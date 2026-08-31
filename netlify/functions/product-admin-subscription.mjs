const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body)
});

const validPlans = new Set(['essential', 'builder', 'professional', 'custom']);
const validStatuses = new Set(['trial', 'active', 'payment_due', 'suspended', 'cancelled']);

function config() {
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'PRODUCT_ADMIN_EMAILS'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Configuração pendente: ${missing.join(', ')}`);
  return {
    url: process.env.SUPABASE_URL.replace(/\/$/, ''),
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    adminEmails: new Set(process.env.PRODUCT_ADMIN_EMAILS.split(',').map((email) => email.trim().toLowerCase()).filter(Boolean))
  };
}

async function callSupabase(url, key, path, options = {}) {
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: { apikey: key, ...(options.headers || {}) }
  });
  const text = await response.text();
  const body = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!response.ok) throw new Error(body?.message || body?.error || 'Falha ao atualizar a assinatura.');
  return body;
}

async function authenticatedAdmin(request, settings) {
  const token = request.headers.get('authorization') || '';
  if (!token.startsWith('Bearer ')) throw new Error('Acesso não autenticado.');
  const user = await callSupabase(settings.url, settings.anonKey, '/auth/v1/user', {
    headers: { authorization: token }
  });
  if (!user?.email || !settings.adminEmails.has(user.email.toLowerCase())) throw new Error('Este usuário não é administrador do produto.');
  return user;
}

export default async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'Método não permitido.' });
  try {
    const settings = config();
    const admin = await authenticatedAdmin(request, settings);
    const { companyId, plan, status, note = '' } = await request.json();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(companyId || ''))) return json(400, { error: 'Empresa inválida.' });
    if (!validPlans.has(plan) || !validStatuses.has(status)) return json(400, { error: 'Plano ou status inválido.' });

    const existing = await callSupabase(settings.url, settings.serviceKey, `/rest/v1/subscriptions?company_id=eq.${encodeURIComponent(companyId)}&select=id,plan,status`, {
      headers: { authorization: `Bearer ${settings.serviceKey}` }
    });
    const previous = existing[0] || null;
    const now = new Date().toISOString();
    const payload = { plan, status, updated_at: now };
    if (status === 'payment_due') payload.grace_ends_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    if (status === 'active') payload.grace_ends_at = null;

    if (previous) {
      await callSupabase(settings.url, settings.serviceKey, `/rest/v1/subscriptions?company_id=eq.${encodeURIComponent(companyId)}`, {
        method: 'PATCH',
        headers: { authorization: `Bearer ${settings.serviceKey}`, 'content-type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(payload)
      });
    } else {
      await callSupabase(settings.url, settings.serviceKey, '/rest/v1/subscriptions', {
        method: 'POST',
        headers: { authorization: `Bearer ${settings.serviceKey}`, 'content-type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ company_id: companyId, ...payload, trial_started_at: now, trial_ends_at: now })
      });
    }

    await callSupabase(settings.url, settings.serviceKey, '/rest/v1/subscription_history', {
      method: 'POST',
      headers: { authorization: `Bearer ${settings.serviceKey}`, 'content-type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ company_id: companyId, previous_plan: previous?.plan || null, new_plan: plan, previous_status: previous?.status || null, new_status: status, note: `[alteração manual por ${admin.email}] ${String(note).slice(0, 500)}` })
    });
    return json(200, { ok: true });
  } catch (error) {
    const message = error.message || 'Não foi possível atualizar a assinatura.';
    const statusCode = /não autenticado|não é administrador/i.test(message) ? 403 : /Configuração pendente/i.test(message) ? 503 : 400;
    return json(statusCode, { error: message });
  }
};
