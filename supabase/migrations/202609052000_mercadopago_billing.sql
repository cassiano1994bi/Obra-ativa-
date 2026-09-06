-- ObraAtiva: plano único, 30 dias grátis, recorrência e consulta após vencimento.
-- Instalação aditiva. NÃO ativa cobranças nem altera dados operacionais.
-- billing_activate() é uma ação separada, exclusiva do servidor, após homologação.
begin;

create table if not exists public.billing_control (
  id boolean primary key default true check(id), enabled boolean not null default false,
  activated_at timestamptz
);
insert into public.billing_control(id) values(true) on conflict do nothing;
create table if not exists public.billing_accounts (
  owner_user_id uuid primary key references auth.users(id) on delete restrict,
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default now()+interval '30 days',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.billing_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.billing_accounts(owner_user_id) on delete restrict,
  provider_id text unique,
  status text not null default 'creating' check(status in ('creating','uncertain','pending','authorized','paused','cancelled')),
  checkout_url text, provider_updated_at timestamptz, checked_at timestamptz,
  sync_requested_at timestamptz, invoice_offset integer not null default 0 check(invoice_offset>=0),
  last_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists billing_one_live_attempt on public.billing_attempts(owner_user_id)
  where status <> 'cancelled';
create index if not exists billing_attempts_check_idx on public.billing_attempts(checked_at nulls first,created_at);
create table if not exists public.billing_payments (
  provider_payment_id text primary key,
  invoice_id text not null,
  attempt_id uuid not null references public.billing_attempts(id) on delete restrict,
  status text not null check(status in ('approved','rejected','pending','in_process','cancelled','refunded','charged_back','in_mediation','authorized')),
  amount numeric(12,2) not null check(amount=69), currency text not null check(currency='BRL'),
  debit_at timestamptz not null, approved_at timestamptz, provider_updated_at timestamptz not null,
  period_ends_at timestamptz, recorded_at timestamptz not null default now()
);
create table if not exists public.billing_events (
  id bigint generated always as identity primary key,
  owner_user_id uuid references public.billing_accounts(owner_user_id) on delete restrict,
  attempt_id uuid references public.billing_attempts(id) on delete restrict,
  kind text not null, resource_id text, recorded_at timestamptz not null default now()
);
alter table public.billing_control enable row level security;
alter table public.billing_accounts enable row level security;
alter table public.billing_attempts enable row level security;
alter table public.billing_payments enable row level security;
alter table public.billing_events enable row level security;
revoke all on public.billing_control,public.billing_accounts,public.billing_attempts,public.billing_payments,public.billing_events from public,anon,authenticated;
grant select,insert,update on public.billing_control,public.billing_accounts,public.billing_attempts,public.billing_payments,public.billing_events to service_role;
grant usage,select on sequence public.billing_events_id_seq to service_role;

-- A conta responsável paga; convidados mantêm as permissões que já receberam.
-- Também atende contas antigas que ainda gravam no app_state individual.
create or replace function public.billing_company_owner(p_company uuid)
returns uuid language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(
    (select m.user_id from public.company_members m where m.company_id=p_company and m.role::text='owner' and m.status='active' order by m.created_at limit 1),
    (select coalesce(nullif(to_jsonb(c)->>'owner_user_id','')::uuid,nullif(to_jsonb(c)->>'created_by','')::uuid) from public.companies c where c.id=p_company)
  );
$$;
create or replace function public.billing_account_access(p_owner uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  a public.billing_accounts%rowtype; paid_until timestamptz; failed_at timestamptz;
  last_paid_debit timestamptz; grace_until timestamptz; provider_state text; result_mode text;
begin
  if not coalesce((select enabled from public.billing_control where id),false) then
    return jsonb_build_object('enabled',false,'can_write',true,'mode','not_enabled');
  end if;
  -- O cadastro legado usa a presença na tabela; versões novas também têm active.
  -- Um administrador explicitamente inativo continua sem isenção.
  if exists(select 1 from public.sales_admins sa where sa.user_id=p_owner
    and coalesce((to_jsonb(sa)->>'active')::boolean,true)) then
    return jsonb_build_object('enabled',true,'can_write',true,'mode','administrator','plan','obraativa','price',69,'currency','BRL','owner_user_id',p_owner);
  end if;
  select * into a from public.billing_accounts where owner_user_id=p_owner;
  select max(p.period_ends_at),max(p.debit_at) into paid_until,last_paid_debit from public.billing_payments p
    join public.billing_attempts t on t.id=p.attempt_id where t.owner_user_id=p_owner and p.status='approved';
  select min(p.debit_at) into failed_at from public.billing_payments p join public.billing_attempts t on t.id=p.attempt_id
    where t.owner_user_id=p_owner and p.status='rejected'
    and p.debit_at>coalesce(last_paid_debit,'-infinity'::timestamptz);
  grace_until:=failed_at+interval '3 days';
  select status into provider_state from public.billing_attempts where owner_user_id=p_owner order by created_at desc limit 1;
  result_mode:=case
    when paid_until>now() then 'active'
    when a.trial_ends_at>now() then 'trial'
    when grace_until>now() then 'grace'
    when provider_state='cancelled' then 'cancelled'
    when failed_at is not null then 'payment_due'
    else 'expired' end;
  return jsonb_build_object('enabled',true,'owner_user_id',p_owner,'plan','obraativa','price',69,'currency','BRL',
    'mode',result_mode,'can_write',result_mode in ('trial','active','grace'),
    'trial_started_at',a.trial_started_at,'trial_ends_at',a.trial_ends_at,'paid_until',paid_until,
    'payment_failed_at',failed_at,'grace_ends_at',grace_until,'provider_status',provider_state,'server_now',now());
end;
$$;
create or replace function public.billing_access(p_company_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare target uuid; result jsonb;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória.' using errcode='42501'; end if;
  if p_company_id is not null then
    if not public.is_company_member(p_company_id) then raise exception 'Acesso negado.' using errcode='42501'; end if;
    target:=public.billing_company_owner(p_company_id);
  else target:=auth.uid(); end if;
  result:=public.billing_account_access(target);
  return result||jsonb_build_object('can_manage',target=auth.uid(),'company_id',p_company_id);
end;
$$;

create or replace function public.billing_activate()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer;
begin
  perform 1 from public.billing_control where id for update;
  if (select enabled from public.billing_control where id) then return jsonb_build_object('already_enabled',true); end if;
  insert into public.billing_accounts(owner_user_id,trial_started_at,trial_ends_at)
    select id,now(),now()+interval '30 days' from auth.users on conflict do nothing;
  get diagnostics n=row_count;
  update public.billing_control set enabled=true,activated_at=now() where id;
  insert into public.billing_events(kind) values('billing_activated_30_day_trial');
  return jsonb_build_object('enabled',true,'accounts_enrolled',n);
end;
$$;
create or replace function public.billing_new_account()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  -- Serialize signups with activation: no account misses its initial trial.
  perform 1 from public.billing_control where id for share;
  if (select enabled from public.billing_control where id) then
    insert into public.billing_accounts(owner_user_id,trial_started_at,trial_ends_at)
      values(new.id,now(),now()+interval '30 days') on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger obraativa_billing_new_account after insert on auth.users for each row execute function public.billing_new_account();

-- Reserva persistente: duas abas não criam duas recorrências. Falha incerta
-- exige consulta por external_reference, nunca repetir POST cegamente.
create or replace function public.billing_claim_checkout(p_owner uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.billing_attempts%rowtype;
begin
  if not (select enabled from public.billing_control where id) then raise exception 'Assinaturas ainda não ativadas.'; end if;
  perform 1 from public.billing_accounts where owner_user_id=p_owner for update;
  if not found then raise exception 'Conta de assinatura não encontrada.'; end if;
  select * into a from public.billing_attempts where owner_user_id=p_owner and status<>'cancelled';
  if found then return to_jsonb(a)||jsonb_build_object('created',false); end if;
  insert into public.billing_attempts(owner_user_id) values(p_owner) returning * into a;
  insert into public.billing_events(owner_user_id,attempt_id,kind) values(p_owner,a.id,'recurring_consent_69_brl_month_v1');
  return to_jsonb(a)||jsonb_build_object('created',true);
end;
$$;
create or replace function public.billing_claim_sync(p_attempt uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.billing_attempts set sync_requested_at=now() where id=p_attempt
    and (sync_requested_at is null or sync_requested_at<now()-interval '30 seconds');
  return found;
end;
$$;
create or replace function public.billing_apply_provider(
  p_attempt uuid,p_provider_id text,p_status text,p_modified timestamptz,p_checkout text default null,
  p_payment jsonb default null
) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.billing_attempts%rowtype; changed integer:=0; metadata_changed boolean:=false; debit_time timestamptz; approved_time timestamptz;
begin
  select * into a from public.billing_attempts where id=p_attempt for update;
  if not found or p_status not in ('pending','authorized','paused','cancelled') or p_modified is null then raise exception 'Assinatura inválida.'; end if;
  perform 1 from public.billing_accounts where owner_user_id=a.owner_user_id for update;
  if a.provider_id is not null and a.provider_id<>p_provider_id then raise exception 'Vínculo de cobrança inválido.'; end if;
  if a.provider_updated_at is null or p_modified>a.provider_updated_at then
    metadata_changed:=a.status is distinct from p_status;
    update public.billing_attempts set provider_id=p_provider_id,status=p_status,
      provider_updated_at=p_modified,checkout_url=coalesce(p_checkout,checkout_url),checked_at=now(),last_error=null,updated_at=now() where id=p_attempt;
  else update public.billing_attempts set checked_at=now(),last_error=null where id=p_attempt; end if;
  if p_payment is not null then
    if (p_payment->>'amount')::numeric<>69 or p_payment->>'currency'<>'BRL' then raise exception 'Valor de assinatura inválido.'; end if;
    if exists(select 1 from public.billing_payments where provider_payment_id=p_payment->>'id' and attempt_id<>p_attempt) then raise exception 'Pagamento já vinculado a outra conta.'; end if;
    debit_time:=(p_payment->>'debit_at')::timestamptz;
    approved_time:=(p_payment->>'approved_at')::timestamptz;
    insert into public.billing_payments(provider_payment_id,invoice_id,attempt_id,status,amount,currency,debit_at,approved_at,provider_updated_at,period_ends_at)
    values(p_payment->>'id',p_payment->>'invoice_id',p_attempt,p_payment->>'status',69,'BRL',debit_time,approved_time,
      (p_payment->>'modified_at')::timestamptz,
      case when p_payment->>'status'='approved' and approved_time is not null then greatest(debit_time,approved_time)+interval '1 month' else null end)
    on conflict(provider_payment_id) do update set status=excluded.status,approved_at=excluded.approved_at,
      provider_updated_at=excluded.provider_updated_at,period_ends_at=excluded.period_ends_at
      where excluded.provider_updated_at>billing_payments.provider_updated_at;
    get diagnostics changed=row_count;
  end if;
  if changed>0 or metadata_changed then
    insert into public.billing_events(owner_user_id,attempt_id,kind,resource_id)
      values(a.owner_user_id,p_attempt,case when p_payment is null then 'subscription_'||p_status else 'payment_'||(p_payment->>'status') end,coalesce(p_payment->>'id',p_provider_id));
  end if;
  update public.billing_accounts set updated_at=now() where owner_user_id=a.owner_user_id;
  return true;
end;
$$;

-- Compatibilidade: a antiga porta de login não pode impedir a consulta.
-- Desativado, o comportamento anterior permanece literalmente no contrato legado.
alter function public.current_company_access() rename to billing_legacy_company_access;
revoke all on function public.billing_legacy_company_access() from public,anon,authenticated;
create function public.current_company_access() returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare cid uuid; access jsonb;
begin
  if not (select enabled from public.billing_control where id) then return public.billing_legacy_company_access(); end if;
  if auth.uid() is null then return jsonb_build_object('allowed',false,'reason','not_authenticated'); end if;
  select company_id into cid from public.company_members where user_id=auth.uid() and status='active'
    order by case when role::text='owner' then 0 else 1 end,created_at limit 1;
  access:=public.billing_access(cid);
  return access||jsonb_build_object('allowed',true,'status',access->>'mode','ends_at',
    coalesce(access->>'paid_until',access->>'trial_ends_at'));
end;
$$;
revoke all on function public.current_company_access() from public,anon;
grant execute on function public.current_company_access() to authenticated;

-- Camada de servidor: nem uma versão antiga do app nem uma chamada direta
-- pode salvar/excluir dados quando o teste ou a tolerância tiver terminado.
create or replace function public.billing_guard_operational_write()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare row_data jsonb; target uuid; access jsonb;
begin
  if not coalesce((select enabled from public.billing_control where id),false) then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  if tg_table_name='app_state' then target:=(row_data->>'user_id')::uuid;
  elsif tg_table_name='companies' then
    target:=coalesce(public.billing_company_owner((row_data->>'id')::uuid),nullif(row_data->>'owner_user_id','')::uuid,nullif(row_data->>'created_by','')::uuid);
  elsif tg_table_name='budget_public_proposals' then
    -- Visualizações e respostas do destinatário continuam funcionando; emitir
    -- ou substituir uma proposta pelo dono exige assinatura válida.
    if tg_op='UPDATE' and auth.uid() is distinct from (row_data->>'owner_id')::uuid and
      (to_jsonb(new)-'status'-'viewed_at'-'responded_at'-'updated_at')=
      (to_jsonb(old)-'status'-'viewed_at'-'responded_at'-'updated_at') then return new; end if;
    target:=(row_data->>'owner_id')::uuid;
  else target:=public.billing_company_owner((row_data->>'company_id')::uuid); end if;
  if tg_table_name='company_members' and tg_op='UPDATE' and
    (to_jsonb(new)-'last_seen_at'-'updated_at')=(to_jsonb(old)-'last_seen_at'-'updated_at') then return new; end if;
  access:=public.billing_account_access(target);
  if not coalesce((access->>'can_write')::boolean,false) then
    raise exception 'Seu teste ou assinatura terminou. Seus dados estão seguros e continuam disponíveis para consulta.' using errcode='OB069';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
do $$ declare t text; begin
  foreach t in array array['app_state','companies','company_app_state','company_members','company_invitations'] loop
    execute format('create trigger obraativa_billing_write before insert or update or delete on public.%I for each row execute function public.billing_guard_operational_write()',t);
  end loop;
  -- Não criar armazenamentos opcionais que a instalação antiga não utiliza.
  foreach t in array array['work_media','budget_public_proposals'] loop
    if to_regclass('public.'||t) is not null then
      execute format('create trigger obraativa_billing_write before insert or update or delete on public.%I for each row execute function public.billing_guard_operational_write()',t);
    end if;
  end loop;
end $$;

-- Legado permanece legível; uma ativação manual antiga não marca o novo
-- plano como pago nem exibe um sucesso enganoso no painel comercial.
create function public.billing_guard_legacy_subscription() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not coalesce((select enabled from public.billing_control where id),false) then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_op='INSERT' then
    new.plan:='custom';new.status:='trial';
    select trial_started_at,trial_ends_at into new.trial_started_at,new.trial_ends_at from public.billing_accounts
      where owner_user_id=public.billing_company_owner(new.company_id);
    return new;
  end if;
  raise exception 'A assinatura agora é automática. Use o painel Assinaturas; pagamentos são confirmados pelo Mercado Pago.' using errcode='OB069';
end;
$$;
create trigger obraativa_billing_legacy_subscription before insert or update or delete on public.subscriptions
  for each row execute function public.billing_guard_legacy_subscription();
revoke all on function public.billing_guard_legacy_subscription() from public,anon,authenticated;

-- Administração apenas de leitura; não aceita status pago enviado pelo navegador.
create or replace function public.billing_admin_report(p_search text default '',p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not public.is_sales_admin() then raise exception 'Acesso exclusivo do proprietário.' using errcode='42501'; end if;
  if p_offset<0 or p_offset>100000 then raise exception 'Página inválida.'; end if;
  return jsonb_build_object('enabled',(select enabled from public.billing_control where id),
    'rows',coalesce((select jsonb_agg(x) from (select a.owner_user_id,u.email,
      coalesce(u.raw_user_meta_data->>'full_name','Conta') as name,
      public.billing_account_access(a.owner_user_id) as access,a.created_at,
      (select max(checked_at) from public.billing_attempts where owner_user_id=a.owner_user_id) as last_sync,
      (select last_error from public.billing_attempts where owner_user_id=a.owner_user_id order by created_at desc limit 1) as sync_error
      from public.billing_accounts a join auth.users u on u.id=a.owner_user_id
      where position(lower(left(p_search,120)) in lower(coalesce(u.email,'')||' '||coalesce(u.raw_user_meta_data->>'full_name','')))>0
      order by a.created_at desc,a.owner_user_id limit 50 offset p_offset) x),'[]'::jsonb));
end;
$$;
revoke all on function public.billing_company_owner(uuid),public.billing_account_access(uuid),public.billing_access(uuid),
  public.billing_activate(),public.billing_new_account(),public.billing_claim_checkout(uuid),
  public.billing_claim_sync(uuid),
  public.billing_apply_provider(uuid,text,text,timestamptz,text,jsonb),public.billing_guard_operational_write(),
  public.billing_admin_report(text,integer) from public,anon,authenticated;
grant execute on function public.billing_access(uuid),public.billing_admin_report(text,integer) to authenticated;
grant execute on function public.billing_company_owner(uuid),public.billing_account_access(uuid),public.billing_activate(),
  public.billing_claim_checkout(uuid),public.billing_apply_provider(uuid,text,text,timestamptz,text,jsonb) to service_role;
grant execute on function public.billing_claim_sync(uuid) to service_role;
commit;
