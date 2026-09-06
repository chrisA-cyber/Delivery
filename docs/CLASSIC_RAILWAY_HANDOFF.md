# Classic Railway migration

## Current runtime evidence — September 6, 2026

The historical setup blockers below have been resolved by the owner granting Railway GitHub access, entering the three private settings directly in Railway, and saving the Railway Supabase Auth URLs (Auth configuration is owner-reported). Deployment `3108860b-d957-407c-81cc-7af069e17a75` is SUCCESS at code revision `71d7a1a86dfdf99eb675ae607f14d9253ce60f88`. The allocated `/play` URL now returns 200. `/api/account` returns 200 with `configured:true, authenticated:false`; `/api/prompts/daily` returns 200 through the real Supabase service-role RPC and public read; guest access to a nonexistent report target returns expected 404 `REPORT_TARGET_NOT_FOUND` with a signed device cookie, verifying the deployed device secret and native Redis route. No report row was created.

Owner approved a $1 ceiling, three short judged takes and at most six OpenAI judging dispatches including repair, then requested realistic synthetic speech instead of supplying human takes. A one-second all-zero PCM WAV sent to the actual `/api/judge` returned 422 `NO_SPEECH_DETECTED` in 8,152 ms (client-observed), request ID `f6b37c01-09c6-4be7-bf57-2082386d761d`, before any provider call. Stripe and cleanup launch settings remain separate from these passing free-session routes.

## Live synthetic judging results

[Recorded responses and sample hashes](evidence/classic-railway/synthetic-live.json) come from the actual deployed app, native Redis, Supabase catalog and OpenAI judge. Free local Kokoro synthesis ran in Railway's execution sandbox after workspace download access failed; no new deployed service or exposed credential was needed. Stock voices `af_sarah` and `am_michael` generated 3.593-second and 3.674-second mono PCM16 WAVs. These are synthetic fixtures, not human performance evidence.

| Case | Overall | Word accuracy | HTTP latency |
| --- | --- | --- | --- |
| Correct line, Sarah | 29 | 100 | 4,221 ms |
| Exact same attempt replay | 29 | 100 | 33 ms |
| Identical audio, fresh attempt | 29 | 100 | 2,429 ms |
| Changed words, Michael | 20 | 70 | 1,997 ms |

All four successful responses were live `source:ai`, rubric `delivery-voice-v1.1`, scoring `delivery-voice-v1`. Guest results correctly remained unpersisted. Cached replay returned the identical result ID and kept quota usage at one; fresh judgments advanced usage to two and three. Literal transcripts matched both synthesized texts. The first test setup used a direction slug instead of full text and returned 409 `ENERGY_MISMATCH` before reservation/provider invocation; the test payload was corrected, without an application change or paid retry.

Feedback addressed the steady tone and pause before the second sentence, and did not prescribe shouting. However, the identical recording received conflicting coaching: first insert a clearer pause, then tighten the existing pause. Overall repeat difference was zero, comedy differed by one, and two repeats are insufficient competition-calibration evidence. The changed-word case also changes voice, so performance-score differences cannot establish accent/voice fairness or isolate word changes from vocal delivery.

Three unique successful judgments imply **3–6 provider dispatches** including bounded repairs. The route does not expose token usage or exact dispatch count; neither is invented here. The cached replay and two pre-provider rejections add no provider calls. Estimated spend remains below the prior $0.50 planning estimate for these short clips, but actual spend is unverified; $1 was authorized. All six possible dispatch slots are accounted for, so no paid rerun was made.

## Scale clarification and remaining validation

Positive feedback and `MAIN_CHARACTER` badges accompanied commitment/comedy/chaos values of 2–7, producing overall 29 despite 100 accuracy. This suggests scale ambiguity; it does not prove the model intended 70 rather than 7. The existing schema required 0–100, but the prose did not explain that range. Rubric **`delivery-voice-v1.2`** now explicitly requests 0–100 rather than 0–10, with matching field descriptions. The scoring version, 30/25/25/20 weights, OpenAI transcript source and legitimate low scores remain unchanged; no historic result is multiplied or rewritten. This prompt clarification can shift new scores, so v1.1 and v1.2 are not proven calibrated/comparable and should be identified by rubric version. A regression fixture preserves the observed 7/6/100/2 → 29 arithmetic.

The clarification passed `npx vitest run src/lib/judging/rubric.test.ts src/lib/server/openai-contract.test.ts` (14 tests), `npm run typecheck`, `npm run lint`, and `git diff --check`. The authorized live follow-up below is now complete. Quiet-direction weighting and feedback stability remain unresolved. Signed-in save/history/private playback, browser microphone/replay, real devices and human enjoyment remain untested. Next: one signed-in save/playback check. Live transport and guest retry handling work; this is not a public-launch validation or proof of comedy quality. No later mode work began.

## Authorized v1.2 live follow-up — September 6, 2026

Verified Railway deployment `bb72afad-fed7-4dda-b56c-80a5184e4963` SUCCESS at **`5618fb8040d6ae45aee6548f3ac1953ee364caa4`**, branch `codex/classic-railway`. [Raw follow-up evidence](evidence/classic-railway/synthetic-scale-v12.json) records one actual `/api/judge` request: HTTP 200, `source:ai`, rubric `delivery-voice-v1.2`, scoring `delivery-voice-v1`, **3,827 ms**. Scores: commitment **80**, comedy **60**, deterministic accuracy **100**, chaos **30**, overall **70**. Guest quota used one; result correctly remained unpersisted.

The owner approved one additional take, at most two provider dispatches including repair, estimated under **$0.10**. One app request completed; exact provider usage and billing remain unavailable, so report **1–2 provider calls**, not an exact count or spend. Synthesis was free. No paid retries or further takes were made; the request allowance is finished.

The original WAV expired with Railway's temporary sandbox. A recovery pin to Kokoro 0.4.7 failed before judging; 0.6.1 produced a new 3.593-second `af_sarah` WAV with the same script but different bytes. Both preflight failures made zero provider calls. The new hash is recorded explicitly: this is a new synthetic scale check, **not an identical-audio before/after comparison**. Do not infer the earlier 29-to-current-70 difference is solely caused by the prompt change.

Feedback recognized a flat tone and deliberate pause. Coaching: “Try hitting the word 'panicking' with a slightly more measured pace to drive home the embarrassment.” It gave a specific adjustment without telling the quiet delivery to shout. The new result supports the explicit scale contract, but one synthetic take does not establish repeatability, human acting quality, fairness or restrained-direction calibration. No additional application changes were needed after this check; this follow-up changes evidence/docs only, checked with JSON parsing and `git diff --check`.

Owner check: open [the isolated preview](https://delivery-production-0577.up.railway.app/play), sign in, record a take, listen, judge, replay and retry; confirm the saved take appears in history and plays after reloading. Report the actual device/browser and any unclear state. There is no demonstrated shared recording/storage defect from these guest checks; signed-in persistence is still a concrete shared-flow validation gap. Human playtesting is a launch limitation, not by itself a prohibition on developing Say It Back.

## Original migration record (historical)

The remaining sections record setup-time status, superseded by the current runtime evidence and live checks above.

2026-09-06. The owner authorized moving the isolated Classic preview to Railway on their existing plan. Production Netlify, main, PR #1 and the separate Clipping Railway project remain untouched. This is an environment migration, not repeated Step 1C/1D validation.

## Code and verification

Work branch: `codex/classic-railway`, based on local `8f3e378` and Step 1C `a3350346af7681b838bcb3267ded0d98d471c307`. The local ancestry retains unpushed Step 1D `7c60b932955d66f39e7e7589cc38a8a4b61b5053` and all setup notes; their contents are included in this branch. Main and draft PR #1 were rechecked and remain `c74badd` and `a335034` respectively.

Published code revision: `84ee4d49487be5370d20004e14aedc4374a670fb` on GitHub branch `codex/classic-railway`. Its tree `ec2850c103c7c7e2fe5f0053fc111180fcbe6e2b` exactly matches tested local commit `923583e5485312031d28d44b1154efb7c5ac7c24`, preserved on `codex/classic-railway-local`. The GitHub connector published the combined working tree on top of Step 1C; no local work was lost. Railway's existing web service is now staged against this exact repo/branch/code revision. This subsequent handoff update changes documentation only.

Added the official `@redis/client` transport for Railway private Redis. Rate limiting, idempotency and guest quotas use the same existing Lua scripts. Native connections have 2.5-second deadlines, no automatic reconnect/offline replay, sanitized errors and fail-closed behavior. Upstash remains supported as an alternative; configuring both backends is rejected. No scoring weights, transcripts, catalog identities, database schema or privacy rules changed.

Passed: `npx vitest run src/lib/server/redis.test.ts src/lib/server/env.test.ts src/lib/server/rate-limit.test.ts src/lib/server/idempotency.test.ts src/lib/server/entitlements.test.ts` (36 tests), `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`. These transport tests use a mocked Redis client. Actual app-to-Railway Redis connectivity is still pending deployment.

## Isolated resources and configuration

- Railway project `delivery-classic-test`: `321c764e-38fe-4ecb-98f2-39c8654d0956`, workspace `74780029-b692-4f94-93e2-455c5d049847`.
- Environment `8470f7d3-49f4-41bc-b39e-65fc1e5a1e22` retains Railway's default label `production`; it belongs exclusively to this test project and is not Delivery's existing production deployment.
- Web service `Delivery`: `34d3b855-25f3-4eea-9438-c43974cef738`.
- Allocated URL: `https://delivery-production-0577.up.railway.app/play`. **Not yet a working gameplay preview.**
- Standard Redis template replacement staged: service `Redis-u2D6` (`b79ed0ee-00d3-484b-b706-c2f84e4e9588`), volume `bfaadfa4-820f-4594-af5f-2bdec31edaa0`, private networking, one replica. An initial manually created Redis (`aea0c5bc-19bb-4c33-9293-74eb1dc409a2`) used an unverified secret-generation expression; its removal is staged. It was never connected to gameplay and contains no test fixtures. Do not use that initial service.
- Existing test Supabase stays `rcsopyxrotbbfaqikire`: 17 exact migrations and seed already verified, private audio/share buckets, no production fixtures.

Web build/runtime variables present: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NODE_ENV`, `PORT`, `RAILPACK_NODE_VERSION`, `DELIVERY_AI_MODE`, `DELIVERY_AI_ALLOW_MOCK_FALLBACK`, `DELIVERY_TRANSCRIPTION_PROVIDER`. Public settings target only the test Supabase and Railway origin. Live mode remains enabled with mock fallback false. Build is `npm run build`; start is `npm run start -- --hostname 0.0.0.0 --port 3000`; platform liveness uses `/play`. The unchanged `/api/health` still enforces full launch configuration; liveness is not proof of gameplay readiness.

Staged `REDIS_URL` reference was corrected to `${{Redis-u2D6.REDIS_URL}}` using Railway's reference tool and verified against the exact replacement service; no rendered credential was exposed. Supabase, build/start and domain configuration were reverified intact. The application has **no deployment yet**; the owner must apply the staged changes through the required dashboard verification. This is a Railway access requirement, not an automatic approval-review rejection.

## Initial access blockers (resolved; historical record)

Railway returned: “These staged changes require two-factor verification, which isn't available over an API/MCP token. Apply them from the Railway dashboard.” No alternate tool was used to bypass that requirement. Open [the isolated project](https://railway.com/project/321c764e-38fe-4ecb-98f2-39c8654d0956?environmentId=8470f7d3-49f4-41bc-b39e-65fc1e5a1e22), review staged changes and apply them with the account's verification.

Additional private configuration cannot be automatically copied: Netlify intentionally masks `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `DELIVERY_DEVICE_SECRET`; the Supabase connector exposes public keys only. No protected secret was exported, displayed or written to a file. Railway's connector accepts known values but cannot recover these secrets. A separately generated stable `DELIVERY_DEVICE_SECRET` is still needed; do not reuse the Redis password or enter a literal `secret()` expression as an ordinary variable.

Secure destinations after dashboard verification: the test project's **Delivery → Variables**, never chat. `SUPABASE_SERVICE_ROLE_KEY` comes from [test Supabase API Keys](https://supabase.com/dashboard/project/rcsopyxrotbbfaqikire/settings/api-keys/), legacy service-role key. `OPENAI_API_KEY` comes from the owner's existing Delivery Classic Test key if still available, or a replacement created in the same authorized OpenAI project. Supabase **Authentication → URL Configuration** must allow `https://delivery-production-0577.up.railway.app/**` and use the new origin as Site URL; the previous owner-saved URL targets Netlify. Neither connector exposes the required Auth configuration write.

Optional for this free Classic session: Stripe settings, scheduled cleanup and Scribe. These must not be mistaken for failures that prevent free recording, live judging, authentication, persistence or playback. Conversely, missing OpenAI, service-role, device identity or Redis configuration does block relevant gameplay paths.

## Evidence and next check

No paid OpenAI/Scribe requests, recordings uploaded, Auth users created, or connected gameplay validations occurred in this migration. Provider spend: $0. Railway services incur usage under the owner's approved existing plan; the $20 subscription is shared with other projects and is not a hard usage ceiling. No subscription, global cap, production configuration or database migration changed.

Once configuration is applied, verify the actual `/api/prompts/random`, `/api/account`, private upload/signed playback and unauthorized rejection routes. Before paid judging, retain the separate request/cost approval and recording-purpose consent gate. Owner session: Classic assignment → record → listen → live judge → replay → retry; sign in and confirm a saved take in history, then replay it. Record actual device/browser. No new harness is needed.

There is no demonstrated shared recording/playback/persistence defect from this migration; those connected paths remain untested. Human playtesting remains a public-launch limitation, not an automatic prohibition on developing Say It Back. No later-mode work began.
