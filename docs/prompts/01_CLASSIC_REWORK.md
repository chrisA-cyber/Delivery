# Implementation prompt — complete the Classic rework and site redesign

You are implementing Step 1 of Delivery's product rework. Complete the working implementation, verification, and review handoff in this task. Own the entire outcome, including the initial assessment, design choices, content work, engineering, and iteration. Make routine decisions autonomously and continue through implementation; an audit, plan, sample slate, or attractive home page alone does not complete this assignment.

Repository: https://github.com/chrisA-cyber/Delivery
Expected local workspace, if available: /Users/christopherassef/Documents/ChatGPT/Delivery

Inspect the current repository and branch. Preserve existing work and use an isolated codex/ branch or worktree when appropriate. Read applicable instructions, README, relevant product/architecture/content/test documentation, and docs/DELIVERY_2_ROADMAP.md if present. This prompt is self-contained if that local planning document is unavailable. The source previously inspected was main at 97ed5d3; verify the current state instead of assuming it is unchanged.

1. Product outcome and scope

Delivery is becoming a social performance game for solo players, invited friend groups, and streamer communities. The first two core games will be Classic and Switch. Voice-only participation is a first-class experience.

This assignment delivers a substantially reworked Classic and a cohesive, polished website. Classic remains: get a line and a delivery direction → prepare → record your voice → replay or retake → submit → receive an entertaining, useful result → retry, play another, or challenge someone.

Make that experience enjoyable enough to play repeatedly. Improve actual interaction, content, feedback, and reliability alongside its appearance.

Switch, video capture/export, new group lobbies, remote audience voting, Guess the Energy, and live multiplayer belong to later steps. Shape reusable components sensibly for that future. Existing friend challenges and host-operated Stream Mode remain real working features to preserve and visually integrate. Do not advertise later features as usable or create fake working buttons for them.

2. Rework the content completely

The owner considers the current quotes and speaking prompts too lame. The desired center of gravity is funny, unhinged, inappropriate internet comedy, familiar meme phrases, and recognizable streamer/influencer clip quotes. Players should think “I know that clip” or “I cannot believe I have to say this.”

Write strong originals with outrageous confessions, absurd boasts, profanity, awkward situations, and adult/inappropriate humor where content settings allow. Avoid substituting generic office jokes, corporate whimsy, or random nouns for humor. Curate recognizable online references and research real creator quotes against actual sources. Never invent a quote and attribute it to a real person, or claim something is currently popular without evidence.

Delivery directions must create a second joke and be playable: outrageous confidence while holding back tears, a furious outburst whispered politely, a ridiculous confession delivered with total sincerity. Score following the direction, not matching a creator's voice.

Target at least 60 strong playable lines and 30 meaningful directions in a handful of coherent packs. Include enough fresh reviewed material that Classic feels substantially different. These are breadth targets, not permission to pad the catalog. Avoid near-duplicates and keep lines readable and speakable within the recording limit. Provide 12 standout line/direction combinations in the handoff so the owner can evaluate the tone.

Research a separate shortlist of recognizable creator/meme quotations with source links, verified wording, attribution, and publication status. Include eligible sourced material in the playable catalog; keep unresolved items out of the production pool. Attribution alone does not establish publication rights. Do not import original creator audio/video. Finish a useful original catalog even if some sourced items remain pending.

Implement simple, working content-intensity controls and a cleaner option suitable for hosts. Keep the requested bold tone prominent in the appropriate setting. Inspect the current rating model: it previously supported only everyone/teen. Do not label mature content as teen or implement a cosmetic filter that the server ignores. Keep mature material behind an explicit appropriately labeled opt-in; report any remaining launch-age-policy dependency without holding up the local implementation. Humor should not depend on protected-trait attacks, targeted harassment, or sexual content involving minors.

Update client catalog, server resolution/selection, pack discovery, defaults, fallback content, seed data, and relevant tests together. Prevent dull immediate repeats and incompatible pairings. Introduce fresh identities or versions for changed lines rather than silently changing old challenge/history references. Account for existing database content through an additive update strategy; changing only a fresh-install seed is insufficient. Preserve historical receipts and document how obsolete content leaves new draws.

Produce the content sample during your work, make a reasoned editorial choice, and proceed. This assignment does not require stopping for sample approval.

3. Make the site look and feel excellent

Inspect the running experience first. Choose and implement a distinctive visual direction that fits an internet performance game: expressive typography, confident composition, purposeful color, excellent spacing, readable prompt cards, and satisfying motion. Give the game personality without making the interface noisy.

Prioritize home → Classic → recording → review → judging → result → replay/invite. Make the primary play action obvious and the game understandable immediately. Give the line and direction visual priority while performing. Results need hierarchy, entertaining copy, useful feedback, and an obvious next action.

Build consistent tokens and reusable components for layout, type, buttons, cards, inputs, navigation, feedback, and animation. Apply them across existing supporting routes, including discovery, Daily, challenges, profiles, leaderboards, settings, pricing, and Stream Mode. Inspect page-specific layouts and repair inconsistencies; global color changes alone are not a site redesign. Preserve the actual functionality and integrate legal/account screens appropriately.

Use relevant installed design/browser skills and tools. You may privately compare a few approaches, then choose and execute one. Iterate on rendered screens and interactions. Use intentional assets where helpful. Avoid fabricated activity counts, fake users/results, invented endorsements, and unlabeled simulated activity.

Make mobile and desktop both excellent. Verify at 320, 390, 768, and 1440 pixels. Maintain readable contrast, keyboard focus, touch targets, and reduced-motion support. Optional sound cues must respect mute preferences and must not contaminate the recording. Do not introduce sounds or animation solely to make the page busier.

4. Improve the complete Classic experience

Deliver clear preparation and permission states, responsive mic feedback, obvious recording/stop controls, immediate local playback, retake, reliable submission, understandable waiting, and an excellent result. Keep unsent takes local and stop/release media resources correctly.

Voice-only play should feel intentional through the stage layout and waveform/avatar presentation. Do not ask for camera permission or make camera-free users feel incomplete. Offer comfortable private rehearsal and avoid surprise publication.

Handle permission denial, missing microphone, silence, short/unusable takes, device interruption, size/duration limits, failed requests, repeated submit clicks, and safe retry. Preserve the recorded take when recovery reasonably allows it. Use genuine browser/media state for indicators.

Audit Classic judging and improve feedback so it evaluates the requested performance. The existing overall formula was 30% commitment, 25% comedy, 25% accuracy, and 20% chaos; do not assume this is ideal for every direction. Quiet and deadpan performances must be legitimate. Make the verdict specific and the coaching actionable without personal attacks.

Preserve direct-audio judging and deterministic accuracy checks unless evidence supports a better implementation. Do not replace audio perception with transcript-only guesses. Any rubric/score changes need versioning and an explicit compatibility approach for existing results and leaderboards. Do not mix incompatible scores silently. When calibration evidence is unavailable, state that limitation and avoid claiming newly invented weights are validated.

Build a repeatable evaluation path for consented recordings, including quiet/loud delivery, mistakes, different interpretations, and spoken attempts to manipulate the judge. Synthetic fixtures can test contracts and failures; they cannot establish human enjoyment or perceptual scoring quality.

5. Engineering and autonomy

Use GPT-6 Astra for this assignment if available. The operator should select the highest available reasoning setting for demanding design, architecture, and review work. Report the actual configuration if known; a written instruction is not proof it changed.

Explicitly use subagents where supported and useful: independent content/source research, implementation investigation with separate file ownership, and a final adversarial reviewer are suitable assignments. Keep one integration owner, reconcile findings, and verify the integrated product. Do not create unrelated user-owned tasks.

Retain useful Next.js/React, Supabase, storage, auth, challenge, moderation, billing, and idempotency infrastructure. Make necessary changes without an unrelated framework migration. Preserve private-by-default recordings, authorization boundaries, Daily rules, and existing entitlement behavior.

Follow the environment's credential workflow before live API work. Never expose secrets. If services or credentials are missing, complete all independent implementation and use clearly labeled local fixtures to verify the reachable flow. Document precisely which integrations remain unverified. Never weaken production validation or silently return fabricated live scores to get a demo working.

This prompt authorizes local implementation, appropriate dependencies, tests, browser verification, and local preview. Prepare additive migrations and deployment instructions where needed. External deployment, paid provisioning, production migrations, pushes, and merges require separate authorization. Do not let those later actions block reviewable local work.

6. Verification and completion

Run the existing baseline checks, then fix regressions and relevant defects introduced or exposed by this work. Use the repository's lint, typecheck, unit tests, build, and applicable Playwright suite. Add meaningful coverage for changed catalog/filtering, scoring, historical compatibility, and recovery behavior. Do not delete useful assertions or weaken tests simply to make them pass.

Exercise the entire Classic loop in a browser using supported synthetic microphone input where appropriate. Verify retry-same, next-round, content settings, share-card output, and the existing challenge entry points. Check signed-in integration when configured and document its absence otherwise. Capture before/after evidence of major screens, including recording/review/result and mobile layouts. Inspect the actual downloaded share card for clipping and incorrect content.

Request an independent final review when available, address actionable findings, and rerun affected checks. Stop after the complete scoped outcome and necessary verification; do not expand into later game modes.

Return a review handoff containing:

- What changed and why, plus branch/commit or exact changed-file references.
- A working local preview address and how to run it again.
- Before/after screenshots or equivalent visual artifacts for desktop and mobile core flows.
- Twelve standout prompt/direction pairs, catalog counts, and the verified quote shortlist with publication status.
- Exact checks run and their outcomes; clearly distinguish mock, locally exercised, live-integrated, and unverified behavior.
- Scoring changes, calibration evidence or limitations, and historical data compatibility.
- Remaining blockers, migration/setup steps, and any real-device/user playtests still needed.

The completion standard is a playable, cohesive, substantially better Classic experience with a strong new catalog and a redesigned site. Make the implementation concrete enough for the planning task to review by playing it and inspecting the evidence.
