(() => {
  'use strict';

  const STATUS_SELECTOR = [
    '.badge', '.internal-work-status', '.labor-cost-tag', '.work-public-state',
    '.lead-status', '.work-closing-status', '.site-manager-status',
    '.co-budget-status', '.co-budget-link-status', '.co-dist-badge',
    '.oa-billing-tag', '.assistant-status-pill', '.assistant-readonly-badge',
    '.assistant-report-preview-badge', '.employee-performance-status',
    '.ws-state', '.access-role-badge', '.presence-status', '.oc-status',
    '.finance-status'
  ].join(',');

  const PROGRESS_SELECTOR = [
    '.obraativa-progress', '.work-progress', '.finance-work-progress',
    '.attendance-progress', '.permission-hub-progress'
  ].join(',');

  const CARD_SELECTOR = [
    '.card', '.internal-work-card', '.obraativa-panel', '.home-insight-panel',
    '.home-weather-card', '.permission-hub-card', '.permission-hub-stat',
    '.finance-executive-summary', '.finance-payment-summary',
    '.finance-payment-center-nav', '.finance-work-card', '.finance-summary-card',
    '.routine-item', '.site-manager-card', '.site-manager-row', '.work-update-card',
    '.work-phase-row', '.work-phase-folder', '.simple-phase-folder',
    '.wc-phase-card', '.ws-summary-card', '.ws-phase-card',
    '.admin-card', '.owner-center-card', '.co-budget-card', '.co-budget-metric',
    '.co-dist-card', '.co-dist-panel'
  ].join(',');

  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const hasAny = (value, words) => words.some(word => value.includes(word));

  function statusTone(element) {
    const text = normalize(element.textContent);
    const context = `${text} ${normalize(element.className)}`;
    if (!text || text.length > 64 || text.length < 2 || element.querySelector('button,a,input,select,textarea')) return null;
    if (hasAny(context, ['nao iniciado', 'nao iniciada', 'nao ativo', 'nao ativa', 'inativo', 'inativa', 'arquivado', 'arquivada', 'cancelado', 'cancelada', 'sem dados', 'sem prazo', 'nao definido', 'nao definida', 'rascunho'])) return ['gray', '—'];
    if (hasAny(context, ['vencido', 'bloqueado', 'recusado', 'rejeitado', 'prejuizo', 'erro', 'critico', 'falha', 'danger', 'negative', 'absent'])) return ['red', '!'];
    if (hasAny(context, ['atrasado', 'vencimento', 'vence em', 'risco', 'pendencia importante'])) return ['orange', '!'];
    if (hasAny(context, ['atencao', 'pendente', 'proximo', 'em acompanhamento', 'warning', 'pending', 'amber'])) return ['yellow', '•'];
    if (hasAny(context, ['concluido', 'concluida', 'aprovado', 'aprovada', 'recebido', 'recebida', 'pago', 'paga', 'ativo', 'ativa', 'no prazo', 'dentro do prazo', 'saudavel', 'liberado', 'liberada', 'pronto para envio', 'ready', 'positive', 'live', 'online'])) return ['green', '✓'];
    if (hasAny(context, ['andamento', 'informacao', 'aguardando', 'normal', 'programado', 'programada', 'em analise'])) return ['blue', 'i'];
    return null;
  }

  function progressTone(element) {
    const context = normalize(element.closest('article,section,.card,.work-phase-row,.finance-work-card')?.textContent || element.parentElement?.textContent);
    if (hasAny(context, ['critico', 'erro', 'bloqueado', 'vencido'])) return 'red';
    if (hasAny(context, ['atrasado', 'risco', 'vencimento'])) return 'orange';
    if (hasAny(context, ['atencao', 'pendente'])) return 'yellow';
    const child = element.firstElementChild;
    const declared = element.getAttribute('aria-valuenow') || element.getAttribute('aria-label') || child?.style.width || child?.style.getPropertyValue('--finance-progress') || getComputedStyle(element).getPropertyValue('--attendance-progress');
    const percent = Number(String(declared || '').match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.'));
    if (Number.isFinite(percent)) {
      if (percent >= 100) return 'green';
      if (percent <= 0) return 'gray';
    }
    return 'blue';
  }

  function annotate(root = document) {
    const app = document.querySelector('#app:not(.public-app)');
    if (!app || document.body.classList.contains('public-mode') || document.body.classList.contains('auth-mode')) return;
    root.querySelectorAll?.(STATUS_SELECTOR).forEach(element => {
      const status = statusTone(element);
      if (!status) return;
      element.classList.add('oa-status-token');
      element.dataset.oaStatusTone = status[0];
      element.dataset.oaStatusIcon = status[1];
    });
    root.querySelectorAll?.(PROGRESS_SELECTOR).forEach(element => {
      element.dataset.oaProgressTone = progressTone(element);
    });
    root.querySelectorAll?.(CARD_SELECTOR).forEach(element => element.classList.add('oa-design-card'));
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      annotate(document.querySelector('#view'));
      annotate(document.querySelector('#dialog'));
    });
  }

  function start() {
    schedule();
    const observer = new MutationObserver(schedule);
    ['view', 'dialog'].forEach(id => {
      const target = document.getElementById(id);
      if (target) observer.observe(target, {childList:true, subtree:true});
    });
    window.ObraAtivaDesignSystem = Object.freeze({version:'1.0.0', refresh:schedule});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
