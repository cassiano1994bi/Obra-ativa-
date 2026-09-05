(() => {
  'use strict';

  const STYLE_ID = 'mobileUiV2Style';
  const MOBILE_QUERY = '(max-width:760px)';
  let refreshQueued = false;

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="${STYLE_ID}">
      @media(max-width:760px){
        html,body{max-width:100%;overflow-x:hidden}
        body{background:#f2f6fb;-webkit-text-size-adjust:100%;text-size-adjust:100%}
        #app:not(.public-app){display:block;width:100%;min-height:100dvh;padding-bottom:100px;background:#f2f6fb}
        #app:not(.public-app) .main{width:100%;min-width:0;overflow-x:hidden}

        #app:not(.public-app) .top{position:sticky;top:0;z-index:30;display:flex;flex-wrap:wrap;align-items:center;gap:7px;width:100%;height:auto;min-height:58px;padding:8px 12px;background:#fff;border-bottom:1px solid #dce5ef;box-shadow:0 5px 18px #183a5a12}
        #app:not(.public-app) .top-brand{display:grid;flex:1 1 125px;min-width:0;max-width:none}
        #app:not(.public-app) .top-brand span{font-size:9px;line-height:1.1;letter-spacing:.12em}
        #app:not(.public-app) .top-brand strong,
        #app:not(.public-app) #headerPage{max-width:100%;overflow:hidden;color:#132e4f;font-size:15px;line-height:1.2;text-overflow:ellipsis;white-space:nowrap}
        #app:not(.public-app) .top .spacer{display:none}
        #app:not(.public-app) .top .user{display:inline-flex!important;align-items:center;min-height:34px;padding:6px 9px;border:1px solid #cfe7d9;border-radius:999px;background:#f0faf4;color:#1f7350;font-size:11px;font-weight:750;white-space:nowrap}
        #app:not(.public-app) .top .top-settings-button{display:grid;place-items:center;flex:0 0 44px;width:44px;min-height:44px;padding:0;border-radius:12px;font-size:18px}
        #app:not(.public-app) .top .work-select{order:5;flex:1 0 100%;width:100%;min-width:0;min-height:44px;margin:0;padding:8px 10px;border-radius:11px}

        #app:not(.public-app) .content{width:100%;max-width:100%;margin:0;padding:16px 12px calc(116px + env(safe-area-inset-bottom));overflow:visible}
        #app:not(.public-app) .page-title{margin:0;color:#102f50;font-size:24px;line-height:1.16;letter-spacing:-.025em;overflow-wrap:anywhere}
        #app:not(.public-app) .sub{margin:5px 0 16px;color:#61758a;font-size:13px;line-height:1.48;overflow-wrap:anywhere}
        #app:not(.public-app) .section{margin-top:17px}
        #app:not(.public-app) .section h2{color:#173a5c;font-size:18px;line-height:1.25}
        #app:not(.public-app) .section-head{display:grid;grid-template-columns:minmax(0,1fr);align-items:start;gap:10px;width:100%;margin-bottom:13px}
        #app:not(.public-app) .section-head>div{min-width:0}
        #app:not(.public-app) .section-head>div:last-child:not(:first-child){display:flex;flex-wrap:wrap;gap:7px;width:100%}
        #app:not(.public-app) .section-head>div:last-child:not(:first-child)>.btn{flex:1 1 135px;margin:0}

        #app:not(.public-app) .card{min-width:0;padding:14px;border:1px solid #dbe5ed;border-radius:15px;box-shadow:0 5px 16px #173a5b0d}
        #app:not(.public-app) .grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        #app:not(.public-app) .metric{min-height:104px;padding:13px}
        #app:not(.public-app) .metric label{font-size:11px;line-height:1.3}
        #app:not(.public-app) .metric strong{margin-top:7px;font-size:clamp(19px,6vw,24px);line-height:1.15;overflow-wrap:anywhere}
        #app:not(.public-app) .metric small{display:block;margin-top:5px;font-size:11px;line-height:1.35}
        #app:not(.public-app) .two,
        #app:not(.public-app) .form{grid-template-columns:minmax(0,1fr);gap:11px}
        #app:not(.public-app) .form .wide{grid-column:1}

        #app:not(.public-app) .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:10px 13px;border-radius:11px;line-height:1.2;text-align:center;white-space:normal}
        #app:not(.public-app) .btn.sm{min-height:44px;padding:8px 10px;font-size:12px}
        #app:not(.public-app) .toolbar{display:grid;grid-template-columns:minmax(0,1fr);gap:9px;width:100%;margin-bottom:13px;padding:12px;border:1px solid #dbe5ed;border-radius:14px;background:#fff;box-shadow:0 4px 14px #173a5b0b}
        #app:not(.public-app) .toolbar .field{width:100%;min-width:0}
        #app:not(.public-app) .toolbar>.btn{width:100%;margin:0}
        #app:not(.public-app) .field{min-width:0}
        #app:not(.public-app) .field label{font-size:11px;line-height:1.35}
        #app:not(.public-app) .field input,
        #app:not(.public-app) .field select,
        #app:not(.public-app) .field textarea,
        #app:not(.public-app) input,
        #app:not(.public-app) select,
        #app:not(.public-app) textarea{max-width:100%;min-height:44px;font-size:16px}
        #app:not(.public-app) textarea{line-height:1.45}
        #app:not(.public-app) .tabs{display:flex;flex-wrap:nowrap;gap:7px;width:100%;margin:0 -2px 14px;padding:2px;overflow-x:auto;scroll-snap-type:x proximity;scrollbar-width:thin}
        #app:not(.public-app) .tabs button{flex:0 0 auto;min-height:44px;padding:9px 12px;scroll-snap-align:start;white-space:nowrap}

        #app:not(.public-app) .table-wrap{width:100%;max-width:100%;overflow-x:auto;overscroll-behavior-inline:contain;border-radius:14px;-webkit-overflow-scrolling:touch}
        #app:not(.public-app) .table-wrap:not(.mobile-ui-card-wrap) .table{min-width:640px}
        #app:not(.public-app) .table th,
        #app:not(.public-app) .table td{padding:10px 9px}
        #app:not(.public-app) .mobile-ui-card-wrap{overflow:visible;border:0;background:transparent;box-shadow:none}
        #app:not(.public-app) .mobile-ui-card-table{display:block;width:100%;min-width:0!important;border:0;background:transparent;white-space:normal}
        #app:not(.public-app) .mobile-ui-card-table thead{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
        #app:not(.public-app) .mobile-ui-card-table tbody{display:grid;gap:10px;width:100%;padding:0}
        #app:not(.public-app) .mobile-ui-card-table tbody tr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0;width:100%;padding:9px 11px;border:1px solid #dbe5ed;border-radius:14px;background:#fff;box-shadow:0 4px 14px #173a5b0b}
        #app:not(.public-app) .mobile-ui-card-table tbody td{display:flex;align-items:flex-start;justify-content:space-between;gap:9px;min-width:0;padding:8px 4px;border:0;border-bottom:1px solid #edf1f5;color:#1a3653;text-align:right;white-space:normal;overflow-wrap:anywhere}
        #app:not(.public-app) .mobile-ui-card-table tbody td::before{content:attr(data-mobile-label);flex:0 0 auto;max-width:48%;color:#6c7e90;font-size:11px;font-weight:850;line-height:1.3;letter-spacing:.045em;text-align:left;text-transform:uppercase}
        #app:not(.public-app) .mobile-ui-card-table tbody td:nth-last-child(-n+2){border-bottom:0}
        #app:not(.public-app) .mobile-ui-card-table tbody td.num{text-align:right}
        #app:not(.public-app) .mobile-ui-card-table tbody td .btn{flex:1 1 auto;min-width:96px;min-height:46px;padding:9px 10px;line-height:1.2}
        #app:not(.public-app) .mobile-ui-card-table tbody td:last-child{flex-wrap:wrap;justify-content:flex-end;grid-column:1/-1;padding-top:10px}
        #app:not(.public-app) .mobile-ui-card-table tbody td:last-child::before{margin-right:auto}
        #app:not(.public-app) .mobile-ui-card-table tbody td.empty{display:block;grid-column:1/-1;padding:22px 10px;text-align:center;border:0}
        #app:not(.public-app) .mobile-ui-card-table tbody td.empty::before{display:none}

        #app:not(.public-app) .finance-page-organized .finance-clean-table .table-wrap{overflow:visible}
        #app:not(.public-app) .finance-page-organized .finance-clean-table .table{width:100%;min-width:0!important}
        #app:not(.public-app) .finance-page-organized .finance-clean-table .table tbody tr.work-cash-history-row>td{width:100%;max-width:100%}
        #app:not(.public-app) .finance-page-organized .finance-clean-table .table tbody tr.work-cash-history-row[hidden]{display:none!important}
        #app:not(.public-app) .finance-page-organized .finance-work-guide-panel{width:100%;max-width:100%;margin:8px 0;padding:12px}
        #app:not(.public-app) .finance-page-organized .finance-work-guide-metrics,
        #app:not(.public-app) .finance-page-organized .finance-work-guide-meta{grid-template-columns:repeat(2,minmax(0,1fr))!important}

        #app:not(.public-app) .presence{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:0!important;width:100%;max-width:100%;overflow:visible!important;border:0!important;background:transparent!important}
        #app:not(.public-app) .presence .phead{display:none!important}
        #app:not(.public-app) .presence>div:not(.phead){display:block!important;min-width:0;background:#fff}
        #app:not(.public-app) .presence>div:nth-child(5n+1):not(.phead){position:static!important;grid-column:1/-1;margin-top:10px;padding:13px 12px 8px;border:1px solid #dbe5ed;border-bottom:0;border-radius:14px 14px 0 0;box-shadow:0 4px 14px #173a5b0b}
        #app:not(.public-app) .presence>div:nth-child(5n+2):not(.phead),
        #app:not(.public-app) .presence>div:nth-child(5n+3):not(.phead),
        #app:not(.public-app) .presence>div:nth-child(5n+4):not(.phead),
        #app:not(.public-app) .presence>div:nth-child(5n):not(.phead){padding:4px 6px}
        #app:not(.public-app) .presence>div:nth-child(5n+2):not(.phead),
        #app:not(.public-app) .presence>div:nth-child(5n+4):not(.phead){border-left:1px solid #dbe5ed}
        #app:not(.public-app) .presence>div:nth-child(5n+3):not(.phead),
        #app:not(.public-app) .presence>div:nth-child(5n):not(.phead){border-right:1px solid #dbe5ed}
        #app:not(.public-app) .presence>div:nth-child(5n+4):not(.phead),
        #app:not(.public-app) .presence>div:nth-child(5n):not(.phead){padding-bottom:7px;border-bottom:1px solid #dbe5ed}
        #app:not(.public-app) .presence>div:nth-child(5n+4):not(.phead){border-radius:0 0 0 14px}
        #app:not(.public-app) .presence>div:nth-child(5n):not(.phead){border-radius:0 0 14px 0}
        #app:not(.public-app) .presence .pchoice{width:100%;min-height:48px;padding:8px 5px;border-radius:10px;font-size:12px;white-space:normal}
        #app:not(.public-app) .presence>div:nth-child(5n+1):not(.phead) .btn{width:100%;margin-top:8px!important}

        body.mobile-ui-v2-active .modal{align-items:flex-end;padding:8px 8px 0;background:#071a2d99}
        body.mobile-ui-v2-active .dialog{width:100%;max-width:100%;max-height:calc(100dvh - 12px);padding:18px 14px calc(18px + env(safe-area-inset-bottom));border-radius:22px 22px 0 0;overflow-x:hidden;overscroll-behavior:contain}
        body.mobile-ui-v2-active .dialog h2{padding-right:4px;font-size:22px;line-height:1.2;overflow-wrap:anywhere}
        body.mobile-ui-v2-active .dialog footer{position:sticky;bottom:calc(-18px - env(safe-area-inset-bottom));z-index:2;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:18px 0 calc(-18px - env(safe-area-inset-bottom));padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid #e1e7ed;box-shadow:0 -8px 20px #132f4c12}
        body.mobile-ui-v2-active .dialog footer .btn{width:100%;margin:0}

        #app:not(.public-app) .notice,
        #app:not(.public-app) .alert{font-size:12px;line-height:1.48;overflow-wrap:anywhere}
        #app:not(.public-app) .client-card,
        #app:not(.public-app) .visit-card{min-width:0;overflow:hidden}
        #app:not(.public-app) .client-filters{grid-template-columns:1fr}
        #app:not(.public-app) .chatbar{align-items:stretch;flex-direction:column}
        #app:not(.public-app) .chatbar .btn{width:100%}

        #app:not(.public-app) .side{position:fixed!important;inset:auto 0 0!important;z-index:50!important;width:100%!important;height:auto!important;padding:0 8px calc(7px + env(safe-area-inset-bottom))!important;background:transparent!important;pointer-events:none}
        #app:not(.public-app) .side .brand{display:none!important}
        #app:not(.public-app) .side .nav{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:2px!important;width:min(560px,100%)!important;min-height:70px!important;margin:0 auto!important;padding:6px 5px!important;overflow:visible!important;border:1px solid #dce5ef!important;border-radius:22px!important;background:#fff!important;box-shadow:0 12px 35px #0c284437!important;pointer-events:auto}
        #app:not(.public-app) .side .nav>button{display:flex!important;align-items:center!important;justify-content:center!important;flex-direction:column!important;gap:2px!important;min-width:0!important;min-height:56px!important;padding:6px 2px!important;border:0!important;border-radius:17px!important;background:transparent!important;color:#52606f!important;font-size:11px!important;line-height:1.1!important;box-shadow:none!important}
        #app:not(.public-app) .side .nav>button[data-nav-key="planning"]{display:none!important}
        #app:not(.public-app) .side .nav>button.active,
        #app:not(.public-app) .side .nav>button.nav-more.open{background:#e7f0ff!important;color:#1769d5!important}
        #app:not(.public-app) .side .nav .mobile-nav-icon{font-size:20px!important}
        #app:not(.public-app) .side .nav .mobile-nav-label{max-width:100%;overflow:hidden;font-size:11px!important;text-overflow:ellipsis;white-space:nowrap!important}
        #app:not(.public-app) .side .nav .nav-extra-scroll{position:fixed!important;inset:0 0 calc(84px + env(safe-area-inset-bottom))!important;z-index:1!important;display:block!important;width:100%!important;max-height:none!important;padding:18px 13px 28px!important;overflow-y:auto!important;overflow-x:hidden!important;background:#f3f6fa!important;border:0!important;border-radius:0!important;box-shadow:none!important}
        #app:not(.public-app) .side .nav .mobile-more-header{top:-18px!important;margin:-18px -13px 15px!important;padding:17px 15px 13px!important;background:#f3f6fa!important}
        #app:not(.public-app) .side .nav .mobile-more-group{margin-bottom:12px!important;border-radius:15px!important}
        #app:not(.public-app) .side .nav .mobile-more-group button{min-height:54px!important;padding:11px 14px!important;font-size:14px!important}
      }

      @media(max-width:430px){
        #app:not(.public-app) .content{padding-left:10px;padding-right:10px}
        #app:not(.public-app) .grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        #app:not(.public-app) .metric{min-height:102px;padding:12px}
        #app:not(.public-app) .metric strong{font-size:clamp(17px,5.5vw,21px)}
        #app:not(.public-app) .finance-page-organized .finance-clean-metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        #app:not(.public-app) .mobile-ui-card-table tbody tr{grid-template-columns:minmax(0,1fr)}
        #app:not(.public-app) .mobile-ui-card-table tbody td,
        #app:not(.public-app) .mobile-ui-card-table tbody td:nth-last-child(-n+2){border-bottom:1px solid #edf1f5}
        #app:not(.public-app) .mobile-ui-card-table tbody td:last-child{grid-column:1;border-bottom:0}
        #app:not(.public-app) .top .user{font-size:11px;padding:6px 8px}
        #app:not(.public-app) .side{padding-left:5px!important;padding-right:5px!important}
        #app:not(.public-app) .side .nav{border-radius:20px!important}
        #app:not(.public-app) .side .nav .mobile-nav-label{font-size:10px!important}
      }
    </style>`);
  }

  function cleanLabel(value, fallback) {
    const label = String(value || '').replace(/\s+/g, ' ').trim();
    return label || fallback;
  }

  function decorateTables(root = document) {
    if (!window.matchMedia(MOBILE_QUERY).matches) return;
    const app = document.getElementById('app');
    if (!app || app.classList.contains('public-app')) return;

    root.querySelectorAll('#view table.table').forEach((table) => {
      if (table.closest('.finance-page-organized') || table.closest('.finance-payment-center') || table.closest('.co-dist-table-wrap')) return;
      const headers = [...table.querySelectorAll('thead tr:first-child th')].map((cell, index, list) => cleanLabel(cell.textContent, index === list.length - 1 ? 'Ações' : `Campo ${index + 1}`));
      if (!headers.length) return;
      const rows = [...table.querySelectorAll('tbody > tr')];
      const simple = rows.every((row) => {
        if (row.classList.contains('work-cash-history-row')) return false;
        const cells = [...row.children].filter((cell) => cell.tagName === 'TD');
        return cells.length === headers.length || (cells.length === 1 && Number(cells[0].getAttribute('colspan') || 1) >= headers.length);
      });
      if (!simple) {
        table.classList.add('mobile-ui-scroll-table');
        return;
      }
      table.classList.add('mobile-ui-card-table');
      table.closest('.table-wrap')?.classList.add('mobile-ui-card-wrap');
      rows.forEach((row) => {
        [...row.children].filter((cell) => cell.tagName === 'TD').forEach((cell, index) => {
          if (cell.classList.contains('empty') || Number(cell.getAttribute('colspan') || 1) > 1) return;
          cell.dataset.mobileLabel = headers[index] || (index === headers.length - 1 ? 'Ações' : `Campo ${index + 1}`);
        });
      });
    });
  }

  function normalizeVisiblePage() {
    installStyle();
    const app = document.getElementById('app');
    if (!app || app.classList.contains('public-app')) {
      document.body.classList.remove('mobile-ui-v2-active');
      return;
    }
    document.body.classList.add('mobile-ui-v2-active');
    app.classList.add('mobile-ui-v2-ready');
    decorateTables(document);
  }

  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      normalizeVisiblePage();
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
    window.matchMedia(MOBILE_QUERY).addEventListener?.('change', queueRefresh);
    window.addEventListener('orientationchange', queueRefresh, { passive: true });
    normalizeVisiblePage();
  }

  window.MobileUIV2 = { refresh: queueRefresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
