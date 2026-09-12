/**
 * Static wiring check — runs alongside the map validator (`npm run validate`).
 *
 * There is no build step and no bundler, so nothing catches a typo'd import
 * path, a HUD element that was renamed in index.html, or a `?v=N` cache
 * buster that was only bumped in some files. This script does.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const warnings = [];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const p = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const jsFiles = walk(resolve(ROOT, 'js'));
const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');

// ---- 1. every relative import resolves, and cache-buster versions agree ----
const versions = new Map(); // version -> [file...]
for (const file of jsFiles) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);

  for (const m of src.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
    const spec = m[1];
    if (!spec.startsWith('.')) continue;              // 'three' comes from the import map
    const clean = spec.split('?')[0].split('#')[0];
    const target = resolve(dirname(file), clean);
    if (!existsSync(target)) problems.push(`${rel}: import "${spec}" does not resolve to a file`);
  }
  for (const m of src.matchAll(/import\s+['"]([^'"]+)['"]/g)) {
    const spec = m[1];
    if (!spec.startsWith('.')) continue;
    const target = resolve(dirname(file), spec.split('?')[0]);
    if (!existsSync(target)) problems.push(`${rel}: side-effect import "${spec}" does not resolve`);
  }
  for (const m of src.matchAll(/\?v=(\d+)/g)) {
    if (!versions.has(m[1])) versions.set(m[1], []);
    versions.get(m[1]).push(rel);
  }
}

for (const m of html.matchAll(/\?v=(\d+)/g)) {
  if (!versions.has(m[1])) versions.set(m[1], []);
  versions.get(m[1]).push('index.html');
}

if (versions.size > 1) {
  const detail = [...versions.entries()]
    .map(([v, files]) => `v${v} in ${files.length} place(s) (e.g. ${files[0]})`)
    .join(', ');
  problems.push(
    `cache-buster versions are mixed (${detail}). Every import specifier and the ` +
    `index.html script tag must use the same ?v=N — see README "Cache note".`
  );
}

// ---- 2. every DOM id the JS looks up exists in index.html ----
const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
const lookedUp = new Map(); // id -> [file...]
for (const file of jsFiles) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);
  const patterns = [/\$\(\s*'([^']+)'\s*\)/g, /getElementById\(\s*'([^']+)'\s*\)/g];
  for (const re of patterns) {
    for (const m of src.matchAll(re)) {
      if (!lookedUp.has(m[1])) lookedUp.set(m[1], []);
      lookedUp.get(m[1]).push(rel);
    }
  }
}
for (const [id, files] of lookedUp) {
  if (!htmlIds.has(id)) problems.push(`index.html is missing id="${id}" (looked up by ${files[0]})`);
}

// ---- 3. class-based selectors the HUD binds to ----
for (const cls of ['btn-menu']) {
  const re = new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"`);
  if (!re.test(html)) problems.push(`index.html has no element with class "${cls}" (bound in hud.js)`);
}

// ---- 4. every html id that the JS never uses is just a warning ----
const knownStatic = new Set(['app', 'hud', 'fatal', 'scope-overlay', 'crosshair', 'hitmarker',
  'dmg-indicators', 'banner', 'msg', 'top-left', 'bottom-left', 'bottom-right',
  'health-bar', 'ammo-row', 'ammo-sep', 'reload-bar', 'reload-fill', 'reload-hint',
  'grenade-row', 'slots', 'menu-screen', 'pause-screen', 'gameover-screen', 'victory-screen']);
for (const id of htmlIds) {
  if (!lookedUp.has(id) && !knownStatic.has(id)) warnings.push(`index.html id="${id}" is never referenced by JS`);
}

console.log('NEON COMPOUND — wiring check\n');
console.log(`  ${jsFiles.length} module(s), ${htmlIds.size} DOM id(s), cache-buster v${[...versions.keys()].join('/v')}`);

if (warnings.length) {
  console.log('\nwarnings');
  for (const w of warnings) console.log(`  ! ${w}`);
}
if (problems.length) {
  console.log('\nFAILURES');
  for (const p of problems) console.log(`  x ${p}`);
  process.exitCode = 1;
} else {
  console.log('\nWiring OK: imports resolve, HUD ids present, cache busters consistent.');
}
