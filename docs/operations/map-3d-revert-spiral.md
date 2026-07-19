# Carte 3D + Coach — Bilan du revert (2026-07-19)

## État final du revert

Revert propre de la migration **JobMap.jsx → JobMap.tsx** (migration ratée). Les artefacts suivants ont été retirés :
- `components/JobMap.tsx` (supprimé)
- `types/css-modules.d.ts` + le dossier `types/` (supprimés)
- `@types/leaflet` devDep (npm uninstall)

Restauré fonctionnel :
- `components/JobMap.jsx` (intact, non type-checked strict)
- `components/JobPortalClient.tsx` (call `<JobMap ... />` direct, sans l'IIFE spread cast)
- `npm run lint` : OK
- `npm run test:unit` : 129/129 tests passent

## Problème runtime résiduel

Le test Playwright `tests/e2e/map-3d.spec.ts` échoue APRÈS le click sur la toolbar chip "Karte".
Diagnostic capturé en runtime (via `page.evaluate(...)`) :
```
domProbe = {
  hasContainer: false, // .results-map-container absent du DOM
  hasMapShell: false,   // .city-map-shell (JobMap) absent
  hasCoach: false,      // .map-coach (MapCoachOverlay) absent
  ...
}
consoleErrors: [] // aucune erreur JS consignée
```

→ Le branch `{ui.viewMode === "map" ? ...}` ne s'exécute pas après le click. Hypothèse : `ui.setViewMode("map")` ne re-render pas l'arbre, OU le click matche un mauvais élément.

## Dette technique assumée

| Fichier          | État      | Impact strict mode |
|------------------|-----------|---------------------|
| JobMap.jsx       | code 3D plutôt que 2D, pas type-checked strict | OK (allowJs:true, pas de strict sur .jsx) |
| MapCoachOverlay.jsx | réécrit en pur JSX, sans interface TS | OK |
| useSearch.ts     | ajout recommendedCities + topOpportunity | TS-correct, export rétrocompatible |
| lib/german-city-map.js | ajout CITY_CAREER_FOCUS/MARKET_NOTES/SENTENCES | OK |
| app/globals.css  | ~681 lignes de styles 3D CSS | OK |
| styles/e2e/map-3d.spec.ts | nouveau test Playwright focalisé 3D | OK |

Aucun `// @ts-nocheck`, aucun ambient `.d.ts` non-essentiel, aucune dette cachée de type-casting.

## Prochaines étapes recommandées

1. **Debug viewMode toggle** : ajouter `console.log("viewMode changed:", ui.viewMode)` dans JobPortalClient.tsx pour vérifier en runtime que `ui.setViewMode("map")` est bien appelé par le click.

2. **Ouverture test minimal** : si le rendering runtime de la carte 3D est bloqué hors-session debug, la screenshot peut être produite manuellement via `npm run dev` + observation humaine.

3. **PR de suivi** : remboursement explicite de la dette typage si on souhaite passer JobMap en .tsx proprement (sans spiral). Plan : utiliser `checkJs: false` localement sur ce fichier + typage incrémental via migration script.
