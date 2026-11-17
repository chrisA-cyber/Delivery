--!strict
-- The atelier's fitting mirror: a live clone of the avatar under the chosen stage look, framed like a
-- dressing-room mirror with bulbs. Sits in the top-left, above the HUD desk.
local Players = game:GetService("Players")
local Run = game:GetService("RunService")
local Style = require(script.Parent.GuideStyle)
local Preview = {}
local palette = {
	house = Color3.fromRGB(255, 229, 188),
	apricot = Color3.fromRGB(255, 178, 104),
	cobalt = Color3.fromRGB(117, 152, 255),
	cherry = Color3.fromRGB(255, 127, 158),
}
local function part(parent, name, size, pos, color, shape)
	local p = Instance.new("Part")
	p.Name = name
	p.Anchored = true
	p.CanCollide = false
	p.CastShadow = false
	p.Size = size
	p.Position = pos
	p.Color = color
	p.Material = Enum.Material.SmoothPlastic
	if shape then
		p.Shape = shape
	end
	p.Parent = parent
	return p
end
function Preview.new(gui: ScreenGui, root: Instance?)
	local frameOuter = Style.frame(root or gui, "AtelierMirrorFrame", Style.color.lacquer, 0)
	frameOuter.Position = UDim2.fromOffset(12, 8)
	frameOuter.Visible = false
	Style.corner(frameOuter, 22)
	Style.stroke(frameOuter, Style.color.champagne, 2.5, 0)
	Style.gradient(frameOuter, Color3.fromRGB(120, 48, 76), Style.color.lacquer)
	local port = Instance.new("ViewportFrame")
	port.Name = "AtelierMirror"
	port.AnchorPoint = Vector2.new(0.5, 0)
	port.Position = UDim2.new(0.5, 0, 0, 10)
	port.Size = UDim2.new(1, -20, 1, -44)
	port.BackgroundColor3 = Color3.fromRGB(36, 28, 50)
	port.BorderSizePixel = 0
	port.Ambient = Color3.fromRGB(149, 137, 155)
	port.LightDirection = Vector3.new(-1, -0.7, -0.45)
	port.Parent = frameOuter
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 16)
	corner.Parent = port
	local edge = Instance.new("UIStroke")
	edge.Color = Style.color.bulb
	edge.Transparency = 0.2
	edge.Thickness = 1.5
	edge.Parent = port
	-- Dressing-room bulbs along both sides of the mirror.
	local bulbs: { Frame } = {}
	for _, side in { 0, 1 } do
		for i = 0, 4 do
			local bulb = Style.frame(frameOuter, "Bulb", Style.color.bulb)
			bulb.AnchorPoint = Vector2.new(0.5, 0.5)
			bulb.Position = UDim2.fromScale(side, 0.12 + i * 0.17)
			bulb.Size = UDim2.fromOffset(9, 9)
			Style.corner(bulb, 999)
			Style.stroke(bulb, Color3.fromRGB(255, 240, 200), 2, 0.6)
			table.insert(bulbs, bulb)
		end
	end
	local plate = Style.text(frameOuter, "Plate", Style.font.title, Style.color.bulb, 15, 11)
	plate.AnchorPoint = Vector2.new(0.5, 1)
	plate.Position = UDim2.new(0.5, 0, 1, -6)
	plate.Size = UDim2.new(1, -24, 0, 22)
	plate.TextXAlignment = Enum.TextXAlignment.Center
	plate.Text = Style.spaced("Fitting mirror")
	local function layout()
		local size = gui.AbsoluteSize
		local desk = gui:GetAttribute("HudDeskTop")
		local room = (if type(desk) == "number" then desk else size.Y * 0.5) - 20
		local h = math.clamp(room, 150, 320)
		frameOuter.Size = UDim2.fromOffset(math.floor(math.min(h * 0.82, size.X * 0.34)), h)
	end
	gui:GetPropertyChangedSignal("AbsoluteSize"):Connect(layout)
	gui:GetAttributeChangedSignal("HudDeskTop"):Connect(layout)
	layout()
	local cam = Instance.new("Camera")
	cam.FieldOfView = 35
	cam.Parent = port
	port.CurrentCamera = cam
	local model = nil
	local world = nil
	local stem = nil
	local housings = nil
	local target = Vector3.new(0, 3, 0)
	local distance = 11
	local function reset()
		if world then
			world:Destroy()
		end
		model = nil
		world = nil
		stem = nil
		housings = nil
	end
	local function build()
		world = Instance.new("WorldModel")
		world.Name = "FittingSet"
		world.Parent = port
		local character = Players.LocalPlayer.Character
		if character then
			local previous = character.Archivable
			character.Archivable = true
			model = character:Clone()
			character.Archivable = previous
			if model then
				for _, item in model:GetDescendants() do
					if
						item:IsA("BaseScript")
						or item:IsA("ModuleScript")
						or item:IsA("Tool")
						or item:IsA("Sound")
						or item:IsA("ParticleEmitter")
					then
						item:Destroy()
					elseif item:IsA("BasePart") then
						item.Anchored = true
						item.CanCollide = false
						item.LocalTransparencyModifier = 0
					end
				end
				model:PivotTo(CFrame.new(0, 0, 0))
				local center, size = model:GetBoundingBox()
				local shift = Vector3.new(-center.X, -center.Y + size.Y * 0.5, -center.Z)
				model:PivotTo(model:GetPivot() + shift)
				target = Vector3.new(0, size.Y * 0.51, 0)
				distance = math.max(9, size.Y * 2.25, size.X * 2.1)
				model.Parent = world
			end
		end
		local navy = Color3.fromRGB(49, 34, 75)
		part(world, "StagePlinth", Vector3.new(10, 0.25, 7), Vector3.new(0, -0.15, 0), navy)
		local brass = Color3.fromRGB(193, 144, 81)
		housings =
			part(world, "SpotlightHousing", Vector3.new(11, 0.16, 0.25), Vector3.new(0, 5.9, 2.5), brass)
		stem = part(world, "MicStand", Vector3.new(0.13, 3.5, 0.13), Vector3.new(-1.8, 1.75, -0.65), brass)
		part(
			world,
			"Microphone",
			Vector3.new(0.47, 0.69, 0.47),
			Vector3.new(-1.8, 3.6, -0.65),
			brass,
			Enum.PartType.Ball
		)
		part(world, "Foot", Vector3.new(0.8, 0.1, 0.8), Vector3.new(-1.8, 0.05, -0.65), brass)
	end
	local orbit: RBXScriptConnection? = nil
	local angle = 0
	local function aim()
		local aspect = port.AbsoluteSize.X / math.max(1, port.AbsoluteSize.Y)
		local dir = Vector3.new(math.sin(angle) - 0.15, 0.13, -math.cos(angle)).Unit
		cam.CFrame = CFrame.lookAt(target + dir * (distance * math.max(1, 1 / aspect)), target)
	end
	local lastLook = ""
	local function show(visible, look)
		frameOuter.Visible = visible
		if not visible then
			if orbit then
				orbit:Disconnect()
				orbit = nil
			end
			lastLook = ""
			if world then
				reset()
			end
			return
		end
		if not orbit then
			-- A slow sway so the mirror feels alive; held still under reduced motion.
			orbit = Run.Heartbeat:Connect(function()
				if Style.reduced() then
					angle = 0
				else
					angle = math.sin(os.clock() * 0.6) * 0.35
				end
				aim()
			end)
		end
		if look ~= lastLook then
			lastLook = look
			Style.pop(frameOuter, 0.96)
			for i, bulb in bulbs do
				bulb.BackgroundTransparency = 0.6
				Style.tween(bulb, 0.25 + i * 0.03, { BackgroundTransparency = 0 })
			end
		end
		if not world then
			build()
		end
		local col = palette[look] or palette.house
		port.LightColor = if look == "apricot" then col else palette.house
		if housings then
			housings.Color = col
		end
		if stem then
			stem.Color = if look == "cherry" or look == "cobalt" then col else Color3.fromRGB(193, 144, 81)
		end
		aim()
	end
	return { show = show }
end
return Preview
