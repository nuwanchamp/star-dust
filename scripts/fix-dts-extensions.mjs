// tsc emits extensionless relative imports in .d.ts files (the source uses bundler resolution).
// Consumers on `moduleResolution: node16/nodenext` need explicit `.js` — add it.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? 'dist-lib/types';
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.d.ts') ? [p] : [];
  });

for (const file of walk(root)) {
  const src = readFileSync(file, 'utf8');
  const out = src.replace(
    /(from\s+|import\()(['"])(\.{1,2}\/[^'"]+?)(?<!\.js)\2/g,
    (_, kw, q, spec) => `${kw}${q}${spec}.js${q}`
  );
  if (out !== src) writeFileSync(file, out);
}
