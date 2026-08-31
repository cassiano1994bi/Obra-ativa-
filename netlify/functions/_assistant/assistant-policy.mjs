import { createHash } from 'node:crypto';

export const ASSISTANT_PHASE = 1;
export const ASSISTANT_NAME = 'Assistente da Obra';
export const ASSISTANT_MODULES = Object.freeze([
  'works',
  'clients',
  'team',
  'planning',
  'attendance',
  'payments',
  'financial',
  'vehicles',
  'reports'
]);

const MODULE_SET = new Set(ASSISTANT_MODULES);
const PROFILE_MODULES = Object.freeze({
  gerente: ASSISTANT_MODULES,
  supervisor: ['works', 'team', 'planning', 'attendance'],
  financeiro: ['payments', 'financial', 'reports'],
  colaborador: ['works', 'planning', 'attendance'],
  visualizador: ASSISTANT_MODULES
});
const DEFAULT_LIMITS = Object.freeze({
  trial: 10,
  essential: 20,
  builder: 60,
  professional: 150,
  custom: 300
});

// Public browser configuration already shipped by the application. Server
// environment pairs remain preferred; this fallback only keeps the assistant
// on the same Supabase project when Netlify does not expose those variables.
const DEFAULT_SUPABASE_PAIR = Object.freeze({
  supabaseUrl: 'https://vqwxvsasmybwpeqiyzmd.supabase.co',
  anonKey: 'sb_publishable_vMwHLNZ-701PG7kCWR7azw_faYVZyCj'
});

export class AssistantHttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AssistantHttpError';
    this.status = status;
    this.code = code;
  }
}

function validSupabasePair(supabaseUrl, anonKey) {
  let parsed;
  try {
    parsed = new URL(String(supabaseUrl || ''));
  } catch {
    return false;
  }
  const key = String(anonKey || '').trim();
  return parsed.protocol === 'https:'
    && /^[a-z0-9-]+\.supabase\.co$/i.test(parsed.hostname)
    && parsed.pathname === '/'
    && (key.startsWith('sb_publishable_') || key.startsWith('eyJ'));
}

export function assistantSupabaseConfig(env = process.env) {
  const pairs = [
    [env.ASSISTANT_SUPABASE_URL, env.ASSISTANT_SUPABASE_ANON_KEY],
    [env.SUPABASE_URL, env.SUPABASE_ANON_KEY],
    [env.INVITE_SUPABASE_URL, env.INVITE_SUPABASE_ANON_KEY],
    [DEFAULT_SUPABASE_PAIR.supabaseUrl, DEFAULT_SUPABASE_PAIR.anonKey]
  ];

  for (const [rawUrl, rawKey] of pairs) {
    const supabaseUrl = String(rawUrl || '').trim().replace(/\/+$/, '');
    const anonKey = String(rawKey || '').trim();
    if (validSupabasePair(`${supabaseUrl}/`, anonKey)) return { supabaseUrl, anonKey };
  }

  throw new AssistantHttpError(
    503,
    'SERVER_NOT_CONFIGURED',
    'A conexão segura do assistente ainda não está configurada no servidor.'
  );
}

export function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

export function cleanIdentifier(value, maxLength = 120) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9_.:\-]/g, '')
    .slice(0, maxLength);
}

export function allowedModulesForMembership(membership = {}) {
  const role = String(membership.role || '').toLowerCase();
  if (role === 'owner' || role === 'manager') return [...ASSISTANT_MODULES];

  const explicit = Array.isArray(membership.permissions?.modules)
    ? membership.permissions.modules.filter((module) => MODULE_SET.has(module))
    : [];
  if (explicit.length) return [...new Set(explicit)];

  const profile = String(membership.permission_profile || '').toLowerCase();
  if (PROFILE_MODULES[profile]) return [...PROFILE_MODULES[profile]];
  if (role === 'viewer') return [...PROFILE_MODULES.visualizador];
  return [...PROFILE_MODULES.colaborador];
}

export function dailyLimitForPlan(plan, env = process.env) {
  const normalized = String(plan || 'trial').toLowerCase();
  const environmentKey = `ASSISTANT_DAILY_LIMIT_${normalized.toUpperCase()}`;
  const configured = Number(env[environmentKey]);
  if (Number.isInteger(configured) && configured > 0 && configured <= 10000) return configured;
  return DEFAULT_LIMITS[normalized] || DEFAULT_LIMITS.trial;
}

export function requestFingerprint({ companyId, userId, action, payload = {} }) {
  const material = JSON.stringify({
    companyId: String(companyId || ''),
    userId: String(userId || ''),
    action: String(action || ''),
    payload
  });
  return createHash('sha256').update(material).digest('hex');
}

export function createRepeatGuard({ ttlMs = 15000, now = () => Date.now() } = {}) {
  const entries = new Map();
  return Object.freeze({
    claim(key) {
      const current = now();
      for (const [storedKey, expiresAt] of entries) {
        if (expiresAt <= current) entries.delete(storedKey);
      }
      if (entries.has(key)) return false;
      entries.set(key, current + ttlMs);
      return true;
    },
    release(key) {
      entries.delete(key);
    },
    size() {
      return entries.size;
    }
  });
}

export function assertPhaseOneAction(action) {
  const normalized = String(action || 'status').trim().toLowerCase();
  if (normalized !== 'status') {
    throw new AssistantHttpError(
      409,
      'PHASE_ONE_READ_ONLY',
      'A conversa será liberada somente na Fase 2. Nesta fase, o assistente apenas valida a estrutura segura.'
    );
  }
  return normalized;
}
