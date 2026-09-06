# Classic preview setup — historical Netlify configuration

The owner subsequently authorized moving the isolated preview to Railway. Resume from [CLASSIC_RAILWAY_HANDOFF.md](CLASSIC_RAILWAY_HANDOFF.md); the Netlify/Upstash owner actions below are superseded. This note preserves the work and verified configuration already completed.

2026-09-06. **The isolated Supabase project and core branch settings are ready for runtime verification. The remaining configuration blocker is a designated test Redis database and its branch credentials.** The environment read succeeded after explicit user authorization; no secret values were displayed or written to files, logs, commits or this note. Only configuration metadata and public addresses are recorded here.

## Completed setup

- `delivery-classic-test`: project **`rcsopyxrotbbfaqikire`**, Delivery organization `zginsfcknhjwcoiwegjp`, `us-east-2`, `ACTIVE_HEALTHY`. The project-cost quote was rechecked at **$0/month** before creation. No plan changes.
- Confirmed the project started with zero public tables, migration records, Auth users and storage buckets. Applied the exact **17 existing repository migrations**, in order, then the existing `supabase/seed.sql`; every operation succeeded without SQL changes.
- Verified **86 active lines, 36 active directions, six active packs and 31 seeded Daily assignments**. Retired content remains present. All public base tables have RLS; expected public/authenticated SELECT grants exist while delivery/score INSERT stays server-only. `delivery-audio` and `delivery-share` are private; `avatars` is public.
- Reconciled the new project's MCP-generated migration ledger to the repository's exact versions/names in one guarded transaction. All 17 match; recorded SQL statements were verified unchanged. No DDL was rerun.
- **Zero Auth users/deliveries created; zero OpenAI/Scribe calls; $0 provider spend.** This is actual hosted database configuration, not application HTTP, Auth email, media upload/signing, or live judge→save evidence.
- Application revision remains PR #1's `a3350346af7681b838bcb3267ded0d98d471c307`, containing all Step 1C fixes. Main remains `c74badd`; local `7c60b93` and subsequent setup-note commits are preserved on `codex/classic-preview-setup`. No application code change, push, merge or deployment occurred. The agent made no Netlify configuration writes and did not use the separate Railway Clipping project; production secret values were not compared.

## Netlify status actually observed

Reverified identity on 2026-09-06 after the owner identified the project as **Delivery**: Netlify's current API name is `deliverygame`, site ID `0e51ca4e-90ea-4b21-88de-783d4e6e5026`, and its primary HTTPS domain is `https://deliverygame.netlify.app`. Netlify's site-specific lookup for preview deploy `6a9cb2b680d8410007008782` returns that same site ID, context `deploy-preview`, branch `codex/classic-step-1c`, commit `a3350346af7681b838bcb3267ded0d98d471c307`, and review URL `https://github.com/chrisA-cyber/Delivery/pull/1`. GitHub's PR metadata/status and Netlify bot comment independently match. This verifies the requested repository/project/domain relationship; deployment state `ready` does not establish functioning gameplay.

The owner added the following settings; the authorized Netlify listing verifies their **`codex/classic-step-1c` branch** metadata. Below, **B/F/R/P** mean Netlify **Builds/Functions/Runtime/Post processing** scopes; Functions is the relevant server runtime scope. Saved secret presence does not establish credential validity.

| Variable names | Scope | Branch status |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | B/F/R/P | Matches `https://deploy-preview-1--deliverygame.netlify.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | B/F | Matches `https://rcsopyxrotbbfaqikire.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | B/F | Present; public key claims match the test project and anon role |
| `SUPABASE_SERVICE_ROLE_KEY` | F | Present, marked secret and masked; validity untested |
| `DELIVERY_AI_MODE` | B/F/R/P | `live` |
| `OPENAI_API_KEY`, `DELIVERY_DEVICE_SECRET` | B/F/R | Present, marked secret; existing scopes retained, validity untested |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | B/F/R | Missing; only production values present, preview entries blank |
| `OPENAI_AUDIO_JUDGE_MODEL` | B/F/R/P | No branch override; preview entry blank, repository default applies |
| `DELIVERY_AI_ALLOW_MOCK_FALLBACK`, `DELIVERY_TRANSCRIPTION_PROVIDER`, `ELEVENLABS_API_KEY` | None | No branch override; fallback defaults to false, transcript provider to audio-judge, Scribe unused |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID`, `MODERATION_CLEANUP_SECRET` | None | Missing; outside this free Classic session |

The owner created an OpenAI key named **Delivery Classic Test** and entered it directly in Netlify. No paid provider call or budget approval occurred. The previously blank judging mode now has the valid branch value `live`. Redis is still required for production-mode rate limiting, quotas and idempotency; a running preview must establish that the saved credentials and connected application flows work.

Stripe and scheduled cleanup are outside this short free Classic session, but still gate the existing full-production `/api/health` check. That check is not global middleware. Do not weaken it or insert dummy credentials: report its billing/cleanup failure separately from actual gameplay route results. Scribe is optional; accuracy remains on the OpenAI judge transcript. No scoring or fallback semantics changed.

## Why a manual configuration step remains

The installed Netlify write tool exposes `newVarContext: branch` **without a branch-name/context-parameter field**. Its deploy operation accepts only a site ID, with no preview selector. Those calls cannot establish the requested `codex/classic-step-1c` scope, so neither was invoked. No authenticated local Netlify CLI session/token exists. This is a capability limit, **not another approval rejection**. The newly approved read worked.

## Remaining owner action: bind test Redis, then rebuild the preview

First identify a **designated test Redis database** in the Upstash console. None is currently designated, and the available plugin search returned documentation access (Context7), not Upstash database management. Do not select a paid plan without authorization or substitute the production store.

Then open [Netlify's deliverygame project](https://app.netlify.com/projects/deliverygame) → **Project configuration → Environment variables**. Add a **Branch** contextual value for **`codex/classic-step-1c`** on the two existing variables below. Preserve existing contexts and scopes; do not edit Production, All contexts, or all Deploy Previews. [Netlify documents branch-specific preview values](https://docs.netlify.com/build/environment-variables/overview/#value-per-deploy-context).

| Variable | Value/source to enter securely | Required scope |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Upstash console → a **designated test Redis database** → REST API credentials | Functions |

Do not copy production Redis credentials: the application uses shared `delivery:` key prefixes, so test quota/idempotency traffic would not be isolated. No secret should be pasted into chat or an env file. Public Supabase settings already have **both Builds and Functions** for browser auth, server clients and the built CSP; Netlify's separate Runtime checkbox does not replace Functions.

The owner reports saving the test Supabase **Authentication → URL Configuration** Site URL as the exact preview origin above, with `https://deploy-preview-1--deliverygame.netlify.app/**` allowed for redirects. This Auth configuration has not been independently verified. Existing email delivery restrictions still apply; sign-in email delivery has not been tested.

After these settings are saved, rebuild **PR #1 only** from [its verified Deploy Preview entry](https://app.netlify.com/projects/deliverygame/deploys/6a9cb2b680d8410007008782) (latest branch commit); do not use a generic production deploy action. The current preview URL is not yet a verified working live session. Once configured, verify `/api/prompts/random` and `/api/account`, private upload/signing and unauthorized rejection, plus a budget-approved live judge→save. Full-production health may still report optional billing/cleanup gaps.

## Owner session after configuration and provider budget approval

Open Classic → record → listen back → request live judging → replay → retry. Then sign in, make one saved take, open history and replay it. Record the actual device/OS/browser and any confusing state. The existing proposed evaluation batch remains 14 attempts/28 maximum provider dispatches; no paid evaluation is authorized until its cost estimate and sample consent are approved.

No shared recording/playback/persistence code defect was demonstrated in this setup. Connected application flows remain untested. Missing human playtests are a launch limitation, not an automatic prohibition on Say It Back development. No later mode work was started.
