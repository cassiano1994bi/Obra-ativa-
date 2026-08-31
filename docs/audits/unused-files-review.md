# Fase 8 — revisão segura de arquivos sem uso

Data da revisão: 31/08/2026
Branch local: `audit-fixes-20260831`

## Escopo e decisão

A revisão foi somente estrutural e não acessou dados empresariais. Nenhum arquivo desta lista foi apagado nesta fase. A ausência de referência no código atual não prova que uma imagem não seja consumida por um APK já distribuído, um endereço direto ou material de marca. A exclusão definitiva exige uma autorização separada e um teste do próximo pacote Android.

## Código ativo confirmado

- Os módulos JavaScript e CSS carregados por `index.html`, `exclusao-de-conta.html`, `privacidade.html` e `proposta.html` foram preservados.
- `account-deletion-public-v1.js`, `legal-pages-v1.css` e `orcamento-publico-v1.js` possuem entradas públicas válidas.
- Os ícones `obraativa-ui-works-v2.png`, `obraativa-ui-attendance-v2.png` e `obraativa-ui-financial-v2.png` são atalhos ativos do manifesto PWA.
- `obraativa-ui-icons-v2.png` e os ícones oficiais 192/512/1024 continuam ativos.

## Candidatos sem referência no aplicativo atual

Os itens abaixo somam aproximadamente **6,67 MiB**. Permanecem preservados até a validação do Android e de possíveis endereços diretos.

- `public-assets/finance-attendance-assignment-v1.js`
- `public-assets/controle-de-obra-icon.ico`
- `public-assets/controle-de-obra-icon.svg`
- `public-assets/obraativa-icon-pack-reference-v2.jpg`
- `public-assets/obraativa-icons-reference-v1.png`
- `public-assets/obraativa-ui-icons-v2-1024.png`
- `public-assets/obraativa-ui-admin-v2.png`
- `public-assets/obraativa-ui-assistant-v2.png`
- `public-assets/obraativa-ui-budgets-v2.png`
- `public-assets/obraativa-ui-clients-v2.png`
- `public-assets/obraativa-ui-home-v2.png`
- `public-assets/obraativa-ui-payments-v2.png`
- `public-assets/obraativa-ui-planning-v2.png`
- `public-assets/obraativa-ui-reports-v2.png`
- `public-assets/obraativa-ui-routine-v2.png`
- `public-assets/obraativa-ui-site-v2.png`
- `public-assets/obraativa-ui-team-v2.png`
- `public-assets/obraativa-ui-textpdf-v2.png`
- `public-assets/obraativa-ui-vehicles-v2.png`

## Arquivos locais ignorados pelo Git

As pastas `deploy-*`, `release-*`, `backups/`, `tmp/`, builds Android e arquivos `index.before-*` estão corretamente ignorados no `.gitignore`. Eles não entram em novos commits do GitHub. Foram mantidos porque contêm históricos, pacotes instaláveis e pontos locais de recuperação.

## Próxima ação segura, se autorizada futuramente

1. Gerar um APK de teste sem os candidatos.
2. Testar ícone, atalhos, navegação, assistente, presença, financeiro e telas legais.
3. Verificar URLs diretas usadas em instalações antigas.
4. Remover somente os candidatos aprovados e registrar a exclusão em commit separado e reversível.

## Resolução na Fase 2 de reorganização

Com autorização específica para remover código morto e duplicado, o inventário foi refeito sem conta real, banco ou rede:

- `finance-attendance-assignment-v1.js` foi confirmado sem carregamento, import ou referência ativa e removido.
- As 18 imagens de marca/interface listadas acima foram retiradas de `public-assets/` e preservadas em `docs/design-sources/legacy-unused/`.
- Aproximadamente 6,64 MiB deixaram de fazer parte dos arquivos públicos, sem apagar as fontes do repositório.
- Os ícones ativos do manifesto, atalhos PWA e recursos Android por densidade permaneceram em seus caminhos originais.
- A produção não foi alterada nesta fase local.
