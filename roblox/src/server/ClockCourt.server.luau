--!strict
local Players = game:GetService("Players")
local Storage = game:GetService("ReplicatedStorage")
local court = workspace:WaitForChild("ShowSet"):WaitForChild("ClockCourt")

local function prompt(parent, title, verb, radius)
	local action = Instance.new("ProximityPrompt")
	action.ObjectText = title
	action.ActionText = verb
	action.MaxActivationDistance = radius
	action.RequiresLineOfSight = false
	action.HoldDuration = 0.12
	action.Parent = parent
	return action
end

local function nearby(player, target, radius)
	local character = player.Character
	local hum = character and character:FindFirstChildOfClass("Humanoid")
	local root = character and character:FindFirstChild("HumanoidRootPart")
	return if root
			and hum
			and hum.Health > 0
			and (root.Position - target.Position).Magnitude <= radius
		then hum
		else nil
end

local cooldown = {}
local benchOf: { [Seat]: Player } = {}
Players.PlayerRemoving:Connect(function(player)
	cooldown[player] = nil
	for seat, who in benchOf do
		if who == player then
			benchOf[seat] = nil
		end
	end
end)
local chimes: { { bell: BasePart, brass: Color3, material: Enum.Material } } = {}
for index, name in { "Low", "Middle", "High" } do
	local handle = court:WaitForChild("ChimeHandle" .. name) :: BasePart
	local bell = court:WaitForChild("ChimeBell" .. name) :: BasePart
	table.insert(chimes, { bell = bell, brass = bell.Color, material = bell.Material })
	local tone = Instance.new("Sound")
	tone.Name = "BellTone"
	tone.SoundId = "rbxasset://sounds/volume_slider.ogg"
	tone.PlaybackSpeed = ({ 0.94, 1.18, 1.41 })[index]
	tone.Volume = 0.64
	tone.RollOffMode = Enum.RollOffMode.InverseTapered
	tone.RollOffMinDistance = 7
	tone.RollOffMaxDistance = 35
	tone.Parent = bell
	local readyAt = 0
	local brass = bell.Color
	local action = prompt(handle, "Clock Court • " .. name .. " bell", "Pull chime", 6)
	action.Exclusivity = Enum.ProximityPromptExclusivity.AlwaysShow
	action.ClickablePrompt = true
	action.UIOffset = Vector2.new((index - 2) * 68, 0)
	action.Triggered:Connect(function(player)
		local time = os.clock()
		if time < readyAt or time < (cooldown[player] or 0) or not nearby(player, handle, 8) then
			return
		end
		readyAt = time + 0.50
		cooldown[player] = time + 0.23
		tone.TimePosition = 0
		tone:Play()
		bell.Color = Color3.fromRGB(251, 214, 123)
		task.delay(0.32, function()
			if bell.Parent then
				bell.Color = brass
			end
		end)
	end)
end

for _, anchor in court:GetChildren() do
	if not anchor:IsA("BasePart") or not string.match(anchor.Name, "^CourtSeat%d+$") then
		continue
	end
	local seat = Instance.new("Seat")
	seat.Name = "BenchSeat"
	seat.Size = Vector3.new(2.0, 0.16, 1.35)
	seat.CFrame = anchor.CFrame
	seat.Transparency = 1
	seat.Anchored = true
	seat.CanCollide = false
	seat.CanTouch = false
	seat.Parent = anchor
	local action = prompt(anchor, "Clock Court bench", "Take a seat", 5)
	action.Triggered:Connect(function(player)
		local hum = nearby(player, anchor, 7)
		if hum and not hum.SeatPart and not seat.Occupant then
			seat:Sit(hum)
		end
	end)
	-- Bench sitters join the outdoor audience. Main.server reads this server-set attribute and
	-- re-checks the seat weld before accepting any of their votes or reactions.
	seat:GetPropertyChangedSignal("Occupant"):Connect(function()
		action.Enabled = seat.Occupant == nil
		local occupant = seat.Occupant
		local player = if occupant then Players:GetPlayerFromCharacter(occupant.Parent) else nil
		local previous = benchOf[seat]
		benchOf[seat] = player
		if previous and previous ~= player then
			local elsewhere = false
			for _, who in benchOf do
				elsewhere = elsewhere or who == previous
			end
			if not elsewhere and previous.Parent == Players then
				previous:SetAttribute("CourtAudience", nil)
			end
		end
		if player then
			player:SetAttribute("CourtAudience", true)
		end
	end)
end

-- After every reveal the court strikes the verdict: one, two or three bells by score band.
do
	local ids = require(Storage:WaitForChild("Delivery"):WaitForChild("SoundIds")) :: any
	local lantern = court:FindFirstChild("ClockLantern")
	local tower = if lantern and lantern:IsA("BasePart") then lantern else chimes[2].bell
	local tolls = {}
	for index, speed in { 0.7, 0.88, 1.05 } do
		local toll = Instance.new("Sound")
		toll.Name = "VerdictToll" .. index
		local asset = tonumber(ids.Bell) or 0
		toll.SoundId = if asset > 0 then "rbxassetid://" .. asset else "rbxasset://sounds/volume_slider.ogg"
		toll.PlaybackSpeed = if asset > 0 then speed * 1.2 else speed
		toll.Volume = 1
		toll.RollOffMode = Enum.RollOffMode.InverseTapered
		toll.RollOffMinDistance = 40
		toll.RollOffMaxDistance = 260
		toll.Parent = tower
		tolls[index] = toll
	end
	local glow = Instance.new("PointLight")
	glow.Name = "VerdictGlow"
	glow.Color = Color3.fromRGB(255, 220, 158)
	glow.Brightness = 3
	glow.Range = 22
	glow.Shadows = false
	glow.Enabled = false
	glow.Parent = tower
	local generation = 0
	local function strike(band: number)
		generation += 1
		local token = generation
		for i = 1, math.clamp(band, 0, 3) do
			if token ~= generation then
				return
			end
			local chime = chimes[i]
			local toll = tolls[i]
			toll.TimePosition = 0
			toll:Play()
			local tone = chime.bell:FindFirstChild("BellTone")
			if tone and tone:IsA("Sound") then
				tone.TimePosition = 0
				tone:Play()
			end
			glow.Enabled = true
			chime.bell.Color = Color3.fromRGB(255, 220, 158)
			chime.bell.Material = Enum.Material.Neon
			task.wait(0.5)
			glow.Enabled = false
			chime.bell.Color = chime.brass
			chime.bell.Material = chime.material
			task.wait(0.45)
		end
	end
	task.spawn(function()
		local status = Storage:WaitForChild("ShowStatus", 60)
		if not status then
			return
		end
		status:GetAttributeChangedSignal("Round"):Connect(function()
			if status:GetAttribute("Phase") == "reveal" then
				task.spawn(strike, tonumber(status:GetAttribute("LastBand")) or 0)
			end
		end)
	end)
end

local faces = {}
for _, angle in { 0, 90, 180, 270 } do
	table.insert(faces, {
		center = (court:WaitForChild("ClockAxis" .. angle) :: BasePart).CFrame,
		hour = court:WaitForChild("HourHand" .. angle) :: BasePart,
		minute = court:WaitForChild("MinuteHand" .. angle) :: BasePart,
	})
end
-- All four faces tell UTC and advance together. No per-frame replication is needed.
local function setHand(hand, center, angle, depth)
	hand.CFrame = center * CFrame.Angles(0, 0, -angle) * CFrame.new(0, hand.Size.Y / 2, depth)
end
while court.Parent do
	local time = DateTime.now():ToUniversalTime()
	for _, face in faces do
		setHand(face.hour, face.center, (time.Hour % 12 + time.Minute / 60) * math.pi / 6, 0)
		setHand(face.minute, face.center, time.Minute * math.pi / 30, 0.06)
	end
	task.wait(60 - time.Second)
end
