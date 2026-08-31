-- ObraAtiva — esquema-base versionado para ambientes novos e de revisão.
--
-- Esta migration antecede as migrations históricas que já dependem destas
-- relações. Ela é aditiva e idempotente: não apaga tabelas, colunas ou dados.

begin;

create extension if not exists pgcrypto;

create table if not exists public.app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  responsible_name text,
  whatsapp text,
  city text,
  owner_user_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  role text not null default 'collaborator'
    check (role in ('owner','manager','admin','collaborator','viewer')),
  status text not null default 'active' check (status in ('active','inactive')),
  permission_profile text not null default 'colaborador',
  permissions jsonb not null default '{}'::jsonb check (jsonb_typeof(permissions) = 'object'),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id,user_id)
);

create index if not exists company_members_user_status_idx
  on public.company_members(user_id,status,company_id);

create unique index if not exists company_members_one_owner_idx
  on public.company_members(company_id) where role = 'owner' and status = 'active';

create table if not exists public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  role text not null default 'collaborator'
    check (role in ('manager','collaborator','viewer')),
  permission_profile text not null default 'colaborador',
  permissions jsonb not null default '{}'::jsonb check (jsonb_typeof(permissions) = 'object'),
  status text not null default 'pending'
    check (status in ('pending','accepted','cancelled','expired')),
  token_sha256 text not null unique check (char_length(token_sha256) = 64),
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_invitations_company_status_idx
  on public.company_invitations(company_id,status,created_at desc);
create index if not exists company_invitations_email_status_idx
  on public.company_invitations(lower(email),status);

create table if not exists public.company_app_state (
  company_id uuid primary key references public.companies(id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  plan text not null default 'essential'
    check (plan in ('essential','builder','professional','custom','administrator')),
  status text not null default 'trial'
    check (status in ('trial','active','payment_due','suspended','cancelled')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  grace_ends_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  previous_plan text,
  new_plan text,
  previous_status text,
  new_status text,
  note text not null default '',
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists subscription_history_company_idx
  on public.subscription_history(company_id,created_at desc);

create table if not exists public.usage_metrics (
  company_id uuid primary key references public.companies(id) on delete cascade,
  active_works integer not null default 0 check (active_works >= 0),
  active_users integer not null default 0 check (active_users >= 0),
  photo_bytes bigint not null default 0 check (photo_bytes >= 0),
  photo_count integer not null default 0 check (photo_count >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.terms_acceptances (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_key text not null check (document_key in ('terms','privacy')),
  document_version text not null check (char_length(document_version) between 1 and 40),
  accepted_at timestamptz not null default now(),
  primary key (company_id,user_id,document_key,document_version)
);

create table if not exists public.migration_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  source text not null,
  source_key text not null,
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  created_at timestamptz not null default now(),
  unique (company_id,source_key)
);

create table if not exists public.work_media (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  work_id text not null,
  storage_path text not null unique,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  upload_status text not null default 'pending'
    check (upload_status in ('pending','ready','failed','deleted')),
  caption text not null default '',
  alt_text text not null default '',
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists work_media_company_status_idx
  on public.work_media(company_id,upload_status,created_at desc);

create table if not exists public.sales_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sales_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  company text,
  phone text,
  plan text,
  status text not null default 'Novo contato',
  notes text not null default '',
  next_action_at date,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.company_members
    where company_id = p_company_id and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.can_manage_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.company_members
    where company_id = p_company_id and user_id = auth.uid()
      and status = 'active' and role::text in ('owner','manager')
  );
$$;

create or replace function public.is_sales_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.sales_admins
    where user_id = auth.uid() and active
  );
$$;

revoke all on function public.is_company_member(uuid),
  public.can_manage_company(uuid), public.is_sales_admin() from public, anon;
grant execute on function public.is_company_member(uuid),
  public.can_manage_company(uuid), public.is_sales_admin() to authenticated;

commit;
