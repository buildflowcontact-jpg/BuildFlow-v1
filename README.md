# BuildFlow

BuildFlow est une application de gestion de projets BTP (Bâtiment et Travaux
Publics) : suivi de chantiers, planning Gantt, tâches récursives avec
dépendances, documents, plans, maquettes 3D, approvisionnements, incidents et
réserves de réception.

- **Frontend** : React 18 + TypeScript (strict) + Vite + Tailwind CSS + Lucide
  React + Motion
- **Backend** : Supabase (Auth, Postgres, Realtime, Storage)
- **Données** : aucune donnée fictive — tous les modules sont connectés à de
  vraies tables Supabase via une architecture en couches stricte
  `UI → Hooks → Services → Supabase`.

## 1. Prérequis

- Node.js 18+
- Un compte [Supabase](https://supabase.com) (le plan gratuit suffit pour
  démarrer)
- Le CLI Supabase (`npm install -g supabase`) si vous souhaitez exécuter les
  migrations en local ou via le CLI plutôt que depuis le tableau de bord web

## 2. Créer le projet Supabase

1. Sur [supabase.com](https://supabase.com), créez un nouveau projet.
2. Notez l'**URL du projet** et la clé **`anon` / `public`** (Project
   Settings → API). Ce sont les seules valeurs nécessaires côté frontend.
3. **Important — sécurité** : la clé **`service_role`** ne doit jamais être
   utilisée côté client, ni placée dans un fichier `.env`, ni committée dans
   le dépôt. Vite intègre toutes les variables préfixées `VITE_` dans le
   bundle JavaScript exposé publiquement : seule la clé `anon` (protégée par
   les policies RLS) doit donc s'y trouver.

## 3. Exécuter les migrations SQL

Les migrations se trouvent dans `supabase/migrations/` et doivent être
exécutées **dans l'ordre numérique** (`0001_...` puis `0002_...`, etc.).
Principales étapes :

1. `0001_schema.sql` — tables, enums, triggers (dont la protection anti-cycle
   sur les tâches et leurs dépendances), fonctions (`has_resource_access`,
   etc.)
2. `0002_rls_policies.sql` — policies RLS (Row Level Security) sur toutes les
   tables : priorité d'accès ressource > projet > organisation
3. `0003_storage_buckets.sql` — création des buckets Storage (`documents`,
   `plans`, `models3d`) et policies associées
4. `0004` à `0014` — évolutions du profil/projet, durcissement sécurité
   (RLS, search_path, escalade de privilèges), optimisations de performance
   (policies, index)
5. `0015_advanced_modules.sql` — modules avancés : journal de chantier,
   budget/dépenses, RFI, avenants (avec signature électronique), pointage
   horaire, sélections clients, pièces jointes polymorphes
6. `0016` et `0017` — durcissement et fusion des policies RLS des modules
   avancés

### Option A — via le tableau de bord Supabase

Dans l'éditeur SQL du projet (SQL Editor), exécutez le contenu de chaque
fichier dans l'ordre numérique ci-dessus.

### Option B — via le CLI Supabase

```bash
supabase link --project-ref <votre-ref-de-projet>
supabase db push
```

## 4. Configurer les variables d'environnement

Copiez `.env.example` vers `.env` et renseignez les deux variables :

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-anon-publique
```

`.env` est exclu du contrôle de version (voir `.gitignore`). Ne renseignez
jamais ici une clé `service_role`.

## 5. Installer et lancer

```bash
npm install
npm run dev
```

L'application est accessible sur `http://localhost:5173`.

À la première connexion, créez un compte (Auth Supabase par email/mot de
passe). Une organisation est automatiquement créée pour le premier
utilisateur, qui en devient propriétaire (`owner`).

## 6. Scripts disponibles

| Commande            | Description                                  |
| -------------------- | --------------------------------------------- |
| `npm run dev`        | Serveur de développement Vite                |
| `npm run build`      | Vérification TypeScript + build de production |
| `npm run preview`    | Prévisualisation du build de production       |
| `npm run lint`       | ESLint (zéro warning toléré)                  |
| `npm run typecheck`  | Vérification TypeScript seule                 |
| `npm run test:db`    | Tests pgTAP sur les policies RLS et les fonctions critiques (nécessite Docker) |

## 7. Tests de base de données (RLS + fonctions critiques)

`supabase/tests/database/` contient des tests [pgTAP](https://pgtap.org/)
qui vérifient, sur une vraie base Postgres locale (jamais sur le projet de
production) :

- **`01_project_isolation.test.sql`** : un admin/owner d'organisation NON
  invité sur un projet ne peut pas en voir le contenu (régression couverte
  par la migration `0011`), un membre explicitement invité retrouve l'accès,
  et l'isolation entre organisations est respectée.
- **`02_transfer_ownership.test.sql`** : `transfer_project_ownership()` —
  seul le owner actuel ou un admin d'organisation peut transférer, le
  nouveau propriétaire doit appartenir à l'organisation, l'ancien owner est
  rétrogradé (pas retiré), `projects.owner_id` reste synchronisé, et chaque
  transfert est journalisé + notifié.

Ces tests nécessitent Docker (stack Postgres locale lancée par le CLI
Supabase) :

```bash
npm run test:db
# équivalent à : npx supabase test db
```

## 8. Architecture du code

```
src/
  app/          Bootstrap de l'application, routage, providers
  modules/      Pages et composants spécifiques à chaque domaine
                (dashboard, projects, tasks, gantt, documents, plans,
                models3d, supplies, incidents, punchlist, settings,
                dailylogs, budget, rfis, changeorders, timeentries,
                portal, selections…)
  components/   Composants UI réutilisables (ui/) et transverses
                (sharing/ResourceSharingModal…)
  services/     Seule couche autorisée à appeler Supabase directement
  hooks/        React Query + logique métier, consomment les services
  stores/       État global client (Zustand) : authStore, uiStore
  lib/          Client Supabase, utilitaires bas niveau
  types/        Types générés/dérivés de la base (database.types.ts) et
                types de domaine + libellés français (domain.ts)
  utils/        Fonctions utilitaires pures (dates, classnames…)
```

Règle stricte respectée dans tout le projet : **aucun composant UI n'appelle
Supabase directement** — tout passe par `hooks/` puis `services/`.

## 9. Fonctionnalités principales

- **Tâches récursives** : profondeur illimitée (`parent_task_id`), avec
  protection anti-cycle à la fois côté base (trigger SQL) et côté client.
- **Dépendances de tâches** : détection de cycle avant toute création
  (`taskDependencies.service.ts`), en plus du trigger SQL.
- **Planning Gantt (SVG)** : zoom jour/semaine/mois, ligne « aujourd'hui »,
  flèches de dépendances multiples, jalons. L'édition se fait uniquement via
  formulaire (pas de glisser-déposer).
- **Documents, Plans (avec versions), Maquettes 3D** : stockage réel via
  Supabase Storage.
- **Approvisionnements, Incidents, Réserves de réception** : suivi avec
  alertes visuelles sur les retards.
- **Partage de ressources** : partage fin (lecture / modification / gestion)
  sur les documents, plans et tâches, en plus de l'appartenance au projet.
- **Exports PDF** : fiche chantier, planning, réserves de réception
  (`src/services/pdfExport.service.ts`, basé sur jsPDF + jspdf-autotable —
  architecture extensible pour ajouter de nouveaux exports).
- **Notifications & journal d'activité** en temps réel via Supabase
  Realtime.
- **Journal de chantier** : comptes-rendus quotidiens (avancement, météo,
  effectifs, incidents).
- **Budget & suivi des coûts** : catégories budgétaires et dépenses, écarts
  prévisionnel/réel.
- **RFI (demandes d'information)** : numérotation automatique, statuts de
  traitement, réponses tracées.
- **Avenants (change orders)** : impact coût/délai, workflow brouillon →
  soumis → approuvé/rejeté, **signature électronique obligatoire** à
  l'approbation (`decide_change_order`, fonction SECURITY DEFINER).
- **Pointage horaire** : saisie des heures par tâche, chacun gère ses
  propres entrées (le owner du projet peut tout corriger).
- **Sélections client** : options de matériaux/finitions proposées par
  l'équipe, validation par tout membre du projet (y compris client) avec
  **signature électronique optionnelle** (`decide_selection`).
- **Portail client** : tableau de bord consolidé (avancement, avenants en
  attente, derniers journaux de chantier, RFI ouvertes, documents récents).

## 10. Sécurité

- Toutes les tables sont protégées par des policies RLS : un utilisateur ne
  voit que les données de son organisation et des projets auxquels il a
  accès (directement, via permission de ressource, ou via son rôle
  d'organisation).
- La clé `service_role` n'apparaît dans aucun fichier du dépôt.
