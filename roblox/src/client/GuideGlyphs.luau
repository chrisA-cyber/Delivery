--!strict
-- Line glyphs for town places, drawn on the same 24-unit grid as FeatherPaths so they share ShowIcons' look.
local Feather = require(script.Parent.FeatherPaths)
local Glyphs = {}

type Path = { number }
local function ring(cx: number, cy: number, r: number, steps: number, from: number?, to: number?): Path
	local points = {}
	local a0, a1 = from or 0, to or math.pi * 2
	for i = 0, steps do
		local a = a0 + (a1 - a0) * i / steps
		table.insert(points, math.floor((cx + math.cos(a) * r) * 100 + 0.5) / 100)
		table.insert(points, math.floor((cy + math.sin(a) * r) * 100 + 0.5) / 100)
	end
	return points
end

local paths: { [string]: { Path } } = {
	ticket = {
		{
			3,
			7,
			21,
			7,
			21,
			10,
			19.6,
			10.7,
			19.1,
			12,
			19.6,
			13.3,
			21,
			14,
			21,
			17,
			3,
			17,
			3,
			14,
			4.4,
			13.3,
			4.9,
			12,
			4.4,
			10.7,
			3,
			10,
			3,
			7,
		},
		{ 9, 8.8, 9, 10 },
		{ 9, 11.4, 9, 12.6 },
		{ 9, 14, 9, 15.2 },
	},
	theatre = {
		{ 3, 21, 3, 9.5, 12, 3.5, 21, 9.5, 21, 21, 3, 21 },
		{ 5.5, 11.5, 18.5, 11.5 },
		{ 9.5, 21, 9.5, 15, 14.5, 15, 14.5, 21 },
	},
	parcel = {
		{ 3, 7.5, 12, 3, 21, 7.5, 21, 16.5, 12, 21, 3, 16.5, 3, 7.5 },
		{ 3, 7.5, 12, 12, 21, 7.5 },
		{ 12, 12, 12, 21 },
		{ 7.5, 5.3, 16.5, 9.8 },
	},
	record = {
		ring(12, 12, 9.5, 20),
		ring(12, 12, 2.6, 10),
		ring(12, 12, 6.2, 8, -0.4, 1.2),
	},
	cup = {
		{ 4.5, 9, 16, 9, 16, 15, 15, 18.3, 12.5, 20, 8, 20, 5.5, 18.3, 4.5, 15, 4.5, 9 },
		{ 16, 10.5, 18.6, 10.5, 20, 12.2, 18.6, 14, 16, 14 },
		{ 8.5, 3, 8, 4.5, 8.5, 6 },
		{ 12.5, 3, 12, 4.5, 12.5, 6 },
	},
	postcard = {
		{ 3, 4.5, 21, 4.5, 21, 19.5, 3, 19.5, 3, 4.5 },
		{ 3, 16.5, 8.5, 11, 12.5, 15, 15.5, 12, 21, 17 },
		ring(16, 8.5, 1.6, 8),
	},
	tram = {
		{ 5, 5, 19, 5, 19, 17.5, 5, 17.5, 5, 5 },
		{ 7.5, 7.5, 16.5, 7.5, 16.5, 11.5, 7.5, 11.5, 7.5, 7.5 },
		{ 8, 17.5, 6.5, 21 },
		{ 16, 17.5, 17.5, 21 },
		{ 12, 5, 12, 2 },
		{ 9, 2, 15, 2 },
	},
	anchor = {
		ring(12, 5, 2, 8),
		{ 12, 7, 12, 21 },
		{ 8, 10.5, 16, 10.5 },
		{ 4, 14, 4.6, 16.6, 6.3, 18.9, 9, 20.5, 12, 21, 15, 20.5, 17.7, 18.9, 19.4, 16.6, 20, 14 },
		{ 2.5, 15.5, 4, 14, 5.5, 15.5 },
		{ 18.5, 15.5, 20, 14, 21.5, 15.5 },
	},
	flag = {
		{ 5.5, 22, 5.5, 2.5 },
		{ 5.5, 3.5, 19, 3.5, 15.5, 7.75, 19, 12, 5.5, 12 },
	},
	lantern = {
		{ 12, 1.5, 12, 4 },
		{ 8, 4, 16, 4 },
		{ 8.5, 4, 6.5, 8.5, 6.5, 15.5, 8.5, 20, 15.5, 20, 17.5, 15.5, 17.5, 8.5, 15.5, 4 },
		{ 12, 7, 12, 17 },
		{ 9.5, 20, 9.5, 22, 14.5, 22, 14.5, 20 },
	},
	clock = {
		ring(12, 12, 9.5, 22),
		{ 12, 6.5, 12, 12, 15.8, 14.3 },
	},
	camera = {
		{
			22.5,
			18.5,
			22.5,
			9,
			21,
			7,
			17,
			7,
			15,
			4,
			9,
			4,
			7,
			7,
			3,
			7,
			1.5,
			9,
			1.5,
			18.5,
			3,
			20.5,
			21,
			20.5,
			22.5,
			18.5,
		},
		ring(12, 13, 4, 12),
	},
	hanger = {
		{ 12, 9, 2.5, 17, 2.5, 18.5, 21.5, 18.5, 21.5, 17, 12, 9 },
		{ 12, 9, 12, 7.2, 13.6, 5.8, 13, 3.9, 11.2, 3.5, 10.1, 4.6 },
	},
	crate = {
		{ 3, 6, 21, 6, 21, 20, 3, 20, 3, 6 },
		{ 3, 6, 21, 20 },
		{ 21, 6, 3, 20 },
		{ 2, 6, 22, 6 },
	},
	pin = {
		{
			12,
			22,
			6.6,
			15.2,
			5,
			11,
			5.2,
			8.6,
			6.3,
			6.3,
			8.2,
			4.4,
			10.5,
			3.2,
			12,
			3,
			13.5,
			3.2,
			15.8,
			4.4,
			17.7,
			6.3,
			18.8,
			8.6,
			19,
			11,
			17.4,
			15.2,
			12,
			22,
		},
		ring(12, 10.2, 2.6, 10),
	},
	close = {
		{ 6, 6, 18, 18 },
		{ 18, 6, 6, 18 },
	},
	star = {
		{
			12,
			2.5,
			14.8,
			8.6,
			21.5,
			9.3,
			16.5,
			13.8,
			17.9,
			20.4,
			12,
			17,
			6.1,
			20.4,
			7.5,
			13.8,
			2.5,
			9.3,
			9.2,
			8.6,
			12,
			2.5,
		},
	},
	compass = {
		ring(12, 12, 9.5, 22),
		{ 12, 5.5, 14.2, 12, 12, 18.5, 9.8, 12, 12, 5.5 },
	},
	map = {
		{ 2, 6, 8.5, 3, 15.5, 6, 22, 3, 22, 18, 15.5, 21, 8.5, 18, 2, 21, 2, 6 },
		{ 8.5, 3, 8.5, 18 },
		{ 15.5, 6, 15.5, 21 },
	},
	check = {
		{ 4.5, 12.5, 9.5, 17.5, 19.5, 7 },
	},
	sparkle = {
		{ 12, 2, 13.2, 10.8, 22, 12, 13.2, 13.2, 12, 22, 10.8, 13.2, 2, 12, 10.8, 10.8, 12, 2 },
	},
}
Glyphs.paths = paths

-- Each place shown on the map, the chevron and the strip uses one of these.
Glyphs.place = {
	lobby = "radio",
	theatre = "theatre",
	balcony = "camera",
	studio = "headphones",
	writers = "book-open",
	warehouse = "crate",
	atelier = "hanger",
	pier = "anchor",
	park = "flag",
	market = "lantern",
	post = "parcel",
	records = "record",
	cafe = "cup",
	gallery = "postcard",
	clock = "clock",
	tram = "tram",
	street = "map",
	marketWalk = "lantern",
}

-- Draws a glyph from thin rotated frames. Thickness is in grid units (Feather uses 2).
function Glyphs.mount(
	parent: Instance,
	name: string,
	sizePx: number,
	color: Color3,
	position: UDim2?,
	thickness: number?
): Frame
	local root = Instance.new("Frame")
	root.Name = "Glyph_" .. name
	root.BackgroundTransparency = 1
	root.Size = UDim2.fromOffset(sizePx, sizePx)
	root.Position = position or UDim2.fromOffset(0, 0)
	root.ZIndex = if parent:IsA("GuiObject") then parent.ZIndex + 1 else 1
	root.Parent = parent
	local width = thickness or 1.9
	local strokes: { Path } = paths[name] or (Feather :: any)[name] or {}
	for _, stroke in strokes do
		for i = 3, #stroke, 2 do
			local x1, y1, x2, y2 = stroke[i - 2], stroke[i - 1], stroke[i], stroke[i + 1]
			local dx, dy = x2 - x1, y2 - y1
			local length = math.sqrt(dx * dx + dy * dy)
			local segment = Instance.new("Frame")
			segment.Name = "Stroke"
			segment.AnchorPoint = Vector2.new(0.5, 0.5)
			segment.BackgroundColor3 = color
			segment.BorderSizePixel = 0
			segment.ZIndex = root.ZIndex
			segment.Position = UDim2.fromScale((x1 + x2) / 48, (y1 + y2) / 48)
			segment.Size = UDim2.fromScale((length + width * 0.55) / 24, width / 24)
			segment.Rotation = math.deg(math.atan2(dy, dx))
			segment.Parent = root
		end
	end
	return root
end

-- Recolours a mounted glyph in place.
function Glyphs.tint(glyph: Instance, color: Color3)
	for _, child in glyph:GetChildren() do
		if child:IsA("Frame") then
			child.BackgroundColor3 = color
		end
	end
end
return Glyphs
