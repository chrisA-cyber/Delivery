# Isolated SQL checks

This runner creates three disposable, in-memory PostgreSQL databases using the
locked PGlite 0.5.8 / pgTAP 0.0.9 packages. It accepts **no connection URL**, reads
**no environment file or credential**, and opens **no listener**. Closing each
instance destroys its synthetic test data. It does not connect to Supabase.

From the repository root, with Node 20.11 or later:

```bash
npm ci --prefix scripts/local-db --ignore-scripts
node scripts/local-db/run.mjs
```

The first command downloads the two development-only dependencies. Subsequent
runs require no network. The root application dependency graph is unaffected.
The process fails on a migration error, a failed pgTAP assertion/plan, or an
upgrade invariant. It writes exact test output and migration/seed SHA-256 hashes
to `docs/evidence/classic-step-1b/database.json`.

It checks:

1. Every actual application migration, in sorted order and separate transactions,
   followed by the current seed and all `supabase/tests/database/*.test.sql`.
2. A nonempty legacy database built through migration 013 and the frozen historical
   seed fixture; then 014 onward without the current seed. UUIDs, original text,
   Daily assignments, a friend challenge/entry, a delivery, and its score remain
   intact. It also checks v2 text preservation, fresh/additive count parity, seed
   repeatability, and no resurrection of an archived active-catalog prompt.
3. Migration 016's existing-Mature-share-pointer preflight and private containment.
   The pointer is a string-only fixture. No file or Storage object is created or
   removed.

`bootstrap.sql` supplies the minimal Auth/Storage schemas and claim-reading
functions that application SQL references. These are **test boundary shims**.
The account trigger, public schema, SQL functions, grants, RLS, constraints,
triggers, views and pgTAP tests are the actual repository SQL. The dedicated
`classic_rls_isolation.test.sql` uses actual `SET ROLE anon/authenticated` so RLS
applies; setting claim strings alone would leave a superuser bypassing RLS.

PGlite is PostgreSQL compiled to WebAssembly (this lock reports PostgreSQL 18.3).
It is a single-session engine. This check is meaningful SQL evidence, not a
replacement for Supabase's full stack or its PostgreSQL version. It cannot prove
HTTP authentication, JWT validation, PostgREST exposure, Storage upload/signing,
audio playback, HTTP lost-response recovery, distributed races, or billing/provider
integration. Run the existing tests again with a disposable full Supabase stack
before deployment. Never run these frozen fixture seed files against a remote DB.
