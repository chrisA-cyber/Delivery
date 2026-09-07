# Say It Back content expansion — September 7, 2026

Ten new immutable excerpts extend the catalog from 17 to 27 scenes. The original 17 manifests and media are unchanged. The additions use real public source footage in Delivery’s player, with selected-role cues, H.264/AAC video, posters, 16 kHz mono PCM reference audio, AAC backing tracks, and SHA256 hashes. The ten new scenes are enabled for personal rendered downloads by the Delivery owner; provenance remains unchanged and makes no independent creator-license claim.

| Scene ID | Duration | Selected voice | Rating | Source record and public footage |
| --- | ---: | --- | --- | --- |
| `xqc-stop-smoking-crack` | 4.55 s | xQc | Mature | [Fifteen-minute-delay source record](https://livestreamfails.com/clip/L1ezEdegF6-W/xqc-on-a-15-minute-delay-to-prevent-stream-sniping), [original-footage mirror](https://streamable.com/aje2y) |
| `xqc-feels-like-work` | 4.70 s | xQc | Mature | [Professional-setup source record](https://www.reddit.com/r/LivestreamFail/comments/bhg9f1/xqcs_opinion_on_professional_streaming_setups/), [original-footage mirror](https://streamable.com/owlqs) |
| `tyler1-get-counseling` | 9.40 s | Tyler1 | Teen | [Contemporary source record](https://www.reddit.com/r/LivestreamFail/comments/150ezk9/tyler1_finishes_his_24_hour_stream/), [public mirror](https://arazu.io/t3_150ezk9/) |
| `northernlion-i-prefer-it` | 4.75 s | Northernlion | Clean | [Video-speed source record](https://www.reddit.com/r/LivestreamFail/comments/1caj8jt/nl_on_2x_speed_video_watching/), [public mirror](https://arazu.io/t3_1caj8jt/) |
| `northernlion-sinners-spoilers` | 12.00 s | Northernlion | Clean | [Source record](https://www.reddit.com/r/LivestreamFail/comments/1l8he7a/dumbdog_finally_explains_what_2_means_in/), [public mirror](https://arazu.io/t3_1l8he7a/). Only the opening movie/tennis misunderstanding is excerpted. |
| `ludwig-going-once` | 19.65 s | Ludwig | Clean | [Charity-auction source record](https://www.reddit.com/r/LivestreamFail/comments/14mlvb2/average_jerma_fan_makes_a_big_donation/), [public mirror](https://arazu.io/t3_14mlvb2/) |
| `caseoh-perfect-product-name` | 15.93 s | CaseOh | Mature | [Source record](https://www.reddit.com/r/LivestreamFail/comments/1jkee3b/caseoh_tries_to_pick_the_best_name_for_his/), [public mirror](https://arazu.io/t3_1jkee3b/). The rating includes the crude in-game names shown on screen. |
| `ninja-the-fattest-one` | 3.25 s | Ninja | Mature | [Contemporary source record](https://www.reddit.com/r/LivestreamFail/comments/bcx6nb/old_ninja_is_back/), [public mirror](https://streamable.com/4h6ow) |
| `drk-come-up-for-air` | 16.50 s | Ludwig | Mature | [Contemporary source record](https://www.reddit.com/r/LivestreamFail/comments/l80nui/dr_k_challenges_ludwig_to_make_a_dick_joke_out_of/), [linked public archive transfer](https://web.archive.org/web/20210129191002if_/https%3A//stream.livestreamfails.com/video/60145cd837ead.mp4). Dr K’s opening remains as context. |
| `maya-parrot-final-question` | 8.70 s | Maya | Teen | [Contemporary source record](https://www.reddit.com/r/LivestreamFail/comments/14zmhkx/let_the_parrot_speak_maya_ruining_the_stream/), [public mirror](https://arazu.io/t3_14zmhkx/). Only the final question is a recording cue; the interrupted explanation and parrot establish the joke. |

These are selections from documented creator performances, not a claim that each is a globally highest-viewed video or that every one appears in Choicer Voicer. They add seven selected voices, clean conversational humor, live-audience timing, animal interruptions, absurd gaming context, and uncensored lines. The two xQc excerpts come from separate documented source moments. Transcribed cues remain short (at most 25 words from each newly excerpted source work); no lyrics are transcribed.

## Source handling

The Delivery owner requested these short original-footage excerpts. Each new manifest truthfully records that third-party reuse rights were not independently verified. No creator license, public-domain status, endorsement, or permission is invented. Source URLs identify original Twitch clips when available; the linked public mirrors and exact transfer-relative excerpt boundaries remain in provenance. No Choicer Voicer assets, synthetic footage, voice clone, third-party player, paid ASR API, account cookies, login bypass, or official platform API key is used.

Ordinary public downloads succeeded through documented Streamable/Arazu mirrors and a contemporary Internet Archive alternative. Several unrelated YouTube media requests failed with HTTP 502 or execution-tool network-approval cancellation, and a Google sample CDN returned 403. Those inaccessible sources were not represented as playable catalog content.

## Preparation and verification

Source audio and video are trimmed together at their original speed. Local Whisper `base.en` supplies initial phrase timing; `small.en` independently checks ambiguous wording in the Ninja, CaseOh, Dr K, Northernlion tennis, and Maya sources. The Maya closing question is additionally supported by the contemporary source discussion. Uncertain earlier parrot-interrupted speech remains context, not guessed transcript cues.

Six single-speaker mixes are muted throughout their prepared backing. Four context scenes use interval muting, retaining other replies, audience reactions, or the parrot outside the selected intervals. These sources do not supply isolated dialogue stems: background sound also drops during replaced intervals. The Maya scene intentionally replaces only the closing question, as its role description states.

`node scripts/import-say-clips.mjs --probe` validates all catalog manifests, hashes, browser codecs, reference format, and timeline agreement within 60 ms. Decoded backing samples are checked for silence throughout each selected cue. Representative source frames and every shipped poster are inspected. This is engineering media QA; it does not claim physical-device recording tests or human listening acceptance. Publication status is recorded in the release commit and deployment history.
