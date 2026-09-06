import { createBilling, endpoint, input, fail } from './_billing/core.mjs';
export function createHandler(deps) {
  const b = createBilling(deps);
  return endpoint(async request => {
    const body = await input(request), actor = await b.actor(request, body);
    b.manage(actor);
    if (body.confirm !== true) fail(400, 'confirmation', 'Confirme o cancelamento da renovação automática.');
    const a = await b.current(actor.user.id);
    if (!a) return { cancelled: true };
    const current = await b.sync(a, false);
    if (current.status !== 'cancelled') {
      await b.mp(`/preapproval/${encodeURIComponent(current.id)}`, 'PUT', { status: 'cancelled' });
      const pair = await b.subscription(current.id);
      if (!pair || pair.s.status !== 'cancelled') fail(503, 'cancellation_pending', 'Ainda estamos confirmando o cancelamento. Atualize o status antes de tentar novamente.');
      await b.apply(pair.s, pair.a);
    }
    return { cancelled: true, message: 'Renovação cancelada. O período já liberado continua válido. Seus dados permanecem disponíveis para consulta.' };
  });
}
export default createHandler();
