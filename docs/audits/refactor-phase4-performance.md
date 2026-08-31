# Fase 4 — Performance

## Escopo aplicado

- Recompressão sem perda dos PNG públicos.
- Comparação dos pixels decodificados antes de cada substituição.
- Carregamento tardio e decodificação assíncrona nas imagens de cartões públicos abaixo da dobra.
- Barreira automática para dimensões, peso e atributos de carregamento.

## Resultado medido

- PNG públicos antes: 6.299.028 bytes.
- PNG públicos depois: 4.805.949 bytes.
- Economia total: 1.493.079 bytes (23,7%).
- Onze arquivos ficaram menores e nenhum teve dimensão ou pixel alterado.

## Preservação

- Nomes, formatos e caminhos dos ativos permaneceram iguais.
- Ícones Android, atalhos PWA, logo, avatar e tela de abertura continuam PNG compatível.
- Nenhum dado, regra de negócio, função ou layout foi alterado.
