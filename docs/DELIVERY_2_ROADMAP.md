# Delivery 2.0 — product goal, roadmap, and implementation workflow

Current execution — September 6, 2026: **Switch is implemented and deployed in solo play, direct friend challenges, private rounds, and community hosting.** It uses one uninterrupted 20-second recording and the same short phrase across five emoji/emotion or relative-speed cues. Eight curated challenges ship: four emotion and four speed. Immutable challenge snapshots keep recording, the separate audio-based beta judge, saved replay, host preview, and broadcast cues consistent. Switch remains unranked; casual equivalent-challenge comparisons stay separate from Classic, Say It Back, and audience winners. See [SWITCH_HANDOFF.md](SWITCH_HANDOFF.md) and [PR #5](https://github.com/chrisA-cyber/Delivery/pull/5) for publication and verification.

Railway is the playable application, and Netlify preserves paths and queries when redirecting there. The owner confirmed real sign-in works. Physical phone capture and audible OBS playback remain brief owner acceptance checks; human score calibration is unproven. Conservative evaluation accounting is **$2.675 of the original $5 cap**, including a $1 reservation for two bounded Switch tests; actual provider billing is not yet reconciled. No new recurring resources were added. Video exports, optional cameras, private live Stage, tournaments, and another hosting system were excluded from this assignment.

Classic, Say It Back, private asynchronous groups, community rounds, and Switch are implemented. The owner's current authorization covers implementation, additive migrations, Git publication, merging after checks, and deployment within existing resources. The earlier baselines, gates, and proposed expansions below are historical planning context; they do not reopen completed work or override the current scope.

**Historical implementation baselines**

Historical implementation baseline: `chrisA-cyber/Delivery`, `main`, commit `c74baddcc93783490ec636291cc5b03397bdaa7b`, fetched September 6, 2026. Step 1B is committed and its [handoff](CLASSIC_STEP_1B_HANDOFF.md), [independent review](CLASSIC_STEP_1B_REVIEW.md), and recorded evidence have been read. Step 1C changes and validation boundaries are recorded in [CLASSIC_STEP_1C_HANDOFF.md](CLASSIC_STEP_1C_HANDOFF.md). Later tasks must fetch the current branch rather than assume this snapshot remains current.

Step 1B completed the content/UI implementation: 86 active lines, 36 directions, six packs, historical identity preservation, a separate Scribe companion transcript, and a ready human-playtest kit. Its recorded evidence includes 517 database assertions in PostgreSQL WASM and 11 live synthetic Scribe requests; neither establishes full Supabase HTTP integration or live OpenAI judging. Human enjoyment, judging calibration, and real-device behavior remain unvalidated. Do not repeat the catalog redesign or treat those external gates as passed.

Historical Step 1D fetched main and draft PR #1 on September 6: main remains `c74badd`, and the Step 1C branch remains `a335034`. Its existing Netlify preview opens, but `/api/health` returns `503 SERVER_NOT_CONFIGURED`. No disposable Supabase runtime, configured local provider key, approved evaluation budget, or consented samples were available. No new mocked tests or paid calls were run. The [Step 1D handoff](CLASSIC_STEP_1D_HANDOFF.md) records the working preview, exact setup commands, and a **blocked** decision pending live judging, connected persistence/access, and the first owner session. At that historical gate, Say It Back was deferred rather than substituting repeated audits for those observations; later handoffs record its completed implementation.

Historical connected-environment follow-up created the approved $0/month `delivery-classic-test` Supabase project and applied/verified all 17 existing migrations plus seed. The isolated Railway preview was running with native Redis and owner-configured private credentials. Three real OpenAI judgments of stock synthetic voices verified literal accuracy (100 for the correct line, 70 for changed words), guest quota progression and idempotent replay. Positive feedback with very low performance numbers exposed possible scale ambiguity; rubric v1.2 clarifies the existing 0–100 contract without rescaling history or changing weights. One authorized follow-up confirmed the deployed v1.2 rubric: 70 overall, 100 accuracy, 3.827 seconds, with specific quiet-direction coaching. The original WAV expired; regenerated audio differs, so this is not an identical-audio before/after comparison or proof of calibration. At that checkpoint, feedback stability and signed-in save/playback remained unverified. [CLASSIC_RAILWAY_HANDOFF.md](CLASSIC_RAILWAY_HANDOFF.md) records that earlier release; the current completion section supersedes its starting status. Human playtesting remains a launch limitation and does not by itself prohibit next-mode development; assess demonstrated shared-flow failures separately.

Product context: [shared Delivery conversation](https://chatgpt.com/share/6a9ac69e-3ad4-83ea-93b3-c584a64e1d66). Earlier feature lists, completion percentages, infrastructure estimates, and model comparisons are discussion context, not verified engineering results or commitments.

**Product goal**

Delivery is a social performance game with several comfortable ways to participate: perform with voice or optional camera, choose directions, guess, react, or judge with friends. Its shipped games are Classic, Say It Back, and Switch; optional camera and finished clip exports remain future possibilities. Players receive understandable feedback, improve their skills, invite groups, and join streamer-led sessions. A completed performance can become a finished, shareable clip that invites someone else to play the same challenge.

The desired user journey is discovery → immediate play → satisfying result → voluntary retry or friend challenge → a reason to return on another day. Social clips provide distribution. Skill, competition, relationships, and well-designed new challenges provide reasons to stay.

The eventual product should support the sentence: “Get on Delivery tonight.” It should also be enjoyable when a player arrives alone and nobody else is online.

Confirmed priorities: excellent solo play, easy invitations to groups, and streamer-friendly sessions. Camera-free play is a first-release requirement. The user expanded the original solo/friend audience on September 5 and explicitly requested that the original game and the site's look and feel be reworked at the beginning. Initial language, age policy, launch regions, device priorities, release date, and operating budget remain open decisions. No claim of market demand or retention is established yet.

**The complete product vision**

| Layer | Player value | Candidate experiences |
| --- | --- | --- |
| Quick play | Enjoy a challenge immediately; practice and improve | Classic, Say It Back, and unranked Switch; Daily across supported modes; Speed/Rush and Gauntlet later |
| Competition | Compare fairly, rematch, and develop rivalries | Friend challenges, asynchronous Duels, personal bests, mode-specific ratings, later live Face-Off |
| Social play | Join friends or a creator with a comfortable participation role | Early private group challenges, host-led sessions, cue voting and reactions; later private Stage, Pass the Mic, elimination and team formats |
| Creation | Make challenges and host recurring experiences | Validated challenge builder, remixes, creator challenges, hosted rooms, themed playlists |
| Distribution | Turn an attempt into an invitation | Vertical replays, synchronized directions and captions, score explanations, challenge links |
| Ongoing progression | Have meaningful reasons to return | Mastery, personal records, Daily, rivals, later seasons and cosmetics |

Do not treat every candidate as a launch requirement. Don't Break, One Take/Scene, public stranger matching, and music rounds need separate rules and feasibility work. The original Roast-Off idea remains a separate concept. Native mobile and desktop clients remain later distribution options.

**The first product we are building**

Classic remains a principal game: one compelling line, one clear direction, a short performance, an entertaining and useful result, and an immediate retry or invitation. The user explicitly rejected the existing speaking prompts as too lame. Overhauling the content is a core first-phase deliverable: funny, unhinged, inappropriate internet humor alongside recognizable meme phrases and curated streamer/influencer clip quotes. Rework pairing rules, preparation, recording feedback, judging, result choreography, and replay around that content. Quiet or deadpan performances can still deliver outrageous material; comedy and chaos should not mechanically dominate the score for every direction. Retain valuable existing systems while checking that their actual behavior supports the new experience.

**Classic content direction — confirmed September 5**

The target feeling is “I know that clip” or “I cannot believe I have to say this.” Favor lines that a player wants to read aloud and immediately send to a friend. The existing catalog is material to reassess, not the standard the new catalog must imitate.

Build a curated mix of:

- Funny, absurd, unhinged original lines, including profanity and inappropriate/adult humor where the selected audience and content settings allow it.
- Widely recognizable internet phrases, meme formats, and familiar punchlines whose appeal survives outside a tiny niche.
- Streamer and online-creator clip quotes with a strong performance hook and traceable source.
- Contrasting delivery directions that create a second joke: an outrageous boast as a tearful apology, a furious line whispered politely, or a ridiculous confession delivered with complete sincerity.

Recognizability and performance value both matter. Avoid filling the catalog with generic office jokes, random absurdity without a punchline, stale references, or obscure quotations presented as universally known. Do not copy a creator's name onto an invented quotation or require impersonation of their voice to score well. Accept distinct funny interpretations of the requested direction.

For real quotes and current trends, the implementation/content assignment must research the actual clip or primary source, verify wording and attribution, record why it is recognizable to the target audience, and track publication eligibility. Attribution alone does not establish permission to reproduce a clip or quotation commercially. Do not scrape and bulk-publish a catalog or include original creator audio/video by default. Reference mechanics and original lines can support the game while exact-source items are reviewed.

Give players and hosts simple content-intensity controls. The user-requested bold humor is the central creative direction; a cleaner host playlist is an explicit option for communities that want it. Decide age/content defaults before exposing mature material publicly. Keep humor directed at the bit and situation rather than targeted abuse or protected-trait attacks.

The first content assignment should return a small, strong sample slate for review, with original versus sourced items identified, paired directions, and a clear account of what is ready to publish. Then expand the approved style based on actual play. Do not substitute a large quantity target for humor quality. Track redraws, completion, voluntary retries, and player recognition to retire weak prompts and refresh fading references.

Switch now adds five changing emotion or speed cues to one continuous take of the same short phrase. Classic remains the simplest entry point. All three shipped modes use the established visual language, media controls, result conventions, and invitation system; Switch reuses the friend/community round lifecycle.

The site redesign starts with the home-to-game-to-result journey. Establish typography, color, spacing, cards, buttons, motion, sound cues, and responsive layouts through that real flow. The home page should make playing, joining a group, and hosting easy to find. Gameplay gets readable directions, strong recording feedback, satisfying transitions, useful loading/error states, and a clear next action. Apply the resulting system to supporting pages as the core settles. Visual polish is a continuing acceptance criterion in every phase.

**Comfortable ways to play**

Camera and microphone choices are independent. Never request a device merely because someone opened a game or joined a group. Do not label participants as shy or rank participation roles by prestige.

| Path | Experience | Initial scope |
| --- | --- | --- |
| Voice only | Play Classic or Switch with an avatar and animated waveform; camera stays off | Fully supported core play, rehearsal, scoring, invitations, and results |
| Voice and camera | Play the same games with optional video and a personal replay | Same core performance rules; camera adds presentation without an automatic score advantage |
| Director / audience | Join by link, choose between curated directions, react, and give a simple crowd rating | Early group/streamer sessions; microphone and camera unnecessary; taking a performance turn is always optional |
| Guess the energy | Listen to a short approved sample and choose its intended direction, then reveal the answer | Small solo mini-game proposed for the first beta, using curated consented samples and distinct participation points |

Use friendly labels such as “Voice only,” “Camera on,” and “Join audience.” Private rehearsal gives a hesitant performer a way to try without publishing. No forced turns, surprise unmuting, or pressure to enable a camera.

For the initial games, propose a shared audio-based performance score for equivalent voice-only and camera-on attempts. Any experimental visual feedback is separately labeled and does not silently boost the common leaderboard. A future specifically visual competition needs its own clearly described rules. Crowd ratings and mini-game points stay distinct from judged performance scores.

Voice-only sharing should produce an attractive clip with the player's chosen avatar, waveform, line, timed directions, and captions, subject to the same explicit sharing controls as camera clips. An avatar is presentation, not a promise of anonymity: voice may still identify a person.

**Groups and streamers in the initial release**

Private group challenges use a link or code, a shared Classic/Switch challenge or short playlist, private results, and an obvious rematch. Players can take their turns asynchronously; do not require simultaneous attendance to make an invitation useful. Group visibility is scoped to the invited group, with member removal and invite revocation considered in the design.

Streamer sessions extend the existing host-operated stage with a polished fullscreen/OBS layout, hotkeys, a curated challenge queue, a join link/QR code, and a simple audience page for direction votes, reactions, and round reveals. The host can supply the performance while viewers participate without devices. Prefer this bounded hosted format before implementing multi-person media transport. Viewer actions still require real session state, join permissions, bounded voting, and late/duplicate-event handling; a static vote overlay is not a working audience system.

Remote guest microphones/cameras, performer queues, and multi-person live media arrive with private Stage. This sequencing brings meaningful streamer use forward while keeping its first experience concrete.

**Experience standards**

- A first-time player understands what to do from the actual game screen. Guest play stays easy.
- Classic and Switch share a coherent, distinctive visual system; responsive layout, motion, sound controls, reduced motion, and keyboard access are verified through actual play.
- Voice-only participation is first-class. Joining as audience requests no microphone or camera, and becoming a performer requires an explicit action.
- Directions remain readable during performance. Cue timing gives a person enough time to speak and understand the next direction.
- The interface clearly distinguishes rehearsal, recording, submission, judging, and replay.
- Silence, unusable recordings, interruptions, and uncertain judgments receive honest recovery states.
- Scores describe performance against the requested rules. Feedback points to evidence and gives an actionable next attempt.
- Quiet acting, different microphones, and varied legitimate interpretations must be evaluated deliberately. A louder take must not automatically win.
- Visual evaluation addresses performed directions; it does not claim to discover genuine emotions, personality, attractiveness, or other personal characteristics.
- Rankings compare equivalent rules, challenge versions, and eligible attempts. Camera-optional and camera-required formats cannot silently share an incomparable score scale.
- Recording, sharing, retention, deletion, reporting, and room permissions are part of the experience from the first relevant implementation.
- Clips should be watchable and usable without manual editing. Downloads and share handoffs must not be reported as confirmed posts to external platforms.
- The game must remain enjoyable to people who never publish a recording.

**Historical repository baseline before the mode expansion**

The source contains a Next.js 15 / React 19 / TypeScript application, an audio recorder, a server audio-judging path, six existing mode identifiers, Supabase integration, friend challenges, ranked Daily receipts, profiles, history, public results, moderation, Stripe integration, rate-limit/idempotency code, SQL migrations, and automated test suites.

Boundaries recorded at that historical baseline (current implementation and handoffs take precedence):

- `src/hooks/use-audio-recorder.ts` requests `video: false`.
- `src/types/game.ts` lists Classic, Daily, Endless, Impossible, Challenge, and Stream; it does not define Switch, Speed, Gauntlet, or live multiplayer modes.
- `src/lib/server/openai.ts` currently computes overall with a fixed 30% commitment, 25% comedy, 25% accuracy, 20% chaos formula.
- `src/app/stream/stage/page.tsx` and `src/components/stream/stream-setup.tsx` implement a host-controlled stage display and manual energy-vote controls, not a networked multiplayer lobby.
- `src/lib/share-card.ts` produces a static PNG scorecard, not a vertical performance video.

Existing documents sometimes describe intended behavior beyond these implementations. Verify individual claims in code and tests. Preserve useful infrastructure, while changing an existing system when evidence shows it does not meet the new requirement.

**Phase sequence and completion gates**

| Phase | Outcome | Main work | Evidence required to advance |
| --- | --- | --- | --- |
| 0 — Baseline and experience brief | A reproducible baseline and clear redesign direction | Exercise current Classic; inspect the actual UI; map weaknesses; define core journeys for solo, groups, streamers, and camera-free participants; specify Classic and Switch rules | Exact commit, actual checks, current-flow evidence, a concrete design proposal, and bounded implementation steps |
| 1 — Rework Classic and the site | The original game becomes a polished, satisfying first experience | Rebuild home-to-play-to-result flow; overhaul the catalog around unhinged humor, familiar internet phrases, and verified creator quotes; improve delivery pairings, recording, feedback, retry, and sharing; establish the visual/motion system; preserve voice-only play and start scoring evaluation | Reviewed content slate with strong performance pairings and publication status, full playable Classic flow, inspected mobile/desktop states, honest judging, usability observations, and relevant regression checks |
| 1B — Classic content and flow | Implemented and reviewed; external validation outstanding | Preserve the completed catalog/UI, historical content, companion transcript, and test kit | Step 1B handoff, independent review, synthetic Scribe and isolated SQL evidence |
| 1C — Classic live validation and completion | Close demonstrated engineering defects and collect remaining evidence | Live judging, isolated Supabase HTTP flows, observed play, and device checks; keep missing dependencies explicit | Step 1C handoff distinguishes measured behavior from mocks, unrun service checks, and owner actions |
| 2 — Say It Back | Match a reference performance and watch the scene dubbed with your voice | Curated publishable clips; reference playback; timed recording; dialogue replacement; original/yours comparison; separate matching rubric; quick retries | Synchronized replacement playback, correctly handled source audio, real match-score evaluation, camera-free desktop/mobile flow, latency/cost and recovery evidence |
| 3 — Groups, streamers, and inclusive beta | Solo players, invited groups, and stream audiences can participate in Classic and Say It Back | Shared-clip challenges; links/playlists/results/rematches; host display and audience voting; device-free roles; observed playtests | Complete invite/join/play/reveal loops, actual multi-client voting, no device prompts for audience, observed solo/group/streamer sessions, reliability data |
| 3B — Switch beta (shipped) | One phrase changes emotion or speaking speed across an uninterrupted take | Eight 20-second challenges; five synchronized cues; separate audio-based beta rubric; solo, friends, community and broadcast integration | Application/SQL/deployed HTTP evidence recorded; human calibration and physical-phone/OBS acceptance remain. Optional camera and exports are deferred |
| 4 — Private live Stage | Friends and creators can bring remote performers into a session | Live media, volunteer queue, voice-only and camera participants, host controls, server-owned rounds, disconnect/reconnect recovery | Real group sessions, performer/audience participation, permissions and failure-case tests, acceptable media quality |
| 5 — Broader games and creator tools | The platform supports more skills and creator-led replay | Speed, validated Gauntlet, asynchronous ranked Duels, challenge builder/remixes, mastery and themed playlists | New modes reuse shared contracts; fair comparisons; creators make playable challenges; repeat/rematch evidence |
| 6 — Scale and long-term progression | Expansion follows observed demand | Seasons, additional party formats, fair monetization, capacity, public rooms/matching when supported, mobile app evaluation | Feature-specific demand, operational readiness, sustainable costs, and no regression in core play |

The original phase 3 target was a closed beta across solo, group, and streamer use; those flows and phase 3B Switch are now implemented. An initial public release can follow once quality and launch gates pass. It includes useful group and streamer participation; multi-person live media and advanced creator tooling follow later. Phases 4–6 are a proposed order, not a commitment to build every item.

A private Stage experiment may move earlier if group and streamer playtests identify it as the most valuable next step. Classic, Switch, group invitations, streamer tools, and inclusive roles are first-release priorities. Break each phase into small complete assignments as evidence becomes available.

Prototype new rules in unranked play before promoting them to competition. Any temporary scores must be unmistakably labeled as simulated and excluded from live results and comparisons. Preserve the working Classic judging path while evaluating replacements; never silently change the meaning of historic scores.

**The shared technical foundation**

Build enough shared structure for Classic and Switch, using Classic as the simple single-direction case and Switch as the sequence case. Start inside the existing application where practical. A reusable engine does not require an early microservice rewrite.

The central contract is a versioned challenge definition: line, ordered cues, timing windows, allowed variations, scoring rules, and eligibility. An attempt binds that definition to recorded media and an event timeline. Scoring, results, replay, and export all use that same version and timing information.

Keep these responsibilities explicit:

| Responsibility | Required behavior |
| --- | --- |
| Challenge definition | Validates playable combinations and preserves immutable rules for completed/ranked attempts |
| Media capture | Handles permissions, devices, codecs, size/duration limits, actual start time, cancellation, and media cleanup |
| Attempt timeline | Relates displayed cue events to the media clock; records interruptions; makes timing uncertainty visible |
| Scoring | Separates measured facts, perceptual judgments, confidence, rubric version, and result explanation |
| Result/replay | Connects feedback to the relevant segment and makes retry/rematch obvious |
| Rendering | Reproduces the recorded cue timeline and captions; supports bounded jobs, idempotency, retries, and deletion |
| Competition | Validates eligible attempts, equivalent rules, ties, result visibility, and replay protection |
| Participation | Separates device consent and media capabilities from performer, host, director, and audience roles |
| Groups and hosted sessions | Supports invitations, scoped results, playlists, host-controlled rounds, audience votes, and rematches without requiring multi-person media |
| Rooms | Owns permissions, round transitions, votes, selection, reconnects, and authoritative results on the server |

Client event timestamps are evidence, not an authority a ranked server should blindly trust. Validate challenge identity, timing plausibility, attempt state, and media constraints. Define realistic anti-cheat limits and do not promise tamper-proof browser capture.

Keep the current web, database, auth, and billing foundations as the starting point. The shared chat suggests LiveKit for live media, a persistent worker/FFmpeg for rendering, timestamped transcription providers, and object storage suitable for clips. Treat these as candidates. Verify current capabilities, deployment constraints, and workload costs before committing to them; no new service or subscription is selected by this document.

**How to use GPT-6 Astra effectively**

Official documentation describes Astra support for complex coding, image input, computer use, structured output, and tool-based workflows. It does not accept native audio or video input. Its API page documents reasoning through `max`; the Codex application's available settings must be checked separately. [Astra model documentation](https://developers.openai.com/api/docs/models/gpt-6-astra)

The official prompting guidance emphasizes explicit autonomy, delegation instructions, and appropriate verification scope. We will use those controls to make assignments concrete and inspectable. [Astra guidance](https://developers.openai.com/api/docs/guides/latest-model)

The following is our proposed working method, not a guarantee of model performance:

1. Use Astra with the highest reasoning setting available in the implementation task for architecture decisions, judging design, difficult integration, and milestone reviews. A prompt cannot change a model selector or unlock unavailable capabilities.
2. Give it an entire bounded user outcome, the real repository, accepted product decisions, and clear success conditions. Allow it to choose the implementation details within that scope.
3. For consequential design choices, require a short comparison of plausible approaches, the decisive tradeoff, and a testable recommendation. Avoid endless option generation.
4. Require browser inspection and iteration for interaction work. A screenshot proves appearance; a complete exercised flow proves behavior. Neither replaces real-device capture tests.
5. In future implementation prompts, explicitly authorize useful independent subagent work when available: for example, a scoring evaluator, a media compatibility investigator, or a reviewer looking for counterexamples. Keep one integration owner and avoid concurrent edits to the same files. Independent review can still share model blind spots.
6. Give reviews an adversarial question: how could a convincing demo fail, a result be misleading, or a player exploit the rule? Ask for evidence and fixes, not a quality rating.
7. Require measured experiments for uncertain technical and product choices. Use held-out recordings and real playtests; synthetic fixtures cover mechanics and error handling.
8. Keep a small durable record of decisions, schemas, versions, commands, remaining uncertainties, and the next task. Carry that record between implementation sessions.
9. Permit routine reversible decisions without repeated permission requests. Keep account ownership, spending, external publication, destructive actions, and required credentials explicit in each assignment.
10. Stop the assignment when its acceptance criteria are satisfied. Deeper reasoning should produce better decisions and verified behavior, not unlimited refactoring or repeated green tests.

Astra's development role and Delivery's runtime AI are separate decisions. Candidate runtime uses for Astra include authoring validated challenge drafts, evaluating sampled visual performance evidence, and synthesizing evidence into explanations. Any such use must earn its place through comparison on quality, consistency, latency, and cost. Audio-capable judging and transcription remain separate capabilities. A transcript cannot establish vocal tone; sampled frames cannot establish exact facial transition times.

**Scoring and quality evaluation**

Start the evaluation harness during the Classic rework and extend it for Switch, before new ranking or progression gives scores greater consequences. Evaluate voice-only and camera-on attempts against the same shared audio rules; test any visual evaluation separately.

- Collect consented performances spanning clear success, deliberate mistakes, incomplete lines, missed cues, silence, noise, quiet delivery, exaggerated delivery, different microphones, and multiple valid interpretations.
- Obtain human assessments of specific requested behaviors and preference comparisons. Record disagreement rather than assuming a single human judgment is objective truth.
- Keep development and held-out examples separate. Do not tune until a fixed evaluation set merely agrees with the implementation.
- Repeat judgments of identical recordings to measure variability. Test whether irrelevant changes, such as recording gain, unduly change results.
- Measure transcript errors and timestamp uncertainty before using them for speed or transition rankings.
- Test prompt-like spoken content and malformed provider output as untrusted performance data.
- Define mode-specific rubrics, confidence/failure policies, and tie rules. A technical failure must not become a competitive loss.
- Version rubrics and models; decide how version changes affect past records and ranked seasons.
- Preserve qualitative coaching when a numerical score would imply unsupported precision.

Set numerical acceptance thresholds before evaluating the release candidate, after baseline measurements show realistic latency and variability. Record the population, sample size, evaluation version, and exceptions. Do not silently weaken thresholds to pass a phase.

**How we will judge product progress**

Proposed north-star metric: weekly returning players who take part in a meaningful game session on at least two distinct days. Track performers, directors/audience, and mini-game players separately from the first beta. A valid performance, a completed guessing round, or deliberate participation in a completed hosted round can qualify; passive page views and reaction spam do not. Report role overlap so the total does not double-count people.

Track supporting evidence:

| Question | Evidence |
| --- | --- |
| Can someone begin easily? | Prompt-to-recording conversion, permission failures, time to first completed result |
| Was the round enjoyable? | Voluntary second-round rate, directed retry rate, observed playtest behavior and comments |
| Does the feedback help? | Player understanding, targeted improvement on a retry, disagreement and uncertainty rates |
| Does sharing bring players? | Challenge opens → starts → valid results; distinguish share intent, download, and confirmed handoff |
| Is there a reason to return? | D1/D7 cohorts, repeat friend challenges, rematches, later repeat room attendance |
| Can camera-free players enjoy it? | Voice-only completion, audience/guessing repeat play, unwanted permission prompts, feedback on comfort and choice |
| Do group and streamer features work? | Invite-to-join rate, joined-to-participated rate, host setup completion, complete hosted rounds, repeat sessions |
| Is it reliable? | Submission success, retry recovery, p50/p95 result/render latency, device-specific failures |
| Can it be operated? | Cost per completed attempt/session, moderation load, support needs, deletion completion |

Report denominators and small samples honestly. Establish experiment hypotheses and thresholds before reading results. An added mode or a passing build is not evidence of retention.

**Planning and implementation working agreement**

This planning task maintains the product direction, phase scope, prompt queue, decisions, risks, and review outcomes. It creates prompts and evaluates returned evidence. Application implementation belongs in the designated implementation task.

The cycle is: define one deliverable → prepare its prompt → run it in the implementation task → return the result and evidence → review here → issue a correction or accept the milestone → update the next prompt.

The planner may inspect source, diffs, previews, and test results when available. If only an implementation summary is supplied, the review must explicitly distinguish reported claims from independently verified facts. Do not accept a milestone solely because the implementing model says it is complete.

Each implementation prompt should include:

1. The player outcome and why it matters now.
2. Repository/branch context and the required current-state inspection.
3. Relevant accepted decisions and source files/documents.
4. Scope, concrete deliverables, and exclusions that protect the milestone.
5. Observable acceptance criteria and relevant failure cases.
6. Permitted tools, independent agent assignments where useful, and integration ownership.
7. Credential, service, spending, migration, and publishing boundaries relevant to this task.
8. Required evidence and a clear stopping condition.

Every completion report should include the branch/commit or exact diff, behavior changed, tests actually run with outcomes, browser/device evidence, integration and mock status, unverified claims, known limitations, and any user action genuinely needed next. A failed or unavailable check must not be described as passed.

Review outcomes are: accepted with evidence; a specific correction is needed; or external validation is still needed. Preserve narrower completion when appropriate—for example, local media capture can be complete while production upload remains unverified.

**Current completion and next work — September 6, 2026**

1. Real sign-in is owner-confirmed. Preserve working GitHub OAuth, guest/account claiming, private history and playback. Verified SMTP remains necessary for email signup/recovery; it does not block the shipped guest or GitHub sign-in flows.
2. Say It Back retains its line-based recording, individual retakes, immediate assembled preview, waveform guidance, longer multi-line scenes, immutable clip versions, and documented source/reuse limits. Switch does not change its recording or scoring contract.
3. Friend and community rounds support Classic, Say It Back, and Switch using existing membership, exact assignments, submission replacement, consent, reveal, showcase, audience voting, broadcast controls, retention, deletion, and rematch rules. Audience winners remain separate from judging.
4. Switch ships eight 20-second challenges: four emoji/emotion sequences and four relative-speed sequences. Each repeats one short phrase across five cues. Preparation, countdown, current/next cues, progress, local replay during judging, full-take retry, saved replay, segment feedback jumps, and exact invitation snapshots are implemented. No partial retakes or speech time-warping are introduced.
5. Verification: 50 deployed HTTP checks with 22 semantic assertions across four guest sessions, 667 isolated SQL assertions plus 12 upgrade checks, focused Switch/media/recovery tests, lint, typecheck, and production build passed. The application suite had 397 passes and one flaky Say It Back timeout; the 14-test focused Say It Back rerun passed. This is not a claim of a single all-green full-suite run. Costs, live judge observations, limitations, and release references are in [SWITCH_HANDOFF.md](SWITCH_HANDOFF.md).
6. Next, complete the brief physical-phone recording/retry/reopen flow and listen to one Switch performance through OBS. Use a small real-friend/community session to assess fun, cue comprehension, quiet delivery, and feedback quality. Fix demonstrated problems; avoid a new broad audit, repeated synthetic batch, or unrelated feature expansion.

**Switch — shipped beta rules**

Repeat the same short three-word phrase once per cue, in one continuous 20-second take. Emotion challenges use five emoji directions with four seconds each. Speed challenges use 1×, 0.5×, 0.25×, 2×, and 4× instructions over 4/5/6/3/2-second windows. These are changes the performer makes with their voice. Recording and replay preserve the actual speech timing and playback speed.

The stored challenge snapshot includes its version, kind, phrase, directions, emoji, speed ratios where applicable, cue boundaries, and scoring/rubric versions. A single bounded full-audio evaluation receives all segment context and assesses words, requested delivery, and changes between cues. Quiet delivery can succeed; loudness and vocal identity are not scoring targets. Approximate timing and uncertain judgments are disclosed. Beta scores are unranked and comparable only within equivalent Switch assignments; neither they nor audience votes enter existing ranked leaderboards.

**Say It Back — confirmed product decision**

The core loop is: watch/listen to the original short clip → record the same line with timing cues → replay the video with the player's voice replacing the original dialogue → inspect a match score → retry or challenge a friend. Dubbed playback is the main payoff. The mode is camera-free by design.

The shipped matching version measures words (50%), phrase timing (30%) and rhythm (20%). Intonation and emotional delivery remain unscored until a credible audio measurement is available. Natural vocal identity should not determine success; do not require an identical voice or introduce voice cloning. Define and validate a separate scoring contract from Classic, with measured alignment and honest limits for subjective delivery similarity. Absurd reinterpretation remains in Classic, not the initial Say It Back scope.

Use a curated, publishable clip collection spanning recognizable sources where feasible. Record source attribution and media-use status separately from short-text quote publication decisions. Preserve background music/effects when suitable source tracks or validated separation permit it; do not promise clean separation from arbitrary clips. Verify that the original dialogue is actually replaced, the user's voice is synchronized, and the reference is not recorded as microphone leakage. Prioritize immediate original-versus-yours comparison and quick retries. Finished exports follow the same source-media publication constraints.

Write each full prompt only after preceding evidence resolves important decisions. Include visual and interaction acceptance criteria; do not defer polish to a final pass.

**Decisions still to make**

- First audience is decided: solo players, invited friend groups, and streamer-led communities. Refine recruiting within those audiences.
- Initial age range and markets; corresponding room/publication policies.
- Camera-free play is decided. Finalize friendly role labels and the small guessing activity; validate the proposed common audio score with separate visual feedback.
- The bold Classic/home/result visual direction is implemented. Validate comprehension, humor, replay motivation, and feedback credibility with players before making another broad redesign.
- Supported launch devices and language.
- Target date, development constraints, provider access, and monthly operating budget.
- Prompt tone is decided: funny, unhinged/inappropriate, recognizable internet culture, and streamer/creator quotes. Refine intensity settings, audience-appropriate defaults, reference mix, and coaching tone through a small reviewed sample slate.
- When monetization should begin, with competitive fairness protected.

Only ask for a decision when it changes the next assignment. The wider vision can remain flexible while the first experience is made concrete.


**Performance videos — implementation milestone, September 6, 2026**

Classic, five-cue Switch, and eligible Say It Back film scenes now have private queued MP4 exports, actual-file preview, download, and native file-share fallback. Immutable public assignment invitations contain no recording or private round capability. Guest/unscored Classic can save for export without judging. Existing source reuse restrictions and Mature-publication boundaries remain. See [VIDEO_EXPORTS_HANDOFF.md](VIDEO_EXPORTS_HANDOFF.md) for release evidence and limits. Next acceptance is one real phone download/share and a small friend session; no camera, Stage, auto-posting, editor, or new paid infrastructure is part of this milestone.
