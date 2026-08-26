# Go-live runbook

This is the release gate for a public commercial launch. A green build is necessary but not sufficient. Every checked item needs an owner and evidence link in the launch tracker.

The repository supplies anonymous and signed-in reporting, an authenticated
moderator queue at `/moderation`, urgent-first triage, target inspection, atomic
containment, and audited decisions. Software does not create a staffed moderation
operation. Public traffic remains a no-go until named coverage, out-of-band
escalation contacts, appeal/legal procedures, production role assignments, and a
rehearsed response path are in place.

## Current certification boundary

This repository can supply source-level evidence; it cannot certify external accounts or operations. Keep launch blocked until the tracker contains evidence for all of the following:

- a fresh disposable Supabase reset and the full pgTAP suite, followed by hosted migration, RLS, backup, and restore verification;
- paid OpenAI model access, calibrated live judgments, rate/spend limits, and outage behavior;
- activated Stripe products/prices, Portal, webhook, tax/refund decisions, and duplicate-subscription reconciliation;
- production Upstash limits, a scheduled moderation-cleanup worker, alert delivery, final HTTPS/DNS, and a rollback rehearsal;
- real-device recorder/installability and accessibility testing; and
- staffed Trust & Safety/support coverage plus approved legal, age, region, retention, and content-rights decisions.

A successful build or local test run is not public-launch certification. Checkboxes in this runbook remain intentionally unchecked until an owner attaches evidence.

## Launch roles

Assign named people before setting a date:

- Launch commander — final go/no-go and coordination
- Engineering on-call — application, database, and deployment
- AI/content on-call — judgment quality, model, prompt, trend, Daily
- Trust & Safety lead — reports, emergency unpublish, escalation
- Support lead — user communication and known issues
- Billing owner — Stripe, refunds, entitlements, tax configuration
- Privacy/security owner — incident response and legal contact
- Communications owner — status, social, Product Hunt, creator partners

One person may hold several roles at small scale, but no role may be unowned. Record phone/out-of-band contact paths.

## T-14 days: scope freeze

### Product

- [ ] Guest can finish the first round without an account.
- [ ] Classic, Daily, Challenge, result, share, profile, leaderboard, packs, settings, and pricing have final empty/loading/error states.
- [ ] “One more” returns to a playable prompt without a full-app dead end.
- [ ] Mobile layouts pass at 320, 375, 390, and tablet widths.
- [ ] Stream Mode is labeled appropriately if any audience interaction remains limited.
- [ ] Free/Pro limits match UI copy, server enforcement, Stripe products, and support macros.

### Content

- [ ] Launch library meets the approved volume and quality targets.
- [ ] Every live item has safety tier, rights status, provenance, and owner.
- [ ] Thirty Daily Challenges and fourteen fallbacks are scheduled.
- [ ] Trend slots have expiry, fallback, kill switch, and staff owner.
- [ ] No copied movie/anime/game dialogue or attributed streamer quote ships without documented approval.
- [ ] Calibration set passes the current model/rubric gate.

### Trust and legal

- [ ] Terms, Privacy Notice, Community Guidelines, refund/cancellation language, and content license are counsel-approved and linked.
- [ ] Minimum age and regional availability are decided and enforced.
- [ ] Recording and publication consent copy is final.
- [ ] Report, block, unpublish, appeal, export, and deletion flows work.
- [ ] Account deletion and Billing Portal require the approved recent-authentication step, or security has explicitly accepted the session-age policy.
- [ ] An authenticated moderator queue or approved staff tool supports report triage, target review, quarantine/unpublish, auditable decisions, and urgent escalation end to end.
- [ ] Moderator staffing/coverage matches published expectations.
- [ ] Emergency and legal reporting procedures, named owners, coverage hours, and out-of-band escalation contacts are accessible to the team and have been rehearsed.
- [ ] Subprocessor and retention inventory matches actual configuration.

## T-7 days: production configuration

### Source and CI

- [ ] Production branch is protected and requires review/checks.
- [ ] Lockfile is committed and clean install is reproducible.
- [ ] Lint, type-check, unit, integration, build, E2E, content validation, secret scan, and dependency scan pass.
- [ ] Source maps and logs are configured without exposing secrets/content.
- [ ] Release SHA and version appear in safe operational metadata.
- [ ] Rollback deployment is identified and database compatibility is confirmed.

Run the source gate from a clean install:

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
$env:PLAYWRIGHT_SERVER_MODE = "production"
npm run test:e2e
Remove-Item Env:PLAYWRIGHT_SERVER_MODE
$env:PLAYWRIGHT_BASE_URL = "https://STAGING_DOMAIN"
npm run test:e2e
Remove-Item Env:PLAYWRIGHT_BASE_URL
```

The default suite starts the development server, production mode tests the already-built application, and `PLAYWRIGHT_BASE_URL` runs the bounded smoke suite against a deployed host without starting a local server. The suite covers public routes, mobile overflow, guest synthetic-microphone gameplay, health, and random-prompt contracts; it is not a substitute for live Supabase, OpenAI, Stripe, real-microphone, or real-device verification.

### Supabase — third-party configuration

- [ ] Production project is separate from staging.
- [ ] All migrations applied and recorded.
- [ ] A disposable local stack passes `npx supabase db reset` and `npx supabase test db` from the repository root; the evidence includes the Daily, challenge/privacy, moderation-cleanup, and Stripe snapshot migrations.
- [ ] RLS enabled and negative authorization matrix tested.
- [ ] `delivery-audio` is private with owner/service policies.
- [ ] Signed playback expires and unpublish revokes new access.
- [ ] Auth Site URL and exact callback allowlist use the final domain.
- [ ] Email provider/templates/from-domain/links are production-ready.
- [ ] Chosen social providers use production credentials and callback URLs.
- [ ] Backups/PITR and restore procedure match RPO/RTO.
- [ ] Database, storage, auth, and egress quotas have headroom/alerts.
- [ ] Service-role access is restricted and rotation owner recorded.

### OpenAI — third-party configuration

- [ ] Production project/key is separate from development.
- [ ] `DELIVERY_AI_MODE=live`.
- [ ] `DELIVERY_AI_ALLOW_MOCK_FALLBACK=false`.
- [ ] Direct-audio judgment model and rubric values are approved by calibration.
- [ ] Project spend/rate limits and alerts are set.
- [ ] Provider error/request IDs are logged without content.
- [ ] Timeout, retry, invalid schema, refusal, quota, and outage behavior pass.
- [ ] No OpenAI secret or direct call appears in browser assets/network.

### Stripe — third-party configuration

- [ ] Account activation, business details, bank/payout, support contact, statement descriptor, tax decision, and required policies are complete.
- [ ] Live Delivery Pro product has approved monthly and annual prices.
- [ ] Pricing UI, checkout display, and receipts use the same currency/terms.
- [ ] Customer Portal cancellation/payment/invoice settings are approved.
- [ ] Live secret, price IDs, and endpoint signing secret are present only in Production scope.
- [ ] Live webhook points to `https://CANONICAL_DOMAIN/api/stripe/webhook`.
- [ ] Required events are selected.
- [ ] Raw-body signature verification and event idempotency pass.
- [ ] Checkout reconciliation routes an existing nonterminal Delivery subscription to Portal, reuses a matching open session, and expires obsolete competing sessions without creating a second subscription.
- [ ] Webhook replay and same-second/out-of-order tests prove that a freshly retrieved current Stripe object snapshot—not the lexicographic event ID—controls entitlement state.
- [ ] An operator query/runbook detects customers with multiple nonterminal Delivery subscriptions, selects the intended record, cancels/refunds the unintended duplicate in Stripe, and verifies a subsequent signed webhook reconciliation.
- [ ] Checkout, renewal, failed payment, recovery, cancellation, interval change, and Portal flows are tested.
- [ ] Success URL alone never grants Pro.
- [ ] Refund and billing-support runbooks are ready.

### Hosting, DNS, and operations — third-party configuration

- [ ] Canonical domain and `www` redirect chosen.
- [ ] TLS is active and auto-renewing.
- [ ] Production variables exactly match [ENVIRONMENT.md](ENVIRONMENT.md).
- [ ] Preview deployments cannot reach production data/billing.
- [ ] Security headers and CSP support microphone, providers, images, media, and analytics with minimum origins.
- [ ] Robots/sitemap/canonical/Open Graph metadata are correct; private/unlisted routes are noindex.
- [ ] Error tracking, uptime, analytics, and alert destinations are active.
- [ ] Distributed rate limiter is configured and failure behavior tested.
- [ ] Status page and support address/form are ready.
- [ ] DNS/provider/admin accounts have MFA and recovery owners.

## T-3 days: production dress rehearsal

Run against the final production domain with controlled test accounts/content.

### Core smoke

- [ ] Landing is interactive on a cold mobile connection.
- [ ] `Play now` reaches a ready prompt.
- [ ] Microphone permission grant, denial, dismissal, and later recovery behave correctly.
- [ ] Recording level, timer, stop, playback, retake, and max duration work.
- [ ] A live WAV submission is heard by the audio judge and returns a valid transcript plus structured score.
- [ ] Overall score recomputes from dimensions and rubric.
- [ ] Low-quality/silent input asks for retry.
- [ ] Provider timeout preserves privacy and does not invent a result.
- [ ] One More, same-line Director's Note retry, favorite, and history work.

### Modes/social

- [ ] `GET /api/leaderboard?period=daily&metric=overall&market=global` matches `daily_leaderboard_live`: current UTC date, canonical global prompt plus energy, one durable ranked receipt per account/date/market, practice retries excluded, and blocked/private/moderated/deleting users absent.
- [ ] A signed-in player below the top 100 receives the same-shape `viewer` position from `get_daily_leaderboard_position`; first submission is ranked, later same-day submissions are labeled practice, and deleting the first take does not free its ranked receipt.
- [ ] Hot Streak state cannot be client-edited and survives navigation as intended.
- [ ] Impossible Energy uses only eligible safe prompts.
- [ ] Challenge invite opens signed out, expires, completes, and reveals both results at the right time; only bound participants can call the compact matchup projection, including when the opponent profile is private.
- [ ] A third party, blocked pair, deleting account, profile-contained participant, archived prompt, or removed delivery cannot resolve the invite or matchup; blocking revokes open and completed receipts and does not resurrect follows on unblock.
- [ ] Completed challenges do not advertise a public share URL unless a separately authorized public receipt exists.
- [ ] Public/unlisted/private visibility rules pass.
- [ ] Share card/clip contains correct result and no private metadata.
- [ ] X intent uses concise encoded copy and canonical URL.
- [ ] Unpublish removes feed/profile/leaderboard/share access and invalidates cache.
- [ ] Reactions, blocks, reports, profiles, and leaderboards enforce authorization.

### Account, privacy, and billing

- [ ] Schedule `POST /api/moderation/cleanup?limit=100` every minute with the dedicated worker bearer secret; verify avatar/share retry, dead-letter alerting, and account-deletion receipt reconciliation.
- [ ] A delivery/profile/prompt/submission limit or removal is atomically contained and audited; storage-cleanup jobs lease, retry with backoff, and reach an alerted dead-letter state after the bounded attempt count.
- [ ] Restriction lift is staff-only and audited, and does not silently restore removed content, previous public visibility, follows, avatars, or share assets.
- [ ] Exercise account deletion with more than 1,000 recordings and injected Stripe, Storage, Auth, and final-receipt failures; confirm immediate containment and checkpointed retry behavior.
- [ ] Email auth and each social provider complete callback and logout.
- [ ] Guest results remain clearly ephemeral, and Daily warns guests to sign in before submitting for rank/history.
- [ ] Export contains expected data and no other user's data.
- [ ] Delivery deletion removes/revokes source and derived media.
- [ ] Account deletion is understandable and propagates.
- [ ] Pricing terms and feature limits are accurate.
- [ ] Live or final pre-live Stripe test proves Checkout → signed webhook → Pro.
- [ ] Portal and cancellation reconcile via webhook.

### Accessibility/compatibility

- [ ] Keyboard-only core, reporting, billing, and deletion pass.
- [ ] Screen-reader pass with NVDA/Chrome and VoiceOver/Safari.
- [ ] Reduced motion, forced colors, 200% zoom, and 320 px reflow pass.
- [ ] iPhone Safari, Android Chrome, macOS browsers, and Windows browsers pass the recorder matrix.
- [ ] All status/error messages are perceivable and actionable.
- [ ] Manifest, 192/512/maskable icons, start URL, standalone display, and add-to-home-screen behavior pass on supported iOS and Android devices.
- [ ] Product and marketing copy do not claim offline gameplay, cached judging, background sync, push notifications, or an install prompt; the current build has no service worker.

### Operations

- [ ] Alert tests reach the right people.
- [ ] Moderator can quarantine a delivery and trend editor can kill a slot without deploy.
- [ ] Rollback rehearsal completes within target time.
- [ ] Database restore is tested in a nonproduction project.
- [ ] Support can locate a request, delivery, subscription, and moderation state using safe IDs.
- [ ] No secrets, transcript, audio, report narrative, or signed URL appear in sampled logs/analytics.

## T-24 hours: change freeze and go/no-go

- [ ] Release candidate SHA is frozen.
- [ ] Migration and environment diff reviewed by two people.
- [ ] Known issues are classified, owned, and reflected in support copy.
- [ ] No unresolved P0/P1 trust, security, privacy, accessibility, billing, data-loss, or core-loop bug.
- [ ] Capacity forecast covers expected campaign/creator spike with provider headroom.
- [ ] Daily prompt, trend slots, launch feed, and featured deliveries are approved.
- [ ] Launch posts, visuals, links, UTM allowlist, and creator instructions are final.
- [ ] On-call coverage begins before announcement.
- [ ] Rollback criteria and decision authority are explicit.
- [ ] Every item in the current certification boundary has a named owner and linked external evidence; no source-only green check is treated as provider or operational proof.

### Go decision

The launch commander records:

- release SHA/deployment ID
- migration version
- OpenAI model and rubric versions
- content snapshot/version
- Stripe product/price IDs (IDs only, no secrets)
- environment validation result
- active experiments
- known issues
- on-call roster
- unanimous go/no-go from engineering, trust/safety, billing, and privacy/legal owners

## Launch day

### T-60 minutes

- [ ] Confirm providers and status pages are healthy.
- [ ] Run one private real judgment and immediately inspect stage latency/cost/log redaction.
- [ ] Verify Auth and a controlled live entitlement.
- [ ] Verify Daily, featured feed, share card, unpublish, and report.
- [ ] Freeze trend/content edits except emergency owner.
- [ ] Open dashboards and incident channel.

### Announce

1. Publish canonical launch post.
2. Publish Product Hunt listing at the planned time.
3. Send creator/partner links.
4. Pin a clear “how to play” result, not a feature checklist.
5. Keep team replies human and avoid amplifying harmful recordings.

### First two hours

Watch at five- to fifteen-minute intervals:

- landing → prompt → record → submit → result
- p50/p95 time-to-result by stage
- microphone permission and recorder errors by browser
- AI/provider error, schema retry, fallback, and spend
- database/storage saturation and object failures
- Checkout, webhook success/lag, and entitlement mismatch
- report rate, queue age, blocks, emergency content changes
- share-link visits and attributable play

Sample at least twenty verdicts across score bands. Humor quality failures may not appear as technical errors.

### First 24 hours

- Rotate explicit on-call handoff with written state.
- Review top/lowest-performing prompts for context, not only rank.
- Reconcile Stripe events and subscriptions.
- Inspect orphaned audio and failed-processing cleanup.
- Publish a status update if a material issue affects results, privacy, or billing.
- Do not ship a model, rubric, price, or aggressive trend change without a calibration/safety check.

## Rollback triggers

Immediate feature disable or rollback:

- private audio/result becomes accessible without authorization
- cross-account data access
- secret exposure
- incorrect paid entitlement or duplicate charge risk
- nonconsensual public default
- severe harmful verdict/systematic protected-trait issue
- account deletion/unpublish fails while claiming success
- corrupted or irreversible migration

Pause new judgments/content surface:

- judgment failure above 10% for 10 minutes
- p95 time-to-result above 30 seconds for 15 minutes
- uncontrolled provider spend or quota exhaustion
- mock result detected in production
- report spike linked to a prompt/trend
- storage upload/finalization failures risk orphan/leak

Thresholds should be tuned after baseline traffic; privacy/security triggers remain immediate.

## Rollback sequence

1. Declare incident and owner; timestamp the decision.
2. Stop the smallest unsafe surface with a feature/content kill switch.
3. For data/auth/billing risk, disable affected mutations before rolling application code.
4. Roll back to the last database-compatible deployment.
5. Revoke/rotate exposed credentials and signed capabilities.
6. Quarantine affected content and invalidate caches.
7. Reconcile incomplete judgments, uploads, webhooks, entitlements, and deletions idempotently.
8. Communicate externally when users are affected.
9. Reopen only after targeted tests and owner sign-off.

Never roll a database backward destructively during an incident without an explicit recovery plan and verified backup. Prefer forward-compatible corrective migrations.

## Incident severity

| Severity | Definition | Response |
| --- | --- | --- |
| SEV-0 | Active safety, privacy, security, or financial harm | Immediate containment, executive/legal involvement |
| SEV-1 | Core game or entitlement broadly unavailable; no confirmed sensitive exposure | Page on-call, mitigation target under 30 minutes |
| SEV-2 | Major degraded mode or cohort-specific breakage | Owner within business/on-call window, frequent updates |
| SEV-3 | Limited defect with workaround | Track and schedule |

## T+1, T+7, and T+30 reviews

### T+1 day

- activation, one-more, share/challenge conversion
- browser/device errors
- verdict quality and calibration
- provider cost/latency
- reports, containment, support themes
- billing/webhook reconciliation

### T+7 days

- D1 retention and Daily streak
- content fatigue and pack breadth
- share-to-play coefficient
- paid conversion/cancellation/support
- moderation reversal and disparity slices
- capacity and cost forecast
- launch experiment decisions

### T+30 days

- D7 retention and cohort quality
- content replenishment health
- unit economics
- privacy/deletion SLA
- incident/near-miss review
- roadmap decision: deepen game loop, social discovery, or Stream Mode based on evidence

## Launch evidence archive

Retain in the internal launch tracker:

- release/migration/content/model versions
- test and calibration summaries
- legal and content approvals
- RLS/security review
- provider configuration screenshots with secrets redacted
- alert and rollback rehearsal results
- go/no-go record
- incidents and follow-ups

Do not place credentials, raw audio, transcripts, user reports, or unnecessary personal data in the archive.
