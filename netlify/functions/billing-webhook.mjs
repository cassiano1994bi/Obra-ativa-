import { createBilling, endpoint, input, fail, signatureValid } from './_billing/core.mjs';
export function createHandler(deps) {
  const b = createBilling(deps);
  return endpoint(async request => {
    const body = await input(request), url = new URL(request.url), id = url.searchParams.get('data.id');
    if (!signatureValid(request, b.env.MERCADOPAGO_WEBHOOK_SECRET, id) || String(body.data?.id).toLowerCase() !== String(id).toLowerCase())
      fail(401, 'signature', 'Notificação não autenticada.');
    const topic = body.type;
    if (topic === 'subscription_preapproval') {
      const pair = await b.subscription(id);
      if (pair) await b.apply(pair.s, pair.a);
    } else if (topic === 'subscription_authorized_payment') await b.invoice(id);
    else if (topic === 'payment') {
      const list = await b.mp(`/authorized_payments/search?payment_id=${encodeURIComponent(id)}&limit=10`);
      for (const inv of list.results || []) {
        if (String(inv.payment?.id) === String(id)) await b.invoice(inv.id);
      }
    } else return { received: true, ignored: true };
    return { received: true };
  });
}
export default createHandler();
