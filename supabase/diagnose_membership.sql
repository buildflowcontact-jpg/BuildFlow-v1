select
  u.id as user_id,
  u.email,
  p.id as profile_id,
  om.organization_id,
  om.role,
  o.id as org_id,
  o.slug,
  o.owner_id
from auth.users u
left join public.profiles p on p.id = u.id
left join public.organization_members om on om.user_id = u.id
left join public.organizations o on o.id = om.organization_id;
