# Convenções do projeto ObraAtiva

Estas regras padronizam a manutenção do projeto sem alterar comportamento, dados ou regras de negócio.

## Texto e formatação

- Arquivos de texto usam UTF-8, quebra de linha LF e linha final.
- JavaScript, HTML, CSS, JSON, Markdown e SQL usam dois espaços de indentação.
- Java e Kotlin usam quatro espaços de indentação.
- Alterações exclusivamente de formatação não devem ser misturadas com mudanças funcionais.

## Organização e nomes

- Módulos internos usam nomes descritivos em `kebab-case`.
- Ativos públicos que dependem de cache mantêm seu versionamento explícito.
- Código compartilhado da assistente fica em `netlify/functions/_assistant/`.
- Respostas HTTP JSON da assistente usam `assistant-http.mjs`.
- Acesso e contexto de dados da assistente usam `assistant-data.mjs`.

## Segurança e testes

- Testes devem ser locais, isolados, offline e usar somente dados claramente fictícios.
- Nenhum teste pode acessar Supabase, contas, empresas ou registros reais.
- Toda padronização deve preservar mensagens, códigos HTTP, cabeçalhos, permissões e resultados existentes.
