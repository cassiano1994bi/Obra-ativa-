(() => {
  'use strict';

  const STYLE_ID = 'landscapeDensityV1Style';
  const LANDSCAPE_QUERY = '(orientation:landscape)';
  let refreshPending = false;

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="${STYLE_ID}">
      /*
       * Camada estritamente visual para celular/tablet em modo horizontal.
       * Não altera conteúdo, dados, cálculos ou eventos. No desktop, somente
       * a composição visual da tela inicial é compartilhada por autorização.
       */
      @media (min-width:1200px) {
        body.responsive-home-desktop #app:not(.public-app) .home-operational {
          gap:11px!important;
        }
        body.responsive-home-desktop #app:not(.public-app) .home-operational-head {
          align-items:center!important;
          padding:13px 15px!important;
          border:1px solid #17614b!important;
          border-radius:15px!important;
          background:linear-gradient(125deg,#0d365f 0%,#12624a 100%)!important;
          box-shadow:0 10px 24px #123f5d1f!important;
        }
        body.responsive-home-desktop #app:not(.public-app) .home-operational-head small,
        body.responsive-home-desktop #app:not(.public-app) .home-operational-head h1,
        body.responsive-home-desktop #app:not(.public-app) .home-operational-head p,
        body.responsive-home-desktop #app:not(.public-app) .home-pay-chip small,
        body.responsive-home-desktop #app:not(.public-app) .home-pay-chip b {
          color:#fff!important;
        }
        body.responsive-home-desktop #app:not(.public-app) .home-operational-head h1 {
          margin:3px 0!important;
          font-size:23px!important;
        }
        body.responsive-home-desktop #app:not(.public-app) .home-operational-head p {
          font-size:11px!important;
          opacity:.88!important;
        }
        body.responsive-home-desktop #app:not(.public-app) .home-pay-chip {
          min-width:190px!important;
          padding:9px 11px!important;
          border-color:#ffffff3d!important;
          background:#ffffff14!important;
          color:#fff!important;
        }
        body.responsive-home-desktop #app:not(.public-app) .home-shortcuts {
          grid-template-columns:repeat(4,minmax(0,1fr))!important;
          gap:12px!important;
        }
        body.responsive-home-desktop #app:not(.public-app) .home-shortcut {
          grid-template-columns:auto minmax(0,1fr)!important;
          grid-template-rows:auto auto!important;
          align-items:center!important;
          column-gap:8px!important;
          row-gap:1px!important;
          min-height:118px!important;
          padding:14px!important;
          border-radius:12px!important;
        }
        body.responsive-home-desktop #app:not(.public-app) .home-shortcut-icon {
          grid-row:1/3!important;
          width:42px!important;
          height:42px!important;
          border-radius:10px!important;
          font-size:15px!important;
        }
        body.responsive-home-desktop #app:not(.public-app) .home-shortcut b {
          align-self:end!important;
          font-size:12px!important;
        }
        body.responsive-home-desktop #app:not(.public-app) .home-shortcut small {
          align-self:start!important;
          margin:0!important;
          font-size:9px!important;
          line-height:1.25!important;
        }
        body.responsive-home-desktop #app:not(.public-app) .home-insights {
          grid-template-columns:1.2fr .8fr!important;
          gap:9px!important;
        }
        body.responsive-home-desktop #app:not(.public-app) .home-insight-head {
          padding:10px 11px 8px!important;
        }
        body.responsive-home-desktop #app:not(.public-app) .home-insight-head h2 {
          font-size:14px!important;
        }
        body.responsive-home-desktop #app:not(.public-app) .home-insight-head p {
          margin-top:2px!important;
          font-size:10px!important;
        }
        body.responsive-home-desktop #app:not(.public-app) .home-attention-item,
        body.responsive-home-desktop #app:not(.public-app) .home-activity-item {
          padding:8px 11px!important;
        }
        body.responsive-home-desktop #app:not(.public-app) .home-attention-item b,
        body.responsive-home-desktop #app:not(.public-app) .home-activity-item b {
          font-size:11px!important;
        }
        body.responsive-home-desktop #app:not(.public-app) .home-attention-item small,
        body.responsive-home-desktop #app:not(.public-app) .home-activity-item small {
          margin-top:2px!important;
          font-size:9px!important;
          line-height:1.3!important;
        }
      }
      @media (orientation:landscape) {
        body.responsive-landscape-density #app:not(.public-app) .content {
          padding:10px 12px 18px!important;
        }

        body.responsive-landscape-density #app:not(.public-app) .top .top-brand,
        body.responsive-landscape-density #app:not(.public-app) .top .user,
        body.responsive-landscape-density #app:not(.public-app) #companyTeamAction,
        body.responsive-landscape-density #app:not(.public-app) #subscriptionAction {
          display:none!important;
        }

        body.responsive-landscape-density #app:not(.public-app) .landscape-top-company-logo {
          display:block!important;
          width:40px!important;
          height:40px!important;
          flex:0 0 40px!important;
          padding:3px!important;
          border:1px solid #d7e3ee!important;
          border-radius:11px!important;
          background:#fff!important;
          object-fit:contain!important;
          box-shadow:0 4px 12px #163d6814!important;
        }

        body.responsive-landscape-density #app:not(.public-app) #cloudTopActions:empty {
          display:none!important;
        }

        body.responsive-landscape-density .landscape-settings-shortcuts {
          display:grid!important;
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
          gap:8px!important;
          margin:12px 0 4px!important;
          padding:11px!important;
          border:1px solid #dce7f1!important;
          border-radius:11px!important;
          background:#f7faff!important;
        }

        body.responsive-landscape-density .landscape-settings-shortcuts .btn {
          min-height:40px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="planning"],
        body.responsive-landscape-density #view[data-landscape-page="team"],
        body.responsive-landscape-density #view[data-landscape-page="vehicles"],
        body.responsive-landscape-density #view[data-landscape-page="reports"],
        body.responsive-landscape-density #view[data-landscape-page="assistant"],
        body.responsive-landscape-density #view[data-landscape-page="permissions"] {
          font-size:12px;
        }

        body.responsive-landscape-density #view[data-landscape-page="planning"] .page-title,
        body.responsive-landscape-density #view[data-landscape-page="team"] .page-title,
        body.responsive-landscape-density #view[data-landscape-page="vehicles"] .page-title,
        body.responsive-landscape-density #view[data-landscape-page="reports"] .page-title,
        body.responsive-landscape-density #view[data-landscape-page="assistant"] .page-title,
        body.responsive-landscape-density #view[data-landscape-page="permissions"] .page-title {
          font-size:20px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="planning"] .sub,
        body.responsive-landscape-density #view[data-landscape-page="team"] .sub,
        body.responsive-landscape-density #view[data-landscape-page="vehicles"] .sub,
        body.responsive-landscape-density #view[data-landscape-page="reports"] .sub,
        body.responsive-landscape-density #view[data-landscape-page="assistant"] .sub,
        body.responsive-landscape-density #view[data-landscape-page="permissions"] .sub {
          margin:3px 0 8px!important;
          font-size:11px!important;
          line-height:1.35!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="planning"] .section,
        body.responsive-landscape-density #view[data-landscape-page="team"] .section,
        body.responsive-landscape-density #view[data-landscape-page="vehicles"] .section,
        body.responsive-landscape-density #view[data-landscape-page="reports"] .section,
        body.responsive-landscape-density #view[data-landscape-page="assistant"] .section,
        body.responsive-landscape-density #view[data-landscape-page="permissions"] .section {
          margin-top:9px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="planning"] .card,
        body.responsive-landscape-density #view[data-landscape-page="team"] .card,
        body.responsive-landscape-density #view[data-landscape-page="vehicles"] .card,
        body.responsive-landscape-density #view[data-landscape-page="reports"] .card,
        body.responsive-landscape-density #view[data-landscape-page="permissions"] .card {
          padding:10px!important;
          border-radius:11px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="planning"] .section-head,
        body.responsive-landscape-density #view[data-landscape-page="team"] .section-head,
        body.responsive-landscape-density #view[data-landscape-page="vehicles"] .section-head,
        body.responsive-landscape-density #view[data-landscape-page="reports"] .section-head,
        body.responsive-landscape-density #view[data-landscape-page="permissions"] .section-head {
          gap:8px!important;
          margin-bottom:7px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="planning"] .section-head h2,
        body.responsive-landscape-density #view[data-landscape-page="team"] .section-head h2,
        body.responsive-landscape-density #view[data-landscape-page="vehicles"] .section-head h2,
        body.responsive-landscape-density #view[data-landscape-page="reports"] .section-head h2,
        body.responsive-landscape-density #view[data-landscape-page="permissions"] .section-head h2 {
          font-size:14px!important;
        }

        /* Escala, equipe e veículos: mais cartões simultâneos, sem esconder campos. */
        body.responsive-landscape-density #view[data-landscape-page="planning"] table.responsive-v3-card-table tbody,
        body.responsive-landscape-density #view[data-landscape-page="planning"] table.mobile-ui-card-table tbody,
        body.responsive-landscape-density #view[data-landscape-page="team"] table.responsive-v3-card-table tbody,
        body.responsive-landscape-density #view[data-landscape-page="team"] table.mobile-ui-card-table tbody,
        body.responsive-landscape-density #view[data-landscape-page="vehicles"] table.responsive-v3-card-table tbody,
        body.responsive-landscape-density #view[data-landscape-page="vehicles"] table.mobile-ui-card-table tbody {
          grid-template-columns:repeat(4,minmax(0,1fr))!important;
          gap:7px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="planning"] table.responsive-v3-card-table tbody tr,
        body.responsive-landscape-density #view[data-landscape-page="planning"] table.mobile-ui-card-table tbody tr,
        body.responsive-landscape-density #view[data-landscape-page="team"] table.responsive-v3-card-table tbody tr,
        body.responsive-landscape-density #view[data-landscape-page="team"] table.mobile-ui-card-table tbody tr,
        body.responsive-landscape-density #view[data-landscape-page="vehicles"] table.responsive-v3-card-table tbody tr,
        body.responsive-landscape-density #view[data-landscape-page="vehicles"] table.mobile-ui-card-table tbody tr {
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
          align-content:start!important;
          padding:6px 7px!important;
          border-radius:10px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="planning"] table.responsive-v3-card-table tbody td,
        body.responsive-landscape-density #view[data-landscape-page="planning"] table.mobile-ui-card-table tbody td,
        body.responsive-landscape-density #view[data-landscape-page="team"] table.responsive-v3-card-table tbody td,
        body.responsive-landscape-density #view[data-landscape-page="team"] table.mobile-ui-card-table tbody td,
        body.responsive-landscape-density #view[data-landscape-page="vehicles"] table.responsive-v3-card-table tbody td,
        body.responsive-landscape-density #view[data-landscape-page="vehicles"] table.mobile-ui-card-table tbody td {
          display:block!important;
          min-width:0!important;
          padding:5px 3px!important;
          border-bottom:1px solid #edf1f5!important;
          font-size:11px!important;
          line-height:1.25!important;
          text-align:left!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="planning"] table tbody td b,
        body.responsive-landscape-density #view[data-landscape-page="team"] table tbody td b,
        body.responsive-landscape-density #view[data-landscape-page="vehicles"] table tbody td b,
        body.responsive-landscape-density #view[data-landscape-page="reports"] table tbody td b {
          display:block!important;
          max-width:100%!important;
          overflow-wrap:anywhere!important;
          white-space:normal!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="planning"] table.responsive-v3-card-table tbody td::before,
        body.responsive-landscape-density #view[data-landscape-page="planning"] table.mobile-ui-card-table tbody td::before,
        body.responsive-landscape-density #view[data-landscape-page="team"] table.responsive-v3-card-table tbody td::before,
        body.responsive-landscape-density #view[data-landscape-page="team"] table.mobile-ui-card-table tbody td::before,
        body.responsive-landscape-density #view[data-landscape-page="vehicles"] table.responsive-v3-card-table tbody td::before,
        body.responsive-landscape-density #view[data-landscape-page="vehicles"] table.mobile-ui-card-table tbody td::before {
          display:block!important;
          max-width:none!important;
          margin-bottom:2px!important;
          font-size:7px!important;
          line-height:1.1!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="planning"] table tbody td:has(.btn),
        body.responsive-landscape-density #view[data-landscape-page="team"] table tbody td:has(.btn),
        body.responsive-landscape-density #view[data-landscape-page="vehicles"] table tbody td:has(.btn) {
          grid-column:1/-1!important;
          border-bottom:0!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="planning"] table tbody td .btn,
        body.responsive-landscape-density #view[data-landscape-page="team"] table tbody td .btn,
        body.responsive-landscape-density #view[data-landscape-page="vehicles"] table tbody td .btn {
          min-height:32px!important;
          padding:5px 7px!important;
          font-size:9px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="planning"] .toolbar,
        body.responsive-landscape-density #view[data-landscape-page="team"] .toolbar {
          margin-bottom:8px!important;
          padding:8px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="planning"] .notice,
        body.responsive-landscape-density #view[data-landscape-page="team"] .notice {
          padding:7px 9px!important;
          font-size:10px!important;
        }

        /* Relatórios: cada funcionário continua completo em cartões compactos. */
        body.responsive-landscape-density #view[data-landscape-page="reports"] table.responsive-v3-card-table tbody,
        body.responsive-landscape-density #view[data-landscape-page="reports"] table.mobile-ui-card-table tbody {
          grid-template-columns:repeat(4,minmax(0,1fr))!important;
          gap:8px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="reports"] table.responsive-v3-card-table tbody tr,
        body.responsive-landscape-density #view[data-landscape-page="reports"] table.mobile-ui-card-table tbody tr {
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
          padding:7px 8px!important;
          border-radius:10px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="reports"] table.responsive-v3-card-table tbody td,
        body.responsive-landscape-density #view[data-landscape-page="reports"] table.mobile-ui-card-table tbody td {
          display:block!important;
          min-width:0!important;
          padding:5px 3px!important;
          border-bottom:1px solid #edf1f5!important;
          font-size:10px!important;
          line-height:1.2!important;
          text-align:left!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="reports"] table.responsive-v3-card-table tbody td::before,
        body.responsive-landscape-density #view[data-landscape-page="reports"] table.mobile-ui-card-table tbody td::before {
          display:block!important;
          max-width:none!important;
          margin-bottom:2px!important;
          font-size:7px!important;
          line-height:1.1!important;
        }

        /* Assistente: área de consulta compacta e conversa visível sem ocupar a tela toda. */
        body.responsive-landscape-density #view[data-landscape-page="assistant"] .assistant {
          padding:11px 13px!important;
          border-radius:12px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="assistant"] .assistant .page-title {
          margin:0 0 4px!important;
          color:#fff!important;
          font-size:18px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="assistant"] .assistant p {
          margin:0!important;
          font-size:10px!important;
          line-height:1.35!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="assistant"] .toolbar {
          grid-template-columns:repeat(3,minmax(0,1fr))!important;
          gap:6px!important;
          margin:8px 0!important;
          padding:7px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="assistant"] .toolbar .btn {
          min-height:32px!important;
          padding:5px 7px!important;
          font-size:9px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="assistant"] .chat {
          min-height:100px!important;
          max-height:150px!important;
          margin-top:7px!important;
          padding:8px!important;
          overflow-y:auto!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="assistant"] .bubble {
          max-width:88%!important;
          margin:5px 0!important;
          padding:7px 9px!important;
          font-size:11px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="assistant"] .chatbar {
          margin-top:7px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="assistant"] .chatbar input,
        body.responsive-landscape-density #view[data-landscape-page="assistant"] .chatbar .btn {
          min-height:36px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="assistant"] > .notice {
          margin:5px 0 0!important;
          padding:6px 0!important;
          font-size:9px!important;
        }

        /* Permissões: perfis menores, mantendo todas as opções e controles. */
        body.responsive-landscape-density #view[data-landscape-page="permissions"] > .section > .grid,
        body.responsive-landscape-density #view[data-landscape-page="permissions"] .grid {
          grid-template-columns:repeat(4,minmax(0,1fr))!important;
          gap:8px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="permissions"] .grid > .card h2 {
          margin:0 0 3px!important;
          font-size:14px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="permissions"] .check-line {
          min-height:25px!important;
          font-size:10px!important;
          line-height:1.2!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="permissions"] #permissionInvitePanel {
          margin:0!important;
          padding:8px!important;
          font-size:10px!important;
        }

        /* Início: mesma informação, com hierarquia mais clara e cartões menores. */
        body.responsive-landscape-density #view[data-landscape-page="home"] .home-operational {
          gap:11px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="home"] .home-operational-head {
          align-items:center!important;
          padding:13px 15px!important;
          border:1px solid #17614b!important;
          border-radius:15px!important;
          background:linear-gradient(125deg,#0d365f 0%,#12624a 100%)!important;
          box-shadow:0 10px 24px #123f5d1f!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="home"] .home-operational-head small,
        body.responsive-landscape-density #view[data-landscape-page="home"] .home-operational-head h1,
        body.responsive-landscape-density #view[data-landscape-page="home"] .home-operational-head p {
          color:#fff!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="home"] .home-operational-head h1 {
          margin:3px 0!important;
          font-size:23px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="home"] .home-operational-head p {
          font-size:11px!important;
          opacity:.88!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="home"] .home-pay-chip {
          min-width:190px!important;
          padding:9px 11px!important;
          border-color:#ffffff3d!important;
          background:#ffffff14!important;
          color:#fff!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="home"] .home-pay-chip small,
        body.responsive-landscape-density #view[data-landscape-page="home"] .home-pay-chip b {
          color:#fff!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="home"] .home-shortcuts {
          grid-template-columns:repeat(4,minmax(0,1fr))!important;
          gap:12px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="home"] .home-shortcut {
          grid-template-columns:auto minmax(0,1fr)!important;
          grid-template-rows:auto auto!important;
          align-items:center!important;
          column-gap:8px!important;
          row-gap:1px!important;
          min-height:118px!important;
          padding:14px!important;
          border-radius:12px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="home"] .home-shortcut-icon {
          grid-row:1/3!important;
          width:42px!important;
          height:42px!important;
          border-radius:10px!important;
          font-size:15px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="home"] .home-shortcut b {
          align-self:end!important;
          font-size:12px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="home"] .home-shortcut small {
          align-self:start!important;
          margin:0!important;
          font-size:9px!important;
          line-height:1.25!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="home"] .home-insights {
          grid-template-columns:1.2fr .8fr!important;
          gap:9px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="home"] .home-insight-head {
          padding:10px 11px 8px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="home"] .home-insight-head h2 {
          font-size:14px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="home"] .home-insight-head p {
          margin-top:2px!important;
          font-size:10px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="home"] .home-attention-item,
        body.responsive-landscape-density #view[data-landscape-page="home"] .home-activity-item {
          padding:8px 11px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="home"] .home-attention-item b,
        body.responsive-landscape-density #view[data-landscape-page="home"] .home-activity-item b {
          font-size:11px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="home"] .home-attention-item small,
        body.responsive-landscape-density #view[data-landscape-page="home"] .home-activity-item small {
          margin-top:2px!important;
          font-size:9px!important;
          line-height:1.3!important;
        }

        /* Obras: quatro cartões menores por linha, sem retirar informações ou ações. */
        body.responsive-landscape-density #view[data-landscape-page="works"] .internal-works-grid {
          grid-template-columns:repeat(4,minmax(0,1fr))!important;
          gap:8px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="works"] .internal-work-card {
          gap:7px!important;
          min-width:0!important;
          min-height:0!important;
          padding:9px!important;
          border-radius:11px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="works"] .internal-work-card-top {
          gap:6px!important;
          padding-right:20px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="works"] .internal-work-icon {
          width:29px!important;
          height:29px!important;
          border-radius:8px!important;
          font-size:14px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="works"] .internal-work-card h2 {
          margin-top:1px!important;
          font-size:12px!important;
          overflow-wrap:anywhere!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="works"] .internal-work-card-top small,
        body.responsive-landscape-density #view[data-landscape-page="works"] .internal-work-current small {
          font-size:7px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="works"] .internal-work-remove {
          top:7px!important;
          right:7px!important;
          width:20px!important;
          height:20px!important;
          font-size:17px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="works"] .internal-work-status {
          gap:4px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="works"] .internal-work-status span {
          padding:3px 5px!important;
          font-size:8px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="works"] .internal-work-current {
          gap:2px!important;
          min-height:0!important;
          padding:6px!important;
          border-radius:8px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="works"] .internal-work-current b {
          font-size:10px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="works"] .internal-work-current span {
          display:-webkit-box!important;
          overflow:hidden!important;
          font-size:8px!important;
          line-height:1.25!important;
          -webkit-box-orient:vertical!important;
          -webkit-line-clamp:2!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="works"] .internal-work-card-actions {
          gap:4px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="works"] .internal-work-card-actions .btn {
          min-height:30px!important;
          padding:4px 5px!important;
          font-size:8px!important;
        }

        /* Financeiro principal preservado; somente a guia expandida ganha largura correta. */
        body.responsive-landscape-density #view[data-landscape-page="financial"] tr.work-cash-history-row:not([hidden]) {
          display:block!important;
          grid-column:1/-1!important;
          width:100%!important;
          padding:0!important;
          overflow:visible!important;
          border:0!important;
          background:transparent!important;
          box-shadow:none!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="financial"] tr.work-cash-history-row > td {
          display:block!important;
          width:100%!important;
          max-width:none!important;
          padding:0!important;
          border:0!important;
          text-align:left!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="financial"] tr.work-cash-history-row > td::before {
          display:none!important;
          content:none!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="financial"] .finance-work-guide-panel {
          width:100%!important;
          max-width:none!important;
          margin:4px 0!important;
          padding:10px!important;
          gap:9px!important;
          overflow:visible!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="financial"] .finance-work-guide-toolbar,
        body.responsive-landscape-density #view[data-landscape-page="financial"] .finance-work-guide-head {
          align-items:flex-start!important;
          flex-direction:row!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="financial"] .finance-work-guide-toolbar .btn {
          flex:0 0 auto!important;
          width:auto!important;
          min-height:34px!important;
          padding:6px 9px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="financial"] .finance-work-guide-meta,
        body.responsive-landscape-density #view[data-landscape-page="financial"] .finance-work-guide-metrics {
          grid-template-columns:repeat(4,minmax(0,1fr))!important;
          gap:7px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="financial"] .finance-work-guide-meta article,
        body.responsive-landscape-density #view[data-landscape-page="financial"] .finance-work-guide-metrics article {
          min-width:0!important;
          padding:8px!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="financial"] .work-cash-history {
          width:100%!important;
          margin:0!important;
        }
      }

      @media (orientation:landscape) and (max-width:760px) {
        body.responsive-landscape-density #view[data-landscape-page="planning"] table.responsive-v3-card-table tbody,
        body.responsive-landscape-density #view[data-landscape-page="planning"] table.mobile-ui-card-table tbody,
        body.responsive-landscape-density #view[data-landscape-page="team"] table.responsive-v3-card-table tbody,
        body.responsive-landscape-density #view[data-landscape-page="team"] table.mobile-ui-card-table tbody,
        body.responsive-landscape-density #view[data-landscape-page="vehicles"] table.responsive-v3-card-table tbody,
        body.responsive-landscape-density #view[data-landscape-page="vehicles"] table.mobile-ui-card-table tbody {
          grid-template-columns:repeat(4,minmax(0,1fr))!important;
        }

        body.responsive-landscape-density #view[data-landscape-page="home"] .home-shortcuts {
          grid-template-columns:repeat(4,minmax(0,1fr))!important;
        }
      }
    </style>`);
  }

  function detectPage() {
    try {
      if (typeof page === 'string' && page) return page;
    } catch (error) {}
    const active = document.querySelector('#app:not(.public-app) .side .nav button.active[onclick*="go("]');
    const match = active?.getAttribute('onclick')?.match(/go\(['"]([^'"]+)['"]\)/);
    return match?.[1] || '';
  }

  function syncCompactTop(enabled) {
    const top = document.querySelector('#app:not(.public-app) .top');
    if (!top) return;
    let logo = top.querySelector('.landscape-top-company-logo');
    if (!enabled) {
      logo?.remove();
      return;
    }
    if (!logo) {
      logo = document.createElement('img');
      logo.className = 'landscape-top-company-logo';
      const first = top.firstElementChild;
      top.insertBefore(logo, first || null);
    }
    const source = document.querySelector('#app:not(.public-app) .side .brand-logo');
    logo.src = source?.currentSrc || source?.src || 'public-assets/controle-de-obra-icone-v1.svg';
    logo.alt = source?.alt || 'Logo da empresa';
  }

  function syncSettingsShortcuts(enabled) {
    const dialog = document.getElementById('dialog');
    const existing = dialog?.querySelector('.landscape-settings-shortcuts');
    if (!enabled || !dialog || !document.getElementById('modal')?.classList.contains('show')) {
      existing?.remove();
      return;
    }
    const title = dialog.querySelector('h2')?.textContent?.trim().toLocaleLowerCase('pt-BR') || '';
    if (title !== 'configurações' || existing) return;
    const shortcuts = document.createElement('section');
    shortcuts.className = 'landscape-settings-shortcuts';
    shortcuts.setAttribute('aria-label', 'Acessos da conta');
    const subscription = document.createElement('button');
    subscription.type = 'button';
    subscription.className = 'btn alt';
    subscription.textContent = 'Minha assinatura';
    subscription.addEventListener('click', () => {
      if (typeof CompanyWorkspace !== 'undefined' && typeof CompanyWorkspace.showSubscription === 'function') {
        CompanyWorkspace.showSubscription();
      }
    });
    shortcuts.appendChild(subscription);
    dialog.querySelector('footer')?.before(shortcuts);
  }

  function normalize() {
    installStyle();
    const app = document.getElementById('app');
    const view = document.getElementById('view');
    const internalApp = !!app && !app.classList.contains('public-app');
    const responsiveDevice = document.body.classList.contains('responsive-v3-landscape-phone') || document.body.classList.contains('responsive-v3-tablet');
    const enabled = internalApp && responsiveDevice && window.matchMedia(LANDSCAPE_QUERY).matches;
    document.body.classList.toggle('responsive-landscape-density', enabled);
    document.body.classList.toggle('responsive-home-desktop', false);
    if (view) view.dataset.landscapePage = internalApp ? detectPage() : '';
    syncCompactTop(enabled);
    syncSettingsShortcuts(enabled);
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
    new MutationObserver(queueNormalize).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    const top = document.querySelector('#app:not(.public-app) .top');
    if (top) new MutationObserver(queueNormalize).observe(top, { childList: true, subtree: true });
    const dialog = document.getElementById('dialog');
    if (dialog) new MutationObserver(queueNormalize).observe(dialog, { childList: true, subtree: true });
    window.matchMedia(LANDSCAPE_QUERY).addEventListener?.('change', queueNormalize);
    window.addEventListener('orientationchange', queueNormalize, { passive: true });
    normalize();
  }

  window.LandscapeDensityV1 = { refresh: queueNormalize };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
