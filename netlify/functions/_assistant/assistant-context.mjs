const SOURCE_RULES = Object.freeze({
  works: Object.freeze({
    works: ['id', 'name', 'status', 'startDate', 'endDate', 'archived', 'clientId']
  }),
  clients: Object.freeze({
    clients: ['id', 'status', 'city', 'service', 'workId', 'createdAt'],
    clientRequests: ['id', 'clientId', 'workId', 'status', 'createdAt', 'service']
  }),
  team: Object.freeze({
    employees: ['id', 'name', 'role', 'group', 'groupHistory', 'status', 'daily', 'rateHistory', 'startDate', 'active']
  }),
  planning: Object.freeze({
    distributions: ['id', 'employeeId', 'workId', 'date', 'status', 'period'],
    cycles: ['id', 'group', 'start', 'end', 'status']
  }),
  attendance: Object.freeze({
    attendance: ['id', 'employeeId', 'workId', 'date', 'status', 'period', 'hours']
  }),
  payments: Object.freeze({
    advances: ['id', 'employeeId', 'workId', 'date', 'value', 'cycle', 'cycleId'],
    discounts: ['id', 'employeeId', 'workId', 'date', 'value', 'cycle', 'cycleId'],
    payments: ['id', 'employeeId', 'workId', 'date', 'value', 'cycle', 'cycleId', 'status']
  }),
  financial: Object.freeze({
    receivables: ['id', 'workId', 'date', 'startDate', 'dueDate', 'value', 'total', 'status'],
    receipts: ['id', 'workId', 'date', 'value', 'source'],
    workClosings: ['id', 'workId', 'date', 'closedDate', 'expectedDate', 'periodFrom', 'periodTo', 'value', 'receipts']
  }),
  vehicles: Object.freeze({
    vehicles: ['id', 'name', 'plate', 'status'],
    fuel: ['id', 'vehicleId', 'workId', 'date', 'value', 'total', 'liters'],
    maintenance: ['id', 'vehicleId', 'workId', 'date', 'value', 'status'],
    tow: ['id', 'vehicleId', 'workId', 'date', 'value'],
    licenses: ['id', 'vehicleId', 'workId', 'date', 'dueDate', 'value', 'status']
  }),
  reports: Object.freeze({
    reports: ['id', 'workId', 'date', 'type', 'status']
  })
});
const DIMENSION_SOURCES = new Set(['works', 'clients', 'employees', 'vehicles', 'workClosings']);

function pick(record, fields, period = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const selected = {};
  fields.forEach((field) => {
    if (record[field] === undefined) return;
    if (field === 'rateHistory' && Array.isArray(record[field])) {
      selected[field] = record[field].slice(0, 100).map((item) => ({ date: item?.date, value: item?.value }));
      return;
    }
    if (field === 'groupHistory' && Array.isArray(record[field])) {
      selected[field] = record[field].slice(0, 100).map((item) => ({ date: item?.date, group: item?.group }));
      return;
    }
    if (field === 'receipts' && Array.isArray(record[field])) {
      selected[field] = record[field].filter((item) => inPeriod(item, period)).slice(0, 200).map((item) => ({ id: item?.id, date: item?.date, value: item?.value }));
      return;
    }
    selected[field] = record[field];
  });
  return selected;
}

function dateValue(item) {
  const candidate = item?.date || item?.closedDate || item?.expectedDate || item?.dueDate || item?.createdAt || item?.startDate || item?.start || item?.from || '';
  const normalized = String(candidate || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function inPeriod(item, period = {}) {
  const itemDate = dateValue(item);
  if (!itemDate) return true;
  if (period.from && itemDate < period.from) return false;
  if (period.to && itemDate > period.to) return false;
  return true;
}

function cloneAndFreeze(value) {
  if (Array.isArray(value)) {
    value.forEach(cloneAndFreeze);
    return Object.freeze(value);
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach(cloneAndFreeze);
    return Object.freeze(value);
  }
  return value;
}

export function buildReadOnlyContext({ data = {}, allowedModules = [], period = {} } = {}) {
  const sourceNames = new Set();
  const collections = {};

  [...new Set(allowedModules)].forEach((module) => {
    const moduleRules = SOURCE_RULES[module];
    if (!moduleRules) return;
    Object.entries(moduleRules).forEach(([collectionName, fields]) => {
      const sourceRows = Array.isArray(data[collectionName]) ? data[collectionName] : [];
      const rows = sourceRows
        .filter((row) => DIMENSION_SOURCES.has(collectionName) || inPeriod(row, period))
        .map((row) => pick(row, fields, period))
        .filter(Boolean);
      collections[collectionName] = rows;
      sourceNames.add(collectionName);
    });
  });

  const sources = [...sourceNames].map((name) => Object.freeze({
    name,
    count: collections[name]?.length || 0
  }));
  const missingData = sources.filter((source) => source.count === 0).map((source) => source.name);

  return cloneAndFreeze({
    readOnly: true,
    period: {
      from: String(period.from || ''),
      to: String(period.to || '')
    },
    allowedModules: [...new Set(allowedModules)].filter((module) => SOURCE_RULES[module]),
    sources,
    missingData,
    collections
  });
}

export function contextSummary(context) {
  return Object.freeze({
    readOnly: context?.readOnly === true,
    modules: Array.isArray(context?.allowedModules) ? context.allowedModules.length : 0,
    sources: Array.isArray(context?.sources) ? context.sources.length : 0,
    records: Array.isArray(context?.sources)
      ? context.sources.reduce((total, source) => total + Number(source.count || 0), 0)
      : 0,
    missingSources: Array.isArray(context?.missingData) ? context.missingData.length : 0
  });
}
