--!strict
-- House crowd (C8): when fewer than three people watch a show, empty audience seats fill with uniformed
-- "HOUSE" robots so a solo performer does not play to empty chairs. They are local visuals only: they
-- never vote, never occupy a Seat, and react only at the reveal, from the measured score band.
-- A real player sitting down always wins: that seat's robot leaves at once.
local RunService = game:GetService("RunService")

local client = script.Parent
local StreetRobot = require(client:WaitForChild("StreetRobot"))
local StreetShow = require(client:WaitForChild("StreetShow"))
local StreetBubble = require(client:WaitForChild("StreetBubble"))

local MAX_FIGURES = 8
local STAGE_SPOT = Vector3.new(5, 5, -9.5) -- where Room places the performer
local THEATRE = Vector3.new(0, 6, -2)
local ANIMATE_RANGE = 90

local c = StreetRobot.colors
local folder = Instance.new("Folder")
folder.Name = "HouseCrowd"
folder.Parent = workspace

local seats: { Seat } = {}
local function addSeat(item: Instance)
	if item:IsA("Seat") and item.Name == "Seat" and not table.find(seats, item) then
		table.insert(seats, item)
		-- Front row first, centre outwards: the seats a performer looks at.
		table.sort(seats, function(a, b)
			if math.abs(a.Position.Z - b.Position.Z) > 1 then
				return a.Position.Z < b.Position.Z
			end
			return math.abs(a.Position.X) < math.abs(b.Position.X)
		end)
	end
end
task.spawn(function()
	local set = workspace:WaitForChild("ShowSet")
	local rig = set:WaitForChild("ShowRig")
	for _, item in rig:GetChildren() do
		addSeat(item)
	end
	rig.ChildAdded:Connect(addSeat)
end)

type Figure = {
	robot: StreetRobot.Robot,
	seat: Seat?,
	poseDt: number,
}
local pool: { Figure } = {}
local bodies = {
	Color3.fromRGB(240, 222, 186),
	Color3.fromRGB(176, 208, 214),
	Color3.fromRGB(255, 220, 158),
	Color3.fromRGB(213, 190, 230),
}

local function badge(robot: StreetRobot.Robot)
	local gui = Instance.new("BillboardGui")
	gui.Name = "HouseBadge"
	gui.Adornee = robot.head
	gui.Size = UDim2.fromOffset(46, 16)
	gui.StudsOffsetWorldSpace = Vector3.new(0, 1.35 * robot.scale, 0)
	-- Readable to anyone walking the aisle, out of the way of the show cameras.
	gui.MaxDistance = 14
	gui.LightInfluence = 0
	local pill = Instance.new("TextLabel")
	pill.Size = UDim2.fromScale(1, 1)
	pill.BackgroundColor3 = c.champagne
	pill.TextColor3 = Color3.fromHex("242957")
	pill.Font = Enum.Font.FredokaOne
	pill.TextSize = 11
	pill.Text = "HOUSE"
	pill.Parent = gui
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0.5, 0)
	corner.Parent = pill
	local stroke = Instance.new("UIStroke")
	stroke.Color = Color3.fromHex("5b2338")
	stroke.Thickness = 1.5
	stroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	stroke.Parent = pill
	gui.Parent = robot.head
end

local function figure(index: number): Figure
	local existing = pool[index]
	if existing then
		return existing
	end
	-- A shared usher uniform (lacquer jacket, champagne cap) marks them as the house, not players.
	local robot = StreetRobot.build({
		name = "House" .. index,
		kind = "walker",
		scale = 0.9 + (index % 3) * 0.04,
		body = c.lacquer,
		casing = bodies[index % #bodies + 1],
		trim = c.ink,
		hat = "usher",
		hatColor = c.champagne,
	}, folder)
	robot.model.Parent = nil
	robot.base = "sit"
	robot.gesture = "sit"
	robot.sit = 1
	robot.sitTarget = 1
	badge(robot)
	local entry: Figure = { robot = robot, seat = nil, poseDt = 0 }
	pool[index] = entry
	return entry
end

local function place(f: Figure, seat: Seat)
	f.seat = seat
	local top = seat.Position + Vector3.new(0, 0.04, 0.2)
	local r = f.robot
	r.root = CFrame.new(top) * seat.CFrame.Rotation
	local rel = r.root:PointToObjectSpace(STAGE_SPOT) - Vector3.new(0, 2.5, 0)
	r.lookYaw = math.atan2(-rel.X, -rel.Z)
	r.lookPitch = math.atan2(rel.Y, math.sqrt(rel.X * rel.X + rel.Z * rel.Z))
	r.lookWeight = 0.75
	r.model.Parent = folder
	StreetRobot.animate(r, 0.5, os.clock(), true)
end

local function release(f: Figure)
	f.seat = nil
	f.robot.model.Parent = nil
end

local active = false
local hideAt = 0
local function refresh(now: number)
	local wanted = StreetShow.showOn() and StreetShow.watchers() < 3
	if wanted then
		active = true
		hideAt = math.huge
	elseif active and hideAt == math.huge then
		-- Let the house finish its reaction before it slips out.
		hideAt = now + 6
	end
	if active and now >= hideAt then
		active = false
	end
	local seated = 0
	for _, f in pool do
		local seat = f.seat
		if seat then
			if not active or seat.Occupant ~= nil or not seat.Parent then
				release(f)
			else
				seated += 1
			end
		end
	end
	if not active then
		return
	end
	-- Each robot keeps its seat; new ones take the best empty seats left.
	for _, seat in seats do
		if seated >= MAX_FIGURES then
			break
		end
		if seat.Parent and seat.Occupant == nil then
			local taken = false
			for _, f in pool do
				if f.seat == seat then
					taken = true
					break
				end
			end
			if not taken then
				local free: Figure? = nil
				for i = 1, MAX_FIGURES do
					local f = figure(i)
					if not f.seat then
						free = f
						break
					end
				end
				if free then
					place(free, seat)
					seated += 1
				end
			end
		end
	end
end

-- Roses: a short arc from the hand to the stage, a few seconds on the boards, then gone.
type Rose = { bloom: BasePart, stem: BasePart, from: Vector3, to: Vector3, born: number, landed: boolean }
local roses: { Rose } = {}
local rays = RaycastParams.new()
rays.FilterType = Enum.RaycastFilterType.Include
local function throwRose(f: Figure, now: number)
	local hand = f.robot.parts[4] -- right arm
	local from = hand.Position + Vector3.new(0, 1, 0)
	local target = Vector3.new(math.random(-60, 60) / 10, 6, math.random(-125, -80) / 10)
	local set = workspace:FindFirstChild("ShowSet")
	rays.FilterDescendantsInstances = if set then { set } else {}
	local hit = workspace:Raycast(target, Vector3.new(0, -8, 0), rays)
	local to = if hit then hit.Position + Vector3.new(0, 0.12, 0) else Vector3.new(target.X, 2.15, target.Z)
	local function bit(name: string, size: Vector3, color: Color3, shape: Enum.PartType): BasePart
		local p = Instance.new("Part")
		p.Name = name
		p.Shape = shape
		p.Size = size
		p.Color = color
		p.Material = Enum.Material.SmoothPlastic
		p.Anchored = true
		p.CanCollide = false
		p.CanQuery = false
		p.CanTouch = false
		p.CastShadow = false
		p.CFrame = CFrame.new(from)
		p.Parent = folder
		return p
	end
	table.insert(roses, {
		bloom = bit(
			"RoseBloom",
			Vector3.new(0.42, 0.42, 0.42),
			Color3.fromRGB(214, 48, 72),
			Enum.PartType.Ball
		),
		stem = bit(
			"RoseStem",
			Vector3.new(0.75, 0.08, 0.08),
			Color3.fromRGB(64, 128, 72),
			Enum.PartType.Cylinder
		),
		from = from,
		to = to,
		born = now,
		landed = false,
	})
end

local cheerSound: Sound? = nil
do
	local id = StreetBubble.soundId("HouseCheer")
	if id then
		local anchor = Instance.new("Part")
		anchor.Name = "HouseCheerAnchor"
		anchor.Anchored = true
		anchor.CanCollide = false
		anchor.CanQuery = false
		anchor.CanTouch = false
		anchor.Transparency = 1
		anchor.Size = Vector3.one
		anchor.Position = Vector3.new(0, 4, 7)
		anchor.Parent = folder
		local sound = Instance.new("Sound")
		sound.SoundId = id
		sound.RollOffMinDistance = 12
		sound.RollOffMaxDistance = 80
		sound.Parent = anchor
		cheerSound = sound
	end
end

StreetShow.onReveal(function(band: number, _encore: boolean)
	if not active or band < 0 then
		return
	end
	local now = os.clock()
	local thrown = 0
	local count = 0
	for _, f in pool do
		if f.seat then
			count += 1
			local delay = math.random() * 0.6
			local r = f.robot
			task.delay(delay, function()
				local t = os.clock()
				if band >= 3 then
					StreetRobot.play(r, "cheer", 3.2, t)
					task.delay(3.2, function()
						StreetRobot.play(r, "clap", 3, os.clock())
					end)
				elseif band == 2 then
					StreetRobot.play(r, if math.random() < 0.4 then "cheer" else "clap", 3.5, t)
				elseif band == 1 then
					StreetRobot.play(r, "clap", 3, t)
				else
					StreetRobot.play(r, "clap", 1.8, t)
				end
			end)
			local roseOdds = if band >= 3 then 0.6 elseif band == 2 then 0.2 else 0
			if thrown < 4 and math.random() < roseOdds then
				thrown += 1
				task.delay(delay + 0.5, function()
					throwRose(f, os.clock())
				end)
			end
		end
	end
	local sound = cheerSound
	if sound and count > 0 then
		sound.Volume = 0.25 + 0.15 * math.clamp(band, 0, 3)
		sound.PlaybackSpeed = 0.96 + math.random() * 0.08
		sound:Play()
	end
	hideAt = if hideAt == math.huge then hideAt else math.max(hideAt, now + 7)
end)

local slow = 0
RunService.Heartbeat:Connect(function(dt: number)
	local now = os.clock()
	slow += dt
	if slow >= 0.4 then
		slow = 0
		refresh(now)
	end
	local camera = workspace.CurrentCamera
	local inRange = camera ~= nil and (camera.CFrame.Position - THEATRE).Magnitude < ANIMATE_RANGE
	if inRange then
		for _, f in pool do
			if f.seat then
				f.poseDt += dt
				StreetRobot.animate(f.robot, f.poseDt, now, true)
				f.poseDt = 0
			end
		end
	end
	for i = #roses, 1, -1 do
		local rose = roses[i]
		local age = now - rose.born
		if age > 6.5 then
			rose.bloom:Destroy()
			rose.stem:Destroy()
			table.remove(roses, i)
		elseif age < 0.9 then
			local t = age / 0.9
			local p = rose.from:Lerp(rose.to, t) + Vector3.new(0, math.sin(t * math.pi) * 4, 0)
			local spin = CFrame.Angles(t * 9, t * 4, 0)
			rose.bloom.CFrame = CFrame.new(p) * spin * CFrame.new(0.38, 0, 0)
			rose.stem.CFrame = CFrame.new(p) * spin
		elseif not rose.landed then
			rose.landed = true
			local lie = CFrame.new(rose.to) * CFrame.Angles(0, math.random() * 6.28, 0)
			rose.stem.CFrame = lie
			rose.bloom.CFrame = lie * CFrame.new(0.38, 0.1, 0)
		end
	end
end)
