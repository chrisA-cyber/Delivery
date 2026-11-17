--!strict
-- Comic speech bubble for town robots: midnight panel, champagne stroke and tail, a name pill, a typewriter
-- reveal and an optional soft voice blip. The GUI is built on first use and only enabled while speaking.
local Storage = game:GetService("ReplicatedStorage")
local TextService = game:GetService("TextService")
local TweenService = game:GetService("TweenService")

local StreetBubble = {}
StreetBubble.__index = StreetBubble

local PANEL = Color3.fromRGB(27, 29, 58)
local CHAMPAGNE = Color3.fromHex("ddb481")
local CREAM = Color3.fromHex("fff0cf")
local MIDNIGHT = Color3.fromHex("242957")
-- Enum fonts (as in UITheme) so TextService:GetTextSize measures synchronously.
local BODY_FONT = Enum.Font.BuilderSansMedium
local NAME_FONT = Enum.Font.FredokaOne
local TEXT_SIZE = 18
local NAME_SIZE = 16
local MAX_WIDTH = 250
local PAD_X = 14
local PAD_Y = 10
local NAME_HEIGHT = 24
local TAIL = 12
local REVEAL_RATE = 48 -- graphemes per second
-- Ambient chatter never fills the screen: at most this many unprompted bubbles at once.
local MAX_AMBIENT = 3

local ids: any = {}
do
	local shared = Storage:FindFirstChild("Delivery")
	local module = shared and shared:FindFirstChild("SoundIds")
	if module and module:IsA("ModuleScript") then
		local ok, value = pcall(require, module)
		if ok and type(value) == "table" then
			ids = value
		end
	end
end

local function soundId(key: string): string?
	local id = ids[key]
	if type(id) == "number" and id > 0 then
		return "rbxassetid://" .. tostring(id)
	elseif type(id) == "string" and id ~= "" and id ~= "0" then
		return if string.find(id, "://", 1, true) then id else "rbxassetid://" .. id
	end
	return nil
end
StreetBubble.soundId = soundId

local ambientLive = 0

export type Bubble = {
	adornee: BasePart,
	name: string,
	voice: number,
	height: number,
	token: number,
	ambient: boolean,
	live: boolean,
	gui: BillboardGui?,
	body: Frame?,
	label: TextLabel?,
	pill: Frame?,
	pillText: TextLabel?,
	tail: Frame?,
	mask: Frame?,
	scale: UIScale?,
	blip: Sound?,
}

local function measure(text: string, font: Enum.Font, size: number, width: number): Vector2
	-- A couple of spare pixels keep the last word from wrapping when the label renders.
	return TextService:GetTextSize(text, size, font, Vector2.new(width, 1000)) + Vector2.new(3, 2)
end

local function frame(parent: Instance, name: string, color: Color3, z: number): Frame
	local f = Instance.new("Frame")
	f.Name = name
	f.BackgroundColor3 = color
	f.BorderSizePixel = 0
	f.ZIndex = z
	f.Parent = parent
	return f
end

-- height: studs above the adornee's centre where the tail should point.
function StreetBubble.new(adornee: BasePart, name: string, voice: number?, height: number?): Bubble
	local self = {
		adornee = adornee,
		name = name,
		voice = voice or 1,
		height = height or 1.6,
		token = 0,
		ambient = false,
		live = false,
	}
	return setmetatable(self, StreetBubble) :: any
end

local function build(self: Bubble)
	if self.gui then
		return
	end
	local gui = Instance.new("BillboardGui")
	gui.Name = "StreetBubble"
	gui.Adornee = self.adornee
	gui.AlwaysOnTop = true
	gui.LightInfluence = 0
	gui.MaxDistance = 48
	gui.SizeOffset = Vector2.new(0, 0.5)
	gui.StudsOffsetWorldSpace = Vector3.new(0, self.height, 0)
	gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	gui.ClipsDescendants = false
	gui.Enabled = false
	local holder = Instance.new("Frame")
	holder.Name = "Holder"
	holder.BackgroundTransparency = 1
	holder.Size = UDim2.fromScale(1, 1)
	-- Pop from the tail, not from the corner.
	holder.AnchorPoint = Vector2.new(0.5, 1)
	holder.Position = UDim2.fromScale(0.5, 1)
	holder.Parent = gui
	local scale = Instance.new("UIScale")
	scale.Parent = holder
	local body = frame(holder, "Body", PANEL, 2)
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 14)
	corner.Parent = body
	local stroke = Instance.new("UIStroke")
	stroke.Color = CHAMPAGNE
	stroke.Thickness = 2
	stroke.Parent = body
	local label = Instance.new("TextLabel")
	label.Name = "Line"
	label.BackgroundTransparency = 1
	label.Font = BODY_FONT
	label.TextSize = TEXT_SIZE
	label.TextColor3 = CREAM
	label.TextWrapped = true
	label.TextXAlignment = Enum.TextXAlignment.Left
	label.TextYAlignment = Enum.TextYAlignment.Top
	label.Position = UDim2.fromOffset(PAD_X, PAD_Y + 6)
	label.Size = UDim2.new(1, -PAD_X * 2, 1, -(PAD_Y * 2 + 6))
	label.ZIndex = 4
	label.Parent = body
	-- The tail sits under the body; a small mask erases the body's stroke where the two join.
	local tail = frame(holder, "Tail", PANEL, 1)
	tail.AnchorPoint = Vector2.new(0.5, 0.5)
	tail.Size = UDim2.fromOffset(16, 16)
	tail.Rotation = 45
	local tailStroke = Instance.new("UIStroke")
	tailStroke.Color = CHAMPAGNE
	tailStroke.Thickness = 2
	tailStroke.Parent = tail
	local mask = frame(holder, "TailMask", PANEL, 3)
	mask.AnchorPoint = Vector2.new(0.5, 0)
	mask.Size = UDim2.fromOffset(18, 4)
	local pill = frame(holder, "Name", CHAMPAGNE, 5)
	local pillCorner = Instance.new("UICorner")
	pillCorner.CornerRadius = UDim.new(0.5, 0)
	pillCorner.Parent = pill
	local pillText = Instance.new("TextLabel")
	pillText.BackgroundTransparency = 1
	pillText.Size = UDim2.fromScale(1, 1)
	pillText.Font = NAME_FONT
	pillText.TextSize = NAME_SIZE
	pillText.TextColor3 = MIDNIGHT
	pillText.Text = string.upper(self.name)
	pillText.ZIndex = 6
	pillText.Parent = pill
	local id = soundId("CrewBlip")
	if id then
		local blip = Instance.new("Sound")
		blip.Name = "Blip"
		blip.SoundId = id
		blip.Volume = 0.32
		blip.RollOffMinDistance = 6
		blip.RollOffMaxDistance = 42
		blip.PlaybackSpeed = self.voice
		blip.Parent = self.adornee
		self.blip = blip
	end
	gui.Parent = self.adornee
	self.gui = gui
	self.body = body
	self.label = label
	self.pill = pill
	self.pillText = pillText
	self.tail = tail
	self.mask = mask
	self.scale = scale
end

local function setLive(self: Bubble, live: boolean, ambient: boolean)
	if self.live and self.ambient then
		ambientLive -= 1
	end
	self.live = live
	self.ambient = live and ambient
	if self.live and self.ambient then
		ambientLive += 1
	end
end

function StreetBubble.busy(self: Bubble): boolean
	return self.live
end

function StreetBubble.ambientRoom(): boolean
	return ambientLive < MAX_AMBIENT
end

function StreetBubble.hide(self: Bubble)
	self.token += 1
	setLive(self, false, false)
	if self.gui then
		self.gui.Enabled = false
	end
end

-- Shows `text` with a typewriter reveal, then holds it. Ambient lines are dropped when the town is
-- already chatty. Returns false when the line was not shown.
function StreetBubble.say(self: Bubble, text: string, hold: number?, ambient: boolean?): boolean
	local isAmbient = ambient == true
	if isAmbient and not self.live and ambientLive >= MAX_AMBIENT then
		return false
	end
	self.token += 1
	local token = self.token
	setLive(self, true, isAmbient)
	task.spawn(function()
		build(self)
		local gui = self.gui :: BillboardGui
		local label = self.label :: TextLabel
		local textSize = measure(text, BODY_FONT, TEXT_SIZE, MAX_WIDTH)
		local nameSize = measure(string.upper(self.name), NAME_FONT, NAME_SIZE, 400)
		if token ~= self.token then
			return
		end
		local width = math.ceil(math.max(textSize.X, nameSize.X + 20, 64)) + PAD_X * 2
		local bodyHeight = math.ceil(textSize.Y) + PAD_Y * 2 + 6
		local top = NAME_HEIGHT // 2
		gui.Size = UDim2.fromOffset(width + 8, top + bodyHeight + TAIL + 6)
		local body = self.body :: Frame
		body.Position = UDim2.fromOffset(4, top)
		body.Size = UDim2.fromOffset(width, bodyHeight)
		local pill = self.pill :: Frame
		pill.Size = UDim2.fromOffset(math.ceil(nameSize.X) + 20, NAME_HEIGHT)
		pill.Position = UDim2.fromOffset(16, 0)
		local tail = self.tail :: Frame
		tail.Position = UDim2.new(0.5, 0, 0, top + bodyHeight)
		local mask = self.mask :: Frame
		mask.Position = UDim2.new(0.5, 0, 0, top + bodyHeight - 1)
		label.Text = text
		label.MaxVisibleGraphemes = 0
		local scale = self.scale :: UIScale
		scale.Scale = 0.55
		gui.Enabled = true
		TweenService:Create(scale, TweenInfo.new(0.22, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
			Scale = 1,
		}):Play()
		local count = utf8.len(text) or #text
		local shown = 0
		local step = 0
		while shown < count do
			task.wait(2 / REVEAL_RATE)
			if token ~= self.token then
				return
			end
			shown = math.min(count, shown + 2)
			label.MaxVisibleGraphemes = shown
			step += 1
			local blip = self.blip
			if blip and step % 2 == 1 then
				blip.PlaybackSpeed = self.voice * (0.94 + math.random() * 0.12)
				blip:Play()
			end
		end
		label.MaxVisibleGraphemes = -1
		task.wait(hold or math.clamp(2.4 + count * 0.045, 3, 8))
		if token ~= self.token then
			return
		end
		TweenService:Create(scale, TweenInfo.new(0.14, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
			Scale = 0.6,
		}):Play()
		task.wait(0.14)
		if token ~= self.token then
			return
		end
		gui.Enabled = false
		setLive(self, false, false)
	end)
	return true
end

return StreetBubble
