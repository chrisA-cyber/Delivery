--!strict
-- Town errand feedback: a stamp when a parcel is picked up, and a chime, a burst of sparkles at the
-- counter and a reward card when an errand is finished. The server sends fixed kinds, catalogue
-- titles and numbers only. Sounds use SoundIds when the owner assigns them and built-in clips
-- otherwise, so every moment is still visible and audible with all IDs at 0.
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local SoundService = game:GetService("SoundService")
local GuiService = game:GetService("GuiService")
local Debris = game:GetService("Debris")
local Storage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer
local shared = Storage:WaitForChild("Delivery")
local remote = shared:WaitForChild("TownFeedback", 60)
if not remote or not remote:IsA("RemoteEvent") then
	return
end
local okIds, loadedIds = pcall(require, shared:WaitForChild("SoundIds", 10))
local ids: { [string]: any } = if okIds and type(loadedIds) == "table" then loadedIds else {}

local palette = {
	midnight = Color3.fromRGB(27, 29, 58),
	champagne = Color3.fromRGB(221, 180, 129),
	bulb = Color3.fromRGB(255, 220, 158),
	cream = Color3.fromRGB(255, 240, 207),
	petal = Color3.fromRGB(213, 140, 165),
	cobalt = Color3.fromRGB(65, 91, 168),
	harbor = Color3.fromRGB(66, 131, 142),
	lacquer = Color3.fromRGB(91, 35, 56),
}
-- Matches the parcel label colours on the server-built prop.
local shopColours = {
	records = palette.cobalt,
	cafe = Color3.fromRGB(217, 119, 58),
	gallery = palette.petal,
}
local heavy = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.Heavy)
local bold = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.Bold)

local function reduced(): boolean
	local ok, value = pcall(function()
		return GuiService.ReducedMotionEnabled
	end)
	return ok and value == true
end

-- Sound ------------------------------------------------------------------------------------------
local clips = {
	click = "rbxasset://sounds/volume_slider.ogg",
	land = "rbxasset://sounds/action_jump_land.mp3",
}
local function play(source: string, speed: number, volume: number, delay: number?)
	task.delay(delay or 0, function()
		local sound = Instance.new("Sound")
		sound.SoundId = source
		sound.PlaybackSpeed = speed
		sound.Volume = volume
		sound.Parent = SoundService
		sound:Play()
		Debris:AddItem(sound, 2)
	end)
end
local function asset(key: string): string?
	local id = tonumber(ids[key])
	return if id and id > 0 then "rbxassetid://" .. math.floor(id) else nil
end
local function stampSound()
	local own = asset("stamp")
	if own then
		play(own, 1, 0.8)
	else
		play(clips.land, 0.62, 0.9)
		play(clips.click, 0.55, 0.55, 0.02)
	end
end
local function chimeSound()
	local own = asset("chime")
	if own then
		play(own, 1, 0.75)
	else
		for i, speed in { 1.18, 1.41, 1.77 } do
			play(clips.click, speed, 0.5 + i * 0.08, (i - 1) * 0.1)
		end
		play(clips.click, 2.36, 0.32, 0.34)
	end
end

-- Counter effects ----------------------------------------------------------------------------------
local function distanceTo(position: Vector3): number
	local camera = workspace.CurrentCamera
	local origin = if camera then camera.CFrame.Position else position
	return (origin - position).Magnitude
end
local function burst(position: Vector3, colour: Color3, big: boolean)
	if distanceTo(position) > 130 then
		return
	end
	local mount = Instance.new("Attachment")
	mount.Name = "TownFeedbackBurst"
	mount.WorldPosition = position + Vector3.new(0, 2.6, 0)
	mount.Parent = workspace.Terrain
	local sparkle = Instance.new("ParticleEmitter")
	sparkle.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	sparkle.Color = ColorSequence.new({
		ColorSequenceKeypoint.new(0, palette.bulb),
		ColorSequenceKeypoint.new(0.5, colour),
		ColorSequenceKeypoint.new(1, palette.cream),
	})
	sparkle.LightEmission = 0.8
	sparkle.Size = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0.55),
		NumberSequenceKeypoint.new(1, 0.1),
	})
	sparkle.Transparency = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0),
		NumberSequenceKeypoint.new(0.75, 0.2),
		NumberSequenceKeypoint.new(1, 1),
	})
	sparkle.Lifetime = NumberRange.new(0.8, 1.5)
	sparkle.Speed = NumberRange.new(8, 15)
	sparkle.SpreadAngle = Vector2.new(70, 70)
	sparkle.EmissionDirection = Enum.NormalId.Top
	sparkle.Acceleration = Vector3.new(0, -18, 0)
	sparkle.Drag = 1.6
	sparkle.Rotation = NumberRange.new(0, 360)
	sparkle.RotSpeed = NumberRange.new(-260, 260)
	sparkle.Rate = 0
	sparkle.Parent = mount
	-- Confetti: the same built-in sparkle squashed into tumbling flecks of the show palette.
	local confetti = sparkle:Clone()
	confetti.Color = ColorSequence.new({
		ColorSequenceKeypoint.new(0, palette.petal),
		ColorSequenceKeypoint.new(0.33, palette.cobalt),
		ColorSequenceKeypoint.new(0.66, palette.champagne),
		ColorSequenceKeypoint.new(1, colour),
	})
	confetti.LightEmission = 0.25
	confetti.Squash = NumberSequence.new({
		NumberSequenceKeypoint.new(0, -0.6),
		NumberSequenceKeypoint.new(0.5, 0.6),
		NumberSequenceKeypoint.new(1, -0.6),
	})
	confetti.Lifetime = NumberRange.new(1.4, 2.2)
	confetti.Parent = mount
	local flash = Instance.new("PointLight")
	flash.Color = palette.bulb
	flash.Brightness = if big then 3 else 1.6
	flash.Range = if big then 16 else 9
	flash.Shadows = false
	flash.Parent = mount
	sparkle:Emit(if big then 38 else 16)
	confetti:Emit(if big then 46 else 0)
	TweenService:Create(flash, TweenInfo.new(0.6, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		Brightness = 0,
	}):Play()
	Debris:AddItem(mount, 2.6)
end

-- Reward card --------------------------------------------------------------------------------------
local gui = Instance.new("ScreenGui")
gui.Name = "TownFeedback"
gui.ResetOnSpawn = false
gui.DisplayOrder = 30
gui.IgnoreGuiInset = false
gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
gui.Parent = player:WaitForChild("PlayerGui")

local function make(class: string, props: { [string]: any }, parent: Instance?): any
	local item = Instance.new(class)
	for key, value in props do
		(item :: any)[key] = value
	end
	item.Parent = parent
	return item
end

local card = make("Frame", {
	Name = "RewardCard",
	AnchorPoint = Vector2.new(0.5, 0),
	Position = UDim2.new(0.5, 0, 0, 64),
	Size = UDim2.new(0.86, 0, 0, 108),
	BackgroundColor3 = palette.midnight,
	BackgroundTransparency = 0.06,
	Visible = false,
}, gui)
make("UISizeConstraint", { MaxSize = Vector2.new(440, 108) }, card)
make("UICorner", { CornerRadius = UDim.new(0, 16) }, card)
local edge = make("UIStroke", { Color = palette.champagne, Thickness = 2, Transparency = 0 }, card)
local scale = make("UIScale", { Scale = 1 }, card)
local stripe = make("Frame", {
	Name = "Accent",
	Position = UDim2.fromOffset(10, 12),
	Size = UDim2.new(0, 6, 1, -24),
	BackgroundColor3 = palette.bulb,
	BorderSizePixel = 0,
}, card)
make("UICorner", { CornerRadius = UDim.new(1, 0) }, stripe)
local kicker = make("TextLabel", {
	Name = "Kicker",
	Position = UDim2.fromOffset(28, 10),
	Size = UDim2.new(1, -128, 0, 38),
	BackgroundTransparency = 1,
	FontFace = heavy,
	TextColor3 = palette.cream,
	TextScaled = true,
	TextXAlignment = Enum.TextXAlignment.Left,
	Text = "",
}, card)
make("UIGradient", {
	Color = ColorSequence.new(palette.cream, palette.bulb),
	Rotation = 90,
}, kicker)
local body = make("TextLabel", {
	Name = "Body",
	Position = UDim2.fromOffset(28, 50),
	Size = UDim2.new(1, -128, 0, 22),
	BackgroundTransparency = 1,
	FontFace = bold,
	TextColor3 = palette.cream,
	TextScaled = true,
	TextWrapped = true,
	TextXAlignment = Enum.TextXAlignment.Left,
	Text = "",
}, card)
local reward = make("TextLabel", {
	Name = "Reward",
	Position = UDim2.fromOffset(28, 76),
	Size = UDim2.fromOffset(150, 22),
	BackgroundColor3 = palette.bulb,
	BackgroundTransparency = 0,
	FontFace = heavy,
	TextColor3 = palette.midnight,
	TextScaled = true,
	Text = "",
}, card)
make("UICorner", { CornerRadius = UDim.new(1, 0) }, reward)
make("UIPadding", { PaddingLeft = UDim.new(0, 8), PaddingRight = UDim.new(0, 8) }, reward)
-- The rubber stamp: a tilted inked ring that slams onto the card.
local stamp = make("Frame", {
	Name = "Stamp",
	AnchorPoint = Vector2.new(0.5, 0.5),
	Position = UDim2.new(1, -54, 0.5, 0),
	Size = UDim2.fromOffset(84, 84),
	BackgroundColor3 = palette.lacquer,
	BackgroundTransparency = 0.82,
	Rotation = -14,
}, card)
make("UICorner", { CornerRadius = UDim.new(1, 0) }, stamp)
local stampEdge = make("UIStroke", { Color = palette.petal, Thickness = 3 }, stamp)
local stampScale = make("UIScale", { Scale = 1 }, stamp)
local stampText = make("TextLabel", {
	AnchorPoint = Vector2.new(0.5, 0.5),
	Position = UDim2.fromScale(0.5, 0.5),
	Size = UDim2.fromScale(0.82, 0.36),
	BackgroundTransparency = 1,
	FontFace = heavy,
	TextColor3 = palette.petal,
	TextScaled = true,
	Text = "",
}, stamp)

local theme: any = nil
do
	local module = script.Parent:FindFirstChild("UITheme")
	if module and module:IsA("ModuleScript") then
		local ok, loaded = pcall(require, module)
		if ok and type(loaded) == "table" and type(loaded.toast) == "function" then
			theme = loaded
		end
	end
end

local showing = 0
local function present(
	title: string,
	line: string,
	rewardXp: number,
	track: string,
	word: string,
	accent: Color3,
	slam: boolean
)
	local rewardWhat = track .. " XP"
	local prize = if rewardXp > 0 then string.format("+%d %s", rewardXp, rewardWhat) else ""
	if theme then
		-- ui-core's shared toast stack owns the top-centre zone, so use it rather than overlap it.
		local ok = pcall(theme.toast, title .. " · " .. line, {
			kind = if prize ~= "" then "reward" elseif slam then "success" else "info",
			icon = if prize ~= "" then "award" else "star",
			duration = 3.5,
			key = "town-errand",
		})
		if ok then
			if prize ~= "" and type(theme.reward) == "function" then
				pcall(theme.reward, rewardXp, rewardWhat, "star")
			end
			return
		end
	end
	showing += 1
	local token = showing
	kicker.Text = title
	body.Text = line
	reward.Text = prize
	reward.Visible = prize ~= ""
	stampText.Text = word
	stampEdge.Color = accent
	stampText.TextColor3 = accent
	stripe.BackgroundColor3 = accent
	edge.Color = palette.champagne
	card.Visible = true
	card.BackgroundTransparency = 0.06
	local still = reduced()
	if still then
		scale.Scale = 1
		stampScale.Scale = 1
	else
		scale.Scale = 0.7
		TweenService:Create(scale, TweenInfo.new(0.32, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
			Scale = 1,
		}):Play()
		stampScale.Scale = if slam then 2.2 else 1
		if slam then
			TweenService:Create(
				stampScale,
				TweenInfo.new(0.18, Enum.EasingStyle.Quad, Enum.EasingDirection.In, 0, false, 0.12),
				{ Scale = 1 }
			):Play()
		end
	end
	-- A brief bulb-gold border glow, then back to champagne.
	edge.Color = palette.bulb
	TweenService:Create(edge, TweenInfo.new(0.9), { Color = palette.champagne }):Play()
	task.delay(3, function()
		if token ~= showing then
			return
		end
		local fade = TweenInfo.new(0.35)
		TweenService:Create(card, fade, { BackgroundTransparency = 1 }):Play()
		if not still then
			TweenService:Create(scale, fade, { Scale = 0.92 }):Play()
		end
		task.delay(0.36, function()
			if token == showing then
				card.Visible = false
			end
		end)
	end)
end

local kinds = { pickup = true, delivered = true, errand = true }
local function clean(value: any, limit: number): string
	return if type(value) == "string" and #value <= limit then value else ""
end
remote.OnClientEvent:Connect(function(payload: any)
	if type(payload) ~= "table" or not kinds[payload.kind] or type(payload.carrier) ~= "number" then
		return
	end
	local kind = payload.kind
	local title = clean(payload.title, 60)
	local shop = clean(payload.shop, 20)
	local track = if payload.track == "stage" then "stage" else "crowd"
	local xp = if type(payload.xp) == "number" then math.clamp(math.floor(payload.xp), 0, 99) else 0
	local at = if typeof(payload.at) == "Vector3" then payload.at :: Vector3 else nil
	local accent = shopColours[shop] or palette.bulb
	local mine = payload.carrier == player.UserId
	if at then
		burst(at, accent, kind ~= "pickup" and mine)
	end
	if not mine then
		return
	end
	if kind == "pickup" then
		stampSound()
		local parcel = clean(payload.parcel, 80)
		present(
			"PARCEL FOR " .. string.upper(title),
			if parcel ~= "" then parcel else "Walk it to the marked counter.",
			0,
			track,
			"POST",
			accent,
			true
		)
	elseif kind == "delivered" then
		stampSound()
		chimeSound()
		present("DELIVERED!", "Signed for at " .. title .. ".", xp, track, "SIGNED", accent, true)
	else
		chimeSound()
		present("NICE WORK!", title, xp, track, "DONE", accent, false)
	end
end)
