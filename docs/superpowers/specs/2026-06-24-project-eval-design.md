Title: Projet — Évaluation approfondie
Date: 2026-06-24
Author: OpenCode (automated spec for evaluation)

But: Ce document est la spec de la mission "Evaluation approfondie du projet". Il décrit le périmètre, la méthode, les livrables et les commandes que j'exécuterai pour produire le rapport demandé.

Objectif
- Fournir une évaluation technique approfondie du dépôt "Emploi Agences" (Next.js App Router) couvrant :
  - architecture et structure du projet
  - qualité du code et lisibilité
  - tests (unitaires et e2e) et résultats d'exécution
  - CI/CD, déploiement et configuration (Vercel)
  - dépendances, sécurité et gestion des secrets
  - performances et points d'amélioration

Méthodologie
1. Exploration initiale
   - Lire README, package.json, scripts, schéma Prisma, routes API et tests existants.
2. Automatisation contrôlée
   - Ajouter ce fichier de spec au dépôt et committer (non intrusif).
   - Installer les dépendances localement (`npm install`) afin d'exécuter les tests.
3. Exécution des tests
   - Lancer `npm run test:unit` (Vitest) et capturer la sortie.
   - Lancer `npm run test:e2e` (Playwright) si configuré; noter les erreurs d'environnement si présents.
4. Audit manuel rapide
   - Parcourir modules critiques : `app/api/_lib`, Prisma schema, auth/cron, envoi d'emails.
   - Rechercher vulnérabilités évidentes : secrets en clair, usage dangereux de eval/fetch, validations manquantes.
5. Rapport et recommandations
   - Synthétiser constats, risques, et 8–12 actions priorisées (sécurité, test, infra, code).

Périmètre exclu
- Refactorings lourds ou changements d'API qui exigent approbation préalable.

Livrables
- Rapport d'évaluation complet (fournis dans la conversation) comprenant :
  - Résumé exécutif (3–6 lignes)
  - Détails par domaine (architecture, code, tests, CI, sécurité, perf)
  - Commandes exécutées et sorties (tests)
  - Liste d'actions prioritaires classées par impact et effort
- Spec commitée à `docs/superpowers/specs/2026-06-24-project-eval-design.md` (ce fichier)

Commandes exécutées (prévisibles)
- npm install --no-audit --no-fund
- npm run test:unit
- npm run test:e2e (optionnel)

Sécurité et confidentialité
- Ne committer que ce fichier et aucune donnée sensible.
- Ne pas ajouter de secrets au dépôt. Si des secrets sont trouvés, je les signale dans le rapport mais ne les committerai pas.

Critères de succès
- Rapport livré et spec commitée.
- Résultats des tests unitaires inclus dans le rapport (passés ou échoués) avec sortie brute et analyse.

Prochaine étape
- Je vais committer cette spec puis exécuter les tests unitaires et e2e (si possible). Les résultats et le rapport détaillé suivent.
