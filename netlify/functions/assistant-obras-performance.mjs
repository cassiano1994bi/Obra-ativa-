import {
  AssistantHttpError,
  allowedModulesForMembership,
  cleanIdentifier,
  dailyLimitForPlan,
  requestFingerprint,
  validUuid
} from './_assistant/assistant-policy.mjs';
import { createAuditEvent, writeAudit } from './_assistant/assistant-audit.mjs';
import {
  assistantServerConfig as serverConfig,
  authenticateAssistantRequest,
  createAssistantTtlCache,
  loadAssistantCompanyState as loadCompanyState,
  loadAssistantMembership as loadMembership,
  loadAssistantSubscription as loadSubscription
} from './_assistant/assistant-data.mjs';
import { persistentDailyUsage } from './_assistant/assistant-usage.mjs';
import { buildEmployeePerformanceExplanation, validateEmployeePerformanceExplanation } from './_assistant/assistant-performance.mjs';

const pending = new Set();
const responseCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
const { get: cacheGet, set: cacheSet } = createAssistantTtlCache(responseCache, CACHE_TTL_MS);

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
});

async function authenticate(request, config) {
  return authenticateAssistantRequest(request, config, 'Entre na sua conta para visualizar a explicação.');
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

export function resetAssistantPerformanceStateForTests() {
  pending.clear();
  responseCache.clear();
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
    const limit = dailyLimitForPlan(subscription.plan);
    if (cached) {
      const usage = await persistentDailyUsage({ companyId, scope: 'assistant_performance', limit, authorization, config, consume: false });
      return json(200, { ok: true, phase: 5, performance: cached, usage: { usedToday: usage.count, dailyLimit: limit, cached: true }, readOnly: true, officialFormulaPreserved: true });
    }
    if (pending.has(fingerprint)) throw new AssistantHttpError(429, 'REPEATED_REQUEST', 'Esta explicação já está sendo preparada. Aguarde.');
    pending.add(fingerprint);
    claimedFingerprint = fingerprint;
    const usage = await persistentDailyUsage({ companyId, scope: 'assistant_performance', limit, authorization, config, consume: true });
    let performance;
    try {
      performance = validateEmployeePerformanceExplanation(buildEmployeePerformanceExplanation({ data: state.db, allowedModules, filters, employeeId }));
    } catch (error) {
      if (error?.code === 'EMPLOYEE_NOT_FOUND') throw new AssistantHttpError(404, error.code, error.message);
      if (error?.code === 'PERFORMANCE_PERMISSION_DENIED') throw new AssistantHttpError(403, error.code, error.message);
      throw error;
    }
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
