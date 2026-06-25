-- =========================================================================
-- BuildFlow — fix_organization_membership.sql
-- Diagnostic + réparation : garantit que chaque compte auth.users a bien
-- un profil ET une ligne organization_members valide. Corrige le bug du
-- précédent backfill_profiles.sql (variable v_org_id non réinitialisée en
-- cas de conflit de slug).
-- =========================================================================

-- 1) DIAGNOSTIC : décommente et exécute ce select seul pour inspecter l'état actuel
-- select
--   u.id as user_id,
--   u.email,
--   p.id as profile_id,
--   om.organization_id,
--   om.role,
--   o.id as org_id,
--   o.slug
-- from auth.users u
-- left join public.profiles p on p.id = u.id
-- left join public.organization_members om on om.user_id = u.id
-- left join public.organizations o on o.id = om.organization_id;

-- 2) RÉPARATION
do $$
declare
  v_user record;
  v_org_id uuid;
  v_slug text;
begin
  for v_user in select id, email, raw_user_meta_data from auth.users
  loop
    -- a) profil manquant -> on le crée
    insert into public.profiles (id, email, full_name)
    values (v_user.id, v_user.email, v_user.raw_user_meta_data->>'full_name')
    on conflict (id) do nothing;

    -- b) déjà membre d'au moins une organisation -> rien à faire
    if exists (select 1 from public.organization_members where user_id = v_user.id) then
      continue;
    end if;

    -- c) pas d'organisation -> on en crée une (ou on récupère l'existante par slug)
    v_slug := 'org-' || replace(v_user.id::text, '-', '');
    v_org_id := null;

    insert into public.organizations (name, slug, owner_id)
    values (
      coalesce(v_user.raw_user_meta_data->>'full_name', v_user.email, 'Mon entreprise'),
      v_slug,
      v_user.id
    )
    on conflict (slug) do update set name = excluded.name
    returning id into v_org_id;

    insert into public.organization_members (organization_id, user_id, role)
    values (v_org_id, v_user.id, 'owner')
    on conflict (organization_id, user_id) do nothing;
  end loop;
end;
$$;

-- 3) VÉRIFICATION finale : chaque user doit avoir exactement >=1 ligne
select u.email, count(om.id) as nb_memberships
from auth.users u
left join public.organization_members om on om.user_id = u.id
group by u.email;
