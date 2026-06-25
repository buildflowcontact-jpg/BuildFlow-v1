-- =========================================================================
-- Optimisation RLS : remplace les appels directs à auth.uid() par
-- (select auth.uid()) dans les policies, pour que Postgres puisse mettre en
-- cache le résultat par requête (InitPlan) plutôt que de le réévaluer pour
-- chaque ligne. Aucun changement de comportement, seulement de performance.
-- Cible les 11 policies signalées par l'advisor auth_rls_initplan.
-- =========================================================================

-- comments
drop policy if exists "comments_delete_author_or_owner" on public.comments;
create policy "comments_delete_author_or_owner" on public.comments
  for delete using ((author_id = (select auth.uid())) or is_project_owner(project_id));

drop policy if exists "comments_insert_member" on public.comments;
create policy "comments_insert_member" on public.comments
  for insert with check (is_project_member(project_id) and (author_id = (select auth.uid())));

drop policy if exists "comments_update_author" on public.comments;
create policy "comments_update_author" on public.comments
  for update using (author_id = (select auth.uid()));

-- notifications
drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
  for delete using (user_id = (select auth.uid()));

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select using (user_id = (select auth.uid()));

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (user_id = (select auth.uid()));

-- organizations
drop policy if exists "organizations_insert_self" on public.organizations;
create policy "organizations_insert_self" on public.organizations
  for insert with check (owner_id = (select auth.uid()));

-- profiles
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select using ((select auth.uid()) is not null);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = (select auth.uid()));

-- projects
drop policy if exists "projects_insert_org_member" on public.projects;
create policy "projects_insert_org_member" on public.projects
  for insert with check (is_org_member(organization_id) and (owner_id = (select auth.uid())));

drop policy if exists "projects_select_member" on public.projects;
create policy "projects_select_member" on public.projects
  for select using ((owner_id = (select auth.uid())) or is_project_member(id));
