-- =========================================================================
-- BuildFlow — 0017_advanced_modules_merge_policies.sql
-- Corrige l'avertissement multiple_permissive_policies (perf) introduit par
-- 0015 : sur daily_logs, rfis et resource_attachments, une policy SELECT
-- dédiée faisait doublon avec la policy ALL (manage_team), forçant Postgres
-- à évaluer deux policies pour chaque lecture.
-- =========================================================================

-- daily_logs : daily_logs_select_team est un doublon exact de la portée
-- SELECT déjà couverte par daily_logs_manage_team (même prédicat). On la
-- supprime.
drop policy if exists "daily_logs_select_team" on public.daily_logs;

-- rfis : même cas, rfis_select_team fait doublon avec rfis_manage_team.
drop policy if exists "rfis_select_team" on public.rfis;

-- resource_attachments : ici les deux policies ont des portées différentes
-- (select_member est plus large, ouverte à tout membre du projet, y compris
-- le rôle client, alors que manage_team restreint l'écriture aux membres de
-- l'équipe interne). On ne peut donc pas supprimer select_member. On retire
-- plutôt le SELECT de la policy de gestion en la limitant aux actions
-- d'écriture, pour qu'une seule policy permissive s'applique au SELECT.
drop policy if exists "resource_attachments_manage_team" on public.resource_attachments;

create policy "resource_attachments_insert_team" on public.resource_attachments
  for insert with check (is_project_team_member(project_id));

create policy "resource_attachments_update_team" on public.resource_attachments
  for update using (is_project_team_member(project_id))
  with check (is_project_team_member(project_id));

create policy "resource_attachments_delete_team" on public.resource_attachments
  for delete using (is_project_team_member(project_id));
