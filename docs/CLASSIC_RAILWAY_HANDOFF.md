# Classic Railway migration

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

## Actual access blockers

Railway returned: “These staged changes require two-factor verification, which isn't available over an API/MCP token. Apply them from the Railway dashboard.” No alternate tool was used to bypass that requirement. Open [the isolated project](https://railway.com/project/321c764e-38fe-4ecb-98f2-39c8654d0956?environmentId=8470f7d3-49f4-41bc-b39e-65fc1e5a1e22), review staged changes and apply them with the account's verification.

Additional private configuration cannot be automatically copied: Netlify intentionally masks `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `DELIVERY_DEVICE_SECRET`; the Supabase connector exposes public keys only. No protected secret was exported, displayed or written to a file. Railway's connector accepts known values but cannot recover these secrets. A separately generated stable `DELIVERY_DEVICE_SECRET` is still needed; do not reuse the Redis password or enter a literal `secret()` expression as an ordinary variable.

Secure destinations after dashboard verification: the test project's **Delivery → Variables**, never chat. `SUPABASE_SERVICE_ROLE_KEY` comes from [test Supabase API Keys](https://supabase.com/dashboard/project/rcsopyxrotbbfaqikire/settings/api-keys/), legacy service-role key. `OPENAI_API_KEY` comes from the owner's existing Delivery Classic Test key if still available, or a replacement created in the same authorized OpenAI project. Supabase **Authentication → URL Configuration** must allow `https://delivery-production-0577.up.railway.app/**` and use the new origin as Site URL; the previous owner-saved URL targets Netlify. Neither connector exposes the required Auth configuration write.

Optional for this free Classic session: Stripe settings, scheduled cleanup and Scribe. These must not be mistaken for failures that prevent free recording, live judging, authentication, persistence or playback. Conversely, missing OpenAI, service-role, device identity or Redis configuration does block relevant gameplay paths.

## Evidence and next check

No paid OpenAI/Scribe requests, recordings uploaded, Auth users created, or connected gameplay validations occurred in this migration. Provider spend: $0. Railway services incur usage under the owner's approved existing plan; the $20 subscription is shared with other projects and is not a hard usage ceiling. No subscription, global cap, production configuration or database migration changed.

Once configuration is applied, verify the actual `/api/prompts/random`, `/api/account`, private upload/signed playback and unauthorized rejection routes. Before paid judging, retain the separate request/cost approval and recording-purpose consent gate. Owner session: Classic assignment → record → listen → live judge → replay → retry; sign in and confirm a saved take in history, then replay it. Record actual device/browser. No new harness is needed.

There is no demonstrated shared recording/playback/persistence defect from this migration; those connected paths remain untested. Human playtesting remains a public-launch limitation, not an automatic prohibition on developing Say It Back. No later-mode work began.
