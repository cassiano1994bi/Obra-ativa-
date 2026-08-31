# Plano seguro para atribuir presenças antigas às obras

Status: **somente planejamento; não aplicado ao Supabase nem publicado**.

## O que já está pronto na prévia local

- Tela exclusiva do Financeiro para revisar presenças sem obra atribuída.
- Seleção individual ou por data, filtros, confirmação detalhada e cópia de segurança local.
- Preservação de status, data, diária, custo, escala, pagamentos e quantidade de registros.
- Bloqueio de registros duplicados, obras arquivadas e perfis que não sejam o proprietário.
- Salvamento online bloqueado até a proteção de servidor descrita abaixo estar concluída.

## Por que a gravação online ainda não deve ser ativada

O estado da empresa ainda é salvo como um bloco completo. A rotina antiga aceita gravações sem verificar uma versão do estado. Assim, outro aparelho com uma cópia antiga poderia sobrescrever uma atribuição recém-feita. Uma checagem apenas na tela também não é suficiente para garantir que somente o proprietário use a ação.

## Etapa necessária antes da publicação

1. Adicionar uma revisão numérica ao estado da empresa.
2. Criar uma nova rotina geral de salvamento que exija a revisão esperada e rejeite conflitos.
3. Criar uma rotina exclusiva do proprietário para receber somente os identificadores da presença e da obra.
4. Validar no servidor: proprietário ativo, presença única, obra existente, obra não arquivada e lote sem identificadores repetidos.
5. Alterar somente `attendance.workId` e acrescentar o histórico da atribuição.
6. Registrar cada alteração em histórico imutável de auditoria.
7. Fazer o aplicativo atualizar a revisão após cada salvamento e recarregar os dados quando houver conflito.
8. Após os testes, desativar a rotina antiga de gravação completa e impedir alteração direta do estado por usuários autenticados.

## Testes obrigatórios antes de ativar

- Proprietário consegue atribuir uma presença válida.
- Gerente, colaborador e visualizador recebem bloqueio.
- Registros duplicados ou sem identificador não são alterados.
- Obra arquivada não pode receber atribuição.
- Duas sessões simultâneas: uma salva e a outra recebe conflito sem sobrescrever dados.
- Status, datas, diárias, valores, escalas, pagamentos e demais áreas permanecem idênticos.
- Uma atualização antiga em outro aparelho não desfaz a atribuição.
- Backup e restauração são verificados antes de qualquer ativação em produção.

Nenhuma dessas mudanças de servidor foi aplicada nesta etapa.
