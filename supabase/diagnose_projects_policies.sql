-- RLS activée sur la table projects ?
select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relname = 'projects';

-- Policies existantes sur projects
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'projects';

-- Définition actuelle des fonctions utilitaires (vérifie qu'elles existent bien)
select proname, prosecdef, provolatile
from pg_proc
where proname in ('is_org_member', 'is_org_admin_or_owner', 'is_project_member', 'is_project_owner');
