# Publicação autorizada: retirada da IA e correções de assinaturas

Data: 11/09/2026. Base: 427a1fd001f91a1c4998174bfb536394c3b6e06e.

## Escopo aprovado

- Retirada da bolha, acessos, boas-vindas e promoção da assistente no login/plano. Seis endpoints respondem 410 antes de consultar dados ou consumir o provedor. Scripts removidos do pacote público/cache; helpers compartilhados preservados nos bundles privados.
- Sete achados corrigidos: recusa terminal não se torna incerta novamente; bloqueio antes de estornar pagamento da equipe; modal acompanha liberação; retorno suporta sessão/empresa lentas e falha temporária; impressão preservada no modo consulta; cancelamento seguro sem depender do preço divergente; proteção integral do período vigente.
- Retirada do acesso duplicado Equipe e escala dentro da Central da Obra, já autorizada e presente na prévia revisada. Os módulos globais permanecem.
- Plano de R$ 69/mês, teste de 30 dias, tolerância de três dias, permissões, autenticação e dados preservados. Nenhuma mudança de banco, migration, variável remota, credencial ou assinatura de cliente.

## Verificação

Todas as contas, empresas, pessoas e valores dos testes são fictícios, com rede externa bloqueada e armazenamento em memória. Nenhuma conta real foi usada.

- 68 testes de billing/provider/retorno/SQL/legado/regressões aprovados.
- 12 cenários integrados handlers → banco em memória → interface aprovados.
- 5 verificações SQL de salvamento real com guards de revisão/custos e vencimento aprovadas.
- 27 testes de retirada da IA, recepção, página pública e sintaxe aprovados.
- 3 testes da Home e módulos, incluindo cinco dimensões de tela, aprovados.
- 5 suítes da Central da Obra/fases/custos/quinzena aprovadas novamente antes da publicação.
- Regressões visuais de billing e ausência da assistente aprovadas em 1440×900, 844×390 e 390×844.
- Convenções, orçamento público de desempenho, dependências locais e git diff --check aprovados.

Não foi executado o agregador de todas as suítes históricas: inclui telas/pacotes antigos e testes que exigem a assistente retirada. Os arquivos históricos foram preservados; não se declara aprovação da suíte histórica completa. As regressões novas verificam explicitamente a remoção e usam a interface atual.

## Limites

Compra real, entrega de webhook em produção e renovação real não são certificados pela simulação. Tentativas antigas de resultado incerto não foram resetadas sem evidência do provedor. Pacote público usa somente manifesto explícito e downloads oficiais já existentes verificados por hash; testes, documentação, SQL e segredos ficam fora da hospedagem pública.
