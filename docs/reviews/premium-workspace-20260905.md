# ObraAtiva — revisão visual interna

Status: implementado localmente para revisão. Sem commit, push, publicação ou alteração em banco de dados.
Branch local: `feature/identidade-premium-interna`.

## Proposta aplicada

- Referência: estilos atuais da página pública e da recepção/login. Azul-marinho `#020b18` e `#081828`, verde `#2bd466` e texto claro `#f4f8fc` nas áreas de comando. Conteúdo operacional em cartões claros, texto `#142e40` e apoio `#4c6374`.
- Refinamento da primeira proposta local: menu e cabeçalho escuros, superfícies de trabalho claras, contornos discretos e sombras leves. Conteúdo e números continuam vindo das funções existentes. Verde reservado à ação principal, estado selecionado e indicadores positivos; ações secundárias neutras.
- Cabeçalho padrão reduzido de 100 para 88 px de altura mínima, com saudação de 20–24 px e nome menor. Atalhos padrão reduzidos de 112 para 96 px no desktop; modo Compacto de 92 para 84 px e Amplo de 136 para 120 px. Estes valores comparam as duas propostas locais, não representam uma versão publicada.
- Ícones de 50 px no desktop, 42 px no tablet/celular horizontal e 36 px na faixa horizontal até 700 px. Títulos de 17/15/14 px e descrições de 12/11 px conforme a largura. Em celular horizontal usual, cartão padrão de 92 px com ícone e nome juntos; na tela de 667 px, 112 px e conteúdo vertical para não quebrar “Pagamentos” no meio. Quatro atalhos continuam na primeira linha. Alturas são mínimas: textos podem ampliar o cartão.
- No desktop largo, escala do dia e avisos ficam lado a lado. No tablet/celular até 1180 px, escala e avisos vêm antes do clima. Os indicadores ocupam sua própria linha, sem serem esticados pela previsão. A alteração da ordem também ocorre no documento para acompanhar a leitura e o teclado, usando os mesmos elementos e eventos. Um único observador de mudança de faixa de largura reutiliza a atualização já existente; sem novos timers ou observadores de mutação.
- Tamanhos Compacto/Confortável/Amplo, quantidade, ordem e visibilidade do editor continuam funcionando. A prévia dentro do editor acompanha as novas cores.
- Menu lateral com seleção verde, logo preservada e nomes organizados no espaço disponível.
- Módulos com cabeçalhos azul-marinho, superfícies de trabalho claras e ações verdes; exclusões e estados de alerta mantêm seu tratamento separado.
- Assistente mantém avatar, ações e arraste; apenas o aro em repouso acompanha o verde da marca. Estados de processamento e alerta não foram substituídos.
- Sem novas imagens de produção, bibliotecas, fontes remotas ou animações contínuas. A preferência do dispositivo por reduzir movimento desativa as transições do menu e dos atalhos.

## Preservado

Rotas, eventos de clique, formulários, regras de acesso, autenticação, cálculos, registros, dados zero e obras sem fase. Não foram recriados os painéis complexos de fases que o usuário pediu para simplificar. A página pública e o login não receberam mudanças de conteúdo ou de autenticação.

## Arquivos

- `public-assets/obraativa-workspace-premium-v1.css`: camada visual escopada ao aplicativo interno.
- `public-assets/obraativa-home-v1.js`: somente ordem de apresentação dos blocos existentes e atualização ao cruzar a faixa de largura; nenhum cálculo, filtro, permissão ou ação foi alterado.
- `index.html`: referência à nova folha de estilos; nenhuma alteração nos scripts de negócio.
- `service-worker.js`: versão local de cache v47 e inclusão do CSS no núcleo offline, para uma eventual publicação aprovada.
- `scripts/release/public-files.json`: inclusão explícita do novo CSS, sem incluir testes ou relatórios.
- `netlify/functions/_assistant/assistant-code-snapshot.generated.mjs`: índice de código regenerado; nenhuma mudança nas regras da IA.
- `tests/premium-workspace.test.mjs`, `tests/premium-workspace-visual-check.mjs`, `tests/helpers/premium-workspace-preview.mjs` e `tests/premium-workspace-review.html`: verificações e demonstração isoladas.

## Validação

Todos os testes foram feitos com registros identificados como FICTÍCIOS, armazenamento em memória, servidor local e rede externa bloqueada. Nenhuma conta real foi acessada.

- 45 combinações: Home, Obras, Escala, Presença, Pagamentos, Financeiro, Equipe, Relatórios e Administrador × 1440×900, 1024×768, 844×390, 667×375 e 390×844.
- Mais cinco verificações da Home preenchida: três obras, três linhas da escala, dois avisos, duas atividades, dados zero e previsão fictícia completa. Nenhum elemento de registro ou clima com transbordamento horizontal nesses cenários.
- Sem overflow horizontal da página nessas combinações; conteúdo dos atalhos dentro dos cartões; quatro atalhos na primeira linha em modo horizontal padrão.
- Comparação de controles, destinos, estados de ocultação e dados com o CSS ligado e desligado: preservados.
- Cliques reais nos quatro atalhos; edição de tamanho/quantidade/colunas, salvamento e restauração do padrão; foco de teclado; mensagem de clima sem autorização; assistente visível e arrastável após edição.
- Ordem operacional verificada após redimensionamento. Contraste mínimo de 4,5:1 para título e descrição dos atalhos; texto legível no hover; transições desativadas com redução de movimento.
- Capturas antes/depois e referência do login, com comparação lado a lado na página de revisão.
- Verificação geral final: 166 testes aprovados, zero falhas, em 46 arquivos de suíte; sintaxe de 61 arquivos de execução aprovada. Verificações de convenções, performance pública e recursos do pacote aprovadas. Sete suítes históricas continuam fora da execução porque dependem de pacotes antigos ausentes; não foram removidas.

As dimensões de tablet e celular foram simuladas no Chrome. Isso não substitui o aceite visual em um aparelho Android físico. A escolha estética final depende da revisão do proprietário.

## Como revisar sem publicar

Execute `node tests/helpers/premium-workspace-preview.mjs` e abra o endereço local informado, com `/tests/premium-workspace-review.html` para a comparação ou `/tests/premium-workspace-preview.html?app=1&scenario=busy&weather=1` para navegar na demonstração fictícia preenchida.

Evidências regeneráveis em `tmp/premium-workspace-qa/`: `checks.json`, imagens `before-*`, `after-*`, `modern-*`, referências pública/login e `comparison.png`. Esta pasta não entra na publicação nem no Git. As comparações identificam quando uma proposta usa mais registros fictícios que a outra.
