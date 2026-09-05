# Classic Step 1B independent review

Reviewed September 5, 2026, on the uncommitted `codex/classic-rework` working tree. This review covers the changes added after the initial Classic rework: the frozen v2 snapshot, v3 editorial replacements and recognizable text, migration 017 and seed, local SQL evidence, revised prepare/result layout and exclusion deck, bounded Scribe batch, and offline human-playtest kit. The earlier review remains in [CLASSIC_REWORK_REVIEW.md](CLASSIC_REWORK_REVIEW.md).

**No new substantive findings were identified in this bounded review.** No implementation file was changed by the reviewer. No credentials were read, provider calls made, human recordings collected, or external state changed. A separate read-only subreview inspected the Scribe batch and feedback export.

## Independent checks

| Area | Evidence inspected and outcome |
| --- | --- |
| Historical content | Compared every frozen v2 line and direction against migration 015: **72 line texts and 36 direction texts match exactly**. Focused tests also compare every historical object with the active lookup, count the 27 retired line identities and 12 retired direction identities, and preserve the September 5 bundled Daily. |
| Additive data | Migration 017 inserts new identities without updating conflicting prompt bodies, directions, or moderation state. Its catalog block matches the seed. Retirement targets only the replaced v2 IDs. No retired Step 1B identity remained in non-test runtime source outside the historical snapshot at the review checkpoint. |
| Ratings, access, compatibility | Reviewed Clean/Spicy/Mature filtering, Pro membership, canonical resolution, friend-challenge admission, and the short-line rule in client selection, runtime database selection, and SQL Daily generation. The recognizable subset participates in those same controls. Focused tests passed for retired new-round rejection, active short-line compatibility, historical resolution, and publication boundaries. |
| Source and publication claims | The 14 source records separate exact wording evidence, source/coinage uncertainty, dated recognition evidence, and individual text-use decisions. Caption verification is identified as captions rather than listening; later recollections and distributed idioms retain their limitations. The ledger does not claim creator permission, worldwide legal clearance, measured player recognition, current popularity, or imported audiovisual assets. This reviewer inspected the records and their serialization, but did not repeat every browser transcript export or independently provide legal clearance. |
| SQL integration | Inspected the disposable runner, Auth/Storage shims, real role changes in RLS tests, upgrade snapshots, and recorded TAP output. The report identifies **517 assertions in 21 files**, 17 migrations, nine upgrade checks, and three Mature preflight checks. The narrow migration 007 repair removes the non-immutable conversion from the generated hash; the added UTF8 comparison retains intended normalized bytes. Existing test repairs address assertion signatures or valid fixture setup. The integration owner owns execution of this SQL run; this reviewer did not rerun the entire database suite. |
| Prepare/result/replay | Inspected the current component code and `after/prepare-320.png` and `after/result-390.png` under `evidence/classic-step-1b`. Content controls precede the assignment; next round and direct replay precede secondary result details. Native disclosure retains the four score dimensions. Fixture labeling remains explicit. Reviewed the new exclusion-deck reset and its browser regression. |
| Scribe evidence | The saved report contains **12 synthetic cases, 11 provider calls, and 37.608 seconds submitted**. Silence was rejected locally; noise-only was counted as a provider call and rejected by the server parser. Ten successful transcripts score 100% against their own literal references. The reference for deliberately wrong/omitted/instruction words remains distinct from the target line. This is transcription evidence, not live performance judging. |
| Batch and playtest privacy | All fixture hashes/paths and waveforms are checked before network calls; measured per-file and aggregate audio are bounded; the estimated cost must fit the configured dollar limit before key lookup, the one-shot marker, or any provider call. The atomic marker prevents repeating the same batch; uncertain/failed requests are counted and not retried. The offline feedback page uses no network or persistent browser storage and excludes disabled live-judge fields from fixture exports. No participant observations are fabricated. |

Independent test command:

```bash
/Users/christopherassef/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  node_modules/vitest/vitest.mjs run \
  src/lib/content/content.test.ts \
  src/lib/server/content-resolution.test.ts \
  src/lib/server/random-content.test.ts \
  src/lib/server/elevenlabs.test.ts \
  src/lib/server/judge-retry.test.ts \
  src/lib/server/challenge-creation.test.ts \
  src/lib/server/content-publication.test.ts
```

**7 files / 81 tests passed**, September 5, 2026. No opt-in live evaluation was enabled. The integration owner's full browser, lint, type, build, and SQL outcomes belong in the Step 1B handoff rather than being represented as independent executions here.

## Evidence limits

The completed Scribe batch's estimated cost is **$0.00418** at its stated $0.40/audio-hour basis; it is not a billing receipt. Its approved $0.10 ceiling is comfortably bounded by the two-minute audio limit under that estimate. The review's nonblocking observation that smaller custom dollar limits were only recorded is **addressed**: the harness now compares the conservative estimate for all prepared audio with `costLimitUsd` before any live action. An independent repeat of the network-disabled preflight passed at $0.10 and rejected at $0.001 with the expected dollar-limit error; neither created a run marker. No further paid request was made. This enforces the stated price estimate, not an independent provider billing ceiling.

The PostgreSQL WASM run supplies real SQL behavior with explicit boundary shims. It does not establish hosted Supabase Auth/JWT, PostgREST, Storage upload/signing, concurrent transactions, or a signed-in browser recording-to-persistence flow. The synthetic Scribe batch establishes neither OpenAI scoring quality nor human acting/comedy/accent performance. Real devices, consented human playtests, calibrated judging, and full-stack release checks remain the separately documented work. This review is not a finding that the entire application is defect-free or ready for production deployment.
