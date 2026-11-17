--!strict
local Players = game:GetService("Players")
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
Players.PlayerRemoving:Connect(function(player)
	cooldown[player] = nil
end)
for index, name in { "Low", "Middle", "High" } do
	local handle = court:WaitForChild("ChimeHandle" .. name) :: BasePart
	local bell = court:WaitForChild("ChimeBell" .. name) :: BasePart
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
	seat:GetPropertyChangedSignal("Occupant"):Connect(function()
		action.Enabled = seat.Occupant == nil
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
