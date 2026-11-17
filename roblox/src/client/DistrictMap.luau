--!strict
-- Illustrated district map. Water, land, streets and buildings are drawn from frames at their real
-- world coordinates (x to the right, z down, so the theatre sits at the top), scaled to fit any screen.
-- Labels are placed greedily so they never collide, and the player's arrow always draws beneath them.
local Style = require(script.Parent.GuideStyle)
local Glyphs = require(script.Parent.GuideGlyphs)
local GuideShow = require(script.Parent.GuideShow)
local C = Style.color
local Map = {}

export type Place = { id: string, title: string, x: number, z: number, rank: number }
export type Info =
	{ tag: string, title: string, body: string, travel: string?, watch: boolean, here: boolean }
export type Handlers = {
	info: (id: string) -> Info,
	travel: (id: string) -> (),
	watch: (id: string) -> (),
	destination: (id: string) -> (),
	close: () -> (),
	help: () -> (),
}

-- Pin positions (studs). rank 1 = district, 2 = shop or landmark, 3 = theatre-block room.
Map.places = {
	{ id = "theatre", title = "Main Theatre", x = 0, z = 20, rank = 1 },
	{ id = "lobby", title = "Broadcast Plaza", x = 0, z = 58, rank = 1 },
	{ id = "market", title = "Night Market", x = 0, z = 182, rank = 1 },
	{ id = "pier", title = "Waterfront Pier", x = -126, z = 74, rank = 1 },
	{ id = "park", title = "Signal Park", x = 134, z = 98, rank = 1 },
	{ id = "post", title = "Dockside Post", x = -87, z = 55, rank = 2 },
	{ id = "records", title = "Needle Drop", x = 85, z = 91, rank = 2 },
	{ id = "cafe", title = "Bakehouse", x = -52, z = 121, rank = 2 },
	{ id = "gallery", title = "Print Gallery", x = 52, z = 130, rank = 2 },
	{ id = "clock", title = "Clock Court", x = 91, z = 132, rank = 2 },
	{ id = "balcony", title = "Sky Lounge", x = 0, z = 121, rank = 2 },
	{ id = "studio", title = "Studio B", x = -53, z = 52, rank = 3 },
	{ id = "writers", title = "Writers’ Room", x = -53, z = 93, rank = 3 },
	{ id = "warehouse", title = "Props Depot", x = 53, z = 52, rank = 3 },
	{ id = "atelier", title = "Atelier", x = 53, z = 93, rank = 3 },
}
local X0, X1, Z0, Z1 = -174, 172, -34, 214
local land = Color3.fromRGB(44, 48, 96)
local landEdge = Color3.fromRGB(58, 64, 122)
local sea = Color3.fromRGB(26, 70, 86)
local seaDeep = Color3.fromRGB(18, 44, 62)
local road = Color3.fromRGB(214, 200, 170)
local paving = Color3.fromRGB(78, 80, 136)
local grass = Color3.fromRGB(46, 96, 78)
local tree = Color3.fromRGB(32, 74, 60)
local deck = Color3.fromRGB(128, 86, 58)
local building = Color3.fromRGB(70, 56, 104)

local function unit(x: number, z: number): (number, number)
	return (x - X0) / (X1 - X0), (z - Z0) / (Z1 - Z0)
end

function Map.new(gui: ScreenGui, handlers: Handlers)
	local shade = Style.frame(gui, "VenueMapShade", Color3.fromRGB(8, 8, 20), 0.35)
	shade.Size = UDim2.fromScale(1, 1)
	shade.ZIndex = 6
	shade.Visible = false
	shade.Active = true
	local sheet = Style.frame(shade, "FoldoutMap", seaDeep)
	sheet.AnchorPoint = Vector2.new(0.5, 0.5)
	sheet.Position = UDim2.fromScale(0.5, 0.5)
	sheet.ClipsDescendants = true
	Style.corner(sheet, 16)
	Style.stroke(sheet, C.champagne, 2, 0)
	Style.gradient(sheet, sea, seaDeep, 0)
	local sheetScale = Style.attachScale(sheet)

	local canvas = Style.frame(sheet, "StreetAtlas")
	canvas.ZIndex = 1
	local art = Style.frame(canvas, "Art")
	art.Size = UDim2.fromScale(1, 1)
	art.ZIndex = 1
	local dismiss = Instance.new("TextButton")
	dismiss.Name = "Dismiss"
	dismiss.Text = ""
	dismiss.BackgroundTransparency = 1
	dismiss.Selectable = false
	dismiss.Size = UDim2.fromScale(1, 1)
	dismiss.ZIndex = 2
	dismiss.Parent = canvas
	local pins = Style.frame(canvas, "Pins")
	pins.Size = UDim2.fromScale(1, 1)
	pins.ZIndex = 3
	local you = Style.frame(canvas, "PlayerLocation")
	you.Size = UDim2.fromScale(1, 1)
	you.ZIndex = 4
	local labels = Style.frame(canvas, "Labels")
	labels.Size = UDim2.fromScale(1, 1)
	labels.ZIndex = 5

	local function rect(
		x1: number,
		z1: number,
		x2: number,
		z2: number,
		color: Color3,
		name: string,
		radius: number?,
		transparency: number?
	): Frame
		local u1, v1 = unit(math.min(x1, x2), math.min(z1, z2))
		local u2, v2 = unit(math.max(x1, x2), math.max(z1, z2))
		local f = Style.frame(art, name, color, transparency or 0)
		f.Position = UDim2.fromScale(u1, v1)
		f.Size = UDim2.fromScale(u2 - u1, v2 - v1)
		if radius then
			Style.corner(f, radius)
		end
		return f
	end
	local function dot(
		x: number,
		z: number,
		studs: number,
		color: Color3,
		name: string,
		transparency: number?
	): Frame
		local u, v = unit(x, z)
		local f = Style.frame(art, name, color, transparency or 0)
		f.AnchorPoint = Vector2.new(0.5, 0.5)
		f.Position = UDim2.fromScale(u, v)
		f.Size = UDim2.fromScale(studs / (X1 - X0), studs / (Z1 - Z0))
		Style.corner(f, 999)
		return f
	end
	local function street(x1: number, z1: number, x2: number, z2: number, width: number, name: string)
		local half = width / 2
		if math.abs(z2 - z1) < math.abs(x2 - x1) then
			rect(x1, z1 - half, x2, z2 + half, road, name, 3, 0.08)
		else
			rect(x1 - half, z1, x2 + half, z2, road, name, 3, 0.08)
		end
	end

	-- Sea swell, the land mass and the harbour.
	for i, z in { -10, 30, 140, 175, 200 } do
		local swell =
			rect(X0 + 4, z, -152 + (i % 2) * 6, z + 1.2, Color3.fromRGB(120, 180, 190), "Swell", 2, 0.65)
		swell.Rotation = -4
	end
	local ground = rect(-139, -32, 170, 213, land, "Land", 14)
	Style.gradient(ground, landEdge, land, 90)
	Style.stroke(ground, C.champagne, 1, 0.55)
	rect(-140, 50, -74, 104, deck, "WharfApron", 4, 0.35)
	rect(-149.5, 45.5, -132.5, 106.5, deck, "PierDeck", 3, 0.1)
	rect(-168, 103, -132, 113, deck, "LighthouseJetty", 3, 0.1)
	local lighthouse = dot(-166, 108, 7, C.bulb, "Lighthouse")
	Style.stroke(lighthouse, C.bulb, 3, 0.55)

	-- Green spaces and paved squares.
	local park = rect(92, 28, 166, 126, grass, "SignalPark", 10)
	Style.gradient(park, Color3.fromRGB(60, 118, 92), grass, 90)
	for _, t in
		{
			{ 104, 40 },
			{ 150, 38 },
			{ 160, 60 },
			{ 112, 112 },
			{ 152, 118 },
			{ 100, 98 },
			{ 162, 92 },
			{ 124, 46 },
		}
	do
		dot(t[1], t[2], 9, tree, "Tree")
	end
	local bandstand = dot(136, 94, 12, C.powder, "Bandstand", 0.2)
	Style.stroke(bandstand, C.cream, 1, 0.4)
	rect(-30, 103, 30, 140, Color3.fromRGB(92, 74, 128), "SkyLoungeTerrace", 6)
	rect(78, 114, 104, 150, paving, "ClockCourt", 6)
	local tower = dot(91, 132, 9, C.powder, "ClockTower")
	Style.stroke(tower, C.cream, 1.5, 0.2)
	local marketSquare = rect(-34, 145, 34, 209, Color3.fromRGB(96, 56, 82), "MarketSquare", 8)
	Style.gradient(marketSquare, Color3.fromRGB(118, 64, 92), Color3.fromRGB(80, 44, 70), 90)
	local plaza = rect(-17, 36, 17, 68, paving, "BroadcastPlaza", 8)
	Style.stroke(plaza, C.champagne, 1, 0.6)
	local medallion = dot(0, 62, 13, C.champagne, "PlazaMedallion", 0.35)
	Style.stroke(medallion, C.bulb, 1, 0.3)

	-- Streets.
	street(-136, 74.5, 124, 74.5, 12, "LanternStreet")
	street(0, 33, 0, 68, 10, "PlazaWalk")
	for _, side in { -32, 32 } do
		street(side, 74.5, side, 158, 8, "MarketWalk")
	end
	street(-32, 154, 32, 154, 7, "MarketApproach")
	street(0, 140, 0, 158, 8, "TerraceStair")
	street(99, 80, 99, 117, 6, "RecordLane")
	street(82, 140, 82, 154, 6, "CourtLane")
	street(32, 150, 82, 150, 6, "MarketCutThrough")
	street(-87, 66, -87, 74.5, 6, "PostDoor")
	-- The Lot Line runs along Lantern Street between the pier and the park.
	for x = -108, 104, 8 do
		rect(x, 74.1, x + 4.5, 74.9, Color3.fromRGB(90, 70, 60), "LotLine", nil, 0.1)
	end
	for _, stop in { -104, 0, 104 } do
		local u, v = unit(stop + 5, 80.5)
		local badge = Style.frame(art, "TramStop", Style.accent.tram)
		badge.AnchorPoint = Vector2.new(0.5, 0.5)
		badge.Position = UDim2.fromScale(u, v)
		badge.Size = UDim2.fromOffset(14, 14)
		Style.corner(badge, 4)
		Style.stroke(badge, C.ink, 1, 0.3)
		Glyphs.mount(badge, "tram", 12, C.ink, UDim2.fromOffset(1, 1), 2.4)
	end

	-- Buildings.
	local theatre = rect(-32, -28, 32, 33.4, C.lacquer, "Theatre", 6)
	Style.gradient(theatre, Color3.fromRGB(120, 46, 74), C.lacquer, 90)
	Style.stroke(theatre, C.champagne, 1.5, 0.1)
	rect(-20.5, 31.5, 20.5, 33.6, C.bulb, "Marquee", 2)
	local name = Style.text(theatre, "Lettering", Style.font.display, C.bulb, 22, 6)
	name.AnchorPoint = Vector2.new(0.5, 0.5)
	name.Position = UDim2.fromScale(0.5, 0.42)
	name.Size = UDim2.fromScale(0.86, 0.3)
	name.TextXAlignment = Enum.TextXAlignment.Center
	name.Text = Style.spaced("Delivery")
	for _, side in { -1, 1 } do
		for _, zc in { 53, 92 } do
			local z1, z2 = if zc < 75 then 38 else 81, if zc < 75 then 68 else 104
			rect(side * 34, z1, side * 72, z2, building, "Pavilion", 4)
		end
	end
	for id, box in
		{
			post = { -100, 42, -74, 66 },
			records = { 72, 82, 97, 100 },
			cafe = { -64, 110, -40, 132 },
			gallery = { 40, 119, 64, 141 },
		}
	do
		local shop = rect(box[1], box[2], box[3], box[4], Style.accent[id], "Shop_" .. id, 4, 0.25)
		Style.stroke(shop, Style.accent[id], 1, 0.2)
	end
	-- String lights across the market.
	for i = 0, 11 do
		local x = -30 + i * 5.4
		dot(x, 150 + (i % 2) * 4, 2.6, C.bulb, "StringLight", 0.05)
	end
	for _, stall in { { -22, 172 }, { 22, 172 }, { -22, 192 }, { 22, 192 }, { -8, 200 }, { 8, 200 } } do
		rect(stall[1] - 5, stall[2] - 3, stall[1] + 5, stall[2] + 3, Color3.fromRGB(150, 90, 110), "Stall", 2)
	end

	-- Title cartouche.
	local title = Style.text(canvas, "MapTitle", Style.font.display, C.bulb, 22, 13)
	title.Position = UDim2.fromScale(0.015, 0.02)
	title.Size = UDim2.fromScale(0.3, 0.075)
	title.ZIndex = 6
	title.Text = Style.spaced("Town map")
	local titleStroke = Instance.new("UIStroke")
	titleStroke.Color = C.ink
	titleStroke.Thickness = 1.5
	titleStroke.Transparency = 0.3
	titleStroke.Parent = title

	-- Close and help, 48 x 48 each with an 8 px gap.
	local function roundButton(caption: string, glyph: string, offset: number): TextButton
		local b = Style.button(sheet, caption, "", "secondary")
		b.AnchorPoint = Vector2.new(1, 0)
		b.Position = UDim2.new(1, -8 - offset, 0, 8)
		b.Size = UDim2.fromOffset(48, 48)
		b.ZIndex = 20
		Glyphs.mount(b:FindFirstChild("Face") or b, glyph, 22, C.cream, UDim2.new(0.5, -11, 0.5, -11))
		return b
	end
	local close = roundButton("CloseMap", "close", 0)
	local help = roundButton("ShowGuide", "help-circle", 56)
	close.Activated:Connect(handlers.close)
	help.Activated:Connect(handlers.help)

	-- Pins and labels.
	local nodes: { [string]: TextButton } = {}
	local discs: { [string]: Frame } = {}
	local rings: { [string]: UIStroke } = {}
	local tags: { [string]: Frame } = {}
	local tagText: { [string]: TextLabel } = {}
	local selected = ""
	local hereId = ""
	local choose: (string) -> ()
	for _, p in Map.places do
		local u, v = unit(p.x, p.z)
		local hit = Instance.new("TextButton")
		hit.Name = "Room_" .. p.id
		hit.Text = ""
		hit.AutoButtonColor = false
		hit.BackgroundTransparency = 1
		hit.Selectable = true
		hit.AnchorPoint = Vector2.new(0.5, 0.5)
		hit.Position = UDim2.fromScale(u, v)
		hit.Size = UDim2.fromOffset(48, 48)
		hit.ZIndex = 3
		hit.Parent = pins
		local disc = Style.frame(hit, "Pin", Style.accent[p.id] or C.bulb)
		disc.AnchorPoint = Vector2.new(0.5, 0.5)
		disc.Position = UDim2.fromScale(0.5, 0.5)
		disc.Size = UDim2.fromOffset(30, 30)
		disc.ZIndex = 3
		Style.corner(disc, 999)
		rings[p.id] = Style.stroke(disc, C.ink, 2, 0.15)
		local glyph = Glyphs.mount(disc, Glyphs.place[p.id] or "pin", 18, C.ink, UDim2.new(0.5, -9, 0.5, -9))
		glyph.Name = "LandmarkSymbol"
		nodes[p.id] = hit
		discs[p.id] = disc
		local tag = Style.frame(labels, "Label_" .. p.id, C.panelDeep, 0.12)
		tag.AnchorPoint = Vector2.new(0.5, 0.5)
		Style.corner(tag, 999)
		local text = Style.text(tag, "Text", Style.font.bold, C.cream, 14, 10)
		text.TextScaled = false
		text.Size = UDim2.fromScale(1, 1)
		text.TextXAlignment = Enum.TextXAlignment.Center
		text.Text = p.title
		tags[p.id] = tag
		tagText[p.id] = text
		hit.Activated:Connect(function()
			choose(p.id)
		end)
	end

	-- "Show on now" badge over the theatre, driven by ReplicatedStorage.ShowStatus.
	local live = Style.frame(labels, "ShowOnNow", C.petal)
	live.AnchorPoint = Vector2.new(0.5, 1)
	live.Size = UDim2.fromOffset(96, 22)
	live.Visible = false
	Style.corner(live, 999)
	Style.stroke(live, C.bulb, 1.5, 0)
	local liveText = Style.text(live, "Text", Style.font.heavy, C.ink, 12, 9)
	liveText.Size = UDim2.fromScale(1, 1)
	liveText.TextXAlignment = Enum.TextXAlignment.Center
	local liveTween: Tween? = nil

	-- The player's arrow: a cyan disc with a pointer that turns with the camera's heading.
	local arrow = Style.frame(you, "Arrow")
	arrow.AnchorPoint = Vector2.new(0.5, 0.5)
	arrow.Size = UDim2.fromOffset(30, 30)
	arrow.Visible = false
	local halo = Style.frame(arrow, "Halo", Color3.fromRGB(80, 220, 230), 0.7)
	halo.AnchorPoint = Vector2.new(0.5, 0.5)
	halo.Position = UDim2.fromScale(0.5, 0.5)
	halo.Size = UDim2.fromOffset(30, 30)
	Style.corner(halo, 999)
	local heading = Style.frame(arrow, "Heading")
	heading.Size = UDim2.fromScale(1, 1)
	local point = Style.frame(heading, "Tip", Color3.fromRGB(80, 220, 230))
	point.AnchorPoint = Vector2.new(0.5, 0.5)
	point.Position = UDim2.new(0.5, 0, 0, 6)
	point.Size = UDim2.fromOffset(10, 10)
	point.Rotation = 45
	local core = Style.frame(arrow, "Core", Color3.fromRGB(80, 220, 230))
	core.AnchorPoint = Vector2.new(0.5, 0.5)
	core.Position = UDim2.fromScale(0.5, 0.5)
	core.Size = UDim2.fromOffset(14, 14)
	Style.corner(core, 999)
	Style.stroke(core, C.cream, 2, 0)
	local haloTween: Tween? = nil

	-- Place card: opposite side of the selected pin (landscape) or under the map (portrait).
	local card = Style.panel(sheet, "RoomGuide")
	card.ZIndex = 10
	card.Visible = false
	local cardDisc = Style.frame(card, "Disc", C.bulb)
	cardDisc.Position = UDim2.fromOffset(12, 12)
	cardDisc.Size = UDim2.fromOffset(40, 40)
	Style.corner(cardDisc, 999)
	Style.stroke(cardDisc, C.ink, 1.5, 0.2)
	local cardIcon: Frame? = nil
	local tag = Style.text(card, "Activity", Style.font.bold, C.bulb, 12, 10)
	tag.Position = UDim2.fromOffset(60, 10)
	tag.Size = UDim2.new(1, -116, 0, 16)
	local heading2 = Style.text(card, "SelectedRoom", Style.font.title, C.cream, 21, 14)
	heading2.Position = UDim2.fromOffset(60, 26)
	heading2.Size = UDim2.new(1, -116, 0, 26)
	local cardClose = Instance.new("TextButton")
	cardClose.Name = "CloseCard"
	cardClose.Text = ""
	cardClose.BackgroundTransparency = 1
	cardClose.AnchorPoint = Vector2.new(1, 0)
	cardClose.Position = UDim2.new(1, -2, 0, 4)
	cardClose.Size = UDim2.fromOffset(48, 48)
	cardClose.Parent = card
	Glyphs.mount(cardClose, "close", 16, C.powder, UDim2.new(0.5, -8, 0.5, -8))
	local status = Style.frame(card, "ShowStatus", C.petal)
	status.Position = UDim2.fromOffset(12, 60)
	status.Size = UDim2.new(1, -24, 0, 24)
	status.Visible = false
	Style.corner(status, 999)
	local statusText = Style.text(status, "Text", Style.font.heavy, C.ink, 13, 10)
	statusText.Position = UDim2.fromOffset(10, 0)
	statusText.Size = UDim2.new(1, -20, 1, 0)
	local body = Style.text(card, "Description", Style.font.body, Color3.fromRGB(226, 222, 244), 15, 12)
	body.TextYAlignment = Enum.TextYAlignment.Top
	local destination = Style.button(card, "SetDestination", "Set as destination", "primary")
	Style.buttonGlyph(destination, "pin", 20)
	local travel = Style.button(card, "Travel", "", "secondary")
	local watch = Style.button(card, "WatchHere", "Watch show", "secondary")

	local canvasSize = Vector2.new(300, 200)
	local pinSize = 30
	local portrait = false
	local function positionLabels()
		-- Greedy placement: districts first, then shops, then rooms. A label that cannot fit is hidden.
		local placed: { { number } } = {}
		local cw, ch = canvasSize.X, canvasSize.Y
		local pinR = pinSize / 2
		local textSize = if ch < 320 then 12 elseif ch < 520 then 13 else 15
		local obstacles: { { number } } = {}
		for _, p in Map.places do
			local u, v = unit(p.x, p.z)
			table.insert(obstacles, { u * cw - pinR, v * ch - pinR, u * cw + pinR, v * ch + pinR })
		end
		local function free(box: { number }): boolean
			if box[1] < 2 or box[2] < 2 or box[3] > cw - 2 or box[4] > ch - 2 then
				return false
			end
			for _, other in placed do
				if box[1] < other[3] and box[3] > other[1] and box[2] < other[4] and box[4] > other[2] then
					return false
				end
			end
			for _, other in obstacles do
				if box[1] < other[3] and box[3] > other[1] and box[2] < other[4] and box[4] > other[2] then
					return false
				end
			end
			return true
		end
		local ordered = table.clone(Map.places)
		table.sort(ordered, function(a, b)
			local ar = if a.id == selected or a.id == hereId then 0 else a.rank
			local br = if b.id == selected or b.id == hereId then 0 else b.rank
			if ar ~= br then
				return ar < br
			end
			return a.id < b.id
		end)
		for _, p in ordered do
			local label = tags[p.id]
			local txt = tagText[p.id]
			txt.TextSize = textSize
			local w = math.ceil(#p.title * textSize * 0.56) + 14
			local h = textSize + 8
			local u, v = unit(p.x, p.z)
			local px, py = u * cw, v * ch
			local spots = {
				{ px, py + pinR + 3 + h / 2 },
				{ px, py - pinR - 3 - h / 2 },
				{ px + pinR + 4 + w / 2, py },
				{ px - pinR - 4 - w / 2, py },
			}
			local chosen = nil
			for _, s in spots do
				local box = { s[1] - w / 2, s[2] - h / 2, s[1] + w / 2, s[2] + h / 2 }
				if free(box) then
					chosen = s
					table.insert(placed, box)
					break
				end
			end
			label.Visible = chosen ~= nil and (p.rank < 3 or ch >= 300 or p.id == selected)
			if chosen then
				label.Position = UDim2.fromOffset(chosen[1], chosen[2])
				label.Size = UDim2.fromOffset(w, h)
			end
			label.BackgroundColor3 = if p.id == selected then C.bulb else C.panelDeep
			txt.TextColor3 = if p.id == selected then C.ink else C.cream
		end
		local tu, tv = unit(0, 20)
		live.Position = UDim2.fromOffset(tu * cw, tv * ch - pinR - 4)
	end

	local function placeCard()
		local sheetSize = Vector2.new(sheet.Size.X.Offset, sheet.Size.Y.Offset)
		-- The map's close and help buttons always sit just outside the card.
		local shift = 0
		if card.Visible and not portrait then
			local p = nodes[selected]
			if not (p and p.Position.X.Scale > 0.5) then
				shift = math.clamp(sheetSize.X * 0.38, 240, 330) + 8
			end
		end
		close.Position = UDim2.new(1, -8 - shift, 0, 8)
		help.Position = UDim2.new(1, -64 - shift, 0, 8)
		if not card.Visible then
			return
		end
		if portrait then
			card.AnchorPoint = Vector2.new(0.5, 1)
			card.Position = UDim2.new(0.5, 0, 1, -8)
			card.Size = UDim2.fromOffset(sheetSize.X - 16, math.min(250, sheetSize.Y * 0.42))
		else
			local p = nodes[selected]
			local onRight = p and p.Position.X.Scale > 0.5
			local width = math.clamp(sheetSize.X * 0.38, 240, 330)
			card.AnchorPoint = Vector2.new(if onRight then 0 else 1, 0.5)
			card.Position = if onRight then UDim2.new(0, 8, 0.5, 0) else UDim2.new(1, -8, 0.5, 0)
			card.Size = UDim2.fromOffset(width, math.min(sheetSize.Y - 16, 320))
		end
		local size = card.Size
		local w, h = size.X.Offset, size.Y.Offset
		local hasStatus = status.Visible
		local top = if hasStatus then 90 else 60
		local twoRows = travel.Visible or watch.Visible
		local buttons = if twoRows then 48 + 8 + 48 else 48
		body.Position = UDim2.fromOffset(12, top)
		body.Size = UDim2.fromOffset(w - 24, math.max(0, h - top - buttons - 22))
		body.Visible = body.Size.Y.Offset >= 16
		destination.Position = UDim2.new(0, 12, 1, -(buttons + 10))
		destination.Size = UDim2.new(1, -24, 0, 48)
		local both = travel.Visible and watch.Visible
		travel.Position = UDim2.new(0, 12, 1, -58)
		travel.Size = if both then UDim2.new(0.5, -16, 0, 48) else UDim2.new(1, -24, 0, 48)
		watch.Position = if both then UDim2.new(0.5, 4, 1, -58) else UDim2.new(0, 12, 1, -58)
		watch.Size = travel.Size
	end

	local function updateLive()
		local s = GuideShow.read()
		local on = s.live or s.soon or s.curtain
		live.Visible = on and shade.Visible
		liveText.Text = if s.live then "SHOW ON NOW" elseif s.soon then "NEXT ACT" else "CURTAIN CALL"
		live.BackgroundColor3 = if s.live then C.petal else C.bulb
		if liveTween then
			liveTween:Cancel()
			liveTween = nil
			live.BackgroundTransparency = 0
		end
		if live.Visible and s.live and not Style.reduced() then
			local t = game:GetService("TweenService"):Create(
				live,
				TweenInfo.new(0.8, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true),
				{ BackgroundTransparency = 0.35 }
			)
			t:Play()
			liveTween = t
		end
		if selected == "theatre" and card.Visible then
			status.Visible = true
			statusText.Text = GuideShow.line()
			status.BackgroundColor3 = if s.live then C.petal else C.powder
			placeCard()
		end
	end
	GuideShow.changed:Connect(function()
		if shade.Visible then
			updateLive()
		end
	end)

	local function fill()
		if selected == "" then
			return
		end
		local info = handlers.info(selected)
		tag.Text = info.tag
		heading2.Text = info.title
		body.Text = info.body
		cardDisc.BackgroundColor3 = Style.accent[selected] or C.bulb
		if cardIcon then
			cardIcon:Destroy()
		end
		cardIcon =
			Glyphs.mount(cardDisc, Glyphs.place[selected] or "pin", 24, C.ink, UDim2.new(0.5, -12, 0.5, -12))
		travel.Visible = info.travel ~= nil
		travel.Text = info.travel or ""
		watch.Visible = info.watch
		status.Visible = selected == "theatre"
		if status.Visible then
			local s = GuideShow.read()
			statusText.Text = GuideShow.line()
			status.BackgroundColor3 = if s.live then C.petal else C.powder
		end
		destination.Text = if info.here then "You are here" else "Set as destination"
		Style.paint(destination, if info.here then "quiet" else "primary")
		Style.tintGlyph(destination)
		Style.setEnabled(destination, not info.here)
		card.Visible = true
		placeCard()
	end

	choose = function(id: string)
		local changed = id ~= selected
		selected = id
		for pid, disc in discs do
			local on = pid == id
			disc.Size = if on
				then UDim2.fromOffset(pinSize + 8, pinSize + 8)
				else UDim2.fromOffset(pinSize, pinSize)
			rings[pid].Color = if on then C.bulb else C.ink
			rings[pid].Thickness = if on then 3 else 2
		end
		if changed then
			Style.pop(discs[id], 0.7)
		end
		positionLabels()
		fill()
		if changed and card.Visible then
			Style.pop(card, 0.94)
		end
	end
	dismiss.Activated:Connect(function()
		card.Visible = false
		placeCard()
	end)
	cardClose.Activated:Connect(function()
		card.Visible = false
		placeCard()
	end)
	destination.Activated:Connect(function()
		if selected ~= "" and destination.Active then
			handlers.destination(selected)
		end
	end)
	travel.Activated:Connect(function()
		if selected ~= "" then
			handlers.travel(selected)
		end
	end)
	watch.Activated:Connect(function()
		if selected ~= "" then
			handlers.watch(selected)
		end
	end)

	local function layout()
		local size = gui.AbsoluteSize
		if size.X < 10 or size.Y < 10 then
			return
		end
		portrait = size.X < size.Y
		local k = Style.currentScale()
		sheetScale.Scale = k
		local sw = math.min(size.X - 16, 1280) / k
		local sh = math.min(size.Y - 16, 800) / k
		sheet.Size = UDim2.fromOffset(sw, sh)
		local availW, availH = sw - 12, sh - 12
		local top = 6
		if portrait then
			availH = sh - math.min(250, sh * 0.42) - 24
			top = 6
		end
		local spanX, spanZ = X1 - X0, Z1 - Z0
		local sx, sz = availW / spanX, availH / spanZ
		sx = math.min(sx, sz * 1.6)
		sz = math.min(sz, sx * 1.6)
		canvasSize = Vector2.new(math.floor(spanX * sx), math.floor(spanZ * sz))
		canvas.Size = UDim2.fromOffset(canvasSize.X, canvasSize.Y)
		canvas.AnchorPoint = Vector2.new(0.5, 0)
		canvas.Position = UDim2.new(0.5, 0, 0, top + math.max(0, (availH - canvasSize.Y) / 2))
		local big = canvasSize.Y >= 420
		local pin = if big then 36 else 30
		pinSize = pin
		for pid, disc in discs do
			local on = pid == selected
			disc.Size = UDim2.fromOffset(if on then pin + 8 else pin, if on then pin + 8 else pin)
		end
		positionLabels()
		placeCard()
	end
	gui:GetPropertyChangedSignal("AbsoluteSize"):Connect(layout)

	local api = {}
	api.frame = shade
	api.nodes = nodes
	function api.open(current: string)
		hereId = current
		shade.Visible = true
		layout()
		if nodes[current] then
			choose(current)
		else
			choose("lobby")
		end
		updateLive()
		if not Style.reduced() then
			sheet.Position = UDim2.new(0.5, 0, 0.5, 24)
			Style.tween(sheet, 0.4, { Position = UDim2.fromScale(0.5, 0.5) }, Enum.EasingStyle.Back)
		end
		if haloTween then
			haloTween:Cancel()
		end
		if not Style.reduced() then
			halo.Size = UDim2.fromOffset(18, 18)
			halo.BackgroundTransparency = 0.4
			local t = game:GetService("TweenService"):Create(
				halo,
				TweenInfo.new(1.2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out, -1),
				{ Size = UDim2.fromOffset(40, 40), BackgroundTransparency = 1 }
			)
			t:Play()
			haloTween = t
		end
	end
	function api.close()
		shade.Visible = false
		if haloTween then
			haloTween:Cancel()
			haloTween = nil
		end
		if liveTween then
			liveTween:Cancel()
			liveTween = nil
		end
	end
	function api.isOpen(): boolean
		return shade.Visible
	end
	function api.selected(): string
		return selected
	end
	function api.refresh()
		if shade.Visible then
			fill()
		end
	end
	function api.busy(text: string)
		travel.Text = text
	end
	function api.track(pos: Vector3, look: Vector3?)
		local u, v = unit(pos.X, pos.Z)
		arrow.Visible = u >= 0 and u <= 1 and v >= 0 and v <= 1
		arrow.Position = UDim2.fromScale(math.clamp(u, 0.01, 0.99), math.clamp(v, 0.01, 0.99))
		if look and look.Magnitude > 1e-3 then
			local dx = look.X * canvasSize.X / (X1 - X0)
			local dy = look.Z * canvasSize.Y / (Z1 - Z0)
			heading.Rotation = math.deg(math.atan2(dy, dx)) + 90
		end
	end
	layout()
	return api
end
return Map
