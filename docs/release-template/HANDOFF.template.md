# Release Notes Bundle — Handoff (post-rebase SHA `<<POST_REBASE_SHA>>`)

> Single source of truth for the release-notes platform owner.
> **Lead platform:** <<LEAD_PLATFORM>>. **Delivery channel:** <<CHANNEL>>. **Packaging:** GPG-signed plain tarball (no symmetric encryption).

## TL;DR

| Artifact | Path | Purpose |
|---|---|---|
| Plaintext tarball | `release-notes-bundle.tar.gz` | Self-extract archive (<<BUNDLE_SIZE>>) of all release assets |
| Bundle SHA-256 | `<<BUNDLE_SHA256>>` | Integrity fingerprint of the bundle |
| Signed sidecar | `SHA256SUMS.txt.asc` (over `SHA256SUMS.txt`) | Detached ASCII-armored GPG signature on the canonical hashes |
| Public key | `<<GPG_KEY_PUBFILE>>` | ASCII-armored GPG pubkey for verification |
| Signer fingerprint | **`<<GPG_FINGERPRINT>>`** | The long-form token we expect you to compare against the value relayed to you out-of-band |
| This manifest | `HANDOFF.md` | <<LEAD_PLATFORM>>-led import recipe + verification one-liner |

> **Trust model.** This key is a *<<GPG_KEY_LIFECYCLE>>* key, generated on <<RELEASE_DATE>> just for this bundle. We **must** send you the fingerprint `<<GPG_FINGERPRINT>>` through a separate channel (Slack DM, voice call, signed email) before you trust the signature. That is the same out-of-band bootstrap that `apt` uses for its archive signing keys.

## Verify before you trust (5 commands, runs in <30 s)

```bash
# 1. import the release-signer public key
gpg --import <<GPG_KEY_PUBFILE>>

# 2. verify the detached signature on the SHA list
gpg --verify SHA256SUMS.txt.asc SHA256SUMS.txt
#   expected: "Good signature from <<GPG_KEY_UID>> ..."

# 3. confirm fingerprint matches the value relayed to you out-of-band
gpg --fingerprint <<GPG_KEY_EMAIL>>
#   expected -> the list MUST contain: <<GPG_FINGERPRINT>>

# 4. verify the two artifacts are byte-for-byte intact
sha256sum -c SHA256SUMS.txt
#   expected:
#     release-notes-bundle.tar.gz: OK
#     HANDOFF.md:                  OK

# 5. extract the bundle once you've decided to trust it
mkdir -p release-notes/ && tar -xzf release-notes-bundle.tar.gz -C release-notes/
ls release-notes/
```

If **step 3** doesn't match the fingerprint we relayed, **stop** — the bundle is not from us.

## What's inside the bundle (10 files, <<BUNDLE_SIZE>> unpacked)

| File | Approx. size | Purpose |
|---|---|---|
| `RELEASE-NOTES.md` | ~12 KB | Source markdown — 5 relative PNG refs, handoff matrix, history |
| `RELEASE-NOTES.rendered.html` | ~50 KB | Relative-image HTML, browser-viewable |
| `RELEASE-NOTES.rendered.png` | ~350 KB | Chromium fullPage screenshot of `rendered.html` — proves the 5 PNG refs load |
| `RELEASE-NOTES.portable.html` | ~2.1 MB | Self-contained HTML, **base64-inlined images** — paste into <<LEAD_PLATFORM>> |
| `RELEASE-NOTES.portable.png` | ~350 KB | Chromium fullPage screenshot of `portable.html` |
| `VERIFICATION.md` | ~9 KB | Round-<<QA_ROUND>> QA summary + per-image metrics + overflow probe |
| `01-homepage-desktop-1440x900.png` | ~350 KB | Homepage @ 1440×900 full-page |
| `02-homepage-mobile-390x844.png` | ~440 KB | Homepage @ 390×844 full-page |
| `03-health-json-1280x400.png` | ~30 KB | `/health` JSON snapshot |
| `04-jobs-real-ref-desktop-1440x900.png` | ~190 KB | `/jobs/<<REFERENCE_NUM>>` @ 1440×900 |
| `05-jobs-real-ref-mobile-390x844.png` | ~280 KB | `/jobs/<<REFERENCE_NUM>>` @ 390×844 (mobile overflow fix evidence) |

## <<LEAD_PLATFORM>> import — lead recipe (6 steps)

1. Confirm the SHA + GPG fingerprint (run all 5 verification commands above).
2. Extract the bundle: `tar -xzf release-notes-bundle.tar.gz -C ./release-notes/`
3. In <<LEAD_PLATFORM>>, create a new page titled **"Release notes — <<POST_REBASE_SHA>>"** (or your standard title).
4. **Body content** — paste the contents of `release-notes/RELEASE-NOTES.portable.html` into the page body. <<LEAD_PLATFORM>>'s importer parses inline `<img>` tags and uploads the images automatically; tables render natively; code blocks render as code; headings as headings.
5. **QA appendix** — paste the contents of `release-notes/VERIFICATION.md` as a toggle/collapsible sub-section under the body (round-<<QA_ROUND>> QA data + overflow-probe numbers are evidence the live site is currently healthy).
6. **Sanity check** — open the rendered page; confirm 5 images render (01…05), the `## Screenshots` heading maps to H2, and any code spans are syntax-highlighted.

## Gitbook import — appendix (3 steps)

1. Extract: `tar -xzf release-notes-bundle.tar.gz`.
2. Copy the 11 extracted files into a Gitbook-tracked directory, e.g. `release-notes/<<RELEASE_DATE>>/`.
3. `git add . && git commit -m "Release notes — <<POST_REBASE_SHA>>" && git push`. Gitbook resolves `![](01-homepage-…)` relative paths automatically against the file's own location.

## Confluence import — appendix (3 steps)

1. Extract the bundle.
2. Confluence page → *Insert* → *Markup* widget.
3. Paste the contents of `release-notes/RELEASE-NOTES.portable.html` into the markup widget body. Confluence parses `<table>` / `<h1>` / `<code>` / `<img>`; tables render as Confluence table macros; code blocks as code macros; images inline directly.

## Runbook — what to do if something looks wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| `gpg --verify` reports **bad signature** | hash sidecar corrupted during transit | re-ship `SHA256SUMS.txt` + `SHA256SUMS.txt.asc` |
| `sha256sum -c` reports **FAILED** on bundle | tarball corrupted (very rare) | re-ship `release-notes-bundle.tar.gz` |
| `sha256sum -c` reports **FAILED** on `HANDOFF.md` | this manifest corrupted | re-ship `HANDOFF.md` |
| <<LEAD_PLATFORM>> import shows **broken image icons** | image-attach cap (rare) | switch to Gitbook recipe |
| `/jobs/<<REFERENCE_NUM>>` mobile shot looks wider than 390 px | this artifact is stale; rerender | rerun `/tmp/full-page-shots.mjs` against the live URL |
| Fingerprint doesn't match what we relayed out-of-band | phishing or MITM | **ABORT** — re-confirm the fingerprint via a different channel before doing anything else |

## Email template for the sender (you)

The recipient needs four artifacts: (a) the tarball, (b) the detached signature, (c) the public key, and (d) the fingerprint relayed through a *separate* channel. Copy-paste-ready subject + body for the **<<CHANNEL>>** channel — fill in the bracketed `[...]` fields:

**Subject.** `[webscraper] Release notes for SHA <<POST_REBASE_SHA>> — signed bundle for review`

**Body.**

```
Hi [release-notes owner name],

Forwarding today's release notes for SHA <<POST_REBASE_SHA>>
(Vercel deploy <<VERCEL_DEPLOY_ID>>, status <<PROD_DEPLOY_STATUS>>).

Attachments:
  1. release-notes-bundle.tar.gz          (<<BUNDLE_SIZE>>, primary artifact)
  2. SHA256SUMS.txt.asc                   (detached GPG signature)
  3. <<GPG_KEY_PUBFILE>>                  (public key for verification)
  4. HANDOFF.md                           (<<LEAD_PLATFORM>>-led import recipe)

Reference SHA-256 of the tarball:
  <<BUNDLE_SHA256>>

Verify with these 4 commands (Linux/macOS shell):
  gpg --import <<GPG_KEY_PUBFILE>>
  gpg --verify SHA256SUMS.txt.asc SHA256SUMS.txt
  gpg --fingerprint <<GPG_KEY_EMAIL>>
  sha256sum -c SHA256SUMS.txt

The fingerprint MUST print as:
  <<GPG_FINGERPRINT>>

I'm sending you the SAME fingerprint through a different channel
(Slack DM / voice call / signed PGP email) so you can compare
end-to-end before trusting. That is the fingerprint out-of-band
that binds this key to me — without it, the signature is not
authenticated.

Import recipe for <<LEAD_PLATFORM>>: see HANDOFF.md section
"<<LEAD_PLATFORM>> import — lead recipe".

Runbook if anything looks wrong: see HANDOFF.md section "Runbook".

— [your name]
```

After sending the email, post the same fingerprint in the separate
channel you chose (Slack DM, voice call, etc.) and ask the recipient
to read it back to you. If the fingerprint they read back differs
from what you sent, **abort** — that is the symptom in the runbook.

## Why one channel (and what changed vs the assumption)

We considered `openssl aes-256-gcm -pbkdf2 -iter 200000` symmetric encryption (sealed blob + passphrase sidecar on two different channels). We chose the **signed plain tarball** path instead because:

- The bundle contents are public release notes from a publicly-served Vercel app (no IP / PII to protect).
- Symmetric encryption adds terminal friction for a non-developer reviewer (download `.enc`, install `openssl`, decrypt, extract) — that friction buys no security gain when the contents aren't confidential.
- A GPG-detached signature on a SHA-256 sidecar gives equivalent **integrity** (you can't tamper with the bundle without invalidating the signature) plus **authenticity** (the long-form fingerprint relayed out-of-band binds the public key to me).

## Provenance

- **Post-rebase SHA**: `<<POST_REBASE_SHA>>` — Vercel Production deployment `<<VERCEL_DEPLOY_ID>>` (status `<<PROD_DEPLOY_STATUS>>`).
- **Why this SHA**: `<<POST_REBASE_SHA>>` is the linearization of `[operator: fill in the per-release CSS/feature/fix narrative here, including the upstream baseline SHA `<<BASELINE_SHA>>` and the patches that were rebased away]`. The release notes are deliberately produced right downstream of that change to document the rendered-before / rendered-after evidence.
- **Empty commit `<<DROPPED_COMMIT>>`** was removed by the rebase; the CSS/style patches preserve identical trees.
- **Capture tooling**: `/tmp/full-page-shots.mjs` (Playwright 1.61 + bundled Chromium 1228) + `/tmp/visual-qa.py` (Pillow + numpy + tesseract 5.3.4 `deu+eng` OCR for keyword match).

## Bundle manifest SHA-256 (canonical)

| File | SHA-256 |
|---|---|
| `release-notes-bundle.tar.gz` | `<<BUNDLE_SHA256>>` |
| `HANDOFF.md` (this file) | _see `SHA256SUMS.txt` — it is the canonical signed sidecar_ |
