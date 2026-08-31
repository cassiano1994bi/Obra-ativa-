import { persistentDailyUsage } from './_assistant/assistant-usage.mjs';

const json = (statusCode, body) => new Response(JSON.stringify(body), {
  status: statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
});
const validUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const allowedModules = new Set(['works', 'clients', 'team', 'planning', 'attendance', 'payments', 'financial', 'vehicles', 'reports']);
const profileRoles = Object.freeze({ gerente: 'manager', supervisor: 'collaborator', financeiro: 'collaborator', colaborador: 'collaborator', visualizador: 'viewer' });

async function call(url, options = {}, fetchImpl = fetch) {
  const response = await fetchImpl(url, options);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const error = new Error(body?.msg || body?.message || body?.error || 'Falha ao consultar o serviço.');
    error.status = response.status;
    error.code = body?.code || '';
    throw error;
  }
  return body;
}

function inviteDailyLimit(env) {
  const configured = Number(env.INVITE_DAILY_LIMIT);
  return Number.isInteger(configured) && configured >= 1 && configured <= 100 ? configured : 20;
}

function appBaseUrl(request, env) {
  for (const value of [env.INVITE_APP_URL, env.URL, env.DEPLOY_PRIME_URL, request.url]) {
    try {
      const parsed = new URL(String(value || '').trim());
      const localTest = ['localhost', '127.0.0.1'].includes(parsed.hostname);
      if (parsed.protocol === 'https:' || (localTest && parsed.protocol === 'http:')) return new URL('/', parsed.origin);
    } catch {}
  }
  throw new Error('O endereço autorizado do aplicativo não está configurado.');
}

function normalizeInvitation(body) {
  const invitation = Array.isArray(body) ? body[0] : body;
  return invitation && typeof invitation === 'object' ? invitation : null;
}

function sanitizedPermissions(input) {
  const modules = Array.isArray(input?.modules) ? input.modules.filter((module) => allowedModules.has(String(module))) : [];
  return { modules: [...new Set(modules)] };
}

export function createSendCompanyInviteHandler({ env = process.env, fetchImpl = fetch, now = () => new Date() } = {}) {
  return async (request) => {
    if (request.method !== 'POST') return json(405, { error: 'Método não permitido.' });
    const supabaseUrl = String(env.INVITE_SUPABASE_URL || '').replace(/\/$/, '');
    const anonKey = env.INVITE_SUPABASE_ANON_KEY;
    const resendKey = env.RESEND_API_KEY;
    const from = env.INVITE_FROM_EMAIL;
    if (!supabaseUrl || !anonKey || !resendKey || !from) return json(503, { error: 'Envio de convites ainda não configurado: falta definir o remetente verificado.' });

    try {
      const authorization = request.headers.get('authorization') || '';
      if (!authorization.startsWith('Bearer ')) return json(401, { error: 'Acesso não autenticado.' });
      const rawBody = await request.text();
      if (rawBody.length > 12000) return json(413, { error: 'Dados do convite ultrapassam o limite permitido.' });
      let input;
      try { input = rawBody ? JSON.parse(rawBody) : {}; } catch { return json(400, { error: 'Dados do convite inválidos.' }); }

      const companyId = String(input.companyId || '').trim();
      const email = String(input.email || '').trim().toLowerCase();
      const permissionProfile = String(input.permissionProfile || 'colaborador').trim().toLowerCase();
      const role = profileRoles[permissionProfile];
      const permissions = sanitizedPermissions(input.permissions);
      if (!validUuid(companyId) || !validEmail(email) || email.length > 254 || !role) return json(400, { error: 'Dados do convite inválidos.' });
      const headers = { apikey: anonKey, authorization, accept: 'application/json' };

      const user = await call(`${supabaseUrl}/auth/v1/user`, { headers }, fetchImpl);
      if (!validUuid(user?.id)) return json(401, { error: 'Sua sessão não pôde ser validada.' });
      const memberQuery = new URLSearchParams({ company_id: `eq.${companyId}`, user_id: `eq.${user.id}`, status: 'eq.active', role: 'in.(owner,manager)', select: 'company_id,user_id,role', limit: '1' });
      const members = await call(`${supabaseUrl}/rest/v1/company_members?${memberQuery}`, { headers }, fetchImpl);
      const member = Array.isArray(members) ? members[0] : null;
      if (!member || member.company_id !== companyId || member.user_id !== user.id || !['owner', 'manager'].includes(member.role)) return json(403, { error: 'Somente o dono ou gerente desta empresa pode enviar convites.' });

      const companiesQuery = new URLSearchParams({ id: `eq.${companyId}`, select: 'id,name', limit: '1' });
      const companies = await call(`${supabaseUrl}/rest/v1/companies?${companiesQuery}`, { headers }, fetchImpl);
      const company = Array.isArray(companies) ? companies[0] : null;
      if (!company || company.id !== companyId) return json(404, { error: 'Empresa não encontrada.' });

      await persistentDailyUsage({ companyId, scope: 'company_invite_email', limit: inviteDailyLimit(env), authorization, config: { supabaseUrl, anonKey }, consume: true, fetchImpl });

      const invitation = normalizeInvitation(await call(`${supabaseUrl}/rest/v1/rpc/create_company_invitation`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ p_company_id: companyId, p_email: email, p_role: role, p_permission_profile: permissionProfile, p_permissions: permissions })
      }, fetchImpl));
      const invitationEmail = String(invitation?.email || '').trim().toLowerCase();
      const invitationId = String(invitation?.id || '').trim();
      const token = String(invitation?.token || '').trim();
      const expiration = new Date(invitation?.expires_at || '');
      if (!validUuid(invitationId) || invitationEmail !== email || !token || token.length > 512 || /[\s<>"']/.test(token) || !Number.isFinite(expiration.getTime())) throw new Error('O serviço criou um convite inválido.');
      if (expiration.getTime() <= now().getTime()) return json(410, { error: 'Este convite expirou. Gere um novo link.' });

      const companyName = String(company.name || 'sua empresa').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 160) || 'sua empresa';
      const inviteUrl = appBaseUrl(request, env);
      inviteUrl.searchParams.set('app', '1');
      inviteUrl.searchParams.set('invite', token);
      inviteUrl.searchParams.set('empresa', companyName);
      const expiresLabel = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' }).format(expiration);
      const result = await call('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [invitationEmail],
          subject: `Convite para entrar na ${companyName}`,
          text: `Olá!\n\n${user.email || 'A empresa'} convidou você para acessar a ${companyName} no ObraAtiva.\n\nAbra este link para aceitar o convite:\n${inviteUrl}\n\nO link é válido até ${expiresLabel}.\n\nSe você não esperava este convite, ignore esta mensagem.`,
          html: `<p>Olá!</p><p>Você foi convidado para acessar a <strong>${escapeHtml(companyName)}</strong> no ObraAtiva.</p><p><a href="${escapeHtml(inviteUrl.toString())}">Aceitar convite seguro</a></p><p>O link é válido até ${escapeHtml(expiresLabel)}.</p><p>Se você não esperava este convite, ignore esta mensagem.</p>`
        })
      }, fetchImpl);
      return json(200, { ok: true, id: result?.id || null, invitation: { id: invitationId, email: invitationEmail, token, expires_at: invitation.expires_at } });
    } catch (error) {
      const status = Number(error?.status);
      const safeStatus = [400, 401, 403, 409, 410, 413, 429, 502, 503].includes(status) ? status : 400;
      return json(safeStatus, { error: error.message || 'Não foi possível enviar o convite.', code: error.code || undefined });
    }
  };
}

export default createSendCompanyInviteHandler();
