# From the web stage to the Roblox stage

Source snapshot: 242289a, GitHub main. Read PRODUCT_AND_FLOWS and DELIVERY_2_ROADMAP first. The roadmap contains historic release claims and proposals. The code below supplies the implementation reference.

| Source in web tree | Decision |
|---|---|
| src/data/content.ts, ORIGINAL_PROMPTS; src/data/classic-content-v2.ts and legacy-content.ts | Screen original everyone-rated lines individually, keep text and IDs together. Older lookup tables are candidates when they add a distinct clean bit. Explicit approvals guard against future upstream changes. |
| src/data/content.ts, ENERGY_MODIFIERS and PACKS | Attach a measure to every selected direction. Some directions ask the room to judge acting. Regroup safe packs around everyday mishaps, backstage and games. Exclude romance. |
| src/lib/content/catalog.ts, hash.ts, types.ts | Seeded shuffle, recent direction exclusions, unique IDs and UTC Daily pair. Web has historical date branches and favourites, unnecessary for a new game. |
| src/lib/judging/rubric.ts | Commitment 30, Comedy 25, Accuracy 25, Chaos 20. Keep quiet takes competitive, one note, no identity judgments. Give the audience comedy and a bounded share of Chaos. |
| src/lib/say-it-back/scoring.ts | Word edits, spoken numbers and contractions carry over. A ten-second aggregate supplies pace. The web scorer's role-specific timestamps and clip media stay out. |
| src/lib/switch/catalog.ts | Use the everyone phrases as repeated cues. The 20-second web sequence needs a shorter schedule for Roblox STT. |
| src/lib/roast/engine.ts and types.ts | Offers, server deadlines, votes, reconnect grace and forfeit. No insults, media tokens, public roast rooms or automatic rematches. Each appearance needs a new acceptance. |
| docs/PRODUCT_AND_FLOWS.md, src/data/content.ts | Reveal in under two seconds, score bands, 70+ hot streak, first valid Daily. Rehearsal never competes with the public room. |
| supabase/seed.sql badges | Source has ten badge definitions including First Take, Committed to the Bit, Licensed Chaos Agent, Appointment Player and Unreasonable Range. Re-key to measured takes and crowd events. The product doc’s suggested badge list differs. |
| docs/DELIVERY_2_ROADMAP.md, Comfortable ways to play | Opt-in performance, directing, predictions, reactions, rating. Joining the server opens the crowd view. |
| docs/VISUAL_THEME.md, src/lib/visual-theme.ts, src/lib/brand.ts, docs/LAUNCH_COPY.md | Carry over the speech-wave silhouette, paper, yellow, blue, violet, pink and orange. Current theme code supersedes the old chartreuse product note. Short stage instructions. |

## Left with the web game

Next.js, React, Tailwind, browser capture, hosting, containers and browser tests serve the web UI. Supabase accounts, schema, migrations, Stripe and Pro belong to its business model. OpenAI, Scribe and LiveKit would take speech outside Roblox. Uploads, saved audio, reviews, share receipts, exports and cameras violate the ephemeral take design. Say It Back media and recognizable-content/v4 sourced lines lack release rights for this game. Teen, mature, romance and targeted roast material miss the audience. Public profiles, follows, feed, challenge URLs, line submissions, moderation console and OBS stage introduce unnecessary identity, free text or streaming infrastructure. All remain in place.
