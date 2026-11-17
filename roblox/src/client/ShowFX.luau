--!strict
-- Directs the live show on this client: camera shots per phase, the curtain wipe between the street
-- and the stage, Flip's puppetry, theatre-local light cues, pad props and reveal juice.
-- Public API (used by Main.client.luau): ShowFX.new(gui, shared) -> { update, isReduced, toggle,
-- isTransitioning }. Global Lighting is owned by the district; this module only drives the stage rig
-- and a "ShowGrade" ColorCorrection while the show camera is live.
local Players = game:GetService("Players")
local SoundService = game:GetService("SoundService")
local Debris = game:GetService("Debris")
local GuiService = game:GetService("GuiService")
local Lighting = game:GetService("Lighting")
local Storage = game:GetService("ReplicatedStorage")
local Instruments = require(script.Parent.DeliveryInstruments)
local ShopWalkingZoom = require(script.Parent.ShopWalkingZoom)
local StageCurtain = require(script.Parent.StageCurtain)
local StageHost = require(script.Parent.StageHost)
local StageLights = require(script.Parent.StageLights)
local StageJuice = require(script.Parent.StageJuice)
local Trove = require(Storage:WaitForChild("DeliveryLibraries"):WaitForChild("Trove"))
local ShowFX = {}
local gold = Color3.fromRGB(255, 217, 135)
local pink = Color3.fromRGB(255, 93, 185)
local blue = Color3.fromRGB(112, 136, 255)
local champagne = Color3.fromRGB(221, 180, 129)
local petal = Color3.fromRGB(213, 140, 165)

-- Shots: from -> to over dur seconds (eased), looking at aim. drift adds a slow handheld sway.
-- cut = hard cut in and out (TV grammar for a reverse angle); everything else glides.
type Shot = {
	from: Vector3,
	to: Vector3?,
	aim: Vector3,
	fov: number,
	fovTo: number?,
	dur: number?,
	drift: number?,
	cut: boolean?,
}
local shots: { [string]: Shot } = {
	campus = { from = Vector3.new(13.3, 23.3, 100.8), aim = Vector3.new(-1.4, 5.2, 47.5), fov = 54 },
	-- Establishing wide for the lineup and between acts.
	wide = { from = Vector3.new(-1.6, 9.1, 26.8), aim = Vector3.new(0, 6.5, -13.8), fov = 52, drift = 1.1 },
	-- Medium on the stage while the audience directs and votes.
	stage = { from = Vector3.new(3.4, 7.4, 15.5), aim = Vector3.new(1.2, 5.2, -10), fov = 47, drift = 0.5 },
	-- Push-ins run through the countdown and the take (2 s + 10 s).
	take = {
		from = Vector3.new(14.6, 7.0, 10.2),
		to = Vector3.new(11.9, 6.35, 4.9),
		aim = Vector3.new(4.8, 4.78, -9.5),
		fov = 45,
		fovTo = 41,
		dur = 12,
	},
	booth = {
		from = Vector3.new(10.6, 8.8, 6.6),
		to = Vector3.new(9.0, 8.15, 2.8),
		aim = Vector3.new(5.0, 4.45, -8.35),
		fov = 52,
		fovTo = 49,
		dur = 12,
	},
	house = {
		from = Vector3.new(-3.4, 7.4, 8.2),
		to = Vector3.new(-4.7, 6.95, 3.8),
		aim = Vector3.new(-10.35, 5.18, -10.1),
		fov = 44,
		fovTo = 41,
		dur = 12,
	},
	-- Reverse angle from the stage lip onto the house.
	audience = {
		from = Vector3.new(4.2, 6.9, -6.6),
		to = Vector3.new(2.6, 6.6, -6.1),
		aim = Vector3.new(-1, 3.4, 8),
		fov = 58,
		dur = 2.2,
		cut = true,
	},
	host = {
		from = Vector3.new(-5.4, 6.6, 1.2),
		to = Vector3.new(-6.3, 6.3, -1.4),
		aim = Vector3.new(-10.4, 5.7, -10.2),
		fov = 37,
		fovTo = 34,
		dur = 2,
	},
	-- Slow dolly toward the score plate and dial.
	reveal = {
		from = Vector3.new(-1.5, 8.1, 11.5),
		to = Vector3.new(-0.9, 7.5, 5.6),
		aim = Vector3.new(0, 7.6, -18),
		fov = 50,
		fovTo = 45,
		dur = 4.5,
	},
	winner = {
		from = Vector3.new(4, 4.9, 1.7),
		to = Vector3.new(4.3, 5.0, 0.6),
		aim = Vector3.new(5.1, 5, -10),
		fov = 48,
		dur = 2,
	},
	daily = { from = Vector3.new(11.1, 6, -3.7), aim = Vector3.new(14, 5.2, -13.8), fov = 45 },
}
-- The shop lenses sit just inside the open portals and point past the visitor toward each workbench.
local counters = {
	post = { Vector3.new(-83.4, 5.75, 63.8), Vector3.new(-86.40, 3.20, 51.35), 64 },
	records = { Vector3.new(89.1, 5.65, 83.20), Vector3.new(84.65, 3.25, 95.65), 65 },
	cafe = { Vector3.new(-44.35, 5.75, 124.6), Vector3.new(-57.20, 3.20, 120.65), 65 },
	gallery = { Vector3.new(44.35, 5.75, 126.55), Vector3.new(57.35, 3.35, 130.65), 64 },
}
local PERFORMER_MARK = Vector3.new(5, 2.1, -9.3)
local FLIP_MARK = Vector3.new(-10.4, 2.1, -10.2)
local MARQUEE_FALLBACK = Vector3.new(0, 14.9, 38.4)
local TAKE_SECONDS = 10
local CUE_WINDOW = 1.15

local function prop(parent, name, size, pos, color)
	local part = Instance.new("Part")
	part.Name = name
	part.Size = size
	part.Position = pos
	part.Color = color
	part.Anchored = true
	part.CanCollide = false
	part.CanTouch = false
	part.CanQuery = false
	part.CastShadow = false
	part.Material = Enum.Material.Neon
	part.Parent = parent
	return part
end
local function ease(u: number): number
	u = math.clamp(u, 0, 1)
	return 0.5 - 0.5 * math.cos(math.pi * u)
end
local function words(text: string?): number
	if type(text) ~= "string" then
		return 0
	end
	local _, n = string.gsub(text, "%S+", "")
	return n
end
local function talkTime(text: string?): number
	return math.clamp(0.6 + words(text) * 0.36, 1.2, 7)
end
local function bucketOf(result): string
	if not result or result.overall == nil then
		return "miss"
	end
	local overall = result.overall
	if result.miss and overall < 60 then
		return "miss"
	end
	return if overall >= 90
		then "top"
		elseif overall >= 75 then "high"
		elseif overall >= 60 then "mid"
		else "low"
end
local function insideTheatre(p: Vector3): boolean
	return math.abs(p.X) < 31 and p.Z > -26 and p.Z < 33 and p.Y < 24
end

function ShowFX.new(gui: ScreenGui, shared)
	local ids = require(shared.SoundIds) :: any
	local set = workspace:WaitForChild("ShowSet")
	local trove = Trove.new()
	local folder = Instance.new("Folder")
	folder.Name = "LocalShowFX"
	folder.Parent = workspace
	trove:Add(folder)
	local player = Players.LocalPlayer
	local playerGui = gui.Parent or player:WaitForChild("PlayerGui")

	local stem = set:FindFirstChild("MicStem", true)
	local stemColor = if stem and stem:IsA("BasePart") then stem.Color else Color3.new(1, 1, 1)
	local dial = set:WaitForChild("Dial", 10)
	local needle = dial and dial:WaitForChild("TuningNeedle", 5)
	local pivot = CFrame.new(0, 8.4, -20.85)
	local restNeedle = if needle and needle:IsA("BasePart")
		then pivot:ToObjectSpace(needle.CFrame)
		else CFrame.identity
	local dialAngle = 0
	local foleyParts = {}
	local rackModel = set:WaitForChild("FoleyRack", 10)
	if rackModel then
		for _, obj in rackModel:GetChildren() do
			if obj:IsA("BasePart") then
				obj.LocalTransparencyModifier = 1
				obj.Transparency = 0
				table.insert(foleyParts, obj)
			end
		end
	end
	local rack = Instruments.rack(rackModel)
	local boothVisible = false
	local cueShowing = false
	local lastPadTurn, lastPadIndex = -1, 0
	local bars = {}
	for i = 1, 19 do
		bars[i] = prop(
			folder,
			"Meter",
			Vector3.new(0.17, 0.12, 0.10),
			Vector3.new((i - 10) * 0.34, 6.6, -18.82),
			if i % 3 == 0 then pink else gold
		)
	end

	local reduced = GuiService.ReducedMotionEnabled
	trove:Connect(GuiService:GetPropertyChangedSignal("ReducedMotionEnabled"), function()
		reduced = GuiService.ReducedMotionEnabled
	end)

	-- Applied camera domain (what is on screen) and the wanted one (what Main last asked for).
	local freeCamera = true
	local counter = nil
	local view = "wide"
	local domain = "free"
	local want = { free = true, counter = nil :: any, view = "wide" }
	local settled = false
	local wiping = false
	local priorWalkPose: CFrame? = nil
	local priorWalkPosition: Vector3? = nil
	local priorWalkFov: number? = nil
	local desk = gui:FindFirstChild("ControlDesk") :: GuiObject?
	local roamFov = if workspace.CurrentCamera then workspace.CurrentCamera.FieldOfView else 70
	local lastHumanoid: Humanoid? = nil
	local s
	local currentKey = ""
	local reacted = 0
	local meter = 0
	local meterAt = 0
	local started = 0
	local viewStarted = os.clock()
	local revealTurn = -1
	local revealShown = false
	local shakeAt, shakeLength = -100, 0
	local stingTurn = -1

	local curtain = StageCurtain.new(playerGui, ids)
	local host = StageHost.new(set:WaitForChild("Flip", 10))
	set:WaitForChild("Bandstand", 10)
	local lights = StageLights.new(set, folder)
	local audible = function()
		return not freeCamera
	end
	local juice = StageJuice.new(playerGui, folder, Instruments, audible)

	local function sound(kind, vol, pitch)
		if freeCamera then
			return
		end
		local asset = ids[kind] or 0
		if type(asset) ~= "number" or asset <= 0 then
			Instruments.sting(kind, vol)
			return
		end
		local effect = Instance.new("Sound")
		effect.SoundId = "rbxassetid://" .. asset
		effect.Volume = vol
		effect.PlaybackSpeed = pitch
		effect.Parent = SoundService
		effect:Play()
		Debris:AddItem(effect, 3)
	end
	-- Needle Drop riff on the performer's entrance. Gameplay sends s.entranceNotes (pad names) and
	-- s.entranceSting (the record's name). Notes play on the pad sounds ~0.25 s apart and pulse the
	-- stage pads when the booth is out; a sting that names a SoundIds key or an asset id also works.
	local function entrance(notes: any, sting: any): boolean
		if freeCamera then
			return false
		end
		if type(notes) == "table" and #notes > 0 then
			local played = 0
			for i, pad in notes do
				if i > 8 then
					break
				end
				if pad == "Bell" or pad == "Squeak" or pad == "Thump" then
					played += 1
					task.delay((i - 1) * 0.25, function()
						Instruments.strike(pad)
						if rack and boothVisible then
							rack.hit(pad, nil, reduced)
						end
					end)
				end
			end
			if played > 0 then
				return true
			end
		end
		if sting ~= nil and sting ~= false then
			if Instruments.cue(sting, 0.6) then
				return true
			end
			if type(sting) == "table" and Instruments.cue(sting.soundId or sting.key, 0.6) then
				return true
			end
		end
		return false
	end

	-- Lighting.ShowFocus (a disabled DepthOfField owned by the atmosphere pass) softens the
	-- background on close-ups. Skipped entirely under reduced motion.
	local focusEffect: DepthOfFieldEffect? = nil
	local focusOn = false
	local function setFocus(on: boolean, distance: number)
		if on and not (focusEffect and focusEffect.Parent) then
			local found = Lighting:FindFirstChild("ShowFocus")
			focusEffect = if found and found:IsA("DepthOfFieldEffect") then found else nil
		end
		local effect = focusEffect
		if not effect then
			return
		end
		if on then
			effect.FocusDistance = distance
			effect.InFocusRadius = 7
		end
		if focusOn ~= on then
			focusOn = on
			effect.Enabled = on
		end
	end

	local function performerMark(): Vector3
		return if s and s.actor == 0 then FLIP_MARK else PERFORMER_MARK
	end
	local function domainOf(free: boolean, ctr: any, v: string): string
		return if ctr then "counter" elseif free then "free" elseif v == "campus" then "campus" else "stage"
	end
	local function scripted(d: string): boolean
		return d == "stage" or d == "campus"
	end

	local snapNext = true
	local shotKey = ""
	local shotStart = 0
	local camPos, camAim, camFov = Vector3.zero, Vector3.zero, 50

	local function commit()
		local wantsFree, nextCounter = want.free, want.counter
		if nextCounter and not counter then
			local camera = workspace.CurrentCamera
			local character = player.Character
			if camera and character and camera.CameraType == Enum.CameraType.Custom then
				priorWalkPose = camera.CFrame
				priorWalkPosition = character:GetPivot().Position
				priorWalkFov = camera.FieldOfView
			end
		elseif counter and not nextCounter and not wantsFree then
			priorWalkPose, priorWalkPosition, priorWalkFov = nil, nil, nil
		end
		if wantsFree and (not freeCamera or (counter and not nextCounter)) then
			lastHumanoid = nil
		end
		counter = nextCounter
		freeCamera = wantsFree
		if want.view ~= view then
			view = want.view
			viewStarted = os.clock()
		end
		local before = domain
		domain = domainOf(freeCamera, counter, view)
		if domain ~= before then
			snapNext = true
			shotKey = ""
		end
		lights.grade(domain == "stage", reduced)
	end

	local function update(state, backstage, welcome, exploring, overview, counterId)
		s = state
		local accepted = s.actor == player.UserId and s.phase ~= "lineup" and s.phase ~= "lobby"
		local wantsFree = if exploring ~= nil
			then exploring
			else s.venue ~= nil and not s.venue.watching and not accepted and not welcome
		local nextCounter = if wantsFree and counterId then counters[counterId] else nil
		local onStage = s.phase == "countdown" or s.phase == "take" or s.phase == "read"
		local nextView = if overview
			then "wide"
			elseif welcome then "campus"
			elseif backstage then "daily"
			elseif onStage then (if s.foley then "booth" elseif s.actor == 0 then "house" else "take")
			elseif s.phase == "direct" then "stage"
			elseif s.phase == "vote" then "vote"
			elseif s.phase == "host" then "host"
			elseif s.phase == "reveal" then "reveal"
			elseif
				s.phase == "intermission"
				and s.actor ~= 0
				and s.result
				and (s.result.overall or 0) >= 75
			then "winner"
			else "wide"
		want.free, want.counter, want.view = wantsFree, nextCounter, nextView
		local nextDomain = domainOf(wantsFree, nextCounter, nextView)
		if not settled then
			settled = true
			commit()
		elseif nextDomain ~= domain and (scripted(nextDomain) or scripted(domain)) then
			if not wiping then
				wiping = true
				curtain.wipe(function()
					wiping = false
					commit()
				end, reduced)
			end
		elseif not wiping then
			commit()
		end

		local showBooth = s.foley ~= nil and s.phase ~= "intermission"
		if boothVisible ~= showBooth then
			boothVisible = showBooth
			for _, part in foleyParts do
				part.LocalTransparencyModifier = if showBooth then 0 else 1
			end
			if rack then
				rack.show(showBooth)
			end
		end

		local result = s.result
		local bucket = bucketOf(result)
		local house = s.actor == 0
		local encoreMoment = not house and result ~= nil and ((result.overall or 0) >= 90 or s.encore == true)
		local mark = performerMark()
		lights.cue({
			phase = s.phase,
			house = house,
			bucket = bucket,
			encore = encoreMoment,
			performer = mark,
		})

		local scoreVisible = not welcome
			and not backstage
			and s.phase == "reveal"
			and result ~= nil
			and result.overall ~= nil
		if not scoreVisible and revealShown then
			revealShown = false
			juice.hideScore()
		end

		local key = tostring(s.turn) .. "/" .. s.phase
		if key ~= currentKey then
			currentKey = key
			started = os.clock()
			meter = 0
			reacted = 0

			if s.phase == "countdown" then
				local played = stingTurn ~= s.turn and entrance(s.entranceNotes, s.entranceSting)
				if played then
					stingTurn = s.turn
				else
					sound("places", 0.4, 1.2)
				end
				if (s.actorSkin == "gold-entrance" or s.actorSkin == "house-entrance") and not freeCamera then
					juice.glint(
						mark + Vector3.new(0, 7.2, 0),
						if s.actorSkin == "gold-entrance"
							then gold
							elseif s.actorStage >= 80 then pink
							else champagne
					)
				end
				host.look("performer")
			elseif s.phase == "direct" then
				if s.mode == "Echo" and s.line then
					host.talk(talkTime(s.line.text))
				end
				host.look("audience")
			elseif s.phase == "take" then
				if (house or s.foley) and s.line then
					host.talk(talkTime(s.line.text))
				end
				host.look(if house then "audience" else "performer")
			elseif s.phase == "vote" then
				sound("roll", 0.22, 0.75)
				host.look("audience")
			elseif s.phase == "host" then
				host.talk(talkTime(s.hostLine or "The room has spoken."))
				host.gesture(
					if house
						then "bow"
						elseif bucket == "miss" then "facepalm"
						elseif bucket == "low" then "shrug"
						else "point"
				)
				host.look(if bucket == "miss" then "down" elseif house then "audience" else "performer")
			elseif s.phase == "reveal" then
				host.gesture("hop")
				host.look("audience")
			elseif s.phase == "lobby" then
				juice.clearProps()
				host.look("idle")
			end
		end

		if scoreVisible and not revealShown then
			revealShown = true
			-- A first look within a second of the phase plays the full show; coming back from the menu
			-- mid-reveal just shows the settled score.
			local fresh = revealTurn ~= s.turn and os.clock() - started < 1
			revealTurn = s.turn
			if fresh then
				sound("reveal", 0.5, 1.45)
			end
			local turn = s.turn
			juice.reveal(result.overall, result.band or "", reduced or not fresh, function()
				if not fresh or not s or s.turn ~= turn or s.phase ~= "reveal" or freeCamera then
					return
				end
				juice.stinger(bucket)
				lights.burst()
				if not reduced then
					lights.flash(if encoreMoment then 1.4 else 0.6)
				end
				if encoreMoment then
					juice.confetti(
						if s.actorSkin == "blue-finale"
							then StageJuice.palettes.blue
							elseif s.actorStage >= 80 then { petal, pink, champagne }
							else StageJuice.palettes.show,
						reduced
					)
					host.gesture("spin")
					if not reduced then
						shakeAt, shakeLength = os.clock(), 1.1
					end
				elseif house then
					host.gesture("bow")
				elseif bucket == "high" then
					host.gesture("cheer")
				elseif bucket == "low" then
					host.gesture("shrug")
				elseif bucket == "miss" then
					host.gesture("facepalm")
				end
			end)
		end

		if s.foley and s.phase == "take" and not freeCamera then
			local hit = s.foley.last
			if hit and (s.turn ~= lastPadTurn or hit.index ~= lastPadIndex) then
				lastPadTurn, lastPadIndex = s.turn, hit.index
				Instruments.strike(hit.pad)
				if rack then
					rack.hit(hit.pad, hit.label, reduced)
				end
			end
		end
		if s.phase == "take" and s.reactions > reacted then
			local fresh = math.min(3, s.reactions - reacted)
			reacted = s.reactions
			if not freeCamera then
				local kind = s.lastReaction or "Rose"
				local golden = kind == "Rose" and (s.reactionSkin == "rose-gold" or s.reactorCrowd >= 40)
				for _ = 1, fresh do
					juice.react(kind, mark, golden, reduced)
				end
			end
			sound(
				if s.lastReaction == "Laugh" then "chuckle" else "applause",
				math.min(0.5, 0.12 + 0.05 * reacted),
				0.9
			)
		end
	end

	local channel = shared:WaitForChild("Meter") :: RemoteEvent
	trove:Connect(channel.OnClientEvent, function(turn, value)
		if s and s.turn == turn and s.phase == "take" then
			meter = value
			meterAt = os.clock()
		end
	end)

	-- First walking shot -----------------------------------------------------------------------------
	local arrivalPoint: Vector3? = nil
	local marqueePoint: Vector3? = nil
	local function arrival(): Vector3?
		if arrivalPoint then
			return arrivalPoint
		end
		local anchor = set:FindFirstChild("PlazaArrival", true)
		if not (anchor and anchor:IsA("BasePart")) then
			local rig = set:FindFirstChild("ShowRig")
			anchor = (rig and rig:FindFirstChild("Entry")) or workspace:FindFirstChild("Entry", true)
		end
		if anchor and anchor:IsA("BasePart") then
			arrivalPoint = anchor.Position
		end
		return arrivalPoint
	end
	local function marquee(): Vector3
		if not marqueePoint then
			local sign = set:FindFirstChild("GrandMarquee", true)
			marqueePoint = if sign and sign:IsA("BasePart") then sign.Position else MARQUEE_FALLBACK
		end
		return marqueePoint :: Vector3
	end
	local function nearArrival(p: Vector3): boolean
		local a = arrival()
		if not a then
			return false
		end
		local flat = Vector3.new(p.X - a.X, 0, p.Z - a.Z)
		return flat.Magnitude <= 8 and math.abs(p.Y - a.Y) <= 8
	end
	-- Twelve studs behind and a little above the avatar, looking past it to the DELIVERY marquee.
	local function frameArrival(camera: Camera, root: BasePart)
		local focus = root.Position + Vector3.new(0, 1.5, 0)
		local sign = marquee()
		local flat = Vector3.new(sign.X - focus.X, 0, sign.Z - focus.Z)
		local facing = Vector3.new(root.CFrame.LookVector.X, 0, root.CFrame.LookVector.Z)
		local dir = if flat.Magnitude > 2 and flat.Magnitude < 80
			then flat.Unit
			elseif facing.Magnitude > 0.05 then facing.Unit
			else Vector3.new(0, 0, -1)
		local eye = focus - dir * 12 + Vector3.new(0, 2.6, 0)
		camera.CFrame = CFrame.lookAt(eye, focus)
		camera.Focus = CFrame.new(focus)
	end
	local arrivalWatchUntil = 0
	local acquiredAt = Vector3.zero

	local walkingZoom = ShopWalkingZoom.new(player, set)
	local function resetCharacterCamera()
		walkingZoom.reset()
		lastHumanoid = nil
		priorWalkPose, priorWalkPosition, priorWalkFov = nil, nil, nil
	end
	trove:Connect(player.CharacterRemoving, resetCharacterCamera)
	trove:Connect(player.CharacterAdded, resetCharacterCamera)
	trove:BindToRenderStep("DeliveryWalkingZoom", Enum.RenderPriority.Camera.Value - 1, function()
		local character = player.Character
		local root = character and character:FindFirstChild("HumanoidRootPart")
		walkingZoom.update(
			freeCamera and not counter and gui.Enabled and not player:GetAttribute("DeliveryPortraitPose"),
			root
		)
	end)
	trove:Add(function()
		walkingZoom.release()
		curtain.destroy()
		host.rest()
		lights.rest()
		lights.grade(false, true)
		setFocus(false, 0)
	end)
	gui.Destroying:Connect(function()
		trove:Destroy()
	end)

	local lastFrame = 0
	local lastLights = 0
	local stageActive = false

	local function shotFor(now: number): string
		local key = if reduced and view ~= "daily" and view ~= "campus" then "wide" else view
		if key == "vote" then
			return if now - viewStarted < 2.2 then "audience" else "stage"
		end
		return if shots[key] then key else "wide"
	end

	local function directStage(camera: Camera, now: number, dt: number)
		local key = shotFor(now)
		local shot = shots[key]
		if key ~= shotKey then
			local previous = shots[shotKey]
			if shot.cut or (previous and previous.cut) then
				snapNext = true
			end
			shotKey = key
			shotStart = if key == "take"
					or key == "booth"
					or key == "house"
					or key == "audience"
				then math.min(now, viewStarted)
				else now
		end
		local t = now - shotStart
		local alpha = if shot.to and shot.dur and not reduced then ease(t / shot.dur) else 0
		local pos = if shot.to and alpha > 0 then shot.from:Lerp(shot.to, alpha) else shot.from
		local aim = shot.aim
		local fov = shot.fov + ((shot.fovTo or shot.fov) - shot.fov) * alpha
		if shot.drift and not reduced then
			local d = shot.drift
			pos += Vector3.new(math.sin(now * 0.21) * d, math.sin(now * 0.13) * d * 0.25, 0)
		end
		local viewport = camera.ViewportSize
		local aspect = viewport.X / math.max(1, viewport.Y)
		if aspect < 1.35 then
			pos = aim + (pos - aim) * math.min(1.65, 1.35 / aspect)
		end
		-- When the control desk covers the lower screen (phones), aim lower so the subject rides higher.
		if key ~= "campus" and desk and desk.Visible then
			local covered = desk.AbsoluteSize.Y / math.max(gui.AbsoluteSize.Y, 1)
			aim -= Vector3.new(0, math.clamp((covered - 0.28) / 0.25, 0, 1) * 1.3, 0)
		end
		if snapNext or reduced or not s then
			snapNext = false
			camPos, camAim, camFov = pos, aim, fov
		else
			local k = 1 - math.exp(-dt * 4.5)
			camPos = camPos:Lerp(pos, k)
			camAim = camAim:Lerp(aim, k)
			camFov += (fov - camFov) * k
		end
		local frame = CFrame.lookAt(camPos, camAim)
		local shaking = now - shakeAt
		if shaking < shakeLength and not reduced then
			local amp = 0.014 * (1 - shaking / shakeLength)
			frame *= CFrame.Angles(
				math.sin(now * 31) * amp,
				math.sin(now * 23 + 1.3) * amp,
				math.sin(now * 17 + 0.4) * amp * 0.5
			)
		end
		camera.CameraType = Enum.CameraType.Scriptable
		camera.CFrame = frame
		camera.Focus = CFrame.new(camAim)
		camera.FieldOfView = camFov
		local closeUp = key == "host" or key == "take" or key == "house" or key == "booth" or key == "winner"
		setFocus(closeUp and not reduced, (camPos - camAim).Magnitude)
	end

	local function directWalker(camera: Camera, now: number)
		local character = player.Character
		local humanoid = if character then character:FindFirstChildOfClass("Humanoid") else nil
		if not humanoid or player:GetAttribute("DeliveryPortraitPose") then
			return
		end
		local root = humanoid.RootPart
		if humanoid ~= lastHumanoid then
			lastHumanoid = humanoid
			camera.CameraType = Enum.CameraType.Custom
			camera.CameraSubject = humanoid
			camera.FieldOfView = priorWalkFov or roamFov
			local firstPerson = player.CameraMode == Enum.CameraMode.LockFirstPerson
				or (not priorWalkPose and (camera.CFrame.Position - camera.Focus.Position).Magnitude < 1)
			arrivalWatchUntil = 0
			if
				not firstPerson
				and priorWalkPose
				and priorWalkPosition
				and root
				and (root.Position - priorWalkPosition).Magnitude <= 10
			then
				local offset = priorWalkPose.Position - root.Position
				if walkingZoom.indoors(root.Position) and offset.Magnitude > 5.5 then
					camera.CFrame = priorWalkPose
						+ (root.Position + offset.Unit * 5.5 - priorWalkPose.Position)
				else
					camera.CFrame = priorWalkPose
				end
			elseif root and not firstPerson then
				if nearArrival(root.Position) then
					frameArrival(camera, root)
				else
					local target = root.Position + Vector3.new(0, 1.2, 0)
					local distance = if walkingZoom.indoors(root.Position) then 4.8 else 10
					local eye = target
						- root.CFrame.LookVector * distance
						+ Vector3.new(0, distance * 0.35, 0)
					camera.CFrame = CFrame.lookAt(eye, target)
					camera.Focus = CFrame.new(target)
					-- The server may pivot a fresh character to the plaza a moment after it spawns.
					arrivalWatchUntil = now + 1.5
					acquiredAt = root.Position
				end
			end
			priorWalkPose, priorWalkPosition, priorWalkFov = nil, nil, nil
		elseif arrivalWatchUntil > now and root then
			if (root.Position - acquiredAt).Magnitude > 15 and nearArrival(root.Position) then
				arrivalWatchUntil = 0
				frameArrival(camera, root)
			end
		end
	end

	local function updateCueRing()
		if not rack then
			return
		end
		if boothVisible and s and s.phase == "take" and s.foley and s.foley.beats then
			local elapsed = TAKE_SECONDS - (s.deadline - workspace:GetServerTimeNow())
			local hits = s.foley.hits
			for i, beat in s.foley.beats do
				local done = hits and (hits[tostring(i)] or hits[i])
				if not done and elapsed <= beat.at + CUE_WINDOW then
					rack.cue(beat.pad, beat.at - elapsed, CUE_WINDOW)
					cueShowing = true
					return
				end
			end
		end
		if cueShowing then
			cueShowing = false
			rack.cue(nil, 0, CUE_WINDOW)
		end
	end

	trove:BindToRenderStep("DeliveryShowCamera", Enum.RenderPriority.Camera.Value + 1, function(dt)
		local camera = workspace.CurrentCamera
		if not camera or not gui.Enabled then
			return
		end
		local now = os.clock()
		local root: BasePart? = nil
		if focusOn and (counter or freeCamera) then
			setFocus(false, 0)
		end
		if counter then
			local viewport = camera.ViewportSize
			local aspect = viewport.X / math.max(viewport.Y, 1)
			local covered = if desk and desk.Visible
				then desk.AbsoluteSize.Y / math.max(gui.AbsoluteSize.Y, 1)
				else 0
			local aimDrop = math.clamp((covered - 0.25) / 0.25, 0, 1) * 1.5
			local target = counter[2] - Vector3.new(0, aimDrop, 0)
			camera.CameraType = Enum.CameraType.Scriptable
			camera.CFrame = CFrame.lookAt(counter[1], target)
			camera.Focus = CFrame.new(target)
			camera.FieldOfView = counter[3] + math.clamp((1.30 - aspect) * 13, 0, 12)
		elseif freeCamera then
			directWalker(camera, now)
			local character = player.Character
			local part = character and character:FindFirstChild("HumanoidRootPart")
			root = if part and part:IsA("BasePart") then part else nil
		else
			directStage(camera, now, dt)
		end

		-- Stage life runs while the show camera is live, or while the visitor stands in the auditorium.
		local active = not counter and (not freeCamera or (root ~= nil and insideTheatre(root.Position)))
		if not active then
			if stageActive then
				stageActive = false
				host.rest()
				lights.rest()
				juice.clearProps()
				if rack then
					rack.cue(nil, 0, CUE_WINDOW)
				end
				cueShowing = false
			end
			return
		end
		stageActive = true
		host.step(now, reduced)
		juice.step(now)
		updateCueRing()
		local amplitude = if now - meterAt < 0.65 then meter else 0
		local look = if s and (not s.actorSkin or s.actorSkin == "house-entrance") then s.actorLook else nil
		if now - lastLights >= 1 / 30 then
			local step = now - lastLights
			lastLights = now
			local keyColor = if s
					and s.actorSkin == "violet-key"
					and s.phase == "take"
				then Color3.fromRGB(177, 127, 255)
				elseif look == "apricot" then Color3.fromRGB(255, 174, 111)
				elseif s and s.actorStage >= 100 and s.phase == "take" then Color3.fromRGB(177, 127, 255)
				else nil
			lights.step(now, math.min(step, 0.25), amplitude, keyColor)
		end
		if now - lastFrame < 0.07 then
			return
		end
		lastFrame = now
		if stem and stem:IsA("BasePart") then
			stem.Color = if look == "cherry"
				then Color3.fromRGB(218, 73, 102)
				elseif look == "cobalt" or (s and s.actorStage >= 60) then blue
				else stemColor
		end
		for i, bar in bars do
			bar.Color = if s and s.actorSkin == "rose-marquee"
				then pink
				else (if i % 3 == 0 then pink else gold)
			bar.Size = Vector3.new(
				0.17,
				0.10 + amplitude * (0.3 + math.abs(math.sin(i * 1.3 + now * 7)) * 0.85),
				0.10
			)
		end
		if needle and needle:IsA("BasePart") then
			local dialValue = if s
					and s.result
					and s.result.overall
				then s.result.overall / 100
				elseif s and s.phase == "take" then 0.35 + amplitude * 0.55
				else 0.46
			local targetAngle = math.rad(74 - 126 * dialValue)
			dialAngle = if reduced then targetAngle else dialAngle + (targetAngle - dialAngle) * 0.26
			needle.CFrame = pivot * CFrame.Angles(0, 0, dialAngle) * restNeedle
		end
	end)

	return {
		update = update,
		isReduced = function()
			return reduced
		end,
		toggle = function()
			reduced = not reduced
			return reduced
		end,
		-- Optional: true while the curtain wipe covers or uncovers the screen.
		isTransitioning = function()
			return curtain.busy()
		end,
	}
end
return ShowFX
