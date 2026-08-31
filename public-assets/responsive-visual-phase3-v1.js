(() => {
  'use strict';

  const STYLE_ID = 'responsiveVisualPhase3V1Style';

  function install() {
    if (document.getElementById(STYLE_ID)) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="${STYLE_ID}">
      /*
       * Fase 3 — ritmo visual, cabeçalhos e grades em telas horizontais menores.
       * Somente aparência: nenhuma informação, ação ou regra é modificada.
       */
      #app:not(.public-app) .finance-payment-center-tabs {
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
        width:min(100%,520px)!important;
        min-width:0!important;
      }

      #app:not(.public-app) .finance-payment-center-tab {
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        width:100%!important;
        min-width:0!important;
        max-width:100%!important;
        padding:9px 12px!important;
        line-height:1.2!important;
        text-align:center!important;
        white-space:normal!important;
        overflow-wrap:break-word!important;
      }

      @media (orientation:landscape) and (max-width:1366px) {
        body.responsive-landscape-density #app:not(.public-app) #view {
          --responsive-visual-gap:10px;
        }

        body.responsive-landscape-density #app:not(.public-app) #view > .section-head,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-clean-head,
        body.responsive-landscape-density #app:not(.public-app) #view .work-closing-head,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-payment-summary-head,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-fortnight-head,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-work-guide-toolbar {
          display:grid!important;
          grid-template-columns:minmax(0,1fr) auto!important;
          align-items:center!important;
          gap:12px!important;
          width:100%!important;
          margin-bottom:12px!important;
          padding-right:2px!important;
          padding-left:2px!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view > .section-head > div,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-clean-head > div,
        body.responsive-landscape-density #app:not(.public-app) #view .work-closing-head > div,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-payment-summary-head > div,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-fortnight-head > div,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-work-guide-toolbar > div {
          min-width:0!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view > .section-head h1,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-clean-head h1,
        body.responsive-landscape-density #app:not(.public-app) #view .work-closing-head h2,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-payment-summary-head h2,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-fortnight-head h2,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-work-guide-toolbar h3 {
          margin-top:0!important;
          margin-bottom:3px!important;
          line-height:1.15!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view > .section-head .sub,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-clean-head p,
        body.responsive-landscape-density #app:not(.public-app) #view .work-closing-head p,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-payment-summary-head p,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-fortnight-head p,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-work-guide-toolbar p {
          margin:3px 0 0!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view > .section-head > .btn,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-clean-head > .btn,
        body.responsive-landscape-density #app:not(.public-app) #view .work-closing-head > .btn,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-payment-summary-head > .btn,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-work-guide-toolbar > .btn {
          justify-self:end!important;
          width:auto!important;
          min-width:132px!important;
          max-width:min(240px,42vw)!important;
          margin:0!important;
          white-space:normal!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view .section {
          margin-top:16px!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view .grid {
          grid-template-columns:repeat(4,minmax(0,1fr))!important;
          gap:var(--responsive-visual-gap)!important;
          align-items:stretch!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view .two,
        body.responsive-landscape-density #app:not(.public-app) #view .home-insights {
          gap:var(--responsive-visual-gap)!important;
          align-items:stretch!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view .grid > .card,
        body.responsive-landscape-density #app:not(.public-app) #view .two > .card,
        body.responsive-landscape-density #app:not(.public-app) #view .home-insights > *,
        body.responsive-landscape-density #app:not(.public-app) #view .internal-works-grid > * {
          height:100%!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view .finance-clean-metrics,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-work-guide-metrics,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-work-guide-meta,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-payment-summary-grid,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-fortnight-totals,
        body.responsive-landscape-density #app:not(.public-app) #view .work-closing-metrics,
        body.responsive-landscape-density #app:not(.public-app) #view .work-closing-summary,
        body.responsive-landscape-density #app:not(.public-app) #view .home-metrics {
          grid-template-columns:repeat(auto-fit,minmax(145px,1fr))!important;
          gap:8px!important;
          align-items:stretch!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view .finance-clean-metrics > *,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-work-guide-metrics > *,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-work-guide-meta > *,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-payment-summary-grid > *,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-fortnight-totals > *,
        body.responsive-landscape-density #app:not(.public-app) #view .work-closing-metrics > *,
        body.responsive-landscape-density #app:not(.public-app) #view .work-closing-summary > *,
        body.responsive-landscape-density #app:not(.public-app) #view .home-metrics > * {
          min-width:0!important;
          height:100%!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view .card,
        body.responsive-landscape-density #app:not(.public-app) #view .home-insight-panel,
        body.responsive-landscape-density #app:not(.public-app) #view .internal-work-card,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-work-guide-panel,
        body.responsive-landscape-density #app:not(.public-app) #view table.responsive-v3-card-table > tbody > tr {
          border-color:#d9e4ed!important;
          border-radius:13px!important;
          box-shadow:0 4px 14px #173a5b0b!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view .toolbar:not(.finance-fortnight-controls) {
          border-color:#d9e4ed!important;
          border-radius:12px!important;
          box-shadow:0 3px 11px #173a5b08!important;
        }

        body.responsive-landscape-density .dialog {
          border:1px solid #d9e4ed!important;
          border-radius:16px!important;
          box-shadow:0 18px 48px #0c28443b!important;
        }

        body.responsive-landscape-density .dialog footer {
          align-items:stretch!important;
          gap:8px!important;
        }
      }

      @media (orientation:landscape) and (max-width:820px) {
        body.responsive-landscape-density #app:not(.public-app) #view .grid {
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #view > .section-head,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-clean-head,
        body.responsive-landscape-density #app:not(.public-app) #view .work-closing-head,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-payment-summary-head,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-fortnight-head,
        body.responsive-landscape-density #app:not(.public-app) #view .finance-work-guide-toolbar {
          gap:9px!important;
        }
      }
    </style>`);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
