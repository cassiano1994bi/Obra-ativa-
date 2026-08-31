import AssistantActionsCore from '../../public-assets/assistant-actions-core-v1.js';
import {
  AssistantHttpError,
  allowedModulesForMembership,
  cleanIdentifier,
  requestFingerprint,
  validUuid
} from './_assistant/assistant-policy.mjs';
import { createAuditEvent, writeAudit } from './_assistant/assistant-audit.mjs';
import {
  assistantServerConfig as serverConfig,
  authenticateAssistantRequest,
  loadAssistantCompanyState as loadCompanyState,
  loadAssistantMembership as loadMembership
} from './_assistant/assistant-data.mjs';

const pending = new Set();
const confirmed = new Map();
const CONFIRMATION_TTL_MS = 2 * 60 * 1000;

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
});

async function authenticate(request, config) {
  return authenticateAssistantRequest(request, config, 'Entre na sua conta para preparar ações.');
}

function allowedActions(allowedModules) {
  const allowed = new Set(allowedModules);
  return Object.entries(AssistantActionsCore.ACTION_DEFINITIONS).map(([type, definition]) => ({
    type,
    label: definition.label,
    mode: definition.mode,
    reinforced: definition.reinforced,
    allowed: definition.modules.every((module) => allowed.has(module)),
    requiredModules: definition.modules
  }));
}

function ensureActionAllowed(type, allowedModules) {
  const row = allowedActions(allowedModules).find((item) => item.type === type);
  if (!row) throw new AssistantHttpError(400, 'INVALID_ACTION_TYPE', 'Tipo de ação inválido.');
  if (!row.allowed) throw new AssistantHttpError(403, 'ACTION_PERMISSION_DENIED', 'Seu perfil não possui todas as permissões necessárias para esta ação.');
  return row;
}

function cleanupConfirmed() {
  const now = Date.now();
  confirmed.forEach((expiresAt, key) => { if (expiresAt <= now) confirmed.delete(key); });
}

export function resetAssistantActionStateForTests() {
  pending.clear();
  confirmed.clear();
}

export default async (request) => {
  const startedAt = Date.now();
  let auditBase = {};
  let claimedFingerprint = '';
  try {
    if (request.method !== 'POST') throw new AssistantHttpError(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
    const rawBody = await request.text();
    if (rawBody.length > 40000) throw new AssistantHttpError(413, 'PAYLOAD_TOO_LARGE', 'A proposta ultrapassa o limite permitido.');
    let input = {};
    try { input = rawBody ? JSON.parse(rawBody) : {}; } catch { input = {}; }
    const action = String(input.action || 'options');
    if (!['options', 'confirm'].includes(action)) throw new AssistantHttpError(400, 'INVALID_ACTION', 'Ação inválida.');
    const companyId = String(input.companyId || '').trim();
    if (!validUuid(companyId)) throw new AssistantHttpError(400, 'INVALID_COMPANY', 'A empresa informada é inválida.');
    const config = serverConfig();
    const { authorization, user } = await authenticate(request, config);
    const membership = await loadMembership({ companyId, userId: user.id, authorization, config });
    const allowedModules = allowedModulesForMembership(membership);
    const requestId = cleanIdentifier(request.headers.get('x-request-id') || input.requestId || crypto.randomUUID(), 80);
    if (action === 'options') return json(200, { ok: true, phase: 6, readOnly: true, actions: allowedActions(allowedModules) });

    const proposal = input.proposal;
    const type = String(proposal?.type || '');
    const actionDefinition = ensureActionAllowed(type, allowedModules);
    if (String(proposal?.companyId || '') !== companyId) throw new AssistantHttpError(403, 'PROPOSAL_COMPANY_MISMATCH', 'A proposta não pertence à empresa atual.');
    if (input.explicit !== true) throw new AssistantHttpError(400, 'EXPLICIT_CONFIRMATION_REQUIRED', 'Use o botão Confirmar ação para continuar.');
    const phrase = String(input.confirmationPhrase || '').trim().toLocaleUpperCase('pt-BR');
    if (type === 'payments' && phrase !== 'CONFIRMAR PAGAMENTOS') throw new AssistantHttpError(400, 'REINFORCED_CONFIRMATION_REQUIRED', 'Digite CONFIRMAR PAGAMENTOS para abrir a confirmação financeira oficial.');
    if (type === 'whatsapp' && phrase !== 'CONFIRMAR CÓPIA') throw new AssistantHttpError(400, 'REINFORCED_CONFIRMATION_REQUIRED', 'Digite CONFIRMAR CÓPIA para copiar a lista.');
    const state = await loadCompanyState({ companyId, authorization, config });
    try { AssistantActionsCore.validateProposalForState(state.db, proposal, companyId); }
    catch (error) { throw new AssistantHttpError(409, 'STALE_OR_INVALID_PROPOSAL', error?.message || 'A proposta não corresponde mais aos dados atuais.'); }
    const fingerprint = requestFingerprint({ companyId, userId: user.id, action: `confirm_${type}`, payload: { proposalId: proposal.id, beforeHash: proposal.beforeHash, updatedAt: state.updatedAt } });
    auditBase = { requestId, companyId, userId: user.id, action: `confirm_${type}`, fingerprint };
    cleanupConfirmed();
    if (confirmed.has(fingerprint)) throw new AssistantHttpError(409, 'ALREADY_CONFIRMED', 'Esta proposta já foi confirmada. Prepare uma nova ação.');
    if (pending.has(fingerprint)) throw new AssistantHttpError(429, 'REPEATED_REQUEST', 'Esta confirmação já está em andamento. Aguarde.');
    pending.add(fingerprint); claimedFingerprint = fingerprint;
    const confirmation = Object.freeze({
      id: cleanIdentifier(`confirmation-${crypto.randomUUID()}`, 100),
      proposalId: cleanIdentifier(proposal.id, 120),
      companyId,
      userId: user.id,
      actionType: type,
      confirmedAt: new Date().toISOString(),
      reinforced: actionDefinition.reinforced === true,
      expiresAt: new Date(Date.now() + CONFIRMATION_TTL_MS).toISOString()
    });
    confirmed.set(fingerprint, Date.now() + CONFIRMATION_TTL_MS);
    writeAudit(createAuditEvent({ ...auditBase, status: 'confirmed', durationMs: Date.now() - startedAt }));
    return json(200, { ok: true, phase: 6, confirmation, writePerformed: false, message: 'Confirmação validada. A aplicação usará agora o fluxo nativo da empresa.' });
  } catch (error) {
    const known = error instanceof AssistantHttpError;
    const status = known ? error.status : 500;
    const code = known ? error.code : 'UNEXPECTED_ERROR';
    const message = known ? error.message : 'Não foi possível confirmar a ação agora.';
    writeAudit(createAuditEvent({ ...auditBase, status: 'error', errorCode: code, durationMs: Date.now() - startedAt }));
    return json(status, { ok: false, error: message, code, phase: 6, writePerformed: false });
  } finally {
    if (claimedFingerprint) pending.delete(claimedFingerprint);
  }
};
