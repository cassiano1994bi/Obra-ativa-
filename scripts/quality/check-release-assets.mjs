import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const failures = [];
const checked = new Set();

function localPath(reference) {
  const clean = reference.split(/[?#]/, 1)[0].replace(/^\//, '');
  if (!clean || /^(?:data:|blob:|https?:|#)/i.test(reference)) return null;
  return clean;
}

function requireFile(reference, owner) {
  const relativePath = localPath(reference);
  if (!relativePath) return;
  checked.add(relativePath);
  if (!fs.existsSync(path.join(projectRoot, relativePath))) failures.push(`${owner}: referência ausente ${relativePath}`);
}

const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
for (const match of html.matchAll(/<(?:script|link)\b[^>]+(?:src|href)="([^"]+)"/g)) requireFile(match[1], 'index.html');

for (const fileName of fs.readdirSync(path.join(projectRoot, 'public-assets')).filter((name) => name.endsWith('.css'))) {
  const source = fs.readFileSync(path.join(projectRoot, 'public-assets', fileName), 'utf8');
  for (const match of source.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
    const reference = match[1];
    if (/^(?:data:|blob:|https?:|#)/i.test(reference)) continue;
    requireFile(`public-assets/${reference}`, `public-assets/${fileName}`);
  }
}

const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'manifest.webmanifest'), 'utf8'));
for (const icon of manifest.icons || []) requireFile(icon.src, 'manifest.webmanifest');
for (const shortcut of manifest.shortcuts || []) {
  for (const icon of shortcut.icons || []) requireFile(icon.src, 'manifest.webmanifest');
}

const serviceWorker = fs.readFileSync(path.join(projectRoot, 'service-worker.js'), 'utf8');
for (const match of serviceWorker.matchAll(/['"](\/(?:index\.html|manifest\.webmanifest|public-assets\/[^'"]+))['"]/g)) {
  requireFile(match[1], 'service-worker.js');
}

if (failures.length) {
  console.error('RELEASE_ASSETS_FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`RELEASE_ASSETS_OK: ${checked.size} dependências locais válidas em HTML, CSS, manifesto e cache.`);
