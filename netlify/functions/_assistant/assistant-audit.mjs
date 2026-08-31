function clean(value, maxLength = 120) {
  return String(value || '').replace(/[^a-zA-Z0-9_.:\-]/g, '').slice(0, maxLength);
}

export function createAuditEvent({
  requestId,
  companyId,
  userId,
  action,
  status,
  fingerprint,
  errorCode = '',
  durationMs = 0,
  provider = 'not-configured',
  model = ''
} = {}) {
  return Object.freeze({
    event: 'assistant_request',
    phase: 1,
    requestId: clean(requestId),
    companyId: clean(companyId),
    userId: clean(userId),
    action: clean(action),
    status: clean(status),
    fingerprint: clean(fingerprint, 64),
    errorCode: clean(errorCode),
    durationMs: Math.max(0, Math.floor(Number(durationMs || 0))),
    provider: clean(provider),
    model: clean(model),
    containsBusinessData: false,
    at: new Date().toISOString()
  });
}

export function writeAudit(event, logger = console) {
  const method = event?.status === 'error' ? 'warn' : 'info';
  logger?.[method]?.(JSON.stringify(event));
  return event;
}
