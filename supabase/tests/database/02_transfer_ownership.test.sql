-- =========================================================================
-- BuildFlow — Tests pgTAP : transfer_project_ownership().
--
-- Couvre 0011_project_isolation_and_ownership_transfer.sql : réaffectation
-- atomique et auditée du propriétaire d'un projet, autorisée seulement
-- pour le owner actuel ou un admin/owner d'organisation, avec contrainte
-- que le nouveau propriétaire appartienne à l'organisation du projet.
-- Exécution locale : `supabase test db` (nécessite Docker).
-- =========================================================================

begin;
create extension if not exists pgtap;

select plan(11);

-- ---------------------------------------------------------------------
-- Fixtures : owner + 2 collègues de la même organisation (l'un invité
-- sur le projet en simple collaborateur, l'autre admin d'organisation
-- mais non invité) + 1 utilisateur d'une organisation tierce.
-- ---------------------------------------------------------------------
select tests.create_user('owner.transfer@buildflow.test') as owner_id \gset
select tests.create_user('collab.transfer@buildflow.test') as collab_id \gset
select tests.create_user('admin.transfer@buildflow.test') as admin_id \gset
select tests.create_user('outsider.transfer@buildflow.test') as outsider_id \gset

select id as org_id from public.organizations where owner_id = :'owner_id' \gset

insert into public.organization_members (organization_id, user_id, role)
values
  (:'org_id', :'collab_id', 'member'),
  (:'org_id', :'admin_id', 'admin');

select tests.authenticate_as(:'owner_id');

insert into public.projects (id, organization_id, name, owner_id)
values ('22222222-2222-2222-2222-222222222222', :'org_id', 'Projet à transférer', :'owner_id');

insert into public.project_members (project_id, user_id, role)
values ('22222222-2222-2222-2222-222222222222', :'collab_id', 'collaborator');

-- ---------------------------------------------------------------------
-- 1. Un simple collaborateur (ni owner, ni admin d'organisation) ne peut
-- pas transférer la propriété.
-- ---------------------------------------------------------------------
select tests.authenticate_as(:'collab_id');

select throws_like(
  format('select public.transfer_project_ownership(%L::uuid, %L::uuid)', '22222222-2222-2222-2222-222222222222', :'collab_id'),
  '%non autorisée%',
  'un simple collaborateur ne peut pas transférer la propriété du projet'
);

-- ---------------------------------------------------------------------
-- 2. Le nouveau propriétaire doit appartenir à l'organisation du projet.
-- ---------------------------------------------------------------------
select tests.authenticate_as(:'owner_id');

select throws_like(
  format('select public.transfer_project_ownership(%L::uuid, %L::uuid)', '22222222-2222-2222-2222-222222222222', :'outsider_id'),
  '%appartenir à l''organisation%',
  'impossible de transférer à un utilisateur hors organisation'
);

-- ---------------------------------------------------------------------
-- 3. Le owner actuel transfère avec succès à son collègue collaborateur.
-- ---------------------------------------------------------------------
select lives_ok(
  format('select public.transfer_project_ownership(%L::uuid, %L::uuid)', '22222222-2222-2222-2222-222222222222', :'collab_id'),
  'le owner actuel peut transférer la propriété à un membre de l''organisation'
);

select is(
  (select owner_id from public.projects where id = '22222222-2222-2222-2222-222222222222'),
  :'collab_id'::uuid,
  'projects.owner_id est synchronisé après le transfert'
);

select is(
  (select role from public.project_members where project_id = '22222222-2222-2222-2222-222222222222' and user_id = :'collab_id'),
  'owner',
  'le nouveau propriétaire a le rôle owner dans project_members'
);

select is(
  (select role from public.project_members where project_id = '22222222-2222-2222-2222-222222222222' and user_id = :'owner_id'),
  'collaborator',
  'l''ancien propriétaire est rétrogradé en collaborateur (pas retiré du projet)'
);

select is(
  (select count(*) from public.activity_logs where project_id = '22222222-2222-2222-2222-222222222222' and action = 'project.ownership_transferred'),
  1::bigint,
  'le transfert est journalisé dans activity_logs'
);

select is(
  (select count(*) from public.notifications where user_id = :'collab_id' and type = 'ownership_transfer'),
  1::bigint,
  'le nouveau propriétaire reçoit une notification'
);

-- ---------------------------------------------------------------------
-- 4. Cas "chef de projet absent" : un admin d'organisation NON invité
-- sur le projet peut malgré tout réaffecter la propriété (seul accès
-- qui lui reste sur ce projet — il ne peut rien voir d'autre, cf.
-- 01_project_isolation.test.sql).
-- ---------------------------------------------------------------------
select tests.authenticate_as(:'admin_id');

select lives_ok(
  format('select public.transfer_project_ownership(%L::uuid, %L::uuid)', '22222222-2222-2222-2222-222222222222', :'owner_id'),
  'un admin d''organisation non invité peut réaffecter la propriété (cas PM absent)'
);

select is(
  (select owner_id from public.projects where id = '22222222-2222-2222-2222-222222222222'),
  :'owner_id'::uuid,
  'projects.owner_id reflète la réaffectation faite par l''admin'
);

-- ---------------------------------------------------------------------
-- 5. Projet inexistant -> exception explicite, pas un échec silencieux.
-- ---------------------------------------------------------------------
select throws_like(
  format('select public.transfer_project_ownership(%L::uuid, %L::uuid)', '99999999-9999-9999-9999-999999999999', :'owner_id'),
  '%introuvable%',
  'transférer un projet inexistant lève une exception explicite'
);

select * from finish();
rollback;
