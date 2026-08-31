# ObraAtiva

Aplicativo de gestão inteligente de obras, equipes, presença, pagamentos,
financeiro, orçamentos e rotinas operacionais.

## Estrutura

- `index.html` — shell e renderização da aplicação web.
- `public-assets/` — módulos JavaScript, CSS e imagens usadas pelo aplicativo.
- `netlify/functions/` — funções de servidor; credenciais ficam somente nas
  variáveis protegidas do ambiente de hospedagem.
- `supabase/migrations/` — alterações de estrutura do banco, sem dados de
  empresas.
- `android-twa/` — código-fonte do pacote Android/TWA. Chaves, builds e
  binários assinados ficam fora do Git.
- `docs/` — documentação de produto, segurança e publicação.
- `scripts/` — verificações automatizadas de qualidade.

## Regras de segurança

1. Dados de empresas, clientes, funcionários, presença, pagamentos e saldos
   nunca entram no código, em testes ou em commits.
2. Testes usam páginas isoladas e dados claramente fictícios; não acessam a
   conta real nem o armazenamento da aplicação.
3. Backups, prévias, diretórios `deploy-*`, releases, testes, temporários,
   chaves, senhas, APKs e AABs são excluídos pelo `.gitignore`.
4. Mudanças devem ser pequenas, revisadas e não podem remover regras ou
   funcionalidades existentes sem autorização explícita.
5. Publicação online continua manual e exige autorização do proprietário.

## Verificação local

Antes de registrar uma melhoria, execute a auditoria completa:

```text
node scripts/run-assistant-quality-gate.mjs
```

Para uma prévia estática local, sirva a pasta com qualquer servidor HTTP local
e abra `index.html?app=1`. A prévia não deve receber credenciais ou dados reais.

## Fluxo de contribuição

- `main` é a branch principal e deve permanecer estável.
- Use branches de trabalho para cada melhoria e descreva o impacto no commit.
- Confira `git diff` e o resultado da auditoria antes de integrar em `main`.
- Só configure o remoto e envie alterações ao GitHub depois de confirmar o
  repositório de destino e verificar que nenhum arquivo ignorado está sendo
  enviado.
