# Oferta pública e revisão de navegação — 06/09/2026

## Correção autorizada para publicação

- A página aberta mostrava 14 dias e os planos antigos. Após uma atualização, o mesmo endereço exibiu 30 dias e um único plano de R$69/mês: os arquivos publicados já continham a oferta correta, mas a visita anterior podia ser mantida pelo cache.
- O menu e o rodapé passam de “Planos” para “Plano único”, preservando a âncora `#planos` e os links de cadastro, login, demonstração e contato.
- Somente o JS/CSS da oferta pública passam a consultar primeiro a versão online, revalidando o cache HTTP. Em falha ou após 5 segundos, usam a última cópia válida disponível.
- Versões dos recursos públicos e cache do PWA atualizadas. Não há recarga forçada de uma sessão em uso nem limpeza de dados de contas.
- Inventário técnico gerado novamente para acompanhar os arquivos atuais; nenhuma regra da IA ou da assinatura foi alterada.

## Testes da correção

- Regressões reproduzidas antes: cache preferia a oferta fictícia antiga; navegação ainda dizia “Planos”. Corrigidas e reexecutadas.
- Verificação da marcação renderizada: exatamente um plano, R$69/mês, 30 dias, quatro links de cadastro e seis perguntas preservadas.
- Cache online, offline, erro temporário e exclusão de APIs privadas verificados isoladamente.
- Oferta conferida em 1440×900, 1366×768, 1024×768, 844×390, 667×375 e 390×844: sem estouro horizontal da página ou do quadro de assinatura.
- Verificação geral: 209 testes aprovados em 50 arquivos de suítes e 66 arquivos de execução verificados. Sete suítes históricas que dependem de pacotes antigos ausentes continuam explicitamente fora da execução.

## Revisão solicitada da barra lateral e abas — sem redesenho

Testes locais, em navegador isolado, armazenamento em memória, dados exclusivamente fictícios e acesso externo bloqueado. Nenhuma conta real foi acessada.

- 60 aberturas por clique verificadas em PC, tablet, celular horizontal normal/pequeno e retrato.
- Início, Obras, Escala diária, Presença, Financeiro, Equipe, Lembretes importantes, Veículos, Relatórios, Administrador e Orçamentos abriram a área correspondente. Pagamentos também foi aberto pelo atalho da Home.
- As seis guias principais do Administrador foram abertas em cinco tamanhos: 30 verificações. Isso valida navegação e disposição, não respostas reais do servidor.
- Nenhum erro de JavaScript nem estouro horizontal da página nas aberturas verificadas. A barra lateral permite rolar até as últimas opções; a logo não foi coberta pelo botão Início nos tamanhos conferidos.

### Pontos encontrados para uma próxima correção

1. **Legibilidade no celular:** “Administrador” quebra de forma inadequada, deixando a última letra sozinha. O estilo permite quebra em qualquer ponto dentro de uma coluna estreita.
2. **Descoberta da rolagem:** a barra lateral tem mais opções abaixo, mas oculta a barra de rolagem e não indica visualmente que continua. O gesto funciona; a indicação pode ser melhorada.
3. **Espaço e sobreposição:** em celular horizontal, a bolha da IA pode ficar sobre controles no canto inferior direito (observado junto aos controles do Administrador e da Escala). Convém reservar espaço ou revisar a posição inicial, mantendo a IA e os botões.
4. **Sugestão de densidade:** cabeçalho, aviso de teste e título do módulo consomem bastante altura nas telas internas. Compactar sua apresentação pode expor mais conteúdo sem remover o aviso nem alterar a assinatura.

Esses pontos NÃO foram alterados: a autorização desta publicação é para a oferta pública. Não foram exercitadas gravações, exclusões, cobrança real, envio de arquivos ou operação em Android físico; a revisão não equivale a homologação completa de todas as funções.

## Preservação

Dados das empresas, permissões, rotas, funções de cobrança, período de teste no servidor, integrações e banco permanecem intocados. Testes, imagens de revisão, arquivos temporários e este relatório não fazem parte do pacote público.
