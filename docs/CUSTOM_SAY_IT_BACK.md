# Custom Say It Back

Players can paste a public Twitch clip, YouTube video/Short, Instagram Reel or full TikTok video URL, or upload a video. The existing Railway media worker imports up to 3 minutes/80 MB, then prepares a selected 1–45 second excerpt in Delivery's own player. No source-platform API key or account authorization is required. Unavailable, private, login-gated or incompatible links use the upload fallback.

The editor drafts English dialogue with the existing transcription integration. Players can correct wording and times, choose their lines, set a rating, and create a scene. Original video, reference waveform, line retakes, whole-scene recording and dubbed playback use the existing Say It Back experience. Selected dialogue windows are muted in the backing track; other sounds inside those windows also mute because ordinary clips do not provide isolated speech stems.

Published scenes are immutable. Guests keep imports for 24 hours; signing in claims the device's imports, retains published scenes and gives unfinished drafts seven days. Original source files require owner access. Prepared excerpts use a revocable media capability so explicitly shared performances can play. Deleting a scene disables playback and removes its stored media; account deletion includes custom scenes.

The private `delivery-scenes` bucket and service-role-only `say_imports` table reuse existing Supabase infrastructure. Queue leases run in the existing export worker, with bounded FFmpeg processing and retry cleanup. The migrations add these resources and 45-second Say limits. Personal exports accept owner-enabled source manifests, including Mature scenes after the player's content opt-in; public audience and account restrictions remain enforced.

Validation includes focused editor, recorder, media processing and worker tests; full SQL migration tests for ownership, leases, immutable publication and deletion; and a production build. Live deployment verification is recorded separately. Public platform retrieval can depend on the platform's availability and hosting-network access.
