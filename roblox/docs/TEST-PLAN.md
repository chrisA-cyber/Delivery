# Evidence and acceptance

Use headless tests for deterministic rules, local Studio for replicated interaction, and people for fun and real voice. Record runs and gaps here. Never attach speech, account IDs or private conversation.

## Thirty minutes with three or four friends

| Time | Action | Record |
|---|---|---|
| 0–4 | Join separately. Use a phone and a desktop with two eligible mics. One friend stays in the crowd without voice. Start a timer on join. | Time to first action, legibility, phone model and frame rate. |
| 4–9 | Check each microphone for three seconds, cancel an offer, accept a fresh one, then whisper. One listener mutes the speaker. | Consent on every turn, intelligible words, level relative to baseline, mute respected. |
| 9–14 | Speak a projected line, then deliver deliberately wrong words. Try a silent take. | Compare accuracy and direction feedback. Confirm silence offers recovery. |
| 14–19 | The no-mic player directs, predicts, reacts and rates. Try changing a submitted vote and self-rating. | Standing earned, what felt consequential, whether two voters can carry a show. |
| 19–24 | Disconnect during a take, rejoin inside and outside grace, then play another round. Test blocked accounts and chat-incompatible listeners privately. | Time to next offer, no accidental rebroadcast or automatic return to mic. |
| 24–30 | Try Daily twice and rejoin. Invite a friend, inspect the feature on a phone, play a voluntary encore. | First ranked result, continuity, any low frame rate, funniest card, dead air and whether each friend voluntarily plays again. |

Record actual observations and mark unavailable checks explicitly. Ten rounds across two Studio clients, real microphone isolation and five final art captures are separate acceptance gates.

## What was exercised on this branch

| Area | Method and observed result | Still needs live evidence |
|---|---|---|
| Content and rules | From roblox/, ./tools/check.ps1 validated 123 unique lines and 36 directions. Sixteen Luau groups passed. StyLua passed. Selene reported zero errors, warnings and parse errors. Rojo produced the normal place. | Audience response and spoken pacing across devices. Strict directives are present. No separate whole-project strict type-analysis result is claimed. |
| Multiplayer core | Real local Studio server and two separate clients. The performer used scripted input. The second client directed, reacted and rated. Ten reveals completed. See evidence/studio-greybox.txt. | Feel, social chemistry and a networked live session. |
| Voice and host | In single-client Studio a synthetic measurement produced accuracy 100, 2.4 words/second, 0.75× baseline and ten stage points. A headless test exercised 20 varied outcomes through the authored host policy. The selector can return only an allowed line index. | Live STT segmentation and latency, device mute/block changes, audible TTS and live generative output. A synthetic voice result uses authored words and numbers, not an audio recording. |
| Progression | In-memory adapter tests exercised release/rejoin, stale locks, delayed load, first Daily wins, and troupe retry deduplication. Independent deck seeds selected the same UTC Daily in pure tests. | Cross-server cloud writes, real shutdown, friend permissions, troupe membership, next-day retention and public-room teleports. |
| Store and metrics | Store tests covered verified ownership, denial, Studio preview and repeat developer-product receipt stamping. Metrics tests emitted deduplicated names and separate attempted/missed transcription counts. | Platform purchase, charge, restore, native invite send, Creator Analytics visibility and real cohorts. Studio simulations use no Robux. |
| Art | The five first and revised Studio captures are in evidence/. See the original-vs-revised comparison and ART-REVIEW.md. The glTF export has 568 nodes, 26 shared meshes and a measured maximum of 440 triangles per mesh. | Ten avatars on a physical mid-range phone, licensed original sound IDs and human art acceptance. |

## Defensive review of client input

The production game has one inbound Stage RemoteEvent. The dedicated Meter RemoteEvent sends sanitized values outward. The QA-only RemoteEvent and two fixture scripts are mounted solely in the disposable test build.

| Input | Server checks and effects |
|---|---|
| All intents and sync | Known player, short string verb, numeric turn, per-player 12-per-second bucket. All actions except a state refresh must match the active turn. Unknown verbs have no effect. A refresh returns that recipient’s scoped view. |
| Queue, accept, leave, encore, retake | Mode and custom mix are allowlisted. A queue slot is unique. Each timed offer belongs to one player. Live accepts explicitly opt in to mic use. A retake needs an actual technical miss, an encore needs crowd demand and a qualifying reveal. Both return a fresh offer. Pack night requires an earned unlock. |
| Direct, react, predict, rate and face-off vote | The actor cannot contribute as audience. The phase, choices and one-per-player entries are checked. A face-off finalist cannot select their own winner. Scores and awards are calculated once on the server. |
| Meter, mic-checked and claim | Performer, consent, take/read window, sample count, valid UTF-8, duration, finite normalized levels, baseline and elapsed time are checked. A 0.24-second meter cap limits fanout. The server accepts one measurement and recomputes the component scores. Fabricated but plausible local measurements remain possible. There is no global rank. |
| Scripted take | Studio only, current performer, rehearsal choice and active take. One delayed fixture can run. The turn and claim checks run again on delivery. Studio actions cannot create a live audio route through rehearsal. |
| Cosmetics and store | The live server looks up pass ownership independently. A cleared player cannot acquire a late result after leaving. The developer product uses the platform receipt callback and an atomic write under the buyer's own storage scope. The client cannot grant a live receipt. |
| Troupe and public-room finder | Troupes require two online profiles, a platform-confirmed friendship, a bounded team and no earlier points that week. Finding a room is voluntary, excludes private sessions and checks live counts. Delayed or full rooms can reject a teleport. |
| Invite event | Only an observed prompt opening and separately observed referred join feed telemetry. Neither can award an entitlement. No player names, speech or volume enter analytics. |

## Negative cases for private testing

Run a silent, muted and permission-denied take, then retry the same card. Make filtering unavailable in a test copy and confirm the caption stays neutral. Disable each speech or host switch independently and complete another round. Leave during mic check, take and read. Refresh a released session and confirm no prior caption, live wire or earned grant follows it. Fill a private show and verify its guests stay together. Force a test-store retry and return to the dressing room in a second server. Save only the scenario, observed UI, duration, outcome and device.

## Final Studio runs

The theatre multiplayer fixture rotated Main stage, Switch, Echo, Daily and Custom twice. The two local clients completed ten distinct reveals. The spectator had a recorded direction vote, reaction, prediction and rating in every round, progressed from 6 to 66 XP, equipped the Studio rose preview and received no text from the performer. The ten accepted fixtures enabled no stage mic. This run covered the hardening build before the final presentation and souvenir changes. The individual scores and Daily string are in evidence/studio-five-modes.txt. Both this server and a separate single-client server showed the same November 17 UTC Daily.

The Galaxy A16 landscape simulator exposed a 34-pixel action area and jump controls over the buttons in evidence/phone-before.jpg. In the revised place the 685 × 338 logical viewport had a 131-pixel control desk, 92-pixel scrolling action area and 123 × 44 buttons. Card and direction reported TextFits. Movement controls were hidden for the seated show. See evidence/phone-revised.jpg. One desktop Studio sample captured 360 frames in six seconds with a 16.7 ms median and 18.0 ms 95th percentile. An earlier background sample was much slower. Neither sample measures the phone hardware.

The visible room had 592 BaseParts under ShowSet, five local lights and one shadow-casting light. The HUD uses scrollable 44-pixel action rows, the local meter caps display updates and expired reaction effects are scheduled for removal. Physical-device frame time with ten avatars remains unverified.
