import {
  AssistantHttpError,
  allowedModulesForMembership,
  cleanIdentifier,
  dailyLimitForPlan,
  requestFingerprint,
  validUuid
} from './_assistant/assistant-policy.mjs';
import { buildReadOnlyContext } from './_assistant/assistant-context.mjs';
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
import { REPORT_DEFINITIONS, allowedReportTypes, buildReportPreview, reportDefinition, validateReportPreview } from './_assistant/assistant-reports.mjs';

const pending = new Set();
const reportCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
const { get: cacheGet, set: cacheSet } = createAssistantTtlCache(reportCache, CACHE_TTL_MS);

async function authenticate(request, config) {
  return authenticateAssistantRequest(request, config, 'Entre na sua conta para gerar a prévia do relatório.');
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
