# Entrada e cadastro mais claros — prévia local

## Pedido autorizado

Separar visualmente “Entrar” de “Criar conta grátis”, com 30 dias grátis indicados, e facilitar o acesso no celular horizontal. Esta autorização foi tratada como implementação e teste local, sem publicação.

## Alterações

- O botão principal continua dentro do formulário. Logo abaixo dele aparece uma única escolha secundária compacta: “Criar conta grátis · 30 dias grátis” no login, ou “Já tem conta? Entrar” no cadastro. Nada foi acrescentado acima do cartão de boas-vindas.
- “Criar conta grátis” substitui os rótulos inconsistentes do cadastro tanto na recepção quanto nos quatro convites da página pública. O botão original que troca a tela foi apenas reposicionado e mantém o mesmo evento.
- A recepção informa “30 dias grátis · Depois, R$ 69/mês”, sem alterar o período nem a cobrança.
- No celular horizontal, apresentação e formulário ficam lado a lado. As escolhas e o botão de entrar aparecem na primeira área visível em 844×390 e 667×375.
- Google/Microsoft, recuperação de senha, lembrar conta, mostrar/ocultar senha, indicador de força, etapas de cadastro, WhatsApp e demonstração foram preservados.
- “Privacidade de uso” permanece disponível uma vez na recepção/login e foi removida da barra lateral e de todas as telas internas após o acesso.
- “Permitir medição” fica salvo neste computador ou celular e não volta a interromper a recepção. “Agora não” fecha o aviso apenas na visita atual e permite que ele reapareça numa visita futura. A escolha pode ser revista pelo atalho de privacidade no login.
- A conta administradora mantém a isenção, mas não exibe o cartão grande de assinatura no topo.
- Para usuários comuns, o aviso superior aparece somente nos últimos sete dias do teste ou do período pago, ou quando atraso/bloqueio exige uma ação. Durante o uso normal, ele não ocupa espaço.
- O primeiro login não é mais marcado temporariamente como “somente consulta” enquanto o servidor confirma o teste. Uma migration idempotente garante e repara o registro dos 30 dias grátis sem renovar prazos existentes.

## Arquivos

- `public-assets/obraativa-reception-v1.js`: organização das escolhas e texto do botão, sem novas requisições nem substituição dos métodos de autenticação.
- `public-assets/obraativa-reception-v1.css`: escolhas legíveis e layout horizontal, com alvos de pelo menos 44 px.
- `public-assets/obraativa-product-site-v2.js`: padronização dos quatro rótulos, sem mudança de destinos.
- `netlify/functions/_assistant/assistant-code-snapshot.generated.mjs`: inventário técnico regenerado; não altera regras da IA.
- Testes: `tests/auth-entry-clarity-check.mjs`, `tests/mobile-brand-privacy-check.mjs`, `tests/billing-visual-check.mjs`, `tests/auth-experience.test.mjs`, `tests/product-public-site-v2.test.mjs` e `tests/billing-return.test.mjs`.

## Testes

- 215 testes aprovados nas suítes atuais; 66 arquivos de execução verificados. Sete comparações históricas de pacotes ausentes continuam explicitamente fora da execução.
- Cinco tamanhos: 1440×900, 1024×768, 844×390, 667×375 e 390×844; dez verificações de layout entre login e cadastro.
- Em 120 combinações entre tamanhos, estado de marca e módulos, foram confirmados zero controles de privacidade dentro do aplicativo, sem duplicação da logo nem estouro horizontal.
- Os estados de assinatura foram simulados localmente: administrador, teste normal, sete dias finais, assinatura normal, sete dias finais, atraso e bloqueio. A regra financeira não foi alterada.
- Troca de modo por teclado, e-mail fictício preservado entre telas, mostrar/ocultar senha, recuperação e retorno ao login, além dos quatro convites públicos ao cadastro.
- Confirmadas as mesmas funções de autenticação antes e depois da navegação. Nenhuma credencial foi enviada, conta criada ou banco acessado.
- Regressão adicional: seis tamanhos da página pública e 62 renderizações de módulos, sem erros de JavaScript nos cenários testados.
- Todos os testes usam armazenamento em memória, rede externa bloqueada e dados fictícios. Não houve teste em Android físico.
- O cache do aplicativo avançou para uma nova versão, evitando que celular ou PC reutilizem os estilos e comportamentos anteriores após uma futura publicação.

## Estado de entrega

Somente prévia local para aprovação visual. Sem commit, push ou publicação nesta alteração. Dados reais, segurança, permissões, assinatura, APIs e rotas permanecem intactos. Capturas e simulações não integram o pacote público.

## Pagamento disponível antes do vencimento

- A assinatura continua acessível em `Administrador > Assinatura` mesmo quando o aviso superior está oculto.
- O cliente pode autorizar a renovação durante o teste ou durante um período já pago; as datas restantes são preservadas.
- A caixa de seleção redundante foi removida. O botão agora informa claramente `R$ 69/mês` e o próprio clique representa a autorização explícita.
- Uma assinatura recorrente já autorizada não cria outra cobrança duplicada: a tela mostra a próxima data e leva ao gerenciamento da forma de pagamento no Mercado Pago.
- Em ambiente de teste, uma rejeição ao abrir o checkout agora orienta usar a conta Comprador, separada da conta Vendedor, sem expor dados internos do provedor.
- Nenhuma cobrança real foi executada nos testes locais.
