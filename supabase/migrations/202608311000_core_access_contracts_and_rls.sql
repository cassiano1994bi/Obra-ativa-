-- ObraAtiva — contratos de acesso e RLS do núcleo.
--
-- Reaplica explicitamente as fronteiras por usuário/empresa depois de todas as
-- migrations históricas. Nenhuma política concede acesso global aos usuários do app.

begin;

create or replace function public.create_company_with_owner(
  company_name text,
  responsible text default null,
  company_whatsapp text default null,
  company_city text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_email text;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória.' using errcode = '42501'; end if;
  if char_length(trim(coalesce(company_name,''))) not between 2 and 120 then
    raise exception 'Nome da empresa inválido.' using errcode = '22023';
  end if;

  select lower(email) into v_email from auth.users where id = auth.uid();
  insert into public.companies(name,responsible_name,whatsapp,city,owner_user_id,created_by)
  values(trim(company_name),nullif(trim(responsible),''),nullif(trim(company_whatsapp),''),
    nullif(trim(company_city),''),auth.uid(),auth.uid())
  returning id into v_company_id;

  insert into public.company_members(company_id,user_id,email,role,status,permission_profile,permissions)
  values(v_company_id,auth.uid(),v_email,'owner','active','gerente',
    jsonb_build_object('modules',jsonb_build_array('works','clients','team','planning','attendance','payments','financial','vehicles','reports')));
  insert into public.company_app_state(company_id,data,updated_by)
  values(v_company_id,'{}'::jsonb,auth.uid());
  insert into public.subscriptions(company_id,plan,status,trial_started_at,trial_ends_at)
  values(v_company_id,'essential','trial',now(),now() + interval '14 days');
  insert into public.usage_metrics(company_id,active_users) values(v_company_id,1);
  return v_company_id;
end;
$$;

create or replace function public.current_company_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_subscription public.subscriptions%rowtype;
  v_allowed boolean := false;
  v_mode text := 'blocked';
  v_ends_at timestamptz;
begin
  if auth.uid() is null then
    return jsonb_build_object('allowed',false,'reason','not_authenticated');
  end if;
  select company_id into v_company_id
  from public.company_members
  where user_id = auth.uid() and status = 'active'
  order by case when role::text = 'owner' then 0 else 1 end, created_at
  limit 1;
  if v_company_id is null then
    return jsonb_build_object('allowed',false,'reason','company_not_found');
  end if;

  select * into v_subscription from public.subscriptions where company_id = v_company_id;
  if not found then return jsonb_build_object('allowed',false,'reason','subscription_not_found','company_id',v_company_id); end if;

  if v_subscription.status = 'trial' then
    v_ends_at := v_subscription.trial_ends_at;
    v_allowed := v_ends_at is null or v_ends_at > now();
    v_mode := 'trial';
  elsif v_subscription.status = 'active' then
    v_ends_at := v_subscription.current_period_ends_at;
    v_allowed := v_ends_at is null or v_ends_at > now();
    v_mode := 'active';
  elsif v_subscription.status = 'payment_due' then
    v_ends_at := v_subscription.grace_ends_at;
    v_allowed := v_ends_at is not null and v_ends_at > now();
    v_mode := 'grace';
  end if;

  return jsonb_build_object('allowed',v_allowed,'mode',v_mode,'ends_at',v_ends_at,
    'company_id',v_company_id,'status',v_subscription.status,'plan',v_subscription.plan,
    'reason',case when v_allowed then null else 'subscription_inactive' end);
end;
$$;

create or replace function public.create_company_invitation(
  p_company_id uuid,
  p_email text,
  p_role text default 'collaborator',
  p_permission_profile text default 'colaborador',
  p_permissions jsonb default '{}'::jsonb
) returns table(id uuid,email text,token text,expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token text := encode(gen_random_bytes(32),'hex');
  v_id uuid;
  v_email text := lower(trim(coalesce(p_email,'')));
  v_expires_at timestamptz := now() + interval '7 days';
begin
  if not public.can_manage_company(p_company_id) then raise exception 'Somente dono ou gerente pode convidar.' using errcode = '42501'; end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'E-mail inválido.' using errcode = '22023'; end if;
  if p_role not in ('manager','collaborator','viewer') then raise exception 'Perfil inválido.' using errcode = '22023'; end if;
  if jsonb_typeof(coalesce(p_permissions,'{}'::jsonb)) <> 'object' then raise exception 'Permissões inválidas.' using errcode = '22023'; end if;
  if exists(select 1 from public.company_members m where m.company_id=p_company_id and lower(m.email)=v_email and m.status='active') then
    raise exception 'Esta pessoa já possui acesso ativo.' using errcode = '23505';
  end if;

  update public.company_invitations i set status='cancelled',cancelled_at=now(),updated_at=now()
  where i.company_id=p_company_id and lower(i.email)=v_email and i.status='pending';
  insert into public.company_invitations(company_id,email,role,permission_profile,permissions,status,token_sha256,invited_by,expires_at)
  values(p_company_id,v_email,p_role,coalesce(nullif(trim(p_permission_profile),''),'colaborador'),
    coalesce(p_permissions,'{}'::jsonb),'pending',encode(digest(v_token,'sha256'),'hex'),auth.uid(),v_expires_at)
  returning company_invitations.id into v_id;
  return query select v_id,v_email,v_token,v_expires_at;
end;
$$;

create or replace function public.invite_company_member(p_company_id uuid,p_email text,p_role text)
returns table(id uuid,email text,token text,expires_at timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $$
  select * from public.create_company_invitation(p_company_id,p_email,p_role,
    case when p_role='manager' then 'gerente' else 'colaborador' end,'{}'::jsonb);
$$;

create or replace function public.accept_company_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invite public.company_invitations%rowtype;
  v_email text;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória.' using errcode = '42501'; end if;
  select lower(email) into v_email from auth.users where id=auth.uid();
  select * into v_invite from public.company_invitations
  where token_sha256=encode(digest(coalesce(p_token,''),'sha256'),'hex') and status='pending'
  for update;
  if not found or v_invite.expires_at <= now() then raise exception 'Convite inválido ou expirado.' using errcode = '22023'; end if;
  if lower(v_invite.email) <> v_email then raise exception 'Este convite pertence a outro e-mail.' using errcode = '42501'; end if;

  insert into public.company_members(company_id,user_id,email,role,status,permission_profile,permissions)
  values(v_invite.company_id,auth.uid(),v_email,v_invite.role,'active',v_invite.permission_profile,v_invite.permissions)
  on conflict(company_id,user_id) do update set email=excluded.email,role=excluded.role,status='active',
    permission_profile=excluded.permission_profile,permissions=excluded.permissions,updated_at=now();
  update public.company_invitations set status='accepted',accepted_by=auth.uid(),accepted_at=now(),updated_at=now()
  where id=v_invite.id;
  return v_invite.company_id;
end;
$$;

create or replace function public.refresh_company_invitation_link(p_company_id uuid,p_invitation_id uuid)
returns table(id uuid,email text,token text,expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token text := encode(gen_random_bytes(32),'hex');
  v_email text;
  v_expires_at timestamptz := now() + interval '7 days';
begin
  if not public.can_manage_company(p_company_id) then raise exception 'Acesso negado.' using errcode='42501'; end if;
  update public.company_invitations i set token_sha256=encode(digest(v_token,'sha256'),'hex'),
    status='pending',expires_at=v_expires_at,cancelled_at=null,updated_at=now()
  where i.id=p_invitation_id and i.company_id=p_company_id and i.status in ('pending','expired')
  returning i.email into v_email;
  if v_email is null then raise exception 'Convite não encontrado.' using errcode='P0002'; end if;
  return query select p_invitation_id,v_email,v_token,v_expires_at;
end;
$$;

create or replace function public.cancel_company_invitation(p_company_id uuid,p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_manage_company(p_company_id) then raise exception 'Acesso negado.' using errcode='42501'; end if;
  update public.company_invitations set status='cancelled',cancelled_at=now(),updated_at=now()
  where id=p_invitation_id and company_id=p_company_id and status='pending';
  return found;
end;
$$;

create or replace function public.revoke_company_member(p_company_id uuid,p_member_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_manage_company(p_company_id) then raise exception 'Acesso negado.' using errcode='42501'; end if;
  if p_member_user_id=auth.uid() then raise exception 'Você não pode remover o próprio acesso.' using errcode='22023'; end if;
  update public.company_members set status='inactive',updated_at=now()
  where company_id=p_company_id and user_id=p_member_user_id and role::text <> 'owner';
  return found;
end;
$$;

create or replace function public.reactivate_company_member(p_company_id uuid,p_member_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_manage_company(p_company_id) then raise exception 'Acesso negado.' using errcode='42501'; end if;
  update public.company_members set status='active',updated_at=now()
  where company_id=p_company_id and user_id=p_member_user_id and role::text <> 'owner';
  return found;
end;
$$;

create or replace function public.touch_company_presence(p_company_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_now timestamptz := now();
begin
  update public.company_members set last_seen_at=v_now,updated_at=v_now
  where company_id=p_company_id and user_id=auth.uid() and status='active';
  if not found then raise exception 'Acesso da empresa não encontrado.' using errcode='42501'; end if;
  return v_now;
end;
$$;

revoke all on function public.create_company_with_owner(text,text,text,text),
  public.current_company_access(),
  public.create_company_invitation(uuid,text,text,text,jsonb),
  public.invite_company_member(uuid,text,text),
  public.accept_company_invitation(text),
  public.refresh_company_invitation_link(uuid,uuid),
  public.cancel_company_invitation(uuid,uuid),
  public.revoke_company_member(uuid,uuid),
  public.reactivate_company_member(uuid,uuid),
  public.touch_company_presence(uuid) from public, anon;
grant execute on function public.create_company_with_owner(text,text,text,text),
  public.current_company_access(),
  public.create_company_invitation(uuid,text,text,text,jsonb),
  public.invite_company_member(uuid,text,text),
  public.accept_company_invitation(text),
  public.refresh_company_invitation_link(uuid,uuid),
  public.cancel_company_invitation(uuid,uuid),
  public.revoke_company_member(uuid,uuid),
  public.reactivate_company_member(uuid,uuid),
  public.touch_company_presence(uuid) to authenticated;

alter table public.app_state enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.company_invitations enable row level security;
alter table public.company_app_state enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_history enable row level security;
alter table public.usage_metrics enable row level security;
alter table public.terms_acceptances enable row level security;
alter table public.migration_events enable row level security;
alter table public.work_media enable row level security;
alter table public.sales_admins enable row level security;
alter table public.sales_leads enable row level security;
alter table public.admin_audit_log enable row level security;

revoke all on public.app_state,public.companies,public.company_members,
  public.company_invitations,public.company_app_state,public.subscriptions,
  public.subscription_history,public.usage_metrics,public.terms_acceptances,
  public.migration_events,public.work_media,public.sales_admins,
  public.sales_leads,public.admin_audit_log from anon;

grant select,insert,update on public.app_state to authenticated;
grant select,update on public.companies to authenticated;
grant select on public.company_members,public.company_invitations,
  public.company_app_state,public.subscriptions,public.usage_metrics,
  public.work_media to authenticated;
grant insert,select on public.terms_acceptances,public.migration_events to authenticated;
grant select on public.subscription_history,public.sales_leads,public.admin_audit_log to authenticated;

drop policy if exists app_state_own_select on public.app_state;
drop policy if exists app_state_own_insert on public.app_state;
drop policy if exists app_state_own_update on public.app_state;
create policy app_state_own_select on public.app_state for select to authenticated using(user_id=auth.uid());
create policy app_state_own_insert on public.app_state for insert to authenticated with check(user_id=auth.uid());
create policy app_state_own_update on public.app_state for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

drop policy if exists companies_member_select on public.companies;
drop policy if exists companies_manager_update on public.companies;
create policy companies_member_select on public.companies for select to authenticated using(public.is_company_member(id));
create policy companies_manager_update on public.companies for update to authenticated using(public.can_manage_company(id)) with check(public.can_manage_company(id));

drop policy if exists company_members_company_select on public.company_members;
create policy company_members_company_select on public.company_members for select to authenticated using(public.is_company_member(company_id));

drop policy if exists company_invitations_manager_select on public.company_invitations;
create policy company_invitations_manager_select on public.company_invitations for select to authenticated using(public.can_manage_company(company_id));

drop policy if exists company_state_member_select on public.company_app_state;
create policy company_state_member_select on public.company_app_state for select to authenticated using(public.is_company_member(company_id));

drop policy if exists subscriptions_member_select on public.subscriptions;
create policy subscriptions_member_select on public.subscriptions for select to authenticated using(public.is_company_member(company_id));

drop policy if exists usage_metrics_member_select on public.usage_metrics;
create policy usage_metrics_member_select on public.usage_metrics for select to authenticated using(public.is_company_member(company_id));

drop policy if exists terms_acceptances_company_select on public.terms_acceptances;
drop policy if exists terms_acceptances_own_insert on public.terms_acceptances;
create policy terms_acceptances_company_select on public.terms_acceptances for select to authenticated
  using(user_id=auth.uid() or public.can_manage_company(company_id));
create policy terms_acceptances_own_insert on public.terms_acceptances for insert to authenticated
  with check(user_id=auth.uid() and public.is_company_member(company_id));

drop policy if exists migration_events_company_select on public.migration_events;
drop policy if exists migration_events_own_insert on public.migration_events;
create policy migration_events_company_select on public.migration_events for select to authenticated using(public.is_company_member(company_id));
create policy migration_events_own_insert on public.migration_events for insert to authenticated
  with check(user_id=auth.uid() and public.is_company_member(company_id));

drop policy if exists work_media_company_select on public.work_media;
create policy work_media_company_select on public.work_media for select to authenticated using(public.is_company_member(company_id));

drop policy if exists subscription_history_admin_select on public.subscription_history;
drop policy if exists sales_leads_admin_select on public.sales_leads;
drop policy if exists admin_audit_admin_select on public.admin_audit_log;
create policy subscription_history_admin_select on public.subscription_history for select to authenticated using(public.is_sales_admin());
create policy sales_leads_admin_select on public.sales_leads for select to authenticated using(public.is_sales_admin());
create policy admin_audit_admin_select on public.admin_audit_log for select to authenticated using(public.is_sales_admin());

-- Não são concedidas mutações diretas em membros, convites, assinaturas, mídia
-- ou áreas administrativas. Elas passam pelas RPCs/Edge Functions validadas.
revoke insert,update,delete on public.company_members,public.company_invitations,
  public.subscriptions,public.subscription_history,public.usage_metrics,
  public.work_media,public.sales_admins,public.sales_leads,public.admin_audit_log
  from authenticated;

commit;
