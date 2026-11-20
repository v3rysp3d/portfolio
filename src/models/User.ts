/** An admin account. The password hash never leaves the repository layer. */
export interface User {
  id: number;
  username: string;
  passwordHash: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
  last_login_at: string | null;
}

/** Safe projection of a user for storing in the session (no secrets). */
export interface SessionUser {
  id: number;
  username: string;
}

export function mapUserRow(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}
