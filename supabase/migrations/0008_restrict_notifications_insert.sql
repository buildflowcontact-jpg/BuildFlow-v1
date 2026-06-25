-- =========================================================================
-- BuildFlow — 0008_restrict_notifications_insert.sql
-- La policy notifications_insert_any_member avait with check (true) :
-- n'importe quel utilisateur authentifié pouvait insérer une notification
-- arbitraire pour n'importe quel autre user_id (titre/message/lien
-- usurpables — risque de phishing interne ou de spam). On restreint
-- l'insertion aux cas réels d'usage de l'application : l'expéditeur
-- (auth.uid()) et le destinataire partagent un projet ou une organisation,
-- ou le destinataire détient un accès fin (resource_permissions) sur un
-- projet où l'expéditeur est membre/propriétaire.
-- =========================================================================

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

drop policy if exists "notifications_insert_any_member" on public.notifications;

create policy "notifications_insert_any_member" on public.notifications
  for insert with check (public.can_notify_user(user_id));
