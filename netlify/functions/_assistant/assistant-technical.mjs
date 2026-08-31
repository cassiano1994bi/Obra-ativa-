import codeSnapshot from './assistant-code-snapshot.generated.mjs';

function clean(value, max = 600) { return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function normalized(value) { return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

export function assertTechnicalMembership(membership = {}) {
  const role = String(membership.role || '').toLowerCase();
  if (role !== 'owner') {
    const error = new Error('Somente o proprietário pode solicitar uma auditoria técnica do aplicativo.');
    error.code = 'TECHNICAL_REVIEW_FORBIDDEN';
    throw error;
  }
}

function focusCategories(question) {
  const text = normalized(question);
  const categories = [];
  if (/seguranca|vulnerabilidade|risco/.test(text)) categories.push('security', 'security-ux');
  if (/desempenho|performance|gargalo|lent/.test(text)) categories.push('performance', 'reliability');
  if (/duplic|refator|manuten/.test(text)) categories.push('duplication', 'maintainability');
  if (/bug|erro|logica|falha/.test(text)) categories.push('reliability');
  return [...new Set(categories)];
}

export function technicalEvidence(question) {
  const categories = focusCategories(question);
  const severityWeight = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
  const prioritized = [...codeSnapshot.findings].sort((a, b) => {
    const focusA = categories.includes(a.category) ? 1 : 0;
    const focusB = categories.includes(b.category) ? 1 : 0;
    const severityA = severityWeight[a.severity] || 0;
    const severityB = severityWeight[b.severity] || 0;
    return focusB - focusA || severityB - severityA;
  });
  const largestFiles = [...codeSnapshot.files].sort((a, b) => b.bytes - a.bytes).slice(0, 18).map(({ path, bytes, lines, functions, fetches, domWrites, inlineHandlers }) => ({ path, bytes, lines, functions, fetches, domWrites, inlineHandlers }));
  return Object.freeze({
    snapshot: { generatedAt: codeSnapshot.generatedAt, codeHash: codeSnapshot.codeHash, ...codeSnapshot.summary },
    focusCategories: categories,
    largestFiles,
    findings: prioritized.slice(0, 80),
    evidenceRules: [
      'Os achados automáticos são sinais para revisão, não confirmação de defeito.',
      'Nenhum dado de empresa, credencial ou segredo está incluído.',
      'A revisão não possui ferramenta de escrita, publicação ou alteração de código.',
      'Comparações atuais de mercado exigem fontes de pesquisa externa que não fazem parte deste inventário.'
    ]
  });
}

export function technicalSystemInstructions() {
  return `Você continua sendo a mesma Assistente da Obra. Neste pedido, atue como engenheira de software e consultora de produto em modo estritamente somente leitura. Analise apenas o inventário técnico sanitizado fornecido. Os achados automáticos são sinais, não fatos: diferencie claramente problema confirmado, risco provável e oportunidade de revisão. Nunca invente arquivo, linha, comportamento, concorrente, pesquisa ou resultado de teste. Para cada item relevante, explique: evidência, impacto, solução sugerida e como validar. Inclua oportunidades de UX, produto, inovação e monetização somente quando sustentadas pelo escopo visível; comparações de mercado sem pesquisa externa devem ser rotuladas como conceituais. Não gere patch, não diga que alterou algo e não autorize execução. Termine a análise deixando claro que qualquer implementação exige aprovação explícita do proprietário. Retorne somente JSON com answer, confidence (low|medium|high), missingData e warnings.`;
}

export function buildTechnicalReply({ providerResult = {}, question, reference }) {
  const evidence = technicalEvidence(question);
  const top = evidence.findings.slice(0, 5);
  const fallback = top.length
    ? `Diagnóstico inicial do inventário técnico:\n${top.map((item, index) => `${index + 1}. [${item.category}] ${item.title} — ${item.file}:${item.line}. Impacto precisa ser confirmado em teste. Solução sugerida: ${item.recommendation}`).join('\n')}`
    : 'O inventário técnico não apresentou sinais automáticos suficientes para uma conclusão segura.';
  const baseAnswer = clean(providerResult.answer, 5200) || fallback;
  const approval = `Nenhuma alteração foi realizada. Referência da proposta: ${reference}. Antes de qualquer implementação, apresente esta referência e peça aprovação explícita do proprietário.`;
  const marketRequested = /mercado|concorrente|vender|monetiza|inova/.test(normalized(question));
  return {
    answer: `${baseAnswer}\n\n${approval}`,
    period: { label: 'Revisão técnica do código', from: '', to: '' },
    sources: [
      { module: 'technical', name: 'Arquivos do aplicativo inventariados', count: evidence.snapshot.fileCount },
      { module: 'technical', name: 'Sinais técnicos sanitizados revisados', count: evidence.findings.length }
    ],
    calculations: [{ label: 'Cobertura do inventário', formula: 'arquivos e linhas analisados sem dados de empresa', value: `${evidence.snapshot.fileCount} arquivos · ${evidence.snapshot.totalLines} linhas` }],
    confidence: ['low', 'medium', 'high'].includes(providerResult.confidence) ? providerResult.confidence : 'medium',
    missingData: [...new Set([...(Array.isArray(providerResult.missingData) ? providerResult.missingData : []), ...(marketRequested ? ['Pesquisa web atual com fontes verificáveis para comparação de mercado.'] : [])])],
    warnings: [...new Set([...(Array.isArray(providerResult.warnings) ? providerResult.warnings : []), 'Sinais automáticos precisam ser confirmados por reprodução e testes antes de qualquer correção.', 'A Assistente não possui permissão de escrita ou publicação neste modo.'])],
    readOnly: true
  };
}

export function technicalReference(fingerprint) { return `TECH-${String(fingerprint || '').replace(/[^a-f0-9]/gi, '').slice(0, 12).toUpperCase()}`; }
