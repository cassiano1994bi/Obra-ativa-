-- ObraAtiva: acompanhamento opcional do produto, isolado dos dados operacionais.
-- Instalar somente após aprovação. A coleta nasce DESLIGADA.
begin;

create table public.product_insight_settings (
  id boolean primary key default true check(id), enabled boolean not null default false,
  enabled_at timestamptz, updated_at timestamptz not null default now()
);
insert into public.product_insight_settings(id) values(true);
create table public.product_insight_consent (
  user_id uuid primary key references auth.users(id) on delete cascade,
  allowed boolean not null, updated_at timestamptz not null default now(), last_tick timestamptz, first_activity_at timestamptz
);
create table public.product_insight_sessions (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
  ended_at timestamptz, end_reason text check(end_reason in ('logout','optout')),
  active_seconds integer not null default 0 check(active_seconds>=0)
);
create index on public.product_insight_sessions(user_id,last_seen_at desc);
create table public.product_insight_days (
  user_id uuid not null references auth.users(id) on delete cascade, day date not null,
  active_seconds integer not null default 0 check(active_seconds>=0),
  modules jsonb not null default '{}'::jsonb, primary key(user_id,day)
);
create table public.product_campaigns (
  id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 100),
  slug text not null unique check(slug ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  source text not null check(source in ('instagram','facebook','google','whatsapp','other')),
  created_at timestamptz not null default now(), created_by uuid references auth.users(id) on delete set null
);
create table public.product_campaign_visits (
  id uuid primary key, campaign_id uuid references public.product_campaigns(id) on delete restrict,
  visited_at timestamptz not null default now(), whatsapp_clicked boolean not null default false,
  user_id uuid unique references auth.users(id) on delete cascade, linked_at timestamptz
);
create index on public.product_campaign_visits(campaign_id,visited_at);
create table public.product_campaign_spend (
  campaign_id uuid not null references public.product_campaigns(id) on delete restrict, day date not null,
  amount numeric(12,2) not null check(amount>=0), updated_at timestamptz not null default now(),
  primary key(campaign_id,day)
);
-- Livro comercial separado: não altera financeiro, assinaturas ou pagamentos de obras.
create table public.product_campaign_receipts (
  id uuid primary key, company_id uuid not null references public.companies(id) on delete cascade,
  day date not null, amount numeric(12,2) not null check(amount>0),
  kind text not null check(kind in ('payment','refund')),
  reference text not null unique check(length(reference) between 3 and 100),
  created_at timestamptz not null default now(), created_by uuid references auth.users(id) on delete set null
);
create table public.product_insight_limits (
  key text primary key, bucket timestamptz not null, hits integer not null default 1
);

alter table public.product_insight_settings enable row level security;
alter table public.product_insight_consent enable row level security;
alter table public.product_insight_sessions enable row level security;
alter table public.product_insight_days enable row level security;
alter table public.product_campaigns enable row level security;
alter table public.product_campaign_visits enable row level security;
alter table public.product_campaign_spend enable row level security;
alter table public.product_campaign_receipts enable row level security;
alter table public.product_insight_limits enable row level security;
-- Sem acesso direto nem políticas amplas: apenas os contratos abaixo.
revoke all on public.product_insight_settings,public.product_insight_consent,
 public.product_insight_sessions,public.product_insight_days,public.product_campaigns,
 public.product_campaign_visits,public.product_campaign_spend,public.product_campaign_receipts,
 public.product_insight_limits from anon,authenticated;

create function public.product_insight_preference(p_allowed boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Acesso negado' using errcode='42501'; end if;
  insert into public.product_insight_consent(user_id,allowed) values(auth.uid(),p_allowed)
  on conflict(user_id) do update set allowed=excluded.allowed,updated_at=now();
  if not p_allowed then
    update public.product_insight_sessions set ended_at=now(),end_reason='optout'
    where user_id=auth.uid() and ended_at is null;
  end if;
  return jsonb_build_object('enabled',(select enabled from public.product_insight_settings where id));
end; $$;

create function public.product_insight_tick(p_session uuid,p_module text,p_seconds integer default 0,p_end boolean default false)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_previous timestamptz; v_seconds integer; v_day date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if auth.uid() is null then raise exception 'Acesso negado' using errcode='42501'; end if;
  if p_module is null or p_module not in ('home','works','planning','team','attendance','payments','financial','vehicles','reports','assistant','permissions','reminders','budgets')
    or p_seconds is null or p_seconds not between 0 and 60 or p_session is null or p_end is null then
    raise exception 'Evento inválido' using errcode='22023';
  end if;
  if not (select enabled from public.product_insight_settings where id) then return false; end if;
  select last_tick into v_previous from public.product_insight_consent
    where user_id=auth.uid() and allowed for update;
  if not found then return false; end if;
  -- Encerrar nunca cria sessão: só finaliza uma sessão aberta do próprio usuário.
  -- A trava da preferência serializa encerramentos repetidos sem creditar tempo.
  if p_end and not exists(select 1 from public.product_insight_sessions
    where id=p_session and user_id=auth.uid() and ended_at is null) then return false; end if;
  -- Serializa por usuário, impede crédito sobreposto de abas/dispositivos e tempestades.
  if not p_end and v_previous>now()-interval '10 seconds' then return false; end if;
  if exists(select 1 from public.product_insight_sessions where id=p_session and (user_id<>auth.uid() or ended_at is not null)) then return false; end if;
  v_seconds:=case when v_previous is null then 0 else least(p_seconds,greatest(0,floor(extract(epoch from now()-v_previous))::integer),60) end;
  insert into public.product_insight_sessions(id,user_id) values(p_session,auth.uid()) on conflict(id) do nothing;
  update public.product_insight_sessions set last_seen_at=now(),active_seconds=active_seconds+v_seconds,
    ended_at=case when p_end then now() else null end,end_reason=case when p_end then 'logout' else null end
    where id=p_session and user_id=auth.uid();
  update public.product_insight_consent set last_tick=now(),first_activity_at=coalesce(first_activity_at,now()) where user_id=auth.uid();
  if not p_end or v_seconds>0 then
    insert into public.product_insight_days(user_id,day,active_seconds,modules)
      values(auth.uid(),v_day,v_seconds,jsonb_build_object(p_module,v_seconds))
    on conflict(user_id,day) do update set active_seconds=product_insight_days.active_seconds+v_seconds,
      modules=jsonb_set(product_insight_days.modules,array[p_module],to_jsonb(coalesce((product_insight_days.modules->>p_module)::integer,0)+v_seconds),true);
  end if;
  return true;
end; $$;

-- Somente servidor; limite persistente com chave HMAC (não armazena IP).
create function public.product_campaign_visit(p_id uuid,p_slug text,p_rate_key text,p_kind text default 'visit')
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_hits integer; v_campaign uuid;
begin
  if p_id is null or p_kind is null or p_kind not in ('visit','whatsapp') or p_rate_key is null or p_rate_key !~ '^[a-f0-9]{64}$' then return false; end if;
  if not (select enabled from public.product_insight_settings where id) then return false; end if;
  insert into public.product_insight_limits(key,bucket) values(p_rate_key,date_trunc('hour',now()))
  on conflict(key) do update set hits=case when product_insight_limits.bucket=excluded.bucket then product_insight_limits.hits+1 else 1 end,bucket=excluded.bucket
  returning hits into v_hits;
  if v_hits>120 then return false; end if;
  select id into v_campaign from public.product_campaigns where slug=p_slug;
  if p_kind='visit' then
    insert into public.product_campaign_visits(id,campaign_id) values(p_id,v_campaign)
    on conflict(id) do update set campaign_id=excluded.campaign_id,visited_at=excluded.visited_at
      where product_campaign_visits.campaign_id is null and product_campaign_visits.user_id is null and excluded.campaign_id is not null;
  else
    update public.product_campaign_visits set whatsapp_clicked=true where id=p_id;
  end if;
  return true;
end; $$;

create function public.product_campaign_link(p_id uuid,p_user uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_created timestamptz;
begin
  if not (select enabled from public.product_insight_settings where id) then return false; end if;
  if not exists(select 1 from public.product_insight_consent where user_id=p_user and allowed) then return false; end if;
  select created_at into v_created from auth.users where id=p_user;
  -- Não atribui contas antigas a anúncios novos, nem substitui a primeira origem.
  if exists(select 1 from public.product_campaign_visits where user_id=p_user) then return true; end if;
  update public.product_campaign_visits set user_id=p_user,linked_at=now()
    where id=p_id and user_id is null and visited_at<=v_created and v_created<=visited_at+interval '30 days'
      and visited_at>now()-interval '30 days';
  return found;
end; $$;

create function public.owner_insight_settings(p_enabled boolean)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_sales_admin() then raise exception 'Acesso negado' using errcode='42501'; end if;
  update public.product_insight_settings set enabled=p_enabled,enabled_at=case when p_enabled then coalesce(enabled_at,now()) else enabled_at end,updated_at=now();
  insert into public.admin_audit_log(actor_user_id,action,target_type,details)
    values(auth.uid(),'product_insights_setting','product',jsonb_build_object('enabled',p_enabled));
  return true;
end; $$;

create function public.owner_campaign_save(p_name text,p_slug text,p_source text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if not public.is_sales_admin() then raise exception 'Acesso negado' using errcode='42501'; end if;
  insert into public.product_campaigns(name,slug,source,created_by) values(trim(p_name),p_slug,p_source,auth.uid()) returning id into v_id;
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id) values(auth.uid(),'campaign_created','campaign',v_id::text);
  return v_id;
end; $$;

create function public.owner_campaign_spend(p_campaign uuid,p_day date,p_amount numeric)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_sales_admin() then raise exception 'Acesso negado' using errcode='42501'; end if;
  if p_day is null or p_day>(now() at time zone 'America/Sao_Paulo')::date or p_amount is null or p_amount<0 then raise exception 'Valor ou data inválidos' using errcode='22023'; end if;
  insert into public.product_campaign_spend(campaign_id,day,amount) values(p_campaign,p_day,p_amount)
  on conflict(campaign_id,day) do update set amount=excluded.amount,updated_at=now();
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,details) values(auth.uid(),'campaign_spend_saved','campaign',p_campaign::text,jsonb_build_object('day',p_day,'amount',p_amount));
  return true;
end; $$;

create function public.owner_campaign_receipt(p_id uuid,p_company uuid,p_day date,p_amount numeric,p_kind text,p_reference text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_sales_admin() then raise exception 'Acesso negado' using errcode='42501'; end if;
  if p_day is null or p_day>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Data inválida' using errcode='22023'; end if;
  if exists(select 1 from public.product_campaign_receipts where id=p_id) then return false; end if;
  insert into public.product_campaign_receipts(id,company_id,day,amount,kind,reference,created_by)
    values(p_id,p_company,p_day,p_amount,p_kind,trim(p_reference),auth.uid());
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,details)
    values(auth.uid(),'campaign_receipt_recorded','commercial_receipt',p_id::text,jsonb_build_object('kind',p_kind,'amount',p_amount));
  return true;
end; $$;

create function public.owner_insights_report(p_days integer default 30,p_search text default '',p_offset integer default 0,p_activity text default 'all')
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_since date; v_start timestamptz; v_users jsonb; v_campaigns jsonb;
begin
  if not public.is_sales_admin() then raise exception 'Acesso negado' using errcode='42501'; end if;
  if p_days is null or p_days not in (7,30,90) or p_offset is null or p_offset<0 or length(coalesce(p_search,''))>120 or p_activity is null or p_activity not in ('all','online','unused','unmeasured') then raise exception 'Filtro inválido' using errcode='22023'; end if;
  v_since:=(now() at time zone 'America/Sao_Paulo')::date-p_days+1;
  v_start:=v_since::timestamp at time zone 'America/Sao_Paulo';
  select coalesce(jsonb_agg(row_to_json(x)),'[]') into v_users from (
    select u.id,u.email,u.created_at,u.last_sign_in_at,
      coalesce(nullif(u.raw_user_meta_data->>'full_name',''),'') as name,
      (select jsonb_agg(jsonb_build_object('name',c.name,'role',m.role,'status',m.status,'plan',s.plan,'subscription_status',s.status))
        from public.company_members m join public.companies c on c.id=m.company_id left join public.subscriptions s on s.company_id=c.id where m.user_id=u.id) as companies,
      (select i.email from public.company_invitations ci join auth.users i on i.id=ci.invited_by where ci.accepted_by=u.id order by ci.accepted_at limit 1) as invited_by,
      (select allowed from public.product_insight_consent where user_id=u.id) as tracking_allowed,
      (select last_tick from public.product_insight_consent where user_id=u.id) as last_activity,
      (select first_activity_at from public.product_insight_consent where user_id=u.id) as first_activity,
      exists(select 1 from public.product_insight_sessions where user_id=u.id and ended_at is null and last_seen_at>now()-interval '90 seconds') as online,
      (select count(*) from public.product_insight_days where user_id=u.id and day>=v_since and active_seconds>0) as active_days,
      (select coalesce(sum(active_seconds),0) from public.product_insight_days where user_id=u.id and day>=v_since) as active_seconds,
      (select c.name from public.product_campaign_visits v join public.product_campaigns c on c.id=v.campaign_id where v.user_id=u.id) as origin
    from auth.users u where (coalesce(u.email,'') ilike '%'||coalesce(p_search,'')||'%'
      or coalesce(u.raw_user_meta_data->>'full_name','') ilike '%'||coalesce(p_search,'')||'%')
      and (p_activity='all'
        or (p_activity='online' and exists(select 1 from public.product_insight_sessions s where s.user_id=u.id and s.ended_at is null and s.last_seen_at>now()-interval '90 seconds'))
        or (p_activity='unused' and exists(select 1 from public.product_insight_consent pc where pc.user_id=u.id and pc.allowed) and not exists(select 1 from public.product_insight_days d where d.user_id=u.id and d.day>=v_since and d.active_seconds>0))
        or (p_activity='unmeasured' and not exists(select 1 from public.product_insight_consent pc where pc.user_id=u.id and pc.allowed)))
    order by u.created_at desc,u.id limit 50 offset p_offset
  ) x;
  select coalesce(jsonb_agg(row_to_json(x)),'[]') into v_campaigns from (
    select c.*,
      (select coalesce(sum(amount),0) from public.product_campaign_spend where campaign_id=c.id and day>=v_since) as spent,
      (select count(*) from public.product_campaign_visits where campaign_id=c.id and visited_at>=v_start) as visits,
      (select count(*) from public.product_campaign_visits where campaign_id=c.id and visited_at>=v_start and whatsapp_clicked) as whatsapp,
      (select count(*) from public.product_campaign_visits v join auth.users u on u.id=v.user_id where campaign_id=c.id and u.created_at>=v_start) as signups,
      (select count(*) from public.product_campaign_visits v join auth.users u on u.id=v.user_id where campaign_id=c.id and u.created_at>=v_start
        and exists(select 1 from public.product_insight_days d where d.user_id=u.id and d.active_seconds>0)) as activated,
      (select count(distinct co.id) from public.companies co join public.product_campaign_visits v on v.user_id=co.owner_user_id join auth.users u on u.id=v.user_id
        where v.campaign_id=c.id and u.created_at>=v_start and exists(select 1 from public.product_campaign_receipts r where r.company_id=co.id and r.kind='payment')) as customers,
      (select coalesce(sum(case when r.kind='refund' then -r.amount else r.amount end),0) from public.product_campaign_receipts r
        join public.companies co on co.id=r.company_id join public.product_campaign_visits v on v.user_id=co.owner_user_id
        where v.campaign_id=c.id and r.day>=v_since) as revenue
    from public.product_campaigns c order by c.created_at desc
  ) x;
  return jsonb_build_object('settings',(select row_to_json(s) from public.product_insight_settings s where id),
    'since',v_since,'server_time',now(),'users',v_users,'campaigns',v_campaigns,
    'user_total',(select count(*) from auth.users u where (coalesce(u.email,'') ilike '%'||coalesce(p_search,'')||'%' or coalesce(u.raw_user_meta_data->>'full_name','') ilike '%'||coalesce(p_search,'')||'%')
      and (p_activity='all'
        or (p_activity='online' and exists(select 1 from public.product_insight_sessions s where s.user_id=u.id and s.ended_at is null and s.last_seen_at>now()-interval '90 seconds'))
        or (p_activity='unused' and exists(select 1 from public.product_insight_consent pc where pc.user_id=u.id and pc.allowed) and not exists(select 1 from public.product_insight_days d where d.user_id=u.id and d.day>=v_since and d.active_seconds>0))
        or (p_activity='unmeasured' and not exists(select 1 from public.product_insight_consent pc where pc.user_id=u.id and pc.allowed)))),
    'summary',jsonb_build_object('registered',(select count(*) from auth.users where created_at>=v_start),
      'active',(select count(distinct user_id) from public.product_insight_days where day>=v_since and active_seconds>0),
      'online',(select count(distinct user_id) from public.product_insight_sessions where ended_at is null and last_seen_at>now()-interval '90 seconds'),
      'unattributed',(select count(*) from auth.users u where created_at>=v_start and not exists(select 1 from public.product_campaign_visits v where v.user_id=u.id and v.campaign_id is not null))),
    'receipts',(select coalesce(jsonb_agg(row_to_json(r)),'[]') from (select r.id,c.name as company,r.day,r.amount,r.kind,r.reference from public.product_campaign_receipts r join public.companies c on c.id=r.company_id where day>=v_since order by r.created_at desc limit 100) r));
end; $$;

create function public.owner_insight_user(p_user uuid,p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_since date;
begin
  if not public.is_sales_admin() then raise exception 'Acesso negado' using errcode='42501'; end if;
  if p_days is null or p_days not in (7,30,90) then raise exception 'Filtro inválido' using errcode='22023'; end if;
  v_since:=(now() at time zone 'America/Sao_Paulo')::date-p_days+1;
  return jsonb_build_object('days',(select coalesce(jsonb_agg(row_to_json(d)),'[]') from (select day,active_seconds,modules from public.product_insight_days where user_id=p_user and day>=v_since order by day desc) d),
    'sessions',(select coalesce(jsonb_agg(row_to_json(s)),'[]') from (select started_at,last_seen_at,ended_at,end_reason,active_seconds from public.product_insight_sessions where user_id=p_user and started_at>=v_since::timestamp at time zone 'America/Sao_Paulo' order by started_at desc limit 20) s));
end; $$;

-- Manutenção restrita ao servidor. Agendar diariamente após aprovação da ativação.
create function public.product_insights_prune()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  delete from public.product_insight_sessions where last_seen_at<now()-interval '90 days';
  delete from public.product_insight_days where day<(now() at time zone 'America/Sao_Paulo')::date-90;
  delete from public.product_campaign_visits where user_id is null and visited_at<now()-interval '90 days';
  delete from public.product_insight_limits where bucket<now()-interval '2 days';
end; $$;

revoke all on function public.product_insight_preference(boolean),public.product_insight_tick(uuid,text,integer,boolean),
 public.owner_insight_settings(boolean),public.owner_campaign_save(text,text,text),public.owner_campaign_spend(uuid,date,numeric),
 public.owner_campaign_receipt(uuid,uuid,date,numeric,text,text),public.owner_insights_report(integer,text,integer,text),
 public.owner_insight_user(uuid,integer),public.product_campaign_visit(uuid,text,text,text),public.product_campaign_link(uuid,uuid),public.product_insights_prune() from public,anon,authenticated;
grant execute on function public.product_insight_preference(boolean),public.product_insight_tick(uuid,text,integer,boolean),
 public.owner_insight_settings(boolean),public.owner_campaign_save(text,text,text),public.owner_campaign_spend(uuid,date,numeric),
 public.owner_campaign_receipt(uuid,uuid,date,numeric,text,text),public.owner_insights_report(integer,text,integer,text),public.owner_insight_user(uuid,integer) to authenticated;
grant execute on function public.product_campaign_visit(uuid,text,text,text),public.product_campaign_link(uuid,uuid),public.product_insights_prune() to service_role;
commit;
