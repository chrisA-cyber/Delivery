# Environment and third-party configuration

This is the configuration contract for Delivery. Copy `.env.example` to `.env.local` for local development. Values in `.env.local` are secrets or machine-specific configuration and must not be committed.

## Environment matrix

| Variable | Required for full production | Browser-visible | Local default / example | Purpose |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Yes | Yes | `http://localhost:3000` | Canonical absolute origin used for redirects and share URLs; production requires an exact HTTPS origin with no trailing slash, path, query, credentials, or fragment |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase features | Yes | Supabase project URL | Public project endpoint; production requires HTTPS |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase features | Yes | Supabase anonymous/public key | User-scoped browser and SSR access protected by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Durable server operations | **No** | None | Privileged server-only database/storage operations |
| `DELIVERY_AUTH_EMAIL_READY` | Only for email onboarding/recovery | No | `false` | Show email account links and password recovery only after custom SMTP delivery has been verified; OAuth availability follows live Supabase provider settings |
| `OPENAI_API_KEY` | Live judging | **No** | None | Server-side audio judgment request; requires a paid API project with model access |
| `OPENAI_AUDIO_JUDGE_MODEL` | No | No | `gpt-audio-1.5` | Audio-capable voice judgment model override |
| `OPENAI_MODERATION_MODEL` | No | No | `omni-moderation-latest` | User-line text moderation model override |
| `DELIVERY_AI_MODE` | Yes | No | Defaults to `live`; set `mock` for credential-free local UI work | Select real provider calls or deterministic test responses |
| `DELIVERY_AI_ALLOW_MOCK_FALLBACK` | Yes | No | Defaults to `false`; explicitly opt in only for local demos | Permit a live failure to fall back to a clearly flagged mock result |
| `STRIPE_SECRET_KEY` | Paid plans | **No** | Stripe sandbox secret | Checkout, Portal, and server-side Stripe calls |
| `STRIPE_WEBHOOK_SECRET` | Paid plans | **No** | Stripe CLI or endpoint signing secret | Verify raw webhook payloads |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | Paid plans | No | `price_…` | Allowlisted monthly recurring price |
| `STRIPE_PRO_ANNUAL_PRICE_ID` | Paid plans | No | `price_…` | Allowlisted annual recurring price |
| `STRIPE_ENABLE_AUTOMATIC_TAX` | No | No | `false` | Enable Stripe automatic tax where the account is configured |
| `DELIVERY_DEVICE_SECRET` | Yes | **No** | None | Signs guest devices and HMACs UTC-day-rotating anonymous-report abuse metadata; raw IPs are never stored |
| `UPSTASH_REDIS_REST_URL` | Yes | No | None | Production rate-limit, guest-quota, and cross-instance judge-idempotency store |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | **No** | None | Authenticates production distributed limit and idempotent-result requests |
| `MODERATION_CLEANUP_SECRET` | Yes | **No** | None; 32+ random characters | Authorizes scheduled moderation-media cleanup and account-deletion receipt reconciliation |

Only variables intentionally prefixed `NEXT_PUBLIC_` may enter the browser bundle. “Anon” in the Supabase key name means public and RLS-scoped; it does not mean unrestricted. The service-role key bypasses RLS and is always a secret.

## Safe local templates

### UI and deterministic testing

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000

DELIVERY_AI_MODE=mock
DELIVERY_AI_ALLOW_MOCK_FALLBACK=true
```

Supabase-backed pages may show an explicit unavailable/preview state when its public variables are absent.

### Full local integration

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY

OPENAI_API_KEY=YOUR_SERVER_ONLY_PROJECT_KEY
OPENAI_AUDIO_JUDGE_MODEL=gpt-audio-1.5
OPENAI_MODERATION_MODEL=omni-moderation-latest
DELIVERY_AI_MODE=live
DELIVERY_AI_ALLOW_MOCK_FALLBACK=false

STRIPE_SECRET_KEY=YOUR_STRIPE_TEST_SECRET_KEY
STRIPE_WEBHOOK_SECRET=YOUR_LOCAL_STRIPE_LISTENER_SECRET
STRIPE_PRO_MONTHLY_PRICE_ID=price_monthly
STRIPE_PRO_ANNUAL_PRICE_ID=price_annual
STRIPE_ENABLE_AUTOMATIC_TAX=false

# Required for a production-like abuse-control test
DELIVERY_DEVICE_SECRET=GENERATE_A_LONG_RANDOM_SECRET
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
MODERATION_CLEANUP_SECRET=GENERATE_A_SEPARATE_LONG_RANDOM_SECRET
```

Placeholder values are documentation only. Never use them as real credentials.

## What works without credentials

| Area | UI-only local mode | Full local integration | Production |
| --- | --- | --- | --- |
| Landing, pricing, policy, component states | Works | Works | Works |
| Built-in prompt browsing | Works from the bundled catalog | Works from Supabase, with local fallback only when unconfigured | Supabase; database failures surface visibly |
| Microphone recording and in-memory playback | Works on localhost | Works | Requires HTTPS/secure context |
| AI result | Deterministic demo, clearly labeled in the player UI | Live when explicitly configured | Live only |
| Authentication and durable profile | Unavailable/preview | Supabase | Supabase |
| Storage and public sharing | Unavailable/ephemeral | Supabase | Supabase |
| Checkout and Portal | Disabled | Stripe sandbox | Stripe live mode |
| Webhook-driven entitlement | No | Stripe CLI | Registered live endpoint |
| Distributed rate limiting | In-memory best effort | Upstash recommended | Upstash required |

The current installable surface is configuration-free: `public/manifest.webmanifest`
and the checked-in icons provide metadata and standalone display behavior. No
environment variable enables offline play. The app does not register a service
worker and does not provide cached judgment, background sync, push notifications,
or an install prompt.

## Supabase values

Find the project URL and public/server keys in the Supabase project's API settings. Use different projects and values for staging and production.

Configuration outside the environment file:

- Apply database migrations.
- Run the idempotent `supabase/seed.sql` catalog seed.
- Confirm `delivery-audio` (private), `delivery-share` (private derived assets), and `avatars` (public profile images) plus their object policies.
- Set Auth Site URL and allowed redirect URLs.
- Enable email and chosen OAuth providers.
- Configure email templates and an SMTP provider before public launch.
- Set database backups/PITR according to the chosen plan and recovery objective.

### Pilot authentication

One complete OAuth route is sufficient for new accounts; it requires no Delivery
password. The login page reads Supabase's public Auth settings on each request and
shows only enabled Google/GitHub providers. A disabled or unreachable provider list
does not create placeholder signup buttons. Enable the chosen provider only after
its client ID/secret and redirect configuration are saved.

For the isolated Railway pilot, the canonical origin is
`https://delivery-production-0577.up.railway.app`. Its Supabase OAuth provider
callback is `https://rcsopyxrotbbfaqikire.supabase.co/auth/v1/callback`.
Set the Supabase Site URL to the canonical Railway origin and allow
`https://delivery-production-0577.up.railway.app/auth/callback**` for application
returns (including the encoded `next` query). Verify with a controlled account:
public signup → provider consent → original scene/challenge → save/claim → sign
out/in. Do not enable provider buttons by adding frontend-only flags.

Email account creation uses a passwordless sign-in link. Existing password users
can still sign in when Supabase email authentication is enabled. Keep
`DELIVERY_AUTH_EMAIL_READY=false` until custom SMTP sends signup, sign-in, and
password recovery messages successfully to a controlled mailbox. Supabase's
hosted-mailer enablement alone is not delivery evidence. Until then, email signup,
magic links, and reset requests are hidden and the UI explains the temporary
onboarding/recovery limitation; email confirmation stays enabled.

For SMTP verification also allow
`https://delivery-production-0577.up.railway.app/auth/reset**`. Recovery links
must use the requested redirect URL, including `next`; the reset screen consumes
the PKCE code in the requesting browser, requires the SDK's `PASSWORD_RECOVERY`
event, and reverifies that same authenticated user before changing a password.
Expired, reused, cross-browser, and normal sign-in codes cannot open the reset
form. Returning from recovery retains the scene/challenge destination. The app's
new-account route remains blocked until a provider or custom SMTP has completed
this real-service verification; prepared code is not a verified onboarding route.

Validation:

- A signed-out browser can read only published safe content.
- A user cannot read another user's private delivery or subscription using the public API.
- The service-role key does not appear in built assets, HTML, source maps, or browser network requests.
- Auth callback rejects external redirect destinations.
- Signed storage URLs expire after their stated lifetime. Making a delivery private prevents new non-owner access immediately; an already issued signed URL remains a bearer capability until expiry or object deletion.

## OpenAI values

Use a project-scoped key from a paid OpenAI API project, set provider budgets/alerts, and grant only the access the deployed service needs. The key must be read in server-only modules. A ChatGPT subscription does not fund API usage.

`OPENAI_AUDIO_JUDGE_MODEL` is an operational override so an audio-capable model can be evaluated and rolled back without changing source. The configured model must accept WAV/MP3 audio input and function calling. Before switching:

1. Run the fixed calibration set.
2. Compare score distributions, subgroup slices, invalid-schema rate, latency, and cost.
3. Update the stored model/rubric version.
4. Canary in staging or a small production cohort.
5. Keep the previous model value ready for rollback.

The production readiness check must fail loudly when `DELIVERY_AI_MODE=live` and `OPENAI_API_KEY` is absent. `DELIVERY_AI_ALLOW_MOCK_FALLBACK` must be false outside local/preview demonstration contexts.

Current official references:

- [OpenAI audio model catalog](https://developers.openai.com/api/docs/models/gpt-audio-1.5)
- [OpenAI Chat Completions API](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)
- [OpenAI API key dashboard](https://platform.openai.com/api-keys)

## Stripe values

Stripe has independent sandbox/test and live objects. A test price ID does not work with a live secret key, and a local Stripe CLI signing secret is not the production endpoint secret.

Required out-of-band setup:

1. Product: Delivery Pro
2. Recurring monthly price → `STRIPE_PRO_MONTHLY_PRICE_ID`
3. Recurring annual price → `STRIPE_PRO_ANNUAL_PRICE_ID`
4. Customer Portal configuration
5. Webhook endpoint → `/api/stripe/webhook`
6. Endpoint events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

For local forwarding:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Put the printed `whsec_…` value in the local `STRIPE_WEBHOOK_SECRET`. Restart the development server after editing environment values.

Production checks:

- Webhook signature is verified against the raw body.
- Duplicate delivery of the same event is harmless.
- Events can arrive out of order; the handler fetches the customer's current
  subscriptions and orders applied snapshots by retrieval time rather than treating
  a Stripe event ID as a causal clock.
- Checkout success does not grant Pro until server state is reconciled.
- Existing nonterminal Delivery subscriptions route to Portal, a matching open
  Checkout Session is reused, and obsolete competing sessions are expired.
- Historical duplicate active subscriptions are not automatically canceled or
  refunded. Billing operations must detect them, select the intended subscription,
  cancel/refund the duplicate in Stripe, and verify reconciliation through a later
  signed webhook.
- Cancellation at period end, immediate cancellation, failed renewal, recovery, plan interval change, and refund/support paths have been tested.
- Automatic tax is enabled only after Stripe tax registrations and business configuration are complete.

See Stripe's [subscription integration](https://docs.stripe.com/billing/subscriptions/build-subscriptions), [subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks), and [sandbox testing](https://docs.stripe.com/testing).

## Upstash / distributed rate limiting

When both Upstash values are absent, local development may use a process-memory limiter. That limiter resets on restart and does not coordinate across regions or server instances. It is not an adequate abuse control for a public paid API, so production configuration validation requires both Upstash values and production requests fail closed if the limiter is unavailable. Production also requires `DELIVERY_DEVICE_SECRET`; rotate it deliberately because changing it invalidates guest device signatures.

If one Upstash variable exists without the other, configuration should fail closed or surface a clear startup error. Use separate databases/tokens for staging and production and set spend/command alerts.

## Deployment scopes

Use independent values for:

- **Development:** local developer resources or sandbox providers
- **Preview:** staging Supabase, OpenAI project limits, Stripe sandbox, staging Redis
- **Production:** production Supabase, live Stripe, production OpenAI project, production Redis

Do not point arbitrary pull-request previews at production databases or billing. If previews must use third-party resources, protect them with authentication and use staging projects.

## Scheduled safety cleanup

Schedule `POST /api/moderation/cleanup?limit=100` at least once per minute in production with `Authorization: Bearer $MODERATION_CLEANUP_SECRET`. Supply the secret from the host secret store, never a URL or repository file. The worker leases at most 100 jobs, records idempotent removals, retries with exponential backoff, dead-letters after ten failures, and reconciles account-deletion receipts when Auth deletion completed but the final receipt write/HTTP response was lost.

Equivalent scheduler request (inject the values from the scheduler's secret store
and suppress request-header logging):

```bash
curl -fsS -X POST \
  "$NEXT_PUBLIC_APP_URL/api/moderation/cleanup?limit=100" \
  -H "Authorization: Bearer $MODERATION_CLEANUP_SECRET"
```

The moderation action route also attempts immediate avatar/share removal. The scheduled worker remains the authoritative recovery path. Alert when a cleanup job is dead, the oldest eligible job is more than five minutes old, or an account-deletion job remains failed/media-complete without reconciliation.

Environment changes apply to the next deployment, not an already-running deployment. After changing callback URLs, webhook secrets, prices, model names, or public app origin, redeploy and rerun the targeted smoke tests.

## Secret-handling rules

- Never commit `.env*` files containing values.
- Never paste keys into tickets, chat, screenshots, analytics, or CI logs.
- Never print environment objects or provider error objects without redaction.
- Use the hosting provider's encrypted secret store and least-privilege team access.
- Rotate a secret immediately if it may have been exposed; assume build logs and browser bundles are durable.
- Rotate production service-role, OpenAI, Stripe, and Redis credentials on an operational schedule and after access changes.
- Store a key owner, creation date, allowed environment, and rotation record outside the repository.
- Use automated secret scanning in source control and CI.

## Configuration validation

`GET /api/health` invokes the complete production configuration assertion and should
be a required deployment-readiness gate. A successful `npm run build` alone does not
prove that credentials are present, provider accounts are active, migrations are
applied, or upstream services are reachable. Individual protected routes also
validate the configuration they use.

The readiness assertion validates:

- `NEXT_PUBLIC_APP_URL` is an exact HTTPS origin in production, with no trailing slash, path, query, credentials, or fragment; localhost may use HTTP outside production.
- `NEXT_PUBLIC_SUPABASE_URL` uses HTTPS in production.
- Boolean variables accept only explicit `true` or `false`.
- `DELIVERY_AI_MODE` is exactly `live` or `mock`.
- Live AI mode has an OpenAI key.
- Production disallows mock fallback.
- Stripe configuration is all-or-nothing; both prices and both secrets are present when billing is enabled.
- Both Upstash values are present together.
- Server-only variables are never imported by client modules.

The readiness response may report dependency categories and build/version metadata, but must never return variable values, key prefixes, provider account IDs, or detailed upstream errors. Provider activation, webhook registration, DNS/TLS, database restore readiness, live model access, scheduler execution, alert delivery, and staffing are external launch evidence; none can be inferred from environment-variable presence.
