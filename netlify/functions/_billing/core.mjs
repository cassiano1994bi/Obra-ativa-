import { createHmac, timingSafeEqual } from 'node:crypto';

export const PLAN = Object.freeze({ price: 69, currency: 'BRL', trialDays: 30, graceDays: 3 });
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESOURCE = /^[a-z0-9_-]{1,100}$/i;
export class BillingError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export function fail(status, code, message) { throw new BillingError(status, code, message); }
export function json(status, value) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}
export function endpoint(run) {
  return async request => {
    try { return json(200, await run(request)); }
    catch (e) { return json(e instanceof BillingError ? e.status : 503, { error: e instanceof BillingError ? e.message : 'Não foi possível confirmar agora. Seus dados estão seguros. Tente novamente.', code: e instanceof BillingError ? e.code : 'temporarily_unavailable' }); }
  };
}
export async function input(request) {
  if (request.method !== 'POST') fail(405, 'method', 'Use uma solicitação POST.');
  if (Number(request.headers.get('content-length')) > 16384) fail(413, 'size', 'Solicitação muito grande.');
  const body = await request.text();
  if (Buffer.byteLength(body) > 16384) fail(413, 'size', 'Solicitação muito grande.');
  try { const value = JSON.parse(body || '{}'); if (!value || Array.isArray(value) || typeof value !== 'object') throw Error(); return value; }
  catch { fail(400, 'body', 'Solicitação inválida.'); }
}
export function checkoutURL(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && ['www.mercadopago.com.br', 'mercadopago.com.br'].includes(url.hostname) && !url.username && !url.password && !url.port && url.pathname.startsWith('/subscriptions/')) return url.href;
  } catch { /* fail closed */ }
  fail(502, 'provider_link', 'O endereço seguro de pagamento ainda não foi confirmado.');
}
export function signatureValid(request, secret, dataId) {
  if (!secret || !RESOURCE.test(String(dataId))) return false;
  const entries = (request.headers.get('x-signature') || '').split(',').map(s => s.trim().split('='));
  if (entries.filter(([k]) => k === 'ts').length !== 1 || entries.filter(([k]) => k === 'v1').length !== 1) return false;
  const parts = Object.fromEntries(entries), requestId = request.headers.get('x-request-id');
  if (!requestId || !/^[a-z0-9-]{1,150}$/i.test(requestId) || !/^\d{10,13}$/.test(parts.ts || '') || !/^[a-f0-9]{64}$/i.test(parts.v1 || '')) return false;
  // Old signatures remain valid for delayed retries: canonical API state and
  // monotonic, idempotent database writes prevent replay from changing access.
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest();
  return timingSafeEqual(expected, Buffer.from(parts.v1, 'hex'));
}
function date(value) {
  if (!value || !Number.isFinite(Date.parse(value))) fail(502, 'provider_date', 'A data da cobrança não foi confirmada.');
  return new Date(value).toISOString();
}
function resource(value) {
  if (!RESOURCE.test(String(value))) fail(400, 'resource', 'Identificador inválido.');
  return encodeURIComponent(String(value));
}

export function createBilling({ env = process.env, fetchImpl = fetch, now = () => Date.now() } = {}) {
  const dbURL = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const service = env.SUPABASE_SERVICE_ROLE_KEY, anon = env.SUPABASE_ANON_KEY;
  const appURL = env.BILLING_APP_URL;
  function configured(provider = false) {
    if (!/^https:\/\//.test(dbURL) || !service || !anon || (provider && (!env.MERCADOPAGO_ACCESS_TOKEN || !/^\d+$/.test(env.MERCADOPAGO_COLLECTOR_ID || '') || !/^https:\/\//.test(appURL || ''))))
      fail(503, 'not_configured', 'As assinaturas ainda estão sendo configuradas. Nenhuma cobrança foi iniciada.');
  }
  async function fetchJSON(url, options) {
    const response = await fetchImpl(url, { redirect: 'error', ...options, signal: AbortSignal.timeout(5000) });
    let value; try { value = await response.json(); } catch { value = null; }
    if (!response.ok) {
      // Never expose a provider response, credentials, payer data or SQL internals.
      const code = value?.code === 'OB069' ? 'read_only' : 'upstream';
      const sessionExpired = response.status === 401 && !url.startsWith('https://api.mercadopago.com/');
      const error = new BillingError(sessionExpired ? 401 : code === 'read_only' ? 403 : 503, code,
        sessionExpired ? 'Entre novamente para confirmar sua identidade.' : 'Não foi possível confirmar agora. Seus dados estão seguros. Tente novamente.');
      error.upstreamStatus=response.status;
      throw error;
    }
    return value;
  }
  async function db(path, { token, method = 'GET', body, headers = {} } = {}) {
    configured();
    const key = token ? anon : service;
    return fetchJSON(`${dbURL}/rest/v1/${path}`, { method, headers: {
      apikey: key, ...((token || !key.startsWith('sb_secret_')) ? { authorization: `Bearer ${token || key}` } : {}),
      'content-type': 'application/json', ...headers
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  const rpc = (name, body = {}, token) => db(`rpc/${name}`, { method: 'POST', body, token });
  async function mp(path, method = 'GET', body, idempotency) {
    configured(true);
    if (!path.startsWith('/')) throw Error('Invalid API path');
    return fetchJSON(`https://api.mercadopago.com${path}`, { method, headers: {
      authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}`, 'content-type': 'application/json',
      ...(idempotency ? { 'X-Idempotency-Key': idempotency } : {})
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }).catch(error => {
      if (method==='POST' && path==='/preapproval' && [400,401,403,404,422].includes(error.upstreamStatus)) error.definitiveCreateFailure=true;
      throw error;
    });
  }
  async function actor(request, body) {
    configured();
    const token = /^Bearer (\S+)$/i.exec(request.headers.get('authorization') || '')?.[1];
    if (!token) fail(401, 'session', 'Entre na conta para gerenciar sua assinatura.');
    const origin = request.headers.get('origin');
    if (origin && appURL && origin !== new URL(appURL).origin) fail(403, 'origin', 'Origem não autorizada.');
    const user = await fetchJSON(`${dbURL}/auth/v1/user`, { headers: { apikey: anon, authorization: `Bearer ${token}` } });
    if (!UUID.test(user?.id || '')) fail(401, 'session', 'Entre novamente para continuar.');
    if (body.companyId && !UUID.test(body.companyId)) fail(400, 'company', 'Empresa inválida.');
    const access = await rpc('billing_access', { p_company_id: body.companyId || null }, token);
    if (!access?.enabled) fail(409, 'not_enabled', 'O novo sistema de assinaturas ainda não foi ativado.');
    return { user, token, access };
  }
  function manage(actor) {
    if (!actor.access.can_manage || actor.access.owner_user_id !== actor.user.id) fail(403, 'owner', 'Somente o responsável pela conta pode gerenciar o pagamento.');
    if (actor.access.mode === 'administrator') fail(409, 'administrator', 'Esta conta administrativa não precisa contratar uma assinatura.');
  }
  async function attempt(id) {
    if (!UUID.test(id || '')) return null;
    return (await db(`billing_attempts?id=eq.${id}&select=*&limit=1`))?.[0] || null;
  }
  async function current(owner) { return (await db(`billing_attempts?owner_user_id=eq.${owner}&order=created_at.desc&limit=1&select=*`))?.[0] || null; }
  function validateSubscriptionIdentity(s, a) {
    if (!a || String(s.external_reference) !== a.id || (a.provider_id && String(s.id) !== a.provider_id) ||
      String(s.collector_id) !== env.MERCADOPAGO_COLLECTOR_ID || !['pending', 'authorized', 'paused', 'cancelled'].includes(s.status))
      fail(502, 'provider_mismatch', 'Os dados da assinatura precisam ser conferidos. Nenhum acesso foi alterado.');
    resource(s.id); date(s.last_modified);
    return s;
  }
  function validateSubscription(s, a) {
    validateSubscriptionIdentity(s, a);
    const r = s.auto_recurring;
    if (Number(r?.transaction_amount) !== 69 || r?.currency_id !== 'BRL' || Number(r?.frequency) !== 1 || r?.frequency_type !== 'months')
      fail(502, 'provider_mismatch', 'Os dados da assinatura precisam ser conferidos. Nenhum acesso foi alterado.');
    return s;
  }
  // Cancelar uma recorrência divergente não equivale a aceitar seu preço ou liberar pagamento.
  async function applyCancellation(s, a) {
    validateSubscriptionIdentity(s, a);
    if (s.status !== 'cancelled') fail(503, 'cancellation_pending', 'Ainda estamos confirmando o cancelamento. Atualize o status antes de tentar novamente.');
    await rpc('billing_apply_provider', {
      p_attempt: a.id, p_provider_id: String(s.id), p_status: 'cancelled',
      p_modified: date(s.last_modified), p_checkout: null, p_payment: null
    });
  }
  async function apply(s, a, payment = null) {
    validateSubscription(s, a);
    await rpc('billing_apply_provider', {
      p_attempt: a.id, p_provider_id: String(s.id), p_status: s.status,
      p_modified: date(s.last_modified), p_checkout: s.init_point ? checkoutURL(s.init_point) : null, p_payment: payment
    });
  }
  async function subscription(id) {
    const s = await mp(`/preapproval/${resource(id)}`);
    const a = await attempt(s?.external_reference);
    if (!a) return null; // A different product belonging to the same seller.
    validateSubscription(s, a);
    return { s, a };
  }
  async function invoice(id, knownPair = null) {
    const inv = await mp(`/authorized_payments/${resource(id)}`);
    const pair = knownPair || await subscription(inv?.preapproval_id);
    if (!pair) return false;
    if (String(inv.id) !== String(id) || String(inv.preapproval_id) !== String(pair.s.id) || Number(inv.transaction_amount) !== 69 || inv.currency_id !== 'BRL') fail(502, 'invoice', 'Cobrança divergente.');
    const { s, a } = pair;
    if (!inv.payment?.id) { await apply(s, a); return true; }
    const pay = await mp(`/v1/payments/${resource(inv.payment.id)}`);
    if (String(pay.id) !== String(inv.payment.id) || Number(pay.transaction_amount) !== 69 || pay.currency_id !== 'BRL' || String(pay.collector_id) !== env.MERCADOPAGO_COLLECTOR_ID ||
      (pay.payer?.id && s.payer_id && String(pay.payer.id) !== String(s.payer_id))) fail(502, 'payment', 'Pagamento divergente.');
    const status = Number(pay.transaction_amount_refunded) > 0 ? 'refunded' : pay.status;
    if (!['approved','rejected','pending','in_process','cancelled','refunded','charged_back','in_mediation','authorized'].includes(status)) fail(502, 'payment_status', 'Pagamento ainda não confirmado.');
    await apply(s, a, {
      id: String(pay.id), invoice_id: String(inv.id), status, amount: 69, currency: 'BRL',
      debit_at: date(inv.debit_date), approved_at: status === 'approved' ? date(pay.date_approved) : null,
      modified_at: date(pay.date_last_updated)
    });
    return true;
  }
  async function readProvider(a) {
    let providerId = a.provider_id;
    if (!providerId) {
      const found = await mp(`/preapproval/search?external_reference=${encodeURIComponent(a.id)}&limit=10`);
      const matches = (found.results || []).filter(s => String(s.external_reference) === a.id);
      if (matches.length !== 1) fail(409, 'checkout_uncertain', 'Ainda estamos conferindo a tentativa anterior. Não inicie outra cobrança. Tente atualizar em alguns instantes.');
      providerId = matches[0].id;
    }
    const s = await mp(`/preapproval/${resource(providerId)}`);
    validateSubscriptionIdentity(s, { ...a, provider_id: String(providerId) });
    return s;
  }
  async function sync(a, withPayments = true) {
    const s = await readProvider(a);
    await apply(s, a);
    if (withPayments) {
      // Persisted pagination revisits every invoice, including old refunds.
      const offset = Number(a.invoice_offset) || 0;
      const list = await mp(`/authorized_payments/search?preapproval_id=${resource(s.id)}&limit=4&offset=${offset}`);
      if (!Array.isArray(list.results)) fail(502, 'invoices', 'Histórico de cobranças indisponível.');
      await Promise.all(list.results.slice(0,4).map(inv => invoice(inv.id, { s, a })));
      const next = list.results.length < 4 || offset + 4 >= Number(list.paging?.total) ? 0 : offset + 4;
      await db(`billing_attempts?id=eq.${a.id}`, { method: 'PATCH', body: { invoice_offset: next } });
    }
    return s;
  }
  async function recordError(a, code) {
    // Os filtros usam o estado atual no banco: um callback antigo não reabre recusa definitiva.
    await db(`billing_attempts?id=eq.${a.id}&or=(provider_id.not.is.null,status.neq.cancelled)`, { method: 'PATCH', body: { last_error: String(code || 'temporarily_unavailable').slice(0, 80), checked_at: new Date(now()).toISOString() } });
    if (!a.provider_id) await db(`billing_attempts?id=eq.${a.id}&provider_id=is.null&status=in.(creating,uncertain)`, { method: 'PATCH', body: { status: 'uncertain' } });
  }
  return { env, db, rpc, mp, actor, manage, current, attempt, subscription, apply, applyCancellation, readProvider, invoice, sync, recordError, now, configured };
}
export const uncreatedCancellation = a => a?.status === 'cancelled' && !a.provider_id;
