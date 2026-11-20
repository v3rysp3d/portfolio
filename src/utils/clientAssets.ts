import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { APP_ROOT } from '../config/env';

/**
 * Resolves logical client asset names ("app.css", "boot.js") to the hashed
 * filenames produced by scripts/build-client.mjs. Hashed names + the 1-day
 * static cache mean deploys never serve stale assets. In production the
 * manifest is read once; in development it re-reads when the file changes so
 * the esbuild watcher's output is picked up without restarting the server.
 */
const MANIFEST_PATH = path.join(APP_ROOT, 'public', 'build', 'manifest.json');
const isProduction = process.env.NODE_ENV === 'production';

let cache: Record<string, string> | null = null;
let cachedMtimeMs = 0;
const warned = new Set<string>();

export function asset(logical: string): string {
  try {
    if (!cache || !isProduction) {
      const mtimeMs = statSync(MANIFEST_PATH).mtimeMs;
      if (!cache || mtimeMs !== cachedMtimeMs) {
        cache = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Record<string, string>;
        cachedMtimeMs = mtimeMs;
      }
    }
    const mapped = cache[logical];
    if (mapped) return mapped;
  } catch {
    // Manifest missing (client build not run yet) — fall through to the
    // unhashed path so the server still boots; the console warning explains
    // the 404s the browser will see.
  }
  if (!warned.has(logical)) {
    console.warn(`[assets] manifest has no entry for "${logical}" — run the client build`);
    warned.add(logical);
  }
  return `/build/${logical}`;
}
