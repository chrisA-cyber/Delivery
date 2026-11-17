--!strict
-- Blue-hour presentation on the client: a quality tier, a small pool of practical lights moved onto the lanterns
-- nearest the camera, the marquee and BladeSign bulb chase, and the ambience driver. Global lighting lives in
-- default.project.json (Lighting); this script never changes the clock. One Heartbeat drives everything: the
-- light pool re-sorts four times a second, the chase steps about six times a second, and nothing allocates per
-- frame. Lighting.ShowGrade (ColorCorrection) and Lighting.ShowFocus (DepthOfField) belong to ShowFX.
local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local Run = game:GetService("RunService")
local GuiService = game:GetService("GuiService")
local UserInput = game:GetService("UserInputService")
local Storage = game:GetService("ReplicatedStorage")

if not game:IsLoaded() then
	game.Loaded:Wait()
end
local set = workspace:WaitForChild("ShowSet")
local Ambience = require(script.Parent:WaitForChild("Ambience"))

-- Quality tiers: 1 phones and low settings, 2 default, 3 high settings on capable machines.
local POINT_BUDGET = { 8, 16, 24 }
local SURFACE_BUDGET = { 0, 4, 8 }
local LIGHT_REACH = { 75, 115, 160 }
local POINT_POOL = 24
local SURFACE_POOL = 8
local CANDIDATE_CAP = 120

local warm = Color3.fromRGB(255, 206, 150)

-- Groups that are the theatre interior; the show rig lights them, so their bulbs get no pool lights.
local interior = {
	Architecture = true,
	Bandstand = true,
	VelvetFly = true,
	Dial = true,
	Flip = true,
	StageProps = true,
	FoleyRack = true,
	HouseBoxes = true,
	FloorInlay = true,
	Gallery = true,
	ShowRig = true,
}

type Rule = { range: number, brightness: number, color: Color3?, spacing: number }

-- Existing lantern parts by exact name. Parts named Lamp* (any group, Neon or Glass) use the Lamp rule and may
-- override it with attributes LightRange, LightBrightness and LightColor.
local rules: { [string]: Rule } = {
	LanternShade = { range = 16, brightness = 1.35, color = warm, spacing = 4 },
	PeristyleLantern = { range = 13, brightness = 1.15, color = Color3.fromRGB(255, 214, 160), spacing = 4 },
	MarketLantern = { range = 18, brightness = 1.5, color = Color3.fromRGB(255, 190, 140), spacing = 4 },
	FestoonLamp = { range = 14, brightness = 1.05, color = nil, spacing = 11 },
	StreetSconce = { range = 12, brightness = 1.2, color = Color3.fromRGB(255, 200, 150), spacing = 4 },
	HearthGlow = { range = 12, brightness = 1.6, color = Color3.fromRGB(255, 150, 90), spacing = 2 },
	ClockLantern = { range = 18, brightness = 1.3, color = Color3.fromRGB(255, 214, 170), spacing = 2 },
	LighthouseLens = { range = 24, brightness = 1.5, color = Color3.fromRGB(255, 236, 190), spacing = 2 },
	PortBeacon = { range = 10, brightness = 1.2, color = nil, spacing = 2 },
	LanternGlass = { range = 10, brightness = 1.1, color = warm, spacing = 2 },
	PortalCove = { range = 14, brightness = 0.9, color = Color3.fromRGB(255, 214, 176), spacing = 4 },
}
local lampRule: Rule = { range = 14, brightness = 1.2, color = nil, spacing = 6 }
local windowRule: Rule = { range = 10, brightness = 0.8, color = Color3.fromRGB(255, 214, 170), spacing = 3 }
local chaseLightRule: Rule =
	{ range = 22, brightness = 1.3, color = Color3.fromRGB(255, 210, 160), spacing = 1 }

-- Candidate lanterns (struct of arrays so the update loop never allocates).
local candPart: { BasePart } = {}
local candKind: { number } = {} -- 1 point, 2 surface
local candRange: { number } = {}
local candBright: { number } = {}
local candColor: { Color3 } = {}
local candFace: { Enum.NormalId } = {}
local candKey: { number } = {}
local candSlot: { number } = {}
local candWant: { boolean } = {}
local order: { number } = {}

local function lightColour(part: BasePart, rule: Rule): Color3
	local custom = part:GetAttribute("LightColor")
	if typeof(custom) == "Color3" then
		return custom
	end
	if rule.color then
		return rule.color
	end
	-- Tinted bulbs (festoons, beacons) keep a little of their own colour inside a warm pool.
	return warm:Lerp(part.Color, 0.35)
end

local function addCandidate(part: BasePart, rule: Rule, kind: number)
	if #candPart >= CANDIDATE_CAP then
		return
	end
	local pos = part.Position
	for i = 1, #candPart do
		if (candPart[i].Position - pos).Magnitude < rule.spacing then
			return
		end
	end
	local range = part:GetAttribute("LightRange")
	local brightness = part:GetAttribute("LightBrightness")
	local face = Enum.NormalId.Front
	local faceName = part:GetAttribute("LightFace")
	if type(faceName) == "string" then
		for _, item in Enum.NormalId:GetEnumItems() do
			if item.Name == faceName then
				face = item
			end
		end
	end
	table.insert(candPart, part)
	table.insert(candKind, kind)
	table.insert(candRange, if type(range) == "number" then range else rule.range)
	table.insert(candBright, if type(brightness) == "number" then brightness else rule.brightness)
	table.insert(candColor, lightColour(part, rule))
	table.insert(candFace, face)
	table.insert(candKey, 0)
	table.insert(candSlot, 0)
	table.insert(candWant, false)
	table.insert(order, #candPart)
end

-- Marquee and BladeSign bulbs that chase.
type Chase = {
	parts: { BasePart },
	bright: { Color3 },
	dim: { Color3 },
	center: Vector3,
	key: string,
}
local chases: { Chase } = {}
local chaseByKey: { [string]: Chase } = {}
local function chaseFor(key: string): Chase
	local found = chaseByKey[key]
	if found then
		return found
	end
	local entry: Chase = { parts = {}, bright = {}, dim = {}, center = Vector3.zero, key = key }
	chaseByKey[key] = entry
	table.insert(chases, entry)
	return entry
end
local bladeGuis: { SurfaceGui } = {}
local bladeBase: { number } = {}

local function isLit(part: BasePart): boolean
	return part.Material == Enum.Material.Neon or part.Material == Enum.Material.Glass
end

local function chaseKey(part: BasePart): string?
	if part.Name == "StreetMarqueeBulb" then
		return "TheatreMarquee"
	end
	if part.Name:sub(1, 4) ~= "Lamp" then
		return nil
	end
	local blade = part:FindFirstAncestor("BladeSign")
	if blade then
		return blade:GetFullName()
	end
	-- The theatre canopy's small chaser and marquee bulbs glow and chase; they never take pool lights.
	if part.Name == "LampChaser" or part.Name == "LampMarqueeBulb" then
		return "TheatreMarquee"
	end
	local node = part.Parent
	while node and node ~= set do
		if node.Name:find("Marquee") then
			return node:GetFullName()
		end
		node = node.Parent
	end
	return nil
end

local function discover()
	local lamps: { BasePart } = {}
	local windows: { BasePart } = {}
	local named: { BasePart } = {}
	-- Scan every exterior group, plus a BladeSign wherever the art nests it.
	local roots: { Instance } = {}
	for _, group in set:GetChildren() do
		if not interior[group.Name] then
			table.insert(roots, group)
		else
			local blade = group:FindFirstChild("BladeSign", true)
			if blade then
				table.insert(roots, blade)
			end
		end
	end
	local function visit(item: Instance)
		if item:IsA("BasePart") then
			local key = chaseKey(item)
			if key then
				local chase = chaseFor(key)
				table.insert(chase.parts, item)
			elseif item.Name:sub(1, 9) == "LitWindow" then
				table.insert(windows, item)
			elseif item.Name:sub(1, 4) == "Lamp" and isLit(item) then
				table.insert(lamps, item)
			elseif rules[item.Name] then
				table.insert(named, item)
			end
		elseif item:IsA("SurfaceGui") and item:FindFirstAncestor("BladeSign") then
			table.insert(bladeGuis, item)
		end
	end
	for _, group in roots do
		visit(group)
		for _, item in group:GetDescendants() do
			visit(item)
		end
	end
	-- Chases: order bulbs along the sign's long axis, then give each chase one representative pool light.
	for _, chase in chases do
		local lo, hi = Vector3.one * math.huge, -Vector3.one * math.huge
		for _, p in chase.parts do
			lo, hi = lo:Min(p.Position), hi:Max(p.Position)
		end
		local spread = hi - lo
		chase.center = (lo + hi) / 2
		local vertical = spread.Y >= spread.X and spread.Y >= spread.Z
		local alongX = spread.X >= spread.Z
		table.sort(chase.parts, function(a, b)
			if vertical then
				return a.Position.Y > b.Position.Y
			elseif alongX then
				return a.Position.X < b.Position.X
			end
			return a.Position.Z < b.Position.Z
		end)
		local nearest: BasePart? = nil
		local best = math.huge
		for _, p in chase.parts do
			table.insert(chase.bright, p.Color)
			table.insert(chase.dim, p.Color:Lerp(Color3.fromRGB(70, 38, 30), 0.5))
			local d = (p.Position - chase.center).Magnitude
			if d < best then
				best, nearest = d, p
			end
		end
		if nearest and chase.key ~= "TheatreMarquee" then
			addCandidate(nearest, chaseLightRule, 1)
		end
	end
	-- Priority: authored lanterns first, then the new Lamp* convention, then lit windows.
	for _, part in named do
		addCandidate(part, rules[part.Name], 1)
	end
	for _, part in lamps do
		addCandidate(part, lampRule, 1)
	end
	for _, part in windows do
		addCandidate(part, windowRule, 2)
	end
	table.sort(bladeGuis, function(a, b)
		local pa, pb = a.Parent, b.Parent
		local ya = if pa and pa:IsA("BasePart") then pa.Position.Y else 0
		local yb = if pb and pb:IsA("BasePart") then pb.Position.Y else 0
		return ya > yb
	end)
	for i, gui in bladeGuis do
		bladeBase[i] = gui.Brightness
	end
end
discover()

-- Light pools: a fixed set of lights re-parented onto the nearest candidates.
local pointLights: { PointLight } = {}
local pointHost: { number } = {}
local surfaceLights: { SurfaceLight } = {}
local surfaceHost: { number } = {}
local parking = Instance.new("Attachment")
parking.Name = "AtmosphereLightPool"
parking.Parent = workspace.Terrain
local function newPoint(): PointLight
	local l = Instance.new("PointLight")
	l.Name = "AtmosLantern"
	l.Shadows = false
	l.Enabled = false
	l.Parent = parking
	return l
end
local function newSurface(): SurfaceLight
	local l = Instance.new("SurfaceLight")
	l.Name = "AtmosWindow"
	l.Shadows = false
	l.Angle = 75
	l.Enabled = false
	l.Parent = parking
	return l
end
for i = 1, POINT_POOL do
	pointLights[i] = newPoint()
	pointHost[i] = 0
end
for i = 1, SURFACE_POOL do
	surfaceLights[i] = newSurface()
	surfaceHost[i] = 0
end

local tier = 2
local function byKey(a: number, b: number): boolean
	return candKey[a] < candKey[b]
end

local function updateLights(camPos: Vector3)
	local n = #candPart
	for i = 1, n do
		local part = candPart[i]
		if part.Parent then
			local d = (part.Position - camPos).Magnitude
			-- Lit candidates keep a small advantage so lights do not hop between equidistant lanterns.
			candKey[i] = if candSlot[i] > 0 then d - 6 else d
		else
			candKey[i] = math.huge
		end
		candWant[i] = false
	end
	table.sort(order, byKey)
	local reach = LIGHT_REACH[tier]
	local points, surfaces = POINT_BUDGET[tier], SURFACE_BUDGET[tier]
	for _, i in order do
		if candKey[i] > reach then
			break
		end
		if candKind[i] == 1 and points > 0 then
			points -= 1
			candWant[i] = true
		elseif candKind[i] == 2 and surfaces > 0 then
			surfaces -= 1
			candWant[i] = true
		end
	end
	-- Release lights whose lantern dropped out of the nearest set.
	for slot = 1, POINT_POOL do
		local host = pointHost[slot]
		if host > 0 and not candWant[host] then
			pointLights[slot].Enabled = false
			if not candPart[host].Parent then
				-- The lantern was removed and took its light with it; replace the pool entry.
				pointLights[slot] = newPoint()
			end
			candSlot[host] = 0
			pointHost[slot] = 0
		end
	end
	for slot = 1, SURFACE_POOL do
		local host = surfaceHost[slot]
		if host > 0 and not candWant[host] then
			surfaceLights[slot].Enabled = false
			if not candPart[host].Parent then
				surfaceLights[slot] = newSurface()
			end
			candSlot[host] = 0
			surfaceHost[slot] = 0
		end
	end
	-- Assign free lights to newly wanted lanterns; existing ones ease up to full brightness.
	for i = 1, n do
		if candWant[i] then
			local slot = candSlot[i]
			if slot == 0 then
				local isPoint = candKind[i] == 1
				local hosts = if isPoint then pointHost else surfaceHost
				for s = 1, #hosts do
					if hosts[s] == 0 then
						slot = s
						break
					end
				end
				if slot > 0 then
					hosts[slot] = i
					candSlot[i] = slot
					local l: Light = if isPoint then pointLights[slot] else surfaceLights[slot]
					l.Brightness = 0
					l.Color = candColor[i]
					if isPoint then
						pointLights[slot].Range = candRange[i]
					else
						surfaceLights[slot].Range = candRange[i]
						surfaceLights[slot].Face = candFace[i]
					end
					l.Parent = candPart[i]
					l.Enabled = true
				end
			else
				local l: Light = if candKind[i] == 1 then pointLights[slot] else surfaceLights[slot]
				local target = candBright[i]
				if l.Brightness < target then
					l.Brightness = math.min(target, l.Brightness + target * 0.34)
				end
			end
		end
	end
end

-- Chase state.
local chaseStep = 0
local chaseClock = 0
local chaseStill = false
local encoreUntil = 0
local sweepClock = 0
local function stepChase(camPos: Vector3, fast: boolean)
	chaseStep += 1
	for _, chase in chases do
		if (chase.center - camPos).Magnitude < 200 then
			local parts, bright, dim = chase.parts, chase.bright, chase.dim
			for i = 1, #parts do
				local off = if fast then (i + chaseStep) % 2 == 0 else (i + chaseStep) % 4 == 0
				parts[i].Color = if off then dim[i] else bright[i]
			end
		end
	end
end
local function stillChase()
	for _, chase in chases do
		for i, part in chase.parts do
			part.Color = chase.bright[i]
		end
	end
	for i, gui in bladeGuis do
		gui.Brightness = bladeBase[i]
	end
end

-- Quality: the saved graphics level when set, otherwise a frame-rate estimate. Phones cap at tier 2.
local touchOnly = UserInput.TouchEnabled and not UserInput.KeyboardEnabled
local function savedLevel(): number
	local ok, level = pcall(function()
		return (UserSettings():GetService("UserGameSettings") :: any).SavedQualityLevel.Value
	end)
	return if ok and type(level) == "number" then level else 0
end
local sunRays = Lighting:FindFirstChild("DuskRays")
local baseExposure = Lighting.ExposureCompensation
local slowWindows, fastWindows = 0, 0
local function applyTier(next: number)
	if touchOnly then
		next = math.min(next, 2)
	end
	tier = math.clamp(next, 1, 3)
	if sunRays and sunRays:IsA("SunRaysEffect") then
		sunRays.Enabled = tier >= 2
	end
	-- With fewer practical lights the low tier lifts exposure a touch so the streets stay readable.
	Lighting.ExposureCompensation = baseExposure + (if tier == 1 then 0.12 else 0)
end
local function chooseTier(fps: number)
	local level = savedLevel()
	if level > 0 then
		applyTier(if level <= 3 then 1 elseif level <= 7 then 2 else 3)
		return
	end
	slowWindows = if fps < 32 then slowWindows + 1 else 0
	fastWindows = if fps > 52 then fastWindows + 1 else 0
	if slowWindows >= 2 and tier > 1 then
		slowWindows = 0
		applyTier(tier - 1)
	elseif fastWindows >= 3 and tier < 3 then
		fastWindows = 0
		applyTier(tier + 1)
	end
end
applyTier(if savedLevel() >= 8 then 3 elseif savedLevel() >= 1 and savedLevel() <= 3 then 1 else 2)

local ambience = Ambience.new(set)
local status: Instance? = nil
local lastRound: number? = nil
local lightClock = 0
local tierClock, tierFrames = 0, 0
local statusClock = 0
Run.Heartbeat:Connect(function(dt)
	tierFrames += 1
	tierClock += dt
	if tierClock >= 4 then
		chooseTier(tierFrames / tierClock)
		tierClock, tierFrames = 0, 0
	end
	local camera = workspace.CurrentCamera
	if not camera then
		return
	end
	local camPos = camera.CFrame.Position
	ambience.update(dt, camPos)
	lightClock += dt
	if lightClock >= 0.25 then
		lightClock = 0
		updateLights(camPos)
	end
	-- An encore-level reveal (LastBand 3) sets the bulbs racing for eight seconds.
	statusClock += dt
	if statusClock >= 0.5 then
		statusClock = 0
		if not status or not status.Parent then
			status = Storage:FindFirstChild("ShowStatus")
		end
		local round = if status then status:GetAttribute("Round") else nil
		if type(round) == "number" then
			local band = if status then status:GetAttribute("LastBand") else nil
			if lastRound and round > lastRound and band == 3 then
				encoreUntil = os.clock() + 8
			end
			lastRound = round
		end
	end
	if GuiService.ReducedMotionEnabled then
		if not chaseStill then
			chaseStill = true
			stillChase()
		end
		return
	end
	chaseStill = false
	local fast = os.clock() < encoreUntil
	chaseClock += dt
	if chaseClock >= (if fast then 0.08 else 0.16) then
		chaseClock = 0
		stepChase(camPos, fast)
	end
	-- BladeSign sweep: every nine seconds a brighter band runs down the letters.
	local letters = #bladeGuis
	if letters > 0 then
		sweepClock += dt
		local lit = math.floor(sweepClock / 0.16) + 1
		for i = 1, letters do
			local base = bladeBase[i]
			local wanted = if i == lit or i == lit - 1 then base * 1.35 else base
			if bladeGuis[i].Brightness ~= wanted then
				bladeGuis[i].Brightness = wanted
			end
		end
		if sweepClock >= 9 then
			sweepClock = 0
		end
	end
end)

Players.LocalPlayer.CharacterAdded:Connect(function()
	-- A respawn can teleport the camera across town; re-sort the pool on the next frame.
	lightClock = 1
end)
