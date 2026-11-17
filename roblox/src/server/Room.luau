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
	surface.Brightness = 1.12
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
	local water = set:FindFirstChild("HarborSurface", true)
	if water and water:IsA("BasePart") then
		-- The far-water sheet supplies the horizon below the swimmable, reflective near shore.
		water.Position = Vector3.new(water.Position.X, -6.2, water.Position.Z)
		water.Reflectance = 0.04
		local terrain = workspace.Terrain
		terrain.WaterColor = Color3.fromRGB(48, 120, 133)
		terrain.WaterTransparency = 0.22
		terrain.WaterWaveSize = 0.16
		terrain.WaterWaveSpeed = 8
		terrain:FillBlock(CFrame.new(-262, -8, 76), Vector3.new(260, 12, 408), Enum.Material.Water)
	end
	local paper = Color3.fromRGB(255, 239, 202)
	for _, item in set:GetDescendants() do
		if
			item:IsA("StringValue")
			and item.Name == "Wayfinding"
			and item.Parent
			and item.Parent:IsA("BasePart")
		then
			local plate = item.Parent
			local caption = screen(
				plate,
				"WayfindingType",
				item.Value,
				paper,
				Vector2.new(900, math.max(92, 900 * plate.Size.Y / plate.Size.X))
			)
			caption.Font = Enum.Font.GothamBold
		end
	end
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
	local logo = fixture("Marquee", Vector3.new(0, 14.22, -20.25), Vector3.new(12.1, 1.65, 0.12))
	screen(logo, "Nameplate", "D E L I V E R Y", Color3.fromRGB(255, 226, 180), Vector2.new(930, 126))
	local ticketHeader =
		fixture("BoxOfficeHeader", Vector3.new(14, 7.3, -13.70), Vector3.new(5.35, 0.74, 0.1))
	screen(ticketHeader, "Header", "TODAY'S PROGRAMME", paper, Vector2.new(540, 75))
	local daily = fixture("DailyBoard", Vector3.new(14, 5.30, -13.72), Vector3.new(5.14, 3.50, 0.2))
	daily.Transparency = 0
	daily.Color = Color3.fromRGB(45, 31, 52)
	local dailySign = screen(daily, "Daily", "DAILY SHOW", paper, Vector2.new(390, 240))
	local tickets = {}
	for _, item in set.Gallery:GetChildren() do
		if item:IsA("BasePart") and item.Name == "SeatTicket" then
			table.insert(tickets, item)
		end
	end
	table.sort(tickets, function(a, b)
		if math.abs(a.Position.Z - b.Position.Z) > 0.1 then
			return a.Position.Z < b.Position.Z
		end
		return a.Position.X < b.Position.X
	end)
	for index, ticket in tickets do
		screen(
			ticket,
			"SeatNumber",
			string.format("%02d", index),
			Color3.fromRGB(47, 32, 32),
			Vector2.new(90, 40)
		)
	end
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
	for _, site in
		{
			{ "TicketLights", Vector3.new(0, 11, 39), Color3.fromRGB(255, 224, 189), 1.25, 39 },
			{ "PlazaPractical", Vector3.new(2, 12, 62), Color3.fromRGB(239, 210, 233), 1.12, 49 },
			{ "WorkshopSidelight", Vector3.new(-54, 9, 53), Color3.fromRGB(179, 197, 255), 1.50, 29 },
			{ "DispatchWarmth", Vector3.new(53, 9, 53), Color3.fromRGB(255, 211, 169), 1.48, 29 },
			{ "TailoringLamps", Vector3.new(56, 9, 89), Color3.fromRGB(255, 197, 219), 1.45, 29 },
			{ "LoftDaylight", Vector3.new(-54, 9, 89), Color3.fromRGB(255, 222, 190), 1.42, 29 },
			{ "DerrickLantern", Vector3.new(-121, 9, 72), Color3.fromRGB(242, 208, 165), 1.22, 37 },
			{ "SignalParkCanopy", Vector3.new(131, 10, 90), Color3.fromRGB(230, 199, 232), 1.2, 37 },
			{ "FestivalLight", Vector3.new(0, 14, 173), Color3.fromRGB(255, 200, 163), 1.36, 46 },
			{ "TerraceLanterns", Vector3.new(0, 14, 119), Color3.fromRGB(202, 184, 246), 1.22, 31 },
		}
	do
		light(site[1], site[2], site[3], site[4] * 0.8, site[5], false)
	end
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
		beam.Width1 = 3.2
		beam.LightEmission = 0.9
		beam.Color = ColorSequence.new(Color3.fromRGB(255, 218, 169))
		beam.Transparency = NumberSequence.new({
			NumberSequenceKeypoint.new(0, 0.85),
			NumberSequenceKeypoint.new(0.4, 0.94),
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
	spawn.CFrame = CFrame.lookAt(Vector3.new(99, 0.11, 80), Vector3.new(136, 0.11, 94))
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
			if hum.SeatPart and table.find(seats, hum.SeatPart) then
				return
			end
			for _, seat in seats do
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
