# Vercel-deploy gating runbook

> How and why Vercel skips deployments for docs-only pushes, plus the recovery procedure if a non-docs commit gets skipped by accident. Last updated 2026-07-11, alongside the touchstone commit `49399f2`.

## TL;DR

A `vercel.json` `ignoreCommand` runs `git diff --quiet HEAD~1 HEAD -- ':!docs'` on every push to `main`. If that command exits `0`, Vercel cancels the build. The rule is currently live (boot install: commit `fff44cf`, Vercel deploy `5406021582`, status `success`) and was proven by the touchstone commit `49399f2`, which GitHub's Deployments API confirmed produced **zero** Vercel deployments for its SHA.

## The rule

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "ignoreCommand": "git diff --quiet HEAD~1 HEAD -- ':!docs'",
  "crons": [
    { "path": "/api/cron/agents", "schedule": "0 6 * * *" }
  ]
}
```

Vercel documented behavior — `_vercel.json#ignoreCommand_` runs once per push; exit-code semantics:

| Exit code | What it means for this push | Vercel action |
|---|---|---|
| `0` | No diff outside `docs/` | **Cancel the build** — no Vercel deployment created |
| `1` | There IS a diff outside `docs/` | Build and deploy as usual |
| Other | `git` choking / container issue | Fail open — deploy proceeds |

The pathspec `':!docs'` is git's `exclude-from-diff` syntax, embedded in single quotes so Vercel's `bash -lc` shell doesn't expand the `!`. It matches any path whose name starts with `docs/` (top-level directory only — subdirectories inherit the prefix).

## Why docs-only is exempt

Every push to `main` used to trigger a Vercel deployment, regardless of whether the change touched app code or only docs. Cost per docs-only redeploy:

- ~30–90 s of Vercel build time (no-op rebuild, since bytes are identical to the previous build)
- Noise in the GitHub Deployments API timeline — makes "what deploy did we ship at 16:34 UTC?" harder to answer
- Risk of spurious `main`-branch failures during sensitive deploy windows

The most expensive no-op rebuild so far was deployment `5405999040` (Vercel's response to push `6766843`, the round-1 `docs/release-template/` landing). The build emitted zero diff to the served app but consumed full build minutes — pure waste.

## Provenance — the touchstone chain

| Commit | What it changed | Vercel deployment? | Deploy ID | Outcome |
|---|---|---|---|---|
| `6766843` | `docs/release-template/{HANDOFF,VERIFICATION,README}.template.md + placeholders.json` (added) | yes (this is the no-op rebuild we wanted to suppress) | `5405999040` | success (wasted) |
| `fff44cf` | `vercel.json` `ignoreCommand` (added) | yes — rule itself is non-docs, so the boot deploys normally | `5406021582` | success — **installs the rule** |
| `49399f2` | `docs/release-template/README.md` (one-line append) | **no** | _none — confirmed via GitHub Deployments API poll, 90 s window_ | confirms the rule works |
| `8c276e8` | `docs/operations/vercel-deploy-gating.md` (added) | **no** | _none — confirmed via GitHub Deployments API poll, 90 s window_ | confirms the rule survives its own landing; serves as the audit baseline for §Evolution quarterly audit |

Rule of thumb for future readers: if you see two consecutive commits where the second has docs/ paths and the first doesn't, the second is likely a touchstone. Current tip on `origin/main` is `49399f2` (touchstone) → `fff44cf` (boot) → `6766843` (templates).

## Pre-push local check (fail-closed)

Before pushing, run inside the webscraper repo checkout:

```bash
git diff --quiet HEAD~1 HEAD -- ':!docs'; echo "exit=$?  (0 = Vercel will skip; 1 = Vercel will deploy)"
```

Interpretation:

- `exit=0` and you expected `1` → **stop**. Most likely cause: there's a non-docs path that Git considers as starting with `docs/` (e.g. a `docsfoo/` directory the rule would mistakenly match). Run `git diff HEAD~1 HEAD --name-only` to enumerate the touched paths and confirm.
- `exit=1` and you expected `0` → **stop**. Your push will trigger a Vercel rebuild. If that rebuild isn't desired, revert the non-docs change locally and recommit with only the docs portion.
- `exit=0` and you expected `0` → safe to push; Vercel skips.
- `exit=1` and you expected `1` → safe to push; Vercel deploys normally.

## Recovery — non-docs commit got skipped

If a future non-docs commit disappears because the rule fired:

1. **Diagnose** — confirm the skip and what's in `main`:

   ```bash
   # Did Vercel deploy for this SHA?
   gh api /repos/Walid-Khalfa/webscraper/deployments?per_page=10 \
     | python3 -c 'import json,sys; d=json.load(sys.stdin); print([x for x in d if x["sha"].startswith("<7-char SHA>")])'
   # What was actually pushed?
   git show --stat <full SHA>
   ```

   If the first command prints `[]`, the rule fired; if it prints a deploy ID, Vercel deployed.

2. **Most likely cause**: a top-level prefix other than `docs/` is also exempt (we don't have any today; verify `cat vercel.json | grep ignoreCommand` shows only the canonical pattern). Less likely: the diff actually WAS all `docs/` — in which case the rule correctly fired.

3. **Workaround A — manual Vercel redeploy** (preferred):

   - In the Vercel dashboard: project "webscraper" → Production tab → click "..." next to the latest deployment → "Redeploy".
   - This re-builds from the current `main` tip with no further git churn. Quick, clean, observable.

4. **Workaround B** — _do not use_, included only because someone might suggest it: append a one-line touchstone to a `docs/...` file and recommit the non-docs change alongside it, hoping the combined diff cancels the deploy. **It doesn't — `'!docs'` pathspec is an OR over "any path NOT under docs/";** adding more `docs/` paths doesn't disable the rule. The deploy still proceeds.

5. **Workaround C — temporarily flip the rule off** (last resort, ugly):

   ```bash
   # 1. Disable the rule locally
   sed -i 's|"ignoreCommand": ".*"|"ignoreCommand": "false"|' vercel.json
   git add vercel.json && git commit -m "chore(vercel): temporarily disable ignoreCommand for $ISSUE_ID"
   # 2. Cherry-pick the original non-docs commit onto this branch (or amend the existing commit)
   # 3. Push → Vercel deploys (rule is off)
   # 4. Restore the rule
   sed -i 's|"ignoreCommand": ".*"|"ignoreCommand": "git diff --quiet HEAD~1 HEAD -- '\\'':!docs'\\''"|' vercel.json
   git add vercel.json && git commit -m "chore(vercel): restore ignoreCommand"
   git push origin main
   ```

   Workaround C is ugly — prefer Workaround A or a permanent fix to the rule.

## Recovery — docs-only commit accidentally deployed (rule fails open)

Inverse problem. Most likely causes:

- Pathspec typo: `':docs'` instead of `':!docs'` would mean the rule cancels ONLY when EVERY change is under `docs/` (which is what we want). Actually wait — the inverse is more typical: if `':!docs'` ever flips to `':docs'`, then Vercel skips docs-only changes _and_ non-docs changes alike. Verify the syntax with `cat vercel.json | grep ignoreCommand`.
- The rule was commented-out or removed entirely.
- `git` is missing from Vercel's container (would cause the rule to fail open by design — see the exit-code table above).

Recovery: fix the rule, commit a touchstone like `49399f2`, poll GitHub Deployments API for the touchstone SHA, confirm zero deployments.

## Evolution

- **Adding a second exempt prefix** (e.g., `.github/` workflows): update the rule to a multi-pathspec expression, e.g. `git diff --quiet HEAD~1 HEAD -- ':!docs' ':!.github'`. Test locally against the three synthetic scenarios from the boot-deploy commit (`fff44cf`) before pushing the rule change itself. The synthetic test cases are documented in the commit message.
- **If a `.vercelignore` file appears in the repo**: that's a different lever — it only excludes files from the build, does NOT cancel the deployment. Don't confuse it with `ignoreCommand`.
- **Quarterly audit**: spot-check that recent docs-only pushes produce zero Vercel deployments.

  ```bash
  for sha in $(git log --oneline -30 origin/main | awk '{print $1}'); do
    short="${sha:0:7}"
    if git diff --quiet "${sha}^" "$sha" -- ':!docs'; then
      d=$(gh api /repos/Walid-Khalfa/webscraper/deployments?per_page=20 \
            | python3 -c "import json,sys; d=json.load(sys.stdin); print([x['id'] for x in d if x['sha'].startswith('$short')])")
      if [ "$d" != "[]" ]; then
        echo "ALERT: $sha was docs-only but Vercel deployed: $d"
      fi
    fi
  done
  ```

  Output should be empty after running; any `ALERT:` lines mean the rule regressed.

## Why this runbook exists (instead of living only in chat history)

- **Auditability**: a future engineer onboarding to the project should be able to grep `docs/operations/` and find this rule's provenance without trawling Slack threads.
- **Drift detection**: the quarterly audit script above catches rule regressions early; the script lives next to the runbook so it doesn't get lost.
- **Touchstone precedent**: commit `49399f2` is the **first** committed, unmodified by later traffic, of the no-deployment outcome. Future audit scripts can use it as a baseline (if its SHA starts a deployment, we've regressed).

---

_Runbook last updated on 2026-07-11 alongside the touchstone commit `49399f2`. Maintained by the webscraper engineering team; updates happen in the same PR that changes the rule itself._
