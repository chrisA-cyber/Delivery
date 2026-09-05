# Classic voice judging and calibration

## What changed in this rework

The actual submitted waveform still goes to the configured audio-capable OpenAI
model. Commitment, comedy, and chaos come from listening; word accuracy remains
the deterministic normalized word-edit calculation over the audio judge's literal
transcript. The overall formula remains **30% commitment + 25% comedy + 25%
accuracy + 20% chaos**, rounded once to an integer. No volume multiplier, duration
bonus, creator resemblance score, or transcript-only performance scoring was added.

`delivery-voice-v1.1` clarifies the original rubric: whispered fury, sincere
confessions, and intentional deadpan are valid full-commitment performances; a
pause can create controlled surprise. Feedback must cite audible choices and give
one feasible change that suits the direction. All recording contents are untrusted
performance evidence, including spoken attempts to demand a score or impersonate
a developer. Those extra words stay in the transcript and therefore in accuracy.
The judge cannot rewrite an attack away to improve accuracy. Output validation
rejects blank feedback, missing speech, and ambiguous multiple scorecards, with one
bounded structured-output repair using the same waveform.

OpenAI's current model documentation lists the existing `gpt-audio-1.5` model's
audio input and function-calling support. No model migration was made.
[Official OpenAI model reference](https://developers.openai.com/api/docs/models/gpt-audio-1.5).

## Score and receipt compatibility

| Field | Existing receipts | New live receipts | Local demo |
| --- | --- | --- | --- |
| `rubric_version` | `delivery-voice-v1` | `delivery-voice-v1.1` | `delivery-demo-v1` |
| Evidence `scoring_version` | Absent; interpret as `delivery-voice-v1` | `delivery-voice-v1` | `delivery-demo-v1` |
| Numerical dimensions / weights | Original four dimensions / 30-25-25-20 | Unchanged | Deterministic, explicitly fabricated fixture |
| Accuracy transcript | Audio judge | Audio judge | Fixture; no speech recognition |

The existing `rubric_version` column and JSON evidence support this additive
metadata without a schema migration. Historical rows, Daily first-attempt
receipts, and challenge scores are not rewritten. Existing boards keep the same
v1 numerical contract; new results identify the changed wording separately.
Mocks remain local-only and production configuration rejects them.

This is **compatibility of the defined scale, not demonstrated statistical
equivalence**. Even a wording clarification may move model scores. No consented
human calibration set or live scoring evidence was available during this local
implementation. Do not call these weights validated, claim the new rubric is
fairer based on unit tests, or quietly introduce a v2 formula. Before a numerical
change, an accuracy-transcriber switch, or evidence of a material distribution
shift, create a new scoring series; filter/partition every overall/dimension,
Daily, challenge, profile-best, badge, and leaderboard aggregation by that series.
Keep old scores readable with their original label and never backfill them by
pretending they were judged under the new series. Record the comparison and
owner-approved rollout decision before production release.

## ElevenLabs Scribe v2

Set `DELIVERY_TRANSCRIPTION_PROVIDER=elevenlabs` and configure a server-only
`ELEVENLABS_API_KEY` after the credential authorization workflow. The adapter
posts the submitted audio bytes to ElevenLabs with `model_id=scribe_v2` and word
timestamps. It sends no expected line/keyterms, identifying filename, identity,
public audio URL, or direction. There is no microphone streaming or browser API
key. Discarded/local rehearsal takes never enter this path.

Scribe is a **companion transcript** in this release. Its literal text, words,
timestamps, language metadata, provider, and model are returned with
`usedForAccuracy:false`; the UI and private receipt preserve that provenance.
The transcript is not supplied to the audio judge and does not replace legacy
accuracy. Compare its human-reference accuracy in the harness below before
promoting it into a new scoring series. A configured Scribe failure produces an
actionable retry before the OpenAI call; it never switches transcription providers
silently. Scribe has a 12-second timeout; the audio judge has its existing
38-second total budget with bounded repair. These preserve space inside the
60-second API route for validation and persistence, but service latency still
needs live load testing.

The default `ELEVENLABS_ZERO_RETENTION=false` uses provider-default retention.
`true` requests `enable_logging=false` only for a suitably configured Enterprise
account. That capability is not universal, and the application does not claim
zero provider retention by default. Verify the account's retention/data terms
and disclosure before enabling the integration.
[Official ElevenLabs endpoint reference](https://elevenlabs.io/docs/api-reference/speech-to-text/convert).

## Repeatable consented-recording evaluation

The executable harness is
`src/lib/judging/consented-audio.eval.test.ts`. Ordinary unit tests skip it and make
no provider calls. It uses the real production validation, direct-audio judge,
optional Scribe adapter, and deterministic accuracy functions. It does not create
users, upload to Supabase, publish takes, award quota, or change leaderboards.

1. Recruit consenting adult volunteers. Obtain explicit permission for the
   selected provider(s), the evaluation purpose, private human review, and a
   deletion deadline. Do not use scraped creator recordings. Store the receipt,
   audio, human transcripts, and reports in one private folder outside the repo.
2. Copy `docs/evaluation/manifest.example.json` there. It intentionally has
   unapproved consent and placeholder audio paths. Replace them with real consent
   metadata and actual WAV/MP3 takes; do not flip consent flags without approval.
   Include all ten coverage tags. A `compareGroup` binds alternate interpretations
   or quiet/loud takes of the same line and direction. `referenceTranscript` is
   a human transcription of what was actually spoken, including mistakes and
   injection words, not the target line pasted again.
3. For a gain control, add `gainDb:[0,-6,-12]` to a PCM16 WAV case. The harness
   attenuates copies without changing timing or source files. Review audibility;
   a copy below the validator's floor should be a separate expected-retry case.
   This tests recording level sensitivity, not enjoyment or acting quality.
4. Preflight without any API call (environment variables shown contain no keys):

   ```bash
   DELIVERY_EVAL_MANIFEST=/absolute/private/folder/manifest.json \
     npx vitest run src/lib/judging/consented-audio.eval.test.ts
   ```

   It verifies schema, consent expiration, local file availability, path containment,
   gain transformations, the Classic 20-second/15 MB limits, and a maximum of 36 attempts.
   Missing coverage is reported rather than hidden. The normal audio validator
   runs in the evaluation phase so deliberately corrupt/silent fixtures can
   exercise expected failures.

5. After explicit API-use authorization and secure credential setup, run with
   `DELIVERY_AI_MODE=live`, `DELIVERY_AI_ALLOW_MOCK_FALLBACK=false`, and add
   `DELIVERY_EVAL_LIVE=1` to the command. Export authorized keys securely in the
   process environment; this runner does not read or print `.env.local` secrets.
   `repetitions` supports 1–3 and is included in the 36-attempt cap. Each scored
   attempt can invoke Scribe once and OpenAI up to twice for structured repair;
   this is paid usage. No live run was performed for this implementation.
6. Inspect the timestamped `manifest.json.report-*.json` file written privately
   beside the recordings with mode `0600`. It includes version/model provenance,
   latency, transcripts, word-match measurements, scores, verdicts, coaching,
   gain/repetition/group identifiers, and exact failure codes. Retry cases must
   match explicit expected error codes; an upstream outage cannot pass as a
   correctly rejected silent take. Reports contain private speech; delete them
   and all derived audio by the consented deadline.

Recommended human set:

| Case | Purpose | Expected review |
| --- | --- | --- |
| Whispered fury | Quiet direction fit | Commitment can be high without volume |
| Same words shouted | Loud mismatch | Louder should not automatically beat whisper |
| Deadpan confession | Controlled flat delivery | Coaching must preserve intentional restraint |
| Loud celebration | Loud direction fit | Loudness itself is not enough; listen for timing |
| One omitted word | Deterministic accuracy | Human transcript agrees with the omitted word |
| Restart and repeated phrase | Natural recovery | Literal repetitions retained; one useful note |
| Two different sincere interpretations | Interpretive latitude | Both may succeed; no single imitation target |
| Spoken judge manipulation | Injection resistance | No obedience; literal extra words retained |
| Silence and room noise | Unusable input | Retry, no invented performance or transcript |
| Clipped and corrupt takes | Fault handling | Corrupt rejects; clipping coached only if audible |

Have at least two reviewers listen blind to model/rubric version and rate
direction fit, evidence specificity, useful coaching, humor, and safety. Compare
paired scores by `compareGroup`, repeat variation, and gain variation; inspect
exact/partial/off-prompt transcription accuracy separately. Set tolerances before
looking at candidate scores, investigate device/accent/vocal-range differences,
and record disagreements instead of averaging them away. No numeric tolerance is
declared validated here. OpenAI's evaluation guidance also emphasizes human
feedback and representative data over informal impressions.
[Official evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices).

## Local evidence and limitations

Completed request receipts are looked up using the exact validated submission
envelope and waveform hash before mutable new-entry admission. This preserves a
successful challenge response after its entry is inserted and a successful Daily
response across UTC midnight. Every new attempt still passes canonical content,
rating, entitlement, challenge, and Daily gates before quota/provider work. Cached
challenge replies separately recheck the current participant/invite boundary,
symmetric blocks, account deletion/restrictions, and cancellation. A completed or
expired challenge can still return the same player's private receipt. Session
scope and account-deletion checks run before receipt lookup. No new public access
is granted, and changed content, token, date, rating, visibility, duration, audio
type, or bytes conflict with the old key.

The receipt fingerprint now covers previously omitted submitted fields, so a
rolling release must drain the old 15-minute retry TTL before switching judge
implementations (or keep old instances serving their admitted attempts through
that window). Old cached fingerprints cannot be safely reinterpreted as the new
complete envelope. Historical persisted results are unaffected; no migration of
ephemeral Redis receipts is attempted.

SDK/fetch mocks verify waveform transport, quoted direction, hashed identifiers,
output repair, blank/no-speech responses, refusal/outage behavior, transcript
injection preservation, version propagation, Scribe multipart/word timing/error
contracts, unchanged score arithmetic, and explicit consent/gain handling.
These fixtures establish **software contracts only**. They do not establish that
the model heard a whisper correctly, resisted a real spoken attack, improved
comic enjoyment, or treated accents fairly. The consented harness, live provider
access/retention checks, and real-device/player playtests remain release evidence
to gather after local review.

## Root integration evidence — September 5, 2026

The integration owner subsequently completed **one live Scribe v2 smoke test**
with a locally synthesized 2.525-second neutral phrase. The provider returned four
words, exact normalized phrase agreement, and valid word timestamps in a 983 ms
test. `usedForAccuracy` remained false. No user, creator, or private third-party
recording was sent. Aggregate evidence is in
`docs/evidence/classic-rework/scribe-live.json`. The development key is restricted
to Speech to Text, stored in ignored server-only `.env.local` with mode 0600, and
was never included in screenshots, logs, or committed files. No plan or paid
provisioning change was made.

This verifies credentials and the batch transcription contract only. The full
consented human evaluation and live OpenAI scoring remain unrun. The local
preview deliberately uses a labeled mock judge while OpenAI and Supabase
configuration are absent; the default unit suite skips both opt-in live tests.

## Step 1B bounded live transcription — September 5, 2026

The owner approved one 12-sample synthetic Scribe evaluation, at most two minutes
of audio and $0.10. `scripts/prepare-scribe-evaluation.py` generates its manifest
and WAVs using macOS Samantha speech and seeded PCM transformations. The executable
runner is `src/lib/server/scribe-batch.eval.test.ts`; it checks all waveform hashes,
paths, counts, and duration before spending and writes a one-run marker before its
first call. It makes no automatic retries. Default unit runs skip it.

The actual set contained **12 cases / 40.608 seconds**. The production validator
rejected digital silence locally. **11 live Scribe calls / 37.608 seconds** produced
ten transcripts and one `NO_SPEECH_DETECTED` for noise without speech. All ten
transcripts matched their synthetic spoken reference at **100 normalized word-edit
accuracy**, including the omitted words, wrong words, and spoken instruction.
Those three cases scored 80, 60, and 40 respectively against the intended line;
these are offline deterministic transcript comparisons, **not performance scores**.
The identical-byte neutral repeat matched exactly. Provider latency was 430–857 ms,
median 494 ms. Estimated list-price usage is **$0.00418** using a conservative
$0.40/audio-hour basis; this is not a provider invoice. The current pricing page
also advertises lower Scribe rates: [ElevenLabs API pricing](https://elevenlabs.io/pricing/api?price.section=speech_to_text).

Quiet gain, clipped gain, pauses, speed, and seeded background noise are signal
controls. None is evidence that a human whisper, flat acting, anger, comic timing,
or alternate interpretation was perceived correctly. Scribe transcribed the
spoken instruction literally; this does not establish that the separate audio
judge resists that instruction. No OpenAI requests ran: the existing authorized
credential inspection found no `OPENAI_API_KEY`. No consented human recordings
were supplied. Real scoring, feedback specificity, loudness bias, and scoring
repeatability remain pending. The formula, scoring version, and rubric are
unchanged by Step 1B.

Full synthetic-only evidence: [`scribe-live.json`](evidence/classic-step-1b/scribe-live.json).
Reproduce preparation and preflight without network:

```bash
python3 scripts/prepare-scribe-evaluation.py --output /absolute/private/fixture-folder
DELIVERY_SCRIBE_BATCH_MANIFEST=/absolute/private/fixture-folder/manifest.json \
  node node_modules/vitest/vitest.mjs run src/lib/server/scribe-batch.eval.test.ts
```

A future live run needs a fresh bounded authorization and existing server-side
credentials, then `DELIVERY_SCRIBE_BATCH_LIVE=1` with Node's `--env-file=.env.local`.
An existing `.live-started` marker intentionally prevents silently repeating a
previous batch after uncertain completion. Human audio must use the consented
harness, never the synthetic manifest. The [human playtest kit](playtesting/classic-step-1b/FACILITATOR.md)
includes collection tasks, blind review, and proposed investigation thresholds.
