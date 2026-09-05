# Supporting-screen evidence

Captured from the local Next.js development preview with Chromium by `e2e/supporting-ui.spec.ts` on September 5, 2026.

Every PNG includes a **LOCAL TEST FIXTURE** footer. The account response is a named Pro UI fixture with zero activity; it exercises the actual supporting components without signing in, provisioning an account, changing billing, publishing, or sending invitations. Feed and leaderboard screenshots show the genuine unavailable states from unconfigured service responses. They contain no fabricated community performers or rankings.

## Screenshots

Each screen has a `-390.png` mobile and `-1440.png` desktop image:

- `discover`: pack browser, actual filtered line counts, and content controls.
- `challenge`: line selection, compatible direction, and private invite preview.
- `stream`: host controls, clean default content, and a clearly labeled example stage.
- `settings`: content, playback, privacy, and account controls.
- `profile`: empty fixture history and milestones, without fabricated accomplishments.
- `pricing`: current Free/Pro presentation; no billing actions were executed.
- `feed`: unavailable community service.
- `leaderboard`: unavailable rankings and actual eligibility explanation.

Screens were visually inspected after capture. Layout assertions cover **320, 390, 768, and 1440 pixels** across 11 routes, including pack details, sign-in, and privacy.

## Verification

- `node node_modules/playwright/cli.js test e2e/supporting-ui.spec.ts --reporter=line`: **9 passed**. Includes 44 route/viewport checks, mature opt-in and downgrade filtering, exact challenge deep-link pairing, challenge rating request data, independent clean Stream defaults, removal of invented community content, and public-profile request recovery/block hiding.
- Existing `e2e/public-routes.spec.ts`, selected with `--grep 'discover|feed|leaderboard|challenge|stream|pricing|settings|login|submit|guidelines|privacy|terms|endless|impossible'`: **14 passed**, with the original document-response, crash, title, main, and page-error assertions retained.
- `node node_modules/vitest/vitest.mjs run src/components/challenge/challenge-match-view.test.tsx src/components/game/endless-shell.test.tsx`: **4 passed**. Waiting/completed mature matches conceal verdicts/audio until consent and stop playback when lowered. Synthetic Hot Streak results do not affect live-score counters.
- Whole-repository `node node_modules/typescript/bin/tsc --noEmit`: passed at integration handoff.
- ESLint on the modified supporting components, route wrappers, and supporting tests: passed.

Browser checks used `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000` and `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/delivery-playwright`. In this workspace the bundled Node path is `/Users/christopherassef/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`.

These checks establish local interaction, rendering, filtering, and client recovery contracts. They do **not** establish live authentication, payment, publication, invite delivery, or human performance quality. The root implementation handoff documents the service integration status separately.

## Supporting implementation file ownership

The supporting UI subtask changed these files (repository-relative paths). `e2e/public-routes.spec.ts` was shared with the integration owner; this subtask changed only the supporting-route headline expectations.

```
src/components/shell/page-shell.tsx
src/components/discover/pack-browser.tsx
src/components/discover/pack-detail.tsx
src/components/discover/submission-form.tsx
src/components/challenge/challenge-builder.tsx
src/components/challenge/challenge-match-view.tsx
src/components/challenge/challenge-match-view.test.tsx
src/components/stream/stream-setup.tsx
src/components/profile/badge-shelf.tsx
src/components/profile/profile-view.tsx
src/components/profile/public-profile-view.tsx
src/components/social/delivery-feed.tsx
src/components/social/leaderboard.tsx
src/components/social/public-delivery.tsx
src/components/settings/settings-panel.tsx
src/components/auth/auth-panel.tsx
src/components/legal/legal-page.tsx
src/components/pricing/pricing-table.tsx
src/components/pricing/pro-gate.tsx
src/components/game/endless-shell.tsx
src/components/game/endless-shell.test.tsx
src/app/challenge/page.tsx
src/app/challenge/[code]/page.tsx
src/app/discover/page.tsx
src/app/discover/[packId]/page.tsx
src/app/endless/page.tsx
src/app/impossible/page.tsx
src/app/feed/page.tsx
src/app/leaderboard/page.tsx
src/app/login/page.tsx
src/app/pricing/page.tsx
src/app/settings/page.tsx
src/app/stream/page.tsx
e2e/public-routes.spec.ts
e2e/supporting-ui.spec.ts
```

## Final statistics review follow-up

`src/lib/profile-statistics.ts` and its test now define the comparison pool used by ProfileView's local overview, Pro axes, and category statistics: confirmed `source: ai` receipts with either `delivery-voice-v1` or an absent score version. Fixture receipts, unknown sources, and explicit incompatible versions remain readable in history with exclusion labels. Their scores do not enter these local aggregates. `src/lib/profile-statistics.test.ts`: **2 passed**; focused ESLint passed. No additional browser run was needed for this data-only follow-up.
