# Delivery visual identity

The original neon direction from `573a658`, adapted to the current app.

- Near-black `#070707` and graphite `#0e0e10`: backgrounds and panels.
- Paper `#f5f2e8`: text and readable performance cards.
- Yellow `#ffdc66`: primary controls and score emphasis. Replaces the
  original lime to retain the requested no-green/no-mint palette.
- Electric blue `#5d7cff`: selections, levels and completed states.
- Hot pink `#ff4cc8` and violet `#a96cff`: supporting accents.
- Orange `#ff7a2f`: complementary emphasis.

The original blue/pink radial glows, translucent panels and neon button shadows
return. The homepage headline uses a white/blue/violet/pink gradient. Current
navigation, concise copy, focus styles and light-card contrast remain intact.

CSS/Tailwind tokens live in `src/app/globals.css` and `tailwind.config.ts`.
Canvas, OG cards and video output use `src/lib/visual-theme.ts`; keep them aligned.

The new speech-wave logo uses one path and a shared blue/violet/pink/orange
gradient in `src/lib/brand.ts`. The header/footer,
share cards, OG images, video headers and app icons use this same geometry.
Run `node --import tsx scripts/render-icons.mjs` to rebuild both public SVGs and
the four PWA raster icons. Maskable artwork stays inside the central safe area.

New renders use the theme. Existing finished videos are not regenerated.
Audio processing, storage, judging and live-room logic are unchanged.

Local preview accepts host/port flags through `scripts/dev.mjs`. Development
uses `.next-dev` so previews cannot overwrite production `.next` builds.
