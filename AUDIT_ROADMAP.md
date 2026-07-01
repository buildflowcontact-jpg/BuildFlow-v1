# Audit complet BuildFlow — Feuille de route
> Généré le 01/07/2026

---

## 1. État des lieux — Ce qui est déjà en place

### Architecture technique
- **Stack** : React 18 + TypeScript strict + Vite 5 + react-router-dom v6 + TanStack Query v5 + Supabase (Postgres + RLS) + Zustand + Tailwind CSS 3
- **Code-splitting** : toutes les routes sont `lazy()`-chargées ; 3 chunks vendor séparés (react, supabase/tanstack, ui) → bundle initial minimal
- **Sécurité BDD** : 41 migrations, RLS sur toutes les tables, fonctions SECURITY DEFINER pour les notifications, `pg_cron` pour les alertes différées
- **Offline/cache** : TanStack Query Persist Client (localStorage) pour le cache cross-session
- **Realtime** : `useRealtimeInvalidate` via Supabase channels sur toutes les tables actives
- **Observabilité** : Sentry intégré (en attente de DSN)
- **Tests BDD** : pgTAP (migrations 04 et 05)

### Modules complets (CRUD + PDF/export)

| Module | CRUD | Notifications | PDF | Remarques |
|--------|------|---------------|-----|-----------|
| Tâches | ✅ | — | ✅ | Dépendances, jalons, hiérarchie |
| Gantt | ✅ | — | ✅ | Zoom jour/sem/mois, livraisons, SVG dépendances |
| Documents | ✅ | — | — | Storage Supabase, permissions par ressource |
| Plans & 3D | ✅ | — | ✅ | PDF viewer, IFC, annotations, captures, versions |
| Approvisionnements | ✅ | ✅ cron | ✅ | Délai, location, catégories |
| Journal de chantier | ✅ | — | ✅ | Météo Open-Meteo, pointage |
| Budget | ✅ | — | — | Postes arborescents, engagé vs réel |
| RFI | ✅ | ✅ | — | Workflow open→answered→closed |
| Avenants | ✅ | — | — | |
| Facturation | ✅ | — | ✅ | Devis, factures, DPGF import, Factur-X |
| Pointage | ✅ | — | ✅ | Rapport quotidien |
| Portail client | ✅ | — | — | Widgets configurables |
| Incidents | ✅ | — | — | |
| Réserves (Punch List) | ✅ | — | ✅ | PV réception avec signatures électroniques |
| DOE | ✅ | — | ✅ | Suivi par lot et catégorie |
| Garanties / SAV | ✅ | ✅ | ✅ | Décennale, biennale, parfait achèvement |
| Révisions de plans | ✅ | ✅ | — | Workflow soumis→approuvé/refusé |
| Suivi déchets (BSD) | ✅ | — | ✅ | Par catégorie réglementaire |
| Rapports de réunion | ✅ | — | ✅ | Points d'action, prochaine réunion |
| Sécurité (feu/PPSPS) | ✅ | — | ✅ | Permis de feu avec signatures |
| Qualité | ✅ | — | — | Modèles, inspections, non-conformités |
| Messagerie interne | ✅ | — | — | Conversations par projet |
| CRM Prospects | ✅ | — | — | Kanban drag & drop, visites |
| Clients / Entreprises | ✅ | — | — | |
| Paramètres | ✅ | — | — | Organisation, profil, membres |
| Dashboard | ✅ | — | — | KPIs, widgets garanties/plans |

---

## 2. Points critiques identifiés

### 2.1 Dette technique
**Priorité haute**

**A. Double fichier d'export PDF**
`src/utils/pdfExport.ts` (version simple, sans header brandé, créée en urgence) coexiste avec `src/services/pdfExport.service.ts` (version complète avec header, footer, pagination). Les composants `WarrantyTab` et `ProjectOverviewPage` utilisent encore l'ancienne version — exports visuellement incohérents avec le reste.

**B. Types DB non-resserrés**
Dans `database.types.ts`, `priority`, `status`, `discipline` sont typés `string` au lieu des unions littérales correspondantes. Tous les accès aux maps de labels nécessitent des casts explicites et ne bénéficient pas de la vérification d'exhaustivité TypeScript.

**C. `confirm()` navigateur pour les suppressions**
Chaque suppression utilise `window.confirm()`, un dialog bloquant hors du cycle React. Aucune gestion du feedback de succès/erreur (pas de toast).

**D. Aucun toast/notification in-app**
Les mutations réussies ne donnent aucun retour visuel. Les erreurs réseau sont silencieuses.

**Priorité moyenne**

**E. Pas de CI/CD**
Aucun pipeline (GitHub Actions, Vercel CI, etc.). Le `tsc --noEmit` et `eslint` ne tournent jamais automatiquement.

**F. ESLint jamais exécuté**
`eslint . --max-warnings 0` est défini dans `package.json` mais n'a pas été lancé. Impossible de savoir combien d'avertissements latents existent.

**G. Pas de tests frontend**
Zéro test unitaire (Vitest) ou E2E (Playwright). Seuls les triggers BDD sont testés via pgTAP.

**H. `staleTime` non configuré globalement**
TanStack Query utilise `staleTime: 0` par défaut → refetch inutiles à chaque montage de composant.

---

### 2.2 Fonctionnalités manquantes à fort impact

**Notifications email**
Les triggers DB insèrent dans la table `notifications` mais aucun email n'est envoyé. Les utilisateurs ne sont informés que s'ils ouvrent l'application.

**Accès portail client externe**
Le portail client est une vue interne (onglet projet visible par l'équipe). Il n'existe pas d'URL dédiée ni de login magic-link permettant à un client externe de consulter son projet sans compte BuildFlow complet.

**Recherche globale**
Aucune barre de recherche. Pour retrouver un RFI spécifique, une réserve ou un document, l'utilisateur doit naviguer manuellement dans chaque projet.

**Liaison devis ↔ budget**
Un devis accepté dans Facturation ne crée pas automatiquement de ligne dans le Budget. Risque de double-saisie et de divergences.

**Pièces jointes sur RFIs**
Les RFIs ne supportent pas les fichiers joints (plans, photos) alors que c'est le cas d'usage le plus fréquent en pratique.

---

### 2.3 UX / Accessibilité

- Aucun mode sombre
- Navigation au clavier incomplète (pas d'attributs `aria-*` systématiques)
- Pas de responsive mobile (layout desktop uniquement)
- Pas de breadcrumb (on ne sait pas où on est dans la hiérarchie)
- Confirmation de suppression via `confirm()` navigateur (bloquant, non stylé)
- Pas de skeleton loaders (uniquement spinner global par page)
- Aucun raccourci clavier

---

## 3. Feuille de route

### Phase 1 — Qualité & fiabilité (2 semaines)
*Objectif : supprimer la dette technique, stabiliser la base de code.*

| # | Tâche | Effort |
|---|-------|--------|
| 1.1 | **Migrer WarrantyTab + ProjectOverviewPage** vers `pdfExport.service.ts` et supprimer `utils/pdfExport.ts` | S |
| 1.2 | **Système de toasts** : intégrer `react-hot-toast` (ou composant custom léger), remplacer tous les `confirm()` par une modale de confirmation stylée | M |
| 1.3 | **ESLint clean** : exécuter, corriger tous les avertissements, ajouter `lint` en pre-commit (husky + lint-staged) | S |
| 1.4 | **staleTime global** : configurer `QueryClient` avec `defaultOptions: { queries: { staleTime: 30_000 } }` | XS |
| 1.5 | **Types DB resserrés** : narrower `priority`, `status`, `discipline` dans `database.types.ts` en unions litérales → supprimer les casts | M |
| 1.6 | **CI/CD** : GitHub Actions — `tsc`, `eslint`, `supabase test db` sur chaque PR | M |

---

### Phase 2 — UX & Expérience utilisateur (3 semaines)
*Objectif : rendre l'application agréable et fluide au quotidien.*

| # | Tâche | Effort |
|---|-------|--------|
| 2.1 | **Toasts de feedback** (suite 1.2) : chaque mutation réussie affiche un toast de confirmation | S |
| 2.2 | **Modale de confirmation stylée** : remplacer `window.confirm()` par un `ConfirmModal` React avec bouton destructif | S |
| 2.3 | **Skeleton loaders** : remplacer les `FullPageSpinner` par des skeletons (squelettes animés) sur les listes principales | M |
| 2.4 | **Breadcrumb** : ajouter un fil d'Ariane dans le `ProjectLayout` (ex : Projets / Mon Chantier / Tâches) | S |
| 2.5 | **Recherche globale** : barre de recherche dans la Topbar, recherche full-text Supabase sur projets, tâches, RFIs, documents | L |
| 2.6 | **Accessibilité de base** : aria-label sur tous les boutons icon-only, focus visible, navigation clavier sur les modales | M |
| 2.7 | **Raccourcis clavier** : `N` pour créer, `/` pour rechercher, `Esc` pour fermer les modales | S |
| 2.8 | **Mobile responsive** : audit et correction du layout — sidebar collapsible, tableaux scrollables, formulaires adaptés | L |

---

### Phase 3 — Fonctionnalités manquantes (4 semaines)
*Objectif : compléter les workflows métier critiques.*

| # | Tâche | Effort |
|---|-------|--------|
| 3.1 | **Notifications email** : Edge Function Supabase + Resend (ou Sendgrid) ; envoyer un email pour chaque type de notification existant (plan, garantie, supply, RFI) | L |
| 3.2 | **Portail client externe** : URL dédiée `/portal/:token`, login par magic-link, vue en lecture seule des widgets configurés | XL |
| 3.3 | **Pièces jointes RFIs** : utiliser `resource_attachments` (table et storage déjà présents) sur les RFIs | M |
| 3.4 | **Liaison devis ↔ budget** : bouton "Importer en budget" sur un devis accepté, crée des lignes dans `expenses` (kind: committed) | M |
| 3.5 | **Enrichissement CRM** : scoring prospect (0-100), relance automatique (cron J+7 si aucune visite), conversion prospect → projet en 1 clic | L |
| 3.6 | **Validation en masse** : sélection multiple + action groupée (ex : résoudre plusieurs réserves d'un coup, archiver des plans) | M |
| 3.7 | **Calendrier** : vue calendrier mensuel (react-big-calendar ou custom) agrégeant tâches, livraisons, réunions | L |
| 3.8 | **Mode hors-ligne amélioré** : queue de mutations offline (TanStack Query persist + sync au retour de connexion), banner offline fonctionnel | M |

---

### Phase 4 — Analytics & Reporting cross-projet (3 semaines)
*Objectif : donner une vision consolidée à l'échelle de l'organisation.*

| # | Tâche | Effort |
|---|-------|--------|
| 4.1 | **Dashboard cross-projet** : KPIs agrégés (tâches en retard sur tous projets, budget global, RFIs ouvertes, livraisons imminentes) | L |
| 4.2 | **Rapport de rentabilité** : budget prévu vs engagé vs réel par projet, exportable PDF/CSV | M |
| 4.3 | **Planning multi-projets** : timeline horizontale croisant tous les projets actifs (vue ressources) | XL |
| 4.4 | **Export consolidé** : rapport PDF mensuel d'activité organisation (projets actifs, alertes, RFIs en attente) | M |
| 4.5 | **Tableau de bord QSE** : synthèse qualité + sécurité + environnement sur tous les projets | M |

---

### Phase 5 — Infrastructure & Production (2 semaines)
*Objectif : préparer l'application à un usage multi-utilisateurs en production.*

| # | Tâche | Effort |
|---|-------|--------|
| 5.1 | **Configurer Sentry DSN** : activer le monitoring d'erreurs en production | XS |
| 5.2 | **Tests E2E Playwright** : couvrir les parcours critiques (auth, créer projet, créer tâche, soumettre RFI) | L |
| 5.3 | **Rate limiting** : Edge Function ou middleware Supabase pour limiter les requêtes | M |
| 5.4 | **Politique de backup** : Supabase PITR activé, test de restauration documenté | S |
| 5.5 | **Variables d'environnement** : audit de tous les `VITE_*` en production (pas de secret exposé côté client) | S |
| 5.6 | **Performance bundle** : analyser avec `rollup-plugin-visualizer`, identifier les chunks anormalement lourds | S |

---

## 4. Priorisation recommandée

```
MAINTENANT (blocants ou dette critique)
  → 1.2 Toasts + ConfirmModal
  → 1.1 Unification PDF
  → 1.4 staleTime
  → 1.6 CI/CD

COURT TERME (valeur utilisateur immédiate)
  → 3.3 Pièces jointes RFIs
  → 2.5 Recherche globale
  → 2.4 Breadcrumb
  → 2.2 Modale confirmation

MOYEN TERME (différenciateurs produit)
  → 3.1 Notifications email
  → 3.2 Portail client externe
  → 3.5 CRM enrichi
  → 4.1 Dashboard cross-projet

LONG TERME (roadmap produit avancée)
  → 3.8 Mode hors-ligne
  → 3.7 Calendrier
  → 4.3 Planning multi-projets
  → 2.8 Mobile responsive
```

---

## 5. Légende des efforts

| Symbole | Durée estimée |
|---------|--------------|
| XS | < 2h |
| S | 2-4h |
| M | 1-2 jours |
| L | 3-5 jours |
| XL | > 1 semaine |

---

*Audit réalisé sur la base de l'inspection complète des 160+ fichiers source, 41 migrations SQL, services, hooks et modules UI.*
