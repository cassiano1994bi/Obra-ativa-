import crypto from 'node:crypto';

const json = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) });

function validSignature(rawBody, signature) {
  const secret = process.env.BILLING_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const received = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return received.length === expectedBuffer.length && crypto.timingSafeEqual(received, expectedBuffer);
}

export default async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'Método não permitido.' });
  const rawBody = await request.text();
  if (!validSignature(rawBody, request.headers.get('x-controle-obra-signature'))) return json(401, { error: 'Assinatura inválida.' });

  // A ativação real deve ser concluída somente após o mapeamento assinado do
  // provedor escolhido (Mercado Pago ou Asaas) e o uso da chave de serviço no servidor.
  // Nenhum plano é atualizado por clique do navegador.
  return json(501, { error: 'Cobrança ainda não configurada para este ambiente.' });
};
