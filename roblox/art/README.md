# The Delivery theatre

The original drawing is in concepts/theatre.png. The second sheet establishes the cue stock and the brass carry-case host, Flip. The set was modelled from those references using Blender 4.5.15. Open DeliveryTheatre.blend to edit the materials, sections, lights' housings and geometry. DeliveryTheatre.glb contains the PBR geometry with UVs. Every individual mesh is below 500 triangles. No image textures are needed.

Run `./art/scripts/build.ps1` from roblox/ to regenerate the Blender file, glTF and ShowSet.model.json from the shared shape descriptions. The Rojo assembly uses that model directly so the owner can open the theatre offline. The native version uses stretchable sphere meshes for upholstery and stadium-shaped steps for the apron. Local lighting, shadow and effect budgets are in docs/TEST-PLAN.md.

Five original mono WAV masters are in sound/. Regenerate them with `python art/scripts/sound.py`. Their approved Roblox asset IDs can be assigned in src/shared/SoundIds.luau. The local build uses short pitched Roblox interface sounds until IDs are supplied.
