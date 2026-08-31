(function installAssistantTechnicalExpert(root) {
  'use strict';
  const REVIEW_PATTERN = /\b(codigo|bug|bugs|erro de logica|duplicacao|duplicado|desempenho|performance|seguranca|vulnerabilidade|gargalo|arquitetura|refator|ux|experiencia do usuario|produto|funcionalidade|inovar|mercado|concorrente|vender mais|auditoria tecnica|engenheira de software|consultora de produto)\b/;
  const REQUEST_PATTERN = /\b(analisar|analise|revisar|revise|verificar|verifique|vasculhar|vasculhe|encontrar|encontre|comparar|compare|sugerir|sugira|modo tecnico|especialista tecnica)\b/;
  function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim(); }
  function classify(value) {
    const text = normalize(value);
    if (/\baprovo\b.*\btech-[a-f0-9]{8,16}\b/.test(text)) return 'approval-reference';
    if (REQUEST_PATTERN.test(text) && REVIEW_PATTERN.test(text)) return 'technical-review';
    return 'normal';
  }
  function matches(value) { return classify(value) !== 'normal'; }
  root.AssistantTechnicalExpert = Object.freeze({ matches, classify, normalize, sameAssistant: true, readOnlyReview: true, directCodeWrites: false, version: 1 });
})(window);
