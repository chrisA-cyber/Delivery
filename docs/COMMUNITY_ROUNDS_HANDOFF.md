# Community rounds handoff — September 6, 2026

[Play](https://delivery-production-0577.up.railway.app) · [Host](https://delivery-production-0577.up.railway.app/rounds?community=1) · [Join by code](https://delivery-production-0577.up.railway.app/join) · [PR #4](https://github.com/chrisA-cyber/Delivery/pull/4)

## Release

Started from fetched main `2be9ebe`; preserved the prior worktree. Implementation commits: `7de3877` (community rounds/claim return), `3d395ea` (polling and UI polish), `f320ffb` (results replay), `ea28e69` (automatic broadcast next-round transition). The remaining PR changes are this roadmap/handoff and evidence. Compare the PR merge against `ea28e69` to establish the unchanged application tree.

Railway Delivery service `34d3b855-25f3-4eea-9438-c43974cef738`, project `321c764e-38fe-4ecb-98f2-39c8654d0956`, production environment `8470f7d3-49f4-41bc-b39e-65fc1e5a1e22`. Its actual source initially pointed at `codex/classic-railway`/`ed38bdb`; it was explicitly advanced to this implementation, not assumed to follow main. Verified deployment `fbb3b626-6173-49ce-a8d9-22bf05810b65` serves `3d395ea`. Final release deployment/source is recorded in PR #4 and the delivery response after merging. Netlify previews build successfully and main triggers production deployment, but its backend is still unconfigured; Railway remains playable. No credentials were copied. Clipping, Redis, cleanup scheduling, and unrelated services were unchanged.

Additive migration `20260906165536_community_rounds.sql` was applied successfully to the existing isolated Delivery Supabase project `rcsopyxrotbbfaqikire`.

## Delivered behavior

Guest return automatically requests the authenticated claim only when the original signed guest cookie identifies a claimable member. Missing/malformed cookies cannot authorize a claim; claimed cookies alone lose access and invite holders see sign-in/recovery guidance. Existing member IDs retain submissions, votes, host ownership, and round relationships. A retry is harmless. Supabase remains responsible for actual OAuth and verified account identity; no fabricated session or auth bypass was added.

Community rounds reuse challenges, members, takes, private storage, score caches, and the existing editors. They support 10–50 submitted performances (25 default), up to 500 joined identities, and up to 12 selected entries. Deadlines use the existing 1/24/72/168-hour choices; a host can close early. Close enters private review; showcase, voting, and results are explicit permission-checked phases. Parent-row locking serializes submissions and transitions. Duplicate display commands and rematches do not replay/split the round.

Every broadcast submission requires consent attached to that exact take. Replacement clears selection. The host cannot turn private drafts into consented performances. Private preview and audience audio are separately authorized; the display ignores host cookies, exposes selected eligible entries only, and uses a separately revocable token. Codes locate invitations and grant no host rights. Known held/rejected media, blocked/deleted accounts, and Mature content remain excluded. Community Say scenes use the catalog's CC BY/US-public-domain license entries; unverified xQc reuse is not offered for broadcast. Existing historical content versions remain intact.

Voting accepts only eligible showcased entries: one effective vote per identity, changes while open, no self-votes, server-side late rejection, explicit ties and no-vote results. Audience favorite stays separate from Classic judging/full matching; words-only scores remain separate. Guest controls suit casual communities, not determined repeat-account abuse.

The broadcast has submission/QR, showcase, voting, and result layouts. Host play/pause/replay/skip is polled; next-round links advance the display automatically. Audio requires a display-tab enable action and retains that choice within the tab; browser rejection remains visible. Dub video stays muted while replacement audio/backing tracks play. No viewer-wide video synchronization or stream ingestion was built. Hidden tabs pause polling; active showcase display reads every 2.5 seconds after each response, voting every 5 seconds, idle every 15 seconds. Slow reads cannot overlap and starve updates. Queues do not download or score recordings; media loads on demand.

The existing 20-second recording, upload-size/rate limits, per-member take cap, and cleanup worker remain in force. Replay lasts seven days after submissions close, bounded to fourteen days from creation. Submitted guest Say sources are extended through that window. In-app deletion removes access but cannot retract externally recorded broadcasts; consent copy states this.

## Actual verification

- Application suite: 367 passed initially; two unchanged tests timed out during a concurrent build, then both passed in the focused 23-test rerun. One later polling regression also passed: **370 distinct application tests passed across these runs**, three existing integration tests skipped. No claim of a single all-green full run. Lint, production build, and final UI typecheck passed.
- **621 PostgreSQL assertions plus 12 upgrade checks**, including 39 community assertions; real service-role creation probe rolled back successfully. Claim/reclaim, cookie loss of authority, host account recovery, deletion/FKs, retention, voting, permissions, and idempotency are covered. This is authenticated-path/SQL evidence, not a live identity-provider login.
- **106 passing deployed HTTP checks** across six independent guest cookie jars: both modes, two performers, replacement, consent rejection, private/hidden media denial, host range preview, selected playback, close retries, votes, results, linked rematch retries, and display/invite revocation. Audio is an existing 16.55-second reference WAV fixture; no human recording or invented score. [Sanitized evidence](evidence/community-rounds/live-http.json).
- Browser: rendered desktop builder, host queue, voting and display; create, private preview, select two, close, showcase, enable audio, remote play/pause/replay/skip, vote/change, matching host/display result, refresh and rematch. Playing media had no errors; video muted, both dub audio elements active. Final small UI follow-up spotchecks are recorded in PR #4 after deployment.
- HTTP median **7.868 seconds**, maximum **15.180 seconds**, includes the agent's network proxy and is not isolated server latency or a load test. A separate Server-Timing probe was interrupted by the environment network approval mechanism. Successful round responses now expose server duration in the standard header for future diagnosis. No performance claim beyond these samples.

**Costs: $0 new provider calls; cumulative $1.675 / original $5 cap.** No new recurring resources. Existing broad `/api/health` still reports missing configuration (including unavailable payment configuration); Railway's configured `/play` health route and free round flows work. SMTP/payments remain outside this milestone.

## Exact remaining owner session

No authenticated Delivery browser session or owner GitHub login was available. On the same browser that joins/submits as a guest, choose **Sign in & keep my access**, complete the real provider login, and confirm return to the same member/submission. Sign out/in and repeat for a guest host. The application/SQL claim path is verified separately; the full external login path is not yet accepted.

Use a physical phone to join by code, record/redo/submit, return from sign-in, then watch and vote without microphone access. Open the display in OBS/browser, enable audio, listen for one dub without doubled reference speech, reveal results, and rematch. Cloud-browser tools did not provide mobile viewport emulation, physical microphones, or subjective audio listening; none is claimed. Report demonstrated issues with device/browser details. No paid synthetic batch is needed.
