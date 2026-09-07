# Protótipo local — Cronograma por etapas

Data da validação: 06/09/2026  
Branch isolada: `prototype/cronograma-etapas`  
Ponto de retorno: `fb0385b23d777b6cd52bba0a059da68c1bc7552f`

## 1. O que foi reutilizado

- As fases já existentes em `db.workPhases`, sem criar uma segunda lista.
- O percentual manual já usado nas fases das obras.
- O mesmo identificador de fase que a Escala diária grava em `distributions.phaseId`.
- O fluxo existente de persistência, revisão concorrente e histórico do controle de obras.
- As permissões atuais de edição e consulta.
- Os cartões existentes de fases, fotos e custo de mão de obra.

## 2. O que foi adicionado

- Início e término previstos em cada fase.
- Situações automáticas: `Sem prazo`, `No prazo`, `Atenção`, `Atrasada` e `Concluída`.
- Dias restantes, dias de atraso e duração prevista.
- Resumo compacto com etapa atual, próxima etapa e término planejado da obra.
- Divisão opcional de uma fase em um único nível de subetapas, adequada para térreo e pavimentos.
- Bloqueio de datas invertidas, hierarquia recursiva e exclusão acidental de uma fase que ainda possui subetapas.

## 3. O que não foi alterado

- Nenhum dado real foi acessado ou modificado.
- Fotos e pastas das fases.
- Percentuais existentes e sua edição manual.
- Equipe, presença, pagamentos, recebimentos ou despesas.
- Cálculos financeiros atuais.
- Regras de autenticação, assinatura e cobrança.
- Banco de produção ou estrutura de tabelas.

## 4. Arquivos do protótipo

- `public-assets/work-schedule-core-v1.js`
- `public-assets/work-schedule-v1.js`
- `public-assets/work-schedule-v1.css`
- `public-assets/work-control-core-v1.js`
- `public-assets/work-control-v1.js`
- `index.html`
- `service-worker.js`
- `scripts/release/public-files.json`
- `tests/work-schedule-core.test.cjs`
- `tests/work-schedule-database.test.mjs`
- `tests/work-schedule-ui.test.mjs`
- `tests/work-schedule-preview-server.mjs`

## 5. Testes executados

- Obra simples.
- Obras subdivididas em dois e três pavimentos.
- Associação entre fase principal e subetapa.
- Datas válidas, incompletas e invertidas.
- Etapa em dia, próxima do prazo, atrasada e concluída.
- Alteração de percentual sem apagar datas ou vínculo com a fase principal.
- Preservação de equipe, presença, pagamentos e fotos.
- Persistência e recarregamento no banco local fictício.
- Permissão de proprietário, consulta e usuário sem acesso.
- Celular em retrato e paisagem, tablet e computador.
- Regressão das funções existentes de Obras, fotos, Escala diária e custo de mão de obra.
- Cache/offline e lista de arquivos públicos.

Todos os testes executados passaram após os ajustes.

## 6. Resultado da validação

- O cronograma usa a fase existente como fonte única.
- Nenhum percentual é recalculado ou substituído automaticamente.
- A data geral só aparece quando todas as etapas efetivas possuem início e término.
- Subetapas ficam visualmente ligadas à fase principal e não contam a fase-pai duas vezes no resumo.
- Os botões novos possuem área mínima de toque de 44 px no celular.
- A interface não apresentou rolagem horizontal nos quatro tamanhos testados.

## 7. Como desfazer

O protótipo está isolado na branch `prototype/cronograma-etapas`. Para voltar ao estado anterior, use o ponto `fb0385b23d777b6cd52bba0a059da68c1bc7552f` ou descarte somente os arquivos relacionados no item 4. Arquivos locais anteriores e não relacionados foram preservados.

## 8. Preparação para o futuro

O vínculo `parentPhaseId` permite consolidar subetapas sem duplicar fases. Como a Escala diária já registra `phaseId`, no futuro o custo de mão de obra pode ser agrupado por fase ou subetapa usando a mesma origem confirmada. Nenhum novo cálculo financeiro foi exibido neste protótipo.

## 9. Pendências antes de qualquer publicação

- Aprovação visual do usuário na prévia local.
- Decisão explícita para publicar.
- Nova validação final após qualquer ajuste solicitado na revisão.

Até esta etapa não houve merge, push, deploy ou alteração de produção.
