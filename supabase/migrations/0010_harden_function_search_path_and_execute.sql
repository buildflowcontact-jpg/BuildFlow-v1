-- =========================================================================
-- BuildFlow — 0010_harden_function_search_path_and_execute.sql
-- Correctifs cosmétiques signalés par Supabase Advisors :
-- 1) search_path manquant sur 3 fonctions trigger : sans `set search_path`,
--    une fonction résout les objets non qualifiés via le search_path de
--    l'appelant, ce qui peut être détourné si un rôle malveillant crée un
--    schéma/objet de même nom plus tôt dans le chemin. On fixe
--    explicitement le search_path à public.
-- 2) Les fonctions trigger d'onboarding (handle_new_user,
--    handle_new_project, handle_new_profile_organization) ne doivent être
--    invoquées que par leurs triggers respectifs, jamais appelées
--    directement via RPC PostgREST par un client. On retire le droit
--    EXECUTE accordé par défaut à PUBLIC/anon/authenticated.
-- =========================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.check_task_parent_not_self()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.parent_task_id is not null and new.parent_task_id = new.id then
    raise exception 'Une tâche ne peut pas être son propre parent';
  end if;
  return new;
end;
$$;

create or replace function public.check_no_circular_dependency()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_has_cycle boolean;
begin
  with recursive chain as (
    select new.depends_on_task_id as task_id
    union all
    select td.depends_on_task_id
    from public.task_dependencies td
    join chain c on td.task_id = c.task_id
  )
  select exists(select 1 from chain where task_id = new.task_id) into v_has_cycle;

  if v_has_cycle then
    raise exception 'Dépendance circulaire détectée entre les tâches';
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_project() from public, anon, authenticated;
revoke execute on function public.handle_new_profile_organization() from public, anon, authenticated;
