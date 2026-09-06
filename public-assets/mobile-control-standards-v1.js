(() => {
  'use strict';

  const STYLE_ID = 'mobileControlStandardsV1Style';

  function install() {
    if (document.getElementById(STYLE_ID)) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="${STYLE_ID}">
      /* Camada visual isolada: não altera eventos, valores, regras ou conteúdo. */
      @media (max-width:1024px), (hover:none) and (pointer:coarse) {
        html body #app:not(.public-app) button:not([hidden]),
        html body #app:not(.public-app) .btn:not([hidden]),
        html body #app:not(.public-app) [role="button"]:not([hidden]),
        html body.responsive-v3-device .dialog button:not([hidden]),
        html body.responsive-v3-device .dialog .btn:not([hidden]),
        html body.responsive-v3-device #cloudGate button:not([hidden]) {
          min-height:44px!important;
          touch-action:manipulation!important;
          -webkit-tap-highlight-color:transparent;
        }

        html body #app:not(.public-app) input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]),
        html body #app:not(.public-app) select,
        html body #app:not(.public-app) textarea,
        html body.responsive-v3-device .dialog input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]),
        html body.responsive-v3-device .dialog select,
        html body.responsive-v3-device .dialog textarea,
        html body.responsive-v3-device #cloudGate input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]),
        html body.responsive-v3-device #cloudGate select,
        html body.responsive-v3-device #cloudGate textarea {
          min-height:44px!important;
          max-width:100%!important;
          font-size:16px!important;
          line-height:1.35!important;
        }

        html body #app:not(.public-app) input[type="checkbox"],
        html body #app:not(.public-app) input[type="radio"],
        html body.responsive-v3-device .dialog input[type="checkbox"],
        html body.responsive-v3-device .dialog input[type="radio"] {
          width:20px!important;
          min-width:20px!important;
          height:20px!important;
          min-height:20px!important;
          margin:0 8px 0 0!important;
        }

        html body #app:not(.public-app) .check-line,
        html body.responsive-v3-device .dialog .check-line {
          min-height:44px!important;
          align-items:center!important;
        }

        html body #app:not(.public-app) summary,
        html body.responsive-v3-device .dialog summary {
          min-height:44px!important;
          align-items:center!important;
          touch-action:manipulation!important;
        }

        html body #app:not(.public-app) button[aria-label]:not([hidden]),
        html body.responsive-v3-device .dialog button[aria-label]:not([hidden]) {
          min-width:44px!important;
        }

        /* Mantém o alvo de toque acessível mesmo quando as camadas de densidade
           horizontal usam controles visualmente compactos. */
        html body.responsive-v3-device.responsive-landscape-density #app:not(.public-app) #view button:not([hidden]),
        html body.responsive-v3-device.responsive-landscape-density #app:not(.public-app) #view .btn:not([hidden]),
        html body.responsive-v3-device.responsive-landscape-density #modal .dialog button:not([hidden]),
        html body.responsive-v3-device.responsive-landscape-density #cloudGate button:not([hidden]) {
          min-height:44px!important;
          font-size:13px!important;
          touch-action:manipulation!important;
        }

        html body.responsive-v3-device.responsive-landscape-density #app:not(.public-app) #view input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]),
        html body.responsive-v3-device.responsive-landscape-density #app:not(.public-app) #view select,
        html body.responsive-v3-device.responsive-landscape-density #app:not(.public-app) #view textarea,
        html body.responsive-v3-device.responsive-landscape-density #modal .dialog input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]),
        html body.responsive-v3-device.responsive-landscape-density #modal .dialog select,
        html body.responsive-v3-device.responsive-landscape-density #modal .dialog textarea {
          min-height:44px!important;
          font-size:16px!important;
        }

        html body.responsive-v3-device #app:not(.public-app) #view[data-landscape-page] table.responsive-v3-card-table td button.btn:not([hidden]),
        html body.responsive-v3-device #app:not(.public-app) #view[data-landscape-page] table.mobile-ui-card-table td button.btn:not([hidden]) {
          min-height:44px!important;
          padding:8px 10px!important;
          font-size:12px!important;
        }

        /* Fases no celular horizontal precisam manter quatro cartões visíveis.
           Estes controles continuam acima do mínimo WCAG de 24 px e ficam
           separados; não devem herdar os 44 px destinados a listas e formulários. */
        html body.responsive-v3-landscape-phone #app#app:not(.public-app) #view .wc-simple .simple-phase-head :is(.wc-button,.btn) {
          min-height:32px!important;
          height:32px!important;
          max-height:32px!important;
          padding:5px 9px!important;
          font-size:10px!important;
        }
        html body.responsive-v3-landscape-phone #app#app:not(.public-app) #view .wc-phase-info .wc-button {
          min-height:29px!important;
          height:29px!important;
          max-height:29px!important;
          padding:3px 6px!important;
          font-size:9.5px!important;
        }
        html body.responsive-v3-landscape-phone #app#app:not(.public-app) #view .wc-simple .simple-phase-add-photo {
          min-height:28px!important;
          height:28px!important;
          max-height:28px!important;
          padding:4px 5px!important;
          font-size:8.5px!important;
        }

        html body #app:not(.public-app) :is(button,.btn,input,select,textarea,summary,[role="button"]):focus-visible,
        html body.responsive-v3-device .dialog :is(button,.btn,input,select,textarea,summary,[role="button"]):focus-visible {
          outline:3px solid #2f80ed!important;
          outline-offset:2px!important;
        }
      }
    </style>`);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
