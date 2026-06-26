-- =========================================================================
-- BuildFlow — 0028_revoke_anon_execute_security_definer.sql
--
-- Réduit la surface d'attaque relevée lors de l'audit complet du 26/06/2026
-- (section 7 "Sécurité") : 20 fonctions `security definer` (helpers de
-- permission + RPC métier) étaient exécutables par le rôle `anon` (non
-- authentifié). Aucune ne fuite de donnée sensible (les helpers ne
-- renvoient qu'un booléen), mais elles permettaient à un acteur non
-- authentifié de sonder l'existence d'UUID de projet/organisation/
-- conversation (oracle booléen), et certaines RPC métier (decide_quote,
-- transfer_project_ownership...) n'ont aucune raison d'être appelables
-- sans session authentifiée — tout le parcours applicatif (y compris le
-- portail client) est protégé par <AppShell> et exige une authentification
-- Supabase. On retire `anon`, on conserve `authenticated`.
-- =========================================================================

revoke execute on function public.can_notify_user(uuid) from anon;
revoke execute on function public.decide_change_order(uuid, boolean, text, text) from anon;
revoke execute on function public.decide_quote(uuid, boolean, text, text) from anon;
revoke execute on function public.decide_selection(uuid, integer, text, text) from anon;
revoke execute on function public.ensure_project_group_conversation(uuid) from anon;
revoke execute on function public.get_or_create_direct_conversation(uuid, uuid) from anon;
revoke execute on function public.has_resource_access(text, uuid, uuid, text) from anon;
revoke execute on function public.is_conversation_participant(uuid) from anon;
revoke execute on function public.is_org_admin_or_owner(uuid) from anon;
revoke execute on function public.is_org_member(uuid) from anon;
revoke execute on function public.is_org_owner(uuid) from anon;
revoke execute on function public.is_project_member(uuid) from anon;
revoke execute on function public.is_project_owner(uuid) from anon;
revoke execute on function public.is_project_team_member(uuid) from anon;
revoke execute on function public.mark_conversation_read(uuid) from anon;
revoke execute on function public.recompute_invoice_payment_status() from anon;
revoke execute on function public.set_invoice_defaults() from anon;
revoke execute on function public.set_quote_organization() from anon;
revoke execute on function public.touch_conversation_last_message() from anon;
revoke execute on function public.transfer_project_ownership(uuid, uuid) from anon;
