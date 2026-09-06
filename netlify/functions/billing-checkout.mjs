import { createBilling, endpoint, input, fail, checkoutURL } from './_billing/core.mjs';

export function createHandler(deps) {
  const b = createBilling(deps);
  return endpoint(async request => {
    const body = await input(request), actor = await b.actor(request, body);
    b.manage(actor); b.configured(true);
    if (body.acceptRecurring !== true) fail(400, 'consent', 'Confirme a assinatura de R$ 69 por mês, com renovação automática.');
    if (['price', 'amount', 'currency', 'plan', 'ownerId', 'redirectUrl'].some(key => key in body)) fail(400, 'plan', 'O plano é definido pelo servidor.');
    if (!actor.user.email || !actor.user.email_confirmed_at) fail(409, 'confirm_email', 'Confirme seu e-mail antes de contratar a assinatura.');
    const starts = Math.max(Date.parse(actor.access.trial_ends_at) || 0, Date.parse(actor.access.paid_until) || 0);
    // The provider persists whole seconds. Round UP so its normalization never
    // shortens the free/already-paid period or falsely rejects a valid checkout.
    const providerStarts = Math.ceil(starts / 1000) * 1000;
    const verifyStart = s => {
      if (starts > b.now()+60000 && !(Date.parse(s.auto_recurring?.start_date) >= starts))
        fail(502,'trial_start_not_confirmed','O período grátis ainda não foi confirmado no checkout. Nenhuma autorização de cobrança foi solicitada. Atualize o status antes de continuar.');
    };
    const a = await b.rpc('billing_claim_checkout', { p_owner: actor.user.id });
    try {
      if (!a.created) {
        const s = await b.sync(a, false);
        if (s.status !== 'pending') fail(409, 'existing_subscription', 'Você já tem uma assinatura. Atualize o status ou gerencie a cobrança existente.');
        verifyStart(s);
        return { url: checkoutURL(s.init_point), reused: true };
      }
      const s = await b.mp('/preapproval', 'POST', {
        reason: 'ObraAtiva — acesso completo mensal', external_reference: a.id,
        payer_email: actor.user.email, status: 'pending',
        auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: 69, currency_id: 'BRL',
          ...(starts > b.now() + 60000 ? { start_date: new Date(providerStarts).toISOString() } : {}) },
        back_url: `${new URL(b.env.BILLING_APP_URL).origin}/?app=1&billing=return`
      }, a.id);
      await b.apply(s, a);
      verifyStart(s);
      return { url: checkoutURL(s.init_point), reused: false };
    } catch (e) {
      if (a.created) {
        await b.recordError(a, e.code).catch(() => {});
        if (e.definitiveCreateFailure) await b.db(`billing_attempts?id=eq.${a.id}&provider_id=is.null`, {method:'PATCH',body:{status:'cancelled',last_error:'checkout_rejected_before_creation'}}).catch(()=>{});
      }
      throw e;
    }
  });
}
export default createHandler();
