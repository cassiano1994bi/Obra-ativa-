export class AssistantProviderDisabledError extends Error {
  constructor(message = 'O provedor de IA permanece desligado durante a Fase 1.') {
    super(message);
    this.name = 'AssistantProviderDisabledError';
    this.code = 'PROVIDER_DISABLED_PHASE_ONE';
  }
}

export function providerDescriptor(env = process.env) {
  const provider = String(env.ASSISTANT_AI_PROVIDER || 'not-configured').trim().toLowerCase();
  const model = String(env.ASSISTANT_AI_MODEL || '').trim();
  const endpoint = String(env.ASSISTANT_AI_ENDPOINT || (provider === 'openai-responses' ? 'https://api.openai.com/v1/responses' : '')).trim();
  const hasEndpoint = Boolean(endpoint);
  const hasSecret = Boolean(String(env.ASSISTANT_AI_API_KEY || env.OPENAI_API_KEY || '').trim());
  return Object.freeze({
    provider,
    model,
    configured: Boolean(provider !== 'not-configured' && model && hasEndpoint && hasSecret),
    phaseOneActive: true
  });
}

const OPENAI_RESPONSE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['answer', 'confidence', 'missingData', 'warnings'],
  properties: {
    answer: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    missingData: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } }
  }
});

function openAIOutputText(body) {
  if (typeof body?.output_text === 'string') return body.output_text;
  if (!Array.isArray(body?.output)) return '';
  return body.output
    .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
    .filter((item) => item?.type === 'output_text' && typeof item?.text === 'string')
    .map((item) => item.text)
    .join('');
}

function parseStructuredBody(body) {
  if (body?.response && typeof body.response === 'object') return body.response;
  if (body?.result && typeof body.result === 'object') return body.result;
  let content = openAIOutputText(body) || body?.response || body?.result || body?.choices?.[0]?.message?.content || '';
  if (Array.isArray(content)) content = content.map((item) => item?.text || item?.content || '').join('');
  if (content && typeof content === 'object') return content;
  const cleaned = String(content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  if (!cleaned) throw new Error('O provedor não retornou uma resposta estruturada.');
  return JSON.parse(cleaned);
}

export function createAssistantProvider({ env = process.env, fetchImpl = fetch, phase = 1 } = {}) {
  const descriptor = providerDescriptor(env);
  return Object.freeze({
    descriptor,
    async generateStructured({ system, question, evidence, history = [] } = {}) {
      if (phase < 2) throw new AssistantProviderDisabledError();
      if (!descriptor.configured) throw new AssistantProviderDisabledError('O provedor de IA ainda não está configurado no servidor.');
      if (!['json-http', 'openai-compatible', 'openai-responses'].includes(descriptor.provider)) {
        throw new Error(`Provedor não suportado: ${descriptor.provider}.`);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      try {
        const messages = [
          { role: 'system', content: String(system || '') },
          ...history.slice(-12).map((item) => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: String(item.content || '').slice(0, 1200) })),
          { role: 'user', content: JSON.stringify({ question: String(question || '').slice(0, 600), evidence }) }
        ];
        const body = descriptor.provider === 'openai-responses'
          ? {
              model: descriptor.model,
              instructions: String(system || ''),
              input: [{
                role: 'user',
                content: [{
                  type: 'input_text',
                  text: JSON.stringify({
                    question: String(question || '').slice(0, 600),
                    history: history.slice(-12).map((item) => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: String(item.content || '').slice(0, 1200) })),
                    evidence
                  })
                }]
              }],
              text: {
                format: {
                  type: 'json_schema',
                  name: 'assistant_obras_response',
                  strict: true,
                  schema: OPENAI_RESPONSE_SCHEMA
                }
              },
              reasoning: { effort: 'low' },
              max_output_tokens: 1200,
              store: false
            }
          : descriptor.provider === 'openai-compatible'
            ? { model: descriptor.model, messages, temperature: 0.1, response_format: { type: 'json_object' } }
            : { model: descriptor.model, system: String(system || ''), question: String(question || '').slice(0, 600), history: messages.slice(1, -1), evidence, responseSchemaVersion: 1 };
        const endpoint = String(env.ASSISTANT_AI_ENDPOINT || (descriptor.provider === 'openai-responses' ? 'https://api.openai.com/v1/responses' : ''));
        const apiKey = String(env.ASSISTANT_AI_API_KEY || env.OPENAI_API_KEY || '');
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
            accept: 'application/json'
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });
        const raw = await response.text();
        let parsed = null;
        try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = null; }
        if (!response.ok) throw new Error('O provedor de IA está temporariamente indisponível.');
        return parseStructuredBody(parsed);
      } finally {
        clearTimeout(timeout);
      }
    }
  });
}
