# Painel inteligente da obra — execução por fases

Branch: `feature/painel-inteligente-obras`. Base: `982dfdc`.
Status: desenvolvimento local; nenhuma alteração de produção autorizada nesta tarefa.

## Fase 0 — mapa verificado

O aplicativo usa `index.html` como shell, com funções legadas estendidas por
módulos em `public-assets`. A tela vigente de Obras é `worksGlobal`, abre
`workTrackerPage` e reutiliza a hierarquia Obra → Fase → Fotos. As versões antigas
de resumo e editor de fases ainda estão no arquivo, mas foram substituídas por
um editor de nomes. A nova interface deve integrar as funções vigentes, não as
primeiras definições encontradas no arquivo.

| Informação | Fonte vigente | Integração prevista |
|---|---|---|
| Obras | `db.works`, `openInternalWorkModal` | Campos opcionais em `work.control`, sem recriar obra |
| Fases | `db.workPhases`, IDs e ordem existentes | Datas, status, peso e progresso nas mesmas fases |
| Fotos | `db.workMedia`, `ServerWorkMedia` | Reutilizar upload, otimização e visualizador |
| Atualizações | `db.workUpdates` | Acrescentar progresso anterior, novo e autoria |
| Equipe | `db.employees`, `rateHistory` | Diária histórica; não multiplicar escala por pagamento |
| Escala | `db.distributions`, funcionário/data/obra | Fase opcional na distribuição vigente |
| Presença | `db.attendance`, `financeAttendanceLaborRows` | Deduplicação por funcionário/data; meio período = 0,5 |
| Pagamentos | `db.payments`, vales e descontos | Liquidação não é um segundo custo de mão de obra |
| Recebimentos | `receipts`, `workClosings[].receipts` | Identidade de origem, sem somar saldo a receber como receita |
| Outras despesas | `otherExpenses`, `fuel`, `maintenance`, `tow`, `licenses` | Somente valores vinculados à obra; fase opcional |
| Contratos e orçamentos | `workContracts`, orçamentos existentes | Valor contratado explícito; orçamento não é gasto realizado |
| Relatórios | geradores existentes | Painel imprimível; dados calculados a partir das mesmas fontes |
| Empresa e permissões | `CompanyWorkspace`, `company_allowed_modules` | Contexto da empresa obrigatório no servidor |

## Persistência e risco estrutural

`company_app_state.data.db` armazena a empresa como JSON. A rotina vigente
`save_company_app_state` confere os módulos permitidos, mas não a versão lida.
Um aparelho desatualizado pode sobrescrever outro. Histórico novo apenas dentro
do JSON não seria suficiente para garantir integridade entre dispositivos.

A evolução usará os mesmos registros, com campos opcionais compatíveis, uma
rotina de salvamento com comparação da revisão e histórico adicional no servidor
com RLS. A migração será apenas aditiva, sem executar importações, apagar registros
ou aplicar as migrations históricas que copiam estados reais. Clientes antigos
serão avisados para atualizar quando tentarem sobrescrever uma empresa que já
adotou o novo controle. Conflitos devem preservar a cópia local e pedir revisão.

## Contratos de cálculo

- Ausência de dado é `null`, nunca zero fabricado.
- Marco inicial guarda a data de corte e somente os saldos anteriores informados.
  Os lançamentos anteriores já existentes serão conciliados, não somados de novo.
- Presença gera custo. Pagamento, vale e fechamento não repetem esse custo.
- Progresso total usa pesos explícitos das fases; sem pesos, média simples
  identificada como aproximação. Fases sem medição reduzem a cobertura. Zero
  automático de pasta antiga não vira medição confirmada; o dado original permanece.
- Previsões dependem de medições datadas suficientes, sem correção regressiva
  misturada a avanço. Fórmula, janela e confiança ficam disponíveis ao usuário.
- Sem orçamento/custo completo, a tela não promete margem final nem saúde perfeita.
- Comparações usam somente a empresa atual e informam tamanho da amostra.

## Sequência e validação

0. Auditoria e arquitetura: preservar hash dos arquivos públicos.
1. Cadastro/marco: novos, iniciados e finais; dados opcionais e corte sem duplicação.
2. Fases: IDs antigos, status, datas, nomes longos e exclusão com histórico preservado.
3. Progresso: autor/data/delta, validação, correções e prevenção de envio repetido.
4. Escala: fase por pessoa/data/obra, sem modificar o cálculo da presença.
5. Custos: duplicatas, meia diária, mudança histórica de valor e despesas sem fase.
6. Indicadores: fórmula inspecionável, estados vazios e acesso financeiro.
7. Financeiro: contrato/orçado/recebido/custo separados e cobertura conhecida.
8. Operação: equipe, ritmo, alertas, fases e prazo.
9. Previsões: poucos dados, progresso corrigido e simulação claramente estimada.
10. Comparação: obras equivalentes, amostras e dados insuficientes.
11. Histórico: eventos filtráveis, autoria e preservação do registro original.
12. Centro de controle: síntese e atalhos para funções existentes.
13. Histórico da empresa: médias, dispersão e confiança transparente.
14. Radar: filtros explícitos, prioridade explicada e arquivadas acessíveis.
15. Regressão: cálculo, banco isolado, permissões, conflitos, mobile horizontal/PC.

Os testes usam exclusivamente dados FICTÍCIOS, sem Supabase de produção, contas
reais, armazenamento real ou imagens de clientes. Testes e prévias ficam fora
do inventário publicado.

## Entrega local — 05/09/2026

Implementação em branch exclusiva, sem push, deploy, acesso a contas reais ou
aplicação da migration em produção. O resultado está pronto para revisão local;
isso não representa homologação de uma instalação Android física nem de produção.

| Fase | Implementado e verificado |
|---|---|
| 0 | Mapa de funções, fontes, permissões e risco de concorrência; auditoria sem mudar a tela |
| 1 | Novo cadastro e marco opcional de obra antiga; novo/andamento/final, valores desconhecidos, datas, equipe, fase, fotos pelo fluxo existente; renomear não cria marco automaticamente |
| 2 | Status, percentuais, datas, pesos, equipe de referência, custo previsto, observações, modelos adaptáveis e fotos; mantém IDs, ordem e funções anteriores |
| 3 | Atualização rápida com autor, horário, percentual anterior/novo/delta, observação e foto opcional; correção regressiva explicada e proteção contra repetição |
| 4 | Fase opcional por funcionário/data na distribuição existente, sem gerar presença ou pagamento |
| 5 | Custo de presença e diária histórica, meio período, categorias e vínculo de despesas existentes; sem repetir pagamentos, faltas ou recebimentos de mesma origem |
| 6 | Quatro indicadores com texto, nota e fórmula consultável; sem nota quando faltam dados |
| 7 | Contrato, orçamento, recebido, custo, saldo, margem conhecida, projeções e valores já lançados no Financeiro; revisão do plano atual sem substituir o marco |
| 8 | Fase atual, equipe de hoje, dias registrados, atrasos, prazo global e alertas |
| 9 | Projeção com pelo menos três datas de medição ao longo de sete dias; correções/pesos/escopo e histórico desatualizado impedem extrapolações inadequadas |
| 10 | Comparação interna de duração, resultado conhecido, margem, custo e fases mais demoradas/custosas; pelo menos dois registros para eleger um destaque |
| 11 | Linha do tempo filtrável, paginação, metadados protegidos do servidor e fallback local; fotos e eventos preservados após exclusão de fase |
| 12 | Painel único com andamento, equipe, finanças, prazo, atenção e atalhos para integrações vigentes |
| 13 | Médias por fase, pessoas, mão de obra, ritmo, variação de prazo, tamanho de amostra e confiança; nenhum cálculo gerado por IA |
| 14 | Radar mantém todas as obras, inclusive sem movimento/arquivadas; filtros somente por escolha explícita |
| 15 | Suíte atual e integração isolada aprovadas; verificação de banco, concorrência, permissões, integridade, tamanho e responsividade |

### Evidências da validação

- `node scripts/release/check-owner-release.mjs`: **162 testes aprovados**, zero
  falhas, 44 arquivos de suítes executados e 61 arquivos de runtime verificados.
- Sete suítes históricas já excluídas pelo verificador dependem de backups/pacotes
  antigos ausentes. Não foram declaradas aprovadas nem removidas.
- Núcleo: 19 provas sobre cálculo, marcos, planejamento, datas, fases, duplicação,
  autorizações, comparações, estatísticas, previsões e preservação de dados.
- Sincronização: quatro provas de revisão, confirmação, conflito sem reenvio
  automático, erro de conexão, ausência da migration e separação entre empresas.
- Banco PostgreSQL compatível isolado (PGlite): RLS, usuário externo, visualizador,
  supervisor, campos financeiros, autoria registrada pelo servidor, histórico
  protegido e recusa de versão desatualizada. Nenhuma conexão Supabase real.
- Navegador: fluxo completo local com todos os módulos do `index.html`, armazenamento
  efêmero em memória e rede externa interceptada. Fases, progresso, editor, abertura
  do formulário de fotos original, exclusão com histórico/fotos preservados, escala,
  radar e comparação verificados. Upload real de arquivos/contas não foi executado.
- Prévia isolada: 25 combinações de seção/tamanho, além de formulários. Larguras
  1440, 1024, 844, 667 e 390; horizontal priorizada. Sem overflow horizontal da página.
- Capturas do aplicativo completo em 1440×900, 1024×768, 844×390 e 667×375 revisadas.
- Ensaio de cálculo: radar de **100 obras fictícias, 1.200 fases e 10.000 lançamentos**
  em aproximadamente **87 ms** neste computador. Não é medição de Android físico,
  renderização ou tempo de rede.
- Inventário público: 74 dependências locais verificadas. Testes, capturas e banco
  sintético não integram a lista de publicação.

### Arquivos e preservação

- `public-assets/work-control-core-v1.js`: comandos e cálculos independentes da tela.
- `public-assets/work-control-v1.js` / `.css`: integração e interface isoladas.
- `public-assets/work-control-sync-v1.js`: controle de revisão e compatibilidade.
- `supabase/migrations/202609051600_work_control_revision.sql`: estrutura aditiva,
  RPCs, RLS e histórico. **Preparada, não executada em produção.**
- `index.html`: somente links para CSS/JS novos; funções inline antigas preservadas.
- `service-worker.js` e `scripts/release/public-files.json`: cache/inventário dos
  novos arquivos. Versão local do cache: v45.
- Inventário técnico gerado da IA e documento de modularização atualizados para
  refletir 46 módulos externos. Nenhuma regra de autenticação/IA foi reescrita.
- Testes novos em `tests/work-control-*`; a asserção do inventário anterior foi
  atualizada de 43 para 46 scripts, mantendo suas demais verificações.

Foram preservados os cadastros, IDs, fotos, equipe, escala, presença, pagamentos,
rotas, relatórios, configurações e funções que não fazem parte da nova integração.
Não houve alteração em dados reais de nenhuma empresa.

### Limites e liberação futura

1. As novas telas só são ativadas após a leitura da revisão segura do banco. Sem
   a migration, o funcionamento anterior continua disponível. Em conflito, a cópia
   local é preservada, novas tentativas automáticas param e a tela pede revisão.
2. A instalação do banco deverá ser autorizada explicitamente, sem importar
   migrations históricas nem dados de empresas. Usar somente a migration aditiva
   desta entrega e conferir as dependências de schema no ambiente de destino.
3. Somente depois de autorizar a liberação: registrar/sincronizar a versão no GitHub,
   preparar o pacote pelo inventário, publicar a mesma revisão e homologar o fluxo
   no Android físico em ambiente de teste, sem contas reais.
4. Histórico estatístico nunca é apresentado como garantia. Resultados financeiros
   são dos custos conhecidos; orçamento proporcional ao avanço é uma referência
   linear, não auditoria contábil. A nota financeira não mede simplesmente quanto
   sobrou do orçamento.
5. Simulações de contratar/remover pessoas ficaram expressamente para evolução
   futura, como permitido no pedido. A versão atual projeta pelo ritmo histórico,
   com fórmula, janela de medição e confiança visíveis.
