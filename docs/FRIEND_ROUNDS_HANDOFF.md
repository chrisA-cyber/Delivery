# Delivery friend-round milestone — September 6, 2026

**Status: implementation complete; integration, live verification, and publication in progress.** This supersedes earlier short-catalog and never-merge guidance. Merging completed work and deployment are owner-authorized.

## Publication record

| Item | Final evidence |
| --- | --- |
| Main / application commits | Pending |
| Railway deployment identity and deployed revision | Pending |
| Railway / Netlify branch topology and resulting status | Pending; main alone may not deploy Railway |
| Required gates / multi-session service and browser checks | Pending actual results/evidence |

After publication: [Classic](https://delivery-production-0577.up.railway.app/play), [Say It Back](https://delivery-production-0577.up.railway.app/say-it-back), and [create a friend round](https://delivery-production-0577.up.railway.app/rounds). Rounds supply private invitations.

## Implemented

**Recording:** displayed line windows and media-clock stopping now agree, including when rendering is throttled. Smaller capture blocks and measured saved/full-take waveforms support Listen/Record/Redo, preserved interrupted takes, immediate assembled preview, stale-score rejection, and save/reopen. Speech is not stretched or given arbitrary offsets. The original cloud overrun’s physical-device cause remains unproven; local preview speed does not establish backend judging speed.

**Content:** seven new immutable scenes bring the catalog to seventeen. Additions run 10.60–17.55 seconds with 2–5 recording lines; four are Clean. Assets include video, poster, measured reference audio, precise cues, and backing audio retaining film replies with short fades. The 20-second limit and historical versions remain unchanged.

**Groups:** `/rounds` extends the existing challenge system with one immutable Classic assignment or Say It Back scene/role, up to twelve participants, display-name guest joining, private rehearsals, explicit submission, replacement before closure, progress polling, and host or automatic reveal. Deadlines offer 1/24/72/168 hours. Results center on replay, Original/Take comparison, compatible scores/ties, and a separate funniest vote: one per participant, no self-vote. Rematches retain previous results and provide a new invitation.

## Privacy and operation

Invitation tokens grant joining access; hosts can revoke new joins. Server/database rules enforce membership, reveal, ownership, idempotency, and closure races. Clean/Spicy gates precede exposure; Mature stays private. Guest cookies preserve access, with eligible account claiming after sign-in. Display names are unverified.

Scores are optional. Explicitly consented unscored performances can enter the private group as **unreviewed**; known rejected or review-held recordings cannot. Full matching and words-only results remain separate, and Classic scores never mix with Say It Back. Public-feed moderation is unchanged.

Group replay lasts seven days after closure, bounded to fourteen days from creation. Submitted guest Say sources last through that window; ordinary guest Say drafts expire after 24 hours. Existing Supabase/private storage, cleanup, and account erasure cover group assets.

## Evidence, cost, and remaining acceptance

The publication table must distinguish actual gates/service checks from synthetic fixtures. No new paid provider tests: cumulative conservative spend remains **$1.675 / $5**; the allowance is not reset.

Source provenance and reuse limits are in [SAY_IT_BACK_MEDIA.md](SAY_IT_BACK_MEDIA.md). xQc reuse permission is not independently verified; public-domain findings are US-specific. Mixed soundtracks still lose background audio during replaced dialogue. Physical microphone/listening acceptance remains outstanding; cloud fixtures do not establish device quality or enjoyment. GitHub OAuth remains owner-confirmed; SMTP and Stripe are outside this free-play milestone.

**Brief owner session:** on desktop, record two lines, redo one, compare and submit; on phone, join as another guest and submit. Close the round, watch both takes, vote, and open its rematch. Include one same-browser sign-in/return. Report only demonstrated issues with device/browser details.
