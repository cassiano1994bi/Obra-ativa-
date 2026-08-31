(function(){
  // Financeiro: revisão manual e auditável de presenças antigas sem obra.
  // Este módulo nunca altera status, data, diária, valor, escala ou pagamentos.
  const BACKUP_KEY_PREFIX='controleObraAttendanceAssignmentBackup';
  const draft=new Map();
  let dateFilter='';
  let searchFilter='';

  function assignmentAllowed(){
    if(window.AccessControl?.isReadOnly?.())return false;
    if(typeof CompanyWorkspace==='undefined'||!CompanyWorkspace.enabled?.())return true;
    if(!CompanyWorkspace.current?.id)return false;
    return String(CompanyWorkspace.current.role||'').toLowerCase()==='owner'
  }

  function assignmentKey(row){
    return `${String(row?.assignment?.employeeId||'')}::${String(row?.assignment?.date||'')}`
  }

  function assignmentRows(){
    return typeof financeAttendanceLaborRows==='function'
      ?financeAttendanceLaborRows().filter(row=>row?.unassigned)
      :[]
  }

  function unresolvedRecords(row){
    return (db.attendance||[]).filter(record=>
      record&&
      record.employeeId===row.assignment.employeeId&&
      record.date===row.assignment.date&&
      (!record.workId||!workById(record.workId))
    )
  }

  function destinationWorks(){
    return [...(db.works||[])].sort((a,b)=>{
      let aArchived=a.archived?1:0,bArchived=b.archived?1:0;
      if(aArchived!==bArchived)return aArchived-bArchived;
      let aFinal=a.status==='Finalizada'?1:0,bFinal=b.status==='Finalizada'?1:0;
      if(aFinal!==bFinal)return aFinal-bFinal;
      return String(a.name||'').localeCompare(String(b.name||''),'pt-BR')
    })
  }

  function scopedBackupKey(){
    let userId=typeof CloudSync!=='undefined'?CloudSync?.session?.user?.id||'local':'local',companyId=typeof CompanyWorkspace!=='undefined'?CompanyWorkspace.current?.id||'local':'local';
    return `${BACKUP_KEY_PREFIX}:${encodeURIComponent(String(userId))}:${encodeURIComponent(String(companyId))}`
  }

  function hasCompanyCloudSession(){
    return typeof CompanyWorkspace!=='undefined'&&
      CompanyWorkspace.enabled?.()&&
      !!CompanyWorkspace.current?.id&&
      typeof CloudSync!=='undefined'&&
      !!CloudSync?.session?.access_token
  }

  function workOptions(selected=''){
    return `<option value="">Escolha a obra correta</option>${destinationWorks().map(work=>{
      let archived=!!work.archived,label=work.name||'Obra sem nome';
      if(archived)label+=' — arquivada (somente consulta)';
      else if(work.status==='Finalizada')label+=' — finalizada';
      return `<option value="${escapeHtml(work.id)}" ${work.id===selected?'selected':''} ${archived?'disabled':''}>${escapeHtml(label)}</option>`
    }).join('')}`
  }

  function isPossibleDemo(row){
    return /demonstra|exemplo|modelo/i.test(String(row?.employee?.name||''))
  }

  function installStyle(){
    if(document.getElementById('financeAttendanceAssignmentStyle'))return;
    document.head.insertAdjacentHTML('beforeend',`<style id="financeAttendanceAssignmentStyle">
      .finance-attendance-assignment{display:grid;gap:14px;padding:15px;border:1px solid #d5e4dc;border-radius:13px;background:#fff}
      .finance-attendance-assignment-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
      .finance-attendance-assignment-head h4{margin:0;color:#173f55;font-size:17px}
      .finance-attendance-assignment-head p{max-width:760px;margin:5px 0 0;color:#627b70;font-size:12px;line-height:1.5}
      .finance-attendance-assignment-warning{padding:11px 13px;border:1px solid #efdba7;border-radius:10px;background:#fff9ec;color:#775717;font-size:12px;line-height:1.5}
      .finance-attendance-assignment-controls{display:grid;grid-template-columns:minmax(170px,260px) minmax(210px,1fr) auto;gap:9px;align-items:end}
      .finance-attendance-assignment-controls label{display:grid;gap:5px;color:#506a60;font-size:11px;font-weight:800}
      .finance-attendance-assignment-controls select,.finance-attendance-assignment-controls input,.finance-assignment-row select,.finance-assignment-bulk select{width:100%;min-height:42px;border:1px solid #cadbd3;border-radius:9px;background:#fff;padding:8px 10px;color:#173f55}
      .finance-assignment-groups{display:grid;gap:10px}
      .finance-assignment-group{overflow:hidden;border:1px solid #dce8e2;border-radius:12px;background:#fbfdfc}
      .finance-assignment-group>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;cursor:pointer;color:#1d5542;font-weight:850;list-style:none}
      .finance-assignment-group>summary::-webkit-details-marker{display:none}
      .finance-assignment-group>summary span{color:#71867d;font-size:11px;font-weight:700}
      .finance-assignment-group-body{display:grid;gap:9px;padding:0 11px 11px}
      .finance-assignment-bulk{display:grid;grid-template-columns:minmax(200px,1fr) auto;gap:8px;padding:10px;border:1px dashed #bcd5c8;border-radius:10px;background:#f3f9f6}
      .finance-assignment-grid-head,.finance-assignment-row{display:grid;grid-template-columns:95px minmax(170px,1.35fr) 115px 105px 105px minmax(215px,1.5fr);gap:9px;align-items:center}
      .finance-assignment-grid-head{padding:0 11px;color:#70847b;font-size:9px;font-weight:900;letter-spacing:.05em}
      .finance-assignment-row{padding:11px;border:1px solid #e0e9e4;border-radius:10px;background:#fff}
      .finance-assignment-row.ready{border-color:#82c9a6;background:#f2fbf6;box-shadow:inset 3px 0 #2c9a65}
      .finance-assignment-cell small{display:none}
      .finance-assignment-cell b{display:block;color:#193f52;font-size:12px}
      .finance-assignment-cell span{display:block;margin-top:2px;color:#72847d;font-size:11px;line-height:1.35}
      .finance-assignment-badge{display:inline-flex!important;width:max-content;margin-top:4px!important;padding:3px 6px;border-radius:999px;background:#fff0cf;color:#915f08!important;font-size:9px!important;font-weight:850}
      .finance-assignment-badge.duplicate{background:#e8f2ff;color:#1764b7!important}
      .finance-attendance-assignment-footer{position:sticky;bottom:8px;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 13px;border:1px solid #bcd8ca;border-radius:11px;background:#f5fbf7;box-shadow:0 8px 24px #173f5524}
      .finance-attendance-assignment-footer b{display:block;color:#174b3b;font-size:13px}
      .finance-attendance-assignment-footer span{display:block;margin-top:2px;color:#6f8279;font-size:11px}
      .finance-attendance-assignment-footer-actions{display:flex;gap:7px}
      .finance-attendance-assignment-owner-note{margin:0;padding:13px;border:1px solid #dce5ed;border-radius:10px;background:#f7f9fb;color:#5e7181;font-size:12px;line-height:1.5}
      @media(max-width:980px){
        .finance-assignment-grid-head{display:none}
        .finance-assignment-row{grid-template-columns:repeat(3,minmax(0,1fr))}
        .finance-assignment-cell small{display:block;margin-bottom:4px;color:#74867e;font-size:9px;font-weight:900;letter-spacing:.04em}
        .finance-assignment-destination{grid-column:1/-1}
      }
      @media(max-width:700px){
        .finance-attendance-assignment{padding:11px}
        .finance-attendance-assignment-head,.finance-attendance-assignment-footer{align-items:stretch;flex-direction:column}
        .finance-attendance-assignment-controls{grid-template-columns:1fr}
        .finance-attendance-assignment-controls .btn{width:100%;min-height:44px}
        .finance-assignment-bulk{grid-template-columns:1fr}
        .finance-assignment-bulk .btn{width:100%;min-height:44px}
        .finance-assignment-row{grid-template-columns:1fr 1fr;gap:10px}
        .finance-assignment-person,.finance-assignment-destination{grid-column:1/-1}
        .finance-assignment-row select{min-height:46px;font-size:16px}
        .finance-attendance-assignment-footer{position:static}
        .finance-attendance-assignment-footer-actions{display:grid;grid-template-columns:1fr 1fr;width:100%}
        .finance-attendance-assignment-footer-actions .btn{min-height:46px}
      }
      @media(max-width:360px){
        .finance-assignment-row{grid-template-columns:1fr}
        .finance-assignment-person,.finance-assignment-destination{grid-column:auto}
        .finance-attendance-assignment-footer-actions{grid-template-columns:1fr}
      }
    </style>`)
  }

  function rowMarkup(row){
    let key=assignmentKey(row),records=unresolvedRecords(row),duplicate=records.length!==1,selected=duplicate?'':draft.get(key)||'',demo=isPossibleDemo(row);
    return `<article class="finance-assignment-row ${selected?'ready':''}" data-assignment-row data-search="${escapeHtml(String(row.employee.name||'').toLocaleLowerCase('pt-BR'))}">
      <div class="finance-assignment-cell"><small>DATA</small><b>${dateBR(row.assignment.date)}</b><span>${escapeHtml(row.attendance?.status||'Sem status')}</span></div>
      <div class="finance-assignment-cell finance-assignment-person"><small>PROFISSIONAL</small><b>${escapeHtml(row.employee.name||'Funcionário')}</b><span>${escapeHtml(row.employee.role||'Função não informada')}</span>${demo?'<span class="finance-assignment-badge">Possível demonstração — revisar</span>':''}${duplicate?`<span class="finance-assignment-badge duplicate">${records.length} registros no mesmo dia — revisão individual necessária</span>`:''}</div>
      <div class="finance-assignment-cell"><small>STATUS</small><b>${escapeHtml(row.attendance?.status||'—')}</b><span>não será alterado</span></div>
      <div class="finance-assignment-cell"><small>DIÁRIA</small><b>${money(row.daily)}</b><span>valor histórico</span></div>
      <div class="finance-assignment-cell"><small>CUSTO</small><b>${money(row.value)}</b><span>${row.units?`${String(row.units).replace('.',',')} diária(s)`:'sem custo'}</span></div>
      <div class="finance-assignment-cell finance-assignment-destination"><small>OBRA CORRETA</small><select data-assignment-key="${escapeHtml(key)}" aria-label="Escolher obra para ${escapeHtml(row.employee.name||'funcionário')}" onchange="financeAttendanceAssignmentDraftChange(this)" ${duplicate?'disabled title="Existem registros repetidos neste dia; nada será alterado automaticamente."':''}>${duplicate?'<option value="">Revisar registros repetidos primeiro</option>':workOptions(selected)}</select></div>
    </article>`
  }

  function groupMarkup(date,rows,index){
    let total=rows.reduce((sum,row)=>sum+Number(row.value||0),0);
    return `<details class="finance-assignment-group" data-assignment-group ${index===0?'open':''}><summary><b>${dateBR(date)}</b><span>${rows.length} profissional(is) · ${money(total)}</span></summary><div class="finance-assignment-group-body"><div class="finance-assignment-bulk"><select aria-label="Obra para todos os registros de ${dateBR(date)}">${workOptions('')}</select><button class="btn sm alt" type="button" data-assignment-date="${escapeHtml(date)}" onclick="financeAttendanceAssignmentApplyDate(this)">Aplicar nas linhas visíveis desta data</button></div><div class="finance-assignment-grid-head"><span>Data</span><span>Profissional</span><span>Status</span><span>Diária</span><span>Custo</span><span>Obra correta</span></div>${rows.map(rowMarkup).join('')}</div></details>`
  }

  function reviewMarkup(){
    installStyle();
    let rows=assignmentRows(),dates=[...new Set(rows.map(row=>row.assignment.date))].sort((a,b)=>String(b).localeCompare(String(a)));
    if(dateFilter&&!dates.includes(dateFilter))dateFilter='';
    let visible=dateFilter?rows.filter(row=>row.assignment.date===dateFilter):rows;
    let groups=[...new Set(visible.map(row=>row.assignment.date))].sort((a,b)=>String(b).localeCompare(String(a)));
    let total=rows.reduce((sum,row)=>sum+Number(row.value||0),0),professionals=new Set(rows.map(row=>row.assignment.employeeId)).size;
    if(!assignmentAllowed())return `<section class="finance-attendance-assignment" id="financeAttendanceAssignmentReview"><div class="finance-attendance-assignment-head"><div><h4>Revisar presenças sem obra</h4><p>Os registros continuam visíveis, mas somente o proprietário da empresa pode alterar o vínculo com uma obra.</p></div></div><p class="finance-attendance-assignment-owner-note">Seu acesso permite consultar estes valores. Nenhuma alteração pode ser feita por este perfil.</p></section>`;
    if(!rows.length)return `<section class="finance-attendance-assignment" id="financeAttendanceAssignmentReview"><div class="finance-attendance-assignment-head"><div><h4>Presenças organizadas</h4><p>Não existe nenhuma presença aguardando vínculo com uma obra.</p></div></div></section>`;
    return `<section class="finance-attendance-assignment" id="financeAttendanceAssignmentReview">
      <div class="finance-attendance-assignment-head"><div><h4>Revisar presenças sem obra</h4><p>Escolha a obra correta em cada linha. Nada será alterado enquanto você não tocar em “Revisar e salvar”.</p></div><button class="btn sm alt" type="button" onclick="financeAttendanceAssignmentClear()">Limpar escolhas</button></div>
      <div class="finance-attendance-assignment-warning"><b>Proteção dos seus dados:</b> status, data, diária, custo, escala, pagamentos e histórico permanecem iguais. Registros de demonstração não serão excluídos automaticamente. Obras arquivadas ficam somente para consulta e não podem receber novos vínculos.</div>
      ${hasCompanyCloudSession()?'<div class="finance-attendance-assignment-owner-note"><b>Prévia local segura:</b> você pode conferir e escolher as obras, mas o salvamento online está bloqueado nesta etapa. Nenhum dado da empresa será alterado.</div>':''}
      <div class="finance-attendance-assignment-controls"><label>Mostrar data<select onchange="financeAttendanceAssignmentSetDate(this.value)"><option value="">Todas as datas</option>${dates.map(date=>`<option value="${escapeHtml(date)}" ${date===dateFilter?'selected':''}>${dateBR(date)}</option>`).join('')}</select></label><label>Buscar profissional<input type="search" value="${escapeHtml(searchFilter)}" placeholder="Digite o nome" oninput="financeAttendanceAssignmentFilter(this.value)"></label><button class="btn sm alt" type="button" onclick="financeAttendanceAssignmentRefresh()">Atualizar lista</button></div>
      <div class="finance-assignment-groups">${groups.map((date,index)=>groupMarkup(date,visible.filter(row=>row.assignment.date===date),index)).join('')}</div>
      <div class="finance-attendance-assignment-footer"><div><b id="financeAttendanceAssignmentDraftLabel">Nenhuma alteração escolhida</b><span>${rows.length} presença(s) sem obra · ${professionals} profissional(is) · custo confirmado ${money(total)}</span></div><div class="finance-attendance-assignment-footer-actions"><button class="btn sm alt" type="button" onclick="financeAttendanceAssignmentClear()">Cancelar escolhas</button><button class="btn sm" id="financeAttendanceAssignmentSaveButton" type="button" onclick="financeAttendanceAssignmentSave()" disabled>Revisar e salvar</button></div></div>
    </section>`
  }

  function updateDraftSummary(){
    let fresh=new Map(assignmentRows().map(row=>[assignmentKey(row),row])),valid=[];
    for(let [key,workId] of draft){
      let row=fresh.get(key),work=workById(workId);
      if(row&&row.unassigned&&work&&!work.archived&&unresolvedRecords(row).length===1)valid.push({row,work})
    }
    let total=valid.reduce((sum,item)=>sum+Number(item.row.value||0),0),hidden=valid.filter(item=>!rowMatchesCurrentFilters(item.row)).length,label=document.getElementById('financeAttendanceAssignmentDraftLabel'),button=document.getElementById('financeAttendanceAssignmentSaveButton');
    if(label)label.textContent=valid.length?`${valid.length} atribuição(ões) pronta(s) · ${money(total)}${hidden?` · ${hidden} fora do filtro atual`:''}`:'Nenhuma alteração escolhida';
    if(button)button.disabled=!valid.length
  }

  function refreshPanel(){
    let panel=document.getElementById('financeAttendanceAssignmentReview');
    if(panel)panel.outerHTML=reviewMarkup();
    setTimeout(()=>{filterRows(searchFilter);updateDraftSummary()},0)
  }

  function draftChange(select){
    if(!assignmentAllowed()){alert('Somente o proprietário pode atribuir estas presenças.');return refreshPanel()}
    let key=String(select?.dataset?.assignmentKey||''),workId=String(select?.value||''),row=new Map(assignmentRows().map(item=>[assignmentKey(item),item])).get(key);
    if(!key)return;
    if(!row||unresolvedRecords(row).length!==1){draft.delete(key);alert('Este profissional possui registros repetidos no mesmo dia. Por segurança, nada foi alterado automaticamente.');return refreshPanel()}
    if(workId)draft.set(key,workId);else draft.delete(key);
    select.closest('.finance-assignment-row')?.classList.toggle('ready',!!workId);
    updateDraftSummary()
  }

  function applyDate(button){
    if(!assignmentAllowed())return alert('Somente o proprietário pode atribuir estas presenças.');
    let date=String(button?.dataset?.assignmentDate||''),select=button?.parentElement?.querySelector('select'),workId=String(select?.value||''),work=workById(workId);
    if(!workId||!work||work.archived)return alert('Escolha uma obra disponível antes de aplicar.');
    let eligible=assignmentRows().filter(row=>row.assignment.date===date&&rowMatchesCurrentFilters(row)&&unresolvedRecords(row).length===1);
    assignmentRows().filter(row=>row.assignment.date===date&&unresolvedRecords(row).length!==1).forEach(row=>draft.delete(assignmentKey(row)));
    eligible.forEach(row=>draft.set(assignmentKey(row),workId));
    if(!eligible.length)return alert('Nesta data, todos os registros exigem revisão individual e nada foi preparado para salvar.');
    refreshPanel()
  }

  function setDate(value){
    dateFilter=String(value||'');
    refreshPanel()
  }

  function normalizeSearch(value){
    return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim()
  }

  function rowMatchesCurrentFilters(row){
    if(dateFilter&&row.assignment.date!==dateFilter)return false;
    let needle=normalizeSearch(searchFilter);
    return !needle||normalizeSearch(row.employee?.name).includes(needle)
  }

  function filterRows(value){
    searchFilter=String(value||'');
    let panel=document.getElementById('financeAttendanceAssignmentReview'),needle=normalizeSearch(searchFilter);
    if(!panel)return;
    panel.querySelectorAll('[data-assignment-row]').forEach(row=>{
      row.hidden=!!needle&&!normalizeSearch(row.dataset.search).includes(needle)
    });
    panel.querySelectorAll('[data-assignment-group]').forEach(group=>{
      group.hidden=![...group.querySelectorAll('[data-assignment-row]')].some(row=>!row.hidden)
    });
    updateDraftSummary()
  }

  function clearDraft(){
    draft.clear();
    refreshPanel()
  }

  function restoreSnapshots(snapshots){
    snapshots.forEach(snapshot=>{
      snapshot.record.workId=snapshot.workId;
      if(snapshot.hadHistory)snapshot.record.workAssignmentHistory=snapshot.history;
      else delete snapshot.record.workAssignmentHistory
    })
  }

  async function saveAssignments(){
    if(!assignmentAllowed())return alert('Somente o proprietário pode salvar estas atribuições.');
    let freshRows=assignmentRows(),fresh=new Map(freshRows.map(row=>[assignmentKey(row),row])),plans=[],ignored=0;
    for(let [key,workId] of draft){
      let row=fresh.get(key),work=workById(workId);
      if(!row||!row.unassigned||!work||work.archived){ignored++;continue}
      let records=unresolvedRecords(row);
      if(records.length!==1){ignored++;continue}
      plans.push({key,row,work,records})
    }
    if(!plans.length)return alert('Nenhuma escolha válida está pronta para salvar. Atualize a lista e tente novamente.');
    if(hasCompanyCloudSession())return alert('Esta é uma prévia local. A gravação online ficará bloqueada até a proteção exclusiva do proprietário ser ativada no servidor. Nenhum dado foi alterado.');
    let logicalCount=plans.length,recordCount=plans.reduce((sum,plan)=>sum+plan.records.length,0),total=plans.reduce((sum,plan)=>sum+Number(plan.row.value||0),0),byWork=new Map();
    plans.forEach(plan=>{let item=byWork.get(plan.work.id)||{name:plan.work.name,count:0};item.count++;byWork.set(plan.work.id,item)});
    let destinations=[...byWork.values()].map(item=>`• ${item.name}: ${item.count} presença(s)`).join('\n'),reviewLines=plans.slice(0,15).map(plan=>`• ${dateBR(plan.row.assignment.date)} · ${plan.row.employee.name} → ${plan.work.name}`).join('\n'),more=plans.length>15?`\n• e mais ${plans.length-15} presença(s) já contabilizada(s) acima.`:'';
    let message=`Confirmar a atribuição de ${logicalCount} presença(s) (${recordCount} registro(s) preservado(s))?\n\nDESTINOS\n${destinations}\n\nREVISÃO\n${reviewLines}${more}\n\nCusto total organizado: ${money(total)}.\n\nStatus, datas, diárias, valores, escala e pagamentos não serão alterados.`;
    if(!confirm(message))return;
    try{
      let records=plans.flatMap(plan=>plan.records.map(record=>({attendanceIndex:(db.attendance||[]).indexOf(record),id:record.id||'',employeeId:record.employeeId,date:record.date,workId:record.workId||'',workAssignmentHistory:record.workAssignmentHistory||[]})));
      localStorage.setItem(scopedBackupKey(),JSON.stringify({savedAt:new Date().toISOString(),userId:typeof CloudSync!=='undefined'?CloudSync?.session?.user?.id||'local':'local',companyId:typeof CompanyWorkspace!=='undefined'?CompanyWorkspace.current?.id||'local':'local',records}))
    }catch(error){
      alert('A alteração foi cancelada porque não foi possível criar o backup de segurança neste aparelho.');
      return
    }
    let beforeGross=financeAttendanceLaborRows().reduce((sum,row)=>sum+Number(row.value||0),0),beforeUnassigned=financeAttendanceLaborRows().filter(row=>row.unassigned).reduce((sum,row)=>sum+Number(row.value||0),0),beforeCount=(db.attendance||[]).length,now=new Date().toISOString(),snapshots=[],auditBefore=JSON.parse(JSON.stringify(db.audit||[])),committed=false;
    try{
      plans.forEach(plan=>plan.records.forEach(record=>{
        let hadHistory=Object.prototype.hasOwnProperty.call(record,'workAssignmentHistory'),history=hadHistory?JSON.parse(JSON.stringify(record.workAssignmentHistory||[])):undefined,previous=record.workId||'';
        snapshots.push({record,workId:record.workId,hadHistory,history});
        record.workAssignmentHistory=[...(record.workAssignmentHistory||[]),{at:now,fromWorkId:previous,toWorkId:plan.work.id,source:'Revisão manual no Financeiro'}];
        record.workId=plan.work.id
      }));
      let afterRows=financeAttendanceLaborRows(),afterGross=afterRows.reduce((sum,row)=>sum+Number(row.value||0),0),afterUnassigned=afterRows.filter(row=>row.unassigned).reduce((sum,row)=>sum+Number(row.value||0),0),expectedUnassigned=beforeUnassigned-total;
      if((db.attendance||[]).length!==beforeCount||Math.abs(afterGross-beforeGross)>.009||Math.abs(afterUnassigned-expectedUnassigned)>.009)throw new Error('A conferência encontrou uma diferença inesperada.');
      let detail=`${logicalCount} presença(s) · ${recordCount} registro(s) preservado(s) · ${money(total)} organizado`;
      let saveResult=save('Presenças atribuídas às obras',detail);
      if(saveResult===false)throw new Error('Seu perfil não permite salvar esta alteração.');
      committed=true
    }catch(error){
      restoreSnapshots(snapshots);
      db.audit=auditBefore;
      try{localStorage.setItem('controleObraV1',JSON.stringify(db))}catch(restoreError){}
      alert(`${error.message||'Não foi possível concluir a alteração'} Nenhum dado do lote foi mantido.`);
      return
    }
    if(!committed)return;
    draft.clear();
    render();
    let cloudMessage='Salvo neste aparelho.';
    try{
      if(typeof CloudSync!=='undefined'&&CloudSync?.ready&&typeof CloudSync.flush==='function'){
        await CloudSync.flush(true);
        cloudMessage=CloudSync.status==='Salvo na nuvem'?'Salvo e confirmado na nuvem.':'Salvo neste aparelho; a nuvem continuará tentando sincronizar.'
      }
    }catch(error){
      cloudMessage='Salvo neste aparelho; a sincronização com a nuvem ficou pendente.'
    }
    alert(`${logicalCount} presença(s) foram atribuídas com segurança. ${ignored?`${ignored} escolha(s) desatualizada(s) foram ignoradas. `:''}${cloudMessage}`);
    setTimeout(()=>{
      if(page==='financial'&&assignmentRows().length)openFinanceWorkGuide(FINANCE_UNASSIGNED_WORK.id)
    },80)
  }

  function unassignedGuide(row){
    installStyle();
    let rows=assignmentRows(),dates=rows.map(item=>item.assignment.date).sort(),from=dates[0]||'',to=dates.at(-1)||'',professionals=new Set(rows.map(item=>item.assignment.employeeId)).size;
    return `<section class="finance-work-guide-panel"><div class="finance-work-guide-toolbar"><div class="finance-work-guide-head"><div><small>ORGANIZAÇÃO DA MÃO DE OBRA</small><h3>⚠️ Presenças sem obra atribuída</h3><p>Estes valores vêm de presenças reais que ainda não indicam em qual obra o profissional trabalhou.</p></div></div><button class="btn alt sm" type="button" onclick="closeFinanceWorkGuide('${FINANCE_UNASSIGNED_WORK.id}')">Fechar guia</button></div><div class="finance-work-guide-metrics"><article><small>PRESENÇAS PARA REVISAR</small><b>${rows.length}</b></article><article><small>CUSTO CONFIRMADO</small><b>${money(row.labor)}</b></article><article><small>PROFISSIONAIS</small><b>${professionals}</b></article><article><small>PERÍODO</small><b>${from?`${dateBR(from)} a ${dateBR(to)}`:'—'}</b></article></div>${reviewMarkup()}${row.labor?workCashHistoryMarkup(row):''}</section>`
  }

  const guideBeforeAssignmentReview=financeWorkGuideMarkup;
  financeWorkGuideMarkup=function(row){
    return row?.unassigned?unassignedGuide(row):guideBeforeAssignmentReview(row)
  };

  Object.assign(window,{
    financeAttendanceAssignmentDraftChange:draftChange,
    financeAttendanceAssignmentApplyDate:applyDate,
    financeAttendanceAssignmentSetDate:setDate,
    financeAttendanceAssignmentFilter:filterRows,
    financeAttendanceAssignmentClear:clearDraft,
    financeAttendanceAssignmentRefresh:refreshPanel,
    financeAttendanceAssignmentSave:saveAssignments
  })
})();
