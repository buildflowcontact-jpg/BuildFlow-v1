-- =========================================================================
-- BuildFlow — 0022_annotated_captures.sql
--
-- Backfill : ce fichier reconstitue le schéma "captures annotées" (3D + plans
-- 2D) tel qu'il a été appliqué directement sur le projet Supabase lors d'une
-- session précédente, sans fichier de migration correspondant (régression
-- découverte le 2026-06-25). Schéma reconstruit à partir du type généré
-- src/types/database.types.ts pour rester rejouable depuis zéro.
--
-- Principe : une capture est un brouillon privé (visible uniquement par son
-- auteur) tant qu'elle n'a pas été regroupée dans un rapport envoyé ; une
-- fois le rapport envoyé (capture_reports.sent_at renseigné), la capture
-- passe au statut "sent" et devient visible par tous les membres du projet.
-- =========================================================================

-- -------------------------------------------------------------------------
-- CAPTURE_REPORTS
-- -------------------------------------------------------------------------
create table public.capture_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  pdf_storage_path text,
  sent_at timestamptz,
  sent_to jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_capture_reports_project on public.capture_reports(project_id);

-- -------------------------------------------------------------------------
-- ANNOTATED_CAPTURES
-- -------------------------------------------------------------------------
create table public.annotated_captures (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_type text not null check (source_type in ('plan', 'model3d')),
  source_id uuid not null,
  source_label text not null,
  image_storage_path text not null,
  annotations jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'sent')),
  report_id uuid references public.capture_reports(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_annotated_captures_project on public.annotated_captures(project_id, status);
create index idx_annotated_captures_report on public.annotated_captures(report_id);

create trigger trg_annotated_captures_updated_at
  before update on public.annotated_captures
  for each row execute function public.set_updated_at();

-- =========================================================================
-- RLS
-- =========================================================================
alter table public.annotated_captures enable row level security;
alter table public.capture_reports enable row level security;

-- Brouillon : visible uniquement par son auteur. Une fois envoyée (statut
-- "sent"), visible par tout membre du projet.
create policy "annotated_captures_select_draft_own_or_sent_member" on public.annotated_captures
  for select using (
    (status = 'draft' and created_by = (select auth.uid()))
    or (status = 'sent' and public.is_project_member(project_id))
  );

create policy "annotated_captures_insert_own" on public.annotated_captures
  for insert with check (
    public.is_project_member(project_id) and created_by = (select auth.uid())
  );

create policy "annotated_captures_update_own_draft" on public.annotated_captures
  for update using (created_by = (select auth.uid()) and status = 'draft')
  with check (created_by = (select auth.uid()));

create policy "annotated_captures_delete_own_draft" on public.annotated_captures
  for delete using (created_by = (select auth.uid()) and status = 'draft');

-- Rapports : visibles par leur auteur (avant envoi) et par tout membre du
-- projet une fois envoyés. Création/mise à jour réservées à l'auteur — c'est
-- capturesService.sendReport() qui pilote tout le cycle de vie côté client.
create policy "capture_reports_select_own_or_sent_member" on public.capture_reports
  for select using (
    created_by = (select auth.uid())
    or (sent_at is not null and public.is_project_member(project_id))
  );

create policy "capture_reports_insert_own" on public.capture_reports
  for insert with check (
    public.is_project_member(project_id) and created_by = (select auth.uid())
  );

create policy "capture_reports_update_own" on public.capture_reports
  for update using (created_by = (select auth.uid()));

-- -------------------------------------------------------------------------
-- BUCKET "captures"
-- -------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('captures', 'captures', false, 52428800)
on conflict (id) do nothing;

create policy "captures_bucket_select_member" on storage.objects
  for select using (
    bucket_id = 'captures'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

create policy "captures_bucket_insert_member" on storage.objects
  for insert with check (
    bucket_id = 'captures'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

create policy "captures_bucket_delete_member" on storage.objects
  for delete using (
    bucket_id = 'captures'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );
