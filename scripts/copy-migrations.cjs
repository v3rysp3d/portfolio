// Copies SQL migration files into the compiled output so `npm start` (which runs
// dist/) can find them. tsc only emits .js, not the .sql assets next to them.
const fs = require('node:fs');
const path = require('node:path');

const srcDir = path.join(__dirname, '..', 'src', 'db', 'migrations');
const destDir = path.join(__dirname, '..', 'dist', 'db', 'migrations');

fs.mkdirSync(destDir, { recursive: true });

let copied = 0;
for (const file of fs.readdirSync(srcDir)) {
  if (!file.endsWith('.sql')) continue;
  fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
  copied += 1;
}

console.log(`[build] copied ${copied} migration file(s) to dist/db/migrations`);
