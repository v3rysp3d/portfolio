/*
 * One-off rasterizer: assets/og.svg → public/og.png (1200×630).
 * Run with `npm run og` after editing the SVG; the PNG is committed, so
 * nothing renders at runtime and no external fetch ever happens.
 */
const { Resvg } = require('@resvg/resvg-js');
const { readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const svg = readFileSync(path.join(root, 'assets', 'og.svg'), 'utf8');

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1200 },
  font: { loadSystemFonts: true },
  background: '#0b0c0f',
});
const png = resvg.render().asPng();
writeFileSync(path.join(root, 'public', 'og.png'), png);
console.log(`[og] wrote public/og.png (${(png.length / 1024).toFixed(1)} KB)`);
