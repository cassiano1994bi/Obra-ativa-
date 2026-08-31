(function assistantCommandRegistryModule(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  root.AssistantCommandRegistry = api;
})(typeof window !== 'undefined' ? window : null, function assistantCommandRegistryFactory() {
  'use strict';

  const ROUTES = Object.freeze({
    home: Object.freeze({ label: 'Início', aliases: ['inicio', 'pagina inicial', 'tela inicial'] }),
    works: Object.freeze({ label: 'Obras', aliases: ['obra', 'obras', 'projetos'] }),
    planning: Object.freeze({ label: 'Escala diária', aliases: ['escala', 'escala diaria', 'planejamento'] }),
    attendance: Object.freeze({ label: 'Presença', aliases: ['presenca', 'lista de presenca'] }),
    payments: Object.freeze({ label: 'Pagamentos', aliases: ['pagamento', 'pagamentos', 'pagamento da equipe'] }),
    financial: Object.freeze({ label: 'Financeiro', aliases: ['financeiro', 'financas', 'financeiro das obras'] }),
    clients: Object.freeze({ label: 'Clientes', aliases: ['cliente', 'clientes'] }),
    budgets: Object.freeze({ label: 'Orçamentos', aliases: ['orcamento', 'orcamentos'] }),
    team: Object.freeze({ label: 'Equipe', aliases: ['equipe', 'funcionarios', 'funcionario'] }),
    vehicles: Object.freeze({ label: 'Veículos', aliases: ['veiculo', 'veiculos', 'frota'] }),
    reports: Object.freeze({ label: 'Relatórios', aliases: ['relatorio', 'relatorios'] }),
    textpdf: Object.freeze({ label: 'Escrever e gerar PDF', aliases: ['gerar pdf', 'escrever pdf', 'pdf'] }),
    permissions: Object.freeze({ label: 'Administrador', aliases: ['administrador', 'permissoes', 'configuracoes', 'assinatura', 'convites'] }),
    assistant: Object.freeze({ label: 'Assistente da Obra', aliases: ['assistente', 'assistente da obra', 'ia'] })
  });

  const FORM_ACTIONS = Object.freeze({
    work: Object.freeze({ label: 'Nova obra', route: 'works', handler: 'openModal', args: ['work'] }),
    employee: Object.freeze({ label: 'Novo funcionário', route: 'team', handler: 'openModal', args: ['employee'] }),
    advance: Object.freeze({ label: 'Registrar vale ou adiantamento', route: 'payments', handler: 'openModal', args: ['advance'] }),
    discount: Object.freeze({ label: 'Registrar desconto', route: 'payments', handler: 'openModal', args: ['discount'] }),
    payment: Object.freeze({ label: 'Registrar pagamento', route: 'payments', handler: 'openModal', args: ['payment'] }),
    vehicle: Object.freeze({ label: 'Novo veículo', route: 'vehicles', handler: 'openModal', args: ['vehicle'] }),
    fuel: Object.freeze({ label: 'Registrar abastecimento', route: 'vehicles', handler: 'openModal', args: ['fuel'] }),
    maintenance: Object.freeze({ label: 'Registrar manutenção', route: 'vehicles', handler: 'openModal', args: ['maintenance'] }),
    workClosing: Object.freeze({ label: 'Informar valor da obra', route: 'financial', handler: 'openWorkClosingModal', args: [] })
  });

  const WORKFLOWS = Object.freeze({
    scale: Object.freeze({ label: 'Preparar escala', confirmation: 'explicit' }),
    attendance: Object.freeze({ label: 'Preparar presença', confirmation: 'explicit' }),
    reminder: Object.freeze({ label: 'Preparar lembrete', confirmation: 'explicit' }),
    whatsapp: Object.freeze({ label: 'Preparar lista para WhatsApp', confirmation: 'reinforced' }),
    report: Object.freeze({ label: 'Preparar relatório', confirmation: 'explicit' }),
    payments: Object.freeze({ label: 'Preparar pagamentos', confirmation: 'reinforced' })
  });

  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9$.,/\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function beginsWithRequest(text, verbs) {
    const direct = new RegExp(`^(?:por favor\\s+)?(?:(?:voce\\s+)?(?:pode|consegue|poderia)\\s+)?(?:me\\s+)?(?:${verbs})\\b`);
    const desired = new RegExp(`^(?:eu\\s+)?(?:quero|preciso)\\s+(?:que\\s+voce\\s+)?(?:${verbs})\\b`);
    return direct.test(text) || desired.test(text);
  }

  function hasActionVerb(text) { return beginsWithRequest(text, 'abrir|abra|abre|ir|va|navegar|mostrar|mostre|mostra|entrar|acessar|levar|leve'); }
  function hasWriteVerb(text) { return beginsWithRequest(text, 'cadastrar|cadastre|cadastra|registrar|registre|registra|lancar|lance|lanca|adicionar|adicione|adiciona|criar|crie|cria|novo|nova|marcar|marque|marca|colocar|coloque|coloca|preparar|prepare|prepara|gerar|gere|gera'); }

  function isCapabilityQuestion(text, originalText = '') {
    if (/\b(?:o que|oq|quais?)\b.*\b(?:mudou|atualizacao|versao|consegue|pode|capacidade|habilidade)\b/.test(text)) return true;
    if (/^(?:agora\s+)?(?:voce|vc)\s+(?:ja\s+)?(?:consegue|pode)\s+(?:executar|fazer)\s+(?:tudo|qualquer coisa)\b/.test(text)) return true;
    const attendanceQuestion = /^(?:agora\s+)?(?:voce|vc)\s+(?:ja\s+)?(?:consegue|pode)\s+(?:marcar|colocar|registrar|lancar)\s+(?:uma\s+)?presenca\b/.test(text);
    if (attendanceQuestion && (/\?\s*$/.test(String(originalText || '')) || !/\b(?:hoje|amanha|\d{1,2}[\/-]\d{1,2}[\/-]\d{4})\b/.test(text))) return true;
    return false;
  }

  function dateInSaoPaulo(referenceDate, dayOffset = 0) {
    const date = referenceDate instanceof Date ? referenceDate : new Date(referenceDate || Date.now());
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(date)
      .reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
    const calendarDate = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + dayOffset));
    return calendarDate.toISOString().slice(0, 10);
  }

  function parseDate(text, referenceDate) {
    if (/\bamanha\b/.test(text)) return dateInSaoPaulo(referenceDate, 1);
    if (/\bhoje\b/.test(text)) return dateInSaoPaulo(referenceDate);
    const match = text.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/);
    if (!match) return '';
    const [, day, month, year] = match;
    const numericDay = Number(day);
    const numericMonth = Number(month);
    const numericYear = Number(year);
    const candidate = new Date(Date.UTC(numericYear, numericMonth - 1, numericDay));
    if (candidate.getUTCFullYear() !== numericYear || candidate.getUTCMonth() !== numericMonth - 1 || candidate.getUTCDate() !== numericDay) return '';
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function parseMoney(text) {
    const match = text.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})|\d+(?:[.,]\d{1,2})?)/);
    if (!match) return null;
    const raw = match[1];
    const value = raw.includes(',') ? Number(raw.replace(/\./g, '').replace(',', '.')) : Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  function routeFromText(text) {
    const entries = Object.entries(ROUTES).flatMap(([route, item]) => item.aliases.map((alias) => ({ route, alias }))).sort((a, b) => b.alias.length - a.alias.length);
    return entries.find((item) => text.includes(item.alias))?.route || '';
  }

  function planCommand(input = {}) {
    const originalText = String(typeof input === 'string' ? input : input.text || '').trim();
    const channel = String(typeof input === 'string' ? 'app' : input.channel || 'app').trim().toLowerCase();
    const referenceDate = typeof input === 'string' ? undefined : input.now;
    const text = normalize(originalText);
    const base = { id: `command-${Date.now()}`, originalText, normalizedText: text, channel, handled: true };
    if (!text) return Object.freeze({ ...base, handled: false, kind: 'unknown' });
    if (isCapabilityQuestion(text, originalText)) return Object.freeze({ ...base, handled: false, kind: 'capability_question' });

    if (hasWriteVerb(text) && /\b(gasto|despesa|material|materiais)\b/.test(text) && !/\b(combustivel|abastecimento|manutencao)\b/.test(text)) {
      return Object.freeze({ ...base, kind: 'unavailable', action: 'expense.general.create', risk: 'write', args: { amount: parseMoney(text), description: text }, message: 'Ainda não existe no aplicativo um cadastro oficial de gasto geral ou material. Nenhum valor foi salvo. Para manter os dados corretos, essa ação só poderá ser ativada quando houver uma função oficial para esse tipo de gasto.' });
    }

    if (hasWriteVerb(text) && /\bpresenca\b/.test(text)) return Object.freeze({ ...base, kind: 'workflow', action: 'attendance', risk: 'write', args: { date: parseDate(text, referenceDate), prepare: true } });
    if (hasWriteVerb(text) && /\b(relatorio|relatorios)\b/.test(text)) return Object.freeze({ ...base, kind: 'workflow', action: 'report', risk: 'navigate', args: { reportType: /financeir/.test(text) ? 'financial' : /pagamento/.test(text) ? 'payments' : /equipe|funcionario/.test(text) ? 'team' : /veiculo/.test(text) ? 'vehicles' : 'daily', prepare: true } });
    if (hasWriteVerb(text) && /\bescala\b/.test(text)) return Object.freeze({ ...base, kind: 'workflow', action: 'scale', risk: 'write', args: { targetDate: parseDate(text, referenceDate), prepare: false } });
    if (hasWriteVerb(text) && /\blembrete\b/.test(text)) return Object.freeze({ ...base, kind: 'workflow', action: 'reminder', risk: 'write', args: { date: parseDate(text, referenceDate), prepare: false } });
    if (hasWriteVerb(text) && /\bwhatsapp\b/.test(text)) return Object.freeze({ ...base, kind: 'workflow', action: 'whatsapp', risk: 'copy', args: { date: parseDate(text, referenceDate), prepare: true } });
    if (hasWriteVerb(text) && /\bpagamentos?\b/.test(text) && /\b(preparar|prepare|quitar|pagar)\b/.test(text)) return Object.freeze({ ...base, kind: 'workflow', action: 'payments', risk: 'navigate', args: { prepare: false } });

    let form = '';
    if (hasWriteVerb(text)) {
      if (/\b(funcionario|colaborador|membro da equipe)\b/.test(text)) form = 'employee';
      else if (/\b(nova obra|cadastrar obra|registrar obra|criar obra)\b/.test(text)) form = 'work';
      else if (/\b(abastecimento|abastecer|combustivel)\b/.test(text)) form = 'fuel';
      else if (/\bmanutencao\b/.test(text)) form = 'maintenance';
      else if (/\b(veiculo|carro)\b/.test(text)) form = 'vehicle';
      else if (/\b(vale|adiantamento)\b/.test(text)) form = 'advance';
      else if (/\bdesconto\b/.test(text)) form = 'discount';
      else if (/\bpagamento\b/.test(text)) form = 'payment';
      else if (/\b(valor da obra|valor aprovado|fechamento)\b/.test(text)) form = 'workClosing';
    }
    if (form) return Object.freeze({ ...base, kind: 'open_form', action: form, risk: 'form', route: FORM_ACTIONS[form].route, args: {} });

    if (hasActionVerb(text)) {
      const route = routeFromText(text);
      if (route) return Object.freeze({ ...base, kind: 'navigate', action: route, route, risk: 'navigate', args: {} });
    }
    return Object.freeze({ ...base, handled: false, kind: 'unknown' });
  }

  return Object.freeze({ ROUTES, FORM_ACTIONS, WORKFLOWS, normalize, isCapabilityQuestion, planCommand, version: 1 });
});
