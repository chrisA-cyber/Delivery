# Roast Off — September 7, 2026

Entry: `/roast-off`. Private host setup: `/roast-off/new`. One moderated public stage (`/roast-off/main`), private rooms through revocable invitations. The entry reports configuration/offline/empty states from the server, with no invented audience. A signed-in host owns each private room. Public hosting requires an existing moderator/admin role or the narrowly scoped `ROAST_PUBLIC_HOST_IDS` allowlist; the verified owner account is configured there. Visitors never receive moderator authority.

## Live implementation

LiveKit Cloud carries actual WebRTC audio/video; Railway keeps Next.js, the existing FFmpeg export worker, and a small Roast Off clock worker. Existing Redis stores room state behind a fenced distributed lease. Supabase provides verified accounts, existing signed guest identity continuity, moderation reports, and expiring result summaries. No recordings, egress, AI judging, transcription, media storage or new paid service are enabled.

Audience joins receive-only; device acquisition occurs only through the user's private microphone/camera preparation controls. Signed-in adult performers explicitly consent to the roast and accept a 20-second invitation. Cameras are optional. Tokens initially grant no publishing, no data publishing, no screen sharing, and no room administration. The server restricts active-turn sources to microphone plus optional camera, and the other performer to optional camera. SFU source revocation removes the old microphone before granting the next, preserving camera video. A lifted host mute still requires the participant's own unmute. Removal denies future app tokens and revokes existing Cloud tokens. Closing revokes the issued identity ledger before deleting the SFU room.

Format: three-second introduction; A/B/A/B at 30 seconds each; three-second final-audio buffer; 15-second audience vote; six-second result. Winner stays up to three wins; draws/zero votes rotate both. One effective vote per established identity, changes allowed until the server deadline, no performer votes. Eligibility is frozen before voting opens. This limits casual duplicate voting, not determined multi-account abuse.

Only the worker advances timed phases. UI deadlines are displays, not clocks of record. Commands, invitation acceptance, and voting bind to the current state/battle. Host/action retries and queue changes serialize through the lease. Media synchronization succeeds before new timed states become visible. Failed transport is a technical pause/no-contest, not an invented audience verdict. A single performer gets a 12-second reconnect window; a started battle can end in a forfeit. Host absence pauses at 20 seconds and closes at 120 seconds. Explicit host pause/skip/close and voluntary step-down remain available.

Chat is room-scoped (280 characters, eight messages/10 seconds per identity); reactions are 12/10 seconds and expire after six seconds. Keep at most 100 chat messages for 15 minutes, 20 recent reactions, and 20 visible results. Blocking hides room chat/reactions and incoming audio/video locally; reports enter the existing staff queue with manual review bookkeeping. Host mute/remove/ban and message removal act inside the room. Adult acknowledgement is consent/policy acknowledgement, not age verification. Rules forbid threats, doxxing, protected-trait abuse and targeting uninvolved spectators; consensual insults are expected. Copy explains that other participants can capture a session externally.

## Configuration and cost bounds

Required server variables: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. Production accepts LiveKit Cloud endpoints because token revocation is a Cloud guarantee. Secrets never enter client bundles. Regional LiveKit signaling origins are in CSP; camera permission is enabled only on Roast Off pages.

Initial application caps: **two active rooms total, 28 connected identities per room (including host), queue 12, one-hour maximum session**. The usual full stage is two performers, 25 audience identities and a host. Empty app rooms close after a bounded absence; SFU empty/departure timeouts also release media. Up to 512 historical identity bindings are retained for token revocation during a session; state expires after 24 hours. Results expire within 30 days and are service-only. No capacity claim inherits the recorded-community-round limits.

The [LiveKit Build plan](https://livekit.com/pricing) is $0, no card, with 5,000 participant-minutes/month, 50 GB downstream and 100 simultaneous connections across the project. It has hard [quota limits](https://docs.livekit.io/deploy/admin/quotas-and-limits/); exhausting these makes media unavailable rather than silently buying a subscription. Allowances are shared with any other apps on the same LiveKit project. No paid upgrade is authorized or selected here.

Encoding targets: two optional 360p/15fps VP8 cameras at up to 350 kbps each, one active mono Opus microphone at 32 kbps. The following model assumes both cameras transmit continuously, each spectator receives both, performers receive the opponent, and 20% transport overhead. Adaptive delivery and voice-only play can reduce bandwidth; these are estimates, not measured bills. Host is included among the spectator count in this table.

| One hour | Participant-minutes | Estimated downstream | Build | Ship usage after its included allowance |
| --- | ---: | ---: | --- | ---: |
| Two performers + 25 spectators | 1,620 | 10.28 GB | $0 while allowance remains | $2.04 |
| Two performers + 100 spectators | 6,120 | 39.92 GB | Exceeds Build concurrency/minutes | $7.85 |

Ship starts at $50/month including 150,000 minutes + 250 GB, then $0.0005/participant-minute and $0.12/GB. The last column is marginal usage beyond those inclusions, excluding the monthly base. Voice-only models are about 0.45/1.75 GB with unchanged participant-minutes. Railway/Supabase usage remains part of the owner's existing resources.

## Verification and release

Additive migration `20260907011002_roast_off_history.sql` is applied to Delivery Supabase. Focused SQL checks passed 25 Roast assertions plus 50 existing reporting/moderation assertions; remote service-only privilege checks denied anonymous result reads/writes and review RPC access. Focused application tests cover phase/queue concurrency, permissions, voting, failure/recovery, device consent and API validation. Release commit, deployed revision, exact final test totals and actual media evidence are recorded below after the release run.

`scripts/verify-roast-live.mjs` uses ordinary Supabase test-account sign-in, real app HTTP controls and independent native LiveKit RTC clients with generated audio/video. `scripts/roast-verify-once.ts` is an explicitly enabled, Redis-claimed one-shot operation (`ROAST_VERIFY_RUN_ID`); it exposes no test HTTP endpoint, exports no credentials, installs its test-only native SDK into temporary disk, and never repeats on ordinary restarts. Its bounded finalizer closes its own private room and deletes its disposable users. Clear the operational flag after verification. The native transport run cannot establish browser microphone capture or physical-phone audio quality.

Pending release evidence: hosted multi-client media and rendered UI verification are not yet reported as passed. Short final human acceptance: two real devices/headphones, optional camera preview, one full battle, audience vote, and next challenger. No automatic recording or live-battle exports are included.
