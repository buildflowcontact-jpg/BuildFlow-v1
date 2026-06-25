-- =========================================================================
-- BuildFlow — Tests pgTAP : isolation des projets (RLS).
--
-- Couvre la régression corrigée en 0011_project_isolation_and_ownership_transfer.sql :
-- un admin/owner d'organisation ne doit PAS avoir accès au contenu d'un
-- projet auquel il n'a pas été explicitement invité (project_members).
-- Exécution locale : `supabase test db` (nécessite Docker).
-- =========================================================================

begin;
create extension if not exists pgtap;

select plan(9);

-- ---------------------------------------------------------------------
-- Fixtures : deux utilisateurs dans la MÊME organisation. user_a crée le
-- projet (devient owner via le trigger handle_new_project) et n'invite
-- jamais user_b. user_b est admin de l'organisation (cas réel : deux
-- collègues d'une même entreprise, l'un gérant un projet confidentiel).
-- ---------------------------------------------------------------------
select tests.create_user('owner.iso@buildflow.test') as user_a \gset
select tests.create_user('admin.iso@buildflow.test') as user_b \gset

-- user_a crée son organisation personnelle (auto-créée par trigger) ; on
-- récupère son id pour y faire entrer user_b comme admin.
select id as org_id from public.organizations where owner_id = :'user_a' \gset

insert into public.organization_members (organization_id, user_id, role)
values (:'org_id', :'user_b', 'admin');

select tests.authenticate_as(:'user_a');

insert into public.projects (id, organization_id, name, owner_id)
values ('11111111-1111-1111-1111-111111111111', :'org_id', 'Projet confidentiel', :'user_a');

insert into public.tasks (project_id, title)
values ('11111111-1111-1111-1111-111111111111', 'Tâche confidentielle');

-- ---------------------------------------------------------------------
-- user_a (owner réel, invité via project_members par le trigger) voit
-- son projet et ses tâches.
-- ---------------------------------------------------------------------
select is(
  (select count(*) from public.projects where id = '11111111-1111-1111-1111-111111111111'),
  1::bigint,
  'le owner du projet voit son propre projet'
);

select is(
  (select count(*) from public.tasks where project_id = '11111111-1111-1111-1111-111111111111'),
  1::bigint,
  'le owner du projet voit les tâches de son projet'
);

-- ---------------------------------------------------------------------
-- user_b (admin de l'organisation, NON invité sur ce projet) ne doit
-- plus avoir de passe-droit : 0 ligne visible, ni sur projects ni sur
-- les tables enfants (tasks, documents, etc. partagent la même fonction
-- is_project_member).
-- ---------------------------------------------------------------------
select tests.authenticate_as(:'user_b');

select is(
  (select count(*) from public.projects where id = '11111111-1111-1111-1111-111111111111'),
  0::bigint,
  'un admin organisation NON invité ne voit PAS le projet (plus de passe-droit)'
);

select is(
  (select count(*) from public.tasks where project_id = '11111111-1111-1111-1111-111111111111'),
  0::bigint,
  'un admin organisation NON invité ne voit PAS les tâches du projet'
);

-- Il peut malgré tout lister les membres du projet (policy dédiée,
-- nécessaire pour pouvoir réaffecter un propriétaire absent), mais ne
-- peut RIEN modifier ni voir d'autre contenu.
select is(
  (select count(*) from public.project_members where project_id = '11111111-1111-1111-1111-111111111111'),
  1::bigint,
  'un admin organisation NON invité peut lister les membres (pour réaffectation), sans accès au contenu'
);

-- ---------------------------------------------------------------------
-- Une fois explicitement invité (insert project_members par le owner),
-- user_b doit retrouver l'accès normal.
-- ---------------------------------------------------------------------
select tests.authenticate_as(:'user_a');

insert into public.project_members (project_id, user_id, role)
values ('11111111-1111-1111-1111-111111111111', :'user_b', 'collaborator');

select tests.authenticate_as(:'user_b');

select is(
  (select count(*) from public.projects where id = '11111111-1111-1111-1111-111111111111'),
  1::bigint,
  'une fois explicitement invité, le collègue retrouve l''accès au projet'
);

select is(
  (select count(*) from public.tasks where project_id = '11111111-1111-1111-1111-111111111111'),
  1::bigint,
  'une fois explicitement invité, le collègue retrouve l''accès aux tâches'
);

-- ---------------------------------------------------------------------
-- Isolation inter-organisations : un utilisateur d'une AUTRE organisation
-- ne doit jamais voir ce projet, même en admin de sa propre organisation.
-- ---------------------------------------------------------------------
select tests.create_user('outsider.iso@buildflow.test') as user_c \gset
select tests.authenticate_as(:'user_c');

select is(
  (select count(*) from public.projects where id = '11111111-1111-1111-1111-111111111111'),
  0::bigint,
  'un utilisateur d''une autre organisation ne voit jamais le projet'
);

select * from finish();
rollback;
