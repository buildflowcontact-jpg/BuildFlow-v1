-- =========================================================================
-- BuildFlow — 0011_project_isolation_and_ownership_transfer.sql
--
-- Contexte : l'application est destinée à être commercialisée à plusieurs
-- entreprises (multi-tenant). L'isolation entre organisations était déjà
-- correcte (audit pg_policies). En revanche, AU SEIN d'une même
-- organisation, un admin/owner d'organisation avait un accès total à TOUS
-- les projets via un "passe-droit" dans is_project_member / is_project_owner
-- / has_resource_access, même s'il n'était pas invité (project_members).
-- Cela contredit la règle voulue : un collègue ne doit voir/accéder à un
-- projet que s'il y a été explicitement invité par son propriétaire.
--
-- Ce fichier :
--   1. Retire le passe-droit admin-org des 3 fonctions de droits projet.
--   2. Ajoute une policy de lecture restreinte sur project_members pour les
--      admins/owners d'organisation : ils peuvent voir QUI est membre/owner
--      d'un projet (nécessaire pour réaffecter un propriétaire en cas
--      d'absence), mais cette policy ne donne accès à AUCUNE autre table
--      (tasks, documents, plans, etc.) — c'est la base d'une future petite
--      application séparée de gestion des droits, sans visibilité sur le
--      contenu métier des projets.
--   3. Crée transfer_project_ownership(), une fonction SECURITY DEFINER
--      dédiée et auditée pour réaffecter le owner d'un projet de façon
--      atomique (project_members + projects.owner_id), autorisée pour le
--      owner actuel OU un admin/owner d'organisation — c'est le seul moyen
--      restant pour un admin d'agir sur un projet auquel il n'est pas
--      invité, et il ne donne accès à rien d'autre.
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1. Retrait du passe-droit admin-org
-- ---------------------------------------------------------------------

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

  -- 2. Permission projet (uniquement si invité via project_members — plus
  -- de repli "admin d'organisation" ici : voir le commentaire en tête de
  -- fichier).
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

-- ---------------------------------------------------------------------
-- 2. Visibilité restreinte pour les admins/owners d'organisation : ils
-- peuvent lister les membres d'un projet (savoir qui en est propriétaire)
-- pour préparer une réaffectation, mais cette policy ne s'applique qu'à
-- project_members et ne leur donne aucun accès au contenu du projet.
-- ---------------------------------------------------------------------

drop policy if exists "project_members_select_org_admin" on public.project_members;

create policy "project_members_select_org_admin" on public.project_members
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = project_members.project_id
        and public.is_org_admin_or_owner(p.organization_id)
    )
  );

-- ---------------------------------------------------------------------
-- 3. Réaffectation atomique et auditée du propriétaire d'un projet.
-- Autorisée pour : le owner actuel du projet, OU un admin/owner de
-- l'organisation (cas "chef de projet absent/malade"). Le nouveau
-- propriétaire doit appartenir à la même organisation que le projet.
-- Ne donne aucun accès supplémentaire à l'appelant : la fonction se
-- contente de modifier project_members/projects, rien d'autre.
-- ---------------------------------------------------------------------

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

  -- Autorisation : owner actuel du projet (via project_members) OU
  -- admin/owner de l'organisation.
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

  -- Le nouveau propriétaire doit appartenir à l'organisation du projet.
  if not exists (
    select 1 from public.organization_members
    where organization_id = v_org_id and user_id = p_new_owner_user_id
  ) then
    raise exception 'Le nouveau propriétaire doit appartenir à l''organisation du projet';
  end if;

  -- Rétrograde l'ancien owner (s'il existe une ligne project_members pour lui).
  update public.project_members
  set role = 'collaborator'
  where project_id = p_project_id and role = 'owner' and user_id <> p_new_owner_user_id;

  -- Affecte ou met à jour la ligne du nouveau propriétaire.
  insert into public.project_members (project_id, user_id, role, accepted_at)
  values (p_project_id, p_new_owner_user_id, 'owner', now())
  on conflict (project_id, user_id) do update set role = 'owner', accepted_at = coalesce(public.project_members.accepted_at, now());

  -- Synchronise projects.owner_id (corrige le bug où owner_id ne suivait
  -- jamais le transfert).
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
