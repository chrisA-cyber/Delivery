--!strict
-- The harbor birds and park kites belong to the scenery. Their motion never affects activities.
local Run = game:GetService("RunService")
local guiService = game:GetService("GuiService")
local scenery = Instance.new("Folder")
scenery.Name = "DistrictSky"
scenery.Parent = workspace
local bone = Color3.fromRGB(252, 236, 195)
local blue = Color3.fromRGB(70, 136, 195)
local orange = Color3.fromRGB(247, 130, 76)
local ink = Color3.fromRGB(51, 63, 76)
local function shape(model, kind, name, size, frame, colour)
	local part = Instance.new(kind)
	part.Name = name
	part.Anchored = true
	part.CanCollide = false
	part.CanTouch = false
	part.CanQuery = false
	part.CastShadow = false
	part.Size = size
	part.CFrame = frame
	part.Color = colour
	part.Parent = model
	return part
end
local function gull(index)
	local m = Instance.new("Model")
	m.Name = "HarborGull" .. index
	local body = shape(m, "Part", "Body", Vector3.new(0.48, 0.42, 1.48), CFrame.identity, bone)
	body.Shape = Enum.PartType.Ball
	m.PrimaryPart = body
	shape(m, "WedgePart", "Tail", Vector3.new(0.6, 0.18, 0.86), CFrame.new(0, 0.04, 0.68), ink)
	shape(
		m,
		"WedgePart",
		"Beak",
		Vector3.new(0.20, 0.17, 0.35),
		CFrame.new(0, 0.05, -0.78) * CFrame.Angles(0, math.pi, 0),
		orange
	)
	for _, side in { -1, 1 } do
		shape(
			m,
			"WedgePart",
			"Wing",
			Vector3.new(1.25, 0.16, 0.67),
			CFrame.new(side * 0.78, 0.16, 0.05) * CFrame.Angles(0, side * 0.20, side * 0.22),
			bone
		)
		shape(
			m,
			"WedgePart",
			"WingTip",
			Vector3.new(0.85, 0.1, 0.42),
			CFrame.new(side * 1.72, 0.18, 0.23) * CFrame.Angles(0, side * 0.40, -side * 0.2),
			ink
		)
	end
	m.Parent = scenery
	return m
end
local function kite(index, colour)
	local m = Instance.new("Model")
	m.Name = "SignalKite" .. index
	local face =
		shape(m, "Part", "Sail", Vector3.new(2.65, 2.65, 0.09), CFrame.Angles(0, 0, math.pi / 4), colour)
	local mast = shape(m, "Part", "Spine", Vector3.new(0.11, 3.78, 0.13), CFrame.new(0, 0, 0.05), bone)
	m.PrimaryPart = mast
	shape(m, "Part", "Spar", Vector3.new(3.77, 0.12, 0.13), CFrame.new(0, 0, 0.04), bone)
	for i = 1, 4 do
		shape(
			m,
			"Part",
			"Ribbon",
			Vector3.new(0.20, 0.8, 0.09),
			CFrame.new(math.sin(i * 0.8) * 0.3, -1.5 - i * 0.75, 0)
				* CFrame.Angles(0, 0, math.cos(i * 0.8) * 0.3),
			if i % 2 == 0 then bone else face.Color
		)
	end
	local endPoint = Instance.new("Attachment")
	endPoint.Position = Vector3.new(0, -0.42, -0.07)
	endPoint.Parent = mast
	local anchor = shape(
		scenery,
		"Part",
		"KiteStringAnchor",
		Vector3.new(0.05, 0.05, 0.05),
		CFrame.new(138 + (index - 1) * 6, 3.5, 95),
		bone
	)
	anchor.Transparency = 1
	local start = Instance.new("Attachment")
	start.Parent = anchor
	local thread = Instance.new("Beam")
	thread.Attachment0 = start
	thread.Attachment1 = endPoint
	thread.Width0 = 0.045
	thread.Width1 = 0.04
	thread.Color = ColorSequence.new(bone)
	thread.Transparency = NumberSequence.new(0.35)
	thread.FaceCamera = true
	thread.Segments = 6
	thread.CurveSize0 = 1.4
	thread.CurveSize1 = 1.2
	thread.Parent = mast
	m.Parent = scenery
	return m
end
local gulls = { gull(1), gull(2), gull(3) }
local kites = { kite(1, orange), kite(2, blue) }
local function place(t)
	for i, m in gulls do
		local a = t * (0.23 + i * 0.017) + 2.1 * i
		local rx, rz = 17 + i * 3, 9 + i
		local pos = Vector3.new(-139 + rx * math.cos(a), 19 + i * 2 + math.sin(a * 2), 82 + rz * math.sin(a))
		local direction = Vector3.new(-rx * math.sin(a), 0.25 * math.cos(a * 2), rz * math.cos(a))
		m:PivotTo(CFrame.lookAt(pos, pos + direction) * CFrame.Angles(0, 0, math.rad(-10)))
	end
	for i, m in kites do
		local a = t * 0.37 + i * 1.9
		m:PivotTo(
			CFrame.new(140 + i * 5 + math.sin(a) * 2, 23 + i * 4 + math.cos(a * 0.74), 99 + math.cos(a) * 1.5)
				* CFrame.Angles(math.rad(12), -0.5, math.sin(a) * 0.12)
		)
	end
end
place(0)
local elapsed = 0
Run.Heartbeat:Connect(function(delta)
	elapsed += delta
	if elapsed < 0.09 then
		return
	end
	elapsed = 0
	local cam = workspace.CurrentCamera
	if not cam or guiService.ReducedMotionEnabled then
		return
	end
	local x = cam.CFrame.Position.X
	if math.abs(x) > 65 then
		place(workspace:GetServerTimeNow() % 2000)
	end
end)
