# Classic Step 1C — implementation and validation handoff

**Engineering fixes completed; Classic's live validation gate remains blocked by named external dependencies.** No Say It Back, groups/streamer expansion, or Switch work was started. This is not a claim of full Classic validation or production readiness.

## 1. Exact starting point and delivery state

- Repository: `chrisA-cyber/Delivery`.
- Branch: `codex/classic-step-1c`.
- Freshly fetched starting `main`: `c74baddcc93783490ec636291cc5b03397bdaa7b`; clean checkout. It was still the latest main when work began.
- Final implementation commit: `8d2c3c982804866d3efdd0a121635666b7d9154b`. The following documentation-only commit contains this handoff and evidence. The GitHub connector uploaded the same validated implementation tree (`c246c316819ef1460ce4b43365a7c6fc24083a44`); direct shell push was unavailable because it had no GitHub credentials. Review the complete branch diff with `git diff c74baddcc93783490ec636291cc5b03397bdaa7b..codex/classic-step-1c`; no application code changed after the implementation commit.
- No `AGENTS.md` was present in the repository or inspected workspace parents. Read the roadmap, Step 1B handoff/review, judging evaluation, architecture, environment, Supabase, go-live documentation, relevant implementation/tests, and recorded evidence.
- Step 1B's catalog, 17 migrations, historical identities, 86 active lines, 36 directions, six packs, and prior evidence were preserved. No database migration, production fixture, service provisioning, subscription change, or deployment was performed.

## 2. What changed and why

| Demonstrated gap | Completed change |
| --- | --- |
| Live mode silently returned demo scores when the OpenAI key was absent, even with fallback disabled | Missing-key live mode now returns a configuration error. Only explicitly requested local demo/fallback remains possible. Real HTTP verification returned 503 with no score. |
| Configured demo sessions could upload mock scores into provider-agnostic SQL progression/Daily triggers | New mock judgments never enter durable delivery/score storage, Daily claims, or challenge entries. Publication is skipped. The player is told the take is not saved to their account and does not count competitively. Browser-local demo history remains available. |
| History, public results, and friend matchups had no recovery when signed audio failed | Added a small shared playback control with an explicit **Reload playback** action. History/public recovery reuses existing authorization routes; a matchup reload repeats its existing server checks. Failures remain understandable and bounded. |
| The owner playback route could mint a new URL after account deletion began | Added the existing account-deletion gate before lookup/signing. Legitimate owner access otherwise remains unchanged. Previously issued URLs retain their original expiry/object-deletion behavior. |
| The human judging harness lacked an explicit request budget and useful interruption/repeat records | Extended the existing harness with request-ceiling preflight, dispatch counting including repairs/Scribe, one-run marker, private incremental checkpoints, hashes, provider usage, and identical-recording score/feedback variation summaries. Expanded existing case template rather than creating a replacement study. |
| Prior roadmap still said the Step 1B report had not arrived | Recorded the received/reviewed implementation and evidence; added Step 1C and retained the confirmed phase order. Environment documentation now correctly describes demo labeling and signed URL expiry. |

No score recalibration was implemented. Existing score rows, words behind historical IDs, Daily assignments, challenge identities, privacy rules, and entitlements were not rewritten. Existing stored demo rows, if any exist in an older test project, are not retroactively repaired; use a fresh disposable database for the connected validation run.

## 3. Environment and real-service boundary

Node/npm and FFmpeg worked; `npm ci --no-audit --no-fund` completed. No OpenAI, Scribe, Supabase test, or distributed-cache credentials were available. No consented recordings, participants, or physical devices were supplied.

Docker/Podman/Supabase/PostgreSQL executables and Docker sockets were absent. Container privileges were unavailable; the user-namespace probe was rejected. Installing a Docker binary alone would not make a disposable Supabase stack runnable here. The [integration evidence](evidence/classic-step-1c/integration.md) records these checks.

**Real external OpenAI/Scribe/Supabase services validated in Step 1C: none.** Real Next.js HTTP routes were exercised in an isolated local process tree. Mock results, bundled data, service mocks, and prior SQL evidence remain explicitly separate.

## 4. Actual judging evidence

| Measurement | Step 1C result |
| --- | --- |
| Live OpenAI / Scribe requests | **0 / 0** |
| Provider spend / estimated cost | **$0** for this assignment; no paid evaluation run |
| Human recordings / participants | **0 / 0** |
| Local transport sample | One-second generated 440 Hz PCM and zero-valued PCM silence; neither is human speech |
| Live score repeatability, latency, feedback grounding | **Unmeasured** |
| Quiet/deadpan success, loud-direction mismatch, alternate interpretations | **Unmeasured** |
| Word errors, background noise/unintelligibility, spoken judge manipulation | Contract/template coverage exists; real OpenAI perception remains **unmeasured** |
| Human enjoyment, recognition, accent fairness | **Unmeasured** |

The path remains: waveform → optional separate Scribe transcript → OpenAI audio performance judgment and its literal transcript → deterministic word accuracy → unchanged weighted result. Scribe stays `usedForAccuracy:false` and is not passed into the OpenAI judge. Live scale remains `delivery-voice-v1`, rubric `delivery-voice-v1.1`; the formula remains **30% commitment / 25% comedy / 25% accuracy / 20% chaos**. Demo scale stays `delivery-demo-v1`.

There is insufficient evidence to change restrained-direction weighting or historical comparability. **Calibration remains unresolved.** The inherited Step 1B Scribe batch was synthetic transcription evidence, not new Step 1C work or acting-quality validation.

The updated template contains 16 cases expanding to 20 attempts, including selected identical-byte repeats. Its worst case is 40 OpenAI requests, or 60 total when Scribe is included. **These are planning bounds, not spending authorization.** A smaller initial subset is supported. The owner must approve a request ceiling before live use; `DELIVERY_EVAL_MAX_PROVIDER_REQUESTS` enforces it including repairs. Reports record available token usage/duration for estimating monetary cost with then-current prices and reconciling uncertain responses. No hard dollar cap is claimed.

See [judging evidence and exact commands](evidence/classic-step-1c/judging.md) and [the existing evaluation guide](JUDGING_EVALUATION.md). The example's unapproved consent flags intentionally fail preflight; no consent was invented to make it pass.

## 5. HTTP, account, Storage, and access evidence

| Requested flow | Evidence obtained | Still required |
| --- | --- | --- |
| Guest judge and another round | Real local HTTP mock transport and bundled draws; browser evidence below | Human microphone and live provider |
| Lost-response retry / concurrent duplicate | Seven judge POSTs produced five successes representing two receipts; usage stayed 1/2 on exact replay. Changed body returned 409. One-process HTTP, not TCP fault injection | Signed-in durable save and cross-instance/cache recovery |
| Silence and provider configuration failure | Actual waveform rejection: 422 `NO_SPEECH_DETECTED`. Separate live-no-key request: 503 `SERVER_NOT_CONFIGURED`, no invented result | Real unintelligibility/noise, provider outages, live failure/refund behavior |
| Signed-in save → history → signed playback | New owner-deletion guard and playback-recovery contract tests pass | Actual Auth/PostgREST/Storage round-trip with live judge → save |
| Daily admission and assignment preservation | Repeated bundled Daily HTTP reads agree; prior SQL tests remain historical evidence | Existing isolated database assignments, first scored claim, practice admission |
| Friend creation → recipient → attempt → result | Existing contracts retained; prepared connected script covers creation/open/mock admission | Real two-account durable completion and access/concurrency boundaries |
| Private/unauthorized audio | Unconfigured route fails closed; owner guard tested with mocked services | Actual JWT, RLS, private Storage, expiry/refresh and unauthorized sessions |
| Mature and retired content | Existing content/privacy tests pass; no identity/catalog/migration changes | Full connected sharing/feed/challenge/direct-URL matrix and staging historical rows |

`scripts/verify-supabase-http.mjs` is an opt-in **loopback-only** runner using disposable test users and cleanup. When supplied with local services it exercises application HTTP, real cookie Auth, PostgREST, and Storage; synthetic durable receipts are explicitly direct setup fixtures, not proof of judge → save. Here its preflight exited 1 before service activity. The [receipt](evidence/classic-step-1c/supabase-http.json) says `blocked-preflight`, zero checks, and no sample executed. It must be run and any discovered defects fixed before claiming connected integration.

No SQL changes were made, so the prior 517-assertion WASM suite was not rerun. Those prior Auth/Storage shims do not establish real Supabase HTTP or concurrent transactions.

## 6. Browser, preview, and human play

The production build succeeds. A local preview can be started using the exact command in the [Step 1C owner guide](playtesting/classic-step-1c/README.md). It uses real local capture/replay and a labeled demo judge. No externally hosted preview or deployment was created; `127.0.0.1` must be opened on the machine running the app.

**Nine focused existing browser tests passed in 49.2 seconds.** Fresh home, prepare, recording, review, judging, and result screenshots plus downloaded cards were captured at 390 and 1440 pixels; next-round/replay visibility also passed at 320 pixels. The recording direction remains readable and immediate replay/retry/next-round actions are clear. No observed defect justified a catalog rewrite or broad redesign. The integration owner also visually inspected the mobile recording and result captures.

[Browser evidence and exact command](evidence/classic-step-1c/browser.md) records the initial browser-download failure and recovery using a temporary Chromium 149 package, with no repository dependency change. This is responsive headless browser emulation with synthetic media and mocked judging, not iPhone/Android/Safari or physical microphone validation. Playback component tests use simulated errors and mocked refresh responses; they do not prove Supabase expiry.

**Human results: zero sessions, zero consented recordings.** Reused the existing six-person facilitator guide, offline feedback form, and event CSV. The concise Step 1C session asks for unaided comprehension, recognition and skipped IDs, voluntary replay/retries before prompting, privacy understanding, and live-only feedback credibility. A demo flow/content pilot can run immediately on the owner's local browser. A complete feedback/challenge session requires live judging and isolated accounts.

## 7. Commands and verification

Run from the repository root. No paid evaluation flag was enabled.

| Command | Actual outcome |
| --- | --- |
| `npm ci --no-audit --no-fund` | Passed; no dependency/lockfile change |
| `npm test -- --reporter=dot` | 221 passed; 3 live evaluations skipped at the root verification checkpoint |
| Focused judging suites listed in `judging.md` | 29 passed; 1 live evaluation skipped, including final telemetry changes |
| `npx vitest run src/lib/server/demo-persistence.test.ts` | 3 passed; mock Classic/Daily/challenge never instantiate Storage/database clients |
| Owner playback route suite | 2 passed; deletion rejection and legitimate five-minute owner signing |
| SavedAudio + challenge component suites | 5 passed; explicit refresh, rejection, StrictMode, Mature teardown |
| Nine selected existing Playwright tests, command in `browser.md` | 9 passed; desktop/mobile flow, replay/next round, same-take retry, rehearsal, microphone-error recovery; 14 fresh image files |
| `npm run lint` | Passed; subsequently added scripts/component changes also passed focused ESLint |
| `npm run build` | Passed, including type/lint checks and 39 static pages; expected Edge static-generation notice |
| `DELIVERY_HTTP_START_LOCAL=1 DELIVERY_EVIDENCE_DIR=docs/evidence/classic-step-1c node scripts/verify-local-judge.mjs` | 10 checks passed, 7 judge POSTs; actual HTTP, synthetic PCM, mock judge |
| Same command with `DELIVERY_HTTP_LIVE_NO_KEY=1` | 1 actual judge POST returned expected 503/no result; zero provider requests |
| `DELIVERY_SUPABASE_HTTP_TEST=1 node scripts/verify-supabase-http.mjs` | Blocked preflight, exit 1; zero connected checks. `node --check` passed |
| Example consented-manifest preflight | Expected rejection of unapproved consent before audio/provider processing |
| `git diff --check` | Passed |

The whole unit suite was not repeatedly rerun for evidence counts; later changes received focused checks. An independent implementation review found no material regression; its demo-history wording correction was applied. Test completion does not imply live perceptual quality or production readiness.

## 8. Remaining issues by product impact and recommendation

1. **High — live judging credibility and calibration:** direction fit, quiet/loud behavior, transcript accuracy, specific coaching, injection resistance, repeat variation, latency, and cost still need consented samples and authorized live evaluation.
2. **High — connected persistence and competitive access:** actual isolated Supabase HTTP, signed-in judge/save, Daily claims, friend completion, private/Mature boundaries, and multi-session/distributed retry behavior remain unvalidated.
3. **High product uncertainty — human enjoyment/retry motivation:** run the prepared observed session and existing cohort, record skipped pairings and contrary evidence, then make only demonstrated content/flow changes.
4. **Medium — physical devices:** real iOS Safari, Android Chrome, and desktop microphone/permission/interruption/playback tests remain owner-run. Emulation does not close this gate.

**Recommendation: blocked from declaring Classic validated or advancing the sequence to Say It Back by issues 1–2, with issues 3–4 also outstanding.** The engineering changes and test preparation are complete enough for the next bounded validation session; further unobserved polishing is not recommended.

**Smallest next step:** use this branch on a Docker-capable validation machine, start/reset disposable local Supabase, configure its generated test keys and an existing authorized OpenAI key securely, and run the prepared HTTP harness. Then approve one small consented audio batch and conduct the first observed session using the existing kit. Keep production untouched, return the actual receipts/findings, and fix only failures they demonstrate.
