# Verificação da cópia de lançamento — painel do proprietário

Data: 05/09/2026. Ambiente: cópia isolada `oa-owner-release-20260905`. Nenhum teste entrou em conta real, acessou nuvem ou alterou dados de empresas. Esta conferência não publica nem aprova automaticamente uma implantação.

## Resultado

- Verificações de convenções, orçamento de desempenho, ativos e sintaxe: aprovadas; 58 arquivos de execução.
- Gate da versão atual: 39 arquivos de suítes executados, 133 testes aprovados e 3 falhas conhecidas da base online explicitamente mantidas. Sete arquivos de suítes históricas não participam desse gate.
- Novo acompanhamento: SQL 11 testes, endpoints 4 e coletor 4 aprovados. Administrador existente: 5 testes aprovados. Nenhuma regressão demonstrada do OwnerCenter nesses contratos.
- Não equivale a dizer que todos os testes gerais passaram. As três falhas abaixo continuam existindo e não foram transformadas em aprovação.

## Falhas de infraestrutura dos testes corrigidas, sem alterar o aplicativo

Três arquivos fixavam literalmente `v42`: `action-feedback-v1.test.mjs`, `product-public-site-v2.test.mjs` e `audit-phase7-pwa-cache.test.mjs`. A versão autorizada usa `v43`. Agora a versão é lida do worker e validada como versão numérica explícita. As asserções de cache offline, exclusão de APIs privadas, ativos e navegação foram preservadas. Foi acrescido teste de instalação/ativação em VM: cache atual é mantido, cache obsoleto do aplicativo é removido e cache de outra origem lógica é preservado.

O inventário de modularização esperava 802 eventos; a base pública conciliada tem 803 pelo critério `\son[a-z]+=`. Documento e teste foram alinhados: 97 blocos de estilo, 16 scripts inline, 43 scripts externos e 803 eventos. O novo OwnerCenter e a medição opcional de campanhas não acrescentam handler inline.

O snapshot técnico atual corresponde ao hash do `index.html` conciliado. Seu contador de 815 handlers usa outro critério (`\bon(?:click|change|submit|input)=`) e não deve ser confundido com o inventário de 803. O snapshot precisa ser regenerado pelo responsável pelo pacote depois da adição do runner em `scripts/release/`, pois também inventaria scripts técnicos.

## Três falhas da base online preservada

Arquivo: `work-phase-photo-session-guard.test.mjs`. Cinco dos seus oito testes passam: abertura do modal, preservação da rota, processamento de fotos em sequência, retomada de sessão válida e falha de rede durante renovação.

1. `falha temporária ao retomar sessão não remove a sessão do dispositivo`: a asserção estática espera preservar a sessão mais recente em memória com `session || stored`; a versão online usa `stored` diretamente.
2. `falha temporária depois da renovação preserva o token mais recente`: após renovar com sucesso e falhar na ativação, a versão online recoloca o token antigo na memória. O armazenamento mantém o renovado. Falha funcional demonstrada em VM fictícia.
3. `sessão comprovadamente inválida é removida e exige autenticação`: a versão online remove a sessão temporária do armazenamento e abre login, mas não zera `CloudSync.session` em memória. Falha funcional demonstrada em VM fictícia.

Esses comportamentos já estão em `obraativa-social-auth-v1.js` da base online preservada, SHA-256 `2e982198c1811587002eb6687180ee91c48e83af1082c501ab857ce28ed68894`; não foram introduzidos pelo painel. A correção adicional estava somente na outra cópia local e está fora do escopo selecionado para este pacote. Não houve alteração de autenticação nesta conferência.

O gate executa as oito asserções. Exige exatamente as três falhas conhecidas e a assinatura da base conferida; se aparecer outra falha, uma delas deixar de falhar ou o arquivo mudar, exige nova revisão. Não usa `skip` nem muda o resultado das asserções para esconder falhas.

## Sete arquivos históricos separados

| Arquivo | Motivo para ficar fora do gate atual |
| --- | --- |
| `assistant-bubble-release-integrity.test.mjs` | Compara duas pastas de implantação de 29/30-08 e hashes congelados. Pastas ausentes na cópia limpa. |
| `assistant-complete-capabilities-release-integrity.test.mjs` | Compara pacotes de 30-08 com quantidade e hashes congelados. |
| `assistant-employee-experience-release-integrity.test.mjs` | Depende de dois pacotes antigos e suas assinaturas; não valida a implantação atual. |
| `assistant-phase4.test.mjs` | Asserções finais exigem backup `assistant-phase4-before-20260829` ausente. |
| `assistant-phase5.test.mjs` | Asserções finais exigem backup `assistant-phase5-before-20260829` ausente. |
| `assistant-phase6.test.mjs` | Asserções finais exigem backup `assistant-phase6-before-20260829` ausente. |
| `team-xss-isolated.test.mjs` | Mistura a fonte atual com pacote de 30-08 ausente. As verificações da fonte atual foram preservadas integralmente no novo `team-xss-current-release.test.mjs`, executado e aprovado. |

A execução diagnóstica de todas as 45 suítes originais foi realizada antes da separação. Esses sete arquivos falharam por dependência de artefatos históricos. Não foram copiados backups antigos ou possíveis dados reais para contornar as falhas, nem removidas suas asserções. Os casos funcionais anteriores às leituras dos backups nas fases 4/5/6 chegaram até aquela leitura sem erro; isso não é contado como aprovação das suítes inteiras.

## Repetir esta verificação

Executar `node scripts/release/check-owner-release.mjs` na cópia de lançamento, com os testes e PGlite locais disponíveis. A saída é resumida e relata exclusões e falhas conhecidas. O runner aborta em qualquer falha nova. Ele não regenera arquivos do aplicativo, não aplica migrations e não publica.

`scripts/quality/run-general-regression.mjs` permanece inalterado: continua representando a regressão geral original, inclusive dependências históricas. Testes, fixtures, este relatório e o runner são internos e nunca entram no site público.

## Alterações nesta conferência

- Testes: três verificações de cache; inventário de modularização; novo teste XSS da fonte atual.
- Documentação: contagem atualizada no plano de modularização e este relatório.
- Ferramenta interna: `scripts/release/check-owner-release.mjs`.
- Runtime, autenticação, regras de negócio, funções remotas e dados: preservados.
