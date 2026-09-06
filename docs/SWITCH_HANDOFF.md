# Switch handoff — September 6, 2026

[Play Switch](https://delivery-production-0577.up.railway.app/switch) · [Host rounds](https://delivery-production-0577.up.railway.app/rounds?community=1) · [PR #5](https://github.com/chrisA-cyber/Delivery/pull/5)

## Release

Started from fetched main `92da8ed`. Verified Railway application `09f92c67b6b0db3c0716831ca70064164e960c9b` in successful deployment `62a70788-00aa-4ed9-a7a0-804841f0f697`; final publication also includes compact preparation cue cards and the verification/handoff. Final main/deployment values are recorded in PR #5, Railway, and the completion reply. Railway remains the playable app. Netlify's redirect still preserves paths and query parameters. The owner confirmed real sign-in works.

Applied additive migrations `20260906212111_switch_attempts.sql` and `20260906212209_switch_group_rounds.sql` to Delivery's existing Supabase project. Existing Classic/Say records, scoring, resources, and Netlify routing are preserved. Clipping is untouched; no new recurring services were added.

## Shipped

The final user direction is **the same short phrase repeated across changing cues**, replacing the earlier proposed three-section script. Eight curated challenges run for 20 seconds with five cues: four emoji/emotion challenges and four speed challenges. Emotion windows last four seconds each. Speed instructions are 1×, 0.5×, 0.25×, 2×, and 4× over 4/5/6/3/2-second windows. Players change their own delivery; capture and replay do not stretch, compress, or change the speed of their speech.

Preparation shows the phrase and sequence. Recording includes countdown, prominent current/next cues, progress, and a waveform. One uninterrupted take supports immediate local replay, full-take retry, upload recovery, saved reopening, synchronized cues after seeking, and feedback links into segments. Say It Back keeps its separate line assembly and partial-retake features.

Switch uses its own versioned full-audio judge, with one bounded evaluation carrying all cue context. It assesses words, requested delivery, and changes between cues. Feedback includes segment notes, one retry suggestion, and timing/judgment limitations. Quiet delivery can succeed; loudness and vocal identity are not objectives. Scores remain explicitly beta/unranked, with casual comparisons only for equivalent Switch assignments. Classic/Say historical scores and ranked leaderboards are unchanged; audience winners remain separate.

Navigation, solo play, history, direct friend challenges, private rounds, community assignments, host previews, broadcast cues, and linked rematches are integrated. Immutable snapshots preserve the phrase, cue sequence, timing, kind, and judging versions. Existing guest/account ownership, replacement, reveal, broadcast consent, content restrictions, retention, and deletion rules apply. No exports, optional camera, private live Stage, tournaments, or replacement hosting system were built.

## Verification and spend

- **50 deployed HTTP checks and 22 semantic assertions passed** across four independent guest sessions: emotion private rounds through reveal/seek; equivalent saved takes in community; consent, full replacement and stale-retry rejection; host preview, selected broadcast audio and Range playback; vote/self-vote/late-vote rules; duplicate-safe speed rematch, upload, submission, and deletion. All four synthetic transport recordings were deleted. [Sanitized evidence](evidence/switch/live-rounds.json).
- **667 SQL assertions plus 12 upgrade checks passed**, including both new migrations and legacy invariants. [Database evidence](evidence/switch/database.json).
- Application suite: **397 passed, one flaky Say It Back timeout; the 14-test focused Say It Back rerun passed**. Focused Switch/media/recovery tests passed. Final lint, typecheck, and production build all passed. Desktop browser review and microphone-unavailable recovery passed; cloud tooling did not provide a usable microphone or narrow-viewport control. This does not assert a single all-green full-suite run.
- Conservative budget accounting: **$2.675 / $5**, comprising the prior $1.675 and a $1 reservation for two bounded Switch evaluations. Actual provider billing remains unreconciled. The free HTTP fixture run made zero judge/provider calls. Both bounded live evaluations passed 11 checks each with one full-audio provider call per take; cached retries added no calls or quota, and both recordings were deleted. The neutral stock-voice emotion sample returned words 100, delivery 57, transitions 50. Quiet relative-speed speech returned words 100, delivery 88, transitions 90, overall 92. These samples verify integration and demonstrate one successful quiet case; they do not establish human score calibration or enjoyment.

## Brief owner check

On a physical phone, record an emotion and speed take, retry, reopen, and seek between cues. In OBS/browser, enable audio and listen to one showcased Switch performance, then vote and rematch. Cloud/HTTP evidence cannot establish physical microphone behavior or audible OBS output. Human calibration and real-player enjoyment remain unproven; follow observed problems rather than restarting broad synthetic tests.
