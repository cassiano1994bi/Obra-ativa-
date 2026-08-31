(function installAssistantObraPhaseTwo() {
  'use strict';

  const PAGE_KEY = 'assistant';
  const ENDPOINT = '/.netlify/functions/assistant-obras-chat';
  const COMPACT_VIEWPORT_QUERY = '(max-width:800px), (orientation:landscape) and (max-width:1024px) and (max-height:740px), (orientation:landscape) and (pointer:coarse) and (max-width:1400px) and (max-height:1000px)';
  const suggestions = Object.freeze([
    'O que precisa da minha atenção hoje?',
    'Quem faltou nesta quinzena?',
    'Quais pagamentos estão pendentes?',
    'Qual obra teve maior gasto?',
    'Existe alguma obra com risco de prejuízo?',
    'Faça um resumo desta semana.',
    'Analise o desempenho da equipe.',
    'Compare os gastos das obras.',
    'Quais veículos possuem despesas recentes?'
  ]);
  const state = {
    messages: [],
    loading: false,
    error: '',
    speech: null,
    listening: false,
    requestController: null,
    stoppedByUser: false
  };

  function escapeValue(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function installStyles() {
    if (document.getElementById('assistantObraPhaseTwoStyle')) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="assistantObraPhaseTwoStyle">
      #assistantObraPhase2{display:grid;gap:16px;max-width:1500px;margin:0 auto;color:#173d55}
      #assistantObraPhase2 *{box-sizing:border-box}
      .assistant-chat-hero{display:flex;align-items:center;justify-content:space-between;gap:22px;padding:20px 22px;border:1px solid #d5e6de;border-radius:19px;background:linear-gradient(135deg,#f6fff9,#edf7ff);box-shadow:0 9px 26px #173e6210}
      .assistant-chat-kicker{display:block;color:#16734d;font-size:10px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}
      .assistant-chat-hero h1{margin:4px 0 5px;color:#113f5a;font-size:clamp(25px,3vw,38px);line-height:1.08}
      .assistant-chat-hero p{max-width:780px;margin:0;color:#677d87;font-size:14px;line-height:1.5}
      .assistant-chat-safe{display:flex;align-items:center;gap:8px;flex:0 0 auto;padding:10px 13px;border:1px solid #b7decd;border-radius:999px;background:#eaf8f1;color:#146d49;font-size:12px;font-weight:850;white-space:nowrap}
      .assistant-chat-layout{display:grid;grid-template-columns:minmax(0,1.75fr) minmax(270px,.65fr);gap:15px;align-items:start}
      .assistant-chat-panel,.assistant-chat-side{min-width:0;border:1px solid #d9e6eb;border-radius:18px;background:#fff;box-shadow:0 8px 24px #173e620d}
      .assistant-chat-panel{overflow:hidden}
      .assistant-chat-history{display:grid;gap:13px;min-height:330px;max-height:56vh;padding:18px;overflow:auto;overscroll-behavior:contain;scroll-padding-block:18px;background:linear-gradient(180deg,#fbfdfe,#f5f9fb)}
      .assistant-chat-empty{display:grid;place-items:center;min-height:280px;padding:30px;text-align:center;color:#70838d}
      .assistant-chat-empty b{display:block;margin-bottom:7px;color:#214d63;font-size:18px}
      .assistant-message{display:grid;gap:7px;max-width:min(760px,88%)}
      .assistant-message.user{justify-self:end}
      .assistant-message.assistant{justify-self:start}
      .assistant-message-bubble{padding:12px 14px;border-radius:15px;line-height:1.52;white-space:pre-wrap;overflow-wrap:anywhere}
      .assistant-message.user .assistant-message-bubble{border-bottom-right-radius:5px;background:#1d70dc;color:#fff}
      .assistant-message.assistant .assistant-message-bubble{border:1px solid #d7e6df;border-bottom-left-radius:5px;background:#fff;color:#23495c}
      .assistant-message.error .assistant-message-bubble{border-color:#efd8a8;background:#fff9ec;color:#79591b}
      .assistant-answer-meta{display:flex;flex-wrap:wrap;gap:6px;color:#6d818b;font-size:10px}
      .assistant-answer-meta span{padding:4px 7px;border-radius:999px;background:#edf4f7}
      .assistant-answer-details{padding:10px 12px;border:1px solid #dce8ed;border-radius:11px;background:#f9fbfc;color:#617883;font-size:11px}
      .assistant-quality-summary{display:grid;gap:8px;margin-top:7px;padding:10px;border:1px solid #bcd9ee;border-radius:11px;background:#f3f9ff;color:#315568;font-size:11px}.assistant-quality-summary b{color:#174a6a}.assistant-quality-summary ul{display:grid;gap:7px;margin:0;padding-left:18px}.assistant-quality-summary li{line-height:1.45}.assistant-quality-download{justify-self:start;min-height:36px;padding:7px 11px;border:1px solid #2b79dc;border-radius:9px;background:#fff;color:#1766c5;font-weight:850;cursor:pointer}
      .assistant-answer-details summary{cursor:pointer;color:#315e72;font-weight:850}
      .assistant-answer-details ul{margin:8px 0 0;padding-left:18px}
      .assistant-answer-missing{padding:9px 11px;border:1px solid #efd8a8;border-radius:10px;background:#fff9ec;color:#79591b;font-size:11px;line-height:1.45}
      .assistant-answer-rating{display:flex;align-items:center;gap:6px;color:#6d818b;font-size:10px}
      .assistant-answer-rating button{min-width:34px;min-height:30px;border:1px solid #d8e4e9;border-radius:9px;background:#fff;cursor:pointer}
      .assistant-answer-rating button.selected{border-color:#6aa6e7;background:#e9f3ff}
      .assistant-analyzing{display:flex;align-items:center;gap:9px;padding:11px 13px;border:1px solid #cfe1ea;border-radius:13px;background:#f4f9fc;color:#416a7e;font-size:12px;font-weight:750}
      .assistant-analyzing::before{content:'';width:15px;height:15px;border:2px solid #a9c9d8;border-top-color:#1c75d7;border-radius:50%;animation:assistantChatSpin .8s linear infinite}
      @keyframes assistantChatSpin{to{transform:rotate(360deg)}}
      .assistant-chat-composer{display:grid;gap:10px;padding:14px;border-top:1px solid #dce8ed;background:#fff}
      .assistant-chat-composer textarea{width:100%;min-height:82px;max-height:180px;padding:12px 14px;border:1px solid #cfdde5;border-radius:13px;resize:vertical;color:#173d55;font:inherit;line-height:1.45}
      .assistant-chat-composer textarea:focus{outline:3px solid #cfe5ff;border-color:#4e93e2}
      .assistant-composer-actions{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .assistant-composer-left,.assistant-composer-right{display:flex;align-items:center;gap:8px}
      .assistant-period-select{min-height:42px;padding:8px 10px;border:1px solid #d3e0e7;border-radius:10px;background:#fff;color:#315468;font-weight:700}
      .assistant-voice,.assistant-send{min-height:42px;padding:9px 13px;border-radius:10px;font-weight:850;cursor:pointer}
      .assistant-voice{border:1px solid #d3e0e7;background:#fff;color:#315468}
      .assistant-voice.listening{border-color:#e59a9a;background:#fff0f0;color:#a73f3f}
      .assistant-send{border:1px solid #1769d2;background:#1d70dc;color:#fff;box-shadow:0 6px 14px #1d70dc2e}
      .assistant-send.is-loading{display:inline-flex;align-items:center;justify-content:center;gap:7px;background:#145fbf;cursor:pointer}
      .assistant-send.is-loading::before{content:'';width:13px;height:13px;border:2px solid #ffffff80;border-top-color:#fff;border-radius:50%;animation:assistantChatSpin .8s linear infinite}
      .assistant-send.is-loading:disabled{opacity:1}
      .assistant-send:disabled,.assistant-voice:disabled{opacity:.55;cursor:not-allowed}
      .assistant-chat-error{padding:9px 11px;border-radius:10px;background:#fff0f0;color:#a63d3d;font-size:11px}
      .assistant-chat-side{display:grid;gap:14px;padding:16px;position:sticky;top:88px}
      .assistant-side-section h2{margin:0 0 4px;color:#19475d;font-size:16px}
      .assistant-side-section p{margin:0 0 10px;color:#71848d;font-size:11px;line-height:1.45}
      .assistant-suggestions{display:grid;gap:7px}
      .assistant-suggestion{width:100%;padding:10px 11px;border:1px solid #d9e6eb;border-radius:11px;background:#f8fbfc;color:#315568;text-align:left;font-size:11px;font-weight:750;line-height:1.35;cursor:pointer}
      .assistant-suggestion:hover{border-color:#75aee9;background:#eef6ff}
      .assistant-suggestion:disabled{opacity:.55;cursor:not-allowed}
      .assistant-guard-list{display:grid;gap:7px;margin:0;padding:0;list-style:none;color:#657b86;font-size:11px}
      .assistant-guard-list li{display:flex;gap:7px;line-height:1.4}.assistant-guard-list li::before{content:'✓';color:#168058;font-weight:900}
      .assistant-home-shortcut{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:16px;padding:14px 16px;border:1px solid #cfe2d9;border-radius:14px;background:linear-gradient(135deg,#f7fff9,#f1f8ff);box-shadow:0 7px 18px #173e620b}
      .assistant-home-shortcut div{min-width:0}.assistant-home-shortcut small{display:block;color:#16734d;font-size:9px;font-weight:900;letter-spacing:.11em}.assistant-home-shortcut b{display:block;margin-top:4px;color:#19475d;font-size:15px}.assistant-home-shortcut span{display:block;margin-top:3px;color:#70838d;font-size:11px}
      .assistant-home-shortcut button{flex:0 0 auto;min-height:42px;padding:9px 13px;border:1px solid #2b79dc;border-radius:10px;background:#2b79dc;color:#fff;font-weight:850;cursor:pointer}
      @media(max-width:1050px){.assistant-chat-layout{grid-template-columns:minmax(0,1.5fr) minmax(245px,.65fr)}.assistant-chat-side{position:static}}
      @media(max-width:800px){.assistant-chat-hero{display:grid;padding:16px}.assistant-chat-safe{justify-self:start}.assistant-chat-layout{grid-template-columns:1fr}.assistant-chat-side{grid-template-columns:1fr 1fr}.assistant-chat-history{max-height:none;min-height:300px}.assistant-message{max-width:94%}}
      @media(max-width:560px){#assistantObraPhase2{gap:11px}.assistant-chat-side{grid-template-columns:1fr}.assistant-composer-actions{align-items:stretch;flex-direction:column}.assistant-composer-left,.assistant-composer-right{width:100%}.assistant-period-select{min-width:0;flex:1}.assistant-send{flex:1}.assistant-voice{min-width:96px}.assistant-message{max-width:100%}.assistant-home-shortcut{align-items:stretch;flex-direction:column}.assistant-home-shortcut button{width:100%}}
      @media(orientation:landscape) and (max-width:1024px) and (max-height:740px),(orientation:landscape) and (pointer:coarse) and (max-width:1400px) and (max-height:1000px){
        #assistantObraPhase2{gap:10px}
        .assistant-chat-hero{padding:10px 14px;gap:12px}
        .assistant-chat-hero h1{margin:2px 0 3px;font-size:22px}
        .assistant-chat-hero p{font-size:11px;line-height:1.35}
        .assistant-chat-safe{padding:7px 9px;font-size:10px}
        .assistant-chat-panel{display:grid;grid-template-rows:minmax(140px,1fr) auto;height:clamp(320px,calc(100dvh - 160px),460px)}
        .assistant-chat-history{height:auto;min-height:0;max-height:none;padding:12px;scroll-padding-block:12px}
        .assistant-chat-empty{min-height:130px;padding:18px}
        .assistant-chat-composer{gap:5px;padding:7px}
        .assistant-chat-composer textarea{height:52px;min-height:52px;max-height:76px;padding:8px 10px;resize:none}
        .assistant-chat-composer,.assistant-composer-actions,.assistant-composer-left,.assistant-composer-right{min-width:0}
        .assistant-composer-actions{align-items:center;flex-direction:row;flex-wrap:wrap;gap:7px}
        .assistant-composer-left,.assistant-composer-right{width:auto;gap:6px}
        .assistant-composer-right{margin-left:auto}
        .assistant-period-select,.assistant-voice,.assistant-send{min-height:38px}
        .assistant-message{max-width:96%}
        .assistant-chat-side{max-height:clamp(320px,calc(100dvh - 160px),460px);overflow:auto;overscroll-behavior:contain}
      }
      @media(orientation:landscape) and (max-width:1024px) and (max-height:740px){.assistant-chat-layout{grid-template-columns:1fr}.assistant-chat-side{grid-template-columns:1fr 1fr}}
    </style>`);
  }

  function currentPeriod() {
    return document.getElementById('assistantPeriod')?.value || 'current_cycle';
  }

  function pageMarkup() {
    installStyles();
    return `<main id="assistantObraPhase2" aria-labelledby="assistantChatTitle">
      <section class="assistant-chat-hero">
        <div><span class="assistant-chat-kicker">Fase 2 · Chat inteligente</span><h1 id="assistantChatTitle">Assistente da Obra</h1><p>Converse, consulte os registros autorizados e peça ações seguras. Alterações usam as funções oficiais, com prévia e confirmação.</p></div>
        <div class="assistant-chat-safe">🛡️ Consulta e ações seguras</div>
      </section>
      <div class="assistant-chat-layout">
        <section class="assistant-chat-panel" aria-label="Conversa com o Assistente da Obra">
          <div class="assistant-chat-history" id="assistantChatHistory" aria-live="polite">${historyMarkup()}</div>
          <form class="assistant-chat-composer" onsubmit="return AssistantObraPhase2.submit(event)">
            <label for="assistantQuestion" class="assistant-chat-kicker">Sua pergunta</label>
            <textarea id="assistantQuestion" maxlength="600" placeholder="Ex.: Quais pagamentos estão pendentes?" aria-describedby="assistantComposerHelp" onkeydown="return AssistantObraPhase2.handleComposerKeydown(event)"></textarea>
            <div class="assistant-composer-actions">
              <div class="assistant-composer-left">
                <select id="assistantPeriod" class="assistant-period-select" aria-label="Período da análise">
                  <option value="current_cycle">Ciclo atual</option><option value="today">Hoje</option><option value="current_week">Semana atual</option><option value="current_fortnight">Quinzena atual</option><option value="current_month">Mês atual</option>
                </select>
                <button class="assistant-voice ${state.listening?'listening':''}" id="assistantVoiceButton" type="button" onclick="AssistantObraPhase2.toggleVoice()" ${state.loading?'disabled':''}>${state.listening?'■ Parar':'🎙️ Falar'}</button>
              </div>
            <div class="assistant-composer-right"><span id="assistantComposerHelp" style="font-size:10px;color:#71848d">Máximo 600 caracteres</span><button class="assistant-send ${state.loading?'is-loading':''}" type="${state.loading?'button':'submit'}" aria-busy="${state.loading?'true':'false'}" ${state.loading?'onclick="return AssistantObraPhase2.stopResponse(event)"':''}>${state.loading?'Parar · Pensando…':'Enviar'}</button></div>
            </div>
            ${state.error?`<div class="assistant-chat-error" role="alert">${escapeValue(state.error)}</div>`:''}
          </form>
        </section>
        <aside class="assistant-chat-side">
          <section class="assistant-side-section"><h2>Perguntas sugeridas</h2><p>Escolha uma pergunta ou escreva do seu jeito.</p><div class="assistant-suggestions">${suggestions.map((suggestion) => `<button type="button" class="assistant-suggestion" onclick="AssistantObraPhase2.askSuggestion('${escapeValue(suggestion)}')" ${state.loading?'disabled':''}>${escapeValue(suggestion)}</button>`).join('')}</div></section>
          <section class="assistant-side-section"><h2>Proteção ativa</h2><ul class="assistant-guard-list"><li>Somente a empresa autenticada</li><li>Respeita as permissões do usuário</li><li>Ações usam função oficial, prévia e confirmação</li><li>Não envia o banco inteiro ao provedor</li><li>Informa fontes, período e dados ausentes</li></ul></section>
        </aside>
      </div>
    </main>`;
  }

  function responseDetails(reply) {
    const sourceItems = Array.isArray(reply.sources) ? reply.sources.filter((item) => item.name) : [];
    const calculations = Array.isArray(reply.calculations) ? reply.calculations : [];
    if (!sourceItems.length && !calculations.length) return '';
    return `<details class="assistant-answer-details"><summary>Ver fontes e cálculos</summary><ul>${sourceItems.map((item) => `<li>Fonte: ${escapeValue(item.name)} · ${escapeValue(item.count)} registro(s)</li>`).join('')}${calculations.map((item) => `<li>${escapeValue(item.label)}: ${escapeValue(item.formula)} = ${escapeValue(item.value)}</li>`).join('')}</ul></details>`;
  }

  function qualityReportMarkup(report, messageId) {
    if (!report || report.readOnly !== true) return '';
    const counts = report.summary?.severityCounts || {};
    const findings = Array.isArray(report.findings) ? report.findings.slice(0, 12) : [];
    const verification = report.verification?.available ? `<p><b>Verificação:</b> ${escapeValue(report.verification.persisting?.length || 0)} persistente(s), ${escapeValue(report.verification.resolved?.length || 0)} resolvido(s) com teste, ${escapeValue(report.verification.unverifiable?.length || 0)} não verificável(is) e ${escapeValue(report.verification.newFindings?.length || 0)} novo(s).</p>` : '';
    return `<details class="assistant-answer-details"><summary>Relatório técnico completo · ${escapeValue(report.auditId || 'sem referência')}</summary><div class="assistant-quality-summary"><p><b>Snapshot:</b> ${escapeValue(String(report.codeHash || '').slice(0, 12))} · ${escapeValue(report.summary?.fileCount || 0)} arquivo(s) · ${escapeValue(report.summary?.totalLines || 0)} linha(s)</p><p><b>Gravidade:</b> ${escapeValue(counts.critical || 0)} crítica · ${escapeValue(counts.high || 0)} alta · ${escapeValue(counts.medium || 0)} média · ${escapeValue(counts.low || 0)} baixa · ${escapeValue(counts.info || 0)} informativa</p>${verification}${findings.length ? `<ul>${findings.map((item) => `<li><b>${escapeValue(item.id)} · ${escapeValue(item.title)}</b><br>${escapeValue(item.file)}:${escapeValue(item.line)} · ${escapeValue(item.severity)} · ${escapeValue(item.status)}<br>Causa provável: ${escapeValue(item.probableCause)}<br>Solução: ${escapeValue(item.recommendation)}<br>Validação: ${escapeValue(item.validationPlan)}<br>Prompt Codex: ${escapeValue(item.codexPrompt)}</li>`).join('')}</ul>` : '<p>Nenhum sinal técnico foi classificado.</p>'}<p>As 12 maiores prioridades aparecem acima. O arquivo JSON contém todos os achados sanitizados, fontes de mercado e histórico técnico.</p><button type="button" class="assistant-quality-download" onclick="AssistantObraPhase2.downloadQualityReport('${escapeValue(messageId)}')">Baixar relatório completo (JSON)</button></div></details>`;
  }

  function confidenceLabel(value) {
    return ({ low: 'baixa', medium: 'média', high: 'alta' })[value] || 'baixa';
  }

  function historyMarkup() {
    if (!state.messages.length && !state.loading) return `<div class="assistant-chat-empty"><div><b>Como posso ajudar na obra hoje?</b><span>Escolha uma sugestão ou escreva do seu jeito. Nenhum dado é alterado sem prévia e confirmação.</span></div></div>`;
    const messages = state.messages.map((message) => {
      if (message.role === 'user') return `<article class="assistant-message user"><div class="assistant-message-bubble">${escapeValue(message.content)}</div></article>`;
      if (message.kind === 'error') return `<article class="assistant-message assistant error" role="alert"><div class="assistant-message-bubble">${escapeValue(message.content)}</div></article>`;
      if (message.kind === 'command') return `<article class="assistant-message assistant"><div class="assistant-message-bubble">${escapeValue(message.content)}</div></article>`;
      const reply = message.reply || {};
      const missing = Array.isArray(reply.missingData) && reply.missingData.length ? `<div class="assistant-answer-missing"><b>Dados ausentes:</b> ${escapeValue(reply.missingData.join('; '))}</div>` : '';
      const period = reply.period || {};
      const sourceCount = Array.isArray(reply.sources) ? reply.sources.length : 0;
      return `<article class="assistant-message assistant"><div class="assistant-message-bubble">${escapeValue(reply.answer || message.content)}</div><div class="assistant-answer-meta"><span>${escapeValue(period.label || 'Período informado')}</span><span>${escapeValue(period.from || '—')} a ${escapeValue(period.to || '—')}</span><span>${sourceCount} fonte(s)</span><span>Confiança: ${escapeValue(confidenceLabel(reply.confidence))}</span></div>${missing}${responseDetails(reply)}${qualityReportMarkup(reply.qualityReport, message.id)}<div class="assistant-answer-rating"><span>Esta resposta ajudou?</span><button type="button" aria-label="Resposta útil" class="${message.rating==='up'?'selected':''}" onclick="AssistantObraPhase2.rate('${escapeValue(message.id)}','up')">👍</button><button type="button" aria-label="Resposta não ajudou" class="${message.rating==='down'?'selected':''}" onclick="AssistantObraPhase2.rate('${escapeValue(message.id)}','down')">👎</button>${message.rating?'<span>Avaliação registrada nesta conversa.</span>':''}</div></article>`;
    }).join('');
    return `${messages}${state.loading?'<div class="assistant-analyzing">Analisando dados da sua empresa</div>':''}`;
  }

  function scrollConversationToLatest(delay = 0) {
    const update = () => {
      const target = document.getElementById('assistantChatHistory');
      if (target) target.scrollTop = target.scrollHeight;
    };
    if (delay > 0) {
      window.setTimeout(() => window.requestAnimationFrame(update), delay);
      return;
    }
    window.requestAnimationFrame(() => window.requestAnimationFrame(update));
  }

  function revealLatestAssistantAnswer(delay = 0) {
    const update = () => {
      const history = document.getElementById('assistantChatHistory');
      const answers = history?.querySelectorAll('.assistant-message.assistant');
      const latest = answers?.[answers.length - 1];
      if (!history || !latest) {
        scrollConversationToLatest();
        return;
      }
      const historyBounds = history.getBoundingClientRect();
      const answerBounds = latest.getBoundingClientRect();
      history.scrollTop = Math.max(0, history.scrollTop + answerBounds.top - historyBounds.top - 4);
    };
    window.setTimeout(() => window.requestAnimationFrame(update), delay);
  }

  function isCompactConversationViewport() {
    return window.matchMedia(COMPACT_VIEWPORT_QUERY).matches;
  }

  function keepConversationPanelVisible(delay = 0) {
    if (!isCompactConversationViewport()) return;
    const update = () => {
      const panel = document.querySelector('#assistantObraPhase2 .assistant-chat-panel');
      if (!panel) return;
      const visibleHeight = window.visualViewport?.height || window.innerHeight;
      const visibleTop = window.visualViewport?.offsetTop || 0;
      const visibleBottom = visibleTop + visibleHeight;
      const bounds = panel.getBoundingClientRect();
      if (bounds.top < visibleTop || bounds.bottom > visibleBottom + 1) {
        panel.scrollIntoView({ block: 'end', inline: 'nearest', behavior: 'auto' });
        window.requestAnimationFrame(() => {
          const adjusted = panel.getBoundingClientRect();
          const viewportTop = window.visualViewport?.offsetTop || 0;
          const viewportBottom = viewportTop + (window.visualViewport?.height || window.innerHeight);
          const delta = adjusted.bottom > viewportBottom ? adjusted.bottom - viewportBottom + 4 : adjusted.top < viewportTop ? adjusted.top - viewportTop - 4 : 0;
          if (!delta) return;
          let host = panel.parentElement;
          while (host && host !== document.body) {
            const overflowY = window.getComputedStyle(host).overflowY;
            if (/(auto|scroll)/.test(overflowY) && host.scrollHeight > host.clientHeight) break;
            host = host.parentElement;
          }
          if (host && host !== document.body) host.scrollBy({ top: delta, behavior: 'auto' });
          else window.scrollBy({ top: delta, behavior: 'auto' });
        });
      }
    };
    window.setTimeout(() => window.requestAnimationFrame(update), delay);
  }

  function renderHistory() {
    const target = document.getElementById('assistantChatHistory');
    if (!target) return;
    target.innerHTML = historyMarkup();
    const lastMessage = state.messages[state.messages.length - 1];
    if (!state.loading && lastMessage?.role === 'assistant') revealLatestAssistantAnswer();
    else scrollConversationToLatest();
    if (state.messages.length) keepConversationPanelVisible(20);
    const submit = document.querySelector('#assistantObraPhase2 .assistant-send');
    if (submit) {
      submit.disabled = false;
      submit.type = state.loading ? 'button' : 'submit';
      submit.onclick = state.loading ? stopResponse : null;
      submit.classList.toggle('is-loading', state.loading);
      submit.setAttribute('aria-busy', state.loading ? 'true' : 'false');
      submit.textContent = state.loading ? 'Parar · Pensando…' : 'Enviar';
    }
    document.querySelectorAll('#assistantObraPhase2 .assistant-suggestion').forEach((button) => { button.disabled = state.loading; });
    const voice = document.getElementById('assistantVoiceButton');
    if (voice) voice.disabled = state.loading;
  }

  function notifyAssistantState(next, timeout = 0) {
    try { window.dispatchEvent(new CustomEvent('assistant-state-change', { detail: { state: next, timeout } })); } catch {}
  }

  function requestContext() {
    const cloud = typeof CloudSync !== 'undefined' ? CloudSync : window.CloudSync;
    const workspace = typeof CompanyWorkspace !== 'undefined' ? CompanyWorkspace : window.CompanyWorkspace;
    return { token: cloud?.session?.access_token || '', companyId: workspace?.current?.id || '' };
  }

  async function ask(question) {
    const cleaned = String(question || '').trim();
    if (!cleaned || state.loading) return;
    const qualityIntent = window.AssistantQualityAuditor?.classify?.(cleaned) || 'normal';
    const qualityMode = qualityIntent !== 'normal';
    const technicalMode = !qualityMode && window.AssistantTechnicalExpert?.matches?.(cleaned) === true;
    if (!qualityMode && !technicalMode && typeof window.AssistantCommandBus?.dispatch === 'function') {
      try {
        const command = await window.AssistantCommandBus.dispatch({ text: cleaned, channel: 'app' });
        if (command?.handled) {
          const input = document.getElementById('assistantQuestion');
          if (input) input.value = '';
          if (!command.ok || command.kind === 'unavailable') {
            state.messages.push({ id: `user-command-${Date.now()}`, role: 'user', content: cleaned });
            state.messages.push({ id: `assistant-command-${Date.now()}`, role: 'assistant', kind: command.kind === 'unavailable' ? 'command' : 'error', content: command.message || 'Não foi possível executar esse comando com segurança.', rating: '' });
            renderHistory();
          }
          return;
        }
      } catch (error) {
        state.messages.push({ id: `user-command-${Date.now()}`, role: 'user', content: cleaned });
        state.messages.push({ id: `assistant-command-${Date.now()}`, role: 'assistant', kind: 'error', content: error?.message || 'Não foi possível executar esse comando.', rating: '' });
        renderHistory();
        return;
      }
    }
    const qualityContext = qualityMode ? window.AssistantQualityAuditor?.contextFromMessages?.(state.messages) || null : null;
    const { token, companyId } = requestContext();
    if (!token || !companyId) { state.error = 'Entre na sua conta e selecione uma empresa para usar o assistente.'; renderHistory(); return; }
    const history = state.messages.filter((message) => message.kind !== 'error').slice(-12).map((message) => ({ role: message.role, content: message.role === 'assistant' ? message.reply?.answer || message.content : message.content }));
    state.messages.push({ id: `user-${Date.now()}`, role: 'user', content: cleaned });
    const input = document.getElementById('assistantQuestion');
    if (input) input.value = '';
    const controller = new AbortController();
    state.requestController = controller;
    state.stoppedByUser = false;
    state.loading = true;
    state.error = '';
    notifyAssistantState('thinking');
    renderHistory();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const requestId = window.crypto?.randomUUID?.() || `chat-${Date.now()}`;
      const action = qualityMode ? 'quality_audit' : technicalMode ? 'technical_review' : 'ask';
      const response = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-request-id': requestId }, body: JSON.stringify({ action, companyId, question: cleaned, period: { kind: currentPeriod() }, history, qualityIntent, qualityContext, requestId }), signal: controller.signal });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.ok !== true) {
        const requestError = new Error(body?.error || 'Não foi possível obter a resposta agora.');
        requestError.code = String(body?.code || 'ASSISTANT_REQUEST_FAILED');
        throw requestError;
      }
      state.messages.push({ id: `assistant-${Date.now()}`, role: 'assistant', content: body.reply?.answer || '', reply: body.reply, rating: '' });
      notifyAssistantState('responding', 1400);
    } catch (error) {
      const errorMessage = error?.name === 'AbortError'
        ? state.stoppedByUser
          ? 'Resposta interrompida. Você pode enviar outra pergunta quando quiser.'
          : 'A análise demorou mais que o esperado. Tente novamente.'
        : error?.code === 'DAILY_LIMIT_REACHED'
          ? `${error.message} O acesso será liberado novamente no próximo dia.`
          : (error?.message || 'Não foi possível analisar os dados agora.');
      state.error = '';
      state.messages.push({
        id: `assistant-error-${Date.now()}`,
        role: 'assistant',
        kind: 'error',
        content: errorMessage,
        rating: ''
      });
      notifyAssistantState('alert', 3200);
    } finally {
      clearTimeout(timeout);
      if (state.requestController === controller) state.requestController = null;
      state.stoppedByUser = false;
      state.loading = false;
      renderHistory();
    }
  }

  function submit(event) {
    event.preventDefault();
    ask(document.getElementById('assistantQuestion')?.value || '');
    return false;
  }

  function handleComposerKeydown(event) {
    if (event?.key !== 'Enter' || event.shiftKey || event.isComposing) return true;
    event.preventDefault();
    if (!state.loading) event.currentTarget?.form?.requestSubmit();
    return false;
  }

  function stopResponse(event) {
    event?.preventDefault?.();
    if (!state.loading || !state.requestController) return false;
    state.stoppedByUser = true;
    state.requestController.abort();
    return false;
  }

  function askSuggestion(question) {
    const input = document.getElementById('assistantQuestion');
    if (input) input.value = question;
    ask(question);
  }

  function rate(messageId, rating) {
    const message = state.messages.find((item) => item.id === messageId && item.role === 'assistant');
    if (!message) return;
    message.rating = rating === 'down' ? 'down' : 'up';
    renderHistory();
  }

  function downloadQualityReport(messageId) {
    const report = state.messages.find((item) => item.id === messageId)?.reply?.qualityReport;
    if (!report || report.containsCompanyData !== false) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `auditoria-tecnica-${String(report.auditId || 'somente-leitura').replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function toggleVoice() {
    if (state.listening && state.speech) { state.speech.stop(); return; }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { state.error = 'O reconhecimento de voz não está disponível neste navegador. Você pode escrever a pergunta.'; renderHistory(); return; }
    const recognition = new Recognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => { state.listening = true; const button = document.getElementById('assistantVoiceButton'); if (button) { button.classList.add('listening'); button.textContent = '■ Parar'; } };
    recognition.onresult = (event) => { const transcript = event.results?.[0]?.[0]?.transcript || ''; const input = document.getElementById('assistantQuestion'); if (input) { input.value = transcript; input.focus(); } };
    recognition.onerror = () => { state.error = 'Não foi possível captar a voz. Confira a permissão do microfone ou escreva a pergunta.'; };
    recognition.onend = () => { state.listening = false; state.speech = null; const button = document.getElementById('assistantVoiceButton'); if (button) { button.classList.remove('listening'); button.textContent = '🎙️ Falar'; } renderHistory(); };
    state.speech = recognition;
    recognition.start();
  }

  function mount() {
    renderHistory();
    const input = document.getElementById('assistantQuestion');
    if (input && input.dataset.assistantViewportBound !== 'true') {
      input.dataset.assistantViewportBound = 'true';
      input.addEventListener('focus', () => scrollConversationToLatest());
    }
    if (!window.__assistantObraPhase2ViewportBound) {
      const keepLatestVisible = () => keepConversationPanelVisible(90);
      window.visualViewport?.addEventListener('resize', keepLatestVisible, { passive: true });
      window.addEventListener('orientationchange', keepLatestVisible, { passive: true });
      window.__assistantObraPhase2ViewportBound = true;
    }
    const compactViewport = isCompactConversationViewport();
    if (compactViewport) keepConversationPanelVisible(60);
    if (!compactViewport) input?.focus();
  }

  function installHomeShortcut() {
    installStyles();
    const view = document.getElementById('view');
    if (!view || page !== 'home' || document.getElementById('assistantHomeShortcut')) return;
    view.insertAdjacentHTML('beforeend', `<section class="assistant-home-shortcut" id="assistantHomeShortcut"><div><small>ASSISTENTE DA OBRA</small><b>Converse, consulte e prepare ações com segurança</b><span>Consultas identificam período e fontes; alterações exigem prévia e confirmação.</span></div><button type="button" onclick="go('assistant')">Abrir assistente</button></section>`);
  }

  const renderBeforePhaseTwo = render;
  render = function renderWithAssistantPhaseTwo() {
    if (page === PAGE_KEY) {
      const view = document.getElementById('view');
      if (view) view.innerHTML = pageMarkup();
      mount();
      return undefined;
    }
    const result = renderBeforePhaseTwo();
    if (page === 'home') setTimeout(installHomeShortcut, 0);
    return result;
  };

  const renderTopBeforePhaseTwo = renderTop;
  renderTop = function renderTopWithAssistantPhaseTwo() {
    const result = renderTopBeforePhaseTwo();
    if (page === PAGE_KEY) {
      const title = document.getElementById('headerPage');
      if (title) title.textContent = 'Assistente da Obra';
    }
    return result;
  };

  window.AssistantObraPhase2 = Object.freeze({ submit, handleComposerKeydown, stopResponse, askSuggestion, rate, downloadQualityReport, toggleVoice, mount, phase: 2, readOnly: true });
})();
