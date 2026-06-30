-- Comptes-rendus de réunion de chantier : table parent (meeting_reports) +
-- points d'action enfants (meeting_action_items), sur le même modèle que
-- quotes/quote_items (suivi de statut indépendant par point d'action).

create table public.meeting_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  meeting_date date not null default current_date,
  location text,
  attendees jsonb not null default '[]'::jsonb,
  agenda text,
  notes text,
  next_meeting_date date,
  document_id uuid references public.documents(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.meeting_reports.attendees is
  'Liste jsonb de participants : { name, role?, member_id? } (membre interne ou contact externe en saisie libre).';
comment on column public.meeting_reports.document_id is
  'Document archivé (PDF du compte-rendu) une fois généré et envoyé dans Documents.';

create index idx_meeting_reports_project on public.meeting_reports(project_id);
create index idx_meeting_reports_date on public.meeting_reports(meeting_date);

create trigger trg_meeting_reports_updated_at
  before update on public.meeting_reports
  for each row execute function public.set_updated_at();

create table public.meeting_action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_report_id uuid not null references public.meeting_reports(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  description text not null,
  assigned_to uuid references public.profiles(id) on delete set null,
  due_date date,
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now()
);

create index idx_meeting_action_items_report on public.meeting_action_items(meeting_report_id);
create index idx_meeting_action_items_project on public.meeting_action_items(project_id);

alter table public.meeting_reports enable row level security;
alter table public.meeting_action_items enable row level security;

create policy meeting_reports_select_member on public.meeting_reports
  for select using (public.is_project_member(project_id));

create policy meeting_reports_manage_member on public.meeting_reports
  for all using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));

create policy meeting_action_items_select_member on public.meeting_action_items
  for select using (public.is_project_member(project_id));

create policy meeting_action_items_manage_member on public.meeting_action_items
  for all using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
