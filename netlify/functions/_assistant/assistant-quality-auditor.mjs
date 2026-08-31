import codeSnapshot from './assistant-code-snapshot.generated.mjs';
import qualityHistory from './assistant-quality-history.generated.mjs';
import marketBenchmark from './assistant-market-benchmark.mjs';

const SEVERITY_ORDER = Object.freeze({ critical: 5, high: 4, medium: 3, low: 2, info: 1 });
const SEVERITY_LABEL = Object.freeze({ critical: 'CRÍTICA', high: 'ALTA', medium: 'MÉDIA', low: 'BAIXA', info: 'INFORMATIVA' });
const QUALITY_INTENTS = new Set(['full_audit', 'verify', 'history', 'market', 'codex_prompt', 'approval']);

function clean(value, max = 900) {
  return String(value || '')
    .replace(/-----BEGIN[\s\S]*?PRIVATE KEY-----/gi, '[CHAVE REDIGIDA]')
    .replace(/(?:sk-|sb_secret_)[A-Za-z0-9_.-]+/gi, '[SEGREDO REDIGIDO]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL REDIGIDO]')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, max);
}
function normalized(value) { return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function unique(values) { return [...new Set(values.filter(Boolean))]; }
function productAdmins(env = process.env) { return new Set(String(env.PRODUCT_ADMIN_EMAILS || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)); }

export function assertQualityAuditAdmin(user = {}, env = process.env, verifiedProductAdmin = false) {
  if (verifiedProductAdmin === true) return;
  const admins = productAdmins(env);
  if (user.email && admins.has(String(user.email).trim().toLowerCase())) return;
  const error = new Error('Somente o administrador do aplicativo pode solicitar a varredura completa do sistema.');
  error.code = 'QUALITY_AUDIT_FORBIDDEN';
  throw error;
}

export function detectQualityIntent(question) {
  const text = normalized(question);
  if (/\baprovo\b.*\b(?:qa|audit)-[a-f0-9-]{6,32}\b/.test(text)) return 'approval';
  if (/\b(verifique|verificar|confira|confirmar|validar|valide)\b.*\b(corrigid\w*|resolvid\w*|correc\w*|problemas?|bugs?|achados?)\b|\bpos[- ]?correcao\b/.test(text)) return 'verify';
  if (/\b(historico|recorrencia|recorrente|bugs corrigidos|melhorias aplicadas|recomendacoes anteriores)\b/.test(text)) return 'history';
  if (/\b(mercado|concorrente|procore|buildertrend|sienge|autodesk|inovacao|vender mais|benchmark)\b/.test(text)) return 'market';
  if (/\b(prompt)\b.*\b(codex|corrigir|correcao)\b|\bgerar\b.*\bprompt\b/.test(text)) return 'codex_prompt';
  return 'full_audit';
}

export function safeQualityContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const findings = Array.isArray(value.findings) ? value.findings.slice(0, 260).map((item) => ({
    id: clean(item?.id, 40),
    recurrenceKey: clean(item?.recurrenceKey, 40),
    ruleId: clean(item?.ruleId, 80),
    severity: SEVERITY_ORDER[item?.severity] ? item.severity : 'info',
    file: clean(item?.file, 240),
    line: Math.max(1, Math.floor(Number(item?.line || 1)))
  })).filter((item) => /^QF-[A-F0-9]{12}$/.test(item.id)) : [];
  return Object.freeze({
    reference: clean(value.reference, 60),
    codeHash: clean(value.codeHash, 80).toLowerCase(),
    scannerVersion: clean(value.scannerVersion, 60),
    findings: Object.freeze(findings.map(Object.freeze))
  });
}

function codexPrompt(finding, reference) {
  const recurrence = finding.recurrenceCount > 0 ? ` Este padrão já consta ${finding.recurrenceCount} vez(es) no histórico técnico; proponha um teste preventivo para evitar nova recorrência.` : '';
  return clean(`Projeto Controle de Obra. Referência ${reference}, achado ${finding.id}. Antes de editar, leia integralmente AGENTS.md. Corrija somente o sinal "${finding.title}" em ${finding.file}:${finding.line}, após confirmar a evidência em teste isolado. Causa provável: ${finding.probableCause}. Impacto a validar: ${finding.impact}. Solução sugerida: ${finding.recommendation}. Validação obrigatória: ${finding.validationPlan}.${recurrence} Preserve todas as funções, regras de negócio, layout e dados das empresas. Não acesse nem copie dados reais. Faça backup dos arquivos exatos, execute testes de regressão relacionados e não publique sem nova autorização explícita do proprietário. Se o sinal for falso positivo ou exigir mudar outra área, pare e explique antes.`, 1800);
}

function recurrenceCount(recurrenceKey) {
  let count = 0;
  for (const record of qualityHistory.records || []) {
    for (const finding of Array.isArray(record?.findings) ? record.findings : []) {
      if (typeof finding === 'object' && clean(finding?.recurrenceKey, 40) === recurrenceKey) count += 1;
    }
  }
  return count;
}

function currentFindings(reference) {
  return [...codeSnapshot.findings]
    .sort((a, b) => (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0) || String(a.file).localeCompare(String(b.file)) || Number(a.line) - Number(b.line))
    .slice(0, 260)
    .map((finding) => {
      const previousOccurrences = recurrenceCount(clean(finding.recurrenceKey, 40));
      const item = {
      id: clean(finding.id, 40),
      recurrenceKey: clean(finding.recurrenceKey, 40),
      ruleId: clean(finding.ruleId, 80),
      status: ['confirmed', 'probable', 'opportunity'].includes(finding.status) ? finding.status : 'probable',
      severity: SEVERITY_ORDER[finding.severity] ? finding.severity : 'info',
      confidence: ['low', 'medium', 'high'].includes(finding.confidence) ? finding.confidence : 'low',
      category: clean(finding.category, 60),
      scope: finding.scope === 'third-party' ? 'third-party' : 'application',
      title: clean(finding.title, 180),
      file: clean(finding.file, 240),
      line: Math.max(1, Math.floor(Number(finding.line || 1))),
      evidence: clean(finding.evidence, 260),
      probableCause: clean(finding.probableCause, 300),
      impact: clean(finding.impact, 300),
      recommendation: clean(finding.recommendation, 360),
      validationPlan: clean(finding.validationPlan, 360),
      recurrenceCount: previousOccurrences
      };
      return Object.freeze({ ...item, codexPrompt: codexPrompt(item, reference) });
    });
}

function validatedFindingIdsForHash(codeHash) {
  const validated = new Set();
  for (const record of qualityHistory.records || []) {
    if (clean(record?.targetCodeHash, 80).toLowerCase() !== clean(codeHash, 80).toLowerCase()) continue;
    for (const validation of Array.isArray(record?.validations) ? record.validations : []) {
      if (validation?.passed === true && /^QF-[A-F0-9]{12}$/.test(String(validation.findingId || ''))) validated.add(validation.findingId);
    }
  }
  return validated;
}

export function compareQualitySnapshots(previousContext, current = codeSnapshot) {
  const previous = safeQualityContext(previousContext);
  if (!previous?.findings.length) return Object.freeze({ available: false, reason: 'Nenhum relatório anterior foi fornecido nesta conversa ou no histórico técnico.', sameCode: false, resolved: Object.freeze([]), persisting: Object.freeze([]), unverifiable: Object.freeze([]), newFindings: Object.freeze([]) });
  const currentById = new Map((current.findings || []).map((item) => [item.id, item]));
  const previousIds = new Set(previous.findings.map((item) => item.id));
  const sameCode = previous.codeHash === current.codeHash;
  const validated = validatedFindingIdsForHash(current.codeHash);
  const resolved = [], persisting = [], unverifiable = [];
  for (const finding of previous.findings) {
    if (currentById.has(finding.id)) persisting.push(finding.id);
    else if (!sameCode && validated.has(finding.id)) resolved.push(finding.id);
    else unverifiable.push(finding.id);
  }
  const newFindings = sameCode ? [] : (current.findings || []).filter((item) => !previousIds.has(item.id)).map((item) => item.id);
  return Object.freeze({
    available: true,
    reason: sameCode ? 'O código não mudou desde o relatório anterior; nenhum item pode ser declarado resolvido.' : (unverifiable.length ? 'Sinais ausentes no novo snapshot continuam não verificáveis até o teste específico ser registrado como aprovado.' : 'Comparação concluída com evidências registradas.'),
    previousCodeHash: previous.codeHash,
    currentCodeHash: current.codeHash,
    sameCode,
    resolved: Object.freeze(resolved),
    persisting: Object.freeze(persisting),
    unverifiable: Object.freeze(unverifiable),
    newFindings: Object.freeze(newFindings)
  });
}

function severityCounts(findings) {
  return Object.fromEntries(Object.keys(SEVERITY_ORDER).map((level) => [level, findings.filter((item) => item.severity === level).length]));
}

function publicHistory() {
  return Object.freeze((qualityHistory.records || []).slice(-40).map((record) => Object.freeze({
    id: clean(record?.id, 80),
    type: clean(record?.type, 60),
    status: clean(record?.status, 60),
    reference: clean(record?.reference, 80),
    baselineCodeHash: clean(record?.baselineCodeHash, 80),
    targetCodeHash: clean(record?.targetCodeHash, 80),
    summary: clean(record?.summary, 500),
    createdAt: clean(record?.createdAt, 40),
    testCount: Array.isArray(record?.tests) ? record.tests.length : 0,
    validationCount: Array.isArray(record?.validations) ? record.validations.length : 0
  })));
}

function publicMarket() {
  return Object.freeze({
    reviewedAt: marketBenchmark.reviewedAt,
    methodology: marketBenchmark.methodology,
    products: Object.freeze(marketBenchmark.products.map((product) => Object.freeze({ name: product.name, capabilities: product.capabilities, sources: product.sources }))),
    opportunities: marketBenchmark.opportunityLenses
  });
}

export function buildQualityReport({ question, reference, qualityContext = null } = {}) {
  const intent = detectQualityIntent(question);
  const findings = currentFindings(reference);
  const counts = severityCounts(findings);
  const verification = intent === 'verify' ? compareQualitySnapshots(qualityContext, codeSnapshot) : null;
  return Object.freeze({
    auditId: reference,
    intent,
    generatedAt: codeSnapshot.generatedAt,
    scannerVersion: codeSnapshot.scannerVersion || `snapshot-v${codeSnapshot.version || 1}`,
    codeHash: codeSnapshot.codeHash,
    scope: Object.freeze({ included: Object.freeze([...(codeSnapshot.coverage?.included || ['aplicação web e backend'])]), excluded: Object.freeze([...(codeSnapshot.coverage?.excluded || ['dados de empresa'])]), limitations: Object.freeze([...(codeSnapshot.coverage?.limitations || ['análise estática exige confirmação'])]) }),
    summary: Object.freeze({ ...codeSnapshot.summary, severityCounts: Object.freeze(counts), recurringFindingCount: findings.filter((item) => item.recurrenceCount > 0).length }),
    findings: Object.freeze(findings),
    verification,
    market: publicMarket(),
    history: publicHistory(),
    approval: Object.freeze({ required: true, codeWritesAllowed: false, automaticFixes: false, publicationAllowed: false, instruction: `Use a referência ${reference} para aprovar somente a preparação da correção; a execução e a publicação continuam exigindo autorizações separadas.` }),
    readOnly: true,
    containsCompanyData: false
  });
}

function topFindingLines(report, limit = 8) {
  return report.findings.slice(0, limit).map((item, index) => `${index + 1}. [${SEVERITY_LABEL[item.severity]} · ${item.status === 'opportunity' ? 'oportunidade' : 'provável'}] ${item.id} — ${item.title} (${item.file}:${item.line}). Causa: ${clean(item.probableCause, 170)} Solução: ${clean(item.recommendation, 190)}`);
}

function deterministicNarrative(report) {
  const counts = report.summary.severityCounts;
  if (report.intent === 'verify') {
    const result = report.verification;
    if (!result?.available) return `Verificação pós-correção indisponível: ${result?.reason || 'não há relatório anterior.'}`;
    return `Verificação pós-correção da referência ${report.auditId}: ${result.persisting.length} persistente(s), ${result.resolved.length} resolvido(s) com teste registrado, ${result.unverifiable.length} não verificável(is) e ${result.newFindings.length} novo(s). ${result.reason}`;
  }
  if (report.intent === 'history') {
    return report.history.length ? `Histórico técnico sanitizado: ${report.history.length} registro(s) versionado(s). Nenhum registro contém dados de empresa.` : 'O histórico técnico está preparado, mas ainda não há correções aprovadas e verificadas registradas. A IA não inventará histórico.';
  }
  if (report.intent === 'market') {
    return `Benchmark técnico revisado em ${report.market.reviewedAt}, baseado em ${report.market.products.length} referências oficiais. Ele apresenta capacidades para comparação e não afirma que algo esteja ausente no aplicativo sem evidência.`;
  }
  return `Varredura estática sanitizada concluída na referência ${report.auditId}: ${report.summary.fileCount} arquivo(s), ${report.summary.totalLines} linha(s) e ${report.summary.findingCount} sinal(is). Gravidade: ${counts.critical} crítica(s), ${counts.high} alta(s), ${counts.medium} média(s), ${counts.low} baixa(s) e ${counts.info} informativa(s).`;
}

export function qualityProviderEvidence(report) {
  return Object.freeze({
    audit: Object.freeze({ auditId: report.auditId, intent: report.intent, codeHash: report.codeHash, scannerVersion: report.scannerVersion, summary: report.summary, scope: report.scope }),
    prioritizedFindings: Object.freeze(report.findings.slice(0, 24).map((item) => Object.freeze({ id: item.id, status: item.status, severity: item.severity, confidence: item.confidence, category: item.category, scope: item.scope, title: item.title, file: item.file, line: item.line, evidence: item.evidence, probableCause: item.probableCause, impact: item.impact, recommendation: item.recommendation, validationPlan: item.validationPlan }))),
    verification: report.verification,
    market: report.intent === 'market' || report.intent === 'full_audit' ? report.market : null,
    historySummary: Object.freeze({ count: report.history.length, records: report.history.slice(-8) }),
    rules: Object.freeze(['Sinais estáticos não são bugs confirmados.', 'Gravidade, IDs e evidências determinísticas não podem ser alterados pelo modelo.', 'Nenhum dado de empresa foi lido.', 'Nenhuma escrita, correção, execução do Codex ou publicação está autorizada.'])
  });
}

export function qualitySystemInstructions() {
  return `Você é a mesma Assistente da Obra e, neste pedido, atua como engenheira de software e auditora do produto em modo estritamente somente leitura. Use apenas o relatório sanitizado fornecido. Nunca transforme sinal estático em bug confirmado; preserve exatamente IDs, gravidades, arquivos e evidências determinísticas. Explique prioridades, causa provável, impacto, solução, validação, UX, automação, desempenho, segurança e oportunidades de produto com linguagem clara. As fontes de mercado são referências oficiais datadas, não um ranking independente; não declare uma função ausente sem evidência. Nunca gere patch, nunca execute Codex, nunca diga que alterou, corrigiu, publicou, monitorou 24 horas ou acessou dados da empresa. Reforce que qualquer alteração exige aprovação explícita e depois testes. Retorne somente JSON com answer, confidence (low|medium|high), missingData e warnings.`;
}

export function buildQualityReply({ providerResult = {}, report } = {}) {
  const deterministic = deterministicNarrative(report);
  const providerNarrative = clean(providerResult.answer, 900);
  const priorities = topFindingLines(report, 4);
  const promptNote = report.findings.length ? `O relatório inclui um prompt seguro para o Codex em cada achado. Gerar o prompt não executa nenhuma correção.` : '';
  const marketNote = `Comparação de mercado: ${report.market.products.map((item) => item.name).join(', ')}; fontes oficiais revisadas em ${report.market.reviewedAt}.`;
  const approval = `Nenhuma alteração foi realizada. ${report.approval.instruction}`;
  const sections = [providerNarrative && providerNarrative !== deterministic ? providerNarrative : '', deterministic, priorities.length ? `Prioridades para confirmação:\n${priorities.join('\n')}` : '', report.intent === 'market' || report.intent === 'full_audit' ? marketNote : '', promptNote, approval].filter(Boolean);
  return {
    answer: sections.join('\n\n'),
    period: { label: 'Auditoria técnica do produto', from: '', to: '' },
    sources: [
      { module: 'quality', name: 'Arquivos do produto no snapshot sanitizado', count: report.summary.fileCount },
      { module: 'quality', name: 'Sinais técnicos classificados', count: report.summary.findingCount },
      { module: 'quality-market', name: 'Produtos com fontes oficiais no benchmark', count: report.market.products.length },
      { module: 'quality-history', name: 'Registros técnicos versionados', count: report.history.length }
    ],
    calculations: [
      { label: 'Cobertura estática', formula: 'arquivos e linhas de código/configuração, sem dados empresariais', value: `${report.summary.fileCount} arquivos · ${report.summary.totalLines} linhas` },
      { label: 'Proteção', formula: 'ferramentas de escrita + execução + publicação', value: '0 habilitadas' }
    ],
    confidence: ['low', 'medium', 'high'].includes(providerResult.confidence) ? providerResult.confidence : 'medium',
    missingData: unique([...(Array.isArray(providerResult.missingData) ? providerResult.missingData.map((item) => clean(item, 300)) : []), ...report.scope.limitations]),
    warnings: unique([...(Array.isArray(providerResult.warnings) ? providerResult.warnings.map((item) => clean(item, 300)) : []), 'Sinal estático não equivale a bug confirmado.', 'A auditoria não leu nem alterou dados de nenhuma empresa.', 'Correção, execução do Codex e publicação permanecem bloqueadas até autorizações separadas.']),
    readOnly: true,
    qualityReport: report
  };
}

export function attachQualityReport(validatedReply, report) {
  return Object.freeze({ ...validatedReply, qualityReport: report });
}

export function qualityReference(fingerprint) {
  return `QA-${String(fingerprint || '').replace(/[^a-f0-9]/gi, '').slice(0, 12).toUpperCase()}`;
}

export function isQualityIntent(value) { return QUALITY_INTENTS.has(value); }

export function qualitySnapshotDescriptor() {
  return Object.freeze({ codeHash: codeSnapshot.codeHash, generatedAt: codeSnapshot.generatedAt, scannerVersion: codeSnapshot.scannerVersion || `snapshot-v${codeSnapshot.version || 1}`, fileCount: codeSnapshot.summary.fileCount, findingCount: codeSnapshot.summary.findingCount });
}
