import {
  AssistantHttpError,
  assistantSupabaseConfig,
  validUuid
} from './assistant-policy.mjs';

export function assistantServerConfig(env = process.env) {
  return assistantSupabaseConfig(env);
}

export async function callAssistantSupabase(path, { authorization, config, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(`${config.supabaseUrl}${path}`, {
    method: 'GET',
    headers: { apikey: config.anonKey, authorization, accept: 'application/json' }
  });
  const raw = await response.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
  const invalidSession = path === '/auth/v1/user' && (response.status === 401 || response.status === 403);
  if (!response.ok) {
    throw new AssistantHttpError(
      invalidSession ? 401 : 502,
      invalidSession ? 'INVALID_SESSION' : 'DATA_SERVICE_UNAVAILABLE',
      invalidSession ? 'Sua sessão expirou. Entre novamente.' : 'Não foi possível consultar as fontes autorizadas agora.'
    );
  }
  return body;
}

export async function authenticateAssistantRequest(request, config, requiredMessage, fetchImpl = fetch) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    throw new AssistantHttpError(401, 'AUTH_REQUIRED', requiredMessage);
  }
  const user = await callAssistantSupabase('/auth/v1/user', { authorization, config, fetchImpl });
  if (!validUuid(user?.id)) {
    throw new AssistantHttpError(401, 'INVALID_SESSION', 'Sua sessão não pôde ser validada.');
  }
  return { authorization, user };
}

export async function loadAssistantMembership({ companyId, userId, authorization, config, fetchImpl = fetch }) {
  const query = new URLSearchParams({
    company_id: `eq.${companyId}`,
    user_id: `eq.${userId}`,
    status: 'eq.active',
    select: 'company_id,user_id,role,permission_profile,permissions',
    limit: '1'
  });
  const rows = await callAssistantSupabase(`/rest/v1/company_members?${query}`, { authorization, config, fetchImpl });
  const membership = Array.isArray(rows) ? rows[0] : null;
  if (!membership || membership.company_id !== companyId || membership.user_id !== userId) {
    throw new AssistantHttpError(403, 'COMPANY_ACCESS_DENIED', 'Você não possui acesso ativo a esta empresa.');
  }
  return membership;
}

export async function loadAssistantSubscription({ companyId, authorization, config, fetchImpl = fetch }) {
  const query = new URLSearchParams({ company_id: `eq.${companyId}`, select: 'plan,status', limit: '1' });
  const rows = await callAssistantSupabase(`/rest/v1/subscriptions?${query}`, { authorization, config, fetchImpl });
  return Array.isArray(rows) && rows[0] ? rows[0] : { plan: 'trial', status: 'trial' };
}

export async function loadAssistantCompanyState({ companyId, authorization, config, fetchImpl = fetch }) {
  const query = new URLSearchParams({ company_id: `eq.${companyId}`, select: 'data,updated_at', limit: '1' });
  const rows = await callAssistantSupabase(`/rest/v1/company_app_state?${query}`, { authorization, config, fetchImpl });
  const row = Array.isArray(rows) ? rows[0] : null;
  return {
    db: row?.data?.db && typeof row.data.db === 'object' ? row.data.db : {},
    updatedAt: String(row?.updated_at || '')
  };
}

export function createAssistantTtlCache(storage, ttlMs) {
  const ttl = Number(ttlMs);
  if (!(storage instanceof Map) || !Number.isFinite(ttl) || ttl < 1) {
    throw new TypeError('Cache interno da assistente configurado de forma inválida.');
  }
  return Object.freeze({
    get(key) {
      const entry = storage.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= Date.now()) {
        storage.delete(key);
        return null;
      }
      return entry.value;
    },
    set(key, value) {
      storage.set(key, { value, expiresAt: Date.now() + ttl });
    }
  });
}
