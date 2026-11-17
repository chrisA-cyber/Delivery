--!strict
-- The dockhand, gardener and wrapper offer short, authored directions on the street.
local crew = {
	{
		name = "Capstan",
		x = -117,
		z = 82,
		angle = 105,
		shirt = Color3.fromRGB(34, 102, 122),
		hat = "cap",
		tip = "Watch the crane lamp. Reel as it flashes, three times per shift.",
	},
	{
		name = "Pip",
		x = 125,
		z = 63,
		angle = -95,
		shirt = Color3.fromRGB(67, 124, 80),
		hat = "brim",
		tip = "Start at the bandstand. Run through each marked arch, then circle back here.",
	},
	{
		name = "Dot",
		x = 7,
		z = 176.3,
		angle = -45,
		shirt = Color3.fromRGB(165, 70, 86),
		hat = "bow",
		tip = "Take an order, find the two supply stalls, and use the customer's stamp at the counter.",
	},
}
local ink = Color3.fromRGB(47, 45, 55)
local paper = Color3.fromRGB(250, 228, 183)
local gold = Color3.fromRGB(213, 162, 92)
local population = Instance.new("Folder")
population.Name = "DistrictCrew"
population.Parent = workspace
for _, member in crew do
	local model = Instance.new("Model")
	model.Name = member.name
	model.Parent = population
	local mark = CFrame.new(member.x, 0, member.z) * CFrame.Angles(0, math.rad(member.angle), 0)
	local function part(name, size, pos, color, round)
		local b = Instance.new("Part")
		b.Name = name
		b.Size = size
		b.CFrame = mark * CFrame.new(pos)
		b.Color = color
		b.Material = Enum.Material.SmoothPlastic
		if round then
			b.Shape = Enum.PartType.Ball
		end
		b.Anchored = true
		b.CanCollide = false
		b.CanTouch = false
		b.CanQuery = false
		b.Parent = model
		return b
	end
	for _, side in { -1, 1 } do
		part("Boot", Vector3.new(0.58, 0.46, 0.83), Vector3.new(side * 0.39, 0.24, -0.08), ink, true)
		part("Leg", Vector3.new(0.33, 0.69, 0.37), Vector3.new(side * 0.39, 0.73, 0), gold)
		part("Sleeve", Vector3.new(0.52, 0.62, 0.54), Vector3.new(side * 1.03, 1.89, 0), member.shirt, true)
		part("Glove", Vector3.new(0.40, 0.43, 0.45), Vector3.new(side * 1.05, 1.43, -0.06), gold, true)
	end
	part("Coveralls", Vector3.new(1.63, 1.17, 0.81), Vector3.new(0, 1.62, 0), member.shirt)
	part("Pocket", Vector3.new(0.43, 0.31, 0.07), Vector3.new(-0.29, 1.77, -0.44), paper)
	local head = part("Radio", Vector3.new(1.79, 1.28, 0.93), Vector3.new(0, 2.74, 0), gold)
	part("Glass", Vector3.new(1.53, 0.92, 0.08), Vector3.new(0, 2.73, -0.5), ink)
	for _, side in { -1, 1 } do
		part("DialEye", Vector3.new(0.33, 0.37, 0.14), Vector3.new(side * 0.39, 2.81, -0.56), paper, true)
		part("Tuner", Vector3.new(0.13, 0.20, 0.06), Vector3.new(side * 0.39, 2.80, -0.63), ink, true)
	end
	part("Grille", Vector3.new(0.53, 0.075, 0.08), Vector3.new(0, 2.47, -0.55), gold)
	if member.hat == "bow" then
		for _, side in { -1, 1 } do
			part(
				"Bow",
				Vector3.new(0.42, 0.32, 0.25),
				Vector3.new(0.42 + side * 0.18, 3.44, -0.21),
				member.shirt,
				true
			)
		end
	else
		part(
			"Crown",
			Vector3.new(1.37, 0.64, 0.95),
			Vector3.new(0, 3.43, 0),
			if member.hat == "brim" then gold else member.shirt,
			true
		)
		part(
			"Visor",
			Vector3.new(if member.hat == "brim" then 2.16 else 1.52, 0.13, 1.15),
			Vector3.new(0, 3.30, -0.12),
			if member.hat == "brim" then gold else ink
		)
	end
	local talk = Instance.new("ProximityPrompt")
	talk.ObjectText = member.name
	talk.ActionText = "Ask for a tip"
	talk.MaxActivationDistance = 6
	talk.RequiresLineOfSight = false
	talk.HoldDuration = 0.1
	talk.Parent = head
	local bubble = Instance.new("BillboardGui")
	bubble.Name = "CrewTip"
	bubble.Adornee = head
	bubble.StudsOffsetWorldSpace = Vector3.new(0, 2.25, 0)
	bubble.Size = UDim2.fromOffset(200, 60)
	bubble.MaxDistance = 22
	bubble.Enabled = false
	bubble.AlwaysOnTop = true
	bubble.Parent = head
	local speech = Instance.new("TextLabel")
	speech.Size = UDim2.fromScale(1, 1)
	speech.BackgroundColor3 = ink
	speech.BackgroundTransparency = 0.08
	speech.TextColor3 = paper
	speech.TextWrapped = true
	speech.Font = Enum.Font.GothamMedium
	speech.TextSize = 13
	speech.Text = member.tip
	speech.Parent = bubble
	local pad = Instance.new("UIPadding")
	pad.PaddingLeft = UDim.new(0, 9)
	pad.PaddingRight = UDim.new(0, 9)
	pad.Parent = speech
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 8)
	corner.Parent = speech
	local token = 0
	talk.Triggered:Connect(function()
		token += 1
		local current = token
		bubble.Enabled = true
		task.delay(6, function()
			if token == current then
				bubble.Enabled = false
			end
		end)
	end)
end
