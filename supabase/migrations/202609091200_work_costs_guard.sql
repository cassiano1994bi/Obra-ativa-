-- Preparação local: não executar em produção antes da aprovação desta atualização.
-- Apenas valida futuras gravações no estado existente. Não importa ou altera dados.
begin;
create or replace function public.work_costs_guard()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare work jsonb; previous_work jsonb; contract jsonb; expense jsonb; previous_expense jsonb;
  assignment jsonb; previous_assignment jsonb; old_db jsonb := '{}'::jsonb;
  finance_access boolean; enabled boolean; total_paid numeric;
begin
  if tg_op='UPDATE' then old_db:=coalesce(old.data->'db','{}'); end if;
  finance_access:=auth.uid() is null or 'financial'=any(public.company_allowed_modules(new.company_id));
  enabled:=exists(select 1 from jsonb_array_elements(coalesce(new.data#>'{db,works}','[]')) w where jsonb_array_length(coalesce(w#>'{control,empreitas}','[]'))>0)
    or exists(select 1 from jsonb_array_elements(coalesce(new.data#>'{db,otherExpenses}','[]')) e where e->>'costType' in ('extra','contractPayment'))
    or exists(select 1 from jsonb_array_elements(coalesce(old_db->'works','[]')) w where jsonb_array_length(coalesce(w#>'{control,empreitas}','[]'))>0);
  if enabled and auth.uid() is not null and current_setting('app.work_control_checked',true) is distinct from new.company_id::text then
    raise exception using errcode='40001',message='Atualize o aplicativo antes de salvar empreitas e custos. O controle de revisão é obrigatório.';
  end if;
  for work in select w from jsonb_array_elements(coalesce(new.data#>'{db,works}','[]')) w loop
    previous_work:=null;
    select w into previous_work from jsonb_array_elements(coalesce(old_db->'works','[]')) w where w->>'id'=work->>'id' limit 1;
    if not finance_access and coalesce(work#>'{control,empreitas}','[]') is distinct from coalesce(previous_work#>'{control,empreitas}','[]') then
      raise exception using errcode='42501',message='Seu perfil não permite alterar valores de empreitas.';
    end if;
    if exists(select 1 from jsonb_array_elements(coalesce(work#>'{control,empreitas}','[]')) c group by c->>'id' having count(*)>1) then raise exception 'Empreita duplicada.'; end if;
    for contract in select c from jsonb_array_elements(coalesce(work#>'{control,empreitas}','[]')) c loop
      if coalesce(contract->>'id','')='' or contract->>'workId' is distinct from work->>'id'
        or (contract->>'companyId' is not null and contract->>'companyId'<>new.company_id::text) then raise exception 'Empreita fora da obra ou empresa.'; end if;
      if coalesce(trim(contract->>'name'),'')='' or coalesce(trim(contract->>'responsible'),'')='' then raise exception 'Informe serviço e responsável da empreita.'; end if;
      if jsonb_typeof(contract->'total') is distinct from 'number' then raise exception 'Valor da empreita inválido.'; end if;
      if (contract->>'total')::numeric<=0 or (contract->>'total')::numeric>1000000000 or round((contract->>'total')::numeric,2)<>(contract->>'total')::numeric then raise exception 'Valor da empreita inválido.'; end if;
      if not coalesce(contract->>'mode','') in ('fixed','meters') then raise exception 'Forma de cálculo da empreita inválida.'; end if;
      if contract->>'mode'='meters' then
        if jsonb_typeof(contract->'quantity') is distinct from 'number' or jsonb_typeof(contract->'unitPrice') is distinct from 'number' then raise exception 'Metragem e preço inválidos.'; end if;
        if (contract->>'quantity')::numeric<=0 or (contract->>'unitPrice')::numeric<=0 or round((contract->>'quantity')::numeric*(contract->>'unitPrice')::numeric,2)<>(contract->>'total')::numeric then raise exception 'Total não corresponde à metragem.'; end if;
      end if;
      if coalesce(contract->>'phaseId','')<>'' and not exists(select 1 from jsonb_array_elements(coalesce(new.data#>'{db,workPhases}','[]')) p where p->>'id'=contract->>'phaseId' and p->>'workId'=work->>'id')
        and not exists(select 1 from jsonb_array_elements(coalesce(previous_work#>'{control,empreitas}','[]')) p where p->>'id'=contract->>'id' and p->>'phaseId'=contract->>'phaseId') then raise exception 'Fase da empreita não pertence à obra.'; end if;
      select coalesce(sum((e->>'value')::numeric),0) into total_paid from jsonb_array_elements(coalesce(new.data#>'{db,otherExpenses}','[]')) e where e->>'costType'='contractPayment' and e->>'workId'=work->>'id' and e->>'contractId'=contract->>'id';
      if total_paid>(contract->>'total')::numeric then raise exception 'Pagamentos ultrapassam o valor da empreita.'; end if;
    end loop;
  end loop;
  if exists(select 1 from jsonb_array_elements(coalesce(new.data#>'{db,otherExpenses}','[]')) e where e->>'costType' in ('extra','contractPayment') group by e->>'id' having count(*)>1) then raise exception 'Lançamento de custo duplicado.'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(new.data#>'{db,otherExpenses}','[]')) e where e->>'costType' in ('extra','contractPayment') and coalesce(e->>'operationId','')<>'' group by e->>'workId',e->>'operationId' having count(*)>1) then raise exception 'Operação de custo duplicada.'; end if;
  for expense in select e from jsonb_array_elements(coalesce(new.data#>'{db,otherExpenses}','[]')) e where e->>'costType' in ('extra','contractPayment') loop
    if coalesce(expense->>'id','')='' or coalesce(expense->>'operationId','')='' or (expense->>'companyId' is not null and expense->>'companyId'<>new.company_id::text) then raise exception 'Identificador do custo inválido.'; end if;
    if jsonb_typeof(expense->'value') is distinct from 'number' then raise exception 'Valor do custo inválido.'; end if;
    if (expense->>'value')::numeric<=0 or (expense->>'value')::numeric>1000000000 or round((expense->>'value')::numeric,2)<>(expense->>'value')::numeric then raise exception 'Valor do custo inválido.'; end if;
    if coalesce(expense->>'date','')!~'^\d{4}-\d{2}-\d{2}$' or to_char((expense->>'date')::date,'YYYY-MM-DD')<>expense->>'date' then raise exception 'Data do custo inválida.'; end if;
    work:=null; select w into work from jsonb_array_elements(coalesce(new.data#>'{db,works}','[]')) w where w->>'id'=expense->>'workId' limit 1;
    if work is null then raise exception 'Obra do custo não encontrada.'; end if;
    if expense->>'costType'='contractPayment' and not exists(select 1 from jsonb_array_elements(coalesce(work#>'{control,empreitas}','[]')) c where c->>'id'=expense->>'contractId') then raise exception 'Pagamento não pertence a uma empreita desta obra.'; end if;
    previous_expense:=null; select e into previous_expense from jsonb_array_elements(coalesce(old_db->'otherExpenses','[]')) e where e->>'id'=expense->>'id' limit 1;
    if coalesce(expense->>'phaseId','')<>'' and not exists(select 1 from jsonb_array_elements(coalesce(new.data#>'{db,workPhases}','[]')) p where p->>'id'=expense->>'phaseId' and p->>'workId'=expense->>'workId')
      and not coalesce(previous_expense->>'phaseId'=expense->>'phaseId' and previous_expense->>'workId'=expense->>'workId',false) then raise exception 'Fase do custo não pertence à obra.'; end if;
    if expense->'proof' is not null and expense->'proof'<>'null'::jsonb then
      if length(expense#>>'{proof,data}')>220000 or coalesce(expense#>>'{proof,data}','')!~'^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$' then raise exception 'Comprovante inválido ou muito grande.'; end if;
    end if;
  end loop;
  for assignment in select d from jsonb_array_elements(coalesce(new.data#>'{db,distributions}','[]')) d where coalesce(d->>'contractId','')<>'' loop
    if not exists(select 1 from jsonb_array_elements(coalesce(new.data#>'{db,works}','[]')) w, lateral jsonb_array_elements(coalesce(w#>'{control,empreitas}','[]')) c where w->>'id'=assignment->>'workId' and c->>'id'=assignment->>'contractId') then raise exception 'Empreita da escala não pertence à obra.'; end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists work_costs_guard_before on public.company_app_state;
create trigger work_costs_guard_before before insert or update on public.company_app_state for each row execute function public.work_costs_guard();
revoke all on function public.work_costs_guard() from public,anon,authenticated;
commit;
