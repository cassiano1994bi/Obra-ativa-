const SUPPORT_EMAIL = 'escritoriodaminhaobra@gmail.com';

const json = (statusCode, body) => new Response(JSON.stringify(body), {
  status: statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  }
});

function clean(value, maxLength) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 180;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

async function call(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(body?.msg || body?.message || body?.error || 'Falha ao consultar o serviço.');
  return body;
}

async function authenticatedEmail(request) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return '';
  const supabaseUrl = String(process.env.INVITE_SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = process.env.INVITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) throw new Error('A validação da sessão não está configurada.');
  const user = await call(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, authorization } });
  return clean(user?.email, 180).toLowerCase();
}

async function sendEmail({ from, to, subject, text, html }) {
  return call('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ from, to: [to], subject, text, html })
  });
}

export default async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'Método não permitido.' });
  if (!process.env.RESEND_API_KEY) return json(503, { error: 'O canal de solicitações ainda não está configurado.' });

  try {
    const input = await request.json();
    if (clean(input.website, 80)) return json(200, { ok: true });
    const sessionEmail = await authenticatedEmail(request);
    const email = sessionEmail || clean(input.email, 180).toLowerCase();
    const name = clean(input.name, 120) || 'Usuário do Controle de Obra';
    const reason = clean(input.reason, 800) || 'Não informado';
    const source = clean(input.source, 40) || 'não informado';
    if (!validEmail(email)) return json(400, { error: 'Informe um e-mail válido.' });

    const requestId = `DEL-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const from = process.env.ACCOUNT_DELETION_FROM_EMAIL || process.env.INVITE_FROM_EMAIL;
    const to = process.env.ACCOUNT_DELETION_TO_EMAIL || SUPPORT_EMAIL;
    if (!from) return json(503, { error: 'O remetente do canal de solicitações ainda não está configurado.' });

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeReason = escapeHtml(reason);
    const safeSource = escapeHtml(source);
    await sendEmail({
      from,
      to,
      subject: `[${requestId}] Solicitação de exclusão de conta`,
      text: `Nova solicitação de exclusão de conta\n\nProtocolo: ${requestId}\nNome: ${name}\nE-mail: ${email}\nOrigem: ${source}\nObservação: ${reason}\n\nConfirme a identidade antes de qualquer alteração. Esta mensagem não autoriza exclusão automática de dados empresariais.`,
      html: `<h2>Solicitação de exclusão de conta</h2><p><b>Protocolo:</b> ${requestId}</p><p><b>Nome:</b> ${safeName}<br><b>E-mail:</b> ${safeEmail}<br><b>Origem:</b> ${safeSource}</p><p><b>Observação:</b> ${safeReason}</p><p><strong>Confirme a identidade antes de qualquer alteração.</strong> Esta solicitação não autoriza exclusão automática de dados empresariais.</p>`
    });

    try {
      await sendEmail({
        from,
        to: email,
        subject: `Recebemos sua solicitação ${requestId}`,
        text: `Olá, ${name}.\n\nRecebemos sua solicitação de exclusão da conta do Controle de Obra.\nProtocolo: ${requestId}\n\nResponderemos por este e-mail para confirmar sua identidade e explicar os próximos passos. Nenhum dado será apagado automaticamente.\n\nEscritório da Minha Obra`,
        html: `<p>Olá, ${safeName}.</p><p>Recebemos sua solicitação de exclusão da conta do <strong>Controle de Obra</strong>.</p><p><b>Protocolo:</b> ${requestId}</p><p>Responderemos por este e-mail para confirmar sua identidade e explicar os próximos passos. Nenhum dado será apagado automaticamente.</p><p>Escritório da Minha Obra</p>`
      });
    } catch {
      // A solicitação principal já foi entregue ao canal de suporte.
    }

    return json(200, { ok: true, requestId });
  } catch (error) {
    return json(400, { error: error.message || 'Não foi possível registrar a solicitação.' });
  }
};
