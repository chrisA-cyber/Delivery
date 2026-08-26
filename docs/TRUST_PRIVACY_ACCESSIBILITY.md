# Trust, safety, privacy, and accessibility

## Safety posture

Delivery asks people to record and sometimes publish their voices. That creates higher consent, harassment, privacy, impersonation, and youth-safety risk than an ordinary prompt game. Safety is part of the game loop, not a footer.

Defaults:

- New recordings are private.
- Publishing and challenge sharing are explicit actions.
- Public discovery is available only for eligible, moderated accounts/content.
- Share links reveal the minimum result data and can be revoked.
- User-submitted prompts never enter play automatically.
- The safe-default content tier excludes mature language and sensitive scenarios.
- AI judgment is entertainment feedback, not a measure of intelligence, identity, health, truthfulness, employability, or vocal ability.

## Community guidelines

### The short version

Commit to the bit. Do not make another person the target.

### Allowed

- Original comedic performances and playful role-play
- Good-faith friend challenges where everyone chooses to participate
- Transformative genre parody that does not copy protected dialogue or impersonate a real person
- Predefined reactions to public deliveries
- Criticism of a performance expressed without harassment
- Mature language only in an appropriately labeled opt-in surface

### Not allowed

- Hate, dehumanization, slurs, or attacks based on protected traits
- Threats, encouragement of violence, glorification of real-world harm, or dangerous challenges
- Sexual content involving minors; grooming; exploitation
- Self-harm encouragement or instructions
- Targeted harassment, dogpiling, humiliation, stalking, doxxing, or sharing private information
- Nonconsensual recording or publication
- Impersonation intended to deceive, defraud, harass, or suggest endorsement
- Requests to clone or imitate a real person's distinctive voice
- Fraud, scams, illegal instructions, or evasion of safety systems
- Spam, coordinated manipulation, bought reactions, leaderboard cheating, or abusive automation
- Copyrighted dialogue, creator quotes, music, or other material the poster has no right to publish
- Malware, exploit payloads, encoded abuse, or attempts to manipulate the judging/moderation prompts

Users should not submit sensitive personal information in lines, bios, reports, or recordings.

## Reporting

Every public delivery, profile, challenge, line, and reaction menu exposes `Report`. Reports use structured reasons:

- hate or harassment
- threat or dangerous behavior
- sexual/minor safety
- self-harm
- private information
- impersonation or deceptive synthetic media
- nonconsensual recording
- spam/manipulation
- copyright or trademark
- other policy concern

The report form:

- preselects the entity and preserves its internal ID
- accepts a short optional explanation
- warns users not to repeat sensitive content unnecessarily
- provides emergency guidance when imminent harm is reported
- confirms receipt without revealing enforcement details

Do not require an account for serious public-content reports. Apply anti-spam limits without blocking urgent categories.

## Moderation workflow

```text
report / automated signal
    → triage
    → contain if urgent
    → evidence review
    → decision
    → action + notification
    → appeal
    → quality review
```

Priority targets:

| Priority | Examples | Containment target | Decision target |
| --- | --- | --- | --- |
| P0 | credible imminent harm, child sexual exploitation, exposed highly sensitive data | Immediate automated quarantine/escalation | Specialized response immediately |
| P1 | threat, severe hate/harassment, nonconsensual intimate or deceptive impersonation | Under 1 hour | Under 4 hours |
| P2 | targeted harassment, private information, repeated evasion, rights complaint | Under 8 hours | Under 24 hours |
| P3 | spam, mislabeled mature content, ordinary policy dispute | As needed | Under 72 hours |

Targets are operational goals, not promises to users until staffing and coverage support them. Illegal-content procedures, reporting obligations, and preservation rules require counsel and jurisdiction-specific review.

Moderator console requirements:

- least-privilege roles and strong authentication
- queue ordered by harm, virality, and exposure—not only report count
- sanitized playback with explicit audio action and volume protection
- reporter identity hidden where not needed
- exact policy version and reason codes
- immutable audit trail for views and actions
- dual approval for permanent high-impact actions where practical
- conflict-of-interest reassignment
- no downloading raw audio by default

## Enforcement ladder

Choose the least severe action that reliably stops harm:

- no action / educate
- label or remove from recommendation
- unpublish specific delivery
- reject or retire prompt
- disable reactions/challenges
- temporary feature restriction
- temporary account suspension
- permanent account ban
- hash/block repeated content or actor patterns
- preserve/escalate under legal emergency process

Severity, intent, harm, history, reach, and evasion inform the choice. Payment does not reduce enforcement. Scores, badges, and follower/reaction counts do not increase credibility.

Users receive:

- the affected content/account
- policy category
- action and duration
- whether content is still privately available
- appeal method and deadline

Do not expose reporter identity or detailed detection logic.

## Appeals

- One accessible appeal per decision within a documented window.
- A different qualified reviewer handles the appeal when staffing allows.
- Restore publication, ranks, and badges atomically when a decision is reversed.
- Notify the user with a concise reason.
- Track reversal rate by rule, reviewer, model, locale, and content source.
- Do not punish good-faith appeals.

## Automated safety

Use layered controls:

1. deterministic validation and blocked patterns
2. provider text moderation for submitted lines, transcripts, and generated verdicts where appropriate
3. application-specific policy classifier/rules
4. human review for public user submissions, ambiguous high-risk reports, and appeals
5. post-publication reports and anomaly detection

Automated output is a signal, not an explanation users must accept blindly. Record model/policy version and confidence. Never send full recordings to a text-only moderation endpoint or claim that transcript moderation detects every audio cue.

OpenAI's [Moderations endpoint](https://developers.openai.com/api/reference/resources/moderations) classifies potentially harmful text or images. Delivery still needs its own policies for voice consent, impersonation, privacy, rights, and game-specific abuse.

## AI judging fairness

The judging prompt and calibration set must explicitly prevent:

- inferring race, ethnicity, nationality, gender, sexuality, disability, health, age, class, or religion
- rewarding a prestige accent or penalizing a regional/non-native accent
- diagnosing speech, mental state, intoxication, or truthfulness
- comparing the performer to a protected or real person's voice
- degrading comments about voice pitch, timbre, speech difference, or identity
- conflating audio interpretation uncertainty with low commitment

Accuracy measures words/intent relative to the supplied prompt. If transcript confidence or audio usability is too low, ask for a retry rather than issue a punitive score.

Calibration slices:

- device and codec
- quiet/background-noise setting
- volume and speaking rate
- language fluency
- regional and non-native accents
- speech differences where participants explicitly consent
- masculine/feminine/androgynous-presenting vocal ranges without inferring identity

Review score distribution, unusable-audio rate, transcript error, verdict sentiment, and appeals/complaints. Any material disparity blocks a model/rubric rollout until understood and mitigated.

## Privacy data map

| Data | Why collected | Visibility | Suggested retention |
| --- | --- | --- | --- |
| Account ID, email through Auth | Login and account recovery | User + restricted operations | Account life plus bounded backup window |
| Profile handle/name/avatar/bio | Identity and sharing | User-selected public/private | Until edited/deleted |
| Source audio | Judgment, replay, optional sharing | Private by default | User-controlled; define short default for failed/unpublished takes |
| Derived share media | User-requested sharing | Unlisted/public by choice | While delivery remains shared |
| Transcript | Judge input, support/calibration when necessary | Restricted/private | Shortest useful period; delete with recording |
| Scores/verdict/model versions | Result, history, calibration | Private/public by choice | Account life or de-identified aggregate |
| Challenges/reactions | Social features | Participants/public aggregate | Product life with delete/block controls |
| Reports/moderation evidence | Safety and appeals | Trust staff | Policy/legal schedule |
| Billing IDs/status | Entitlement and support | User + billing operations | Accounting/legal schedule; card data stays with Stripe |
| Security logs | Abuse, reliability, incident response | Restricted operations | Bounded operational window |
| Analytics events | Product improvement | Aggregated/controlled | Bounded; no raw voice/transcript |

Actual retention durations, subprocessors, international transfer mechanisms, lawful bases, age rules, and regional rights must be finalized with counsel and published before launch. This document is an engineering requirement, not a privacy policy or legal advice.

## Consent and visibility

Before first recording:

- Explain what will be captured and that submission sends audio for AI processing.
- Link to the privacy notice.
- Do not request microphone permission until the user taps record.

Before first publication:

- Show exactly what becomes public: audio/share clip, prompt, score, verdict, handle/profile association, timestamp/rank.
- Default the toggle off.
- Require confirmation that the user recorded the performance and has permission from anyone audible.
- Explain that copied share media may persist outside Delivery even after unpublishing.

Visibility states:

- **Private:** owner only
- **Unlisted:** anyone with the opaque link; excluded from feed/profile/leaderboards unless separately eligible
- **Public:** discoverable subject to moderation and profile settings

A public profile does not make every delivery public.

## User controls

Settings must include:

- default delivery visibility
- public profile toggle and discoverability
- reaction/challenge permissions
- blocked users
- sound and motion preferences
- download personal data
- delete individual delivery and source audio
- revoke/unpublish share link
- delete account

Deletion is confirmed, cancellable for a short recovery period only if disclosed, then propagated to database, storage, derived media, caches, search/feed indexes, and processors. Show status if completion is asynchronous.

## Privacy engineering

- Data minimization: do not collect contacts, precise location, or raw browser fingerprint for launch.
- Do not place transcript, audio URL, email, challenge code, or report details in analytics.
- Hash or pseudonymize rate-limit and safety identifiers; rotate salts deliberately.
- Strip unnecessary object metadata and file names.
- Use TLS, encrypted provider storage, least privilege, access logging, and separate staging/production resources.
- Signed URLs are capabilities: short-lived, scoped, omitted from logs/referrers where possible.
- Prevent indexing of private/unlisted pages and avoid personal data in Open Graph metadata.
- Define processor settings and whether provider data is stored; align code and public policy.
- Run a data-protection impact review before launching public voice profiles or youth access.

## Security incident basics

For suspected key, audio, account, or billing exposure:

1. Contain: revoke keys/sessions/URLs and disable the affected path.
2. Preserve minimal forensic evidence with access controls.
3. Determine data types, people, duration, and environments affected.
4. Notify security, privacy/legal, providers, and users/regulators as required.
5. Restore from known-safe configuration.
6. document root cause, decisions, timeline, and prevention owners.

Maintain an out-of-band contact list and provider account recovery path. Do not store the only incident instructions inside a potentially inaccessible product.

## Accessibility target

Target WCAG 2.2 AA for all customer and staff-critical flows.

### Keyboard and focus

- Every action works by keyboard without timing traps.
- Use native controls where possible.
- Provide a persistent, high-contrast focus indicator.
- Move focus to the new page/state heading after navigation and to actionable error summary after failure.
- Dialogs trap focus, close predictably, and restore focus to their trigger.
- Do not make Space shortcuts fire while a button, input, or other control owns the key.

### Screen readers and status

- One logical heading structure per view.
- Prompt and energy are real text, not rasterized into images.
- Recording state, elapsed time, upload, audio judgment, success, and error use restrained live regions.
- Waveforms and score rings have concise text equivalents.
- Dimension scores include label, value, and scale.
- Decorative confetti, meters, and icons are hidden from accessibility APIs.
- Share cards have generated alt text that states prompt title/summary, overall score, dimensions, and verdict without exposing private content.

### Visual

- Text and interactive controls meet contrast requirements in every state.
- Color never carries recording, pass/fail, plan, or rank meaning alone.
- Layout supports 200% zoom and reflow down to 320 CSS pixels without lost actions.
- Touch targets are at least 44×44 CSS pixels where practical and never below WCAG minimum.
- Avoid rapid flashes, visual noise behind text, and parallax.
- Provide reduced-motion behavior for countdowns, score reveals, streak effects, and confetti.

### Audio

- Microphone level has a textual equivalent: too quiet, good, clipping.
- All sound effects have a visible equivalent and global mute.
- Playback has play/pause, elapsed/total time, seek where supported, volume, and accessible labels.
- Do not autoplay user recordings.
- If a recording contains multiple people or material needed for support review, provide a transcript where safe and useful.
- Device-selection/help copy uses plain language and does not assume one browser.

### Alternatives and accommodation

Core ranked play legitimately depends on voice input, but the rest of the product—browsing, profiles, reacting, reporting, settings, billing, and deleting data—must not. Provide:

- a practice/demo result path without publication or ranking
- text access to every prompt, energy, score, and verdict
- no speed bonus for operating the interface
- retry for audio interpretation uncertainty
- a clear support route for speech-access needs

Do not claim that a text-only practice result is comparable to a voice-ranked score.

## Accessibility QA

For every release:

- keyboard-only pass in Chrome/Firefox/Safari equivalents
- NVDA + Chrome on Windows and VoiceOver + Safari on iOS/macOS for the core flow
- 200% zoom and 320 px reflow
- light sensitivity/reduced motion
- Windows high-contrast/forced colors
- permission denied, no microphone, device switch, silence, clipping, slow upload
- captions/transcript/labels on result and share surfaces
- axe or equivalent automated scan, with manual review because automation is incomplete

Any blocker preventing record, submit, result, report, billing, privacy, or deletion is release-stopping.

## Youth and legal launch gate

Choose and enforce a minimum age before public launch. If minors are allowed, obtain specialized counsel and implement the required consent, discovery, messaging/challenge, retention, advertising, and safety controls before admitting them. Until that work is complete, do not market Delivery as child-directed.

Before launch, counsel must review:

- Terms, Privacy Notice, Community Guidelines, and content license
- biometric/voice-data treatment by jurisdiction
- publicity, voice likeness, copyright, and trademark risks
- recording consent laws
- consumer subscription disclosures and cancellation
- age assurance/consent
- moderation and illegal-content reporting obligations
- sweepstakes/prize rules if leaderboards ever award value
