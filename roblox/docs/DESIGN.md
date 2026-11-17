# The house opens on a card

A new spectator sees one card and can direct, react, predict and rate. With an empty queue the stage runs an explicitly identified house rehearsal using authored material. This gives the first spectator a decision before a friend arrives. A human joins the queue, reviews the listening notice and accepts a fresh seat offer each time.

Target timing in seconds: offer 5, direct 5, countdown 2, take 10, read 2, vote 5, host 1.5, reveal 1.8, reset 1. Loudness is relative to that performer's three-second calibration. Counts and word matching measure evidence. The crowd decides comedy. A technical miss can be retried without recording a zero. Private, sparse rooms use available measurements and show absent components plainly.

One authoritative clock advances the show. Network input is a bounded intent tied to the active turn. Filtering and host calls run off the clock and stale completions are discarded. No transcript or sound sample enters persistence or telemetry. Daily parity uses the UTC calendar. No client claim can set a global rank.

The grey box uses a riser, a back screen, ten seats, one host stand and a phone-readable card. Production art waits on a human grey-box playtest. Target a late-night curtain theatre and a little flip-board host whose mouth changes as it speaks. The camera follows the show only with player consent to motion.

## Platform references checked November 17

- Voice eligibility and place settings: [Voice Chat](https://create.roblox.com/docs/chat/voice-chat). Roblox has region and account restrictions. Use platform eligibility, never infer age. Test social compatibility and personal mutes on actual accounts.
- [Audio objects](https://create.roblox.com/docs/audio/objects) and [STT](https://create.roblox.com/docs/reference/engine/classes/AudioSpeechToText): a client-local text result, up to ten seconds per segment, 1 + 5 × concurrent users per minute. Silence may split a take. Latency, language detection and an AudioPlayer harness need runtime evidence. Do not rely on any latency promise, language count or guaranteed live-file transcription.
- [Analyzer](https://create.roblox.com/docs/reference/engine/classes/AudioAnalyzer): server levels are zero. Use client RMS only, disable spectrum. Local levels are claims.
- [TTS](https://create.roblox.com/docs/reference/engine/classes/AudioTextToSpeech) has a 300-character limit. [TextGenerator](https://create.roblox.com/docs/reference/engine/classes/TextGenerator) supports request MaxTokens, with an initial 100 requests/minute. [AI maturity](https://create.roblox.com/docs/generative-AI) is an owner decision.
- [Filtering](https://create.roblox.com/docs/ui/text-filtering) requires appropriate filtering for user-derived text. Keep transcripts private to their speaker and filter even that view. Audience can read the original line.
- [CaptureService](https://create.roblox.com/docs/reference/engine/classes/CaptureService) records up to 30 seconds and mutes all player voices in video. Design the share moment around the visual reveal. [Discovery](https://create.roblox.com/docs/discovery) lists intentional co-play among several signals without promising its relative rank.
- [Mesh specifications](https://create.roblox.com/docs/art/modeling/specifications) give a 20,000-triangle per-mesh ceiling. Six shadow lights and 1024 textures are production budgets pending phone measurement.

## Implemented timing and playtest revisions

The seat offer lasts six seconds. The take lasts ten, the result holds for 1.8 and the house can play as soon as a spectator joins. The owner's grey-box feedback supported developing the theatre and replacing generic material with original Roblox-specific lines. The response was 60 revised lines and a nine-combination preset writer. The actual audience and graphics verdict await the friends test.

A same-card retake goes to the back of the queue and asks again at the offer. A successful encore also requires the performer to opt in. A verified friend in the room adds one progression point to participating players. Twenty points in either track opens Pack night and the subtle Echo stage effect. Stage ranks unlock an entrance at 40 points, a blue mic stem at 60, a confetti tint at 80 and a follow-spot tint at 100. Forty crowd points unlock gold roses. These affect presentation and progression only. The house read supplies the line and direction publicly. A successfully filtered heard-text caption goes to its performer.

## Second build

The first theatre revision changed the entrance from a live ballot to a choice of sound pads, voice or audience. The district revision starts outside with unrestricted movement. The house still runs while people choose. A lone player can immediately claim an idle house slot, accept a fresh offer, perform a voiced or no-mic act, receive specific feedback and replay from the result. Groups retain the shared stage queue. Sound booth uses three server-timed inputs, six scenes, audience-selected orders, visible cue countdowns and tactile stage props. The starting design now honors Roblox's reduced-motion preference. See REFERENCE-STUDY.md for the three game references and the external libraries used.

## Public campus and independent activities

The public show has its own clock. Each visitor also has a private Studio B drill, supervised preset writer, prop dispatch ticket and atelier fitting state. Walking or travelling across the campus must never opt a visitor into microphone use. The plaza marquee is a co-operative puzzle: three linked rotary switches change numbered lamps, and the people who help match the ticket can earn a crew souvenir. A rooftop portrait booth offers cast, close-up and wide framing. Its gallery prompt is local and optional. A player can go back to walking without saving a picture.

## District streets and the Lot Line

The theatre is a building on public streets. Open-air routes connect the waterfront, park and night market with the production workshops. The sightseeing streetcar runs from the pier through the plaza to Signal Park and reverses through the same stops. It has six seats, signs showing where the car is, and an optional stop-request button for passengers. Moving on foot or by streetcar leaves the shared theatre running independently.

## Streets and shop counters

Lantern Street has an enterable post office on the waterfront side and a listening room on the park side. The west market walk passes a working bakehouse. The east walk passes a print gallery. Upper-storey windows, residential façades and ground-floor displays continue the streets between the four doors. Walk inside to explore. Using a counter starts its activity.

The post office sends parcels to another business, the record deck plays a short sequence for the listener to reproduce, the bakehouse serves a recipe ticket, and the gallery prints a three-layer postcard. Replacing a job is an explicit choice. Each completed ticket awards a souvenir or increases that business's personal count. The gallery restores the latest printed design.

Clock Court is a second pedestrian route between record row and Market Walk. Its four clock faces show UTC. Three bell pulls play different nearby notes, and the court benches offer a seat. Four local residents walk routes between the shopfronts and pause when asked for directions.
