# Analytics, experimentation, and quality plan

## Measurement principles

- Measure behavior needed to improve the product, not everything available in the browser.
- Event names describe completed facts in `snake_case`.
- One canonical event is emitted once at the layer that knows it succeeded.
- Server events are authoritative for judgment, publication, challenge completion, moderation, and billing.
- Never send audio, transcript, line text, verdict text, email, full URL/query, IP address, signed URL, API key, or report narrative as an analytics property.
- Stable IDs are opaque UUIDs. Anonymous IDs are first-party, resettable, and not used as covert fingerprints.
- Document owner, purpose, retention, and downstream destinations for every event.

## Common event envelope

Every event should include only applicable safe values:

| Property | Example | Notes |
| --- | --- | --- |
| `event_id` | UUID | Dedupe |
| `occurred_at` | ISO UTC | Server time for authoritative events |
| `anonymous_id` / `user_id` | Opaque ID | Never email/handle |
| `session_id` | Opaque ID | Rotated according to privacy policy |
| `app_version` | Git SHA/release | Required for regressions |
| `environment` | local/preview/production | Exclude local from product dashboards |
| `platform` | web | Avoid high-entropy fingerprint fields |
| `viewport_class` | small/medium/large | Coarse |
| `locale` | en-US | Only where justified |
| `mode` | classic/daily/streak/impossible/challenge/stream | Enum |
| `pack_id`, `line_id`, `energy_id` | UUID | IDs, never text |
| `experiment_assignments` | bounded key/version | No arbitrary JSON |
| `request_id` | opaque | Correlates operational traces, tightly controlled |

## Core gameplay funnel

| Event | Emission point | Important properties |
| --- | --- | --- |
| `landing_viewed` | Landing interactive | referrer class, campaign allowlist |
| `play_started` | Prompt becomes playable | entry point, guest/auth |
| `prompt_presented` | Eligible pair displayed | IDs, difficulty, selection source |
| `prompt_redrawn` | New pair accepted | prior IDs, redraw count |
| `microphone_permission_requested` | Direct user action requests permission | first-time/session |
| `microphone_permission_resolved` | Browser resolution | granted/denied/dismissed |
| `recording_started` | Capture actually begins | codec family, take number |
| `recording_stopped` | Valid local blob created | duration bucket, stop reason |
| `take_played_back` | Playback begins | take number |
| `take_discarded` | Retake/discard | reason if explicit |
| `judgment_submitted` | Server accepts idempotent request | auth state, duration bucket |
| `judgment_stage_completed` | Server stage completes | stage, latency bucket, model version |
| `judgment_completed` | Durable result committed | overall band, dimension bands, confidence band, rubric |
| `judgment_failed` | Terminal failure | safe error code, stage, retryable |
| `result_viewed` | Scorecard visible | reveal skipped/reduced motion |
| `director_retry_started` | Same prompt retried | prior score band |
| `next_round_started` | New prompt accepted from result | source |

Do not emit raw numeric audio features or a person's inferred vocal attributes to product analytics. Operational calibration belongs in a restricted evaluation store.

## Sharing and social

| Event | Meaning |
| --- | --- |
| `share_started` | User opens share action; channel is copied_link, native_share, x_intent, download_card, download_clip |
| `share_completed` | Browser/provider indicates handoff where observable; do not overstate a click as a successful post |
| `share_link_opened` | Public share route rendered with valid content |
| `share_play_started` | Visitor starts shared media |
| `share_cta_clicked` | Visitor chooses Play this line / Take the challenge |
| `delivery_visibility_changed` | Owner changes private/unlisted/public |
| `delivery_unpublished` | Public access revoked |
| `reaction_created` / `reaction_removed` | Valid server mutation |
| `profile_viewed` | Public profile view, block-aware |
| `feed_delivery_opened` | Feed card expands/opens |
| `challenge_created` | Invite is durable |
| `challenge_opened` | Valid code preview |
| `challenge_submitted` | Recipient result committed |
| `challenge_completed` | Rivalry card available |
| `rematch_created` | Mutual follow-up created |

Attribution uses a short-lived, first-party share/challenge token mapped server-side. Do not encode user identity, prompt text, or private content in campaign parameters.

## Daily, streak, content, and progression

- `daily_viewed`
- `daily_ranked_submission_completed`
- `daily_practice_completed`
- `daily_streak_advanced`
- `hot_streak_started`
- `hot_streak_round_completed`
- `energy_debt_added`
- `hot_streak_banked`
- `hot_streak_ended`
- `pack_viewed`
- `pack_play_started`
- `pack_favorited` / `pack_unfavorited`
- `line_favorited` / `line_unfavorited`
- `badge_earned`
- `leaderboard_viewed`
- `leaderboard_entry_opened`

Content events include content version and selection source: evergreen, daily, trend slot, challenge, favorite, replay. This lets editors separate trend lift from prompt quality.

## Account, safety, and billing

| Event | Notes |
| --- | --- |
| `signup_started` / `signup_completed` | Provider enum only |
| `daily_guest_signin_clicked` | Guest chooses the pre-submit ranked-receipt sign-in path |
| `profile_updated` | Changed-field enum; no values |
| `data_export_requested` / `data_export_completed` | Privacy operation |
| `account_deletion_requested` / `account_deletion_completed` | Privacy operation |
| `submission_created` | Category and automated review state, no text |
| `report_submitted` | Entity type and reason code; no narrative |
| `moderation_action_applied` / `moderation_action_reversed` | Restricted dataset |
| `checkout_started` | Monthly/annual key, never arbitrary amount |
| `checkout_session_created` | Server event |
| `subscription_state_changed` | Webhook-authoritative old/new status, interval |
| `billing_portal_opened` | Server session created |

Trust events should be access-controlled and excluded from broad self-service analytics.

## KPI definitions

### Acquisition and activation

- Landing → Play: `play_started / eligible landing_viewed`
- Record start: `recording_started / prompt_presented`
- First valid result: unique new users/sessions with `judgment_completed`
- Time to first result: result commit minus first `play_started`
- Activation: new visitor completes a judgment and starts a second round, share, or challenge within the same session

### Engagement and retention

- Weekly performers: unique accounts/anonymous sessions with a valid submitted round
- Rounds per performer
- One-more rate: result viewers who start another round within ten minutes
- D1/D7 performer retention by first-play cohort
- Daily participation and streak continuation
- Pack breadth per weekly performer

### Sharing

- Share initiation per valid result
- Share-link visit per completed share where observable
- Share-to-play: attributed recipients who start
- Share-to-result: attributed recipients who complete
- Viral coefficient: attributed new performers per sharing performer
- Challenge open and completion rates

### Quality and safety

- p50/p95 recording-to-result latency by stage
- technical failure and retry-success rates
- unusable-audio and low-confidence judgment rate
- invalid structured output and moderation quarantine rates
- score distribution drift by prompt/rubric/model
- report rate per 1,000 public views
- report-to-containment/decision time
- block, unpublish, deletion, and appeal reversal rates

### Business

- Pricing view → Checkout
- Checkout → active entitlement
- trial/initial payment failure where applicable
- paid conversion by activated cohort
- monthly/annual mix
- voluntary/involuntary churn
- gross margin per paid performer, including AI, storage, render, and support costs

Do not optimize conversion by hiding recurring terms or making cancellation harder.

## Dashboard set

1. **Launch room:** traffic, play funnel, valid results, p95 latency, error classes, provider usage/spend, webhook lag, report volume.
2. **Core loop:** cohort activation, one-more rate, rounds/session, retakes, mode mix.
3. **Content desk:** prompt and energy skip/start/submit/share/report, trend slot lift, fatigue.
4. **Social loop:** share/challenge conversion, public playback, reactions, unpublishing.
5. **Trust:** queue age, action and reversal, repeat actors, public exposure before containment.
6. **Business:** Checkout, entitlement, MRR-equivalent, churn, payment failures, unit cost.
7. **Accessibility/compatibility:** permission denial, recorder errors by browser/OS class, reduced-motion usage, keyboard/a11y support defects.

## Experiment rules

- Write hypothesis, primary metric, guardrails, population, duration, and stopping rule before launch.
- Randomize server-side or with a stable first-party assignment.
- Do not experiment on privacy defaults, safety enforcement, deletion, consent, accessibility, hidden fees, or deceptive urgency.
- Keep event definitions constant across variants.
- Require enough exposure and a full weekly cycle where behavior varies by day.
- Segment only on approved coarse properties.
- Roll back if safety, error, latency, or accessibility guardrails regress.
- Record the winning decision and remove stale flags.

Initial experiments:

- Result primary action: “One more” versus the Director's Note retry
- Share card composition: score-led versus receipt-led
- Daily sign-in explanation: inline notice versus pre-recording gate
- Daily landing: rank-led versus shared-prompt-led

## Test strategy

The release pyramid has deterministic unit and integration coverage, a small cross-browser E2E suite, fixed AI calibration evaluations, manual audio/accessibility checks, and production smoke monitoring.

### Unit tests

Content/domain:

- prompt eligibility, weighting, cooldown, fallback, and trend expiry
- daily UTC key and tie-break
- Hot Streak transitions and signed state
- challenge expiry/redemption/rematch
- score weighting/clamping/bands
- badges and quota/entitlement decisions
- content normalization/duplicate validation

Security/parsing:

- environment schema and production mock prohibition
- MIME, bytes, duration, and multipart validation
- redirect allowlist
- public projection/redaction
- storage path generation
- rate-limit keys and retry headers
- structured judgment schema with missing, extra, boundary, and malicious fields

Billing:

- price-key allowlist
- subscription status → entitlement mapping
- webhook idempotency and out-of-order events
- checkout/portal ownership

### Integration tests

- anonymous and authenticated prompt draw
- Supabase SSR login/callback/logout/session refresh
- guest result remains ephemeral and cannot appear in account history without a dedicated future claim protocol
- upload → direct-audio judge fake → structured result → durable result
- idempotent repeated `/api/judge` request
- private/public/unlisted RLS matrix
- signed URL issuance and revocation
- submission moderation/review state
- report and unpublish propagation
- challenge dual result
- Daily one-ranked-result rule
- Stripe signature verification, replay, status changes, and failure handling

Use provider fakes for CI; run separate opt-in contract tests against sandbox providers. Tests must never call live billing or a production database.

### Browser E2E

Critical journeys:

1. Guest first play → mocked recording → result → one more
2. Permission denied → recovery guidance
3. Retake → playback → submit
4. Daily guest notice → sign in → return to the same Daily before recording
5. Daily submission → rank → practice replay
6. Challenge create → recipient play → rivalry card
7. Publish → public share → unpublish → link unavailable
8. Report public delivery
9. Subscribe in Stripe sandbox → webhook → Pro → Portal
10. Account export/deletion initiation

Run on current Chromium, Firefox, WebKit desktop emulation, and representative small mobile layouts. Real-device audio coverage remains necessary because mocked media APIs do not validate codecs or permissions.

### Real-device audio matrix

At minimum:

- iPhone Safari, current and previous major iOS
- Android Chrome on a midrange device
- macOS Safari and Chrome
- Windows Chrome, Edge, and Firefox
- built-in mic, Bluetooth headset, wired/USB mic where available
- device switching, notification interruption, phone call/interruption where testable
- quiet speech, clipping, silence, short/maximum take
- Wi-Fi, throttled network, upload interruption, background/lock behavior

Record supported MIME type, blob size, playback success, transcript result, latency, and recovery quality. Do not retain tester audio beyond the consented test period.

### AI evaluation suite

Maintain a versioned, consented fixture set with:

- exact/partial/off-prompt readings
- low/medium/high commitment
- intentional deadpan and non-comedic delivery
- controlled versus extreme chaos
- silence, noise, clipping, and corrupted files
- varied devices, vocal ranges, accents, fluency, and speech rates
- adversarial prompt injection spoken in the recording
- abusive text that must not be echoed into the verdict

Gates for a model/rubric change:

- 100% output-schema validity after allowed retry
- unusable audio routes to retry, not fabricated score
- score ordering matches labeled low/medium/high commitment on the calibration subset
- overall distribution shift stays within the approved tolerance
- no prohibited sensitive inference or abusive verdict in adversarial fixtures
- subgroup gaps are investigated and within approved bounds
- latency/cost meets the current service budget

Human reviewers score specificity, humor, fairness, repetition, and safety blind to model version. Automated checks cannot judge comic quality alone.

### Moderation tests

- every guideline category and boundary-safe negative example
- obfuscation, spacing, homoglyphs, coded language, and prompt injection
- private data patterns and real-person names/handles
- repeated reporter and coordinated report floods
- block effects across profile/feed/challenge/reaction
- urgent quarantine and cache invalidation
- moderator role boundaries and audit logging
- appeal/reversal restoration
- user deletion interacting with open reports

### Accessibility tests

Use the release checks in [TRUST_PRIVACY_ACCESSIBILITY.md](TRUST_PRIVACY_ACCESSIBILITY.md). Automated scans are required but never sufficient.

### Performance tests

Budgets:

- Core Web Vitals meet “good” thresholds at the p75 field percentile on the launch audience where measurable.
- Marketing/play initial JavaScript stays within an explicit bundle budget set in CI.
- No layout shift when prompt, waveform, score, or fonts resolve.
- Prompt APIs remain responsive under expected launch load.
- Judge submissions backpressure before provider/host saturation.
- Feed/profile images and media are lazy, sized, and bounded.

Load test application-owned endpoints with mock providers and disposable data. Do not load test Stripe sandbox or other third-party APIs.

### Security tests

- dependency and secret scanning
- static analysis and production-header review
- authorization/RLS tests for every table and storage object
- IDOR attempts across delivery, challenge, profile, subscription, and report IDs
- CSRF/origin protections on cookie-authenticated mutations
- XSS in handles, bios, prompts, verdicts, SVG/art, share metadata
- SSRF/open redirect
- oversized/decompression/polyglot audio upload
- rate-limit bypass and anonymous-session rotation
- webhook invalid signature/replay/body mutation
- OAuth callback abuse and account linking
- signed URL leakage and cache-control
- admin route/role escalation

Commission an independent review before major creator/stream campaigns.

### Resilience tests

- OpenAI timeout, quota, invalid JSON, safety refusal, and partial outage
- Supabase database/storage unavailable
- Stripe API unavailable and webhook delayed/duplicated/out of order
- Redis unavailable
- deployment during an in-flight judgment
- stale cache after unpublish
- scheduled Daily content missing

Expected behavior is explicit, retry-safe, and privacy-preserving. Production never converts an outage into a fabricated score or entitlement.

## Release acceptance

A release candidate passes when:

- lint, type check, unit, integration, build, and critical E2E pass
- migrations apply forward on a production-like copy and rollback/mitigation is documented
- no critical/high unresolved security or trust defect
- no blocker in record → result, share/unpublish, report, billing, or data deletion
- real-device audio matrix passes supported targets
- AI calibration gates pass with recorded model/rubric versions
- accessibility critical flow passes manual review
- error, spend, webhook, and moderation alerts are tested
- on-call owner and rollback build are identified

## Post-deploy verification

Within fifteen minutes:

- homepage and play route render from two regions/networks
- one synthetic/mock-safe health check passes without creating public content
- one controlled real judgment completes
- auth callback and signed-out boundaries work
- Stripe endpoint receives a signed test/sandbox event in nonproduction
- logs contain correlation data and no content/secrets
- dashboards receive the new app version

Within twenty-four hours:

- compare funnel and error metrics with release baseline
- inspect provider cost/latency and schema retry
- sample public results and verdict quality
- check moderation queue and report exposure
- verify no unexpected production mock fallback
