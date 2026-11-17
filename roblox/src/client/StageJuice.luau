--!strict
-- Reveal and crowd juice for the live show: the ticking house score, band stingers, proscenium
-- confetti, roses and tomatoes thrown from the seats, and reaction emoji rising over the audience.
-- Everything is pooled and driven from ShowFX's single render loop through step().
local Tween = game:GetService("TweenService")

local StageJuice = {}

local champagne = Color3.fromRGB(221, 180, 129)
local bulb = Color3.fromRGB(255, 220, 158)
local cream = Color3.fromRGB(255, 240, 207)
local petal = Color3.fromRGB(213, 140, 165)
local cobalt = Color3.fromRGB(65, 91, 168)
local electric = Color3.fromRGB(112, 136, 255)
local gold = Color3.fromRGB(255, 205, 110)

local TICK_DELAY = 0.3
local TICK_TIME = 1.35
local THROW_TIME = 0.75
local FLOAT_TIME = 1.7
local SPARKLES = "rbxasset://textures/particles/sparkles_main.dds"

local emoji: { [string]: string } = { Rose = "🌹", Tomato = "🍅", Laugh = "😂", Gasp = "😮" }

export type Palette = { Color3 }
export type Juice = {
	step: (now: number) -> (),
	reveal: (overall: number, band: string, reduced: boolean, onLand: () -> ()) -> (),
	hideScore: () -> (),
	confetti: (palette: Palette?, reduced: boolean) -> (),
	glint: (at: Vector3, color: Color3) -> (),
	react: (kind: string, target: Vector3, golden: boolean, reduced: boolean) -> (),
	clearProps: () -> (),
	stinger: (bucket: string) -> (),
	landed: () -> boolean,
}

StageJuice.palettes = {
	show = { champagne, petal, cobalt } :: Palette,
	blue = { electric, cobalt, Color3.fromRGB(170, 190, 255) } :: Palette,
	gold = { gold, champagne, bulb } :: Palette,
}

local function anchor(parent: Instance, name: string, size: Vector3, cf: CFrame): Part
	local p = Instance.new("Part")
	p.Name = name
	p.Anchored = true
	p.CanCollide = false
	p.CanTouch = false
	p.CanQuery = false
	p.CastShadow = false
	p.Transparency = 1
	p.Size = size
	p.CFrame = cf
	p.Parent = parent
	return p
end

local function flutter(): NumberSequence
	-- Oscillating squash flips each flake edge-on and back, like paper confetti tumbling.
	local keys = {}
	for i = 0, 10 do
		table.insert(keys, NumberSequenceKeypoint.new(i / 10, if i % 2 == 0 then -0.7 else 0.7))
	end
	return NumberSequence.new(keys)
end

local function emitter(parent: Instance, color: Color3, cannon: boolean): ParticleEmitter
	local e = Instance.new("ParticleEmitter")
	e.Name = "Confetti"
	e.Texture = SPARKLES
	e.Rate = 0
	e.Enabled = false
	e.Color = ColorSequence.new(color)
	e.LightEmission = 0.35
	e.LightInfluence = 0.3
	e.Size = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0.32),
		NumberSequenceKeypoint.new(1, 0.24),
	})
	e.Squash = flutter()
	e.Transparency = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0),
		NumberSequenceKeypoint.new(0.8, 0),
		NumberSequenceKeypoint.new(1, 1),
	})
	e.Rotation = NumberRange.new(0, 360)
	e.RotSpeed = NumberRange.new(-260, 260)
	if cannon then
		e.EmissionDirection = Enum.NormalId.Front
		e.Speed = NumberRange.new(20, 30)
		e.SpreadAngle = Vector2.new(16, 16)
		e.Acceleration = Vector3.new(0, -14, 0)
		e.Drag = 1.3
		e.Lifetime = NumberRange.new(2.6, 3.4)
	else
		e.EmissionDirection = Enum.NormalId.Bottom
		e.Speed = NumberRange.new(2, 7)
		e.SpreadAngle = Vector2.new(40, 40)
		e.Acceleration = Vector3.new(0, -6, 0)
		e.Drag = 0.8
		e.Lifetime = NumberRange.new(3.2, 4.2)
	end
	e.Parent = parent
	return e
end

local function emojiBoard(parent: Instance, name: string, studs: number, onTop: boolean)
	local board = Instance.new("BillboardGui")
	board.Name = name
	board.Size = UDim2.fromScale(studs, studs)
	board.LightInfluence = 0
	board.AlwaysOnTop = onTop
	board.MaxDistance = 120
	board.Enabled = false
	board.Parent = parent
	local halo = Instance.new("Frame")
	halo.Name = "Halo"
	halo.AnchorPoint = Vector2.new(0.5, 0.5)
	halo.Position = UDim2.fromScale(0.5, 0.5)
	halo.Size = UDim2.fromScale(0.95, 0.95)
	halo.BackgroundColor3 = gold
	halo.BackgroundTransparency = 1
	halo.Parent = board
	local round = Instance.new("UICorner")
	round.CornerRadius = UDim.new(0.5, 0)
	round.Parent = halo
	local label = Instance.new("TextLabel")
	label.Name = "Emoji"
	label.BackgroundTransparency = 1
	label.AnchorPoint = Vector2.new(0.5, 0.5)
	label.Position = UDim2.fromScale(0.5, 0.5)
	label.Size = UDim2.fromScale(1, 1)
	label.Font = Enum.Font.GothamBold
	label.TextScaled = true
	label.Text = ""
	label.Parent = board
	local scale = Instance.new("UIScale")
	scale.Parent = label
	return board, label, halo, scale
end

type Prop = {
	part: Part,
	board: BillboardGui,
	label: TextLabel,
	halo: Frame,
	scale: UIScale,
	mode: string, -- "idle" | "throw" | "rest" | "splat" | "float"
	kind: string,
	at: number,
	from: Vector3,
	to: Vector3,
	golden: boolean,
	sway: number,
}

function StageJuice.new(
	playerGui: Instance,
	folder: Instance,
	Instruments: any,
	audible: () -> boolean
): Juice
	-- House score plate ---------------------------------------------------------------------------
	local plate =
		anchor(folder, "HouseScorePlate", Vector3.new(12.9, 1.36, 0.05), CFrame.new(0, 5.68, -19.11))
	local board = Instance.new("SurfaceGui")
	board.Name = "HouseScore"
	board.Face = Enum.NormalId.Back
	board.LightInfluence = 0
	board.Brightness = 1.4
	board.CanvasSize = Vector2.new(1200, 126)
	board.Adornee = plate
	board.ResetOnSpawn = false
	board.Enabled = false
	board.Parent = playerGui
	local function text(name: string, font: Enum.Font, color: Color3): TextLabel
		local t = Instance.new("TextLabel")
		t.Name = name
		t.BackgroundTransparency = 1
		t.Font = font
		t.TextColor3 = color
		t.TextScaled = true
		t.Text = ""
		t.Parent = board
		return t
	end
	local title = text("Title", Enum.Font.GothamBold, champagne)
	title.Text = "HOUSE SCORE"
	title.AnchorPoint = Vector2.new(0, 0.5)
	title.Position = UDim2.fromScale(0.02, 0.5)
	title.Size = UDim2.fromScale(0.3, 0.52)
	title.TextXAlignment = Enum.TextXAlignment.Left
	local number = text("Score", Enum.Font.GothamBlack, bulb)
	number.AnchorPoint = Vector2.new(0.5, 0.5)
	number.Position = UDim2.fromScale(0.5, 0.5)
	number.Size = UDim2.fromScale(0.2, 1)
	local punch = Instance.new("UIScale")
	punch.Name = "Punch"
	punch.Parent = number
	local tail = text("Band", Enum.Font.GothamBold, cream)
	tail.AnchorPoint = Vector2.new(1, 0.5)
	tail.Position = UDim2.fromScale(0.98, 0.5)
	tail.Size = UDim2.fromScale(0.36, 0.5)
	tail.TextXAlignment = Enum.TextXAlignment.Right
	local underline = Instance.new("Frame")
	underline.Name = "Glow"
	underline.BorderSizePixel = 0
	underline.BackgroundColor3 = gold
	underline.AnchorPoint = Vector2.new(0.5, 1)
	underline.Position = UDim2.fromScale(0.5, 1)
	underline.Size = UDim2.fromScale(0, 0.06)
	underline.Parent = board

	local revealAt = -100
	local target = 0
	local shown = -1
	local tickMark = 0
	local landedAt: number? = nil
	local onLand: (() -> ())? = nil
	local bandName = ""

	local function land(now: number, reduced: boolean)
		landedAt = now
		number.Text = tostring(target)
		tail.Text = string.upper(bandName)
		tail.TextTransparency = 0
		if reduced then
			punch.Scale = 1
			underline.Size = UDim2.fromScale(0.24, 0.06)
		else
			punch.Scale = 1.45
			Tween:Create(
				punch,
				TweenInfo.new(0.42, Enum.EasingStyle.Back, Enum.EasingDirection.Out),
				{ Scale = 1 }
			):Play()
			underline.Size = UDim2.fromScale(0, 0.06)
			Tween:Create(underline, TweenInfo.new(0.35, Enum.EasingStyle.Quad), {
				Size = UDim2.fromScale(0.24, 0.06),
			}):Play()
			tail.TextTransparency = 1
			Tween:Create(tail, TweenInfo.new(0.25), { TextTransparency = 0 }):Play()
		end
		local callback = onLand
		onLand = nil
		if callback then
			task.spawn(callback)
		end
	end
	local reducedReveal = false

	-- Confetti ---------------------------------------------------------------------------------------
	local rain = anchor(folder, "ConfettiRain", Vector3.new(30, 0.4, 1.4), CFrame.new(0, 18.8, -15.6))
	local leftCannon = anchor(
		folder,
		"ConfettiCannonLeft",
		Vector3.new(1, 1, 1),
		CFrame.lookAt(Vector3.new(-18.5, 5.2, -15.4), Vector3.new(-6, 17, -9))
	)
	local rightCannon = anchor(
		folder,
		"ConfettiCannonRight",
		Vector3.new(1, 1, 1),
		CFrame.lookAt(Vector3.new(18.5, 5.2, -15.4), Vector3.new(6, 17, -9))
	)
	local rains, cannons = {}, {}
	for i = 1, 3 do
		rains[i] = emitter(rain, champagne, false)
		cannons[i] = emitter(leftCannon, champagne, true)
		cannons[i + 3] = emitter(rightCannon, champagne, true)
	end
	local glintHost = anchor(folder, "EntranceGlint", Vector3.new(2, 0.4, 2), CFrame.new(5, 9.5, -9.3))
	local glinter = Instance.new("ParticleEmitter")
	glinter.Name = "Glint"
	glinter.Texture = SPARKLES
	glinter.Rate = 0
	glinter.Enabled = false
	glinter.Lifetime = NumberRange.new(0.9, 1.5)
	glinter.Speed = NumberRange.new(2, 5)
	glinter.SpreadAngle = Vector2.new(180, 180)
	glinter.Acceleration = Vector3.new(0, -3, 0)
	glinter.Drag = 1.5
	glinter.LightEmission = 1
	glinter.LightInfluence = 0
	glinter.Size = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0.55),
		NumberSequenceKeypoint.new(1, 0),
	})
	glinter.Rotation = NumberRange.new(0, 360)
	glinter.RotSpeed = NumberRange.new(-120, 120)
	glinter.Parent = glintHost

	-- Reaction props ---------------------------------------------------------------------------------
	local props: { Prop } = {}
	local function makeProp(index: number, onTop: boolean, studs: number): Prop
		local part = anchor(folder, "ReactionProp" .. index, Vector3.one * 0.3, CFrame.new(0, -50, 0))
		local b, label, halo, scale = emojiBoard(part, "Emoji", studs, onTop)
		return {
			part = part,
			board = b,
			label = label,
			halo = halo,
			scale = scale,
			mode = "idle",
			kind = "",
			at = 0,
			from = Vector3.zero,
			to = Vector3.zero,
			golden = false,
			sway = 0,
		}
	end
	for i = 1, 12 do
		table.insert(props, makeProp(i, false, 1.5))
	end
	local floats: { Prop } = {}
	for i = 1, 8 do
		table.insert(floats, makeProp(100 + i, true, 2.3))
	end

	local function free(list: { Prop }, preferIdleOnly: boolean): Prop?
		local oldest: Prop? = nil
		for _, p in list do
			if p.mode == "idle" then
				return p
			end
			if not preferIdleOnly and p.mode == "rest" and (oldest == nil or p.at < oldest.at) then
				oldest = p
			end
		end
		return oldest
	end
	local function park(p: Prop)
		p.mode = "idle"
		p.board.Enabled = false
		p.part.CFrame = CFrame.new(0, -50, 0)
	end
	local function dress(p: Prop, kind: string, golden: boolean)
		p.kind = kind
		p.golden = golden
		p.label.Text = emoji[kind] or "✨"
		p.label.TextTransparency = 0
		p.halo.BackgroundTransparency = if golden then 0.35 else 1
		p.scale.Scale = 1
		p.board.Enabled = true
	end
	local function seat(): Vector3
		local row = if math.random() < 0.5 then 4 else 10
		return Vector3.new(
			math.random(-100, 100) / 10,
			4.4 + (if row == 10 then 1.2 else 0),
			row + math.random(-8, 8) / 10
		)
	end

	local function float(kind: string, golden: boolean, reduced: boolean)
		local p = free(floats, true)
		if not p then
			return
		end
		dress(p, kind, golden)
		p.mode = "float"
		p.at = os.clock()
		p.from = seat() + Vector3.new(0, 0.8, 0)
		p.to = p.from + Vector3.new(0, if reduced then 1.2 else 3.6, 0)
		p.sway = math.random() * math.pi * 2
		p.part.CFrame = CFrame.new(p.from)
	end

	local function react(kind: string, stage: Vector3, golden: boolean, reduced: boolean)
		float(kind, golden, reduced)
		if kind ~= "Rose" and kind ~= "Tomato" then
			return
		end
		local p = free(props, false)
		if not p then
			return
		end
		dress(p, kind, golden)
		p.mode = if reduced then "rest" else "throw"
		p.at = os.clock()
		p.from = seat()
		local spread = Vector3.new(math.random(-16, 16) / 10, 0, 1.3 + math.random(0, 12) / 10)
		p.to = Vector3.new(stage.X, 2.35, stage.Z) + spread
		p.part.CFrame = CFrame.new(if reduced then p.to else p.from)
		if reduced and kind == "Tomato" then
			p.mode = "splat"
		end
	end

	local function clearProps()
		for _, p in props do
			park(p)
		end
		for _, p in floats do
			park(p)
		end
	end

	local function step(now: number)
		-- Score counter.
		if board.Enabled and landedAt == nil and revealAt > 0 then
			local u = math.clamp((now - revealAt - TICK_DELAY) / TICK_TIME, 0, 1)
			if reducedReveal then
				u = 1
			end
			local eased = 1 - (1 - u) ^ 3
			local value = math.floor(target * eased + 0.5)
			if value ~= shown then
				shown = value
				number.Text = tostring(value)
				if value >= tickMark + 6 and audible() then
					tickMark = value
					Instruments.play("scoreTick", 0.32, 0.9 + 0.7 * u)
				end
			end
			if u >= 1 then
				land(now, reducedReveal)
			end
		end
		-- Thrown props and rising emoji.
		for _, p in props do
			if p.mode == "throw" then
				local t = math.clamp((now - p.at) / THROW_TIME, 0, 1)
				local pos = p.from:Lerp(p.to, t) + Vector3.new(0, math.sin(math.pi * t) * 4.5, 0)
				p.part.CFrame = CFrame.new(pos)
				p.scale.Scale = 0.8 + 0.25 * math.sin(math.pi * t)
				if t >= 1 then
					p.at = now
					if p.kind == "Tomato" then
						p.mode = "splat"
					else
						p.mode = "rest"
						p.scale.Scale = 0.75
					end
				end
			elseif p.mode == "splat" then
				local t = math.clamp((now - p.at) / 0.45, 0, 1)
				p.scale.Scale = 0.8 + 0.9 * t
				p.label.TextTransparency = t
				if t >= 1 then
					park(p)
				end
			end
		end
		for _, p in floats do
			if p.mode == "float" then
				local t = math.clamp((now - p.at) / FLOAT_TIME, 0, 1)
				local rise = 1 - (1 - t) ^ 2
				local pos = p.from:Lerp(p.to, rise) + Vector3.new(math.sin(p.sway + t * 5) * 0.35, 0, 0)
				p.part.CFrame = CFrame.new(pos)
				p.scale.Scale = if t < 0.18
					then 0.4 + 0.8 * (t / 0.18)
					elseif t < 0.3 then 1.2 - (t - 0.18) / 0.12 * 0.2
					else 1
				local fade = math.clamp((t - 0.72) / 0.28, 0, 1)
				p.label.TextTransparency = fade
				p.halo.BackgroundTransparency = if p.golden then 0.35 + 0.65 * fade else 1
				if t >= 1 then
					park(p)
				end
			end
		end
	end

	return {
		step = step,
		reveal = function(overall: number, band: string, reduced: boolean, callback: () -> ())
			revealAt = os.clock()
			target = math.clamp(math.floor(overall + 0.5), 0, 100)
			shown = -1
			tickMark = 0
			landedAt = nil
			onLand = callback
			bandName = band
			reducedReveal = reduced
			number.Text = "0"
			punch.Scale = 1
			tail.Text = "/ 100"
			tail.TextTransparency = 0
			underline.Size = UDim2.fromScale(0, 0.06)
			board.Enabled = true
		end,
		hideScore = function()
			board.Enabled = false
			revealAt = -100
			onLand = nil
		end,
		confetti = function(palette: Palette?, reduced: boolean)
			local colors = palette or StageJuice.palettes.show
			for i = 1, 3 do
				local c = ColorSequence.new(colors[(i - 1) % #colors + 1])
				rains[i].Color = c
				cannons[i].Color = c
				cannons[i + 3].Color = c
				rains[i]:Emit(if reduced then 12 else 26)
				if not reduced then
					cannons[i]:Emit(12)
					cannons[i + 3]:Emit(12)
				end
			end
			if not reduced then
				task.delay(0.35, function()
					for i = 1, 3 do
						rains[i]:Emit(14)
					end
				end)
			end
			if audible() then
				Instruments.play("confetti", 0.5)
			end
		end,
		glint = function(at: Vector3, color: Color3)
			glintHost.CFrame = CFrame.new(at)
			glinter.Color = ColorSequence.new(Color3.fromRGB(255, 250, 230), color)
			glinter:Emit(30)
		end,
		react = react,
		clearProps = clearProps,
		stinger = function(bucket: string)
			if not audible() then
				return
			end
			local key = if bucket == "top"
				then "stingTop"
				elseif bucket == "high" then "stingHigh"
				elseif bucket == "mid" then "stingMid"
				elseif bucket == "low" then "stingLow"
				else "stingMiss"
			Instruments.play(key, 0.6)
		end,
		landed = function()
			return landedAt ~= nil
		end,
	}
end

return StageJuice
