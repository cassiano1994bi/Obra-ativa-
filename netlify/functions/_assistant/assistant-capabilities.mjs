export const ASSISTANT_CAPABILITIES_VERSION = 'funcionaria-digital-segura-v1';

export const ASSISTANT_CAPABILITIES = Object.freeze({
  navigation: Object.freeze([
    'Início', 'Obras', 'Escala diária', 'Presença', 'Pagamentos', 'Financeiro',
    'Clientes', 'Orçamentos', 'Equipe', 'Veículos', 'Relatórios',
    'Escrever e gerar PDF', 'Administrador e Assistente da Obra'
  ]),
  officialForms: Object.freeze([
    'nova obra', 'novo funcionário', 'vale ou adiantamento', 'desconto',
    'pagamento', 'veículo', 'abastecimento', 'manutenção e valor da obra'
  ]),
  confirmedWorkflows: Object.freeze(['presença', 'escala diária e lembretes']),
  preparedWorkflows: Object.freeze(['relatórios', 'pagamentos e lista para WhatsApp']),
  technicalModes: Object.freeze(['auditoria de qualidade e revisão técnica somente para o proprietário']),
  safety: Object.freeze({
    directWrites: false,
    usesOfficialFunctions: true,
    respectsPermissions: true,
    previewBeforeChanges: true,
    explicitConfirmation: true,
    technicalChangesRequireApproval: true
  })
});

function normalized(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifyCapabilityQuestion(question) {
  const text = normalized(question);
  if (!text) return '';

  if (
    /\b(?:o que|oq|quais?)\b.*\b(?:mudou|mudanca|novo|novidade|atualizacao|versao)\b/.test(text)
    || /\b(?:ficou|esta|ta)\b.*\b(?:mais inteligente|melhor|nova versao)\b/.test(text)
  ) return 'changes';

  if (
    /\b(?:voce|vc)\b.*\b(?:consegue|pode|sabe)\b.*\b(?:marcar|colocar|registrar|lancar)\b.*\bpresenca\b/.test(text)
    || /\bpresenca\b.*\b(?:consegue|pode|sabe)\b/.test(text)
  ) return 'attendance';

  if (
    /\b(?:o que|oq|quais?)\b.*\b(?:consegue|pode|faz|fazer|capacidade|capacidades|habilidade|habilidades)\b/.test(text)
    || /\b(?:voce|vc)\b.*\b(?:consegue|pode)\b.*\b(?:executar tudo|fazer tudo|qualquer coisa)\b/.test(text)
    || /\b(?:como funciona|o que faz)\b.*\b(?:assistente|ia|funcionaria)\b/.test(text)
  ) return 'capabilities';

  return '';
}

function capabilitySummary() {
  return [
    `abrir ${ASSISTANT_CAPABILITIES.navigation.join(', ')}`,
    `abrir os formulários oficiais de ${ASSISTANT_CAPABILITIES.officialForms.join(', ')}`,
    `preparar ${ASSISTANT_CAPABILITIES.confirmedWorkflows.join(', ')} com prévia e confirmação`,
    `preparar ${ASSISTANT_CAPABILITIES.preparedWorkflows.join(', ')}`,
    `atuar em ${ASSISTANT_CAPABILITIES.technicalModes.join(', ')}`
  ].join('; ');
}

export function assistantCapabilityPrompt() {
  return `Você é a mesma funcionária digital do aplicativo. A conversa consulta e interpreta dados em modo somente leitura. Separadamente, a camada segura de comandos pode ${capabilitySummary()}. Nunca diga que nenhuma ação é possível. Nunca diga que executa tudo ou que grava diretamente: qualquer alteração usa a função oficial, respeita as permissões, mostra uma prévia e exige confirmação explícita. Perguntas sobre capacidade não executam comandos. Auditorias técnicas apenas explicam e propõem; qualquer mudança exige aprovação do proprietário.`;
}

export function buildCapabilityReply({ question, period = {} } = {}) {
  const intent = classifyCapabilityQuestion(question) || 'capabilities';
  let answer = '';

  if (intent === 'changes') {
    answer = `Sim. Nesta atualização eu passei a conhecer e usar a camada segura de comandos do aplicativo. Agora posso ${capabilitySummary()}. Também consigo explicar com precisão o que está disponível. Eu não executo tudo sem limites: qualquer alteração continua passando pela função oficial, pelas permissões, por uma prévia e pela sua confirmação.`;
  } else if (intent === 'attendance') {
    answer = 'Consigo preparar uma presença. Diga, por exemplo, “Colocar presença hoje” ou “Marcar presença hoje”. Eu abro a prévia oficial da equipe escalada; você confere e escolhe o status de cada pessoa e só depois confirma. A presença não é gravada por esta pergunta e eu não invento funcionário, obra ou status.';
  } else {
    answer = `Posso ${capabilitySummary()}. Consultas e explicações não alteram dados. Quando uma ação puder modificar algo, eu uso somente a função oficial do aplicativo, mostro a prévia e aguardo sua confirmação. Não tenho permissão para executar qualquer coisa sem limite nem para alterar o sistema sozinha.`;
  }

  return Object.freeze({
    answer,
    period: {
      label: 'Capacidades da versão atual',
      from: String(period.from || ''),
      to: String(period.to || '')
    },
    sources: [{ module: 'assistant', name: 'Manifesto seguro de capacidades da Assistente', count: 5 }],
    calculations: [],
    confidence: 'high',
    missingData: [],
    warnings: ['Nenhuma ação foi executada por esta pergunta.'],
    readOnly: true
  });
}
