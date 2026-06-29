# fpl-port-mapping

A small [NestJS](https://nestjs.com/) service that automates account creation for the FPL project across multiple environments. It creates an [AWS Cognito](https://aws.amazon.com/cognito/) user and the matching `user_master` row in the environment's Aurora (PostgreSQL) database in one call, opening an SSH tunnel to the private database automatically.

## Supported servers

| Server | Cognito auth          | Notes                                              |
| ------ | --------------------- | -------------------------------------------------- |
| `dev1` | Static IAM keys       |                                                    |
| `dev2` | Static IAM keys       |                                                    |
| `stg4` | Named profile (assume-role) | Reaches its account via `source_profile` → `role_arn` |

Each server's DB and Cognito settings come from suffixed environment variables (`*_DEV1`, `*_DEV2`, `*_STG4`).

## How it works

`POST /api/fpl-support/create-account` runs the following for the requested server:

1. **Tunnel** – ensures the local DB port is reachable, auto-starting an SSH tunnel through the bastion (`SSH_BASTION_<SERVER>`) if it is down.
2. **Duplicate check** – rejects the request if an active (`del_flg = false`) account with the same email already exists.
3. **Cognito** – creates the user and sets a permanent password (`AdminCreateUser` → `AdminSetUserPassword`).
4. **Database** – inserts the `user_master` row and returns it.

Credentials are resolved per server: static keys for DEV1/DEV2, and a named AWS profile for STG4 (via `fromIni`, which reads only that profile and ignores ambient `AWS_*` environment variables).

## API

### Create an account

```
POST /api/fpl-support/create-account
Content-Type: application/json
```

| Field             | Required | Description                                                              |
| ----------------- | -------- | ------------------------------------------------------------------------ |
| `server`          | yes      | `dev1` \| `dev2` \| `stg4`                                               |
| `email`           | yes      | Account email; used as the Cognito username.                             |
| `role`            | yes      | `owner` \| `manager` \| `editor` \| `viewer`                            |
| `hjnNum`          | one of   | Maintenance-company number. Sets `user_type = maintenanceCompany`.       |
| `leaseCompanyId`  | one of   | Lease company id. Sets `user_type = lease`.                              |
| `isNewFront`      | no       | Boolean, defaults to `false`. When `true`, sets `user_type = maintenanceNewFront`. Only allowed together with `hjnNum`. |
| `userName`        | no       | Display name. Defaults to the local part of the email.                   |
| `password`        | no       | Cognito password. Falls back to the default when omitted.                |

Exactly one of `hjnNum` / `leaseCompanyId` must be provided.

Example:

```bash
curl --location 'http://localhost:3002/api/fpl-support/create-account' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "server": "stg4",
    "email": "someone@example.com",
    "userName": "Some One",
    "role": "owner",
    "leaseCompanyId": "013"
  }'
```

Response (`201`):

```json
{
  "server": "stg4",
  "userId": 213711,
  "email": "someone@example.com",
  "userName": "Some One",
  "userType": "lease",
  "role": "owner",
  "hjnNum": null,
  "leaseCompanyId": "013"
}
```

### Port mapping

`POST /api/fpl-port-mapping/dev1` and `/dev2` run the target-group port-mapping script on the corresponding bastion. (DEV only.)

## Configuration

Copy `.env.example` to `.env` and fill in the values. Per server you need:

- **DB / tunnel**: `DB_PORT_<SERVER>`, `DB_USERNAME_<SERVER>`, `DB_PASSWORD_<SERVER>`, `DB_NAME_<SERVER>`, `SSH_BASTION_<SERVER>`, `DB_REMOTE_HOST_<SERVER>`
- **Cognito**: `AWS_COGNITO_USER_POOL_ID_<SERVER>`, `AWS_COGNITO_CLIENT_ID_<SERVER>`
- **Credentials**: either `AWS_ACCESS_KEY_ID_<SERVER>` + `AWS_SECRET_ACCESS_KEY_<SERVER>` (DEV1/DEV2), **or** `AWS_PROFILE_<SERVER>` (STG4). When a profile is set it takes precedence.

The service listens on `PORT` (default **3002**). `DB_ENDPOINT` is the host the tunnel forwards to locally (default `localhost`).

### STG4 AWS profile

STG4 authenticates by assuming a role rather than with static keys. Configure the profile in `~/.aws/config` + `~/.aws/credentials`:

```ini
# ~/.aws/config
[profile refpl-stg]
source_profile = refpl-dev
role_arn       = arn:aws:iam::535325915171:role/fpls-stg-switch-admin-role
region         = ap-northeast-1
```

```ini
# ~/.aws/credentials
[refpl-dev]
aws_access_key_id     = <DEV account access key>
aws_secret_access_key = <DEV account secret>
```

Verify the chain resolves before running the app:

```bash
aws sts get-caller-identity --profile refpl-stg
```

## SSH tunnel

The service opens the tunnel for you, but the bastion must be reachable with key-based auth (it runs `ssh` in `BatchMode`). You can also open it manually:

```bash
ssh $SSH_BASTION_STG4 -L 0.0.0.0:$DB_PORT_STG4:$DB_REMOTE_HOST_STG4:5432 -N
```

## Development

```bash
npm install        # install dependencies

npm run start:dev  # watch mode
npm run start      # development
npm run build      # compile to dist/
npm run start:prod # run the compiled build (node dist/main)

npm run lint       # eslint --fix
npm run test       # unit tests
npm run test:e2e   # e2e tests
```

## Project structure

| File                      | Responsibility                                           |
| ------------------------- | -------------------------------------------------------- |
| `account.controller.ts`   | `POST /api/fpl-support/create-account` endpoint.         |
| `account.service.ts`      | Orchestrates validation → tunnel → Cognito → DB insert.  |
| `cognito.service.ts`      | Cognito user creation / password (per-server client).    |
| `tunnel.service.ts`       | Starts and manages the SSH tunnels.                      |
| `server-config.ts`        | Builds per-server DB / Cognito / tunnel config from env. |
| `create-account.dto.ts`   | Request shape, `Server` and `Role` types.                |
| `app.controller.ts`       | Port-mapping endpoints.                                  |
