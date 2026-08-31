(() => {
  'use strict';

  const STYLE_ID = 'responsiveVisualPhase1V1Style';

  function install() {
    if (document.getElementById(STYLE_ID)) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="${STYLE_ID}">
      /*
       * Fase 1 — legibilidade e área de toque em celular/tablet horizontal.
       * Camada estritamente visual: não altera conteúdo, dados ou eventos.
       */
      @media (orientation:landscape) and (max-width:1366px) {
        body.responsive-landscape-density #app:not(.public-app) .content {
          padding-right:16px!important;
          padding-left:16px!important;
        }

        body.responsive-landscape-density #view small:not(.home-weather-credit),
        body.responsive-landscape-density #view .sub,
        body.responsive-landscape-density #view .notice,
        body.responsive-landscape-density #view .finance-clean-note,
        body.responsive-landscape-density #view .work-closing-footnote,
        body.responsive-landscape-density #view .finance-fortnight-note {
          font-size:10px!important;
          line-height:1.4!important;
        }

        body.responsive-landscape-density #view .field label,
        body.responsive-landscape-density #view .metric label,
        body.responsive-landscape-density #view .table th,
        body.responsive-landscape-density #view table th,
        body.responsive-landscape-density #view [class*="kicker"] {
          font-size:10px!important;
          line-height:1.25!important;
        }

        body.responsive-landscape-density #view .table td,
        body.responsive-landscape-density #view table td,
        body.responsive-landscape-density #view .badge,
        body.responsive-landscape-density #view .check-line {
          font-size:11px!important;
          line-height:1.35!important;
        }

        body.responsive-landscape-density #view button,
        body.responsive-landscape-density #view .btn,
        body.responsive-landscape-density .dialog button,
        body.responsive-landscape-density .dialog .btn {
          min-height:40px!important;
          padding-top:7px!important;
          padding-bottom:7px!important;
          font-size:11px!important;
          line-height:1.2!important;
          touch-action:manipulation!important;
        }

        body.responsive-landscape-density #view input:not([type="checkbox"]):not([type="radio"]),
        body.responsive-landscape-density #view select,
        body.responsive-landscape-density #view textarea,
        body.responsive-landscape-density .dialog input:not([type="checkbox"]):not([type="radio"]),
        body.responsive-landscape-density .dialog select,
        body.responsive-landscape-density .dialog textarea {
          min-height:40px!important;
          font-size:12px!important;
          line-height:1.35!important;
        }

        body.responsive-landscape-density #view .internal-work-card small,
        body.responsive-landscape-density #view .internal-work-status span,
        body.responsive-landscape-density #view .internal-work-current span,
        body.responsive-landscape-density #view .home-shortcut small,
        body.responsive-landscape-density #view .home-attention-item small,
        body.responsive-landscape-density #view .home-activity-item small,
        body.responsive-landscape-density #view[data-landscape-page="assistant"] .assistant p,
        body.responsive-landscape-density #view[data-landscape-page="assistant"] > .notice {
          font-size:10px!important;
          line-height:1.35!important;
        }

        body.responsive-landscape-density #view .home-weather-credit {
          font-size:8px!important;
        }

        body.responsive-landscape-density #view .section-head > .btn,
        body.responsive-landscape-density #view .finance-clean-head > .btn,
        body.responsive-landscape-density #view .work-closing-head > .btn,
        body.responsive-landscape-density #view .finance-work-guide-toolbar > .btn {
          flex:0 0 auto!important;
          max-width:calc(100% - 8px)!important;
          margin-right:4px!important;
          padding-right:12px!important;
          padding-left:12px!important;
          white-space:normal!important;
          text-align:center!important;
        }

        /* Sobrescreve apenas compactações antigas que deixavam ações difíceis de tocar. */
        body.responsive-landscape-density #app #view[data-landscape-page="works"] .internal-work-card-top small,
        body.responsive-landscape-density #app #view[data-landscape-page="works"] .internal-work-current small,
        body.responsive-landscape-density #app #view[data-landscape-page="works"] .internal-work-status span,
        body.responsive-landscape-density #app #view[data-landscape-page="works"] .internal-work-current span {
          font-size:10px!important;
          line-height:1.3!important;
        }

        body.responsive-landscape-density #app #view[data-landscape-page="works"] .internal-work-card-actions .btn,
        body.responsive-landscape-density #app #view[data-landscape-page="team"] table tbody td .btn,
        body.responsive-landscape-density #app #view[data-landscape-page="vehicles"] table tbody td .btn,
        body.responsive-landscape-density #app #view[data-landscape-page="assistant"] .toolbar .btn {
          min-height:40px!important;
          padding:7px 9px!important;
          font-size:11px!important;
          line-height:1.2!important;
        }

        body.responsive-landscape-density #app #view[data-landscape-page="planning"] table tbody td::before,
        body.responsive-landscape-density #app #view[data-landscape-page="team"] table tbody td::before,
        body.responsive-landscape-density #app #view[data-landscape-page="vehicles"] table tbody td::before,
        body.responsive-landscape-density #app #view[data-landscape-page="reports"] table tbody td::before {
          font-size:9px!important;
          line-height:1.2!important;
        }

        /* Mantém a mesma área mínima de toque também no modo tablet. */
        html body.responsive-landscape-density #app:not(.public-app) #view[data-landscape-page] button:not(.home-shortcut) {
          min-height:40px!important;
          padding-top:7px!important;
          padding-bottom:7px!important;
          font-size:11px!important;
          line-height:1.2!important;
          touch-action:manipulation!important;
        }

        html body.responsive-landscape-density #app:not(.public-app) #view[data-landscape-page="works"] .internal-work-card-actions .internal-work-edit-action,
        html body.responsive-landscape-density #app:not(.public-app) #view[data-landscape-page="works"] .internal-work-card-actions .internal-work-delete-action {
          min-height:34px!important;
          padding:5px 7px!important;
          border:0!important;
          background:transparent!important;
          box-shadow:none!important;
          font-size:10px!important;
          font-weight:700!important;
        }

        html body.responsive-landscape-density #app:not(.public-app) #view[data-landscape-page="works"] .internal-work-card-top {
          padding-right:42px!important;
        }

        html body.responsive-landscape-density #app:not(.public-app) #view[data-landscape-page="works"] .internal-work-remove {
          top:4px!important;
          right:4px!important;
          width:40px!important;
          height:40px!important;
          padding:0!important;
          font-size:17px!important;
        }
      }
    </style>`);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
