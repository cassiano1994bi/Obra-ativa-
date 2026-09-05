(() => {
  'use strict';

  const STYLE_ID = 'responsiveUiV3Style';
  const PHONE_QUERY = '(max-width:600px)';
  const LANDSCAPE_PHONE_QUERY = '(orientation:landscape) and (max-height:600px) and (max-width:1024px)';
  const TABLET_QUERY = '(min-width:601px) and (max-width:1024px)';
  const LARGE_TOUCH_TABLET_QUERY = '(min-width:1025px) and (max-width:1366px) and (orientation:landscape) and (hover:none) and (pointer:coarse)';
  let refreshPending = false;

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="${STYLE_ID}">
      /* Camada adaptativa isolada. Acima de 1024px, alcança apenas tablets grandes com toque. */
      @media(max-width:1024px), (min-width:1025px) and (max-width:1366px) and (orientation:landscape) and (hover:none) and (pointer:coarse){
        html,body{max-width:100%;overflow-x:hidden}
        body{background:#f2f6fb;-webkit-text-size-adjust:100%;text-size-adjust:100%}
        #app:not(.public-app),
        #app:not(.public-app) .main,
        #app:not(.public-app) .content,
        #app:not(.public-app) #view{min-width:0;max-width:100%}
        #app:not(.public-app) img,
        #app:not(.public-app) video,
        #app:not(.public-app) canvas,
        #app:not(.public-app) svg{max-width:100%;height:auto}
        #app:not(.public-app) .card,
        #app:not(.public-app) .section,
        #app:not(.public-app) .notice,
        #app:not(.public-app) .alert,
        #app:not(.public-app) .toolbar,
        #app:not(.public-app) .table-wrap{min-width:0;max-width:100%}
        #app:not(.public-app) .page-title,
        #app:not(.public-app) h1,
        #app:not(.public-app) h2,
        #app:not(.public-app) h3,
        #app:not(.public-app) p,
        #app:not(.public-app) small,
        #app:not(.public-app) b,
        #app:not(.public-app) strong{overflow-wrap:anywhere}
        #app:not(.public-app) input,
        #app:not(.public-app) select,
        #app:not(.public-app) textarea{max-width:100%;font-size:16px}
        #app:not(.public-app) .btn,
        #app:not(.public-app) button,
        body.responsive-v3-device .dialog .btn{touch-action:manipulation}
        #app:not(.public-app) .btn,
        #app:not(.public-app) button{min-height:44px!important}
        body.responsive-v3-device .modal{max-width:100%;overflow:hidden}
        body.responsive-v3-device .dialog{max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);overflow:auto;overscroll-behavior:contain}
        #app:not(.public-app) .permission-hub-info{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      }

      /* Celulares: uma coluna, navegação simplificada e nenhum conteúdo fora da tela. */
      @media(max-width:600px){
        #app:not(.public-app){display:block!important;width:100%!important;min-height:100dvh;padding-bottom:calc(92px + env(safe-area-inset-bottom))!important;background:#f2f6fb}
        #app:not(.public-app) .main{display:block!important;width:100%!important;overflow-x:hidden!important}
        #app:not(.public-app) .content{width:100%!important;margin:0!important;padding:14px 10px calc(112px + env(safe-area-inset-bottom))!important;overflow:visible!important}

        #app:not(.public-app) .top{position:sticky!important;top:0!important;z-index:30!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:7px!important;width:100%!important;height:auto!important;min-height:58px!important;padding:8px 10px!important;overflow:visible!important;background:#fff!important;border-bottom:1px solid #dce5ef!important;box-shadow:0 5px 18px #183a5a12!important}
        #app:not(.public-app) .top-brand{display:grid!important;min-width:0!important;max-width:none!important}
        #app:not(.public-app) .top-brand span{font-size:9px!important;line-height:1.1!important;letter-spacing:.12em!important}
        #app:not(.public-app) .top-brand strong,
        #app:not(.public-app) #headerPage{max-width:100%!important;overflow:hidden!important;font-size:15px!important;line-height:1.2!important;text-overflow:ellipsis!important;white-space:nowrap!important}
        #app:not(.public-app) .top .spacer{display:none!important}
        #app:not(.public-app) .top .user{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:38px!important;padding:6px 9px!important;font-size:11px!important;white-space:nowrap!important}
        #app:not(.public-app) .top .top-settings-button{display:grid!important;place-items:center!important;width:44px!important;min-width:44px!important;min-height:44px!important;padding:0!important}
        #app:not(.public-app) .top .work-select{grid-column:1/-1!important;order:10!important;width:100%!important;min-height:46px!important;margin:0!important}

        #app:not(.public-app) .page-title{font-size:clamp(23px,7vw,29px)!important;line-height:1.15!important}
        #app:not(.public-app) .sub{margin:5px 0 15px!important;font-size:13px!important;line-height:1.5!important}
        #app:not(.public-app) .section{margin-top:16px!important}
        #app:not(.public-app) .section-head,
        #app:not(.public-app) .finance-section-head,
        #app:not(.public-app) .home-section-head,
        #app:not(.public-app) .site-manager-section-head,
        #app:not(.public-app) .work-closing-head,
        #app:not(.public-app) .finance-payment-summary-head{display:grid!important;grid-template-columns:minmax(0,1fr)!important;align-items:start!important;gap:10px!important;width:100%!important}
        #app:not(.public-app) .section-head>div,
        #app:not(.public-app) .finance-section-head>div{min-width:0!important;max-width:100%!important}
        #app:not(.public-app) .section-head>div:last-child:not(:first-child),
        #app:not(.public-app) .hero-actions,
        #app:not(.public-app) .form-actions,
        #app:not(.public-app) .routine-actions,
        #app:not(.public-app) .work-phase-actions,
        #app:not(.public-app) .site-manager-actions,
        #app:not(.public-app) .finance-work-actions,
        #app:not(.public-app) .finance-value-edit-actions{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:8px!important;width:100%!important}
        #app:not(.public-app) .section-head>div:last-child:not(:first-child)>.btn,
        #app:not(.public-app) .hero-actions>.btn,
        #app:not(.public-app) .form-actions>.btn,
        #app:not(.public-app) .routine-actions>.btn,
        #app:not(.public-app) .work-phase-actions>.btn,
        #app:not(.public-app) .finance-work-actions>.btn{width:100%!important;margin:0!important}

        #app:not(.public-app) .grid,
        #app:not(.public-app) .two,
        #app:not(.public-app) .form,
        #app:not(.public-app) .compact-fields,
        #app:not(.public-app) .home-metrics,
        #app:not(.public-app) .home-shortcuts,
        #app:not(.public-app) .home-operation,
        #app:not(.public-app) .finance-summary-grid,
        #app:not(.public-app) .finance-expense-grid,
        #app:not(.public-app) .finance-work-grid,
        #app:not(.public-app) .finance-work-amounts,
        #app:not(.public-app) .finance-history-metrics,
        #app:not(.public-app) .finance-clean-metrics,
        #app:not(.public-app) .finance-payment-summary-grid,
        #app:not(.public-app) .work-closing-metrics,
        #app:not(.public-app) .work-closing-summary,
        #app:not(.public-app) .attendance-ranking-filters,
        #app:not(.public-app) .attendance-ranking-summary,
        #app:not(.public-app) .site-manager-grid,
        #app:not(.public-app) .site-manager-preview,
        #app:not(.public-app) .client-detail-grid,
        #app:not(.public-app) .my-site-choice-grid,
        #app:not(.public-app) .my-site-work-grid,
        #app:not(.public-app) .my-site-style-options,
        #app:not(.public-app) .work-action-grid{grid-template-columns:minmax(0,1fr)!important;gap:10px!important}
        #app:not(.public-app) .form .wide,
        #app:not(.public-app) .compact-fields .wide{grid-column:1!important}
        #app:not(.public-app) .card{width:100%!important;padding:14px!important;border-radius:15px!important}
        #app:not(.public-app) .metric{min-height:auto!important;padding:14px!important}
        #app:not(.public-app) .metric strong{font-size:clamp(20px,7vw,26px)!important}
        #app:not(.public-app) .home-welcome,
        #app:not(.public-app) .finance-hero,
        #app:not(.public-app) .my-site-hero,
        #app:not(.public-app) .site-management-hero{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:12px!important;padding:17px!important}
        #app:not(.public-app) .home-next-pay,
        #app:not(.public-app) .finance-hero-balance{min-width:0!important;width:100%!important}

        #app:not(.public-app) .toolbar{display:grid!important;grid-template-columns:minmax(0,1fr)!important;align-items:stretch!important;gap:9px!important;width:100%!important;margin-bottom:13px!important;padding:12px!important}
        #app:not(.public-app) .toolbar .field,
        #app:not(.public-app) .toolbar>.btn,
        #app:not(.public-app) .toolbar>.check-line{width:100%!important;margin:0!important}
        #app:not(.public-app) .field{min-width:0!important;width:100%!important}
        #app:not(.public-app) .field input,
        #app:not(.public-app) .field select,
        #app:not(.public-app) .field textarea,
        #app:not(.public-app) input,
        #app:not(.public-app) select,
        #app:not(.public-app) textarea{width:100%!important;min-height:46px!important}
        #app:not(.public-app) .btn{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:46px!important;padding:10px 13px!important;border-radius:11px!important;line-height:1.2!important;white-space:normal!important}
        #app:not(.public-app) .btn.sm{min-height:44px!important;padding:8px 10px!important}
        #app:not(.public-app) .tabs,
        #app:not(.public-app) .site-management-tabs,
        #app:not(.public-app) .finance-payment-center-tabs{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important;width:100%!important;margin:0 0 14px!important;padding:0!important;overflow:visible!important}
        #app:not(.public-app) .tabs button,
        #app:not(.public-app) .site-management-tabs button,
        #app:not(.public-app) .finance-payment-center-tab{width:100%!important;min-width:0!important;min-height:46px!important;white-space:normal!important}

        #app:not(.public-app) .table-wrap.responsive-v3-card-wrap,
        #app:not(.public-app) .table-wrap.mobile-ui-card-wrap{overflow:visible!important;border:0!important;background:transparent!important;box-shadow:none!important}
        #app:not(.public-app) table.responsive-v3-card-table,
        #app:not(.public-app) table.mobile-ui-card-table{display:block!important;width:100%!important;min-width:0!important;border:0!important;background:transparent!important;white-space:normal!important}
        #app:not(.public-app) table.responsive-v3-card-table thead,
        #app:not(.public-app) table.mobile-ui-card-table thead{position:absolute!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;border:0!important;white-space:nowrap!important}
        #app:not(.public-app) table.responsive-v3-card-table tbody,
        #app:not(.public-app) table.mobile-ui-card-table tbody{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:10px!important;width:100%!important;padding:0!important}
        #app:not(.public-app) table.responsive-v3-card-table tbody tr,
        #app:not(.public-app) table.mobile-ui-card-table tbody tr{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:0!important;width:100%!important;padding:9px 11px!important;border:1px solid #dbe5ed!important;border-radius:14px!important;background:#fff!important;box-shadow:0 4px 14px #173a5b0b!important}
        #app:not(.public-app) table.responsive-v3-card-table tbody tr[hidden],
        #app:not(.public-app) table.mobile-ui-card-table tbody tr[hidden]{display:none!important}
        #app:not(.public-app) table.responsive-v3-card-table tbody td,
        #app:not(.public-app) table.mobile-ui-card-table tbody td{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:10px!important;min-width:0!important;width:100%!important;padding:9px 3px!important;border:0!important;border-bottom:1px solid #edf1f5!important;text-align:right!important;white-space:normal!important;overflow-wrap:anywhere!important}
        #app:not(.public-app) table.responsive-v3-card-table tbody td::before,
        #app:not(.public-app) table.mobile-ui-card-table tbody td::before{content:attr(data-responsive-label)!important;flex:0 0 42%!important;max-width:42%!important;color:#6c7e90!important;font-size:11px!important;font-weight:850!important;line-height:1.35!important;letter-spacing:.045em!important;text-align:left!important;text-transform:uppercase!important}
        #app:not(.public-app) table.responsive-v3-card-table tbody td:last-child,
        #app:not(.public-app) table.mobile-ui-card-table tbody td:last-child{flex-wrap:wrap!important;border-bottom:0!important}
        #app:not(.public-app) table.responsive-v3-card-table tbody td[colspan],
        #app:not(.public-app) table.mobile-ui-card-table tbody td[colspan]{display:block!important;grid-column:1!important;text-align:left!important}
        #app:not(.public-app) table.responsive-v3-card-table tbody td[colspan]::before,
        #app:not(.public-app) table.mobile-ui-card-table tbody td[colspan]::before,
        #app:not(.public-app) table.responsive-v3-card-table tbody td.empty::before,
        #app:not(.public-app) table.mobile-ui-card-table tbody td.empty::before{display:none!important}
        #app:not(.public-app) table.responsive-v3-card-table tbody td .btn,
        #app:not(.public-app) table.mobile-ui-card-table tbody td .btn{flex:1 1 125px!important;min-width:0!important;min-height:44px!important}

        #app:not(.public-app) .presence{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:0!important;width:100%!important;max-width:100%!important;overflow:visible!important;border:0!important;background:transparent!important}
        #app:not(.public-app) .presence .phead{display:none!important}
        #app:not(.public-app) .presence>div:not(.phead){display:block!important;min-width:0!important;background:#fff!important}
        #app:not(.public-app) .presence>div:nth-child(5n+1):not(.phead){position:static!important;grid-column:1/-1!important;margin-top:10px!important;padding:13px 12px 8px!important;border:1px solid #dbe5ed!important;border-bottom:0!important;border-radius:14px 14px 0 0!important;box-shadow:0 4px 14px #173a5b0b!important}
        #app:not(.public-app) .presence>div:nth-child(5n+2):not(.phead),
        #app:not(.public-app) .presence>div:nth-child(5n+3):not(.phead),
        #app:not(.public-app) .presence>div:nth-child(5n+4):not(.phead),
        #app:not(.public-app) .presence>div:nth-child(5n):not(.phead){padding:4px 6px!important}
        #app:not(.public-app) .presence>div:nth-child(5n+2):not(.phead),
        #app:not(.public-app) .presence>div:nth-child(5n+4):not(.phead){border-left:1px solid #dbe5ed!important}
        #app:not(.public-app) .presence>div:nth-child(5n+3):not(.phead),
        #app:not(.public-app) .presence>div:nth-child(5n):not(.phead){border-right:1px solid #dbe5ed!important}
        #app:not(.public-app) .presence>div:nth-child(5n+4):not(.phead),
        #app:not(.public-app) .presence>div:nth-child(5n):not(.phead){padding-bottom:7px!important;border-bottom:1px solid #dbe5ed!important}
        #app:not(.public-app) .presence>div:nth-child(5n+4):not(.phead){border-radius:0 0 0 14px!important}
        #app:not(.public-app) .presence>div:nth-child(5n):not(.phead){border-radius:0 0 14px 0!important}
        #app:not(.public-app) .presence .pchoice{width:100%!important;min-height:48px!important;padding:8px 5px!important;border-radius:10px!important;font-size:12px!important;white-space:normal!important}
        #app:not(.public-app) .presence>div:nth-child(5n+1):not(.phead) .btn{width:100%!important;margin-top:8px!important}

        #app:not(.public-app) .attendance-ranking-row{grid-template-columns:38px minmax(0,1fr)!important;gap:9px!important;padding:11px!important}
        #app:not(.public-app) .attendance-ranking-metrics{grid-column:1/-1!important;justify-content:flex-start!important;max-width:none!important;padding:7px 0 0!important;border-top:1px solid #edf2f8!important;text-align:left!important}
        #app:not(.public-app) .work-phase-row,
        #app:not(.public-app) .site-manager-row,
        #app:not(.public-app) .finance-contract-item,
        #app:not(.public-app) .my-site-work-card{grid-template-columns:minmax(0,1fr)!important;width:100%!important}

        body.responsive-v3-phone .modal{align-items:flex-end!important;padding:8px 8px 0!important;background:#071a2d99!important}
        body.responsive-v3-phone .dialog{width:100%!important;max-width:100%!important;max-height:calc(100dvh - 8px)!important;padding:18px 14px calc(18px + env(safe-area-inset-bottom))!important;border-radius:22px 22px 0 0!important;overflow-x:hidden!important}
        body.responsive-v3-phone .dialog footer{position:sticky!important;bottom:calc(-18px - env(safe-area-inset-bottom))!important;z-index:2!important;display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:8px!important;margin:18px 0 calc(-18px - env(safe-area-inset-bottom))!important;padding:12px 16px calc(12px + env(safe-area-inset-bottom))!important;background:#fff!important;border-top:1px solid #e1e7ed!important;box-shadow:0 -8px 20px #132f4c12!important}
        body.responsive-v3-phone .dialog footer .btn{width:100%!important;margin:0!important}

        #app:not(.public-app) .side{position:fixed!important;inset:auto 0 0!important;z-index:50!important;width:100%!important;height:auto!important;padding:0 6px calc(7px + env(safe-area-inset-bottom))!important;background:transparent!important;pointer-events:none!important}
        #app:not(.public-app) .side .brand{display:none!important}
        #app:not(.public-app) .side .nav{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:2px!important;width:min(560px,100%)!important;min-height:70px!important;margin:0 auto!important;padding:6px 5px!important;overflow:visible!important;border:1px solid #dce5ef!important;border-radius:22px!important;background:#fff!important;box-shadow:0 12px 35px #0c284437!important;pointer-events:auto!important}
        #app:not(.public-app) .side .nav>button{display:flex!important;align-items:center!important;justify-content:center!important;flex-direction:column!important;gap:2px!important;width:100%!important;min-width:0!important;min-height:56px!important;padding:6px 2px!important;border:0!important;border-radius:17px!important;background:transparent!important;color:#52606f!important;font-size:11px!important;line-height:1.1!important;box-shadow:none!important}
        #app:not(.public-app) .side .nav>button[data-nav-key="planning"]{display:none!important}
        #app:not(.public-app) .side .nav>button.active,
        #app:not(.public-app) .side .nav>button.nav-more.open{background:#e7f0ff!important;color:#1769d5!important}
        #app:not(.public-app) .side .nav .mobile-nav-icon{font-size:20px!important;line-height:1!important}
        #app:not(.public-app) .side .nav .mobile-nav-label{max-width:100%!important;overflow:hidden!important;font-size:9.5px!important;text-overflow:ellipsis!important;white-space:nowrap!important}
        #app:not(.public-app) .side .nav .nav-extra-scroll{position:fixed!important;inset:0 0 calc(84px + env(safe-area-inset-bottom))!important;z-index:1!important;display:block!important;width:100%!important;max-height:none!important;padding:18px 13px 28px!important;overflow-y:auto!important;overflow-x:hidden!important;background:#f3f6fa!important;border:0!important;border-radius:0!important;box-shadow:none!important}
        #app:not(.public-app) .side .nav .mobile-more-header{top:-18px!important;margin:-18px -13px 15px!important;padding:17px 15px 13px!important;background:#f3f6fa!important}
        #app:not(.public-app) .side .nav .mobile-more-group{margin-bottom:12px!important;border-radius:15px!important}
        #app:not(.public-app) .side .nav .mobile-more-group button{min-height:54px!important;padding:11px 14px!important;font-size:14px!important}
      }

      /* Tablets e iPads: duas colunas, mais largura útil e navegação proporcional. */
      @media(min-width:601px) and (max-width:1024px), (min-width:1025px) and (max-width:1366px) and (orientation:landscape) and (hover:none) and (pointer:coarse){
        #app:not(.public-app){width:100%;min-height:100dvh;background:#f2f6fb}
        #app:not(.public-app) .main{min-width:0;width:100%}
        #app:not(.public-app) .content{width:100%;max-width:none;margin:0;padding:20px 18px 34px}
        #app:not(.public-app) .top{min-height:68px;height:auto;padding:10px 18px;gap:10px;flex-wrap:wrap}
        #app:not(.public-app) .top-brand{min-width:150px;flex:1 1 180px}
        #app:not(.public-app) .top .work-select{flex:1 1 260px;min-width:220px;max-width:420px;min-height:44px}
        #app:not(.public-app) .top .user{min-height:40px}
        #app:not(.public-app) .top .top-settings-button{min-width:44px;min-height:44px}
        #app:not(.public-app) .page-title{font-size:27px;line-height:1.18}
        #app:not(.public-app) .card{padding:17px;border-radius:15px}
        #app:not(.public-app) .grid,
        #app:not(.public-app) .two,
        #app:not(.public-app) .form,
        #app:not(.public-app) .compact-fields,
        #app:not(.public-app) .home-metrics,
        #app:not(.public-app) .home-shortcuts,
        #app:not(.public-app) .home-operation,
        #app:not(.public-app) .finance-summary-grid,
        #app:not(.public-app) .finance-expense-grid,
        #app:not(.public-app) .finance-work-grid,
        #app:not(.public-app) .finance-history-metrics,
        #app:not(.public-app) .finance-clean-metrics,
        #app:not(.public-app) .finance-payment-summary-grid,
        #app:not(.public-app) .work-closing-metrics,
        #app:not(.public-app) .attendance-ranking-summary,
        #app:not(.public-app) .site-manager-grid,
        #app:not(.public-app) .my-site-choice-grid,
        #app:not(.public-app) .my-site-work-grid,
        #app:not(.public-app) .client-detail-grid,
        #app:not(.public-app) .work-action-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important}
        #app:not(.public-app) .toolbar{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px;padding:14px}
        #app:not(.public-app) .toolbar .field{flex:1 1 220px;min-width:0}
        #app:not(.public-app) .toolbar>.btn{min-height:44px}
        #app:not(.public-app) .btn{min-height:44px}
        #app:not(.public-app) .two>.card .form{grid-template-columns:minmax(0,1fr)!important}
        #app:not(.public-app) .two>.card .form .wide{grid-column:1!important}
        #app:not(.public-app) .table-wrap{max-width:100%;overflow-x:auto;overscroll-behavior-inline:contain;-webkit-overflow-scrolling:touch}
        #app:not(.public-app) .table{font-size:13px}
        #app:not(.public-app) .tabs,
        #app:not(.public-app) .site-management-tabs{display:flex;flex-wrap:wrap;gap:7px;overflow:visible}
        #app:not(.public-app) .permission-hub-info{grid-template-columns:repeat(3,minmax(0,1fr))!important}
        #app:not(.public-app) .btn,
        #app:not(.public-app) button,
        #app:not(.public-app) .presence .pchoice{min-height:44px}
        body.responsive-v3-tablet .dialog{width:min(760px,calc(100vw - 36px));max-width:calc(100vw - 36px);max-height:calc(100dvh - 36px);padding:22px;border-radius:18px;overflow-x:hidden}
        body.responsive-v3-tablet .dialog footer{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}
      }

      /* Trilho lateral compacto somente para tablets com largura suficiente. */
      @media(min-width:761px) and (max-width:1024px), (min-width:1025px) and (max-width:1366px) and (orientation:landscape) and (hover:none) and (pointer:coarse){
        body.responsive-v3-tablet{overflow:hidden!important}
        #app:not(.public-app):has(>.side){display:grid!important;grid-template-columns:96px minmax(0,1fr)!important;height:100dvh!important;min-height:0!important;overflow:hidden!important}
        #app:not(.public-app) .main{height:100dvh!important;min-height:0!important;overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior:contain!important}
        #app:not(.public-app) .side{position:relative!important;top:auto!important;width:96px!important;height:100dvh!important;padding:13px 8px!important;overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior:contain!important;scrollbar-width:thin!important;background:#103864!important}
        #app:not(.public-app) .side .brand{display:grid!important;place-items:center!important;padding:5px 0 12px!important}
        #app:not(.public-app) .side .brand-logo{width:48px!important;height:48px!important;margin:0!important}
        #app:not(.public-app) .side .brand-text,
        #app:not(.public-app) .side .brand small,
        #app:not(.public-app) .side .brand span{display:none!important}
        #app:not(.public-app) .side .nav{display:grid!important;gap:5px!important;width:100%!important;margin:0!important;padding:0!important;overflow:visible!important}
        #app:not(.public-app) .side .nav>button,
        #app:not(.public-app) .side>.nav-more-docked{width:100%!important;min-width:0!important;min-height:48px!important;margin:0!important;padding:8px 4px!important;border-radius:10px!important;font-size:11px!important;line-height:1.2!important;text-align:center!important;white-space:normal!important}
        #app:not(.public-app) .side .nav-extra-scroll{position:static!important;inset:auto!important;display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:5px!important;width:100%!important;max-width:none!important;max-height:none!important;padding:4px 0 0!important;overflow:visible!important;background:transparent!important;border:0!important;box-shadow:none!important}
      }

      /* Celular na horizontal: mais área útil, duas colunas e menu lateral compacto. */
      @media(orientation:landscape) and (max-height:600px) and (max-width:1024px){
        body.responsive-v3-landscape-phone{overflow:hidden!important}
        #app:not(.public-app):has(>.side){display:grid!important;grid-template-columns:82px minmax(0,1fr)!important;height:100dvh!important;min-height:0!important;padding:0!important;overflow:hidden!important}
        #app:not(.public-app) .main{width:100%!important;height:100dvh!important;min-width:0!important;min-height:0!important;overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior:contain!important}
        #app:not(.public-app) .content{width:100%!important;max-width:none!important;margin:0!important;padding:12px 14px 24px!important}
        #app:not(.public-app) .top{position:sticky!important;top:0!important;z-index:30!important;display:flex!important;flex-wrap:nowrap!important;align-items:center!important;gap:8px!important;min-height:56px!important;height:56px!important;padding:7px 12px!important;overflow:hidden!important}
        #app:not(.public-app) .top-brand{flex:1 1 150px!important;min-width:120px!important}
        #app:not(.public-app) .top-brand span{font-size:9px!important}
        #app:not(.public-app) .top-brand strong,
        #app:not(.public-app) #headerPage{font-size:14px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
        #app:not(.public-app) .top .spacer{display:none!important}
        #app:not(.public-app) .top .work-select{order:0!important;flex:0 1 280px!important;width:auto!important;min-width:160px!important;max-width:300px!important;min-height:44px!important;margin:0!important;font-size:14px!important}
        #app:not(.public-app) .top .user{flex:none!important;min-height:38px!important;padding:5px 8px!important;font-size:11px!important}
        #app:not(.public-app) .top .top-settings-button{flex:0 0 44px!important;width:44px!important;min-width:44px!important;min-height:44px!important;padding:0!important}
        #app:not(.public-app) .page-title{font-size:24px!important;line-height:1.15!important}
        #app:not(.public-app) .sub{margin:4px 0 12px!important;font-size:12px!important;line-height:1.4!important}
        #app:not(.public-app) .section{margin-top:14px!important}
        #app:not(.public-app) .card{padding:13px!important;border-radius:13px!important}
        #app:not(.public-app) .grid,
        #app:not(.public-app) .two,
        #app:not(.public-app) .form,
        #app:not(.public-app) .compact-fields,
        #app:not(.public-app) .home-metrics,
        #app:not(.public-app) .home-shortcuts,
        #app:not(.public-app) .home-operation,
        #app:not(.public-app) .finance-summary-grid,
        #app:not(.public-app) .finance-expense-grid,
        #app:not(.public-app) .finance-work-grid,
        #app:not(.public-app) .finance-history-metrics,
        #app:not(.public-app) .finance-clean-metrics,
        #app:not(.public-app) .finance-payment-summary-grid,
        #app:not(.public-app) .work-closing-metrics,
        #app:not(.public-app) .attendance-ranking-summary,
        #app:not(.public-app) .site-manager-grid,
        #app:not(.public-app) .my-site-choice-grid,
        #app:not(.public-app) .my-site-work-grid,
        #app:not(.public-app) .client-detail-grid,
        #app:not(.public-app) .work-action-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
        #app:not(.public-app) .two>.card .form{grid-template-columns:minmax(0,1fr)!important}
        #app:not(.public-app) .two>.card .form .wide{grid-column:1!important}
        #app:not(.public-app) .toolbar{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;align-items:end!important;gap:8px!important;padding:11px!important}
        #app:not(.public-app) .toolbar>.btn,
        #app:not(.public-app) .toolbar>.check-line{width:100%!important;min-height:44px!important;margin:0!important}
        #app:not(.public-app) .field input,
        #app:not(.public-app) .field select,
        #app:not(.public-app) .field textarea,
        #app:not(.public-app) input,
        #app:not(.public-app) select,
        #app:not(.public-app) textarea{min-height:44px!important}
        #app:not(.public-app) .btn{min-height:44px!important;padding:8px 11px!important}
        #app:not(.public-app) .tabs,
        #app:not(.public-app) .site-management-tabs,
        #app:not(.public-app) .finance-payment-center-tabs{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:7px!important;width:100%!important;overflow:visible!important}

        #app:not(.public-app) table.responsive-v3-card-table,
        #app:not(.public-app) table.mobile-ui-card-table{display:block!important;width:100%!important;min-width:0!important;border:0!important;background:transparent!important;white-space:normal!important}
        #app:not(.public-app) table.responsive-v3-card-table thead,
        #app:not(.public-app) table.mobile-ui-card-table thead{position:absolute!important;width:1px!important;height:1px!important;margin:-1px!important;overflow:hidden!important;clip:rect(0 0 0 0)!important}
        #app:not(.public-app) table.responsive-v3-card-table tbody,
        #app:not(.public-app) table.mobile-ui-card-table tbody{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important;width:100%!important;padding:0!important}
        #app:not(.public-app) table.responsive-v3-card-table tbody tr,
        #app:not(.public-app) table.mobile-ui-card-table tbody tr{display:grid!important;grid-template-columns:minmax(0,1fr)!important;width:100%!important;padding:8px 10px!important;border:1px solid #dbe5ed!important;border-radius:12px!important;background:#fff!important;box-shadow:0 3px 12px #173a5b0b!important}
        #app:not(.public-app) table.responsive-v3-card-table tbody tr[hidden],
        #app:not(.public-app) table.mobile-ui-card-table tbody tr[hidden]{display:none!important}
        #app:not(.public-app) table.responsive-v3-card-table tbody td,
        #app:not(.public-app) table.mobile-ui-card-table tbody td{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:8px!important;width:100%!important;min-width:0!important;padding:7px 2px!important;border:0!important;border-bottom:1px solid #edf1f5!important;text-align:right!important;white-space:normal!important;overflow-wrap:anywhere!important}
        #app:not(.public-app) table.responsive-v3-card-table tbody td::before,
        #app:not(.public-app) table.mobile-ui-card-table tbody td::before{content:attr(data-responsive-label)!important;flex:0 0 38%!important;max-width:38%!important;color:#6c7e90!important;font-size:11px!important;font-weight:850!important;text-align:left!important;text-transform:uppercase!important}
        #app:not(.public-app) table.responsive-v3-card-table tbody td:last-child,
        #app:not(.public-app) table.mobile-ui-card-table tbody td:last-child{flex-wrap:wrap!important;border-bottom:0!important}
        #app:not(.public-app) table.responsive-v3-card-table tbody td[colspan],
        #app:not(.public-app) table.mobile-ui-card-table tbody td[colspan]{display:block!important;grid-column:1!important;text-align:left!important}
        #app:not(.public-app) table.responsive-v3-card-table tbody td[colspan]::before,
        #app:not(.public-app) table.mobile-ui-card-table tbody td[colspan]::before{display:none!important}

        #app:not(.public-app) .presence{display:grid!important;grid-template-columns:minmax(150px,1.45fr) repeat(4,minmax(76px,1fr))!important;gap:0!important;width:100%!important;max-width:100%!important;overflow:visible!important;border:1px solid #dbe5ed!important;border-radius:12px!important;background:#fff!important}
        #app:not(.public-app) .presence .phead{display:flex!important;position:static!important;align-items:center!important;justify-content:center!important;min-width:0!important;padding:7px 5px!important;font-size:11px!important;text-align:center!important}
        #app:not(.public-app) .presence .phead:first-child{justify-content:flex-start!important;text-align:left!important}
        #app:not(.public-app) .presence>div:not(.phead){display:flex!important;position:static!important;align-items:center!important;min-width:0!important;margin:0!important;padding:7px 5px!important;border:0!important;border-top:1px solid #e4ebf2!important;border-radius:0!important;background:#fff!important;box-shadow:none!important}
        #app:not(.public-app) .presence>div:nth-child(5n+1):not(.phead){grid-column:auto!important;display:block!important;padding:8px!important}
        #app:not(.public-app) .presence>div:nth-child(5n+1):not(.phead) .btn{width:100%!important;min-height:44px!important;margin-top:6px!important;padding:8px!important;font-size:11px!important}
        #app:not(.public-app) .presence .pchoice{width:100%!important;min-width:0!important;min-height:44px!important;padding:6px 3px!important;border-radius:9px!important;font-size:11px!important;white-space:normal!important}
        #app:not(.public-app) .presence>div:nth-child(5n+1):not(.phead) .btn{min-height:44px!important}

        #app:not(.public-app) .side{position:relative!important;inset:auto!important;top:auto!important;z-index:40!important;width:82px!important;height:100dvh!important;padding:8px 6px!important;overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior:contain!important;scrollbar-width:thin!important;background:#103864!important;pointer-events:auto!important}
        #app:not(.public-app) .side .brand{display:none!important}
        #app:not(.public-app) .side .nav{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:4px!important;width:100%!important;min-height:0!important;margin:0!important;padding:0!important;overflow:visible!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
        #app:not(.public-app) .side .nav>button,
        #app:not(.public-app) .side>.nav-more-docked{display:flex!important;align-items:center!important;justify-content:center!important;flex-direction:column!important;gap:2px!important;width:100%!important;min-width:0!important;min-height:44px!important;margin:0!important;padding:5px 3px!important;border:0!important;border-radius:10px!important;background:transparent!important;color:#dceaff!important;font-size:11px!important;line-height:1.05!important;text-align:center!important;white-space:normal!important;box-shadow:none!important}
        #app:not(.public-app) .side .nav>button[data-nav-key="planning"]{display:none!important}
        #app:not(.public-app) .side .nav>button.active,
        #app:not(.public-app) .side .nav>button.nav-more.open{background:#2b79d3!important;color:#fff!important}
        #app:not(.public-app) .side .nav .mobile-nav-icon{font-size:17px!important}
        #app:not(.public-app) .side .nav .mobile-nav-label{font-size:10px!important;white-space:normal!important}
        #app:not(.public-app) .side .nav .nav-extra-scroll{position:static!important;inset:auto!important;z-index:auto!important;display:grid!important;grid-template-columns:minmax(0,1fr)!important;align-content:start!important;gap:4px!important;width:100%!important;max-width:none!important;max-height:none!important;padding:4px 0 0!important;overflow:visible!important;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;color:#dceaff!important}
        #app:not(.public-app) .side .nav .mobile-more-header{display:none!important}
        #app:not(.public-app) .side .nav .mobile-more-group{display:grid!important;gap:4px!important;margin:4px 0 0!important;overflow:visible!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
        #app:not(.public-app) .side .nav .mobile-more-group h3{margin:0!important;padding:7px 2px 3px!important;color:#91b5d7!important;font-size:7px!important;line-height:1.2!important;text-align:center!important;letter-spacing:.04em!important}
        #app:not(.public-app) .side .nav .mobile-more-group button,
        #app:not(.public-app) .side .nav .nav-extra-scroll>button{display:flex!important;align-items:center!important;justify-content:center!important;flex-direction:column!important;gap:2px!important;width:100%!important;min-width:0!important;min-height:44px!important;margin:0!important;padding:5px 3px!important;border:0!important;border-radius:10px!important;background:transparent!important;color:#dceaff!important;font-size:11px!important;line-height:1.05!important;text-align:center!important;white-space:normal!important;box-shadow:none!important}
        #app:not(.public-app) .side .nav .mobile-more-group button:hover,
        #app:not(.public-app) .side .nav .mobile-more-group button.active,
        #app:not(.public-app) .side .nav .nav-extra-scroll>button:hover,
        #app:not(.public-app) .side .nav .nav-extra-scroll>button.active{background:#2b79d3!important;color:#fff!important}
        #app:not(.public-app) .side .nav .mobile-more-group .mobile-nav-icon{width:auto!important;font-size:17px!important;text-align:center!important}
        #app:not(.public-app) .side .nav .mobile-more-group .mobile-nav-label{font-size:10px!important;white-space:normal!important}

        body.responsive-v3-landscape-phone .modal{align-items:center!important;padding:8px!important}
        body.responsive-v3-landscape-phone .dialog{width:min(760px,calc(100vw - 106px))!important;max-width:calc(100vw - 106px)!important;max-height:calc(100dvh - 16px)!important;padding:15px!important;border-radius:16px!important;overflow-x:hidden!important}
        body.responsive-v3-landscape-phone .dialog .form{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        body.responsive-v3-landscape-phone .dialog footer{display:flex!important;flex-wrap:wrap!important;justify-content:flex-end!important;gap:8px!important;margin:12px 0 0!important;padding:0 10px 0!important}
      }
    </style>`);
  }

  function cleanLabel(value, fallback) {
    const label = String(value || '').replace(/\s+/g, ' ').trim();
    return label || fallback;
  }

  function decoratePhoneTables(root = document) {
    if (!window.matchMedia(PHONE_QUERY).matches && !window.matchMedia(LANDSCAPE_PHONE_QUERY).matches) return;
    const app = document.getElementById('app');
    if (!app || app.classList.contains('public-app')) return;
    root.querySelectorAll('#view table.table').forEach((table) => {
      const headers = [...table.querySelectorAll('thead tr:first-child th')].map((cell, index, list) => cleanLabel(cell.textContent, index === list.length - 1 ? 'Ações' : `Campo ${index + 1}`));
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

  function normalize() {
    installStyle();
    const app = document.getElementById('app');
    const internalApp = !!app && !app.classList.contains('public-app');
    const landscapePhone = internalApp && window.matchMedia(LANDSCAPE_PHONE_QUERY).matches;
    const phone = internalApp && !landscapePhone && window.matchMedia(PHONE_QUERY).matches;
    const tablet = internalApp && !landscapePhone && (window.matchMedia(TABLET_QUERY).matches || window.matchMedia(LARGE_TOUCH_TABLET_QUERY).matches);
    document.body.classList.toggle('responsive-v3-device', phone || landscapePhone || tablet);
    document.body.classList.toggle('responsive-v3-phone', phone);
    document.body.classList.toggle('responsive-v3-landscape-phone', landscapePhone);
    document.body.classList.toggle('responsive-v3-tablet', tablet);
    if (phone || landscapePhone) decoratePhoneTables(document);
  }

  function queueNormalize() {
    if (refreshPending) return;
    refreshPending = true;
    requestAnimationFrame(() => {
      refreshPending = false;
      normalize();
    });
  }

  function install() {
    installStyle();
    const view = document.getElementById('view');
    if (!view) {
      setTimeout(install, 120);
      return;
    }
    new MutationObserver(queueNormalize).observe(view, { childList: true, subtree: true });
    window.matchMedia(PHONE_QUERY).addEventListener?.('change', queueNormalize);
    window.matchMedia(LANDSCAPE_PHONE_QUERY).addEventListener?.('change', queueNormalize);
    window.matchMedia(TABLET_QUERY).addEventListener?.('change', queueNormalize);
    window.matchMedia(LARGE_TOUCH_TABLET_QUERY).addEventListener?.('change', queueNormalize);
    window.addEventListener('orientationchange', queueNormalize, { passive: true });
    normalize();
  }

  window.ResponsiveUIV3 = { refresh: queueNormalize };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
