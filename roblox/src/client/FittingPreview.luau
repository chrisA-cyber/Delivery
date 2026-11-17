--!strict
local Players = game:GetService("Players")
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
function Preview.new(gui)
	local port = Instance.new("ViewportFrame")
	port.Name = "AtelierMirror"
	port.Position = UDim2.fromOffset(12, 5)
	port.Size = UDim2.new(0.36, 0, 0.49, -8)
	port.BackgroundColor3 = Color3.fromRGB(36, 28, 50)
	port.BorderSizePixel = 0
	port.Visible = false
	port.Ambient = Color3.fromRGB(149, 137, 155)
	port.LightDirection = Vector3.new(-1, -0.7, -0.45)
	port.Parent = gui
	local cap = Instance.new("UISizeConstraint")
	cap.MaxSize = Vector2.new(325, 290)
	cap.Parent = port
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 10)
	corner.Parent = port
	local edge = Instance.new("UIStroke")
	edge.Color = Color3.fromRGB(207, 179, 121)
	edge.Transparency = 0.32
	edge.Parent = port
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
	local function show(visible, look)
		port.Visible = visible
		if not visible then
			if world then
				reset()
			end
			return
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
		local aspect = port.AbsoluteSize.X / math.max(1, port.AbsoluteSize.Y)
		cam.CFrame = CFrame.lookAt(
			target + Vector3.new(-0.15, 0.13, -1).Unit * (distance * math.max(1, 1 / aspect)),
			target
		)
	end
	return { show = show }
end
return Preview
