# Classic Step 1D — validation readiness decision

**2026-09-06: blocked by missing live judging and connected persistence evidence.** Step 1C engineering remains intact. An existing preview was found and opened, but its server reports incomplete configuration. No additional mocked tests, harnesses, application changes, paid calls, migrations, merges, or deployments were performed.

## Exact revision and scope

- Fetched `origin/main` and `origin/codex/classic-step-1c`; main remains `c74baddcc93783490ec636291cc5b03397bdaa7b`.
- [Draft PR #1](https://github.com/chrisA-cyber/Delivery/pull/1) remains open and unmerged at `a3350346af7681b838bcb3267ded0d98d471c307`. Its tree is `cd0247468528fdb17e480315e02e63a30e1f795a`.
- Verified Step 1C implementation commit `8d2c3c982804866d3efdd0a121635666b7d9154b` is an ancestor. `src`, `scripts`, and the evaluation materials match the PR head. Validation therefore includes the Step 1C fixes, not just main.
- Step 1D local branch: `codex/classic-step-1d`, based on that PR head. The working change is this handoff plus a roadmap status update; application revision remains `a335034`. The documentation commit can be identified with `git log -1` on this branch.
- No applicable `AGENTS.md` was found. Read the Step 1C handoff, roadmap, environment/judging guidance, prepared HTTP/evaluation commands, and owner-session materials. Existing work and Step 1C receipts are preserved.
- Changes are kept local: GitHub exposed an automatic Netlify preview for PR #1, so updating that PR could trigger another deployment contrary to this assignment. No push was performed.

## What actually ran

| Check | Actual outcome |
| --- | --- |
| `git fetch origin main codex/classic-step-1c` | Passed; revisions above unchanged |
| GitHub PR and commit-status reads | Confirmed draft/unmerged state and an existing successful Netlify preview status for exact commit `a335034` |
| `git merge-base --is-ancestor 8d2c3c982804866d3efdd0a121635666b7d9154b origin/codex/classic-step-1c` | Exit 0 |
| `git diff --quiet origin/codex/classic-step-1c -- src scripts docs/evaluation` | Exit 0 |
| Safe configuration/runtime inspection | Results below; values of secrets were not printed |
| Existing preview, cloud Chrome browser | Home loaded; **Play Classic** opened `/play`. Prepare showed a line, direction, mic-off state, and **“This feature has not been configured yet.”** |
| `curl --max-time 20 -sS -D - https://deploy-preview-1--deliverygame.netlify.app/api/health` | Application HTTP **503**, `SERVER_NOT_CONFIGURED`, message **“This feature has not been configured yet.”**; request ID `68353a09-0752-43be-837c-393a0e802e5d` |
| Separate read-only `/api/account` probe | Inconclusive: execution ended with “network approval was cancelled before a decision was returned”; no account result inferred |
| `git diff --check` | Passed for the documentation changes |

The verified preview is [Classic prepare](https://deploy-preview-1--deliverygame.netlify.app/play); [home](https://deploy-preview-1--deliverygame.netlify.app/) also opens. GitHub's preview status was created at `2026-09-06T00:25:25Z`; the health response was dated `2026-09-06T00:32:31Z`. This preview was already present when discovered. Its existence corrects the assumption that no owner-accessible URL was available. It does **not** establish working live judging or a disposable database. The health route checks several production settings and deliberately hides missing key names; this response does not establish which hosted credentials are absent.

This was a read-only cloud-browser check, not a microphone session, mobile emulation run, physical-device test, or human playtest. No audio was recorded/submitted, accounts created, fixtures inserted, or challenge messages sent.

## Available environment and blockers

| Dependency | Current executor evidence / consequence |
| --- | --- |
| Application tools | Node/npm, installed dependencies, and FFmpeg available; existing local application/test tooling remains usable |
| Isolated Supabase | No Docker, Podman, Supabase CLI, or PostgreSQL executable; no Docker socket at either inspected standard path; effective container capabilities are zero and `NoNewPrivs=1`. Installing a CLI alone is insufficient here. |
| Test database configuration | Supabase URL, anon key, and service-role environment variables absent. No private environment file beyond the example. No explicitly designated disposable remote project supplied. Supabase plugin discovery returned available but **not installed**. |
| Provider evaluation | OpenAI and ElevenLabs keys absent in this executor. No live request/spend authorization or evaluation manifest configured. Hosted preview configuration remains unknown. |
| Samples | No suitable recordings found in the checkout or supplied for this assignment. Example manifest has intentionally unapproved consent and placeholder files. |
| Owner session | Reachable preview exists, but configuration blocks a complete live session. No participant/device observations returned. |

**Stop boundary:** no remaining material service validation can run with these dependencies. The prior mock/SQL/browser evidence is linked in [Step 1C](CLASSIC_STEP_1C_HANDOFF.md), not rerun or counted as new Step 1D evidence. No new code defect was demonstrated that justifies an implementation change.

## Results and limitations

- **OpenAI requests: 0; Scribe requests: 0; evaluation attempts: 0; provider spend: $0.** No scores, feedback examples, live latency, repeat variation, or audible-grounding results exist for Step 1D.
- **Isolated Supabase HTTP checks: 0.** Signed-in live judge → save → history/playback, durable retry/concurrency, Daily claims, friend completion, private access, playback expiry/recovery, and account-deletion restrictions remain unverified against real services.
- The prepared HTTP harness forces a **mock judge** and clears provider keys. With real local Supabase it can establish Auth/PostgREST/Storage wiring, mock exclusion, one-process retry/concurrency, Daily assignment preservation, challenge creation/open/mock admission, and seeded history/private playback/expiry. Directly inserted synthetic receipts do not prove live judgment persistence. It does not currently exercise account-deletion playback rejection or distributed concurrency; do not mark those passed from that harness.
- **Human sessions: 0; physical devices: 0.** Prior browser emulation remains historical evidence only. One future owner session will be an initial usability check, not proof of broad appeal or fairness.
- Scoring remains **30/25/25/20**, live scale `delivery-voice-v1`, rubric `delivery-voice-v1.1`. OpenAI judges audio and supplies the transcript used for deterministic word accuracy. Separate Scribe remains `usedForAccuracy:false`; demo scores remain labeled and excluded from new durable competitive records. No historical semantics or content identities changed.
- Quiet/deadpan calibration remains unresolved: a correct restrained performance might still be disadvantaged by comedy/chaos weighting or generic loudness preferences. No evidence currently supports changing the formula or asserting fair competition.

## Minimum setup to resume

### 1. Identify a usable existing validation machine

The current executor cannot host the required local Supabase stack. Use an **already available Docker-capable machine** with Node ≥20.11 and Supabase CLI; verify `docker info` succeeds. Do not assume the owner's laptop supports Docker or provision a paid replacement. An explicitly designated existing disposable hosted project is another possible environment, but the prepared harness accepts **loopback HTTP only** and cannot run against it unchanged. Keep that guard intact.

On the suitable machine, check out `codex/classic-step-1c` at `a335034` (or the Step 1D docs branch containing it). In a dedicated validation checkout:

```sh
npm ci
supabase init
supabase start
supabase db reset
```

Run `supabase init` only if `supabase/config.toml` is absent (it is absent in the current checkout). Reset **only this disposable local stack**, without `--linked` or a remote database URL. No production data is needed.

Put its generated local `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in ignored `.env.validation.local`, using the machine's secure editor/environment settings. Do not overwrite another environment or paste keys into chat. Leave port 3101 free and stop other Next processes using this checkout.

Preserve the old receipt because the runner writes to the Step 1C directory:

```sh
step1c_receipt=$(mktemp)
cp docs/evidence/classic-step-1c/supabase-http.json "$step1c_receipt"
DELIVERY_SUPABASE_HTTP_TEST=1 node --env-file=.env.validation.local scripts/verify-supabase-http.mjs
mkdir -p docs/evidence/classic-step-1d
cp docs/evidence/classic-step-1c/supabase-http.json docs/evidence/classic-step-1d/supabase-http.json
cp "$step1c_receipt" docs/evidence/classic-step-1c/supabase-http.json
```

Retain the new receipt even if the runner fails. Fix only demonstrated failures and rerun affected checks. Live save, ranked Daily completion, completed friend results, and deletion-state playback still need actual isolated HTTP evidence after this mocked-judge run.

### 2. Prepare one bounded human-audio batch

Reuse [the existing manifest](evaluation/manifest.example.json) and [evaluation guide](JUDGING_EVALUATION.md). A small proposed subset is ten cases: `whispered-fury` (three identical-byte repetitions), `shouted-fury`, `deadpan-confession`, `loud-celebration` (three repetitions), `flat-celebration`, `omitted-word`, `substituted-word`, `spoken-injection`, `silence`, and `room-noise`: **14 attempts, maximum 28 OpenAI dispatches including repairs, no Scribe calls**.

Privately collect the owner's consented WAV/MP3 samples, literal human transcripts, actual durations, permission for OpenAI/private review, and a deletion deadline. Complete consent truthfully; synthetic samples cannot answer acting/comedy/fairness questions. Securely configure an existing authorized key in the validation runtime.

**This proposed ceiling is not budget authorization.** No future dollar estimate is claimed without durations and current model rates. Once samples are available, present that estimate and obtain explicit authorization for the batch before paid calls. Keep the owner app session's additional calls separately budgeted; it is outside the harness ceiling.

Run the existing preflight with live execution explicitly off:

```sh
DELIVERY_EVAL_LIVE=0 \
DELIVERY_EVAL_MANIFEST=/absolute/private/manifest.json \
DELIVERY_EVAL_MAX_PROVIDER_REQUESTS=28 \
DELIVERY_TRANSCRIPTION_PROVIDER=audio-judge \
node --env-file=.env.validation.local node_modules/vitest/vitest.mjs \
run src/lib/judging/consented-audio.eval.test.ts
```

Only after approval, use the same command with `DELIVERY_EVAL_LIVE=1`, `DELIVERY_AI_MODE=live`, and `DELIVERY_AI_ALLOW_MOCK_FALLBACK=false`. Keep checkpoints and the `.live-started` marker after interruption; do not erase them to restart the budget. Summarize actual scores/coaching, identical-byte variation, latency, usage and estimated spend. The ceiling bounds requests, not dollars.

### 3. Run the prepared owner session

The existing [preview](https://deploy-preview-1--deliverygame.netlify.app/play) can be opened now for unaided comprehension and local rehearsal/replay; its current alert means it is **not ready for live feedback or connected-account validation**. No owner recording/playback success has been observed. Before using that hosted preview for the complete session, its administrator must identify its disposable database and resolve its configuration in a separately authorized deployment task. This assignment does not authorize that deployment.

Alternatively, after local setup and separate app-call budget approval, start the app on the same validation machine:

```sh
DELIVERY_AI_MODE=live DELIVERY_AI_ALLOW_MOCK_FALLBACK=false \
DELIVERY_TRANSCRIPTION_PROVIDER=audio-judge NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000 \
node --env-file=.env.validation.local node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:3000/` **on that machine**. A phone requires an already authorized secure test origin; its own loopback address will not reach the app. Reuse the [15-minute owner session](playtesting/classic-step-1c/README.md), [feedback form](playtesting/classic-step-1b/feedback.html), and [observations CSV](playtesting/classic-step-1b/observations.csv):

1. Find Classic and explain the assignment/privacy without coaching; record recognized and skipped lines.
2. Record, listen back, request live feedback, and choose whether to retry. Note voluntary retries before prompting.
3. Try one quiet/deadpan direction. Quote one feedback claim and the audible moment that supports or contradicts it; identify one useful adjustment.
4. Using two isolated test accounts with the existing required entitlement, open and attempt a friend challenge through its result; check saved history/playback. Do not buy an entitlement for this test or send unsolicited invites.
5. Report confusing states and playback failures, plus **actual device model, OS, browser/version**. Keep consent/audio/identifiable exports outside Git.

## Decision and smallest next action

**Recommendation: blocked by named missing evidence.** Live judging credibility/repeatability and real connected persistence/access are the two material gaps preventing a justified recommendation to begin Say It Back. The incomplete hosted configuration blocks the full owner session. No extra catalog polish, mock coverage, or infrastructure build is recommended.

Readiness to develop Say It Back is a smaller gate than public launch: one bounded human-audio batch, the isolated connected flow checks, and one owner session can support the next development decision. Public Classic launch additionally needs appropriate device, operational, privacy/content, and broader quality evidence; neither readiness claim is made here.

**Minimum owner action now:** identify an existing Docker-capable validation machine, or explicitly designate an existing disposable test environment and its access path. Then supply consented samples privately and approve an estimated provider budget. The working preview link is available above; return the actual device/browser and session observations once the live configuration is ready. No secrets should be sent in chat.
