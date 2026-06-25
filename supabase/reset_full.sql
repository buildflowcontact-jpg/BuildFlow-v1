-- =========================================================================
-- BuildFlow — reset_full.sql
-- Script de RESET COMPLET de la base Supabase.
-- À coller intégralement dans le SQL Editor de Supabase et exécuter.
-- Effet : supprime tout le schéma applicatif existant (tables, fonctions,
-- triggers, policies storage) puis recrée tout depuis zéro
-- (équivalent de 0001_schema.sql + 0002_rls_policies.sql + 0003_storage_buckets.sql).
--
-- ATTENTION : destructif. Toutes les données des tables ci-dessous seront perdues.
-- Les comptes auth.users ne sont PAS supprimés par ce script.
-- =========================================================================

-- =========================================================================
-- PARTIE 0 — DROP (nettoyage complet)
-- =========================================================================

-- Policies sur storage.objects créées par 0003
drop policy if exists "documents_bucket_select_member" on storage.objects;
drop policy if exists "documents_bucket_insert_member" on storage.objects;
drop policy if exists "documents_bucket_delete_member" on storage.objects;
drop policy if exists "plans_bucket_select_member" on storage.objects;
drop policy if exists "plans_bucket_insert_member" on storage.objects;
drop policy if exists "plans_bucket_delete_member" on storage.objects;
drop policy if exists "models3d_bucket_select_member" on storage.objects;
drop policy if exists "models3d_bucket_insert_member" on storage.objects;
drop policy if exists "models3d_bucket_delete_member" on storage.objects;
drop policy if exists "avatars_bucket_public_select" on storage.objects;
drop policy if exists "avatars_bucket_insert_own" on storage.objects;
drop policy if exists "avatars_bucket_update_own" on storage.objects;
drop policy if exists "avatars_bucket_delete_own" on storage.objects;

-- Buckets : la suppression directe des lignes storage.objects/storage.buckets
-- est bloquée par Supabase (protect_delete trigger) — il faut passer par la
-- Storage API ou le dashboard si tu veux vraiment vider les fichiers existants.
-- Ce script ne touche donc pas aux objets déjà uploadés ; la recréation des
-- buckets plus bas utilise "on conflict do nothing" et est donc idempotente.

-- Triggers sur auth.users (créés par 0001)
drop trigger if exists trg_on_auth_user_created on auth.users;

-- Tables applicatives (ordre inverse des dépendances, CASCADE pour sécurité)
drop table if exists public.planning_snapshots cascade;
drop table if exists public.resource_permissions cascade;
drop table if exists public.activity_logs cascade;
drop table if exists public.notifications cascade;
drop table if exists public.punch_list_items cascade;
drop table if exists public.incidents cascade;
drop table if exists public.supplies cascade;
drop table if exists public.models3d cascade;
drop table if exists public.plan_annotations cascade;
drop table if exists public.plan_versions cascade;
drop table if exists public.plans cascade;
drop table if exists public.documents cascade;
drop table if exists public.comments cascade;
drop table if exists public.task_dependencies cascade;
drop table if exists public.tasks cascade;
drop table if exists public.phases cascade;
drop table if exists public.project_companies cascade;
drop table if exists public.project_members cascade;
drop table if exists public.projects cascade;
drop table if exists public.companies cascade;
drop table if exists public.clients cascade;
drop table if exists public.organization_members cascade;
drop table if exists public.organizations cascade;
drop table if exists public.profiles cascade;

-- Fonctions
drop function if exists public.handle_new_project() cascade;
drop function if exists public.check_no_circular_dependency() cascade;
drop function if exists public.check_task_parent_not_self() cascade;
drop function if exists public.handle_new_profile_organization() cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.has_resource_access(text, uuid, uuid, text) cascade;
drop function if exists public.is_project_owner(uuid) cascade;
drop function if exists public.is_project_member(uuid) cascade;
drop function if exists public.is_org_admin_or_owner(uuid) cascade;
drop function if exists public.is_org_member(uuid) cascade;

-- =========================================================================
-- PARTIE 1 — SCHÉMA (0001_schema.sql)
-- =========================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------------
-- Fonction générique updated_at
-- -------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
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
set search_path = public
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
set search_path = public
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

-- =========================================================================
-- PARTIE 2 — RLS POLICIES (0002_rls_policies.sql)
-- =========================================================================

create or replace function public.is_org_member(p_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin_or_owner(p_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.is_org_owner(p_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

-- NOTE : pas de repli "admin d'organisation" ici. Un projet n'est visible
-- que par les utilisateurs explicitement invités via project_members — voir
-- 0011_project_isolation_and_ownership_transfer.sql. Le seul mécanisme
-- permettant à un admin d'organisation d'agir sur un projet auquel il n'est
-- pas invité est transfer_project_ownership() (réaffectation du owner en
-- cas d'absence), qui ne donne accès à rien d'autre.
create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_project_owner(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = auth.uid() and role = 'owner'
  );
$$;

-- Vérifie l'accès à une ressource précise selon la priorité
-- ressource > projet (pas de repli organisation, voir note ci-dessus)
create or replace function public.has_resource_access(
  p_resource_type text,
  p_resource_id uuid,
  p_project_id uuid,
  p_min_permission text
)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_rank_min int;
  v_resource_permission text;
  v_project_role text;
begin
  v_rank_min := case p_min_permission
    when 'view' then 1
    when 'edit' then 2
    when 'manage' then 3
    else 1
  end;

  -- 1. Permission ressource (priorité la plus haute)
  select permission into v_resource_permission
  from public.resource_permissions
  where resource_type = p_resource_type
    and resource_id = p_resource_id
    and grantee_user_id = auth.uid();

  if v_resource_permission is not null then
    return (case v_resource_permission
      when 'view' then 1
      when 'edit' then 2
      when 'manage' then 3
      else 0
    end) >= v_rank_min;
  end if;

  -- 2. Permission projet
  select role into v_project_role
  from public.project_members
  where project_id = p_project_id and user_id = auth.uid();

  if v_project_role = 'owner' then
    return true;
  elsif v_project_role = 'collaborator' then
    return v_rank_min <= 2;
  end if;

  return false;
end;
$$;

-- =========================================================================
-- Activation RLS
-- =========================================================================
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.clients enable row level security;
alter table public.companies enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_companies enable row level security;
alter table public.phases enable row level security;
alter table public.tasks enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.comments enable row level security;
alter table public.documents enable row level security;
alter table public.plans enable row level security;
alter table public.plan_versions enable row level security;
alter table public.plan_annotations enable row level security;
alter table public.models3d enable row level security;
alter table public.supplies enable row level security;
alter table public.incidents enable row level security;
alter table public.punch_list_items enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.resource_permissions enable row level security;
alter table public.planning_snapshots enable row level security;

-- -------------------------------------------------------------------------
-- PROFILES
-- -------------------------------------------------------------------------
create policy "profiles_select_authenticated" on public.profiles
  for select using (auth.uid() is not null);

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

-- -------------------------------------------------------------------------
-- ORGANIZATIONS
-- -------------------------------------------------------------------------
create policy "organizations_select_member" on public.organizations
  for select using (public.is_org_member(id));

create policy "organizations_insert_self" on public.organizations
  for insert with check (owner_id = auth.uid());

create policy "organizations_update_owner" on public.organizations
  for update using (public.is_org_admin_or_owner(id));

-- -------------------------------------------------------------------------
-- ORGANIZATION MEMBERS
-- -------------------------------------------------------------------------
create policy "org_members_select_member" on public.organization_members
  for select using (public.is_org_member(organization_id));

create policy "org_members_manage_admin" on public.organization_members
  for all using (
    public.is_org_owner(organization_id)
    or (public.is_org_admin_or_owner(organization_id) and role <> 'owner')
  )
  with check (
    public.is_org_owner(organization_id)
    or (public.is_org_admin_or_owner(organization_id) and role <> 'owner')
  );

-- -------------------------------------------------------------------------
-- CLIENTS
-- -------------------------------------------------------------------------
create policy "clients_select_org_member" on public.clients
  for select using (public.is_org_member(organization_id));

create policy "clients_insert_org_member" on public.clients
  for insert with check (public.is_org_member(organization_id));

create policy "clients_update_org_member" on public.clients
  for update using (public.is_org_member(organization_id));

create policy "clients_delete_org_admin" on public.clients
  for delete using (public.is_org_admin_or_owner(organization_id));

-- -------------------------------------------------------------------------
-- COMPANIES
-- -------------------------------------------------------------------------
create policy "companies_select_org_member" on public.companies
  for select using (public.is_org_member(organization_id));

create policy "companies_insert_org_member" on public.companies
  for insert with check (public.is_org_member(organization_id));

create policy "companies_update_org_member" on public.companies
  for update using (public.is_org_member(organization_id));

create policy "companies_delete_org_admin" on public.companies
  for delete using (public.is_org_admin_or_owner(organization_id));

-- -------------------------------------------------------------------------
-- PROJECTS
-- -------------------------------------------------------------------------
create policy "projects_select_member" on public.projects
  for select using (public.is_project_member(id));

create policy "projects_insert_org_member" on public.projects
  for insert with check (public.is_org_member(organization_id) and owner_id = auth.uid());

create policy "projects_update_owner" on public.projects
  for update using (public.is_project_owner(id));

create policy "projects_delete_owner" on public.projects
  for delete using (public.is_project_owner(id));

-- -------------------------------------------------------------------------
-- PROJECT MEMBERS
-- -------------------------------------------------------------------------
create policy "project_members_select_member" on public.project_members
  for select using (public.is_project_member(project_id));

create policy "project_members_manage_owner" on public.project_members
  for insert with check (public.is_project_owner(project_id));

create policy "project_members_update_owner" on public.project_members
  for update using (public.is_project_owner(project_id));

create policy "project_members_delete_owner" on public.project_members
  for delete using (public.is_project_owner(project_id));

-- Permet à un admin/owner d'organisation de voir qui est membre/owner d'un
-- projet (nécessaire pour réaffecter un owner absent), SANS lui donner
-- accès au contenu du projet lui-même (tasks, documents, etc.) — voir
-- 0011_project_isolation_and_ownership_transfer.sql.
create policy "project_members_select_org_admin" on public.project_members
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = project_members.project_id
        and public.is_org_admin_or_owner(p.organization_id)
    )
  );

-- -------------------------------------------------------------------------
-- PROJECT COMPANIES
-- -------------------------------------------------------------------------
create policy "project_companies_select_member" on public.project_companies
  for select using (public.is_project_member(project_id));

create policy "project_companies_manage_member" on public.project_companies
  for all using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

-- -------------------------------------------------------------------------
-- PHASES
-- -------------------------------------------------------------------------
create policy "phases_select_member" on public.phases
  for select using (public.is_project_member(project_id));

create policy "phases_manage_member" on public.phases
  for all using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

-- -------------------------------------------------------------------------
-- TASKS
-- -------------------------------------------------------------------------
create policy "tasks_select_member" on public.tasks
  for select using (public.is_project_member(project_id));

create policy "tasks_insert_member" on public.tasks
  for insert with check (public.is_project_member(project_id));

create policy "tasks_update_with_permission" on public.tasks
  for update using (public.has_resource_access('task', id, project_id, 'edit'));

create policy "tasks_delete_with_permission" on public.tasks
  for delete using (public.has_resource_access('task', id, project_id, 'manage'));

-- -------------------------------------------------------------------------
-- TASK DEPENDENCIES
-- -------------------------------------------------------------------------
create policy "task_deps_select_member" on public.task_dependencies
  for select using (
    exists (select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id))
  );

create policy "task_deps_manage_member" on public.task_dependencies
  for all using (
    exists (select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id))
  )
  with check (
    exists (select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id))
  );

-- -------------------------------------------------------------------------
-- COMMENTS
-- -------------------------------------------------------------------------
create policy "comments_select_member" on public.comments
  for select using (public.is_project_member(project_id));

create policy "comments_insert_member" on public.comments
  for insert with check (public.is_project_member(project_id) and author_id = auth.uid());

create policy "comments_update_author" on public.comments
  for update using (author_id = auth.uid());

create policy "comments_delete_author_or_owner" on public.comments
  for delete using (author_id = auth.uid() or public.is_project_owner(project_id));

-- -------------------------------------------------------------------------
-- DOCUMENTS
-- -------------------------------------------------------------------------
create policy "documents_select_member" on public.documents
  for select using (public.is_project_member(project_id));

create policy "documents_insert_member" on public.documents
  for insert with check (public.is_project_member(project_id));

create policy "documents_update_with_permission" on public.documents
  for update using (public.has_resource_access('document', id, project_id, 'edit'));

create policy "documents_delete_with_permission" on public.documents
  for delete using (public.has_resource_access('document', id, project_id, 'manage'));

-- -------------------------------------------------------------------------
-- PLANS / PLAN VERSIONS / PLAN ANNOTATIONS
-- -------------------------------------------------------------------------
create policy "plans_select_member" on public.plans
  for select using (public.is_project_member(project_id));

create policy "plans_manage_with_permission" on public.plans
  for insert with check (public.is_project_member(project_id));

create policy "plans_update_with_permission" on public.plans
  for update using (public.has_resource_access('plan', id, project_id, 'edit'));

create policy "plans_delete_with_permission" on public.plans
  for delete using (public.has_resource_access('plan', id, project_id, 'manage'));

create policy "plan_versions_select_member" on public.plan_versions
  for select using (
    exists (select 1 from public.plans p where p.id = plan_id and public.is_project_member(p.project_id))
  );

create policy "plan_versions_manage_member" on public.plan_versions
  for insert with check (
    exists (select 1 from public.plans p where p.id = plan_id and public.is_project_member(p.project_id))
  );

create policy "plan_annotations_select_member" on public.plan_annotations
  for select using (
    exists (
      select 1 from public.plan_versions pv
      join public.plans p on p.id = pv.plan_id
      where pv.id = plan_version_id and public.is_project_member(p.project_id)
    )
  );

create policy "plan_annotations_insert_member" on public.plan_annotations
  for insert with check (
    exists (
      select 1 from public.plan_versions pv
      join public.plans p on p.id = pv.plan_id
      where pv.id = plan_version_id and public.is_project_member(p.project_id)
    )
  );

-- -------------------------------------------------------------------------
-- MODELS3D
-- -------------------------------------------------------------------------
create policy "models3d_select_member" on public.models3d
  for select using (public.is_project_member(project_id));

create policy "models3d_manage_member" on public.models3d
  for all using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

-- -------------------------------------------------------------------------
-- SUPPLIES
-- -------------------------------------------------------------------------
create policy "supplies_select_member" on public.supplies
  for select using (public.is_project_member(project_id));

create policy "supplies_manage_member" on public.supplies
  for all using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

-- -------------------------------------------------------------------------
-- INCIDENTS
-- -------------------------------------------------------------------------
create policy "incidents_select_member" on public.incidents
  for select using (public.is_project_member(project_id));

create policy "incidents_manage_member" on public.incidents
  for all using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

-- -------------------------------------------------------------------------
-- PUNCH LIST
-- -------------------------------------------------------------------------
create policy "punch_list_select_member" on public.punch_list_items
  for select using (public.is_project_member(project_id));

create policy "punch_list_manage_member" on public.punch_list_items
  for all using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

-- -------------------------------------------------------------------------
-- NOTIFICATIONS
-- -------------------------------------------------------------------------
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());

-- Restreint l'insertion à des cas réels d'usage : expéditeur et destinataire
-- partagent un projet/une organisation, ou le destinataire détient un accès
-- fin (resource_permissions) sur un projet où l'expéditeur est membre.
create or replace function public.can_notify_user(p_target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    p_target_user_id = auth.uid()
    or exists (
      select 1 from public.project_members pm1
      join public.project_members pm2 on pm2.project_id = pm1.project_id
      where pm1.user_id = auth.uid() and pm2.user_id = p_target_user_id
    )
    or exists (
      select 1 from public.organization_members om1
      join public.organization_members om2 on om2.organization_id = om1.organization_id
      where om1.user_id = auth.uid() and om2.user_id = p_target_user_id
    )
    or exists (
      select 1 from public.resource_permissions rp
      join public.project_members pm on pm.project_id = rp.project_id
      where rp.grantee_user_id = p_target_user_id and pm.user_id = auth.uid()
    );
$$;

create policy "notifications_insert_any_member" on public.notifications
  for insert with check (public.can_notify_user(user_id));

create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid());

create policy "notifications_delete_own" on public.notifications
  for delete using (user_id = auth.uid());

-- -------------------------------------------------------------------------
-- ACTIVITY LOGS
-- -------------------------------------------------------------------------
create policy "activity_logs_select_member" on public.activity_logs
  for select using (project_id is null or public.is_project_member(project_id));

create policy "activity_logs_insert_member" on public.activity_logs
  for insert with check (project_id is null or public.is_project_member(project_id));

-- -------------------------------------------------------------------------
-- RESOURCE PERMISSIONS
-- -------------------------------------------------------------------------
create policy "resource_permissions_select_member" on public.resource_permissions
  for select using (public.is_project_member(project_id));

create policy "resource_permissions_manage_owner" on public.resource_permissions
  for all using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

-- -------------------------------------------------------------------------
-- PLANNING SNAPSHOTS
-- -------------------------------------------------------------------------
create policy "planning_snapshots_select_member" on public.planning_snapshots
  for select using (public.is_project_member(project_id));

create policy "planning_snapshots_manage_member" on public.planning_snapshots
  for all using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

-- =========================================================================
-- PARTIE 3 — STORAGE BUCKETS (0003_storage_buckets.sql)
-- =========================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('documents', 'documents', false, 104857600),
  ('plans', 'plans', false, 209715200),
  ('models3d', 'models3d', false, 524288000),
  ('avatars', 'avatars', true, 5242880)
on conflict (id) do nothing;

-- -------------------------------------------------------------------------
-- DOCUMENTS bucket
-- -------------------------------------------------------------------------
create policy "documents_bucket_select_member" on storage.objects
  for select using (
    bucket_id = 'documents'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

create policy "documents_bucket_insert_member" on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

create policy "documents_bucket_delete_member" on storage.objects
  for delete using (
    bucket_id = 'documents'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

-- -------------------------------------------------------------------------
-- PLANS bucket
-- -------------------------------------------------------------------------
create policy "plans_bucket_select_member" on storage.objects
  for select using (
    bucket_id = 'plans'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

create policy "plans_bucket_insert_member" on storage.objects
  for insert with check (
    bucket_id = 'plans'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

create policy "plans_bucket_delete_member" on storage.objects
  for delete using (
    bucket_id = 'plans'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

-- -------------------------------------------------------------------------
-- MODELS3D bucket
-- -------------------------------------------------------------------------
create policy "models3d_bucket_select_member" on storage.objects
  for select using (
    bucket_id = 'models3d'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

create policy "models3d_bucket_insert_member" on storage.objects
  for insert with check (
    bucket_id = 'models3d'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

create policy "models3d_bucket_delete_member" on storage.objects
  for delete using (
    bucket_id = 'models3d'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

-- -------------------------------------------------------------------------
-- AVATARS bucket (public en lecture, écriture limitée au propriétaire)
-- -------------------------------------------------------------------------
-- Bucket marqué public (storage.buckets.public = true) : l'affichage réel des
-- photos via getPublicUrl() ne dépend pas de cette policy. On limite donc le
-- SELECT (listing via l'API Storage) à son propre dossier.
create policy "avatars_bucket_public_select" on storage.objects
  for select using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1]::uuid = auth.uid()
  );

create policy "avatars_bucket_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1])::uuid = auth.uid()
  );

create policy "avatars_bucket_update_own" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1])::uuid = auth.uid()
  );

create policy "avatars_bucket_delete_own" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1])::uuid = auth.uid()
  );

-- -------------------------------------------------------------------------
-- DURCISSEMENT : les fonctions trigger d'onboarding ne doivent être
-- invoquées que par leurs triggers, jamais appelées directement via RPC
-- PostgREST par un client (anon/authenticated).
-- -------------------------------------------------------------------------
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_project() from public, anon, authenticated;
revoke execute on function public.handle_new_profile_organization() from public, anon, authenticated;

-- =========================================================================
-- PARTIE 4 — Isolation multi-tenant & transfert de propriété
-- (0011_project_isolation_and_ownership_transfer.sql)
--
-- Réaffectation atomique et auditée du propriétaire d'un projet. Autorisée
-- pour : le owner actuel du projet, OU un admin/owner de l'organisation
-- (cas "chef de projet absent/malade"). Le nouveau propriétaire doit
-- appartenir à la même organisation que le projet. Ne donne aucun accès
-- supplémentaire à l'appelant : la fonction se contente de modifier
-- project_members/projects, rien d'autre.
-- =========================================================================

create or replace function public.transfer_project_ownership(
  p_project_id uuid,
  p_new_owner_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_current_owner_user_id uuid;
  v_is_authorized boolean;
begin
  select organization_id, owner_id into v_org_id, v_current_owner_user_id
  from public.projects
  where id = p_project_id;

  if v_org_id is null then
    raise exception 'Projet introuvable';
  end if;

  select
    exists (
      select 1 from public.project_members
      where project_id = p_project_id and user_id = auth.uid() and role = 'owner'
    )
    or public.is_org_admin_or_owner(v_org_id)
  into v_is_authorized;

  if not v_is_authorized then
    raise exception 'Action non autorisée';
  end if;

  if not exists (
    select 1 from public.organization_members
    where organization_id = v_org_id and user_id = p_new_owner_user_id
  ) then
    raise exception 'Le nouveau propriétaire doit appartenir à l''organisation du projet';
  end if;

  update public.project_members
  set role = 'collaborator'
  where project_id = p_project_id and role = 'owner' and user_id <> p_new_owner_user_id;

  insert into public.project_members (project_id, user_id, role, accepted_at)
  values (p_project_id, p_new_owner_user_id, 'owner', now())
  on conflict (project_id, user_id) do update set role = 'owner', accepted_at = coalesce(public.project_members.accepted_at, now());

  update public.projects set owner_id = p_new_owner_user_id, updated_at = now() where id = p_project_id;

  insert into public.activity_logs (project_id, user_id, action, entity_type, entity_id, metadata)
  values (
    p_project_id,
    auth.uid(),
    'project.ownership_transferred',
    'project',
    p_project_id,
    jsonb_build_object('new_owner_user_id', p_new_owner_user_id, 'previous_owner_user_id', v_current_owner_user_id)
  );

  insert into public.notifications (user_id, type, title, message, link)
  values (
    p_new_owner_user_id,
    'ownership_transfer',
    'Propriété de projet transférée',
    'Vous êtes désormais propriétaire de ce projet.',
    '/projects/' || p_project_id
  );
end;
$$;

revoke all on function public.transfer_project_ownership(uuid, uuid) from public;
grant execute on function public.transfer_project_ownership(uuid, uuid) to authenticated;

-- =========================================================================
-- FIN — reset complet terminé.
-- Si des comptes auth.users existants n'ont pas de profil (créés avant ce
-- reset), le trigger trg_on_auth_user_created ne se redéclenchera pas pour
-- eux. Il faudra alors soit les recréer, soit insérer manuellement leur
-- ligne dans public.profiles.
-- =========================================================================
