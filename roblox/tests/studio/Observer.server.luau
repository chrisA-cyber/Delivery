--!strict
local Players = game:GetService("Players")
local testService = game:GetService("StudioTestService")
local started = os.clock()
local test = Instance.new("RemoteEvent")
test.Name = "DeliveryTest"
test.Parent = game:GetService("ReplicatedStorage")
local count = 0
local seen = {}
local modes = { "Main stage", "Switch", "Echo", "Daily", "Custom" }
local lastCrowd = 0
local function finish(msg: string)
	print("DELIVERY_MULTIPLAYER", msg)
	testService:EndTest(msg)
end
test.OnServerEvent:Connect(
	function(
		p,
		turn,
		accuracy,
		voters,
		overall,
		directed,
		reacted,
		rated,
		mode,
		prediction,
		crowd,
		skin,
		simulated,
		useMic,
		heard,
		dailyLine
	)
		if p.UserId == test:GetAttribute("Performer") or seen[turn] then
			return
		end
		if
			accuracy ~= 100
			or voters ~= 1
			or type(overall) ~= "number"
			or directed ~= (if mode == "Daily" or mode == "Switch" or mode == "Echo" then 1 else 2)
			or mode ~= modes[count % #modes + 1]
			or prediction ~= 2
			or crowd <= lastCrowd
			or skin ~= "rose-gold"
			or simulated ~= true
			or useMic ~= false
			or heard ~= nil
			or workspace:FindFirstChild("StageAudio") ~= nil
			or reacted ~= "Rose"
			or rated ~= 75
		then
			finish(
				string.format(
					"FAIL round %s mode=%s dir=%s crowd=%s skin=%s score=%s voters=%s simulated=%s useMic=%s",
					tostring(turn),
					tostring(mode),
					tostring(directed),
					tostring(crowd),
					tostring(skin),
					tostring(accuracy),
					tostring(voters),
					tostring(simulated),
					tostring(useMic)
				)
			)
			return
		end
		lastCrowd = crowd
		seen[turn] = true
		count += 1
		print("DELIVERY_TEST_ROUND", count, turn, mode, overall, crowd, dailyLine)
		if count == 10 then
			finish(
				"PASS ten distinct scripted reveals across five modes, two clients, crowd XP growth, one ballot and reaction each, private captions, Studio wardrobe preview and rehearsal with no stage mic"
			)
		end
	end
)
task.spawn(function()
	while #Players:GetPlayers() < 2 and os.clock() - started < 60 do
		task.wait(0.25)
	end
	if #Players:GetPlayers() ~= 2 then
		finish("FAIL two clients did not join")
		return
	end
	test:SetAttribute("Performer", Players:GetPlayers()[1].UserId)
end)
task.delay(690, function()
	finish("FAIL deadline after " .. count .. " full rounds")
end)
