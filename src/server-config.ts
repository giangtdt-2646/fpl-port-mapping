import { Server } from './create-account.dto';

export interface ServerConfig {
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  cognito: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    userPoolId: string;
    clientId: string;
  };
  /** SSH tunnel parameters for reaching the (private) Aurora endpoint via the bastion. */
  tunnel: {
    bastion: string; // user@host
    localPort: number;
    remoteHost: string;
    remotePort: number;
  };
}

const COGNITO_REGION = 'ap-northeast-1';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Build the DB + Cognito config for a server from the *_DEV1 / *_DEV2 env vars. */
export function getServerConfig(server: Server): ServerConfig {
  const suffix = server.toUpperCase(); // DEV1 | DEV2
  const localPort = Number(required(`DB_PORT_${suffix}`));
  return {
    db: {
      host: process.env.DB_ENDPOINT || 'localhost',
      port: localPort,
      user: required(`DB_USERNAME_${suffix}`),
      password: required(`DB_PASSWORD_${suffix}`),
      database: required(`DB_NAME_${suffix}`),
    },
    cognito: {
      region: COGNITO_REGION,
      accessKeyId: required(`AWS_ACCESS_KEY_ID_${suffix}`),
      secretAccessKey: required(`AWS_SECRET_ACCESS_KEY_${suffix}`),
      userPoolId: required(`AWS_COGNITO_USER_POOL_ID_${suffix}`),
      clientId: required(`AWS_COGNITO_CLIENT_ID_${suffix}`),
    },
    tunnel: {
      bastion: required(`SSH_BASTION_${suffix}`),
      localPort,
      remoteHost: required(`DB_REMOTE_HOST_${suffix}`),
      remotePort: Number(process.env[`DB_REMOTE_PORT_${suffix}`] || 5432),
    },
  };
}
