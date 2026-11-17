--!strict
local Players = game:GetService("Players")
local Storage = game:GetService("ReplicatedStorage")
local Marquee = require(Storage.Delivery.Marquee)
local Attractions = {}
local brass = Color3.fromRGB(196, 145, 79)
local ink = Color3.fromRGB(34, 29, 48)
local ivory = Color3.fromRGB(255, 235, 190)
local lampColours =
	{ Color3.fromRGB(209, 148, 249), Color3.fromRGB(99, 177, 244), Color3.fromRGB(255, 196, 104) }
local function block(parent, name, pos, size, col, material)
	local p = Instance.new("Part")
	p.Name = name
	p.Anchored = true
	p.Position = pos
	p.Size = size
	p.Color = col
	p.Material = material or Enum.Material.SmoothPlastic
	p.Parent = parent
	return p
end
local function sign(p, message, colour)
	local surface = Instance.new("SurfaceGui")
	surface.Face = Enum.NormalId.Back
	surface.CanvasSize = Vector2.new(660, math.max(96, 660 * p.Size.Y / p.Size.X))
	surface.LightInfluence = 0
	surface.Parent = p
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(0.94, 0.88)
	label.Position = UDim2.fromScale(0.03, 0.06)
	label.BackgroundTransparency = 1
	label.TextScaled = true
	label.TextWrapped = true
	label.Font = Enum.Font.GothamBold
	label.TextColor3 = colour
	label.Text = message
	label.Parent = surface
	return label
end
local function station(parent, name, pos)
	local folder = Instance.new("Model")
	folder.Name = name
	folder.Parent = parent
	local function piece(label, x, y, z, w, h, d, colour, material)
		return block(folder, label, pos + Vector3.new(x, y, z), Vector3.new(w, h, d), colour, material)
	end
	return folder, piece
end
local function prompt(part, verb, noun, distance, callback)
	local action = Instance.new("ProximityPrompt")
	action.Name = "UseStation"
	action.ActionText = verb
	action.ObjectText = noun
	action.MaxActivationDistance = distance
	action.RequiresLineOfSight = false
	action.HoldDuration = 0
	action.Parent = part
	action.Triggered:Connect(callback)
	return action
end
local function near(player, part, radius)
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	return player.Parent == Players
		and hum
		and hum.Health > 0
		and root
		and (root.Position - part.Position).Magnitude <= radius
end
function Attractions.bind(options)
	local root = Instance.new("Folder")
	root.Name = "FestivalAttractions"
	root.Parent = workspace
	local marquee, piece = station(root, "MarqueeRelay", Vector3.new(-14, 0, 68))
	piece("Base", 0, 0.4, 0, 12, 0.8, 4, ink)
	piece("Spine", 0, 3.7, -0.65, 11.8, 6.1, 0.8, brass, Enum.Material.Metal)
	local board = piece("RelayHeader", 0, 5.45, -0.1, 11.45, 2.25, 0.25, ink)
	local header = sign(board, "", ivory)
	local motors, labels, actions = {}, {}, {}
	local lamps = { 1, 1, 1 }
	local target = { 2, 3, 2 }
	local lastPress, crew = {}, {}
	local closed = false
	local function refresh()
		header.Text = if closed
			then "PLAZA MARQUEE  ·  LIGHTS UP!\nCrew souvenir earned"
			else string.format(
				"MARQUEE RELAY   ·   MATCH THE TICKET\nTarget    %d    /    %d    /    %d",
				target[1],
				target[2],
				target[3]
			)
		for i = 1, 3 do
			motors[i].Color = lampColours[lamps[i]]
			labels[i].Text = tostring(lamps[i])
			actions[i].Enabled = not closed
		end
	end
	for i = 1, 3 do
		local x = (i - 2) * 3.65
		piece("LampSocket", x, 3.05, -0.09, 3.25, 2.2, 0.4, brass, Enum.Material.Metal)
		motors[i] = piece("Lamp" .. i, x, 3.05, 0.19, 2.98, 1.95, 0.24, lampColours[1], Enum.Material.Neon)
		labels[i] = sign(motors[i], "1", ink)
		local lever = piece("Switch" .. i, x, 1.45, 1, 2.7, 0.92, 1.55, ink)
		sign(lever, if i == 3 then "RIGHT" elseif i == 2 then "MID + RIGHT" else "LEFT + MID", ivory)
		actions[i] = prompt(
			lever,
			"Turn dial",
			({ "Left + middle", "Middle + right", "Right only" })[i],
			5.5,
			function(p)
				local now = os.clock()
				if
					closed
					or not options.canExplore(p)
					or not near(p, lever, 7)
					or now < (lastPress[p] or 0)
				then
					return
				end
				lastPress[p] = now + 0.22
				crew[p] = now
				Marquee.turn(lamps, i)
				if Marquee.matches(lamps, target) then
					closed = true
					for helper, stamp in crew do
						if now - stamp < 60 and options.canExplore(helper) and near(helper, board, 17) then
							options.grantBadge(helper, "marquee-relay")
						end
					end
					table.clear(crew)
					task.delay(6, function()
						repeat
							target = { math.random(1, 3), math.random(1, 3), math.random(1, 3) }
						until not Marquee.matches(lamps, target)
						closed = false
						refresh()
					end)
				end
				refresh()
			end
		)
		actions[i].Exclusivity = Enum.ProximityPromptExclusivity.AlwaysShow
		actions[i].ClickablePrompt = true
		actions[i].UIOffset = Vector2.new((i - 2) * 68, 0)
	end
	refresh()
	local portrait, build = station(root, "PortraitStudio", Vector3.new(12, 5, 119))
	build("Apron", 0, 0.16, 0, 10, 0.32, 7, ink)
	build("BackdropTrim", 0, 3.8, -2.7, 10.1, 7.45, 0.45, brass, Enum.Material.Metal)
	build("Backdrop", 0, 3.8, -2.44, 9.83, 7.13, 0.3, Color3.fromRGB(68, 43, 90))
	local crown = build("Sign", 0, 6.45, -2.17, 9.24, 1.15, 0.12, ink)
	sign(crown, "D E L I V E R Y   /   CAST PORTRAITS", ivory)
	for _, side in { -1, 1 } do
		for i = 1, 7 do
			local light = build(
				"VanityBulb",
				side * 4.63,
				0.62 + i * 0.79,
				-2.14,
				0.30,
				0.30,
				0.30,
				ivory,
				Enum.Material.Neon
			)
			light.Shape = Enum.PartType.Ball
		end
	end
	local lens = build("PortraitRelease", 0, 1.65, 3.54, 1.62, 1.1, 0.65, brass, Enum.Material.Metal)
	build("Stand", 0, 0.76, 3.53, 0.36, 1.5, 0.37, ink)
	sign(lens, "PORTRAIT", ink)
	local invite = Instance.new("RemoteEvent")
	invite.Name = "PortraitSession"
	invite.Parent = Storage.Delivery
	prompt(lens, "Pose for a portrait", "Rooftop photo studio", 6, function(p)
		if not options.canExplore(p) or not near(p, lens, 8) or os.clock() < (lastPress[p] or 0) then
			return
		end
		lastPress[p] = os.clock() + 1
		local mark = Vector3.new(12, 8.45, 118.8)
		local bestDistance = -1
		for _, offset in { 0, -2.5, 2.5 } do
			local pos = Vector3.new(12 + offset, 8.45, 118.8)
			local nearest = math.huge
			for _, other in Players:GetPlayers() do
				local actor = other.Character and other.Character:FindFirstChild("HumanoidRootPart")
				if other ~= p and actor then
					nearest = math.min(nearest, (actor.Position - pos).Magnitude)
				end
			end
			if nearest > bestDistance then
				bestDistance = nearest
				mark = pos
			end
		end
		p.Character:PivotTo(CFrame.lookAt(mark, mark + Vector3.zAxis))
		options.grantBadge(p, "rooftop-portrait")
		invite:FireClient(p, mark)
	end)
	Players.PlayerRemoving:Connect(function(p)
		lastPress[p] = nil
		crew[p] = nil
	end)
	return { marquee = marquee, portrait = portrait }
end
return Attractions
