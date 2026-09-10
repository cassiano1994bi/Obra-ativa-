# Correções da Central da Obra após a auditoria

09/09/2026 — implementação autorizada após a análise. Apenas prévia local, sem publicação ou acesso a contas reais.

## Decisões e correções

- Contrato do cliente: formulário próprio para o valor **total**. Não acrescenta novamente o recebido; mostra o saldo calculado e preserva recebimentos/fechamentos existentes. Sem contrato, o resultado não aparece como uma estimativa financeira de zero.
- Etapa atual: seleção compartilhada pelos cartões da obra e pelo cronograma. A indicação foi retirada do cabeçalho repetitivo, permanecendo nas áreas de resumo e fases.
- Percentual: fases principais entram no avanço da obra; subetapas apenas detalham a fase, sem ganhar outro peso na média. Esta alternativa conserva os percentuais informados, não recalcula/sobrescreve dados e não muda o avanço apenas por cadastrar uma subetapa. A regra está explicada na tela.
- Prazo concluído: não continua apresentando contagem de dias restantes/atraso corrente após a conclusão.
- Mão de obra dos cartões: diárias confirmadas mais empreitas pagas. A composição é explicitada; faltas continuam sem gerar diária.
- Relatório por fase: uma única apresentação completa no Financeiro da obra. O botão nas Fases abre esse relatório diretamente, sem perda de informações.
- Histórico: permanece uma consulta por contexto — empreita individual e financeiro geral da obra — sem somar novamente o evento de auditoria como despesa.
- Cadastros com nomes iguais: confirmação antes de manter duas obras, fases, subetapas ou empreitas parecidas. Não exclui nem combina registros automaticamente.
- Gastos semelhantes: aviso quando há lançamento na mesma obra, data e valor; cancelar mantém o formulário e não cria outro registro. A proteção de operação repetida continua ativa.
- Rascunhos da escala: seleção, fase e modalidade ficam em memória por usuário, empresa, obra e data; trocar de aba/data não descarta o rascunho. Há aviso enquanto não salvo e proteção ao sair/recarregar. Não há gravação automática de escala ou presença.
- Data: primeiro acesso à escala usa hoje e identifica Hoje/Amanhã/Data da escala.
- Primeira utilização: orientação contextual do próximo passo; acesso ao cadastro existente de funcionário e à área existente de presença/falta, sem redesenhar esses módulos.
- Empreitas: unidade explícita (m², metro linear ou m³), sem atribuir uma unidade presumida aos contratos antigos. O total calculado só aparece no modo por metragem. Totais da obra e valores da empreita individual receberam nomes distintos.
- Lista de Obras: referências à galeria/fotos removida foram retiradas da apresentação; arquivos anteriores permanecem intactos.
- Financeiro: cinco indicadores principais, composição de custos em segundo nível visual e explicação de que o saldo calculado da obra não é saldo bancário.
- Leitura: cabeçalho e atalhos compactos; nomes das fases sem cortes; valores mais fortes; duas colunas de fases no celular deitado; navegação e valores de empreitas também verificados em retrato.
- Avisos: corrigido o tratamento de erro que dependia de uma função ausente no aplicativo completo e poderia deixar a mensagem de duplicidade vazia.

## Arquivos do aplicativo alterados nesta etapa

- `public-assets/work-hub-v1.js`
- `public-assets/work-hub-v1.css`
- `public-assets/work-control-core-v1.js`
- `public-assets/work-control-v1.js`
- `public-assets/work-cost-core-v1.js`
- `public-assets/work-costs-v1.js`
- `public-assets/work-costs-v1.css`
- `public-assets/work-schedule-core-v1.js`
- `public-assets/work-schedule-v1.js`

Foram adicionados testes locais de regressão para os achados. O conjunto fictício compartilhado recebeu coleções vazias equivalentes à estrutura do aplicativo, e o teste de metragem passou a selecionar a unidade explicitamente.

Mudanças anteriores do projeto, incluindo integração do Pixel e preparação do banco, não foram publicadas nem revertidas. Nenhuma migração foi executada em banco remoto nesta etapa.

## Verificação executada

Todos os cenários abaixo usaram dados artificialmente identificados como TESTE/FICTÍCIO, armazenamento em memória e rede externa bloqueada:

- `tests/work-hub-audit-core.test.mjs`
- `tests/work-hub-audit-ui.test.mjs`
- `tests/work-control-core.test.mjs` — 19 testes.
- `tests/work-control-full-app.test.mjs`
- `tests/work-control-ui.test.mjs`
- `tests/work-control-sync.test.mjs` — 4 testes.
- `tests/work-hub-v1.test.mjs`
- `tests/work-cost-core.test.mjs`
- `tests/work-costs-ui.test.mjs` — fluxos completos e cinco formatos.
- `tests/work-cost-database.test.mjs` — PostgreSQL isolado em memória, sem banco remoto.
- `tests/work-schedule-ui.test.mjs`
- `tests/mobile-landscape-current-fixes.test.mjs`
- `tests/global-design-system.test.mjs` — 3 testes de escopo, telas e estados.
- `tests/source-syntax.test.mjs` — 16 blocos internos e 55 módulos.
- Verificação de diferenças sem erros de whitespace.

Capturas de inspeção: `tmp/work-hub-audit-qa/` e `tmp/work-costs-qa/`, somente com dados fictícios. Nenhum arquivo dessas pastas ou dos testes/documentos consta no manifesto público.

O servidor local da porta 54944 foi conferido por comparação do conteúdo servido com os arquivos atuais: página e nove recursos, HTTP 200 e conteúdo correspondente. Não houve login do agente nem inspeção dos dados do usuário.

## Como o proprietário pode revisar

Abra `http://127.0.0.1:54944/?app=1&review=central-organizada-primeiro-uso` neste computador e entre com sua própria conta. Confira Obras → Abrir obra → Resumo, Equipe, Fases, Empreitas e Financeiro.

Esta prévia usa a conexão normal da conta: alterações que o proprietário salvar são alterações reais. Não usar registros fictícios na conta real. Os testes automatizados do agente ocorreram em outro servidor, completamente isolado.

Antes de uma publicação futura, ainda é necessário autorizar a publicação dessa atualização e verificar a proteção de empreitas e custos no banco conforme o plano de liberação existente. Esta entrega não é uma publicação em produção.
