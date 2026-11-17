--!strict
-- Who lives in town and where they walk. Pure data: DistrictCrew builds and drives the robots.
-- Stops are ground points (y is found by a downward ray at start-up); `seat` is the top of a bench or
-- stool to sit on, `look` is what the robot faces while it waits, `act` is the pose it holds there.
-- Routes loop. Segments were checked against the town plan so nobody walks through a wall, planter or
-- the streetcar; a segment that crosses the tram band waits for the car to pass.
local StreetRobot = require(script.Parent:WaitForChild("StreetRobot"))

local StreetCast = {}

export type Stop = {
	at: Vector3,
	wait: number?,
	act: string?,
	look: Vector3?,
	seat: Vector3?,
	plaza: boolean?, -- where this walker leaves its route for the theatre queue
}

export type Member = {
	name: string,
	role: string?,
	spec: StreetRobot.Spec,
	speed: number,
	voice: number,
	greet: string, -- gesture when a visitor walks up
	prompt: boolean?, -- residents who give tips
	fan: boolean?, -- drifts to the theatre doors at lineup
	approach: { Vector3 }?, -- plaza waypoints between the `plaza` stop and the queue
	route: { Stop },
}

local function v(x: number, z: number): Vector3
	return Vector3.new(x, 0, z)
end

local c = StreetRobot.colors
local THEATRE_DOOR = Vector3.new(0, 2, 33)
local MARQUEE = Vector3.new(0, 15, 38)
local SEA_WEST = Vector3.new(-175, 1, 70)

StreetCast.door = THEATRE_DOOR

-- Loose queue in front of the theatre doors (facing the doors).
StreetCast.queue = {
	v(-6.5, 41.2),
	v(-3.2, 42.4),
	v(0.2, 41.3),
	v(3.6, 42.5),
	v(6.9, 41.4),
	v(-1.8, 46.2),
	v(1.9, 45.8),
	v(5.4, 46.6),
	v(-5.2, 47),
	v(9.4, 44.6),
}

StreetCast.residents = {
	{
		name = "Marnie",
		role = "Postie",
		speed = 4.1,
		voice = 1.15,
		greet = "wave",
		prompt = true,
		spec = {
			name = "Marnie",
			body = Color3.fromRGB(56, 101, 136),
			casing = Color3.fromRGB(213, 162, 92),
			trim = c.ink,
			hat = "postie",
			hatColor = Color3.fromRGB(38, 60, 104),
			prop = "satchel",
			propColor = c.copper,
		},
		route = {
			{ at = v(-87, 66.6), wait = 5, act = "watch", look = v(-87, 58) },
			{ at = v(-95, 67.2) },
			{ at = v(-101, 70.5) },
			{ at = v(-117, 70.5), wait = 4, act = "sea", look = SEA_WEST },
			{ at = v(-118, 78.6) },
			{ at = v(-104, 78.6) },
			{ at = v(-90, 78.6), wait = 3 },
			{ at = v(-82, 70.5) },
		},
	},
	{
		name = "Bram",
		role = "Baker",
		speed = 3.2,
		voice = 0.85,
		greet = "laugh",
		prompt = true,
		fan = true,
		approach = { v(-16, 90), v(-8, 60) },
		spec = {
			name = "Bram",
			body = Color3.fromRGB(160, 91, 53),
			casing = Color3.fromRGB(246, 226, 190),
			trim = Color3.fromRGB(96, 52, 34),
			hat = "baker",
			hatColor = c.white,
			prop = "basket",
			propColor = Color3.fromRGB(196, 148, 84),
		},
		route = {
			{ at = v(-41, 120.8), wait = 4, look = v(-52, 121) },
			{ at = v(-30, 119.5) },
			{ at = v(-28.6, 111.2), wait = 4, act = "window", look = v(-24, 111.2) },
			{ at = v(-29.5, 99), wait = 2, plaza = true },
			{ at = v(-28.6, 128.6), wait = 4, act = "window", look = v(-24, 128.6) },
			{ at = v(-36, 121) },
			{ at = v(-45, 121) },
			{
				at = v(-46.1, 113.31),
				wait = 9,
				act = "sit",
				seat = Vector3.new(-47.31, 1.7, 113.31),
				look = v(-52, 113.31),
			},
			{ at = v(-45, 121) },
		},
	},
	{
		name = "Linn",
		role = "Printmaker",
		speed = 3.4,
		voice = 1.25,
		greet = "wave",
		prompt = true,
		fan = true,
		approach = { v(16, 90), v(8, 60) },
		spec = {
			name = "Linn",
			body = Color3.fromRGB(124, 81, 137),
			casing = Color3.fromRGB(146, 154, 203),
			trim = c.ink,
			hat = "beret",
			hatColor = c.lacquer,
			prop = "palette",
			propColor = Color3.fromRGB(233, 210, 166),
		},
		route = {
			{ at = v(41.5, 130), wait = 4, look = v(52, 130) },
			{ at = v(30, 131) },
			{ at = v(28.6, 128.6), wait = 5, act = "window", look = v(24, 128.6) },
			{ at = v(28.6, 119.9), wait = 4, act = "window", look = v(24, 119.9) },
			{ at = v(29.5, 99), wait = 3, act = "lookup", look = Vector3.new(10, 9, 112), plaza = true },
			{ at = v(28.6, 111.2), wait = 3, act = "window", look = v(24, 111.2) },
			{ at = v(33, 124), wait = 2 },
		},
	},
	{
		name = "Reed",
		role = "Record keeper",
		speed = 3.0,
		voice = 1.0,
		greet = "nod",
		prompt = true,
		spec = {
			name = "Reed",
			body = Color3.fromRGB(57, 131, 116),
			casing = c.champagne,
			trim = c.ink,
			hat = "headphones",
			hatColor = c.lacquer,
			prop = "record",
			propColor = c.bulb,
		},
		route = {
			{ at = v(85, 80.4), wait = 5, act = "nod", look = v(85, 90) },
			{ at = v(100, 79) },
			{ at = v(100.5, 92) },
			{ at = v(99.5, 110), wait = 5, act = "nod", look = Vector3.new(94, 8, 128) },
			{ at = v(93, 117), wait = 4, act = "lookup", look = Vector3.new(94.4, 17, 128.8) },
			{ at = v(100.5, 104) },
			{ at = v(100, 86) },
		},
	},
	{
		name = "Capstan",
		role = "Harbour master",
		speed = 2.2,
		voice = 0.75,
		greet = "wave",
		prompt = true,
		spec = {
			name = "Capstan",
			body = Color3.fromRGB(34, 52, 92),
			casing = Color3.fromRGB(226, 222, 210),
			trim = c.ink,
			hat = "captain",
			hatColor = c.white,
			prop = "spyglass",
			propColor = Color3.fromRGB(210, 156, 70),
		},
		route = {
			{ at = v(-118.5, 82.5), wait = 7, act = "sea", look = Vector3.new(-146, 2, 89) },
			{ at = v(-121.5, 84.5), wait = 6, act = "spy", look = Vector3.new(-160, 4, 95) },
			{ at = v(-119, 86.5), wait = 6, act = "watch", look = Vector3.new(-146, 2, 89) },
		},
	},
	{
		name = "Pip",
		role = "Park coach",
		speed = 3.8,
		voice = 1.35,
		greet = "cheer",
		prompt = true,
		spec = {
			name = "Pip",
			body = Color3.fromRGB(67, 124, 80),
			casing = Color3.fromRGB(246, 214, 120),
			trim = c.ink,
			hat = "sport",
			hatColor = Color3.fromRGB(247, 130, 76),
			prop = "stopwatch",
			propColor = Color3.fromRGB(205, 210, 220),
			antenna = true,
		},
		route = {
			{ at = v(125, 63), wait = 6, act = "jog", look = v(110, 55) },
			{ at = v(128, 66), wait = 4, act = "watch", look = v(136, 90) },
			{ at = v(122, 61.5), wait = 4, look = v(109, 55) },
		},
	},
	{
		name = "Dot",
		role = "Gift wrapper",
		speed = 2.8,
		voice = 1.2,
		greet = "clap",
		prompt = true,
		spec = {
			name = "Dot",
			body = Color3.fromRGB(165, 70, 86),
			casing = Color3.fromRGB(250, 232, 200),
			trim = c.lacquer,
			hat = "bow",
			hatColor = c.petal,
			prop = "parcel",
			propColor = Color3.fromRGB(65, 91, 168),
		},
		route = {
			{ at = v(7, 176.3), wait = 6, look = v(0, 172) },
			{ at = v(-1.6, 172), wait = 5, act = "window", look = v(-6, 171) },
			{ at = v(7, 169.5), wait = 4, look = v(0, 160) },
		},
	},
} :: { Member }

local function walker(
	name: string,
	body: Color3,
	casing: Color3,
	trim: Color3,
	hat: string?,
	hatColor: Color3?,
	prop: string?,
	propColor: Color3?,
	scale: number?
): StreetRobot.Spec
	return {
		name = name,
		kind = "walker",
		scale = scale or 0.95,
		body = body,
		casing = casing,
		trim = trim,
		hat = hat,
		hatColor = hatColor,
		prop = prop,
		propColor = propColor,
	}
end

-- Background townsfolk: no prompts, 8-10 parts each.
StreetCast.walkers = {
	{
		name = "Ottie",
		speed = 3.5,
		voice = 1.05,
		greet = "wave",
		fan = true,
		approach = { v(-14, 60) },
		spec = walker(
			"Ottie",
			Color3.fromRGB(92, 110, 170),
			Color3.fromRGB(240, 222, 186),
			c.ink,
			"beanie",
			Color3.fromRGB(213, 92, 80),
			"paper",
			c.paper
		),
		route = {
			{ at = v(-24, 69.8), plaza = true },
			{ at = v(-40, 70.3) },
			{ at = v(-70, 70.4) },
			{ at = v(-92, 70.6), wait = 3, act = "watch" },
			{ at = v(-92, 78.6) },
			{ at = v(-60, 78.6) },
			{ at = v(-38, 78.6) },
			{ at = v(-26, 78), wait = 4, act = "lookup", look = MARQUEE },
		},
	},
	{
		name = "Fen",
		speed = 3.3,
		voice = 0.95,
		greet = "wave",
		fan = true,
		approach = { v(14, 60) },
		spec = walker(
			"Fen",
			Color3.fromRGB(196, 120, 72),
			Color3.fromRGB(176, 208, 214),
			c.ink,
			"sunhat",
			Color3.fromRGB(240, 214, 150),
			"bag",
			Color3.fromRGB(91, 35, 56)
		),
		route = {
			{ at = v(24, 70.2), plaza = true },
			{ at = v(60, 70.3) },
			{ at = v(75, 70.4) },
			{ at = v(91, 70.6), wait = 3, act = "lookup", look = Vector3.new(85, 18, 82) },
			{ at = v(99, 66) },
			{ at = v(98.5, 57) },
			{ at = v(95, 60), wait = 14, act = "sit", seat = Vector3.new(95, 1.71, 62.05), look = v(95, 50) },
			{ at = v(98.5, 52), wait = 3, act = "lookup", look = Vector3.new(145, 28, 95) },
			{ at = v(98.8, 66) },
			{ at = v(75, 70.5) },
			{ at = v(40, 70.2) },
		},
	},
	{
		name = "Mabel",
		speed = 2.9,
		voice = 1.2,
		greet = "wave",
		fan = true,
		approach = {},
		spec = walker(
			"Mabel",
			Color3.fromRGB(213, 140, 165),
			Color3.fromRGB(255, 240, 207),
			c.lacquer,
			"flower",
			Color3.fromRGB(255, 220, 158),
			nil,
			nil,
			0.9
		),
		route = {
			{ at = v(-8, 48), wait = 3, act = "lookup", look = MARQUEE, plaza = true },
			{ at = v(-16, 37.6), wait = 4, act = "window", look = Vector3.new(-19.25, 2.4, 34) },
			{
				at = v(-22.6, 85),
				wait = 12,
				act = "sit",
				seat = Vector3.new(-24.1, 1.72, 85),
				look = v(-10, 85),
			},
			{ at = v(-14, 76) },
			{ at = v(-10, 60) },
		},
	},
	{
		name = "Rook",
		speed = 3.1,
		voice = 0.8,
		greet = "bow",
		fan = true,
		approach = {},
		spec = walker(
			"Rook",
			Color3.fromRGB(58, 62, 96),
			Color3.fromRGB(221, 180, 129),
			c.ink,
			"tophat",
			c.ink,
			nil,
			nil,
			1.0
		),
		route = {
			{ at = v(10, 45), wait = 4, act = "lookup", look = MARQUEE, plaza = true },
			{ at = v(18, 37.6), wait = 4, act = "window", look = Vector3.new(19.25, 2.4, 34) },
			{
				at = v(22.6, 85),
				wait = 10,
				act = "sit",
				seat = Vector3.new(24.1, 1.72, 85),
				look = v(10, 85),
			},
			{ at = v(12, 92), wait = 3 },
			{ at = v(21, 70) },
			{ at = v(19, 55) },
		},
	},
	{
		name = "Juno",
		speed = 3.0,
		voice = 1.1,
		greet = "wave",
		fan = true,
		approach = { v(-16, 90), v(-8, 60) },
		spec = walker(
			"Juno",
			Color3.fromRGB(66, 131, 142),
			Color3.fromRGB(250, 236, 214),
			c.copper,
			nil,
			nil,
			"bag",
			Color3.fromRGB(221, 180, 129)
		),
		route = {
			{ at = v(-29, 97), plaza = true },
			{ at = v(-29, 108) },
			{ at = v(-28.6, 119.9), wait = 4, act = "window", look = v(-24, 119.9) },
			{ at = v(-29.5, 145), wait = 2 },
			{ at = v(-14, 158) },
			{ at = v(-17.6, 162), wait = 4, act = "window", look = v(-21, 162) },
			{ at = v(-12, 170) },
			{ at = v(-14, 152) },
			{ at = v(-29.5, 146) },
		},
	},
	{
		name = "Wick",
		speed = 2.8,
		voice = 0.9,
		greet = "nod",
		spec = walker(
			"Wick",
			Color3.fromRGB(110, 86, 64),
			Color3.fromRGB(205, 214, 230),
			c.ink,
			"beanie",
			Color3.fromRGB(66, 131, 142),
			"cone",
			Color3.fromRGB(255, 205, 214)
		),
		route = {
			{ at = v(-29.5, 102) },
			{ at = v(-30, 121) },
			{ at = v(-45, 121) },
			{
				at = v(-46.1, 128.69),
				wait = 22,
				act = "sit",
				seat = Vector3.new(-47.31, 1.7, 128.69),
				look = v(-52, 128.69),
			},
			{ at = v(-45, 121) },
			{ at = v(-30, 121) },
			{ at = v(-29.5, 140), wait = 3, act = "lookup", look = Vector3.new(-10, 10, 175) },
		},
	},
	{
		name = "Pim",
		speed = 3.2,
		voice = 1.3,
		greet = "wave",
		fan = true,
		approach = { v(16, 90), v(8, 60) },
		spec = walker(
			"Pim",
			Color3.fromRGB(240, 196, 92),
			Color3.fromRGB(91, 35, 56),
			c.ink,
			"beanie",
			Color3.fromRGB(255, 240, 207),
			"bag",
			Color3.fromRGB(65, 91, 168)
		),
		route = {
			{ at = v(29, 97), wait = 2, plaza = true },
			{ at = v(28.6, 111.2), wait = 4, act = "window", look = v(24, 111.2) },
			{ at = v(29, 140) },
			{ at = v(24, 152) },
			{ at = v(14, 158) },
			{ at = v(17.6, 161), wait = 4, act = "window", look = v(21, 161) },
			{ at = v(17.6, 182), wait = 4, act = "window", look = v(21, 182) },
			{ at = v(14, 190), wait = 3 },
			{ at = v(14, 153) },
			{ at = v(29, 146) },
		},
	},
	{
		name = "Sol",
		speed = 2.7,
		voice = 0.85,
		greet = "nod",
		spec = walker(
			"Sol",
			Color3.fromRGB(130, 96, 168),
			Color3.fromRGB(236, 230, 214),
			c.lacquer,
			"tophat",
			Color3.fromRGB(91, 35, 56),
			nil,
			nil,
			1.05
		),
		route = {
			{ at = v(-4, 200), wait = 3, act = "lookup", look = Vector3.new(0, 10, 192) },
			{ at = v(-17.6, 198), wait = 4, act = "window", look = v(-21, 198) },
			{ at = v(-19.2, 181), wait = 3, act = "window", look = v(-23, 181) },
			{ at = v(-9, 186) },
			{ at = v(9, 186) },
			{ at = v(17.5, 198), wait = 4, act = "window", look = v(21, 198) },
			{ at = v(4, 204) },
		},
	},
	{
		name = "Tansy",
		speed = 3.1,
		voice = 1.15,
		greet = "wave",
		spec = walker(
			"Tansy",
			Color3.fromRGB(234, 236, 240),
			Color3.fromRGB(66, 131, 142),
			Color3.fromRGB(38, 60, 104),
			"sunhat",
			Color3.fromRGB(255, 220, 158),
			"paper",
			c.paper
		),
		route = {
			{ at = v(-113.8, 66) },
			{ at = v(-131, 64.5) },
			{ at = v(-140, 63), wait = 5, act = "sea", look = SEA_WEST },
			{ at = v(-140, 85) },
			{ at = v(-141, 100) },
			{ at = v(-146, 107.5), wait = 6, act = "lookup", look = Vector3.new(-159, 15, 108) },
			{ at = v(-138, 99) },
			{ at = v(-126, 95) },
			{ at = v(-113.8, 93) },
		},
	},
	{
		name = "Bix",
		speed = 3.6,
		voice = 1.5,
		greet = "cheer",
		spec = walker(
			"Bix",
			Color3.fromRGB(247, 130, 76),
			Color3.fromRGB(255, 240, 207),
			c.ink,
			nil,
			nil,
			"balloon",
			Color3.fromRGB(213, 92, 120),
			0.74
		),
		route = {
			{ at = v(98.5, 66) },
			{ at = v(98.5, 92) },
			{ at = v(116, 99) },
			{ at = v(124, 88) },
			{ at = v(128, 76) },
			{ at = v(118, 66), wait = 3, act = "lookup", look = Vector3.new(150, 28, 100) },
			{ at = v(104, 64.5) },
		},
	},
	{
		name = "Nell",
		speed = 2.8,
		voice = 1.1,
		greet = "wave",
		fan = true,
		approach = {},
		spec = walker(
			"Nell",
			Color3.fromRGB(65, 91, 168),
			Color3.fromRGB(255, 220, 158),
			c.ink,
			"flower",
			c.petal,
			"paper",
			c.paper,
			0.92
		),
		route = {
			{ at = v(6, 88) },
			{ at = v(-6, 88), wait = 3 },
			{ at = v(-14, 60), wait = 4, act = "lookup", look = MARQUEE },
			{ at = v(-4, 50), wait = 3, act = "watch", plaza = true },
		},
	},
} :: { Member }

return StreetCast
