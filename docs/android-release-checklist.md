# Checklist de publicação Android

## Concluído

- PWA publicada com manifesto e service worker seguro.
- Service worker limitado a arquivos estáticos; APIs e dados empresariais não entram no cache.
- Política de privacidade pública.
- Solicitação manual de exclusão dentro e fora do aplicativo.
- Projeto TWA separado do código e dos dados empresariais.
- Pacote definitivo: `br.com.escritoriodaminhaobra.controledeobra`.
- Android 16 / API 36.
- Orientação preferencial horizontal.
- Localização habilitada somente para a previsão do tempo; notificações continuam desativadas.
- APK e AAB assinados e verificados.
- Digital Asset Links publicado para a assinatura local.
- Ícone e imagem de destaque preparados.

## Antes do envio à produção

- Instalar o APK em um aparelho Android real e testar celular e tablet na horizontal.
- Capturar imagens da loja usando dados fictícios isolados, nunca dados de empresa real.
- Criar ou confirmar a conta de desenvolvedor da Play Console.
- Criar o aplicativo na Play Console como aplicativo, gratuito, categoria Corporativo.
- Ativar o Play App Signing.
- Copiar a impressão digital SHA-256 do certificado de assinatura da Play e adicioná-la ao `assetlinks.json`.
- Preencher Conteúdo do app, Acesso ao app, Público-alvo, Segurança dos dados e classificação indicativa.
- Enviar primeiro ao teste interno.
- Se a conta pessoal estiver sujeita à regra vigente de teste fechado, concluir o período e o número mínimo de testadores exigidos antes da produção.

## Arquivos de entrega

- APK: `android-twa/app-release-signed.apk`
- AAB: `android-twa/app-release-bundle.aab`
- Chave: `android-twa/android.keystore`
- Ficha da loja: `docs/play-store-listing-pt-BR.md`
- Segurança dos dados: `docs/play-data-safety-draft.md`
