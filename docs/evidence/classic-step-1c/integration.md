# Classic Step 1C: connected integration evidence

Date: 2026-09-06. This is an engineering execution receipt, not full Supabase or human validation.

## Environment and actual attempts

- `command -v docker podman supabase psql postgres` found none. Neither `/var/run/docker.sock` nor `/run/docker.sock` exists.
- `/proc/self/status` reports `CapEff: 0000000000000000` and `NoNewPrivs: 1`.
- `unshare --user --map-root-user true` failed with `write failed /proc/self/uid_map: Operation not permitted`. Downloading a Docker binary would not supply a running engine or usable container privileges. Building an alternative native stack was not a reasonable bounded substitute.
- `curl -IL --max-time 10 https://download.docker.com/linux/static/stable/x86_64/` reached HTTP 200. Network availability alone does not establish a usable local Supabase stack.
- No designated Supabase test URL/anon/service key is configured. No production fixtures, paid services, or external provider calls were used.
- Separate executor commands could not reach a sibling command's ready Next server over loopback. The HTTP scripts now optionally own their Next subprocess and perform requests in the same process tree. This workaround successfully ran real application HTTP.

## Completed HTTP checks

Command:

```bash
DELIVERY_HTTP_START_LOCAL=1 DELIVERY_EVIDENCE_DIR=docs/evidence/classic-step-1c \
  node scripts/verify-local-judge.mjs
```

Outcome: **10 checks passed, 7 judge POSTs, zero provider calls, zero persisted deliveries.** Five successful HTTP responses represented two distinct mock judgments. All success receipts identify `source:fallback` and `delivery-demo-v1`. [Machine receipt](local-api.json).

| Check | Measured result | Evidence boundary |
| --- | --- | --- |
| Guest synthetic audio → judgment response | HTTP 200, explicit mock result, ephemeral | Actual Next route, local mock judge, synthetic 440 Hz PCM; no microphone/human speech |
| Lost-response retry | Same receipt and usage `1` | Real HTTP; response ignored and retried; no TCP fault injection |
| Two concurrent identical requests + retry | Same second receipt, usage `2` throughout | One Next process and in-memory idempotency/quota only |
| Changed words with completed key | HTTP 409 `IDEMPOTENCY_CONFLICT` | Real route; provider never called |
| Silent PCM | HTTP 422 `NO_SPEECH_DETECTED`, no result | Actual waveform validation before judgment |
| Missing account service | `authenticated:false`, `configured:false` | Honest unconfigured state |
| Private audio access without Auth service | HTTP 503 `AUTH_NOT_CONFIGURED` | Fail-closed route; not proof of authenticated RLS |
| Default random draw | Everyone rating | Bundled catalog via actual HTTP |
| Repeated Daily reads | Identical prompt/direction | Bundled assignment; not a database persistence check |

The script's original two-request smoke remains available without `DELIVERY_HTTP_START_LOCAL`; it now performs the expanded checks against an already running unconfigured localhost server. When auto-starting, it clears service/provider configuration for its child, binds loopback, and stops the child after success or failure.

## Actual missing-key failure recovery

```bash
DELIVERY_HTTP_START_LOCAL=1 DELIVERY_HTTP_LIVE_NO_KEY=1 \
  DELIVERY_EVIDENCE_DIR=docs/evidence/classic-step-1c \
  node scripts/verify-local-judge.mjs
```

**1 check passed, 1 actual judge POST, zero provider calls.** With `DELIVERY_AI_MODE=live`, mock fallback disabled, and no OpenAI key, the route returned HTTP 503 `SERVER_NOT_CONFIGURED` with no result. This directly verifies that the missing-key defect now fails visibly instead of returning an invented demo judgment. [Machine receipt](local-live-no-key.json). Provider-outage recovery after an actual paid request is still untested.

## Narrow access fix

The owner playback route previously minted a fresh five-minute Storage URL without checking whether account deletion had started. It now calls the same `assertAccountNotDeleting` gate used by judging and publishing before fetching/signing audio. Normal owner playback remains allowed, including legitimate owner access that database policy deliberately preserves for moderated records. Previously minted signed URLs still live until their existing expiry or object deletion; this change does not claim instant revocation of issued URLs.

```bash
node node_modules/vitest/vitest.mjs run src/lib/server/delivery-audio-access.test.ts
```

**2 tests passed.** Targeted ESLint of both HTTP scripts, the access route, and its test passed with no warnings. Deletion prevents signing and emits a noncached recoverable error; normal owner playback retains a five-minute signed URL with `no-store`. These are route-unit tests with mocked Auth/Storage, not connected Supabase evidence.

## Ready-to-run isolated Supabase HTTP harness

`node --check scripts/verify-supabase-http.mjs` passed. Actual invocation:

```bash
DELIVERY_SUPABASE_HTTP_TEST=1 node scripts/verify-supabase-http.mjs
```

Outcome: **blocked preflight**, exit 1, zero checks, zero users/objects/requests to Supabase, zero provider calls. [Machine receipt](supabase-http.json) explicitly records `status:blocked-preflight`, `sample:null`, and `LOCAL_SUPABASE_PREFLIGHT_UNAVAILABLE`.

The script is prepared but **its connected cases have not run here**. It refuses non-loopback Supabase origins, requires an explicit opt-in and local keys, launches its own mock-only Next process on port 3101, creates three throwaway Auth users, and cleans its own objects/users. It uses real cookie sessions, application routes, PostgREST and Storage when services are supplied. No production keys or records are needed.

Prepared checks cover:

- Actual Auth → account HTTP; guest/signed-in mock judging; concurrent exact retry/conflict with no duplicate receipt or additional reported quota.
- Mock results remaining ephemeral, with no durable rival delivery.
- Daily HTTP reads preserving an existing seeded database assignment; current Daily admission.
- Pro test entitlement → challenge creation → recipient page → mock attempt admission.
- **Explicitly seeded** private mock receipts for active, Mature, and retired content → history → signed playback. These service-role setup writes are not evidence of judge → save.
- Another user and anonymous session denied owner playback; private rows hidden via actual PostgREST RLS; raw public Storage paths denied.
- Mature publication denied via the application, and its private receipt absent from feed/share HTTP.
- One-second signed URL expiry → owner HTTP refresh → playable URL.

The setup writes only disposable private synthetic receipts, marked `delivery-demo-v1`/`provider:mock`. It does not rewrite catalog IDs, Daily assignments, historical records, or score semantics. Live judge → durable save → ranked Daily/challenge completion still requires a separately bounded provider run. Multi-instance cache behavior is also outside this local harness.

## Minimum owner actions

On a machine that can run Docker, in a disposable checkout/database:

1. Stop other Next processes using this checkout. Install/start Docker and the Supabase CLI. Run `supabase init` only if local config is absent, then `supabase start` and **local** `supabase db reset` (no `--linked` or remote URL). This applies the 17 migrations and seed.
2. Configure the generated **local** URL, anon key and service-role key securely in an ignored environment file. Do not paste keys into chat and do not overwrite an existing production/staging environment file.
3. Run `DELIVERY_SUPABASE_HTTP_TEST=1 node --env-file=.env.local scripts/verify-supabase-http.mjs` with that local-only file. Review the generated receipt and cleanup result; a passing run closes only the prepared transport/Auth/Storage boundaries above.
4. With authorized live OpenAI credentials and consented recordings, run signed-in judge → save → history/replay, first Daily admission/practice, friend result completion, provider failure/refund recovery, and multi-session retries. Confirm any real preexisting rows in designated staging before additive migration rollout.
5. Run the owner playtest/device kit separately. Synthetic fixtures do not establish acting quality, comedy, fairness, microphone hardware behavior, or enjoyment.

## Unresolved, by impact

1. **Live judging → durable submission → competitive result** has no connected evidence; neither scores nor Daily/challenge completion can be declared validated.
2. **Actual Supabase Auth/Storage/RLS HTTP integration** remains unrun pending a disposable stack. Existing Step 1B SQL results are not relabeled as HTTP; no SQL/migration change required rerunning those 517 assertions.
3. **Distributed idempotency and quota** across separate application instances/cache remain untested. The local measured concurrency is explicitly one process.
4. **Mature recipient consent and real historical rollout** need the designated test/staging session; prepared private receipt tests alone do not close all sharing/challenge/direct-link boundaries.
5. Real devices, human speech, listening enjoyment, and feedback credibility remain owner-run validation.
