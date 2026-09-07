# Reactive speech waveform correction

The waveform now redraws a rolling 650 ms window of the audible performance at 15 fps, following speech volume and rhythm and settling to a flat baseline in silence. It replaces the static whole-clip waveform and cursor. Shared preview/export geometry uses the trimmed source clock and Say It Back recording offset; reduced motion uses a stationary volume display. Audio is unchanged. Renderer version `delivery-vertical-v4` prevents reusing the previous visual treatment; already finished files remain available.

Twenty focused composition, preview and renderer tests and scoped lint pass. Four actual MP4s cover Classic, emotion/speed Switch and Say It Back; ten decoded-frame comparisons include the waveform region. Evidence: [render results](evidence/speech-waveform/render-results.json) and [preview/export comparisons](evidence/speech-waveform/composition-agreement.json).

---

# Compact Switch, speaking avatars and waveforms — September 7, 2026

This follow-up supersedes the application release recorded below. Switch now uses compact phrase choices and a single recording/replay stage, with the current emoji or speed and five-step progression above the avatar. Desktop and simulated 390×844 layouts were inspected.

The shared avatar artwork now visibly lifts, leans and scales with measured speech; silence settles it, uploaded images retain their proportions, and reduced motion suppresses movement. All three clip modes include an actual-audio waveform and synchronized playhead. Switch video presets put cues at the top and the avatar beneath them. Preview and MP4 use the same composition and original source clock, including trimmed cues and Say It Back offsets. Original audio and the existing dub mix are unchanged.

The renderer is `delivery-vertical-v3`. Saved settings carry `layoutRevision: 3`; only exact legacy Switch default placements migrate, while custom positions remain intact. Existing finished exports stay accessible and revised settings render a new version. No dependency, schema, infrastructure or Clipping changes are needed.

Focused checks cover Switch capture/recovery, avatar speech and reduced motion, preview interactions, waveform/trim timing, and saved-edit migration. Four actual MP4 samples cover Classic with an uploaded avatar, emoji Switch, speed Switch and Say It Back. Ten decoded frames agree with the shared preview within normal compression differences. See the [render contact sheet](evidence/switch-compact/v3-render-contact-sheet.webp), [render results](evidence/switch-compact/v3-render-results.json), [frame comparisons](evidence/switch-compact/v3-composition-agreement.json), and [uploaded-image speech motion](evidence/switch-compact/v3-upload-speech-motion.webp). Physical-phone microphone and native sharing remain outside these simulated checks.

Railway still requires an explicit update of the existing Delivery service's pinned source commit followed by deployment; pushing main alone does not deploy. The release report identifies the exact deployed revision.

---

# Previous avatar and clip editor release — September 7, 2026

**Previous deployed application:** [`0eec933901c41bbf22826faa5aa7f92983d903ff`](https://github.com/chrisA-cyber/Delivery/commit/0eec933901c41bbf22826faa5aa7f92983d903ff), Railway deployment `dc0df35d-35ad-4f52-ba50-226b2b3b6e23` (**SUCCESS**).

Extends the working export pipeline below. Railway’s Delivery service uses `chrisA-cyber/Delivery` **main** with a pinned `source.commitSha`; pushing main does not deploy it automatically, and ordinary redeploy repeats the pinned revision. Explicitly update that source commit and deploy this existing service, preserving its Dockerfile, Next process, serial FFmpeg worker, storage and ownership checks. Clipping remains untouched.

## Current player flow

Choose one of six custom illustrated avatars or upload a JPG, PNG or WebP in Settings or beside the recording controls. Uploads have a matching crop preview, drag/keyboard positioning and zoom; normalized images are bounded and stored with the existing guest/account identity. Avatar movement follows measured microphone levels during recording and saved voice levels during playback and export. Reduced motion removes the movement.

From a completed or saved performance, **Create video** opens the compact editor: shared video preview, two mode-specific layouts, avatar placement/size, caption and separate name/score toggles, trim, reset, save and export. Mouse, touch and keyboard positioning are supported. Say It Back keeps the entire scene framing and existing dub mix. Text is labeled as the challenge/script; it is not represented as a speech transcript. Trims use the original source clock for sound, scene, captions and Switch cues. Original takes and scores are immutable.

Edits reopen without recording again. Matching source/settings reuse an export; changed compositions produce distinct versions. Existing progress, retry, finished preview, download, supported native sharing, saved-performance access and same-challenge invitations remain. Earlier ready videos remain accessible. Additive migration `20260907201007_performance_clip_editor.sql` is applied; guest adoption, expiration and deletion follow source ownership. There is no new runtime AI call, paid service, audio effect, normalization, music or time stretching.

## Focused verification

Production build, scoped lint/type checks and focused renderer, backend, editor, recording and dub regression tests pass. [Render results](evidence/clip-editor/render-results.json) cover actual Classic, emotion Switch, speed Switch and Say It Back MP4s; [custom image rendering](evidence/clip-editor/upload-render.json) also passes. [Composition comparisons](evidence/clip-editor/composition-agreement.json) check 16 frames across trimmed cue/caption boundaries against the shared preview. [Audio comparisons](evidence/clip-editor/audio-agreement.json) verify the original sound and established dub mix. Browser checks cover the editor, accurate crop/zoom/reposition, avatar dragging, trim/save and a 390×844 workspace. Database checks cover saved edits, guest adoption, isolation and cleanup; disposable database fixtures were rolled back. The [live release checks](evidence/clip-editor/live-checks.json) cover disposable guest uploads in all three modes, avatar persistence and normalized uploads, saved-edit recovery, ownership denial, invalid trim rejection, matching export reuse, a changed-settings version, real private MP4 downloads/full decode, and unchanged original takes. All **52 live HTTP calls passed**, including owner deletion of all three disposable takes. [Actual hosted renders](evidence/clip-editor/live-render-inspection.json) and the [live contact sheet](evidence/clip-editor/live-render-contact-sheet.webp) confirm the uploaded crop, complete avatar artwork, retained scene framing and readable dialogue. Ten hosted frames match the shared preview within normal compression differences, including trimmed Switch and Say cue boundaries. The [deployment record](evidence/clip-editor/deployment.json) confirms the deployed commit and a browser-opened same-challenge invitation.

[Avatar artwork](avatar-art.md) documents the six bundled transparent portraits. [Rendered contact sheet](evidence/clip-editor/render-contact-sheet.png) and [phone workspace](evidence/clip-editor/phone-layout.jpg) show inspected samples. Physical-phone microphone acceptance, native sharing and audible OBS output remain unverified by these simulated/browser checks. Camera recording and face/lip tracking remain outside this phase.

---

# Previous performance video export release — September 7, 2026

**Tested application:** [`f62b84260d513f82b35a59800d0b6b04e2144105`](https://github.com/chrisA-cyber/Delivery/commit/f62b84260d513f82b35a59800d0b6b04e2144105), live on Railway in successful deployment `eef7aa16-7433-4615-9376-d546edef66b8`. The release report identifies any later documentation-only publication.

## Player flow

Open [Classic](https://delivery-production-0577.up.railway.app/play), [Switch](https://delivery-production-0577.up.railway.app/switch), or [Say It Back](https://delivery-production-0577.up.railway.app/say-it-back), finish a take, and choose **Create video**. Choose score/name visibility, generate, preview the actual finished MP4, then download or open supported native file sharing. Saved performances recover export status. Guest and unscored Classic can save for export without judging; unscored videos contain no invented result. Opening a device share menu is not reported as confirmed publication.

All modes use 1080×1920 H.264/AAC, measured waveforms, readable text, and restrained branding. Switch keeps one continuous recording and the same phrase across five emoji/emotion or speed cues. Say It Back uses the saved assembled take, measured offset, existing role backing/mutes and boundary fades, full scene aspect ratio, and stored phrase captions. No music, normalization, voice effects, or speech time stretching is added; compatible AAC copies when mixing/compatibility do not require encoding.

A short `deliverygame.netlify.app/a/code` invitation opens the exact immutable assignment and rules. It contains no recording, private round token, or host capability. Netlify redirects to the playable Railway app; Clipping and unrelated services remain unchanged.

## Access and operation

Videos remain private, with ownership/content checks on status and every media request. Watching a group submission does not grant export permission. Existing CC BY/public-domain film provenance permits eligible scene exports; unverified source reuse and Mature-publication restrictions return an explanation. No new rights metadata is inferred. Downloaded or externally shared copies cannot be remotely recalled.

The existing Railway app runs Next and one serial FFmpeg worker; existing Supabase stores immutable jobs and private files. Leases, fenced publication, bounded retries/time/duration/size, and cleanup tombstones handle interruption and deletion. Derived videos expire after seven days or the shorter guest-source lifetime. Original takes retain their existing retention rules. Additive migration `20260906233910_private_performance_videos.sql` is applied. No new service, recurring subscription, or AI call was required; the cumulative testing bound remains **$2.675 / $5**.

## Verified release evidence

- Application suite: **435 passed, three provider opt-ins skipped**; focused regressions, lint, typecheck, and production build passed. Database gates: **713 SQL assertions and 12 upgrade checks passed**.
- **69 live HTTP checks passed**, including owner cleanup and subsequent media denial. [Live export evidence](evidence/video-exports/live-exports.json) covers actual upload-only attempts, generation, recovered status, exact-request reuse, unauthorized collection/status/media/create denial, private downloads/ranges, source deletion/retry denial, and exact public assignments for all four samples. The owner export flow is supported by live HTTP and component tests. Browser checks opened exact Classic, speed Switch, and Say It Back assignments through Netlify; emotion Switch was verified through the assignment API; they do not establish a physical-phone export/share flow.
- [Actual-file inspection](evidence/video-exports/live-media.json) confirms H.264/AAC, 1080×1920, full decode and preserved duration for Classic **2.075s**, emotion Switch **20s**, speed Switch **20s**, and a five-line Say It Back scene **14.7s**. Audio matches the source or expected existing dub mix; cue/caption changes match within one frame. The Say retake changes only its selected interval, retains other speakers, and preserves the scene framing. Inspected text was readable without clipping; name omission and absent unscored results were verified. Samples use disclosed offline stock speech.
- Measured worker runs took **1.913s Classic**, **5.915s emotion Switch**, **5.792s speed Switch**, and **6.427s Say It Back**. The verifier's separate polling-wait field starts after access checks and is not end-to-end generation latency. An expired worker lease was deliberately simulated: the actual worker recovered the same job to ready on attempt two in **2.651s**, and stale publication was rejected. These are bounded examples, not latency percentiles.
- Railway's one-hour window contained 61 samples: maximum memory **0.4986 GB**, latest **0.3954 GB**, and maximum reported CPU **0.1872**. That window includes startup and the preceding release; it is not an isolated export peak or a monthly cost estimate. All four disposable sources were removed through owner APIs. A database check limited to the six fixture jobs found no remaining published objects or active/ready jobs; all seven cleanup receipts, including the old lease, were swept. The four downloaded sample copies were retained for the user. See [live operations](evidence/video-exports/live-operations.json).

## Brief physical-device check

On a real phone, finish a take, create its video, play the finished preview with sound, download it, and open native sharing. Confirm the download fallback if file sharing is unavailable. Listen to one showcased performance through OBS. Physical-phone sharing, real microphone acceptance, and audible OBS output remain explicitly untested by cloud evidence; no automatic social posting, camera, private Stage, or editor was added.
