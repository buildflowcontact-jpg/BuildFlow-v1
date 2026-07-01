-- =========================================================================
-- BuildFlow — Tests pgTAP : notifications garanties et livraisons.
--
-- Couvre :
--   0040_warranty_claim_notifications.sql :
--     ouvert     → notifie les membres (pas le créateur)
--     en_cours   → notifie le created_by
--     resolu     → notifie tous les membres
--     clos       → notifie le created_by
--   0041_supply_delivery_notifications.sql :
--     delivered  → notifie les membres
--     delayed    → notifie le created_by
--     cron overdue → dédupliqué par jour
-- Exécution locale : `supabase test db` (nécessite Docker).
-- =========================================================================

begin;
create extension if not exists pgtap;

select plan(11);

-- ─── Fixtures ─────────────────────────────────────────────────────────────

select tests.create_user('creator.ws@buildflow.test') as creator_id \gset
select tests.create_user('member.ws@buildflow.test')  as member_id  \gset

select id as org_id
from public.organizations
where owner_id = :'creator_id' \gset

select tests.authenticate_as(:'creator_id');

insert into public.projects (id, organization_id, name, owner_id)
values ('cccc0000-0000-0000-0000-000000000001',
        :'org_id', 'Projet Garanties Test', :'creator_id');

insert into public.project_members (project_id, user_id, role)
values ('cccc0000-0000-0000-0000-000000000001', :'member_id', 'collaborator');

-- ═══════════════════════════════════════════════════════════════════════════
-- GARANTIES
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. INSERT ouvert → notifie le membre, pas le créateur ───────────────

insert into public.warranty_claims (
  id, project_id, title, warranty_type, priority, status, created_by
) values (
  'dddd0000-0000-0000-0000-000000000001',
  'cccc0000-0000-0000-0000-000000000001',
  'Fissure façade', 'decennale', 'haute', 'ouvert', :'creator_id'
);

select is(
  (select count(*)::int from public.notifications
   where user_id = :'member_id'
     and type = 'warranty.ouvert'),
  1,
  'ouvert : le membre reçoit une notification'
);

select is(
  (select count(*)::int from public.notifications
   where user_id = :'creator_id'
     and type = 'warranty.ouvert'),
  0,
  'ouvert : le créateur ne se notifie pas lui-même'
);

-- ─── 2. UPDATE → en_cours : notifie le créateur ──────────────────────────

update public.warranty_claims
set status = 'en_cours'
where id = 'dddd0000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.notifications
   where user_id = :'creator_id'
     and type = 'warranty.en_cours'),
  1,
  'en_cours : le créateur reçoit une notification'
);

-- ─── 3. UPDATE → resolu : notifie tous les membres ───────────────────────

update public.warranty_claims
set status = 'resolu'
where id = 'dddd0000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.notifications
   where type = 'warranty.resolu'
     and user_id in (:'creator_id'::uuid, :'member_id'::uuid)),
  2,
  'resolu : le créateur et le membre reçoivent une notification'
);

-- ─── 4. UPDATE → clos : notifie le créateur ──────────────────────────────

update public.warranty_claims
set status = 'clos'
where id = 'dddd0000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.notifications
   where user_id = :'creator_id'
     and type = 'warranty.clos'),
  1,
  'clos : le créateur reçoit une notification'
);

-- ─── 5. UPDATE sans changement de statut → aucune notification ───────────

declare v_count int;
select count(*)::int into v_count from public.notifications;

update public.warranty_claims
set notes = 'Intervention planifiée'
where id = 'dddd0000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.notifications),
  v_count,
  'UPDATE sans changement de statut : aucune notification supplémentaire'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- LIVRAISONS
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 6. INSERT supply delivered → notifie tous les membres ───────────────

insert into public.supplies (
  id, project_id, supplier_name, item_description, quantity, status, created_by
) values (
  'eeee0000-0000-0000-0000-000000000001',
  'cccc0000-0000-0000-0000-000000000001',
  'Acier SA', 'Poutrelles HEA 200', 10, 'delivered', :'creator_id'
);

select is(
  (select count(*)::int from public.notifications
   where type = 'supply.delivered'
     and user_id in (:'creator_id'::uuid, :'member_id'::uuid)),
  2,
  'delivered : creator et membre reçoivent une notification de livraison'
);

-- ─── 7. UPDATE → delayed : notifie le created_by ─────────────────────────

insert into public.supplies (
  id, project_id, supplier_name, item_description, quantity, status, created_by
) values (
  'eeee0000-0000-0000-0000-000000000002',
  'cccc0000-0000-0000-0000-000000000001',
  'Bois SA', 'Charpente pin', 5, 'ordered', :'creator_id'
);

update public.supplies
set status = 'delayed'
where id = 'eeee0000-0000-0000-0000-000000000002';

select is(
  (select count(*)::int from public.notifications
   where user_id = :'creator_id'
     and type = 'supply.delayed'),
  1,
  'delayed : le créateur reçoit une notification de retard'
);

-- ─── 8. Cron overdue : première notification envoyée ─────────────────────

insert into public.supplies (
  id, project_id, supplier_name, item_description, quantity, status,
  expected_delivery_date, created_by
) values (
  'eeee0000-0000-0000-0000-000000000003',
  'cccc0000-0000-0000-0000-000000000001',
  'Carrelage SA', 'Faïence salle de bain', 200, 'ordered',
  CURRENT_DATE - 3, :'creator_id'
);

select public.notify_overdue_supplies();

select is(
  (select count(*)::int from public.notifications
   where type = 'supply.retard'
     and user_id in (:'creator_id'::uuid, :'member_id'::uuid)),
  2,
  'cron overdue : creator et membre notifiés pour la supply en retard'
);

-- ─── 9. Cron overdue : deuxième appel → pas de doublon le même jour ──────

select public.notify_overdue_supplies();

select is(
  (select count(*)::int from public.notifications
   where type = 'supply.retard'
     and user_id in (:'creator_id'::uuid, :'member_id'::uuid)),
  2,
  'cron overdue : deuxième appel dans la journée, aucun doublon'
);

-- ─── 10. Supply delivered/cancelled → non retournée par le cron ──────────

insert into public.supplies (
  id, project_id, supplier_name, item_description, quantity, status,
  expected_delivery_date, created_by
) values (
  'eeee0000-0000-0000-0000-000000000004',
  'cccc0000-0000-0000-0000-000000000001',
  'Peinture SA', 'Peinture blanche', 50, 'delivered',
  CURRENT_DATE - 1, :'creator_id'
);

select public.notify_overdue_supplies();

select is(
  (select count(*)::int from public.notifications
   where type = 'supply.retard'
     and link like '%eeee0000-0000-0000-0000-000000000004%'),
  0,
  'cron overdue : supply delivered exclue même si date dépassée'
);

select * from finish();
rollback;
