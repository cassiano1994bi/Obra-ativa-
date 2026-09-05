-- ObraAtiva: compatibilidade aditiva com o histórico administrativo legado.
-- Instalações antigas usam actor_id/detail; as atuais usam os campos estruturados.
-- O gatilho mantém os dois formatos sincronizados sem remover o histórico existente.
begin;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='admin_audit_log' and column_name='actor_id'
  ) then
    alter table public.admin_audit_log add column if not exists actor_user_id uuid;
    alter table public.admin_audit_log add column if not exists target_type text;
    alter table public.admin_audit_log add column if not exists target_id text;
    alter table public.admin_audit_log add column if not exists details jsonb not null default '{}'::jsonb;

    update public.admin_audit_log
      set actor_user_id=actor_id
      where actor_user_id is null;

    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='admin_audit_log' and column_name='detail'
    ) then
      update public.admin_audit_log
        set details=jsonb_build_object('legacy_detail',detail)
        where coalesce(detail,'')<>'' and details='{}'::jsonb;

      execute $trigger_function$
        create or replace function public.sync_admin_audit_log_legacy()
        returns trigger language plpgsql set search_path=public,pg_temp as $body$
        begin
          new.actor_user_id:=coalesce(new.actor_user_id,new.actor_id);
          new.actor_id:=coalesce(new.actor_id,new.actor_user_id);
          new.details:=coalesce(new.details,'{}'::jsonb);
          if coalesce(new.detail,'')='' then
            new.detail:=concat_ws(' · ',nullif(new.target_type,''),nullif(new.target_id,''),
              case when new.details='{}'::jsonb then null else new.details::text end);
          end if;
          return new;
        end;
        $body$;
      $trigger_function$;

      drop trigger if exists admin_audit_log_legacy_sync on public.admin_audit_log;
      create trigger admin_audit_log_legacy_sync
        before insert on public.admin_audit_log
        for each row execute function public.sync_admin_audit_log_legacy();
    end if;
  end if;
end;
$$;

commit;
