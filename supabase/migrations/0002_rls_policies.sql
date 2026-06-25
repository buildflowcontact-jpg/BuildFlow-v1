-- =========================================================================
-- BuildFlow — 0002_rls_policies.sql
-- Fonctions utilitaires de permissions + Row Level Security sur toutes les tables.
-- Priorité : permission ressource > permission projet > permission globale (organisation).
-- =========================================================================

-- -------------------------------------------------------------------------
-- Fonctions utilitaires (security definer pour éviter la récursion RLS)
-- -------------------------------------------------------------------------
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
  )
  or exists (
    select 1 from public.projects p
    where p.id = p_project_id and public.is_org_admin_or_owner(p.organization_id)
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
  )
  or exists (
    select 1 from public.projects p
    where p.id = p_project_id and public.is_org_admin_or_owner(p.organization_id)
  );
$$;

-- Vérifie l'accès à une ressource précise selon la priorité
-- ressource > projet > organisation (global)
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
  v_org_id uuid;
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

  -- 3. Permission globale (organisation)
  select organization_id into v_org_id from public.projects where id = p_project_id;
  if v_org_id is not null and public.is_org_admin_or_owner(v_org_id) then
    return true;
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
  for all using (public.is_org_admin_or_owner(organization_id))
  with check (public.is_org_admin_or_owner(organization_id));

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
  for select using (owner_id = auth.uid() or public.is_project_member(id));

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

create policy "notifications_insert_any_member" on public.notifications
  for insert with check (true);

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
