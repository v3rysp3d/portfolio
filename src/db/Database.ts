import fs from 'node:fs';
import path from 'node:path';
import BetterSqlite3 from 'better-sqlite3';

export type SqliteConnection = BetterSqlite3.Database;

/**
 * Owns the single SQLite connection and applies file-based migrations.
 *
 * Encapsulating connection setup here keeps the rest of the codebase ignorant of
 * the concrete driver: repositories depend only on the {@link SqliteConnection}
 * surface, so swapping the storage engine (e.g. RDS/Postgres on AWS) means
 * replacing this class and the repositories, not the services or controllers.
 */
export class Database {
  private readonly db: SqliteConnection;

  constructor(databasePath: string) {
    this.ensureParentDirectory(databasePath);

    this.db = new BetterSqlite3(databasePath);
    // Pragmas for a server workload: WAL for concurrent reads during writes,
    // enforced foreign keys, and a busy timeout so brief lock contention retries
    // instead of throwing.
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');

    this.migrate();
  }

  /** The underlying driver connection, for repositories to prepare statements. */
  get connection(): SqliteConnection {
    return this.db;
  }

  /** Closes the connection. Call on graceful shutdown. */
  close(): void {
    this.db.close();
  }

  private ensureParentDirectory(databasePath: string): void {
    const dir = path.dirname(databasePath);
    fs.mkdirSync(dir, { recursive: true });
  }

  /**
   * Applies any migration files in `./migrations` that have not yet run, in
   * lexical order, each inside its own transaction. Applied filenames are
   * recorded in `_migrations` so re-runs are idempotent.
   */
  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) return;

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const isApplied = this.db.prepare('SELECT 1 FROM _migrations WHERE filename = ?');
    const recordApplied = this.db.prepare('INSERT INTO _migrations (filename) VALUES (?)');

    for (const file of files) {
      if (isApplied.get(file)) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const runMigration = this.db.transaction(() => {
        this.db.exec(sql);
        recordApplied.run(file);
      });
      runMigration();
      // eslint-disable-next-line no-console
      console.log(`[db] applied migration: ${file}`);
    }
  }
}
