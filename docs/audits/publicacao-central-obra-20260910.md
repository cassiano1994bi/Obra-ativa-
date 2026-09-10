# Liberação da Central da Obra — 10/09/2026

## Escopo autorizado

O proprietário aprovou a prévia `financeiro-fases-conferir` e solicitou publicação,
explicitando o uso do GitHub. A preferência de versionamento foi registrada em
`AGENTS.md`. O repositório continua sendo o existente; não houve refatoração,
troca de hospedagem nem mudança da arquitetura.

Esta liberação reúne as melhorias locais anteriormente solicitadas e revisadas:
Central por obra, equipe/fases/empreitas/custos extras, visão por quinzena,
contrato/aditivos/previsões/recebimentos, ausência sem diária, preservação do
progresso ao excluir fase, retirada da interface de fotos sem apagar registros,
Pixel consentido sem evento Purchase e amostra visual da Home/menu. Inclui a
correção pontual do histórico financeiro antigo sem título e o contraste da
página pública. A paleta não foi expandida para os outros módulos.

## Verificações anteriores ao envio

- Os 105 arquivos estáticos da base online corresponderam integralmente ao
  commit `8170bfb`, sem diferenças remotas a sobrescrever. A produção tinha 114
  arquivos incluindo downloads e cabeçalhos; nenhum caminho privado encontrado.
- Os 8 caminhos de APK foram preservados com tamanho e SHA-1 verificados.
- 94 arquivos JavaScript/funções passaram na conferência de sintaxe.
- Verificações de convenções, orçamento de desempenho e referências de recursos
  aprovadas; 89 dependências locais presentes; `git diff --check` sem erros.
- Rodada consolidada de 31 arquivos de teste: 144 testes aprovados, zero falhas,
  cancelamentos ou testes ignorados. Somente dados explicitamente fictícios,
  armazenamento em memória e rede real bloqueada nos testes funcionais.
- Cobertura inclui Financeiro e histórico antigo, Central, contrato, recebimentos,
  aditivos, falta, empreita, quinzena, fases, prazos, percentuais, autorização,
  isolamento por empresa, cadastro, assinatura, consentimento/Pixel, PWA e
  responsividade de computador, tablet e celular, inclusive horizontal.
- A primeira execução detectou uma diferença transitória de 4px na posição
  vertical do conjunto de cartões, sem mudança de tamanho, conteúdo ou estilo.
  A repetição original passou; a comparação agora normaliza a rolagem/resize,
  mantém igualdade exata da geometria e usa um commit-base imutável. Nenhum
  layout de fases foi alterado para ajustar o teste.

## Estrutura de proteção dos custos

Consulta somente a metadados confirmou que a gravação com revisão já existia,
mas `work_costs_guard` ainda não. A função e o gatilho do arquivo
`202609091200_work_costs_guard.sql`, previamente testados em PostgreSQL isolado,
foram instalados nesta liberação aprovada. Não foi executado INSERT, UPDATE,
DELETE, importação, restauração nem transformação dos registros de empresas.

A consulta posterior confirmou função e gatilho ativos, execução com segurança
definida e execução direta negada aos papéis `anon` e `authenticated`. Nenhuma
conta ou dado operacional foi aberto para essa conferência.

## Empacotamento e publicação

- GitHub recebe a fonte autorizada antes da implantação na Netlify.
- A hospedagem existente não tem compilação automática ligada ao repositório;
  o pacote é preparado a partir do commit exato e publicado na mesma Netlify.
- Somente `scripts/release/public-files.json` define os arquivos estáticos
  públicos. Testes, documentação, SQL, prévias, arquivos privados e credenciais
  não entram no site. Funções são empacotadas separadamente, preservando os
  serviços de assinatura/assistente e agendamentos existentes.
- Cache do PWA avança de v60 online para v63 e os recursos operacionais
  alterados recebem identificador próprio desta versão, sem limpar dados locais,
  sessões ou permissões do usuário.
- A confirmação final depende do envio ao GitHub, estado `ready` da implantação
  e comparação dos arquivos públicos com o pacote. Provas de implantação ficam
  somente no diretório local de empacotamento, nunca no site público.

## Preservação obrigatória

Dados de empresas intocados; nenhum dado de conta copiado para código/testes;
nenhuma conta real usada em teste; somente arquivos e funções autorizados na
implantação; não houve cobrança, alteração de plano ou operação de pagamento.
