# Delivery friend-round milestone — September 6, 2026

**Shipped and merged in [PR #3](https://github.com/chrisA-cyber/Delivery/pull/3).** Railway is the playable pilot. This supersedes historical short-catalog and never-merge guidance.

## Publication record

| Item | Verified identity |
| --- | --- |
| Application | `ed38bdb591dfc6220e3c3a66f507c5f5547179a3` (initial feature commit `23177da18a46293961a0b83bf855da20250d0a6b`) |
| Main release merge | `c2f4cfef7e251f71e013c107d8bef79d019ac697`; subsequent handoff/evidence updates change no application code |
| Railway | **SUCCESS**, deployment `b87c0471-9f1f-472a-b92b-2a78a77662a6`, application `ed38bdb` |
| Netlify | Production **ready**, deployment `6a9d92bd0c117b00080813d9`, main merge `c2f4cfe`; same application code, backend unavailable |
| Database | Isolated Delivery project `rcsopyxrotbbfaqikire`; additive migrations `20260906154403` and `20260906160409` applied |

Play [Classic](https://delivery-production-0577.up.railway.app/play), [Say It Back](https://delivery-production-0577.up.railway.app/say-it-back), or [create a friend round](https://delivery-production-0577.up.railway.app/rounds). The round supplies its functioning private invitation.

Railway still uses `codex/classic-railway` with an explicit source commit. Updating a Git branch or calling ordinary redeploy did **not** select new code: update the Delivery service’s source commit and commit that staged change, then verify the deployment’s actual commit. Main triggers Netlify. No Railway secrets were copied to Netlify; its gameplay API remains unconfigured. Handoff-only commits do not represent a different application release. Final repository/deployment pointers are also recorded on PR #3.

## Shipped

**Recording:** first-click Listen, media-clock line stopping, clear dialogue/capture windows, smaller capture blocks, measured saved waveforms, preserved interrupted retakes, immediate assembled preview, and stale-score rejection. Omissions remain silence; speech is not stretched. Full-scene instructions now match the selected mode.

**Content:** seven new immutable scenes, **10.60–17.55 seconds**, 2–5 selected-role lines, four Clean; seventeen scenes total. Historical versions remain intact. Video, posters, measured reference waveforms, precise cues, retained film replies, and short audio fades ship together. The 20-second cap is unchanged.

**Groups:** one immutable Classic or Say assignment; up to twelve display-name guests; private practice; explicit consented submission/replacement; 1/24/72/168-hour deadlines or early host reveal; progress; private replay and Original/Take comparison; separate compatible score rankings; funniest voting with ties; rematches that retain previous results and can switch modes.

Invitation tokens grant joining access and can be revoked. Server/database rules enforce ownership, membership, content eligibility, reveal, voting, and closure races. Clean/Spicy preferences apply before exposure; Mature remains private. Eligible account claiming preserves guest group access. Display names are unverified.

Scores are optional. Unscored private shares are explicitly **unreviewed**; known rejected/review-held content is blocked. Public-feed moderation is unchanged. Group replay lasts seven days after closure, bounded to fourteen days from creation; submitted guest Say sources are retained through that window. Existing cleanup, private storage, and account deletion cover group media.

## Evidence and limits

[Evidence](evidence/friend-rounds/): **363 application tests**, lint and production build; **579 full SQL assertions/12 upgrade checks**, then **65 focused group assertions** and a real service-role rollback probe. Live verification passed **49 HTTP requests** across three isolated cookie jars plus a cloud-browser guest: replacement, unauthorized access, reveal, range replay, votes, rematch, content gates, and concurrent close/submit. Fixtures contain real reference WAVs and **no invented scores**. Two live defects—helper permission and internal-origin links—were fixed and rechecked.

Rendered builder/recording/reveal pages and browser create/join/copy/replay/vote/rematch were inspected. Listen stopped at 2.478, 5.29, and 5.97 seconds as displayed; the reported overrun was not reproduced. Upload/persistence for three 16.55-second fixtures took 1.074–1.089 seconds; this is not judging or capture latency evidence.

**No new paid calls: $1.675 / original $5 cumulative cap.** GitHub OAuth remains owner-confirmed; new live account claiming, physical microphone capture, phone layout, and subjective listening remain unverified. SMTP and Stripe remain unavailable/outside this free-gameplay milestone. [Media provenance](SAY_IT_BACK_MEDIA.md) retains unverified xQc reuse permission and US-specific public-domain limits; mixed tracks still lose background sound during replaced dialogue.

**Brief owner session:** desktop—record two lines, redo one, compare and submit; phone—join and submit. Close, listen to both dubs, vote, and rematch. Include one same-browser sign-in/return. Report only demonstrated issues with device/browser details.
