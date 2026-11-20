declare module 'better-sqlite3-session-store' {
  import type session from 'express-session';
  import type { Store } from 'express-session';

  interface SqliteStoreOptions {
    /** A better-sqlite3 Database instance. */
    client: unknown;
    expired?: {
      clear?: boolean;
      intervalMs?: number;
    };
  }

  interface SqliteStoreConstructor {
    new (options: SqliteStoreOptions): Store;
  }

  function connectSqlite3(s: typeof session): SqliteStoreConstructor;
  export = connectSqlite3;
}
