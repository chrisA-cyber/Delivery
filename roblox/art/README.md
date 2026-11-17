# Delivery’s theatre district

Players arrive outdoors at Signal Park’s tram gateway, facing the orchard and bandstand. Lantern Street heads west through Broadcast Plaza to Waterfront Pier. Two ground-level walks pass either side of the terrace to reach Night Market. The theatre, rehearsal booth, writers’ loft, costume atelier, props warehouse and rooftop remain accessible from the same plaza.

| Destination | Defining scenery |
| --- | --- |
| Waterfront Pier | Timber wharf and jetty, a trussed cargo crane, flashing buoy, moored launch, banded lighthouse and a waterfront slipway |
| Signal Park | Blossom trees, ochre meadow, a three-gate running loop and an eight-column bandstand |
| Night Market | Six textile and food stalls, striped canvas, suspended festival lamps and a wrapping counter |
| Live Theatre | Art Deco box office, a working radio dial, shaped velvet swag curtains, host Flip and playable Foley instruments |

The walking camera follows the player. Choosing a seat or performing switches to the live show’s audience, presenter and performer shots. A reduced-motion preference holds a stable stage view. Each outdoor destination has an exterior sign, a distinctive silhouette and an interaction point.

## Source and exports

Open `DeliveryTheatre.blend` to edit the scene or review the named cameras for the show, workshops and outdoor districts. The scene builder in `scripts/theatre.py` shares its primitives, coordinate system and export logic with `scripts/campus.py` and `scripts/districts.py`. Run `art/scripts/build.ps1` from the Roblox project using Blender 4.5.15 LTS and the workstation’s owned-command wrapper. The builder writes the editable Blender file, a UV-mapped glTF and a self-contained native Rojo model.

The native model contains 3,160 anchored objects in 23 sections. Five continuous fabric meshes in Blender become 456 noncollidable native curtain wedges. The glTF contains 88 shared meshes, 2,690 nodes and 41 used materials from a 43-material source palette. Its largest mesh has 440 triangles. Studio fills the near shore with 260 by 408 studs of swimmable water. A blue-green surface beneath it extends the harbor to the horizon. Roblox builds the lettering on the signed plates, and the lighting shifts between the sunlit street and late-night stage.

Run `python art/scripts/check-campus.py` from the Roblox project to verify the shipped collision model. Its 19 walks cover the outdoor activities, the studio and atelier entrances, elevated landings, both approaches to the market and the coastal jetty. It checks 19 unique arrival and pickup anchors and the width and headroom of the complete streetcar track. Live vehicles, dynamic props and player controls require a Studio playtest.

The strong central performance silhouette draws on the runway and voting sequence of Dress To Impress. Shared dressing kits and distinct silhouettes follow Roblox’s environment-art guidance. All of the district’s geometry, props and characters are original. [Dress To Impress](https://www.roblox.com/games/15101393044/Dress-To-Impress) · [Roblox environmental art curriculum](https://create.roblox.com/docs/tutorials/curriculums/environmental-art)

The original show stings and Bell, Squeak and Thump WAV masters are in `sound/`. Regenerate the show sounds with `python art/scripts/sound.py`. The owner can assign approved Roblox audio asset IDs in `src/shared/SoundIds.luau`. The portable local show also includes sequenced stings and three playable Foley cues.
