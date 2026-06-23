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
   * Maintenance-company number. Mutually exclusive with lease_company_id.
   * When set, the account is created with user_type = 'maintenanceCompany'.
   */
  hjn_num?: string | null;

  /**
   * Lease company id. Mutually exclusive with hjn_num.
   * When set, the account is created with user_type = 'lease'.
   */
  lease_company_id?: string | null;

  /** Optional Cognito password. Falls back to the default when omitted. */
  password?: string;
}
