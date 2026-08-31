(function installAssistantCapabilityRegistry(root) {
  'use strict';

  const plugins = new Map();

  function cleanId(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function publicDescriptor(plugin) {
    return Object.freeze({
      id: plugin.id,
      label: plugin.label,
      version: plugin.version,
      category: plugin.category,
      readOnly: plugin.readOnly,
      requiresApproval: plugin.requiresApproval
    });
  }

  function register(definition = {}) {
    const id = cleanId(definition.id);
    if (!id) throw new Error('Toda capacidade da Assistente precisa de um identificador.');
    if (plugins.has(id)) return publicDescriptor(plugins.get(id));
    const plugin = Object.freeze({
      id,
      label: String(definition.label || id),
      version: Number(definition.version || 1),
      category: String(definition.category || 'general'),
      readOnly: definition.readOnly !== false,
      requiresApproval: definition.requiresApproval !== false,
      collectSignals: typeof definition.collectSignals === 'function' ? definition.collectSignals : null,
      onEvent: typeof definition.onEvent === 'function' ? definition.onEvent : null
    });
    plugins.set(id, plugin);
    return publicDescriptor(plugin);
  }

  function list() {
    return Object.freeze([...plugins.values()].map(publicDescriptor));
  }

  async function collectSignals(context = {}) {
    const signals = [];
    for (const plugin of plugins.values()) {
      if (!plugin.collectSignals) continue;
      try {
        const result = await plugin.collectSignals(Object.freeze({ ...context }));
        const items = Array.isArray(result) ? result : result ? [result] : [];
        items.forEach((item, index) => {
          if (!item || !String(item.message || '').trim()) return;
          signals.push(Object.freeze({
            id: String(item.id || `${plugin.id}-${index}`),
            pluginId: plugin.id,
            level: ['info', 'attention', 'alert'].includes(item.level) ? item.level : 'info',
            message: String(item.message).trim(),
            route: String(item.route || 'assistant')
          }));
        });
      } catch (error) {
        try { root.dispatchEvent(new CustomEvent('assistant-capability-error', { detail: { pluginId: plugin.id, message: String(error?.message || 'Falha isolada na capacidade.') } })); } catch {}
      }
    }
    const weight = { alert: 3, attention: 2, info: 1 };
    return Object.freeze(signals.sort((a, b) => (weight[b.level] || 0) - (weight[a.level] || 0)));
  }

  function emit(name, detail = {}) {
    for (const plugin of plugins.values()) {
      if (!plugin.onEvent) continue;
      try { plugin.onEvent(String(name || ''), Object.freeze({ ...detail })); } catch {}
    }
  }

  root.AssistantCapabilityRegistry = Object.freeze({
    register,
    list,
    collectSignals,
    emit,
    version: 1,
    modular: true,
    directDataWrites: false,
    approvalRequiredForChanges: true
  });
})(window);
