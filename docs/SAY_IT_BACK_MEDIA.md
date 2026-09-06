# Curated Say It Back media

The collection contains **17 immutable excerpts**: the original ten plus **seven new multi-line scenes** with 10.60–17.55 seconds of actual footage. Four of the additions are Clean. The seven additions extend the source footage, rather than reordering or padding the short catalog. Each scene ships with its actual video, an extracted poster, reference audio, phrase cues, and a prepared backing track for every selectable role. No third-party embed, synthetic scene, or voice clone is required at play time.

## Sources and reuse

| Work | Rights evidence | Downloaded transfer |
| --- | --- | --- |
| *Tears of Steel* (2012), Blender Foundation, directed by Ian Hubert | The producer releases the film and its production assets under [CC BY 3.0](https://mango.blender.org/sharing/). The [official asset page](https://studio.blender.org/projects/tears-of-steel/55f344892beb3300251b0172/?asset=5910) confirms CC BY. | [1920×800 original release](https://archive.org/download/Tears-of-Steel/tears_of_steel_1080p.webm), also released on the [official YouTube channel](https://www.youtube.com/watch?v=R6MlUcmOul8). |
| *His Girl Friday* (1940), Columbia Pictures, directed by Howard Hawks | [Internet Archive's public-domain screening](https://blog.archive.org/event/his-girl-friday-public-domain-movie-screening-at-the-internet-archive/) and the [source item's public-domain declaration](https://archive.org/details/his_girl_friday). | [640×480 monochrome transfer](https://archive.org/download/his_girl_friday/his_girl_friday.mp4). Excerpts occur after the early sync defect noted on the source page. |
| *Night of the Living Dead* (1968), Image Ten, directed by George A. Romero | The original release lacked a required copyright notice; [catalog evidence records cancelled registration PA0000046101](https://publicdomainmovie.net/movie/night-of-the-living-dead). [Wikimedia records the original film's US public-domain status](https://commons.wikimedia.org/wiki/File:Night_of_the_Living_Dead_(1968).webm). | [640×480 original monochrome transfer](https://archive.org/download/NightOfTheLivingDead-MPEG/NightOfTheLivingDead.mp4), without a later colorization, new score, or added footage. |

The public-domain determinations above concern the United States. A launch targeting other territories needs a separate territorial rights assessment. The CC BY material permits commercial adaptation with attribution; the in-game source details retain creator, license link, and a notice that these are shortened, dubbed adaptations. No endorsement is implied.

The xQc Twitch excerpts are included at the Delivery owner’s express direction, following their request for the moments used in Choicer Voicer. Each source manifest records the original Twitch URL and a contemporaneously linked public footage mirror. Each manifest explicitly states that third-party reuse rights were not independently verified; it does not label the footage Creative Commons, public domain, or creator-licensed. No Choicer Voicer game assets were copied. No contemporary television excerpt is included.

The Twitch moments are:

- [Fifteen-minute delay](https://clips.twitch.tv/SlipperyOnerousDoveNotATK), excerpted at 1.80–7.65 seconds from the [2019 public mirror](https://streamable.com/aje2y). The [contemporaneous source record](https://livestreamfails.com/clip/L1ezEdegF6-W/xqc-on-a-15-minute-delay-to-prevent-stream-sniping) records the original performance.
- [Six consoles](https://clips.twitch.tv/PlumpHelplessSnakeWholeWheat), excerpted at 8.60–14.25 seconds from the [2019 public mirror](https://streamable.com/owlqs). The [original Reddit post and archive-bot link](https://www.reddit.com/r/LivestreamFail/comments/bhg9f1/xqcs_opinion_on_professional_streaming_setups/) establish provenance. Both selections stop before later profanity.

## Longer multi-line collection — September 6, 2026

| Scene | Length | Recording lines | Preference | Selected role | Source excerpt |
| --- | ---: | ---: | --- | --- | --- |
| The entire gaming setup | 10.65 s | 5 | Teen | xQc | `owlqs`, 3.65–14.30 s |
| The perfect fiancé | 14.70 s | 5 | Clean | Walter | *His Girl Friday*, 750.40–765.10 s |
| We’ll get married again | 16.55 s | 4 | Clean | Walter | *His Girl Friday*, 396.30–412.85 s |
| And then what? The whole objection | 10.60 s | 5 | Teen | xQc | `aje2y`, 1.80–12.40 s |
| We have to follow our passions | 12.37 s | 2 | Clean | Thom | *Tears of Steel*, 22.08–34.45 s |
| Divorce doesn’t mean anything | 12.43 s | 5 | Clean | Walter | *His Girl Friday*, 302.77–315.20 s |
| Look, here comes one now | 17.55 s | 4 | Teen | Johnny | *Night of the Living Dead*, 365.60–383.15 s |

These are new clip IDs and asset directories; the original ten manifests and files are unchanged. Both Twitch additions use the same documented public original-footage mirrors and owner-directed reuse decision above; no additional creator permission is claimed. The film exchanges retain the other speaker’s replies, including the fiancé and reconciliation punchlines. The source excerpt ranges refer to the named transfers, not a different upload’s timeline. His Girl Friday text was also cross-checked against the [PBS film transcript](https://www.pbs.org/video/his-girl-friday-s5bjri/).

Every addition includes H.264/AAC video, a representative poster, a 16 kHz PCM reference waveform source, and an AAC role backing. The quiet monochrome transfers receive a constant 3× gain in the scene, reference, and backing; the gain introduces no time changes or compression. Film backing transitions use 25 ms ramps outside the documented mute intervals. Twitch backing remains silent because its mixed soundtrack has no separate dialogue/background stem. The scene limit stays **18.5 seconds**, within the existing **20-second capture/upload/scoring limit**, so historical takes and Classic need no limit migration.

Asset preparation and focused QA: source video/audio are trimmed together at original speed; phrase boundaries are checked against free local Whisper ASR, source captions where available, and decoded PCM. The new references contain 424–702 measured 25 ms waveform bins. `node scripts/import-say-clips.mjs --probe` validates all 17 manifests, SHA256 hashes, browser codecs, audio presence, and media duration agreement (within 60 ms). The seven decoded backing tracks are silent inside every selected cue; original context/replies remain outside film mute intervals. Representative extracted frames were inspected. This is engineering media evidence, not a claim of physical-device recording or human listening acceptance. No paid model calls were used.

## Playback and measurement

Video and audio are trimmed together without changing performance speed. Each role has an AAC backing track with its dialogue intervals removed before playback, including small lead/tail margins. Other speakers remain in exchanges. These films do not supply isolated dialogue stems in this curated transfer, so background sound also drops during the replaced lines; this is interval muting, not claimed source separation. The Twitch single-speaker mix is fully muted in the dub because no isolated dialogue/background stems are available. Scoring uses the untouched selected-role reference timings. The player's recording is never time-stretched to match.

Film transcripts were checked with free local ASR and source captions; Twitch phrase boundaries were checked against local ASR and the actual audio envelope; timings are relative to the exact shipped excerpt. Reference cues are phrase boundaries, not invented per-word forced alignment. Assets have SHA256 hashes in `src/lib/say-it-back/catalog.json`; the version names and asset directories must change when an excerpt, role, cue, or file changes. Saved attempts retain their manifest and existing version assets must remain available.

## Adding a curated scene

1. Confirm a license or creator permission covering the intended adaptation and distribution. Retain its evidence and attribution in `source`.
2. Put the video, poster, reference audio, and role backing tracks in a new version directory under `public/media/say-it-back/`. Keep each scene at most 18.5 seconds. Add its complete manifest and SHA256 asset hashes to `src/lib/say-it-back/catalog.json`.
3. Run `node scripts/import-say-clips.mjs --probe` (requires FFprobe) to validate metadata, asset hashes, role references, cue coverage, boundaries, audio/video durations, and browser codecs. Without `--probe`, the importer performs its portable manifest/hash checks. Watch the original and backing tracks; verify the selected speaker is absent and retained speakers remain intact.
4. With environment variables for the intended Supabase project, run `node scripts/import-say-clips.mjs --apply --project PROJECT_REF`. This inserts new versions, accepts identical existing versions, and refuses a conflicting immutable version. Deploy the asset files and catalog together. Remove an old version from discovery by disabling its database row, while retaining the files needed by saved attempts.

The official [Choicer Voicer page](https://yeahmaybe.itch.io/the-choicer-voicer) and [Dub preservation update](https://yeahmaybe.itch.io/the-choicer-voicer/devlog/1637728/version-053-released-dub-preservation-update) were used to understand the format. Delivery uses its own interface, recordings, scoring, and independently sourced media.
