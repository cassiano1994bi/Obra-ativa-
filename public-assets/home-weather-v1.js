(() => {
  'use strict';

  const STYLE_ID = 'homeWeatherV1Style';
  const CARD_CLASS = 'home-weather-card';
  const LOCATION_STORAGE_KEY = 'obraativaWeatherLocationV1';
  let refreshPending = false;
  let loading = false;
  let forecast = null;
  let status = 'idle';
  let message = '';
  let locationAttempt = 0;
  let savedLocationChecked = false;
  const renderedCards = new WeakMap();

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

  function roundedCoordinate(value) {
    return Math.round(Number(value) * 100) / 100;
  }

  function readSavedLocation() {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCATION_STORAGE_KEY) || 'null');
      const latitude = Number(saved?.latitude);
      const longitude = Number(saved?.longitude);
      if (!saved?.enabled || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
      return { latitude, longitude, savedAt: saved.savedAt || '' };
    } catch {
      return null;
    }
  }

  function saveLocationChoice(latitude, longitude) {
    const saved = { enabled: true, latitude: roundedCoordinate(latitude), longitude: roundedCoordinate(longitude), savedAt: new Date().toISOString() };
    try { localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(saved)); } catch { /* armazenamento do aparelho pode estar indisponível */ }
    return saved;
  }

  function forgetLocationChoice() {
    try { localStorage.removeItem(LOCATION_STORAGE_KEY); } catch { /* armazenamento do aparelho pode estar indisponível */ }
    forecast = null;
    status = 'idle';
    message = '';
    savedLocationChecked = true;
    queueRefresh();
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="${STYLE_ID}">
      .${CARD_CLASS}{position:relative;display:grid;grid-template-columns:minmax(220px,1.2fr) repeat(3,minmax(112px,.55fr));gap:9px;align-items:stretch;overflow:hidden;padding:11px;border:1px solid #cfe2dc;border-radius:14px;background:linear-gradient(120deg,#f0faf6,#f7fbff 58%,#fffaf0);box-shadow:0 7px 18px #173f5510}
      .${CARD_CLASS}:before{position:absolute;inset:0 auto 0 0;width:4px;background:linear-gradient(#2c9b70,#4b9bd2);content:""}
      .home-weather-current{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:center;min-width:0;padding:4px 7px}
      .home-weather-icon{display:grid;place-items:center;width:48px;height:48px;border:1px solid #d1e6df;border-radius:14px;background:#ffffffc7;font-size:28px;box-shadow:0 5px 12px #183f5210}
      .home-weather-current small,.home-weather-day small{display:block;color:#628079;font-size:9px;font-weight:850;letter-spacing:.05em;text-transform:uppercase}
      .home-weather-current strong{color:#174c3c;font-size:23px;letter-spacing:-.05em}
      .home-weather-current b{display:block;margin-top:1px;color:#315d51;font-size:12px}
      .home-weather-meta{display:flex;flex-wrap:wrap;gap:3px 8px;margin-top:4px;color:#657d75;font-size:9px}
      .home-weather-day{display:grid;grid-template-columns:auto 1fr;grid-template-areas:"icon date" "icon temperature" "rain rain";align-items:center;column-gap:7px;min-width:0;padding:8px 9px;border:1px solid #dce9e4;border-radius:11px;background:#ffffffbd}
      .home-weather-day>span{grid-area:icon;font-size:22px}.home-weather-day small{grid-area:date}.home-weather-day b{grid-area:temperature;color:#214f42;font-size:13px}.home-weather-day em{grid-area:rain;margin-top:4px;color:#657d75;font-size:9px;font-style:normal}
      .home-weather-idle{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:5px 7px}
      .home-weather-idle-main{display:flex;align-items:center;gap:10px;min-width:0}.home-weather-idle-main>span{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:#fff;font-size:23px}
      .home-weather-idle b{display:block;color:#234f43;font-size:13px}.home-weather-idle small{display:block;margin-top:3px;color:#667f76;font-size:10px;line-height:1.35}
      .home-weather-button{position:relative;z-index:2;display:inline-flex;align-items:center;justify-content:center;flex:none;min-width:168px;min-height:42px;padding:9px 14px;border:1px solid #86bca8;border-radius:10px;background:#fff;color:#176646;font-size:11px;font-weight:850;cursor:pointer;touch-action:manipulation;box-shadow:0 4px 10px #173f5510}
      .home-weather-button:hover{border-color:#4d9f80;background:#f7fffb}.home-weather-button:disabled{cursor:wait;opacity:.7}
      .home-weather-button[aria-busy="true"]:before{width:12px;height:12px;margin-right:7px;border:2px solid #b9d9cc;border-top-color:#176646;border-radius:50%;content:"";animation:home-weather-spin .7s linear infinite}
      .home-weather-credit{position:absolute;right:9px;bottom:3px;z-index:1;color:#758a83;font-size:7px;opacity:.78;pointer-events:none}
      body.responsive-landscape-density .${CARD_CLASS}{grid-template-columns:minmax(180px,1.15fr) repeat(3,minmax(100px,.55fr));gap:7px;padding:8px}
      body.responsive-landscape-density .home-weather-icon{width:39px;height:39px;font-size:23px}
      body.responsive-landscape-density .home-weather-current strong{font-size:19px}
      body.responsive-landscape-density .home-weather-day{padding:6px 7px}
      @media(max-width:760px){.${CARD_CLASS}{grid-template-columns:minmax(155px,1fr) repeat(3,minmax(88px,.58fr));gap:6px}.home-weather-current{gap:6px;padding:3px}.home-weather-day{padding:6px}.home-weather-day>span{font-size:19px}}
      @media(max-width:600px) and (orientation:portrait){.${CARD_CLASS}{grid-template-columns:1fr 1fr}.home-weather-current{grid-column:1/-1}.home-weather-idle{align-items:stretch;flex-direction:column}.home-weather-button{width:100%}}
      @keyframes home-weather-spin{to{transform:rotate(360deg)}}
      @media(prefers-reduced-motion:no-preference){.${CARD_CLASS}{animation:home-weather-arrive .28s ease-out}@keyframes home-weather-arrive{from{opacity:.3;transform:translateY(4px)}}}
    </style>`);
  }

  function weatherInfo(symbol) {
    const code = String(symbol || '').toLowerCase();
    if (code.includes('thunder')) return { icon: '⛈️', label: 'Tempestade' };
    if (code.includes('snow') || code.includes('sleet')) return { icon: '❄️', label: 'Frio e precipitação' };
    if (code.includes('rain') || code.includes('drizzle')) return { icon: code.includes('showers') ? '🌦️' : '🌧️', label: code.includes('showers') ? 'Pancadas de chuva' : 'Chuva' };
    if (code.includes('fog')) return { icon: '🌫️', label: 'Nevoeiro' };
    if (code.includes('partlycloudy')) return { icon: '⛅', label: 'Parcialmente nublado' };
    if (code.includes('cloudy')) return { icon: '☁️', label: 'Nublado' };
    if (code.includes('fair')) return { icon: '🌤️', label: 'Poucas nuvens' };
    if (code.includes('clearsky')) return { icon: '☀️', label: 'Céu limpo' };
    return { icon: '🌡️', label: 'Previsão local' };
  }

  function dayLabel(date, index) {
    if (index === 0) return 'Hoje';
    if (index === 1) return 'Amanhã';
    return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)).replace('.', '');
  }

  function idleMarkup() {
    const text = status === 'loading' ? message || 'Localizando o aparelho…' : status === 'error' ? message : 'Veja temperatura, chuva e próximos dias sem sair da tela inicial.';
    const buttonLabel = status === 'loading' ? 'Localizando…' : status === 'error' ? 'Tentar novamente' : 'Usar minha localização';
    return `<div class="home-weather-idle"><div class="home-weather-idle-main"><span>${status === 'error' ? '⚠️' : '🌦️'}</span><div><b>Previsão do tempo</b><small aria-live="polite">${escapeHtml(text)} Sua escolha fica salva neste dispositivo usando apenas uma região aproximada.</small></div></div><button class="home-weather-button" data-home-weather-location type="button" ${loading ? 'disabled aria-busy="true"' : ''}>${buttonLabel}</button></div>`;
  }

  function forecastMarkup() {
    const current = forecast.current || {};
    const currentInfo = weatherInfo(current.symbol);
    const days = (forecast.days || []).slice(1, 4);
    return `<div class="home-weather-current"><span class="home-weather-icon">${currentInfo.icon}</span><div><small>Agora · sua região</small><strong>${escapeHtml(current.temperature)}°</strong><b>${currentInfo.label}</b><div class="home-weather-meta"><span>💧 ${escapeHtml(current.humidity)}%</span><span>💨 ${escapeHtml(current.wind)} m/s</span><span>🌧️ ${escapeHtml(current.precipitation)} mm</span></div></div></div>${days.map((day, index) => { const info = weatherInfo(day.symbol); return `<article class="home-weather-day"><span>${info.icon}</span><small>${dayLabel(day.date, index + 1)}</small><b>${escapeHtml(day.min)}° / ${escapeHtml(day.max)}°</b><em>Chuva: ${escapeHtml(day.precipitation)} mm</em></article>`; }).join('')}`;
  }

  function cardMarkup() {
    return `${forecast ? forecastMarkup() : idleMarkup()}<span class="home-weather-credit">Dados meteorológicos: MET Norway · CC BY 4.0</span>`;
  }

  function refresh() {
    installStyle();
    const home = document.querySelector('#app:not(.public-app) #view .home-operational');
    document.querySelectorAll(`.${CARD_CLASS}`).forEach((card) => { if (!home || !home.contains(card)) card.remove(); });
    if (!home) return;
    if (!savedLocationChecked) {
      savedLocationChecked = true;
      const saved = readSavedLocation();
      if (saved) window.setTimeout(() => loadForCoordinates(saved.latitude, saved.longitude), 0);
    }
    let card = home.querySelector(`.${CARD_CLASS}`);
    if (!card) {
      card = document.createElement('section');
      card.className = CARD_CLASS;
      card.setAttribute('aria-label', 'Previsão do tempo');
      home.firstElementChild?.after(card);
    }
    const markup = cardMarkup();
    if (renderedCards.get(card) !== markup) {
      card.innerHTML = markup;
      renderedCards.set(card, markup);
    }
  }

  function queueRefresh() {
    if (refreshPending) return;
    refreshPending = true;
    requestAnimationFrame(() => { refreshPending = false; refresh(); });
  }

  async function loadForCoordinates(latitude, longitude) {
    loading = true;
    status = 'loading';
    message = '';
    queueRefresh();
    try {
      const lat = Math.round(Number(latitude) * 100) / 100;
      const lon = Math.round(Number(longitude) * 100) / 100;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 18000) : null;
      const response = await fetch(`/.netlify/functions/weather-forecast?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&tz=${encodeURIComponent(timezone)}`, controller ? { signal: controller.signal } : undefined)
        .finally(() => { if (timer) clearTimeout(timer); });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Não foi possível carregar a previsão agora.');
      forecast = body;
      status = 'ready';
    } catch (error) {
      status = 'error';
      message = error?.name === 'AbortError'
        ? 'A previsão demorou para responder. Toque novamente para tentar.'
        : error?.message || 'A previsão está temporariamente indisponível.';
    } finally {
      loading = false;
      queueRefresh();
    }
  }

  function positionOptions(retry = false) {
    return retry
      ? { enableHighAccuracy: true, timeout: 18000, maximumAge: 0 }
      : { enableHighAccuracy: false, timeout: 12000, maximumAge: 30 * 60 * 1000 };
  }

  function locate(options) {
    return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, options));
  }

  function locationErrorMessage(error) {
    if (error?.code === 1) return 'Localização bloqueada. Permita a localização nas configurações do navegador ou do aplicativo e toque novamente.';
    if (error?.code === 3) return 'A localização demorou para responder. Confira se ela está ativada no aparelho e tente novamente.';
    return 'Não foi possível encontrar sua localização. Ative a localização do aparelho e tente novamente.';
  }

  async function requestLocation() {
    if (loading) return;
    if (!navigator.geolocation) {
      status = 'error';
      message = 'Este aparelho não oferece localização.';
      queueRefresh();
      return;
    }
    loading = true;
    status = 'loading';
    message = 'Solicitando permissão de localização…';
    queueRefresh();
    const attempt = ++locationAttempt;
    try {
      let position;
      try {
        position = await locate(positionOptions(false));
      } catch (firstError) {
        if (firstError?.code === 1) throw firstError;
        position = await locate(positionOptions(true));
      }
      if (attempt !== locationAttempt) return;
      saveLocationChoice(position.coords.latitude, position.coords.longitude);
      await loadForCoordinates(position.coords.latitude, position.coords.longitude);
    } catch (error) {
      if (attempt !== locationAttempt) return;
      loading = false;
      status = 'error';
      message = locationErrorMessage(error);
      queueRefresh();
    }
  }

  function install() {
    installStyle();
    const view = document.getElementById('view');
    if (!view) { setTimeout(install, 120); return; }
    new MutationObserver(queueRefresh).observe(view, { childList: true, subtree: true });
    queueRefresh();
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-home-weather-location]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Localizando…';
    const saved = readSavedLocation();
    if (saved && status === 'error') loadForCoordinates(saved.latitude, saved.longitude);
    else requestLocation();
  }, true);

  window.HomeWeatherV1 = { refresh: queueRefresh, requestLocation, loadForCoordinates, readSavedLocation, forgetLocationChoice };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
