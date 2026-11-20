/*
 * Client asset pipeline. Bundles the browser TypeScript + CSS into hashed,
 * self-hosted files under public/build/ and writes a manifest the server's
 * asset() helper resolves at render time. Everything ships same-origin because
 * the CSP is `script-src 'self'` — no CDNs, no inline scripts.
 *
 *   node scripts/build-client.mjs          one-shot production build
 *   node scripts/build-client.mjs --watch  dev watch mode (unminified)
 */
import * as esbuild from 'esbuild';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTDIR = path.join(ROOT, 'public', 'build');
const watch = process.argv.includes('--watch');

// Logical name → source entry. Manifest keys are "<name>.<ext>" of the output.
const ENTRIES = {
  boot: 'src/client/boot.ts', // sync <head> script: js/motion-ok classes before first paint
  app: 'src/client/app.ts', // public-site bundle (gsap/lenis live here)
  admin: 'src/client/admin.ts', // admin bundle: nav + confirms only
  styles: 'src/client/styles/app.css',
  print: 'src/client/styles/print.css',
};

// Manifest keys the templates use, keyed by entry name + output extension.
const LOGICAL_NAMES = {
  'boot.js': 'boot.js',
  'app.js': 'app.js',
  'admin.js': 'admin.js',
  'styles.css': 'app.css',
  'print.css': 'print.css',
};

rmSync(OUTDIR, { recursive: true, force: true });
mkdirSync(OUTDIR, { recursive: true });

/** Rebuild manifest.json from an esbuild metafile after every (re)build. */
function writeManifest(metafile) {
  const manifest = {};
  for (const [outfile, meta] of Object.entries(metafile.outputs)) {
    if (!meta.entryPoint) continue; // shared/lazy chunks resolve via import graph
    const entryName = Object.entries(ENTRIES).find(
      ([, src]) => path.resolve(ROOT, src) === path.resolve(ROOT, meta.entryPoint),
    )?.[0];
    if (!entryName) continue;
    const key = LOGICAL_NAMES[`${entryName}${path.extname(outfile)}`];
    if (!key) continue;
    manifest[key] = '/' + path.relative(path.join(ROOT, 'public'), outfile).replace(/\\/g, '/');
  }
  writeFileSync(path.join(OUTDIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

const manifestPlugin = {
  name: 'manifest',
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length === 0 && result.metafile) {
        writeManifest(result.metafile);
        console.log(`[client] built ${Object.keys(result.metafile.outputs).length} files`);
      }
    });
  },
};

/** @type {esbuild.BuildOptions} */
const options = {
  entryPoints: ENTRIES,
  outdir: OUTDIR,
  bundle: true,
  format: 'esm',
  splitting: true, // hero WebGL chunk lazy-loads via dynamic import()
  target: ['es2020'],
  minify: !watch,
  sourcemap: true,
  metafile: true,
  entryNames: '[name].[hash]',
  chunkNames: 'chunks/[name].[hash]',
  assetNames: 'assets/[name].[hash]',
  loader: { '.woff2': 'file', '.svg': 'dataurl', '.glsl': 'text' },
  // Absolute /fonts/... URLs are runtime paths served from public/fonts —
  // pass them through instead of bundling.
  external: ['/fonts/*'],
  logLevel: 'info',
  plugins: [manifestPlugin],
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('[client] watching src/client/ …');
} else {
  await esbuild.build(options);
}
