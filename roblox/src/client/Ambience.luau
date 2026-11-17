--!strict
-- The town soundscape. District beds cross-fade by camera position, spot loops sit in the world, and one-shots
-- follow the streetcar, the shop doors, the gulls and the live show. Every cue reads src/shared/SoundIds; an id
-- of 0 stays silent, and the tram bell, door chime, clock tick and harbour laps fall back to engine sounds so
-- the town is never completely mute. Driven by Atmosphere.client.luau: call update(dt, listener) every frame;
-- the heavy work runs five times a second and nothing allocates per frame.
local Players = game:GetService("Players")
local SoundService = game:GetService("SoundService")
local Storage = game:GetService("ReplicatedStorage")

local ids = require(Storage:WaitForChild("Delivery"):WaitForChild("SoundIds")) :: { [string]: any }

local Ambience = {}

-- minX, maxX, minZ, maxZ, feather (studs over which the bed fades out beyond the rectangle)
type Rect = { number }

type Bed = {
	sound: Sound,
	volume: number,
	current: number,
	target: number,
	rects: { Rect },
	music: boolean,
}

type Spot = {
	sound: Sound,
	volume: number,
	current: number,
	target: number,
	position: Vector3,
	part: BasePart?,
	reach: number,
	gate: number,
	shop: number,
}

local LIVE = {
	lineup = true,
	direct = true,
	countdown = true,
	take = true,
	read = true,
	vote = true,
	host = true,
	reveal = true,
}
local SHOPS = { "DocksidePost", "NeedleDrop", "CopperKettle", "PocketGallery" }
local SHOP_TONES = { "ShopPost", "ShopRecords", "ShopBakery", "ShopGallery" }
local RECORDS = 2
local CLICK = "rbxasset://sounds/volume_slider.ogg"
local SPLASH = "rbxasset://sounds/impact_water.mp3"
local DOOR = Vector3.new(0, 6, 37.5)

local function asset(key: string): string?
	local id = ids[key]
	if type(id) == "number" and id > 0 then
		return "rbxassetid://" .. string.format("%d", id)
	elseif type(id) == "string" and #id > 0 then
		return id
	end
	return nil
end

local function rectWeight(x: number, z: number, r: Rect): number
	local dx = math.max(r[1] - x, 0, x - r[2])
	local dz = math.max(r[3] - z, 0, z - r[4])
	if dx == 0 and dz == 0 then
		return 1
	end
	local w = 1 - math.sqrt(dx * dx + dz * dz) / r[5]
	if w <= 0 then
		return 0
	end
	return w * w * (3 - 2 * w)
end

local function inside(floor: BasePart?, pos: Vector3): boolean
	if not floor or not floor.Parent then
		return false
	end
	local p = floor.CFrame:PointToObjectSpace(pos)
	return math.abs(p.X) <= floor.Size.X / 2 and math.abs(p.Z) <= floor.Size.Z / 2 and p.Y >= -1 and p.Y <= 11
end

function Ambience.new(set: Instance)
	local player = Players.LocalPlayer
	local rng = Random.new()
	local terrain = workspace.Terrain
	local ambientGroup = Instance.new("SoundGroup")
	ambientGroup.Name = "DeliveryAmbience"
	ambientGroup.Volume = 1
	ambientGroup.Parent = SoundService
	local musicGroup = Instance.new("SoundGroup")
	musicGroup.Name = "DeliveryMusic"
	musicGroup.Volume = 1
	musicGroup.Parent = SoundService

	local function anchor(name: string, pos: Vector3): Attachment
		local a = Instance.new("Attachment")
		a.Name = "Ambience_" .. name
		a.Parent = terrain
		a.Position = pos
		return a
	end
	local function sound(
		name: string,
		id: string,
		parent: Instance,
		looped: boolean,
		near: number?,
		far: number?,
		group: SoundGroup?
	): Sound
		local s = Instance.new("Sound")
		s.Name = name
		s.SoundId = id
		s.Looped = looped
		s.Volume = 0
		s.SoundGroup = group or ambientGroup
		if near and far then
			s.RollOffMode = Enum.RollOffMode.InverseTapered
			s.RollOffMinDistance = near
			s.RollOffMaxDistance = far
		end
		s.Parent = parent
		return s
	end

	-- Beds: non-positional loops, weighted by district rectangles.
	local beds: { Bed } = {}
	local function bed(key: string, volume: number, rects: { Rect }, music: boolean?)
		local id = asset(key)
		if not id then
			return
		end
		local entry: Bed = {
			sound = sound(
				"Bed_" .. key,
				id,
				if music then musicGroup else ambientGroup,
				true,
				nil,
				nil,
				if music then musicGroup else ambientGroup
			),
			volume = volume,
			current = 0,
			target = 0,
			rects = rects,
			music = music == true,
		}
		table.insert(beds, entry)
	end
	local town: Rect = { -220, 200, -40, 230, 30 }
	bed("AmbTownAir", 0.22, { town })
	bed("AmbHarbour", 0.55, { { -240, -108, 20, 140, 45 } })
	bed("AmbStreet", 0.32, { { -105, 105, 58, 92, 22 }, { -30, 30, 38, 112, 14 } })
	bed("AmbMarket", 0.45, { { -42, 42, 138, 212, 24 } })
	bed("AmbPark", 0.45, { { 92, 168, 34, 116, 26 } })
	bed("AmbClockCourt", 0.35, { { 66, 112, 100, 152, 14 } })
	bed("MusicTown", 0.14, { town }, true)
	local market = { { -42, 42, 138, 212, 24 } }
	local harbour = { -240, -108, 20, 140, 45 }

	-- Spots: positional loops that only play while the listener is within reach.
	local spots: { Spot } = {}
	local function spot(
		key: string,
		pos: Vector3,
		volume: number,
		near: number,
		far: number,
		shop: number?
	): Spot?
		local id = asset(key)
		if not id then
			return nil
		end
		local entry: Spot = {
			sound = sound(
				"Spot_" .. key,
				id,
				anchor(key, pos),
				true,
				near,
				far,
				if key:sub(1, 5) == "Music" then musicGroup else ambientGroup
			),
			volume = volume,
			current = 0,
			target = 0,
			position = pos,
			part = nil,
			reach = far,
			gate = 1,
			shop = shop or 0,
		}
		table.insert(spots, entry)
		return entry
	end
	spot("MusicMarket", Vector3.new(0, 7, 176), 0.5, 20, 95)
	local spill = spot("TheatreSpill", DOOR, 0.6, 10, 75)
	if spill then
		-- Through closed doors: no highs, softer mids.
		local doors = Instance.new("EqualizerSoundEffect")
		doors.HighGain = -24
		doors.MidGain = -7
		doors.LowGain = 2
		doors.Parent = spill.sound
		spill.gate = 0
	end
	local court = set:FindFirstChild("ClockCourt")
	local clockPart = court
		and (court:FindFirstChild("ClockRim", true) or court:FindFirstChild("ClockLantern", true))
	local clockPos = if clockPart and clockPart:IsA("BasePart")
		then clockPart.Position
		else Vector3.new(94, 15, 129)
	local clockTick = spot("ClockTick", clockPos, 0.45, 5, 34)
	local floors: { BasePart? } = {}
	local chimes: { Sound } = {}
	local chimeIsFallback = asset("DoorChime") == nil
	for index, name in SHOPS do
		local group = set:FindFirstChild(name)
		local floor = group and group:FindFirstChild("ShopFloor")
		floors[index] = if floor and floor:IsA("BasePart") then floor else nil
		local f = floors[index]
		if f then
			spot(
				SHOP_TONES[index],
				f.Position + Vector3.new(0, 5, 0),
				if index == RECORDS then 0.55 else 0.4,
				6,
				26,
				index
			)
			local marquee = group and group:FindFirstChild("BusinessMarquee")
			local door = if marquee and marquee:IsA("BasePart")
				then Vector3.new(marquee.Position.X, 7, marquee.Position.Z)
				else f.Position + Vector3.new(0, 7, 0)
			chimes[index] =
				sound("DoorChime", asset("DoorChime") or CLICK, anchor("Door" .. name, door), false, 6, 40)
		end
	end

	-- One-shot emitters.
	local gullAnchor = anchor("Gulls", Vector3.new(-139, 20, 82))
	local gullId = asset("AmbGulls")
	local gulls = if gullId then sound("Gulls", gullId, gullAnchor, false, 12, 130) else nil
	local lapAnchor = anchor("Laps", Vector3.new(-140, -1.5, 85))
	local laps = if asset("AmbHarbour") then nil else sound("HarbourLap", SPLASH, lapAnchor, false, 8, 60)
	local tickFallback = if clockTick
		then nil
		else sound("ClockTickFallback", CLICK, anchor("Clock", clockPos), false, 3, 26)
	local doorAnchor = anchor("TheatreDoor", DOOR)
	local laughId, applauseId = asset("TheatreLaugh"), asset("TheatreApplause")
	local laugh = if laughId then sound("TheatreLaugh", laughId, doorAnchor, false, 10, 90) else nil
	local applause = if applauseId
		then sound("TheatreApplause", applauseId, doorAnchor, false, 10, 90)
		else nil
	for _, s in { laugh, applause } do
		if s then
			local doors = Instance.new("EqualizerSoundEffect")
			doors.HighGain = -24
			doors.MidGain = -7
			doors.LowGain = 2
			doors.Parent = s
		end
	end

	-- Streetcar: found lazily because the server builds it after the set loads.
	local tramPart: BasePart? = nil
	local tramModel: Instance? = nil
	local tramBell: Sound? = nil
	local tramBellFallback = asset("TramBell") == nil
	local tramRun: Spot? = nil
	local lastStop: string? = nil

	local status: Instance? = nil
	local lastPhase = ""
	local lastRound: number? = nil

	local slowClock = 0
	local now = 0
	local nextGull = 4
	local nextLap = 2
	local nextTick = 0
	local tickTock = false
	local clockNear = false
	local currentShop = 0
	local lastChime = -10
	local ambientMuted = false
	local musicMuted = false

	local function play(s: Sound, volume: number, speed: number)
		s.Volume = volume
		s.PlaybackSpeed = speed
		s.TimePosition = 0
		s:Play()
	end
	local function ring(s: Sound, fallback: boolean, notes: { number }, volume: number)
		if not fallback then
			play(s, volume, 1)
			return
		end
		play(s, volume * 0.8, notes[1])
		for i = 2, #notes do
			task.delay((i - 1) * 0.2, function()
				if s.Parent then
					play(s, volume * 0.8, notes[i])
				end
			end)
		end
	end

	local function findTram()
		local railway = workspace:FindFirstChild("DistrictRailway")
		local model = railway and railway:FindFirstChild("LotLine")
		local root = model and (model:FindFirstChild("Chassis") or (model :: any).PrimaryPart)
		if not model or not root or not root:IsA("BasePart") then
			return
		end
		tramModel = model
		tramPart = root
		tramBell = sound("TramBell", asset("TramBell") or CLICK, root, false, 12, 110)
		local runId = asset("AmbTramRun")
		if runId then
			local entry: Spot = {
				sound = sound("TramRun", runId, root, true, 10, 85),
				volume = 0.45,
				current = 0,
				target = 0,
				position = root.Position,
				part = root,
				reach = 85,
				gate = 0,
				shop = 0,
			}
			table.insert(spots, entry)
			tramRun = entry
		end
		lastStop = model:GetAttribute("Stop") :: string?
	end

	local function slow(listener: Vector3)
		ambientMuted = player:GetAttribute("AmbienceMuted") == true
		musicMuted = player:GetAttribute("MusicMuted") == true
		ambientGroup.Volume = if ambientMuted then 0 else 1
		musicGroup.Volume = if musicMuted then 0 else 1
		local x, z = listener.X, listener.Z
		local inTheatre = math.abs(x) <= 30 and z >= -27 and z <= 32.5 and listener.Y < 34
		local listenerShop = 0
		for index = 1, #SHOPS do
			if inside(floors[index], listener) then
				listenerShop = index
				break
			end
		end
		local outdoor = if inTheatre then 0 elseif listenerShop > 0 then 0.3 else 1
		local marketWeight = rectWeight(x, z, market[1])
		for _, b in beds do
			local w = 0
			for _, r in b.rects do
				local rw = rectWeight(x, z, r)
				if rw > w then
					w = rw
				end
			end
			if b.music then
				w *= (1 - 0.8 * marketWeight) * (if listenerShop == RECORDS then 0 else 1)
			end
			b.target = b.volume * w * outdoor
		end

		-- The live show, heard from the street.
		if not status or not status.Parent then
			status = Storage:FindFirstChild("ShowStatus")
		end
		local phase = if status then status:GetAttribute("Phase") else nil
		phase = if type(phase) == "string" then phase else ""
		local live = LIVE[phase] == true
		if spill then
			spill.gate = if live and not inTheatre then 1 else 0
		end
		local outside = not inTheatre and (listener - DOOR).Magnitude < 95
		if phase ~= lastPhase then
			if phase == "host" and laugh and outside then
				play(laugh, 0.55, rng:NextNumber(0.96, 1.04))
			end
			lastPhase = phase
		end
		local round = if status then status:GetAttribute("Round") else nil
		if type(round) == "number" then
			if lastRound and round > lastRound and applause and outside then
				local band = if status then status:GetAttribute("LastBand") else nil
				local level = if type(band) == "number" then math.clamp(band, 0, 3) else 1
				play(applause, 0.35 + 0.15 * level, 1)
			end
			lastRound = round
		end

		-- Streetcar arrivals and departures.
		if not tramPart or not tramPart.Parent then
			tramPart = nil
			findTram()
		end
		if tramModel and tramPart then
			local stop = tramModel:GetAttribute("Stop")
			local title = if type(stop) == "string" then stop else ""
			if title ~= (lastStop or "") then
				if tramBell then
					if title ~= "" then
						ring(tramBell, tramBellFallback, { 1.22, 1.22 }, 0.6)
					else
						ring(tramBell, tramBellFallback, { 1.22 }, 0.45)
					end
				end
				lastStop = title
			end
			if tramRun then
				tramRun.gate = if title == "" then 1 else 0.15
			end
		end

		-- Shop door chimes: the character, not the camera, walks through the door.
		local character = player.Character
		local root = character and character:FindFirstChild("HumanoidRootPart")
		local shop = 0
		if root and root:IsA("BasePart") then
			for index = 1, #SHOPS do
				if inside(floors[index], root.Position) then
					shop = index
					break
				end
			end
		end
		if shop ~= currentShop then
			if shop > 0 and currentShop == 0 and now - lastChime > 2 and chimes[shop] then
				lastChime = now
				ring(chimes[shop], chimeIsFallback, { 1.9, 1.5 }, 0.5)
			end
			currentShop = shop
		end

		-- Spot loops only run within reach.
		for _, s in spots do
			local pos = if s.part then s.part.Position else s.position
			local near = (listener - pos).Magnitude <= s.reach + 12
			local room = if s.shop > 0
				then (if listenerShop == s.shop then 1 elseif inTheatre then 0 else 0.6)
				else outdoor
			s.target = if near then s.volume * s.gate * room else 0
		end

		-- Harbour one-shots: gull calls from the flying gulls, and engine-sound laps while no harbour bed exists.
		local harbourWeight = rectWeight(x, z, harbour) * outdoor
		if gulls and harbourWeight > 0.15 and now >= nextGull then
			nextGull = now + rng:NextNumber(6, 15)
			local sky = workspace:FindFirstChild("DistrictSky")
			local bird = sky and sky:FindFirstChild("HarborGull" .. rng:NextInteger(1, 9))
			local body = bird and bird:FindFirstChild("Body")
			gullAnchor.Position = if body and body:IsA("BasePart")
				then body.Position
				else Vector3.new(-139 + rng:NextNumber(-20, 20), 20, 82 + rng:NextNumber(-12, 12))
			play(gulls, 0.5 * harbourWeight + 0.15, rng:NextNumber(0.92, 1.08))
		end
		if laps and harbourWeight > 0.2 and now >= nextLap then
			nextLap = now + rng:NextNumber(2.6, 5.5)
			lapAnchor.Position = Vector3.new(rng:NextNumber(-160, -134), -1.5, rng:NextNumber(50, 120))
			play(laps, rng:NextNumber(0.07, 0.13) * harbourWeight, rng:NextNumber(0.42, 0.6))
		end
		clockNear = tickFallback ~= nil and not inTheatre and (listener - clockPos).Magnitude < 34
	end

	local function update(dt: number, listener: Vector3)
		now += dt
		slowClock += dt
		if slowClock >= 0.2 then
			slowClock = 0
			slow(listener)
		end
		-- Fallback tower clock: an engine click every second, alternating tick and tock.
		if clockNear and tickFallback and now >= nextTick then
			nextTick = now + 1
			tickTock = not tickTock
			play(tickFallback, 0.3, if tickTock then 0.6 else 0.52)
		end
		local k = math.min(1, dt * 1.6)
		for _, b in beds do
			local delta = b.target - b.current
			if math.abs(delta) > 0.0005 then
				b.current += delta * k
				b.sound.Volume = b.current
			end
			if b.target > 0 and not b.sound.Playing then
				b.sound.Playing = true
			elseif b.target == 0 and b.current < 0.003 and b.sound.Playing then
				b.current = 0
				b.sound.Volume = 0
				b.sound.Playing = false
			end
		end
		for _, s in spots do
			local delta = s.target - s.current
			if math.abs(delta) > 0.0005 then
				s.current += delta * k
				s.sound.Volume = s.current
			end
			if s.target > 0 and not s.sound.Playing then
				s.sound.Playing = true
			elseif s.target == 0 and s.current < 0.003 and s.sound.Playing then
				s.current = 0
				s.sound.Volume = 0
				s.sound.Playing = false
			end
		end
	end

	return { update = update }
end

return Ambience
