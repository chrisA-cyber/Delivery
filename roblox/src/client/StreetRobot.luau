--!strict
-- Part-built radio robots for the town and the house crowd, with a procedural pose rig.
-- Every part is anchored, non-colliding and non-queryable; one call per robot moves all of its parts
-- with workspace:BulkMoveTo, and the per-frame path reuses each robot's frame array.
local StreetRobot = {}

-- Bones: 1 body, 2 head, 3 left arm, 4 right arm, 5 left leg, 6 right leg, 7 float (balloon).
local BODY, HEAD, ARM_L, ARM_R, LEG_L, LEG_R, FLOAT = 1, 2, 3, 4, 5, 6, 7
StreetRobot.BODY, StreetRobot.HEAD, StreetRobot.ARM_L, StreetRobot.ARM_R = BODY, HEAD, ARM_L, ARM_R
StreetRobot.LEG_L, StreetRobot.LEG_R, StreetRobot.FLOAT = LEG_L, LEG_R, FLOAT

local HIP = 0.95
local NECK = 1.15
local SHOULDER_X = 0.92
local SHOULDER_Y = 0.98
local HIP_X = 0.36
local HAND = 0.74

local ink = Color3.fromRGB(41, 38, 56)
local paper = Color3.fromRGB(255, 240, 207)
local champagne = Color3.fromHex("ddb481")
local bulb = Color3.fromHex("ffdc9e")
local petal = Color3.fromHex("d58ca5")
local lacquer = Color3.fromHex("5b2338")
local copper = Color3.fromHex("875333")
local white = Color3.fromRGB(248, 244, 236)
StreetRobot.colors = {
	ink = ink,
	paper = paper,
	champagne = champagne,
	bulb = bulb,
	petal = petal,
	lacquer = lacquer,
	copper = copper,
	white = white,
}

export type Robot = {
	name: string,
	model: Model,
	parts: { BasePart },
	bones: { number },
	offsets: { CFrame },
	frames: { CFrame },
	pivots: { [number]: CFrame },
	rests: { [number]: CFrame },
	eyes: { number },
	head: BasePart,
	hand: BasePart?,
	scale: number,
	seed: number,
	-- Written by controllers.
	root: CFrame,
	walking: number, -- 0..1 target stride weight
	stride: number, -- studs travelled this frame (drives the walk phase)
	gesture: string,
	gestureAt: number,
	gestureUntil: number,
	base: string, -- gesture to return to when a timed one ends
	lookYaw: number,
	lookPitch: number,
	lookWeight: number,
	sitTarget: number,
	happy: number, -- 0..1 extra bounce while the town celebrates
	-- Smoothed pose.
	walk: number,
	phase: number,
	sit: number,
	lArmP: number,
	lArmR: number,
	rArmP: number,
	rArmR: number,
	headYaw: number,
	headPitch: number,
	headRoll: number,
	lean: number,
	hop: number,
	nextBlink: number,
	blinkUntil: number,
}

export type Spec = {
	name: string,
	kind: string?, -- "hero" (detailed) or "walker" (cheap background figure)
	scale: number?,
	body: Color3,
	casing: Color3,
	trim: Color3?,
	eye: Color3?,
	hat: string?,
	hatColor: Color3?,
	prop: string?,
	propColor: Color3?,
	antenna: boolean?,
}

local function newPart(className: string, robot: Robot, name: string, size: Vector3, color: Color3): BasePart
	local part = Instance.new(className) :: BasePart
	part.Name = name
	part.Size = size
	part.Color = color
	part.Material = Enum.Material.SmoothPlastic
	part.Anchored = true
	part.CanCollide = false
	part.CanTouch = false
	part.CanQuery = false
	part.CastShadow = false
	part.Parent = robot.model
	return part
end

-- Adds a part to a bone. Sizes and offsets are given at scale 1.
local function add(
	robot: Robot,
	bone: number,
	name: string,
	size: Vector3,
	offset: CFrame,
	color: Color3,
	shape: Enum.PartType?,
	material: Enum.Material?
): BasePart
	local s = robot.scale
	local part = newPart("Part", robot, name, size * s, color)
	if shape then
		(part :: Part).Shape = shape
	end
	if material then
		part.Material = material
	end
	table.insert(robot.parts, part)
	table.insert(robot.bones, bone)
	table.insert(robot.offsets, CFrame.new(offset.Position * s) * offset.Rotation)
	table.insert(robot.frames, CFrame.identity)
	return part
end
StreetRobot.add = add

-- Marks the last added part as springy around `pivot` (bone space, scale 1): antennae, toques, balloons.
local function springy(robot: Robot, pivot: Vector3)
	local index = #robot.parts
	local p = CFrame.new(pivot * robot.scale)
	robot.pivots[index] = p
	robot.rests[index] = p:Inverse() * robot.offsets[index]
end

local UP = CFrame.Angles(0, 0, math.pi / 2) -- turns a cylinder's axis from X to Y

local hats: { [string]: (Robot, Color3) -> () } = {
	postie = function(r, c)
		add(r, HEAD, "PostieCrown", Vector3.new(1.55, 0.5, 1.25), CFrame.new(0, 1.55, 0.05), c)
		add(r, HEAD, "PostiePeak", Vector3.new(1.45, 0.1, 0.6), CFrame.new(0, 1.35, -0.82), ink)
		add(
			r,
			HEAD,
			"PostieBadge",
			Vector3.new(0.3, 0.3, 0.3),
			CFrame.new(0, 1.6, -0.62),
			champagne,
			Enum.PartType.Ball,
			Enum.Material.Neon
		)
	end,
	baker = function(r, c)
		add(
			r,
			HEAD,
			"ToqueBand",
			Vector3.new(0.5, 1.35, 1.35),
			CFrame.new(0, 1.58, 0) * UP,
			c,
			Enum.PartType.Cylinder
		)
		add(r, HEAD, "ToquePuff", Vector3.new(1.7, 1.7, 1.7), CFrame.new(0, 2.35, 0), c, Enum.PartType.Ball)
		springy(r, Vector3.new(0, 1.8, 0))
	end,
	beret = function(r, c)
		add(
			r,
			HEAD,
			"Beret",
			Vector3.new(0.32, 1.85, 1.85),
			CFrame.new(0.18, 1.45, 0.05) * CFrame.Angles(0, 0, math.pi / 2 - 0.22),
			c,
			Enum.PartType.Cylinder
		)
		add(
			r,
			HEAD,
			"BeretStalk",
			Vector3.new(0.22, 0.22, 0.22),
			CFrame.new(0.3, 1.66, 0.05),
			c,
			Enum.PartType.Ball
		)
	end,
	headphones = function(r, c)
		add(r, HEAD, "HeadBand", Vector3.new(2.2, 0.18, 0.32), CFrame.new(0, 1.46, 0), ink)
		for _, side in { -1, 1 } do
			add(
				r,
				HEAD,
				"EarCup",
				Vector3.new(0.36, 0.86, 0.86),
				CFrame.new(side * 1.05, 0.72, 0),
				c,
				Enum.PartType.Cylinder
			)
		end
	end,
	captain = function(r, c)
		add(
			r,
			HEAD,
			"CaptainCrown",
			Vector3.new(0.55, 1.75, 1.75),
			CFrame.new(0, 1.62, 0.05) * UP,
			c,
			Enum.PartType.Cylinder
		)
		add(r, HEAD, "CaptainPeak", Vector3.new(1.35, 0.12, 0.62), CFrame.new(0, 1.38, -0.86), ink)
		add(
			r,
			HEAD,
			"CaptainBadge",
			Vector3.new(0.62, 0.2, 0.08),
			CFrame.new(0, 1.6, -0.84),
			champagne,
			nil,
			Enum.Material.Neon
		)
	end,
	sport = function(r, c)
		add(
			r,
			HEAD,
			"CapCrown",
			Vector3.new(0.46, 1.5, 1.5),
			CFrame.new(0, 1.5, 0.05) * UP,
			c,
			Enum.PartType.Cylinder
		)
		add(r, HEAD, "CapPeak", Vector3.new(1.2, 0.1, 0.95), CFrame.new(0, 1.36, -0.9), c)
	end,
	bow = function(r, c)
		for _, side in { -1, 1 } do
			add(
				r,
				HEAD,
				"Bow",
				Vector3.new(0.6, 0.6, 0.6),
				CFrame.new(side * 0.34, 1.52, 0),
				c,
				Enum.PartType.Ball
			)
		end
		add(
			r,
			HEAD,
			"BowKnot",
			Vector3.new(0.32, 0.32, 0.32),
			CFrame.new(0, 1.5, -0.05),
			champagne,
			Enum.PartType.Ball
		)
	end,
	-- Single-part hats for background walkers.
	beanie = function(r, c)
		add(
			r,
			HEAD,
			"Beanie",
			Vector3.new(0.6, 1.6, 1.6),
			CFrame.new(0, 1.42, 0) * UP,
			c,
			Enum.PartType.Cylinder
		)
	end,
	sunhat = function(r, c)
		add(
			r,
			HEAD,
			"SunHat",
			Vector3.new(0.16, 2.5, 2.5),
			CFrame.new(0, 1.36, 0) * UP,
			c,
			Enum.PartType.Cylinder
		)
	end,
	tophat = function(r, c)
		add(
			r,
			HEAD,
			"TopHat",
			Vector3.new(1.1, 1.0, 1.0),
			CFrame.new(0, 1.85, 0) * UP,
			c,
			Enum.PartType.Cylinder
		)
	end,
	flower = function(r, c)
		add(
			r,
			HEAD,
			"Flower",
			Vector3.new(0.5, 0.5, 0.5),
			CFrame.new(0.6, 1.42, -0.2),
			c,
			Enum.PartType.Ball,
			Enum.Material.Neon
		)
	end,
	usher = function(r, c)
		add(
			r,
			HEAD,
			"UsherCap",
			Vector3.new(0.5, 1.3, 1.3),
			CFrame.new(0, 1.55, 0) * UP,
			c,
			Enum.PartType.Cylinder
		)
	end,
	antenna = function(r, c)
		add(
			r,
			HEAD,
			"Aerial",
			Vector3.new(0.08, 0.6, 0.08),
			CFrame.new(0.55, 1.62, 0),
			ink,
			nil,
			Enum.Material.Metal
		)
		springy(r, Vector3.new(0.55, 1.32, 0))
		add(
			r,
			HEAD,
			"AerialBulb",
			Vector3.new(0.28, 0.28, 0.28),
			CFrame.new(0.55, 1.98, 0),
			c,
			Enum.PartType.Ball,
			Enum.Material.Neon
		)
		springy(r, Vector3.new(0.55, 1.32, 0))
	end,
}

local props: { [string]: (Robot, Color3) -> () } = {
	satchel = function(r, c)
		add(r, BODY, "Satchel", Vector3.new(0.78, 0.72, 0.42), CFrame.new(0.42, 0.2, -0.56), c)
		add(
			r,
			BODY,
			"SatchelStrap",
			Vector3.new(0.14, 1.75, 0.08),
			CFrame.new(0.05, 0.62, -0.5) * CFrame.Angles(0, 0, 0.62),
			ink
		)
		r.hand = add(r, ARM_L, "Envelope", Vector3.new(0.72, 0.46, 0.06), CFrame.new(0, -HAND, -0.3), paper)
	end,
	basket = function(r, c)
		add(r, BODY, "Apron", Vector3.new(1.12, 1.0, 0.06), CFrame.new(0, 0.42, -0.5), paper)
		add(r, ARM_L, "Basket", Vector3.new(0.92, 0.45, 0.62), CFrame.new(0, -HAND, -0.36), c)
		add(
			r,
			ARM_L,
			"Loaf",
			Vector3.new(0.8, 0.32, 0.36),
			CFrame.new(0, -HAND + 0.32, -0.36) * CFrame.Angles(0, 0, 0.2),
			Color3.fromRGB(226, 168, 96)
		)
	end,
	palette = function(r, c)
		add(
			r,
			ARM_L,
			"Palette",
			Vector3.new(0.08, 1.05, 1.05),
			CFrame.new(0, -HAND, -0.42) * CFrame.Angles(0, math.pi / 2, 0.5),
			c,
			Enum.PartType.Cylinder
		)
		add(
			r,
			ARM_R,
			"Brush",
			Vector3.new(0.08, 0.8, 0.08),
			CFrame.new(0, -HAND - 0.1, -0.25) * CFrame.Angles(-0.9, 0, 0),
			copper
		)
		add(
			r,
			ARM_R,
			"BrushTip",
			Vector3.new(0.16, 0.16, 0.16),
			CFrame.new(0, -HAND - 0.35, -0.55),
			petal,
			Enum.PartType.Ball,
			Enum.Material.Neon
		)
	end,
	record = function(r, c)
		add(r, BODY, "RecordSleeve", Vector3.new(0.1, 1.05, 1.05), CFrame.new(0.82, 0.55, 0.1), c)
		add(
			r,
			BODY,
			"Vinyl",
			Vector3.new(0.06, 0.95, 0.95),
			CFrame.new(0.8, 0.82, 0.05),
			ink,
			Enum.PartType.Cylinder
		)
	end,
	spyglass = function(r, c)
		add(
			r,
			ARM_R,
			"Spyglass",
			Vector3.new(0.95, 0.24, 0.24),
			CFrame.new(0, -HAND, -0.3) * CFrame.Angles(0, math.pi / 2, 0),
			c,
			Enum.PartType.Cylinder,
			Enum.Material.Metal
		)
		add(r, HEAD, "Beard", Vector3.new(1.2, 0.42, 0.16), CFrame.new(0, 0.18, -0.6), white)
	end,
	stopwatch = function(r, c)
		add(
			r,
			ARM_R,
			"Stopwatch",
			Vector3.new(0.12, 0.5, 0.5),
			CFrame.new(0, -HAND - 0.05, -0.3) * CFrame.Angles(0, math.pi / 2, 0),
			c,
			Enum.PartType.Cylinder,
			Enum.Material.Metal
		)
	end,
	parcel = function(r, c)
		add(r, ARM_L, "Parcel", Vector3.new(0.82, 0.6, 0.6), CFrame.new(0.1, -HAND, -0.42), c)
		add(
			r,
			ARM_L,
			"ParcelRibbon",
			Vector3.new(0.86, 0.64, 0.14),
			CFrame.new(0.1, -HAND, -0.42),
			champagne,
			nil,
			Enum.Material.Neon
		)
	end,
	-- Single-part props for background walkers.
	bag = function(r, c)
		add(r, ARM_R, "ShoppingBag", Vector3.new(0.3, 0.75, 0.7), CFrame.new(0, -HAND - 0.35, 0), c)
	end,
	paper = function(r, c)
		add(r, ARM_L, "Newspaper", Vector3.new(0.06, 0.9, 0.7), CFrame.new(0.12, -HAND + 0.1, -0.25), c)
	end,
	cone = function(r, c)
		add(
			r,
			ARM_R,
			"IceCream",
			Vector3.new(0.42, 0.42, 0.42),
			CFrame.new(0, -HAND + 0.35, -0.3),
			c,
			Enum.PartType.Ball
		)
	end,
	balloon = function(r, c)
		local balloon =
			add(r, FLOAT, "Balloon", Vector3.new(1.1, 1.1, 1.1), CFrame.new(0, 2.5, 0), c, Enum.PartType.Ball)
		balloon.Transparency = 0.08
		local hand = r.parts[4] -- the right arm of a walker body
		local a0 = Instance.new("Attachment")
		a0.Position = Vector3.new(0, -0.42 * r.scale, 0)
		a0.Parent = hand
		local a1 = Instance.new("Attachment")
		a1.Position = Vector3.new(0, -0.55 * r.scale, 0)
		a1.Parent = balloon
		local cord = Instance.new("Beam")
		cord.Attachment0 = a0
		cord.Attachment1 = a1
		cord.Width0 = 0.04
		cord.Width1 = 0.04
		cord.FaceCamera = true
		cord.Segments = 4
		cord.CurveSize0 = 0.4
		cord.Color = ColorSequence.new(white)
		cord.Parent = balloon
	end,
	rose = function(r, c)
		add(
			r,
			ARM_R,
			"Rose",
			Vector3.new(0.3, 0.3, 0.3),
			CFrame.new(0, -HAND + 0.25, -0.3),
			c,
			Enum.PartType.Ball
		)
	end,
}

local function blank(name: string, parent: Instance, scale: number): Robot
	local model = Instance.new("Model")
	model.Name = name
	local robot: Robot = {
		name = name,
		model = model,
		parts = {},
		bones = {},
		offsets = {},
		frames = {},
		pivots = {},
		rests = {},
		eyes = {},
		head = (nil :: any) :: BasePart,
		hand = nil,
		scale = scale,
		seed = math.random() * 100,
		root = CFrame.identity,
		walking = 0,
		stride = 0,
		gesture = "idle",
		gestureAt = 0,
		gestureUntil = math.huge,
		base = "idle",
		lookYaw = 0,
		lookPitch = 0,
		lookWeight = 0,
		sitTarget = 0,
		happy = 0,
		walk = 0,
		phase = 0,
		sit = 0,
		lArmP = 0,
		lArmR = 0.08,
		rArmP = 0,
		rArmR = 0.08,
		headYaw = 0,
		headPitch = 0,
		headRoll = 0,
		lean = 0,
		hop = 0,
		nextBlink = os.clock() + 1 + math.random() * 4,
		blinkUntil = 0,
	}
	model.Parent = parent
	return robot
end

-- Builds a robot from a spec. Heroes have separate gloves, boots, a screen face and a smile; walkers
-- are 8 parts plus at most one hat and one prop so a crowd stays cheap.
function StreetRobot.build(spec: Spec, parent: Instance): Robot
	local r = blank(spec.name, parent, spec.scale or 1)
	local hero = spec.kind ~= "walker"
	local trim = spec.trim or ink
	local eye = spec.eye or bulb
	local torso = add(r, BODY, "Torso", Vector3.new(1.45, 1.15, 0.95), CFrame.new(0, 0.58, 0), spec.body)
	torso.CastShadow = true
	-- Right arm stays at index 4 for both kinds so a balloon string can find the hand.
	if hero then
		local head = add(r, HEAD, "Head", Vector3.new(1.9, 1.32, 1.15), CFrame.new(0, 0.66, 0), spec.casing)
		head.CastShadow = true
		r.head = head
		add(r, ARM_L, "Arm", Vector3.new(0.36, 0.66, 0.36), CFrame.new(0, -0.33, 0), spec.body)
		add(r, ARM_R, "Arm", Vector3.new(0.36, 0.66, 0.36), CFrame.new(0, -0.33, 0), spec.body)
		add(r, HEAD, "Screen", Vector3.new(1.52, 0.92, 0.08), CFrame.new(0, 0.7, -0.58), ink)
		for _, side in { -1, 1 } do
			add(
				r,
				HEAD,
				"Eye",
				Vector3.new(0.34, 0.34, 0.34),
				CFrame.new(side * 0.36, 0.78, -0.6),
				eye,
				Enum.PartType.Ball,
				Enum.Material.Neon
			)
			table.insert(r.eyes, #r.parts)
		end
		add(
			r,
			HEAD,
			"Smile",
			Vector3.new(0.46, 0.08, 0.05),
			CFrame.new(0, 0.46, -0.63),
			eye,
			nil,
			Enum.Material.Neon
		)
		add(r, ARM_L, "Glove", Vector3.new(0.5, 0.5, 0.5), CFrame.new(0, -HAND, 0), trim, Enum.PartType.Ball)
		add(r, ARM_R, "Glove", Vector3.new(0.5, 0.5, 0.5), CFrame.new(0, -HAND, 0), trim, Enum.PartType.Ball)
		for _, bone in { LEG_L, LEG_R } do
			add(r, bone, "Leg", Vector3.new(0.36, 0.6, 0.36), CFrame.new(0, -0.3, 0), champagne)
			add(r, bone, "Boot", Vector3.new(0.56, 0.38, 0.8), CFrame.new(0, -0.76, -0.1), trim)
		end
	else
		local head = add(r, HEAD, "Head", Vector3.new(1.8, 1.28, 1.1), CFrame.new(0, 0.64, 0), spec.casing)
		r.head = head
		add(r, ARM_L, "Arm", Vector3.new(0.38, 0.92, 0.38), CFrame.new(0, -0.44, 0), spec.body)
		add(r, ARM_R, "Arm", Vector3.new(0.38, 0.92, 0.38), CFrame.new(0, -0.44, 0), spec.body)
		for _, side in { -1, 1 } do
			add(
				r,
				HEAD,
				"Eye",
				Vector3.new(0.32, 0.32, 0.32),
				CFrame.new(side * 0.36, 0.72, -0.5),
				eye,
				Enum.PartType.Ball,
				Enum.Material.Neon
			)
			table.insert(r.eyes, #r.parts)
		end
		for _, bone in { LEG_L, LEG_R } do
			add(r, bone, "Leg", Vector3.new(0.44, 0.95, 0.5), CFrame.new(0, -0.47, -0.04), trim)
		end
	end
	if spec.hat and hats[spec.hat] then
		hats[spec.hat](r, spec.hatColor or spec.body)
	end
	if spec.antenna then
		hats.antenna(r, spec.hatColor or petal)
	end
	if spec.prop and props[spec.prop] then
		props[spec.prop](r, spec.propColor or spec.body)
	end
	return r
end

function StreetRobot.count(robot: Robot): number
	return #robot.parts
end

-- Plays a timed gesture; the robot returns to `robot.base` afterwards.
function StreetRobot.play(robot: Robot, gesture: string, seconds: number, now: number)
	robot.gesture = gesture
	robot.gestureAt = now
	robot.gestureUntil = now + seconds
end

local exp = math.exp
local sin = math.sin
local cos = math.cos
local abs = math.abs
local max = math.max

-- Advances the pose by dt and moves the parts when `visible` is true.
function StreetRobot.animate(r: Robot, dt: number, now: number, visible: boolean)
	if now > r.gestureUntil then
		r.gesture = r.base
		r.gestureAt = now
		r.gestureUntil = math.huge
	end
	local k = 1 - exp(-dt * 12)
	r.walk += (r.walking - r.walk) * (1 - exp(-dt * 8))
	r.sit += (r.sitTarget - r.sit) * (1 - exp(-dt * 6))
	local s = r.scale
	r.phase = (r.phase + r.stride * math.pi / (0.9 * s)) % (math.pi * 2)
	r.stride = 0
	if not visible then
		return
	end
	local g = r.gesture
	local age = now - r.gestureAt
	local seed = r.seed
	local tlP, tlR, trP, trR = 0, 0.08, 0, 0.08
	local tYaw, tPitch, tRoll = 0, 0, 0
	local tLean, tHop = 0, 0
	local armsBusy = true
	if g == "wave" then
		trP, trR = 2.75, 0.25 + sin(age * 9) * 0.38
		tRoll = 0.12
	elseif g == "cheer" then
		tlP, trP = 2.85, 2.85
		tlR = 0.4 + sin(age * 10) * 0.18
		trR = 0.4 - sin(age * 10) * 0.18
		tHop = max(0, sin(age * 7 + seed)) * 0.38
		tPitch = 0.28
	elseif g == "clap" then
		local open = 0.5 + 0.5 * sin(age * 13)
		tlP, trP = 1.25, 1.25
		tlR = -0.48 + open * 0.42
		trR = tlR
		tPitch = 0.1
		tHop = abs(sin(age * 6.5)) * 0.06
	elseif g == "laugh" then
		tLean = -0.16
		tPitch = 0.38
		tHop = abs(sin(age * 17)) * 0.07
		tlP, tlR, trP, trR = 0.75, -0.5, 0.75, -0.5
	elseif g == "shrug" then
		tlP, trP = 0.45, 0.45
		tlR, trR = 0.95, 0.95
		tRoll = 0.24
		tHop = 0.07
	elseif g == "talk" then
		tRoll = sin(age * 2.1) * 0.06
		tPitch = 0.05
		trP, trR = 0.6 + sin(age * 3.3) * 0.28, 0.28
		tlP = 0.12
	elseif g == "point" then
		trP, trR = 1.55, 0.12
		tYaw = -0.25
	elseif g == "spy" then
		-- Spyglass (or a hand) raised to the eye.
		trP, trR = 2.15, -0.42
		tPitch = 0.08
	elseif g == "window" then
		tLean = 0.15
		tlP, tlR, trP, trR = -0.42, -0.18, -0.42, -0.18
		tPitch = -0.06
		tYaw = sin(age * 0.6 + seed) * 0.35
	elseif g == "lookup" then
		tPitch = 0.55
		tLean = -0.08
		tYaw = sin(age * 0.45 + seed) * 0.3
		armsBusy = false
	elseif g == "watch" then
		tlP, tlR = 1.45, -0.62
		tPitch, tYaw = -0.38, 0.28
	elseif g == "sea" then
		tlP, tlR, trP, trR = -0.25, 0.8, -0.25, 0.8
		tYaw = sin(age * 0.3 + seed) * 0.55
		tPitch = 0.08
	elseif g == "nod" then
		tPitch = sin(age * 7.5) * 0.14 - 0.04
		tRoll = sin(age * 3.75) * 0.08
		tHop = abs(sin(age * 7.5)) * 0.04
		tlP, trP = 0.25 + sin(age * 3.75) * 0.15, 0.25 - sin(age * 3.75) * 0.15
	elseif g == "bow" then
		tLean = if age < 1.1 then 0.5 else 0
		tPitch = -0.2
		tlP, trP = 0.2, 0.2
	elseif g == "sit" then
		tlP, trP = 0.55, 0.55
		tlR, trR = -0.05, -0.05
		tYaw = sin(now * 0.3 + seed) * 0.4
	else
		-- Idle: breathe, shift weight and look around now and then.
		armsBusy = false
		tYaw = sin(now * 0.37 + seed) * 0.32 + sin(now * 0.13 + seed * 2) * 0.2
		tPitch = sin(now * 0.29 + seed) * 0.06
		tRoll = sin(now * 0.8 + seed) * 0.035
		tHop = sin(now * 2.2 + seed) * 0.015
	end
	if r.happy > 0 then
		tHop += abs(sin(now * 6 + seed)) * 0.12 * r.happy * (1 - r.sit)
	end
	if r.lookWeight > 0 then
		local w = r.lookWeight
		tYaw += (math.clamp(r.lookYaw, -1.15, 1.15) - tYaw) * w
		tPitch += (math.clamp(r.lookPitch, -0.4, 0.5) - tPitch) * w
	end
	r.lArmP += (tlP - r.lArmP) * k
	r.lArmR += (tlR - r.lArmR) * k
	r.rArmP += (trP - r.rArmP) * k
	r.rArmR += (trR - r.rArmR) * k
	r.headYaw += (tYaw - r.headYaw) * k
	r.headPitch += (tPitch - r.headPitch) * k
	r.headRoll += (tRoll - r.headRoll) * k
	r.lean += (tLean - r.lean) * k
	r.hop += (tHop - r.hop) * (1 - exp(-dt * 18))

	local walk = r.walk * (1 - r.sit)
	local swing = sin(r.phase)
	local legSwing = swing * 0.58 * walk
	local armSwing = if armsBusy then 0 else swing * 0.5 * walk
	local bob = abs(cos(r.phase)) * 0.09 * walk
	local twist = swing * 0.09 * walk
	local sway = swing * 0.035 * walk
	local sit = r.sit
	local hipY = HIP + (0.22 - HIP) * sit
	local legBase = 1.45 * sit

	local root = r.root
	local hip = root * CFrame.new(0, (hipY + bob + r.hop) * s, 0)
	local body = hip * CFrame.fromEulerAnglesYXZ(-(r.lean + 0.07 * walk - 0.06 * sit), twist, sway)
	local head = body
		* CFrame.new(0, NECK * s, 0)
		* CFrame.fromEulerAnglesYXZ(r.headPitch, r.headYaw - twist * 0.6, r.headRoll)
	local armL = body
		* CFrame.new(-SHOULDER_X * s, SHOULDER_Y * s, 0)
		* CFrame.Angles(r.lArmP - armSwing, 0, -r.lArmR)
	local armR = body
		* CFrame.new(SHOULDER_X * s, SHOULDER_Y * s, 0)
		* CFrame.Angles(r.rArmP + armSwing, 0, r.rArmR)
	local legL = hip * CFrame.new(-HIP_X * s, 0, 0) * CFrame.Angles(legBase + legSwing, 0, 0)
	local legR = hip * CFrame.new(HIP_X * s, 0, 0) * CFrame.Angles(legBase - legSwing, 0, 0)
	local float = CFrame.new((armR * CFrame.new(0, -HAND * s, 0)).Position)
		* CFrame.Angles(sin(now * 1.3 + seed) * 0.12, 0, sin(now * 1.7 + seed) * 0.12)

	if now > r.nextBlink then
		r.blinkUntil = now + 0.12
		r.nextBlink = now + 2.5 + (r.seed * 7.3 + now) % 3.5
	end
	local wobble = sin(now * 9 + seed) * (0.05 + 0.22 * walk + 1.2 * r.hop)
	local wobbleFrame = CFrame.Angles(wobble * 0.6, 0, wobble)

	local parts, bones, offsets, frames = r.parts, r.bones, r.offsets, r.frames
	local pivots, rests = r.pivots, r.rests
	for i = 1, #parts do
		local bone = bones[i]
		local frame = if bone == BODY
			then body
			elseif bone == HEAD then head
			elseif bone == ARM_L then armL
			elseif bone == ARM_R then armR
			elseif bone == LEG_L then legL
			elseif bone == LEG_R then legR
			else float
		local pivot = pivots[i]
		if pivot then
			frames[i] = frame * pivot * wobbleFrame * rests[i]
		else
			frames[i] = frame * offsets[i]
		end
	end
	if now < r.blinkUntil then
		for _, index in r.eyes do
			frames[index] = frames[index] * CFrame.new(0, 0, 0.22 * s)
		end
	end
	workspace:BulkMoveTo(parts, frames, Enum.BulkMoveMode.FireCFrameChanged)
end

-- Yaw (radians) that makes a robot at `from` face `to`; robots look down their -Z axis.
function StreetRobot.yawTo(from: Vector3, to: Vector3): number
	local d = to - from
	return math.atan2(-d.X, -d.Z)
end

return StreetRobot
