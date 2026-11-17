--!strict
-- Sky and water set dressing: a gull flock that lands on perches and scatters, kites on sagging strings,
-- a sailboat and the harbour launch bobbing, flags and festoons swaying, and the lighthouse beam at blue
-- hour. Nothing here collides or affects play. One Heartbeat drives it all; each group only updates near
-- the camera, and gulls keep HarborGull<n>/Body names for the ambience's gull calls.
local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local client = script.Parent
local StreetShow = require(client:WaitForChild("StreetShow"))

if not game:IsLoaded() then
	game.Loaded:Wait()
end
local set = workspace:WaitForChild("ShowSet")
local player = Players.LocalPlayer

local scenery = Instance.new("Folder")
scenery.Name = "DistrictSky"
scenery.Parent = workspace

local bone = Color3.fromRGB(252, 236, 195)
local ink = Color3.fromRGB(51, 63, 76)
local orange = Color3.fromRGB(247, 130, 76)
local blue = Color3.fromRGB(70, 136, 195)
local petal = Color3.fromHex("d58ca5")
local bulb = Color3.fromHex("ffdc9e")
local WATER = -2

local sin, cos = math.sin, math.cos

local function shape(parent: Instance, kind: string, name: string, size: Vector3, colour: Color3): BasePart
	local part = Instance.new(kind) :: BasePart
	part.Name = name
	part.Anchored = true
	part.CanCollide = false
	part.CanTouch = false
	part.CanQuery = false
	part.CastShadow = false
	part.Size = size
	part.Color = colour
	part.Material = Enum.Material.SmoothPlastic
	part.Parent = parent
	return part
end

----------------------------------------------------------------------------------------------------
-- Gulls
----------------------------------------------------------------------------------------------------
type Gull = {
	model: Model,
	parts: { BasePart },
	frames: { CFrame },
	pos: Vector3,
	vel: Vector3,
	state: string, -- "fly", "land", "perch"
	perch: number,
	until_: number,
	angle: number,
	radius: number,
	height: number,
	rate: number,
	flap: number,
	fold: number,
	yaw: number,
	bank: number,
	seed: number,
}

local perches = {
	Vector3.new(-149.06, 2.75, 60),
	Vector3.new(-149.06, 2.75, 93),
	Vector3.new(-132.94, 2.75, 46),
	Vector3.new(-132.94, 2.75, 57),
	Vector3.new(-131, 8.2, 51),
	Vector3.new(-132, 8.2, 99),
	Vector3.new(-112, 8.2, 90),
	Vector3.new(-96, 8.2, 57),
	Vector3.new(-128, 18.5, 57),
	Vector3.new(-126.4, 18.5, 59.3),
	Vector3.new(-80, 20.9, 50),
	Vector3.new(-94, 20.9, 63),
	Vector3.new(-159, 14.3, 105.4),
	Vector3.new(-156.4, 14.3, 108),
	Vector3.new(-146, 5.1, 58),
}
local perchTaken: { boolean } = table.create(#perches, false)
local FLOCK_CENTRE = Vector3.new(-139, 21, 82)

local function newGull(index: number): Gull
	local m = Instance.new("Model")
	m.Name = "HarborGull" .. index
	local parts: { BasePart } = {}
	local body = shape(m, "Part", "Body", Vector3.new(0.5, 0.46, 1.5), bone)
	local mesh = Instance.new("SpecialMesh")
	mesh.MeshType = Enum.MeshType.Sphere
	mesh.Parent = body
	table.insert(parts, body)
	local head = shape(m, "Part", "Head", Vector3.new(0.36, 0.36, 0.36), bone);
	(head :: Part).Shape = Enum.PartType.Ball
	table.insert(parts, head)
	table.insert(parts, shape(m, "WedgePart", "Beak", Vector3.new(0.12, 0.12, 0.34), orange))
	table.insert(parts, shape(m, "WedgePart", "Tail", Vector3.new(0.5, 0.12, 0.6), ink))
	for _ = 1, 2 do
		table.insert(parts, shape(m, "Part", "Wing", Vector3.new(1.3, 0.08, 0.62), bone))
	end
	for _ = 1, 2 do
		table.insert(parts, shape(m, "WedgePart", "WingTip", Vector3.new(0.12, 0.08, 0.85), ink))
	end
	m.PrimaryPart = body
	m.Parent = scenery
	local frames: { CFrame } = table.create(#parts, CFrame.identity)
	local angle = index * 0.7
	return {
		model = m,
		parts = parts,
		frames = frames,
		pos = FLOCK_CENTRE + Vector3.new(cos(angle) * 18, index, sin(angle) * 12),
		vel = Vector3.zero,
		state = "fly",
		perch = 0,
		until_ = os.clock() + 8 + math.random() * 25,
		angle = angle,
		radius = 14 + (index % 4) * 3,
		height = (index % 3) * 2.2,
		rate = 0.22 + (index % 5) * 0.015,
		flap = 0,
		fold = 0,
		yaw = 0,
		bank = 0,
		seed = math.random() * 50,
	}
end

local gulls: { Gull } = {}
for i = 1, 9 do
	table.insert(gulls, newGull(i))
end
local scatterUntil = 0

local function freePerch(): number
	local start = math.random(1, #perches)
	for n = 0, #perches - 1 do
		local i = (start + n - 1) % #perches + 1
		if not perchTaken[i] then
			return i
		end
	end
	return 0
end

local function takeOff(g: Gull, now: number)
	if g.perch > 0 then
		perchTaken[g.perch] = false
	end
	g.perch = 0
	g.state = "fly"
	g.vel = Vector3.new(math.random() - 0.5, 1, math.random() - 0.5) * 9
	g.until_ = now + 20 + math.random() * 30
end

local function stepGull(g: Gull, dt: number, now: number, near: Vector3?)
	local scatter = now < scatterUntil
	if g.state == "perch" then
		local spooked = near and (near - g.pos).Magnitude < 9
		if scatter or now > g.until_ or spooked then
			takeOff(g, now)
		end
	elseif g.state == "land" and scatter then
		takeOff(g, now)
	elseif g.state == "fly" and not scatter and now > g.until_ then
		local p = freePerch()
		if p > 0 then
			perchTaken[p] = true
			g.perch = p
			g.state = "land"
		else
			g.until_ = now + 10
		end
	end
	if g.state == "perch" then
		g.vel = Vector3.zero
		g.fold += (1 - g.fold) * math.min(1, dt * 6)
		g.bank = 0
		-- Head turns and the odd hop round on the spot.
		if sin(now * 0.7 + g.seed) > 0.97 then
			g.yaw += dt * 2
		end
	else
		local target: Vector3
		local gain = 1.4
		if g.state == "land" then
			local spot = perches[g.perch] + Vector3.new(0, 0.32, 0)
			local offset = spot - g.pos
			local d = offset.Magnitude
			-- Approach from slightly above, then settle.
			target = if d > 6 then spot + Vector3.new(0, 2.5, 0) else spot
			gain = 2.2
			if d < 0.35 then
				g.state = "perch"
				g.pos = spot
				g.until_ = now + 15 + math.random() * 30
			end
		else
			g.angle += dt * g.rate * (if scatter then 1.8 else 1)
			local centre = FLOCK_CENTRE + Vector3.new(sin(now * 0.05) * 8, 0, cos(now * 0.04) * 10)
			local radius = g.radius * (if scatter then 2.2 else 1)
			local lift = g.height + sin(g.angle * 2 + g.seed) * 1.5 + (if scatter then 14 else 0)
			target = centre + Vector3.new(cos(g.angle) * radius, lift, sin(g.angle) * radius * 0.7)
		end
		if g.state ~= "perch" then
			local desired = (target - g.pos) * gain
			local speed = desired.Magnitude
			local cap = if scatter then 16 else 9
			if speed > cap then
				desired = desired * (cap / speed)
			end
			local before = g.vel
			g.vel = g.vel + (desired - g.vel) * math.min(1, dt * 1.8)
			g.pos += g.vel * dt
			local flat = Vector3.new(g.vel.X, 0, g.vel.Z)
			if flat.Magnitude > 0.3 then
				local yaw = math.atan2(-flat.X, -flat.Z)
				local turnRate = ((yaw - g.yaw + math.pi) % (2 * math.pi) - math.pi)
				g.yaw += turnRate * math.min(1, dt * 4)
				g.bank += (math.clamp(-turnRate * 1.2, -0.7, 0.7) - g.bank) * math.min(1, dt * 3)
			end
			local climbing = g.vel.Y > 0.6 or (g.vel - before).Magnitude > dt * 6 or g.state == "land"
			g.fold += (0 - g.fold) * math.min(1, dt * 6)
			local glide = sin(now * 0.6 + g.seed) > 0.2 and not climbing and not scatter
			local flapTarget = if glide then 0 else 1
			g.flap += (flapTarget - g.flap) * math.min(1, dt * 4)
		end
	end
end

local function poseGull(g: Gull, now: number)
	local body = CFrame.new(g.pos) * CFrame.Angles(0, g.yaw, 0) * CFrame.Angles(0, 0, g.bank)
	local fold = g.fold
	local beat = sin(now * 13 + g.seed) * 0.75 * g.flap + 0.12 * (1 - g.flap)
	local a = beat * (1 - fold)
	local frames = g.frames
	local bob = if g.state == "perch"
		then CFrame.Angles(math.max(0, sin(now * 1.3 + g.seed)) * 0.25, 0, 0)
		else CFrame.identity
	frames[1] = body
	frames[2] = body * CFrame.new(0, 0.26, -0.72) * bob
	frames[3] = body * CFrame.new(0, 0.24, -0.98) * bob
	frames[4] = body * CFrame.new(0, 0.05, 0.85)
	for side = -1, 1, 2 do
		local hinge = body
			* CFrame.new(side * 0.2, 0.12, -0.05)
			* CFrame.Angles(0, -side * 1.35 * fold, side * a)
		local i = if side < 0 then 5 else 6
		frames[i] = hinge * CFrame.new(side * 0.65, 0, 0)
		frames[i + 2] = hinge
			* CFrame.new(side * 1.3, 0, 0)
			* CFrame.Angles(0, 0, side * a * 0.6)
			* CFrame.new(side * 0.3, 0, 0.12)
	end
	workspace:BulkMoveTo(g.parts, frames, Enum.BulkMoveMode.FireCFrameChanged)
end

----------------------------------------------------------------------------------------------------
-- Kites
----------------------------------------------------------------------------------------------------
type Kite = {
	parts: { BasePart },
	offsets: { CFrame },
	frames: { CFrame },
	stake: Vector3,
	lift: Vector3,
	knot: Attachment,
	thread: Beam,
	seed: number,
}

local function newKite(index: number, colour: Color3, stake: Vector3, lift: Vector3): Kite
	local m = Instance.new("Model")
	m.Name = "SignalKite" .. index
	local parts: { BasePart } = {}
	local offsets: { CFrame } = {}
	local function piece(kind: string, name: string, size: Vector3, offset: CFrame, c: Color3): BasePart
		local p = shape(m, kind, name, size, c)
		table.insert(parts, p)
		table.insert(offsets, offset)
		return p
	end
	piece("Part", "Sail", Vector3.new(2.65, 2.65, 0.09), CFrame.Angles(0, 0, math.pi / 4), colour)
	local spine = piece("Part", "Spine", Vector3.new(0.11, 3.78, 0.13), CFrame.new(0, 0, 0.05), bone)
	piece("Part", "Spar", Vector3.new(3.77, 0.12, 0.13), CFrame.new(0, 0.3, 0.04), bone)
	for i = 1, 4 do
		piece(
			"Part",
			"Ribbon",
			Vector3.new(0.22, 0.8, 0.06),
			CFrame.identity,
			if i % 2 == 0 then bone else colour
		)
	end
	m.Parent = scenery
	local post =
		shape(scenery, "Part", "KiteStake", Vector3.new(0.22, 1.3, 0.22), Color3.fromRGB(120, 84, 56))
	post.CFrame = CFrame.new(stake + Vector3.new(0, 0.6, 0))
	local base = Instance.new("Attachment")
	base.Position = Vector3.new(0, 0.6, 0)
	base.Parent = post
	-- The string leaves the stake almost level, so its curve droops like a real line.
	local toward = Vector3.new(lift.X, 0, lift.Z).Unit
	base.WorldAxis = (toward + Vector3.new(0, 0.35, 0)).Unit
	local knot = Instance.new("Attachment")
	knot.Position = Vector3.new(0, -0.6, 0.05)
	knot.Parent = spine
	local thread = Instance.new("Beam")
	thread.Attachment0 = base
	thread.Attachment1 = knot
	thread.Width0 = 0.05
	thread.Width1 = 0.04
	thread.Color = ColorSequence.new(bone)
	thread.Transparency = NumberSequence.new(0.3)
	thread.FaceCamera = true
	thread.Segments = 12
	thread.CurveSize0 = 9
	thread.CurveSize1 = 3
	thread.Parent = post
	return {
		parts = parts,
		offsets = offsets,
		frames = table.create(#parts, CFrame.identity),
		stake = stake,
		lift = lift,
		knot = knot,
		thread = thread,
		seed = index * 1.9,
	}
end

local kites = {
	newKite(1, orange, Vector3.new(150, 0, 112), Vector3.new(12, 24, -3)),
	newKite(2, blue, Vector3.new(157, 0, 88), Vector3.new(9, 28, 4)),
	newKite(3, petal, Vector3.new(146, 0, 50), Vector3.new(13, 21, 2)),
}
local UP = Vector3.new(0, 1, 0)

local function poseKite(k: Kite, now: number)
	local t = now + k.seed
	local gust = sin(t * 0.31) * 0.5 + sin(t * 0.83) * 0.3
	local pos = k.stake
		+ k.lift
		+ Vector3.new(sin(t * 0.37) * 2.2, cos(t * 0.29) * 1.4 + gust, sin(t * 0.23) * 3)
	-- The sail faces back down the string and rocks in the wind.
	local face = CFrame.lookAt(pos, k.stake + Vector3.new(0, 4, 0))
		* CFrame.Angles(math.rad(-25), 0, sin(t * 0.9) * 0.22 + gust * 0.1)
	local frames, offsets = k.frames, k.offsets
	for i = 1, 3 do
		frames[i] = face * offsets[i]
	end
	for i = 1, 4 do
		local wave = sin(t * 3.1 - i * 0.8)
		frames[3 + i] = face
			* CFrame.new(wave * 0.18 * i, -2 - i * 0.78, 0.25 * i)
			* CFrame.Angles(0.2 * i, 0, wave * 0.45)
	end
	workspace:BulkMoveTo(k.parts, frames, Enum.BulkMoveMode.FireCFrameChanged)
	-- Tension: a gust pulls the line straighter, a lull lets it sag.
	k.thread.CurveSize0 = 9 - gust * 3
	k.knot.WorldAxis = UP
end

----------------------------------------------------------------------------------------------------
-- Boats
----------------------------------------------------------------------------------------------------
type Rigid = { parts: { BasePart }, rest: { CFrame }, frames: { CFrame }, centre: CFrame }

local function rigid(parts: { BasePart }, centre: CFrame): Rigid
	local rest: { CFrame } = {}
	for _, p in parts do
		table.insert(rest, centre:ToObjectSpace(p.CFrame))
	end
	return { parts = parts, rest = rest, frames = table.create(#parts, CFrame.identity), centre = centre }
end

local function moveRigid(r: Rigid, at: CFrame)
	local frames, rest = r.frames, r.rest
	for i = 1, #rest do
		frames[i] = at * rest[i]
	end
	workspace:BulkMoveTo(r.parts, frames, Enum.BulkMoveMode.FireCFrameChanged)
end

-- The pier's launch: client-side bob of the existing (non-colliding) parts.
local launch: Rigid? = nil
do
	local pier = set:FindFirstChild("BroadcastPier")
	local names = {
		LaunchHull = true,
		LaunchGunwale = true,
		LaunchDeck = true,
		LaunchRoof = true,
		Wheelhouse = true,
		HelmGlass = true,
		PortGlass = true,
		BoatAerial = true,
		PortBeacon = true,
	}
	local parts: { BasePart } = {}
	if pier then
		for _, item in pier:GetDescendants() do
			if item:IsA("BasePart") and names[item.Name] and not item.CanCollide then
				if (item.Position - Vector3.new(-159, 0, 69)).Magnitude < 14 then
					table.insert(parts, item)
				end
			end
		end
	end
	if #parts > 0 then
		launch = rigid(parts, CFrame.new(-159, -0.5, 69))
	end
end

-- A small sailboat tacking round the outer harbour.
local sailboat: Rigid
do
	local m = Instance.new("Model")
	m.Name = "HarbourSailboat"
	local hullColour = Color3.fromRGB(240, 236, 226)
	local parts = {
		shape(m, "Part", "Hull", Vector3.new(2.6, 1.3, 7), hullColour),
		shape(m, "WedgePart", "Bow", Vector3.new(2.6, 1.3, 2.4), hullColour),
		shape(m, "Part", "Deck", Vector3.new(2.3, 0.14, 8.4), Color3.fromRGB(176, 128, 82)),
		shape(m, "Part", "Mast", Vector3.new(0.2, 8.6, 0.2), bone),
		shape(m, "WedgePart", "Mainsail", Vector3.new(0.08, 7.4, 4), Color3.fromRGB(255, 244, 222)),
		shape(m, "WedgePart", "Jib", Vector3.new(0.08, 5.6, 2.6), Color3.fromRGB(221, 180, 129)),
		shape(m, "Part", "Boom", Vector3.new(0.14, 0.14, 4.1), bone),
		shape(m, "Part", "Stripe", Vector3.new(2.64, 0.22, 7.04), Color3.fromHex("415ba8")),
	}
	-- Built around the origin facing -Z, then stored relative to it.
	parts[1].CFrame = CFrame.new(0, -0.15, 0.6)
	parts[2].CFrame = CFrame.new(0, -0.15, -4.1) * CFrame.Angles(0, math.pi, 0) * CFrame.Angles(math.pi, 0, 0)
	parts[3].CFrame = CFrame.new(0, 0.56, -0.2)
	parts[4].CFrame = CFrame.new(0, 4.9, -1.2)
	parts[5].CFrame = CFrame.new(0, 4.6, 0.85) * CFrame.Angles(0, math.pi, 0)
	parts[6].CFrame = CFrame.new(0, 3.7, -2.55)
	parts[7].CFrame = CFrame.new(0, 1.05, 0.85)
	parts[8].CFrame = CFrame.new(0, 0.25, 0.6)
	m.Parent = scenery
	sailboat = rigid(parts, CFrame.identity)
end

----------------------------------------------------------------------------------------------------
-- Flags, pennants and festoons (existing art, swayed locally)
----------------------------------------------------------------------------------------------------
type Swing =
	{ parts: { BasePart }, rest: { CFrame }, pivots: { CFrame }, frames: { CFrame }, centre: Vector3 }

local function swing(parts: { BasePart }, pivotOf: (BasePart) -> CFrame): Swing
	local rest: { CFrame } = {}
	local pivots: { CFrame } = {}
	local centre = Vector3.zero
	for _, p in parts do
		local pivot = pivotOf(p)
		table.insert(pivots, pivot)
		table.insert(rest, pivot:ToObjectSpace(p.CFrame))
		centre += p.Position
	end
	return {
		parts = parts,
		rest = rest,
		pivots = pivots,
		frames = table.create(#parts, CFrame.identity),
		centre = if #parts > 0 then centre / #parts else centre,
	}
end

local flags: { Swing } = {}
local pennants: Swing
local festoons: Swing
do
	local details = set:FindFirstChild("TownStreetDetails")
	if details then
		for _, pole in details:GetChildren() do
			if pole:IsA("BasePart") and pole.Name == "Flagpole" then
				local group: { BasePart } = {}
				for _, item in details:GetChildren() do
					if
						item:IsA("BasePart")
						and string.sub(item.Name, 1, 12) == "MerchantFlag"
						and (item.Position - pole.Position).Magnitude < 2.5
					then
						table.insert(group, item)
					end
				end
				if #group > 0 then
					local axis = CFrame.new(pole.Position)
					table.insert(
						flags,
						swing(group, function()
							return axis
						end)
					)
				end
			end
		end
	end
	local signals: { BasePart } = {}
	local park = set:FindFirstChild("SignalPark")
	if park then
		for _, item in park:GetDescendants() do
			if item:IsA("BasePart") and item.Name == "SignalPennant" then
				table.insert(signals, item)
			end
		end
	end
	pennants = swing(signals, function(p)
		return p.CFrame * CFrame.new(0, p.Size.Y / 2, 0)
	end)
	local bulbs: { BasePart } = {}
	local market = set:FindFirstChild("NightMarket")
	if market then
		for _, item in market:GetDescendants() do
			if item:IsA("BasePart") and item.Name == "FestoonLamp" then
				table.insert(bulbs, item)
			end
		end
	end
	festoons = swing(bulbs, function(p)
		return p.CFrame * CFrame.new(0, p.Size.Y / 2, 0)
	end)
end

local function swayFlag(s: Swing, now: number, seed: number)
	local a = sin(now * 1.7 + seed) * 0.12 + sin(now * 4.3 + seed * 2) * 0.05
	local turnBy = CFrame.Angles(0, a, 0)
	for i = 1, #s.parts do
		s.frames[i] = s.pivots[i] * turnBy * s.rest[i]
	end
	workspace:BulkMoveTo(s.parts, s.frames, Enum.BulkMoveMode.FireCFrameChanged)
end

local function swayHanging(s: Swing, now: number, amount: number)
	for i = 1, #s.parts do
		local pivot = s.pivots[i]
		local phase = pivot.X * 0.21 + pivot.Z * 0.13
		local tilt =
			CFrame.Angles(sin(now * 1.4 + phase) * amount, 0, sin(now * 1.1 + phase * 1.7) * amount * 0.6)
		s.frames[i] = pivot * tilt * s.rest[i]
	end
	workspace:BulkMoveTo(s.parts, s.frames, Enum.BulkMoveMode.FireCFrameChanged)
end

----------------------------------------------------------------------------------------------------
-- Lighthouse beam
----------------------------------------------------------------------------------------------------
local LENS = Vector3.new(-159, 15.26, 108)
do
	local lens = set:FindFirstChild("LighthouseLens", true)
	if lens and lens:IsA("BasePart") then
		LENS = lens.Position
	end
end
local sweep = shape(scenery, "Part", "SweepPivot", Vector3.new(0.2, 0.2, 0.2), bulb)
sweep.Transparency = 1
sweep.CFrame = CFrame.new(LENS)
local beams: { Beam } = {}
local centre = Instance.new("Attachment")
centre.Parent = sweep
for _, direction in { -1, 1 } do
	local far = Instance.new("Attachment")
	far.Position = Vector3.new(0, -3, direction * 75)
	far.Parent = sweep
	local beam = Instance.new("Beam")
	beam.Attachment0 = centre
	beam.Attachment1 = far
	beam.Width0 = 1.4
	beam.Width1 = 16
	beam.FaceCamera = true
	beam.LightEmission = 1
	beam.LightInfluence = 0
	beam.Segments = 2
	beam.Color = ColorSequence.new(bulb)
	beam.Transparency = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0.5),
		NumberSequenceKeypoint.new(0.45, 0.82),
		NumberSequenceKeypoint.new(1, 1),
	})
	beam.Enabled = false
	beam.Parent = sweep
	table.insert(beams, beam)
end
local function blueHour(): boolean
	local t = Lighting.ClockTime
	return t >= 16.6 or t <= 6.6
end

----------------------------------------------------------------------------------------------------
-- Loop
----------------------------------------------------------------------------------------------------
StreetShow.onReveal(function(_band: number, encore: boolean)
	if encore then
		scatterUntil = os.clock() + 10
	end
end)

local HARBOUR = Vector3.new(-140, 8, 80)
local PARK = Vector3.new(150, 20, 85)
local MARKET = Vector3.new(0, 9, 178)
local frame = 0
local beamOn = false
local beamCheck = 0
RunService.Heartbeat:Connect(function(dt: number)
	local camera = workspace.CurrentCamera
	if not camera then
		return
	end
	dt = math.min(dt, 0.1)
	frame += 1
	local now = os.clock()
	local eye = camera.CFrame.Position
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	local near = if root and root:IsA("BasePart") then root.Position else nil

	-- Gulls simulate always (cheap), pose within 260 studs; every other frame when far.
	local harbourDistance = (eye - HARBOUR).Magnitude
	for i, g in gulls do
		stepGull(g, dt, now, near)
		if harbourDistance < 260 and (harbourDistance < 110 or (frame + i) % 2 == 0) then
			poseGull(g, now)
		end
	end
	if harbourDistance < 300 then
		local t = workspace:GetServerTimeNow()
		-- Sailboat on a slow ellipse, heeling away from the wind.
		local a = (t * 0.045) % (math.pi * 2)
		local pos = Vector3.new(-212 + cos(a) * 26, WATER + 0.55 + sin(t * 1.1) * 0.12, 74 + sin(a) * 34)
		local heading = Vector3.new(-sin(a) * 26, 0, cos(a) * 34)
		moveRigid(
			sailboat,
			CFrame.lookAt(pos, pos + heading)
				* CFrame.Angles(sin(t * 0.9) * 0.03, 0, math.rad(9) + sin(t * 0.7) * 0.03)
		)
		local l = launch
		if l then
			moveRigid(
				l,
				l.centre
					* CFrame.new(0, sin(t * 1.3) * 0.13, 0)
					* CFrame.Angles(sin(t * 0.9) * 0.02, 0, sin(t * 1.1 + 1) * 0.035)
			)
		end
	end

	if (eye - PARK).Magnitude < 260 and frame % 2 == 0 then
		for _, k in kites do
			poseKite(k, now)
		end
	end
	for i, f in flags do
		if (eye - f.centre).Magnitude < 120 and (frame + i) % 2 == 0 then
			swayFlag(f, now, i * 1.3)
		end
	end
	if #pennants.parts > 0 and (eye - pennants.centre).Magnitude < 130 and frame % 2 == 1 then
		swayHanging(pennants, now * 1.6, 0.16)
	end
	if #festoons.parts > 0 and (eye - MARKET).Magnitude < 110 and frame % 2 == 0 then
		swayHanging(festoons, now, 0.09)
	end

	if now > beamCheck then
		beamCheck = now + 2
		local want = blueHour()
		if want ~= beamOn then
			beamOn = want
			for _, b in beams do
				b.Enabled = want
			end
		end
	end
	if beamOn then
		sweep.CFrame = CFrame.new(LENS)
			* CFrame.Angles(0, (workspace:GetServerTimeNow() * 0.7) % (math.pi * 2), 0)
	end
end)
