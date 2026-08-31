-- Ativação segura de empresas, convites e permissões na produção.
-- Preserva public.app_state integralmente e cria cópias antes de atualizar
-- apenas public.company_app_state com o estado mais recente do respectivo dono.

begin;

create table if not exists public.company_state_activation_backups (
  id uuid primary key default gen_random_uuid(),
  migration_key text not null,
  company_id uuid not null references public.companies(id) on delete restrict,
  source text not null check (source in ('company_before_activation','legacy_owner_at_activation')),
  source_user_id uuid references auth.users(id) on delete set null,
  data jsonb not null,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (migration_key,company_id,source)
);

alter table public.company_state_activation_backups enable row level security;
revoke all on table public.company_state_activation_backups from anon, authenticated;

insert into public.company_state_activation_backups(
  migration_key,company_id,source,source_user_id,data,source_updated_at
)
select '20260827_company_invites_v1',state.company_id,'company_before_activation',state.updated_by,state.data,state.updated_at
from public.company_app_state state
on conflict (migration_key,company_id,source) do nothing;

insert into public.company_state_activation_backups(
  migration_key,company_id,source,source_user_id,data,source_updated_at
)
select '20260827_company_invites_v1',member.company_id,'legacy_owner_at_activation',member.user_id,legacy.data,legacy.updated_at
from public.company_members member
join public.app_state legacy on legacy.user_id=member.user_id
where member.role::text='owner' and member.status='active'
on conflict (migration_key,company_id,source) do nothing;

-- Somente copia o estado legado mais recente do dono para a empresa.
-- A linha original em app_state não é alterada nem removida.
update public.company_app_state state
set data=legacy.data,
    updated_by=member.user_id,
    updated_at=legacy.updated_at
from public.company_members member
join public.app_state legacy on legacy.user_id=member.user_id
where state.company_id=member.company_id
  and member.role::text='owner'
  and member.status='active'
  and legacy.data is distinct from state.data;

create or replace function public.company_allowed_modules(p_company_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  member_role text;
  member_profile text;
  member_permissions jsonb;
  configured text[];
  all_modules constant text[] := array[
    'works','clients','team','planning','attendance',
    'payments','financial','vehicles','reports'
  ];
begin
  select role::text,permission_profile,permissions
    into member_role,member_profile,member_permissions
  from public.company_members
  where company_id=p_company_id and user_id=auth.uid() and status='active'
  limit 1;

  if member_role is null then return array[]::text[]; end if;
  if member_role in ('owner','manager') then return all_modules; end if;

  if jsonb_typeof(coalesce(member_permissions->'modules','null'::jsonb))='array' then
    select coalesce(array_agg(value order by value),array[]::text[])
      into configured
    from jsonb_array_elements_text(member_permissions->'modules') value
    where value=any(all_modules);
    if cardinality(configured)>0 then return configured; end if;
  end if;

  case lower(coalesce(member_profile,''))
    when 'supervisor' then return array['works','team','planning','attendance'];
    when 'financeiro' then return array['payments','financial','reports'];
    when 'visualizador' then return all_modules;
    when 'gerente' then return all_modules;
    else return array['works','planning','attendance'];
  end case;
end;
$$;

create or replace function public.save_company_app_state(
  p_company_id uuid,
  p_data jsonb
) returns timestamptz
language plpgsql
security definer
set search_path=public
as $$
declare
  member_role text;
  member_profile text;
  old_data jsonb;
  old_db jsonb;
  new_db jsonb;
  sanitized_data jsonb;
  allowed text[];
  changed_key text;
  required_module text;
  saved_at timestamptz := now();
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória.'; end if;

  select role::text,permission_profile
    into member_role,member_profile
  from public.company_members
  where company_id=p_company_id and user_id=auth.uid() and status='active'
  limit 1;

  if member_role is null then raise exception 'Acesso da empresa não encontrado.'; end if;
  if jsonb_typeof(p_data)<>'object' or jsonb_typeof(p_data->'db')<>'object' then
    raise exception 'Formato de dados inválido.';
  end if;

  select data into old_data
  from public.company_app_state
  where company_id=p_company_id
  for update;

  if old_data is null then
    if member_role not in ('owner','manager') then
      raise exception 'Somente o dono ou gerente pode iniciar os dados da empresa.';
    end if;
    insert into public.company_app_state(company_id,data,updated_by,updated_at)
    values(p_company_id,p_data,auth.uid(),saved_at)
    on conflict (company_id) do update set
      data=excluded.data,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
    return saved_at;
  end if;

  sanitized_data := p_data;
  if member_role not in ('owner','manager') then
    if member_role='viewer' or lower(coalesce(member_profile,''))='visualizador' then
      raise exception 'Seu perfil permite somente consulta.';
    end if;
    if (p_data - 'version' - 'db' - 'selectedWork') <> '{}'::jsonb then
      raise exception 'A alteração contém uma área não permitida.';
    end if;

    allowed := public.company_allowed_modules(p_company_id);
    old_db := coalesce(old_data->'db','{}'::jsonb);
    new_db := p_data->'db';

    for changed_key in
      select key from jsonb_object_keys(old_db || new_db) key
    loop
      if old_db->changed_key is not distinct from new_db->changed_key then continue; end if;

      required_module := case
        when changed_key=any(array['works','workClients','workContracts','workPhases','workUpdates','workMedia','workPermissions']) then 'works'
        when changed_key=any(array['clients','clientRequests','clientVisits','clientQuotes','clientHistory']) then 'clients'
        when changed_key='employees' then 'team'
        when changed_key='distributions' then 'planning'
        when changed_key='attendance' then 'attendance'
        when changed_key=any(array['advances','discounts','payments','cycles']) then 'payments'
        when changed_key=any(array['receivables','receipts','receivableDiscounts','workClosings','otherExpenses']) then 'financial'
        when changed_key=any(array['vehicles','fuel','maintenance','tow','licenses']) then 'vehicles'
        when changed_key='reports' then 'reports'
        when changed_key='audit' then 'audit'
        else null
      end;

      if required_module='audit' then continue; end if;
      if required_module is null or not required_module=any(allowed) then
        raise exception 'Seu perfil não permite alterar a área: %.',changed_key;
      end if;
    end loop;

    -- O histórico administrativo não pode ser reescrito por colaboradores.
    sanitized_data := jsonb_set(
      sanitized_data,
      '{db,audit}',
      coalesce(old_data#>'{db,audit}','[]'::jsonb),
      true
    );
  end if;

  update public.company_app_state
  set data=sanitized_data,updated_by=auth.uid(),updated_at=saved_at
  where company_id=p_company_id;
  return saved_at;
end;
$$;

grant execute on function public.company_allowed_modules(uuid),
  public.save_company_app_state(uuid,jsonb) to authenticated;

-- Gravação direta fica restrita a dono/gerente. Colaboradores salvam somente
-- pela função acima, que valida cada módulo autorizado.
drop policy if exists company_state_insert_editor on public.company_app_state;
drop policy if exists company_state_insert_manager on public.company_app_state;
create policy company_state_insert_manager
on public.company_app_state for insert to authenticated
with check (public.can_manage_company(company_id) and updated_by=auth.uid());

drop policy if exists company_state_update_editor on public.company_app_state;
drop policy if exists company_state_update_manager on public.company_app_state;
create policy company_state_update_manager
on public.company_app_state for update to authenticated
using (public.can_manage_company(company_id))
with check (public.can_manage_company(company_id) and updated_by=auth.uid());

commit;
