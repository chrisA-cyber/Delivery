--!strict
local Room = {}
local function part(
	parent: Instance,
	name: string,
	size: Vector3,
	position: Vector3,
	color: Color3,
	class: string?
): BasePart
	local p = Instance.new(class or "Part") :: BasePart
	p.Name = name
	p.Anchored = true
	p.Size = size
	p.Position = position
	p.Color = color
	p.Parent = parent
	return p
end
function Room.build()
	local theatre = Instance.new("Model")
	theatre.Name = "StudioTheatre"
	theatre.Parent = workspace
	local charcoal, paper = Color3.fromRGB(41, 40, 48), Color3.fromRGB(245, 242, 232)
	part(theatre, "Riser", Vector3.new(38, 2, 14), Vector3.new(0, 1, -12), charcoal)
	local wall =
		part(theatre, "Board", Vector3.new(32, 10, 1), Vector3.new(0, 8, -18), Color3.fromRGB(16, 15, 21))
	local surface = Instance.new("SurfaceGui")
	surface.Face = Enum.NormalId.Back
	surface.CanvasSize = Vector2.new(960, 300)
	surface.Parent = wall
	local sign = Instance.new("TextLabel")
	sign.BackgroundTransparency = 1
	sign.Size = UDim2.fromScale(0.94, 0.86)
	sign.Position = UDim2.fromScale(0.03, 0.07)
	sign.Font = Enum.Font.GothamBold
	sign.TextColor3 = paper
	sign.TextScaled = true
	sign.TextWrapped = true
	sign.Text = "DELIVERY"
	sign.Parent = surface
	local seats = {}
	for row = 0, 1 do
		for col = -2, 2 do
			local seat = part(
				theatre,
				"Seat",
				Vector3.new(3, 1, 3),
				Vector3.new(col * 5, 1 + row * 2, 4 + row * 6),
				charcoal,
				"Seat"
			) :: Seat
			table.insert(seats, seat)
		end
	end
	local spawn = part(
		theatre,
		"Entry",
		Vector3.new(5, 1, 5),
		Vector3.new(0, 1, 16),
		charcoal,
		"SpawnLocation"
	) :: SpawnLocation
	spawn.Neutral = true
	spawn.Duration = 0
	local function place(player: Player, performing: boolean)
		local char = player.Character
		if not char then
			return
		end
		local humanoid = char:FindFirstChildOfClass("Humanoid")
		if not humanoid then
			return
		end
		if performing then
			humanoid.Sit = false
			char:PivotTo(CFrame.lookAt(Vector3.new(0, 5, -10), Vector3.new(0, 5, 10)))
		else
			for _, seat in seats do
				if seat.Occupant == humanoid then
					return
				end
				if not seat.Occupant then
					char:PivotTo(seat.CFrame + Vector3.new(0, 2, 0))
					seat:Sit(humanoid)
					return
				end
			end
		end
	end
	return { sign = sign, place = place }
end
return Room
