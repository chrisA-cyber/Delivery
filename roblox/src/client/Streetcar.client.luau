--!strict
-- Lot Line streetcar, client side: the ride card with the request-stop button, plus local dressing on the
-- car (bogies that bob, a trolley pole that sparks while moving, a roof bell that swings at each stop) and
-- the stop flags. The bell's sound is rung by Ambience (SoundIds.TramBell); this file only swings it.
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local UserInput = game:GetService("UserInputService")
local Storage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer
local remote = Storage:WaitForChild("Delivery"):WaitForChild("StreetcarStop") :: RemoteEvent
local network = workspace:WaitForChild("DistrictRailway")
local train = network:WaitForChild("LotLine") :: Model

local themeModule = script.Parent:FindFirstChild("UITheme")
local Theme: any = nil
if themeModule and themeModule:IsA("ModuleScript") then
	local ok, value = pcall(require, themeModule)
	if ok then
		Theme = value
	end
end
local function colour(key: string, fallback: Color3): Color3
	local value = Theme and Theme.Color and Theme.Color[key]
	return if typeof(value) == "Color3" then value else fallback
end
local function font(key: string, fallback: Enum.Font): Enum.Font
	local value = Theme and Theme.Font and Theme.Font[key]
	return if typeof(value) == "EnumItem" then value :: any else fallback
end
local PANEL = colour("panel", Color3.fromRGB(27, 29, 58))
local CHAMPAGNE = colour("champagne", Color3.fromHex("ddb481"))
local BULB = colour("bulb", Color3.fromHex("ffdc9e"))
local CREAM = colour("cream", Color3.fromHex("fff0cf"))
local MIDNIGHT = colour("midnight", Color3.fromHex("242957"))
local MUTED = colour("muted", Color3.fromRGB(184, 182, 214))

----------------------------------------------------------------------------------------------------
-- Ride card. Sits on the right, above the touch jump button (and in the corner on desktop), clear of the
-- thumbstick, the top-right show navigation and the bottom control desk.
----------------------------------------------------------------------------------------------------
local gui = Instance.new("ScreenGui")
gui.Name = "LotLineRide"
gui.ResetOnSpawn = false
gui.Enabled = false
gui.DisplayOrder = 6
gui.ScreenInsets = Enum.ScreenInsets.CoreUISafeInsets
gui.Parent = player:WaitForChild("PlayerGui")

local card = Instance.new("Frame")
card.Name = "RideCard"
card.AnchorPoint = Vector2.new(1, 1)
card.Size = UDim2.fromOffset(250, 138)
card.BackgroundColor3 = PANEL
card.BackgroundTransparency = 0.04
card.Parent = gui
local cardCorner = Instance.new("UICorner")
cardCorner.CornerRadius = UDim.new(0, 16)
cardCorner.Parent = card
local cardStroke = Instance.new("UIStroke")
cardStroke.Color = CHAMPAGNE
cardStroke.Thickness = 1.5
cardStroke.Parent = card
if Theme and type(Theme.attachScale) == "function" then
	pcall(Theme.attachScale, card)
end
local pop = Instance.new("UIScale")
pop.Name = "Pop"
-- Pop animates a wrapper so it never fights the theme's viewport scale.
local wrap = Instance.new("Frame")
wrap.Name = "Content"
wrap.BackgroundTransparency = 1
wrap.Size = UDim2.fromScale(1, 1)
wrap.Parent = card
pop.Parent = wrap

local kicker = Instance.new("TextLabel")
kicker.Name = "Kicker"
kicker.BackgroundTransparency = 1
kicker.Position = UDim2.fromOffset(16, 10)
kicker.Size = UDim2.new(1, -32, 0, 20)
kicker.Font = font("heading", Enum.Font.GothamBold)
kicker.TextSize = 16
kicker.TextColor3 = CHAMPAGNE
kicker.TextXAlignment = Enum.TextXAlignment.Left
kicker.Text = "LOT LINE  ·  STREETCAR"
kicker.Parent = wrap

local status = Instance.new("TextLabel")
status.Name = "Status"
status.BackgroundTransparency = 1
status.Position = UDim2.fromOffset(16, 32)
status.Size = UDim2.new(1, -32, 0, 24)
status.Font = font("body", Enum.Font.GothamMedium)
status.TextSize = 17
status.TextColor3 = CREAM
status.TextXAlignment = Enum.TextXAlignment.Left
status.TextTruncate = Enum.TextTruncate.AtEnd
status.Parent = wrap

local buttonHeight = 52
if Theme and type(Theme.touchHeight) == "function" then
	local ok, value = pcall(Theme.touchHeight)
	if ok and type(value) == "number" then
		buttonHeight = math.max(48, value)
	end
end
card.Size = UDim2.fromOffset(250, 72 + buttonHeight)

local button = Instance.new("TextButton")
button.Name = "RequestStop"
button.AnchorPoint = Vector2.new(0.5, 1)
button.Position = UDim2.new(0.5, 0, 1, -12)
button.Size = UDim2.new(1, -24, 0, buttonHeight)
button.BackgroundColor3 = Color3.new(1, 1, 1)
button.AutoButtonColor = false
button.Font = font("button", Enum.Font.GothamBlack)
button.TextSize = 18
button.TextColor3 = MIDNIGHT
button.Selectable = true
button.Parent = wrap
local buttonCorner = Instance.new("UICorner")
buttonCorner.CornerRadius = UDim.new(0, 12)
buttonCorner.Parent = button
local fill = Instance.new("UIGradient")
fill.Rotation = 90
fill.Color = ColorSequence.new(BULB, CHAMPAGNE)
fill.Parent = button
local press = Instance.new("UIScale")
press.Parent = button

local function place()
	local touch = UserInput.TouchEnabled
	if Theme and type(Theme.isTouch) == "function" then
		local ok, value = pcall(Theme.isTouch)
		if ok and type(value) == "boolean" then
			touch = value
		end
	end
	-- 110 design px of jump button plus a margin on touch screens.
	card.Position = if touch then UDim2.new(1, -14, 1, -126) else UDim2.new(1, -18, 1, -18)
end
place()
UserInput.LastInputTypeChanged:Connect(place)

local requested = false
local function display()
	local stop = train:GetAttribute("Stop")
	local nextStop = train:GetAttribute("NextStop")
	local dest = if type(nextStop) == "string" and nextStop ~= "" then nextStop else "the next stop"
	local here = type(stop) == "string" and stop ~= ""
	if here then
		status.Text = "At " .. (stop :: string)
		button.Text = "Get off here"
	elseif requested then
		status.Text = "Stopping at " .. dest
		button.Text = "Stop requested"
	else
		status.Text = "Next stop  ·  " .. dest
		button.Text = "Request stop"
	end
	button.TextTransparency = if requested and not here then 0.35 else 0
	fill.Color = if requested and not here
		then ColorSequence.new(MUTED, MUTED)
		else ColorSequence.new(BULB, CHAMPAGNE)
end

local function reducedMotion(): boolean
	if Theme and type(Theme.reducedMotion) == "function" then
		local ok, value = pcall(Theme.reducedMotion)
		if ok and value == true then
			return true
		end
	end
	return false
end

local function show(on: boolean)
	if on == gui.Enabled then
		return
	end
	gui.Enabled = on
	if on then
		pop.Scale = if reducedMotion() then 1 else 0.85
		TweenService:Create(pop, TweenInfo.new(0.22, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
			Scale = 1,
		}):Play()
	end
end

local seatedConnection: RBXScriptConnection? = nil
local function watch(character: Model)
	if seatedConnection then
		seatedConnection:Disconnect()
	end
	show(false)
	requested = false
	local hum = character:WaitForChild("Humanoid") :: Humanoid
	seatedConnection = hum.Seated:Connect(function(active: boolean, seat: BasePart?)
		requested = false
		display()
		show(active and seat ~= nil and seat:GetAttribute("LotLineSeat") == true)
	end)
end

button.Activated:Connect(function()
	if not gui.Enabled then
		return
	end
	press.Scale = 0.94
	TweenService:Create(press, TweenInfo.new(0.16, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
		Scale = 1,
	}):Play()
	requested = true
	display()
	remote:FireServer()
end)
button.MouseEnter:Connect(function()
	press.Scale = 1.03
end)
button.MouseLeave:Connect(function()
	press.Scale = 1
end)
train:GetAttributeChangedSignal("Stop"):Connect(display)
train:GetAttributeChangedSignal("NextStop"):Connect(display)
player.CharacterAdded:Connect(watch)
if player.Character then
	task.spawn(watch, player.Character)
end
display()

----------------------------------------------------------------------------------------------------
-- Car dressing (local parts that follow the replicated chassis).
----------------------------------------------------------------------------------------------------
local dressing = Instance.new("Folder")
dressing.Name = "LotLineDressing"
dressing.Parent = workspace

local ink = Color3.fromRGB(30, 34, 46)
local brass = Color3.fromRGB(210, 156, 70)
local function piece(name: string, size: Vector3, color: Color3, material: Enum.Material?): BasePart
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size
	p.Color = color
	p.Material = material or Enum.Material.Metal
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Parent = dressing
	return p
end

local bogies = {
	piece("Bogie", Vector3.new(2.3, 0.36, 4.7), ink),
	piece("Bogie", Vector3.new(2.3, 0.36, 4.7), ink),
}
local pole = piece("TrolleyPole", Vector3.new(5.2, 0.12, 0.12), ink)
local shoe = piece("TrolleyShoe", Vector3.new(0.5, 0.18, 0.3), brass)
local bell = piece("RoofBell", Vector3.new(0.5, 0.5, 0.5), brass);
(bell :: Part).Shape = Enum.PartType.Ball

local spark = Instance.new("ParticleEmitter")
spark.Name = "PoleSpark"
spark.Color = ColorSequence.new(Color3.fromRGB(255, 246, 214), Color3.fromRGB(140, 170, 255))
spark.LightEmission = 1
spark.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.28), NumberSequenceKeypoint.new(1, 0) })
spark.Lifetime = NumberRange.new(0.12, 0.3)
spark.Speed = NumberRange.new(3, 7)
spark.SpreadAngle = Vector2.new(180, 180)
spark.Acceleration = Vector3.new(0, -18, 0)
spark.Rate = 0
spark.Parent = shoe

-- Stop flags (built by the server) sway a little, and swing harder as the car comes in.
type Flag = { part: BasePart, rest: CFrame, pivot: CFrame }
local flags: { Flag } = {}
local function addFlag(item: Instance)
	if item:IsA("BasePart") and item.Name == "StopFlag" then
		local pivot = CFrame.new(item.Position + Vector3.new(0, item.Size.Y / 2, 0))
		table.insert(flags, { part = item, rest = pivot:ToObjectSpace(item.CFrame), pivot = pivot })
	end
end
for _, item in network:GetChildren() do
	addFlag(item)
end
network.ChildAdded:Connect(addFlag)

local bellSwingAt = -10
train:GetAttributeChangedSignal("Stop"):Connect(function()
	bellSwingAt = os.clock()
end)

local lastPos: Vector3? = nil
local speed = 0
local sparkAt = 0
local frames = 0
RunService.Heartbeat:Connect(function(dt: number)
	local root = train.PrimaryPart
	local camera = workspace.CurrentCamera
	if not root or not camera or dt <= 0 then
		return
	end
	local now = os.clock()
	local cf = root.CFrame
	local pos = cf.Position
	local previous = lastPos
	lastPos = pos
	if previous then
		local v = (pos - previous).Magnitude / dt
		speed += (math.min(v, 30) - speed) * math.min(1, dt * 4)
	end
	frames += 1
	local distance = (camera.CFrame.Position - pos).Magnitude
	if distance > 180 or (distance > 80 and frames % 2 == 0) then
		return
	end
	local moving = math.clamp(speed / 10, 0, 1)
	local rattle = math.sin(now * 23) * 0.025 * moving
	bogies[1].CFrame = cf * CFrame.new(-5.3, -0.4 + rattle, 0)
	bogies[2].CFrame = cf * CFrame.new(5.3, -0.4 - rattle, 0)
	-- The pole trails up and back from the rear of the roof and bounces on the joints.
	local bounce = math.sin(now * 7.5) * 0.04 * moving
	local poleFrame = cf
		* CFrame.new(-3.2, 5.75, 0)
		* CFrame.Angles(0, 0, -(0.42 + bounce))
		* CFrame.new(-2.6, 0, 0)
	pole.CFrame = poleFrame
	local tip = poleFrame * CFrame.new(-2.6, 0, 0)
	shoe.CFrame = tip
	if moving > 0.3 and now > sparkAt then
		sparkAt = now + 0.15 + math.random() * 0.6
		spark:Emit(math.random(2, 5))
	end
	local age = now - bellSwingAt
	local ring = if age < 1.6 then math.sin(age * 14) * 0.5 * (1 - age / 1.6) else 0
	bell.CFrame = cf * CFrame.new(6.3, 6.3, 0) * CFrame.Angles(ring, 0, 0) * CFrame.new(0, -0.32, 0)

	for i, flag in flags do
		local near = math.abs(flag.pivot.X - pos.X) < 18
		local amount = if near then 0.07 * math.max(moving, 0.3) else 0.025
		flag.part.CFrame = flag.pivot
			* CFrame.Angles(0, math.sin(now * (if near then 3.2 else 1.3) + i) * amount, 0)
			* flag.rest
	end
end)
