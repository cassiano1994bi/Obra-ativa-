(() => {
  'use strict';

  const MODAL_ID = 'modal';
  const DIALOG_ID = 'dialog';
  let previouslyFocused = null;
  let fieldSequence = 0;

  function focusableElements(dialog) {
    return [...dialog.querySelectorAll([
      'button:not([disabled]):not([hidden])',
      'a[href]:not([hidden])',
      'input:not([disabled]):not([type="hidden"]):not([hidden])',
      'select:not([disabled]):not([hidden])',
      'textarea:not([disabled]):not([hidden])',
      '[tabindex]:not([tabindex="-1"]):not([hidden])'
    ].join(','))].filter((element) => element.getClientRects().length > 0);
  }

  function associateFieldLabels(dialog) {
    dialog.querySelectorAll('.field > label').forEach((label) => {
      if (label.querySelector('input,select,textarea')) return;
      const control = label.parentElement?.querySelector('input:not([type="hidden"]),select,textarea');
      if (!control) return;
      if (!control.id) control.id = `obraativa-modal-field-${++fieldSequence}`;
      label.htmlFor = control.id;
    });
  }

  function describeDialog(modal, dialog) {
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    dialog.setAttribute('tabindex', '-1');
    const heading = dialog.querySelector('h1,h2,h3');
    if (heading) {
      if (!heading.id) heading.id = 'obraativaModalTitle';
      modal.setAttribute('aria-labelledby', heading.id);
      modal.removeAttribute('aria-label');
    } else {
      modal.removeAttribute('aria-labelledby');
      modal.setAttribute('aria-label', 'Janela de operação');
    }
    associateFieldLabels(dialog);
  }

  function syncModal(modal, dialog) {
    const open = modal.classList.contains('show');
    modal.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (!open) {
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
      previouslyFocused = null;
      return;
    }
    describeDialog(modal, dialog);
    if (!previouslyFocused) previouslyFocused = document.activeElement;
    queueMicrotask(() => {
      if (!modal.classList.contains('show')) return;
      const target = focusableElements(dialog)[0] || dialog;
      if (!dialog.contains(document.activeElement)) target.focus({ preventScroll: true });
    });
  }

  function close(modal) {
    if (typeof window.closeModal === 'function') window.closeModal();
    else modal.classList.remove('show');
  }

  function install() {
    const modal = document.getElementById(MODAL_ID);
    const dialog = document.getElementById(DIALOG_ID);
    if (!modal || !dialog || modal.dataset.accessibilityReady === 'true') return;
    modal.dataset.accessibilityReady = 'true';
    describeDialog(modal, dialog);
    syncModal(modal, dialog);

    new MutationObserver(() => syncModal(modal, dialog)).observe(modal, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true
    });

    document.addEventListener('keydown', (event) => {
      if (!modal.classList.contains('show')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close(modal);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = focusableElements(dialog);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
