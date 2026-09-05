-- ObraAtiva: compatibilidade aditiva para instalações antigas de convites.
-- Não altera registros existentes; apenas completa a coluna já prevista no esquema atual.
begin;

alter table public.company_invitations
  add column if not exists accepted_by uuid references auth.users(id) on delete set null;

create index if not exists company_invitations_accepted_by_idx
  on public.company_invitations(accepted_by)
  where accepted_by is not null;

commit;
