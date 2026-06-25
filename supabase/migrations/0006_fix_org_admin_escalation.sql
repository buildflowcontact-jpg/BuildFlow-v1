-- =========================================================================
-- BuildFlow — 0006_fix_org_admin_escalation.sql
-- Corrige une faille de sécurité : la policy "org_members_manage_admin"
-- permettait à n'importe quel admin de promouvoir n'importe qui (y compris
-- lui-même) au rôle 'owner', ou de rétrograder/retirer le propriétaire
-- réel — une prise de contrôle complète de l'organisation possible depuis
-- l'écran Paramètres lui-même, sans contournement technique.
--
-- Nouvelle règle : seul le propriétaire actuel peut créer/modifier/supprimer
-- une ligne dont le rôle est (ou doit devenir) 'owner'. Les admins peuvent
-- continuer à gérer les membres 'admin' et 'member', mais jamais 'owner'.
-- =========================================================================

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

drop policy if exists "org_members_manage_admin" on public.organization_members;

create policy "org_members_manage_admin" on public.organization_members
  for all using (
    public.is_org_owner(organization_id)
    or (public.is_org_admin_or_owner(organization_id) and role <> 'owner')
  )
  with check (
    public.is_org_owner(organization_id)
    or (public.is_org_admin_or_owner(organization_id) and role <> 'owner')
  );
