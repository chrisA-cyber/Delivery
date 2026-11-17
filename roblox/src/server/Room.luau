--!strict
local Room = {}
local function make(class: string, name: string, parent: Instance)
	local obj = Instance.new(class)
	obj.Name = name
	obj.Parent = parent
	return obj
end
local function screen(part: BasePart, name: string, text: string, color: Color3, size: Vector2)
	local surface = Instance.new("SurfaceGui")
	surface.Name = name
	surface.Face = Enum.NormalId.Back
	surface.LightInfluence = 0
	surface.Brightness = 1.3
	surface.CanvasSize = size
	surface.Parent = part
	local t = Instance.new("TextLabel")
	t.Size = UDim2.fromScale(0.94, 0.88)
	t.Position = UDim2.fromScale(0.03, 0.06)
	t.TextColor3 = color
	t.Font = Enum.Font.GothamBold
	t.TextScaled = true
	t.TextWrapped = true
	t.BackgroundTransparency = 1
	t.Text = text
	t.Parent = surface
	return t
end
function Room.build()
	local set = workspace:WaitForChild("ShowSet")
	local rig = make("Folder", "ShowRig", set)
	local paper = Color3.fromRGB(255, 239, 202)
	local board = set:FindFirstChild("LiveBoard", true) :: BasePart
	local sign = screen(board, "Caption", "DELIVERY", paper, Vector2.new(1000, 220))
	local function fixture(name: string, pos: Vector3, size: Vector3)
		local p = Instance.new("Part")
		p.Name = name
		p.Anchored = true
		p.CanCollide = false
		p.CanTouch = false
		p.Transparency = 1
		p.Size = size
		p.Position = pos
		p.Parent = rig
		return p
	end
	local logo = fixture("Marquee", Vector3.new(0, 13.55, -20.6), Vector3.new(11, 1.45, 0.12))
	screen(logo, "Nameplate", "D E L I V E R Y", Color3.fromRGB(56, 35, 36), Vector2.new(800, 145))
	local daily = fixture("DailyBoard", Vector3.new(14, 5, -14), Vector3.new(5, 3.6, 0.3))
	daily.Transparency = 0
	daily.Color = Color3.fromRGB(45, 31, 52)
	local dailySign = screen(daily, "Daily", "DAILY SHOW", paper, Vector2.new(390, 240))
	local function light(name, pos, col, power, range, shadows)
		local lamp = fixture(name, pos, Vector3.one)
		local bulb = Instance.new("PointLight")
		bulb.Name = name
		bulb.Brightness = power
		bulb.Range = range
		bulb.Color = col
		bulb.Shadows = shadows
		bulb.Parent = lamp
		return bulb
	end
	light("Key", Vector3.new(0, 11, 1), Color3.fromRGB(255, 222, 179), 2, 39, true)
	light("BlueWash", Vector3.new(-16, 7, -13), Color3.fromRGB(105, 113, 255), 2.2, 22, false)
	light("RoseWash", Vector3.new(16, 7, -13), Color3.fromRGB(255, 94, 174), 1.7, 22, false)
	light("House", Vector3.new(0, 9, 9), Color3.fromRGB(198, 148, 209), 1.2, 29, false)
	light("Footlights", Vector3.new(2, 5, -15), Color3.fromRGB(255, 192, 114), 1.3, 21, false)
	-- Light shafts have a fixed cost and never cast shadows.
	for _, x in { -14, 0, 14 } do
		local source = fixture("Lens", Vector3.new(x, 20.1, -0.5), Vector3.one)
		local target = fixture("Pool", Vector3.new(x * 0.67, 2.2, -10), Vector3.one)
		local a = Instance.new("Attachment")
		a.Parent = source
		local b = Instance.new("Attachment")
		b.Parent = target
		local beam = Instance.new("Beam")
		beam.Attachment0 = a
		beam.Attachment1 = b
		beam.FaceCamera = true
		beam.Width0 = 0.25
		beam.Width1 = 3.9
		beam.LightEmission = 0.9
		beam.Color = ColorSequence.new(Color3.fromRGB(255, 218, 169))
		beam.Transparency = NumberSequence.new({
			NumberSequenceKeypoint.new(0, 0.68),
			NumberSequenceKeypoint.new(0.4, 0.9),
			NumberSequenceKeypoint.new(1, 1),
		})
		beam.Parent = source
	end
	local seats = {}
	for row = 0, 1 do
		for col = -2, 2 do
			local seat = Instance.new("Seat")
			seat.Name = "Seat"
			seat.Anchored = true
			seat.Transparency = 1
			seat.Size = Vector3.new(3, 0.4, 2.8)
			seat.Position = Vector3.new(col * 5, 1.52 + row * 1.2, 4 + row * 6)
			seat.Parent = rig
			table.insert(seats, seat)
		end
	end
	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "Entry"
	spawn.Neutral = true
	spawn.Duration = 0
	spawn.Anchored = true
	spawn.Size = Vector3.new(4, 0.3, 3)
	spawn.Position = Vector3.new(0, 0.15, 17)
	spawn.Transparency = 1
	spawn.Parent = rig
	local function place(player: Player, performing: boolean)
		local char = player.Character
		if not char or not char:IsDescendantOf(workspace) then
			return
		end
		local hum = char:FindFirstChildOfClass("Humanoid")
		if not hum or hum.Health <= 0 then
			return
		end
		if performing then
			hum.Sit = false
			hum:ChangeState(Enum.HumanoidStateType.GettingUp)
			char:PivotTo(CFrame.lookAt(Vector3.new(5, 5.4, -9.5), Vector3.new(5, 5.4, 5)))
		else
			for _, seat in seats do
				if seat.Occupant == hum then
					return
				end
				if not seat.Occupant then
					char:PivotTo(seat.CFrame + Vector3.new(0, 2.2, 0))
					seat:Sit(hum)
					return
				end
			end
		end
	end
	return { sign = sign, daily = dailySign, place = place }
end
return Room
