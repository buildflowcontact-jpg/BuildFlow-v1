-- =========================================================================
-- BuildFlow — 0025_quality_checklists.sql
--
-- Module Formulaires / checklists qualité (non-conformités).
--
-- Modèle :
--   quality_templates          : modèles de checklist réutilisables (ex.
--                                 "Réception gros œuvre", "Avant peinture")
--   quality_template_items     : points de contrôle d'un modèle
--   quality_inspections        : une exécution d'un modèle sur le chantier
--                                 (ou checklist ad hoc sans modèle)
--   quality_inspection_results : résultat par point de contrôle
--                                 (conforme / non_conforme / non_applicable)
--   non_conformities           : suivi des non-conformités, créées
--                                 automatiquement quand un résultat est
--                                 marqué "non_conforme" (trigger), ou
--                                 directement à la main.
--
-- Visibilité : module interne de suivi qualité, réservé à l'équipe (comme le
-- journal de chantier / RFI) — jamais visible par le rôle "client".
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. MODÈLES DE CHECKLIST
-- -------------------------------------------------------------------------
create table public.quality_templates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_quality_templates_project on public.quality_templates(project_id);

create trigger trg_quality_templates_updated_at
  before update on public.quality_templates
  for each row execute function public.set_updated_at();

create table public.quality_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.quality_templates(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_quality_template_items_template on public.quality_template_items(template_id, position);
create index idx_quality_template_items_project on public.quality_template_items(project_id);

-- -------------------------------------------------------------------------
-- 2. INSPECTIONS (exécution d'une checklist sur le chantier)
-- -------------------------------------------------------------------------
create table public.quality_inspections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  template_id uuid references public.quality_templates(id) on delete set null,
  title text not null,
  location text,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  inspected_by uuid references public.profiles(id) on delete set null,
  inspected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_quality_inspections_project on public.quality_inspections(project_id, created_at desc);

create trigger trg_quality_inspections_updated_at
  before update on public.quality_inspections
  for each row execute function public.set_updated_at();

create table public.quality_inspection_results (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.quality_inspections(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  template_item_id uuid references public.quality_template_items(id) on delete set null,
  label text not null,
  position int not null default 0,
  result text check (result in ('conforme', 'non_conforme', 'non_applicable')),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_quality_inspection_results_inspection on public.quality_inspection_results(inspection_id, position);
create index idx_quality_inspection_results_project on public.quality_inspection_results(project_id);

create trigger trg_quality_inspection_results_updated_at
  before update on public.quality_inspection_results
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- 3. NON-CONFORMITÉS
-- -------------------------------------------------------------------------
create table public.non_conformities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  inspection_id uuid references public.quality_inspections(id) on delete set null,
  inspection_result_id uuid references public.quality_inspection_results(id) on delete set null,
  title text not null,
  description text,
  severity text not null default 'mineure' check (severity in ('mineure', 'majeure', 'critique')),
  status text not null default 'ouverte' check (status in ('ouverte', 'en_cours', 'resolue', 'verifiee')),
  location text,
  assigned_to uuid references public.profiles(id) on delete set null,
  due_date date,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  resolution_notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (inspection_result_id)
);

create index idx_non_conformities_project on public.non_conformities(project_id, status);
create index idx_non_conformities_inspection on public.non_conformities(inspection_id);

create trigger trg_non_conformities_updated_at
  before update on public.non_conformities
  for each row execute function public.set_updated_at();

-- Création automatique d'une non-conformité quand un résultat de checklist
-- est marqué "non_conforme" (sans doublon grâce à la contrainte unique
-- ci-dessus sur inspection_result_id).
create or replace function public.create_non_conformity_from_result()
returns trigger
language plpgsql
as $$
declare
  v_location text;
begin
  if new.result = 'non_conforme' then
    select location into v_location from public.quality_inspections where id = new.inspection_id;

    insert into public.non_conformities (project_id, inspection_id, inspection_result_id, title, location)
    values (new.project_id, new.inspection_id, new.id, new.label, v_location)
    on conflict (inspection_result_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger trg_quality_inspection_results_create_nc
  after insert or update of result on public.quality_inspection_results
  for each row execute function public.create_non_conformity_from_result();

-- =========================================================================
-- RLS — module interne, réservé à l'équipe (cf. is_project_team_member, 0015)
-- =========================================================================
alter table public.quality_templates enable row level security;
alter table public.quality_template_items enable row level security;
alter table public.quality_inspections enable row level security;
alter table public.quality_inspection_results enable row level security;
alter table public.non_conformities enable row level security;

create policy "quality_templates_select_team" on public.quality_templates
  for select using (public.is_project_team_member(project_id));

create policy "quality_templates_manage_team" on public.quality_templates
  for all using (public.is_project_team_member(project_id))
  with check (public.is_project_team_member(project_id));

create policy "quality_template_items_select_team" on public.quality_template_items
  for select using (public.is_project_team_member(project_id));

create policy "quality_template_items_manage_team" on public.quality_template_items
  for all using (public.is_project_team_member(project_id))
  with check (public.is_project_team_member(project_id));

create policy "quality_inspections_select_team" on public.quality_inspections
  for select using (public.is_project_team_member(project_id));

create policy "quality_inspections_manage_team" on public.quality_inspections
  for all using (public.is_project_team_member(project_id))
  with check (public.is_project_team_member(project_id));

create policy "quality_inspection_results_select_team" on public.quality_inspection_results
  for select using (public.is_project_team_member(project_id));

create policy "quality_inspection_results_manage_team" on public.quality_inspection_results
  for all using (public.is_project_team_member(project_id))
  with check (public.is_project_team_member(project_id));

create policy "non_conformities_select_team" on public.non_conformities
  for select using (public.is_project_team_member(project_id));

create policy "non_conformities_manage_team" on public.non_conformities
  for all using (public.is_project_team_member(project_id))
  with check (public.is_project_team_member(project_id));
