import AssistantCommandRegistry from '../../../public-assets/assistant-command-registry-v1.js';

const CHANNELS = Object.freeze(['app', 'whatsapp']);

export function planAssistantChannelCommand({ text, channel = 'app' } = {}) {
  const normalizedChannel = String(channel || 'app').trim().toLowerCase();
  if (!CHANNELS.includes(normalizedChannel)) throw new Error('Canal da Assistente não autorizado.');
  const plan = AssistantCommandRegistry.planCommand({ text, channel: normalizedChannel });
  return Object.freeze({
    ...plan,
    executionPolicy: plan.risk === 'write' ? 'preview-and-explicit-confirmation' : plan.kind === 'navigate' ? 'immediate-if-permitted' : 'official-flow-only',
    transportOwnsBusinessLogic: false
  });
}

export const ASSISTANT_COMMAND_CHANNELS = CHANNELS;
