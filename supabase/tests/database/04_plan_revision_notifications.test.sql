-- =========================================================================
-- BuildFlow — Tests pgTAP : notifications workflow validation des plans.
--
-- Couvre 0039_plan_revision_notifications.sql :
--   - soumis     → notifie les autres membres du projet
--   - approuve   → notifie le submitted_by
--   - refuse     → notifie le submitted_by (avec commentaire)
--   - en_revision→ notifie le submitted_by
--   - pas de doublon si le statut ne change pas
-- Exécution locale : `supabase test db` (nécessite Docker).
-- =========================================================================

begin;
create extension if not exists pgtap;

select plan(8);

-- ─── Fixtures ─────────────────────────────────────────────────────────────

select tests.create_user('submitter.plan@buildflow.test') as submitter_id \gset
select tests.create_user('reviewer.plan@buildflow.test')  as reviewer_id  \gset

select id as org_id
from public.organizations
where owner_id = :'submitter_id' \gset

select tests.authenticate_as(:'submitter_id');

insert into public.projects (id, organization_id, name, owner_id)
values ('aaaa0000-0000-0000-0000-000000000001',
        :'org_id', 'Projet Plans Test', :'submitter_id');

insert into public.project_members (project_id, user_id, role)
values ('aaaa0000-0000-0000-0000-000000000001', :'reviewer_id', 'collaborator');

-- ─── 1. INSERT avec statut 'soumis' → notification pour reviewer ──────────

insert into public.plan_revisions (
  id, project_id, title, revision_index, discipline, status,
  submitted_by, submitted_at
) values (
  'bbbb0000-0000-0000-0000-000000000001',
  'aaaa0000-0000-0000-0000-000000000001',
  'Plan RDC', 'A', 'architecture', 'soumis',
  :'submitter_id', now()
);

select is(
  (select count(*)::int from public.notifications
   where user_id = :'reviewer_id'
     and type = 'plan_revision.soumis'),
  1,
  'soumis : le relecteur reçoit une notification'
);

select is(
  (select count(*)::int from public.notifications
   where user_id = :'submitter_id'
     and type = 'plan_revision.soumis'),
  0,
  'soumis : l''auteur ne se notifie pas lui-même'
);

-- ─── 2. UPDATE statut → 'approuve' : notification pour le submitter ───────

update public.plan_revisions
set status = 'approuve', reviewed_by = :'reviewer_id', reviewed_at = now()
where id = 'bbbb0000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.notifications
   where user_id = :'submitter_id'
     and type = 'plan_revision.approuve'),
  1,
  'approuve : l''auteur reçoit une notification'
);

-- ─── 3. Nouveau plan, passage → refuse avec commentaire ───────────────────

insert into public.plan_revisions (
  id, project_id, title, revision_index, discipline, status,
  submitted_by, submitted_at
) values (
  'bbbb0000-0000-0000-0000-000000000002',
  'aaaa0000-0000-0000-0000-000000000001',
  'Plan Étage 1', 'A', 'structure', 'soumis',
  :'submitter_id', now()
);

update public.plan_revisions
set status = 'refuse',
    reviewed_by = :'reviewer_id',
    reviewed_at = now(),
    reviewer_comment = 'Poutres non conformes à la norme parasismique'
where id = 'bbbb0000-0000-0000-0000-000000000002';

select is(
  (select count(*)::int from public.notifications
   where user_id = :'submitter_id'
     and type = 'plan_revision.refuse'),
  1,
  'refuse : l''auteur reçoit une notification'
);

select is(
  (select message from public.notifications
   where user_id = :'submitter_id'
     and type = 'plan_revision.refuse'),
  'Poutres non conformes à la norme parasismique',
  'refuse : le commentaire est transmis dans le message'
);

-- ─── 4. Passage → 'en_revision' ───────────────────────────────────────────

insert into public.plan_revisions (
  id, project_id, title, revision_index, discipline, status,
  submitted_by, submitted_at
) values (
  'bbbb0000-0000-0000-0000-000000000003',
  'aaaa0000-0000-0000-0000-000000000001',
  'Plan Toiture', 'A', 'architecture', 'soumis',
  :'submitter_id', now()
);

update public.plan_revisions
set status = 'en_revision',
    reviewed_by = :'reviewer_id',
    reviewed_at = now(),
    reviewer_comment = 'Pente insuffisante'
where id = 'bbbb0000-0000-0000-0000-000000000003';

select is(
  (select count(*)::int from public.notifications
   where user_id = :'submitter_id'
     and type = 'plan_revision.en_revision'),
  1,
  'en_revision : l''auteur reçoit une notification'
);

-- ─── 5. UPDATE sans changement de statut → aucune nouvelle notification ───

declare v_count_before int;
select count(*)::int into v_count_before from public.notifications;

update public.plan_revisions
set title = 'Plan Toiture v2'
where id = 'bbbb0000-0000-0000-0000-000000000003';

select is(
  (select count(*)::int from public.notifications),
  v_count_before,
  'UPDATE sans changement de statut : aucune notification supplémentaire'
);

-- ─── 6. submitted_by NULL → pas de notification pour approuve/refuse ──────

insert into public.plan_revisions (
  id, project_id, title, revision_index, discipline, status
) values (
  'bbbb0000-0000-0000-0000-000000000004',
  'aaaa0000-0000-0000-0000-000000000001',
  'Plan Sans Auteur', 'B', 'fluides', 'soumis'
);

update public.plan_revisions
set status = 'approuve'
where id = 'bbbb0000-0000-0000-0000-000000000004';

select is(
  (select count(*)::int from public.notifications
   where type = 'plan_revision.approuve'
     and user_id IS NULL),
  0,
  'approuve sans submitted_by : aucune notification orpheline'
);

select * from finish();
rollback;
