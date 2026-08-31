import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsDirectory, '..');
const outputFile = path.join(projectRoot, 'netlify', 'functions', '_assistant', 'assistant-code-snapshot.generated.mjs');
const allowedExtensions = new Set(['.js', '.mjs', '.cjs', '.html', '.css', '.toml', '.json', '.webmanifest', '.sql', '.xml', '.java', '.kt', '.gradle', '.properties', '.ps1']);
const rootFiles = ['index.html', 'service-worker.js', 'netlify.toml', 'manifest.webmanifest', 'privacidade.html', 'exclusao-de-conta.html'];
const sourceRoots = ['public-assets', path.join('netlify', 'functions'), 'scripts', path.join('supabase', 'migrations'), path.join('android-twa', 'app', 'src')];
const androidRootFiles = ['android-twa/twa-manifest.json', 'android-twa/settings.gradle', 'android-twa/build.gradle', 'android-twa/app/build.gradle', 'android-twa/gradle.properties'];
const excludedSegments = ['/backups/', '/tests/', '/node_modules/', '/deploy-', '/build/', '/.netlify/', '/gradle/wrapper/'];

function walk(relativeDirectory) {
  const absolute = path.join(projectRoot, relativeDirectory);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return walk(relative);
    return [relative];
  });
}

function normalizedPath(value) { return value.split(path.sep).join('/'); }
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function sanitizedSnippet(value) {
  return String(value || '')
    .replace(/-----BEGIN[\s\S]*?PRIVATE KEY-----/gi, '[CHAVE PRIVADA REDIGIDA]')
    .replace(/(?:sk-|sb_secret_)[A-Za-z0-9_.-]+/gi, '[SEGREDO REDIGIDO]')
    .replace(/(api[_-]?key|password|senha|token|secret)\s*[:=]\s*['"`][^'"`]+['"`]/gi, '$1=[VALOR REDIGIDO]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL REDIGIDO]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}
function lineOf(source, index) { return source.slice(0, Math.max(0, index)).split('\n').length; }
function isThirdParty(file) { return /(?:^|\/)(?:vendor|vendors|libs?|pdfjs|jspdf|html2canvas)(?:\/|[.-])/i.test(file) || /(?:\.min\.js$|pdf\.worker)/i.test(file); }
function findingId(ruleId, file, line, occurrence = 0) { return `QF-${hash(`${ruleId}|${file}|${line}|${occurrence}`).slice(0, 12).toUpperCase()}`; }

const candidates = [...rootFiles, ...androidRootFiles, ...sourceRoots.flatMap(walk)]
  .map(normalizedPath)
  .filter((file) => allowedExtensions.has(path.extname(file).toLowerCase()))
  .filter((file) => !file.endsWith('assistant-code-snapshot.generated.mjs'))
  .filter((file) => !file.endsWith('assistant-quality-history.generated.mjs'))
  .filter((file) => !excludedSegments.some((segment) => `/${file}`.includes(segment)))
  .filter((file, index, array) => array.indexOf(file) === index)
  .sort();

const files = [];
const findings = [];
const globalFunctions = new Map();

function addFinding({ ruleId, severity = 'low', status = 'probable', confidence = 'medium', category, title, file, line = 1, occurrence = 0, evidence, probableCause, impact, recommendation, validationPlan }) {
  const scope = isThirdParty(file) ? 'third-party' : 'application';
  findings.push({
    id: findingId(ruleId, file, line, occurrence),
    recurrenceKey: hash(`${ruleId}|${file}`).slice(0, 24),
    ruleId,
    severity: scope === 'third-party' && ['critical', 'high'].includes(severity) ? 'info' : severity,
    status: scope === 'third-party' ? 'opportunity' : status,
    confidence: scope === 'third-party' ? 'low' : confidence,
    category,
    scope,
    title,
    file,
    line,
    evidence: sanitizedSnippet(evidence),
    probableCause: sanitizedSnippet(probableCause || 'O padrão automático precisa ser confirmado no contexto do módulo.'),
    impact: sanitizedSnippet(impact || 'O impacto real depende de reprodução e teste direcionado.'),
    recommendation: sanitizedSnippet(recommendation),
    validationPlan: sanitizedSnippet(validationPlan || 'Reproduzir em ambiente isolado e executar testes de regressão antes de alterar.')
  });
}

for (const file of candidates) {
  const absolute = path.join(projectRoot, file);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
  const source = fs.readFileSync(absolute, 'utf8');
  const lines = source.split(/\r?\n/);
  const functionMatches = [...source.matchAll(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)];
  const localCounts = new Map();
  for (const match of functionMatches) {
    const name = match[1];
    localCounts.set(name, (localCounts.get(name) || 0) + 1);
    if (!globalFunctions.has(name)) globalFunctions.set(name, []);
    globalFunctions.get(name).push({ file, line: lineOf(source, match.index) });
  }
  const fetchCount = (source.match(/\bfetch\s*\(/g) || []).length;
  const domWriteCount = (source.match(/\.innerHTML\s*=|insertAdjacentHTML\s*\(/g) || []).length;
  const inlineHandlerCount = (source.match(/\bon(?:click|change|submit|input)=/g) || []).length;
  const emptyCatchMatches = [...source.matchAll(/catch\s*(?:\([^)]*\))?\s*\{\s*\}/g)];
  const dynamicCodeMatches = [...source.matchAll(/\beval\s*\(|\bnew\s+Function\s*\(/g)];
  const containsSecretDetectionRules = file.endsWith('scripts/generate-assistant-code-snapshot.mjs') || file.endsWith('netlify/functions/_assistant/assistant-quality-auditor.mjs');
  const literalSecretMatches = containsSecretDetectionRules ? [] : [...source.matchAll(/(?:sk-|sb_secret_)[A-Za-z0-9_.-]{12,}|-----BEGIN[\s\S]*?PRIVATE KEY-----/gi)];
  files.push({ path: file, scope: isThirdParty(file) ? 'third-party' : 'application', bytes: Buffer.byteLength(source), lines: lines.length, sha256: hash(source), functions: functionMatches.length, fetches: fetchCount, domWrites: domWriteCount, inlineHandlers: inlineHandlerCount });

  if (Buffer.byteLength(source) > 300000) addFinding({ ruleId: 'maintainability.large-file', severity: 'low', status: 'opportunity', category: 'maintainability', title: 'Arquivo muito grande para manutenção segura', file, line: 1, evidence: `${Buffer.byteLength(source)} bytes e ${lines.length} linhas`, probableCause: 'Muitas responsabilidades ou dependências foram concentradas no mesmo arquivo.', impact: 'Mudanças pequenas podem causar regressões difíceis de isolar.', recommendation: 'Dividir em módulos preservando contratos e testes de regressão.', validationPlan: 'Comparar o comportamento antes/depois e executar todas as suítes relacionadas.' });
  const longLineIndex = lines.findIndex((line) => line.length > 5000);
  if (longLineIndex >= 0) addFinding({ ruleId: 'maintainability.long-line', severity: 'low', status: 'opportunity', category: 'maintainability', title: 'Linha excessivamente extensa', file, line: longLineIndex + 1, evidence: `${lines[longLineIndex].length} caracteres na mesma linha`, probableCause: 'Template, configuração ou biblioteca foi mantido em uma única linha.', impact: 'Revisão, depuração e comparação de alterações ficam mais difíceis.', recommendation: 'Extrair trechos em funções ou templates menores sem alterar o comportamento.', validationPlan: 'Validar sintaxe e renderização visual depois de uma refatoração aprovada.' });
  if (fetchCount > 0 && !/AbortController/.test(source)) addFinding({ ruleId: 'reliability.fetch-without-abort', severity: 'medium', category: 'reliability', title: 'Requisições sem cancelamento explícito no mesmo módulo', file, line: lineOf(source, source.indexOf('fetch(')), evidence: `${fetchCount} chamada(s) fetch; AbortController não localizado`, probableCause: 'A função depende apenas do término natural da rede.', impact: 'Uma conexão lenta pode deixar a interface aguardando ou manter trabalho desnecessário.', recommendation: 'Revisar timeouts e cancelamento antes de considerar alteração.', validationPlan: 'Simular rede lenta/offline e confirmar que a tela recupera o controle sem perder dados.' });
  if (domWriteCount >= 10) addFinding({ ruleId: 'security-ux.dynamic-html-volume', severity: 'medium', category: 'security-ux', title: 'Uso intenso de geração dinâmica de HTML', file, line: 1, evidence: `${domWriteCount} escrita(s) dinâmica(s) de HTML`, probableCause: 'A tela é construída por templates de string e inserções no DOM.', impact: 'Entradas não escapadas podem causar falhas visuais ou risco de injeção.', recommendation: 'Auditar escaping, acessibilidade e duplicações; não substituir sem teste visual.', validationPlan: 'Testar entradas com caracteres especiais e executar revisão visual em todos os tamanhos suportados.' });
  if (inlineHandlerCount >= 20) addFinding({ ruleId: 'maintainability.inline-handlers', severity: 'low', status: 'opportunity', category: 'maintainability', title: 'Muitos eventos declarados dentro do HTML', file, line: 1, evidence: `${inlineHandlerCount} manipulador(es) inline`, probableCause: 'A ligação de eventos cresceu junto com os templates HTML.', impact: 'A manutenção e a política de segurança de conteúdo podem ficar mais complexas.', recommendation: 'Considerar delegação de eventos apenas em refatoração aprovada e coberta por testes.', validationPlan: 'Confirmar todos os cliques, teclado e navegação após qualquer refatoração.' });
  emptyCatchMatches.slice(0, 8).forEach((match, occurrence) => addFinding({ ruleId: 'reliability.empty-catch', severity: 'medium', category: 'reliability', title: 'Erro possivelmente ignorado sem registro', file, line: lineOf(source, match.index), occurrence, evidence: match[0], probableCause: 'A exceção foi silenciada para manter o fluxo da tela.', impact: 'Falhas podem ficar invisíveis e produzir estado inconsistente.', recommendation: 'Explicar o erro ao usuário ou registrar diagnóstico sem expor dados sensíveis.', validationPlan: 'Forçar a falha no caminho isolado e conferir feedback, log sanitizado e recuperação.' }));
  dynamicCodeMatches.slice(0, 8).forEach((match, occurrence) => addFinding({ ruleId: 'security.dynamic-code', severity: 'high', category: 'security', title: 'Execução dinâmica de código exige auditoria', file, line: lineOf(source, match.index), occurrence, evidence: match[0], probableCause: 'Biblioteca ou módulo utiliza avaliação dinâmica para criar funções.', impact: 'Conteúdo controlável externamente pode ampliar risco de execução indevida.', recommendation: 'Confirmar origem, necessidade e controles; remover somente após análise de compatibilidade.', validationPlan: 'Identificar a origem do conteúdo avaliado e executar análise de dependência e testes de PDF/relatório.' }));
  literalSecretMatches.slice(0, 3).forEach((match, occurrence) => addFinding({ ruleId: 'security.literal-secret', severity: 'critical', status: 'probable', confidence: 'high', category: 'security', title: 'Possível segredo literal no código-fonte', file, line: lineOf(source, match.index), occurrence, evidence: '[VALOR SENSÍVEL REDIGIDO]', probableCause: 'Uma credencial pode ter sido incorporada diretamente ao arquivo.', impact: 'Credenciais expostas podem permitir acesso não autorizado.', recommendation: 'Revogar a credencial, mover para variável de ambiente e revisar o histórico do arquivo.', validationPlan: 'Confirmar com o responsável pela infraestrutura sem exibir o valor e executar verificação de segredos.' }));
  if (/security\s+definer/i.test(source) && !/set\s+search_path/i.test(source)) addFinding({ ruleId: 'security.sql-definer-search-path', severity: 'high', category: 'security', title: 'Função SQL privilegiada sem search_path explícito no arquivo', file, line: lineOf(source.toLowerCase(), source.toLowerCase().indexOf('security definer')), evidence: 'SECURITY DEFINER localizado; SET search_path não localizado no mesmo arquivo', probableCause: 'A função privilegiada pode depender do caminho de busca padrão do banco.', impact: 'Objetos inesperados no caminho de busca podem alterar a resolução de nomes.', recommendation: 'Revisar a função e fixar search_path seguro somente após validação da migration.', validationPlan: 'Executar lint SQL e testar permissões/RLS em banco fictício isolado.' });
  for (const [name, count] of localCounts) if (count > 1) addFinding({ ruleId: 'duplication.local-function-name', severity: 'info', status: 'opportunity', category: 'duplication', title: 'Nome de função repetido no mesmo arquivo', file, line: 1, evidence: `${name} aparece ${count} vezes`, probableCause: 'Módulos concatenados ou sobrescritas intencionais compartilham o mesmo nome.', impact: 'Uma definição pode ocultar outra ou dificultar a leitura.', recommendation: 'Verificar se é sobrescrita intencional antes de qualquer consolidação.', validationPlan: 'Mapear cada chamada e comparar comportamento antes de renomear ou consolidar.' });
}

for (const [name, locations] of globalFunctions) {
  const distinctFiles = [...new Set(locations.map((item) => item.file))];
  if (distinctFiles.length >= 4) addFinding({ ruleId: 'duplication.cross-module-name', severity: 'info', status: 'opportunity', category: 'duplication', title: 'Função com o mesmo nome em vários módulos', file: distinctFiles[0], line: locations[0].line, evidence: `${name} aparece em ${distinctFiles.length} arquivos`, probableCause: 'Módulos independentes usam nomes genéricos para responsabilidades possivelmente diferentes.', impact: 'O nome repetido pode confundir manutenção, mas não confirma duplicação de lógica.', recommendation: 'Comparar responsabilidades; nomes iguais não significam necessariamente código duplicado.', validationPlan: 'Comparar assinatura, chamadas e testes de cada módulo antes de qualquer mudança.' });
}

const severityWeight = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
findings.sort((a, b) => (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0) || a.file.localeCompare(b.file) || a.line - b.line);
const aggregateHash = hash(files.map((file) => `${file.path}:${file.sha256}`).join('\n'));
const latestMtime = candidates.reduce((latest, file) => {
  const absolute = path.join(projectRoot, file);
  return fs.existsSync(absolute) ? Math.max(latest, fs.statSync(absolute).mtimeMs) : latest;
}, 0);
const severityCounts = Object.fromEntries(['critical', 'high', 'medium', 'low', 'info'].map((level) => [level, findings.filter((item) => item.severity === level).length]));
const snapshot = {
  version: 2,
  scannerVersion: 'quality-scanner-v1',
  generatedAt: new Date(latestMtime || Date.now()).toISOString(),
  codeHash: aggregateHash,
  coverage: {
    included: ['aplicação web', 'funções de backend', 'service worker e manifestos', 'scripts técnicos', 'migrations SQL', 'fontes e configurações Android'],
    excluded: ['dados de empresa', 'credenciais e arquivos binários', 'backups', 'artefatos de build', 'testes e prévias locais'],
    limitations: ['análise estática não reproduz comportamento em execução', 'sinais precisam de confirmação e testes isolados']
  },
  summary: { fileCount: files.length, totalBytes: files.reduce((sum, file) => sum + file.bytes, 0), totalLines: files.reduce((sum, file) => sum + file.lines, 0), findingCount: findings.length, severityCounts },
  files,
  findings
};
const output = `// Arquivo gerado mecanicamente por scripts/generate-assistant-code-snapshot.mjs.\n// Não contém dados de empresa nem segredos; apenas métricas e evidências sanitizadas do código.\nexport default Object.freeze(${JSON.stringify(snapshot, null, 2)});\n`;
fs.writeFileSync(outputFile, output, 'utf8');
console.log(`ASSISTANT_CODE_SNAPSHOT_OK: ${files.length} arquivos, ${snapshot.summary.totalLines} linhas, ${findings.length} sinais, hash ${aggregateHash.slice(0, 12)}`);
