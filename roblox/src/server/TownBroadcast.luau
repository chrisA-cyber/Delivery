--!strict
-- Mirrors the live show into the town. The mapping and poster copy are pure functions so Lune can
-- test them; only start() touches Roblox services. Every string drawn here is catalogue text, a
-- fixed label below, or a Roblox display name. Speech and typed text never reach these surfaces.
local TownBroadcast = {}

export type Record = { round: number, lastScore: number, lastBand: number }
export type Status = {
	Phase: string,
	PhaseEndsAt: number,
	Format: string,
	House: boolean,
	Performer: string,
	CardLine: string,
	Direction: string,
	LastScore: number,
	LastBand: number,
	Round: number,
	Watchers: number,
}
export type Poster = {
	headline: string,
	performer: string,
	format: string,
	line: string,
	direction: string,
	score: string,
	band: number,
	live: boolean,
	ticking: boolean,
}

TownBroadcast.keys = {
	"Phase",
	"PhaseEndsAt",
	"Format",
	"House",
	"Performer",
	"CardLine",
	"Direction",
	"LastScore",
	"LastBand",
	"Round",
	"Watchers",
}
TownBroadcast.phases =
	{ "idle", "lineup", "direct", "countdown", "take", "read", "vote", "host", "reveal", "intermission" }

-- The bands match the audience prediction buttons: under 60, 60-89 and 90+ (3 is encore level).
function TownBroadcast.band(overall: number?): number
	if type(overall) ~= "number" or overall ~= overall then
		return 0
	end
	if overall < 60 then
		return 1
	elseif overall < 90 then
		return 2
	end
	return 3
end

function TownBroadcast.newRecord(): Record
	return { round = 0, lastScore = -1, lastBand = 0 }
end

-- Called once when the show enters its reveal phase.
function TownBroadcast.reveal(record: Record, result: any)
	local overall = if type(result) == "table" then result.overall else nil
	record.round += 1
	if type(overall) == "number" and overall == overall then
		record.lastScore = math.clamp(math.round(overall), 0, 100)
		record.lastBand = TownBroadcast.band(overall)
	else
		record.lastScore = -1
		record.lastBand = 0
	end
end

local function text(value: any): string
	return if type(value) == "string" then value else ""
end

-- s is the authoritative Show state. performer is the actor's display name ("" when unknown).
function TownBroadcast.status(s: any, record: Record, performer: string, watchers: number): Status
	local phase = if s.phase == "lobby" or not table.find(TownBroadcast.phases, s.phase)
		then "idle"
		else s.phase
	local idle = phase == "idle"
	local house = not idle and s.actor == 0
	return {
		Phase = phase,
		PhaseEndsAt = if idle then 0 else (tonumber(s.untilTime) or 0),
		Format = if idle then "" else text(s.mode),
		House = house,
		Performer = if idle then "" elseif house then "Flip" else performer,
		CardLine = if idle or type(s.line) ~= "table" then "" else text(s.line.text),
		Direction = if idle or type(s.cue) ~= "table" then "" else text(s.cue.label),
		LastScore = record.lastScore,
		LastBand = record.lastBand,
		Round = record.round,
		Watchers = math.max(0, math.floor(watchers)),
	}
end

TownBroadcast.bandWords = { [0] = "TAKE IT AGAIN", [1] = "WARMING UP", [2] = "THAT LANDED", [3] = "ENCORE!" }

function TownBroadcast.scoreLine(score: number, band: number): string
	if score < 0 or band <= 0 then
		return TownBroadcast.bandWords[0]
	end
	if band >= 3 then
		return string.format("ENCORE! %d", score)
	end
	return string.format("%s · %d", TownBroadcast.bandWords[band] or "", score)
end

function TownBroadcast.clock(seconds: number): string
	local whole = math.max(0, math.ceil(seconds))
	return string.format("%d:%02d", whole // 60, whole % 60)
end

local onNow = { direct = true, countdown = true, take = true, read = true, vote = true }

-- Composes the poster copy for one moment. now uses the same clock as PhaseEndsAt.
function TownBroadcast.poster(a: { [string]: any }, now: number): Poster
	local phase = text(a.Phase)
	local performer = text(a.Performer)
	local score = tonumber(a.LastScore) or -1
	local band = tonumber(a.LastBand) or 0
	local hasScore = (tonumber(a.Round) or 0) > 0
	local poster: Poster = {
		headline = "SEATS OPEN",
		performer = "",
		format = text(a.Format),
		line = text(a.CardLine),
		direction = "",
		score = "",
		band = 0,
		live = onNow[phase] == true,
		ticking = false,
	}
	if phase == "lineup" then
		local left = (tonumber(a.PhaseEndsAt) or 0) - now
		poster.headline = if left > 0 then "NEXT ACT IN " .. TownBroadcast.clock(left) else "NEXT ACT SOON"
		poster.ticking = left > 0
		poster.performer = if performer ~= "" then performer .. " is in the wings" else ""
	elseif phase == "intermission" then
		poster.headline = "NEXT ACT SOON"
	elseif onNow[phase] then
		poster.headline = if phase == "vote" then "ON NOW · VOTING" else "ON NOW"
		poster.performer = if a.House == true
			then "Flip performs the house act"
			elseif performer ~= "" then "Starring " .. performer
			else ""
	elseif phase == "host" or phase == "reveal" then
		poster.headline = "THE VERDICT"
		poster.performer = if a.House == true
			then "Flip's house act"
			elseif performer ~= "" then performer
			else ""
	else
		poster.headline = "SEATS OPEN"
		poster.performer = "Walk in through the gold doors"
	end
	if onNow[phase] or phase == "host" or phase == "reveal" then
		local direction = text(a.Direction)
		poster.direction = if direction ~= ""
			then "Direction · " .. direction
			elseif phase == "direct" then "The audience is choosing a direction"
			else ""
	end
	if phase == "host" then
		poster.score = "Flip is reading the room…"
	elseif phase == "reveal" and hasScore then
		poster.score = TownBroadcast.scoreLine(score, band)
		poster.band = band
	elseif (phase == "idle" or phase == "lineup" or phase == "intermission") and hasScore then
		poster.score = "LAST ACT · " .. TownBroadcast.scoreLine(score, band)
		poster.band = band
	end
	return poster
end

-- Runtime rendering. Everything below needs Roblox services.
-- Filled by start(), so the pure functions above stay loadable outside Roblox.
local palette: { [string]: Color3 } = {}
local bandColours: { [number]: Color3 } = {}
local function loadPalette()
	palette.midnight = Color3.fromRGB(27, 29, 58)
	palette.deep = Color3.fromRGB(36, 41, 87)
	palette.champagne = Color3.fromRGB(221, 180, 129)
	palette.bulb = Color3.fromRGB(255, 220, 158)
	palette.cream = Color3.fromRGB(255, 240, 207)
	palette.powder = Color3.fromRGB(146, 154, 203)
	palette.petal = Color3.fromRGB(213, 140, 165)
	bandColours[0] = palette.powder
	bandColours[1] = palette.powder
	bandColours[2] = palette.petal
	bandColours[3] = palette.bulb
end

type Board = {
	part: BasePart,
	headline: TextLabel,
	performer: TextLabel,
	format: TextLabel,
	line: TextLabel,
	direction: TextLabel,
	score: TextLabel,
	stroke: UIStroke,
	bulbs: { Frame },
}

local function label(
	parent: Instance,
	name: string,
	order: number,
	height: number,
	font: Font,
	colour: Color3
)
	local t = Instance.new("TextLabel")
	t.Name = name
	t.LayoutOrder = order
	t.Size = UDim2.fromScale(1, height)
	t.BackgroundTransparency = 1
	t.FontFace = font
	t.TextColor3 = colour
	t.TextScaled = true
	t.TextWrapped = true
	t.Text = ""
	t.Parent = parent
	return t
end

local function bulbRow(parent: Instance, y: number, bulbs: { Frame })
	local row = Instance.new("Frame")
	row.Name = "Bulbs"
	row.BackgroundTransparency = 1
	row.AnchorPoint = Vector2.new(0.5, 0.5)
	row.Position = UDim2.fromScale(0.5, y)
	row.Size = UDim2.fromScale(0.86, 0.035)
	row.Parent = parent
	local layout = Instance.new("UIListLayout")
	layout.FillDirection = Enum.FillDirection.Horizontal
	layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
	layout.VerticalAlignment = Enum.VerticalAlignment.Center
	layout.Padding = UDim.new(0.035, 0)
	layout.Parent = row
	for _ = 1, 9 do
		local dot = Instance.new("Frame")
		dot.Name = "Bulb"
		dot.Size = UDim2.fromScale(0.06, 1)
		dot.BackgroundColor3 = palette.bulb
		dot.BorderSizePixel = 0
		local ratio = Instance.new("UIAspectRatioConstraint")
		ratio.AspectRatio = 1
		ratio.Parent = dot
		local corner = Instance.new("UICorner")
		corner.CornerRadius = UDim.new(0.5, 0)
		corner.Parent = dot
		dot.Parent = row
		table.insert(bulbs, dot)
	end
end

local function build(part: BasePart): Board
	local old = part:FindFirstChild("ShowBroadcast")
	if old then
		old:Destroy()
	end
	local surface = Instance.new("SurfaceGui")
	surface.Name = "ShowBroadcast"
	surface.Face = Enum.NormalId.Back
	surface.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	surface.PixelsPerStud = 64
	surface.LightInfluence = 0
	surface.Brightness = 1.15
	surface.MaxDistance = 140
	local card = Instance.new("Frame")
	card.Name = "Card"
	card.Size = UDim2.fromScale(1, 1)
	card.BackgroundColor3 = palette.midnight
	card.BorderSizePixel = 0
	card.Parent = surface
	local fill = Instance.new("UIGradient")
	fill.Rotation = 90
	fill.Color = ColorSequence.new(palette.deep, palette.midnight)
	fill.Parent = card
	local frame = Instance.new("Frame")
	frame.Name = "Border"
	frame.AnchorPoint = Vector2.new(0.5, 0.5)
	frame.Position = UDim2.fromScale(0.5, 0.5)
	frame.Size = UDim2.fromScale(0.94, 0.95)
	frame.BackgroundTransparency = 1
	frame.Parent = card
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0.04, 0)
	corner.Parent = frame
	local stroke = Instance.new("UIStroke")
	stroke.Color = palette.champagne
	stroke.Thickness = math.max(3, part.Size.X * 64 * 0.012)
	stroke.Parent = frame
	local bulbs = {}
	bulbRow(card, 0.055, bulbs)
	bulbRow(card, 0.945, bulbs)
	local body = Instance.new("Frame")
	body.Name = "Body"
	body.AnchorPoint = Vector2.new(0.5, 0.5)
	body.Position = UDim2.fromScale(0.5, 0.5)
	body.Size = UDim2.fromScale(0.84, 0.8)
	body.BackgroundTransparency = 1
	body.Parent = card
	local list = Instance.new("UIListLayout")
	list.SortOrder = Enum.SortOrder.LayoutOrder
	list.HorizontalAlignment = Enum.HorizontalAlignment.Center
	list.VerticalAlignment = Enum.VerticalAlignment.Center
	list.Padding = UDim.new(0.015, 0)
	list.Parent = body
	local heavy = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.Heavy)
	local bold = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.Bold)
	local medium =
		Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.Medium, Enum.FontStyle.Italic)
	local marquee = label(body, "Marquee", 1, 0.08, bold, palette.champagne)
	marquee.Text = "TONIGHT AT THE DELIVERY"
	local board: Board = {
		part = part,
		headline = label(body, "Headline", 2, 0.2, heavy, palette.cream),
		performer = label(body, "Performer", 3, 0.09, bold, palette.bulb),
		format = label(body, "Format", 4, 0.07, bold, palette.powder),
		line = label(body, "Line", 5, 0.2, medium, palette.cream),
		direction = label(body, "Direction", 6, 0.08, bold, palette.petal),
		score = label(body, "Score", 7, 0.14, heavy, palette.bulb),
		stroke = stroke,
		bulbs = bulbs,
	}
	surface.Parent = part
	return board
end

local function setText(t: TextLabel, value: string)
	if t.Text ~= value then
		t.Text = value
	end
	local visible = value ~= ""
	if t.Visible ~= visible then
		t.Visible = visible
	end
end

local function paint(board: Board, poster: Poster)
	setText(board.headline, poster.headline)
	setText(board.performer, poster.performer)
	setText(board.format, if poster.format ~= "" then string.upper(poster.format) else "")
	setText(board.line, if poster.line ~= "" then "“" .. poster.line .. "”" else "")
	setText(board.direction, poster.direction)
	setText(board.score, poster.score)
	local accent = bandColours[poster.band] or palette.bulb
	if board.score.TextColor3 ~= accent then
		board.score.TextColor3 = accent
	end
	local encore = poster.band >= 3 and poster.score ~= ""
	local bulb = if encore then palette.cream elseif poster.live then palette.bulb else palette.champagne
	for _, dot in board.bulbs do
		if dot.BackgroundColor3 ~= bulb then
			dot.BackgroundColor3 = bulb
		end
	end
	local edge = if encore then palette.bulb else palette.champagne
	if board.stroke.Color ~= edge then
		board.stroke.Color = edge
	end
end

local function wanted(item: Instance): boolean
	return item:IsA("BasePart")
		and (item.Name == "CourtRelayBoard" or string.match(item.Name, "^ShowPoster_%w+$") ~= nil)
end

function TownBroadcast.start(status: Folder)
	loadPalette()
	local showSet = workspace:WaitForChild("ShowSet")
	local boards: { [BasePart]: Board } = {}
	local ticking = false
	local function attrs()
		return status:GetAttributes()
	end
	local function refresh()
		local poster = TownBroadcast.poster(attrs(), workspace:GetServerTimeNow())
		ticking = poster.ticking
		for part, board in boards do
			if part.Parent then
				paint(board, poster)
			else
				boards[part] = nil
			end
		end
	end
	local function adopt(item: Instance)
		if not wanted(item) then
			return
		end
		local part = item :: BasePart
		if boards[part] then
			return
		end
		local ok, board = pcall(build, part)
		if ok then
			boards[part] = board
			paint(board, TownBroadcast.poster(attrs(), workspace:GetServerTimeNow()))
		else
			warn("Delivery town broadcast could not dress", part:GetFullName(), board)
		end
	end
	for _, item in showSet:GetDescendants() do
		adopt(item)
	end
	showSet.DescendantAdded:Connect(adopt)
	showSet.DescendantRemoving:Connect(function(item)
		if item:IsA("BasePart") then
			boards[item :: BasePart] = nil
		end
	end)
	-- Attribute changes repaint once per batch; only the lineup countdown repaints on a 2 Hz clock.
	local scheduled = false
	status.AttributeChanged:Connect(function()
		if not scheduled then
			scheduled = true
			task.defer(function()
				scheduled = false
				refresh()
			end)
		end
	end)
	refresh()
	task.spawn(function()
		while status.Parent do
			task.wait(0.5)
			if ticking then
				refresh()
			end
		end
	end)
end

return TownBroadcast
