--!strict
local TweenService = game:GetService("TweenService")
local Players = game:GetService("Players")
local Storage = game:GetService("ReplicatedStorage")

local Streetcar = {}
local route = {
	{ x = 0, title = "Broadcast Plaza" },
	{ x = -104, title = "Waterfront Pier" },
	{ x = 0, title = "Broadcast Plaza" },
	{ x = 104, title = "Signal Park" },
}
local z = 74.5
local ivory = Color3.fromRGB(255, 231, 183)
local teal = Color3.fromRGB(17, 114, 109)
local navy = Color3.fromRGB(30, 34, 46)
local brass = Color3.fromRGB(210, 156, 70)
local red = Color3.fromRGB(162, 55, 49)

local function lettering(part, face, copy, color)
	local gui = Instance.new("SurfaceGui")
	gui.Face = face
	gui.LightInfluence = 0
	gui.PixelsPerStud = 56
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.Parent = part
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.TextColor3 = color
	label.Font = Enum.Font.GothamBold
	label.TextScaled = true
	label.Text = copy
	label.Parent = gui
	return label
end

function Streetcar.start(canRide)
	local network = Instance.new("Folder")
	network.Name = "DistrictRailway"
	network.Parent = workspace
	local tram = Instance.new("Model")
	tram.Name = "LotLine"
	tram.Parent = network
	local function piece(parent, name, size, frame, color, material)
		local obj = Instance.new("Part")
		obj.Name = name
		obj.Size = size
		obj.CFrame = frame
		obj.Anchored = true
		obj.CanCollide = false
		obj.CanTouch = false
		obj.Material = material or Enum.Material.SmoothPlastic
		obj.Color = color
		obj.Parent = parent
		return obj
	end
	local root = piece(tram, "Chassis", Vector3.new(15.8, 0.45, 5.5), CFrame.new(0, 1.15, z), navy)
	tram.PrimaryPart = root
	local function weld(obj)
		obj.Massless = true
		obj.Anchored = false
		local joint = Instance.new("WeldConstraint")
		joint.Part0 = root
		joint.Part1 = obj
		joint.Parent = obj
		return obj
	end
	local function car(name, x, y, offset, sx, sy, sz, color, mat)
		return weld(piece(tram, name, Vector3.new(sx, sy, sz), CFrame.new(x, y, z + offset), color, mat))
	end
	car("MapleFloor", 0, 1.53, 0, 15.5, 0.36, 5.3, brass, Enum.Material.WoodPlanks)
	car("RaisedRoof", 0, 6.38, 0, 16.1, 0.42, 5.7, teal)
	car("Clerestory", 0, 6.72, 0, 12.5, 0.32, 3.7, ivory)
	for _, side in { -1, 1 } do
		car("Cornice", 0, 6.12, side * 2.79, 16.05, 0.18, 0.14, brass, Enum.Material.Metal)
		for _, x in { -7.1, -3.7, 0, 3.7, 7.1 } do
			car("CanopySupport", x, 3.94, side * 2.55, 0.15, 4.4, 0.15, brass, Enum.Material.Metal)
		end
		for _, x in { -5.3, 0, 5.3 } do
			local wheel = car("Wheel", x, 0.77, side * 2.49, 1.25, 1.25, 0.34, navy, Enum.Material.Metal)
			wheel.Shape = Enum.PartType.Ball
		end
		local panel = car("SidePanel", 0, 2.15, side * 2.49, 7.4, 1.1, 0.23, teal)
		lettering(
			panel,
			if side == 1 then Enum.NormalId.Back else Enum.NormalId.Front,
			"LOT  LINE   •   03",
			ivory
		)
		for _, x in { -7.3, 7.3 } do
			car("Step", x, 1.02, side * 2.63, 1.22, 0.18, 0.82, brass)
		end
	end
	for _, x in { -7.55, 7.55 } do
		car("Nose", x, 2.18, 0, 0.42, 1.32, 5, teal)
		for _, offset in { -1.88, 1.88 } do
			local lamp =
				car("Headlight", x * 1.035, 2.45, offset, 0.25, 0.52, 0.52, ivory, Enum.Material.Neon)
			lamp.Shape = Enum.PartType.Ball
		end
	end
	local seats = {}
	for _, x in { -4.5, 0, 4.5 } do
		car("BenchBack", x - 0.56, 2.9, 0, 0.24, 1, 4.35, red)
		car("BenchCushion", x, 2.21, 0, 1.5, 0.35, 4.55, red)
		for _, offset in { -1.13, 1.13 } do
			local seat = Instance.new("Seat")
			seat.Name = "Passenger"
			seat.Size = Vector3.new(1.96, 0.15, 1.48)
			seat.CFrame = CFrame.new(x, 2.43, z + offset) * CFrame.Angles(0, -math.pi / 2, 0)
			seat.Transparency = 1
			seat.CanTouch = false
			seat.CanCollide = false
			seat:SetAttribute("LotLineSeat", true)
			seat.Parent = tram
			weld(seat)
			table.insert(seats, seat)
		end
	end
	local stops, exitRequests, readouts = {}, {}, {}
	local activeStop
	local function inSeat(player)
		local character = player.Character
		local hum = character and character:FindFirstChildOfClass("Humanoid")
		return hum and table.find(seats, hum.SeatPart) and hum
	end
	local function alight(player, stop)
		local hum = inSeat(player)
		if not hum or not stop then
			return
		end
		local joint = hum.SeatPart:FindFirstChild("SeatWeld")
		if joint then
			joint:Destroy()
		end
		hum.Sit = false
		player.Character:PivotTo(CFrame.new(stop.x, 3.35, z + 5.7))
	end
	for _, stop in route do
		if stops[stop.title] then
			continue
		end
		local platform = piece(
			network,
			"BoardingStripe",
			Vector3.new(11, 0.10, 0.52),
			CFrame.new(stop.x, 0.12, z + 4.5),
			brass
		)
		local x = stop.x + 5.0
		piece(
			network,
			"StopStandard",
			Vector3.new(0.27, 6.1, 0.27),
			CFrame.new(x, 3.1, z + 6),
			teal,
			Enum.Material.Metal
		)
		local sign = piece(network, "StopFlag", Vector3.new(4.2, 2.0, 0.24), CFrame.new(x, 5.4, z + 6), navy)
		for _, face in { Enum.NormalId.Front, Enum.NormalId.Back } do
			local label = lettering(sign, face, "", ivory)
			table.insert(readouts, { name = stop.title, label = label })
		end
		local prompt = Instance.new("ProximityPrompt")
		prompt.Name = "BoardStreetcar"
		prompt.ActionText = "Board streetcar"
		prompt.ObjectText = stop.title .. " • Lot Line"
		prompt.MaxActivationDistance = 11
		prompt.HoldDuration = 0.15
		prompt.RequiresLineOfSight = false
		prompt.Enabled = false
		prompt.Parent = platform
		stops[stop.title] = prompt
		prompt.Triggered:Connect(function(player)
			local character = player.Character
			local hum = character and character:FindFirstChildOfClass("Humanoid")
			local torso = character and character:FindFirstChild("HumanoidRootPart")
			if
				not canRide(player)
				or not activeStop
				or activeStop.title ~= stop.title
				or not hum
				or hum.Health <= 0
				or hum.SeatPart
				or not torso
				or (torso.Position - platform.Position).Magnitude > 13
			then
				return
			end
			for _, seat in seats do
				if not seat.Occupant then
					seat:Sit(hum)
					break
				end
			end
		end)
	end
	local request = Instance.new("RemoteEvent")
	request.Name = "StreetcarStop"
	request.Parent = Storage.Delivery
	request.OnServerEvent:Connect(function(player)
		if not inSeat(player) then
			return
		end
		if activeStop then
			alight(player, activeStop)
		else
			exitRequests[player] = true
		end
	end)
	Players.PlayerRemoving:Connect(function(player)
		exitRequests[player] = nil
	end)
	task.spawn(function()
		local index = 1
		while tram.Parent do
			local stop = route[index]
			local nextIndex = index % #route + 1
			local dest = route[nextIndex]
			activeStop = stop
			tram:SetAttribute("Stop", stop.title)
			tram:SetAttribute("NextStop", dest.title)
			for _, item in readouts do
				item.label.Text = if item.name == stop.title
					then "LOT LINE  •  BOARD HERE\n" .. dest.title
					else "LOT LINE  •  " .. item.name .. "\nCar at " .. stop.title
			end
			for player in exitRequests do
				alight(player, stop)
			end
			table.clear(exitRequests)
			stops[stop.title].Enabled = true
			task.wait(8)
			stops[stop.title].Enabled = false
			activeStop = nil
			tram:SetAttribute("Stop", "")
			for _, item in readouts do
				item.label.Text = "LOT LINE  •  "
					.. item.name
					.. "\n"
					.. (if item.name == dest.title then "Arriving shortly" else "Next: " .. dest.title)
			end
			local ride = TweenService:Create(
				root,
				TweenInfo.new(8, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut),
				{ CFrame = CFrame.new(dest.x, 1.15, z) }
			)
			ride:Play()
			ride.Completed:Wait()
			ride:Destroy()
			index = nextIndex
		end
	end)
end
return Streetcar
