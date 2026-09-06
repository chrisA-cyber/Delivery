# Classic Step 1C browser and playback evidence

Recorded 2026-09-06. **Nine focused browser tests passed, with 12 fresh full-flow screenshots and two exported score cards at 390px and 1440px.** This is headless Chromium responsive emulation with a synthetic microphone and mocked judge/transcript responses. There were zero real-device or human sessions. Existing Step 1B screenshots remain historical evidence and were not renamed or presented as new captures.

## Completed engineering

Inspection of history, public-take, and friend-match playback found native `<audio>` controls with no `error` recovery. Server-created playback links expire after five minutes. A page left open past expiry could therefore display unusable controls without telling the player what to do.

Added `src/components/game/saved-audio.tsx` and integrated it into those three surfaces:

- A media failure explains that the link may have expired or the connection dropped.
- **Reload playback** in history requests the existing owner-only `/api/deliveries/:id` route; public playback requests the existing `/api/share/:id` route. Both use `cache: no-store` and existing server authorization. No new access route or sharing permission was added.
- Friend-match recovery reloads the current matchup so its existing server checks issue fresh links. It does not call an owner-only API for another player's private recording.
- Refresh rejection displays the server's error and leaves an explicit retry action. There is no automatic request loop and no new judgment or quota charge.
- Unmounting pauses the media and releases its source, including when a content preference hides it. Development StrictMode setup restores the source after its deliberate cleanup replay.

The recovery branch is component-tested with synthetic media errors and mocked HTTP responses. **An actually expired Supabase Storage URL was not exercised by this UI test.** See the separate HTTP/service evidence and handoff for that integration boundary.

## Commands and actual outcomes

```sh
npm test -- src/components/game/saved-audio.test.tsx src/components/challenge/challenge-match-view.test.tsx
```

Final run: **2 files, 5 tests passed** (1.87 seconds). Covers explicit-click refresh, access rejection without a request loop, StrictMode source preservation, and mature-match concealment/stopping audio for both waiting and complete matchups. The first run exposed a missing React import for the repository's Vitest JSX mode; fixed before the successful run.

```sh
DELIVERY_EVIDENCE_DIR=docs/evidence/classic-step-1c/browser npm run test:e2e -- e2e/classic-rework.spec.ts e2e/classic-step-1b.spec.ts --grep 'Classic complete flow and evidence at (390|1440)px|submission failure preserves|next round and direct replay remain visible at (320|390|1440)px|private rehearsal|microphone.*recoverable'
```

The initial run started its local Next server but all nine tests were blocked at Chromium launch. The missing executable was `/root/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell`. This was an environment failure, not nine observed product defects.

```sh
npx playwright install chromium
```

The browser download from `cdn.playwright.dev` timed out after 30 seconds. Its automatic retry was cancelled rather than repeatedly requesting it. No browser binary was available in the standard executable locations or the advertised runtime dependencies. A temporary `@sparticuz/chromium` npm package, outside the repository, supplied **Chromium 149.0.7827.0**. No repository dependency or lockfile changed.

A temporary Playwright configuration preserved the repository test configuration and turned failure video off to avoid the absent bundled ffmpeg. The tests' own fake-microphone `launchOptions` overrode the configuration's custom executable path, so the extracted binary was linked into a separate temporary `PLAYWRIGHT_BROWSERS_PATH` cache at the expected executable location. Browser security flags were not weakened. The successful command was:

```sh
PLAYWRIGHT_BROWSERS_PATH=/workspace/scratch/85029a971f25/browser-runtime/playwright-cache DELIVERY_EVIDENCE_DIR=docs/evidence/classic-step-1c/browser npm run test:e2e -- --config=/workspace/scratch/85029a971f25/playwright.step1c.config.ts e2e/classic-rework.spec.ts e2e/classic-step-1b.spec.ts --grep 'Classic complete flow and evidence at (390|1440)px|submission failure preserves|next round and direct replay remain visible at (320|390|1440)px|private rehearsal|microphone.*recoverable'
```

Final run: **9 passed in 49.2 seconds**. On a normal development machine, install the repository's matching Chromium with `npx playwright install chromium` and run the first command without the temporary paths.

| Observed coverage | Result and limit |
| --- | --- |
| Complete home → prepare → record → review → judging → result | Passed and captured at 390×844 and 1440×1000 viewports. Screenshots are full-page, so some image heights exceed the viewport. No horizontal overflow detected. |
| Recording direction and microphone state | Inspected fresh images at both widths: line and full direction remain readable; mic-off, recording timer, stop, review playback, and private-submission copy are distinct. Synthetic audio is not a real microphone/noise-quality result. |
| Fast replay and another round | Passed direct playback time advancement and next-round button viewport checks at 320, 390, and 1440px. Same-direction retry preserves assignment and advances the take number. |
| Submission recovery | Controlled 503 preserves the same local audio; retry reuses the idempotency key; double-click sends one request. This is a mocked browser response, not a database/quota integration assertion. |
| Rehearsal privacy | Zero judge requests before explicit submission. |
| Microphone denied/missing | Controlled `NotAllowedError` and `NotFoundError` both recover without page reload. Real OS permission prompts still need device testing. |
| Result and card labeling | Both visibly say local fixture/not a live score. Mock companion transcript and accuracy detail remain separate; the score card says audio not included. |
| Challenge continuation | Result challenge link preserves prompt and direction. A real recipient/account matchup is outside this browser run. |

Fresh images were visually inspected. No new layout defect justified another design change. The tested pairing was `v2-favorite-child` (the emergency-contact line) with `v2-confidence-tears` (confident while holding back tears). This verifies presentation, not enjoyment or the quality of all catalog combinations.

| Screen | Mobile emulation | Desktop emulation |
| --- | --- | --- |
| Home | [390px](browser/home-390.png) | [1440px](browser/home-1440.png) |
| Prepare | [390px](browser/prepare-390.png) | [1440px](browser/prepare-1440.png) |
| Recording | [390px](browser/recording-390.png) | [1440px](browser/recording-1440.png) |
| Review | [390px](browser/review-390.png) | [1440px](browser/review-1440.png) |
| Judging | [390px](browser/judging-390.png) | [1440px](browser/judging-1440.png) |
| Result | [390px](browser/result-390.png) | [1440px](browser/result-1440.png) |
| Exported fixture card | [390px source](browser/share-card-390.png) | [1440px source](browser/share-card-1440.png) |

The configured cloud browser was also tried through its supported control interface; navigation to `http://127.0.0.1:3000` returned `net::ERR_BLOCKED_BY_CLIENT`. No browser security exception, alternate browser control mechanism, or deployment was used.

## Preview and remaining observation

`npm run dev -- --hostname 127.0.0.1` reported Next 15.5.24 Ready in 1.724 seconds with explicit mock judging. A separately launched `0.0.0.0` listener also reported Ready, but separate executor calls could not connect to either process's loopback port. The test runner's same-process-tree server readiness succeeded. No externally reachable preview URL is available from this session.

The [owner-run guide](../../playtesting/classic-step-1c/README.md) gives the local preview command and a concise session using the existing consent script, offline feedback form, and observation sheet. Actual owner work remains: open the preview with participants; collect consented human recordings for authorized live evaluation; observe unaided comprehension, recognition/skips, voluntary retries, privacy understanding, and live-feedback credibility; and exercise actual device microphone/playback behavior. The completed desktop/mobile viewport checks are emulation.

No catalog change or redesign was made without fresh pairing or comprehension evidence. The existing 86-line/36-direction content work is preserved. Live acting quality, restrained-direction calibration, humor, feedback grounding, accent fairness, and human enjoyment remain outside this component evidence.
