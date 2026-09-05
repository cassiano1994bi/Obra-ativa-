# Painel do proprietário — usuários, campanhas e organização

## Estado da entrega

Implementação preparada para lançamento. A migration aditiva foi aplicada no projeto de produção correto e validada sem consultar registros operacionais. O backend recebeu chaves novas no cofre protegido do Netlify, sem expô-las no HTML ou Git. A coleta geral foi ativada após a configuração e ainda depende da preferência individual do usuário. Push e deploy não haviam sido concluídos no momento deste registro.

## Entregue

- Administrador do produto organizado em Visão geral, Usuários, Campanhas, Comercial e Configurações e histórico.
- Administradores de empresa continuam com o painel e as permissões anteriores. A autorização no navegador não substitui a verificação `is_sales_admin()` no banco.
- Resumos, busca de nome/e-mail, filtros de atividade, período de 7/30/90 dias, paginação de 50 contas, empresas/perfis, cadastro, último login, origem de convite quando registrada e atividade recente.
- Detalhes de uso: dias medidos, módulos, tempo ativo estimado e últimas 20 sessões do período. Saída confirmada é diferente de expiração do último sinal. Não inventa histórico anterior à coleta.
- Indicadores de primeiros passos: conta criada, empresa vinculada e uso medido. Não lê obras, presenças, pagamentos ou conversas para calcular adoção.
- Campanhas com nome, origem, identificador e link UTM. Lista compacta com funil/custos expansíveis para leitura no celular horizontal.
- Investimento diário manual com confirmação explícita de substituição do total do dia. Recebimentos/estornos comerciais manuais com referência única e deduplicação, separados das assinaturas e do financeiro das obras.
- Preferência individual de medição opcional, isolada por conta no dispositivo, revogável. Recusar não impede acesso. Sem gravação de telas, senhas, conteúdo operacional, localização, textos de entrada ou conversas.
- Batimentos no máximo uma vez por minuto em uso ativo visível/com foco. Eventos de interação apenas atualizam um horário em memória; não enviam cada clique/tecla. Amostragem local de 5 segundos; pausa de 5 minutos após falhas.
- O SQL limita crédito por tempo de servidor e serializa por usuário para não somar o mesmo intervalo em abas/dispositivos. Nunca usa identificador de usuário fornecido pelo cliente para conceder acesso.
- Origem pública em cookie assinado HttpOnly, Secure e SameSite; HMAC de IP com rotação diária somente para limitar abuso. IP bruto não é persistido pelo módulo. Não utiliza fingerprinting.
- Manutenção diária preparada para remover somente detalhes de telemetria vencidos (90 dias) e limites temporários. Empresas e registros operacionais não são tocados. As novas referências não impedem o fluxo existente de exclusão de empresa.

## Significado e limites dos números

- Cadastro: conta em `auth.users`, não funcionário cadastrado na equipe, e não comprovação de pagamento.
- Presença: sinal estimado nos últimos 90 segundos. O painel mostra o horário da consulta; Visão geral e Usuários renovam silenciosamente a cada minuto enquanto em foco, sem formulário/edição aberta.
- Tempo: estimativa de interação em primeiro plano. Pode subestimar leitura longa, perder os últimos segundos em fechamento/queda e não registra uso offline. Não representa produtividade.
- Visitantes: navegadores consentidos identificados pela primeira visita/campanha conhecida em uma janela de cookie de até 30 dias, não número exato de pessoas ou todos os acessos.
- Atribuição: primeira campanha conhecida no mesmo navegador, até 30 dias e somente para conta criada após aquela visita. Não reatribui usuários antigos ou troca a origem de um cliente já vinculado. Sem cookie/permissão ou em outro dispositivo, permanece não identificada.
- Funil: cadastros do período; desses cadastros, uso medido; empresas pertencentes a esses cadastrados com recebimento comercial manual. Colaboradores convidados não duplicam clientes pagantes de uma mesma empresa.
- Custos: gasto do período dividido por cadastros/clientes associados. Custo por cliente é parcial porque a aquisição e o gasto podem estar em períodos diferentes.
- Recebido: pagamentos comerciais manuais do período menos estornos de empresas atribuídas, inclusive cadastros anteriores. Não é lucro. Assinatura ativa e clique de WhatsApp não comprovam venda. O WhatsApp da desenvolvedora é excluído dos interesses do produto.
- Dados recentes continuam parciais. Permissão recusada, rede, bloqueadores, mudança de aparelho e cookies removidos reduzem cobertura; ausência de medição não demonstra abandono.
- Origem vinculada e livro comercial ficam para histórico; detalhes de sessões/dias e visitantes não vinculados são limitados pela manutenção. Exclusões de conta/empresa também removem seus novos registros dependentes.

## Arquivos da implementação

- `public-assets/owner-center-v1.js` e `.css`: painel, formulários, filtros e apresentação.
- `public-assets/admin-navigation-v1.js`: navegação do proprietário; reaproveita os controles anteriores.
- `public-assets/product-activity-v1.js`: preferência, atividade e atribuição opcional.
- `public-assets/account-session-controls-v1.js`: aviso de saída confirmada, não bloqueante e protegido por try/catch.
- `netlify/functions/product-campaign-visit.mjs`: cookie/atribuição e limite do servidor.
- `netlify/functions/product-insights-retention.mjs`: manutenção restrita.
- `supabase/migrations/202609051200_owner_insights.sql`: tabelas novas, privilégios e contratos de coleta/relatório; sem alterações de tabelas operacionais existentes.
- `index.html`: carregamento dos módulos/estilo; `service-worker.js`: recursos opcionais offline. A versão do cache será revista apenas na preparação de publicação aprovada.
- `docs/audits/index-modularization-plan.md`: inventário atualizado (43 scripts externos; nenhum handler inline novo).
- `netlify/functions/_assistant/assistant-code-snapshot.generated.mjs`: inventário técnico regenerado.

## Verificação isolada

- Gate da cópia de lançamento após revisão adicional de segurança: 133 testes aprovados em 39 arquivos de suítes, 3 falhas conhecidas da base online mantidas visíveis e 7 suítes históricas separadas; 58 arquivos de execução, sintaxe, convenções, ativos e orçamento de imagens verificados.
- SQL executado de verdade com PostgreSQL/PGlite em memória: migração, privilégios, recusa, rate limit, tempo sobreposto, propriedade de sessão, filtros, deduplicação, estorno, atribuição e retenção.
- Reforço final do encerramento: 200 tentativas de criar sessões já encerradas foram recusadas; só sessões abertas do próprio usuário podem ser finalizadas. Repetir o encerramento não altera horários nem credita tempo novamente. Os 14 testes de SQL e endpoints passaram após esse ajuste.
- Endpoint testado com transporte simulado: origem, tamanho, consentimento, configuração desativada, assinatura/expiração do cookie, identificação pelo servidor, ausência de IP bruto no payload persistido e uso correto da chave secreta moderna somente no cabeçalho `apikey`.
- Coletor testado em VM com relógio e armazenamento fictícios: ausência de coleta antes da escolha, visibilidade/foco/inatividade, batimentos em lote, saída, troca de conta e falhas sem logout.
- UI real dos módulos em Chrome com RPCs apontando exclusivamente para PostgreSQL em memória: PC 1440×900, notebook 1280×720, tablet 1024×600, celular 844×390 e 667×375. Busca, detalhes, links, campanhas, investimento, recebimento e controles anteriores testados; sem overflow horizontal da página ou erros de JavaScript. Conta sem privilégio não mostra painel nem Campanhas.
- Esses testes não comprovam conectividade com Supabase/Netlify de produção nem substituem validação de Android físico após ativação autorizada.
- Scripts locais: `tests/owner-insights-database.test.mjs`, `tests/owner-insights-server.test.mjs`, `tests/product-activity.test.mjs`, `tests/owner-insights-visual-check.mjs`. Inventário confirmado em 43 scripts externos. Testes/fixtures/imagens de QA não podem ser publicados.
- PGlite foi instalado apenas em `tmp/owner-qa-runtime`, ignorado pelo Git; nenhum pacote novo é necessário no navegador ou nas funções de produção.

## Ativação realizada e operação futura

1. Migration revista, aplicada e conferida; criou somente tabelas/contratos novos. Nenhum dado comercial ou operacional fictício foi inserido na nuvem.
2. Acesso anônimo ao relatório foi conferido como negado. Nenhuma conta foi promovida e nenhuma política antiga foi afrouxada.
3. O servidor foi configurado com `PRODUCT_ANALYTICS_ENABLED=true`, segredo HMAC aleatório, URL e chaves modernas do Supabase e manutenção diária habilitada. Os valores permanecem secretos no Netlify.
4. Commit, push e publicação devem usar exatamente esta cópia, sem `tests/`, `tmp/`, documentação interna, credenciais ou arquivos de QA no site.
5. Conferir a função de manutenção agendada e sua execução. Referência técnica: https://docs.netlify.com/build/functions/scheduled-functions/ . A configuração foi preparada em código, não criada em nenhum serviço remoto.
6. A coleta geral já está ativa; cada usuário ainda escolhe permitir. Criar campanhas reais e informar seus gastos continua sendo ação do proprietário; não foi feito nesta entrega.
7. Google/Meta Ads e faturamento não estão integrados automaticamente: gastos e recebimentos são manuais e claramente identificados. Qualquer integração futura precisa de escopo e autorização próprios.
8. Em falha, desativar a coleta no painel e/ou flag do servidor. Não apagar tabelas nem dados para reverter o visual; restaurar somente arquivos da versão aprovada, preservando o histórico.

## Pendências anteriores preservadas

As alterações locais de fotos das fases, imagens públicas, botão Criar conta e quatro módulos antigos de responsividade já estavam na branch. Não foram revertidas ou publicadas. Antes de uma publicação conjunta, revisar os problemas de formatação antigos de responsividade registrados no relatório anterior e o pacote completo autorizado.
