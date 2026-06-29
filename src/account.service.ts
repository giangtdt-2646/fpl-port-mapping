import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Client } from 'pg';
import { CognitoService } from './cognito.service';
import { TunnelService } from './tunnel.service';
import { CreateAccountDto, ROLES, Server } from './create-account.dto';
import { getServerConfig } from './server-config';

const DEFAULT_PASSWORD = 'Aa!123456';
const USER_TABLE = 'user_management.mfpdg012_user_master';

type UserType = 'lease' | 'maintenanceCompany' | 'maintenanceNewFront';

export interface CreateAccountResult {
  server: Server;
  userId: number;
  email: string;
  userName: string;
  userType: UserType;
  role: string;
  hjnNum: string | null;
  leaseCompanyId: string | null;
}

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly cognito: CognitoService,
    private readonly tunnel: TunnelService,
  ) {}

  async createAccount(body: CreateAccountDto): Promise<CreateAccountResult> {
    const dto = this.validate(body);
    const userType: UserType = dto.hjnNum
      ? dto.isNewFront
        ? 'maintenanceNewFront'
        : 'maintenanceCompany'
      : 'lease';
    const password = dto.password || DEFAULT_PASSWORD;
    // Default user_name to the local part of the email (before "@") when not given.
    const userName = dto.userName?.trim() || dto.email.split('@')[0];

    // Make sure the DB is reachable (auto-start the SSH tunnel if the port is down).
    await this.tunnel.ensureTunnel(dto.server);

    // Enforce the documented invariant: an email must not exist more than once
    // with del_flg = false (the email index is non-unique, so the DB won't block it).
    // Checked before Cognito so we don't leave an orphaned Cognito user.
    if (await this.activeEmailExists(dto.server, dto.email)) {
      throw new ConflictException(
        `An active account with email "${dto.email}" already exists on ${dto.server}`,
      );
    }

    // 1. Cognito: create user + set permanent password (matches the manual flow).
    try {
      await this.cognito.createUser(dto.server, dto.email, password);
    } catch (error) {
      const name = (error as { name?: string })?.name;
      if (name === 'UsernameExistsException') {
        throw new ConflictException(
          `Cognito user already exists on ${dto.server}: ${dto.email}`,
        );
      }
      this.logger.error(`[${dto.server}] Cognito createUser failed: ${String(error)}`);
      throw new InternalServerErrorException(
        `Cognito user creation failed on ${dto.server}: ${(error as Error).message}`,
      );
    }

    // 2. DB: insert the user_master row.
    try {
      const row = await this.insertUserMaster(dto.server, {
        hjn_num: dto.hjnNum ?? null,
        lease_company_id: dto.leaseCompanyId ?? null,
        email: dto.email,
        role: dto.role,
        userType,
        userName,
      });
      this.logger.log(`[${dto.server}] user_master inserted: user_id=${row.user_id}`);
      return {
        server: dto.server,
        userId: row.user_id,
        email: dto.email,
        userName,
        userType,
        role: dto.role,
        hjnNum: dto.hjnNum ?? null,
        leaseCompanyId: dto.leaseCompanyId ?? null,
      };
    } catch (error) {
      // The Cognito user was already created above; surface that so it can be cleaned up.
      this.logger.error(`[${dto.server}] user_master insert failed: ${String(error)}`);
      throw new InternalServerErrorException(
        `Cognito user "${dto.email}" was created on ${dto.server}, but the DB insert failed: ` +
          `${(error as Error).message}. Remove the Cognito user before retrying.`,
      );
    }
  }

  /** True if a non-deleted (del_flg = false) row with this email already exists. */
  private async activeEmailExists(server: Server, email: string): Promise<boolean> {
    const { db } = getServerConfig(server);
    const client = new Client(db);
    await client.connect();
    try {
      const result = await client.query(
        `SELECT 1 FROM ${USER_TABLE} WHERE email = $1 AND del_flg = false LIMIT 1`,
        [email],
      );
      return (result.rowCount ?? 0) > 0;
    } finally {
      await client.end();
    }
  }

  private async insertUserMaster(
    server: Server,
    data: {
      hjn_num: string | null;
      lease_company_id: string | null;
      email: string;
      role: string;
      userType: UserType;
      userName: string;
    },
  ): Promise<{ user_id: number }> {
    const { db } = getServerConfig(server);
    const client = new Client(db);
    await client.connect();
    try {
      const result = await client.query<{ user_id: number }>(
        `INSERT INTO ${USER_TABLE}
           (hjn_num, lease_company_id, email, user_name, role, user_type,
            login_flg, registered_flg, del_flg, invoice_send_flg, maintenance_send_flg)
         VALUES ($1, $2, $3, $4, $5, $6, true, true, false, true, true)
         RETURNING user_id`,
        [data.hjn_num, data.lease_company_id, data.email, data.userName, data.role, data.userType],
      );
      return result.rows[0];
    } finally {
      await client.end();
    }
  }

  /** Validate the body and normalise empty strings to null. */
  private validate(body: CreateAccountDto): CreateAccountDto {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Request body is required');
    }

    if (body.server !== 'dev1' && body.server !== 'dev2' && body.server !== 'stg4') {
      throw new BadRequestException(`server must be "dev1", "dev2" or "stg4"`);
    }

    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!email) {
      throw new BadRequestException('email is required');
    }

    if (!ROLES.includes(body.role)) {
      throw new BadRequestException(`role must be one of: ${ROLES.join(', ')}`);
    }

    const hjnNum = body.hjnNum?.toString().trim() || null;
    const leaseCompanyId = body.leaseCompanyId?.toString().trim() || null;
    const isNewFront = body.isNewFront === true;

    if (hjnNum && leaseCompanyId) {
      throw new BadRequestException(
        'Provide either hjnNum or leaseCompanyId, not both',
      );
    }
    if (!hjnNum && !leaseCompanyId) {
      throw new BadRequestException(
        'Either hjnNum or leaseCompanyId is required',
      );
    }
    if (isNewFront && !hjnNum) {
      throw new BadRequestException(
        'isNewFront can only be used together with hjnNum',
      );
    }

    return { ...body, email, hjnNum, leaseCompanyId, isNewFront };
  }
}
