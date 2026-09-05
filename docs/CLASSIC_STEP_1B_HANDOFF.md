# Classic Step 1B — review handoff

**Local implementation complete; further Classic validation is required before Switch.** The refined game is ready for an observed flow/content pilot. The full product playtest still needs live OpenAI judging and an isolated Supabase stack. No human validation is claimed.

Review branch: `codex/classic-rework`, based on `97ed5d3`; all prior Step 1 work is preserved in the working tree. The [complete working-tree inventory](evidence/classic-step-1b/review-working-tree-files.txt) includes both review stages. No commit, push, merge, deployment, production migration, or recording publication was performed. No `AGENTS.md` exists in the repository or inspected parents. The Step 1 implementation prompt and previous handoff/review were read before work.

**Preview: http://127.0.0.1:3000/**. Ordinary play uses the explicitly labeled local fixture judge. Microphone capture, review, replay, retake, and local downloads are real browser operations. The live Scribe evaluation was a separate authorized provider run; it does not make preview scores live.

## What changed

- **Content with sharper premises:** reviewed all 72 originals, 36 directions, and six packs. Replaced 27 lines and refined 12 directions. New versions remove generic filler and repetitive endings while preserving funny Clean options and specific adult absurdity. [Every editorial decision](CLASSIC_STEP_1B_CONTENT.md) records comprehension, speakability, a contrast direction, and replay risks.
- **Recognizable text actually ships locally:** 14 reviewed phrases join the refined originals in active client/server selection, pack filters, canonical resolution, migration, and seed. Eight have creator/speaker/comic associations; six are distributed idioms. Individual text-use decisions replace the blanket pending-only policy. No imported media, character art, cloned voices, endorsements, or current-popularity claims.
- **Faster return to play:** content choices sit before the prompt; the shuffle control visibly says “New line.” The result places “One more round” and direct replay immediately after the verdict. Four dimension scores remain accessible in a disclosure; full playback follows the actions. Small packs reset their exclusion deck on exhaustion, preserving the current-line exclusion and all rating/pack/entitlement gates.
- **A real SQL validation path:** a locked, separate PGlite/pgTAP package executes the migration chain and tests without credentials or a remote database URL. This exposed and repaired a preexisting migration 007 generated-column defect and previously unexecuted test-fixture/signature defects.
- **Bounded live transcription and a ready human kit:** added a reproducible synthetic Scribe batch, retained the separate consented-human audio harness, and built a six-person facilitator guide, event log, and offline feedback form. The form excludes live feedback questions in fixture sessions and exports locally without network requests.

Primary changed-file references: `src/data/content.ts`, `classic-content-v2.ts`, `recognizable-content.ts`; `src/lib/server/content.ts`, `random-content.ts`; `src/components/game/game-experience.tsx`, `result-screen.tsx`; `src/components/landing/hero-demo.tsx`; `src/app/page.tsx`, `discover/page.tsx`; migration `202609050017_classic_content_v3.sql`, narrow repair in `202608250007_ranked_daily_entries.sql`, matching `supabase/seed.sql`; `scripts/local-db/`; `src/lib/server/scribe-batch.eval.test.ts`; `scripts/prepare-scribe-evaluation.py`; `e2e/classic-step-1b.spec.ts`; `docs/playtesting/classic-step-1b/`.

## Catalog and strongest combinations

**86 active lines / 36 directions / 6 packs.** The 72 refined originals remain 24 Clean / 18 Spicy / 30 Mature. Recognizable additions are 12 Clean / 1 Spicy / 1 Mature; total **36 Clean / 19 Spicy / 31 Mature**. Seventy-two lines are Free/rotating and fourteen remain in the existing Pro pack. Clean is the default; Mature requires explicit adult opt-in and remains private under server and database enforcement.


These are **editorial picks**, not player-validated rankings. The direction asks for an independent performance; a familiar source does not ask players to reproduce a creator’s voice. All twenty are actual compatible catalog combinations.

| #   | Line                                                                                   | Direction                                                                                                          | Content level |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------- |
| 1   | This is fine.                                                                          | Whisper a furious outburst with immaculate politeness. Keep every word audible.                                    | Clean         |
| 2   | It is Wednesday, my dudes.                                                             | Give flat, precise testimony. Pause before the most embarrassing detail; do not wink at the joke.                  | Clean         |
| 3   | My disappointment is immeasurable and my day is ruined.                                | Accept an award for this exact behavior. Sound moved, grateful, and completely unashamed.                          | Clean         |
| 4   | Was that the bite of '87?!                                                             | Read this as a vital instruction from an appliance manual. Give one absurd word painfully precise emphasis.        | Spicy         |
| 5   | Emotional damage!                                                                      | Make it a tender declaration of love. Commit especially hard to the least romantic word.                           | Clean         |
| 6   | I liked their old photo, panicked, and liked twelve more. It is an audit now.          | Speak softly and slowly, with the certainty of someone who has already won. No raised voice.                       | Clean         |
| 7   | I faked a phone call to avoid someone. My phone rang. I answered both.                 | Try painfully hard to sound casual. Add a tiny nervous laugh, then pretend you never made it.                      | Clean         |
| 8   | I have been screaming on mute for six minutes. The neighbors got the exclusive.        | Sound outrageously confident while holding back tears; let one word wobble, then recover.                          | Clean         |
| 9   | They leaned in for a kiss. I panicked and said my full legal name.                     | Accept an award for this exact behavior. Sound moved, grateful, and completely unashamed.                          | Clean         |
| 10  | I made a fake account to defend myself. It got bullied into agreeing with them.        | Give flat, precise testimony. Pause before the most embarrassing detail; do not wink at the joke.                  | Spicy         |
| 11  | I sent them the screenshot of me asking how to reply to them. They said "option two."  | Deliver a wounded hero’s final request. Keep the words clear and make the ending absurdly noble.                   | Spicy         |
| 12  | I said "no pressure" and sent three question marks. Separately.                        | Whisper an urgent secret to someone beside you. Be intense without raising your volume.                            | Spicy         |
| 13  | I am the healer. Say please or die with your fucking principles.                       | Whisper a furious outburst with immaculate politeness. Keep every word audible.                                    | Mature · 18+  |
| 14  | The donation robot just read my sext. It pronounced every fucking emoji.               | Brief someone on a crisis in a low, steady voice. Put urgency into the pace, not the volume.                       | Mature · 18+  |
| 15  | This breakup is sponsored. Use code ABANDONED for ten percent off my fucking mattress. | Leave a voicemail pretending everything is fine. Let the final few words give away how badly you need a call back. | Mature · 18+  |
| 16  | We are keeping it casual. I have met his wife.                                         | Start with a soft apology; become audibly proud halfway through, then pretend you did not.                         | Mature · 18+  |
| 17  | I tried to moan their name and said my own. Honestly? Best sex of my life.             | Accept an award for this exact behavior. Sound moved, grateful, and completely unashamed.                          | Mature · 18+  |
| 18  | I tried to send a nude and accidentally selected the printer. Dad is downstairs.       | Read the news with crisp professionalism. Let a laugh threaten one word, swallow it, and keep broadcasting.        | Mature · 18+  |
| 19  | I told everyone I could take two men at once. Apparently the context was important.    | Confess with total sincerity, as if this is the bravest thing you have ever admitted.                              | Mature · 18+  |
| 20  | Autocorrect changed "condolences" to "congratulations." I sent a fucking balloon.      | Make it a tender declaration of love. Commit especially hard to the least romantic word.                           | Mature · 18+  |

## Published recognizable phrases and source ledger

“Published” here means included in this local build's active catalog, not deployed externally. The [complete source ledger](CLASSIC_RECOGNIZABLE_LEDGER.md) records exact phrase, source/original-source distinction, speaker/context, caption or text verification, dated recognition evidence, rating, individual publication rationale, and unresolved limits. The same metadata is carried in catalog source records and migration 017.

Included IDs cover: **This is fine; immeasurable disappointment; Wednesday/my dudes; emotional damage; chat/is this real; bite of ’87; big brain time; let him cook; touch grass; weird flex; no thoughts/head empty; I like turtles; double rainbow; fuck around and find out.** This list abbreviates some titles for scanning; the ledger and catalog contain the exact playable wording.

Original-page visual inspection verified the comic phrase; actual source captions verified several creator clips, retaining automatic-caption limitations. Direct creator interviews and producer accounts support others. Dictionary/post attestations establish idioms without inventing a sole creator. These are editorial publication assessments, not legal clearance or a universal short-phrase exemption. Contemporary candidates received concrete decisions: 2024 “demure” has a specific branding/wording hold; Jet2's 2025 advertising tagline has a brand-use hold; 2025 “six seven” was omitted for thin performance range. Eight excluded candidates remain outside draws for stated reasons. Recognition and comedy value await players.

## Actual live evaluation

The owner approved **12 synthetic samples, no more than two minutes, expected under $0.02, capped at $0.10**, using only the existing restricted ElevenLabs key. No new credential, permission, plan, or billing change occurred.

| Measurement | Observed result |
|---|---|
| Origin | Local macOS Samantha synthetic speech plus seeded PCM transformations; no human or creator recordings |
| Prepared | 12 cases, 40.608 seconds total |
| Provider work | 11 Scribe v2 calls, 37.608 seconds; no automatic retries |
| Silence | Production validation returned `NO_SPEECH_DETECTED` locally; zero call for that case |
| Noise without speech | Live Scribe returned `NO_SPEECH_DETECTED` |
| Literal transcription | All 10 speech cases matched their spoken reference at 100 normalized word-edit accuracy |
| Mistakes retained | Omitted, substituted, and instruction-added takes compare at 80, 60, and 40 against the target line, respectively |
| Repeat | One identical-byte neutral repeat returned the same normalized words |
| Latency | 430–857 ms per provider attempt; median 494 ms |
| Usage estimate | $0.00418 at conservative $0.40/audio-hour; estimate, not a provider invoice |
| Real performance scores | **Zero** — no existing OpenAI key was available |

[Full synthetic receipt](evidence/classic-step-1b/scribe-live.json), [evaluation method and commands](JUDGING_EVALUATION.md), and [generator](../scripts/prepare-scribe-evaluation.py). The runner verifies hashes/path containment, count and duration before spending and marks the batch before its first request to prevent accidental reuse after uncertain completion. Future runs require fresh bounded authorization.

Quiet gain is not a human whisper, punctuation pauses are not deadpan acting, and digital clipping is not loud emotional performance. Scribe's literal transcription of an instruction does not prove the separate audio judge resisted it. No evidence here establishes funny vs flat discrimination, quiet-direction scoring, grounded coaching, accent fairness, real background-room performance, or score repeatability. The consented human manifest/harness and kit cover accurate expressive, flat, quiet/deadpan, true whisper, loud mismatch, errors, silence/unintelligibility, noise, alternate interpretations, and a repeated subset; those human cases remain unrun.

## Scoring and history compatibility

**No scoring semantic change in Step 1B.** Direct audio still goes to `gpt-audio-1.5` when configured. The audio judge's literal transcript still drives deterministic accuracy. Scribe is an independent companion transcript with `usedForAccuracy:false`. Live scale remains `delivery-voice-v1`, rubric `delivery-voice-v1.1`; the formula remains 30% commitment / 25% comedy / 25% accuracy / 20% chaos. Fixture scores remain visibly separate and excluded from comparable aggregates. These weights and perceptual behavior remain uncalibrated.

All v2 lines/directions and their Daily algorithm are frozen in `classic-content-v2.ts`; earlier data stays frozen in `legacy-content.ts`. Changed content receives new IDs. Migration 017 inserts new rows and retires replaced IDs from new draws without rewriting bodies, historical UUIDs, scores, challenge entries, or saved Daily assignments. Existing database Daily slots win unchanged; the bundled September 5 Daily remains v2, with v3 starting September 6. Short phrases cannot draw multi-beat or contrast directions requiring at least eight words. The seed uses conflict-do-nothing and preserves archived moderation state.

## Database and integration results

**17 migrations + seed; 517 pgTAP assertions across 21 files; 9 additive-upgrade invariants and 3 Mature preflight checks passed.** The integration owner reran the SQL suite independently. The [machine-readable report](evidence/classic-step-1b/database.json) includes engine, hashes, TAP, and timestamps; [database handoff](CLASSIC_STEP_1B_DATABASE.md) explains every boundary.

This executes actual PostgreSQL 18.3 WASM using PGlite 0.5.8, with explicit local Auth/Storage schema shims. Real role changes test private delivery/score RLS and denied browser writes. Nonempty upgrade snapshots preserve legacy/v2 text/UUIDs, Daily, challenges, entries, deliveries and scores; fresh/additive/seed counts agree. It is not the hosted Supabase engine or a real JWT/HTTP service.

| Path | Evidence level / outcome | Remaining dependency |
|---|---|---|
| Guest capture → replay → judgment UI → next/challenge | Real Chromium microphone APIs with synthetic signal and labeled fixture responses | Real microphone/device and live judge |
| Private submission / lost-response retries / duplicate prevention | Real local HTTP receipt smoke; mocked provider/API browser failures; SQL quota/idempotency and unit tests | Live signed-in HTTP + distributed cache/concurrency |
| Signed-in persistence and signed playback | Real RLS/SQL with synthetic users; UI account fixtures | Full isolated Auth/PostgREST/Storage stack, test keys/session, OpenAI key |
| Daily and friend challenge admission | Real SQL first-entry/privacy/block rules; canonical server contract tests and browser entry points | Test auth cookies and real HTTP round-trip |
| Mature choices/publication | Client consent + canonical server tests + real SQL trusted/browser write rejection and sticky Mature hold | Launch age/audience decision; no production publication enabled |
| Historical/retired references | Exact bundled lookup tests + additive SQL snapshot invariants + retired-link browser checks | Staging check of real preexisting rows before rollout |

The migration 007 repair replaces a non-immutable `convert_to` call in a generated hash with immutable `digest(text,text)` on the same normalized text. Unicode fixtures verify identical intended UTF8 hashing. It fixes fresh installs; it does not rebuild any existing remote column. Revised pgTAP overloads/fixtures preserve assertions and were necessary to execute tests previously reported as unrun. No production validation was weakened.

## Visual review and evidence

Before captures were made in this Step 1B run before the UI adjustments; catalog editing was already underway. The fixed Classic comparison uses unchanged line/direction IDs. These are UI comparisons, not a pristine old-catalog archive. All verdict screenshots are labeled fixtures.

| Flow step | Finding / current health | Before → after |
|---|---|---|
| 1 Landing | Clear Classic action; hero now includes a real recognizable phrase; pack copy no longer claims original-only content | [390 before](evidence/classic-step-1b/before/home-390.png) → [390 after](evidence/classic-step-1b/after/home-390.png) |
| 2 Prepare | Content choices visible before the line; record remains reachable; New line has visible text | [390 before](evidence/classic-step-1b/before/prepare-390.png) → [390 after](evidence/classic-step-1b/after/prepare-390.png) |
| 3 Record | Voice-only level/timer/stop preserved; synthetic capture and recovery tested | [390 before](evidence/classic-step-1b/before/recording-390.png) → [390 after](evidence/classic-step-1b/after/recording-390.png) |
| 4 Review | Local native playback and retake remain prominent; deliberate submission | [390 before](evidence/classic-step-1b/before/review-390.png) → [390 after](evidence/classic-step-1b/after/review-390.png) |
| 5 Verdict | Dimension details moved below actions; direct replay and next round immediately follow verdict | [390 before](evidence/classic-step-1b/before/result-390.png) → [390 after](evidence/classic-step-1b/after/result-390.png) |
| 6 Another round | Fresh exclusion cycle; same-direction retry and genuine take replay remain available | [1440 before](evidence/classic-step-1b/before/result-1440.png) → [1440 after](evidence/classic-step-1b/after/result-1440.png) |
| 7 Friend challenge | Exact pairing and content consent preserved; live creation blocked by absent test services | Covered by browser entry-point tests; no fake invitation |

Screenshots and browser checks cover 320, 390, 768, and 1440 pixels. [Actual downloaded share card](evidence/classic-step-1b/after/share-card-390.png) was inspected for complete text and fixture labeling. Screenshot checks do not establish full accessibility compliance or actual mobile hardware behavior. Keyboard focus, disclosure access, reduced motion, consent gates, silence, interruptions, and retry behavior have separate executable checks.

## Human playtest kit and actual results

[Facilitator guide](playtesting/classic-step-1b/FACILITATOR.md) · [offline feedback form](playtesting/classic-step-1b/feedback.html) · [event log CSV](playtesting/classic-step-1b/observations.csv).

Plan six participants, with two optional replacements, including solo players and at least two people uncomfortable on camera. The script covers landing through challenge, unaided recognition, confusing moments, skipped IDs/reasons, replay choices, privacy comprehension, comfort, and credible coaching. Acceptance counts and judging triage thresholds are explicitly proposed. The form exports local JSON; no answers upload or auto-save, and fixture sessions cannot export live-only feedback fields. Export verification used synthetic test answers that are not participant data.

**Actual human results: 0 participants, 0 sessions, 0 consented recordings.** Nobody was recruited or messaged. The kit distinguishes an immediately available flow/content pilot from the later live feedback test. No agent or synthetic-audio activity is counted as a human playtest.

## Exact checks

Commands used the bundled Node runtime; `node node_modules/...` corresponds to the repository npm scripts. Opt-in evaluation flags were absent from ordinary tests.

| Check | Exact command / scope | Outcome |
|---|---|---|
| Baseline unit suite | `node node_modules/vitest/vitest.mjs run` before Step 1B edits | 203 passed; 2 live evaluations skipped |
| Final unit suite | `node node_modules/vitest/vitest.mjs run` | **210 passed; 3 opt-in live evaluations skipped**, 30 passing files |
| Lint | `node node_modules/eslint/bin/eslint.js .` | Passed |
| Types | `node node_modules/typescript/bin/tsc --noEmit` | Passed |
| Production build | `node node_modules/next/dist/bin/next build` | Passed; 39 static pages; expected edge-runtime notice only |
| Full browser suite | `DELIVERY_EVIDENCE_DIR=docs/evidence/classic-step-1b/after PLAYWRIGHT_BROWSERS_PATH=/private/tmp/delivery-playwright PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 node node_modules/playwright/cli.js test --reporter=line` | **59 passed**, including all four widths, recording/recovery/filter/history/challenge/PNG contracts and offline form export |
| Final visual refresh | Same environment, `node node_modules/playwright/cli.js test e2e/classic-rework.spec.ts -g 'complete flow and evidence' --reporter=line` | **4 passed**; all core states/cards recaptured after account loading settled using a two-second synthetic take |
| SQL | `node scripts/local-db/run.mjs` | **517 assertions / 21 files; 17 migrations + seed; 9 upgrade + 3 Mature preflight checks passed**; final hashes recorded |
| Real local HTTP / mock judge | `DELIVERY_EVIDENCE_DIR=docs/evidence/classic-step-1b node scripts/verify-local-judge.mjs` | **2 real HTTP submissions passed; identical private receipt replayed; no persistence or provider call** |
| Live Scribe | `DELIVERY_SCRIBE_BATCH_MANIFEST=/private/tmp/delivery-scribe-1b/manifest.json DELIVERY_SCRIBE_BATCH_LIVE=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/server/scribe-batch.eval.test.ts` | 1 batch passed: 12 cases, 11 provider calls; scope detailed above |
| Post-review cost preflight | Same manifest with no live flag; second copy with `$0.001` cap | Normal preflight passed; reduced cap rejected before key lookup/run marker/network; zero new provider calls |
| Independent review | Seven focused suites plus source/history/code/evidence review | **81 tests passed**, 72+36 v2 texts independently matched migration 015; no substantive findings; cost-cap observation addressed and rechecked |
| Hygiene | `git diff --check`; exact secret comparison against production client chunks; ignored-file/permissions inspection | Clean diff; **0 secret matches in 77 bundles**; `.env.local` ignored and mode 0600 |

The first browser pass during concurrent source editing had two navigation/result failures (51/53 passed). After source changes finished, the entire suite passed. Two initial new tests also exposed test synchronization defects: reading the displayed fallback before the initial fetch settled, and stopping synthetic capture before enough samples arrived. They now wait for the actual initial draw and recording timer; their original uniqueness/playback/viewport assertions remain. Final visual capture additionally waits for account loading to finish before saving a screenshot.

[Independent review](CLASSIC_STEP_1B_REVIEW.md), [verification summary](evidence/classic-step-1b/verification.json), [credential hygiene](evidence/classic-step-1b/credential-hygiene.json), and [cost-preflight evidence](evidence/classic-step-1b/cost-preflight.json).


## Run again and remaining dependencies

Do not overwrite the existing ignored `.env.local`. To start this review on the current machine:

```bash
cd /Users/christopherassef/Documents/ChatGPT/Delivery
export PATH=/Users/christopherassef/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
DELIVERY_AI_MODE=mock DELIVERY_AI_ALLOW_MOCK_FALLBACK=true \
  NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000 \
  node node_modules/next/dist/bin/next dev --turbopack --hostname 127.0.0.1
```

On a normally configured Node 20.11+/npm machine use `npm ci`, then the same environment with `npm run dev -- --hostname 127.0.0.1`. For isolated SQL: `npm ci --prefix scripts/local-db --ignore-scripts`, then `node scripts/local-db/run.mjs`. This runner accepts no remote URL and creates only disposable in-memory databases.

Remaining concrete dependencies:

1. **Existing authorized OpenAI key:** absent from this process/local environment. The signed-in Platform browser tab is not an accessible server credential. No new key was created. Configure an already authorized key securely for the live judge, disable fixture fallback, then approve a bounded evaluation. Do not paste keys into chat or commit them.
2. **Full isolated Supabase services:** absent local Docker/Supabase toolchain and no designated test project/keys. Supply a disposable local stack or explicitly designated test environment with Auth redirects, private Storage buckets, URL/anon/service-role configuration, and test accounts. Run actual signed-in capture/judge/persist/playback, Daily/challenge admission, lost-response retry, and distributed idempotency there.
3. **Human consent and devices:** collect the kit's 5–8 participant sessions and separately consented evaluation recordings. Real iOS Safari, Android Chrome, desktop Safari/Firefox, headset/device switches, actual whispers and room noise remain untested.
4. **Launch policies and staging rollout:** decide age/audience policy (opt-in is not verified-age assurance), provider retention/disclosures, and territory/use-specific content review. Review migration 007's existing column if already deployed; apply additive 014, commit before 015, then 016 and 017 in staging. Preserve the prior 15-minute idempotency rollout boundary. Migration 016 still fails if preexisting public Mature Storage pointers need cleanup; no production objects were removed here.

**Recommendation: further Classic work required before starting Switch**, specifically live scoring evidence, full signed-in integration, and human validation. The authorized local implementation, source curation, SQL validation, synthetic live transcription, and playtest preparation are reviewable now; proceed with a clearly labeled flow/content pilot while obtaining the remaining test infrastructure.

The root model/reasoning setting is not exposed. Content, source research, database, and independent review subagents were explicitly run as **GPT-6 Astra / ultra**, the highest offered configuration. The root integrated their work and independently verified the product.
