--!strict
-- A velvet curtain wipe that hides every jump between the walking camera and the show camera.
-- wipe(onCovered) closes the curtain (0.35 s), runs onCovered while the screen is hidden, then opens it.
-- Reduced motion swaps the sliding panels for a short plain fade.
local Tween = game:GetService("TweenService")
local SoundService = game:GetService("SoundService")
local Debris = game:GetService("Debris")

local StageCurtain = {}

local CLOSE_TIME = 0.35
local OPEN_TIME = 0.35
local HOLD_TIME = 0.12
local FADE_IN = 0.12
local FADE_OUT = 0.2

local lacquer = Color3.fromRGB(91, 35, 56)
local deep = Color3.fromRGB(46, 13, 29)
local fold = Color3.fromRGB(128, 41, 70)
local champagne = Color3.fromRGB(221, 180, 129)
local bulb = Color3.fromRGB(255, 220, 158)
local copper = Color3.fromRGB(135, 83, 51)
local midnight = Color3.fromRGB(36, 41, 87)

local function velvet(): ColorSequence
	-- Vertical folds: the gradient runs across the panel, so each light/dark pair reads as one pleat.
	local keys = {}
	local pleats = 7
	for i = 0, pleats * 2 do
		local t = i / (pleats * 2)
		table.insert(keys, ColorSequenceKeypoint.new(t, if i % 2 == 0 then deep else fold))
	end
	return ColorSequence.new(keys)
end

local function panel(parent: Instance, name: string, inner: number): Frame
	local p = Instance.new("Frame")
	p.Name = name
	p.BorderSizePixel = 0
	p.BackgroundColor3 = lacquer
	p.Size = UDim2.new(0.5, 26, 1, 0)
	p.AnchorPoint = Vector2.new(if inner == 1 then 1 else 0, 0)
	p.ZIndex = 1
	p.Visible = false
	p.Parent = parent
	local cloth = Instance.new("UIGradient")
	cloth.Color = velvet()
	cloth.Parent = p
	-- Shade toward the floor and under the valance so the cloth has weight.
	local shade = Instance.new("Frame")
	shade.Name = "Shade"
	shade.BorderSizePixel = 0
	shade.BackgroundColor3 = Color3.new(0, 0, 0)
	shade.Size = UDim2.fromScale(1, 1)
	shade.ZIndex = 2
	shade.Parent = p
	local fall = Instance.new("UIGradient")
	fall.Rotation = 90
	fall.Transparency = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0.45),
		NumberSequenceKeypoint.new(0.18, 0.92),
		NumberSequenceKeypoint.new(0.7, 0.88),
		NumberSequenceKeypoint.new(1, 0.5),
	})
	fall.Parent = shade
	-- Gold trim on the leading edge.
	local edge = Instance.new("Frame")
	edge.Name = "GoldEdge"
	edge.BorderSizePixel = 0
	edge.BackgroundColor3 = champagne
	edge.AnchorPoint = Vector2.new(if inner == 1 then 1 else 0, 0)
	edge.Position = UDim2.fromScale(if inner == 1 then 1 else 0, 0)
	edge.Size = UDim2.new(0, 6, 1, 0)
	edge.ZIndex = 3
	edge.Parent = p
	local shine = Instance.new("UIGradient")
	shine.Rotation = 90
	shine.Color = ColorSequence.new({
		ColorSequenceKeypoint.new(0, bulb),
		ColorSequenceKeypoint.new(0.35, champagne),
		ColorSequenceKeypoint.new(0.65, copper),
		ColorSequenceKeypoint.new(1, bulb),
	})
	shine.Parent = edge
	local fringe = Instance.new("Frame")
	fringe.Name = "Fringe"
	fringe.BorderSizePixel = 0
	fringe.BackgroundColor3 = champagne
	fringe.AnchorPoint = Vector2.new(0, 1)
	fringe.Position = UDim2.fromScale(0, 1)
	fringe.Size = UDim2.new(1, 0, 0, 5)
	fringe.ZIndex = 3
	fringe.Parent = p
	return p
end

local function play(ids: { [string]: number }, key: string)
	local asset = ids[key]
	if type(asset) ~= "number" or asset <= 0 then
		return
	end
	local sound = Instance.new("Sound")
	sound.Name = "Curtain_" .. key
	sound.SoundId = "rbxassetid://" .. asset
	sound.Volume = 0.45
	sound.Parent = SoundService
	sound:Play()
	Debris:AddItem(sound, 3)
end

export type Curtain = {
	wipe: (onCovered: () -> (), reduced: boolean) -> (),
	busy: () -> boolean,
	destroy: () -> (),
}

function StageCurtain.new(playerGui: Instance, ids: { [string]: number }): Curtain
	local screen = Instance.new("ScreenGui")
	screen.Name = "StageCurtain"
	screen.ResetOnSpawn = false
	screen.IgnoreGuiInset = true
	screen.ScreenInsets = Enum.ScreenInsets.None
	screen.DisplayOrder = 40
	screen.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	screen.Parent = playerGui

	local left = panel(screen, "CurtainLeft", 1)
	local right = panel(screen, "CurtainRight", 0)
	local leftOpen, leftShut = UDim2.fromScale(0, 0), UDim2.new(0.5, 2, 0, 0)
	local rightOpen, rightShut = UDim2.fromScale(1, 0), UDim2.new(0.5, -2, 0, 0)
	left.Position = leftOpen
	right.Position = rightOpen

	local mark = Instance.new("TextLabel")
	mark.Name = "Wordmark"
	mark.BackgroundTransparency = 1
	mark.AnchorPoint = Vector2.new(0.5, 0.5)
	mark.Position = UDim2.fromScale(0.5, 0.5)
	mark.Size = UDim2.new(0.6, 0, 0, 56)
	mark.Font = Enum.Font.FredokaOne
	mark.Text = "DELIVERY"
	mark.TextScaled = true
	mark.TextColor3 = bulb
	mark.TextTransparency = 1
	mark.ZIndex = 5
	mark.Parent = screen
	local markLimit = Instance.new("UITextSizeConstraint")
	markLimit.MaxTextSize = 48
	markLimit.Parent = mark
	local markStroke = Instance.new("UIStroke")
	markStroke.Color = deep
	markStroke.Thickness = 2
	markStroke.Transparency = 1
	markStroke.Parent = mark

	local fade = Instance.new("Frame")
	fade.Name = "Fade"
	fade.BorderSizePixel = 0
	fade.BackgroundColor3 = midnight
	fade.BackgroundTransparency = 1
	fade.Size = UDim2.fromScale(1, 1)
	fade.ZIndex = 4
	fade.Visible = false
	fade.Parent = screen
	local fadeTint = Instance.new("UIGradient")
	fadeTint.Rotation = 90
	fadeTint.Color = ColorSequence.new(midnight, deep)
	fadeTint.Parent = fade

	-- "open" | "closing" | "closed" | "opening"
	local stage = "open"
	local covered: (() -> ())? = nil
	local soft = false
	local token = 0
	local running: { Tween } = {}

	local function stopAll()
		for _, t in running do
			t:Cancel()
		end
		table.clear(running)
	end
	local function run(object: Instance, info: TweenInfo, goal: { [string]: any }): Tween
		local t = Tween:Create(object, info, goal)
		table.insert(running, t)
		t:Play()
		return t
	end

	local open: () -> ()
	local function reveal()
		local callback = covered
		covered = nil
		if callback then
			local ok, err = pcall(callback)
			if not ok then
				warn("StageCurtain: " .. tostring(err))
			end
		end
	end
	local function shut()
		stage = "closed"
		reveal()
		local mine = token
		task.delay(HOLD_TIME, function()
			if token == mine and stage == "closed" then
				open()
			end
		end)
	end
	open = function()
		stopAll()
		stage = "opening"
		token += 1
		local mine = token
		local last: Tween
		if soft then
			last = run(fade, TweenInfo.new(FADE_OUT, Enum.EasingStyle.Linear), { BackgroundTransparency = 1 })
		else
			local info = TweenInfo.new(OPEN_TIME, Enum.EasingStyle.Quad, Enum.EasingDirection.InOut)
			run(left, info, { Position = leftOpen })
			last = run(right, info, { Position = rightOpen })
			run(mark, TweenInfo.new(0.12), { TextTransparency = 1 })
			run(markStroke, TweenInfo.new(0.12), { Transparency = 1 })
		end
		last.Completed:Connect(function(state)
			if state == Enum.PlaybackState.Completed and token == mine then
				stage = "open"
				left.Visible = false
				right.Visible = false
				fade.Visible = false
			end
		end)
	end
	local function close()
		stopAll()
		stage = "closing"
		token += 1
		local mine = token
		play(ids, "whoosh")
		local last: Tween
		if soft then
			fade.Visible = true
			last = run(fade, TweenInfo.new(FADE_IN, Enum.EasingStyle.Linear), { BackgroundTransparency = 0 })
		else
			left.Visible = true
			right.Visible = true
			-- Scale the remaining distance so a curtain caught mid-open closes at the same speed.
			local remaining = math.clamp(1 - left.Position.X.Scale / 0.5, 0.15, 1)
			local info =
				TweenInfo.new(CLOSE_TIME * remaining, Enum.EasingStyle.Quad, Enum.EasingDirection.InOut)
			run(left, info, { Position = leftShut })
			last = run(right, info, { Position = rightShut })
		end
		last.Completed:Connect(function(state)
			if state == Enum.PlaybackState.Completed and token == mine then
				if not soft then
					run(mark, TweenInfo.new(0.1), { TextTransparency = 0 })
					run(markStroke, TweenInfo.new(0.1), { Transparency = 0.2 })
				end
				shut()
			end
		end)
	end

	local function wipe(onCovered: () -> (), reduced: boolean)
		covered = onCovered
		if stage == "closed" then
			-- Already hidden: apply now and let the pending open run as scheduled.
			reveal()
			return
		elseif stage == "closing" then
			return
		end
		if stage == "open" then
			soft = reduced
			left.Position = leftOpen
			right.Position = rightOpen
			fade.BackgroundTransparency = 1
		end
		close()
	end

	return {
		wipe = wipe,
		busy = function()
			return stage ~= "open"
		end,
		destroy = function()
			stopAll()
			token += 1
			covered = nil
			screen:Destroy()
		end,
	}
end

return StageCurtain
