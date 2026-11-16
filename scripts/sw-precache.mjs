// After `expo export -p web`: write the build's file list and a version into dist/sw.js so the service worker
// saves every screen up front. Run: node scripts/sw-precache.mjs <dist-dir>
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'dist';
const swPath = join(dir, 'sw.js');
const files = readdirSync(dir, { recursive: true, withFileTypes: true })
  .filter((f) => f.isFile())
  .map((f) => '/' + join(f.parentPath, f.name).slice(dir.length + 1).replaceAll('\\', '/'))
  .filter((p) => !p.endsWith('.map') && !['/sw.js', '/index.html', '/metadata.json'].includes(p))
  .sort();
const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12);

const sw = readFileSync(swPath, 'utf8');
const out = sw.replace("const VERSION = 'dev';", `const VERSION = '${version}';`).replace('const PRECACHE = [];', `const PRECACHE = ${JSON.stringify(files)};`);
if (!out.includes(`'${version}'`) || out.includes('const PRECACHE = [];')) {
  console.error('sw-precache: placeholders not found in dist/sw.js');
  process.exit(1);
}
writeFileSync(swPath, out);
console.log(`sw-precache: ${files.length} files, version ${version}`);
