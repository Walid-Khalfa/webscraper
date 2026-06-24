# Rapport d'évaluation — 2026-06-24

Projet: Emploi Agences (Next.js App Router)

Résumé exécutif
- Évaluation approfondie réalisée : spec ajoutée et committée, dépendances installées, tests unitaires et e2e exécutés. Le projet est bien structuré pour sa taille ; les tests passent localement (unit + e2e). Quelques risques et améliorations prioritaires identifiés autour de la gestion des secrets, durcissement du cron endpoint et CI reproducible.

Actions réalisées (commandes)
- `npm install --no-audit --no-fund` (postinstall a exécuté `prisma generate`)
- `npm run test:unit` (Vitest)
- `npx playwright test --reporter=list` (Playwright e2e)
- Spec committée : `docs/superpowers/specs/2026-06-24-project-eval-design.md`

Sorties importantes (extraits)
- Vitest (unitaires):

  RUN  v4.1.9 C:/Users/wkhal/Desktop/WebScraper

  Test Files  7 passed (7)
       Tests  24 passed (24)
    Duration  585ms

- Playwright (e2e):

  Running 1 test using 1 worker

  ok 1 tests\e2e\home.spec.ts:3:1 › topbar navigation and mocked search flow work (4.8s)

  1 passed (15.3s)

Observations techniques (architecture & code)
- Structure claire : séparation `app/api/_lib/*` (BA integration, email, validation, rate-limit), composants réutilisables sous `components/`, pages dans `app/`.
- Bonne pratique : usage de timeouts et d'abort controller dans `app/api/_lib/ba.js` pour appels externes, cache mémoire pour réponses BA, tentative de refresh du token OAuth si 401.
- Normalisation robuste des données (`normalizeJob`, `flatten`, `valueAt`) — code lisible et testé.
- Prisma présent (`prisma/schema.prisma`) avec client généré au postinstall.

Tests
- Couverture actuelle : les tests unitaires (24) passent. Un petit jeu e2e existe et passe (1 test). Recommandation : augmenter la couverture e2e sur flows critiques (cron digest, agency API key flows, CSV export). Ajouter tests d'intégration pour le scheduler et envoi d'email (mock Resend).

Sécurité — points notables
- Fichiers et variables : `.env` existe localement; `.env.example` expose noms de variables utiles (`CRON_SECRET`, `BA_CLIENT_SECRET`, `RESEND_API_KEY`). Assurez-vous que aucune valeur sensible n'est committée.
- Endpoints sensibles : routes qui lisent `process.env.CRON_SECRET` et `process.env.ADMIN_SECRET` (`app/api/cron/agents/route.js`, `app/api/admin/agencies/rename/route.js`). Vérifier que en production ces secrets sont obligatoires et que la route échoue proprement si absent.
- Secrets par défaut : `app/api/_lib/email.js` retourne une valeur par défaut `dev-email-link-secret` si `RESEND_API_KEY` et `EMAIL_LINK_SECRET` manquent — bon pour dev mais il ne faut pas que ce comportement déborde en production.
- Recommandations immédiates sécurité :
  1. Refuser l'exécution des endpoints sensibles en production si les secrets requis ne sont définis (throw 500/401 explicite). Documenter la procédure d'installation.
  2. Ajouter un scan de secrets en CI (e.g. `git-secrets`, `truffleHog`) et exécuter localement un audit historique si problème.
  3. Ne pas committer build artefacts ou dossiers générés (`.next/`) — vérifier `.gitignore`.

Infra / CI / Déploiement
- Déploiement ciblé : Vercel (présence de `vercel.json` et docs). `vercel.json` configure crons calling `/api/cron/agents`.
- Dev warning observed during Playwright run: Next dev server logs a Cross origin dev warning recommending `allowedDevOrigins` in `next.config` — consider adding when developing/testing cross-origin flows.
- Recommandations CI / infra :
  1. Add GitHub Actions workflow to run `npm ci`, `npm run test:unit`, and `npx playwright test` (headless) on push/PR. Fail on test failures.
  2. Add `npm audit`/dependabot or automated dependency updates pipeline for security.
  3. For Vercel cron, ensure `CRON_SECRET` configured in Vercel env and verify calls by expecting `Authorization: Bearer <CRON_SECRET>`.

Performances
- Caching present for BA search results (in-memory Map with TTL) — ok for single-instance but ephemeral. For scale, recommend shared cache (Redis) or apply request-rate limits / backoff to protect upstream.
- BA API timeout value (12s default) seems reasonable; document rate limits and implement exponential backoff for repeated 5xx from BA.

Priority action list (ordered)
1. Secrets and prod-hardening (high impact, low effort): require `CRON_SECRET`/`ADMIN_SECRET`/`RESEND_API_KEY` in production, remove dev fallbacks in prod, configure Vercel env. Add secret-scan in CI. (Files: `app/api/cron/agents/route.js`, `app/api/_lib/email.js`)
2. CI pipeline (high impact, medium effort): add GH Actions to run unit + e2e tests and lint on PRs. (Add workflow in `.github/workflows/ci.yml`)
3. Increase e2e coverage (medium impact, medium effort): add flows for CSV export, subscription creation, and cron digest send.
4. Deploy-time cache / scale (medium impact): replace in-memory cache with Redis or similar for scheduler at scale.
5. Logging & observability (medium): add structured logging for cron runs and email deliveries (success/failure counts).

Next steps proposés (je peux appliquer si vous validez)
1. Je génère et propose un fichier `/.github/workflows/ci.yml` minimal pour CI (no secrets), commit à PR. (Demande utilisateur requise.)
2. Je lance un scan de secrets local rapide et inclus les résultats dans le rapport. (optionnel — je peux exécuter maintenant)
3. J’ajoute des tests e2e supplémentaires pour les flows critiques selon votre priorité.

Fichiers/points à vérifier manuellement
- `app/api/_lib/ba.js` — token refresh and upstream error handling (already robust). Ensure logging of upstream errors doesn't leak tokens.
- `app/api/_lib/email.js` — default secret fallback; tighten for prod.
- `app/api/cron/agents/route.js` — ensure strong auth and rate-limiting.

Si vous validez, j'exécute immédiatement l'étape 2 (scan de secrets) puis je produis un PR contenant : 1) workflow CI minimal, 2) a small README security checklist, et 3) optional tests scaffold.
