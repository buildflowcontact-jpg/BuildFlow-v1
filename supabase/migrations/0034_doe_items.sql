-- DOE (Dossier des Ouvrages Exécutés) : checklist des pièces attendues à la
-- réception/livraison du chantier, organisée par lot et par entreprise, avec
-- statut de collecte et lien vers le document archivé une fois reçu.

create table public.doe_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  lot text not null,
  company_id uuid references public.companies(id) on delete set null,
  category text not null default 'autre' check (category in ('plan', 'notice_technique', 'pv_reception', 'garantie', 'dossier_entretien', 'autre')),
  label text not null,
  status text not null default 'manquant' check (status in ('manquant', 'recu', 'valide')),
  document_id uuid references public.documents(id) on delete set null,
  received_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.doe_items.lot is
  'Lot ou corps d''état concerné (texte libre, aligné sur quote_items.lot).';
comment on column public.doe_items.category is
  'Type de pièce attendue : plan (plan d''exécution / DOE), notice_technique, pv_reception, garantie, dossier_entretien, autre.';
comment on column public.doe_items.document_id is
  'Document archivé (type=doe) une fois la pièce reçue.';

create index idx_doe_items_project on public.doe_items(project_id);
create index idx_doe_items_lot on public.doe_items(project_id, lot);

create trigger trg_doe_items_updated_at
  before update on public.doe_items
  for each row execute function public.set_updated_at();

alter table public.doe_items enable row level security;

create policy doe_items_select_member on public.doe_items
  for select using (public.is_project_member(project_id));

create policy doe_items_manage_member on public.doe_items
  for all using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
