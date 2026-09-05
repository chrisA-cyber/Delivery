# Step 1B database and integration evidence

The previous “SQL not run” gap now has executable local evidence. Delivery's
actual migration chain, seed, and pgTAP tests execute in disposable PostgreSQL
WASM databases. This is **SQL integration**, with explicitly supplied Auth/Storage
boundary shims. It is not a signed-in Supabase browser integration.

## Run and inspect

From the repository root:

```bash
npm ci --prefix scripts/local-db --ignore-scripts
node scripts/local-db/run.mjs
```

The independent package locks PGlite 0.5.8 and pgTAP 0.0.9. It accepts no database
URL and reads no credentials. All databases exist only in process memory and are
closed after the run. The report is
[`database.json`](evidence/classic-step-1b/database.json), including timestamps,
engine version, per-file TAP output, exact migration/seed hashes, active catalog
counts, and upgrade checks. See [`scripts/local-db/README.md`](../scripts/local-db/README.md)
for the complete boundary contract.

On this host Node is available at
`/Users/christopherassef/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`.
Prefix `PATH` with that directory if the ordinary shell cannot find Node/npm.
The local dependency installation used `--ignore-scripts`; no root dependency or
service was added.

## Measured run

- Run completed **2026-09-05T18:04:08.343Z**.
- **17 migrations + seed passed** on PostgreSQL 18.3 / PGlite 0.5.8.
- **517 pgTAP assertions passed across 21 files**.
- **9 additive-upgrade invariants + 3 Mature preflight checks passed**.
- Active catalog: **86 lines / 36 directions / 6 packs**; ratings **36 Clean /
  19 Spicy / 31 Mature**. The 14 recognizable phrases all retain source URLs and
  an explicit text-only publication decision. Ten forced short-line Daily draws
  passed the multi-beat/contrast compatibility check.
- Focused ESLint for `scripts/local-db/*.mjs`: passed.

## Demonstrated defect and fixes

The first actual migration run stopped in **007**, before any Classic migration:
`normalized_body_hash` used `convert_to(text,name)` inside a generated column.
PostgreSQL reports that function `STABLE`; stored generated expressions require
`IMMUTABLE`, producing SQLSTATE `42P17`. The narrow repair uses
`pgcrypto.digest(text,text)`, which is immutable, on the same normalized text.
The UTF8 compatibility test includes mixed case, whitespace, accented text, and
an emoji; it verifies byte equality against the previous intended UTF8 expression.

This edits the historical migration because a failing earlier migration cannot
be repaired by a later one on a fresh install. No deployed database was touched.
An existing database that already has a working compatible generated hash needs
no column rebuild or data rewrite; inspect its migration/column definition during
staging rollout. The new app content migrations remain additive.

Actually executing the previously unrun pgTAP suite also exposed test defects:

- Untyped schema/table overloads and omitted descriptions made valid tables,
  columns and triggers appear absent. Explicit `name` casts and the documented
  assertion signatures preserve the original assertions.
- `col_default_is` expected a value (`private`), not a serialized SQL expression.
- The quota fixture attempted to insert subscriptions already created by the Auth
  trigger; it now updates the fixture's plan through a conflict-safe upsert.
- The Stripe test negated a text-producing pgTAP assertion. `hasnt_function`
  correctly checks the removed old RPC signature.
- A challenge test inspected an outdated inline block lookup; it now checks the
  actual symmetric-block helper invoked by admission. Behavioral blocked-user
  cases remain in the same suite.
- The Daily containment fixture added a hold while leaving a public receipt in an
  invalid state. It now moves that fixture private as the moderation workflow does;
  the assertion still requires immediate removal from both board and viewer rank.

No useful assertion was deleted and no production validation was relaxed.

## Coverage and measured boundary

The report's current run is authoritative for exact counts. Coverage includes:

| Path | Executed evidence | Limit |
| --- | --- | --- |
| Migration/seed contract | Actual SQL applied in order; all pgTAP files | PostgreSQL 18.3 WASM, not the hosted Supabase engine |
| Guest/owner/other-account privacy | Real `SET ROLE` changes enforce private delivery/score RLS | Claims are locally supplied; no Auth HTTP or JWT verification |
| Browser write boundaries | Direct publication, score editing, quota RPC and audio Storage-SQL insert rejected | Storage service itself is absent |
| Mature publication | Trusted raw writes and checked publication RPC rejected; sticky rating held after downgrade | No object upload/signing endpoint exercised |
| Existing Mature share pointer | 016 rejects with `55000` and retains the pointer; after nonexistent fixture pointer removal, receipt becomes private | No real Storage object was created or deleted |
| Daily | Exact first-ranked claim, repeat practice, canonical leaderboard, blocks/containment | Single-session SQL, not browser admission or a concurrent race |
| Friend challenges | Participant projection, private-profile visibility, symmetric blocks, one-entry rules and immutable recipient | No real invite link/cookie flow |
| Idempotency/quota | Same SQL attempt replays once; counts/refunds preserve invariants | HTTP response loss and distributed cache require separate tests |
| Historical data | Nonempty additive upgrade snapshots retain legacy and v2 UUID/text, Daily, challenge/entry, delivery, score | Synthetic SQL rows, not production records |
| Seed safety | Final counts match fresh install without new seed; repeated seed preserves history and an archived prompt | Does not authorize production seed execution |

## Remaining full-integration prerequisites

No Docker, Podman, PostgreSQL binaries, `psql`, or Supabase CLI were installed on
this host when inspected. No isolated Supabase URL/anon/service-role configuration
was available. A browser signed into the Supabase dashboard is not database test
infrastructure or permission to alter its project.

A disposable full Supabase stack needs Docker plus the Supabase CLI (or an
explicitly designated disposable test project), local/test URL and keys, Auth
redirects for the preview, and its private Storage buckets. Then run:

```bash
# Local disposable stack only; run init once if config.toml is absent.
supabase init
supabase start
supabase db reset
supabase test db
```

Use `supabase init` only when `supabase/config.toml` is absent; do not overwrite an
existing configuration. `db reset` here refers exclusively to the disposable local
stack. Apply all numbered migrations in order with 014 committed before 015 uses
the new enum. No remote reset, production migration, Storage cleanup, deployment,
credential creation, permission change, or billing action was performed.

The real signed-in recording → AI judging → upload → persistence → signed playback
flow remains pending that full stack and authorized live judging setup. So do
Supabase HTTP tests for Daily/friend admission and lost-response recovery. Local UI
fixtures, SQL fixtures, and direct provider evaluation receipts must remain labeled
separately in the final handoff.
