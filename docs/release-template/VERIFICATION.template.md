# Visual QA — release screenshots (round <<QA_ROUND>>)

Generated: <<QA_GENERATED_ISO>>

> **Operator note.** This is the templatized visual-QA report. The headline placeholders (`<<POST_REBASE_SHA>>`, `<<PROD_ALIAS>>`, `<<QA_ROUND>>`) are filled by the release pipeline (see `README.md` in this folder for the substitution guide). The per-image detail tables below carry *exemplar* values from round <<QA_ROUND>> — replace them on each new release with the values produced by `/tmp/visual-qa.py` against the current production build.

**Git tree at HEAD.** `<<POST_REBASE_SHA>>`. Bytes at HEAD are expected to be byte-for-byte identical to the pre-rebase `<<PRE_REBASE_SHA>>` so production behavior is unchanged.

**Source.** Playwright full-page captures of canonical production alias `<<PROD_ALIAS>>` after the post-rebase force-push.

**Capture tool.** `/tmp/full-page-shots.mjs` (Playwright 1.61.0 + bundled Chromium 1228, `waitUntil: load` + per-target 4.5–5s settle).

**QA tool.** `/tmp/visual-qa.py` (Pillow + numpy per-pixel stats, edge-strip CV for clipping, tesseract 5.3.4 `deu+eng` for OCR keyword match).

_Note._ `/health` JSON viewport-only (raw JSON is whitespace by design). `/jobs/<ref>` mobile renders at exactly 390 viewport width after the css fix landed in this release.

## Summary

| File | Dims | Mean | Stddev | OCR words | Layout pass? |
|---|---|---|---|---|---|
| `01-homepage-desktop-1440x900.png` | 1440x4316 | 227.2 | 64.7 | 579 | ✅ |
| `02-homepage-mobile-390x844.png` | 390x8021 | 231.9 | 55.8 | 582 | ✅ |
| `03-health-json-1280x400.png` | 1280x400 | 253.4 | 12.0 | 9 | ✅ |
| `04-jobs-real-ref-desktop-1440x900.png` | 1440x1025 | 229.2 | 66.6 | 89 | ✅ |
| `05-jobs-real-ref-mobile-390x844.png` | 390x1633 | 231.3 | 61.7 | 83 | ✅ |

- _Operator: refresh dims/mean/stddev/OCR with `/tmp/visual-qa.py` against the current build._

## Overflow probe (Playwright, viewport → render scrollWidth)

```
=== /jobs/REF mobile 390 ===
viewportWidth=390  docScrollWidth=390  bodyScrollWidth=390
=== /  mobile 390 ===
viewportWidth=390  docScrollWidth=390  bodyScrollWidth=390
=== /jobs/REF desktop 1440 ===
viewportWidth=1440  docScrollWidth=1440  bodyScrollWidth=1440
```

- _Operator: confirm the three pages render at scrollWidth === viewport; if any line deviates, the QA check fails._

## Per-image detail (exemplar — refresh per release)

### `01-homepage-desktop-1440x900.png`

- Dimensions: 1440x4316 (RGB)
- Mean brightness: 227.2 / 255, stddev 64.7
- Dark pixels (<50 luma): 8.2%, light pixels (>235): 83.56%
- Edge-strip CV (top/bottom/left/right): 0.295 / 0.2309 / 0.331 / 0.0
- Quadrant brightness (TL, TR, BL, BR): 215.2, 243.9, 209.4, 240.5
- OCR words: 579
- Keywords matched: 9 / 10
  - present: khalfa, stelle, recherche, agentur, berlin, hamburg, frankfurt, softwareentwickler, pflegefachkraft
  - missing: köln
- Text sample: `KhalfaJobs für Recruiting-Agenturen …` (truncated by OCR viewport)
- Notes:
  - OCR partially matched: 9/10 expected keywords present; missing 1.
  - Right edge strip is uniform at brightness 250 (cv=0.000); may indicate clipped padding.

### `02-homepage-mobile-390x844.png`

- Dimensions: 390x8021 (RGB)
- Mean brightness: 231.9 / 255, stddev 55.8
- Dark pixels (<50 luma): 4.46%, light pixels (>235): 82.39%
- Edge-strip CV (top/bottom/left/right): 0.4188 / 0.177 / 0.0714 / 0.0712
- Quadrant brightness (TL, TR, BL, BR): 226.5, 237.6, 227.4, 236.1
- OCR words: 582
- Keywords matched: 5 / 5
  - present: khalfa, stelle, recherche, agentur, berlin
- Text sample: `BA LIVE SAAS KhalfaJobs für Recruiting-Agenturen …`

### `03-health-json-1280x400.png`

- Dimensions: 1280x400 (RGB)
- Mean brightness: 253.4 / 255, stddev 12.0
- Dark pixels (<50 luma): 0.11%, light pixels (>235): 99.21%
- Edge-strip CV (top/bottom/left/right): 0.091 / 0.0 / 0.0897 / 0.0182
- Quadrant brightness (TL, TR, BL, BR): 250.4, 253.2, 255.0, 255.0
- OCR words: 9
- Keywords matched: 4 / 5
  - present: status, ok, environment, warnings
  - missing: missingrequired
- Notes:
  - Image mean brightness is very light (253.4); likely blank or outside-content.

### `04-jobs-real-ref-desktop-1440x900.png`

- Dimensions: 1440x1025 (RGB)
- Mean brightness: 229.2 / 255, stddev 66.6
- Dark pixels (<50 luma): 8.87%, light pixels (>235): 87.1%
- Edge-strip CV (top/bottom/left/right): 0.2225 / 0.2029 / 0.6182 / 0.0
- Quadrant brightness (TL, TR, BL, BR): 203.0, 244.8, 218.8, 250.3
- OCR words: 89
- Keywords matched: 8 / 9
  - present: referenznummer, arbeitgeber, arbeitsort, gehalt, beruf, veröffentlicht, eintritt, ba
  - missing: originialanzeige
- Notes:
  - Right edge strip uniform at brightness 250; may indicate clipped padding.

### `05-jobs-real-ref-mobile-390x844.png`

- Dimensions: 390x1633 (RGB)
- Mean brightness: 231.3 / 255, stddev 61.7
- Dark pixels (<50 luma): 6.33%, light pixels (>235): 85.75%
- Edge-strip CV (top/bottom/left/right): 0.8409 / 0.1365 / 0.1496 / 0.1496
- Quadrant brightness (TL, TR, BL, BR): 216.0, 222.9, 239.7, 246.3
- OCR words: 83
- Keywords matched: 2 / 2
  - present: arbeitgeber, arbeitsort
- Notes:
  - Mobile /jobs/<ref> shot — pre-fix had width 492 px (overflow); post-fix 390 px. Keep this assertion true on every release.

## Per-release extension

If a new release adds screenshots (e.g. "06-pricing-desktop-1280x800.png"), append a new section here in the same shape, run `/tmp/visual-qa.py` against the new build, and update the Summary table at the top.
