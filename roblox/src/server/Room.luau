--!strict
local Room = {}

-- Built-in font families. Josefin Sans carries the Art Deco headlines, Montserrat the wayfinding and live
-- boards, Merriweather the painted shop and tenant names.
local DECO = "rbxasset://fonts/families/JosefinSans.json"
local SANS = "rbxasset://fonts/families/Montserrat.json"
local SERIF = "rbxasset://fonts/families/Merriweather.json"

local cream = Color3.fromRGB(255, 240, 207)
local bulb = Color3.fromRGB(255, 220, 158)
local champagne = Color3.fromRGB(221, 180, 129)
local shade = Color3.fromRGB(24, 16, 34)

type SignStyle = {
	font: Font,
	color: Color3,
	gradient: ColorSequence?,
	gradientRotation: number,
	stroke: Color3?,
	strokeTransparency: number,
	-- Outline thickness as a fraction of the canvas height, clamped to 1-5 pixels.
	strokeScale: number,
	brightness: number,
	lightInfluence: number,
	maxDistance: number,
	pixelsPerStud: number,
	padX: number,
	padY: number,
	track: boolean,
}

local headline = ColorSequence.new({
	ColorSequenceKeypoint.new(0, Color3.fromRGB(255, 247, 226)),
	ColorSequenceKeypoint.new(0.48, Color3.fromRGB(255, 222, 163)),
	ColorSequenceKeypoint.new(1, Color3.fromRGB(226, 172, 112)),
})

local styles: { [string]: SignStyle } = {
	-- Theatre, shop and district marquees: deco capitals, bulb-gold gradient, a soft bloom at blue hour.
	marquee = {
		font = Font.new(DECO, Enum.FontWeight.Bold),
		color = Color3.new(1, 1, 1),
		gradient = headline,
		gradientRotation = 90,
		stroke = Color3.fromRGB(64, 22, 40),
		strokeTransparency = 0.15,
		strokeScale = 0.045,
		brightness = 1.75,
		lightInfluence = 0,
		maxDistance = 0,
		pixelsPerStud = 48,
		padX = 0.035,
		padY = 0.15,
		track = true,
	},
	-- One letter per plate on the vertical BladeSign; brightest type in town so it reads from every district.
	blade = {
		font = Font.new(DECO, Enum.FontWeight.Bold),
		color = Color3.new(1, 1, 1),
		gradient = headline,
		gradientRotation = 90,
		stroke = Color3.fromRGB(64, 22, 40),
		strokeTransparency = 0.1,
		strokeScale = 0.05,
		brightness = 2.1,
		lightInfluence = 0,
		maxDistance = 0,
		pixelsPerStud = 40,
		padX = 0.1,
		padY = 0.08,
		track = false,
	},
	-- Street and campus wayfinding: clean geometric sans, crisp and below the bloom threshold.
	wayfinding = {
		font = Font.new(SANS, Enum.FontWeight.Bold),
		color = cream,
		gradient = nil,
		gradientRotation = 0,
		stroke = shade,
		strokeTransparency = 0.35,
		strokeScale = 0.03,
		brightness = 1.15,
		lightInfluence = 0,
		maxDistance = 260,
		pixelsPerStud = 50,
		padX = 0.05,
		padY = 0.17,
		track = false,
	},
	-- Painted tenant boards and stall names.
	tenant = {
		font = Font.new(SERIF, Enum.FontWeight.Bold),
		color = Color3.fromRGB(255, 233, 196),
		gradient = nil,
		gradientRotation = 0,
		stroke = shade,
		strokeTransparency = 0.45,
		strokeScale = 0.03,
		brightness = 1.25,
		lightInfluence = 0,
		maxDistance = 170,
		pixelsPerStud = 56,
		padX = 0.05,
		padY = 0.16,
		track = false,
	},
	-- Instruction boards inside the studios and shops.
	board = {
		font = Font.new(SANS, Enum.FontWeight.SemiBold),
		color = cream,
		gradient = nil,
		gradientRotation = 0,
		stroke = shade,
		strokeTransparency = 0.6,
		strokeScale = 0.02,
		brightness = 1.05,
		lightInfluence = 0,
		maxDistance = 140,
		pixelsPerStud = 56,
		padX = 0.05,
		padY = 0.17,
		track = false,
	},
	-- Gate numbers: deco numerals in bulb gold.
	number = {
		font = Font.new(DECO, Enum.FontWeight.Bold),
		color = bulb,
		gradient = nil,
		gradientRotation = 0,
		stroke = shade,
		strokeTransparency = 0.3,
		strokeScale = 0.04,
		brightness = 1.35,
		lightInfluence = 0,
		maxDistance = 160,
		pixelsPerStud = 60,
		padX = 0.08,
		padY = 0.1,
		track = false,
	},
	-- Seat tickets are paper in the house: ink type that takes the room light.
	ticket = {
		font = Font.new(DECO, Enum.FontWeight.Bold),
		color = Color3.fromRGB(47, 32, 32),
		gradient = nil,
		gradientRotation = 0,
		stroke = nil,
		strokeTransparency = 1,
		strokeScale = 0,
		brightness = 1,
		lightInfluence = 0.85,
		maxDistance = 70,
		pixelsPerStud = 120,
		padX = 0.12,
		padY = 0.08,
		track = false,
	},
	-- The theatre's live caption board: long changing lines, so legibility before ornament.
	live = {
		font = Font.new(SANS, Enum.FontWeight.Bold),
		color = cream,
		gradient = nil,
		gradientRotation = 0,
		stroke = shade,
		strokeTransparency = 0.4,
		strokeScale = 0.012,
		brightness = 1.3,
		lightInfluence = 0,
		maxDistance = 0,
		pixelsPerStud = 44,
		padX = 0.04,
		padY = 0.08,
		track = false,
	},
	header = {
		font = Font.new(DECO, Enum.FontWeight.Bold),
		color = Color3.new(1, 1, 1),
		gradient = headline,
		gradientRotation = 90,
		stroke = Color3.fromRGB(64, 22, 40),
		strokeTransparency = 0.3,
		strokeScale = 0.035,
		brightness = 1.4,
		lightInfluence = 0,
		maxDistance = 0,
		pixelsPerStud = 100,
		padX = 0.04,
		padY = 0.14,
		track = false,
	},
	daily = {
		font = Font.new(SANS, Enum.FontWeight.SemiBold),
		color = cream,
		gradient = nil,
		gradientRotation = 0,
		stroke = nil,
		strokeTransparency = 1,
		strokeScale = 0,
		brightness = 1.2,
		lightInfluence = 0,
		maxDistance = 0,
		pixelsPerStud = 76,
		padX = 0.09,
		padY = 0.11,
		track = false,
	},
}

-- Plate part names from the art scripts, grouped by how the sign should read. Unknown plates read as wayfinding.
local plateStyles: { [string]: string } = {
	GrandMarquee = "marquee",
	BusinessMarquee = "marquee",
	MarketArch = "marquee",
	MarketArchReverse = "marquee",
	ExteriorSign = "marquee",
	LoungeFascia = "marquee",
	TenantSign = "tenant",
	MerchantName = "tenant",
	WalkTenant = "tenant",
	MerchantFlagType = "tenant",
	CafeMenu = "tenant",
	ListeningBar = "tenant",
	EditionsSign = "tenant",
	SortingHall = "tenant",
	WrapSign = "tenant",
	StudioBoard = "board",
	WritersBoard = "board",
	AtelierBoard = "board",
	DepotBoard = "board",
	PracticeInstructions = "board",
	WritersHelp = "board",
	FittingHelp = "board",
	GateNumber = "number",
}

-- Deco letter-spacing for short headline words that the art did not already space ("PROPS DEPOT" ->
-- "P R O P S   D E P O T"). Long or already spaced copy is returned unchanged.
local function track(text: string): string
	if text:match("^%S %S %S") or utf8.len(text) == nil or (utf8.len(text) :: number) > 16 then
		return text
	end
	local letters = {}
	for _, code in utf8.codes((text:gsub("%s+", " "))) do
		table.insert(letters, utf8.char(code))
	end
	return table.concat(letters, " ")
end

local function make(class: string, name: string, parent: Instance)
	local obj = Instance.new(class)
	obj.Name = name
	obj.Parent = parent
	return obj
end

-- Draws controlled copy on one face of a part. The canvas is sized in pixels per stud, so the text keeps the
-- plate's true aspect and never squashes.
local function screen(part: BasePart, name: string, text: string, styleName: string, face: Enum.NormalId?)
	local style = styles[styleName] or styles.wayfinding
	local normal = face or Enum.NormalId.Back
	local surface = Instance.new("SurfaceGui")
	surface.Name = name
	surface.Face = normal
	surface.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	surface.PixelsPerStud = style.pixelsPerStud
	surface.LightInfluence = style.lightInfluence
	surface.Brightness = style.brightness
	surface.MaxDistance = style.maxDistance
	surface.ClipsDescendants = true
	surface.Parent = part
	local faceHeight = if normal == Enum.NormalId.Top or normal == Enum.NormalId.Bottom
		then part.Size.Z
		else part.Size.Y
	local t = Instance.new("TextLabel")
	t.Name = "Type"
	t.Size = UDim2.fromScale(1 - style.padX * 2, 1 - style.padY * 2)
	t.Position = UDim2.fromScale(style.padX, style.padY)
	t.TextColor3 = style.color
	t.FontFace = style.font
	t.TextScaled = true
	t.TextWrapped = true
	t.BackgroundTransparency = 1
	t.Text = if style.track then track(text) else text
	t.Parent = surface
	if style.stroke then
		local outline = Instance.new("UIStroke")
		outline.ApplyStrokeMode = Enum.ApplyStrokeMode.Contextual
		outline.Color = style.stroke
		outline.Transparency = style.strokeTransparency
		outline.LineJoinMode = Enum.LineJoinMode.Round
		outline.Thickness = math.clamp(faceHeight * style.pixelsPerStud * style.strokeScale, 1, 5)
		outline.Parent = t
	end
	if style.gradient then
		local sheen = Instance.new("UIGradient")
		sheen.Color = style.gradient
		sheen.Rotation = style.gradientRotation
		sheen.Parent = t
	end
	return t
end
Room.sign = screen

function Room.build()
	local set = workspace:WaitForChild("ShowSet")
	local rig = make("Folder", "ShowRig", set)
	local water = set:FindFirstChild("HarborSurface", true)
	if water and water:IsA("BasePart") then
		-- The far-water sheet supplies the horizon below the swimmable, reflective near shore.
		water.Position = Vector3.new(water.Position.X, -6.2, water.Position.Z)
		water.Reflectance = 0.04
		local terrain = workspace.Terrain
		terrain.WaterColor = Color3.fromRGB(40, 92, 120)
		terrain.WaterTransparency = 0.22
		terrain.WaterWaveSize = 0.16
		terrain.WaterWaveSpeed = 8
		terrain.WaterReflectance = 0.6
		terrain:FillBlock(CFrame.new(-262, -8, 76), Vector3.new(260, 12, 408), Enum.Material.Water)
	end
	for _, item in set:GetDescendants() do
		if
			item:IsA("StringValue")
			and item.Name == "Wayfinding"
			and item.Parent
			and item.Parent:IsA("BasePart")
		then
			local plate = item.Parent :: BasePart
			local styleName = if plate:FindFirstAncestor("BladeSign")
				then "blade"
				else plateStyles[plate.Name] or (if plate.Name:find("Marquee")
					then "marquee"
					else "wayfinding")
			screen(plate, "WayfindingType", item.Value, styleName)
		end
	end
	local board = set:FindFirstChild("LiveBoard", true) :: BasePart
	local sign = screen(board, "Caption", "DELIVERY", "live")
	local function fixture(name: string, pos: Vector3, size: Vector3)
		local p = Instance.new("Part")
		p.Name = name
		p.Anchored = true
		p.CanCollide = false
		p.CanTouch = false
		p.Transparency = 1
		p.Size = size
		p.Position = pos
		p.Parent = rig
		return p
	end
	local logo = fixture("Marquee", Vector3.new(0, 14.22, -20.25), Vector3.new(12.1, 1.65, 0.12))
	screen(logo, "Nameplate", "D E L I V E R Y", "marquee")
	local ticketHeader =
		fixture("BoxOfficeHeader", Vector3.new(14, 7.3, -13.70), Vector3.new(5.35, 0.74, 0.1))
	screen(ticketHeader, "Header", "TODAY'S PROGRAMME", "header")
	local daily = fixture("DailyBoard", Vector3.new(14, 5.30, -13.72), Vector3.new(5.14, 3.50, 0.2))
	daily.Transparency = 0
	daily.Color = Color3.fromRGB(45, 31, 52)
	daily.Material = Enum.Material.SmoothPlastic
	local dailySign = screen(daily, "Daily", "DAILY SHOW", "daily")
	-- A champagne inner frame turns the plain board into a programme card.
	local card = Instance.new("Frame")
	card.Name = "Frame"
	card.BackgroundTransparency = 1
	card.Size = UDim2.new(1, -16, 1, -16)
	card.Position = UDim2.fromOffset(8, 8)
	card.Parent = dailySign.Parent
	local rule = Instance.new("UIStroke")
	rule.Color = champagne
	rule.Thickness = 3
	rule.Transparency = 0.15
	rule.Parent = card
	local round = Instance.new("UICorner")
	round.CornerRadius = UDim.new(0, 10)
	round.Parent = card
	local tickets = {}
	for _, item in set.Gallery:GetChildren() do
		if item:IsA("BasePart") and item.Name == "SeatTicket" then
			table.insert(tickets, item)
		end
	end
	table.sort(tickets, function(a, b)
		if math.abs(a.Position.Z - b.Position.Z) > 0.1 then
			return a.Position.Z < b.Position.Z
		end
		return a.Position.X < b.Position.X
	end)
	for index, ticket in tickets do
		screen(ticket, "SeatNumber", string.format("%02d", index), "ticket")
	end
	local function light(name, pos, col, power, range, shadows)
		local lamp = fixture(name, pos, Vector3.one)
		local source = Instance.new("PointLight")
		source.Name = name
		source.Brightness = power
		source.Range = range
		source.Color = col
		source.Shadows = shadows
		source.Parent = lamp
		return source
	end
	-- Theatre rig (ShowFX animates Key and House). Key is one of three shadow casters in the whole world.
	light("Key", Vector3.new(0, 11, 1), Color3.fromRGB(255, 222, 179), 2, 39, true)
	light("BlueWash", Vector3.new(-16, 7, -13), Color3.fromRGB(105, 113, 255), 2.2, 22, false)
	light("RoseWash", Vector3.new(16, 7, -13), Color3.fromRGB(255, 94, 174), 1.7, 22, false)
	light("House", Vector3.new(0, 9, 9), Color3.fromRGB(198, 148, 209), 1.2, 29, false)
	light("Footlights", Vector3.new(2, 5, -15), Color3.fromRGB(255, 192, 114), 1.3, 21, false)
	-- District practicals for blue hour: warm tungsten against the indigo sky. The client adds the per-lantern
	-- pools (Atmosphere.client.luau), so these are broad fills with modest ranges. Shadow budget: Key,
	-- PlazaPractical and FestivalLight only (DESIGN budget is six).
	for _, site in
		{
			{ "TicketLights", Vector3.new(0, 11, 39), Color3.fromRGB(255, 210, 160), 1.15, 30, false },
			{ "PlazaPractical", Vector3.new(2, 13, 62), Color3.fromRGB(255, 208, 168), 0.95, 40, true },
			{ "WorkshopSidelight", Vector3.new(-54, 9, 53), Color3.fromRGB(190, 200, 255), 1.15, 26, false },
			{ "DispatchWarmth", Vector3.new(53, 9, 53), Color3.fromRGB(255, 204, 156), 1.15, 26, false },
			{ "TailoringLamps", Vector3.new(56, 9, 89), Color3.fromRGB(255, 196, 212), 1.1, 26, false },
			{ "LoftDaylight", Vector3.new(-54, 9, 89), Color3.fromRGB(255, 214, 176), 1.1, 26, false },
			{ "DerrickLantern", Vector3.new(-121, 9, 72), Color3.fromRGB(255, 196, 140), 0.95, 32, false },
			{ "SignalParkCanopy", Vector3.new(131, 10, 90), Color3.fromRGB(255, 206, 182), 0.9, 32, false },
			{ "PostCounter", Vector3.new(-87, 8, 54), Color3.fromRGB(255, 206, 150), 0.95, 18, false },
			{ "ListeningDesk", Vector3.new(85, 8, 94), Color3.fromRGB(205, 196, 255), 0.95, 17, false },
			{ "Bakehouse", Vector3.new(-56, 8, 121), Color3.fromRGB(255, 196, 140), 1.0, 18, false },
			{ "GalleryLamps", Vector3.new(56, 8, 130), Color3.fromRGB(255, 222, 214), 0.95, 17, false },
			{ "FestivalLight", Vector3.new(0, 14, 173), Color3.fromRGB(255, 190, 140), 1.1, 40, true },
			{ "TerraceLanterns", Vector3.new(0, 14, 119), Color3.fromRGB(212, 190, 255), 0.95, 28, false },
		}
	do
		light(site[1], site[2], site[3], site[4], site[5], site[6])
	end
	-- Light shafts have a fixed cost and never cast shadows.
	for _, x in { -14, 0, 14 } do
		local source = fixture("Lens", Vector3.new(x, 20.1, -0.5), Vector3.one)
		local target = fixture("Pool", Vector3.new(x * 0.67, 2.2, -10), Vector3.one)
		local a = Instance.new("Attachment")
		a.Parent = source
		local b = Instance.new("Attachment")
		b.Parent = target
		local beam = Instance.new("Beam")
		beam.Attachment0 = a
		beam.Attachment1 = b
		beam.FaceCamera = true
		beam.Width0 = 0.25
		beam.Width1 = 3.2
		beam.LightEmission = 0.9
		beam.Color = ColorSequence.new(Color3.fromRGB(255, 218, 169))
		beam.Transparency = NumberSequence.new({
			NumberSequenceKeypoint.new(0, 0.85),
			NumberSequenceKeypoint.new(0.4, 0.94),
			NumberSequenceKeypoint.new(1, 1),
		})
		beam.Parent = source
	end
	local seats = {}
	for row = 0, 1 do
		for col = -2, 2 do
			local seat = Instance.new("Seat")
			seat.Name = "Seat"
			seat.Anchored = true
			seat.Transparency = 1
			seat.Size = Vector3.new(3, 0.4, 2.8)
			seat.Position = Vector3.new(col * 5, 1.52 + row * 1.2, 4 + row * 6)
			seat.Parent = rig
			table.insert(seats, seat)
		end
	end
	-- Arrival in Broadcast Plaza, facing the theatre door and the DELIVERY marquee.
	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "Entry"
	spawn.Neutral = true
	spawn.Duration = 0
	spawn.Anchored = true
	spawn.CanTouch = true
	spawn.Size = Vector3.new(4, 0.3, 3)
	spawn.CFrame = CFrame.lookAt(Vector3.new(0, 0.11, 58), Vector3.new(0, 0.11, 30))
	spawn.Transparency = 1
	spawn.Parent = rig
	local function place(player: Player, performing: boolean)
		local char = player.Character
		if not char or not char:IsDescendantOf(workspace) then
			return
		end
		local hum = char:FindFirstChildOfClass("Humanoid")
		if not hum or hum.Health <= 0 then
			return
		end
		if performing then
			hum.Sit = false
			hum:ChangeState(Enum.HumanoidStateType.GettingUp)
			char:PivotTo(CFrame.lookAt(Vector3.new(5, 5.4, -9.5), Vector3.new(5, 5.4, 5)))
		else
			if hum.SeatPart and table.find(seats, hum.SeatPart) then
				return
			end
			for _, seat in seats do
				if not seat.Occupant then
					char:PivotTo(seat.CFrame + Vector3.new(0, 2.2, 0))
					seat:Sit(hum)
					return
				end
			end
		end
	end
	return { sign = sign, daily = dailySign, place = place }
end
return Room
