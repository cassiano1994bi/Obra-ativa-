# Central da Obra — duplicidades e clareza para o primeiro uso

Data: 09/09/2026. Escopo: versão local atual da lista de Obras e das cinco áreas da Central da Obra. Esta é uma análise, não uma atualização do aplicativo.

## Conclusão

Há repetições de apresentação, caminhos que se sobrepõem e algumas informações que podem divergir. A centralização por obra é uma boa direção; o principal ajuste recomendado é dar um significado e um local principal para cada ação, sem eliminar os registros e sem mudar as outras abas do aplicativo.

Não foi constatada duplicação automática de pagamentos nos fluxos testados. Isso não significa que os dados de uma conta real não contenham lançamentos repetidos: nenhuma conta real foi acessada. Também há situações em que cadastrar novamente a mesma informação gera outro registro, sem aviso de possível duplicidade.

## Como a análise foi feita

- Leitura da implementação atual, incluindo as camadas que substituem as telas antigas. Código antigo presente no arquivo não foi tratado como uma segunda tela visível sem confirmação em execução.
- Navegação isolada pela lista de Obras, Visão geral, Equipe e escala, Fases, Empreitas e Financeiro da obra.
- Inspeção dos formulários de obra, fase, percentual, prazos, subetapas, sugestões, empreita por metragem e valor fechado, pagamento, valor a receber, recebimento e custo extra.
- Comparação entre obra nova sem registros e obra fictícia com movimentação.
- Inspeção visual em 1440 × 1000, 844 × 390 e 667 × 375; os dois últimos representam celular deitado.
- Reexecução dos testes de custos e dos fluxos completos com dados fictícios em memória, armazenamento isolado e rede externa bloqueada. Os testes passaram; a suíte funcional cobre cinco tamanhos de tela.
- As primeiras verificações de recebimentos encontraram uma coleção ausente no conjunto artificial de teste. Após completar esse conjunto com a estrutura vazia do aplicativo, os formulários abriram sem erro. Esse problema do teste não foi atribuído ao aplicativo.

## 1. Repetições de tela e de ações

| ID | Local | Constatação | Prioridade | Recomendação e impacto |
|---|---|---|---|---|
| D01 | Cabeçalho, Visão geral e Fases → Agora | A etapa atual aparece em três pontos da navegação. Mais importante: o cabeçalho e o cronograma usam critérios diferentes para escolher a etapa. Em uma simulação com a primeira fase concluída e a próxima ainda não iniciada, o cabeçalho mostrou a concluída e “Agora” mostrou a próxima. | Alta | Unificar a regra da etapa atual. Depois reduzir a repetição na mesma tela. Evita informações contraditórias sobre o andamento. |
| D02 | Visão geral → Escalar equipe, Atualizar fases e Ver financeiro | Os três cartões apenas abrem as mesmas áreas já disponíveis nas abas. Não executam uma ação adicional. | Média | Escolher uma navegação principal; se os atalhos forem mantidos, deixá-los compactos e com nomes coerentes com as abas. Qualquer retirada depende de aprovação. Reduz espaço e dúvida sobre caminhos diferentes. |
| D03 | Fases e Financeiro → Ver gastos por fase | O relatório completo é exatamente o mesmo nas duas áreas, gerado pela mesma função. A igualdade foi confirmada em execução com os mesmos dados. | Média | Eleger um local principal para o detalhamento e oferecer acesso direto a ele a partir da outra área, se autorizado. Não criar uma segunda fonte de custos. |
| D04 | Cartão de cada fase e relatório de gastos por fase | O custo de diária da fase aparece no cartão como “Mão de obra” e reaparece no relatório como “Diárias”. São o mesmo componente, não dois gastos. | Média | Padronizar o nome e diferenciar resumo de detalhamento. Se a intenção do cartão for mostrar toda a mão de obra, incluir também empreitas pagas com a regra aprovada; hoje ele mostra apenas diárias. |
| D05 | Empreitas → resumo superior e cartão da empreita | Contratado, pago e saldo aparecem no total superior e novamente em cada empreita. Com uma única empreita, os mesmos três valores ficam repetidos na mesma tela. Com várias, o resumo representa a soma e tem utilidade. | Baixa | Identificar claramente “Total de todas as empreitas” e o valor individual, com menor destaque para a repetição. Não excluir o total automaticamente. |
| D06 | Fase → menu Renomear e botão do percentual | “Renomear” abre um formulário com nome e percentual. O botão do percentual abre outro formulário que edita o mesmo percentual. | Média | Tornar o nome da ação coerente: renomear deve tratar o nome, ou chamar-se “Editar fase”. Preservar o atalho direto do percentual. Evita a impressão de que há dois progressos diferentes. |
| D07 | Nova/Editar empreita → Valor fechado | O valor digitado aparece imediatamente outra vez em “Total da empreita”. No modo por metragem, a saída calculada é necessária; no modo fechado é uma confirmação visual redundante. | Baixa | Diferenciar campo editável de total calculado/confirmado. Não apresentar ambos com aparência de dois valores a preencher. |

### Repetições úteis, que não devem ser apagadas por engano

- Total gasto e recebido na Visão geral e no Financeiro: resumo e detalhamento da mesma informação.
- Pagamento no histórico da empreita e no histórico financeiro: duas consultas ao mesmo lançamento, não dois pagamentos. O teste confirmou uma única linha de gasto no histórico financeiro para um único pagamento.
- Equipe e escala dentro da obra e Escala diária no menu principal: visão de uma obra e visão de todas as obras. A existência de ambos é intencional na centralização solicitada.
- Financeiro da obra e Financeiro geral: recortes diferentes dos mesmos dados.
- Contrato com o cliente e empreita: o primeiro é receita combinada; o segundo é contratação de serviço, portanto despesa. Não são contratos duplicados.
- Sugerir fases, Nova fase e Dividir em etapas: ações diferentes — usar uma lista sugerida, criar uma fase e subdividir uma fase existente.

## 2. Riscos de duplicidade em registros e cálculos

| ID | Local | Evidência e causa | Recomendação |
|---|---|---|---|
| R01 | Nova obra, Nova fase e Nova empreita | Os cadastros manuais aceitam nomes iguais. Foram criados dois registros fictícios iguais em cada caso, com identificadores diferentes. A sugestão de fases protege contra nome já adicionado, mas a criação manual não tem a mesma verificação. | Avisar “Já existe um cadastro com esse nome; deseja continuar?”, mostrando o existente. Não impedir nomes legítimos nem fundir/apagar registros automaticamente. |
| R02 | Registrar pagamento e Registrar custo extra | Existe proteção contra repetir o envio da mesma operação. Porém, reabrir o formulário e registrar novamente o mesmo valor, data e descrição cria outra operação válida. Também é possível lançar manualmente um pagamento de empreita como custo extra. O sistema não consegue concluir sozinho que representam a mesma transação. | Aviso de possível repetição por obra, valor, data, responsável e descrição; instrução clara para não lançar novamente em outra área. Manter confirmação do usuário, pois despesas iguais podem ser legítimas. |
| R03 | Fases → Dividir em etapas → Avanço informado | Fase principal e subetapas têm percentuais próprios e entram juntas na média geral. Em teste fictício, uma fase a 50% produzia avanço de 50%; adicionar uma subetapa a 0% mudou a média para 25%, sem registro de novo trabalho executado. | Definir uma única regra: por exemplo, avanço da fase principal derivado das subetapas, sem contar pai e filhos como fases independentes no total. A regra precisa ser aprovada antes de mexer nos percentuais existentes. |

### Proteções que funcionaram nos testes

- Uma presença marcada como falta não gerou diária, mesmo com a pessoa escalada.
- Alterar presença de “Trabalhou” para “Faltou” retirou o custo diário sem apagar a escala.
- Quando o dia está vinculado à empreita, a presença não gera diária adicional; o pagamento registrado compõe o custo da empreita.
- Repetir a mesma operação de pagamento não adicionou outra despesa.
- O evento de histórico de um pagamento não foi somado novamente como gasto.
- O total por fases e o financeiro da obra permaneceram conciliados nos cenários testados.
- A lista exibiu um cartão por obra do conjunto de teste, sem reproduzir o mesmo registro em dois cartões.

Essas conclusões são dos fluxos e dos conjuntos fictícios testados, não uma certificação dos registros reais da empresa.

## 3. O que confunde um cliente ou usuário novo

| ID | Local | O que o usuário pode entender errado | Prioridade | Orientação recomendada |
|---|---|---|---|---|
| U01 | Financeiro → Definir valor | O cartão fala em contrato com o cliente, mas o botão abre “Editar previsto” e pede o saldo que falta receber. Quem digitar o contrato inteiro depois de já ter recebido pode informar um saldo maior do que o correto. | Alta | Separar explicitamente “Valor total do contrato” de “Falta receber”. O saldo deve ser resultado do contrato e dos recebimentos, não um campo ambíguo. Preservar recebimentos e regras antigas até a correção ser aprovada. |
| U02 | Visão geral → Equipe de hoje e Equipe e escala → Data | O resumo é de hoje; a escala usa a data global selecionada e, no primeiro acesso, pode iniciar amanhã. Em teste, o resumo mostrava uma pessoa hoje e a escala nenhuma no dia seguinte. | Alta | Mostrar Hoje/Amanhã junto à data e alinhar o primeiro acesso ao contexto da obra, sem impedir planejar outros dias. |
| U03 | Equipe e escala → marcar pessoa e trocar de aba | A seleção ainda não salva se perde ao mudar de aba, sem uma confirmação específica sobre essas alterações. Foi reproduzido em memória. | Alta | Indicar “Alterações não salvas” e avisar antes de sair ou preservar o rascunho. Não salvar automaticamente como presença. |
| U04 | Equipe e escala → presença/falta | A tela exibe a situação de presença, mas não oferece marcar Trabalhou/Faltou ali. Para isso o usuário precisa descobrir a aba Presença do menu principal. | Média | Primeiro oferecer um atalho contextual claro para a presença da obra/data; integrar a edição somente se autorizado. Distinguir escalar de confirmar presença. |
| U05 | Equipe e escala sem funcionários | Há “Nenhum funcionário ativo cadastrado”, mas continuam visíveis Salvar escala/Repetir dia anterior e não há caminho direto para cadastrar a primeira pessoa. | Média | Orientar “Cadastre a equipe primeiro” com acesso ao cadastro existente, preservando as ações conforme autorização. |
| U06 | Lista de Obras | Ainda há contagem de fotos e texto “registrar fotos”, embora a Central não tenha mais galeria nem botão para adicionar fotos. | Média | Atualizar os textos e indicadores da função descontinuada conforme a remoção já solicitada, sem apagar imagens antigas armazenadas. |
| U07 | Cartões de obra e de fase → Mão de obra | O rótulo parece incluir qualquer contratação, mas o número considera apenas diárias. Empreitas pagas aparecem em outro lugar. | Alta | Usar “Diárias” quando for só diária, ou apresentar mão de obra total com composição clara. Não chamar esse subtotal de total gasto. |
| U08 | Fase concluída → prazo | Uma fase 100% concluída pode continuar exibindo dias restantes ou dias de atraso calculados em relação à data atual. Foi reproduzido “Concluída” junto de “5 dias de atraso” em fase fictícia. | Média | Não exibir contagem de prazo em andamento como se a fase estivesse pendente. Caso se queira atraso histórico, calculá-lo pela data real de conclusão e identificá-lo como histórico. |
| U09 | Celular deitado | Há textos auxiliares entre aproximadamente 9 e 11 px e nomes longos cortados. Na simulação 844 × 390, cabeçalho e navegação ocuparam quase toda a primeira tela; o conteúdo da área começou próximo ao fim da altura disponível. | Média | Compactar repetição de cabeçalhos e manter leitura confortável dos nomes e informações essenciais. Não resolver diminuindo ainda mais a fonte. Não houve estouro horizontal da página nas larguras verificadas. |
| U10 | Financeiro → nove indicadores e resultado estimado | Os indicadores não são todos duplicados, mas muitos têm destaque parecido. “Saldo atual” desconta custos de diárias confirmadas, que não necessariamente já foram pagas; não deve ser confundido com saldo bancário. O resultado estimado também não inclui custos futuros ainda não cadastrados. | Média | Dar maior destaque a contrato, recebido, falta receber, gasto e resultado; manter composição de diárias, empreitas e extras legível. Explicar que é saldo calculado da obra, não extrato de caixa/banco. Não retirar indicadores sem aprovação. |
| U11 | Nova empreita → Por metragem | Os campos dizem “metros” e “valor por metro”, sem unidade explícita como m² ou metro linear. | Média | Identificar a unidade combinada para que a pessoa saiba o que está medindo. Não presumir nem converter dados antigos. |
| U12 | Empreitas e escala | Criar uma empreita não substitui automaticamente a modalidade de cada dia na escala. É preciso selecionar a empreita nos dias correspondentes; a explicação está em texto auxiliar. | Alta | Deixar a modalidade do dia bem visível e orientar a vinculação após cadastrar a empreita. Não alterar diárias de outros dias ou obras automaticamente. |
| U13 | Custos extras e pagamentos → fase opcional | É possível registrar sem fase. O gasto entra no total da obra, mas fica em “Sem fase definida”, contrariando a expectativa de ver todos os custos distribuídos por fase. | Média | Explicar junto ao campo: “Escolha uma fase para acompanhar o gasto nela”. Preservar a opção sem fase quando o gasto for geral. |
| U14 | Financeiro de obra nova sem contrato | O contrato aparece “Não informado”, mas o resultado estimado pode aparecer como zero. Isso pode transmitir que o resultado já foi calculado com dados suficientes. | Baixa | Diferenciar “Sem dados para estimar” de um resultado financeiro realmente igual a zero. Não esconder lançamentos zerados existentes. |

## 4. Organização recomendada, sem criar novas abas

| Área existente | Responsabilidade principal |
|---|---|
| Visão geral | Resumo curto do andamento, equipe do dia e dinheiro da obra. Sem repetir relatórios completos. |
| Equipe e escala | Escolher data, pessoas, fase e modalidade de trabalho; acesso claro à presença. |
| Fases | Percentual, prazo, subetapas e resumo de gasto de cada fase, com regra única de avanço. |
| Empreitas | Serviço contratado, responsável, valor combinado, pagamentos parciais e saldo a pagar. |
| Financeiro da obra | Contrato com cliente, recebimentos, despesas, total gasto, compromissos e histórico conciliado. |

Fluxo sugerido para o primeiro uso: criar a obra → informar o contrato → cadastrar/sugerir fases → escolher a equipe e a data → confirmar presença → registrar recebimentos e pagamentos. Empreitas entram somente para quem trabalha por metragem ou valor fechado. O aplicativo deve indicar o próximo passo sem obrigar preencher tudo de uma vez.

## 5. Ordem proposta para futuras correções

1. Corrigir significados e consistência: valor do contrato versus saldo, etapa atual única, fase principal versus subetapas e rótulo do custo de mão de obra.
2. Evitar erro de operação: data da escala clara, aviso de alterações não salvas, modalidade diária/empreita e possíveis lançamentos repetidos.
3. Organizar somente a Central: reduzir redundâncias aprovadas, atualizar referências a fotos e dar um caminho claro aos estados vazios.
4. Refinar celular deitado: fontes, nomes completos, cabeçalho compacto e hierarquia financeira, mantendo as funções.
5. Testar cada alteração isoladamente, depois regressão integrada, e apresentar a prévia antes de qualquer publicação.

## Rastreabilidade técnica

- `public-assets/work-hub-v1.js`: cabeçalho/etapa atual e Visão geral (aprox. linhas 154–200), equipe e data (207–237), relatórios de fases/financeiro (240–298), Definir valor/Recebimento (350–377).
- `public-assets/work-costs-v1.js`: contrato por metragem/fechado (50–76), seletor diária/empreita e resumo das empreitas (118–132), relatório por fase e histórico único (133–150).
- `public-assets/work-control-v1.js`: cadastro de fase e percentual (99–112), controle de nomes na sugestão (114–144), mão de obra nos cartões (155–207).
- `public-assets/work-control-core-v1.js`: cadastro de obras/fases (55–130), registros da escala, desduplicação de lançamentos por identificador e média dos percentuais (155–243).
- `public-assets/work-cost-core-v1.js`: proteção por operação e gravação de contratos, pagamentos e extras (53–119).
- `public-assets/work-schedule-core-v1.js` e `public-assets/work-schedule-v1.js`: seleção da fase atual do cronograma, datas e mensagens de prazo.
- `index.html`: escolha antiga da etapa atual (aprox. 835), cartão da obra com referências a fotos (1634–1635), editor de saldo previsto (2882–2897).

As referências são da versão local analisada e podem mudar após futuras edições.

## Estado da entrega

- Código do aplicativo: nenhuma alteração nesta auditoria.
- Dados reais, contas, permissões, pagamentos e arquivos antigos: não acessados nem alterados.
- Artefatos produzidos: este relatório e capturas locais de testes com dados inteiramente fictícios.
- Publicação: não realizada. As recomendações não foram implementadas.
