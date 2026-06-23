import { Injectable, Logger } from '@nestjs/common';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import { Server } from './create-account.dto';
import { getServerConfig } from './server-config';

@Injectable()
export class CognitoService {
  private readonly logger = new Logger(CognitoService.name);
  private readonly clients = new Map<Server, CognitoIdentityProviderClient>();

  private getClient(server: Server): { client: CognitoIdentityProviderClient; userPoolId: string } {
    const { cognito } = getServerConfig(server);
    let client = this.clients.get(server);
    if (!client) {
      client = new CognitoIdentityProviderClient({
        region: cognito.region,
        // A named profile resolves its (assume-role) credentials from the shared
        // AWS config/credentials files. fromIni (not defaultProvider) is used on
        // purpose: it reads ONLY the named profile and ignores AWS_* environment
        // variables, so the per-server profile can't be silently overridden.
        credentials: cognito.profile
          ? fromIni({ profile: cognito.profile })
          : {
              accessKeyId: cognito.accessKeyId!,
              secretAccessKey: cognito.secretAccessKey!,
            },
      });
      this.clients.set(server, client);
    }
    return { client, userPoolId: cognito.userPoolId };
  }

  /**
   * Create a Cognito user and set a permanent password.
   * Mirrors the manual adminCreateUserCommand -> adminSetUserPasswordCommand flow.
   */
  async createUser(server: Server, email: string, password: string): Promise<void> {
    const { client, userPoolId } = this.getClient(server);

    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: email,
        MessageAction: 'SUPPRESS',
      }),
    );
    this.logger.log(`[${server}] Cognito user created: ${email}`);

    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: email,
        Password: password,
        Permanent: true,
      }),
    );
    this.logger.log(`[${server}] Cognito password set: ${email}`);
  }
}
