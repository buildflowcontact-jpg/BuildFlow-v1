-- =========================================================================
-- BuildFlow — 0016_advanced_modules_hardening.sql
-- Corrige les avertissements du linter Supabase soulevés par 0015 :
--   1. search_path mutable sur les fonctions trigger de numérotation
--   2. index manquants sur les clés étrangères des nouvelles tables
-- =========================================================================

create or replace function public.assign_rfi_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.number is null then
    select coalesce(max(number), 0) + 1 into new.number
    from public.rfis
    where project_id = new.project_id;
  end if;
  return new;
end;
$$;

create or replace function public.assign_change_order_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.number is null then
    select coalesce(max(number), 0) + 1 into new.number
    from public.change_orders
    where project_id = new.project_id;
  end if;
  return new;
end;
$$;

-- Index manquants sur les clés étrangères des tables ajoutées en 0015.
create index if not exists idx_change_orders_decided_by on public.change_orders(decided_by);
create index if not exists idx_change_orders_requested_by on public.change_orders(requested_by);
create index if not exists idx_change_orders_signature on public.change_orders(signature_id);
create index if not exists idx_rfis_assigned_to on public.rfis(assigned_to);
create index if not exists idx_rfis_raised_by on public.rfis(raised_by);
create index if not exists idx_rfis_responded_by on public.rfis(responded_by);
create index if not exists idx_daily_logs_created_by on public.daily_logs(created_by);
create index if not exists idx_expenses_created_by on public.expenses(created_by);
create index if not exists idx_selections_created_by on public.selections(created_by);
create index if not exists idx_selections_decided_by on public.selections(decided_by);
create index if not exists idx_signatures_signer on public.signatures(signer_user_id);
create index if not exists idx_resource_attachments_document on public.resource_attachments(document_id);
create index if not exists idx_time_entries_task on public.time_entries(task_id);
