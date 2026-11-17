--!strict
local SoundService = game:GetService("SoundService")
local Debris = game:GetService("Debris")
local Tween = game:GetService("TweenService")
local ids = require(game:GetService("ReplicatedStorage").Delivery.SoundIds) :: any
local kit: { [string]: string } = {
	C = "volume_slider.ogg",
	S = "action_jump.mp3",
	K = "action_jump_land.mp3",
	T = "action_footsteps_plastic.mp3",
}
-- Each row sets onset seconds, sample, playback speed, gain, and optional gate time.
local scores: { [string]: { { any } } } = {
	Bell = { { 0, "C", 1.55, 0.58 }, { 0.045, "C", 2.32, 0.17 } },
	Squeak = { { 0, "S", 1.32, 0.67 }, { 0.075, "S", 1.95, 0.34 } },
	Thump = { { 0, "K", 0.73, 0.80 }, { 0.022, "T", 0.70, 0.33, 0.12 } },
	places = { { 0, "C", 0.95, 0.65 }, { 0.11, "C", 1.2, 0.65 }, { 0.24, "C", 1.42, 0.80 } },
	reveal = {
		{ 0, "K", 0.9, 0.4 },
		{ 0, "C", 0.90, 0.70 },
		{ 0.11, "C", 1.14, 0.67 },
		{ 0.22, "C", 1.35, 0.68 },
		{ 0.39, "C", 1.80, 0.84 },
		{ 0.40, "C", 1.35, 0.27 },
	},
	roll = {
		{ 0, "T", 1.1, 0.44, 0.07 },
		{ 0.10, "T", 1.15, 0.52, 0.07 },
		{ 0.20, "T", 1.2, 0.60, 0.07 },
		{ 0.28, "T", 1.25, 0.68, 0.06 },
		{ 0.36, "T", 1.3, 0.78, 0.06 },
		{ 0.44, "K", 1.2, 0.51 },
	},
	applause = {
		{ 0, "T", 1.3, 0.52, 0.10 },
		{ 0.065, "K", 1.65, 0.42 },
		{ 0.13, "T", 1.55, 0.67, 0.09 },
		{ 0.20, "K", 1.45, 0.38 },
		{ 0.27, "T", 1.3, 0.42, 0.09 },
	},
	chuckle = { { 0, "S", 1.76, 0.45 }, { 0.11, "S", 1.57, 0.38 }, { 0.24, "S", 1.34, 0.38 } },
	-- Band stingers for the score landing: built-in stand-ins until the owner uploads masters.
	stingTop = {
		{ 0, "K", 0.85, 0.7 },
		{ 0, "C", 1.2, 0.6 },
		{ 0.09, "C", 1.5, 0.62 },
		{ 0.18, "C", 1.8, 0.7 },
		{ 0.30, "C", 2.4, 0.85 },
		{ 0.30, "K", 1.1, 0.5 },
		{ 0.48, "C", 1.8, 0.45 },
		{ 0.58, "C", 2.4, 0.75 },
		{ 0.58, "T", 1.6, 0.5, 0.1 },
	},
	stingHigh = {
		{ 0, "C", 1.2, 0.6 },
		{ 0.12, "C", 1.5, 0.65 },
		{ 0.24, "C", 1.8, 0.8 },
		{ 0.24, "K", 1.0, 0.45 },
	},
	stingMid = { { 0, "C", 1.2, 0.6 }, { 0.16, "C", 1.5, 0.7 }, { 0.16, "T", 1.3, 0.35, 0.08 } },
	stingLow = { { 0, "S", 1.1, 0.5 }, { 0.22, "S", 0.92, 0.5 }, { 0.46, "S", 0.76, 0.55 } },
	stingMiss = {
		{ 0, "S", 1.0, 0.5 },
		{ 0.28, "S", 0.88, 0.5 },
		{ 0.56, "S", 0.76, 0.5 },
		{ 0.86, "S", 0.6, 0.6, 0.7 },
	},
	scoreTick = { { 0, "C", 2.6, 0.22, 0.25 } },
	padPerfect = { { 0, "C", 2.4, 0.42 }, { 0.06, "C", 3.0, 0.34 }, { 0.12, "C", 3.6, 0.22 } },
	confetti = { { 0, "K", 1.45, 0.5 }, { 0.03, "T", 1.9, 0.42, 0.1 }, { 0.09, "T", 2.2, 0.3, 0.1 } },
}
local templates: { [string]: Sound } = {}
for name, file in kit do
	local sound = Instance.new("Sound")
	sound.Name = "Delivery_" .. name
	sound.SoundId = "rbxasset://sounds/" .. file
	templates[name] = sound
end
task.spawn(function()
	local assets = {}
	for _, sound in templates do
		table.insert(assets, sound)
	end
	pcall(function()
		game:GetService("ContentProvider"):PreloadAsync(assets)
	end)
end)
local function sequence(kind: string, volume: number, speed: number?)
	local hits = scores[kind]
	if not hits then
		return
	end
	local rate = speed or 1
	for _, hit in hits do
		task.delay(hit[1], function()
			local sound = templates[hit[2]]:Clone()
			sound.Volume = volume * hit[4]
			sound.PlaybackSpeed = hit[3] * rate
			sound.Parent = SoundService
			sound:Play()
			Debris:AddItem(sound, hit[5] or 1.5)
		end)
	end
end
local function asset(key: string): number
	local value = ids[key]
	return if type(value) == "number" then value else 0
end
local function playAsset(id: number, volume: number, speed: number?)
	local sound = Instance.new("Sound")
	sound.Name = "Delivery_Cue"
	sound.SoundId = "rbxassetid://" .. id
	sound.Volume = volume
	sound.PlaybackSpeed = speed or 1
	sound.Parent = SoundService
	sound:Play()
	Debris:AddItem(sound, 6)
end
local Instruments = {}
function Instruments.strike(pad: string)
	if pad ~= "Bell" and pad ~= "Squeak" and pad ~= "Thump" then
		return
	end
	local id = asset(pad)
	if id > 0 then
		local sound = Instance.new("Sound")
		sound.Name = "Foley_" .. pad
		sound.SoundId = "rbxassetid://" .. id
		sound.Volume = 0.62
		sound.Parent = SoundService
		sound:Play()
		Debris:AddItem(sound, 3)
	else
		sequence(pad, 0.70)
	end
end
function Instruments.sting(kind: string, volume: number)
	sequence(kind, math.clamp(volume, 0, 1))
end
-- Plays the owner's SoundIds entry for `key` when one is set, otherwise the built-in stand-in (if any).
function Instruments.play(key: string, volume: number, speed: number?)
	local id = asset(key)
	if id > 0 then
		playAsset(id, math.clamp(volume, 0, 1), speed)
	else
		sequence(key, math.clamp(volume, 0, 1), speed)
	end
end
-- Plays a raw asset id or a SoundIds key. Returns false when nothing could be played.
function Instruments.cue(value: any, volume: number): boolean
	if type(value) == "number" and value > 0 and value % 1 == 0 then
		playAsset(value, math.clamp(volume, 0, 1))
		return true
	elseif type(value) == "string" then
		if asset(value) > 0 or scores[value] then
			Instruments.play(value, volume)
			return true
		end
	end
	return false
end
function Instruments.has(kind: string): boolean
	return scores[kind] ~= nil
end

-- Stage pad props ------------------------------------------------------------------------------------
-- The three FoleyRack pads squash, glow and ring on every hit, and show an approach ring that closes
-- on the pad exactly when its cue reaches GO. Purely visual: timing and scoring stay on the server.

local cream = Color3.fromRGB(255, 240, 207)
local bulb = Color3.fromRGB(255, 220, 158)
local gold = Color3.fromRGB(255, 205, 110)
local midnight = Color3.fromRGB(27, 29, 58)
local miss = Color3.fromRGB(146, 154, 203)
local padTints: { [string]: Color3 } = {
	Bell = Color3.fromRGB(255, 214, 140),
	Squeak = Color3.fromRGB(255, 150, 200),
	Thump = Color3.fromRGB(140, 160, 255),
}
local LEAD = 2.4 -- seconds of warning before GO
local TARGET = 0.42 -- target ring size as a share of the billboard

type PadProp = {
	name: string,
	part: BasePart,
	rest: CFrame,
	color: Color3,
	mesh: SpecialMesh?,
	restScale: Vector3,
	light: PointLight,
	board: BillboardGui,
	approach: Frame,
	approachStroke: UIStroke,
	target: UIStroke,
	pulse: Frame,
	pulseStroke: UIStroke,
	caption: TextLabel,
	word: TextLabel,
	wordScale: UIScale,
	sparkle: ParticleEmitter,
	tweens: { Tween },
	cued: boolean,
}

export type Rack = {
	show: (visible: boolean) -> (),
	cue: (pad: string?, offset: number, window: number) -> (),
	hit: (pad: string, label: string?, reduced: boolean) -> (),
	reset: () -> (),
}

local function ring(parent: Instance, name: string, scale: number, thickness: number, color: Color3)
	local frame = Instance.new("Frame")
	frame.Name = name
	frame.AnchorPoint = Vector2.new(0.5, 0.5)
	frame.Position = UDim2.fromScale(0.5, 0.5)
	frame.Size = UDim2.fromScale(scale, scale)
	frame.BackgroundTransparency = 1
	frame.Parent = parent
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0.5, 0)
	corner.Parent = frame
	local stroke = Instance.new("UIStroke")
	stroke.Thickness = thickness
	stroke.Color = color
	stroke.Transparency = 1
	stroke.Parent = frame
	return frame, stroke
end

function Instruments.rack(rack: Instance?): Rack?
	if not rack then
		return nil
	end
	local props: { [string]: PadProp } = {}
	for _, obj in rack:GetChildren() do
		local name = obj:IsA("BasePart") and string.match(obj.Name, "^Pad(.+)")
		if name and obj:IsA("BasePart") then
			local tint = padTints[name] or bulb
			local mesh = obj:FindFirstChildWhichIsA("SpecialMesh")
			local light = Instance.new("PointLight")
			light.Name = "PadGlow"
			light.Range = 7
			light.Brightness = 0
			light.Color = tint
			light.Shadows = false
			light.Enabled = false
			light.Parent = obj

			local board = Instance.new("BillboardGui")
			board.Name = "PadCue"
			board.Size = UDim2.fromScale(2.7, 2.7)
			board.StudsOffsetWorldSpace = Vector3.new(0, 1.55, 0)
			board.LightInfluence = 0
			board.MaxDistance = 90
			board.Enabled = false
			board.Parent = obj
			local _, targetStroke = ring(board, "Target", TARGET, 3, cream)
			local approach, approachStroke = ring(board, "Approach", 1, 4, bulb)
			local pulse, pulseStroke = ring(board, "Pulse", TARGET, 5, tint)
			local caption = Instance.new("TextLabel")
			caption.Name = "PadName"
			caption.BackgroundTransparency = 1
			caption.AnchorPoint = Vector2.new(0.5, 0.5)
			caption.Position = UDim2.fromScale(0.5, 0.5)
			caption.Size = UDim2.fromScale(0.36, 0.16)
			caption.Font = Enum.Font.GothamBlack
			caption.TextScaled = true
			caption.Text = string.upper(name)
			caption.TextColor3 = cream
			caption.TextStrokeColor3 = midnight
			caption.TextStrokeTransparency = 0.2
			caption.TextTransparency = 1
			caption.Parent = board
			local word = Instance.new("TextLabel")
			word.Name = "Verdict"
			word.BackgroundTransparency = 1
			word.AnchorPoint = Vector2.new(0.5, 0.5)
			word.Position = UDim2.fromScale(0.5, 0.08)
			word.Size = UDim2.fromScale(1, 0.24)
			word.Font = Enum.Font.FredokaOne
			word.TextScaled = true
			word.Text = ""
			word.TextColor3 = gold
			word.TextStrokeColor3 = midnight
			word.TextStrokeTransparency = 0.1
			word.TextTransparency = 1
			word.Parent = board
			local wordScale = Instance.new("UIScale")
			wordScale.Parent = word

			local sparkle = Instance.new("ParticleEmitter")
			sparkle.Name = "PerfectSparkle"
			sparkle.Texture = "rbxasset://textures/particles/sparkles_main.dds"
			sparkle.Rate = 0
			sparkle.Enabled = false
			sparkle.Lifetime = NumberRange.new(0.45, 0.8)
			sparkle.Speed = NumberRange.new(4, 9)
			sparkle.SpreadAngle = Vector2.new(70, 70)
			sparkle.EmissionDirection = Enum.NormalId.Top
			sparkle.Acceleration = Vector3.new(0, -6, 0)
			sparkle.Drag = 3
			sparkle.LightEmission = 1
			sparkle.LightInfluence = 0
			sparkle.Size = NumberSequence.new({
				NumberSequenceKeypoint.new(0, 0.5),
				NumberSequenceKeypoint.new(1, 0),
			})
			sparkle.Color = ColorSequence.new(Color3.fromRGB(255, 248, 225), gold)
			sparkle.Rotation = NumberRange.new(0, 360)
			sparkle.RotSpeed = NumberRange.new(-200, 200)
			sparkle.Parent = obj

			props[name] = {
				name = name,
				part = obj,
				rest = obj.CFrame,
				color = obj.Color,
				mesh = mesh,
				restScale = if mesh then mesh.Scale else Vector3.one,
				light = light,
				board = board,
				approach = approach,
				approachStroke = approachStroke,
				target = targetStroke,
				pulse = pulse,
				pulseStroke = pulseStroke,
				caption = caption,
				word = word,
				wordScale = wordScale,
				sparkle = sparkle,
				tweens = {},
				cued = false,
			}
		end
	end
	if next(props) == nil then
		return nil
	end

	local visible = false
	local function cancel(prop: PadProp)
		for _, t in prop.tweens do
			t:Cancel()
		end
		table.clear(prop.tweens)
	end
	local function run(prop: PadProp, object: Instance, info: TweenInfo, goal: { [string]: any }): Tween
		local t = Tween:Create(object, info, goal)
		table.insert(prop.tweens, t)
		t:Play()
		return t
	end
	local function settle(prop: PadProp)
		cancel(prop)
		prop.part.CFrame = prop.rest
		prop.part.Color = prop.color
		if prop.mesh then
			prop.mesh.Scale = prop.restScale
		end
		prop.light.Enabled = false
		prop.light.Brightness = 0
		prop.pulseStroke.Transparency = 1
		prop.word.TextTransparency = 1
	end
	local function hideCue(prop: PadProp)
		if prop.cued then
			prop.cued = false
			prop.approachStroke.Transparency = 1
			prop.target.Transparency = 1
			prop.caption.TextTransparency = 1
		end
	end

	local function show(on: boolean)
		if visible == on then
			return
		end
		visible = on
		for _, prop in props do
			prop.board.Enabled = on
			if not on then
				hideCue(prop)
				settle(prop)
			end
		end
	end

	local function cue(pad: string?, offset: number, window: number)
		for name, prop in props do
			if name ~= pad or not visible or offset > LEAD or offset < -window then
				hideCue(prop)
			else
				prop.cued = true
				-- Close from the outer edge onto the target ring as GO arrives, then hold there.
				local u = math.clamp(offset / LEAD, 0, 1)
				local size = TARGET + (1 - TARGET) * u
				prop.approach.Size = UDim2.fromScale(size, size)
				local go = offset <= 0.18
				local late = offset < -0.45
				prop.approachStroke.Color = if late then miss elseif go then gold else cream:Lerp(bulb, 1 - u)
				prop.approachStroke.Thickness = if go and not late then 6 else 4
				prop.approachStroke.Transparency = if late then 0.55 else 0.05 + 0.5 * u
				prop.target.Transparency = if go then 0 else 0.35
				prop.target.Color = if go and not late then gold else cream
				prop.caption.TextTransparency = 0
				prop.caption.Text = if go and not late then "GO!" else string.upper(name)
			end
		end
	end

	local function hit(pad: string, label: string?, reduced: boolean)
		local prop = props[pad]
		if not prop then
			return
		end
		hideCue(prop)
		settle(prop)
		local perfect = label == "Perfect"
		local good = perfect or label == "On cue"
		local tint = padTints[pad] or bulb
		-- Glow.
		prop.part.Color = Color3.fromRGB(255, 246, 222)
		run(prop, prop.part, TweenInfo.new(0.42, Enum.EasingStyle.Quad), { Color = prop.color })
		prop.light.Enabled = true
		prop.light.Brightness = if perfect then 5 elseif good then 3.5 else 1.5
		run(prop, prop.light, TweenInfo.new(0.45, Enum.EasingStyle.Quad), { Brightness = 0 })
		-- Squash and stretch.
		if not reduced then
			if prop.mesh then
				prop.mesh.Scale = prop.restScale * Vector3.new(1.3, 0.55, 1.3)
				run(
					prop,
					prop.mesh,
					TweenInfo.new(0.5, Enum.EasingStyle.Elastic, Enum.EasingDirection.Out, 0, false, 0),
					{ Scale = prop.restScale }
				)
			end
			prop.part.CFrame = prop.rest
				* CFrame.new(0, -0.12, 0)
				* (if good then CFrame.identity else CFrame.Angles(0, 0, 0.16))
			run(prop, prop.part, TweenInfo.new(0.32, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
				CFrame = prop.rest,
			})
		end
		-- Ring pulse.
		prop.pulse.Size = UDim2.fromScale(TARGET, TARGET)
		prop.pulseStroke.Color = if perfect then gold elseif good then tint else miss
		prop.pulseStroke.Transparency = 0
		local grow = if reduced then TARGET + 0.2 else 1.25
		run(
			prop,
			prop.pulse,
			TweenInfo.new(0.4, Enum.EasingStyle.Quad),
			{ Size = UDim2.fromScale(grow, grow) }
		)
		run(prop, prop.pulseStroke, TweenInfo.new(0.4, Enum.EasingStyle.Quad), { Transparency = 1 })
		-- Verdict word.
		if label then
			prop.word.Text = if perfect then "PERFECT!" elseif good then "ON CUE" else "OFF CUE"
			prop.word.TextColor3 = if perfect then gold elseif good then cream else miss
			prop.word.TextTransparency = 0
			prop.wordScale.Scale = if reduced then 1 else 0.55
			run(prop, prop.wordScale, TweenInfo.new(0.28, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
				Scale = 1,
			})
			run(
				prop,
				prop.word,
				TweenInfo.new(0.35, Enum.EasingStyle.Quad, Enum.EasingDirection.In, 0, false, 0.7),
				{
					TextTransparency = 1,
				}
			)
		end
		if perfect then
			if not reduced then
				prop.sparkle:Emit(18)
			end
			Instruments.play("padPerfect", 0.5)
		end
	end

	local function reset()
		for _, prop in props do
			hideCue(prop)
			settle(prop)
		end
	end

	return { show = show, cue = cue, hit = hit, reset = reset }
end
return Instruments
