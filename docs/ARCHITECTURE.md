# Architecture and data model

## System shape

Delivery uses a Next.js App Router application as the web, server-rendering, and API boundary. Supabase provides identity, Postgres, and object storage. OpenAI listens to the server-submitted waveform and returns a structured voice judgment. Stripe owns payment collection; verified webhooks materialize entitlements in Postgres. Upstash Redis coordinates production abuse controls, anonymous-report limits, guest daily quotas, and cross-instance result replay.

```text
Browser
  ├─ Next.js pages / React client islands
  ├─ MediaDevices + Web Audio PCM/WAV recorder
  └─ local playback / share sheet
          │
          ▼
Next.js server
  ├─ authenticated route handlers
  ├─ prompt selection and challenge rules
  ├─ upload validation / signed storage access
  ├─ direct waveform judgment → deterministic accuracy recompute
  ├─ moderation and publication
  └─ Stripe Checkout / Portal / signed webhook
       │             │              │
       ▼             ▼              ▼
  Supabase       OpenAI API      Stripe API
  Auth/DB/       Audio Judge     Billing
  Storage        (structured)    lifecycle
```

## Boundary rules

- Browser code may receive public configuration and user-scoped data only.
- Server Components use the cookie-scoped Supabase client and respect RLS.
- Mutating route handlers authenticate the user, validate input, check rate limits, and perform one idempotent domain operation.
- The Supabase service-role client is limited to server-only operations that cannot be expressed safely with user-scoped RLS.
- Audio is never sent to OpenAI from the browser; no provider secret is shipped to a client bundle.
- A Stripe redirect is advisory. A verified webhook is authoritative for paid entitlement.
- Public pages query a publication-safe projection, not arbitrary delivery rows.
- Analytics payloads contain opaque IDs and coarse properties, never audio, transcript text, email, or secrets.

## Suggested source layout

The exact component names may evolve; responsibility should remain recognizable:

```text
app/
  (marketing)/                 landing, pricing, policy
  (game)/                      play, daily, result, challenge
  (social)/                    feed, packs, profile, leaderboards
  (account)/                   history, settings, billing
  api/
    judge/
    prompts/random/
    prompts/daily/
    submissions/
    share/[deliveryId]/
    stripe/{checkout,portal,webhook}/
components/
  game/                        recorder, prompt, judge states, scorecard
  social/                      delivery cards, reactions, rank rows
  ui/                          design-system primitives
lib/
  ai/                          direct-audio rubric, schema, normalization
  audio/                       codecs, limits, deterministic features
  auth/                        session and authorization helpers
  content/                     selection, eligibility, trend slots
  moderation/                  policy, classifiers, report workflow
  rate-limit/
  stripe/
  supabase/
  analytics/
supabase/
  migrations/
  seed.sql
content/
  packs/
  energies/
tests/
  unit/
  integration/
  e2e/
```

## Delivery judgment pipeline

### Request contract

`POST /api/judge` accepts multipart form data:

- encoded audio blob
- prompt/line identifier
- energy identifier
- client take duration
- game mode and optional challenge/run identifier
- idempotency key generated once per submitted take

The server derives the authenticated or anonymous session identity; it does not trust a submitted user ID. Enforce content type, total body size, duration range, prompt eligibility, challenge validity, and current quota before external calls.

### Stages

1. **Identify and coalesce:** derive the authenticated user or signed guest-device scope, validate the attempt key, and coalesce process-local retries with a request fingerprint.
2. **Resolve content:** load the canonical published prompt and energy server-side; validate challenge, Daily Drop, and Pro entitlement context without trusting display text.
3. **Validate audio:** inspect the actual container and MIME signature, duration, checksum, and PCM WAV RMS/peak; reject silent, malformed, oversized, or mismatched takes.
4. **Reserve quota:** atomically reserve a durable signed-in play or distributed guest play before calling a paid provider. Exact retries never call the model twice; pre-judgment failures release the reservation.
5. **Hear and judge:** send the WAV/MP3 waveform, quoted target line, energy, duration, and mode to `OPENAI_AUDIO_JUDGE_MODEL`. A forced function call returns speech detection, a literal transcript, commitment, comedy, chaos, and the written verdict; audible dimensions are based on prosody, timing, pacing, dynamics, and pauses.
6. **Accuracy and validation:** validate tool arguments with Zod, fail closed on no speech/refusal, compare literal transcript words with the target line, and recompute the weighted overall score server-side.
7. **Moderate publishing:** new takes default private. An explicit publish request moderates the prompt, transcript, verdict, highlights, and coaching copy; only an explicit `publish-approved` marker can cross the service-only visibility transition.
8. **Persist:** for signed-in users, upload once to `delivery-audio/{user-id}/{delivery-id}.{ext}`, insert the private delivery and score, and attach any challenge entry. Guests remain ephemeral.
9. **Publish if approved:** call the guarded visibility RPC only after persistence. A publish failure leaves the take private without discarding the score.
10. **Respond:** return the scorecard, usage/tier snapshot, privacy state, retryability, warning, and next actions. Audio playback always uses a short-lived signed URL.

### Structured verdict schema

The judge should return a versioned object equivalent to:

```json
{
  "commitment": 82,
  "comedy": 74,
  "chaos": 68,
  "verdict": "...",
  "verdictTag": "COMMITTED_TO_THE_BIT",
  "highlights": ["..."],
  "coachNote": "..."
}
```

Constraints:

- Returned dimension scores are integers 0–100; Accuracy is calculated by application code from the transcript.
- Highlights are short, performance-specific, and contain no sensitive-attribute inference.
- Verdict is concise and avoids profanity in the safe-default tier.
- Verdict tag is selected from the application allowlist and doubles as the compact share headline.
- Coach Note gives one actionable retry instruction.
- Overall score is computed by application code using a versioned mode rubric.
- Low-confidence or unusable audio returns a retry state instead of invented precision.

Recommended default Classic weighting:

```text
overall = round(
  commitment × 0.30 +
  comedy     × 0.25 +
  accuracy   × 0.25 +
  chaos      × 0.20
)
```

Impossible Energy can shift weight toward commitment and chaos, but weights remain server-versioned and stored with each result.

### Reliability

- One bounded retry for a transient direct-audio judgment failure or invalid structured judgment, with jitter and a hard request deadline.
- No retry on authentication, quota, policy, validation, or unsupported-media errors.
- Idempotency prevents duplicate uploads, API spend, results, and streak advancement.
- In production, live-mode failure returns a transparent retry state. Mock fallback must stay disabled.
- Store provider request IDs, model names, latency, token/audio usage, rubric version, and error class without logging content.
- Use a dead-letter/admin review queue for repeated asynchronous share rendering or aggregation failures.

## HTTP API contracts

| Route | Auth | Purpose | Key controls |
| --- | --- | --- | --- |
| `GET /api/prompts/random` | Optional; required for Pro pool | Eligible prompt+energy draw | no-store, active windows, verified entitlement, market trend weighting, published compatible energy |
| `GET /api/prompts/daily` | Optional | Current daily prompt | UTC content-day key; bundled fallback only when Supabase is unconfigured |
| `POST /api/judge` | Optional session; account for persistence features | Upload and judge take | multipart limits, idempotency, quota, abuse limits |
| `POST /api/submissions` | Required | Submit a line for review | text moderation, duplicate detection, cooldown |
| `POST /api/reports` | Optional | Report one visible delivery/profile/prompt/submission | signed-device + network HMAC limits for guests, no raw IP storage, idempotent admin insert |
| `GET /api/leaderboard` | Optional | Generic rolling boards or canonical Daily board | private/no-store, RLS/block-aware; Daily uses `daily_leaderboard_live` and returns an authenticated `viewer` position below top 100 |
| `POST /api/challenges` | Required + Pro | Create a signed challenge invite | server-generated code/token, rate limit, deletion/moderation/block gates |
| `POST /api/moderation/cleanup` | Staff session or protected worker bearer | Drain revoked avatar/share media and reconcile completed deletion receipts | service-only leases, bounded batches, exponential backoff, no-store |
| `GET /api/leaderboard` | Optional | Viewer-scoped weekly/all-time board or canonical current Daily board | private no-store, block/privacy RLS, top 100, authenticated Daily viewer position |
| `GET /api/share/[deliveryId]` | Public for published result | Publication-safe share payload | visibility/review check, no storage path |
| `POST /api/stripe/checkout` | Required | Open Pro Checkout or route an existing recoverable subscription to Portal | live Stripe reconciliation, allowlisted prices, open-session reuse, distributed create coalescing |
| `POST /api/stripe/portal` | Required | Create Billing Portal Session | owner/customer match |
| `POST /api/stripe/webhook` | Stripe signature | Materialize subscription state | raw-body signature, event idempotency, replay safety |

All mutation errors return a stable machine code, safe user message, request ID, and `retryable` flag. Do not leak provider responses or stack traces.

## Database conventions

- UUID primary keys unless a smaller natural key is clearly immutable.
- `created_at` and `updated_at` use timezone-aware UTC timestamps.
- Soft lifecycle fields use constrained enums; audit-critical rows are not hard-deleted during normal operations.
- User-facing handles and slugs have normalized unique companion columns.
- Foreign keys declare deletion behavior deliberately.
- JSONB is reserved for versioned provider payload fragments or flexible metadata, not core relationships.
- Every public query has an index matching visibility/status plus its sort key.
- RLS is enabled on all public-schema tables, including “internal” tables, with service-role-only policies where needed.

## Core data model

This section describes the schema that is actually created by the numbered
migrations. Proposed future splits or queue tables are labeled explicitly; they do
not exist merely because they would be useful at higher scale.

### Identity and access

**`profiles`**

- `id` → `auth.users.id`
- case-insensitive unique `handle`, `display_name`, `bio`, `avatar_path`
- `role`: user, moderator, admin
- `is_private`, `is_verified`, `locale`, activity and audit timestamps

**`profile_preferences`**

- `user_id`
- timezone, autoplay, captions, reduced motion
- challenge/product email preferences and default delivery visibility
- bounded JSON metadata and audit timestamps

**`blocks`**

- `blocker_id`, `blocked_id`, timestamps
- unique pair; blocking suppresses profile, feed, reactions, and challenge interactions

### Content

**`content_packs`**

- `id`, case-insensitive `slug`, name/description, art and visual metadata
- `access`: free, pro, rotating; `state`: draft, review, published, rejected, archived
- categories/tags, featured/order, availability window, creator and audit timestamps

**`prompts`**

- `id`, case-insensitive `slug`, `body`, locale, category, difficulty and rating
- source, optional submitter/source label, mimic flag, tags and safety labels
- scoring focus, metadata, availability window, state and generated search document

**`energy_modifiers`**

- `id`, `slug`, instruction, short label, intensity and tags
- optional compatible difficulties, state, metadata and audit timestamps

**`pack_prompts`**

- `pack_id`, `prompt_id`, sort order, featured flag and timestamp

**`trend_campaigns`** and **`trend_prompts`**

- scheduled campaign window, market, priority, state, and editorial note
- weighted prompt joins with optional energy modifier
- the application content layer supplies evergreen fallback when no campaign is active

**`daily_challenges`**

- UTC `challenge_date`, `market`, exact prompt and energy IDs, optional title/sponsor
- primary key `(challenge_date, market)`; launch product accepts only `global`

### Play

**`deliveries`** and **`delivery_scores`**

- delivery ID and required user ID for durable records; guest results remain ephemeral until a dedicated claim design is implemented
- prompt, energy, challenge, stream, and Daily date/market references
- `daily_ranked` marks only the durable first scored Daily receipt; later Daily takes are practice
- state: uploading, processing, judged, failed, removed
- visibility: private, unlisted, public
- recording/share object paths, MIME, bytes, duration, waveform, take count
- bounded transcript/confidence and moderation labels on the delivery row
- overall and dimension scores, optional confidence, headline, verdict
- provider, model, rubric, evidence, and safety metadata
- publication/scoring timestamps and created/updated timestamps

**Future restricted transcript split** (not implemented)

The current schema keeps the bounded transcript on `deliveries`; RLS and server-only
mutation grants are therefore part of its privacy boundary. A future migration may
move transcript/provider support data into a narrower table, but operators must not
assume a `delivery_private_data` table exists today.

**`daily_ranked_claims`**

- private durable ledger keyed by `(user_id, challenge_date, market)`
- references the immutable first scored Daily delivery, or retains a tombstone when
  that delivery is deleted so a better retry cannot steal the ranked slot
- written by the trusted score trigger; browser roles cannot read or mutate it

**`prompt_favorites`**

- user, line, created timestamp; unique pair

### Challenges and social

**`challenges`** and **`challenge_entries`**

- public lookup code plus a SHA-256 token digest; the bearer token itself is never stored
- creator, optional atomically bound recipient, prompt, energy, state, visibility,
  optional bounded message, maximum entries, expiry and completion timestamps
- entries bind one judged delivery per entrant; the first non-creator becomes the
  immutable recipient and a third account cannot enter
- `get_challenge_match_entries(challenge_id)` is an authenticated participant-only
  projection that permits compact identity for an ordinary private opponent while
  rechecking challenge/delivery/prompt/moderation/deletion/block containment
- a symmetric block cancels active bound challenges and permanently revokes signed
  tokens, including completed receipts; completed matchups are not public share pages

**`reactions`**

- delivery, authenticated user and controlled reaction kind
- controlled reaction type
- one current reaction per user/delivery; validated API writes are service-backed

**`stream_sessions`** and **`stream_votes`**

- host-owned room state, current prompt/energy, audience settings
- one bounded vote per signed-in voter and delivery

**`follows`**

- follower/following pair and timestamp; the schema supports a future opt-in social graph even if the launch UI keeps discovery lightweight

**`reports`**

- exactly one target (delivery/profile/prompt/submission), reason and bounded detail
- either an authenticated reporter or both device/network HMAC hashes for an
  anonymous report; raw IP/device identifiers are never stored
- state, assigned moderator, resolution timestamp and audit timestamps
- timestamps; target content remains the evidence source under staff authorization

**`moderation_actions`**

- target entity/user, policy code, action, actor
- evidence reference, duration, reversal/appeal fields, timestamps

### Progression and leaderboards

**`user_stats`**

- user, play counts, averages, personal bests
- streak metrics, category/energy summaries, last recomputed timestamp

**`badges`**, **`user_badges`**

- versioned badge definition and immutable earned event

**`leaderboard_live`**, **`daily_leaderboard_live`**, and **`leaderboard_snapshots`**

- generic rolling 24-hour/7-day/all-time personal-best boards require at least three
  distinct eligible public prompts per user/period/metric
- the Daily view ranks only today's exact UTC/global prompt+energy durable receipt;
  overall ties favor commitment, axis ties favor overall, then earliest score/ID
- Daily rows include `participant_count`; authenticated
  `get_daily_leaderboard_position(metric, market)` returns the current viewer's same
  row even below the API's top-100 slice
- both live views are viewer-scoped through RLS/block/privacy containment;
  `leaderboard_snapshots` exists for optional scheduled snapshots, but launch reads
  use the live views

At higher scale, move expensive generic aggregation to refreshed snapshots without
changing the Daily immutable-claim or viewer-privacy contract.

### User content and billing

**`line_submissions`**

- submitter, original text, normalized hash, suggested tags
- automated moderation output, review state, editor notes
- consent/originality assertion and timestamps

`line_submissions` is the canonical table name. If a `user_submissions` compatibility view exists during migration, treat it as transitional and do not build new integrations against it.

**`subscriptions`** and **`usage_counters`**

- user, tier/state, Stripe customer/subscription/price IDs
- status, current period bounds, cancel-at-period-end
- last event audit fields plus authoritative current-snapshot retrieval time

- subscription row stores Stripe customer/subscription/price IDs, plan/state, period, and cancellation state
- usage counters enforce period play, AI-score, share-render, and custom-challenge allowances
- `stripe_webhook_events` durably claims event IDs and payload hashes before an entitlement snapshot is applied; deployment verification must exercise replay, failure retry, and out-of-order delivery

### Progression, analytics, and moderation support

The migrations also include `judged_play_claims`, `badges`, `user_badges`,
`user_stats`, `user_category_stats`, `prompt_stats`, `leaderboard_snapshots`,
`reports`, `moderation_actions`, `account_restrictions`,
`moderation_storage_cleanup_jobs`, and the foreign-key-free
`account_deletion_jobs` receipt ledger.

## Row Level Security policy matrix

| Resource | Anonymous | Authenticated owner | Other signed-in users | Staff/server |
| --- | --- | --- | --- | --- |
| Live packs/lines/energies | Read safe published subset | Same | Same | Editors write |
| Profile | Read public fields | Read own; validated account API updates through service | Read public fields unless blocked/contained | Moderators read limited; admin by duty |
| Delivery | Read publication-safe public projection | Read own; validated API owns visibility/delete | Read publication-safe public projection | Service creates scores; moderators quarantine |
| Private audio | No direct read | Short-lived signed read for own item | Only if delivery explicitly published via controlled route | Narrow service access |
| Challenge | Valid code preview only | Sender/recipient read | No enumeration | Moderation access |
| Reactions | Aggregate read | Validated API creates/replaces/deletes | Validated API after target visibility checks | Moderate |
| Submission | No | Validated API creates; read own status | No | Editors/moderators review |
| Reports | No | Validated API creates/read acknowledgment | Anonymous serious reports use HMAC abuse identity | Trust staff review |
| Subscription/entitlement | No | Read own | No | Webhook/service write |
| Analytics/provider log | No | No | No | Operations-only |

Service-role use does not replace policy design. Keep a user-scoped client for operations that should remain subject to RLS, even inside server routes.

## Storage model

Buckets:

- `delivery-audio` — private source recordings
- `delivery-share` — private user-requested derivative cards/clips; visibility-checked routes issue short-lived signed URLs
- `avatars` — public profile images

Object convention:

```text
{user-id}/{delivery-id}.{ext}
{user-id}/{delivery-id}/share.{ext}
```

Controls:

- Server generates the path and persists it; client does not select arbitrary paths.
- Signed upload URLs, if introduced, are single-object, short-lived, and followed by server validation.
- Source-audio playback URLs are short-lived and issued only after a fresh authorization/visibility check.
- A public share derivative contains only content the owner explicitly published. Unpublish revokes new signed access immediately; issued URLs expire shortly, while delete/account-erasure removes the object.
- Discarded takes never upload.
- Orphan cleanup compares storage objects to delivery records.
- Object metadata does not contain transcript, prompt text, email, handle, or verdict.
- Separate lifecycle rules for source audio and derived share media.

## Authentication

- Email magic link or OTP is the safe baseline; social providers are optional accelerators.
- Use PKCE/cookie-backed SSR sessions and exchange the code only at the callback route.
- Validate redirect targets against a fixed allowlist; never reflect an arbitrary `next` URL.
- Link guest results only with a short-lived, single-use claim token bound to the browser session.
- Sensitive actions—email change, account deletion, billing portal—require recent authentication where available.
- Handle collisions are resolved server-side; profile creation is idempotent.

## Subscription and entitlement lifecycle

1. Authenticated user requests Checkout for an allowlisted price key, never an arbitrary Stripe price ID.
2. Server reuses or creates the mapped Stripe Customer, lists the customer's authoritative current subscriptions, and routes every active/trialing/past-due/unpaid/paused/incomplete Delivery subscription to Billing Portal instead of creating a second subscription.
3. If no recoverable subscription exists, the server reuses a matching open Checkout Session or expires an obsolete cadence choice and creates one distributed-idempotent session.
4. Browser redirects to Stripe.
5. Stripe posts signed lifecycle events.
6. The webhook claims the provider event ID in a durable idempotency ledger, then fetches the customer's current Stripe subscriptions instead of trusting the event payload as the latest state.
7. It selects one canonical Delivery subscription and applies that freshly retrieved object snapshot. `stripe_snapshot_retrieved_at` is the causal ordering boundary; event IDs remain audit identifiers, not clocks. An exact retrieval-time tie fails toward the safer terminal status.
8. Application derives active entitlements from the canonical subscription status and allowlisted price mapping.
9. Success/cancel pages re-fetch server state; they do not grant access from query parameters.
10. Billing Portal changes flow through the same webhook path.

This prevents the normal application paths from opening a second Delivery subscription and makes webhook replay converge on Stripe's current object state. It does **not** silently cancel or refund historical duplicate active subscriptions that already exist in Stripe. Operations must detect customers with more than one nonterminal Delivery subscription, choose the intended record, cancel/refund the duplicate in Stripe, and confirm that a subsequent signed webhook reconciles the database entitlement. Deleting a subscription does not delete user content.

## Content selection

The checked-in `src/data/content.ts` catalog is the unconfigured-environment/bootstrap fallback. `supabase/seed.sql` mirrors the approved catalog into `content_packs`, `prompts`, `energy_modifiers`, and `pack_prompts` so authenticated deliveries can persist against relational IDs. The seed is idempotent; catalog validation and a post-seed count/slug parity check are release gates. Once Supabase is configured, a database failure is surfaced as an upstream error rather than silently serving stale fallback content.

The random resolver reads published, currently available prompts through active pack memberships. Default draws admit Free and active rotating packs only. `includePro=true` is accepted only after server-side session and subscription verification. Pack, category, difficulty, comma-separated exclusion, seed, and market filters are applied before selection. Active market/global trend campaigns boost eligible lines using both campaign priority and line weight; a campaign-linked energy wins only when it is published and difficulty-compatible. The Daily resolver uses scheduled database pairs when Supabase is configured.

- live during the current content window
- published in the requested locale and reachable through an active eligible pack
- allowed for the caller's verified entitlement
- not included in the request's recent-line exclusion set
- paired only with a published difficulty-compatible energy

The resolver then applies seeded or random weighted sampling. Editorial trend slots can boost candidates but cannot bypass publication, availability, pack access, filters, or energy compatibility. The server returns stable slugs plus display content; submission revalidates those IDs so stale or altered prompts cannot enter ranked modes.

## Caching

- Marketing pages and immutable pack art: CDN-cacheable.
- Published pack/line lists: short shared cache with explicit revalidation on editorial publish.
- Daily prompt: cache by UTC content date, locale, and safety tier.
- Daily leaderboard: private, no-store, and viewer-scoped; the authenticated `viewer` position and block/privacy filters make shared caching unsafe.
- Random prompt draw: no-store; eligibility can change with session, entitlement, and campaign time.
- Public share payload: private, no-store, because profile privacy and block state are viewer-specific.
- Profiles/feed: user- and block-aware; do not use a cache key that can cross identities.
- Signed audio URLs: never shared-cache.
- Checkout, Portal, judgment, report, and submission responses: no-store.

## Installability and offline boundary

The shipped web app includes a manifest, installable icons, a standalone display mode, and mobile metadata. It does not register a service worker and does not promise offline gameplay, cached judgment, background sync, push notifications, or an in-app install prompt. Launch QA must test the manifest, icons, start URL, and add-to-home-screen flow on real supported iOS and Android devices. Any future offline claim requires a deliberate cache/data-retention design and separate failure-mode testing.

## Rate limits

Use a distributed store in production. Suggested independent buckets:

- prompt draw: generous per IP/session
- judge: per account, anonymous session, and IP; enforce plan quota before provider spend
- line submission: low daily cap plus duplicate hash
- reactions: burst plus sustained limit
- challenge creation/redemption: account/IP and code guessing protection
- reports: allow urgent reports while limiting floods
- Stripe routes: account-bound

Return `429` with a stable code and coarse retry time. Never disclose whether a guessed email, handle, challenge code, or private delivery exists.

## Observability

Every server request receives a correlation ID. Record:

- route, status, deployment, region, coarse auth state
- stage latency and external-provider request ID
- retry count, idempotency hit, error class
- model/rubric/schema version and aggregate usage
- storage and webhook outcomes

Redact authorization headers, cookies, API keys, raw multipart bodies, audio, transcripts, report details, Stripe payload fields beyond safe IDs, and signed URLs. Alert on p95 judgment latency, error spikes, moderation queue age, webhook lag/failures, AI mock fallback in nonlocal environments, and spend anomalies.

## Background work

The synchronous first release performs direct audio judgment inside one route when host timeouts permit. Move work to a durable queue before latency or volume threatens completion. Queue candidates:

- share video/audio rendering
- optional leaderboard snapshots if live views no longer meet the latency target
- profile stat recomputation
- content import and moderation backfills
- audio retention cleanup
- webhook replay reconciliation

Every job needs a stable idempotency key, bounded retries, dead-letter visibility, and an operator replay action.

## Failure and deletion semantics

- A technical failure never counts as a play, daily submission, or streak loss.
- If scoring completed but the response was lost, the same idempotency key retrieves the result.
- Unpublishing immediately removes feed/profile/leaderboard/share access before asynchronous media cleanup.
- Account deletion first hides public identity, removes takes from public/participant surfaces, cancels signed challenges/streams, and blocks protected mutations. It then advances a durable Stripe billing → keyset-paginated/batched media → Auth identity saga. Billing is stopped first so a partial failure cannot keep charging; later failures leave a contained, retryable account. A protected worker reconciles the narrow case where Auth deletion succeeds but the final receipt write/HTTP response is lost.
- Moderation inserts avatar/share cleanup jobs in the same database transaction as its containment and audit action, before object pointers are cleared. The route attempts immediate removal; a leased worker retries with exponential backoff and dead-letter visibility.
- Legal/security holds are exceptional, access-controlled, and disclosed in policy.
- Aggregate analytics may remain only after de-identification and policy review.
