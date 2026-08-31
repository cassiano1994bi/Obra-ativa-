(function installAssistantQualityAuditor(root) {
  'use strict';

  const TECHNICAL_SCOPE = /\b(aplicativo|app|sistema|codigo|software|produto|plataforma|arquitetura|seguranca|performance|desempenho|bug|bugs|ux|interface)\b/;
  const FULL_AUDIT = /\b(varredura|auditoria|audite|auditar|vasculhar|monitore|monitorar|engenheira de software|auditora do sistema|qualidade do aplicativo)\b/;
  const VERIFY = /\b(verifique|verificar|confira|confirmar|validar|valide)\b.*\b(corrigid\w*|resolvid\w*|correc\w*|problemas?|bugs?|achados?)\b|\bpos[- ]?correcao\b/;
  const HISTORY = /\b(historico|recorrencia|recorrente|bugs corrigidos|melhorias aplicadas|recomendacoes anteriores)\b/;
  const MARKET = /\b(compare|comparar|comparacao|benchmark|mercado|concorrente|procore|buildertrend|sienge|autodesk|inovacao|vender mais)\b/;
  const CODEX_PROMPT = /\b(prompt)\b.*\b(codex|corrigir|correcao)\b|\bgerar\b.*\bprompt\b/;

  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();
  }

  function classify(value) {
    const text = normalize(value);
    if (/\baprovo\b.*\b(?:qa|audit)-[a-f0-9-]{6,32}\b/.test(text)) return 'approval';
    if (VERIFY.test(text) && TECHNICAL_SCOPE.test(text)) return 'verify';
    if (HISTORY.test(text) && TECHNICAL_SCOPE.test(text)) return 'history';
    if (CODEX_PROMPT.test(text) && TECHNICAL_SCOPE.test(text)) return 'codex_prompt';
    if (MARKET.test(text) && TECHNICAL_SCOPE.test(text)) return 'market';
    if (FULL_AUDIT.test(text) && TECHNICAL_SCOPE.test(text)) return 'full_audit';
    return 'normal';
  }

  function contextFromMessages(messages) {
    const list = Array.isArray(messages) ? messages : [];
    const previous = [...list].reverse().find((message) => message?.role === 'assistant' && message?.reply?.qualityReport)?.reply?.qualityReport;
    if (!previous) return null;
    return Object.freeze({
      reference: String(previous.auditId || '').slice(0, 60),
      codeHash: String(previous.codeHash || '').slice(0, 80),
      scannerVersion: String(previous.scannerVersion || '').slice(0, 60),
      findings: Object.freeze((Array.isArray(previous.findings) ? previous.findings : []).slice(0, 260).map((item) => Object.freeze({ id: item.id, recurrenceKey: item.recurrenceKey, ruleId: item.ruleId, severity: item.severity, file: item.file, line: item.line })))
    });
  }

  const registry = root.AssistantCapabilityRegistry;
  registry?.register?.({ id: 'software-quality-auditor', label: 'Auditoria técnica completa sob solicitação', version: 1, category: 'technical', readOnly: true, requiresApproval: true });

  root.AssistantQualityAuditor = Object.freeze({
    classify,
    matches: (value) => classify(value) !== 'normal',
    contextFromMessages,
    sameAssistant: true,
    readOnly: true,
    directCodeWrites: false,
    executesCodex: false,
    automaticPublication: false,
    containsCompanyData: false,
    version: 1
  });
})(window);
