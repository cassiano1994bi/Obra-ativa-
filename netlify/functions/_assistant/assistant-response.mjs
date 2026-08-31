const CONFIDENCE_LEVELS = new Set(['low', 'medium', 'high']);

function text(value, maxLength) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function textList(value, maxItems = 20, maxLength = 300) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).map((item) => text(item, maxLength)).filter(Boolean);
}

export function insufficientDataResponse({ period = {}, sources = [], missingData = [] } = {}) {
  return Object.freeze({
    answer: 'Não há dados suficientes para responder com segurança.',
    period: {
      label: text(period.label || 'Período não informado', 120),
      from: text(period.from, 10),
      to: text(period.to, 10)
    },
    sources: Array.isArray(sources) ? sources.slice(0, 20) : [],
    calculations: [],
    confidence: 'low',
    missingData: textList(missingData),
    warnings: ['Nenhum valor foi inventado.'],
    readOnly: true
  });
}

export function validateAssistantResponse(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('A resposta da IA precisa ser um objeto estruturado.');
  }

  const answer = text(value.answer, 6000);
  if (!answer) throw new TypeError('A resposta da IA está sem texto.');

  const sources = Array.isArray(value.sources) ? value.sources.slice(0, 20).map((source) => ({
    module: text(source?.module, 40),
    name: text(source?.name, 100),
    count: Math.max(0, Math.floor(Number(source?.count || 0)))
  })).filter((source) => source.name) : [];
  const calculations = Array.isArray(value.calculations) ? value.calculations.slice(0, 20).map((calculation) => ({
    label: text(calculation?.label, 120),
    formula: text(calculation?.formula, 300),
    value: text(calculation?.value, 120)
  })).filter((calculation) => calculation.label) : [];
  const confidence = CONFIDENCE_LEVELS.has(value.confidence) ? value.confidence : 'low';

  return Object.freeze({
    answer,
    period: Object.freeze({
      label: text(value.period?.label, 120),
      from: text(value.period?.from, 10),
      to: text(value.period?.to, 10)
    }),
    sources: Object.freeze(sources.map(Object.freeze)),
    calculations: Object.freeze(calculations.map(Object.freeze)),
    confidence,
    missingData: Object.freeze(textList(value.missingData)),
    warnings: Object.freeze(textList(value.warnings)),
    readOnly: true
  });
}
