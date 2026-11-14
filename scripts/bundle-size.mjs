// Total gzipped JS in a web export vs a budget. Run: node scripts/bundle-size.mjs <dist-dir> <max-kB>
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const [dir = 'dist', max] = process.argv.slice(2);
if (!max) {
  console.error('usage: node scripts/bundle-size.mjs <dist-dir> <max-kB>');
  process.exit(2);
}
const files = existsSync(dir) ? readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('.js')) : [];
if (files.length === 0) {
  console.error(`bundle-size: no .js files in ${dir}; run npm run build:web first`);
  process.exit(2);
}
const kB = files.reduce((sum, f) => sum + gzipSync(readFileSync(join(dir, f))).length, 0) / 1024;
console.log(`bundle-size: ${kB.toFixed(1)} kB gzipped JS (budget ${max} kB)`);
process.exit(kB <= Number(max) ? 0 : 1);
