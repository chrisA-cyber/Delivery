# Delivery in Roblox Studio

Run commands from this folder in PowerShell. Python 3.12 and PowerShell 7 are used for the authoring scripts. First build: `./tools/build.ps1`. The setup downloads checksum-verified Rojo 7.7.1, Lune 0.11.1, StyLua 2.6.0 and Selene 0.32.0 from their maintainers. Open `build/Delivery.rbxl` locally in Studio. Every build uses the committed source tree.

Rojo is the only sync path. For an interactive edit session use `./.tools/rojo.exe serve default.project.json` with the matching Studio plugin, then disconnect and stop the owned server. Rebuilding and reopening the place needs no plugin. Make source edits in Git. Leave publishing and experience settings to the owner.

Run `python tools/import.py --check` for catalogue validation, `./.tools/lune.exe run tests/run` for pure Luau checks, and `./.tools/selene.exe src tests` plus `./.tools/stylua.exe --check src tests` for style. Run tests serially. Use the owner's Windows command wrapper for worker or server processes. Check the live test protocol before describing any feature as verified.

Keep server authority, explicit consent for every take, and a hard boundary around ephemeral speech. Only controlled text or a successful Roblox filter result can reach a screen. Use only the roblox/ folder. Record changes of scope and evidence in docs/.

## Acceptance commands

Open the checked-in Delivery.rbxl for the ordinary game. Running ./tools/build.ps1 produces build/Delivery.rbxl from source. After changing source, copy the passing build over the checked-in place. Run ./tools/check.ps1 for the catalogue, Luau tests, formatting, lint and place build. On this Windows workstation use the local Invoke-OwnedCommand.ps1 wrapper for worker or server commands.

For the two-client acceptance fixture, run ./tools/build-qa.ps1. Open build/Delivery-QA.rbxl and execute the following from the Studio edit command bar. The test owns the two local clients and ends them on completion. Its Driver and Observer are absent from the normal place.

```lua
local service = game:GetService("StudioTestService")
print(service:ExecuteMultiplayerTestAsync(2, "delivery"))
```

Run one Studio test at a time. Stop simulated input before taking a human playtest. Keep Studio session files, account details and transcripts out of the repository.
