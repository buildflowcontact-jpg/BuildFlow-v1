-- =========================================================================
-- BuildFlow — backfill_profiles.sql
-- À exécuter après un reset_full.sql si des comptes auth.users existaient
-- déjà avant le reset (le trigger handle_new_user ne se déclenche que sur
-- INSERT dans auth.users, donc ces comptes n'ont pas de profil).
--
-- Ce script crée, pour chaque utilisateur auth.users sans profil :
--   - sa ligne dans public.profiles
--   - son organisation personnelle
--   - sa ligne dans organization_members (owner)
-- =========================================================================

do $$
declare
  v_user record;
  v_org_id uuid;
  v_slug text;
begin
  for v_user in
    select u.id, u.email, u.raw_user_meta_data
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p.id is null
  loop
    insert into public.profiles (id, email, full_name)
    values (v_user.id, v_user.email, v_user.raw_user_meta_data->>'full_name')
    on conflict (id) do nothing;

    v_slug := 'org-' || replace(v_user.id::text, '-', '');

    insert into public.organizations (name, slug, owner_id)
    values (
      coalesce(v_user.raw_user_meta_data->>'full_name', v_user.email, 'Mon entreprise'),
      v_slug,
      v_user.id
    )
    on conflict (slug) do nothing
    returning id into v_org_id;

    if v_org_id is not null then
      insert into public.organization_members (organization_id, user_id, role)
      values (v_org_id, v_user.id, 'owner')
      on conflict (organization_id, user_id) do nothing;
    end if;
  end loop;
end;
$$;
