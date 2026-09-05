# Delivery data operations

This directory is the deployable Supabase contract for Delivery. The catalog in
`src/data/content.ts` is the instant-play fallback bundled with the web app;
`seed.sql` publishes the same 6 active packs, 86 playable lines (72 originals and
14 recognizable short phrases), and 36 active directions to Postgres. It also
preserves 147 retired line identities and 60 retired direction identities for
existing receipts. Active draws require `draw_enabled` as well as publication.

## Files

- `migrations/202608250001_delivery_core.sql` — enums, tables, indexes, triggers,
  rollups, deterministic daily generation, and challenge-entry invariants.
- `migrations/202608250002_delivery_security_and_views.sql` — RLS, grants, safe
  helper functions, live feed/leaderboard views, invite lookup, and Storage buckets.
- `migrations/202608250003_judged_play_quota.sql` — atomic UTC-day free/Pro
  reservations and exactly-once provider-failure refunds.
- `migrations/202608250004_hardened_mutations_and_billing.sql` — checked delivery
  publishing plus durable, ordered Stripe webhook processing.
- `migrations/202608250005_durable_progression.sql` — canonical rollups, streaks,
  badges, challenge completion, and progression-safe publishing.
- `migrations/202608250006_challenge_matchups.sql` — signed, expiring two-player
  invite receipts and immutable participant binding.
- `migrations/202608250007_ranked_daily_entries.sql` — one immutable ranked Daily
  claim per player/day, symmetric blocks, submission deduplication, anonymous
  report identity boundaries, and server-owned social mutations.
- `migrations/202608250008_moderation_resolution.sql` — atomic, service-only staff
  decisions, durable containment, audit actions, and profile-edit enforcement.
- `migrations/202608250009_account_deletion_saga.sql` — serialized account
  containment, durable cleanup checkpoints, and deletion-safe invite revocation.
- `migrations/202608250010_stripe_snapshot_ordering.sql` — current-object Stripe
  snapshot ordering and reconciliation-safe subscription application.
- `migrations/202608250011_moderation_cleanup_and_appeals.sql` — durable storage
  cleanup work plus an audited, service-only restriction-lift workflow.
- `migrations/202608250012_challenge_block_privacy.sql` — symmetric block and
  account-deletion serialization, challenge revocation, social-write guards, and
  the participant-only private-profile matchup projection.
- `migrations/202608250013_daily_leaderboard.sql` — canonical current-UTC global
  Daily boards and authenticated current-viewer rank lookup.
- `migrations/202609050014_classic_content_rating.sql` — additive Mature rating
  and draw eligibility; commit before using the enum in 015.
- `migrations/202609050015_classic_content_v2.sql` — original Classic rework;
  immutable new IDs and explicit legacy retirement.
- `migrations/202609050016_mature_private_boundary.sql` — private-only Mature
  recordings, raw-write enforcement and existing-share-pointer preflight.
- `migrations/202609050017_classic_content_v3.sql` — Step 1B refinements and
  sourced short phrases, with immutable replaced IDs and compatible short Daily draws.
- `seed.sql` — idempotent launch catalog, badges, pack membership, and a rolling
  31-day global daily-challenge horizon.
- `tests/database/*.test.sql` — schema, RLS, progression, challenge, Daily,
  anonymous-report, and moderation behavioral checks for pgTAP.

## Local setup

For SQL validation without external services, run the isolated PostgreSQL WASM
harness:

```bash
npm ci --prefix scripts/local-db --ignore-scripts
node scripts/local-db/run.mjs
```

This executes actual migrations and pgTAP, but its explicit Auth/Storage schema
shims do not validate Supabase HTTP authentication, Storage signing or concurrent
races. See [the boundary contract](../scripts/local-db/README.md).

For the full disposable local stack, install the Supabase CLI and Docker, run
`supabase init` once if `supabase/config.toml` is absent, then run:

```bash
supabase start
supabase db reset
supabase test db
```

`db reset` applies every numbered migration and then `supabase/seed.sql`. It is safe to run
the seed repeatedly: active v2/v3 line and direction rows use immutable inserts,
pack memberships upsert by IDs, badges upsert by ID, and existing daily assignments
are preserved. Replaced IDs leave new draws through explicit `draw_enabled=false`,
not deletion. Do not rewrite existing line/direction text behind old IDs.

After changing the schema, replace the temporary permissive TypeScript database
shape with generated types:

```bash
supabase gen types typescript --local > src/lib/supabase/database.generated.ts
```

## Production rollout

1. Create separate Supabase projects for staging and production.
2. Link the intended project and run `supabase db push`.
3. Review `seed.sql`, then execute it once using the Supabase SQL editor or `psql`
   with `ON_ERROR_STOP=1`. `db push` does not seed a hosted project automatically.
4. Configure Auth providers and redirect URLs. Anonymous-first gameplay should stay
   nonpersistent; authenticated users receive a profile/subscription/stats row from
   the `auth.users` trigger.
5. Set server-only `SUPABASE_SERVICE_ROLE_KEY`. Never expose it through a
   `NEXT_PUBLIC_*` variable or send it to the browser.
6. Run the contract tests against a disposable branch database and exercise the RLS
   matrix below before promoting.

The service role intentionally owns these operations:

- inserting or updating `delivery_scores` after trusted AI judgment;
- writing transcripts, moderation labels, state transitions, and share assets;
- syncing Stripe customer/subscription state;
- generating/refreshing leaderboard snapshots and usage counters;
- calling `ensure_daily_challenge` and performing moderation actions.

Do not grant clients write access to `delivery_scores`, `subscriptions`, stats, or
leaderboard snapshots. In particular, a user must never be able to replace their
`stripe_customer_id`: server-side Checkout and webhook handlers should use the
admin client for that write.

## Storage contract

| Bucket | Visibility | Key convention | Purpose |
| --- | --- | --- | --- |
| `delivery-audio` | Private | `{auth.uid()}/{deliveryId}.{ext}` | Original microphone takes |
| `delivery-share` | Private | `{auth.uid()}/{deliveryId}/{asset}` | Moderated cards and rendered share clips |
| `avatars` | Public | `{auth.uid()}/{asset}` | Profile avatars |

Raw and generated delivery assets are written only by trusted server routes after
quota, ownership, MIME, size, and moderation checks. Browser roles have no direct
`delivery-audio` or `delivery-share` upload grant. Deletion and share-asset writes
also go through the trusted service so database state and objects cannot diverge. Raw audio
is never public: trusted routes should issue short-lived signed URLs after checking
`can_view_delivery`, or stream it server-side. The same gate applies to generated
share assets, so moderation or unpublish prevents new access immediately. Public feed rows only include judged
deliveries whose visibility is explicitly `public`; database default visibility is
`private`.

Storage objects are not automatically removed by a Postgres row cascade. A trusted
account-deletion/retention worker must remove the object first (or enqueue its path)
and then delete the delivery/profile row. Configure lifecycle cleanup for abandoned
uploads that never reach `judged`.

## RLS matrix

- Public/anonymous: published catalog, active trends, daily challenge, non-private
  profiles, judged public deliveries and scores, public feed, live leaderboard, and
  public avatar objects; share assets require a visibility-checked signed URL.
- Authenticated player: all public access plus scoped reads of their own profile,
  private deliveries, favorites, follows, challenges, reactions, stream votes,
  submissions, reports, subscription row, usage, and restrictions. Security-sensitive
  mutations use validated API routes and the service role; browser roles do not gain
  direct write grants merely because a row belongs to them.
- Challenge participants: challenge metadata and entries in which they participate;
  invite secrets are checked only by `get_challenge_by_invite(code, token)`. The
  authenticated `get_challenge_match_entries(challenge_id)` projection is the only
  private-profile exception: it returns compact participant identity, judged score,
  and owned recording path after both challenge and delivery containment gates.
- Staff: editorial and moderation tables through an explicit `moderator`/`admin`
  profile role.
- Service role: bypasses RLS for trusted backend jobs. It must remain server-only.

`line_submissions` is canonical. `user_submissions` is a transitional, auto-updatable
compatibility view for the launch API and can be removed after all clients migrate.
Automated labels supplied by a user-scoped route are hints only; the moderation
worker must rescan the normalized line before publication.

## Judged-play quota

Call `reserve_judged_play` inside the judge route's existing idempotent callback and
before spending model capacity. Free users receive five judged plays per UTC day;
active/trialing Pro users are uncapped. The function durably claims the attempt key,
upserts the day's counter, and locks that user/day row before checking/incrementing,
so retries and concurrent requests cannot double-spend. Denied attempts do not
increment.

Only the trusted service has execute permission. The backend passes the already
authenticated user explicitly:

```sql
select * from public.reserve_judged_play(
  'attempt_01HZZZZZZZZZZZZZ',
  '00000000-0000-0000-0000-000000000000'
);
```

Browser roles have no execute grant, preventing clients from creating durable claim
spam outside the rate-limited judge route. The response includes `claim_id`, `allowed`, `used`, `play_limit`,
`remaining`, `reset_at`, `tier`, and `replayed`. Pro returns `null` for
limit/remaining. If `replayed=true`, return the outer idempotency result and never
invoke the model again.

If and only if the model/provider fails before producing a judgment, the service role
refunds the reservation exactly once:

```sql
select * from public.release_judged_play(
  '00000000-0000-0000-0000-000000000000', -- claim_id
  '00000000-0000-0000-0000-000000000000'  -- user_id assertion
);
```

Do not refund when persistence, sharing, or another post-judgment step fails: the user
received the judged play. Retain claims longer than idempotency responses.

## Checked publishing

Authenticated clients have no direct `UPDATE` privilege on `deliveries`, and cannot
replace recording/share paths or toggle visibility. A trusted route uses the
service-only `set_delivery_visibility(delivery_id, 'public', user_id)` to publish and
`'private'` to unpublish. Publishing succeeds only for an owned, judged, scored
delivery with audio, no publishing restriction, no unsafe/hold label, and the
explicit `publish-approved` label written by server moderation. An empty label array
is never treated as approval.

## Stripe event contract

Webhook handlers use three service-role RPCs after verifying the Stripe signature:

1. `claim_stripe_webhook_event(...)` durably claims the event. A recent in-flight or
   completed event returns `claimed=false`; failed/stale work can be retried.
2. The handler lists the customer's current Stripe subscriptions, deterministically
   selects one canonical Delivery subscription, and calls
   `apply_stripe_subscription_event(...)` with that freshly retrieved object snapshot.
   `stripe_snapshot_retrieved_at` is the causal ordering boundary; the event ID is an
   audit/idempotency identifier, not a sortable clock. `stale=true` is a successful
   no-op, not an error, and an exact retrieval-time tie fails toward the safer terminal
   state.
3. `finish_stripe_webhook_event(event_id, 'processed'|'ignored'|'failed', error)`
   closes the ledger row. Store only a payload hash; do not retain whole Stripe
   payloads with customer data.

The initial Checkout customer-ID link and all webhook writes use the admin client.
Never grant a signed-in browser permission to rewrite `stripe_customer_id`.
Checkout also lists current subscriptions before creating a session: a nonterminal
Delivery subscription routes to Portal, a matching open session is reused, and
obsolete competing sessions are expired. This does not automatically cancel or
refund historical duplicate active Stripe subscriptions. Operations must detect and
resolve those in Stripe, then confirm convergence through a signed webhook.

## Content and trend workflow

Built-in content changes follow this sequence:

1. Add a new immutable line ID (or direction ID) with tags, rating, difficulty,
   scoring focus, pack, and source/publication evidence when applicable. Freeze
   replaced wording for historical lookup.
2. Add a numbered migration for existing databases and mirror it in `seed.sql`.
   Retire only the explicit replaced IDs from new draws; retain history joins.
3. Run `validateContentCatalog()` and the database tests; verify parity, intensity,
   compatible short-line pairings, and historical UUID/text preservation.
4. Ship the app fallback, additive migration, and seed in the same release.

Fast-moving culture should not require an application release:

1. An editor creates a short, original or cleared prompt with `source='trend'` and
   `state='review'`.
2. Moderation/rights review changes it to `published`.
3. Create a `trend_campaigns` row with UTC start/end, markets, priority, and an
   internal editorial note; attach prompts/modifiers in `trend_prompts` with weights.
4. Client/server queries select only active published windows. End or archive a
   campaign rather than deleting historical content.
5. Weekly editorial review removes stale moments and promotes evergreen winners to
   a named pack.

For dailies, keep at least 30 days prepared. Selection is restricted to active,
published prompts with an active Free or rotating pack membership; Pro-only packs
never leak into the promised Free Daily experience. A trusted scheduled server job
can extend the horizon without changing existing dates:

```sql
select public.ensure_daily_challenge((now() at time zone 'UTC')::date + 30, 'global');
```

Do not expose arbitrary future generation to a public query parameter. Public reads
may preview already-created rows, while the trusted route should only ensure today's
UTC row and the scheduled job owns future preparation.

The canonical Daily board is separate from the rolling generic leaderboard. Query
`daily_leaderboard_live` for today's UTC `global` challenge, filtering one of
`overall`, `commitment`, `comedy`, or `chaos`, ordering by `rank`, and limiting the
public response to the desired top N. Each row is the user's immutable first scored
receipt (`daily_ranked=true` plus its durable claim); practice takes, private or
blocked profiles, deleted accounts, unpublished prompts, and moderation-contained
rows are excluded. The view returns `participant_count` alongside the score axes.

For a signed-in player's position below top N, call:

```sql
select * from public.get_daily_leaderboard_position('overall', 'global');
```

The authenticated security-invoker RPC returns either zero rows or the same 21-column
row shape as `daily_leaderboard_live`: `period`, `metric`, `rank`,
`participant_count`, `challenge_date`, `market`, `user_id`, `handle`,
`display_name`, `avatar_path`, `delivery_id`, `prompt_id`, `energy_modifier_id`,
`score`, `overall`, `commitment`, `comedy`, `accuracy`, `chaos`, `headline`, and
`created_at`. It accepts only the canonical four metrics and `global` market.

## Moderation workflow

1. Normalize and locally preflight a submission; rate-limit by authenticated user.
2. Run server-side text safety and PII checks before insert. Rejected attempts need
   not be retained beyond abuse telemetry.
3. Insert acceptable candidates into `line_submissions` in `review` with automated
   labels/scores.
4. Human reviewers check safety, originality/licensing, and cultural context.
5. On approval, create a canonical `prompts` row, set `promoted_prompt_id`, and mark
   the submission `published`. Rejections retain a concise internal reason.
6. Reports enter `reports`; `/moderation` lists urgent items first for authenticated
   moderator/admin profiles. `resolve_moderation_report` atomically contains the
   delivery, profile, prompt, or submission, records an immutable
    `moderation_action`, and resolves the report. Active profile enforcement is also
    represented in `account_restrictions` so a normal profile edit cannot undo it.
7. The same transaction queues avatar/share-object cleanup before clearing object
   pointers. The moderation route attempts immediate deletion, while the protected
   `/api/moderation/cleanup` worker leases jobs, retries with exponential backoff,
   dead-letters after ten failures, and reconciles completed account-deletion receipts.
8. `lift_moderation_restriction` is service-only, moderator/admin authorized, and
   audited. Lifting a restriction does not restore removed content, prior visibility,
   follows, avatars, or share assets.

## Launch verification

- Confirm `supabase db reset` and `supabase test db` succeed from an empty disposable
  local database, then retain hosted migration/RLS evidence separately.
- Confirm 6 active packs, 86 active prompts, and 36 active directions, each both
  published and draw-enabled, with no orphaned `pack_prompts` rows. Retired
  published rows remain available for historical references.
- Test anonymous, owner, follower, challenge participant, moderator, and service-role
  reads/writes separately.
- Verify a private delivery and every `delivery-audio` object are inaccessible by an
  unauthenticated request.
- Verify user-scoped clients cannot insert scores or update subscription identifiers.
- Upload and play every backend-accepted audio MIME type; enforce the API's stricter
  15 MiB limit before Storage's 25 MiB ceiling.
- Test Stripe webhooks idempotently, including current-object snapshot ordering and
  the operator flow for detecting/canceling/refunding an unintended duplicate active
  subscription before reconciling tier/state.
- Confirm `/api/leaderboard?period=daily&metric=overall&market=global` matches
  `daily_leaderboard_live`, and that `get_daily_leaderboard_position` returns a
  blocked/privacy-aware viewer rank below top N while practice takes remain unranked.
- Confirm a private-profile challenge opponent is visible only through the authorized
  participant matchup projection; third parties, blocked pairs, contained accounts,
  and revoked completed invite receipts fail closed.
- Confirm daily generation, trend expiration, report triage, signed audio playback,
  moderation cleanup retry/dead-letter behavior, deletion cleanup, feed ordering, and
  all four leaderboard metrics.
