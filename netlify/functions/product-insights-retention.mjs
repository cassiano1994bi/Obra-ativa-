// Exclui somente detalhes de telemetria expirados; nunca dados operacionais.
export default async () => {
  if (process.env.PRODUCT_ANALYTICS_MAINTENANCE_ENABLED !== 'true') return;
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Retenção de telemetria não configurada.');
  const headers = { apikey: key, ...(key.startsWith('sb_secret_') ? {} : { authorization: `Bearer ${key}` }), 'content-type': 'application/json' };
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/product_insights_prune`, {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers, body: '{}'
  });
  if (!response.ok) throw new Error('A manutenção da telemetria não foi concluída.');
};
export const config = { schedule: '@daily' };
