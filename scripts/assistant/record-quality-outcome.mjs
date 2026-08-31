import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const historyFile = path.join(projectRoot, 'netlify', 'functions', '_assistant', 'assistant-quality-history.generated.mjs');
const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? String(args[index + 1] || '').trim() : '';
};
const values = (name) => args.flatMap((item, index) => item === `--${name}` ? [String(args[index + 1] || '').trim()] : []).filter(Boolean);
const confirmed = args.includes('--confirmed');

if (!confirmed) throw new Error('Registro bloqueado: use --confirmed somente depois da aprovação explícita do proprietário.');

const reference = value('reference');
const summary = value('summary');
const status = value('status');
const type = value('type') || 'technical-improvement';
const baselineCodeHash = value('baseline-hash').toLowerCase();
const targetCodeHash = value('target-hash').toLowerCase();
const findingIds = values('finding');
const tests = values('test');
if (!/^QA-[A-F0-9]{12}$/i.test(reference)) throw new Error('Referência QA inválida.');
if (!summary || summary.length > 500) throw new Error('Resumo técnico obrigatório, com até 500 caracteres.');
if (!['approved', 'implemented-local', 'verified', 'verification-failed', 'reopened'].includes(status)) throw new Error('Status técnico inválido.');
if (baselineCodeHash && !/^[a-f0-9]{64}$/.test(baselineCodeHash)) throw new Error('Hash de origem inválido.');
if (targetCodeHash && !/^[a-f0-9]{64}$/.test(targetCodeHash)) throw new Error('Hash de destino inválido.');
if (findingIds.some((id) => !/^QF-[A-F0-9]{12}$/.test(id))) throw new Error('Identificador de achado inválido.');
const serializedInput = JSON.stringify({ reference, summary, type, status, findingIds, tests });
if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:sk-|sb_secret_)[A-Za-z0-9_.-]+|\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/gi.test(serializedInput)) throw new Error('O histórico técnico não aceita e-mail, documento ou segredo.');

const imported = await import(`${pathToFileURL(historyFile).href}?v=${Date.now()}`);
const current = imported.default || { version: 1, records: [] };
const snapshotModule = await import(`${pathToFileURL(path.join(projectRoot, 'netlify', 'functions', '_assistant', 'assistant-code-snapshot.generated.mjs')).href}?v=${Date.now()}`);
const snapshot = snapshotModule.default || { findings: [] };
const snapshotById = new Map((snapshot.findings || []).map((finding) => [finding.id, finding]));
const createdAt = new Date().toISOString();
const id = `AQH-${createdAt.replace(/\D/g, '').slice(0, 14)}-${crypto.createHash('sha256').update(`${reference}|${summary}|${createdAt}`).digest('hex').slice(0, 8).toUpperCase()}`;
const record = {
  id,
  type: String(type).slice(0, 60),
  status,
  reference: reference.toUpperCase(),
  baselineCodeHash,
  targetCodeHash,
  summary,
  findings: findingIds.map((findingId) => ({ findingId, recurrenceKey: snapshotById.get(findingId)?.recurrenceKey || '', ruleId: snapshotById.get(findingId)?.ruleId || '' })),
  tests,
  validations: findingIds.map((findingId) => ({ findingId, recurrenceKey: snapshotById.get(findingId)?.recurrenceKey || '', passed: status === 'verified' && tests.length > 0, tests })),
  createdAt
};
const next = { version: 1, storage: 'versioned-repository-ledger', automaticWrites: false, containsCompanyData: false, records: [...(current.records || []), record] };
const output = `// Histórico técnico sanitizado, separado dos dados das empresas.\n// É atualizado somente pelo fluxo de desenvolvimento após aprovação explícita; a IA em execução apenas lê.\nexport default Object.freeze(${JSON.stringify(next, null, 2)});\n`;
fs.writeFileSync(historyFile, output, 'utf8');
console.log(`ASSISTANT_QUALITY_HISTORY_RECORDED: ${id}`);
