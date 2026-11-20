import type { SqliteConnection } from '../db/Database';
import { mapUserRow, type User, type UserRow } from '../models/User';

/** Data-access for admin accounts. */
export class UserRepository {
  constructor(private readonly db: SqliteConnection) {}

  findByUsername(username: string): User | null {
    const row = this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
      | UserRow
      | undefined;
    return row ? mapUserRow(row) : null;
  }

  findById(id: number): User | null {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    return row ? mapUserRow(row) : null;
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
    return row.n;
  }

  create(username: string, passwordHash: string): User {
    const info = this.db
      .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
      .run(username, passwordHash);
    const created = this.findById(Number(info.lastInsertRowid));
    if (!created) throw new Error('Failed to load user immediately after insert');
    return created;
  }

  updatePassword(id: number, passwordHash: string): void {
    this.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
  }

  markLogin(id: number): void {
    this.db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(id);
  }
}
