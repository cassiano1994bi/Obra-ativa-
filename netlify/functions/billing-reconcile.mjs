import { createBilling } from './_billing/core.mjs';
export function createHandler(deps) {
  const b = createBilling(deps);
  return async () => {
    if (b.env.BILLING_RECONCILIATION_ENABLED !== 'true') return;
    const enabled = await b.db('billing_control?id=eq.true&select=enabled');
    if (!enabled?.[0]?.enabled) return;
    const rows = await b.db('billing_attempts?select=*&order=checked_at.asc.nullsfirst,created_at.asc&limit=4');
    await Promise.all(rows.map(async a => {
      if (!await b.rpc('billing_claim_sync', { p_attempt: a.id })) return;
      try { await b.sync(a); }
      catch (e) { await b.recordError(a, e.code); }
    }));
  };
}
export default createHandler();
// Netlify scheduled functions have no public HTTP route in production.
export const config = { schedule: '* * * * *' };
