# Central da Obra — visão por quinzena

Data: 09/09/2026. Status: **implementação e testes locais; não publicada**.

## Pedido atendido

Dentro de Obras → Abrir obra → Financeiro, acrescentar a escolha **Total da obra | Por quinzena**, sem substituir os registros existentes nem criar um segundo cadastro financeiro. Complemento do proprietário: mostrar também recebido e resultado positivo/negativo, com números no padrão da Central da Obra.

## Experiência entregue

- Total da obra continua sendo a visão inicial, com os mesmos valores, botões, histórico e gastos por fase.
- Por quinzena mostra três indicadores: **Recebido na quinzena**, **Custo da quinzena**, **Resultado da quinzena**.
- Resultado = recebimentos datados do período − custos registrados no período. Positivo e negativo têm texto explícito e cor; zero aparece como “Sem diferença”. Não representa saldo bancário nem lucro final.
- Abaixo, a composição do custo: diárias, empreitas pagas e custos extras.
- Um único detalhe expansível reúne recebimentos, gastos por fase, funcionários e outros lançamentos. Fases sem custo continuam presentes com zero.
- Anterior/Próxima avançam períodos de 14 dias alinhados ao calendário já usado em Pagamentos. O período inicial mantém as datas configuradas. A seleção global de Pagamentos e da comparação geral não é alterada.
- A quinzena atual parte da próxima data de pagamento, não de uma seleção histórica deixada em outra tela. O período em andamento é identificado como parcial, inclusive no último dia.
- Trocar datas não fecha a obra ou os detalhes. A escolha é mantida em memória por obra, usuário e empresa, sem criar preferências no banco ou no armazenamento persistente.
- Principais números: mesmos tamanho, peso e família de fonte dos indicadores de Total da obra em cada largura. Detalhamento: mesmo padrão da composição de custos existente. Moeda BRL com duas casas decimais.

## Regras dos cálculos

- Diária pelo dia da presença e pelo valor histórico: falta, folga e escala sem confirmação não geram diária. Meio período vale meia diária.
- Presença vinculada a empreita não gera diária adicional.
- Quitação de salário e adiantamento não são somados novamente como custo.
- Pagamentos de empreita e extras entram pela data do lançamento realizado.
- Recebimentos comuns e migrados para fechamentos mantêm a identidade de origem, evitando contar a mesma entrada duas vezes.
- Limites de data inclusivos, com separação por obra e empresa. Datas futuras não entram como valores realizados até hoje; há aviso quando existem registros futuros.
- Valores anteriores sem detalhamento por data ficam no total acumulado, com aviso na consulta, sem atribuição arbitrária a uma quinzena.
- Empreitas ainda a pagar aparecem separadas como saldo acumulado, fora do resultado do período.
- Consulta liberada a perfis que podem ver Financeiro, inclusive somente leitura. Os novos seletores não liberam criação, edição, exclusão ou gravação.

## Arquivos de aplicação alterados nesta etapa

1. `public-assets/work-cost-core-v1.js`: cálculo puro de custos, recebimentos e resultado por período, agrupamento de diárias por pessoa e tratamento de datas.
2. `public-assets/work-hub-v1.js`: seletor, navegação local, indicadores e detalhes da quinzena.
3. `public-assets/work-hub-v1.css`: estilos restritos à nova visão, responsividade e compatibilidade com os tamanhos existentes.
4. `index.html`: exceção restrita no controle de somente leitura para os novos botões de consulta; nenhuma permissão de escrita foi ampliada.

Arquivos de teste: `tests/work-fortnight-core.test.mjs` e `tests/work-fortnight-ui.test.mjs`. Este relatório e todos os testes/capturas permanecem fora da publicação.

## Validação realizada

Todos os testes usam dados inteiramente **FICTÍCIOS**, sem acesso a contas reais. Navegadores de teste isolados, armazenamento em memória e chamadas externas bloqueadas ou respondidas por simulação local.

- Testes novos de cálculo: intervalos inclusivos, centavos, períodos vazios, mês/ano, ano bissexto, resultados positivo/negativo/zero, datas futuras, saldos anteriores e duplicações.
- Teste com a aplicação completa: falta/presença, meia diária com tarifa histórica, empreita sem diária, escala sem confirmação, recibo presente no fechamento, detalhes por fase/pessoa, navegação e preservação dos dados.
- Perfis somente consulta e sem acesso a Financeiro; nenhuma gravação de estado da empresa disparada pela nova consulta.
- Sete telas: 1920×1080, 1440×1000, 1024×768, 768×1024, 844×390, 667×375 e 390×844. Sem rolagem lateral global; botões com alvo mínimo de 44 px; números com estilos comparados à visão acumulada.
- Valores grandes fictícios testados em desktop, celular deitado e em pé, sem corte ou quebra dos dígitos.
- Regressões: custos/empreitas, Central da Obra, controle completo de obras, fases/progresso/escala, histórico e interface em paisagem; três testes do design system global e suas navegações/modais.
- 30 testes da execução combinada de regras de obra, custos, quinzena e sincronização aprovados; oito testes da execução combinada de interface/regressão aprovados.
- Sintaxe: 16 scripts inline e 55 módulos externos localizados e validados. `git diff --check` sem erros.

Capturas fictícias: `tmp/work-fortnight-qa/` (somente revisão local).

## Como o proprietário pode conferir

Prévia com login normal: <http://127.0.0.1:54944/?app=1&review=quinzena-recebido-custo-resultado>.

1. Entrar com a própria conta e abrir uma obra.
2. Abrir Financeiro → Por quinzena.
3. Conferir recebido, custo e resultado; abrir os detalhes para ver a composição.
4. Usar Anterior/Próxima e verificar que os detalhes continuam abertos.
5. Retornar a Total da obra para consultar contrato, recebimentos acumulados e histórico original.

O link só funciona neste computador enquanto o servidor local estiver ativo. A prévia não é uma conta de treinamento: a consulta por quinzena não grava nada, mas os botões existentes de salvar/cadastrar continuam operando sobre os dados da conta quando o proprietário os utiliza.

## Preservação e publicação

Nenhum dado de empresa foi lido por login, copiado, criado, editado ou excluído durante o trabalho. Nenhuma migration foi aplicada e nenhuma publicação foi feita. Demais abas e alterações anteriores do projeto foram preservadas. Publicação depende de autorização específica do proprietário.
