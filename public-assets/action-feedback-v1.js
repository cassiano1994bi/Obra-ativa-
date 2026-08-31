(function installObraAtivaActionFeedback() {
  'use strict';

  const ROOT_ID = 'obraativa-action-feedback';
  const STYLE_ID = 'obraativa-action-feedback-style';
  const VISIBLE_CLASS = 'is-visible';
  const DEFAULT_DURATION = 2600;
  let hideTimer = 0;

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID}{position:fixed;z-index:10050;top:max(18px,env(safe-area-inset-top));left:50%;display:grid;grid-template-columns:38px minmax(0,1fr);align-items:center;gap:10px;width:min(430px,calc(100vw - 28px));padding:11px 14px;border:1px solid #b9e3cc;border-radius:15px;background:#f7fffa;color:#153d2c;box-shadow:0 14px 35px #0828192b;opacity:0;pointer-events:none;transform:translate(-50%,-14px) scale(.97);transition:opacity .18s ease,transform .22s cubic-bezier(.2,.8,.2,1)}
      #${ROOT_ID}.${VISIBLE_CLASS}{opacity:1;transform:translate(-50%,0) scale(1)}
      #${ROOT_ID}[data-kind="delete"]{border-color:#efd0d0;background:#fffafa;color:#653737;box-shadow:0 14px 35px #4a151526}
      #${ROOT_ID} .obraativa-action-feedback-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:#159957;color:#fff;font-size:21px;font-weight:900;box-shadow:0 0 0 5px #daf3e5;transform:scale(.72)}
      #${ROOT_ID}.${VISIBLE_CLASS} .obraativa-action-feedback-icon{animation:obraativa-feedback-icon .35s .08s cubic-bezier(.2,.9,.2,1.25) both}
      #${ROOT_ID}[data-kind="delete"] .obraativa-action-feedback-icon{background:#b75a5a;box-shadow:0 0 0 5px #f7e2e2}
      #${ROOT_ID} .obraativa-action-feedback-copy{min-width:0}
      #${ROOT_ID} strong,#${ROOT_ID} span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #${ROOT_ID} strong{font-size:13px;font-weight:850;letter-spacing:.01em}
      #${ROOT_ID} span{margin-top:2px;color:#587265;font-size:11px;font-weight:600}
      #${ROOT_ID}[data-kind="delete"] span{color:#876767}
      #${ROOT_ID} .obraativa-action-feedback-progress{position:absolute;right:12px;bottom:4px;left:12px;height:2px;overflow:hidden;border-radius:9px;background:#dcebe3}
      #${ROOT_ID} .obraativa-action-feedback-progress::after{display:block;width:100%;height:100%;border-radius:inherit;background:#159957;content:"";transform-origin:left}
      #${ROOT_ID}.${VISIBLE_CLASS} .obraativa-action-feedback-progress::after{animation:obraativa-feedback-progress var(--obraativa-feedback-duration,2600ms) linear forwards}
      #${ROOT_ID}[data-kind="delete"] .obraativa-action-feedback-progress{background:#f2dede}
      #${ROOT_ID}[data-kind="delete"] .obraativa-action-feedback-progress::after{background:#b75a5a}
      @keyframes obraativa-feedback-icon{from{opacity:.25;transform:scale(.72) rotate(-8deg)}to{opacity:1;transform:scale(1) rotate(0)}}
      @keyframes obraativa-feedback-progress{from{transform:scaleX(1)}to{transform:scaleX(0)}}
      @media(max-width:650px){#${ROOT_ID}{top:max(10px,env(safe-area-inset-top));grid-template-columns:34px minmax(0,1fr);gap:9px;width:min(390px,calc(100vw - 20px));padding:9px 12px;border-radius:13px}#${ROOT_ID} .obraativa-action-feedback-icon{width:34px;height:34px;font-size:18px}#${ROOT_ID} strong{font-size:12px}#${ROOT_ID} span{font-size:10px}}
      @media(prefers-reduced-motion:reduce){#${ROOT_ID}{transition:opacity .01ms linear;transform:translate(-50%,0)}#${ROOT_ID}.${VISIBLE_CLASS} .obraativa-action-feedback-icon,#${ROOT_ID}.${VISIBLE_CLASS} .obraativa-action-feedback-progress::after{animation:none}}
    `;
    document.head.appendChild(style);
  }

  function ensureRoot() {
    installStyle();
    let root = document.getElementById(ROOT_ID);
    if (root) return root;
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    root.setAttribute('aria-atomic', 'true');
    root.innerHTML = '<div class="obraativa-action-feedback-icon" aria-hidden="true">✓</div><div class="obraativa-action-feedback-copy"><strong></strong><span></span></div><div class="obraativa-action-feedback-progress" aria-hidden="true"></div>';
    document.body.appendChild(root);
    return root;
  }

  function show(options) {
    const value = options || {};
    const kind = value.kind === 'delete' ? 'delete' : 'save';
    const duration = Math.max(1400, Number(value.duration) || DEFAULT_DURATION);
    const root = ensureRoot();
    const title = kind === 'delete' ? 'Exclusão concluída' : 'Alteração salva';
    root.dataset.kind = kind;
    root.style.setProperty('--obraativa-feedback-duration', `${duration}ms`);
    root.querySelector('strong').textContent = String(value.title || title);
    root.querySelector('span').textContent = String(value.message || (kind === 'delete' ? 'O item foi removido com segurança.' : 'As informações foram atualizadas.'));
    root.classList.remove(VISIBLE_CLASS);
    void root.offsetWidth;
    root.classList.add(VISIBLE_CLASS);
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => root.classList.remove(VISIBLE_CLASS), duration);
    return root;
  }

  function classify(action) {
    const normalized = String(action || '').trim().toLocaleLowerCase('pt-BR');
    if (!normalized) return '';
    if (/(exclu|remov|apag|elimin)/.test(normalized)) return 'delete';
    if (/(salv|cadastr|registr|atualiz|alter|adicion|criad|arquiv|public|marcad|lanç|receb|presen|distribui|configur|permiss|fechamento|assinatura)/.test(normalized)) return 'save';
    return '';
  }

  function fromAction(action, detail) {
    const kind = classify(action);
    if (!kind) return null;
    return window.setTimeout(() => show({ kind, message: String(action || detail || '') }), 0);
  }

  window.ObraAtivaActionFeedback = Object.freeze({
    show,
    success(message, title) { return show({ kind: 'save', message, title }); },
    removed(message, title) { return show({ kind: 'delete', message, title }); },
    fromAction,
    classify
  });
})();
