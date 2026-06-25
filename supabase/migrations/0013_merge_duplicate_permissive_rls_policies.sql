-- =========================================================================
-- Fusionne/éclate les policies RLS permissives redondantes signalées par
-- l'advisor multiple_permissive_policies. Pour chaque table concernée, une
-- policy "manage_*" en FOR ALL chevauchait une policy "select_*" dédiée :
-- Postgres devait évaluer les deux pour chaque SELECT. On éclate les
-- policies "manage_*" en INSERT/UPDATE/DELETE (sans SELECT), qui reste
-- couvert uniquement par la policy "select_*". Aucun changement de
-- comportement : mêmes conditions, juste réparties sur moins de policies
-- par action.
-- =========================================================================

-- incidents
drop policy if exists "incidents_manage_member" on public.incidents;
create policy "incidents_insert_member" on public.incidents for insert with check (is_project_member(project_id));
create policy "incidents_update_member" on public.incidents for update using (is_project_member(project_id)) with check (is_project_member(project_id));
create policy "incidents_delete_member" on public.incidents for delete using (is_project_member(project_id));

-- models3d
drop policy if exists "models3d_manage_member" on public.models3d;
create policy "models3d_insert_member" on public.models3d for insert with check (is_project_member(project_id));
create policy "models3d_update_member" on public.models3d for update using (is_project_member(project_id)) with check (is_project_member(project_id));
create policy "models3d_delete_member" on public.models3d for delete using (is_project_member(project_id));

-- phases
drop policy if exists "phases_manage_member" on public.phases;
create policy "phases_insert_member" on public.phases for insert with check (is_project_member(project_id));
create policy "phases_update_member" on public.phases for update using (is_project_member(project_id)) with check (is_project_member(project_id));
create policy "phases_delete_member" on public.phases for delete using (is_project_member(project_id));

-- planning_snapshots
drop policy if exists "planning_snapshots_manage_member" on public.planning_snapshots;
create policy "planning_snapshots_insert_member" on public.planning_snapshots for insert with check (is_project_member(project_id));
create policy "planning_snapshots_update_member" on public.planning_snapshots for update using (is_project_member(project_id)) with check (is_project_member(project_id));
create policy "planning_snapshots_delete_member" on public.planning_snapshots for delete using (is_project_member(project_id));

-- project_companies
drop policy if exists "project_companies_manage_member" on public.project_companies;
create policy "project_companies_insert_member" on public.project_companies for insert with check (is_project_member(project_id));
create policy "project_companies_update_member" on public.project_companies for update using (is_project_member(project_id)) with check (is_project_member(project_id));
create policy "project_companies_delete_member" on public.project_companies for delete using (is_project_member(project_id));

-- project_contacts
drop policy if exists "project_contacts_manage_member" on public.project_contacts;
create policy "project_contacts_insert_member" on public.project_contacts for insert with check (is_project_member(project_id));
create policy "project_contacts_update_member" on public.project_contacts for update using (is_project_member(project_id)) with check (is_project_member(project_id));
create policy "project_contacts_delete_member" on public.project_contacts for delete using (is_project_member(project_id));

-- punch_list_items
drop policy if exists "punch_list_manage_member" on public.punch_list_items;
create policy "punch_list_insert_member" on public.punch_list_items for insert with check (is_project_member(project_id));
create policy "punch_list_update_member" on public.punch_list_items for update using (is_project_member(project_id)) with check (is_project_member(project_id));
create policy "punch_list_delete_member" on public.punch_list_items for delete using (is_project_member(project_id));

-- supplies
drop policy if exists "supplies_manage_member" on public.supplies;
create policy "supplies_insert_member" on public.supplies for insert with check (is_project_member(project_id));
create policy "supplies_update_member" on public.supplies for update using (is_project_member(project_id)) with check (is_project_member(project_id));
create policy "supplies_delete_member" on public.supplies for delete using (is_project_member(project_id));

-- task_dependencies
drop policy if exists "task_deps_manage_member" on public.task_dependencies;
create policy "task_deps_insert_member" on public.task_dependencies for insert with check (
  exists (select 1 from public.tasks t where t.id = task_dependencies.task_id and is_project_member(t.project_id))
);
create policy "task_deps_update_member" on public.task_dependencies for update using (
  exists (select 1 from public.tasks t where t.id = task_dependencies.task_id and is_project_member(t.project_id))
) with check (
  exists (select 1 from public.tasks t where t.id = task_dependencies.task_id and is_project_member(t.project_id))
);
create policy "task_deps_delete_member" on public.task_dependencies for delete using (
  exists (select 1 from public.tasks t where t.id = task_dependencies.task_id and is_project_member(t.project_id))
);

-- resource_permissions (manage_owner avait une condition différente du select)
drop policy if exists "resource_permissions_manage_owner" on public.resource_permissions;
create policy "resource_permissions_insert_owner" on public.resource_permissions for insert with check (is_project_owner(project_id));
create policy "resource_permissions_update_owner" on public.resource_permissions for update using (is_project_owner(project_id)) with check (is_project_owner(project_id));
create policy "resource_permissions_delete_owner" on public.resource_permissions for delete using (is_project_owner(project_id));

-- organization_members (manage_admin avait une condition différente du select)
drop policy if exists "org_members_manage_admin" on public.organization_members;
create policy "org_members_insert_admin" on public.organization_members for insert with check (
  is_org_owner(organization_id) or (is_org_admin_or_owner(organization_id) and role <> 'owner')
);
create policy "org_members_update_admin" on public.organization_members for update using (
  is_org_owner(organization_id) or (is_org_admin_or_owner(organization_id) and role <> 'owner')
) with check (
  is_org_owner(organization_id) or (is_org_admin_or_owner(organization_id) and role <> 'owner')
);
create policy "org_members_delete_admin" on public.organization_members for delete using (
  is_org_owner(organization_id) or (is_org_admin_or_owner(organization_id) and role <> 'owner')
);

-- project_members : fusionne les deux policies SELECT (membre du projet OU
-- admin/owner de l'organisation) en une seule, pour éviter la double
-- évaluation par Postgres sur chaque lecture.
drop policy if exists "project_members_select_member" on public.project_members;
drop policy if exists "project_members_select_org_admin" on public.project_members;
create policy "project_members_select_member_or_org_admin" on public.project_members
  for select using (
    is_project_member(project_id)
    or exists (
      select 1 from public.projects p
      where p.id = project_members.project_id and is_org_admin_or_owner(p.organization_id)
    )
  );
