--!strict
local Run = game:GetService("RunService")
local Tween = game:GetService("TweenService")
local SoundService = game:GetService("SoundService")
local Debris = game:GetService("Debris")
local ShowFX = {}
local gold = Color3.fromRGB(255, 217, 135)
local pink = Color3.fromRGB(255, 93, 185)
local blue = Color3.fromRGB(112, 136, 255)
local cameras = {
	wide = { Vector3.new(-1.1, 9.0, 30), Vector3.new(0, 7.9, -12), 48 },
	take = { Vector3.new(12.5, 6.65, 5.9), Vector3.new(5.0, 5.18, -10), 40 },
	house = { Vector3.new(-4.8, 6.1, 4), Vector3.new(-9.7, 4.4, -10.4), 39 },
	host = { Vector3.new(-5.4, 6.0, 0.5), Vector3.new(-10.3, 4.7, -10.2), 40 },
	reveal = { Vector3.new(-1.5, 8.1, 11.5), Vector3.new(0, 8.8, -18), 50 },
	winner = { Vector3.new(4, 4.9, 1.7), Vector3.new(5.1, 5, -10), 48 },
	daily = { Vector3.new(11.1, 6, -3.7), Vector3.new(14, 5.2, -13.8), 45 },
}
local function prop(parent, name, size, pos, color)
	local part = Instance.new("Part")
	part.Name = name
	part.Size = size
	part.Position = pos
	part.Color = color
	part.Anchored = true
	part.CanCollide = false
	part.CanTouch = false
	part.CanQuery = false
	part.CastShadow = false
	part.Material = Enum.Material.Neon
	part.Parent = parent
	return part
end
function ShowFX.new(gui: ScreenGui, shared)
	local ids = require(shared.SoundIds)
	local set = workspace:WaitForChild("ShowSet")
	local folder = Instance.new("Folder")
	folder.Name = "LocalShowFX"
	folder.Parent = workspace
	local mouth = {}
	for _, obj in set:GetDescendants() do
		if obj.Name == "HostMouth" and obj:IsA("BasePart") then
			table.insert(mouth, obj)
		end
	end
	local bars = {}
	for i = 1, 19 do
		bars[i] = prop(
			folder,
			"Meter",
			Vector3.new(0.17, 0.12, 0.10),
			Vector3.new((i - 10) * 0.34, 6.6, -18.82),
			if i % 3 == 0 then pink else gold
		)
	end
	local ring = Instance.new("Frame")
	ring.Name = "ScoreRing"
	ring.BackgroundTransparency = 1
	ring.AnchorPoint = Vector2.new(0.5, 0.5)
	ring.Position = UDim2.fromScale(0.5, 0.30)
	ring.Size = UDim2.fromOffset(112, 112)
	ring.Visible = false
	ring.Parent = gui
	local round = Instance.new("UICorner")
	round.CornerRadius = UDim.new(1, 0)
	round.Parent = ring
	local edge = Instance.new("UIStroke")
	edge.Thickness = 4
	edge.Color = gold
	edge.Parent = ring
	local digits = Instance.new("TextLabel")
	digits.Size = UDim2.fromScale(1, 1)
	digits.BackgroundTransparency = 1
	digits.Font = Enum.Font.GothamBlack
	digits.TextColor3 = gold
	digits.TextScaled = true
	digits.Parent = ring
	local reduced = false
	local s
	local view = "wide"
	local currentKey = ""
	local reacted = 0
	local meter = 0
	local meterAt = 0
	local started = 0
	local function sound(kind, vol, pitch)
		local asset = ids[kind] or 0
		local effect = Instance.new("Sound")
		effect.SoundId = if asset > 0 then "rbxassetid://" .. asset else "rbxasset://sounds/volume_slider.ogg"
		effect.Volume = vol * (if asset > 0 then 1 else 0.38)
		effect.PlaybackSpeed = pitch
		effect.Parent = SoundService
		effect:Play()
		Debris:AddItem(effect, 3)
	end
	local function toss(reaction)
		if reduced then
			return
		end
		local start = Vector3.new(math.random(-9, 9), 3.8, 5)
		local finish = Vector3.new(if s.actor == 0 then -9 else 5, 3.2, -9.2)
		local icon = prop(
			folder,
			"Reaction",
			Vector3.one * 0.45,
			start,
			if reaction == "Rose" and s.reactionSkin == "rose-gold"
				then gold
				elseif reaction == "Rose" or reaction == "Tomato" then pink
				elseif reaction == "Gasp" then blue
				else gold
		)
		icon.Shape = Enum.PartType.Ball
		local board = Instance.new("BillboardGui")
		board.Size = UDim2.fromOffset(82, 40)
		board.AlwaysOnTop = true
		board.Parent = icon
		local word = Instance.new("TextLabel")
		word.BackgroundTransparency = 1
		word.Size = UDim2.fromScale(1, 1)
		word.Text = ({ Rose = "✿", Tomato = "●", Laugh = "HA!", Gasp = "!" })[reaction] or "!"
		word.TextColor3 = icon.Color
		word.TextStrokeTransparency = 0.3
		word.Font = Enum.Font.GothamBlack
		word.TextScaled = true
		word.Parent = board
		task.spawn(function()
			local t0 = os.clock()
			repeat
				local t = math.min(1, (os.clock() - t0) / 0.72)
				icon.Position = start:Lerp(finish, t) + Vector3.new(0, math.sin(math.pi * t) * 5, 0)
				Run.RenderStepped:Wait()
			until os.clock() - t0 >= 0.72
			icon:Destroy()
		end)
	end
	local function celebrate()
		if reduced then
			return
		end
		for i = 1, 24 do
			local p = prop(
				folder,
				"Confetti",
				Vector3.new(0.19, 0.35, 0.06),
				Vector3.new(5 + math.random(-4, 4), 11 + math.random(), -9),
				if s.actorSkin == "blue-finale"
					then blue
					elseif s.actorSkin == "gold-entrance" and s.phase == "countdown" then gold
					else ({ pink, blue, gold })[i % 3 + 1]
			)
			Tween:Create(p, TweenInfo.new(0.75 + i % 5 * 0.13), {
				Position = p.Position + Vector3.new(math.random(-3, 3), -8, math.random(-2, 2)),
				Orientation = Vector3.new(50 * i, 20 * i, 30 * i),
				Transparency = 1,
			}):Play()
			Debris:AddItem(p, 1.45)
		end
	end
	local function update(state, backstage)
		s = state
		view = if backstage
			then "daily"
			elseif s.phase == "take" then (if s.actor == 0 then "house" else "take")
			elseif s.phase == "host" then "host"
			elseif s.phase == "reveal" then "reveal"
			elseif
				s.phase == "intermission"
				and s.actor ~= 0
				and s.result
				and (s.result.overall or 0) >= 75
			then "winner"
			else "wide"
		local key = tostring(s.turn) .. "/" .. s.phase
		if key ~= currentKey then
			currentKey = key
			started = os.clock()
			meter = 0
			reacted = 0
			ring.Visible = s.phase == "reveal" and s.result and s.result.overall ~= nil
			if s.phase == "countdown" then
				sound("places", 0.4, 1.2)
				if s.actorSkin == "gold-entrance" then
					celebrate()
				end
			elseif s.phase == "vote" then
				sound("roll", 0.22, 0.75)
			elseif ring.Visible then
				digits.Text = tostring(s.result.overall)
				sound("reveal", 0.5, 1.45)
				if not reduced then
					ring.Size = UDim2.fromOffset(152, 152)
					Tween:Create(ring, TweenInfo.new(0.19), { Size = UDim2.fromOffset(110, 110) }):Play()
				end
				if s.result.overall >= 90 and s.actor ~= 0 then
					celebrate()
				end
			end
		end
		if s.phase == "take" and s.reactions > reacted then
			reacted = s.reactions
			toss(s.lastReaction)
			sound(
				if s.lastReaction == "Laugh" then "chuckle" else "applause",
				math.min(0.5, 0.12 + 0.05 * reacted),
				0.9
			)
		end
	end
	local channel = shared:WaitForChild("Meter") :: RemoteEvent
	channel.OnClientEvent:Connect(function(turn, value)
		if s and s.turn == turn and s.phase == "take" then
			meter = value
			meterAt = os.clock()
		end
	end)
	local keyLight = set:WaitForChild("ShowRig"):WaitForChild("Key"):WaitForChild("Key") :: PointLight
	local lastFrame = 0
	Run:BindToRenderStep("DeliveryShowCamera", Enum.RenderPriority.Camera.Value + 1, function(dt)
		local camera = workspace.CurrentCamera
		if not camera then
			return
		end
		local shot = cameras[if reduced and view ~= "daily" then "wide" else view]
		local pos, target = shot[1], shot[2]
		local aspect = camera.ViewportSize.X / math.max(1, camera.ViewportSize.Y)
		if aspect < 1.35 then
			pos = target + (pos - target) * math.min(1.65, 1.35 / aspect)
		end
		camera.CameraType = Enum.CameraType.Scriptable
		local goal = CFrame.lookAt(pos, target)
		camera.CFrame = if reduced or not s then goal else camera.CFrame:Lerp(goal, 1 - math.exp(-dt * 6))
		camera.FieldOfView = shot[3]
		local now = os.clock()
		if now - lastFrame < 0.07 then
			return
		end
		lastFrame = now
		local amplitude = if now - meterAt < 0.65 then meter else 0
		keyLight.Color = if s
				and s.actorSkin == "violet-key"
				and s.phase == "take"
			then Color3.fromRGB(177, 127, 255)
			else Color3.fromRGB(255, 222, 179)
		keyLight.Brightness = 2 + amplitude * 0.6
		for i, bar in bars do
			bar.Color = if s and s.actorSkin == "rose-marquee"
				then pink
				else (if i % 3 == 0 then pink else gold)
			bar.Size = Vector3.new(
				0.17,
				0.10 + amplitude * (0.3 + math.abs(math.sin(i * 1.3 + now * 7)) * 0.85),
				0.10
			)
		end
		local talking = s
			and (s.phase == "host" or (s.actor == 0 and s.phase == "take"))
			and now - started < 4
		for i, p in mouth do
			p.Size = Vector3.new(
				0.23,
				if talking and not reduced then 0.25 + 0.5 * math.abs(math.sin(now * 9 + i)) else 0.44,
				0.19
			)
		end
	end)
	return {
		update = update,
		toggle = function()
			reduced = not reduced
			return reduced
		end,
	}
end
return ShowFX
