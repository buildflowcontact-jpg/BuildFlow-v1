-- =========================================================================
-- BuildFlow — 0029_revoke_public_execute_remaining_functions.sql
--
-- Complète 0028 : les 13 fonctions restantes étaient accessibles par `anon`
-- non via un grant explicite sur `anon`, mais via le grant implicite
-- `PUBLIC` posé par défaut par Postgres à la création de toute fonction.
-- `revoke ... from anon` seul est sans effet quand `PUBLIC` détient le
-- privilège (PUBLIC s'applique à tous les rôles, y compris anon). Il faut
-- donc révoquer sur PUBLIC puis regranter explicitement à `authenticated`.
-- =========================================================================

revoke execute on function public.can_notify_user(uuid) from public;
revoke execute on function public.has_resource_access(text, uuid, uuid, text) from public;
revoke execute on function public.is_conversation_participant(uuid) from public;
revoke execute on function public.is_org_admin_or_owner(uuid) from public;
revoke execute on function public.is_org_member(uuid) from public;
revoke execute on function public.is_org_owner(uuid) from public;
revoke execute on function public.is_project_member(uuid) from public;
revoke execute on function public.is_project_owner(uuid) from public;
revoke execute on function public.is_project_team_member(uuid) from public;
revoke execute on function public.recompute_invoice_payment_status() from public;
revoke execute on function public.set_invoice_defaults() from public;
revoke execute on function public.set_quote_organization() from public;
revoke execute on function public.touch_conversation_last_message() from public;

grant execute on function public.can_notify_user(uuid) to authenticated;
grant execute on function public.has_resource_access(text, uuid, uuid, text) to authenticated;
grant execute on function public.is_conversation_participant(uuid) to authenticated;
grant execute on function public.is_org_admin_or_owner(uuid) to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_owner(uuid) to authenticated;
grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.is_project_owner(uuid) to authenticated;
grant execute on function public.is_project_team_member(uuid) to authenticated;
grant execute on function public.recompute_invoice_payment_status() to authenticated;
grant execute on function public.set_invoice_defaults() to authenticated;
grant execute on function public.set_quote_organization() to authenticated;
grant execute on function public.touch_conversation_last_message() to authenticated;
