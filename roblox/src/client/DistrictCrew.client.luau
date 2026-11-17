--!strict
-- The dockhand, gardener and wrapper offer short, authored directions on the street.
local RunService = game:GetService("RunService")
local GuiService = game:GetService("GuiService")
local walkers = {}
local crew = {
	{
		name = "Marnie",
		x = -85,
		z = 67,
		angle = -90,
		destination = Vector3.new(-108, 0.15, 67),
		shift = 5,
		hat = "cap",
		parcel = true,
		shirt = Color3.fromRGB(56, 101, 136),
		tip = "Take a parcel at Dockside Post. The address on your ticket tells you which shop needs it.",
	},
	{
		name = "Bram",
		x = -32.4,
		z = 112,
		angle = 180,
		destination = Vector3.new(-32.4, 0.15, 142),
		shift = 13,
		hat = "brim",
		basket = true,
		shirt = Color3.fromRGB(160, 91, 53),
		tip = "Smell the bread? Copper Kettle is just off Market Walk. Try the order ticket at the counter.",
	},
	{
		name = "Linn",
		x = 31,
		z = 111,
		angle = 180,
		destination = Vector3.new(31, 0.15, 143),
		shift = 24,
		hat = "bow",
		print = true,
		shirt = Color3.fromRGB(124, 81, 137),
		tip = "Pocket Print Gallery lets you choose the view, ink and greeting for a town postcard.",
	},
	{
		name = "Reed",
		x = 99,
		z = 94,
		angle = 180,
		destination = Vector3.new(99, 0.15, 113),
		shift = 16,
		hat = "cap",
		record = true,
		shirt = Color3.fromRGB(57, 131, 116),
		tip = "Needle Drop is around the corner. Or follow this lane to Clock Court and play its three bells.",
	},
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
	local mark = CFrame.new(member.x, if member.destination then 0.15 else 0, member.z)
		* CFrame.Angles(0, math.rad(member.angle), 0)
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
	if member.parcel then
		part("MailSatchel", Vector3.new(0.71, 0.76, 0.48), Vector3.new(0.87, 1.55, -0.28), ink)
		part("Envelope", Vector3.new(0.89, 0.55, 0.08), Vector3.new(-0.95, 1.59, -0.36), paper)
		part("Stamp", Vector3.new(0.18, 0.18, 0.06), Vector3.new(-0.64, 1.72, -0.43), member.shirt)
	elseif member.basket then
		part("BreadBasket", Vector3.new(1.01, 0.52, 0.67), Vector3.new(-0.9, 1.26, -0.3), gold)
		for _, side in { -1, 1 } do
			part(
				"Loaf",
				Vector3.new(0.42, 0.35, 0.62),
				Vector3.new(-0.91 + side * 0.22, 1.57, -0.3),
				paper,
				true
			)
		end
	elseif member.print or member.record then
		part("Sleeve", Vector3.new(0.96, 0.92, 0.11), Vector3.new(-0.94, 1.52, -0.36), paper)
		part(
			"CoverArt",
			Vector3.new(0.62, 0.61, 0.09),
			Vector3.new(-0.94, 1.52, -0.45),
			if member.record then ink else member.shirt,
			member.record
		)
		part("PrintMark", Vector3.new(0.19, 0.18, 0.06), Vector3.new(-0.94, 1.52, -0.50), gold, true)
	end
	local walker
	if member.destination then
		model.WorldPivot = mark
		local limbs = {}
		for _, item in model:GetChildren() do
			if item:IsA("BasePart") and (item.Name == "Boot" or item.Name == "Leg") then
				local offset = mark:ToObjectSpace(item.CFrame)
				table.insert(limbs, { part = item, offset = offset, side = math.sign(offset.Position.X) })
			end
		end
		local start = mark.Position
		walker = {
			model = model,
			origin = start,
			goal = member.destination,
			duration = (member.destination - start).Magnitude / 3.6,
			shift = member.shift,
			pausedUntil = 0,
			pauseAmount = 0,
			limbs = limbs,
		}
		table.insert(walkers, walker)
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
		if walker then
			walker.pausedUntil = os.clock() + 6
		end
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

-- Each resident strolls on a sidewalk and stops to talk. These local models never block player movement.
local accumulator = 0
RunService.Heartbeat:Connect(function(dt)
	accumulator += dt
	if accumulator < 0.09 then
		return
	end
	local step = accumulator
	accumulator = 0
	local camera = workspace.CurrentCamera
	if not camera or GuiService.ReducedMotionEnabled then
		return
	end
	local now = os.clock()
	for _, w in walkers do
		if w.pausedUntil > now then
			w.pauseAmount += step
			continue
		end
		if (camera.CFrame.Position - w.origin).Magnitude > 100 then
			continue
		end
		local leg = w.duration + 5
		local elapsed = (now + w.shift - w.pauseAmount) % (leg * 2)
		local first = elapsed < leg
		local start = if first then w.origin else w.goal
		local finish = if first then w.goal else w.origin
		local travel = elapsed % leg
		local pos = start:Lerp(finish, math.min(1, travel / w.duration))
		local stride = if travel < w.duration then math.sin(travel * 6.0) else 0
		local pivot = CFrame.lookAt(pos, pos + (finish - start).Unit)
		w.model:PivotTo(pivot)
		for _, limb in w.limbs do
			local swing = stride * limb.side
			limb.part.CFrame = pivot * CFrame.new(0, 0.06 * math.max(0, swing), 0.18 * swing) * limb.offset
		end
	end
end)
