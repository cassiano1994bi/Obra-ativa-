(function installAssistantCommandBus(root) {
  'use strict';
  const registry = root.AssistantCommandRegistry;
  if (!registry) return;
  const capabilityRegistry = root.AssistantCapabilityRegistry;

  if (typeof capabilityRegistry?.register === 'function') {
    capabilityRegistry.register({ id: 'safe-navigation-commands', label: 'Navegação por conversa', category: 'actions', readOnly: true, requiresApproval: false });
    capabilityRegistry.register({ id: 'official-form-commands', label: 'Abertura de formulários oficiais', category: 'actions', readOnly: true, requiresApproval: false });
    capabilityRegistry.register({ id: 'confirmed-action-workflows', label: 'Ações com prévia e confirmação', category: 'actions', readOnly: false, requiresApproval: true });
  }

  function accessControl() { return root.AccessControl || (typeof AccessControl !== 'undefined' ? AccessControl : null); }
  function canOpen(route) {
    const control = accessControl();
    return typeof control?.canOpen === 'function' ? control.canOpen(route) === true : true;
  }
  function navigate(route) {
    if (!canOpen(route)) return { ok: false, message: 'Seu perfil não possui permissão para abrir essa área.' };
    if (typeof root.go !== 'function') return { ok: false, message: 'A navegação do aplicativo não está disponível agora.' };
    const result = root.go(route);
    if (result === false) return { ok: false, message: 'Seu perfil não possui permissão para abrir essa área.' };
    return { ok: true };
  }
  function emit(result) {
    try { root.dispatchEvent(new CustomEvent('assistant-command-result', { detail: result })); } catch {}
    return Object.freeze(result);
  }
  function openForm(plan) {
    const definition = registry.FORM_ACTIONS[plan.action];
    if (!definition) return emit({ ...plan, ok: false, kind: 'error', message: 'Esse formulário não está autorizado para a Assistente.' });
    const navigation = navigate(definition.route);
    if (!navigation.ok) return emit({ ...plan, ok: false, kind: 'error', message: navigation.message });
    const handler = root[definition.handler];
    if (typeof handler !== 'function') return emit({ ...plan, ok: false, kind: 'error', message: 'A função oficial desse formulário não está disponível.' });
    setTimeout(() => handler(...definition.args), 0);
    return emit({ ...plan, ok: true, message: `${definition.label} aberto pelo formulário oficial.` });
  }
  async function openWorkflow(plan) {
    const navigation = navigate('assistant');
    if (!navigation.ok) return emit({ ...plan, ok: false, kind: 'error', message: navigation.message });
    const actions = root.AssistantObraPhase6;
    if (typeof actions?.startCommand !== 'function') return emit({ ...plan, ok: false, kind: 'error', message: 'A área segura de ações ainda não está disponível.' });
    const result = await actions.startCommand(plan.action, { ...plan.args, originalRequest: plan.originalText });
    return emit({ ...plan, ok: result?.ok === true, kind: result?.ok === true ? plan.kind : 'error', message: result?.message || '' });
  }
  async function dispatch(input = {}) {
    const plan = registry.planCommand(input);
    if (!plan.handled) return emit({ ...plan, ok: false });
    if (plan.kind === 'unavailable') return emit({ ...plan, ok: false });
    if (plan.channel !== 'app') return emit({ ...plan, ok: true, execution: 'delegated-to-channel-adapter' });
    if (plan.kind === 'navigate') {
      const result = navigate(plan.route);
      return emit({ ...plan, ok: result.ok, kind: result.ok ? plan.kind : 'error', message: result.message || `${registry.ROUTES[plan.route]?.label || 'Área'} aberta.` });
    }
    if (plan.kind === 'open_form') return openForm(plan);
    if (plan.kind === 'workflow') return openWorkflow(plan);
    return emit({ ...plan, ok: false });
  }

  root.AssistantCommandBus = Object.freeze({ dispatch, plan: registry.planCommand, registry, version: 1, directDataWrites: false, confirmationPreserved: true });
})(window);
