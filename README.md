# Delivery

**The voice performance game where you get a line, deliver it, and get judged.**

Delivery is a fast, high-energy browser game: draw a line and an energy, record a take, receive an AI-powered scorecard, and share the result or run it back. The product is designed for instant solo play, friend challenges, daily competition, and stream-friendly chaos.

## What ships in this repository

- Friction-light guest play, optional Supabase account, and responsive microphone capture
- Classic, Daily, Hot Streak, Impossible Energy, Challenge, and Stream-oriented experiences
- Direct-audio structured AI judging across commitment, comedy, accuracy, and chaos
- Shareable results, public profiles, reactions, history, stats, badges, and leaderboards
- Pack-based prompt library with editorial trend slots and moderated submissions
- Stripe Checkout and Billing Portal flows for Delivery Pro
- Production-minded security boundaries, Row Level Security, durable rate limits/idempotency, moderation, request correlation, and explicit local-only mock behavior

The operational contract, not just the UI, is documented. Start with:

- [Product, information architecture, and user flows](docs/PRODUCT_AND_FLOWS.md)
- [System architecture and data model](docs/ARCHITECTURE.md)
- [Environment reference](docs/ENVIRONMENT.md)
- [Content and trend operations](docs/CONTENT_AND_TRENDS.md)
- [Trust, safety, privacy, and accessibility](docs/TRUST_PRIVACY_ACCESSIBILITY.md)
- [Analytics and test plan](docs/ANALYTICS_AND_QUALITY.md)
- [Go-live runbook](docs/GO_LIVE.md)
- [Launch copy](docs/LAUNCH_COPY.md)

## Local quick start

### 1. Prerequisites

- Node.js 20.11 or newer
- npm 10 or newer
- A modern Chromium, Firefox, or Safari browser with a microphone
- Git

Third-party CLIs are optional for the first local run. Install the Supabase CLI when applying migrations locally, the Stripe CLI when testing webhooks, and the Vercel CLI when mirroring deployment configuration.

### 2. Install and configure

```bash
npm install
Copy-Item .env.example .env.local
```

On macOS or Linux, use `cp .env.example .env.local`. Add values according to [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md). Never commit `.env.local` or paste secrets into issues, chat, screenshots, or client-side variables.

### 3. Choose a local operating mode

**UI-only / no third-party credentials**

Set:

```dotenv
DELIVERY_AI_MODE=mock
DELIVERY_AI_ALLOW_MOCK_FALLBACK=true
```

This is appropriate for layout work and deterministic browser tests. It does not validate real authentication, durable uploads, AI quality, payments, or webhooks.

**Full local integration**

Configure Supabase, OpenAI, and Stripe using the sections below, then set:

```dotenv
DELIVERY_AI_MODE=live
DELIVERY_AI_ALLOW_MOCK_FALLBACK=false
```

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The browser asks for microphone permission only when a recording action begins.

Before opening a pull request:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

The bounded Playwright suite covers public route rendering, 320/390 px
horizontal overflow, active-game mobile navigation, safe health/random-prompt
envelopes, and the complete guest loop using Chromium's synthetic microphone:
PCM/WAV recording, review, deterministic local judgment, and result reveal. It
never calls live AI, creates an account, publishes media, or opens Checkout:

```bash
npx playwright install chromium
npm run test:e2e
```

By default Playwright reuses a server already listening on
`http://127.0.0.1:3000` or starts the local development server. Set
`PLAYWRIGHT_SERVER_MODE=production` to start an already-built, locally configured
production server (`npm run build` first), or set
`PLAYWRIGHT_BASE_URL=https://YOUR_STAGING_DOMAIN` to
test an already deployed environment without starting any local server. The
production mode intentionally uses the production environment contract; it is
not a way to bypass missing production services. Real-device microphone
permission/recording, Supabase Auth and RLS, live OpenAI judgment, signed
challenge completion, moderation operations, and Stripe Checkout/webhooks stay
in the manual production dress rehearsal in [docs/GO_LIVE.md](docs/GO_LIVE.md).

Exact local and deployed commands:

```powershell
# Local development-server E2E
npm run test:e2e

# Local production-server E2E (build first)
npm run build
$env:PLAYWRIGHT_SERVER_MODE="production"
npm run test:e2e
Remove-Item Env:PLAYWRIGHT_SERVER_MODE

# Bounded public smoke against staging; Playwright starts no local server
$env:PLAYWRIGHT_BASE_URL="https://YOUR_STAGING_DOMAIN"
npm run test:e2e
Remove-Item Env:PLAYWRIGHT_BASE_URL
```

On macOS/Linux, prefix the command instead, for example
`PLAYWRIGHT_SERVER_MODE=production npm run test:e2e` or
`PLAYWRIGHT_BASE_URL=https://YOUR_STAGING_DOMAIN npm run test:e2e`.

### Installability boundary

Delivery ships a web-app manifest, standalone display metadata, an Apple touch
icon, and 192/512/maskable icons. It does **not** currently register a service
worker and makes no offline, background-sync, push-notification, or cached-gameplay
promise. “Add to Home Screen” can provide an app-like launcher on supporting
browsers, but the game still needs the live application and provider services.
Do not market it as offline-capable. Before launch, validate
`/manifest.webmanifest`, every declared icon, the `/play` start URL, and a real
iOS/Android home-screen install.

If a script is not present in the current branch, use the scripts listed by `npm run`; the production branch is expected to expose equivalent lint, type-check, test, and build gates.

## Supabase setup

Local UI work does not require Supabase when the app is in mock mode. Accounts, durable delivery history, public profiles, audio storage, challenges, reactions, submissions, subscriptions, and production leaderboards do.

1. Create separate Supabase projects for staging and production.
2. Add the project URL and public anonymous key to `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Add the server-only service-role key to `SUPABASE_SERVICE_ROLE_KEY`. Never expose it through a `NEXT_PUBLIC_*` name.
4. Apply migrations and seed the catalog.

   For a disposable local Supabase stack (Docker required):

   ```bash
   npx supabase init
   npx supabase start
   npx supabase db reset
   ```

   Run `supabase init` only when `supabase/config.toml` is absent. `db reset` applies `supabase/migrations/*.sql` in order and then runs `supabase/seed.sql`. Copy the local project URL, anon key, and service-role key printed by the CLI into `.env.local`.

   For a linked staging or production project:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

   Review `supabase/seed.sql`, then run it once against a new hosted project through the SQL editor or an approved `psql` workflow. The seed is idempotent.
5. Confirm the migration created `delivery-audio` (private), `delivery-share` (private derived assets), and `avatars` (public profile images) with their RLS-backed object policies. Source recordings and generated share media require an authorization check and short-lived signed URL.
6. In Authentication → URL Configuration, set:
   - Site URL: the canonical production origin
   - Redirect URLs: `http://localhost:3000/auth/callback`, the staging callback, and the production callback
7. Enable email login. Configure any social provider in both Supabase and that provider's developer console; use the Supabase callback URL shown in the dashboard.
8. Confirm that RLS is enabled on every user or community table and that anonymous users cannot enumerate private recordings or email-linked data.

Daily competition has a separate canonical read path from the rolling personal-best
leaderboards. `GET /api/leaderboard?period=daily&metric=overall&market=global`
reads `daily_leaderboard_live`; signed-in responses also include `viewer`, sourced
from `get_daily_leaderboard_position`, so a player below the top 100 can still see
their rank and participant count. Only the current UTC/global prompt-and-energy
pair and each account's immutable first scored Daily receipt rank. Later attempts
persist as practice.

Delivery uses cookie-backed server-side sessions. Supabase's current Next.js guidance recommends its SSR client for this pattern; review the [official Next.js quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs) and [server-side Auth guide](https://supabase.com/docs/guides/auth/server-side) when changing authentication.

## OpenAI judging setup

UI-only local work can run without an API key in mock mode. Real waveform-aware voice judging requires a project API key with billing and audio-model access.

1. Create a restricted project key in the [OpenAI API dashboard](https://platform.openai.com/api-keys).
2. Store it server-side as `OPENAI_API_KEY`.
3. The default voice judge is `gpt-audio-1.5`; override it only through `OPENAI_AUDIO_JUDGE_MODEL` after running the calibration set. Defaults are documented in [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).
4. Keep `DELIVERY_AI_ALLOW_MOCK_FALLBACK=false` in production so an upstream outage cannot silently publish fabricated scores.
5. Set project spend alerts and inspect latency, failure rate, and per-judgment cost before raising traffic limits.

The server validates the completed take, then sends the actual waveform to the audio-capable judge in one request. The judge hears prosody, timing, pacing, vocal dynamics, and pauses while also returning the literal transcript through a forced function call. Accuracy is recomputed by Delivery from that transcript; the other dimensions come from the audible performance. Live judging requires a paid OpenAI API project with access to the configured audio model—ChatGPT subscriptions and API billing are separate.

Do not call OpenAI directly from the browser. The key, rubric, safety policy, retry logic, and score normalization stay in the server route.

Audio contract:

- The current judge route accepts one completed take up to 60 seconds and 15 MB.
- Live judging accepts PCM WAV (the browser recorder's production format) or MP3. Container signatures and MIME types must agree.
- Microphone capture requires localhost during development or HTTPS in deployed environments.
- Empty, silent/unusable, unsupported, or oversized input must return an actionable retry state—not a low score.
- Discarded retakes remain local. Only the submitted take may be uploaded.

## Stripe setup

Pricing pages can render without Stripe. Checkout, entitlement changes, and the Billing Portal require credentials and signed webhook delivery.

1. In a Stripe sandbox, create one Delivery Pro product with monthly and annual recurring prices.
2. Set `STRIPE_SECRET_KEY`, `STRIPE_PRO_MONTHLY_PRICE_ID`, and `STRIPE_PRO_ANNUAL_PRICE_ID`.
3. Enable the Customer Portal and configure allowed cancellation, payment-method, and invoice actions.
4. With the app running, forward sandbox events:

   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

5. Copy the temporary signing secret into `STRIPE_WEBHOOK_SECRET`.
6. Exercise Checkout and Portal from an authenticated test account. Use Stripe test data only.
7. For staging and production, register `https://YOUR_DOMAIN/api/stripe/webhook` and subscribe to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
8. Replace all sandbox keys, prices, and endpoint secrets with live-mode values only after the launch review.

Checkout prevents the ordinary duplicate-subscription paths: it lists the
customer's current subscriptions, sends an account with any nonterminal Delivery
subscription to the Portal, reuses a matching open Checkout Session, and expires
other Delivery Checkout Sessions before creating a new one. Every relevant webhook
then fetches the customer's current subscription list and materializes one canonical
Delivery subscription from a freshly retrieved snapshot; Stripe event IDs are audit
identifiers, not a causal clock.

This is not an automatic refund/cancellation system for historical duplicate active
subscriptions. A billing owner must alert on any customer with more than one
nonterminal Delivery Pro subscription, cancel/refund the unintended duplicate in
Stripe, and confirm a subsequent signed webhook reconciles the database entitlement.
Test that operator path before accepting live payments.

Webhook state is the entitlement authority. A Checkout redirect is not proof of payment. Stripe's [subscription guide](https://docs.stripe.com/billing/subscriptions/build-subscriptions) and [webhook guide](https://docs.stripe.com/billing/subscriptions/webhooks) explain the asynchronous lifecycle and signature-verification requirement.

## Production deployment

Vercel is the reference deployment target, but any Node-compatible Next.js host can work.

1. Provision production Supabase, a paid OpenAI API project, Stripe, and Upstash resources.
2. Import the repository into Vercel and set the production branch to `main`.
3. Add every required environment variable to the correct Development, Preview, or Production scope. Secrets must never be represented as `NEXT_PUBLIC_*` variables.
4. Deploy once to obtain the stable host, then update `NEXT_PUBLIC_APP_URL`, Supabase redirect allowlists, OAuth callback configuration, and Stripe's webhook endpoint.
5. Redeploy after environment changes; existing deployments do not receive new values.
6. Run the smoke suite in [docs/GO_LIVE.md](docs/GO_LIVE.md) against the final domain.
7. Confirm retention, abuse, error-rate, and spend alerts before opening traffic.

See Vercel's [Next.js deployment guide](https://vercel.com/docs/frameworks/full-stack/nextjs) and [environment variable documentation](https://vercel.com/docs/environment-variables).

## External launch blockers

The repository can supply code and repeatable checks; it cannot certify or complete
the following external work. Public launch remains blocked until owners attach
evidence for each item in [docs/GO_LIVE.md](docs/GO_LIVE.md):

- a production Supabase project with all migrations/seed applied, pgTAP passing,
  RLS negatives exercised, backups/PITR enabled, and Auth/SMTP/OAuth configured;
- a paid OpenAI API project with model access, calibration approval, budgets, and
  outage behavior tested with mock fallback disabled;
- an activated live Stripe account with approved prices, Portal, webhook, tax and
  refund decisions, plus duplicate-subscription detection/reconciliation rehearsal;
- production Upstash, a high-entropy device secret, and a scheduled authenticated
  moderation cleanup worker with dead-letter alerts;
- a final HTTPS domain/deployment, DNS/TLS, monitoring, incident response, backup
  restore, and real-device microphone/accessibility evidence;
- staffed Trust & Safety/support coverage and approved terms, privacy, content
  rights, retention, escalation, appeal, and regional/age policies.

Until those are complete, a passing source build is not certification for public
commercial traffic.

## Runtime boundaries

| Capability | No credentials / mock mode | Third-party setup required |
| --- | --- | --- |
| Marketing pages, responsive UI, content browsing | Yes | No |
| Deterministic mock recording result | Yes | Microphone permission only |
| Real microphone capture and local playback | Yes | Secure context in production |
| Durable accounts, history, profiles, challenges | No | Supabase Auth + Database |
| Audio upload and signed playback | No | Supabase Storage |
| Real transcript and AI verdict | No | OpenAI project key |
| Pro checkout, portal, entitlements | No | Stripe keys, prices, signed webhook |
| Distributed abuse limits and lost-response judge replay | Process-local fallback for development only | Upstash Redis required |
| Production deployment and custom domain | No | Hosting/DNS provider |

## Security invariants

- Treat every browser value—including score, plan, user ID, MIME type, duration, and challenge target—as untrusted.
- Verify identity server-side before mutations; use RLS as a second enforcement layer.
- Accept only bounded audio formats and sizes, generate object paths server-side, and use signed URLs.
- Verify Stripe signatures against the raw request body and make event processing idempotent.
- Keep service-role, OpenAI, Stripe, and Redis secrets server-only.
- Rate-limit judgment, submissions, reactions, challenges, reports, and authentication abuse separately.
- Never publish a user recording by default. Sharing is an explicit, reversible visibility choice.
- Log request IDs and categories, not raw audio, transcripts, secrets, or email addresses.

## Contributing and release discipline

Use short-lived branches and keep migrations additive whenever possible. Every behavior change needs its matching tests, analytics event, empty/loading/error state, and documentation update. Content changes follow the editorial and rights checklist in [docs/CONTENT_AND_TRENDS.md](docs/CONTENT_AND_TRENDS.md). Moderation changes require adversarial test cases and a rollback path.

The release decision is made from [docs/GO_LIVE.md](docs/GO_LIVE.md), not from a successful build alone.

## License and content rights

No license is granted unless a repository license file says otherwise. Prompt packs must contain original, licensed, public-domain, or otherwise approved material. Cultural references may be described editorially, but recognizable copyrighted dialogue, creator quotes, names, voices, and likenesses require rights review before commercial publication.
