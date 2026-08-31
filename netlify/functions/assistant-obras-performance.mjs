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
import { buildEmployeePerformanceExplanation, validateEmployeePerformanceExplanation } from './_assistant/assistant-performance.mjs';

const pending = new Set();
const responseCache = new Map();
const usageByCompany = new Map();
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
  if (!authorization.startsWith('Bearer ')) throw new AssistantHttpError(401, 'AUTH_REQUIRED', 'Entre na sua conta para visualizar a explicação.');
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

function filtersFrom(input = {}) {
  const range = ['fortnight', 'month', 'custom'].includes(String(input.range)) ? String(input.range) : 'fortnight';
  const result = { range };
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(input.today || ''))) result.today = String(input.today);
  if (range === 'custom') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(input.from || ''))) result.from = String(input.from);
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(input.to || ''))) result.to = String(input.to);
  }
  if (cleanIdentifier(input.workId, 120)) result.workId = cleanIdentifier(input.workId, 120);
  return result;
}

function dayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function usageState(companyId) {
  const key = `${companyId}:${dayKey()}`;
  const current = usageByCompany.get(key) || { key, count: 0 };
  usageByCompany.set(key, current);
  return current;
}

function cacheGet(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) { responseCache.delete(key); return null; }
  return entry.value;
}

function cacheSet(key, value) {
  responseCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function resetAssistantPerformanceStateForTests() {
  pending.clear();
  responseCache.clear();
  usageByCompany.clear();
}

export default async (request) => {
  const startedAt = Date.now();
  let auditBase = {};
  let claimedFingerprint = '';
  try {
    if (request.method !== 'POST') throw new AssistantHttpError(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
    const input = await request.json().catch(() => ({}));
    if (String(input.action || 'explain') !== 'explain') throw new AssistantHttpError(400, 'INVALID_ACTION', 'Ação inválida para o desempenho.');
    const companyId = String(input.companyId || '').trim();
    const employeeId = cleanIdentifier(input.employeeId, 120);
    if (!validUuid(companyId)) throw new AssistantHttpError(400, 'INVALID_COMPANY', 'A empresa informada é inválida.');
    if (!employeeId) throw new AssistantHttpError(400, 'INVALID_EMPLOYEE', 'Selecione um funcionário válido.');
    const config = serverConfig();
    const { authorization, user } = await authenticate(request, config);
    const membership = await loadMembership({ companyId, userId: user.id, authorization, config });
    const allowedModules = allowedModulesForMembership(membership);
    const required = ['team', 'attendance', 'planning', 'works'];
    if (required.some((module) => !allowedModules.includes(module))) throw new AssistantHttpError(403, 'PERFORMANCE_PERMISSION_DENIED', 'Você não possui todas as permissões necessárias para cruzar equipe, presença, escala e obras.');
    const state = await loadCompanyState({ companyId, authorization, config });
    const filters = filtersFrom(input.filters || {});
    if (filters.workId && !(state.db.works || []).some((item) => String(item?.id) === filters.workId)) throw new AssistantHttpError(400, 'INVALID_WORK', 'A obra selecionada não existe nesta empresa.');
    const requestId = cleanIdentifier(request.headers.get('x-request-id') || input.requestId || crypto.randomUUID(), 80);
    const fingerprint = requestFingerprint({ companyId, userId: user.id, action: 'employee_performance_explanation', payload: { employeeId, filters, updatedAt: state.updatedAt, modules: allowedModules } });
    auditBase = { requestId, companyId, userId: user.id, action: 'employee_performance_explanation', fingerprint };
    const cached = cacheGet(fingerprint);
    const subscription = await loadSubscription({ companyId, authorization, config });
    const usage = usageState(companyId);
    const limit = dailyLimitForPlan(subscription.plan);
    if (cached) return json(200, { ok: true, phase: 5, performance: cached, usage: { usedToday: usage.count, dailyLimit: limit, cached: true }, readOnly: true, officialFormulaPreserved: true });
    if (usage.count >= limit) throw new AssistantHttpError(429, 'DAILY_LIMIT_REACHED', `O limite diário de ${limit} explicações desta empresa foi atingido.`);
    if (pending.has(fingerprint)) throw new AssistantHttpError(429, 'REPEATED_REQUEST', 'Esta explicação já está sendo preparada. Aguarde.');
    pending.add(fingerprint);
    claimedFingerprint = fingerprint;
    let performance;
    try {
      performance = validateEmployeePerformanceExplanation(buildEmployeePerformanceExplanation({ data: state.db, allowedModules, filters, employeeId }));
    } catch (error) {
      if (error?.code === 'EMPLOYEE_NOT_FOUND') throw new AssistantHttpError(404, error.code, error.message);
      if (error?.code === 'PERFORMANCE_PERMISSION_DENIED') throw new AssistantHttpError(403, error.code, error.message);
      throw error;
    }
    usage.count += 1;
    cacheSet(fingerprint, performance);
    writeAudit(createAuditEvent({ ...auditBase, status: 'ok', durationMs: Date.now() - startedAt }));
    return json(200, { ok: true, phase: 5, performance, usage: { usedToday: usage.count, dailyLimit: limit, cached: false }, readOnly: true, officialFormulaPreserved: true });
  } catch (error) {
    const known = error instanceof AssistantHttpError;
    const status = known ? error.status : 500;
    const code = known ? error.code : 'UNEXPECTED_ERROR';
    const message = known ? error.message : 'Não foi possível preparar a explicação do desempenho agora.';
    writeAudit(createAuditEvent({ ...auditBase, status: 'error', errorCode: code, durationMs: Date.now() - startedAt }));
    return json(status, { ok: false, error: message, code, phase: 5, readOnly: true, officialFormulaPreserved: true });
  } finally {
    if (claimedFingerprint) pending.delete(claimedFingerprint);
  }
};
