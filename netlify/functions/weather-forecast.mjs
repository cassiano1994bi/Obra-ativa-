const MET_ENDPOINT = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const USER_AGENT = 'EscritorioDaMinhaObra/1.0 https://escritoriodaminhaobra.com.br';

const json = (status, body, extraHeaders = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=1800',
    ...extraHeaders
  }
});

function coordinate(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return Math.round(number * 100) / 100;
}

function safeTimezone(value) {
  const timezone = String(value || '').trim();
  return /^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+$/.test(timezone) ? timezone : 'America/Sao_Paulo';
}

function localParts(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || '';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, hour: Number(part('hour') || 0) };
}

function summarize(payload, timezone) {
  const series = Array.isArray(payload?.properties?.timeseries) ? payload.properties.timeseries : [];
  if (!series.length) throw new Error('A previsão não retornou períodos disponíveis.');
  const now = Date.now();
  const current = series.find((item) => Date.parse(item.time) >= now - 60 * 60 * 1000) || series[0];
  const instant = current?.data?.instant?.details || {};
  const nextHour = current?.data?.next_1_hours || {};
  const groups = new Map();

  series.slice(0, 120).forEach((item) => {
    const parts = localParts(new Date(item.time), timezone);
    const details = item?.data?.instant?.details || {};
    const period = item?.data?.next_1_hours || item?.data?.next_6_hours || {};
    if (!groups.has(parts.date)) groups.set(parts.date, { date: parts.date, temperatures: [], precipitation: 0, symbol: '', symbolDistance: 99 });
    const group = groups.get(parts.date);
    if (Number.isFinite(details.air_temperature)) group.temperatures.push(details.air_temperature);
    group.precipitation += Number(period?.details?.precipitation_amount || 0);
    const distance = Math.abs(parts.hour - 12);
    if (period?.summary?.symbol_code && distance < group.symbolDistance) {
      group.symbol = period.summary.symbol_code;
      group.symbolDistance = distance;
    }
  });

  const days = [...groups.values()].slice(0, 4).map((group) => ({
    date: group.date,
    min: group.temperatures.length ? Math.round(Math.min(...group.temperatures)) : null,
    max: group.temperatures.length ? Math.round(Math.max(...group.temperatures)) : null,
    precipitation: Math.round(group.precipitation * 10) / 10,
    symbol: group.symbol || 'cloudy'
  }));

  return {
    updatedAt: current.time,
    current: {
      temperature: Math.round(Number(instant.air_temperature || 0)),
      apparent: Math.round(Number(instant.air_temperature || 0)),
      humidity: Math.round(Number(instant.relative_humidity || 0)),
      wind: Math.round(Number(instant.wind_speed || 0)),
      precipitation: Math.round(Number(nextHour?.details?.precipitation_amount || 0) * 10) / 10,
      symbol: nextHour?.summary?.symbol_code || current?.data?.next_6_hours?.summary?.symbol_code || 'cloudy'
    },
    days
  };
}

export default async (request) => {
  if (request.method !== 'GET') return json(405, { error: 'Método não permitido.' });
  try {
    const url = new URL(request.url);
    const lat = coordinate(url.searchParams.get('lat'), -90, 90);
    const lon = coordinate(url.searchParams.get('lon'), -180, 180);
    const timezone = safeTimezone(url.searchParams.get('tz'));
    if (lat === null || lon === null) return json(400, { error: 'Localização inválida.' });

    const response = await fetch(`${MET_ENDPOINT}?lat=${lat}&lon=${lon}`, {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'application/json',
        'accept-encoding': 'gzip, deflate'
      }
    });
    if (!response.ok) throw new Error('O serviço de previsão está temporariamente indisponível.');
    const forecast = summarize(await response.json(), timezone);
    return json(200, forecast, { 'x-weather-location-precision': 'approximately-1km' });
  } catch (error) {
    return json(502, { error: error.message || 'Não foi possível carregar a previsão agora.' });
  }
};
