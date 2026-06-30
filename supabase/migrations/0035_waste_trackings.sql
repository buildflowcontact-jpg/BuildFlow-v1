-- Suivi des déchets de chantier (BSD — Bordereau de Suivi des Déchets).
-- Permet de tracer chaque flux de déchets depuis le chantier jusqu'à
-- l'exutoire final (installation de traitement / valorisation), avec le
-- transporteur, la quantité, le statut d'enlèvement et le lien vers le
-- bordereau scanné archivé en documents.

create table public.waste_trackings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  bsd_number text,
  waste_category text not null default 'non_dangereux'
    check (waste_category in ('dangereux', 'non_dangereux', 'inerte')),
  waste_description text not null,
  quantity_tons numeric(10, 3),
  company_id uuid references public.companies(id) on delete set null,
  disposal_site text,
  removal_date date,
  status text not null default 'en_attente'
    check (status in ('en_attente', 'enleve', 'traite')),
  document_id uuid references public.documents(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.waste_trackings.bsd_number is
  'Numéro de bordereau (ex. Trackdéchets) — libre si non dématérialisé.';
comment on column public.waste_trackings.waste_category is
  'Catégorie réglementaire : dangereux (DIS), non_dangereux (DIB), inerte (gravats propres).';
comment on column public.waste_trackings.quantity_tons is
  'Quantité estimée ou pesée en tonnes.';
comment on column public.waste_trackings.company_id is
  'Transporteur / collecteur agréé.';
comment on column public.waste_trackings.disposal_site is
  'Installation de traitement, valorisation ou mise en décharge (ISDND/ISDI/ISDD).';
comment on column public.waste_trackings.document_id is
  'Bordereau signé archivé en Documents.';

create index idx_waste_trackings_project on public.waste_trackings(project_id);
create index idx_waste_trackings_category on public.waste_trackings(project_id, waste_category);

create trigger trg_waste_trackings_updated_at
  before update on public.waste_trackings
  for each row execute function public.set_updated_at();

alter table public.waste_trackings enable row level security;

create policy waste_trackings_select_member on public.waste_trackings
  for select using (public.is_project_member(project_id));

create policy waste_trackings_manage_member on public.waste_trackings
  for all using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));
