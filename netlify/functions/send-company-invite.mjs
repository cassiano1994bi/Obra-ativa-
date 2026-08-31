const json = (statusCode, body) => new Response(JSON.stringify(body), {
  status: statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8' }
});

async function call(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(body?.msg || body?.message || body?.error || 'Falha ao consultar o serviço.');
  return body;
}

export default async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'Método não permitido.' });
  const supabaseUrl = String(process.env.INVITE_SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = process.env.INVITE_SUPABASE_ANON_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_FROM_EMAIL;
  if (!supabaseUrl || !anonKey || !resendKey || !from) return json(503, { error: 'Envio de convites ainda não configurado: falta definir o remetente verificado.' });
  try {
    const authorization = request.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) return json(401, { error: 'Acesso não autenticado.' });
    const user = await call(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, authorization } });
    const input = await request.json();
    const email = String(input.email || '').trim().toLowerCase();
    const inviteUrl = String(input.inviteUrl || '').trim();
    const companyName = String(input.companyName || 'sua empresa').trim();
    const expiresAt = String(input.expiresAt || '').trim();
    if (!email || !inviteUrl || !/^https:\/\//i.test(inviteUrl)) return json(400, { error: 'Dados do convite inválidos.' });
    const result = await call('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `Convite para entrar na ${companyName}`,
        text: `Olá!\n\n${user.email || 'A empresa'} convidou você para acessar a ${companyName} no Controle de Obra.\n\nAbra este link para aceitar o convite:\n${inviteUrl}\n\n${expiresAt ? `O link é válido até ${expiresAt}.` : ''}\n\nSe você não esperava este convite, ignore esta mensagem.`,
        html: `<p>Olá!</p><p>Você foi convidado para acessar a <strong>${companyName.replace(/[&<>"']/g, '')}</strong> no Controle de Obra.</p><p><a href="${inviteUrl.replace(/"/g, '&quot;')}">Aceitar convite seguro</a></p><p>${expiresAt ? `O link é válido até ${expiresAt}.` : ''}</p><p>Se você não esperava este convite, ignore esta mensagem.</p>`
      })
    });
    return json(200, { ok: true, id: result?.id || null });
  } catch (error) {
    return json(400, { error: error.message || 'Não foi possível enviar o convite.' });
  }
};
