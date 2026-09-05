# Verificação de publicação do painel do proprietário

## Escopo e autorização

O proprietário autorizou testar e publicar o novo Administrador com acompanhamento de usuários e campanhas; posteriormente autorizou também a preparação/ativação da estrutura de acompanhamento. Dados operacionais de empresas e contas reais não podem ser usados nos testes nem alterados nesta entrega.

## Conferências executadas

- Gate da cópia exata de lançamento após o reforço de segurança: 133 testes passaram em 39 arquivos de suítes, com 3 falhas antigas da base online mantidas visíveis e 7 suítes históricas separadas por dependerem de pacotes antigos ausentes. Encerramento de sessão exige sessão aberta do próprio usuário e é idempotente; a regressão rejeitou 200 tentativas com identificadores inéditos.
- Interface real dos módulos testada com PostgreSQL/PGlite em memória e dados explicitamente fictícios: PC 1440×900, notebook 1280×720, tablet 1024×600, celular horizontal 844×390 e 667×375.
- Navegação, busca, detalhes de usuário, campanhas, configurações e bloqueio de usuário sem privilégio aprovados. Nenhuma chamada desses testes à nuvem real e nenhum overflow horizontal da página.
- GitHub consultado sem alteração: `main` estava em `9aa1c875182487c8fe111ccb591a59b153246219`.
- Criada branch local `release/owner-insights-20260905` e cópia isolada de preparação. O banco de produção recebeu somente a migration aditiva aprovada; as seis variáveis foram gravadas como segredos do Netlify e a coleta geral foi ativada, permanecendo dependente da escolha individual de cada usuário. Commit, push e deploy ainda não tinham sido realizados no momento deste registro.

## Risco encontrado na publicação existente

A implantação online tem título `rollback 31/08` e não informa commit associado. O inventário do provedor contém 4.191 arquivos, incluindo testes, prévias, cópias antigas, infraestrutura e um arquivo de assinatura Android. Um pedido HTTP HEAD sem autenticação ao arquivo de assinatura retornou 200 e tipo binário; seu conteúdo não foi aberto nem baixado. Isso comprova exposição do arquivo, não comprova uso indevido por terceiros nem conhecimento da senha da chave.

O pacote online não pode ser reutilizado integralmente. O proprietário autorizou excluir os arquivos internos da próxima publicação, preservando o aplicativo, os downloads oficiais e os arquivos locais. A nova lista explícita contém somente 92 arquivos estáticos, 7 caminhos de download Android, cabeçalhos processados e 13 funções. A limpeza do site principal, por si só, não garante a indisponibilidade das URLs imutáveis de implantações anteriores; essa verificação e eventual remoção/proteção exigem tratamento próprio. Deve-se avaliar a segurança da assinatura Android antes de novas distribuições; não trocar nem revogar chaves automaticamente.

Também há diferenças entre o GitHub e seis arquivos públicos de execução online: `index.html`, `landscape-density-v1.js`, `mobile-ui-v2.js`, `obraativa-social-auth-v1.js`, `responsive-ui-v3.js` e `responsive-visual-phase2-v1.js`. As quatro alterações locais antigas de responsividade já correspondem à publicação online. Portanto, não é seguro simplesmente publicar a base Git e presumir que essas mudanças ainda são inéditas: a versão online precisa ser conciliada e registrada sem reverter correções já disponíveis.

## Condições concluídas antes do envio

1. Autorização específica de limpeza recebida.
2. Base pública conciliada com a versão online, preservando correções existentes e excluindo mudanças locais não aprovadas.
3. Painel e reforços de segurança incorporados; gate repetido na cópia exata de lançamento.
4. Pacote definido por lista explícita, sem testes, prévias, SQL, documentação interna, fontes Android ou credenciais; downloads oficiais identificados por hash.
5. Migration aplicada no projeto `vqwxvsasmybwpeqiyzmd`, com tabela instalada, coleta inicialmente desligada e acesso anônimo ao relatório negado. Depois da configuração protegida do backend, a coleta geral foi ativada; o consentimento individual continua obrigatório.
6. Restam commit/push, conferência de sincronização, tentativa de deploy e verificação pública. O painel do Netlify informa que deploys de produção estão pausados por créditos; esse bloqueio externo deve ser respeitado e relatado se impedir a publicação.

## Estado

Dados operacionais de empresas preservados. Banco e cofre do backend configurados; nenhuma credencial foi colocada no código ou no Git. Publicação ainda não concluída e sujeita ao bloqueio de créditos exibido pelo Netlify.
