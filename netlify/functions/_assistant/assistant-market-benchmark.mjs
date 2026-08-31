const reviewedAt = '2026-08-29';

const products = [
  {
    id: 'autodesk-forma',
    name: 'Autodesk Forma (Construction)',
    capabilities: ['trabalho de campo online e offline', 'documentos, plantas, RFI, checklists e relatórios diários no celular', 'integrações com sistemas financeiros e outras ferramentas'],
    sources: [
      { title: 'Onboarding to Autodesk Build', url: 'https://construction.autodesk.com/resources/autodesk-build/onboarding-to-autodesk-build/' },
      { title: 'Construction Project Management', url: 'https://construction.autodesk.com/workflows/construction-project-management/' }
    ]
  },
  {
    id: 'procore',
    name: 'Procore',
    capabilities: ['plataforma unificada de projetos', 'análises e recursos de IA', 'orçamento, previsão de custos, mudanças, faturamento e integrações contábeis'],
    sources: [
      { title: 'Procore Construction Platform', url: 'https://www.procore.com/platform' },
      { title: 'Procore Financial Management', url: 'https://www.procore.com/financial-management' }
    ]
  },
  {
    id: 'buildertrend',
    name: 'Buildertrend',
    capabilities: ['resumo móvel de projetos', 'diário, fotos, ponto, tarefas, cronograma e arquivos', 'recursos móveis de vendas, financeiro e relacionamento com clientes'],
    sources: [
      { title: 'Buildertrend Mobile Construction App', url: 'https://buildertrend.com/app/' }
    ]
  },
  {
    id: 'sienge',
    name: 'Sienge',
    capabilities: ['orçamento, planejamento, acompanhamento, diário e mão de obra', 'financeiro, integrações, controladoria e gestão de ativos', 'BIM, suprimentos e processos do pré-obra ao pós-venda'],
    sources: [
      { title: 'Sienge Plataforma', url: 'https://sienge.com.br/sienge-plataforma/' },
      { title: 'Sienge Plataforma — catálogo oficial', url: 'https://store.sienge.com.br/products/sienge-plataforma' }
    ]
  }
];

const opportunityLenses = [
  { id: 'field-offline', label: 'Operação de campo offline', question: 'A equipe consegue concluir tarefas essenciais sem internet e sincronizar depois com conflitos controlados?' },
  { id: 'cost-forecast', label: 'Previsão financeira', question: 'O sistema diferencia realizado, comprometido, previsto e impacto de mudanças para antecipar desvios?' },
  { id: 'documents-workflow', label: 'Documentos e aprovações', question: 'Plantas, fotos, RFI, checklists e aprovações possuem versão, responsável, prazo e rastreabilidade?' },
  { id: 'integrations-api', label: 'Integrações e API', question: 'Há contratos de integração estáveis para reduzir digitação duplicada sem expor dados sensíveis?' },
  { id: 'client-experience', label: 'Experiência de cliente', question: 'O cliente recebe acompanhamento, aprovações e comunicação sem acessar áreas internas da empresa?' },
  { id: 'bim-assets', label: 'BIM e ativos', question: 'O produto tem caminho de evolução para quantitativos, modelos e ciclo de vida de veículos/equipamentos?' }
];

export default Object.freeze({
  version: 1,
  reviewedAt,
  methodology: 'Referência de capacidades declaradas em páginas oficiais. Não é ranking independente e não confirma que uma capacidade esteja ausente no aplicativo.',
  products: Object.freeze(products.map((product) => Object.freeze({ ...product, capabilities: Object.freeze([...product.capabilities]), sources: Object.freeze(product.sources.map(Object.freeze)) }))),
  opportunityLenses: Object.freeze(opportunityLenses.map(Object.freeze))
});
