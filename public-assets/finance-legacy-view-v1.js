(()=>{
  if(window.__financeLegacyViewV1Installed)return;
  window.__financeLegacyViewV1Installed=true;

  function assignedLaborEntries(workId,from='',to=''){
    const unique=new Map();
    (db.distributions||[])
      .filter(item=>item?.workId===workId&&(!from||item.date>=from)&&(!to||item.date<=to))
      .forEach(item=>unique.set(`${item.employeeId}|${item.date}`,item));
    return [...unique.values()].map(assignment=>{
      const employee=emp(assignment.employeeId);
      const attendance=laborCostPresenceFor(assignment);
      const value=employee?dailyAt(employee,assignment.date)*attendancePresenceValue(attendance?.status):0;
      return {assignment,employee,attendance,value};
    }).filter(item=>item.employee&&item.value>0);
  }

  workClosingCost=function(workId,from='',to=''){
    return assignedLaborEntries(workId,from,to).reduce((total,item)=>total+item.value,0);
  };

  workCashLaborEntries=function(workId){
    return assignedLaborEntries(workId);
  };

  workCashRows=function(){
    return (db.works||[]).filter(work=>!work.archived).map(work=>{
      const received=workCashReceived(work.id);
      const labor=workCashLabor(work.id);
      const expected=workCashExpected(work.id);
      const cash=received-labor;
      return {
        work,
        received,
        labor,
        expected,
        cash,
        forecast:cash+expected,
        usesClosings:workClosingStore().some(item=>item.workId===work.id),
        entries:workCashEntries(work.id),
        unassigned:false
      };
    }).sort((a,b)=>b.cash-a.cash||String(a.work.name).localeCompare(String(b.work.name),'pt-BR'));
  };

  const dashboardWithAttendanceSource=unifiedCashDashboardMarkup;
  unifiedCashDashboardMarkup=function(){
    return dashboardWithAttendanceSource()
      .replace('<small>CUSTO BRUTO DA MÃO DE OBRA</small>','<small>MÃO DE OBRA</small>')
      .replace('CUSTO BRUTO DA MÃO DE OBRA','MÃO DE OBRA CONFIRMADA')
      .replace('todas as presenças confirmadas','escala com presença confirmada')
      .replace('O saldo usa todas as presenças. Valores sem obra na presença ou na escala aparecem em “Sem obra atribuída”.','O saldo acima considera somente o que entrou e a mão de obra confirmada daquela obra.')
      .replace('“Custo bruto da mão de obra” usa todas as presenças. Quando não existe obra na presença nem na escala, o valor aparece em “Sem obra atribuída”.','“Mão de obra confirmada” é o custo das diárias que a presença confirmou naquela obra.');
  };

  const comparisonWithAttendanceSource=financeFortnightComparisonMarkup;
  financeFortnightComparisonMarkup=function(){
    return comparisonWithAttendanceSource()
      .replace('Todas as presenças entram no custo; a escala identifica a obra.','Confira o que entrou e o custo confirmado da equipe na mesma quinzena.')
      .replace(/<p class="finance-fortnight-note">“Sem obra atribuída” reúne presenças sem vínculo com uma obra; nenhum registro foi descartado ou alterado\.<\/p>/,'');
  };
})();
