# Step 1C judging evidence — September 6, 2026

Scope: the existing audio validator, OpenAI adapter, Scribe companion, numerical
rubric, and consented-recording evaluation harness. No provider key or consented
human recording was available in this environment. **OpenAI requests: 0; Scribe
requests: 0; evaluation spend: $0.** Existing Step 1B synthetic Scribe evidence
remains historical transcription evidence only.

## Demonstrated defect fixed

`judgeDelivery` previously returned a deterministic demo judgment whenever the
OpenAI key was absent outside production, even with `DELIVERY_AI_MODE=live` and
`DELIVERY_AI_ALLOW_MOCK_FALLBACK=false`. That contradicted the explicit live-only
configuration and could turn a validation session into demo judging.

Missing-key live mode now raises the existing configuration error before Scribe
or OpenAI work. Deliberate local mock mode and explicitly enabled local fallback
remain available and labeled. Production never accepts the missing-key fallback.
A focused SDK-mocked regression exercises each boundary; it does not claim live
provider behavior.

## Preserved scoring path

1. `validateAudio` checks actual bytes, container, duration, and PCM audibility.
2. When configured, Scribe receives submitted audio and returns a separate
   transcript with `usedForAccuracy:false`. A Scribe failure asks for recovery
   before OpenAI work.
3. OpenAI receives the waveform plus quoted canonical line/direction, with
   `store:false`, a hashed safety identifier, and no Scribe transcript.
4. One structured repair is permitted; no-speech/refusal/provider failures do
   not invent a performance score.
5. Commitment, comedy, and chaos come from the audio judge; accuracy remains
   the existing deterministic normalized word-edit comparison against its literal
   transcript. Overall remains 30/25/25/20, `delivery-voice-v1`; rubric remains
   `delivery-voice-v1.1`. No historical receipt, formula, or transcript source changed.

Quiet/deadpan fairness, audible feedback grounding, spoken-injection resistance,
and relative dimension weights cannot be established by reading the rubric or
mocking its outputs. **Calibration remains unresolved.**

## Bounded live evaluation preparation

The existing harness now requires an explicitly approved
`DELIVERY_EVAL_MAX_PROVIDER_REQUESTS` before live operation. Preflight counts the
worst case, including OpenAI repair and optional Scribe, against that ceiling.
A provider hook independently checks the ceiling before dispatch. A private
`.live-started` marker rejects accidental repeated runs. The private report is
checkpointed before each dispatched request and after each result so an
interruption does not erase the spending record.

Reports identify model/rubric/scoring versions, manifest/audio hashes,
per-attempt latency and failures, exact dispatched request counts, returned OpenAI
token usage, Scribe durations, identical-byte dimension ranges, and distinct
transcript/verdict/coaching counts. These are descriptive statistics with no
invented competition tolerance. Usage for lost responses may be unknown; monetary
cost remains explicitly unknown until current prices and provider billing are
applied. The control is a **request ceiling**, not a hard dollar cap.

Per-case repetitions allow repeating only a useful subset. The example manifest
adds explicit expressive-versus-flat pairing, substituted words, and unintelligible
speech, and distinguishes omitted and added words. It retains unapproved consent
and placeholder recordings. Its 16 cases expand to 20 attempts: at most 40 OpenAI
requests without Scribe, or 60 total with Scribe. Those numbers are planning
bounds, not an authorization granted by this work. Start with a smaller paired
subset if appropriate.

## Commands and actual outcomes

All commands ran from the repository root with Node v24.19.0. No live flag was set.

| Command | Outcome |
| --- | --- |
| `node node_modules/vitest/vitest.mjs run src/lib/server/openai-contract.test.ts src/lib/server/openai.test.ts src/lib/judging/evaluation.test.ts src/lib/judging/rubric.test.ts src/lib/judging/consented-audio.eval.test.ts` | 29 passed; 1 opt-in evaluation skipped. Includes explicit fallback, request-ceiling/repair interception, Scribe separation, usage recording, repeat summary, consent, format and arithmetic contracts. |
| `node node_modules/typescript/bin/tsc --noEmit` | Passed. |
| `node node_modules/eslint/bin/eslint.js src/lib/server/openai.ts src/lib/server/openai-contract.test.ts src/lib/judging/evaluation.ts src/lib/judging/evaluation.test.ts src/lib/judging/consented-audio.eval.test.ts` | Passed. |
| `DELIVERY_EVAL_MANIFEST=docs/evaluation/manifest.example.json node node_modules/vitest/vitest.mjs run src/lib/judging/consented-audio.eval.test.ts` | Expected rejection (exit 1): all three unapproved consent flags rejected before file/provider processing. Zero provider calls. No consent flags were changed to manufacture a calibration run. |

No synthetic speech or human recording was sent during Step 1C. Live score
distribution, repeatability, latency and feedback quality are **not measured**.
The run-once/checkpoint path is prepared in code; no authorized live run exercised
it here. Transport observations remain the earlier Step 1B Scribe results, which
do not validate acting quality or the OpenAI judge.

## Exact remaining owner actions

Securely configure an already authorized OpenAI development key; provide the
consented human fixtures and accurate human transcripts using the existing kit;
approve a small request ceiling; run the no-network preflight, then one bounded
live run with fixture fallback disabled. Use two blind reviewers to assess actual
audible grounding, one actionable coaching adjustment, direction fit, humor,
quiet/loud pair ordering, and repeat variation. Estimate cost from recorded usage
and current prices and reconcile uncertain requests with provider billing. Keep
raw audio/transcripts private and delete them by the consent deadline. Do not
change scoring weights or comparability until this evidence supports a decision.
