# Classic rework — local review handoff

**Review build: `codex/classic-rework`, based on `97ed5d3`.** The redesigned Classic loop, replacement catalog, supporting site, and ElevenLabs Scribe v2 integration are implemented locally. The working tree is the review artifact; nothing was pushed, merged, deployed, or migrated in production. Existing untracked `docs/DELIVERY_2_ROADMAP.md` and `docs/prompts/` were preserved.

Open **http://127.0.0.1:3000/**, then Play Classic. The local preview deliberately uses an explicitly labeled fixture judge because OpenAI and Supabase are not configured here. Recording, WAV capture, playback, retake, submission, retry, filtering, and card download are real local interactions. Scribe credentials and its batch transcription contract were separately verified with one live synthetic-speech request.

## What changed and why

- **A stage built around the assignment.** Warm paper line cards, mint directions, coral actions, Barlow Condensed display type, and DM Sans body type. Both fonts are self-hosted. The shared shell, tokens, controls, navigation, focus, responsive spacing, and reduced-motion behavior connect the home, Classic, packs, Daily, challenges, profiles, rankings, settings, pricing, legal/account pages, and host stage.
- **A substantially different catalog.** 72 original lines, 36 playable directions, six coherent packs. Clean is the default; Spicy adds sharper material; Mature requires an explicit 18+ opt-in. The server independently checks the canonical content rating. Small decks cycle after exhaustion without immediately repeating the current line, and direction compatibility and recent exclusions remain enforced.
- **A complete voice loop.** Mic-off/permission/error states, real signal levels, clear stop controls, a 20-second capture limit, immediate local playback, optional private rehearsal, retake, original WAV download, deliberate private submission, clear waiting, an entertaining result hierarchy, direction-specific coaching, replay, same-direction retry, next round, and working friend challenge entry points. No camera permission is requested.
- **Recovery that keeps the take.** Silence and unusably short audio cannot submit. Quiet usable audio remains valid. Interruption/backgrounding preserves captured audio; resources close on stop/reset/unmount. Failed submission retains the original blob and retry key. Duplicate clicks do not create duplicate judgments. Completed challenge receipts and Daily receipts across midnight can replay after a lost response without admitting a new invalid attempt.
- **Honest results and sharing.** No invented live activity, users, endorsements, demo rankings, or automatic publication. Mock scores are labeled and excluded from comparable local profile/Hot Streak statistics and new XP. Downloaded cards include the complete line, direction, score, content/fixture labeling, and no audio. Existing signed-in publishing still uses authorization and moderation; Mature publication stays blocked in both the API and database until a public audience policy exists.
- **Scribe v2 on the server.** Submitted audio can receive a companion literal transcript and word timestamps; tapping a word replays that moment. Credentials remain server-only. Scribe is separate from direct-audio performance perception and legacy accuracy, so adding it does not silently create a different leaderboard scale.

The integration owner retained Next.js/React, Supabase, storage/auth, moderation, billing, entitlement, Daily, challenge, and idempotency infrastructure. No later Switch/video/live multiplayer feature or fake future button was added. Existing Hot Streak and Impossible routes remain accessible. Host mode still requires the existing Pro entitlement and is operated by the host; Delivery does not collect remote audience votes.

Primary implementation references:

- `src/components/game/game-experience.tsx`, `result-screen.tsx`, `judging-loader.tsx`, `daily-drop.tsx`
- `src/hooks/use-audio-recorder.ts`, `src/lib/audio-capture.ts`, `src/lib/share-card.ts`
- `src/app/page.tsx`, `src/app/globals.css`, `src/components/shell/`, `src/components/content/`
- `src/data/content.ts`, `src/data/legacy-content.ts`, `src/lib/server/content.ts`, `random-content.ts`
- `src/lib/server/elevenlabs.ts`, `openai.ts`, `src/app/api/judge/route.ts`, `src/lib/server/content.ts`
- `src/lib/server/account-history.ts`, `content-publication.ts`, `src/lib/profile-statistics.ts`
- Additive migrations `202609050014` through `202609050016`

The exact tracked/new implementation files are listed in [changed-files.txt](evidence/classic-rework/changed-files.txt). Supporting route ownership and screenshot notes are in [the supporting evidence log](evidence/classic-rework/after/supporting/README.md).

## Play and reproduce

With Node 20.11+ and npm installed:

```bash
cd /Users/christopherassef/Documents/ChatGPT/Delivery
npm ci
DELIVERY_AI_MODE=mock DELIVERY_AI_ALLOW_MOCK_FALLBACK=true \
  NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000 npm run dev -- --hostname 127.0.0.1
```

On this machine, the bundled runtime can restart the preview without npm on PATH:

```bash
cd /Users/christopherassef/Documents/ChatGPT/Delivery
export PATH=/Users/christopherassef/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
DELIVERY_AI_MODE=mock DELIVERY_AI_ALLOW_MOCK_FALLBACK=true \
  NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000 \
  node node_modules/next/dist/bin/next dev --turbopack --hostname 127.0.0.1
```

For a quick review: play Classic, record and replay, retake, submit, save the card, retry the same direction, then draw another round. Switch content on the prepare screen; Mature asks for explicit adult consent. Try a four-line Clean pack for more than four draws. Follow Challenge a friend to retain the chosen line and direction. Use Daily to inspect the first-score rules. Discovery, account configuration notices, real empty feed/rankings, and Pro gates remain truthful without live services.

The authorized ElevenLabs development key is already saved in ignored `.env.local` with mode `0600`, along with `DELIVERY_TRANSCRIPTION_PROVIDER=elevenlabs`. It has only Speech to Text access and a 10,000-credit cap; no plan change was made. An unsuccessful first credential transfer was replaced and its key disabled; the existing Clipping production key was untouched. The key is never included in this handoff. To enable the complete live loop later, provision the remaining authorized server configuration, set `DELIVERY_AI_MODE=live` and `DELIVERY_AI_ALLOW_MOCK_FALLBACK=false`, and run the live checks in an isolated environment. The preview's mock mode intentionally skips all provider calls during ordinary play.

## Visual evidence

Before evidence captures the original UI after the new content had already been integrated; it is **not** a pristine old-catalog snapshot. All judged screenshot results use explicitly labeled local fixtures. Supporting account/Pro screenshots identify the mocked API data. No screenshots contain credentials or actual third-party recordings.

| View | Before | After |
|---|---|---|
| Desktop home | [1440](evidence/classic-rework/before/home-1440.png) | [1440](evidence/classic-rework/after/home-1440.png) |
| Mobile home | [390](evidence/classic-rework/before/home-390.png) | [390](evidence/classic-rework/after/home-390.png) |
| Desktop prepare | [1440](evidence/classic-rework/before/prepare-1440.png) | [1440](evidence/classic-rework/after/prepare-1440.png) |
| Mobile recording | [390](evidence/classic-rework/before/recording-390.png) | [390](evidence/classic-rework/after/recording-390.png), [320](evidence/classic-rework/after/recording-320.png) |
| Desktop review | [1440](evidence/classic-rework/before/review-1440.png) | [1440](evidence/classic-rework/after/review-1440.png) |
| Mobile review | [390](evidence/classic-rework/before/review-390.png) | [390](evidence/classic-rework/after/review-390.png) |
| Desktop judging | [1440](evidence/classic-rework/before/judging-1440.png) | [1440](evidence/classic-rework/after/judging-1440.png) |
| Desktop result | [1440](evidence/classic-rework/before/result-1440.png) | [1440](evidence/classic-rework/after/result-1440.png) |
| Mobile result | [390](evidence/classic-rework/before/result-390.png) | [390](evidence/classic-rework/after/result-390.png) |
| Downloaded share card | — | [Actual PNG](evidence/classic-rework/after/share-card-1440.png) |

The final capture suite writes home/prepare/recording/review/judging/result and downloaded cards at **320, 390, 768, and 1440**. The actual PNG was opened and inspected for correct content, complete direction text, score, and clipping. Sixteen additional supporting screenshots show discovery, friends, Stream setup, profile, settings, pricing, feed, and leaderboard at 390/1440; browser overflow assertions also cover those flows at 320/768.

## Editorial slate and quote research

**72 lines / 36 directions / 6 packs**. Ratings: **24 Clean, 18 Spicy, 30 Mature**. Sixty lines retain Free/rotating access and twelve are in the retained Pro pack. Every line is original in this release; **zero sourced quotations were cleared for publication**. The separate research ledger has seven candidates, four phrase-level primary-source verifications, and explicit wording/permission holds. No popularity or recognition claim was inferred from an old clip's existence.

The twelve selected pairs and full source/rights ledger follow in [CLASSIC_CONTENT_V2.md](CLASSIC_CONTENT_V2.md). The catalog's editorial center is specific confessions, failed boasts, streamer/gaming embarrassment, social disasters, profanity, and adult jokes in the explicit setting—not generic office prompts. Original content ships independently of unresolved creator clearance.


These are actual catalog strings, selected during implementation and carried into the finished catalog. Pairings demonstrate the tonal range; they do not force a single interpretation.

| # | Line | Direction | Rating |
|---|---|---|---|
| 1 | I made a fake account to defend myself. It got bullied into agreeing with them. | Give flat, precise testimony. Pause before the most embarrassing detail; do not wink at the joke. | Spicy |
| 2 | This apology is sponsored by the consequences of my own bullshit. | Start with a soft apology; become audibly proud halfway through, then pretend you did not. | Mature 18+ |
| 3 | I tried to send a nude and accidentally selected the printer. Dad is downstairs. | Brief someone on a crisis in a low, steady voice. Put urgency into the pace, not the volume. | Mature 18+ |
| 4 | I am the healer. Say please or die with your fucking principles. | Whisper a furious outburst with immaculate politeness. Keep every word audible. | Mature 18+ |
| 5 | I have been screaming on mute for six minutes. The neighbors got the exclusive. | Sound outrageously confident while holding back tears; let one word wobble, then recover. | Clean |
| 6 | I faked a British accent on a first date. We have been married six fucking years. | Confess with total sincerity, as if this is the bravest thing you have ever admitted. | Mature 18+ |
| 7 | My mom asked what I do for work. I showed her the clip. She said, "Besides that." | Keep a completely level voice until one important word; crack emotionally there, then go flat again. | Clean |
| 8 | I said "get fucked" to the boss. My date thought I was talking to them. | Record the voice note like it took eight attempts to sound casual. Hide nerves under a breezy finish. | Mature 18+ |
| 9 | They leaned in for a kiss. I panicked and said my full legal name. | Accept an award for this exact behavior. Sound moved, grateful, and completely unashamed. | Clean |
| 10 | Autocorrect changed "condolences" to "congratulations." I sent a fucking balloon. | Report breaking news professionally while an increasingly obvious laugh threatens your composure. | Mature 18+ |
| 11 | I used push-to-talk to fart. I need to leave this server and start a new life. | Deliver a wounded hero’s final request. Keep the words clear and make the ending absurdly noble. | Mature 18+ |
| 12 | I called an emergency family meeting. Nobody is allowed to ask why my eyebrows are missing. | Speak softly and slowly, with the certainty of someone who has already won. No raised voice. | Clean / Pro pack |

## Quote shortlist and publication ledger

Research separated **source identity**, **exact wording evidence**, and **permission to publish**. A real source or attribution alone is not permission. Source pages below were retrieved through web search; creator-owned title/description text was visible. The tools did not provide reliable full video playback/transcripts, so timestamp/audio-dependent candidates are explicitly pending instead of being called verbatim verified. No current-popularity claim or activity count is made. Familiarity is an editorial hypothesis to test with the intended audience.

| Candidate excerpt | Attribution and primary source | Wording verification / provenance | Publication status and performance hook |
|---|---|---|---|
| “It is Wednesday, my dudes.” | Jimmy Here, [creator's own upload](https://www.youtube.com/watch?v=du-TY1GUFGk), published April 9, 2016 | Exact words appear in the creator-owned title; comma/case are editorial punctuation. This verifies the short phrase, not an added scream transcript. | **Hold: permission unconfirmed.** Good with grave, whispered urgency. Recognizable weekly announcement format; recognition not tested. |
| “Yeah, this is big brain time.” | Markiplier, [own Among Us upload](https://www.youtube.com/watch?v=lc58Lwd_CYQ), published November 8, 2020 | Exact wording in the creator-owned title. This later title is an authenticated reuse; it is **not claimed as the original clip**. | **Hold: permission unconfirmed.** Good as a tearful boast. Creator catchphrase, not a requested voice imitation. |
| “I like trains.” | TomSka / Thomas Ridgewell; music credited to Todd Bryanton; [creator-owned song upload](https://www.youtube.com/watch?v=hHkKJfcBXcw), September 23, 2011 | Three-word excerpt verified against the lyrics supplied in the official video description. This source verifies the phrase, not authorship of every earlier performance. | **Hold: text/music/character clearance unconfirmed.** Short line would receive a single-state direction such as painfully sincere, never a three-beat direction. |
| “Everybody do the flop!” | TomSka / Thomas Ridgewell; music credited to Todd Bryanton; [creator-owned song upload](https://www.youtube.com/watch?v=L5inD4XWz4U), January 17, 2014 | Five-word excerpt verified against official title and supplied lyrics. | **Hold: text/music/character clearance unconfirmed.** Whispered command could reverse the original exuberance. No physical flop requested. |
| “Was that the Bite of '87?!” | Markiplier, [original FNAF 4 part 5](https://www.youtube.com/watch?v=AZgnZSmbYn0), July 27, 2015 | Original uploader/title/date verified. The candidate wording is corroborated by [the source-linked meme history](https://knowyourmeme.com/memes/was-that-the-bite-of-87); direct original-audio transcript verification remains pending. | **Hold: wording playback and rights review.** Potential polite outrage; no game artwork/audio would be imported. |
| “Double rainbow all the way across the sky.” | Paul “Bear” Vasquez / Yosemitebear62, [original upload](https://www.youtube.com/watch?v=OQSNhk5ICTI), January 8, 2010 | Creator-owned upload verified. Candidate excerpt is corroborated by [the source-linked history](https://en.wikipedia.org/wiki/Double_Rainbow_(viral_video)); exact spoken segment/timestamp still needs direct review. | **Hold: wording playback and estate/rightsholder clearance.** Flat expert testimony gives the exuberant premise a different joke. |
| “Road work ahead? Uh, yeah, I sure hope it does.” | Drew Gooden; [available repost](https://www.youtube.com/watch?v=9sPthPleEKo) explicitly says it does not own the Vine | Wording visible in repost title; source identity corroborated by [the creator's career history](https://en.wikipedia.org/wiki/Drew_Gooden_(YouTuber)). An accessible creator-owned original was not established. | **Hold: primary archive, wording review, and permission.** Candidate only; a repost is not a publication license. |

**Eligible sourced quotations shipped: zero.** No documented commercial permission was found for this shortlist. The four phrase-level verified candidates are useful clearance leads; the others are useful provenance leads. The full original catalog ships independently. Do not quietly promote a pending item because it is short or attributed. To publish a cleared quote, store the source URL, exact approved text, rightsholder/license scope, territories/term, review date, and immutable new ID; add it to a separate reviewed catalog release. No creator name, voice, likeness, endorsement, audio, or video is part of this release.


## Verification outcomes

Commands below used the bundled Node runtime on this machine. `node node_modules/...` is equivalent to the repository's npm script.

| Check | Exact command / scope | Outcome |
|---|---|---|
| Baseline lint | `node node_modules/eslint/bin/eslint.js .` | Passed before implementation |
| Baseline types | `node node_modules/typescript/bin/tsc --noEmit` | Passed |
| Baseline unit suite | `node node_modules/vitest/vitest.mjs run` | 87 passed |
| Baseline build | `node node_modules/next/dist/bin/next build` | Passed |
| Initial browser pass | Existing Playwright suite after early content/recorder integration | 25 passed, 1 Daily-above-fold failure; fixed and retained assertion |
| Final lint | `node node_modules/eslint/bin/eslint.js .` | Passed |
| Final types | `node node_modules/typescript/bin/tsc --noEmit` | Passed |
| Final unit suite | `node node_modules/vitest/vitest.mjs run` | **203 passed; 2 opt-in live evaluations skipped**, 30 passing test files |
| Full browser suite | `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/delivery-playwright PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 node node_modules/playwright/cli.js test --reporter=line` | **52 passed**, including every requested viewport and the original suite |
| Local API transport | `node scripts/verify-local-judge.mjs` against the explicitly configured local mock server | Two real HTTP submissions; same receipt replayed; no persistence/provider call |
| Live Scribe | `DELIVERY_SCRIBE_SMOKE_LIVE=1 DELIVERY_SCRIBE_SMOKE_WAV=/private/tmp/delivery-scribe-neutral.wav DELIVERY_SCRIBE_SMOKE_EXPECTED='Delivery microphone transcription test.' DELIVERY_SCRIBE_SMOKE_DURATION_MS=2525 node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/server/elevenlabs-live.eval.test.ts` | **1 passed**; four word timestamps and exact phrase agreement; no human recording |
| Independent final review | Four findings, then targeted re-review | All four addressed; reviewer independently reran 38 retry/authorization tests and 2 matchup-consent tests |
| Production build | `node node_modules/next/dist/bin/next build` | Passed; expected Next edge-runtime/static-generation notice only |
| Dependency security patch | `npm update qs --ignore-scripts` | Only transitive `qs` changed to **6.16.0**; npm reported **0 vulnerabilities** afterward |
| Affected patch checks | `node node_modules/vitest/vitest.mjs run src/lib/server/stripe.test.ts src/lib/server/content-publication.test.ts` | 12 passed; production build rerun after the patch |
| Diff and credential hygiene | `git diff --check`; ignored file/permissions check; exact credential scan of production client bundles | Clean diff; `.env.local` ignored and mode 0600; **0 matches in 77 client bundles** |
| Final public-image/API regression | `node node_modules/playwright/cli.js test e2e/api-contracts.spec.ts --reporter=line` | **3 passed**, including the additional PNG render regression; 53 unique browser checks overall |
| Supabase SQL / pgTAP | Prepared content and mature-boundary tests | **Not run**; no configured database/Docker toolchain in this task |

The browser suite uses real Chromium capture/audio APIs with synthetic microphone input. Controlled fixtures exercise silence, permission denial, missing devices, interruption, local rehearsal, failure/retry, repeated clicks, blob retention, timestamp replay, content consent, deck exhaustion, retirement, challenge entry points, keyboard menu/focus, and downloaded PNGs. It does not claim an actual acoustic microphone or remote AI heard those signals. Core receipt screenshots and Scribe word annotations use labeled test fixtures. Supporting signed-in/Pro screens use labeled mocked account responses; real account sessions were not fabricated in the application.

See [CLASSIC_REWORK_REVIEW.md](CLASSIC_REWORK_REVIEW.md) for the independent review and [local-api.json](evidence/classic-rework/local-api.json) / [scribe-live.json](evidence/classic-rework/scribe-live.json) for bounded integration evidence. The historical-Daily browser regression also passed in the final 52-test run after the review checkpoint. A subsequent public-image check caught an ImageResponse text-layout error; it was fixed, the actual private/unavailable PNG was opened and inspected, and all three API/image contracts passed.

## Scoring and historical compatibility

The numeric contract stays **30% commitment, 25% comedy, 25% accuracy, 20% chaos**. Live receipts retain `scoringVersion=delivery-voice-v1`. Rubric wording is versioned `delivery-voice-v1.1`: quiet/deadpan performance is legitimate, controlled contrast counts, spoken judge instructions remain untrusted evidence, and coaching must suit the requested direction. This is a clarified contract, **not demonstrated statistical equivalence or validated new weights**. No consented human calibration or live OpenAI scoring run was available.

The audio-capable OpenAI judge still receives the actual waveform. Its literal transcript still drives deterministic word accuracy. Scribe's independent transcript and word timings carry `usedForAccuracy:false`; they do not influence performance scores or silently change accuracy. Mocks retain the separate `delivery-demo-v1` series and clear UI labels. Saved result bodies, old rubric metadata, historical Daily rules, challenges, and leaderboard scores are not rewritten. Unknown historical score versions remain readable and are excluded from new local comparable aggregates.

A numerical/rubric distribution change or promotion of Scribe to accuracy requires a calibrated new scoring series and explicit partitioning of every leaderboard, best score, Daily, challenge, and badge aggregation. The repeatable consented-recording harness, 13-case manifest, quiet/loud/gain controls, mistakes, alternate interpretations, and spoken manipulation cases are documented in [JUDGING_EVALUATION.md](JUDGING_EVALUATION.md). Synthetic tests establish software contracts, not human enjoyment, perceptual accuracy, accent fairness, or voice acting quality.

Original 120 lines and 48 directions remain frozen in `legacy-content.ts`. New lines/directions have fresh `v2-` identities. Database `draw_enabled=false` retires obsolete material from new selection while preserving joins and exact old receipts. Existing precomputed Daily slots remain immutable. A retired direct Classic link explains retirement before opening the mic; a preserved Daily shares the Daily route and does not create a new retired friend challenge.

## Migration, setup, and remaining release work

1. Review the working tree and test in a separate Supabase environment. Apply **014**, commit its transaction, then **015**, then **016**. The new enum value cannot be used inside the transaction that adds it. Ship app and migrations together. Existing databases need these additive migrations; a fresh-install seed alone is insufficient. Do not reset production.
2. Run the repository's Supabase/pgTAP checks and compare saved old challenge, Daily, and result IDs before/after. Verify active counts/ratings, private storage/RLS, Mature raw-write rejection, entitlement boundaries, moderation, and account deletion. Existing Mature public share objects, if any, must be deleted through Storage before migration 016 can proceed; its preflight fails explicitly rather than hiding an accessible object.
3. Configure authorized OpenAI, Supabase/auth/storage, distributed rate-limit/idempotency/device credentials, and existing billing settings in a reviewed environment. No live sign-in, persisted challenge, Daily leaderboard lock, publication, Stripe checkout/webhook, account deletion/export, or production database operation was exercised here. Their adapters/contracts and local UI fixtures were tested. Production validation was not weakened to make the preview work.
4. Drain the **15-minute old idempotency receipt window**, or keep previously admitted instances available during rollout. The retry request fingerprint now binds the complete client envelope, so old transient in-flight receipt hashes need an explicit rollout boundary. Persisted results/history do not change.
5. Decide the launch age/audience policy, provider retention/disclosures, jurisdictional terms/contact/retention periods, and rights-clearance process. Mature local play is implemented behind explicit opt-in; it is not verified-age gating. Mature public/unlisted publication remains disabled in both API and SQL until that separate policy exists. No unresolved creator quote ships.
6. Run real-device tests on iOS Safari, Android Chrome, desktop Safari/Firefox/Chrome, Bluetooth/headset switching, denied OS permissions, device interruption, quiet rooms/noisy rooms, and long-session recording. Recruit consenting adult players for repeated rounds in all three content settings and blind-listening evaluation. Measure whether people laugh, understand the direction, willingly replay, skip weak lines, and find the coaching useful. These cannot be established with generated microphone data.

The root task's model/reasoning setting was not exposed by the environment, so no claim is made that a written prompt changed it. The independent final adversarial reviewer was explicitly launched as **`gpt-6-astra` with `ultra` reasoning**, the highest offered setting. Separate subagents owned content/source research and backend content, recorder/supporting layouts, and judging/Scribe/evaluation; the root reconciled the work, operated the browser/live Scribe smoke, fixed review findings, and ran integrated checks.
