-- Garante o teste de 30 dias no primeiro acesso, inclusive para uma conta que
-- tenha sido criada durante uma implantação incompleta. Não renova testes já
-- existentes, não altera pagamentos e não concede acesso a outra empresa.
begin;

create or replace function public.billing_access(p_company_id uuid default null)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare target uuid; result jsonb;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória.' using errcode='42501'; end if;
  if p_company_id is not null then
    if not public.is_company_member(p_company_id) then raise exception 'Acesso negado.' using errcode='42501'; end if;
    target:=public.billing_company_owner(p_company_id);
  else target:=auth.uid(); end if;
  if target is null then raise exception 'Conta responsável não encontrada.' using errcode='P0002'; end if;

  -- O trigger continua sendo o caminho normal. Este insert idempotente repara
  -- somente a ausência do registro, sem reiniciar nenhum prazo existente.
  if coalesce((select enabled from public.billing_control where id),false)
    and not exists(select 1 from public.sales_admins sa where sa.user_id=target
      and coalesce((to_jsonb(sa)->>'active')::boolean,true)) then
    insert into public.billing_accounts(owner_user_id,trial_started_at,trial_ends_at)
      values(target,now(),now()+interval '30 days') on conflict do nothing;
  end if;

  result:=public.billing_account_access(target);
  return result||jsonb_build_object('can_manage',target=auth.uid(),'company_id',p_company_id);
end;
$$;

-- Reinstala de forma idempotente o cadastro automático para as próximas contas.
drop trigger if exists obraativa_billing_new_account on auth.users;
create trigger obraativa_billing_new_account after insert on auth.users
  for each row execute function public.billing_new_account();

-- Repara contas eventualmente omitidas na janela da implantação. Quem já tem
-- registro preserva exatamente as datas atuais por causa do ON CONFLICT.
insert into public.billing_accounts(owner_user_id,trial_started_at,trial_ends_at)
select u.id,now(),now()+interval '30 days'
from auth.users u
where coalesce((select enabled from public.billing_control where id),false)
on conflict do nothing;

revoke all on function public.billing_access(uuid) from public,anon,authenticated;
grant execute on function public.billing_access(uuid) to authenticated;
commit;
