import {
  AssistantHttpError,
  allowedModulesForMembership,
  cleanIdentifier,
  dailyLimitForPlan,
  requestFingerprint,
  validUuid
} from './_assistant/assistant-policy.mjs';
import { createAuditEvent, writeAudit } from './_assistant/assistant-audit.mjs';
import { assistantJsonResponse as json } from './_assistant/assistant-http.mjs';
import {
  assistantServerConfig as serverConfig,
  authenticateAssistantRequest,
  createAssistantTtlCache,
  loadAssistantCompanyState as loadCompanyState,
  loadAssistantMembership as loadMembership,
  loadAssistantSubscription as loadSubscription
} from './_assistant/assistant-data.mjs';
import { persistentDailyUsage } from './_assistant/assistant-usage.mjs';
import { resolveAnalysisPeriod } from './_assistant/assistant-tools.mjs';
import { buildInsightPreview, validateInsightPreview } from './_assistant/assistant-insights.mjs';

const pending = new Set();
const insightCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
const { get: cacheGet, set: cacheSet } = createAssistantTtlCache(insightCache, CACHE_TTL_MS);

async function authenticate(request, config) {
  return authenticateAssistantRequest(request, config, 'Entre na sua conta para visualizar os alertas.');
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
