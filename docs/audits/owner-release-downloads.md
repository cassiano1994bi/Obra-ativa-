# Lista pública e preservação dos downloads — 05/09/2026

## Escopo

O proprietário autorizou retirar os arquivos internos da publicação, mantendo o aplicativo, os downloads oficiais e os dados das empresas. Esta preparação não altera a assinatura, o conteúdo dos APKs, as contas, o banco ou os arquivos originais locais. Não representa publicação concluída.

`scripts/release/public-files.json` fixa uma lista explícita de 92 arquivos estáticos do aplicativo e sete destinos de download. Todos os caminhos são relativos à raiz pública. Os hashes SHA-1 dos downloads são identificadores de conteúdo do inventário do Netlify, não certificados de assinatura Android nem prova isolada de procedência. O tamanho também deve ser conferido antes de reutilizar qualquer arquivo.

## Arquivos públicos preservados

- As 82 entradas originais de `public-assets/` coincidem com os caminhos rastreados pelo Git. Foram mantidas integralmente para preservar as interfaces, ícones, manifesto, arquivos PDF públicos e bibliotecas de PDF/planilhas. A lista inclui os três novos recursos de acompanhamento.
- `index.html`, `manifest.webmanifest` e `service-worker.js` mantêm a entrada e a instalação do aplicativo.
- `privacidade.html`, `exclusao-de-conta.html` e `proposta.html` continuam públicos. A proposta exige `public-assets/orcamento-publico-v1.js`; a exclusão exige `account-deletion-public-v1.js`; as páginas legais utilizam `legal-pages-v1.css` e o ícone anterior, que não pode ser eliminado por parecer antigo.
- `.well-known/assetlinks.json` permanece no mesmo endereço e sem alteração da associação Android nesta tarefa.
- As funções do servidor devem ser compiladas/publicadas separadamente. O arquivo `netlify.toml` é configuração de implantação e não pertence à lista estática; seus cabeçalhos de segurança e de download devem continuar efetivos.

## Downloads e alias oficial

| Destino público | Versão / finalidade |
| --- | --- |
| `/downloads/escritorio-da-minha-obra.apk` | Alias estável para os mesmos bytes do v6 já distribuído |
| `/release-android-20260831-v6-obraativa/obraativa-v6.apk` | v6 preservado |
| `/release-android-20260830-v5-obraativa/escritorio-da-minha-obra-v5.apk` | v5 preservado para links anteriores |
| `/release-android-20260830-v4-obraativa/escritorio-da-minha-obra-v4.apk` | v4 preservado para links anteriores |
| `/release-android-20260829-v3-location/escritorio-da-minha-obra-v3.apk` | v3 preservado para links anteriores |
| `/release-android-20260828-v2/app-release-signed.apk` | v2 preservado para links anteriores |
| `/android-twa/app-release-signed.apk` | Link do APK assinado citado na documentação de distribuição; apenas este arquivo, não a pasta Android |

O site público referencia `downloads/escritorio-da-minha-obra.apk`, mas esse destino não consta do inventário da implantação `rollback 31/08`. Seu restabelecimento evita manter um botão de download sem arquivo. A escolha do v6 foi confirmada por três evidências locais independentes:

1. `android-twa/twa-manifest.json` identifica o pacote `br.com.escritoriodaminhaobra.controledeobra`, nome ObraAtiva, `appVersionName: "6"` e `appVersionCode: 6`.
2. O APK de entrega está em `release-android-20260831-v6-obraativa/obraativa-v6.apk`; o inventário público informa 4.284.305 bytes e SHA-1 `c71414af70c290e9946a34bef46d41af6d7a54ef`.
3. Os pacotes anteriores `deploy-release-14e2078-20260831-1110/site/downloads/escritorio-da-minha-obra.apk` e `deploy-release-46f54b1-20260831-0522/site/downloads/escritorio-da-minha-obra.apk` têm esse mesmo tamanho e hash no inventário do provedor.

Os APKs v5 e v6 têm o mesmo tamanho, mas hashes distintos. Não é seguro identificar versão apenas pelo tamanho. Nenhum APK novo foi criado ou reassinado nesta tarefa. A existência do arquivo de assinatura exposto exige avaliação separada da segurança da distribuição Android; preservar os binários existentes não certifica que a chave esteja segura.

## Exclusões e cuidados de compatibilidade

Não publicar diretórios inteiros de `android-twa/`, `tests/`, `tmp/`, `backups/`, `deploy-*`, `release-*`, `docs/`, `scripts/`, `supabase/`, arquivos `index.before-*`, relatórios, configurações privadas, fontes de funções, keystores, AABs, APKs sem assinatura ou arquivos auxiliares de build. A exceção aos prefixos Android/release são somente os destinos APK enumerados no manifesto; não usar glob para selecioná-los.

Rotas internas de pacotes antigos que eventualmente tenham sido compartilhadas deixarão de servir as cópias de aplicação. Não há referência a essas rotas nos arquivos ativos do aplicativo. Os sete destinos oficiais acima preservam o fluxo público de instalação, incluindo o link estável que o próprio site oferece.

Nunca gerar uma regra geral que redirecione arquivos internos para `index.html` e depois considerar resposta 200 uma remoção comprovada. Conferir a inexistência desses conteúdos e o inventário final de implantação. A limpeza do domínio principal não elimina, por si só, o conteúdo de URLs imutáveis de implantações antigas; elas precisam de avaliação separada. Não apagar automaticamente históricos de implantação ou revogar chaves.

## Conferência realizada

Leitura somente de código, documentação e metadados locais do inventário. Nenhuma entrada em conta real, requisição Netlify adicional, download de arquivo sensível, alteração operacional, cópia de binário ou publicação foi realizada por esta subtarefa.
