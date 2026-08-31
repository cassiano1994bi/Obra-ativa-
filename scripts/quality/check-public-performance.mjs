import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const assetsRoot = path.join(projectRoot, 'public-assets');
const failures = [];

const budgets = {
  'obraativa-ui-icons-v2.png': [1254, 1254, 1_530_000],
  'obraativa-app-icon-v2-1024.png': [1024, 1024, 920_000],
  'obraativa-app-icon-v2-source.png': [1254, 1254, 1_170_000],
  'obraativa-ui-works-v2.png': [512, 512, 230_000],
  'obraativa-ui-financial-v2.png': [512, 512, 195_000],
  'obraativa-ui-attendance-v2.png': [512, 512, 195_000],
  'assistant-avatar-v1.png': [384, 384, 160_000],
  'obraativa-launch-screen-v1.png': [482, 223, 95_000],
  'obraativa-app-icon-v2-512.png': [512, 512, 245_000],
  'obraativa-app-icon-v2-192.png': [192, 192, 40_000]
};

function pngDimensions(buffer) {
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') throw new Error('assinatura PNG inválida');
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

for (const [fileName, [expectedWidth, expectedHeight, maximumBytes]] of Object.entries(budgets)) {
  const filePath = path.join(assetsRoot, fileName);
  if (!fs.existsSync(filePath)) {
    failures.push(`${fileName}: arquivo ausente`);
    continue;
  }
  const source = fs.readFileSync(filePath);
  const [width, height] = pngDimensions(source);
  if (width !== expectedWidth || height !== expectedHeight) failures.push(`${fileName}: dimensões alteradas`);
  if (source.length > maximumBytes) failures.push(`${fileName}: ${source.length} bytes excedem ${maximumBytes}`);
}

const pngTotal = fs.readdirSync(assetsRoot)
  .filter((fileName) => fileName.toLowerCase().endsWith('.png'))
  .reduce((total, fileName) => total + fs.statSync(path.join(assetsRoot, fileName)).size, 0);
if (pngTotal > 4_900_000) failures.push(`PNG públicos: ${pngTotal} bytes excedem 4.900.000`);

const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
for (const marker of [
  /class="public-work-card"[\s\S]{0,180}<img[^>]+loading="lazy" decoding="async"/,
  /class="portfolio-image"[^>]+loading="lazy" decoding="async"/
]) {
  if (!marker.test(html)) failures.push('index.html: imagem pública abaixo da dobra sem carregamento otimizado');
}

if (failures.length) {
  console.error('PUBLIC_PERFORMANCE_FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PUBLIC_PERFORMANCE_OK: ${Object.keys(budgets).length} ativos dentro do orçamento e ${pngTotal} bytes em PNG públicos.`);
