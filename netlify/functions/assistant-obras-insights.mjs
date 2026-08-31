import {
  AssistantHttpError,
  allowedModulesForMembership,
  assistantSupabaseConfig,
  cleanIdentifier,
  dailyLimitForPlan,
  requestFingerprint,
  validUuid
} from './_assistant/assistant-policy.mjs';
import { createAuditEvent, writeAudit } from './_assistant/assistant-audit.mjs';
import { persistentDailyUsage } from './_assistant/assistant-usage.mjs';
import { resolveAnalysisPeriod } from './_assistant/assistant-tools.mjs';
import { buildInsightPreview, validateInsightPreview } from './_assistant/assistant-insights.mjs';

const pending = new Set();
const insightCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
});

function serverConfig(env = process.env) {
  return assistantSupabaseConfig(env);
}

async function callSupabase(path, { authorization, config, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(`${config.supabaseUrl}${path}`, { method: 'GET', headers: { apikey: config.anonKey, authorization, accept: 'application/json' } });
  const raw = await response.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
  const invalidSession = path === '/auth/v1/user' && (response.status === 401 || response.status === 403);
  if (!response.ok) throw new AssistantHttpError(invalidSession ? 401 : 502, invalidSession ? 'INVALID_SESSION' : 'DATA_SERVICE_UNAVAILABLE', invalidSession ? 'Sua sessão expirou. Entre novamente.' : 'Não foi possível consultar as fontes autorizadas agora.');
  return body;
}

async function authenticate(request, config) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) throw new AssistantHttpError(401, 'AUTH_REQUIRED', 'Entre na sua conta para visualizar os alertas.');
  const user = await callSupabase('/auth/v1/user', { authorization, config });
  if (!validUuid(user?.id)) throw new AssistantHttpError(401, 'INVALID_SESSION', 'Sua sessão não pôde ser validada.');
  return { authorization, user };
}

async function loadMembership({ companyId, userId, authorization, config }) {
  const query = new URLSearchParams({ company_id: `eq.${companyId}`, user_id: `eq.${userId}`, status: 'eq.active', select: 'company_id,user_id,role,permission_profile,permissions', limit: '1' });
  const rows = await callSupabase(`/rest/v1/company_members?${query}`, { authorization, config });
  const membership = Array.isArray(rows) ? rows[0] : null;
  if (!membership || membership.company_id !== companyId || membership.user_id !== userId) throw new AssistantHttpError(403, 'COMPANY_ACCESS_DENIED', 'Você não possui acesso ativo a esta empresa.');
  return membership;
}

async function loadSubscription({ companyId, authorization, config }) {
  const query = new URLSearchParams({ company_id: `eq.${companyId}`, select: 'plan,status', limit: '1' });
  const rows = await callSupabase(`/rest/v1/subscriptions?${query}`, { authorization, config });
  return Array.isArray(rows) && rows[0] ? rows[0] : { plan: 'trial', status: 'trial' };
}

async function loadCompanyState({ companyId, authorization, config }) {
  const query = new URLSearchParams({ company_id: `eq.${companyId}`, select: 'data,updated_at', limit: '1' });
  const rows = await callSupabase(`/rest/v1/company_app_state?${query}`, { authorization, config });
  const row = Array.isArray(rows) ? rows[0] : null;
  return { db: row?.data?.db && typeof row.data.db === 'object' ? row.data.db : {}, updatedAt: String(row?.updated_at || '') };
}

function cacheGet(key) {
  const entry = insightCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) { insightCache.delete(key); return null; }
  return entry.value;
}

function cacheSet(key, value) {
  insightCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function resetAssistantInsightStateForTests() {
  pending.clear();
  insightCache.clear();
}

export default async (request) => {
  const startedAt = Date.now();
  let auditBase = {};
  let claimedFingerprint = '';
  try {
    if (request.method !== 'POST') throw new AssistantHttpError(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
    const input = await request.json().catch(() => ({}));
    if (String(input.action || 'analyze') !== 'analyze') throw new AssistantHttpError(400, 'INVALID_ACTION', 'Ação inválida para os alertas.');
    const companyId = String(input.companyId || '').trim();
    if (!validUuid(companyId)) throw new AssistantHttpError(400, 'INVALID_COMPANY', 'A empresa informada é inválida.');
    const config = serverConfig();
    const { authorization, user } = await authenticate(request, config);
    const membership = await loadMembership({ companyId, userId: user.id, authorization, config });
    const allowedModules = allowedModulesForMembership(membership);
    const state = await loadCompanyState({ companyId, authorization, config });
    const period = resolveAnalysisPeriod({ kind: String(input.period?.kind || 'current_month') }, state.db.settings || {});
    const requestId = cleanIdentifier(request.headers.get('x-request-id') || input.requestId || crypto.randomUUID(), 80);
    const fingerprint = requestFingerprint({ companyId, userId: user.id, action: 'automatic_insights', payload: { period, updatedAt: state.updatedAt, modules: allowedModules } });
    auditBase = { requestId, companyId, userId: user.id, action: 'automatic_insights', fingerprint };
    const cached = cacheGet(fingerprint);
    const subscription = await loadSubscription({ companyId, authorization, config });
    const limit = dailyLimitForPlan(subscription.plan);
    if (cached) {
      const usage = await persistentDailyUsage({ companyId, scope: 'assistant_insights', limit, authorization, config, consume: false });
      return json(200, { ok: true, phase: 4, insights: cached, usage: { usedToday: usage.count, dailyLimit: limit, cached: true }, readOnly: true, automatic: true });
    }
    if (pending.has(fingerprint)) throw new AssistantHttpError(429, 'REPEATED_REQUEST', 'Esta análise já está sendo preparada. Aguarde.');
    pending.add(fingerprint);
    claimedFingerprint = fingerprint;
    const usage = await persistentDailyUsage({ companyId, scope: 'assistant_insights', limit, authorization, config, consume: true });
    const insights = validateInsightPreview(buildInsightPreview({
      data: state.db,
      allowedModules,
      period,
      company: { id: companyId, name: state.db.settings?.company || '' }
    }));
    cacheSet(fingerprint, insights);
    writeAudit(createAuditEvent({ ...auditBase, status: 'ok', durationMs: Date.now() - startedAt }));
    return json(200, { ok: true, phase: 4, insights, usage: { usedToday: usage.count, dailyLimit: limit, cached: false }, readOnly: true, automatic: true });
  } catch (error) {
    const known = error instanceof AssistantHttpError;
    const status = known ? error.status : 500;
    const code = known ? error.code : 'UNEXPECTED_ERROR';
    const message = known ? error.message : 'Não foi possível preparar os alertas agora.';
    writeAudit(createAuditEvent({ ...auditBase, status: 'error', errorCode: code, durationMs: Date.now() - startedAt }));
    return json(status, { ok: false, error: message, code, phase: 4, readOnly: true, automatic: true });
  } finally {
    if (claimedFingerprint) pending.delete(claimedFingerprint);
  }
};
