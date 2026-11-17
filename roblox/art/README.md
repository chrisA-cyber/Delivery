# Delivery’s theatre district

Players arrive outdoors at Signal Park’s tram gateway, facing the orchard and bandstand. Lantern Street heads west through Broadcast Plaza to Waterfront Pier. Two ground-level walks pass either side of the terrace to reach Night Market. The theatre, rehearsal booth, writers’ loft, costume atelier, props warehouse and rooftop remain accessible from the same plaza.

| Destination | Defining scenery |
| --- | --- |
| Waterfront Pier | Timber wharf and jetty, a trussed cargo crane, flashing buoy, moored launch, banded lighthouse and a waterfront slipway |
| Signal Park | Blossom trees, ochre meadow, a three-gate running loop and an eight-column bandstand |
| Night Market | Six textile and food stalls, striped canvas, suspended festival lamps and a wrapping counter |
| Dockside Post | Sorting pigeonholes, mail cart, brass parcel scale and stepped clock pediment |
| Needle Drop Records | Turntables, sleeve collection, listening booth and a giant rooftop record |
| Copper Kettle Bakehouse | Tiled oven, espresso boiler, bread counter, café tables and rooftop kettle |
| Pocket Print Gallery | Working postcard press, four framed relief prints and striped window canopy |
| Clock Court | Public clock tower, three hanging chimes and a pedestrian passage from Needle Drop Records to Market Walk |
| Live Theatre | Art Deco box office, a working radio dial, shaped velvet swag curtains, host Flip and playable Foley instruments |

Seven neighboring townhouses and commercial fronts continue the four storefronts along Lantern Street and both Market Walk approaches. Planted forecourts, balcony rails, canopies and street-facing display windows mark the change from the broadcast campus to the walkable town. The walking camera follows the player. Choosing a seat or performing switches to the live show’s audience, presenter and performer shots. A reduced-motion preference holds a stable stage view. Each outdoor destination has an exterior sign, a distinctive silhouette and an interaction point.

## Source and exports

Open `DeliveryTheatre.blend` to edit the scene or review the named cameras for the show, workshops and outdoor districts. The scene builder in `scripts/theatre.py` shares its primitives, coordinate system and export logic with `scripts/campus.py`, `scripts/districts.py`, `scripts/town.py` and `scripts/clockcourt.py`. Run `art/scripts/build.ps1` from the Roblox project using Blender 4.5.15 LTS and the workstation’s owned-command wrapper. The builder writes the editable Blender file, a UV-mapped glTF and a self-contained native Rojo model.

The native model contains 4,396 anchored objects in 30 sections. Five continuous fabric meshes in Blender become 456 noncollidable native curtain wedges. The glTF contains 97 shared meshes, 3,915 nodes and 43 used materials from a 45-material source palette. Its largest mesh has 440 triangles. Studio fills the near shore with 260 by 408 studs of swimmable water. A blue-green surface beneath it extends the harbor to the horizon. Roblox builds the lettering on the signed plates, and the lighting shifts between the sunlit street and late-night stage.

Run `python art/scripts/check-campus.py` from the Roblox project to verify the shipped collision model. Its 25 walks include the four shop counters, the Clock Court passage and all three chime handles. They cover 6,594 sampled locations through the outdoor activities, studio and atelier entrances, elevated landings, both approaches to the market and the coastal jetty. It checks 23 unique arrival and pickup anchors and the width and headroom of the complete streetcar track. Live vehicles, dynamic props and player controls require a Studio playtest.

The strong central performance silhouette draws on the runway and voting sequence of Dress To Impress. Shared dressing kits and distinct silhouettes follow Roblox’s environment-art guidance. All of the district’s geometry, props and characters are original. [Dress To Impress](https://www.roblox.com/games/15101393044/Dress-To-Impress) · [Roblox environmental art curriculum](https://create.roblox.com/docs/tutorials/curriculums/environmental-art)

The original show stings and Bell, Squeak and Thump WAV masters are in `sound/`. Regenerate the show sounds with `python art/scripts/sound.py`. The owner can assign approved Roblox audio asset IDs in `src/shared/SoundIds.luau`. The portable local show also includes sequenced stings and three playable Foley cues.
