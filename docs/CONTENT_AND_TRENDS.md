# Content, seeding, and trend operations

## Editorial goal

Delivery needs enough recognizable energy to feel culturally awake and enough original material to remain ownable, safe, and useful after a trend expires. The library is a programmed comedy system—not a scraped quote database.

The unit of play is:

```text
LINE + ENERGY + CONTEXT TAGS + SAFETY/RIGHTS METADATA
```

A line should be speakable in one breath, legible on a phone, and capable of changing meaning under multiple energies. An energy should produce a playable acting choice, not merely add an adjective.

## Repository baseline and commercial launch target

The checked-in catalog currently provides **120 original prompts, 48 energy modifiers, and 12 packs**. It is enough to exercise every content surface and gives a safe, rights-conscious baseline. Before a sustained commercial campaign, expand and review it to at least:

- 400 approved lines
- 120 approved energies
- 12 evergreen packs with 24–50 lines each (expand the existing packs before adding empty rails)
- 4 high-difficulty Impossible Energy collections
- 30 scheduled Daily Challenges plus 14 emergency fallbacks
- 3 launch-week trend slots and 1 empty rollback slot
- 60 calibrated line-energy pairs spanning difficulty, length, device, accent, and performance style for AI evaluation

No pack should feel like filler. If the editorial team cannot write three meaningfully different energy pairings for a line, the line is weak.

## Launch pack slate

| Pack | Promise | Example *original* line | Notes |
| --- | --- | --- | --- |
| Group Chat Court | Messages that require an immediate defense | “Before anyone overreacts, the lamp was already making that noise.” | Broad, safe default |
| Main Character Maintenance | Unreasonable confidence in ordinary moments | “I did not miss the bus. The bus missed its cue.” | Highly shareable |
| Customer Service Final Boss | Polite language under spiritual pressure | “Thank you for your patience; it has now exceeded mine.” | Workplace-safe |
| Patch Notes for My Life | Game language for personal disasters | “Fixed an issue where I believed in the plan.” | Gaming-adjacent, original |
| Anime Adjacent | Huge stakes without copied franchise dialogue | “If the prophecy wanted punctuality, it should have texted.” | No character imitation |
| Cinema in the Kitchen | Trailer-scale drama over tiny tasks | “Tonight, one container learns it was never dishwasher safe.” | Physical comedy |
| NPC With Benefits | Background-character logic gains confidence | “My route is blocked by a chair, so the quest is canceled.” | Internet-native |
| Terms & Conditions | Formal threats with absurd subject matter | “By opening this snack, you acknowledge the consequences.” | Great for deadpan |
| Villain HR | Evil plans meet corporate process | “The volcano launch is pending one final stakeholder.” | Stream-friendly |
| Aura Bankruptcy | Confidence leaves the body | “I waved back. It was not for me. We rebuild.” | Relatable |
| Family Function Lore | Tiny remarks with generational consequences | “No, keep the recipe secret. It tastes nervous.” | Avoid stereotype |
| Extremely Normal News | Anchors report obvious chaos | “Local man discovers the mute button after the meeting.” | Duo/stream potential |

“Movie,” “anime,” “game,” “meme,” and “streamer” discovery labels should initially route to original genre-play and licensed/editor-approved material. Do not commercially ship copied dialogue, attributed creator quotes, voice-clone instructions, or material implying endorsement without rights review.

## Energy taxonomy

Energy is structured along independent axes:

- **Status:** monarch, substitute teacher, intern with leverage, final boss, suspicious narrator
- **Emotional engine:** barely contained joy, offended calm, doomed confidence, fake sincerity, unwanted enlightenment
- **Situation:** lying to the police, announcing a delay, reading a prophecy, leaving a voice note, addressing the council
- **Delivery mechanic:** whisper, one breath, escalating, too slowly, no consonants lost, dramatic pause
- **Contradiction:** furious lullaby, triumphant apology, seductive weather alert, sincere supervillain
- **Intensity:** 1–5
- **Difficulty:** 1–5
- **Safety tier:** all-ages, teen, mature opt-in

Good energies:

- “Like a defeated final boss asking for a receipt”
- “With maximum aura and minimum evidence”
- “As if the group chat has entered the courtroom”
- “Calmly, while the plan becomes visibly worse”
- “Like an NPC who just became self-aware”
- “As a weather alert for one specific person”

Avoid:

- Vague instructions such as “funny” or “crazy”
- Prompts that mock accents, disabilities, speech patterns, mental illness, or protected identities
- Instructions to imitate a living person's distinctive voice
- Sexualized minor-coded contexts
- Situations that normalize threats, self-harm, targeted harassment, or dangerous acts

## Content record

Every line and energy needs:

- stable ID and slug
- display text
- normalized text/hash for duplicate detection
- language and locale suitability
- category and search tags
- length/difficulty/intensity
- safety tier and sensitive-topic flags
- eligible modes
- editorial status
- provenance and author
- rights status: original, licensed, public domain, approved reference, blocked
- valid-from/to dates
- review owner and review timestamp
- optional pronunciation/domain hints
- pairing allow/deny rules
- calibration notes

No content reaches users from a raw text file, submission row, social scrape, or AI generation without the same validation and editorial states.

## Lifecycle

```text
idea
  → drafted
  → automated checks
  → editorial review
  → safety/rights review
  → calibrated
  → scheduled
  → live
  → cooled
  → retired
```

- **Drafted:** editable, invisible.
- **Automated checks:** duplicate hash, length, language, obvious policy categories, banned entities/terms.
- **Editorial review:** playability, originality, voice, pair variety.
- **Safety/rights review:** provenance, protected-person risk, content tier, platform suitability.
- **Calibrated:** internal recordings confirm that the line produces score variation and the judge interprets it consistently.
- **Scheduled/live:** immutable text for ranked use; corrections create a new version.
- **Cooled:** removed from trend surfaces but still playable where rights permit.
- **Retired:** cannot be newly drawn; historic delivery records retain a safe snapshot where legally permitted.

## Seeding plan

### Stage 1: foundations

1. Define the pack, line, energy, and pair-rule schemas.
2. Add protected slugs and immutable IDs.
3. Seed a minimal fallback pack and at least twenty safe energies.
4. Verify that the application can run from fallback data if the editorial query fails.

### Stage 2: launch library

1. Assign pack owners and quotas from the launch slate.
2. Write lines in batches of 20, then test each against at least three energies.
3. Reject close paraphrases and proper-name dependence.
4. Run duplicate, length, blocked-term, and rights-status validators.
5. Complete two-person editorial/safety review.
6. Import idempotently by stable ID; rerunning the seed must update permitted metadata without duplicating rows.

### Stage 3: calibration

1. Record intentionally low, medium, and high commitment examples.
2. Include quiet rooms, ordinary phone microphones, background noise, varied speech rates, accents, and non-native English speakers.
3. Compare transcript accuracy, unusable-audio rate, score spread, and verdict appropriateness.
4. Flag prompts whose meaning depends on pronunciation or culturally narrow context.
5. Store only consented calibration recordings with a documented retention period.

### Stage 4: scheduling

1. Program thirty Daily Challenges.
2. Avoid consecutive days with the same pack, emotional engine, difficulty, or long line.
3. Schedule weekend prompts for group/stream play and weekday prompts for fast solo play.
4. Define the fallback chain: scheduled pair → approved pack fallback → universal safe fallback.
5. Preview every daily card, recorder wrap, result receipt, and share card at smallest supported width.

For the database-backed global fallback horizon, run after the reviewed catalog seed:

```sql
select public.ensure_daily_challenge(current_date + day_offset, 'global')
from generate_series(0, 29) as horizon(day_offset);
```

The function is deterministic and idempotent for a date/market. Editors may replace future rows with specifically reviewed pairs before their content day. Run the rolling horizon from a protected scheduled job; do not expose this function to an unauthenticated browser.

### Stage 5: post-launch replenishment

- Add 25–40 evergreen lines and 12–20 energies monthly.
- Refresh one pack art/copy surface without rewriting historic prompt versions.
- Review low-completion and high-skip content weekly.
- Retire content based on rights, safety, poor playability, or fatigue—not merely age.

## Seed quality gates

A content import fails if:

- stable ID, pack, text, language, rights status, or safety tier is missing
- text is outside the configured character/word range
- normalized duplicate exists without an explicit version relationship
- a scheduled item lacks valid dates, owner, fallback, or approval
- user-generated provenance is marked original without recorded consent assertion
- a trend item lacks an expiry
- a mature item can appear in the safe-default pool
- an energy instructs protected-person voice imitation or targets a protected class
- a daily date is duplicated

The CI content validator should print file/record IDs and reason codes, never secret editorial notes.

## Trend engine

### Design

Trends are a thin, expiring programming layer over approved content. A trend slot references existing versioned content or a newly approved trend pack; it does not inject arbitrary scraped text at request time.

Each slot has:

- placement: home, prompt draw, pack rail, daily candidate, stream
- locale and audience tier
- priority and traffic percentage
- start/end in UTC
- rationale and source links stored in the editorial system
- rights/safety owner
- primary content and evergreen fallback
- kill switch

The resolver evaluates active slots, eligibility, entitlements, cooldown, and experiment assignment, then returns a normal prompt object. Expired or killed slots fall through to evergreen selection without a deploy.

### Culture desk cadence

**Daily, 20 minutes**

- Scan first-party trend signals: in-product searches, skips, shares, challenge reuse, and report spikes.
- Review public cultural signals manually; do not auto-ingest posts or quotes.
- Decide whether the moment is playable, legible, rights-safe, and likely to survive the editorial lead time.
- Update/cancel scheduled slots and verify fallback.

**Twice weekly**

- Pitch three trend concepts expressed as original lines/energies.
- Run editorial and safety review.
- Calibrate one representative pair.
- Schedule with a 24–72 hour expiry unless the item proves evergreen.

**Weekly retrospective**

- Compare impression → record → submit → share by slot.
- Inspect skip, report, block, and negative-feedback rates.
- Promote durable mechanics into evergreen packs; retire proper-noun-dependent copy.

### Trend decision rubric

Score 0–2 each:

- instantly legible
- playable aloud
- transforms under multiple energies
- original/rights-clear
- safe across intended audience
- likely relevant when published
- adds something not already in the library

A concept under 10/14 does not receive a trend slot. Any rights or safety hard stop overrides the score.

## User submissions

Submission form:

- one line only, bounded length
- optional category suggestion
- required confirmation that the submitter has the right to share it
- explicit ban on private information, targeted abuse, copied copyrighted dialogue, and nonconsensual personal content
- clear notice that submission is not publication and may be edited or declined

Pipeline:

1. Normalize and hash for duplicates.
2. Run automated text safety classification.
3. Match blocked entities/patterns and privacy indicators.
4. Quarantine high-risk items; do not display them back in public activity.
5. Human editor reviews playability, originality, context, and safety.
6. Material edits create an editorial version; keep attribution only if opted in and approved.
7. Accepted content enters calibration before scheduling.
8. Notify submitter with a neutral status; rejection details do not reveal detection rules.

Never use submission volume as an unreviewed “trending” feed.

## Moderation of prompts

Pre-publication filters are defense in depth, not final authority:

- automated harm categories
- profanity/safety-tier routing
- personal data patterns
- duplicate/copy similarity
- public figure/protected-person imitation cues
- slur and dog-whistle review with context
- self-harm, weapon, illegal-act, and dangerous-challenge patterns
- sexual/minor-coded content
- targeted individual handles/names

False positives go to human review. A pass does not guarantee publication.

## Rights and attribution

For each non-original reference, record:

- source and date
- exact material used
- creator/rightsholder
- license or permission basis
- territory/platform/term limitations
- attribution requirement
- takedown contact and expiration

Avoid an “everyone knows it” exception. Memes and streamer catchphrases can still involve copyright, trademark, publicity, platform, or endorsement risk. Product/legal review decides publication; editorial enthusiasm does not.

## Content metrics

Measure by line, energy, pair, pack, slot, locale, mode, and content version:

- impressions and prompt skips
- record-start and submission conversion
- retake rate
- unusable-audio rate
- score distribution and confidence
- verdict regeneration/schema failure
- next-round, challenge, save, and share rates
- public-view completion and reactions
- report/block/unpublish rates
- seven- and thirty-day fatigue

Do not optimize only for share rate. A high-share prompt with disproportionate reports, exclusion, or calibration drift is unhealthy.

## Emergency operations

Reasons to kill content immediately:

- breaking event changes the meaning into harm or harassment
- rights complaint
- personal/private information
- exploit or encoded abuse
- severe moderation/report spike
- model behavior makes the prompt unsafe

Response:

1. Activate the slot/line kill switch.
2. Invalidate prompt and share caches.
3. Stop new draws and ranked eligibility.
4. Quarantine affected public deliveries if necessary; preserve appeal/audit data.
5. Replace scheduled Daily content with its approved fallback.
6. Notify support/moderation owner and record timeline.
7. Decide whether historic result cards need unpublication or copy replacement.
8. Complete a blameless review and add a prevention test.

The kill path must not require a code deploy.
