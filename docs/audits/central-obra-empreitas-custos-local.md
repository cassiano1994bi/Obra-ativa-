# Central da Obra — empreitas e custos extras

Atualização preparada em 09/09/2026. Somente local; não publicada e sem execução de migration em banco remoto.

## Auditoria da estrutura existente

- A escala usa `distributions`, a presença usa `attendance`, e a diária vigente vem de `dailyAt`. Esses registros foram reutilizados, sem mudar o cadastro global de forma de pagamento da pessoa.
- `workContracts` já representa anexos/documentos do contrato. Não foi reutilizado indevidamente como cadastro de empreiteiros.
- A definição da empreita fica na própria obra, em `work.control.empreitas`.
- Pagamentos parciais e custos extras ficam em `otherExpenses`, já reconhecido como módulo Financeiro pelo controle de acesso.
- `payments` continua sendo a quitação das diárias. Não é somado novamente ao custo de presença.
- A Central anterior consultava apenas o valor do marco/planejamento. Agora também consulta o valor registrado pelo Financeiro em `receivables.total` e, quando só houver fechamentos, identifica explicitamente o total desses fechamentos. Não modifica o contrato do cliente ao registrar uma despesa.

## Regras implementadas

1. Empreita por metragem ou valor fechado, responsável da Equipe ou nome do empreiteiro, fase e datas.
2. Pagamentos parciais com data, observação, contratado, pago e restante. Valores negativos, excesso sobre o saldo e reenvio da mesma operação são bloqueados.
3. Regime escolhido por pessoa, obra e dia. A mesma pessoa pode receber diária em outra obra.
4. Presença de empreita não gera diária, inclusive na folha de pagamentos. O vínculo fica preservado na presença quando a escala é retirada.
5. Diarista escalado com `Faltou` continua escalado, mas custa zero. Corrigir `Trabalhou` para `Faltou` recalcula o total sem apagar a escala.
6. Custo extra por categoria sugerida ou personalizada, valor, data, observação e fase opcional. Comprovante JPG/PNG/WebP compactado e opcional, sem reativar a galeria de fotos da obra.
7. Gastos por fase distinguem diárias, empreitas pagas e extras. Sem vínculo válido, aparece `Sem fase definida`.
8. Um único histórico financeiro na Central, construído dos lançamentos e da linha do tempo já existentes. Um evento de auditoria de despesa não aparece como outro gasto.
9. Compromisso de empreita ainda a pagar fica separado do gasto realizado. Resultado estimado desconta gastos e compromissos conhecidos, sem inventar custos futuros.
10. Central e resumo Financeiro usam a mesma lista de custos; recibos com o mesmo ID de origem não são duplicados.
11. Repetir a escala dentro da Central se restringe à obra aberta e preserva fase e contratação. Escalas já preenchidas e outras obras não são substituídas.
12. Navegação das áreas e consulta de comprovantes continuam disponíveis no perfil de consulta. Escrita permanece bloqueada.

## Validação local

Os testes usam somente nomes, valores e identificadores FICTÍCIOS, armazenamento em memória e rede externa bloqueada. Nenhuma conta real foi aberta pelo agente.

- `tests/work-cost-core.test.mjs`: cálculo por metragem, fixo, parcelas, centavos, categorias, fase, sem fase, permissões, isolamento por obra, duplicação e preservação da receita.
- `tests/work-cost-database.test.mjs`: executa a migration em PostgreSQL/PGlite isolado. Valida revisão, autorização, valor, duplicação, vínculo da despesa, excesso de pagamento e comprovante inválido.
- `tests/work-costs-ui.test.mjs`: aplicação completa com dados fictícios; cria contratos, paga parcelas, escala, registra presença/falta, custos extras e comprovante, consulta Financeiro e compara totais. Desktop, tablet, Android horizontal 844×390 e 667×375 e retrato 390×844.
- Regressões: núcleo/escala/sincronização de obras, testes do banco existente, interface de fases/cronograma, Central da Obra, aplicação completa, sistema visual global, sintaxe e layout horizontal.

## Antes de uma publicação futura

- A migration `supabase/migrations/202609091200_work_costs_guard.sql` está preparada e testada apenas localmente. Acrescenta validação às gravações futuras; não importa, reescreve ou apaga registros existentes.
- Aplicação no banco de produção e publicação dependem da aprovação explícita desta atualização. Esta etapa NÃO foi realizada.
- A lista de arquivos públicos inclui apenas os módulos/CSS novos e não inclui testes, fixtures, prévias, relatório ou migration.
- Preservar as alterações anteriores de Pixel e Central da Obra já presentes no diretório; não misturar uma publicação não autorizada.

## Revisão pelo proprietário

Prévia com login normal: http://127.0.0.1:54944/?app=1&review=empreitas-custos-contrato

O servidor é local, mas o login usa a conta normal. Dados que o proprietário optar por salvar nessa prévia pertencem à sua conta; não são dados de demonstração.
