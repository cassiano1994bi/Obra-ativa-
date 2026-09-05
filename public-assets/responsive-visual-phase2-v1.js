(() => {
  'use strict';

  const STYLE_ID = 'responsiveVisualPhase2V1Style';
  let refreshPending = false;

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="${STYLE_ID}">
      /*
       * Fase 2 — tabelas como cartões em celular/tablet horizontal.
       * Camada estritamente visual: preserva linhas, colunas, textos e ações.
       */
      @media (max-width:1366px) {
        body.responsive-landscape-density #app:not(.public-app) #view .table-wrap.responsive-v3-card-wrap {
          width:100%!important;
          max-width:100%!important;
          overflow:visible!important;
          border:0!important;
          background:transparent!important;
          box-shadow:none!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view .table-wrap.responsive-v3-card-wrap::after {
          display:none!important;
          content:none!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view table.responsive-v3-card-table {
          display:block!important;
          width:100%!important;
          min-width:0!important;
          border:0!important;
          background:transparent!important;
          white-space:normal!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view table.responsive-v3-card-table > thead {
          position:absolute!important;
          width:1px!important;
          height:1px!important;
          margin:-1px!important;
          padding:0!important;
          overflow:hidden!important;
          clip:rect(0 0 0 0)!important;
          border:0!important;
          white-space:nowrap!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view table.responsive-v3-card-table > tbody {
          display:grid!important;
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
          gap:10px!important;
          width:100%!important;
          padding:0!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view table.responsive-v3-card-table > tbody > tr {
          display:grid!important;
          grid-template-columns:minmax(0,1fr)!important;
          gap:0!important;
          width:100%!important;
          min-width:0!important;
          padding:10px 12px!important;
          overflow:hidden!important;
          border:1px solid #dbe5ed!important;
          border-radius:13px!important;
          background:#fff!important;
          box-shadow:0 4px 14px #173a5b0b!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view table.responsive-v3-card-table > tbody > tr[hidden] {
          display:none!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view table.responsive-v3-card-table > tbody > tr:has(>td[colspan]),
        body.responsive-landscape-density #app:not(.public-app) #view table.responsive-v3-card-table > tbody > tr:has(>td.empty) {
          grid-column:1/-1!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view table.responsive-v3-card-table > tbody > tr > td {
          display:flex!important;
          align-items:flex-start!important;
          justify-content:space-between!important;
          gap:12px!important;
          width:100%!important;
          min-width:0!important;
          padding:9px 2px!important;
          border:0!important;
          border-bottom:1px solid #edf1f5!important;
          font-size:11px!important;
          line-height:1.35!important;
          text-align:right!important;
          white-space:normal!important;
          overflow-wrap:anywhere!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view table.responsive-v3-card-table > tbody > tr > td::before,
        body.responsive-v3-device #app:not(.public-app) #view table.responsive-v3-card-table > tbody > tr > td::before {
          content:attr(data-responsive-label)!important;
          flex:0 0 40%!important;
          max-width:40%!important;
          color:#6c7e90!important;
          font-size:11px!important;
          font-weight:850!important;
          line-height:1.25!important;
          letter-spacing:.035em!important;
          text-align:left!important;
          text-transform:uppercase!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view table.responsive-v3-card-table > tbody > tr > td:last-child {
          flex-wrap:wrap!important;
          border-bottom:0!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view table.responsive-v3-card-table > tbody > tr > td[colspan] {
          display:block!important;
          grid-column:1!important;
          padding:0!important;
          border:0!important;
          text-align:left!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view table.responsive-v3-card-table > tbody > tr > td[colspan]::before,
        body.responsive-landscape-density #app:not(.public-app) #view table.responsive-v3-card-table > tbody > tr > td.empty::before {
          display:none!important;
          content:none!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view table.responsive-v3-card-table > tbody > tr > td .btn,
        body.responsive-v3-device #app:not(.public-app) #view table.responsive-v3-card-table > tbody > tr > td .btn {
          flex:1 1 128px!important;
          min-width:0!important;
          min-height:44px!important;
          max-width:100%!important;
          font-size:12px!important;
          white-space:normal!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view table.responsive-v3-card-table > tbody > tr.work-cash-history-row {
          grid-column:1/-1!important;
          padding:0!important;
          overflow:visible!important;
          border:0!important;
          background:transparent!important;
          box-shadow:none!important;
        }
      }

      @media (max-width:760px) {
        body.responsive-landscape-density #app:not(.public-app) #view table.responsive-v3-card-table > tbody {
          grid-template-columns:minmax(0,1fr)!important;
        }
      }
    </style>`);
  }

  function cleanLabel(value, fallback) {
    const label = String(value || '').replace(/\s+/g, ' ').trim();
    return label || fallback;
  }

  function isResponsiveInternalApp() {
    const app = document.getElementById('app');
    if (!app || app.classList.contains('public-app')) return false;
    return document.body.classList.contains('responsive-landscape-density') ||
      document.body.classList.contains('responsive-v3-device');
  }

  function decorateTables(root = document) {
    if (!isResponsiveInternalApp()) return;
    root.querySelectorAll('#view table.table').forEach((table) => {
      const headers = [...table.querySelectorAll('thead tr:first-child th')]
        .map((cell, index, list) => cleanLabel(cell.textContent, index === list.length - 1 ? 'Ações' : `Campo ${index + 1}`));
      if (!headers.length) return;

      table.classList.add('responsive-v3-card-table');
      table.closest('.table-wrap')?.classList.add('responsive-v3-card-wrap');
      table.querySelectorAll('tbody > tr').forEach((row) => {
        [...row.children].filter((cell) => cell.tagName === 'TD').forEach((cell, index) => {
          if (cell.classList.contains('empty') || Number(cell.getAttribute('colspan') || 1) > 1) return;
          cell.dataset.responsiveLabel = headers[index] || (index === headers.length - 1 ? 'Ações' : `Campo ${index + 1}`);
        });
      });
    });
  }

  function refresh() {
    installStyle();
    decorateTables(document);
  }

  function queueRefresh() {
    if (refreshPending) return;
    refreshPending = true;
    requestAnimationFrame(() => {
      refreshPending = false;
      refresh();
    });
  }

  function install() {
    installStyle();
    const view = document.getElementById('view');
    if (!view) {
      setTimeout(install, 120);
      return;
    }
    new MutationObserver(queueRefresh).observe(view, { childList: true, subtree: true });
    new MutationObserver(queueRefresh).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', queueRefresh, { passive: true });
    window.addEventListener('orientationchange', queueRefresh, { passive: true });
    refresh();
  }

  window.ResponsiveVisualPhase2V1 = { refresh: queueRefresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
