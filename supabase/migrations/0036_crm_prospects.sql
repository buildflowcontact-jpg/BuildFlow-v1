-- Mini-CRM : suivi des affaires en prospection et des visites techniques,
-- à l'échelle de l'organisation (hors projet, car un prospect n'a pas encore
-- de projet BuildFlow). Une colonne project_id nullable permet de lier le
-- prospect à un projet une fois l'affaire gagnée et convertie.

create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  client_name text,
  contact_name text,
  contact_phone text,
  contact_email text,
  address text,
  work_type text,
  estimated_budget numeric(14, 2),
  source text not null default 'autre'
    check (source in ('bouche_a_oreille', 'site_web', 'appel_offre', 'reseau', 'partenaire', 'autre')),
  status text not null default 'prospect'
    check (status in ('prospect', 'visite_planifiee', 'devis_en_cours', 'gagne', 'perdu', 'sans_suite')),
  next_action text,
  next_action_date date,
  notes text,
  project_id uuid references public.projects(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.prospects.source is
  'Origine de la prise de contact : bouche_a_oreille, site_web, appel_offre, reseau, partenaire, autre.';
comment on column public.prospects.status is
  'Stade dans le pipeline CRM.';
comment on column public.prospects.project_id is
  'Projet BuildFlow créé lors de la conversion d''un prospect gagné.';

create index idx_prospects_org on public.prospects(organization_id);
create index idx_prospects_status on public.prospects(organization_id, status);

create trigger trg_prospects_updated_at
  before update on public.prospects
  for each row execute function public.set_updated_at();

alter table public.prospects enable row level security;

create policy prospects_select_member on public.prospects
  for select using (public.is_org_member(organization_id));

create policy prospects_manage_member on public.prospects
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- Visites techniques associées à un prospect
create table public.prospect_visits (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  visit_date date not null,
  duration_minutes integer,
  attendees text,
  notes text,
  outcome text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.prospect_visits.attendees is
  'Participants à la visite (texte libre).';
comment on column public.prospect_visits.outcome is
  'Résultat / suite donnée à la visite.';

create index idx_prospect_visits_prospect on public.prospect_visits(prospect_id);

create trigger trg_prospect_visits_updated_at
  before update on public.prospect_visits
  for each row execute function public.set_updated_at();

alter table public.prospect_visits enable row level security;

-- RLS via le prospect (et donc l'organisation)
create policy prospect_visits_select_member on public.prospect_visits
  for select using (
    exists (
      select 1 from public.prospects p
      where p.id = prospect_id
        and public.is_org_member(p.organization_id)
    )
  );

create policy prospect_visits_manage_member on public.prospect_visits
  for all using (
    exists (
      select 1 from public.prospects p
      where p.id = prospect_id
        and public.is_org_member(p.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.prospects p
      where p.id = prospect_id
        and public.is_org_member(p.organization_id)
    )
  );
