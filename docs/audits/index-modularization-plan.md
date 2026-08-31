# Plano seguro de modularização do `index.html`

## Objetivo e limite desta fase

Este documento descreve como reduzir e organizar o `index.html` sem mudar telas,
regras de negócio, armazenamento, cálculos, permissões, navegação ou integrações.
Nesta fase nenhuma extração de código foi executada.

## Diagnóstico congelado em 31/08/2026

- Tamanho do `index.html`: aproximadamente 1,15 MB.
- Linhas físicas: 3.058; diversas linhas concentram milhares de caracteres.
- CSS escrito diretamente no cabeçalho: 20 blocos.
- CSS adicional criado em tempo de execução: 77 blocos.
- JavaScript embutido: 15 blocos funcionais e um bloco de abertura.
- Bloco JavaScript principal: aproximadamente 948 KB e 748 funções nomeadas.
- Eventos HTML como `onclick`, `onsubmit` e semelhantes: 799 ocorrências.
- Encadeamentos que guardam/substituem uma função anterior: aproximadamente 204.
- Scripts externos existentes no final da página: 36 após a camada visual móvel isolada da Fase 8 e a padronização da marca do aplicativo.

Esses números tornam arriscada uma conversão direta para módulos ES, bundler ou
novos componentes. A primeira passagem deve ser uma movimentação mecânica, com
os mesmos símbolos globais e a mesma ordem de execução.

## Contratos que não podem mudar

1. Os nomes globais chamados pelos eventos HTML devem continuar disponíveis.
2. A ordem dos scripts deve permanecer idêntica. Os vários padrões
   `funcaoAnterior = funcao` dependem dessa ordem.
3. Os scripts embutidos atuais não devem receber `defer`, `async` ou `type=module`
   na primeira extração.
4. A cascata CSS deve manter rigorosamente a ordem atual.
5. IDs, classes, atributos `data-*` e estrutura do shell não podem ser renomeados.
6. As chaves `controleObraV1`, `obraAtual` e demais itens de armazenamento devem
   permanecer iguais.
7. Os contratos `CloudSync`, `CompanyWorkspace`, `AccessControl`, serviços de
   domínio e funções Netlify/Supabase não podem mudar.
8. Não deve existir migração ou transformação de dados nesta modularização.
9. Não se deve aproveitar a extração para corrigir, redesenhar ou limpar regras.
10. Cada lote deve permitir retorno imediato ao arquivo anterior.

## Estrutura-alvo proposta

```text
public-assets/app/
  bootstrap/
    splash-v1.js
  core/
    runtime-v1.js
    state-v1.js
    persistence-v1.js
    navigation-v1.js
    rendering-v1.js
  platform/
    cloud-sync-v1.js
    company-workspace-v1.js
    access-control-v1.js
    subscription-v1.js
    product-admin-v1.js
    secure-media-v1.js
  domains/
    works-v1.js
    clients-site-v1.js
    team-v1.js
    planning-v1.js
    attendance-v1.js
    payments-v1.js
    financial-v1.js
    vehicles-v1.js
    reports-pdf-v1.js
    permissions-v1.js
  compatibility/
    ordered-patches-01-v1.js
    ordered-patches-02-v1.js
    ordered-patches-03-v1.js
  styles/
    shell-v1.css
    mobile-phases-v1.css
    public-site-v1.css
    domains-v1.css
```

Os nomes acima são o destino conceitual. Eles não devem ser criados todos de uma
vez. Durante a extração mecânica inicial serão usados arquivos numerados para
preservar a correspondência exata com cada bloco atual.

## Ordem de execução em microlotes

### Lote M0 — congelar o comportamento

- Registrar hash, tamanho, contagem de scripts/estilos e inventário de globais.
- Ampliar o teste de sintaxe para validar a ordem dos scripts.
- Registrar imagens de referência em computador, tablet e celular.
- Criar dados estritamente fictícios para os testes de navegação e formulários.

Critério: nenhuma alteração funcional; todas as suítes atuais aprovadas.

### Lote M1 — extrair somente os 20 estilos estáticos do cabeçalho

- Copiar os blocos, sem reorganizar seletores, para um único CSS externo.
- Colocar o `<link>` exatamente na posição onde começa o primeiro bloco atual.
- Manter todos os estilos criados dinamicamente dentro do JavaScript.
- Não deduplicar regras nesta etapa.

Risco: médio, causado pela ordem da cascata e pelos pontos de quebra móveis.

### Lote M2 — extrair os blocos JavaScript sem dividir sua lógica

- Transformar cada bloco embutido em um arquivo clássico numerado.
- Manter cada `<script src>` na posição original e sem `defer`, `async` ou módulo.
- Começar pelos blocos menores das linhas finais e deixar o bloco de 948 KB por
  último.
- Extrair o bloco principal inteiro para um único arquivo antes de tentar separá-lo.
- Manter temporariamente os 799 eventos HTML e seus nomes globais.

Risco: alto para o bloco principal; baixo a médio para os blocos finais menores.

### Lote M3 — separar o arquivo principal por limites já existentes

- Usar os comentários atuais como fronteiras: núcleo, clientes/site, nuvem,
  empresas, pagamentos, financeiro, obras, equipe e área administrativa.
- Preservar a ordem original dos arquivos no HTML.
- Não mover uma função para uma camada “mais correta” se isso alterar quando sua
  declaração ou substituição acontece.
- Criar um relatório automático de símbolos fornecidos e consumidos por arquivo.

Risco: alto, principalmente nos 204 encadeamentos de funções anteriores.

### Lote M4 — criar fachadas estáveis sem retirar compatibilidade

- Introduzir gradualmente `window.ObraAtiva` como fachada documentada.
- Manter aliases globais antigos enquanto houver HTML ou script que os utilize.
- Transferir estado e serviços somente após existir teste para cada consumidor.
- Não converter para classes ou reescrever algoritmos.

Risco: médio. O objetivo é reduzir dependências novas, não modernizar sintaxe.

### Lote M5 — substituir eventos HTML por delegação

- Migrar uma tela por vez de `onclick`/`onsubmit` para `addEventListener`.
- Usar atributos `data-action` sem alterar o texto, aparência ou sequência das ações.
- Preservar confirmações, validação nativa dos formulários e foco.
- Remover cada alias global somente quando não houver consumidor restante.

Risco: alto em modais, tabelas renderizadas por string e ações financeiras.

### Lote M6 — retirar estilos dinâmicos e consolidar CSS

- Mover um `style` identificado por vez para folhas externas.
- Preservar a posição lógica da regra na cascata.
- Não combinar seletores visualmente semelhantes sem teste de todas as páginas.
- Remover a injeção somente após comparação visual automática.

Risco: médio a alto em celular e no Financeiro, onde há muitas camadas tardias.

### Lote M7 — endurecimento final opcional

- Somente depois de M1 a M6, avaliar scripts ES, imports ou empacotamento.
- Retirar `unsafe-inline` da política CSP quando não existirem scripts, estilos ou
  eventos embutidos.
- Essa mudança deve ser uma fase própria, não parte da extração mecânica.

## Matriz de risco

| Área | Risco | Motivo | Controle obrigatório |
|---|---:|---|---|
| Bloco principal | Alto | 948 KB e 748 funções | Extração integral antes da divisão |
| Sobrescritas encadeadas | Alto | Cerca de 204 dependências de ordem | Teste de ordem e aliases |
| Eventos HTML | Alto | 799 chamadas globais | Migração tela por tela |
| Financeiro/pagamentos | Alto | Cálculos e várias camadas posteriores | Testes de valores e histórico |
| CloudSync/empresas | Alto | Autenticação e isolamento | Mocks locais, sem conta real |
| CSS móvel | Alto | Muitas regras tardias e específicas | Comparação visual em 6 tamanhos |
| CSS do site público | Médio | Área separada, mas extensa | Testes `?public=1` isolados |
| Shell e splash | Baixo/médio | Dependem do momento de carregamento | Medir primeira pintura e fechamento |

## Testes obrigatórios por microlote

1. Sintaxe de todos os scripts e integridade do snapshot técnico.
2. Ordem exata dos arquivos e disponibilidade dos globais esperados.
3. Navegação por todas as abas, menus móvel e lateral.
4. Abertura, validação, confirmação e fechamento de todos os tipos de modal.
5. Operações fictícias de obras, equipe, escala, presença, pagamentos e financeiro.
6. Login, recuperação e empresa simulados sem acesso a conta ou banco real.
7. Assistente, bolha flutuante, conversa e comandos em ambiente isolado.
8. Importação local fictícia de PDF/planilha e geração de relatório.
9. Comparação visual nas larguras 360, 430, 768, 1024, 1366 e 1920 pixels,
   incluindo orientação horizontal nos dispositivos móveis.
10. Teste do site público, proposta, privacidade e exclusão de conta.
11. Verificação de que não houve chamada de rede nos testes locais.
12. Controle de qualidade completo já existente.

## Critérios finais de aceitação

- Todas as funções e regras visíveis continuam iguais.
- Nenhuma chave de dados ou formato persistido muda.
- Nenhum cálculo financeiro apresenta diferença.
- Zero erros no console durante os fluxos testados.
- Todas as suítes existentes e novas passam.
- `index.html` termina contendo apenas metadados, shell HTML e referências ordenadas.
- A remoção de código embutido acontece sem ampliar permissões da CSP.
- Cada microlote possui alteração pequena e reversível.
- Nenhum lote é publicado ou enviado ao GitHub sem autorização explícita.

## Recomendação de execução

Executar M0 a M2 primeiro. Isso reduz o tamanho do HTML com risco controlado, mas
sem fingir que o sistema já está semanticamente modular. Somente após uma versão
comportamentalmente idêntica deve começar M3. M4 a M7 devem ser autorizações
separadas, porque já modificam a forma como as dependências são organizadas.
