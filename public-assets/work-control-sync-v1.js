(function () {
  'use strict';
  if (typeof CloudSync === 'undefined' || window.ObraAtivaWorkSync) return;
  const revisions = new Map(), conflicts = new Map();
  const original = CloudSync.request.bind(CloudSync);
  const status = { ready(companyId) { return revisions.has(companyId) && !conflicts.has(companyId); },
    error(companyId) { return conflicts.get(companyId) || ''; } };
  CloudSync.request = async function (path, options = {}, token) {
    if (path.startsWith('/rest/v1/company_app_state?') && (!options.method || options.method === 'GET')) {
      const query = new URL(path, 'https://local.invalid'), companyId = (query.searchParams.get('company_id') || '').replace(/^eq\./, '');
      const selected = query.searchParams.get('select');
      if (selected && selected !== '*') query.searchParams.set('select', `${selected},work_control_revision`);
      try {
        const rows = await original(query.pathname + query.search, options, token);
        if (companyId && Array.isArray(rows) && rows.length) { revisions.set(companyId, Number(rows[0].work_control_revision || 0)); conflicts.delete(companyId); }
        else if (companyId && Array.isArray(rows)) revisions.set(companyId, 0);
        return rows;
      } catch (error) {
        // A versão antiga continua acessível antes de instalar a migration.
        if (!/work_control_revision|42703/i.test(`${error.code || ''} ${error.message || ''}`)) throw error;
        revisions.delete(companyId); return original(path, options, token);
      }
    }
    if (path === '/rest/v1/rpc/save_company_app_state') {
      const payload = JSON.parse(options.body), companyId = payload.p_company_id;
      if (conflicts.has(companyId)) throw new Error(conflicts.get(companyId));
      const data = payload.p_data?.db || {};
      const controlled = (data.works || []).some((w) => w.control?.version === 1) || (data.workUpdates || []).some((e) => e.controlEvent) || (data.distributions || []).some((d) => d.phaseId);
      if (!revisions.has(companyId)) {
        if (controlled) throw new Error('A proteção de salvamento das obras ainda precisa ser ativada. A alteração está preservada neste aparelho.');
        return original(path, options, token);
      }
      try {
        const result = await original('/rest/v1/rpc/save_company_app_state_checked', { ...options,
          body: JSON.stringify({ ...payload, p_expected_revision: revisions.get(companyId) }) }, token);
        revisions.set(companyId, Number(result.revision)); return result.updated_at;
      } catch (error) {
        if (error.code === '40001' || /Outra sessão salvou|controle de revisão/.test(error.message || '')) {
          conflicts.set(companyId, 'Outra sessão salvou alterações. Sua cópia permanece neste aparelho. Revise e atualize antes de continuar.');
          document.dispatchEvent(new CustomEvent('obraativa:work-sync-conflict'));
        }
        throw error;
      }
    }
    return original(path, options, token);
  };
  const schedule = CloudSync.schedule.bind(CloudSync);
  CloudSync.schedule = function () { if (!conflicts.has(typeof CompanyWorkspace !== 'undefined' ? CompanyWorkspace.current?.id : '')) return schedule(); };
  window.ObraAtivaWorkSync = Object.freeze(status);
})();
