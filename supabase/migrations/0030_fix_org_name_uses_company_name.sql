-- =========================================================================
-- BuildFlow — 0030_fix_org_name_uses_company_name.sql
--
-- Bug : à l'inscription, l'organisation personnelle créée automatiquement
-- (trg_on_profile_created -> handle_new_profile_organization) était nommée
-- avec le nom complet de l'utilisateur (full_name), jamais avec le nom de
-- son entreprise (company_name), pourtant déjà collecté par le formulaire
-- d'inscription et stocké sur profiles (cf. 0004_profile_project_extensions
-- et auth.service.ts). Priorité corrigée : company_name > full_name > email.
-- =========================================================================

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
  values (
    coalesce(new.company_name, new.full_name, new.email, 'Mon entreprise'),
    v_slug,
    new.id
  )
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, new.id, 'owner');

  return new;
end;
$$;

-- Backfill : renomme les organisations personnelles existantes dont le nom
-- correspond encore au full_name du propriétaire, alors qu'un company_name
-- est disponible (cas où l'utilisateur a renseigné son entreprise après
-- coup, ou dont l'organisation a été créée avant ce correctif).
update public.organizations o
set name = p.company_name
from public.profiles p
where p.id = o.owner_id
  and p.company_name is not null
  and p.company_name <> ''
  and o.name = coalesce(p.full_name, p.email, 'Mon entreprise');
