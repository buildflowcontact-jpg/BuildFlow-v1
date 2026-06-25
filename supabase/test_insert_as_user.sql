-- Simule une requête authentifiée en tant que gauthiercyril@live.fr
-- pour isoler si le problème vient de la policy/fonction (réplicable ici)
-- ou de la session côté navigateur (ne se réplique pas ici).

begin;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '887601d7-e259-4c21-8293-ebc53ebc39a2',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

-- Test 1 : la fonction utilitaire seule
select public.is_org_member('54c2c8b1-dd48-4163-ae62-5435617aed99'::uuid) as is_member_check;

-- Test 2 : l'insert exact que fait le front
insert into public.projects (name, organization_id, owner_id, status)
values ('Test RLS', '54c2c8b1-dd48-4163-ae62-5435617aed99', '887601d7-e259-4c21-8293-ebc53ebc39a2', 'prospection')
returning id, name;

rollback; -- annule le test, rien n'est créé pour de vrai
