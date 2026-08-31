-- Controle de Obra — links públicos de orçamento para a sincronização atual.
--
-- Esta migração NÃO altera app_state, obras, clientes, equipe ou pagamentos.
-- Ela cria uma área isolada somente para a cópia pública de cada orçamento e
-- para a resposta do cliente. O token bruto nunca é salvo no banco.

begin;

create extension if not exists pgcrypto;

create table if not exists public.budget_public_proposals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  local_budget_id text not null check (char_length(local_budget_id) between 1 and 180),
  version_number integer not null default 1 check (version_number > 0),
  token_sha256 text not null unique check (char_length(token_sha256) = 64),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  valid_until date not null,
  expires_at timestamptz not null,
  status text not null default 'Link enviado' check (status in ('Link enviado', 'Visualizado', 'Aprovado', 'Alterações solicitadas', 'Recusado', 'Expirado', 'Cancelado')),
  sent_at timestamptz not null default now(),
  viewed_at timestamptz,
  responded_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, local_budget_id)
);

create index if not exists budget_public_proposals_owner_idx
  on public.budget_public_proposals(owner_id, updated_at desc);
create index if not exists budget_public_proposals_token_idx
  on public.budget_public_proposals(token_sha256);

create table if not exists public.budget_public_responses (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.budget_public_proposals(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  decision text not null check (decision in ('approved', 'revision_requested', 'rejected')),
  signer_name text not null check (char_length(trim(signer_name)) between 3 and 160),
  notes text not null default '' check (char_length(notes) <= 1200),
  consent_version text not null,
  responded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(proposal_id, version_number)
);

create index if not exists budget_public_responses_proposal_idx
  on public.budget_public_responses(proposal_id, responded_at desc);

create table if not exists public.budget_public_events (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.budget_public_proposals(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  event_type text not null check (event_type in ('link_created', 'link_viewed', 'approved', 'revision_requested', 'rejected', 'link_revoked', 'expired')),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists budget_public_events_proposal_idx
  on public.budget_public_events(proposal_id, occurred_at desc);

alter table public.budget_public_proposals enable row level security;
alter table public.budget_public_responses enable row level security;
alter table public.budget_public_events enable row level security;

-- Nenhuma tabela é lida diretamente pelo navegador. O dono usa apenas as
-- funções abaixo e o visitante só recebe a fotografia pública do orçamento.
revoke all on public.budget_public_proposals, public.budget_public_responses, public.budget_public_events from public, anon, authenticated;

create or replace function public.budget_public_issue_link(
  p_local_budget_id text,
  p_snapshot jsonb,
  p_valid_until date
) returns table(raw_token text, version_number integer, status text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_row public.budget_public_proposals;
  next_token text;
  next_hash text;
  next_expiry timestamptz;
  next_version integer;
begin
  if auth.uid() is null then
    raise exception 'Faça login para gerar um link.';
  end if;
  if char_length(trim(coalesce(p_local_budget_id, ''))) not between 1 and 180 then
    raise exception 'Orçamento inválido.';
  end if;
  if jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'Conteúdo do orçamento inválido.';
  end if;
  if p_valid_until is null or p_valid_until < current_date then
    raise exception 'A validade do orçamento precisa ser hoje ou uma data futura.';
  end if;

  -- No Supabase, pgcrypto é instalado no schema extensions. A referência
  -- qualificada mantém o token criptograficamente aleatório mesmo com o
  -- search_path restrito das funções security definer.
  next_token := encode(extensions.gen_random_bytes(32), 'hex');
  next_hash := encode(extensions.digest(next_token, 'sha256'), 'hex');
  next_expiry := least((p_valid_until + 1)::timestamptz, now() + interval '365 days');
  if next_expiry <= now() then
    raise exception 'A validade do orçamento terminou.';
  end if;

  select * into current_row
  from public.budget_public_proposals
  where owner_id = auth.uid() and local_budget_id = trim(p_local_budget_id)
  for update;

  if found then
    next_version := current_row.version_number + 1;
    -- O link anterior deixa de funcionar, mas a resposta anterior permanece
    -- no histórico para auditoria e consulta do dono.
    if current_row.revoked_at is null and current_row.responded_at is null then
      insert into public.budget_public_events(proposal_id, version_number, event_type)
      values(current_row.id, current_row.version_number, 'link_revoked');
    end if;
    update public.budget_public_proposals
       set version_number = next_version,
           token_sha256 = next_hash,
           snapshot = p_snapshot,
           valid_until = p_valid_until,
           expires_at = next_expiry,
           status = 'Link enviado',
           sent_at = now(),
           viewed_at = null,
           responded_at = null,
           revoked_at = null,
           updated_at = now()
     where id = current_row.id;
  else
    next_version := 1;
    insert into public.budget_public_proposals(
      owner_id, local_budget_id, version_number, token_sha256, snapshot, valid_until, expires_at, status
    ) values (
      auth.uid(), trim(p_local_budget_id), next_version, next_hash, p_snapshot, p_valid_until, next_expiry, 'Link enviado'
    ) returning * into current_row;
  end if;

  if current_row.id is null then
    select * into current_row from public.budget_public_proposals
      where owner_id = auth.uid() and local_budget_id = trim(p_local_budget_id);
  end if;
  insert into public.budget_public_events(proposal_id, version_number, event_type, metadata)
  values(current_row.id, next_version, 'link_created', jsonb_build_object('expiresAt', next_expiry));

  return query select next_token, next_version, 'Link enviado'::text, next_expiry;
end;
$$;

create or replace function public.budget_public_owner_statuses(p_local_budget_ids text[] default null)
returns table(
  local_budget_id text,
  version_number integer,
  status text,
  valid_until date,
  sent_at timestamptz,
  viewed_at timestamptz,
  responded_at timestamptz,
  signer_name text,
  decision text,
  notes text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    proposal.local_budget_id,
    proposal.version_number,
    proposal.status,
    proposal.valid_until,
    proposal.sent_at,
    proposal.viewed_at,
    proposal.responded_at,
    response.signer_name,
    response.decision,
    response.notes
  from public.budget_public_proposals proposal
  left join lateral (
    select signer_name, decision, notes
    from public.budget_public_responses response
    where response.proposal_id = proposal.id
      and response.version_number = proposal.version_number
    limit 1
  ) response on true
  where proposal.owner_id = auth.uid()
    and (p_local_budget_ids is null or proposal.local_budget_id = any(p_local_budget_ids));
$$;

create or replace function public.budget_public_snapshot(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  token_hash text;
  proposal public.budget_public_proposals;
begin
  if char_length(trim(coalesce(p_token, ''))) <> 64 then
    raise exception 'Esta proposta não está disponível. Solicite uma nova versão à construtora.';
  end if;
  token_hash := encode(extensions.digest(lower(p_token), 'sha256'), 'hex');
  select * into proposal from public.budget_public_proposals
    where token_sha256 = token_hash
    for update;
  if not found or proposal.revoked_at is not null then
    raise exception 'Esta proposta não está disponível. Solicite uma nova versão à construtora.';
  end if;
  if proposal.expires_at <= now() then
    if proposal.status in ('Link enviado', 'Visualizado') then
      update public.budget_public_proposals set status = 'Expirado', updated_at = now() where id = proposal.id;
      insert into public.budget_public_events(proposal_id, version_number, event_type)
      values(proposal.id, proposal.version_number, 'expired');
    end if;
    raise exception 'Esta proposta não está disponível. Solicite uma nova versão à construtora.';
  end if;
  if proposal.viewed_at is null and proposal.status = 'Link enviado' then
    update public.budget_public_proposals
       set viewed_at = now(), status = 'Visualizado', updated_at = now()
     where id = proposal.id;
    insert into public.budget_public_events(proposal_id, version_number, event_type)
    values(proposal.id, proposal.version_number, 'link_viewed');
    select * into proposal from public.budget_public_proposals where id = proposal.id;
  end if;
  return proposal.snapshot || jsonb_build_object(
    'status', proposal.status,
    'version', proposal.version_number,
    'validUntil', proposal.valid_until,
    'respondedAt', proposal.responded_at
  );
end;
$$;

create or replace function public.budget_public_respond(
  p_token text,
  p_decision text,
  p_signer_name text,
  p_notes text default '',
  p_consent boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  token_hash text;
  proposal public.budget_public_proposals;
  normalized_decision text;
  next_status text;
  now_response timestamptz := now();
begin
  if char_length(trim(coalesce(p_token, ''))) <> 64 then
    raise exception 'Esta proposta não aceita mais respostas.';
  end if;
  normalized_decision := lower(trim(coalesce(p_decision, '')));
  if normalized_decision not in ('approved', 'revision_requested', 'rejected') then
    raise exception 'Escolha uma resposta válida.';
  end if;
  if char_length(trim(coalesce(p_signer_name, ''))) not between 3 and 160 then
    raise exception 'Informe seu nome completo.';
  end if;
  if char_length(coalesce(p_notes, '')) > 1200 then
    raise exception 'A mensagem pode ter no máximo 1.200 caracteres.';
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'Confirme que leu a proposta antes de enviar a resposta.';
  end if;
  token_hash := encode(extensions.digest(lower(p_token), 'sha256'), 'hex');
  select * into proposal from public.budget_public_proposals
    where token_sha256 = token_hash
    for update;
  if not found or proposal.revoked_at is not null or proposal.expires_at <= now() or proposal.responded_at is not null then
    raise exception 'Esta proposta não aceita mais respostas.';
  end if;
  if proposal.status not in ('Link enviado', 'Visualizado') then
    raise exception 'Esta proposta não aceita mais respostas.';
  end if;

  next_status := case normalized_decision
    when 'approved' then 'Aprovado'
    when 'revision_requested' then 'Alterações solicitadas'
    else 'Recusado'
  end;

  insert into public.budget_public_responses(
    proposal_id, version_number, decision, signer_name, notes, consent_version, responded_at
  ) values (
    proposal.id, proposal.version_number, normalized_decision, trim(p_signer_name), trim(coalesce(p_notes, '')),
    'commercial-consent-2026-08', now_response
  );
  update public.budget_public_proposals
     set status = next_status, responded_at = now_response, updated_at = now_response
   where id = proposal.id;
  insert into public.budget_public_events(proposal_id, version_number, event_type)
  values(proposal.id, proposal.version_number, normalized_decision);

  return jsonb_build_object('ok', true, 'status', next_status, 'respondedAt', now_response);
end;
$$;

revoke all on function public.budget_public_issue_link(text, jsonb, date),
  public.budget_public_owner_statuses(text[]),
  public.budget_public_snapshot(text),
  public.budget_public_respond(text, text, text, text, boolean) from public, anon, authenticated;

grant execute on function public.budget_public_issue_link(text, jsonb, date),
  public.budget_public_owner_statuses(text[]) to authenticated;
grant execute on function public.budget_public_snapshot(text),
  public.budget_public_respond(text, text, text, text, boolean) to anon, authenticated;

commit;
