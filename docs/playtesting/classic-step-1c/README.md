# Step 1C: owner-run Classic session

**Prepared 2026-09-06. Actual participation: zero people, zero consented recordings, zero physical devices tested in Step 1C.** This is a runnable continuation of the [existing facilitator guide](../classic-step-1b/FACILITATOR.md), not a replacement study or a completed playtest.

## Start the preview

From the repository on the machine where the browser will run:

```sh
npm ci
DELIVERY_AI_MODE=mock DELIVERY_AI_ALLOW_MOCK_FALLBACK=true NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000 npm run dev -- --hostname 127.0.0.1
```

Open `http://127.0.0.1:3000/` on that machine. The server starts successfully in the Step 1C executor, but separate tool processes and the cloud browser could not reach its loopback address. This address is **not a publicly hosted preview**. No deployment was created. A phone needs an already authorized secure test origin; its own `127.0.0.1` is not your computer. Do not disable microphone security or expose the dev server to work around this.

Mock mode permits a flow/content pilot with normal microphone capture and local replay. Announce that the judge is synthetic; feedback credibility and competitive scoring cannot be measured in this mode. Guest audio is not kept in durable history. Reloading/leaving the active game can lose its local recording; use **Save take** first if the participant has agreed to retain it.

For the live session, first configure the authorized provider and isolated Supabase test environment following [ENVIRONMENT](../../ENVIRONMENT.md) and complete the bounded [judging preflight](../../JUDGING_EVALUATION.md). Set live mode explicitly and disable mock fallback. Do not paste credentials into chat, use production accounts, or collect recordings without separate consent. Check the displayed judge source for every session. A synthetic result does not become live evidence because an account is connected.

## Fifteen-minute first session

Use the opening script and consent guidance in the existing facilitator guide. Start Clean, stay camera-free, and let the participant control volume and interpretation. Record a participant code, build commit, actual browser/device, judge mode, and guest/test-account status. Open [feedback.html](../classic-step-1b/feedback.html) locally and reuse [observations.csv](../classic-step-1b/observations.csv); both remain unchanged.

| Task to give | Record without coaching |
| --- | --- |
| “Find a way to play one round.” | Unaided explanation of the game and whether they expect a camera; time to first recording. |
| “Choose a line you would perform.” | Exact prompt/direction IDs, unaided recognition, every skip and its reason. Avoid creator-name hints. |
| “Make a take, listen, and decide whether to keep it.” | Direction readable while recording, microphone state comprehension, replay/retake discovery. |
| “Tell me what happens when you submit, then submit when ready.” | Private provider processing versus publication understanding; any confusing waiting/recovery state. |
| “What does the feedback mean?” | **Live only:** one feedback claim and its audible supporting/contradicting moment; one usable coaching adjustment. In mock mode select `fixture` in the feedback form and skip credibility. |
| “Do whatever you would naturally do next.” | Voluntary replay, same-direction retry, new line, challenge, or exit **before** asking for another round. Allow up to three rounds. |
| “Challenge the prepared test friend with this line.” | Live isolated-account session only: invite → recipient opening → take → matchup result. Keep invites within the agreed test pair; do not send unsolicited messages. In mock mode record the sign-in/service block. |

Debrief: funniest pairing, weakest pairing, recognition versus enjoyment, camera-free completeness, and whether privacy matched expectations. Export the form; leave private audio, transcripts, consent receipts, and identifiable exports outside Git. Continue the existing six-person study only as needed; its proposed criteria remain unmeasured until real observations exist.

## Exact remaining owner actions

1. Supply the authorized local/test runtime and provider configuration through environment settings, plus an explicit live request/spend ceiling. The repository's evaluation manifest lists the consented samples required; record those or provide already-consented samples privately. Synthetic sound cannot validate acting or humor.
2. Open the local preview on desktop and an authorized secure preview on a real iPhone/Safari and Android/Chrome if available. Exercise microphone allow/deny/retry, recording interruption, review playback, result replay, and another round. Log device/OS/browser versions; viewport emulation is not a device result.
3. Run at least the first observed session above, then the existing planned cohort as needed. Record actual behavioral counts and disagreements; do not infer enjoyment from successful UI automation.
4. In the isolated connected session, play a saved take, let its five-minute signed URL expire, and choose **Reload playback** if playback fails. Verify fresh playback, revoked/private access errors, and the friend matchup after refresh. This rechecks access; it must not create another scored attempt.

Return anonymized counts, skipped prompt IDs, concrete confusing interactions, feedback quotes tied to audible evidence, and device failures to the planning chat. Keep the distinction between completed engineering and external product validation.
