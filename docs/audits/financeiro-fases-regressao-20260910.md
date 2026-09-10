# Financeiro e cartões de fases — verificação pontual

10/09/2026. Apenas local; não publicado. Nenhuma conta real acessada.

## Relato e escopo

O proprietário relatou Financeiro sem abrir e fases sem cartões, após avaliar a amostra de cores. Depois levantou a possibilidade de confusão com o link da prévia. A intervenção ficou restrita à falha reproduzida no histórico financeiro; nenhum formato, conteúdo, dimensão ou regra das fases foi alterado nesta etapa.

## Verificação

- Índice e 19 recursos relevantes do servidor anterior, porta 54944, correspondiam aos arquivos locais atuais. Não foi demonstrado que o link apontava para uma versão antiga.
- Na aplicação completa isolada, menu Financeiro e Financeiro da obra abriram com os registros fictícios habituais. As fases apareceram como cartões com borda, fundo branco e controles de percentual/prazo.
- Ao acrescentar somente na memória isolada um evento financeiro fictício anterior sem título, a abertura do Financeiro da obra falhou com `TypeError: Cannot read properties of undefined (reading 'includes')` em `financialHistoryMarkup`.
- Causa: a apresentação do histórico chamava `row.title.includes(...)` supondo que todo registro tivesse título textual. Não foi possível confirmar se esse é o formato dos registros da conta do proprietário, pois contas reais não são utilizadas em testes.

## Correção

Único arquivo do aplicativo alterado nesta etapa: `public-assets/work-costs-v1.js`.

O histórico agora usa o tipo do evento quando o título está ausente, ou a legenda “Registro financeiro” quando ambos estão ausentes. Converte título e descrição para texto apenas na apresentação. Todos os registros, datas, descrições e valores são preservados; o histórico não cria nova despesa e os cálculos permanecem iguais. Campos textuais continuam escapados.

## Testes

Quatro testes/suítes aprovados, sem falhas:

- Histórico com título ausente, nulo, vazio e numérico; descrição numérica; fallback por tipo; valor zero; conteúdo HTML escapado. Menu, guia financeira e Financeiro da obra, em seis formatos. Alternância Total/Por quinzena. Dados e totais idênticos antes/depois.
- Cartões de fases em sete formatos: comparação A/B da amostra de cores com o CSS anterior. Mesmos cartões, textos, posições, medidas, bordas, fundos e raios. Percentuais, prazo e sugestão de fases presentes.
- Regressão de contrato/aditivo/previsão/recebimento, histórico, permissões e quatro formulários em sete formatos (`work-client-finance-ui`).
- Regressão de quinzena/recebimentos/custos/resultado e preservação das regras de faltas e empreitas (`work-fortnight-ui`).

Teste adicionado: `tests/finance-legacy-history-regression.test.mjs`. Diagnóstico local: `tests/reported-finance-phases-probe.mjs`. Dados exclusivamente FICTÍCIOS, armazenamento em memória e rede externa bloqueada. Sintaxe do arquivo alterado validada; diferenças sem erros de whitespace.

## Nova prévia

Criado servidor em um novo endereço para separar esta revisão das abas/origens antigas:

<http://127.0.0.1:61970/?app=1&review=financeiro-fases-conferir>

Índice, código financeiro, Central da Obra, seus estilos e design system conferidos por conteúdo: HTTP 200 e versões atuais, sem cache. Não oferece service worker nesta origem local. A própria conta pode ser acessada pelo proprietário; seus dados continuam reais, e os controles existentes de gravação continuam funcionando. Não foram feitas gravações pelo agente.

O desaparecimento dos cartões relatado pelo proprietário ainda não foi reproduzido. A prévia nova serve para confirmar se o problema persiste; não foi feita uma reformulação presumida das fases.
