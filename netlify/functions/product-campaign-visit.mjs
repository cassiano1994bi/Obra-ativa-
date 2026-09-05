import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const COOKIE = 'oa_campaign_visit';
const TTL = 30 * 86400;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply = (status, body, cookie = '') => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
    'x-content-type-options': 'nosniff', ...(cookie ? { 'set-cookie': cookie } : {}) }
});
const sign = (value, secret) => createHmac('sha256', secret).update(value).digest('hex');
const serverHeaders = (key) => ({
  apikey: key,
  ...(String(key).startsWith('sb_secret_') ? {} : { authorization: `Bearer ${key}` }),
  'content-type': 'application/json'
});
export function readVisit(cookie, secret, now = Date.now()) {
  const raw = String(cookie || '').split(';').map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const [id, issued, signature] = raw.split('.');
  if (!uuid.test(id) || !/^\d{10}$/.test(issued || '') || !/^[a-f0-9]{64}$/.test(signature || '')) return null;
  const age = now / 1000 - Number(issued);
  if (age < 0 || age > TTL || !timingSafeEqual(Buffer.from(signature), Buffer.from(sign(`${id}.${issued}`, secret)))) return null;
  return { id, issued, signature };
}

// Dependencies are injectable for isolated tests; no production accounts in fixtures.
export function createHandler({ env = process.env, fetchImpl = fetch, now = Date.now } = {}) {
  return async (request, context = {}) => {
    if (request.method !== 'POST') return reply(405, { ok: false });
    const origin = new URL(request.url).origin;
    if (request.headers.get('origin') !== origin || !request.headers.get('content-type')?.startsWith('application/json')) return reply(403, { ok: false });
    const expired = `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
    try {
      if (Number(request.headers.get('content-length') || 0) > 1024) return reply(413, { ok: false });
      const raw = await request.text();
      if (raw.length > 1024) return reply(413, { ok: false });
      const body = JSON.parse(raw);
      if (body.kind === 'forget') return reply(200, { ok: true }, expired);
      if (!['visit', 'whatsapp', 'link'].includes(body.kind) || body.consent !== true) return reply(400, { ok: false });
      const secret = env.PRODUCT_ANALYTICS_SECRET;
      if (env.PRODUCT_ANALYTICS_ENABLED !== 'true' || !secret || secret.length < 32 || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_ANON_KEY) return reply(503, { ok: false, pending: true });
      const base = env.SUPABASE_URL.replace(/\/$/, '');
      const rpc = async (name, args) => {
        const res = await fetchImpl(`${base}/rest/v1/rpc/${name}`, { method: 'POST', signal: AbortSignal.timeout(5000),
          headers: serverHeaders(env.SUPABASE_SERVICE_ROLE_KEY), body: JSON.stringify(args) });
        if (!res.ok) throw new Error('unavailable');
        return res.json();
      };
      let visit = readVisit(request.headers.get('cookie'), secret, now());
      if (body.kind === 'link') {
        if (!visit) return reply(200, { ok: true, attributed: false });
        const authorization = request.headers.get('authorization') || '';
        if (!authorization.startsWith('Bearer ')) return reply(401, { ok: false });
        const res = await fetchImpl(`${base}/auth/v1/user`, { signal: AbortSignal.timeout(5000), headers: { apikey: env.SUPABASE_ANON_KEY, authorization } });
        if (!res.ok) return reply(401, { ok: false });
        const user = await res.json();
        if (!uuid.test(user?.id || '')) return reply(401, { ok: false });
        const linked = await rpc('product_campaign_link', { p_id: visit.id, p_user: user.id });
        return reply(200, { ok: true, attributed: linked === true });
      }
      const slug = String(body.campaign || '');
      if (slug && !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(slug)) return reply(400, { ok: false });
      const ip = context.ip;
      if (!ip) return reply(503, { ok: false, pending: true });
      if (!visit && body.kind === 'whatsapp') return reply(200, { ok: true });
      if (!visit) {
        const id = randomUUID(), issued = String(Math.floor(now() / 1000));
        visit = { id, issued, signature: sign(`${id}.${issued}`, secret) };
      }
      const ok = await rpc('product_campaign_visit', { p_id: visit.id, p_slug: slug,
        p_rate_key: sign(`${new Date(now()).toISOString().slice(0, 10)}:${ip}`, secret), p_kind: body.kind });
      if (!ok) return reply(429, { ok: false });
      return reply(200, { ok: true }, `${COOKIE}=${visit.id}.${visit.issued}.${visit.signature}; Path=/; Max-Age=${TTL}; HttpOnly; Secure; SameSite=Lax`);
    } catch {
      return reply(503, { ok: false, message: 'Medição indisponível. O aplicativo continua funcionando.' });
    }
  };
}
export default createHandler();
