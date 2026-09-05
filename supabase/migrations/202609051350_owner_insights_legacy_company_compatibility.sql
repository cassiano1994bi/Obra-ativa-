-- ObraAtiva: torna o relatório do proprietário compatível com empresas antigas.
-- A origem da empresa passa a usar company_members, que já é a relação canônica
-- de propriedade nas instalações antigas e atuais. Nenhum dado é alterado.
begin;

create or replace function public.owner_insights_report(p_days integer default 30,p_search text default '',p_offset integer default 0,p_activity text default 'all')
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
      (select i.email from public.company_invitations ci join auth.users i on i.id=ci.invited_by
        where ci.accepted_by=u.id or (ci.accepted_by is null and ci.status='accepted' and lower(ci.email)=lower(u.email))
        order by ci.accepted_at desc nulls last,ci.created_at desc limit 1) as invited_by,
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
      (select count(distinct r.company_id) from public.product_campaign_receipts r
        where r.kind='payment' and exists(
          select 1 from public.company_members m
          join public.product_campaign_visits v on v.user_id=m.user_id
          join auth.users u on u.id=v.user_id
          where m.company_id=r.company_id and m.role='owner' and m.status='active'
            and v.campaign_id=c.id and u.created_at>=v_start)) as customers,
      (select coalesce(sum(case when r.kind='refund' then -r.amount else r.amount end),0)
        from public.product_campaign_receipts r where r.day>=v_since and exists(
          select 1 from public.company_members m
          join public.product_campaign_visits v on v.user_id=m.user_id
          where m.company_id=r.company_id and m.role='owner' and m.status='active' and v.campaign_id=c.id)) as revenue
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

comment on function public.owner_insights_report(integer,text,integer,text) is
  'Relatório restrito ao proprietário, compatível com empresas antigas via company_members.';

commit;
