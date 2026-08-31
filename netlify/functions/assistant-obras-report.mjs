import {
  AssistantHttpError,
  allowedModulesForMembership,
  assistantSupabaseConfig,
  cleanIdentifier,
  dailyLimitForPlan,
  requestFingerprint,
  validUuid
} from './_assistant/assistant-policy.mjs';
import { buildReadOnlyContext } from './_assistant/assistant-context.mjs';
import { createAuditEvent, writeAudit } from './_assistant/assistant-audit.mjs';
import { persistentDailyUsage } from './_assistant/assistant-usage.mjs';
import { resolveAnalysisPeriod } from './_assistant/assistant-tools.mjs';
import { REPORT_DEFINITIONS, allowedReportTypes, buildReportPreview, reportDefinition, validateReportPreview } from './_assistant/assistant-reports.mjs';

const pending = new Set();
const reportCache = new Map();
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
  if (!authorization.startsWith('Bearer ')) throw new AssistantHttpError(401, 'AUTH_REQUIRED', 'Entre na sua conta para gerar a prévia do relatório.');
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
  const entry = reportCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) { reportCache.delete(key); return null; }
  return entry.value;
}

function cacheSet(key, value) {
  reportCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function activeOptions(db, allowedModules) {
  const allowed = new Set(allowedModules);
  const cleanRows = (rows, label) => (Array.isArray(rows) ? rows : []).filter((item) => item && item.id && item.active !== false && item.archived !== true).slice(0, 500).map((item) => ({ id: cleanIdentifier(item.id, 120), name: String(item[label] || 'Sem identificação').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 160) })).filter((item) => item.id);
  return {
    reportTypes: allowedReportTypes(allowedModules),
    works: allowed.has('works') ? cleanRows(db.works, 'name') : [],
    employees: allowed.has('team') ? cleanRows(db.employees, 'name') : []
  };
}

export function resetAssistantReportStateForTests() {
  pending.clear();
  reportCache.clear();
}

export default async (request) => {
  const startedAt = Date.now();
  let auditBase = {};
  let claimedFingerprint = '';
  try {
    if (request.method !== 'POST') throw new AssistantHttpError(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
    const input = await request.json().catch(() => ({}));
    const action = String(input.action || 'options');
    if (!['options', 'preview'].includes(action)) throw new AssistantHttpError(400, 'INVALID_ACTION', 'Ação inválida para os relatórios.');
    const companyId = String(input.companyId || '').trim();
    if (!validUuid(companyId)) throw new AssistantHttpError(400, 'INVALID_COMPANY', 'A empresa informada é inválida.');
    const config = serverConfig();
    const { authorization, user } = await authenticate(request, config);
    const membership = await loadMembership({ companyId, userId: user.id, authorization, config });
    const allowedModules = allowedModulesForMembership(membership);
    const state = await loadCompanyState({ companyId, authorization, config });
    const requestId = cleanIdentifier(request.headers.get('x-request-id') || input.requestId || crypto.randomUUID(), 80);
    auditBase = { requestId, companyId, userId: user.id, action: action === 'preview' ? 'report_preview' : 'report_options' };

    if (action === 'options') {
      const options = activeOptions(state.db, allowedModules);
      writeAudit(createAuditEvent({ ...auditBase, status: 'ok', durationMs: Date.now() - startedAt }));
      return json(200, { ok: true, phase: 3, previewOnly: true, readOnly: true, options });
    }

    const type = cleanIdentifier(input.type, 40);
    const definition = reportDefinition(type);
    if (!definition) throw new AssistantHttpError(400, 'INVALID_REPORT_TYPE', 'Escolha um tipo de relatório válido.');
    const allowedTypes = new Set(allowedReportTypes(allowedModules).map((item) => item.type));
    if (!allowedTypes.has(type)) throw new AssistantHttpError(403, 'REPORT_ACCESS_DENIED', 'Seu perfil não possui acesso a todas as fontes necessárias para este relatório.');
    const targetId = cleanIdentifier(input.targetId, 120);
    if (definition.target && !targetId) throw new AssistantHttpError(400, 'REPORT_TARGET_REQUIRED', definition.target === 'work' ? 'Selecione uma obra.' : 'Selecione um funcionário.');
    const fixedPeriod = ['daily', 'weekly', 'fortnightly', 'payments'].includes(type);
    const requestedKind = fixedPeriod ? definition.defaultPeriod : String(input.period?.kind || definition.defaultPeriod);
    const period = resolveAnalysisPeriod({ ...(input.period || {}), kind: requestedKind }, state.db.settings || {});
    const context = buildReadOnlyContext({ data: state.db, allowedModules: definition.modules, period });
    const subscription = await loadSubscription({ companyId, authorization, config });
    const limit = dailyLimitForPlan(subscription.plan);
    const fingerprint = requestFingerprint({ companyId, userId: user.id, action: 'report_preview', payload: { type, targetId, period, updatedAt: state.updatedAt } });
    auditBase = { ...auditBase, fingerprint };
    const cached = cacheGet(fingerprint);
    if (cached) {
      const usage = await persistentDailyUsage({ companyId, scope: 'assistant_report', limit, authorization, config, consume: false });
      return json(200, { ok: true, phase: 3, report: cached, usage: { usedToday: usage.count, dailyLimit: limit, cached: true }, previewOnly: true, readOnly: true });
    }
    if (pending.has(fingerprint)) throw new AssistantHttpError(429, 'REPEATED_REQUEST', 'Esta prévia já está sendo preparada. Aguarde.');
    pending.add(fingerprint);
    claimedFingerprint = fingerprint;
    const usage = await persistentDailyUsage({ companyId, scope: 'assistant_report', limit, authorization, config, consume: true });
    const candidate = buildReportPreview({
      type, context, period, targetId,
      company: { id: companyId, name: state.db.settings?.company || '' },
      settings: state.db.settings || {}
    });
    const report = validateReportPreview(candidate);
    cacheSet(fingerprint, report);
    writeAudit(createAuditEvent({ ...auditBase, status: 'ok', durationMs: Date.now() - startedAt }));
    return json(200, { ok: true, phase: 3, report, usage: { usedToday: usage.count, dailyLimit: limit, cached: false }, previewOnly: true, readOnly: true });
  } catch (error) {
    const known = error instanceof AssistantHttpError;
    const status = known ? error.status : 500;
    const code = known ? error.code : 'UNEXPECTED_ERROR';
    const message = known ? error.message : 'Não foi possível gerar a prévia do relatório agora.';
    writeAudit(createAuditEvent({ ...auditBase, status: 'error', errorCode: code, durationMs: Date.now() - startedAt }));
    return json(status, { ok: false, error: message, code, phase: 3, previewOnly: true, readOnly: true });
  } finally {
    if (claimedFingerprint) pending.delete(claimedFingerprint);
  }
};
