(function installAssistantDigitalEmployee(root) {
  'use strict';

  const registry = root.AssistantCapabilityRegistry;
  if (!registry) return;

  const AVATAR = '/public-assets/assistant-avatar-v1.png';
  const state = {
    visual: 'idle',
    signal: null,
    stateTimer: 0,
    shownSignals: new Set(),
    latestInsights: null,
    drag: null,
    suppressClick: false
  };

  function cloud() {
    try { return typeof CloudSync !== 'undefined' ? CloudSync : root.CloudSync; } catch { return root.CloudSync; }
  }

  function workspace() {
    try { return typeof CompanyWorkspace !== 'undefined' ? CompanyWorkspace : root.CompanyWorkspace; } catch { return root.CompanyWorkspace; }
  }

  function currentPage() {
    try { return typeof page !== 'undefined' ? page : ''; } catch { return ''; }
  }

  function authenticated() {
    return Boolean(cloud()?.session?.access_token && workspace()?.current?.id);
  }

  function modalIsOpen() {
    const candidates = [...document.querySelectorAll('#modal.show, dialog[open], [role="dialog"][aria-modal="true"]')];
    return candidates.some((element) => {
      if (element.hidden || element.closest('[hidden]')) return false;
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }

  function canOpenAssistant() {
    try {
      const control = typeof AccessControl !== 'undefined' ? AccessControl : root.AccessControl;
      return typeof control?.canOpen === 'function' ? control.canOpen('assistant') === true : true;
    } catch { return true; }
  }

  function installStyles() {
    if (document.getElementById('assistantDigitalEmployeeStyle')) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="assistantDigitalEmployeeStyle">
      #assistantDigitalEmployee{--assistant-fab-bottom:18px;--assistant-fab-size:78px;position:fixed;right:max(16px,env(safe-area-inset-right));bottom:max(var(--assistant-fab-bottom),calc(env(safe-area-inset-bottom) + 12px));z-index:92;display:block;width:var(--assistant-fab-size);height:var(--assistant-fab-size);pointer-events:none;font-family:inherit;touch-action:none}
      #assistantDigitalEmployee[hidden]{display:none!important}
      .assistant-employee-notice{position:absolute;right:0;bottom:calc(100% + 9px);width:max-content;max-width:min(310px,calc(100vw - 30px));padding:10px 13px;border:1px solid #cfdeec;border-radius:14px 14px 4px 14px;background:#fff;color:#234d65;box-shadow:0 10px 28px #102e4930;font-size:12px;font-weight:750;line-height:1.4;opacity:0;transform:translateY(7px) scale(.98);transform-origin:right bottom;transition:opacity .2s ease,transform .2s ease;pointer-events:auto}
      #assistantDigitalEmployee.is-left .assistant-employee-notice{right:auto;left:0;border-radius:14px 14px 14px 4px;transform-origin:left bottom}
      .assistant-employee-notice.show{opacity:1;transform:none}.assistant-employee-notice.attention{border-color:#f0cf7a;background:#fffaf0}.assistant-employee-notice.alert{border-color:#efb7b7;background:#fff6f6}
      .assistant-employee-button{position:relative;width:100%;height:100%;padding:0;overflow:visible;border:3px solid #fff;border-radius:50%;background:linear-gradient(145deg,#0f65cb,#123f86);box-shadow:0 10px 28px #123c6e55,0 0 0 2px #f4bd2e;cursor:grab;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;isolation:isolate;transition:transform .18s ease,box-shadow .18s ease}
      .assistant-employee-button:hover{transform:translateY(-2px);box-shadow:0 14px 32px #123c6e66,0 0 0 3px #f4bd2e}.assistant-employee-button:focus-visible{outline:4px solid #8dc4ff;outline-offset:4px}
      #assistantDigitalEmployee.is-dragging .assistant-employee-button{cursor:grabbing;transform:none;transition:none}
      .assistant-employee-avatar{position:absolute;inset:2px;width:calc(100% - 4px);height:calc(100% - 4px);object-fit:cover;object-position:center;border-radius:50%;animation:assistantEmployeeBreathe 4.8s ease-in-out infinite;transform-origin:center 72%}
      .assistant-employee-eyelids{position:absolute;z-index:2;left:26%;top:35%;width:48%;height:5%;border-radius:999px;background:linear-gradient(90deg,transparent 0 7%,#4f352e 8% 34%,transparent 35% 65%,#4f352e 66% 92%,transparent 93%);opacity:0;transform:scaleY(.35);pointer-events:none}
      .assistant-employee-button.is-blinking .assistant-employee-eyelids{animation:assistantEmployeeBlink .18s ease-in-out}
      .assistant-employee-status{position:absolute;z-index:3;right:-3px;bottom:2px;width:19px;height:19px;border:3px solid #fff;border-radius:50%;background:#29b779;box-shadow:0 3px 8px #173e6240}
      .assistant-employee-button[data-state="thinking"]{box-shadow:0 10px 28px #123c6e55,0 0 0 3px #55b8ff}.assistant-employee-button[data-state="thinking"] .assistant-employee-avatar{animation:assistantEmployeeThink 1.35s ease-in-out infinite}.assistant-employee-button[data-state="thinking"] .assistant-employee-status{background:#39aaf0;animation:assistantEmployeePulse .85s ease-in-out infinite}
      .assistant-employee-button[data-state="responding"] .assistant-employee-avatar{animation:assistantEmployeeRespond .72s ease-in-out infinite}.assistant-employee-button[data-state="responding"] .assistant-employee-status{background:#f4bd2e;animation:assistantEmployeePulse .72s ease-in-out infinite}
      .assistant-employee-button[data-state="alert"]{box-shadow:0 10px 28px #123c6e55,0 0 0 4px #f4bd2e}.assistant-employee-button[data-state="alert"] .assistant-employee-avatar{animation:assistantEmployeeAlert 1.8s ease-in-out infinite}.assistant-employee-button[data-state="alert"] .assistant-employee-status{background:#f2a620;animation:assistantEmployeePulse .8s ease-in-out infinite}
      @keyframes assistantEmployeeBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.025)}}
      @keyframes assistantEmployeeBlink{0%,100%{opacity:0}35%,65%{opacity:.92}}
      @keyframes assistantEmployeeThink{0%,100%{transform:rotate(0) scale(1.01)}50%{transform:rotate(-2.4deg) scale(1.035)}}
      @keyframes assistantEmployeeRespond{0%,100%{transform:translateY(0) scale(1.01)}50%{transform:translateY(-1.5px) scale(1.035)}}
      @keyframes assistantEmployeeAlert{0%,100%{filter:saturate(1);transform:scale(1)}50%{filter:saturate(1.16);transform:scale(1.035)}}
      @keyframes assistantEmployeePulse{0%,100%{transform:scale(.88)}50%{transform:scale(1.14)}}
      @media(max-width:820px){#assistantDigitalEmployee{--assistant-fab-size:66px;right:max(11px,env(safe-area-inset-right))}.assistant-employee-notice{max-width:min(270px,calc(100vw - 24px));font-size:11px}}
      @media(max-height:500px) and (orientation:landscape){#assistantDigitalEmployee{--assistant-fab-size:58px}.assistant-employee-status{width:16px;height:16px}.assistant-employee-notice{max-width:245px;padding:8px 10px;font-size:10px}}
      @media(prefers-reduced-motion:reduce){.assistant-employee-avatar,.assistant-employee-status,.assistant-employee-eyelids{animation:none!important}.assistant-employee-button,.assistant-employee-notice{transition:none!important}}
    </style>`);
  }

  function hostMarkup() {
    return `<aside id="assistantDigitalEmployee" hidden aria-label="Funcionária digital do aplicativo">
      <div class="assistant-employee-notice" id="assistantEmployeeNotice" role="status" aria-live="polite"></div>
      <button class="assistant-employee-button" id="assistantEmployeeButton" type="button" data-state="idle" aria-label="Abrir conversa com a Assistente da Obra; arraste para mover" title="Assistente da Obra · toque para abrir ou arraste para mover">
        <img class="assistant-employee-avatar" src="${AVATAR}" alt="" width="384" height="384" decoding="async">
        <span class="assistant-employee-eyelids" aria-hidden="true"></span><span class="assistant-employee-status" aria-hidden="true"></span>
      </button>
    </aside>`;
  }

  function ensureHost() {
    installStyles();
    if (!document.getElementById('assistantDigitalEmployee')) document.body.insertAdjacentHTML('beforeend', hostMarkup());
    const button = document.getElementById('assistantEmployeeButton');
    if (button && !button.dataset.ready) {
      button.dataset.ready = 'true';
      button.addEventListener('click', openAssistant);
      button.addEventListener('pointerdown', beginDrag);
    }
    return document.getElementById('assistantDigitalEmployee');
  }

  function updateVisibility() {
    const host = ensureHost();
    if (!host) return;
    host.hidden = !authenticated() || modalIsOpen();
  }

  function clamped(value, minimum, maximum) {
    return Math.min(Math.max(Number(value || 0), minimum), Math.max(minimum, maximum));
  }

  function placeDraggedHost(host, left, top) {
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const margin = 8;
    const width = rect.width || 78;
    const height = rect.height || 78;
    const safeLeft = clamped(left, margin, root.innerWidth - width - margin);
    const safeTop = clamped(top, margin, root.innerHeight - height - margin);
    host.style.left = `${Math.round(safeLeft)}px`;
    host.style.top = `${Math.round(safeTop)}px`;
    host.style.right = 'auto';
    host.style.bottom = 'auto';
    host.dataset.dragged = 'true';
    host.classList.toggle('is-left', safeLeft + width / 2 < root.innerWidth / 2);
  }

  function clampDraggedHost(host) {
    if (!host || host.dataset.dragged !== 'true') return false;
    const left = Number.parseFloat(host.style.left || '0');
    const top = Number.parseFloat(host.style.top || '0');
    placeDraggedHost(host, left, top);
    return true;
  }

  function beginDrag(event) {
    if (event.isPrimary === false || (Number.isFinite(event.button) && event.button !== 0)) return;
    const host = document.getElementById('assistantDigitalEmployee');
    if (!host || host.hidden) return;
    const rect = host.getBoundingClientRect();
    state.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false
    };
    host.classList.add('is-dragging');
    try { event.currentTarget?.setPointerCapture?.(event.pointerId); } catch {}
  }

  function moveDrag(event) {
    const drag = state.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
    drag.moved = true;
    placeDraggedHost(document.getElementById('assistantDigitalEmployee'), event.clientX - drag.offsetX, event.clientY - drag.offsetY);
    event.preventDefault();
  }

  function endDrag(event) {
    const drag = state.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const host = document.getElementById('assistantDigitalEmployee');
    host?.classList.remove('is-dragging');
    try { event.currentTarget?.releasePointerCapture?.(event.pointerId); } catch {}
    state.drag = null;
    if (!drag.moved) return;
    state.suppressClick = true;
    event.preventDefault();
    setTimeout(() => { state.suppressClick = false; }, 0);
  }

  function updateAvoidance() {
    const host = document.getElementById('assistantDigitalEmployee');
    if (!host || host.hidden) return;
    if (clampDraggedHost(host)) return;
    let bottom = 18;
    const obstacles = [...document.querySelectorAll('#app:not(.public-app) .side, .mobile-bottom-nav, [data-mobile-bottom-nav]')];
    obstacles.forEach((element) => {
      const style = getComputedStyle(element), rect = element.getBoundingClientRect();
      if (!['fixed', 'sticky'].includes(style.position) || rect.width < 1 || rect.height < 1) return;
      const reachesRight = rect.right >= root.innerWidth - 120;
      const reachesBottom = rect.bottom >= root.innerHeight - 4;
      if (reachesRight && reachesBottom && rect.top > root.innerHeight * .45) bottom = Math.max(bottom, root.innerHeight - rect.top + 12);
    });
    host.style.setProperty('--assistant-fab-bottom', `${Math.round(bottom)}px`);
  }

  function setVisual(next, options = {}) {
    const allowed = new Set(['idle', 'thinking', 'responding', 'alert']);
    state.visual = allowed.has(next) ? next : 'idle';
    const button = document.getElementById('assistantEmployeeButton');
    if (button) {
      button.dataset.state = state.visual;
      const labels = { idle: 'disponível', thinking: 'analisando', responding: 'respondendo', alert: 'com um alerta para revisar' };
      button.title = `Assistente da Obra · ${labels[state.visual]} · toque para abrir ou arraste para mover`;
    }
    clearTimeout(state.stateTimer);
    if (Number(options.timeout || 0) > 0) state.stateTimer = setTimeout(() => setVisual('idle'), Number(options.timeout));
  }

  function showNotice(signal) {
    const notice = document.getElementById('assistantEmployeeNotice');
    if (!notice || !signal) return;
    notice.textContent = signal.message;
    notice.className = `assistant-employee-notice ${signal.level || 'info'} show`;
    state.signal = signal;
    setVisual(signal.level === 'info' ? 'responding' : 'alert', { timeout: 6500 });
    setTimeout(() => notice.classList.remove('show'), 6200);
  }

  function openAssistant(event) {
    if (state.suppressClick) {
      event?.preventDefault?.();
      return;
    }
    const notice = document.getElementById('assistantEmployeeNotice');
    notice?.classList.remove('show');
    if (!canOpenAssistant()) {
      showNotice({ level: 'alert', message: 'Seu perfil não possui permissão para abrir a Assistente.' });
      return;
    }
    try {
      const navigate = typeof go === 'function' ? go : root.go;
      if (typeof navigate === 'function') navigate('assistant');
      root.AssistantObraPhase4?.switchMode?.('chat');
      setTimeout(() => document.getElementById('assistantQuestion')?.focus(), 80);
      setVisual('responding', { timeout: 900 });
    } catch {
      showNotice({ level: 'alert', message: 'Não foi possível abrir a conversa agora.' });
    }
  }

  function existingReminderSignal() {
    try {
      const read = typeof routineRead === 'function' ? routineRead : root.routineRead;
      const classify = typeof routineState === 'function' ? routineState : root.routineState;
      if (typeof read !== 'function' || typeof classify !== 'function') return null;
      const urgent = read().filter((item) => item?.status !== 'done' && ['late', 'soon'].includes(classify(item)));
      if (!urgent.length) return null;
      return { id: `existing-reminders-${urgent.length}`, level: urgent.some((item) => classify(item) === 'late') ? 'alert' : 'attention', message: urgent.length === 1 ? 'Há 1 lembrete que precisa da sua atenção.' : `Há ${urgent.length} lembretes que precisam da sua atenção.`, route: 'routine' };
    } catch { return null; }
  }

  function decorateExistingAssistant() {
    document.querySelectorAll('.routine-ana img').forEach((image) => {
      if (!image.src.includes('assistant-avatar-v1.png')) image.src = AVATAR;
      image.alt = 'Assistente da Obra, funcionária digital do aplicativo';
    });
    document.querySelectorAll('.routine-ana-label').forEach((label) => {
      const textNode = [...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
      if (textNode && /ANA\s*·\s*ASSISTENTE DE OBRA/i.test(textNode.nodeValue || '')) textNode.nodeValue = 'ASSISTENTE DA OBRA · FUNCIONÁRIA DIGITAL ';
    });
    document.querySelectorAll('.routine-ana-sound').forEach((button) => { button.textContent = button.textContent.replace(' da Ana', ' da Assistente'); });
  }

  async function refreshSignals() {
    if (!authenticated()) return;
    const signals = await registry.collectSignals({ page: currentPage(), authenticated: true });
    const signal = signals.find((item) => !state.shownSignals.has(item.id));
    if (!signal) return;
    state.shownSignals.add(signal.id);
    showNotice(signal);
  }

  registry.register({ id: 'existing-reminders', label: 'Lembretes existentes', category: 'proactive', readOnly: true, requiresApproval: true, collectSignals: existingReminderSignal });
  registry.register({ id: 'automatic-insights', label: 'Alertas automáticos existentes', category: 'proactive', readOnly: true, requiresApproval: true, collectSignals: () => state.latestInsights });
  registry.register({ id: 'conversation-context', label: 'Contexto da conversa existente', category: 'memory', readOnly: true, requiresApproval: true });

  root.addEventListener('assistant-state-change', (event) => setVisual(event.detail?.state || 'idle', { timeout: event.detail?.timeout || 0 }));
  root.addEventListener('assistant-command-result', (event) => setVisual(event.detail?.ok === false ? 'alert' : 'responding', { timeout: event.detail?.ok === false ? 3200 : 1200 }));
  root.addEventListener('obraativa-home-editor-closed', () => {
    // O editor fica fora do app e usa um backdrop oculto; reavalie a bolha
    // imediatamente ao fechar para que ela não permaneça escondida.
    ensureHost();
    updateVisibility();
    updateAvoidance();
  });
  root.addEventListener('pointermove', moveDrag, { passive: false });
  root.addEventListener('pointerup', endDrag);
  root.addEventListener('pointercancel', endDrag);
  root.addEventListener('assistant-insights-updated', (event) => {
    const attention = Number(event.detail?.attention || 0);
    state.latestInsights = attention > 0 ? { id: `automatic-insights-${attention}`, level: 'attention', message: attention === 1 ? 'A Assistente encontrou 1 ponto para você conferir.' : `A Assistente encontrou ${attention} pontos para você conferir.`, route: 'assistant' } : null;
    refreshSignals();
  });
  root.addEventListener('resize', updateAvoidance, { passive: true });

  function blink() {
    const button = document.getElementById('assistantEmployeeButton');
    if (button && !button.closest('[hidden]')) {
      button.classList.remove('is-blinking'); void button.offsetWidth; button.classList.add('is-blinking');
      setTimeout(() => button.classList.remove('is-blinking'), 240);
    }
    setTimeout(blink, 4800 + Math.round(Math.random() * 3200));
  }

  function tick() {
    updateVisibility(); updateAvoidance(); decorateExistingAssistant();
  }

  function boot() {
    ensureHost(); tick(); blink();
    setInterval(tick, 1600);
    setTimeout(refreshSignals, 3200);
    setInterval(refreshSignals, 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();

  root.AssistantDigitalEmployee = Object.freeze({
    open: openAssistant,
    setState: setVisual,
    refreshSignals,
    capabilities: registry,
    avatar: AVATAR,
    version: 2,
    draggable: true,
    sameAssistant: true,
    directDataWrites: false,
    approvalRequiredForChanges: true
  });
})(window);
