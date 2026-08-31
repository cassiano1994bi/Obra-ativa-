# Rascunho — Segurança dos dados da Play Store

Este documento é um roteiro conservador para preencher o formulário da Play Console. As respostas finais devem refletir exatamente os serviços e os dados usados no ambiente de produção no momento do envio.

## Declarações gerais

- O aplicativo exige conta para acessar as áreas privadas.
- O tráfego é protegido por HTTPS.
- Os dados não são vendidos.
- Dados podem ser processados por prestadores essenciais de hospedagem, autenticação, banco, armazenamento e envio de e-mail.
- Existe solicitação de exclusão dentro do aplicativo e em página pública.
- A exclusão não é automática: a identidade é confirmada antes de qualquer ação.
- O aplicativo não é direcionado a crianças.
- O APK não solicita localização, câmera, microfone, contatos ou acesso amplo ao armazenamento.

## Tipos de dados a declarar, quando usados pela empresa

- Informações pessoais: nome e e-mail da conta.
- Informações do aplicativo: dados de obras, clientes, equipe, escalas, presenças e observações.
- Informações financeiras: valores operacionais, pagamentos, vales, descontos, recebimentos e orçamento; não são dados de cartão bancário.
- Fotos e arquivos: imagens de obras e documentos enviados pelo usuário.
- Identificadores: identificador técnico da conta, empresa e sessão necessários ao funcionamento.

## Finalidades

- Funcionalidade do aplicativo.
- Autenticação, segurança e prevenção de acesso indevido.
- Gestão da conta e suporte ao usuário.
- Comunicação operacional, como convites e confirmação de solicitações.

## Compartilhamento

Marcar como compartilhamento apenas quando a definição da Play exigir. Provedores que atuam exclusivamente como operadores de serviço podem se enquadrar nas exceções do formulário; confirmar isso ao preencher a versão vigente da Play Console.

## URLs obrigatórias

- Política: https://controle-de-obra-app.netlify.app/privacidade.html
- Exclusão: https://controle-de-obra-app.netlify.app/exclusao-de-conta.html

