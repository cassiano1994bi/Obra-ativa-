# ObraAtiva — amostra de paleta e contraste público

Data: 09/09/2026. **Somente prévia local. Não publicado.**

## Escopo desta etapa

Primeira amostra visual na Home e no menu principal, com a paleta solicitada. Correção adicional do texto escuro sobre fundo escuro da página pública, especialmente no botão Entrar. Nenhuma mudança de cadastro, autenticação, navegação, dados, APIs, Supabase, cálculos ou regras de assinatura nesta etapa visual. Alterações funcionais anteriores do projeto foram preservadas.

## Mapeamento antes da edição

O inventário `paleta-cores-inventario-20260909.json` registra referências de arquivo/linha, contagens e definições de tokens. Foram examinados 81 arquivos HTML/CSS/JS da lista de publicação: 2.758 formas textuais de cores e 192 declarações de variáveis. Isso NÃO significa 2.758 cores visíveis diferentes: inclui transparências, diferentes sintaxes e expressões encontradas no código.

| Camada existente | Papel | Situação encontrada |
| --- | --- | --- |
| `obraativa-visual-v1.css` | Identidade antiga, menu e ícones | Tokens `--obraativa-*` e cores fixas |
| `obraativa-home-premium-v2.css` | Home, indicadores, atalhos e resumo | Tokens `--obra-home-*` e regras responsivas |
| `obraativa-workspace-premium-v1.css` | Acabamento interno e componentes | Tokens `--workspace-*`, várias substituições de cores fixas |
| `obraativa-design-system-v1.css` | Tipografia, valores, cartões, estados e controles | Tokens `--oa-*`, última camada principal de estilos |
| `obraativa-product-site-v2.css` | Página pública | Declarava `--oa-text`, `--oa-line` e `--oa-surface` no escopo global, em conflito com o painel |
| `obraativa-reception-v1.css` | Formulário de login e cadastro | Tokens próprios `--obra-*`; contraste do formulário preservado |

Componentes compartilhados considerados: menu/estado ativo, cabeçalho, atalhos, indicadores, painéis, botões de consulta, cartões de obras, progresso, estados, gráfico financeiro, alertas e clima. Formulários/modais gerais e demais módulos não receberam a nova paleta nesta primeira amostra.

## Diagnóstico do botão Entrar

Na aplicação completa isolada, o Entrar herdava `rgb(16,47,67)` sobre a navegação escura. A regra global do design system sobrescrevia `--oa-text` do site público. O problema também atingia títulos dos recursos, perfis de público, plano, FAQ e demonstração de painel.

A definição de tokens públicos foi limitada a `body:has(.oa-public-site), .oa-public-site`, mantendo os valores originais da identidade pública. Agora os textos que herdavam essa cor usam `#F4F8FC`. Os botões verdes e o formulário de login não precisaram ser redesenhados. Destinos, tamanhos, textos e posições dos botões foram preservados.

## Amostra da Home

- `#0F2D4A`: menu, cabeçalho de boas-vindas e cabeçalhos estruturais dos painéis.
- `#16A34A`: item selecionado, ação principal, entradas e progresso concluído.
- `#F3F4F6` e branco: fundo de trabalho, cartões e campos de leitura.
- `#2563EB`: previsão/informação e progresso em andamento.
- `#F59E0B`: avisos de atenção.
- `#EF4444`: barra de custo; variação escura para texto de saldo negativo.
- Valores neutros e valores ainda previstos ficam azul-marinho, não verdes.
- Valores principais reaproveitam `--oa-type-value` e recebem peso 800.

Os tokens-base `--oa-palette-*` ficam centralizados no design system existente. Seus aliases são aplicados localmente à Home e ao menu; os valores globais antigos das demais telas continuam iguais. A barra inferior do celular também recebe fundo marinho para não ficar com letras claras sobre branco.

Contraste: `#9CA3AF` permanece disponível para detalhes e bordas, mas legendas pequenas sobre branco usam `#5B6472`. Textos positivos usam `#166534` e negativos `#B91C1C`. O verde puro dos botões usa texto escuro `#061522`, pois letras brancas pequenas nesse verde não atingem contraste 4,5:1. Cabeçalhos marinhos usam branco/cinza muito claro.

As proporções de cores foram tratadas como hierarquia visual, não como preenchimento artificial de porcentagens da tela. As superfícies de conteúdo permanecem claras para leitura operacional. Grades, posição dos componentes, controles, informações e navegação existentes não foram reformulados.

## Arquivos de aplicação alterados somente nesta etapa visual

1. `public-assets/obraativa-design-system-v1.css`: tokens, amostra restrita à Home/menu, contraste e tipografia dos indicadores.
2. `public-assets/obraativa-home-v1.js`: atributos de apresentação para identificar entrada/custo/previsão e o sinal do saldo já calculado. Nenhum cálculo ou fonte de dados alterado.
3. `public-assets/obraativa-product-site-v2.css`: isolamento das variáveis da página pública.

Arquivos locais de apoio: `tests/palette-inventory.mjs`, `tests/palette-inspect.mjs`, `tests/palette-preview.test.mjs`, este relatório e o inventário JSON. Capturas em `tmp/palette-qa/`. Nenhum arquivo de teste, relatório ou captura é acrescentado ao pacote público.

## Verificação

Todas as validações funcionais usam dados explicitamente FICTÍCIOS, armazenamento em memória, navegador separado e requisições externas bloqueadas. Nenhuma conta real foi acessada.

- Comparação A/B com as três versões anteriores dos arquivos: conteúdo e ações da Home idênticos; mesmos valores e comprimentos das barras; dados fictícios inalterados.
- Oito tamanhos: 1920×1080, 1440×1000, 1366×768, 1024×768, 768×1024, 844×390, 667×375 e 390×844.
- Conferência adicional com toque, escala de pixels 2 e movimento reduzido, em celular deitado e em pé.
- Contraste de Entrar normal, hover e foco; títulos anteriormente afetados e controles principais de login/cadastro.
- Clique em Entrar abre a mesma rota de login; alternância Criar conta grátis/Já tem conta continua funcionando. Não foi enviado cadastro ou login real.
- Contraste mínimo 4,5:1 nos textos/controladores selecionados da Home e página pública, incluindo menu ativo/inativo. Não se trata de certificação de acessibilidade de todo o aplicativo.
- Comparação das cores, fontes, medidas e controles dentro de Obras, Equipe, Escala diária, Presença, Pagamentos, Financeiro, Veículos, Relatórios e Administrador: idênticos ao anterior, exceto o menu compartilhado intencionalmente alterado.
- Suítes existentes de design system, autenticação, página pública e sintaxe, além da nova suíte visual.
- Resultado final: **26 testes aprovados, zero falhas**. `git diff --check` sem erros.
- Revisão visual das capturas de desktop e celular. A instalação em aparelho físico/PWA não foi executada; os mesmos arquivos existentes continuam na lista de recursos offline, sem mudar service worker ou manifest nesta etapa.

Comando de regressão local:

```text
node --test --test-concurrency=1 tests/palette-preview.test.mjs tests/global-design-system.test.mjs tests/auth-experience.test.mjs tests/product-public-site-v2.test.mjs tests/source-syntax.test.mjs
```

## Prévia para o proprietário

- Página pública: <http://127.0.0.1:54944/?produto=1&review=contraste-publico-paleta>
- Login e Home com a própria conta: <http://127.0.0.1:54944/?app=1&review=paleta-marinho-amostra>

O servidor local foi conferido por leitura dos arquivos públicos: índice e três recursos correspondem aos arquivos atuais, sem cache. O link funciona neste computador enquanto o servidor estiver ativo. O proprietário pode entrar normalmente; a prévia não é uma conta de treinamento, e os botões de salvar já existentes continuam ligados aos dados da conta. Os testes automatizados NÃO usam esse servidor com conta real.

## Próxima etapa

Revisão da amostra pelo proprietário antes de ampliar a paleta às demais telas. Não houve publicação, aplicação de migration, chamada de API administrativa ou alteração de registros de empresas nesta etapa.
