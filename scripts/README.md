# Ferramentas internas

- `assistant/generate-code-snapshot.mjs`: gera o inventário técnico sanitizado.
- `assistant/run-quality-gate.mjs`: executa a barreira completa de qualidade da assistente.
- `assistant/record-quality-outcome.mjs`: registra resultados aprovados no histórico técnico.
- `quality/check-project-conventions.mjs`: valida configurações e contratos técnicos compartilhados.
- `quality/check-public-performance.mjs`: protege dimensões, peso e carregamento dos ativos públicos.
- `quality/check-release-assets.mjs`: confere todas as dependências locais entregues pelo aplicativo.
- `quality/run-general-regression.mjs`: executa verificadores, sintaxe e todas as suítes isoladas em um único comando.

Essas ferramentas são executadas localmente e não fazem parte da aplicação publicada.
