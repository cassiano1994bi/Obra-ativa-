-- ObraAtiva — contratos SQL da central administrativa do produto.
-- O administrador comercial gerencia assinatura e atendimento, sem ler o
-- conteúdo operacional armazenado em company_app_state.

begin;

create or replace function public.normalized_subscription_plan(p_plan text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case lower(trim(coalesce(p_plan,'')))
    when 'essencial' then 'essential'
    when 'construtora' then 'builder'
    when 'profissional' then 'professional'
    when 'personalizado' then 'custom'
    when 'essential' then 'essential'
    when 'builder' then 'builder'
    when 'professional' then 'professional'
    when 'custom' then 'custom'
    when 'administrator' then 'administrator'
    else null
  end;
$$;

create or replace function public.admin_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_sales_admin() then raise exception 'Acesso administrativo negado.' using errcode='42501'; end if;
  return jsonb_build_object(
    'companies',(select count(*) from public.companies where status='active'),
    'trials_active',(select count(*) from public.subscriptions where status='trial' and coalesce(trial_ends_at,now()+interval '1 day')>now()),
    'paid_active',(select count(*) from public.subscriptions where status='active'),
    'attention',(select count(*) from public.subscriptions where status in ('payment_due','suspended','cancelled') or (status='trial' and trial_ends_at<=now())),
    'new_leads',(select count(*) from public.sales_leads where status in ('Novo contato','Em conversa','Pagamento pendente')),
    'open_support',(select count(*) from public.sales_leads where status='Em atendimento')
  );
end;
$$;

create or replace function public.admin_list_companies_with_presence(p_search text default '')
returns table(
  company_id uuid,company_name text,responsible text,owner_email text,
  last_seen_at timestamptz,online_users bigint,plan text,
  subscription_status text,ends_at timestamptz,members bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_sales_admin() then raise exception 'Acesso administrativo negado.' using errcode='42501'; end if;
  return query
  select c.id,c.name,c.responsible_name,owner.email,
    max(m.last_seen_at),count(*) filter(where m.status='active' and m.last_seen_at>now()-interval '3 minutes'),
    s.plan,s.status,
    case when s.status='trial' then s.trial_ends_at else s.current_period_ends_at end,
    count(*) filter(where m.status='active')
  from public.companies c
  left join public.company_members m on m.company_id=c.id
  left join public.company_members owner on owner.company_id=c.id and owner.role::text='owner' and owner.status='active'
  left join public.subscriptions s on s.company_id=c.id
  where trim(coalesce(p_search,''))='' or c.name ilike '%'||trim(p_search)||'%'
    or coalesce(c.responsible_name,'') ilike '%'||trim(p_search)||'%'
    or coalesce(owner.email,'') ilike '%'||trim(p_search)||'%'
  group by c.id,c.name,c.responsible_name,owner.email,s.plan,s.status,s.trial_ends_at,s.current_period_ends_at
  order by c.created_at desc;
end;
$$;

create or replace function public.admin_list_sales_leads()
returns setof public.sales_leads
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_sales_admin() then raise exception 'Acesso administrativo negado.' using errcode='42501'; end if;
  return query select * from public.sales_leads order by updated_at desc;
end;
$$;

create or replace function public.admin_list_audit(p_limit integer default 50)
returns setof public.admin_audit_log
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_sales_admin() then raise exception 'Acesso administrativo negado.' using errcode='42501'; end if;
  return query select * from public.admin_audit_log order by created_at desc limit greatest(1,least(coalesce(p_limit,50),200));
end;
$$;

create or replace function public.admin_update_company_subscription(
  p_company_id uuid,p_plan text,p_status text,p_days integer default 30
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan text := public.normalized_subscription_plan(p_plan);
  v_previous public.subscriptions%rowtype;
  v_end timestamptz;
begin
  if not public.is_sales_admin() then raise exception 'Acesso administrativo negado.' using errcode='42501'; end if;
  if v_plan is null or p_status not in ('active','suspended') or p_days not between 1 and 3660 then
    raise exception 'Parâmetros de assinatura inválidos.' using errcode='22023';
  end if;
  if not exists(select 1 from public.companies where id=p_company_id) then raise exception 'Empresa não encontrada.' using errcode='P0002'; end if;
  select * into v_previous from public.subscriptions where company_id=p_company_id for update;
  v_end := case when p_status='active' then now()+make_interval(days=>p_days) else v_previous.current_period_ends_at end;
  insert into public.subscriptions(company_id,plan,status,current_period_ends_at,grace_ends_at,updated_by,updated_at)
  values(p_company_id,v_plan,p_status,v_end,null,auth.uid(),now())
  on conflict(company_id) do update set plan=excluded.plan,status=excluded.status,
    current_period_ends_at=excluded.current_period_ends_at,grace_ends_at=excluded.grace_ends_at,
    updated_by=excluded.updated_by,updated_at=excluded.updated_at;
  insert into public.subscription_history(company_id,previous_plan,new_plan,previous_status,new_status,note,changed_by)
  values(p_company_id,v_previous.plan,v_plan,v_previous.status,p_status,'Alteração pela central administrativa.',auth.uid());
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,details)
  values(auth.uid(),'subscription_updated','company',p_company_id::text,jsonb_build_object('plan',v_plan,'status',p_status,'days',p_days));
  return true;
end;
$$;

create or replace function public.admin_set_subscription(customer_email text,customer_plan text,days_active integer default 30)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_company_id uuid;
begin
  if not public.is_sales_admin() then raise exception 'Acesso administrativo negado.' using errcode='42501'; end if;
  select m.company_id into v_company_id from public.company_members m
  where lower(m.email)=lower(trim(customer_email)) and m.role::text='owner' and m.status='active' limit 1;
  if v_company_id is null then raise exception 'Empresa não encontrada para este e-mail.' using errcode='P0002'; end if;
  return public.admin_update_company_subscription(v_company_id,customer_plan,'active',days_active);
end;
$$;

create or replace function public.admin_save_sales_lead(
  p_id uuid,p_name text,p_email text,p_company text,p_phone text,p_plan text,
  p_status text,p_notes text,p_next_action_at date
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid := coalesce(p_id,gen_random_uuid());
begin
  if not public.is_sales_admin() then raise exception 'Acesso administrativo negado.' using errcode='42501'; end if;
  if char_length(trim(coalesce(p_name,''))) not between 2 and 160 then raise exception 'Nome inválido.' using errcode='22023'; end if;
  insert into public.sales_leads(id,name,email,company,phone,plan,status,notes,next_action_at,created_by,updated_by)
  values(v_id,trim(p_name),nullif(lower(trim(p_email)),''),nullif(trim(p_company),''),nullif(trim(p_phone),''),
    nullif(trim(p_plan),''),coalesce(nullif(trim(p_status),''),'Novo contato'),left(coalesce(p_notes,''),4000),p_next_action_at,auth.uid(),auth.uid())
  on conflict(id) do update set name=excluded.name,email=excluded.email,company=excluded.company,
    phone=excluded.phone,plan=excluded.plan,status=excluded.status,notes=excluded.notes,
    next_action_at=excluded.next_action_at,updated_by=auth.uid(),updated_at=now();
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,details)
  values(auth.uid(),'sales_lead_saved','sales_lead',v_id::text,jsonb_build_object('status',p_status));
  return v_id;
end;
$$;

create or replace function public.admin_delete_sales_lead(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_sales_admin() then raise exception 'Acesso administrativo negado.' using errcode='42501'; end if;
  delete from public.sales_leads where id=p_id;
  if found then
    insert into public.admin_audit_log(actor_user_id,action,target_type,target_id)
    values(auth.uid(),'sales_lead_deleted','sales_lead',p_id::text);
    return true;
  end if;
  return false;
end;
$$;

revoke all on function public.normalized_subscription_plan(text) from public, anon;
grant execute on function public.normalized_subscription_plan(text) to authenticated;

revoke all on function public.admin_dashboard_summary(),
  public.admin_list_companies_with_presence(text),public.admin_list_sales_leads(),
  public.admin_list_audit(integer),public.admin_update_company_subscription(uuid,text,text,integer),
  public.admin_set_subscription(text,text,integer),
  public.admin_save_sales_lead(uuid,text,text,text,text,text,text,text,date),
  public.admin_delete_sales_lead(uuid) from public, anon;
grant execute on function public.admin_dashboard_summary(),
  public.admin_list_companies_with_presence(text),public.admin_list_sales_leads(),
  public.admin_list_audit(integer),public.admin_update_company_subscription(uuid,text,text,integer),
  public.admin_set_subscription(text,text,integer),
  public.admin_save_sales_lead(uuid,text,text,text,text,text,text,text,date),
  public.admin_delete_sales_lead(uuid) to authenticated;

commit;
