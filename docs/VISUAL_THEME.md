# Delivery visual theme

Midnight stage theme, September 2026. No green or mint interface accents.

- Midnight `#0b1020`: page background and dark text on light cards.
- Slate blue `#141c31`: panels, forms, recording and room surfaces.
- Ice `#eef2ff`: body text and light performance cards.
- Amber `#ffc266`: primary actions and score emphasis.
- Blue `#8eb8ff`: selected controls, levels and completion states.
- Lavender `#c4b5fd`: supporting accents and Switch/Roast elements.

Use the shared CSS/Tailwind tokens in `src/app/globals.css` and
`tailwind.config.ts`. Canvas, OG cards and video output use
`src/lib/visual-theme.ts`; keep those values aligned. Existing persisted badge
colors are mapped at display time; awards are not changed.

The homepage prioritizes four modes. Secondary destinations live in More;
mobile navigation retains all destinations. Classic light-card buttons have
explicit dark text and focus styles. Roast Off offers private hosting/solo
play while offline, with battle details in an expandable section.

New renders use the theme. Existing finished videos remain valid and are not
regenerated. Audio processing, storage, judging and live-room logic are unchanged.

Local preview accepts standard host/port flags through `scripts/dev.mjs`.
Development output uses `.next-dev` so previews cannot overwrite production
`.next` builds.
