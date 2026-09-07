# Revisão local — Design System global do ObraAtiva

Data: 07/09/2026
Estado: implementação local para revisão; não publicada.

## Segurança da mudança

- Ponto de restauração: `restore/before-global-design-20260907` no commit `57e6975`.
- A mudança é uma camada visual escopada ao aplicativo autenticado.
- Nenhum cadastro, cálculo, integração, permissão, regra de assinatura ou fluxo de salvamento foi alterado.
- A página pública e a recepção/login não recebem as regras do sistema interno.

## Padrão aplicado

- Uma única família tipográfica e escala de títulos, seções, cartões, textos, controles, legendas e números.
- Cartões com borda, raio, sombra e profundidade consistentes.
- Botões e campos com dimensão e leitura previsíveis.
- Valores numéricos com algarismos tabulares para facilitar comparações.
- Status semânticos com texto, ícone, cor, fundo suave e borda: verde, azul, amarelo, laranja, vermelho e cinza.
- Barras de progresso com trilha, espessura e tons coerentes.
- Redução proporcional em celular, sem reduzir alvos de toque.
- Foco visível e respeito à preferência de redução de movimento.

## Validação concluída antes de produção

- Home, Obras, Equipe, Escala diária, Presença, Pagamentos, Financeiro, Veículos, Relatórios e Administrador percorridos.
- Desempenho da equipe, ranking, ciclos de pagamento, comparação da quinzena, guia financeiro, fases, fotos e cinco áreas administrativas conferidos.
- Modais de obra, funcionário e configurações abertos e medidos.
- Seis dimensões testadas: monitor grande, notebook, desktop, tablet, celular horizontal e celular vertical.
- Teste específico do Design System: 3 cenários aprovados, dados fictícios preservados e rede externa bloqueada.
- Regressão completa: 234 testes aprovados, 0 falhas; 70 arquivos de execução com sintaxe validada.
- Capturas antes/depois geradas em `tmp/design-system-qa/`; nunca entram no pacote público.

A publicação permanece bloqueada até aprovação explícita do resultado visual.
