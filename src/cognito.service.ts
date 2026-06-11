import { Injectable, Logger } from '@nestjs/common';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
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
        credentials: {
          accessKeyId: cognito.accessKeyId,
          secretAccessKey: cognito.secretAccessKey,
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
