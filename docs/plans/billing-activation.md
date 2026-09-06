# Ativação de assinaturas — somente após autorização

Preparação de produção autorizada pelo proprietário em 06/09/2026. As cinco configurações de cobrança estão no Netlify, com token e segredo dos Webhooks protegidos; a conciliação permanece desligada. O destino dos Webhooks foi salvo na aplicação recebedora correta. A estrutura do banco foi conferida somente por metadados, e a migration foi ajustada e testada para o esquema legado. Não houve ainda migration remota, ativação dos 30 dias, publicação do aplicativo ou cobrança real. Os passos abaixo continuam sendo um roteiro, não uma declaração de conclusão; consultar o relatório de assinaturas para o histórico comprovado.

## Configuração protegida

No ambiente de funções Netlify, configurar:

| Variável | Finalidade |
|---|---|
| `SUPABASE_URL` | Projeto de banco do ambiente |
| `SUPABASE_ANON_KEY` | Validação das solicitações autenticadas |
| `SUPABASE_SERVICE_ROLE_KEY` | Acesso privado do servidor às tabelas de cobrança |
| `MERCADOPAGO_ACCESS_TOKEN` | Aplicação recebedora do Mercado Pago |
| `MERCADOPAGO_COLLECTOR_ID` | Identificador numérico da conta recebedora; evita vínculo com outro recebedor |
| `MERCADOPAGO_WEBHOOK_SECRET` | Segredo HMAC fornecido na configuração oficial de notificações |
| `BILLING_APP_URL` | Origem HTTPS canônica do aplicativo, sem credenciais/query |
| `BILLING_RECONCILIATION_ENABLED` | `true` somente no ambiente aprovado e homologado |

Não adicionar segredos a README, Git, capturas, browser, query strings ou mensagens. Não reutilizar tokens expostos anteriormente.

## Ordem de homologação

1. Ambiente de homologação isolado, dados e usuários artificiais, contas de teste do Mercado Pago. Não usar contas ou dados reais do aplicativo.
2. Instalar migrations de base compatíveis e a migration de cobrança. Ela cria estruturas, mas fica `enabled=false` e não altera dados operacionais.
3. Publicar os endpoints apenas em homologação e configurar notificações `subscription_preapproval`, `subscription_authorized_payment` e `payment` para `https://ORIGEM-DO-AMBIENTE/.netlify/functions/billing-webhook`. Usar o segredo desse mesmo ambiente/aplicação.
4. Ativar **somente homologação** com `select public.billing_activate();`, via conexão administrativa segura. A operação concede 30 dias para as contas ali existentes e instala a regra de entrada automática para novos cadastros.
5. Validar pagamento, primeiro débito após teste, recusa, reentrega, atraso, renovação, cancelamento, estorno, isolamento entre empresas, troca de conta, retorno Android e modo consulta.
6. Confirmar que o webhook falha fechado com assinatura inválida, que a rotina agendada aparece como Scheduled e que o retorno do checkout não concede acesso sozinho.

## Produção — precisa de aprovação separada

1. Apresentar relatório da homologação e pedir autorização explícita para migration/ativação e publicação.
2. Registrar a versão aprovada em Git e sincronizar com GitHub antes de publicar, conforme o fluxo definido pelo proprietário.
3. Instalar somente a migration de cobrança compatível. Não reaplicar baseline nem migrations históricas sobre dados de produção.
4. Configurar credenciais/recebedor/segredo reais no servidor e o webhook da aplicação correta. Confirmar recebimento e monitoramento sem cobrança real de teste.
5. Publicar exatamente a versão registrada; excluir `tests/`, `tmp/`, docs de QA e quaisquer fixtures do pacote público.
6. Executar a ativação autorizada. A partir desse momento, todas as contas existentes recebem 30 dias, e novas contas recebem 30 dias no cadastro. O teste não exige cartão e não cria uma assinatura no Mercado Pago por si só.
7. Monitorar pendências de conciliação e os primeiros pagamentos legítimos, sem testar em contas reais. Não remover registros operacionais.

## Contingência

Desativar a criação de novos checkouts ou a regra de acesso não cancela cobranças já autorizadas no Mercado Pago. Uma reversão de cobrança exige tratar as recorrências existentes; nunca basta reverter o front-end.

`billing_control.enabled=false` desliga as novas regras, mas o contrato antigo de acesso volta a valer. Portanto **não** usar isso cegamente para recuperação, pois contas com assinatura legada expirada podem voltar a encontrar o bloqueio antigo. Preferir corrigir a versão mantendo consulta disponível. Repetir `billing_activate()` não estende os testes existentes.

Não executar DROP/TRUNCATE, deletar contas, limpar armazenamento ou reinstalar banco para resolver uma pendência de pagamento.
