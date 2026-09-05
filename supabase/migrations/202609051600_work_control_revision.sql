-- Preparada para instalação futura. Não importar migrations históricas.
-- Reutiliza o estado, as permissões e os IDs vigentes; não copia dados de empresas.
begin;
alter table public.company_app_state add column if not exists work_control_revision bigint not null default 0;

create table if not exists public.work_control_events (
  company_id uuid not null references public.companies(id) on delete cascade,
  event_id text not null,
  work_id text not null,
  actor_id uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default clock_timestamp(),
  payload jsonb not null,
  primary key(company_id,event_id)
);
create index if not exists work_control_events_work_time_idx on public.work_control_events(company_id,work_id,recorded_at desc);
alter table public.work_control_events enable row level security;
revoke all on public.work_control_events from public,anon,authenticated;
grant select on public.work_control_events to authenticated;
create policy work_control_events_read on public.work_control_events for select to authenticated
  using (public.is_company_member(company_id) and 'works'=any(public.company_allowed_modules(company_id))
    and 'financial'=any(public.company_allowed_modules(company_id)));

create or replace function public.work_control_guard()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare enabled boolean; phase jsonb; assignment jsonb; work jsonb; previous_work jsonb; previous_phase jsonb; field text; financial_access boolean;
begin
  select exists(select 1 from jsonb_array_elements(coalesce(new.data#>'{db,works}','[]')) w
    where w#>>'{control,version}'='1') into enabled;
  enabled := enabled or exists(select 1 from jsonb_array_elements(coalesce(new.data#>'{db,workUpdates}','[]')) e where e->>'controlEvent'='true');
  if tg_op='UPDATE' then
    enabled := enabled or exists(select 1 from jsonb_array_elements(coalesce(old.data#>'{db,works}','[]')) w where w#>>'{control,version}'='1');
  end if;
  enabled := enabled or exists(select 1 from jsonb_array_elements(coalesce(new.data#>'{db,distributions}','[]')) d where coalesce(d->>'phaseId','')<>'');
  if tg_op='UPDATE' then
    enabled := enabled or exists(select 1 from jsonb_array_elements(coalesce(old.data#>'{db,distributions}','[]')) d where coalesce(d->>'phaseId','')<>'');
  end if;
  if enabled and auth.uid() is not null
     and current_setting('app.work_control_checked',true) is distinct from new.company_id::text then
    raise exception using errcode='40001',message='Atualize o aplicativo antes de salvar. Esta empresa usa o controle de revisão das obras.';
  end if;
  if enabled then
    financial_access := auth.uid() is null or 'financial'=any(public.company_allowed_modules(new.company_id));
    for work in select w from jsonb_array_elements(coalesce(new.data#>'{db,works}','[]')) w
    loop
      previous_work := null;
      if tg_op='UPDATE' then select w into previous_work from jsonb_array_elements(coalesce(old.data#>'{db,works}','[]')) w where w->>'id'=work->>'id' limit 1; end if;
      foreach field in array array['contractValue','budgetValue','priorReceived','priorCost'] loop
        if field=any(array['contractValue','budgetValue']) then
          if work#>array['control','plan',field] is not null and work#>array['control','plan',field]<>'null'::jsonb then
            if jsonb_typeof(work#>array['control','plan',field])<>'number' then raise exception 'Valor do planejamento inválido.'; end if;
            if (work#>>array['control','plan',field])::numeric<0 or (work#>>array['control','plan',field])::numeric>1000000000000 then raise exception 'Valor do planejamento inválido.'; end if;
          end if;
          if not financial_access and coalesce(work#>array['control','plan',field],'null') is distinct from coalesce(previous_work#>array['control','plan',field],'null') then raise exception using errcode='42501',message='Seu perfil não permite alterar o planejamento financeiro.'; end if;
        end if;
        if work#>array['control','baseline',field] is not null and work#>array['control','baseline',field]<>'null'::jsonb then
          if jsonb_typeof(work#>array['control','baseline',field])<>'number' then raise exception 'Valor do marco inválido.'; end if;
          if (work#>>array['control','baseline',field])::numeric<0 or (work#>>array['control','baseline',field])::numeric>1000000000000 then raise exception 'Valor do marco inválido.'; end if;
        end if;
        if not financial_access and coalesce(work#>array['control','baseline',field],'null') is distinct from coalesce(previous_work#>array['control','baseline',field],'null')
          and not (field=any(array['priorReceived','priorCost']) and work#>>'{control,baseline,entry}'='new' and work#>array['control','baseline',field]='0'::jsonb and previous_work#>'{control,baseline}' is null) then
          raise exception using errcode='42501',message='Seu perfil não permite alterar valores financeiros da obra.';
        end if;
      end loop;
    end loop;
    for phase in select p from jsonb_array_elements(coalesce(new.data#>'{db,workPhases}','[]')) p
    loop
      if phase->>'controlVersion'='1' then
      if jsonb_typeof(phase->'percent') is distinct from 'number'
         or (phase->>'percent')::numeric < 0 or (phase->>'percent')::numeric > 100
         or not coalesce(phase->>'status','')=any(array['Não iniciada','Programada','Em andamento','Pausada','Atrasada','Concluída']) then
        raise exception 'Percentual ou status de fase inválido.';
      end if;
      if ((phase->>'status')='Concluída') is distinct from ((phase->>'percent')::numeric=100) then raise exception 'Fase concluída deve ter 100 por cento.'; end if;
      if not exists(select 1 from jsonb_array_elements(coalesce(new.data#>'{db,works}','[]')) w where w->>'id'=phase->>'workId') then
        raise exception 'A fase deve pertencer a uma obra desta empresa.';
      end if;
      end if;
      previous_phase := null;
      if tg_op='UPDATE' then select p into previous_phase from jsonb_array_elements(coalesce(old.data#>'{db,workPhases}','[]')) p where p->>'id'=phase->>'id' limit 1; end if;
      if not financial_access and coalesce(phase->'budgetCost','null') is distinct from coalesce(previous_phase->'budgetCost','null') then raise exception using errcode='42501',message='Seu perfil não permite alterar o orçamento da fase.'; end if;
    end loop;
    for assignment in select d from jsonb_array_elements(coalesce(new.data#>'{db,distributions}','[]')) d where coalesce(d->>'phaseId','')<>'' loop
      if not exists(select 1 from jsonb_array_elements(coalesce(new.data#>'{db,workPhases}','[]')) p where p->>'id'=assignment->>'phaseId' and p->>'workId'=assignment->>'workId')
        and not (tg_op='UPDATE' and exists(select 1 from jsonb_array_elements(coalesce(old.data#>'{db,distributions}','[]')) d where d->>'id'=assignment->>'id' and d->>'workId'=assignment->>'workId' and d->>'employeeId'=assignment->>'employeeId' and d->>'phaseId'=assignment->>'phaseId')) then raise exception 'Fase da escala não pertence à obra.'; end if;
    end loop;
  end if;
  if tg_op='UPDATE' then new.work_control_revision:=old.work_control_revision+1;
  else new.work_control_revision:=1; end if;
  return new;
end;
$$;
create trigger work_control_guard_before before insert or update on public.company_app_state
for each row execute function public.work_control_guard();

create or replace function public.work_control_record_events()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb; previous_assignment jsonb; old_updates jsonb := '[]'::jsonb; old_assignments jsonb := '[]'::jsonb;
begin
  if tg_op='UPDATE' then old_updates:=coalesce(old.data#>'{db,workUpdates}','[]'); end if;
  if tg_op='UPDATE' then old_assignments:=coalesce(old.data#>'{db,distributions}','[]'); end if;
  for item in select e from jsonb_array_elements(coalesce(new.data#>'{db,workUpdates}','[]')) e
    where e->>'controlEvent'='true' and coalesce(e->>'id','')<>''
      and not exists(select 1 from jsonb_array_elements(old_updates) previous where previous->>'id'=e->>'id')
  loop
    if not exists(select 1 from jsonb_array_elements(coalesce(new.data#>'{db,works}','[]')) w where w->>'id'=item->>'workId') then raise exception 'Obra do histórico não encontrada.'; end if;
    insert into public.work_control_events(company_id,event_id,work_id,actor_id,payload)
    values(new.company_id,item->>'id',item->>'workId',auth.uid(),
      (item-'actorId'-'companyId')||jsonb_build_object('actorId',auth.uid(),'companyId',new.company_id))
    on conflict(company_id,event_id) do nothing;
  end loop;
  -- A escala pode ser gravada por um perfil sem permissão para editar Obras.
  -- O histórico desse vínculo é produzido aqui, sem alterar o JSON de Obras.
  for item in select d from jsonb_array_elements(coalesce(new.data#>'{db,distributions}','[]')) d where coalesce(d->>'phaseId','')<>'' loop
    select d into previous_assignment from jsonb_array_elements(old_assignments) d where d->>'id'=item->>'id' limit 1;
    if previous_assignment is null or (previous_assignment->>'phaseId',previous_assignment->>'workId',previous_assignment->>'date') is distinct from (item->>'phaseId',item->>'workId',item->>'date') then
      insert into public.work_control_events(company_id,event_id,work_id,actor_id,payload) values(new.company_id,'assignment:'||(item->>'id')||':'||new.work_control_revision,item->>'workId',auth.uid(),
        jsonb_build_object('kind','Equipe distribuída','title','Vínculo diário da equipe atualizado','phaseId',item->>'phaseId','description','Distribuição de '||(item->>'date')||' · funcionário '||(item->>'employeeId'),'date',current_date::text)) on conflict do nothing;
    end if;
  end loop;
  return new;
end;
$$;
create trigger work_control_record_after after insert or update on public.company_app_state
for each row execute function public.work_control_record_events();

create or replace function public.save_company_app_state_checked(p_company_id uuid,p_data jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare revision bigint; saved_at timestamptz;
begin
  if auth.uid() is null or not public.is_company_member(p_company_id) then raise exception using errcode='42501',message='Acesso da empresa não encontrado.'; end if;
  -- Serializa inclusive a criação inicial, sem bloquear empresas diferentes.
  perform pg_advisory_xact_lock(hashtextextended(p_company_id::text,41));
  select work_control_revision into revision from public.company_app_state where company_id=p_company_id for update;
  if coalesce(revision,0) is distinct from p_expected_revision then
    raise exception using errcode='40001',message='Outra sessão salvou alterações. Sua cópia local foi preservada; revise antes de tentar novamente.';
  end if;
  perform set_config('app.work_control_checked',p_company_id::text,true);
  saved_at:=public.save_company_app_state(p_company_id,p_data);
  select work_control_revision into revision from public.company_app_state where company_id=p_company_id;
  perform set_config('app.work_control_checked','',true);
  return jsonb_build_object('updated_at',saved_at,'revision',revision);
end;
$$;
revoke all on function public.save_company_app_state_checked(uuid,jsonb,bigint) from public,anon;
grant execute on function public.save_company_app_state_checked(uuid,jsonb,bigint) to authenticated;
revoke all on function public.work_control_guard(),public.work_control_record_events() from public,anon,authenticated;

-- Retorna somente metadados operacionais. Valores e snapshots financeiros não
-- são enviados a perfis sem Financeiro; autoria real vem do registro do servidor.
create or replace function public.read_work_control_history(p_company_id uuid,p_work_id text,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or not public.is_company_member(p_company_id)
    or not 'works'=any(public.company_allowed_modules(p_company_id)) then
    raise exception using errcode='42501',message='Acesso à obra não permitido.';
  end if;
  return coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id',event_id,'workId',work_id,'createdAt',recorded_at,'date',payload->>'date',
    'actorId',actor_id,'responsible',payload->>'responsible','kind',payload->>'kind',
    'title',payload->>'title','phaseId',payload->>'phaseId','previousPercent',payload->'previousPercent',
    'percent',payload->'percent','delta',payload->'delta','description',payload->>'description',
    'controlEvent',true,'serverRecorded',true))) from (
      select * from public.work_control_events where company_id=p_company_id and work_id=p_work_id
      order by recorded_at desc,event_id limit 200 offset greatest(0,least(coalesce(p_offset,0),100000))
    ) events),'[]'::jsonb);
end;
$$;
revoke all on function public.read_work_control_history(uuid,text,integer) from public,anon;
grant execute on function public.read_work_control_history(uuid,text,integer) to authenticated;
commit;
