# Delivery in Roblox Studio

Run commands from this folder in PowerShell. Python 3.12 and PowerShell 7 are used for the authoring scripts. First build: `./tools/build.ps1`. The setup downloads checksum-verified Rojo 7.7.1, Lune 0.11.1, StyLua 2.6.0 and Selene 0.32.0 from their maintainers. Open `build/Delivery.rbxl` locally in Studio. Every build uses the committed source tree.

Rojo is the only sync path. For an interactive edit session use `./.tools/rojo.exe serve default.project.json` with the matching Studio plugin, then disconnect and stop the owned server. Rebuilding and reopening the place needs no plugin. Make source edits in Git. Leave publishing and experience settings to the owner.

Run `python tools/import.py --check` for catalogue validation, `./.tools/lune.exe run tests/run` for pure Luau checks, and `./.tools/selene.exe src tests` plus `./.tools/stylua.exe --check src tests` for style. Run tests serially. Use the owner's Windows command wrapper for worker or server processes. Check the live test protocol before describing any feature as verified.

Keep server authority, explicit consent for every take, and a hard boundary around ephemeral speech. Only controlled text or a successful Roblox filter result can reach a screen. Use only the roblox/ folder. Record changes of scope and evidence in docs/.
