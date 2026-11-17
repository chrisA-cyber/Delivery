--!strict
local Run = game:GetService("RunService")
local Players = game:GetService("Players")
local Lighting = game:GetService("Lighting")
local Tween = game:GetService("TweenService")
local SoundService = game:GetService("SoundService")
local Debris = game:GetService("Debris")
local Instruments = require(script.Parent.DeliveryInstruments)
local ShowFX = {}
local gold = Color3.fromRGB(255, 217, 135)
local pink = Color3.fromRGB(255, 93, 185)
local blue = Color3.fromRGB(112, 136, 255)
local cameras = {
	campus = { Vector3.new(13.3, 23.3, 100.8), Vector3.new(-1.4, 5.2, 47.5), 54 },
	wide = { Vector3.new(-1.6, 9.3, 31.1), Vector3.new(0, 6.5, -13.8), 49 },
	take = { Vector3.new(11.9, 6.35, 4.9), Vector3.new(4.8, 4.78, -9.5), 42 },
	booth = { Vector3.new(9.0, 8.15, 2.8), Vector3.new(5.0, 4.45, -8.35), 50 },
	house = { Vector3.new(-4.7, 6.95, 3.8), Vector3.new(-10.35, 5.18, -10.1), 42 },
	host = { Vector3.new(-5.35, 6.25, 0.35), Vector3.new(-10.35, 5.48, -10.1), 42 },
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
	local stem = set:FindFirstChild("MicStem", true) :: BasePart
	local stemColor = stem.Color
	local houseLight = set:WaitForChild("ShowRig"):WaitForChild("House"):WaitForChild("House") :: PointLight
	local mouth, eyes, brows = {}, {}, {}
	for _, obj in set:WaitForChild("Flip"):GetChildren() do
		if obj:IsA("BasePart") then
			if obj.Name == "HostMouth" then
				table.insert(mouth, obj)
			elseif obj.Name == "AnimatedPupil" or obj.Name == "EyeGlint" then
				table.insert(eyes, { part = obj, rest = obj.CFrame })
			elseif obj.Name == "AnimatedBrow" then
				table.insert(brows, { part = obj, rest = obj.CFrame })
			end
		end
	end
	local needle = set.Dial:WaitForChild("TuningNeedle") :: BasePart
	local pivot = CFrame.new(0, 8.4, -20.85)
	local restNeedle = pivot:ToObjectSpace(needle.CFrame)
	local dialAngle = 0
	local foleyParts, pads = {}, {}
	for _, obj in set:WaitForChild("FoleyRack"):GetChildren() do
		if obj:IsA("BasePart") then
			obj.LocalTransparencyModifier = 1
			obj.Transparency = 0
			table.insert(foleyParts, obj)
			local name = string.match(obj.Name, "^Pad(.+)")
			if name then
				pads[name] = { part = obj, rest = obj.CFrame, color = obj.Color }
			end
		end
	end
	local boothVisible = false
	local lastPadTurn, lastPadIndex = -1, 0
	local scoreAnchor =
		prop(folder, "HouseScorePlate", Vector3.new(12.9, 1.36, 0.05), Vector3.new(0, 5.68, -19.11), gold)
	scoreAnchor.Transparency = 1
	local scoreBoard = Instance.new("SurfaceGui")
	scoreBoard.Name = "HouseScore"
	scoreBoard.Face = Enum.NormalId.Back
	scoreBoard.LightInfluence = 0
	scoreBoard.CanvasSize = Vector2.new(1024, 125)
	scoreBoard.Adornee = scoreAnchor
	scoreBoard.Enabled = false
	scoreBoard.Parent = gui
	local scoreText = Instance.new("TextLabel")
	scoreText.BackgroundTransparency = 1
	scoreText.Size = UDim2.fromScale(1, 1)
	scoreText.Font = Enum.Font.GothamBold
	scoreText.TextColor3 = gold
	scoreText.TextScaled = true
	scoreText.Parent = scoreBoard
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

	local preferences = game:GetService("GuiService")
	local reduced = preferences.ReducedMotionEnabled
	preferences:GetPropertyChangedSignal("ReducedMotionEnabled"):Connect(function()
		reduced = preferences.ReducedMotionEnabled
	end)
	local freeCamera = true
	local campusLighting: boolean? = nil
	local roamFov = if workspace.CurrentCamera then workspace.CurrentCamera.FieldOfView else 70
	local lastHumanoid: Humanoid? = nil
	local s
	local view = "wide"
	local currentKey = ""
	local reacted = 0
	local meter = 0
	local meterAt = 0
	local started = 0
	local function sound(kind, vol, pitch)
		if freeCamera then
			return
		end
		local asset = ids[kind] or 0
		if asset <= 0 then
			Instruments.sting(kind, vol)
			return
		end
		local effect = Instance.new("Sound")
		effect.SoundId = "rbxassetid://" .. asset
		effect.Volume = vol
		effect.PlaybackSpeed = pitch
		effect.Parent = SoundService
		effect:Play()
		Debris:AddItem(effect, 3)
	end
	local function toss(reaction)
		if reduced or freeCamera then
			return
		end
		local start = Vector3.new(math.random(-9, 9), 3.8, 5)
		local finish = Vector3.new(if s.actor == 0 then -9 else 5, 3.2, -9.2)
		local icon = prop(
			folder,
			"Reaction",
			Vector3.one * 0.45,
			start,
			if reaction == "Rose" and (s.reactionSkin == "rose-gold" or s.reactorCrowd >= 40)
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
		if reduced or freeCamera then
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
					elseif s.actorStage >= 80 then pink
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
	local function update(state, backstage, welcome, exploring, overview)
		s = state
		local accepted = s.actor == Players.LocalPlayer.UserId and s.phase ~= "lineup" and s.phase ~= "lobby"
		local wantsFree = if exploring ~= nil
			then exploring
			else s.venue ~= nil and not s.venue.watching and not accepted and not welcome
		if wantsFree and not freeCamera then
			lastHumanoid = nil
		end
		freeCamera = wantsFree
		local outside = wantsFree or welcome == true
		if campusLighting ~= outside then
			campusLighting = outside
			Lighting.ClockTime = if outside then 17.25 else 20
			Lighting.Brightness = if outside then 2.0 else 2.2
			Lighting.ExposureCompensation = if outside then -0.20 else 0
			Lighting.Ambient = if outside then Color3.fromRGB(99, 91, 111) else Color3.fromRGB(82, 69, 97)
			Lighting.OutdoorAmbient = if outside
				then Color3.fromRGB(125, 129, 144)
				else Color3.fromRGB(66, 59, 89)
			Lighting.EnvironmentDiffuseScale = if outside then 0.60 else 0.5
			Lighting.EnvironmentSpecularScale = if outside then 0.43 else 0.8
		end
		view = if overview
			then "wide"
			elseif welcome then "campus"
			elseif backstage then "daily"
			elseif s.phase == "take" then (if s.foley
				then "booth"
				elseif s.actor == 0 then "house"
				else "take")
			elseif s.phase == "host" then "host"
			elseif s.phase == "reveal" then "reveal"
			elseif
				s.phase == "intermission"
				and s.actor ~= 0
				and s.result
				and (s.result.overall or 0) >= 75
			then "winner"
			else "wide"
		local showBooth = s.foley ~= nil and s.phase ~= "intermission"
		if boothVisible ~= showBooth then
			boothVisible = showBooth
			for _, part in foleyParts do
				part.LocalTransparencyModifier = if showBooth then 0 else 1
			end
		end
		local key = tostring(s.turn) .. "/" .. s.phase
		scoreBoard.Enabled = not welcome
				and not backstage
				and s.phase == "reveal"
				and s.result
				and s.result.overall ~= nil
			or false
		if key ~= currentKey then
			currentKey = key
			started = os.clock()
			meter = 0
			reacted = 0

			if s.phase == "countdown" then
				sound("places", 0.4, 1.2)
				if s.actorSkin == "gold-entrance" or s.actorSkin == "house-entrance" then
					celebrate()
				end
			elseif s.phase == "vote" then
				sound("roll", 0.22, 0.75)
			elseif scoreBoard.Enabled then
				scoreText.Text = string.format("HOUSE SCORE    %d  /  100", s.result.overall)
				sound("reveal", 0.5, 1.45)
				if s.result.overall >= 90 and s.actor ~= 0 then
					celebrate()
				end
			end
		end
		if s.foley and s.phase == "take" and not freeCamera then
			local hit = s.foley.last
			if hit and (s.turn ~= lastPadTurn or hit.index ~= lastPadIndex) then
				lastPadTurn, lastPadIndex = s.turn, hit.index
				Instruments.strike(hit.pad)
				local pad = pads[hit.pad]
				if pad then
					pad.part.Color = Color3.fromRGB(255, 236, 197)
					if not reduced then
						pad.part.CFrame = pad.rest * CFrame.new(0, -0.13, 0)
					end
					Tween:Create(pad.part, TweenInfo.new(0.26), { CFrame = pad.rest, Color = pad.color })
						:Play()
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
		if freeCamera then
			local player = Players.LocalPlayer
			local character = player.Character
			local humanoid = if character then character:FindFirstChildOfClass("Humanoid") else nil
			if humanoid and humanoid ~= lastHumanoid and not player:GetAttribute("DeliveryPortraitPose") then
				lastHumanoid = humanoid
				camera.CameraType = Enum.CameraType.Custom
				camera.CameraSubject = humanoid
				camera.FieldOfView = roamFov
				local root = humanoid.RootPart
				if root then
					local target = root.Position + Vector3.new(0, 1.2, 0)
					camera.CFrame =
						CFrame.lookAt(target - root.CFrame.LookVector * 10 + Vector3.new(0, 4, 0), target)
				end
			end
			return
		end
		local shot = cameras[if reduced and view ~= "daily" and view ~= "campus" then "wide" else view]
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
		houseLight.Brightness = 1.2 + amplitude * 0.5
		local look = if s and (not s.actorSkin or s.actorSkin == "house-entrance") then s.actorLook else nil
		stem.Color = if look == "cherry"
			then Color3.fromRGB(218, 73, 102)
			elseif look == "cobalt" or (s and s.actorStage >= 60) then blue
			else stemColor
		keyLight.Color = if s
				and s.actorSkin == "violet-key"
				and s.phase == "take"
			then Color3.fromRGB(177, 127, 255)
			elseif look == "apricot" then Color3.fromRGB(255, 174, 111)
			elseif s and s.actorStage >= 100 and s.phase == "take" then Color3.fromRGB(177, 127, 255)
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
		local dialValue = if s
				and s.result
				and s.result.overall
			then s.result.overall / 100
			elseif s and s.phase == "take" then 0.35 + amplitude * 0.55
			else 0.46
		local targetAngle = math.rad(74 - 126 * dialValue)
		dialAngle = if reduced then targetAngle else dialAngle + (targetAngle - dialAngle) * 0.26
		needle.CFrame = pivot * CFrame.Angles(0, 0, dialAngle) * restNeedle
		local talking = s
			and (s.phase == "host" or (s.actor == 0 and s.phase == "take"))
			and now - started < 4
		local glance = if reduced then 0 elseif talking then 0.12 * math.sin(now * 2) else 0.1
		local brow = if reduced or not talking then 0 else 0.09 * math.sin(now * 6)
		for _, eye in eyes do
			eye.part.CFrame = eye.rest * CFrame.new(glance, 0, 0)
		end
		for i, b in brows do
			b.part.CFrame = b.rest * CFrame.new(0, brow * (if i % 2 == 0 then 1 else -1), 0)
		end
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
		isReduced = function()
			return reduced
		end,
		toggle = function()
			reduced = not reduced
			return reduced
		end,
	}
end
return ShowFX
