# Product, information architecture, and user flows

## Product promise

Delivery turns one sentence and one emotional direction into a tiny performance worth watching. A new visitor should understand the game in three seconds, record within twenty seconds, and reach a result with an obvious next move.

The game is not karaoke, voice imitation software, or a generic AI score. It is a comic performance ritual:

> Get the line. Find the energy. Commit.

The product succeeds when the performer laughs before seeing the score, the verdict feels specific enough to quote, and a friend understands the shared result without opening the app.

## Experience principles

1. **Play before paperwork.** Guests can complete a first round. Ask for an account only when it saves something valuable: history, streak, challenge identity, or publication.
2. **The prompt is a stage direction.** One line plus one energy is the entire creative constraint. Do not bury it in instructions.
3. **Commitment beats polish.** The visual language rewards nerve, surprise, and repeat attempts—not vocal talent or resemblance to a protected person.
4. **Judgment is a show.** Reveal signal, suspense, score, verdict, and reward in a compact sequence that can be skipped for repeat players.
5. **Every result has an exit ramp.** Run it back, draw another, challenge someone, or share. No dead-end dashboards.
6. **Culture moves; the product voice does not chase.** Trend modules expire. Core tone, original prompts, and evergreen packs carry the game.
7. **The joke never punches down.** Funny feedback critiques the performance, not identity, appearance, disability, accent, or speech difference.

## Retention and sharing system

These mechanisms add repeat play without turning Delivery into a grind:

- **Launch — Director's Note:** every judgment includes a specific coach note for the next take.
- **Launch — Receipt:** a compact, quotable verdict and score card is ready for native sharing or download.
- **Launch — Crowd Temperature:** reactions use stage language—fire, crying, skull, aura, and committed—rather than a generic like.
- **Launch — Cold Open:** anyone can practice the Daily, while a clear pre-recording prompt asks guests to sign in before submitting if they want the ranked receipt and streak.
- **Launch — Rivalry receipt:** completed friend challenges reveal both performances together instead of creating a winner-only dead end.
- **Launch — Chaos Insurance:** the first successfully saved Daily score is permanently ranked; later takes are pressure-free practice and never overwrite it.
- **Exploration — Energy Debt:** a future Hot Streak extension may stack carry-over constraints after the session model has a durable server boundary.
- **Exploration — Split Decision:** a future result could compare AI judgment with anonymized community response once vote quality is calibrated.
- **Exploration — Audience Meter:** direct chat aggregation remains out of launch scope; Stream Mode uses a creator-operated, constrained vote overlay.

## Modes

| Mode | Session shape | Distinctive rule | Primary next action |
| --- | --- | --- | --- |
| Classic | One prompt, one submitted take | Balanced line/energy pool | One more round |
| Daily | Same prompt for everyone per UTC content day | First signed-in saved score is ranked; later takes are practice | Share rank |
| Hot Streak | Consecutive rounds in the current session | A 70+ score extends the run; a lower score resets it | Continue |
| Impossible Energy | Extreme or contradictory directions | Chaos weighting increases; safety rules do not relax | Challenge a friend |
| Challenge | Sender fixes line and energy | Signed-in recipient sees the dual receipt only after submitting | Rivalry card |
| Stream | Creator-controlled stage | Clean display, keyboard control, and an on-screen three-option vote overlay | Next contestant |

## Information architecture

### Public

- `/` — landing page and immediate Play entry
- `/play` — Classic prompt and recording flow
- `/daily` — today's global challenge
- `/discover` and `/discover/[packId]` — discovery and pack detail
- `/leaderboard` — daily, weekly, all-time, commitment, chaos
- `/feed` — curated public deliveries and reactions
- `/challenge/[code]` — invitation landing and response flow
- `/d/[id]` — share/result page with privacy-safe metadata
- `/u/[handle]` — public profile
- `/stream/stage` — creator stage with clean-view and vote controls
- `/pricing` — Free and Pro comparison
- `/guidelines`, `/privacy`, `/terms` — policy surfaces

### Authenticated

- `/profile` — private history, favorites, stats, and canonical earned badges
- `/challenge` — create a signed, expiring two-player challenge
- `/submit` — submit an original line to the review queue
- `/settings` — account, microphone, notifications, privacy, blocked users, data controls
- `/settings` — subscription state and Stripe portal entry
- `/stream` — creator setup for the keyboard-controlled stage

### Staff operations

`/moderation` is the protected launch review room for report triage, target inspection,
containment, and auditable decisions. Its API verifies the signed-in profile&apos;s
`moderator` or `admin` role on the server before any service-owned read or mutation;
navigation visibility is never authorization. Content scheduling and trend slots
remain protected Supabase operations owned by trained staff.

## Core gameplay state machine

```text
PROMPT_READY
  ├─ record ─> REQUESTING_PERMISSION
  │              ├─ granted ─> RECORDING
  │              └─ denied  ─> PERMISSION_HELP
  └─ redraw ─> PROMPT_READY

RECORDING
  ├─ stop/limit ─> REVIEW_TAKE
  └─ device error ─> RECORDER_ERROR

REVIEW_TAKE
  ├─ retake ─> RECORDING
  └─ submit ─> UPLOADING ─> LISTENING + JUDGING ─> RESULT

RESULT
  ├─ retry same ─> PROMPT_READY(same prompt)
  ├─ next ─> PROMPT_READY(new prompt)
  ├─ challenge ─> CHALLENGE_CREATED
  └─ share ─> SHARE_READY
```

The UI should name the human action, not the backend stage. “Listening back,” “Reading the room,” and “The judges are fighting” may rotate as display copy, while accessible status text remains literal.

## First-play flow

1. Landing hero presents a live prompt card and a single `Play now` action.
2. The play page preloads a safe prompt; no account gate and no modal.
3. The user taps the microphone. Permission is requested in direct response to that gesture.
4. A three-beat countdown is optional and remembered. Recording shows elapsed time, waveform, input level, cancel, and stop.
5. Review includes immediate playback, retake count, duration, and `Send to the judges`.
6. Submission shows progressive status and never encourages duplicate taps.
7. Result reveals overall score, four dimensions, verdict, receipt, director's note, and earned badge.
8. Primary action is `One more`. Share and challenge remain visible; saving/history asks a guest to create an account without discarding the completed result.

Performance targets:

- Landing interaction ready under 2.5 seconds at the p75 mobile field percentile
- Prompt to recording start in two taps or fewer
- Recorder feedback within 100 ms of input
- Local playback available without a network round trip
- Submitted result p50 under 6 seconds and p95 under 15 seconds, monitored by stage

## Recording interaction contract

- Capture microphone samples with Web Audio, encode bounded PCM WAV in-browser, and report the exact WAV MIME type; server-validated MP3 remains an explicit upload compatibility path.
- Cap a take by duration and encoded bytes on both client and server.
- Keep unsent audio in memory or ephemeral browser storage only.
- Show a clear input-level check before the first take and actionable help for silence, clipping, device loss, and permission denial.
- Pause background audio while recording and restore it afterward.
- Do not auto-start microphone capture, record in the background, or retain discarded takes.
- If the page loses focus, preserve recording only when browser behavior is reliable; otherwise stop safely and explain.
- Keyboard: Space starts/stops when focus is not in an interactive field; Escape cancels with confirmation; all controls have visible focus and accessible names.

## Result choreography

The dopamine sequence should take roughly 1.8 seconds on first view and be fully reducible:

1. The waveform snaps into the score ring.
2. Overall score counts quickly to its final value.
3. Dimension bars land with small timing offsets.
4. Verdict and receipt enter together.
5. Badge/confetti appears only for meaningful thresholds.

Respect `prefers-reduced-motion` by replacing transforms, flashes, and counting animation with a single crossfade or immediate state. Never hide the score behind a mandatory animation.

Score language:

- 0–39: the bit did not land; feedback stays playful and offers a clear retry
- 40–59: signs of life
- 60–74: committed
- 75–89: certified delivery
- 90–97: main-character event
- 98–100: reserved for exceptionally strong evidence; never random or purchasable

Dimension labels are Commitment, Comedy, Accuracy, and Chaos. Accuracy evaluates the supplied text and requested energy—not similarity to a celebrity or protected person's voice.

## Challenge flow

1. Authenticated sender chooses a prompt/energy or uses the just-played result.
2. Server creates an opaque, expiring invite code with optional max redemptions.
3. Recipient preview contains the line, energy, sender handle, expiry, and safety/report controls—never the sender's score before submission.
4. Recipient signs in so the response can be bound to the two-player matchup, then records the locked line.
5. Once submitted, both see a dual scorecard and can rematch.
6. If either delivery is private or removed, the rivalry card degrades gracefully and no audio URL leaks.

Avoid importing contact lists at launch. Native share sheets and copied links provide lower-friction, lower-risk distribution.

## Daily Challenge rules

- A “content day” is keyed by UTC date, with the user's local reset time shown explicitly.
- Editorial staff schedule at least fourteen days ahead, with a safe fallback prompt for every day.
- One ranked result per signed-in account, UTC date, and surfaced market; additional plays are unranked practice.
- The first successfully saved result is immutable. Deleting its recording leaves an internal claim tombstone, so delete-and-resubmit cannot reroll the rank.
- Tie-break: overall score, then commitment, then earliest completion.
- Daily boards freeze after a documented late-arrival window so delayed jobs cannot reshuffle old results indefinitely.
- A streak advances on a valid submission, not on publication.

## Hot Streak rules

- The player has one active run.
- Each completed judgment advances the round; abandoned or failed technical submissions do not.
- A score of 70 or higher advances the hot streak; a lower result resets it.
- Round count, session best, and hot streak are intentionally session-local in the current launch build.
- Difficulty affects prompts and target score, not moderation thresholds.

## Stream Mode

Host view:

- Large prompt, timer, recording controls, reroll, fullscreen, optional clean stage, and manual energy-vote overlay
- Browser-source layout with transparent or chroma-safe background
- Audio-monitoring choice that defaults off to prevent feedback
- Moderator role that can remove queue items without billing/admin access

Spectator view:

- The launch stage does not ingest platform chat or anonymous audience messages.
- The creator manually opens a three-option energy vote and locks a winner with
  keyboard controls.
- No raw chat text, usernames, or third-party credentials render on the broadcast
  surface.
- Public delivery reactions remain predefined and signed-in; serious public-content
  reports do not require an account.

Stream Mode is not permission to rebroadcast a participant. Host onboarding must confirm participant consent and platform compliance.

## Profiles and progression

Public profile:

- Handle, display name, avatar, short bio
- Best public deliveries and curated pinned trio
- Visible stats chosen by the user
- Badges with plain-language unlock conditions
- Follow/unfollow, challenge, report, and symmetric block controls with private-profile
  visibility enforced by the server

Private dashboard:

- Full history, drafts, removed/private entries, favorites
- Personal score trends with a clear “entertainment, not objective ability” label
- Download data, delete account, privacy defaults, blocked users

Suggested badges:

- First Take — publish without a retake
- Director's Cut — improve the same prompt by 15+
- No Notes — score 80+ in every dimension
- Controlled Burn — 90+ Commitment with Chaos below 40
- Lost the Plot — 95+ Chaos
- Daily Bread — complete seven daily challenges
- Rival Material — complete five mutual challenges

Progression never boosts judging scores, ranking weights, or moderation outcomes.

## Design system

### Brand

Delivery should resemble a pirate game-show signal, not a neon SaaS dashboard. The logo is a compressed wordmark with the final “Y” behaving like a microphone cable/checkmark. The signature motion is a hard cut followed by one elastic overshoot.

### Tokens

| Role | Token | Intent |
| --- | --- | --- |
| Canvas | `ink-950` | Near-black blue, never pure black |
| Surface | `ink-900` / `ink-850` | Layered stage panels |
| Primary | `acid-400` | Electric chartreuse for play and success |
| Secondary | `shock-500` | Hot magenta for chaos and live states |
| Accent | `signal-400` | Cyan for links, timing, and accuracy |
| Warning | `heat-400` | Orange for limits and streak risk |
| Danger | `redline-500` | Destructive actions and recording failure |
| Text | `paper-50` / `paper-300` | High/secondary contrast |

Use one display face with compressed, loud forms and one highly readable UI face. Numeric scores use tabular figures. The accessibility fallback is always layout-safe if a web font fails.

### Component language

- Prompt cards feel physical: heavy border, corner index, pack stamp, energy strip.
- Recording control is a large circular target with explicit text; color is never the only state.
- Score rings are supported by numeric text and a four-row breakdown.
- Buttons use verb-first labels and one dominant action per view.
- Toasts acknowledge reversible background actions; errors stay near the control that can resolve them.
- Skeletons mirror final dimensions to prevent layout shift.

### Motion and sound

- 90–160 ms for direct manipulation, 180–260 ms for state changes, up to 900 ms for celebratory sequences
- No repeated idle movement on reading surfaces
- Sound defaults on only after an explicit interaction, has a persistent mute, and never conveys exclusive information
- Haptics, where available, are brief and optional

## Empty, loading, and error standards

Every screen needs a purposeful state:

- Empty history: offer the first prompt
- Empty leaderboard: explain when entries appear and link to Daily
- Empty challenge inbox: create a challenge, not “nothing here”
- Removed delivery: preserve surrounding context without verdict, media, or identity leakage
- Offline before recording: allow prompt and local take, but explain that judgment needs connection
- Upload interruption: retry the same idempotency key; never create duplicate public deliveries
- AI failure: preserve the take privately for a bounded retry window or let the user download/delete it
- Stripe unavailable: do not alter entitlement; offer retry and Portal only when known safe

## Product health measures

The north-star pair is:

- **Weekly performers:** unique people who submit at least one valid round
- **Share-to-play coefficient:** new play sessions attributable to shared delivery/challenge links per share

Guardrails:

- p95 time to result
- judgment failure and fallback rate
- microphone permission denial rate
- report rate per 1,000 public views
- moderation response time
- share unpublish/delete completion time
- day-1 and day-7 performer retention
- repeated-score calibration drift across accents, devices, and environments
