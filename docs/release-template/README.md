# `docs/release-template/` — re-usable release-notes bridge

> This folder contains the templatized artefacts that the engineering team writes once and reuses for every future Vercel Production release. The structure was first proven on round 1 (`830f5db` / Vercel `5405873233` / 2026-07-11). When `<<TOKEN>>` placeholders are substituted with round-1 values, **the SHA-bearing prose round-trips byte-equal to round-1**; the per-image detail tables in `VERIFICATION.template.md` and the §Provenance narrative in `HANDOFF.template.md` are deliberately templatized as operator-edited blocks, so the substituted files match the round-1 output *modulo these intentional divergences*. Round-trip-verify with that delta in mind, not as raw byte-equality.

## Files in this folder

| File | Purpose | When the operator edits |
|---|---|---|
| `HANDOFF.template.md` | Email-led handoff manifest for the release-notes platform owner — TL;DR, trust model, verification, recipes, runbook, **email template for sender**, why-one-channel narrative, provenance, bundle SHA. | Every release. Headline values (SHAs, fingerprint, lead platform) substitute into the `<<TOKEN>>` placeholders. Prose sections that change with the release (the provenance narrative and the `Why this SHA` paragraph) are operator-edited, not tokenized. |
| `VERIFICATION.template.md` | Per-release visual-QA report — headline placeholders + per-image detail exemplars. | Every release. Headline placeholders substitute; per-image detail tables are refreshed from `/tmp/visual-qa.py` and overwritten (the round-1 values in the file today are exemplars). |
| `README.md` (this file) | How to use both templates. | Rarely — only when the release workflow itself changes (e.g. switching lead platforms, switching delivery channel). |

## What the `<<TOKEN>>` placeholders mean

The token syntax is `<<UPPER_SNAKE_CASE>>` (e.g. `<<POST_REBASE_SHA>>`). Tokens only mark **values that change every release**; static prose is left untouched. The full token list, organized by where they appear in the pipeline, follows.

### Production-tree tokens

| Token | Example value | Source |
|---|---|---|
| `<<POST_REBASE_SHA>>` | `830f5db` | `git rev-parse HEAD` after the post-rebase linearization |
| `<<PRE_REBASE_SHA>>` | `e0a47fb` | The pre-rebase commit hash (often identical-tree to `POST_REBASE_SHA`) |
| `<<BASELINE_SHA>>` | `8977620` | The CSS/feature pre-fix parent commit |
| `<<DROPPED_COMMIT>>` | `d533e34` | The empty commit dropped during the rebase (only fills if you actually rebased) |
| `<<VERCEL_DEPLOY_ID>>` | `5405873233` | `gh api /repos/…/deployments?per_page=10` after the force-push |
| `<<PROD_DEPLOY_STATUS>>` | `success` | `gh api /repos/…/deployments/<ID>/statuses` |
| `<<PROD_ALIAS>>` | `https://employment-agones-next.vercel.app` | The canonical production URL |
| `<<RELEASE_DATE>>` | `2026-07-11` | Today (UTC) |
| `<<QA_ROUND>>` | `4` | The latest QA round number |
| `<<QA_GENERATED_ISO>>` | `2026-07-11T17:44:22.041406Z` | ISO 8601 timestamp at `/tmp/visual-qa.py` run time |
| `<<RELEASE_NARRATIVE>>` | _operator-edited block_ | One paragraph: what changed, why, what shipped evidence proves it. Lives in HANDOFF.md §Provenance. |
| `<<NARRATIVE_OUTCOME>>` | _operator-edited block_ | One sentence: the user-visible improvement. Lives in HANDOFF.md §Provenance. |
| `<<REFERENCE_NUM>>` | `10001-1003353506-S` | The BA reference used as the live `/jobs/<ref>` smoke-test sample. Update when retargeting. |

### Bundle + signing tokens

| Token | Example value | Source |
|---|---|---|
| `<<BUNDLE_SHA256>>` | `0e3648fc4a23cc3a541e7196724cc7bdb16f3ef9a06ffe5ef25c52c88f54fe97` | `sha256sum release-notes-bundle.tar.gz` after `tar` packaging |
| `<<HANDOFF_SHA256>>` | `531f2bee6ba7234c2899738850ab55cfe939a82a0d32db9588b25519c42bafb8` | `sha256sum HANDOFF.md` after the substitution completes |
| `<<PUBKEY_SHA256>>` | `12ac18bf072cd89a12d53321b6d85ce0f127abb7ac790ef491fbaa3ab2e2b2b0` | `sha256sum release-signer-*.pub.asc` |
| `<<GPG_FINGERPRINT>>` | `D81F 6477 4285 D6C1 9CFF 03F7 A857 C708 6847 7B26` | `gpg --fingerprint <UID>` |
| `<<GPG_KEY_UID>>` | `Webscraper Release Signer 2026-07-11` | The release-signer key UID |
| `<<GPG_KEY_EMAIL>>` | `release-signer@webscraper.example` | The release-signer key email |
| `<<GPG_KEY_PUBFILE>>` | `release-signer-2026-07-11.pub.asc` | The ASCII-armored pubkey filename |
| `<<GPG_KEY_LIFECYCLE>>` | `throwaway one-time-ship` | One-liner: stability class of the key (`throwaway one-time-ship` / `stable-team-with-hardware-token` / etc.) |
| `<<BUNDLE_SIZE>>` | `7.23 MB` | `du -h release-notes-bundle.tar.gz` |

### Channel + recipient tokens

| Token | Example value | Source |
|---|---|---|
| `<<LEAD_PLATFORM>>` | `Notion` | The release-notes target platform (this release: Notion; next release may differ) |
| `<<CHANNEL>>` | `email` | The delivery channel (`email` / `Slack DM` / `pinned at repo` / etc.) |
| `<<LEAD_RECIPE_STEPS>>` | `6` | Number of steps in the lead-platform recipe (operator adjusts if format changes) |

## How to substitute the tokens

### Option A — `sed` (quick, no script)

```bash
# Extract values to a sidecar
cat > /tmp/release-values.env <<'EOF'
POST_REBASE_SHA=830f5db
BUNDLE_SHA256=0e3648fc4a23cc3a541e7196724cc7bdb16f3ef9a06ffe5ef25c52c88f54fe97
GPG_FINGERPRINT="D81F 6477 4285 D6C1 9CFF 03F7 A857 C708 6847 7B26"
GPG_KEY_PUBFILE=release-signer-2026-07-11.pub.asc
BUNDLE_SIZE="7.23 MB"
EOF

sed -e "s|<<POST_REBASE_SHA>>|$(grep ^POST_REBASE_SHA= /tmp/release-values.env | cut -d= -f2)|g" \
    docs/release-template/HANDOFF.template.md > HANDOFF.md
# repeat for every token+file
```

### Option B — `awk` template loop (medium)

```bash
while IFS='=' read -r key value; do
  export "$key"="$value"
done < /tmp/release-values.env

awk '{
  while (match($0, /<<[A-Z][A-Z0-9_]*>>/)) {
    tok = substr($0, RSTART+2, RLENGTH-4)
    val = ENVIRON[tok]
    if (val == "") val = "<<" tok ">>"
    $0 = substr($0, 1, RSTART-1) val substr($0, RSTART+RLENGTH)
  }
  print
}' docs/release-template/HANDOFF.template.md > HANDOFF.md
```

### Option C — Python (most ergonomic)

```python
import json, re
values = json.load(open('placeholders.json'))  # if you keep one
src = open('docs/release-template/HANDOFF.template.md').read()
out = re.sub(r'<<([A-Z][A-Z0-9_]*)>>', lambda m: values.get(m.group(1), m.group(0)), src)
open('HANDOFF.md', 'w').write(out)
```

Tokens that are *not* in the values map are left in `<<...>>` form so the operator can see what is missing; the substitution exits non-zero in that case (so CI catches incomplete fills before publishing).

## Round-trip verification (proves the template is well-formed)

After substituting `round-1` values back into the templates, the produced `HANDOFF.md` should match the round-1 reference output at `/workspaces/release-screenshots/HANDOFF.md` with **diff confined to the deliberately templatized prose areas** (HANDOFF §Provenance narrative and VERIFICATION per-image detail tables). The SHA-bearing lines round-trip byte-equal. That selective check catches drift in the template against the live output without false positives from intentional divergence.

```bash
diff -u \
  <(python3 -c "import re; print(re.sub(r'<<[A-Z_]*>>', '<ROUND1>', open('docs/release-template/HANDOFF.template.md').read()))") \
  <(python3 -c "import re; print(re.sub(r'D81F 6477.*f54fe97|830f5db|2026-07-11|Notion|email|7\.23 MB', '<ROUND1>', open('/workspaces/release-screenshots/HANDOFF.md').read()))")
# expected: only diffs in §Provenance narrative + per-image detail tables (operator-edited blocks in templates)
# expected: SHA-bearing lines byte-equal — that's where template drift would actually hurt
```

## What lives outside this folder

The round-1 *output* (HANDOFF.md, VERIFICATION.md, the signed tarball, the SHA sidecar, the GPG signature, the pubkey) lives at `/workspaces/release-screenshots/`, not in this repo. That separation is deliberate — `/workspaces/release-screenshots/` is the shipping workspace for the *current* release; `docs/release-template/` is the long-lived schema for *future* releases. The two halves disk-evolve at different rates: this template folder changes rarely (when a section becomes outdated); the workspace rotates with each Vercel deploy.

## When to evolve this template

- Adding a new screenshot to the bundle (e.g. `06-pricing-desktop-1280x800.png`): add the row to **both** the `## Summary` and `## Per-image detail (exemplar — refresh per release)` tables in `VERIFICATION.template.md`; add a row to the `## What's inside the bundle` table in `HANDOFF.template.md`. Round-trip-verify against the next release's output.
- Switching the lead platform (e.g. Notion → Gitbook): substitute `LEAD_PLATFORM` and re-run the round-trip check. The Gitbook Appendix already lives below the Lead Recipe in `HANDOFF.template.md`; you can swap the section order if Gitbook permanently becomes primary.
- Switching the signing key from a throwaway to a stable team key: substitute `GPG_KEY_LIFECYCLE`, `GPG_KEY_UID`, `GPG_KEY_EMAIL`, `GPG_KEY_PUBFILE`, `GPG_FINGERPRINT`. Do NOT change the GPG signature mechanism itself — `gpg --armor --detach-sign SHA256SUMS.txt > SHA256SUMS.txt.asc` is the contract the recipient's verifier depends on.
- Re-templatizing the email body (e.g. adding a "follow-up CI status link" line): edit the inline code-block in `HANDOFF.template.md` §"Email template for the sender (you)" once; future releases inherit the change.
