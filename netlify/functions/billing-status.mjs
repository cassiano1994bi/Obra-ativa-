import { createBilling, endpoint, input, uncreatedCancellation } from './_billing/core.mjs';
export function createHandler(deps) {
  const b = createBilling(deps);
  return endpoint(async request => {
    const body = await input(request), actor = await b.actor(request, body);
    const a = await b.current(actor.access.owner_user_id);
    if (a && !uncreatedCancellation(a) && await b.rpc('billing_claim_sync', { p_attempt: a.id })) {
      try { await b.sync(a); }
      catch (e) { await b.recordError(a, e.code).catch(() => {}); throw e; }
    }
    return b.rpc('billing_access', { p_company_id: body.companyId || null }, actor.token);
  });
}
export default createHandler();
