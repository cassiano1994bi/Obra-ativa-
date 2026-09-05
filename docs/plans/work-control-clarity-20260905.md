# Painel da obra — simplificação da experiência

## Escopo

Revisão local solicitada para que o cliente entenda a tela e o preenchimento
com facilidade. Nenhum envio ao GitHub, publicação, acesso a conta real ou
alteração de dados de empresa. Esta revisão não aplica a migration pendente.

## O que dificultava o primeiro uso

- Indicadores com o mesmo destaque antes das ações e dos avisos úteis.
- Termos como marco inicial, peso e pessoas-dia sem explicação junto ao campo.
- Cadastro extenso sem identificação clara de campos opcionais.
- Botão Salvar no fim do preenchimento, difícil de localizar em tela baixa.
- No aplicativo completo, a barra lateral se sobrepunha aos novos formulários
  em celulares pequenos. A prévia isolada não mostrava esse conflito.

## O que mudou

- Navegação: Resumo, Fases e fotos, Equipe e prazos, Financeiro e Histórico.
- Orientação curta no topo e ação de adicionar a primeira fase quando necessário.
- Resumo com andamento, fase, equipe e término estimado primeiro; alertas e
  ações a seguir. Todas as avaliações continuam disponíveis na mesma página.
- Cadastro por assunto: situação atual, datas, valores e equipe prevista.
- Campos obrigatórios/opcionais identificados; exemplos junto aos percentuais.
- Terminologia mais direta, sem mudar as fórmulas ou o significado dos valores.
- Campo de trabalho previsto explicado como pessoas × dias, mantendo a unidade.
- Para uma obra nova, o caminho mínimo foi testado: nome, salvar, primeira fase
  e atualização do andamento. Os valores não informados continuam desconhecidos.
- Área de preenchimento rolável separada do rodapé: Salvar continua acessível e
  não cobre campos. Erros são anunciados e trazidos à área visível.
- Ajuste de sobreposição limitado aos formulários do Painel da obra, sem mudar
  a barra lateral, outros formulários ou telas de autenticação.

Os campos e detalhes existentes não foram removidos. As condições anteriores
de exibição (permissões, valores anteriores para obras já iniciadas, detalhes
opcionais expansíveis) foram preservadas.

## Preservação

Sem alterações em cálculo, persistência, sincronização, banco, permissões,
rotas, fotos, presença, pagamentos ou escala. Os campos mantêm seus nomes e
validações anteriores. O registro inicial continua preservado; a interface não
promete edição retroativa desse registro.

## Arquivos

- `public-assets/work-control-v1.js`: apresentação, textos, orientação e formulário.
- `public-assets/work-control-v1.css`: hierarquia, formulário e sobreposição local.
- `netlify/functions/_assistant/assistant-code-snapshot.generated.mjs`: inventário
  de código regenerado após os ajustes, exigido pelos testes de integridade.
- `tests/work-control-clarity.test.mjs`: caminhos de primeiro uso, campos e tamanhos.
- `tests/work-control-full-app.test.mjs`: verificação dos formulários dentro do
  aplicativo completo, incluindo elementos realmente livres da barra lateral.

## Validação

Testes somente com dados FICTÍCIOS em memória e rede externa bloqueada.

- Cadastro mínimo, obra já iniciada, valores zero/desconhecidos, datas, equipe,
  primeira fase, atualização de progresso e correção inválida.
- Inventário dos campos antes/depois, evitando perda de opções.
- Cinco tamanhos na prévia: 1440×900, 1024×768, 844×390, 667×375 e 390×844.
- Aplicativo completo em quatro tamanhos, com teste de alcance visual dos
  títulos, campos e botões, além da ausência de sobreposição do rodapé.
- Fluxos existentes de fases, fotos, escala, despesas e permissões mantidos.
- Verificação geral: 163 testes atuais aprovados, zero falhas, em 45 arquivos
  de testes. Sete suítes de comparação com pacotes históricos ausentes não
  foram executadas e não estão incluídas nesse total.

A inspeção visual é uma simulação de primeiro uso, não uma pesquisa com clientes
reais. Não foi testado em aparelho Android físico nem com teclado virtual real.
Os testes e as capturas locais não pertencem ao pacote público.
