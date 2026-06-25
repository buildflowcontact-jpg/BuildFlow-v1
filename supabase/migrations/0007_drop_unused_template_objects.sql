-- =========================================================================
-- BuildFlow — 0007_drop_unused_template_objects.sql
-- Nettoyage : tables et fonctions résiduelles d'un schéma générique
-- antérieur, jamais référencées par le code applicatif ni par les
-- migrations BuildFlow (0001-0006) ni par supabase/reset_full.sql. 0 ligne
-- en base, RLS activé sans policy (déjà inaccessibles). is_team_member()
-- référence une table team_members inexistante et get_my_org() référence
-- profiles.organization_id qui n'existe pas dans le schéma BuildFlow
-- (modèle organization_members many-to-many) — ces fonctions étaient déjà
-- inopérantes. audit_lock() ne sert que le trigger audit_no_update sur la
-- table audit_logs, supprimée avec elle.
-- =========================================================================

drop table if exists public.teams cascade;
drop table if exists public.folders cascade;
drop table if exists public.budget_lines cascade;
drop table if exists public.events cascade;
drop table if exists public.audit_logs cascade;
drop table if exists public.versions cascade;
drop table if exists public.permissions cascade;

drop function if exists public.is_team_member(uuid);
drop function if exists public.get_my_org();
drop function if exists public.audit_lock();
