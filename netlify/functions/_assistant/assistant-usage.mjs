import { AssistantHttpError, cleanIdentifier, validUuid } from './assistant-policy.mjs';

function normalizeResult(body) {
  const row = Array.isArray(body) ? body[0] : body;
  if (!row || typeof row !== 'object') return null;
  return {
    allowed: row.allowed === true,
    count: Number(row.used_count || 0),
    limit: Number(row.daily_limit || 0),
    resetsAt: String(row.resets_at || '')
  };
}

export async function persistentDailyUsage({
  companyId,
  scope,
  limit,
  authorization,
  config,
  consume = true,
  fetchImpl = fetch
} = {}) {
  const normalizedScope = cleanIdentifier(scope, 80);
  const normalizedLimit = Number(limit);
  if (!validUuid(companyId) || !normalizedScope || !Number.isInteger(normalizedLimit) || normalizedLimit < 1 || normalizedLimit > 10000) {
    throw new AssistantHttpError(500, 'INVALID_RATE_LIMIT_CONFIGURATION', 'O limite persistente está configurado de forma inválida.');
  }

  let response;
  try {
    response = await fetchImpl(`${config.supabaseUrl}/rest/v1/rpc/consume_company_rate_limit`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        authorization,
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        p_company_id: companyId,
        p_scope: normalizedScope,
        p_limit: normalizedLimit,
        p_consume: Boolean(consume)
      })
    });
  } catch {
    throw new AssistantHttpError(503, 'PERSISTENT_LIMIT_UNAVAILABLE', 'O controle persistente de uso está temporariamente indisponível.');
  }

  const raw = await response.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
  if (!response.ok) {
    const missingMigration = response.status === 404 || body?.code === 'PGRST202';
    throw new AssistantHttpError(
      missingMigration ? 503 : 502,
      missingMigration ? 'PERSISTENT_LIMIT_NOT_READY' : 'PERSISTENT_LIMIT_UNAVAILABLE',
      missingMigration
        ? 'O controle persistente de uso ainda não foi ativado no banco.'
        : 'Não foi possível confirmar o limite persistente agora.'
    );
  }

  const usage = normalizeResult(body);
  if (!usage || usage.limit !== normalizedLimit || usage.count < 0) {
    throw new AssistantHttpError(502, 'INVALID_RATE_LIMIT_RESPONSE', 'O controle persistente retornou uma resposta inválida.');
  }
  if (consume && !usage.allowed) {
    throw new AssistantHttpError(429, 'DAILY_LIMIT_REACHED', `O limite diário de ${normalizedLimit} solicitações desta empresa foi atingido.`);
  }
  return usage;
}
