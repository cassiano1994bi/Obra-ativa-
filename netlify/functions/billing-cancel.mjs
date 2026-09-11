import { createBilling, endpoint, input, fail, uncreatedCancellation } from './_billing/core.mjs';
export function createHandler(deps) {
  const b = createBilling(deps);
  return endpoint(async request => {
    const body = await input(request), actor = await b.actor(request, body);
    b.manage(actor);
    if (body.confirm !== true) fail(400, 'confirmation', 'Confirme o cancelamento da renovação automática.');
    const a = await b.current(actor.user.id);
    if (!a || uncreatedCancellation(a)) return { cancelled: true };
    let current = await b.readProvider(a);
    const linked = { ...a, provider_id: String(current.id) };
    if (current.status !== 'cancelled') {
      await b.mp(`/preapproval/${encodeURIComponent(current.id)}`, 'PUT', { status: 'cancelled' });
      current = await b.readProvider(linked);
    }
    await b.applyCancellation(current, linked);
    return { cancelled: true, message: 'Renovação cancelada. O período já liberado continua válido. Seus dados permanecem disponíveis para consulta.' };
  });
}
export default createHandler();
