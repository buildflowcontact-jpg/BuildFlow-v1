-- =========================================================================
-- BuildFlow — 0001_schema.sql
-- Schéma complet : tables métier, contraintes, index, fonctions, triggers.
-- =========================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------------
-- Fonction générique updated_at
-- -------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -------------------------------------------------------------------------
-- PROFILES
-- -------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  phone text,
  job_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------------------
-- ORGANIZATIONS
-- -------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- Création automatique d'une organisation personnelle à l'inscription
create or replace function public.handle_new_profile_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_slug text;
begin
  v_slug := 'org-' || replace(new.id::text, '-', '');
  insert into public.organizations (name, slug, owner_id)
  values (coalesce(new.full_name, new.email, 'Mon entreprise'), v_slug, new.id)
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, new.id, 'owner');

  return new;
end;
$$;

create trigger trg_on_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_profile_organization();

-- -------------------------------------------------------------------------
-- CLIENTS
-- -------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  company_name text,
  email text,
  phone text,
  address text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_clients_organization on public.clients(organization_id);

create trigger trg_clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- COMPANIES (entreprise principale, sous-traitants, fournisseurs)
-- -------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  type text not null default 'sous_traitant' check (type in ('principale', 'sous_traitant', 'fournisseur', 'autre')),
  contact_name text,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_companies_organization on public.companies(organization_id);

create trigger trg_companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- PROJECTS
-- -------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  reference text,
  description text,
  client_id uuid references public.clients(id) on delete set null,
  status text not null default 'prospection' check (
    status in ('prospection', 'devis', 'etude', 'preparation', 'approvisionnement', 'chantier', 'reception', 'livre', 'annule')
  ),
  start_date date,
  end_date_planned date,
  end_date_actual date,
  budget numeric(14,2),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_projects_organization on public.projects(organization_id);
create index idx_projects_client on public.projects(client_id);
create index idx_projects_status on public.projects(status);

create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- Le créateur du projet devient automatiquement owner dans project_members
create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null default 'collaborator' check (role in ('owner', 'collaborator')),
  invited_email text,
  invited_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index idx_project_members_project on public.project_members(project_id);
create index idx_project_members_user on public.project_members(user_id);

create or replace function public.handle_new_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_members (project_id, user_id, role, accepted_at)
  values (new.id, new.owner_id, 'owner', now());
  return new;
end;
$$;

create trigger trg_on_project_created
  after insert on public.projects
  for each row execute function public.handle_new_project();

create table public.project_companies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  role text,
  created_at timestamptz not null default now(),
  unique (project_id, company_id)
);

-- -------------------------------------------------------------------------
-- PHASES
-- -------------------------------------------------------------------------
create table public.phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  type text not null default 'custom' check (
    type in ('commercial', 'etudes', 'preparation', 'approvisionnement', 'chantier', 'reception', 'custom')
  ),
  order_index int not null default 0,
  start_date date,
  end_date date,
  status text not null default 'a_venir' check (status in ('a_venir', 'en_cours', 'termine')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_phases_project on public.phases(project_id);

create trigger trg_phases_updated_at
  before update on public.phases
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- TASKS (hiérarchie récursive illimitée)
-- -------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  phase_id uuid references public.phases(id) on delete set null,
  parent_task_id uuid references public.tasks(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'blocked', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  progress int not null default 0 check (progress >= 0 and progress <= 100),
  start_date date,
  end_date date,
  is_milestone boolean not null default false,
  assignee_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_tasks_project on public.tasks(project_id);
create index idx_tasks_phase on public.tasks(phase_id);
create index idx_tasks_parent on public.tasks(parent_task_id);
create index idx_tasks_assignee on public.tasks(assignee_id);

create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- Empêche qu'une tâche soit son propre parent direct, validation supplémentaire en appli
create or replace function public.check_task_parent_not_self()
returns trigger
language plpgsql
as $$
begin
  if new.parent_task_id is not null and new.parent_task_id = new.id then
    raise exception 'Une tâche ne peut pas être son propre parent';
  end if;
  return new;
end;
$$;

create trigger trg_tasks_parent_not_self
  before insert or update on public.tasks
  for each row execute function public.check_task_parent_not_self();

-- -------------------------------------------------------------------------
-- TASK DEPENDENCIES (avec protection anti cycle)
-- -------------------------------------------------------------------------
create table public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  type text not null default 'finish_to_start' check (
    type in ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish')
  ),
  created_at timestamptz not null default now(),
  unique (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create index idx_task_deps_task on public.task_dependencies(task_id);
create index idx_task_deps_depends_on on public.task_dependencies(depends_on_task_id);

-- Détection de cycle via parcours récursif avant insertion/maj
create or replace function public.check_no_circular_dependency()
returns trigger
language plpgsql
as $$
declare
  v_has_cycle boolean;
begin
  with recursive chain as (
    select new.depends_on_task_id as task_id
    union all
    select td.depends_on_task_id
    from public.task_dependencies td
    join chain c on td.task_id = c.task_id
  )
  select exists(select 1 from chain where task_id = new.task_id) into v_has_cycle;

  if v_has_cycle then
    raise exception 'Dépendance circulaire détectée entre les tâches';
  end if;

  return new;
end;
$$;

create trigger trg_no_circular_dependency
  before insert or update on public.task_dependencies
  for each row execute function public.check_no_circular_dependency();

-- -------------------------------------------------------------------------
-- COMMENTS (polymorphe : tasks, documents, incidents)
-- -------------------------------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_type text not null check (parent_type in ('task', 'document', 'incident')),
  parent_id uuid not null,
  author_id uuid not null references public.profiles(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_comments_parent on public.comments(parent_type, parent_id);
create index idx_comments_project on public.comments(project_id);

create trigger trg_comments_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- DOCUMENTS (Supabase Storage)
-- -------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  type text not null default 'autre' check (type in ('pdf', 'plan', 'photo', 'doe', 'compte_rendu', 'autre')),
  storage_path text not null,
  size_bytes bigint,
  mime_type text,
  version int not null default 1,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_documents_project on public.documents(project_id);

create trigger trg_documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- PLANS (versionnage + annotations)
-- -------------------------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  current_version int not null default 1,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_plans_project on public.plans(project_id);

create trigger trg_plans_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

create table public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  version int not null,
  storage_path text not null,
  notes text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (plan_id, version)
);

create index idx_plan_versions_plan on public.plan_versions(plan_id);

create table public.plan_annotations (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references public.plan_versions(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  x numeric not null,
  y numeric not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index idx_plan_annotations_version on public.plan_annotations(plan_version_id);

-- -------------------------------------------------------------------------
-- MODELS3D
-- -------------------------------------------------------------------------
create table public.models3d (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  storage_path text not null,
  format text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_models3d_project on public.models3d(project_id);

create trigger trg_models3d_updated_at
  before update on public.models3d
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- SUPPLIES (approvisionnements)
-- -------------------------------------------------------------------------
create table public.supplies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  supplier_name text not null,
  order_reference text,
  item_description text not null,
  quantity numeric(12,2) not null default 1,
  unit text,
  status text not null default 'pending' check (
    status in ('pending', 'ordered', 'shipped', 'delivered', 'delayed', 'cancelled')
  ),
  expected_delivery_date date,
  actual_delivery_date date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_supplies_project on public.supplies(project_id);
create index idx_supplies_status on public.supplies(status);

create trigger trg_supplies_updated_at
  before update on public.supplies
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- INCIDENTS
-- -------------------------------------------------------------------------
create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  location text,
  reported_by uuid references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  photo_document_id uuid references public.documents(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_incidents_project on public.incidents(project_id);
create index idx_incidents_status on public.incidents(status);

create trigger trg_incidents_updated_at
  before update on public.incidents
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- PUNCH LIST (réserves de réception)
-- -------------------------------------------------------------------------
create table public.punch_list_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  location text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'verified')),
  assigned_to uuid references public.profiles(id) on delete set null,
  due_date date,
  photo_document_id uuid references public.documents(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_punch_list_project on public.punch_list_items(project_id);
create index idx_punch_list_status on public.punch_list_items(status);

create trigger trg_punch_list_updated_at
  before update on public.punch_list_items
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- NOTIFICATIONS
-- -------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on public.notifications(user_id, is_read);

-- -------------------------------------------------------------------------
-- ACTIVITY LOGS
-- -------------------------------------------------------------------------
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_activity_logs_project on public.activity_logs(project_id, created_at desc);

-- -------------------------------------------------------------------------
-- RESOURCE PERMISSIONS (partage fin par ressource)
-- -------------------------------------------------------------------------
create table public.resource_permissions (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null check (resource_type in ('document', 'plan', 'task', 'project')),
  resource_id uuid not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  grantee_user_id uuid not null references public.profiles(id) on delete cascade,
  permission text not null check (permission in ('view', 'edit', 'manage')),
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (resource_type, resource_id, grantee_user_id)
);

create index idx_resource_permissions_lookup on public.resource_permissions(resource_type, resource_id, grantee_user_id);

-- -------------------------------------------------------------------------
-- PLANNING SNAPSHOTS (figer / archiver un planning)
-- -------------------------------------------------------------------------
create table public.planning_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  snapshot jsonb not null,
  is_archived boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_planning_snapshots_project on public.planning_snapshots(project_id);
