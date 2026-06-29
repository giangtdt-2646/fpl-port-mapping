export type Server = 'dev1' | 'dev2' | 'stg4';

export type Role = 'owner' | 'manager' | 'editor' | 'viewer';

export const ROLES: Role[] = ['owner', 'manager', 'editor', 'viewer'];

export interface CreateAccountDto {
  /** Target server. Determines which DB / Cognito pool the account is created in. */
  server: Server;

  /** Account email. Used as the Cognito username and stored on the user_master row. */
  email: string;

  /** Role on the user_master row. */
  role: Role;

  /**
   * Display name stored as user_name. When omitted/null, it defaults to the
   * local part of the email (everything before "@").
   */
  userName?: string | null;

  /**
   * Maintenance-company number. Mutually exclusive with leaseCompanyId.
   * When set, the account is created with user_type = 'maintenanceCompany'
   * (or 'maintenanceNewFront' when isNewFront is true).
   */
  hjnNum?: string | null;

  /**
   * Lease company id. Mutually exclusive with hjnNum.
   * When set, the account is created with user_type = 'lease'.
   */
  leaseCompanyId?: string | null;

  /**
   * When true, create the maintenance-company user with
   * user_type = 'maintenanceNewFront'. Can only be used together with hjnNum.
   * Defaults to false.
   */
  isNewFront?: boolean;

  /** Optional Cognito password. Falls back to the default when omitted. */
  password?: string;
}
