-- Fase 2 da auditoria: limite diário persistente, atômico e isolado por empresa.
-- Esta migration apenas cria infraestrutura de segurança. Não lê nem altera
-- dados funcionais do aplicativo ou registros empresariais existentes.

begin;

create table if not exists public.company_rate_limits (
  company_id uuid not null references public.companies(id) on delete cascade,
  scope text not null check (scope ~ '^[A-Za-z0-9_.:-]{1,80}$'),
  period_date date not null,
  used_count integer not null default 0 check (used_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (company_id, scope, period_date)
);

alter table public.company_rate_limits enable row level security;
revoke all on table public.company_rate_limits from anon, authenticated;

create or replace function public.consume_company_rate_limit(
  p_company_id uuid,
  p_scope text,
  p_limit integer,
  p_consume boolean default true
) returns table(
  allowed boolean,
  used_count integer,
  daily_limit integer,
  resets_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_period date := (timezone('America/Sao_Paulo', now()))::date;
  v_used integer;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória.' using errcode = '42501'; end if;
  if p_company_id is null or p_scope !~ '^[A-Za-z0-9_.:-]{1,80}$' or p_limit < 1 or p_limit > 10000 then
    raise exception 'Parâmetros de limite inválidos.' using errcode = '22023';
  end if;

  select role::text into v_role
  from public.company_members
  where company_id = p_company_id and user_id = auth.uid() and status = 'active'
  limit 1;

  if v_role is null then raise exception 'Acesso da empresa não encontrado.' using errcode = '42501'; end if;
  if p_scope = 'company_invite_email' and v_role not in ('owner', 'manager') then
    raise exception 'Somente dono ou gerente pode enviar convites.' using errcode = '42501';
  end if;

  insert into public.company_rate_limits(company_id, scope, period_date, used_count, updated_at)
  values (p_company_id, p_scope, v_period, 0, now())
  on conflict (company_id, scope, period_date) do nothing;

  if p_consume then
    update public.company_rate_limits
    set used_count = company_rate_limits.used_count + 1, updated_at = now()
    where company_id = p_company_id
      and scope = p_scope
      and period_date = v_period
      and company_rate_limits.used_count < p_limit
    returning company_rate_limits.used_count into v_used;

    if v_used is null then
      select company_rate_limits.used_count into v_used
      from public.company_rate_limits
      where company_id = p_company_id and scope = p_scope and period_date = v_period;
      return query select false, coalesce(v_used, p_limit), p_limit,
        ((v_period + 1)::timestamp at time zone 'America/Sao_Paulo');
      return;
    end if;
  else
    select company_rate_limits.used_count into v_used
    from public.company_rate_limits
    where company_id = p_company_id and scope = p_scope and period_date = v_period;
  end if;

  return query select case when p_consume then true else coalesce(v_used, 0) < p_limit end,
    coalesce(v_used, 0), p_limit,
    ((v_period + 1)::timestamp at time zone 'America/Sao_Paulo');
end;
$$;

revoke all on function public.consume_company_rate_limit(uuid, text, integer, boolean) from public, anon;
grant execute on function public.consume_company_rate_limit(uuid, text, integer, boolean) to authenticated;

commit;
