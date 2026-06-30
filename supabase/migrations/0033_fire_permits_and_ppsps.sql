-- Sécurité chantier : permis de feu (intervention par point chaud, avec
-- checklist de précautions et signatures) et suivi PPSPS par entreprise
-- (accusé de réception/validation du Plan Particulier de Sécurité et de
-- Protection de la Santé avant intervention).

create table public.fire_permits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  location text not null,
  work_description text not null,
  company_id uuid references public.companies(id) on delete set null,
  executant_name text not null,
  work_date date not null default current_date,
  start_time time,
  end_time time,
  fire_watch_minutes integer not null default 60,
  precautions jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'issued', 'closed')),
  document_id uuid references public.documents(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.fire_permits.precautions is
  'Checklist jsonb des mesures de prévention : [{ label, checked }].';
comment on column public.fire_permits.fire_watch_minutes is
  'Durée de surveillance après l''arrêt des travaux par point chaud (minimum recommandé : 60 minutes).';
comment on column public.fire_permits.document_id is
  'Document archivé (PDF du permis signé) une fois émis et envoyé dans Documents.';

create index idx_fire_permits_project on public.fire_permits(project_id);
create index idx_fire_permits_date on public.fire_permits(work_date);

create trigger trg_fire_permits_updated_at
  before update on public.fire_permits
  for each row execute function public.set_updated_at();

create table public.ppsps_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  status text not null default 'en_attente' check (status in ('en_attente', 'recu', 'valide')),
  received_date date,
  document_id uuid references public.documents(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, company_id)
);

comment on column public.ppsps_records.document_id is
  'PPSPS de l''entreprise (document uploadé dans Documents).';

create index idx_ppsps_records_project on public.ppsps_records(project_id);

create trigger trg_ppsps_records_updated_at
  before update on public.ppsps_records
  for each row execute function public.set_updated_at();

alter table public.fire_permits enable row level security;
alter table public.ppsps_records enable row level security;

create policy fire_permits_select_member on public.fire_permits
  for select using (public.is_project_member(project_id));

create policy fire_permits_manage_member on public.fire_permits
  for all using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));

create policy ppsps_records_select_member on public.ppsps_records
  for select using (public.is_project_member(project_id));

create policy ppsps_records_manage_member on public.ppsps_records
  for all using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
