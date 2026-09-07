# Delivery avatar art

Six original character portraits were generated with the built-in image-generation tool for the performance-avatar collection on 2026-09-07. No runtime AI calls or services are required. The production files are 640 × 640 WebP with the generated alpha channel preserved; only resizing and WebP encoding were applied.

| Stable ID | Character | Public asset |
| --- | --- | --- |
| fox | Mischievous orange fox | `/avatars/fox.webp` |
| cloud | Deadpan violet cloud imp | `/avatars/cloud.webp` |
| star | Confident golden star | `/avatars/star.webp` |
| robot | Chrome robot | `/avatars/robot.webp` |
| alien | Amused lime alien | `/avatars/alien.webp` |
| cat | Charcoal cat | `/avatars/cat.webp` |

## Integration

Use these same files in the picker, live avatar and clip composition. The worker embeds the assets into the shared SVG composition; the browser uses the public URL. Preserve transparency and the full silhouette, including ears and antennae. Art has a warm cream key light and blue rim and works over Delivery's tinted podium surfaces. Do not add fake mouths over the art. React to actual recorded levels using restrained whole-character motion and a light rim or halo; honor reduced motion.

## Generation prompts

Each character was produced using a separate built-in image-generation call. The full prompt consisted of the shared direction followed by that character's subject specification.

### Shared direction

```text
Use case: stylized-concept.
Asset type: premium avatar portrait artwork for Delivery, a social voice performance game; a finished production art asset, not a mockup.
Style: an original high-end collectible designer vinyl sculpture rendered with the exceptional art direction and tactile sophistication of an animated feature's hero character. Bold simple silhouette, appealing expressive face, beautifully modeled sculptural forms, subtle satin ceramic-vinyl microtexture, controlled glossy details in the eyes, tiny honest material irregularities. Witty contemporary personality for internet culture; sophisticated cute, never generic emoji or stock mascot.
Composition: single character, frontal face with a subtle three-quarter turn, eye-level close portrait, centered in a square 1024x1024 canvas. Large recognizable head and tiny simplified shoulder base only; no hands, no feet. Entire silhouette including ears or antennae contained with 10% clear margin. Face and all meaningful details sit safely within a central circular crop, readable at 80px but exquisitely finished at 500px. The character occupies about 78% canvas width and height. Floating bust, no ground plane.
Lighting: warm creamy large studio key from upper left, very restrained electric-blue rim on the right, soft clean ambient occlusion. Elegant deep color and bright legible facial expression. Same camera, framing and lighting throughout this collectible series.
Background: genuinely transparent background with a real alpha channel. No background color, no circular backplate, no checkerboard texture painted into the image, no environment, no cast shadow outside the character.
Constraints: completely original character design; no text, letters, logo, watermark, UI, borders, accessories with symbols, no extra characters. Avoid generic emoji rendering, overcomplicated detail, skin realism, cheap plastic sheen, large gleaming teeth, floating decorative objects. Do not crop the silhouette.
```

### fox

```text
Subject: a mischievous bright burnt-orange fox with oversized sculptural triangular ears, buttery cream cheek tufts and muzzle, confident half-lidded dark teal eyes under asymmetrically raised expressive brows, and a small clever closed-mouth smirk. Charcoal rounded nose, tiny cream chin, voluminous swept forelock. Small dark ink-blue bomber-jacket collar visible beneath the head. Design the face as one beautifully integrated sculpted character, with polished eye highlights and elegant warm orange/cream color blocking. Personality: the quick-witted friend delivering the funniest line in the room.
```

### cloud

```text
Subject: a wonderfully unimpressed violet cloud imp. Its large head is a compact asymmetrical cluster of three or four soft lilac cloudlike sculpted lobes, tapering into a tiny violet neck and rounded shoulder base. Two tiny darker-purple horn nubs sit naturally in the silhouette, one partially hidden. A distinct sculpted central face plane with drooping angular brows, slightly narrowed glossy plum-black eyes with pale lavender lids, and a tiny dry deadpan smirk pushed to one side. A single subtle crease under one eye adds personality. Deep periwinkle shadow valleys and pink-lilac soft key highlights. Personality: dry humor, expressive side-eye, theatrically unbothered. It must read as a collectible creature with dimensional facial modeling rather than a cloud emoji.
```

### star

```text
Subject: a charismatic golden-yellow five-pointed star creature with a rounded sculpted star-shaped head, the top point subtly leaning as a jaunty forelock, lower star points forming a small natural shoulder base. Rich marigold at the edges with a creamy sun-yellow front, beautifully sculpted soft facial planes. Confident squinting dark brown eyes, one eyebrow raised, cheek dimples and a small asymmetric open grin with a single simple cream tooth; an appealing comedic actor face. Tiny muted amber freckles sculpted subtly across the upper cheeks. Personality: radiant stage confidence, the charming performer. It must look like a designed collectible character with sculptural face planes, not a shiny flat star emoji, no arms, no legs.
```

### robot

```text
Subject: an effortlessly deadpan chrome robot with a softly squared head, elegantly beveled shell, a broad glossy black inset face panel, and two expressive pale cyan rectangular illuminated eyes, one slightly squinting. A simple minimal embossed horizontal mouth below the face panel gives reserved ironic personality. The chrome is softly brushed silver with cream studio reflections, electric-blue edge reflections and beautifully considered dark graphite seam lines, not a mirror reflecting a room. Two tiny round ear-like side details contained in the square silhouette, a dark graphite short neck and a compact silver shoulder base with a single coral-red circular status indicator. Personality: dry witty stoicism and understated confidence. Not a helmet, not a toy from an existing franchise. No lettering, wires, bolts clutter, antenna, or external gadgets.
```

### alien

```text
Subject: a stylish lime-green alien with a generous rounded inverted-pear head, two short outward-angled flexible antennae with rounded tips kept well inside the frame, wide glossy black almond eyes whose half-lidded upper lime eyelids create an amused knowing expression. Tiny rounded bridge of a nose, narrow sculpted closed smile with one corner lifted, a slight sculpted cheek contour. Muted acid-lime front, deeper emerald shadow edges, very subtle pale chartreuse facial freckles. A tiny deep charcoal-violet high-collar jacket at the base. Personality: the cool outsider with impeccable comic timing. Exquisite satin ceramic texture and deep glassy eyes; friendly sharp character design, never scary, never a generic alien emoji.
```

### cat

```text
Subject: a very cool charcoal-black cat with oversized softly rounded triangular ears, rich ink-blue satin-vinyl fur sculpted in a few elegant cheek tufts, warm cream inner-ear accents, heavy-lidded piercing pale amber eyes with small glossy pupils, raised eyebrows and a subtle irresistibly smug closed-mouth smile. Tiny black triangular nose with beautiful soft highlights, three short fine sculpted whisker creases per cheek rather than separate whisker strands, small cream chin tuft. A minimal electric-blue jacket collar just at the base. Personality: knowing, charismatic and effortlessly funny. Keep black materials luminous and legible with blue edge lighting and creamy key light, never crush shadows, do not use sunglasses. Original artistic toy character, not a familiar franchise cat.
```
