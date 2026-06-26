
# Audit complet de BuildFlow — 26 juin 2026

> Audit mené sous casquette CTO / architecte / UX-UI / PM / sécurité / DevOps / fullstack / investisseur. Ton volontairement sans complaisance. Chaque affirmation ci-dessous est adossée à une donnée concrète relevée dans le code, la base Supabase (projet `nonqaratfnjpdogjbzyi`) ou le build de production — pas à des impressions.

**Périmètre mesuré** : 168 fichiers TS/TSX, 21 375 lignes de code applicatif, 26 migrations SQL, 49 tables (RLS activée sur 100% d'entre elles), 41 services, 39 hooks, 31 dossiers de modules métier, 0 fichier de test frontend, 0 pipeline CI/CD, 0 dépôt git distant.

---

## 1. Vision produit

**Proposition de valeur.** BuildFlow est un ERP/CRM chantier pour le BTP français : gestion de projet, Gantt, journal de chantier, budget, RFI, avenants, pointage, devis/facturation avec conformité Factur-X/Peppol, qualité/non-conformités, messagerie, portail client, plans 2D/IFC 3D annotés. C'est une proposition large et cohérente sur le papier — c'est littéralement le scope combiné de Vertuoza + Obat + Graneet + Plancrad.

**Le vrai problème : c'est une accumulation de fonctionnalités, pas un produit priorisé.** 31 modules ont été construits en l'espace de cet historique de conversation, sans qu'aucune métrique d'usage, aucun retour utilisateur réel, ni aucun test avec un client pilote n'apparaisse dans le repo. Le risque n'est pas technique, il est produit : on a complété la liste de fonctionnalités des concurrents (tâche #66-67) plutôt que de valider ce dont *vos* utilisateurs ont réellement besoin. Un investisseur SaaS regarderait ça et poserait une seule question : « Combien de ces 31 modules sont utilisés chaque semaine par un vrai client payant ? » — et il n'y a aujourd'hui aucun moyen de répondre, faute de toute télémétrie produit (aucune dépendance Sentry/PostHog/Mixpanel/Amplitude dans `package.json`).

**Fonctionnalités manquantes qui, elles, créeraient de la vraie valeur :**
- Un onboarding guidé / mode démo avec données factices — aujourd'hui un nouvel utilisateur arrive sur une app à 17 onglets sans aucun fil rouge.
- Une recherche globale transverse (actuellement la recherche n'existe que dans l'onglet Documents, tâche #33).
- Des notifications mobiles push / un PWA installable — chantier de terrain = usage mobile, et le responsive est aujourd'hui extrêmement léger (cf. section 11).
- Un module de monétisation : aucun Stripe/Paddle dans les dépendances. Si l'objectif est de vendre BuildFlow, il n'y a littéralement aucun mécanisme de facturation des clients de BuildFlow lui-même.
- Une vraie gestion de sous-traitants/fournisseurs au-delà de « Commandes » basique.
- Des templates de projet (créer un nouveau chantier en clonant une structure type au lieu de repartir de zéro).

**Complexité auto-infligée.** La progression des tâches montre plusieurs allers-retours sur la même zone fonctionnelle (Sélections ajoutées puis supprimées #74→#104, Avenants supprimés puis restaurés #100→#115, Phases ajoutées puis supprimées #94). C'est le symptôme classique de fonctionnalités construites sans validation préalable du besoin. Chaque cycle ajoute-supprime-restaure coûte du temps de dev et laisse des traces dans le schéma DB (tables `selections`, colonnes orphelines) qu'il faut ensuite nettoyer.

**Idées à fort potentiel de valeur réelle :**
1. Score de risque chantier automatique (retards Gantt + non-conformités ouvertes + RFI en attente → un indicateur unique par projet).
2. Génération automatique de rapport hebdomadaire client à partir des données déjà saisies (vous avez déjà les daily logs, le budget, les captures — il manque juste l'agrégation en un PDF client).
3. Reconnaissance des montants sur factures fournisseurs scannées (OCR) pour préremplir le budget — bien plus utile que l'import DPGF seul.
4. Marketplace de templates de checklists qualité par corps de métier (gros œuvre, électricité, plomberie).

---

## 2. Expérience utilisateur (UX)

**Parcours et friction.** La navigation projet est en sidebar avec 17 entrées (`projectSectionPages.tsx`) — c'est beaucoup pour un menu plat sans sous-groupes visuels au-delà des renommages cosmétiques (#98-99 ont déplacé Budget/Documents en haut, mais la liste reste une colonne unique de 17 liens). Un chef de chantier qui ouvre l'app pour la première fois ne sait pas par où commencer : il n'y a pas de hiérarchisation visuelle entre « ce que je fais tous les jours » (journal, tâches, pointage) et « ce que je fais une fois par semaine » (facturation, qualité).

**Actions à fort nombre de clics repérées dans le code :**
- Créer une facture *depuis un devis accepté* : ouvrir le devis → vérifier le statut → bouton convertir → ouvrir la facture créée → générer le Factur-X → c'est correct fonctionnellement mais aucun raccourci « one-click » n'existe depuis la liste des devis.
- Messagerie : pour parler à un collègue, il faut passer par `get_or_create_direct_conversation`, ce qui suppose une UI de sélection de membre — à vérifier dans `MessagingTab.tsx`, mais l'absence de notification temps réel visible en dehors de l'onglet messagerie lui-même (pas de badge global dans la sidebar pour les messages non lus, contrairement aux notifications classiques) est une régression d'expérience par rapport au standard du marché.

**Incohérence d'interaction notable.** Le même concept « lignes éditables avec total calculé » existe dans `LineItemsEditor.tsx` (devis/factures) mais le pattern n'est pas repris pour `ChecklistItemsEditor.tsx` (qualité) qui a été recodé séparément — deux implémentations différentes pour un besoin structurellement identique (liste de lignes + ajout + suppression + réordonnancement). C'est un signe de duplication conceptuelle qui va coûter cher en maintenance UX (un changement de comportement dans l'un ne se propage pas à l'autre).

**Ce qui peut perturber un nouvel utilisateur :**
- Le vocabulaire mélange français métier BTP (DPGF, RFI, PDGF) et termes génériques SaaS (« Tableau de bord »). Sans glossaire ni tooltips d'aide contextuelle, un PM/MOA qui n'est pas dans le jargon chantier (un client final dans le portail, par exemple) va se perdre.
- Aucun état de confirmation/« undo » visible avant les actions destructrices (suppression de devis, de facture) au-delà d'un éventuel `window.confirm` natif — à vérifier composant par composant, mais rien dans `QuotesPanel.tsx`/`InvoicesPanel.tsx` ne montre de pattern de confirmation modal cohérent à l'échelle de l'app.

**Ce qui doit être simplifié en priorité :**
1. Regrouper les 17 entrées de la sidebar projet en 4-5 sections pliables (Suivi quotidien / Documents & Plans / Finance / Qualité & Communication / Administration) plutôt qu'une liste plate.
2. Un seul composant `ItemsEditor` générique réutilisé partout au lieu de `LineItemsEditor` + `ChecklistItemsEditor` divergents.
3. Un fil d'Ariane (breadcrumb) systématique — actuellement la profondeur de navigation (projet > onglet > modal détail) n'a pas de repère visuel constant.

---

## 3. Interface utilisateur (UI)

**Ce qui est fait correctement.** Il y a un vrai design system avec tokens définis (#87-91), une palette bleu/violet cohérente, des composants de base modernisés (`Button`, `Input`, `Select`, `Modal`, `Spinner`). Le fait que `FullPageSpinner` et `Spinner` existent montre qu'un minimum d'état de chargement est prévu.

**Lacunes concrètes mesurées dans le code :**
- **Accessibilité visuelle quasi absente en dehors d'un correctif ponctuel** : seulement 15 fichiers sur 77 composants `.tsx` contiennent un `aria-label` (tâche #62 n'a couvert qu'une partie du périmètre, et tout le travail ajouté depuis — billing, quality, messaging, DPGF — n'a pas repris cette discipline : zéro `aria-label` trouvé dans `QuotesPanel.tsx`, `InvoicesPanel.tsx`, `DpgfImportModal.tsx`, `MessagingTab.tsx`, `InspectionsPanel.tsx`).
- **États vides non systématiques** : aucune convention visible de composant `EmptyState` partagé — chaque module qui affiche une liste vide invente probablement son propre texte/icône au lieu de reposer sur un composant unique, ce qui va créer des incohérences (déjà visible structurellement par l'absence d'un fichier `EmptyState.tsx` dans `src/components/ui`).
- **Messages d'erreur** : la couche service laisse `error` remonter brut depuis Supabase (`if (error) throw error`) dans la quasi-totalité des fichiers `*.service.ts`. Rien n'indique une couche de traduction des erreurs Postgres/RLS en message utilisateur compréhensible — un utilisateur qui viole une contrainte va potentiellement voir un message Postgres technique en anglais (« duplicate key value violates unique constraint... ») dans une app entièrement en français.
- **Animations** : la dépendance `motion` (Framer Motion) est présente mais sans garantie d'usage cohérent — à auditer composant par composant pour vérifier qu'elle n'est pas utilisée de façon disparate (certaines transitions animées, d'autres non, sans règle).

**Recommandations concrètes :**
1. Créer un composant `<ErrorMessage>` qui mappe les codes d'erreur Postgres/RLS connus (23505 = doublon, 42501/RLS = permission refusée) vers des phrases françaises, et l'utiliser partout au lieu de laisser fuiter `error.message`.
2. Créer `<EmptyState icon title description action />` unique et le rebrancher dans toutes les listes (devis, factures, inspections, conversations, RFI...).
3. Passer un audit Lighthouse/axe-core automatisé en CI (inexistant aujourd'hui, cf. section 12) pour faire remonter mécaniquement les manques d'`aria-label`/contraste plutôt que de les corriger module par module de façon réactive.

---

## 4. Architecture logicielle

**Le bon choix structurant : la séparation stricte UI → Hooks → Services → Supabase est respectée de façon quasi exemplaire.** Sur tous les fichiers inspectés (`quotes.service.ts`, `invoices.service.ts`, `messaging.service.ts`, `dpgfImport.service.ts`...), aucun composant React n'appelle directement `supabase.from(...)` — c'est systématiquement encapsulé dans `src/services/*.service.ts`, exposé via des hooks React Query dans `src/hooks/*.ts`. C'est l'architecture la plus solide du projet et elle a bien tenu sur 41 services / 39 hooks sans dérive visible.

**Anti-pattern réel : la confusion entre découpage par domaine et découpage par technique.** `src/modules/` contient 31 dossiers à plat (billing, budget, captures, changeorders, clients, companies, dailylogs, dashboard, documents, gantt, incidents, messaging, misc, models3d, plans, portal, projects, punchlist, quality, rfis, settings, supplies, tasks, timeentries, auth...). Il n'y a aucune notion de sous-domaine (« Finance » regroupant billing+budget, « Terrain » regroupant dailylogs+incidents+punchlist+quality). À 31 dossiers plats, la découvrabilité du code commence déjà à se dégrader pour un nouveau développeur — et le projet n'a qu'un seul contributeur effectif jusqu'ici.

**Risque technique le plus sérieux de la section : `src/types/database.types.ts` fait 3 321 lignes et est généré automatiquement depuis le schéma Supabase.** C'est normal en soi, mais sa taille est un indicateur indirect de la vitesse à laquelle le schéma grossit (49 tables) sans qu'aucune segmentation en sous-schémas (`billing`, `quality`, `messaging` comme schémas Postgres séparés plutôt que tout dans `public`) n'ait été envisagée. À ce rythme d'ajout de modules, `public` va devenir un schéma fourre-tout difficile à raisonner pour la sécurité (RLS) et la gouvernance des permissions.

**Dépendances à risque :**
- `@thatopen/components` / `@thatopen/fragments` / `web-ifc` (viewer IFC 3D) : écosystème jeune, API peu stable historiquement — c'est une dépendance critique pour un module entier (Plans et 3D) sur une lib avec un historique de breaking changes fréquents. À surveiller à chaque montée de version.
- `xlsx` (SheetJS) en version `^0.18.5` : cette lib a un historique de CVE (ReDoS, prototype pollution sur d'anciennes versions) — recommandé de verrouiller la version exacte plutôt que `^0.18.5` et de surveiller les advisories npm, surtout qu'elle parse des fichiers uploadés par l'utilisateur (DPGF).
- Pas de typage strict de bout en bout : `database.types.ts` régénéré donne une bonne base, mais l'usage de casts `as unknown as X` repéré dans `messaging.service.ts` (`as unknown as ParticipantWithProfile[]`) montre que le typage Supabase généré ne couvre pas nativement les jointures (`profile:profiles(*)`) — ces casts sont des trous de vérification statique qui peuvent masquer un changement de shape de données silencieusement.

**Architecture proposée si je devais retravailler la structure :**
```
src/
  domains/
    field-ops/       (dailylogs, incidents, punchlist, quality, timeentries)
    finance/         (billing, budget, dpgf-import)
    planning/        (tasks, gantt, rfis, changeorders)
    documents/       (documents, plans, models3d, captures)
    collaboration/   (messaging, portal, notifications)
    core/            (projects, clients, companies, settings, auth)
  shared/
    ui/
    hooks/
    services/        (cross-domain only: activityLogs, storage, realtime)
```
Chaque domaine porterait ses propres `services/`, `hooks/`, et composants — réduisant le `src/modules` plat actuel à une organisation qui scale au-delà d'un seul développeur.

---

## 5. Qualité du code

**Conventions et nommage : globalement bons et cohérents** — `camelCase` pour les fonctions, `PascalCase` pour les composants, suffixe `.service.ts` systématique, commentaires JSDoc en français au-dessus de chaque fonction service expliquant le *pourquoi* (pas juste le *quoi*) — c'est une pratique de bien meilleure qualité que la moyenne des projets de cette taille.

**Duplication identifiée concrètement :**
- Le pattern « create/update avec recalcul de totaux + delete-then-reinsert des lignes » est dupliqué quasi à l'identique entre `quotes.service.ts` et `invoices.service.ts` (les deux fonctions `update()` font `delete().eq(...)` puis ré-insertion complète). Un helper générique `replaceLineItems(table, parentId, items)` éliminerait ~40 lignes dupliquées et le risque que l'un soit corrigé sans l'autre.
- `LineItemsEditor.tsx` et `ChecklistItemsEditor.tsx` (déjà noté en UX) sont une duplication structurelle, pas seulement visuelle.

**Complexité à surveiller :**
- `PlansTab.tsx` (640 lignes), `InvoicesPanel.tsx` (533 lignes), `BudgetTab.tsx` (497 lignes), `QuotesPanel.tsx` (491 lignes) sont des composants god-component qui mélangent probablement état local, requêtes, et rendu de plusieurs sous-vues (liste + modal détail + formulaire) dans un seul fichier. Au-delà de ~300 lignes, un composant React devient difficile à tester et à faire évoluer sans régression visuelle. Ce sont les 4 candidats prioritaires à découper en sous-composants.

**Qualité TypeScript/React :**
- Aucun usage de `React.memo`/`useMemo`/`useCallback` détecté de façon systématique dans les fichiers inspectés — sur des composants de 500+ lignes avec des tableaux de lignes éditables (`LineItemsEditor`), chaque frappe clavier dans un champ déclenche un `onChange` qui recrée tout le tableau de lignes (`rows.map(...)`) et potentiellement re-render l'intégralité du tableau à chaque caractère. Pas critique avec 5-10 lignes, mais un DPGF importé peut contenir 200+ postes (cf. le cas d'usage même que vous avez construit) — risque réel de lag de saisie sur un devis volumineux.
- `eslint --max-warnings 0` en script `lint` est une bonne discipline de rigueur — mais sans CI (section 12), rien n'empêche un commit de violer cette règle puisque la commande n'est jamais exécutée automatiquement.

**Ce qui va devenir problématique avec le temps si rien ne change :** les 4 god-components vont continuer à grossir à chaque nouveau module (la facturation va probablement encore s'enrichir), et sans tests (section suivante), chaque modification dans ces fichiers est un pari.

---

## 6. Performance

Classé par impact réel mesuré :

**Impact CRITIQUE — bundle principal de 6 023 Ko (1,07 Mo gzippé) dans un seul chunk (`index-DK-zhBQu.js`).** C'est mesuré sur un build de production réel effectué pendant cet audit. Malgré un découpage manuel des vendors (`vendor-react`, `vendor-data`, `vendor-ui`) et des imports dynamiques bien pensés pour les libs lourdes ponctuelles (xlsx, pdf-lib, jsPDF — tous correctement chargés en `import()` à la demande), **aucune des 17 pages de routes projet n'est chargée en `React.lazy`** (zéro occurrence de `React.lazy`/`Suspense` dans tout `src`). Résultat : tout le code applicatif de tous les modules (billing + budget + quality + messaging + gantt + plans + dashboard + settings...) est téléchargé et parsé au premier chargement, même pour un utilisateur qui n'ouvrira jamais l'onglet Devis & Facturation. C'est le point de performance le plus impactant du projet et il se corrige sans toucher à l'architecture des données.

**Impact ÉLEVÉ — listage sans pagination généralisé.** Sur 41 services, seuls 4 utilisent `.range()`/`.limit()` ; 34 fichiers font des `select('*')` suivis d'un simple `.eq()/.order()` sans bornage (`quotesService.list`, `invoicesService.list`, `messagingService.listConversations`...). Avec une poignée de lignes en base aujourd'hui ce n'est pas visible ; avec un chantier réel après quelques mois (centaines de tâches, factures, messages), chaque ouverture d'onglet rapatrie l'intégralité de l'historique. `messagingService.listConversations` est particulièrement coûteux : pour chaque conversation, elle fait 2 requêtes Supabase supplémentaires en série dans un `Promise.all` — un projet avec 20 conversations déclenche 40+ requêtes réseau au chargement d'un seul onglet.

**Impact MOYEN — aucune virtualisation de liste.** Pas de `react-window`/`react-virtuoso` dans les dépendances. Le Gantt (SVG, `GanttChart.tsx`, 440 lignes), les listes de tâches, de documents, de messages seront tous rendus intégralement dans le DOM. Avec quelques dizaines d'éléments, négligeable ; avec des centaines (un gros chantier sur 18 mois), le rendu initial et le scroll deviendront perceptiblement lents.

**Impact FAIBLE mais réel — re-renders sur les éditeurs de lignes.** Déjà noté en section 5 (`LineItemsEditor`/`ChecklistItemsEditor` sans memoization) — gênant sur un devis de 200 lignes issu d'un import DPGF, pas gênant sur 5 lignes saisies manuellement.

**Bon point à préserver :** la stratégie de chunking vendor par taux de churn (commentée explicitement dans `vite.config.ts`) et le chargement à la demande de toutes les libs d'export/3D/parsing est une pratique au-dessus de la moyenne — ne pas la défaire en corrigeant le point critique ci-dessus, simplement l'étendre au niveau des routes.

---

## 7. Sécurité

Audit mené avec accès direct aux advisors Supabase du projet (`nonqaratfnjpdogjbzyi`) + lecture du code RLS/services.

**Aucune faille critique (RCE, bypass d'authentification, fuite de données cross-tenant) identifiée.** C'est le point le plus rassurant de cet audit : RLS est activée sur les 49 tables sans exception, les policies des 4 derniers modules livrés sont systématiquement scoping par appartenance projet (`is_project_team_member`), et les fonctions `security definer` sensibles (`decide_quote`, `decide_change_order`, `transfer_project_ownership`) vérifient l'autorisation *avant* d'agir plutôt que de faire confiance à l'appelant. C'est un niveau de rigueur RLS supérieur à ce qu'on voit dans la majorité des projets Supabase early-stage.

**Faille réelle mais de gravité FAIBLE — protection mot de passe compromis désactivée.**
*Pourquoi c'est un problème* : Supabase Auth propose une vérification contre HaveIBeenPwned à l'inscription/changement de mot de passe ; elle est actuellement désactivée (`auth_leaked_password_protection`), donc un utilisateur peut choisir un mot de passe déjà compromis publiquement sans avertissement.
*Gravité* : faible (dépend du comportement utilisateur, pas une faille exploitable directement).
*Correction* : l'activer dans Authentication → Policies sur le dashboard Supabase — 2 minutes, gain réel.

**Faille de gravité FAIBLE — 3 fonctions trigger sans `search_path` figé.**
*Détail* : `assign_quote_number`, `assign_invoice_number`, `create_non_conformity_from_result` n'ont pas de `set search_path = public` explicite, contrairement aux autres fonctions `security definer` du projet qui, elles, le font correctement.
*Pourquoi c'est un problème* : sans `search_path` fixé, une fonction `plpgsql` peut en théorie être trompée par un schéma malveillant placé plus tôt dans le `search_path` de la session (attaque de type « schéma squatting »). Risque réel limité ici car ces fonctions ne sont pas `security definer`, mais c'est une incohérence avec le standard déjà appliqué ailleurs dans le projet.
*Correction* : ajouter `set search_path = public` dans les 3 définitions, comme déjà fait pour `set_quote_organization`/`set_invoice_defaults`.

**Observation de gravité INFORMATIVE — surface d'exécution RPC large pour `anon`.** 18 fonctions `security definer` (les helpers `is_org_member`, `is_project_owner`, etc.) sont exécutables via `/rest/v1/rpc/...` par le rôle `anon` (non authentifié). Elles ne renvoient qu'un booléen et ne fuient aucune donnée métier, mais elles permettent à un acteur non authentifié de sonder l'existence d'un UUID de projet/organisation (oracle booléen). Ce n'est pas exploitable pour extraire des données, mais ce n'est pas non plus une surface volontairement publique — recommandé de `revoke execute ... from anon` sur ces fonctions utilitaires (garder `authenticated`) pour réduire la surface, sans urgence.

**Point fort à souligner — génération Factur-X.** Tous les champs injectés dans le XML CII (`xmlEscape` systématique sur description, nom, adresse, IBAN, notes) sont échappés correctement ; aucune injection XML possible. C'est un point d'attention que beaucoup d'équipes oublient sur la génération de documents dynamiques, et il a été traité correctement.

**Point fort — gestion des secrets.** `.env` et `.env.*.local` sont dans `.gitignore`, aucune clé en dur trouvée dans le code applicatif (`grep` sur le repo n'a fait ressortir aucun secret commité). La clé `service_role` n'apparaît dans aucun fichier `src/`.

**Point d'attention DEVOPS/SÉCURITÉ transverse — aucun dépôt git distant configuré (`git remote -v` vide).** Ce n'est pas une faille applicative mais c'est un risque de sécurité opérationnelle majeur : le code source de production n'existe qu'en un seul exemplaire local. Le projet a d'ailleurs déjà perdu son historique git une fois (incident déjà documenté en mémoire de session, `.git` pointait vers un répertoire éphémère, réinitialisé le 2026-06-25). Sans remote (GitHub/GitLab privé), un second incident similaire = perte totale et définitive du code et de son historique. **C'est, après le bundle de 6 Mo, le risque le plus urgent à corriger dans ce rapport — et il se corrige en 10 minutes.**

---

## 8. Base de données

**Modèle de données : cohérent et normalisé correctement** — chaque module (quotes/quote_items, invoices/invoice_items/invoice_payments, quality_templates/quality_template_items/quality_inspections/quality_inspection_results/non_conformities, conversations/conversation_participants/messages) suit un schéma relationnel classique en 3NF, avec des clés étrangères `on delete cascade`/`on delete set null` posées de façon réfléchie selon la sémantique métier (ex. : supprimer un devis supprime ses lignes, mais supprimer un client laisse les devis existants avec `client_id = null` plutôt que de les supprimer).

**Bons réflexes déjà présents :**
- Numérotation séquentielle sans trou pour les factures via verrou consultatif (`pg_advisory_xact_lock`) — c'est la bonne façon de gérer une contrainte légale de continuité en environnement concurrent, plutôt qu'une séquence Postgres classique qui peut laisser des trous en cas de rollback.
- Triggers de recalcul (`recompute_invoice_payment_status`, `touch_conversation_last_message`) plutôt que recalcul côté client — évite la dérive entre ce que l'UI affiche et l'état réel en base.
- Index posés sur les clés étrangères et colonnes de tri fréquentes (`idx_quotes_project`, `idx_messages_conversation`...) de façon quasi systématique dans les migrations récentes.

**Risques futurs identifiés :**
- **49 tables, toutes dans le schéma `public`.** Pas de séparation en schémas logiques (`billing`, `quality`, `messaging`). À ce stade ce n'est qu'une question de lisibilité ; au-delà de 70-80 tables ça devient une vraie gêne pour auditer les permissions par domaine.
- **Pas de table d'audit/historisation générique au-delà de `activity_logs`.** Pour un outil destiné au BTP (litiges, preuves contractuelles d'acceptation de devis/avenants), l'absence de mécanisme d'historisation des modifications (qui a changé quoi, quand, sur les champs sensibles d'un devis/facture) est un manque pour la valeur juridique des documents — `activity_logs` log des actions macro (« quote.created ») mais pas un diff des champs.
- **26 migrations sans tests automatisés (`supabase test db` est scripté mais aucun fichier de test SQL trouvé dans le repo)** — chaque nouvelle migration repose sur la relecture manuelle plutôt que sur une suite de tests de régression sur les policies RLS. Pour un schéma à 49 tables et croissant, c'est un pari de plus en plus risqué à chaque migration.

**Améliorations proposées :**
1. Ajouter une table `field_change_history` générique (ou des triggers `audit.log_change()`) sur les tables à valeur contractuelle (quotes, invoices, change_orders, selections) pour tracer chaque modification de champ avec horodatage et auteur.
2. Écrire de vrais tests pgTAP (le script `test:db` existe déjà, il manque le contenu) couvrant au minimum : un utilisateur hors-projet ne peut rien lire/écrire, un client ne voit jamais un devis brouillon, un membre direct uniquement voit sa conversation directe.
3. Revoir périodiquement les advisors performance (non auditables intégralement dans cette passe pour des raisons de volume de sortie) — en particulier les index inutilisés qui s'accumulent à chaque itération de schéma.

---

## 9. API

BuildFlow n'a pas d'API REST/GraphQL maison — toute l'interaction passe par le client Supabase (PostgREST auto-généré + RPC). C'est un choix d'architecture pertinent pour la taille actuelle du projet (évite de maintenir une couche API dupliquée), mais il a des implications à connaître :

**Cohérence et validation.** La validation des entrées repose presque entièrement sur les contraintes SQL (`check (status in (...))`, `not null`) — il n'y a pas de couche de validation applicative (type Zod) avant l'envoi à Supabase. Concrètement, dans `dpgfImportModal.tsx`, si l'utilisateur soumet un titre vide, c'est le bouton `disabled` côté UI qui protège, pas une validation de schéma — un appel direct à `quotesService.create` (depuis un futur script, une future intégration, ou un bug front) contournerait cette protection et ne serait rattrapé que par la contrainte `not null` SQL avec un message d'erreur Postgres brut renvoyé à l'utilisateur (cf. section 3).

**Gestion d'erreurs.** Le pattern `unwrap()` (centralisant `if (error) throw error`) est cohérent et bien généralisé — bon point. Mais il n'y a pas de typage des erreurs métier (pas de classe `BuildFlowError` avec code/contexte) : tout remonte comme une `PostgrestError` générique, ce qui complique l'affichage d'un message différencié selon le cas (RLS refusé ≠ contrainte violée ≠ réseau indisponible).

**Pagination/évolutivité** : déjà traité en détail section 6 — c'est le point faible principal de cette couche.

**Recommandation concrète :** introduire Zod (ou équivalent léger) sur les payloads des formulaires les plus sensibles (devis, factures, paiements) en amont de l'appel service, avec des schémas partagés entre la validation du formulaire et celle de l'input du service — ça évite la duplication de règles et sécurise la couche au-delà du seul `disabled` du bouton.

---

## 10. Accessibilité

**Verdict : insuffisant, et en régression sur les modules récents.** La tâche #62 (« aria-label sur boutons icône-seule ») a été traitée à un instant donné, mais aucune discipline systématique n'a suivi : sur les 4 derniers modules livrés (Devis/Facturation, Qualité, Messagerie, DPGF), zéro `aria-label` n'a été ajouté sur les boutons icône-seule (le bouton suppression de ligne dans `LineItemsEditor`, par exemple, n'a qu'une icône `Trash2` sans label accessible).

**Points précis vérifiés :**
- Navigation clavier : aucun piège à tabulation détecté dans les modales (`Modal.tsx` n'a pas été audité ligne à ligne dans cette passe, mais son usage généralisé suggère qu'un audit focus-trap dédié serait nécessaire avant tout test avec un utilisateur de lecteur d'écran).
- Contraste : la palette bleu/violet sur fond blanc (`BRAND_COLOR = [37, 99, 235]`) est probablement conforme AA pour le texte sur fond — non vérifié par calcul de ratio dans cette passe, à confirmer avec un outil dédié (axe DevTools).
- Labels de formulaire : les composants `Input`/`Select` du design system acceptent une prop `label` (vu dans `DpgfImportModal.tsx` : `<Input label="Titre du devis" .../>`) — c'est une bonne base structurelle, à condition que `label` génère bien un `<label htmlFor>` lié à l'input dans le composant partagé (non vérifié ici, à contrôler dans `src/components/ui/Input.tsx`).

**Recommandation priorisée :** avant d'ajouter de nouvelles fonctionnalités, faire une passe unique « accessibilité socle » sur les composants partagés (`Button`, `Modal`, `Input`, table générique) plutôt que de corriger module par module — un correctif sur `Button` (variante icône-seule exigeant une prop `aria-label` obligatoire en TypeScript) corrigerait par ricochet tous les modules actuels et futurs sans repasser dessus un par un.

---

## 11. Responsive

**Donnée mesurée : 30 utilisations totales de breakpoints Tailwind (`sm:`/`md:`/`lg:`/`xl:`) dans l'ensemble du code applicatif** (13 `lg:`, 8 `sm:`, 8 `md:`, 1 `xl:`, 0 `2xl:`) sur 77 composants `.tsx`. C'est extrêmement peu pour une application avec un Gantt, des tableaux de lignes de devis à 7 colonnes, un viewer 3D IFC et une sidebar de navigation — tous ces éléments ont une forte probabilité de casser ou de devenir inutilisables sous 768px de large sans adaptation spécifique.

**Éléments qui vont probablement casser sur mobile/tablette, par construction :**
- Le tableau `LineItemsEditor` (8 colonnes fixes en largeur `w-24`/`w-20`/`w-28`) — sur un écran de téléphone, ce tableau va nécessiter un scroll horizontal permanent, ce qui est géré (`overflow-x-auto`) mais reste une expérience de saisie pénible pour un chef de chantier sur le terrain — exactement le profil d'utilisateur le plus susceptible d'être sur mobile.
- Le Gantt SVG (`GanttChart.tsx`) — les diagrammes de Gantt sont structurellement inadaptés au mobile sans une vue alternative dédiée (liste chronologique), qui n'existe pas ici.
- Le viewer IFC 3D (`IfcViewer.tsx`) — Three.js/WebGL sur mobile pose des questions de performance GPU/mémoire qui n'ont visiblement pas été testées (aucune mention de fallback ou de détection de capacité dans le code lu).

**Sur le fond : ce n'est probablement pas un problème prioritaire si l'usage réel est majoritairement desktop/tablette de chantier (type robuste type Panasonic Toughbook) plutôt que smartphone** — mais c'est une hypothèse non validée par aucune donnée utilisateur dans ce repo. Le portail client en particulier (consulté par le client final, potentiellement depuis un smartphone personnel) est le point d'entrée le plus susceptible d'être utilisé sur mobile, et c'est aussi un module qui n'a (à ce stade de l'audit) reçu aucune attention responsive spécifique documentée.

**Recommandation :** avant d'investir dans le responsive généralisé, trancher explicitement le persona cible par module (terrain = tablette/robuste, portail client = mobile probable, back-office = desktop) et n'investir le responsive que là où l'hypothèse d'usage mobile est forte — typiquement le portail client en priorité.

---

## 12. DevOps

**C'est, avec le bundle de 6 Mo et l'absence de remote git, le point le plus faible de l'ensemble de l'audit.**

- **Aucun pipeline CI/CD** : pas de dossier `.github/workflows`, aucun fichier YAML de CI trouvé dans le repo. `tsc`/`eslint`/`vite build` sont exécutés manuellement à chaque module (et l'historique de cette conversation montre que c'est fait avec sérieux et discipline) — mais c'est un processus humain, pas automatisé. Le jour où ce process n'est pas suivi à la lettre (oubli, urgence, nouveau contributeur), rien ne bloque un commit cassé.
- **Aucun déploiement automatisé documenté** : pas de configuration Vercel/Netlify/Docker visible dans le repo — on ne sait pas, à la lecture du code seul, comment l'application arrive en production aujourd'hui.
- **Aucune observabilité applicative** : pas de Sentry (ni équivalent) pour capturer les erreurs runtime des utilisateurs réels. L'`ErrorBoundary` global (#56) attrape les crashs React côté client, mais rien ne les transmet à l'équipe — un crash en production chez un utilisateur est invisible jusqu'à ce qu'il le signale lui-même.
- **Aucune stratégie de sauvegarde documentée au-delà des backups automatiques Supabase** (qui existent par défaut côté plateforme, mais leur fréquence/rétention selon le plan tarifaire n'a pas été vérifiée dans cet audit).
- **Logs** : aucune stratégie de logs applicatifs structurés (le `activity_logs` métier existant est fonctionnel mais n'est pas un système de logs technique pour le debugging).

**Plan minimal pour sortir de la zone à risque (par ordre de coût croissant) :**
1. `git remote add origin ...` + push immédiat (10 minutes, élimine le risque de perte totale).
2. GitHub Actions basique : `tsc --noEmit` + `eslint` + `vite build` sur chaque push (1-2h, élimine le risque de régression silencieuse).
3. Intégrer Sentry côté front (compte gratuit suffisant au stade actuel) pour la visibilité sur les crashs réels (1h).
4. Documenter le processus de déploiement actuel, quel qu'il soit, dans un `DEPLOY.md` (30 min) — ne serait-ce que pour qu'il survive à la mémoire d'une seule personne.

---

## 13. Dette technique

| Élément | Gravité | Impact | Coût de correction estimé | Priorité |
|---|---|---|---|---|
| Pas de dépôt git distant | Critique | Perte totale possible du code (déjà arrivé une fois) | 10 min | Immédiate |
| Bundle principal 6 Mo / pas de `React.lazy` sur les routes | Élevée | Temps de chargement initial pénalisant, surtout mobile/3G chantier | 2-4h | Immédiate |
| 0 test automatisé frontend | Élevée | Toute régression n'est détectée qu'à l'usage | Plusieurs jours (mise en place + couverture critique) | Haute |
| 0 CI/CD | Élevée | Aucun filet de sécurité avant déploiement | 1-2h | Haute |
| Listing sans pagination (34/41 services) | Moyenne | Dégradation progressive et invisible à mesure que les données grossissent | 1-2 jours | Haute |
| God components (Plans/Invoices/Budget/Quotes > 450 lignes) | Moyenne | Coût croissant de chaque modification future | 1 jour par composant | Moyenne |
| Duplication LineItemsEditor/ChecklistItemsEditor | Faible-Moyenne | Incohérences UX futures, double maintenance | 0,5 jour | Moyenne |
| Pas de Zod/validation applicative en amont des services | Moyenne | Messages d'erreur Postgres bruts exposés, robustesse fragile | 1-2 jours | Moyenne |
| Aucune observabilité erreurs prod (Sentry) | Moyenne | Bugs en prod invisibles jusqu'à signalement utilisateur | 1h | Moyenne |
| 3 fonctions trigger sans `search_path` fixé | Faible | Incohérence avec le reste du projet, risque théorique faible | 15 min | Basse |
| Protection mot de passe compromis désactivée | Faible | Mots de passe faibles non avertis à l'inscription | 2 min | Basse |
| 18 fonctions RPC utilitaires exécutables par `anon` | Informative | Oracle booléen, pas de fuite de données | 30 min | Basse |
| Responsive quasi absent (30 breakpoints sur tout le repo) | Moyenne (si usage mobile réel) | Expérience dégradée sur tablette/mobile chantier | Variable selon périmètre | À trancher (dépend du persona réel) |
| Cycles ajout/suppression de fonctionnalités (Sélections, Avenants, Phases) | Faible | Résidus de schéma/code mort potentiels, coût cognitif | 0,5 jour de nettoyage | Basse |

---

## 14. Scalabilité

**100 utilisateurs.** Aucun problème. Le bundle de 6 Mo gêne un peu le ressenti de chaque chargement de page mais reste tolérable sur connexion correcte. Les `select('*')` sans pagination ne pèsent rien à ce volume de données.

**1 000 utilisateurs.** Premier point de friction réel : les services sans pagination commencent à ramener des listes de centaines d'éléments par projet actif (factures, messages, tâches accumulées sur plusieurs mois de chantier). Le pattern `messagingService.listConversations` avec ses requêtes en cascade par conversation devient visiblement lent. Le bundle de 6 Mo devient un problème UX net sur connexion 4G de chantier.

**10 000 utilisateurs.** Le manque de virtualisation de listes devient un problème de rendu navigateur concret (gantt et listes de tâches à plusieurs centaines d'items par projet). Sans CI/CD ni tests, le rythme de déploiement de correctifs/fonctionnalités va nécessairement ralentir (peur de casser quelque chose en prod, vérifications manuelles de plus en plus longues). C'est aussi le seuil où l'absence d'observabilité (Sentry) devient intenable : à ce volume d'utilisateurs, des bugs en production existent forcément en permanence sans que l'équipe le sache.

**100 000 utilisateurs.** Le schéma 100% `public` sur Postgres mono-instance Supabase devient un sujet : selon le plan Supabase, des questions de connexions concurrentes (pooling PgBouncer), de taille de instance Postgres, et de coût deviennent structurantes. Les triggers de recalcul (`recompute_invoice_payment_status`) qui font un `update` complet à chaque mouvement de paiement commencent à avoir un coût mesurable en write amplification. C'est aussi le stade où l'absence de séparation en domaines/schémas logiques (section 4) commence à coûter réellement en gouvernance.

**1 million d'utilisateurs.** Hors de portée de l'architecture actuelle telle quelle (mono-base Postgres partagée multi-tenant via RLS) sans un travail de sharding/partitionnement par organisation, une stratégie de cache applicatif (Redis) en avant de Postgres pour les lectures fréquentes, et probablement une décomposition en services dédiés pour les modules à charge spécifique (génération PDF/Factur-X, traitement IFC). À ce stade ce n'est plus un sujet de « dette technique » mais un sujet de refonte d'infrastructure — non urgent aujourd'hui, mais bon à savoir : l'architecture actuelle a un plafond, ce n'est pas un problème, c'est juste un fait à anticiper.

**Premier vrai point de rupture concret, à un seuil bien plus bas que 1M : le bundle de 6 Mo et l'absence de pagination/CI/CD vont créer une dégradation perceptible d'expérience et de vélocité bien avant tout sujet d'infrastructure Postgres.**

---

## 15. Vision long terme (si j'étais CTO du projet)

**Ce que je garderais sans hésiter :** la discipline architecturale UI→Hooks→Services→Supabase, la rigueur RLS quasi sans faille sur 49 tables, la pratique de dynamic import() pour les libs lourdes, le choix React Query + Zustand (juste dosage entre état serveur et état UI), et les commentaires SQL/TS expliquant le *pourquoi* des décisions — c'est rare et précieux pour la maintenabilité future.

**Ce que je refondrais complètement :** la stratégie produit. Je stopperais l'ajout de nouveaux modules immédiatement et je passerais le mois suivant à instrumenter (télémétrie d'usage), tester avec 2-3 chantiers pilotes réels, et couper sans pitié les modules qui ne sont pas utilisés après 30 jours d'usage réel. 31 modules sans aucune donnée d'usage est le signal le plus inquiétant de tout cet audit, plus inquiétant que n'importe quel bug technique.

**Fonctionnalités que je supprimerais ou geler en l'état :** rien à supprimer techniquement (le code est propre), mais je gèlerais l'extension fonctionnelle de modules à faible probabilité d'usage quotidien avant validation (Import DPGF, Messagerie interne — concurrencée nativement par WhatsApp/Teams dans la réalité des chantiers français) tant qu'aucune donnée d'usage ne confirme leur valeur.

**Ce que j'ajouterais en priorité absolue :** télémétrie produit (même minimale), CI/CD, remote git, et un programme de 3 chantiers pilotes réels avec retours hebdomadaires structurés.

**Choix techniques que je changerais :** rien de structurant — le choix Supabase/React/Tailwind est pertinent pour ce stade. Le seul vrai changement technique que j'engagerais est l'introduction de `React.lazy` au niveau des routes (correction, pas refonte) et l'ajout d'une couche de validation Zod (ajout, pas refonte).

---

## 16. Tableau de priorisation

| # | Problème | Gravité /10 | Impact utilisateur | Impact business | Difficulté correction | Priorité |
|---|---|---|---|---|---|---|
| 1 | Aucun dépôt git distant (risque de perte totale du code) | 9 | Nul (invisible côté utilisateur) | Catastrophique en cas d'incident | Très faible (10 min) | P0 |
| 2 | Bundle principal 6 Mo, pas de code-splitting routes | 8 | Élevé (chargement lent) | Élevé (taux de rebond, perception de qualité) | Faible (2-4h) | P0 |
| 3 | Aucun pipeline CI/CD | 7 | Indirect (régressions qui passent en prod) | Élevé (vélocité, confiance) | Faible (1-2h) | P0 |
| 4 | Zéro test automatisé frontend | 7 | Indirect | Élevé à moyen terme | Élevée (jours) | P1 |
| 5 | Aucune télémétrie produit / observabilité erreurs | 7 | Nul direct | Critique pour la décision produit | Faible (1-2h pour Sentry, plus pour analytics) | P1 |
| 6 | Listing sans pagination (34/41 services) | 6 | Moyen à élevé selon volume de données | Moyen | Moyenne (1-2j) | P1 |
| 7 | 31 modules sans validation produit/usage réel | 6 | Confusion, surcharge cognitive | Très élevé (risque de construire le mauvais produit) | Élevée (organisationnelle, pas technique) | P1 |
| 8 | Pas de validation applicative (Zod) avant services | 5 | Moyen (messages d'erreur bruts) | Moyen | Moyenne (1-2j) | P2 |
| 9 | God components (4 fichiers > 450 lignes) | 5 | Indirect | Moyen (vélocité future) | Moyenne (1j/fichier) | P2 |
| 10 | Accessibilité très partielle sur modules récents | 5 | Élevé pour les utilisateurs concernés, nul pour les autres | Moyen (risque légal RGAA selon contexte) | Moyenne | P2 |
| 11 | Responsive quasi absent | 5 | Élevé si usage mobile réel, nul sinon | Dépend du persona réel | Élevée si généralisé | P2 |
| 12 | Duplication LineItemsEditor/ChecklistItemsEditor | 4 | Faible direct | Faible | Faible (0,5j) | P3 |
| 13 | 3 fonctions sans search_path fixé | 3 | Nul | Faible | Très faible (15 min) | P3 |
| 14 | Protection mot de passe compromis désactivée | 3 | Faible | Faible | Très faible (2 min) | P3 |
| 15 | 18 RPC utilitaires exécutables par anon | 2 | Nul | Faible | Faible (30 min) | P3 |
| 16 | Pas de monétisation (Stripe absent) | Variable | Nul direct | Bloquant si objectif = vendre BuildFlow | Élevée | Dépend de la stratégie |

---

## 17. Roadmap

**Quick Wins (< 2h) :**
- Ajouter un remote git et pousser le dépôt (10 min).
- Activer la protection mot de passe compromis sur Supabase Auth (2 min).
- Fixer `search_path` sur les 3 fonctions trigger restantes (15 min).
- `revoke execute` sur les fonctions RPC utilitaires pour le rôle `anon` (30 min).
- Intégrer Sentry côté frontend (1h).
- Mettre en place un pipeline CI minimal (tsc + eslint + build) via GitHub Actions (1-2h).

**Améliorations (< 1 jour) :**
- Convertir les 17 pages de routes projet en `React.lazy`/`Suspense` (réduction majeure du bundle initial).
- Ajouter `.range()`/pagination sur les 5-6 services les plus consultés (quotes, invoices, messages, tasks, documents).
- Créer `<EmptyState>` et `<ErrorMessage>` partagés et les rebrancher sur les modules récents.
- Nettoyer les résidus de code/schéma issus des cycles ajout-suppression (Sélections, Phases).

**Améliorations (< 1 semaine) :**
- Refactorer les 4 god-components (PlansTab, InvoicesPanel, BudgetTab, QuotesPanel) en sous-composants.
- Unifier `LineItemsEditor`/`ChecklistItemsEditor` en un composant générique.
- Introduire Zod sur les formulaires sensibles (devis, factures, paiements).
- Passe d'accessibilité socle sur les composants UI partagés (Button, Modal, Input, tables).
- Mettre en place pgTAP sur les policies RLS critiques (multi-tenant, statuts de documents légaux).

**Gros chantiers (> 1 semaine) :**
- Programme de validation produit avec 2-3 chantiers pilotes réels + télémétrie d'usage pour décider quels modules approfondir/geler.
- Réorganisation du code en domaines métier (`src/domains/*`) plutôt que `src/modules/*` plat.
- Stratégie responsive ciblée (portail client en priorité) si l'hypothèse d'usage mobile est confirmée.
- Table d'historisation des modifications sur les documents à valeur contractuelle.
- Réflexion monétisation (Stripe/Paddle) si l'objectif est bien de commercialiser BuildFlow en SaaS payant.

---

## 18. Remise en question

**La messagerie interne mérite d'être challengée frontalement.** Sur un chantier BTP français, la réalité du terrain est que les équipes communiquent par WhatsApp, SMS ou appel — pas par une messagerie intégrée à un ERP qu'elles n'ouvrent qu'occasionnellement. Construire une messagerie maison est un pari risqué sans données d'adoption : elle a un coût de maintenance permanent (RLS, realtime, UI) pour un usage qui pourrait rester proche de zéro si les utilisateurs continuent leurs habitudes existantes. Avant d'investir davantage dans ce module, il faudrait des données d'usage réelles, pas une hypothèse.

**Le viewer 3D IFC est un chantier techniquement impressionnant dont la rentabilité produit est incertaine.** Intégrer un viewer BIM/IFC complet est un effort d'ingénierie significatif (three.js, web-ifc, gestion de fragments) pour une fonctionnalité que tous les concurrents directs (Vertuoza, Obat) n'ont pas nécessairement, ce qui peut être une différenciation... ou un signe que ce n'est pas une priorité du marché cible (PME du BTP, pas des cabinets d'architecture BIM-natifs). À valider avec de vrais utilisateurs avant d'investir plus dans ce module (export, collaboration multi-utilisateur sur le viewer, etc.).

**L'import DPGF intégré aux devis est, lui, un bon choix d'architecture** (réutilisation du modèle quote_items plutôt qu'un module séparé) — mais sa valeur réelle dépend entièrement de la diversité des formats DPGF réels du marché, qui sont notoirement hétérogènes. La détection de colonnes par mots-clés normalisés est une approche raisonnable pour un MVP, mais elle va probablement échouer sur une part non négligeable de fichiers réels (DPGF avec en-têtes fusionnés, sur plusieurs lignes, ou en anglais pour des donneurs d'ordre internationaux) — à tester avec un corpus réel de fichiers clients avant de considérer ce module comme fiable.

**Le portail client en widgets configurables (#103) est une fonctionnalité dont la complexité d'implémentation (configurabilité) mérite d'être questionnée** : la configurabilité a un coût de développement et de test représentant souvent plus que sa valeur perçue pour un client final qui veut surtout voir l'avancement et payer ses factures — un portail simple et fixe bien pensé vaut probablement mieux qu'un portail configurable mal exploité parce que personne ne prend le temps de le configurer.

**Sur l'architecture : `src/modules` plat à 31 dossiers n'est pas sur-dimensionné techniquement (chaque module reste simple individuellement) mais il est sous-dimensionné organisationnellement** — c'est une architecture qui suppose implicitement un seul développeur qui garde tout en tête. Elle ne scale pas à une équipe de 3+ développeurs sans la réorganisation en domaines proposée section 4.

---

## 19. Scores

| Critère | Note /10 | Justification courte |
|---|---|---|
| Produit | 5 | Proposition de valeur cohérente mais non validée ; trop de surface fonctionnelle sans données d'usage |
| UX | 5 | Logique de base saine, mais navigation plate à 17 entrées et incohérences entre modules |
| UI | 6 | Design system réel et cohérent, mais lacunes systématiques (états vides, erreurs brutes, a11y) |
| Architecture | 7 | Séparation des couches exemplaire ; découpage en modules à plat qui ne scale pas à une équipe |
| Qualité du code | 7 | Conventions et documentation au-dessus de la moyenne ; quelques god-components et duplications ciblées |
| Performance | 4 | Bundle 6 Mo et absence de pagination sont des problèmes concrets et mesurés, pas hypothétiques |
| Sécurité | 8 | RLS quasi sans faille, pas de vulnérabilité critique trouvée ; uniquement des points mineurs |
| Maintenabilité | 6 | Bonne base de code, mais 0 test automatisé fragilise toute évolution future |
| Scalabilité | 5 | Tient sans souci jusqu'à ~1000 utilisateurs, frictions concrètes ensuite, plafond architectural identifiable |
| Accessibilité | 3 | Effort ponctuel non généralisé, régression sur les modules récents |
| Robustesse | 5 | Pas de filet (tests, CI, observabilité) malgré un code de bonne qualité intrinsèque |
| Expérience développeur | 6 | Documentation/commentaires de qualité, mais absence de CI/tests rend chaque changement plus risqué qu'il ne devrait |

**Note globale : 5,7/10.** Le socle technique (architecture, sécurité, qualité de code) est nettement au-dessus de ce qu'on voit habituellement à ce stade d'un projet ; ce qui retient la note, ce sont des manques opérationnels simples à corriger (git remote, CI, bundle) et une question produit non résolue (validation réelle de la valeur des 31 modules) qui, elle, demande du temps et des utilisateurs réels plutôt qu'une correction de code.

---

## 20. Conclusion — plan d'action des 30 prochains jours si je reprenais le projet en tant que CTO

**Semaine 1 — éliminer les risques d'incident (rien de nouveau, que de la sécurisation) :**
1. Jour 1 : remote git + push, activation protection mot de passe Supabase, fix search_path sur les 3 fonctions, revoke execute anon sur les RPC utilitaires.
2. Jour 1-2 : pipeline CI minimal (tsc + eslint + build) sur chaque push/PR.
3. Jour 2 : intégration Sentry côté frontend.
4. Jour 3-5 : `React.lazy` sur les 17 routes projet + mesure du gain réel sur le bundle (objectif : faire passer le chunk principal sous 1 Mo non gzippé).

**Semaine 2 — fiabiliser ce qui existe avant d'ajouter quoi que ce soit :**
5. Pagination sur les 5-6 services les plus consultés.
6. pgTAP sur les policies RLS critiques (multi-tenant, statuts légaux des devis/factures).
7. Couverture de tests minimale sur les chemins métier les plus sensibles (création/conversion devis→facture, décision client, transfert de propriété).

**Semaine 3 — arrêter de construire à l'aveugle :**
8. Instrumentation télémétrie produit minimale (même un simple événement par action clé suffit pour démarrer).
9. Recrutement de 2-3 chantiers pilotes réels avec point hebdomadaire structuré.
10. Geler explicitement (communiquer, pas juste s'abstenir) toute nouvelle fonctionnalité tant que ces retours n'arrivent pas.

**Semaine 4 — dette ciblée à fort ratio valeur/effort :**
11. Refactor des 4 god-components.
12. Unification LineItemsEditor/ChecklistItemsEditor.
13. Passe accessibilité socle sur les composants UI partagés.
14. Bilan des 30 jours avec les premiers retours pilotes : décider, avec des données, quels modules approfondir, lesquels geler, et si la réorganisation en domaines métier (section 4) doit être engagée avant ou après l'arrivée d'un deuxième développeur.

Le fil conducteur de ces 30 jours n'est pas technique — c'est de transformer un projet construit en mode « tout faire soi-même, vite, et bien sur le plan du code » en un projet piloté par des retours réels, avec les garde-fous opérationnels (git, CI, observabilité) qui devraient exister depuis le premier jour mais dont l'absence n'a, par chance, pas encore coûté cher.
