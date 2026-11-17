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

## Earlier theatre build evidence

| Area | Method and observed result | Still needs live evidence |
|---|---|---|
| Content and rules | From roblox/, ./tools/check.ps1 validated 123 unique lines and 36 directions. Sixteen Luau groups passed. StyLua passed. Selene reported zero errors, warnings and parse errors. Rojo produced the normal place. | Audience response and spoken pacing across devices. Strict directives are present. No separate whole-project strict type-analysis result is claimed. |
| Multiplayer core | Real local Studio server and two separate clients. The performer used scripted input. The second client directed, reacted and rated. Ten reveals completed. See evidence/studio-greybox.txt. | Feel, social chemistry and a networked live session. |
| Voice and host | In single-client Studio a synthetic measurement produced accuracy 100, 2.4 words/second, 0.75× baseline and ten stage points. A headless test exercised 20 varied outcomes through the authored host policy. The selector can return only an allowed line index. | Live STT segmentation and latency, device mute/block changes, audible TTS and live generative output. A synthetic voice result uses authored words and numbers, not an audio recording. |
| Progression | In-memory adapter tests exercised release/rejoin, stale locks, delayed load, first Daily wins, and troupe retry deduplication. Independent deck seeds selected the same UTC Daily in pure tests. | Cross-server cloud writes, real shutdown, friend permissions, troupe membership, next-day retention and public-room teleports. |
| Store and metrics | Store tests covered verified ownership, denial, Studio preview and repeat developer-product receipt stamping. Metrics tests emitted deduplicated names and separate attempted/missed transcription counts. | Platform purchase, charge, restore, native invite send, Creator Analytics visibility and real cohorts. Studio simulations use no Robux. |
| Art | The five first and revised Studio captures are in evidence/. See the original-vs-revised comparison and ART-REVIEW.md. The glTF export has 568 nodes, 26 shared meshes and a measured maximum of 440 triangles per mesh. | Ten avatars on a physical mid-range phone, licensed original sound IDs and human art acceptance. |

## Defensive review of client input

The production game accepts show and venue intents through the Stage RemoteEvent. Meter carries sanitized values outward. PortraitSession opens a local camera session for the player who approached the physical photo station. The QA-only RemoteEvent and two fixture scripts are mounted solely in the disposable test build.

| Input | Server checks and effects |
|---|---|
| All intents and sync | Known player, short string verb, numeric turn, per-player 12-per-second bucket. Show actions must match the active turn. A state refresh returns the current show. Venue actions use personal activity state, room proximity and active run identifiers. Unknown verbs have no effect. A refresh returns that recipient’s scoped view. |
| Queue, accept, leave, encore, retake | Mode and custom mix are allowlisted. A queue slot is unique. Each timed offer belongs to one player. Each performance requires fresh acceptance. Voice accepts explicitly opt in to the mic. Sound booth accepts the pad role. A retake needs an actual technical miss, an encore needs crowd demand and a qualifying reveal. Both return a fresh offer. Pack night requires an earned unlock. |
| Direct, react, predict, rate and face-off vote | Performers cannot rate themselves or vote for the face-off winner. A solo Sound booth performer can select the otherwise empty audience’s cue sheet. The phase, choices and one-per-player entries are checked. A face-off finalist cannot select their own winner. Scores and awards are calculated once on the server. |
| Meter, mic-checked and claim | Performer, consent, take/read window, sample count, valid UTF-8, duration, finite normalized levels, baseline and elapsed time are checked. A 0.24-second meter cap limits fanout. The server accepts one measurement and recomputes the component scores. Fabricated but plausible local measurements remain possible. There is no global rank. |
| Scripted take | Studio only, current performer, rehearsal choice and active take. One delayed fixture can run. The turn and claim checks run again on delivery. Studio actions cannot create a live audio route through rehearsal. |
| Cosmetics and store | The live server looks up pass ownership independently. A cleared player cannot acquire a late result after leaving. The developer product uses the platform receipt callback and an atomic write under the buyer's own storage scope. The client cannot grant a live receipt. |
| Troupe and public-room finder | Troupes require two online profiles, a platform-confirmed friendship, a bounded team and no earlier points that week. Finding a room is voluntary, excludes private sessions and checks live counts. Delayed or full rooms can reject a teleport. |
| Invite event | Only an observed prompt opening and separately observed referred join feed telemetry. Neither can award an entitlement. No player names, speech or volume enter analytics. |
| Sound booth and Studio B pads | Room or performer role, active cue sheet, timing window, cue index, allowed pad and uniqueness are validated on the server. Studio B requires the correct personal run and workstation proximity. |
| Writers, dispatch and fittings | The server validates the approved mix, physical desk or prop proximity, pickup sequence, active run and owned look. Each completed delivery grants its reward once. |
| Marquee and rooftop portrait | Nearby physical prompts start the interactions. The shared relay validates switch timing and awards nearby contributors. The photo station positions the consenting player before sending a private client invitation. |

## Negative cases for private testing

Run a silent, muted and permission-denied take, then retry the same card. Make filtering unavailable in a test copy and confirm the caption stays neutral. Disable each speech or host switch independently and complete another round. Leave during mic check, take and read. Refresh a released session and confirm no prior caption, live wire or earned grant follows it. Fill a private show and verify its guests stay together. Force a test-store retry and return to the dressing room in a second server. Save only the scenario, observed UI, duration, outcome and device.

## Earlier theatre Studio runs

The theatre multiplayer fixture rotated Main stage, Switch, Echo, Daily and Custom twice. The two local clients completed ten distinct reveals. The spectator had a recorded direction vote, reaction, prediction and rating in every round, progressed from 6 to 66 XP, equipped the Studio rose preview and received no text from the performer. The ten accepted fixtures enabled no stage mic. This run covered the hardening build before the final presentation and souvenir changes. The individual scores and Daily string are in evidence/studio-five-modes.txt. Both this server and a separate single-client server showed the same November 17 UTC Daily.

The Galaxy A16 landscape simulator exposed a 34-pixel action area and jump controls over the buttons in evidence/phone-before.jpg. In the revised place the 685 × 338 logical viewport had a 131-pixel control desk, 92-pixel scrolling action area and 123 × 44 buttons. Card and direction reported TextFits. Movement controls were hidden for the seated show. See evidence/phone-revised.jpg. One desktop Studio sample captured 360 frames in six seconds with a 16.7 ms median and 18.0 ms 95th percentile. An earlier background sample was much slower. Neither sample measures the phone hardware.

The visible room had 592 BaseParts under ShowSet, five local lights and one shadow-casting light. The HUD uses scrollable 44-pixel action rows, the local meter caps display updates and expired reaction effects are scheduled for removal. Physical-device frame time with ten avatars remains unverified.

## District acceptance routes

Use the ordinary outdoor district place for this checklist. A walkthrough in the owner handoff describes controls. The table below is a test procedure. Add dated results, build revision and captures after each actual run.

| Test | Actions | Passing observation |
|---|---|---|
| First arrival | Have four people independently choose exploration, sound pads, voice and audience. Start the join timer. Let the players act before explaining anything. | Each can identify their first action. Record seconds to first vote, pad input or voluntary performance. Record exact words or controls that caused hesitation. |
| Walking and map | Walk from the plaza to both wings and up the rooftop ramp. Open both atlas views on a phone, inspect all ten stops, then try a walking visit and a seat in both the theatre and gallery. | The live position dot and selected landmark match the route. Walking restores the avatar camera and touch movement. A seat uses the show camera. All room buttons and both arrival choices remain usable. |
| Sound booth and practice | In Studio B hit all three cue windows. In a separate run deliberately press one wrong pad and miss one cue. Repeat a successful rehearsal on the public stage with a spectator. | Room practice reports its own timing and stage XP. The audience can react and rate the stage act. Two or more correct private cues unlock Cobalt. No microphone route starts for the pad player. |
| Writer and stage queue | Stamp a preset combination, browse away, return to the press, then queue that card. Pass one invitation and accept a fresh invitation. | The text on stage matches the saved preset after fresh consent. Other attendees cannot replace that writer’s card. |
| Warehouse and fitting | Start an order. Visit an incorrect prop first. Pack the three listed props in order and return the ticket. Inspect the Cobalt and Cherry looks in the atelier, equip an earned look and take another stage turn. | The personal marker points to the next prop or dispatch desk, yields to the close-range prompt, and disappears when leaving the warehouse or completing the ticket. Wrong or repeated pickups leave progress intact. Delivery produces one reward. The mirror and the stage distinguish the selected look. An unearned preview cannot grant the item. |
| Plaza and rooftop | Two players take turns on Marquee Relay. Then have one walk to Cast Portraits, change framing, take a photo, decline the gallery save, and return to the venue. The other keeps walking. | Switch labels and numerals explain the puzzle. Nearby contributors receive the show souvenir. Only the volunteer’s camera changes. Declining the save returns control without exporting speech. |
| Parallel play | In one server, keep a performer and a spectator in the theatre while another player works a warehouse order or Studio B drill. Leave and rejoin during an activity. | The show continues. Side activity and crew notices are personal. Only participating audience members affect show votes, reaction scoring and honours. |
| Outdoor arrival | Join fresh on desktop and phone at the Signal Park gateway. Walk immediately, rotate the camera toward the streetcar, open Map and locate the waterfront and market. Choose **Live show → Play with sound pads** and return outdoors after the act. | The initial frame shows the park and its bandstand, the map opens on Signal Park, walking controls remain clear and joining the show is optional. |
| Lantern Street transit | Board at the plaza, request the next stop, alight and reboard at the waterfront. Try with a friend and on touch. | Riders stay on the moving car, see the correct arrival name and disembark on the platform. |
| Waterfront and Signal Park | Try one early reel and two well-timed reels at Buoy Watch. Run the marked park arches in order and try a later run in reverse route order. | The buoy and prompt agree, catches count once, and the park marker changes after each valid arch. Returning to the bandstand ends and times the run. |
| Night Market | Take an order, try an incorrect stall, collect both requested materials, then try a wrong stamp followed by the ticket’s stamp. | Progress and the private route marker persist after a wrong choice. The correct stamp awards four crowd XP once. The next order starts cleanly. |
| Private-server release checks | Repeat the district route on a physical mid-range phone with ten avatars. On the owner’s private experience, rejoin after equipping a look and stamping a card. Check a real capture permission prompt, two verified microphones, mutes, blocks and cloud saves. | Record real frame timing, touch legibility, consent, data restoration and what each player voluntarily plays again. Record unavailable cases explicitly. |

Previous theatre screenshots and one-avatar performance samples describe their original builds. Use a current district capture for each outdoor landmark and studio block and a real-device measurement for a ten-avatar release decision.

## November 17 district candidate

- `./tools/check.ps1` validated 123 screened lines and 36 directions. All 26 gameplay groups and 729 marquee configurations passed. Formatting and lint passed. The ordinary place built successfully. [Build commands](../AGENTS.md)
- The rebuilt theatre fixture completed 12 shows across six formats. The separate district fixture ran a public stage and private drill concurrently, then seated the second player for the next performance. Both local Studio clients completed the scenario. [Twelve-show receipt](evidence/theatre-rebuild-two-clients.txt) · [Concurrent activity receipt](evidence/district-two-clients.txt)
- In ordinary Studio play, the park, waterfront and market each ran to a rewarded finish. A passenger boarded the Lot Line, rode and requested a stop. The plaza marquee awarded its souvenir. Earlier workshop testing covered the private sound console, writer, ordered prop collection and delivery, earned fittings and rooftop portrait camera. The final release preview returned walking paths from Signal Park to all ten landmarks. A public Sound booth turn finished with three perfect keyboard cues, a score of 100 and +10 stage XP. [Ordinary Studio play receipt](evidence/district-solo.txt)
- Studio's Galaxy A16 landscape simulation showed the joystick, jump control and 44-pixel navigation targets. We corrected clipped role and pier text and checked both again. [Arrival](evidence/district-phone-arrival.jpg) · [Atlas](evidence/district-phone-atlas.jpg) · [Role selection](evidence/district-phone-role.jpg) · [Pier instructions](evidence/district-phone-pier.jpg)
- The Blender geometry audit checked 19 walk routes, 19 anchors, the eight-stud streetcar corridor and unobstructed harbor sightlines. In the final Studio build, the camera starts at the park gateway and water covers the harbor. [Outdoor Blender proof](evidence/blender-open-world.jpg) · [Studio arrival](evidence/district-spawn.jpg) · [Waterfront](evidence/district-waterfront.jpg) · [Night Market](evidence/district-market.jpg) · [Public sound stage](evidence/district-stage.jpg)

The outer streets have less dressing than the three activity districts. Observe new players there during the friends test. A person on a physical phone and two privacy-eligible microphone accounts are still required for live performance and communication acceptance.
