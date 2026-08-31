import {
  ASSISTANT_NAME,
  ASSISTANT_PHASE,
  AssistantHttpError,
  allowedModulesForMembership,
  assistantSupabaseConfig,
  assertPhaseOneAction,
  cleanIdentifier,
  createRepeatGuard,
  dailyLimitForPlan,
  requestFingerprint,
  validUuid
} from './_assistant/assistant-policy.mjs';
import { providerDescriptor } from './_assistant/assistant-provider.mjs';
import { createAuditEvent, writeAudit } from './_assistant/assistant-audit.mjs';
import { assistantJsonResponse as json } from './_assistant/assistant-http.mjs';

const repeatGuard = createRepeatGuard({ ttlMs: 15000 });

function serverConfig(env = process.env) {
  return assistantSupabaseConfig(env);
}

async function callSupabase(path, { authorization, config, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(`${config.supabaseUrl}${path}`, {
    method: 'GET',
    headers: {
      apikey: config.anonKey,
      authorization,
      accept: 'application/json'
    }
  });
  const raw = await response.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
  const invalidSession = path === '/auth/v1/user' && (response.status === 401 || response.status === 403);
  if (!response.ok) {
    throw new AssistantHttpError(
      invalidSession ? 401 : 502,
      invalidSession ? 'INVALID_SESSION' : 'DATA_SERVICE_UNAVAILABLE',
      invalidSession ? 'Sua sessão expirou. Entre novamente.' : 'Não foi possível validar o acesso da empresa agora.'
    );
  }
  return body;
}

async function authenticate(request, config) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    throw new AssistantHttpError(401, 'AUTH_REQUIRED', 'Entre na sua conta para usar o Assistente da Obra.');
  }
  const user = await callSupabase('/auth/v1/user', { authorization, config });
  if (!validUuid(user?.id)) throw new AssistantHttpError(401, 'INVALID_SESSION', 'Sua sessão não pôde ser validada.');
  return { authorization, user };
}

async function membershipFor({ companyId, userId, authorization, config }) {
  const query = new URLSearchParams({
    company_id: `eq.${companyId}`,
    user_id: `eq.${userId}`,
    status: 'eq.active',
    select: 'company_id,user_id,role,permission_profile,permissions',
    limit: '1'
  });
  const rows = await callSupabase(`/rest/v1/company_members?${query}`, { authorization, config });
  const membership = Array.isArray(rows) ? rows[0] : null;
  if (!membership || membership.company_id !== companyId || membership.user_id !== userId) {
    throw new AssistantHttpError(403, 'COMPANY_ACCESS_DENIED', 'Você não possui acesso ativo a esta empresa.');
  }
  return membership;
}

async function subscriptionFor({ companyId, authorization, config }) {
  const query = new URLSearchParams({
    company_id: `eq.${companyId}`,
    select: 'plan,status,trial_ends_at,current_period_ends_at',
    limit: '1'
  });
  const rows = await callSupabase(`/rest/v1/subscriptions?${query}`, { authorization, config });
  return Array.isArray(rows) && rows[0] ? rows[0] : { plan: 'trial', status: 'trial' };
}

export default async (request) => {
  const startedAt = Date.now();
  let auditBase = {};
  let fingerprint = '';
  try {
    if (request.method !== 'POST') throw new AssistantHttpError(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
    const input = await request.json().catch(() => ({}));
    const action = assertPhaseOneAction(input.action);
    const companyId = String(input.companyId || '').trim();
    if (!validUuid(companyId)) throw new AssistantHttpError(400, 'INVALID_COMPANY', 'A empresa informada é inválida.');

    const config = serverConfig();
    const { authorization, user } = await authenticate(request, config);
    const requestId = cleanIdentifier(request.headers.get('x-request-id') || input.requestId || crypto.randomUUID(), 80);
    fingerprint = requestFingerprint({ companyId, userId: user.id, action });
    auditBase = { requestId, companyId, userId: user.id, action, fingerprint };

    if (!repeatGuard.claim(fingerprint)) {
      throw new AssistantHttpError(429, 'REPEATED_REQUEST', 'Esta verificação já está em andamento. Aguarde alguns segundos.');
    }

    const membership = await membershipFor({ companyId, userId: user.id, authorization, config });
    const subscription = await subscriptionFor({ companyId, authorization, config });
    const allowedModules = allowedModulesForMembership(membership);
    const provider = providerDescriptor();
    const dailyLimit = dailyLimitForPlan(subscription.plan);

    writeAudit(createAuditEvent({
      ...auditBase,
      status: 'ok',
      durationMs: Date.now() - startedAt,
      provider: provider.provider,
      model: provider.model
    }));

    return json(200, {
      ok: true,
      requestId,
      phase: ASSISTANT_PHASE,
      assistant: {
        name: ASSISTANT_NAME,
        status: 'secure_structure_ready',
        readOnly: true,
        conversationEnabled: false
      },
      access: {
        authenticated: true,
        companyScoped: true,
        role: String(membership.role || 'collaborator'),
        allowedModules
      },
      subscription: {
        plan: String(subscription.plan || 'trial'),
        status: String(subscription.status || 'trial')
      },
      limits: {
        daily: dailyLimit,
        consumedByThisCheck: false,
        repeatedCallProtectionSeconds: 15
      },
      provider,
      safeguards: {
        contextAllowlist: true,
        structuredResponseValidation: true,
        serverSideSecrets: true,
        auditWithoutBusinessData: true,
        businessWrites: false
      }
    });
  } catch (error) {
    const known = error instanceof AssistantHttpError;
    const status = known ? error.status : 500;
    const code = known ? error.code : 'UNEXPECTED_ERROR';
    const message = known ? error.message : 'Não foi possível validar a estrutura da IA agora.';
    writeAudit(createAuditEvent({
      ...auditBase,
      fingerprint,
      action: auditBase.action || 'status',
      status: 'error',
      errorCode: code,
      durationMs: Date.now() - startedAt
    }));
    return json(status, { ok: false, error: message, code, phase: ASSISTANT_PHASE, readOnly: true });
  }
};
