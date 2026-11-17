--!strict
local Players = game:GetService("Players")
local testService = game:GetService("StudioTestService")
local started = os.clock()
local test = Instance.new("RemoteEvent")
test.Name = "DeliveryTest"
test.Parent = game:GetService("ReplicatedStorage")
local count = 0
local seen = {}
local function finish(msg: string)
	print("DELIVERY_MULTIPLAYER", msg)
	testService:EndTest(msg)
end
test.OnServerEvent:Connect(function(p, turn, accuracy, voters, overall, directed, reacted, rated)
	if p.UserId == test:GetAttribute("Performer") or seen[turn] then
		return
	end
	if
		accuracy ~= 100
		or voters ~= 1
		or type(overall) ~= "number"
		or directed ~= 2
		or reacted ~= "Rose"
		or rated ~= 75
	then
		finish("FAIL incomplete round " .. tostring(turn))
		return
	end
	seen[turn] = true
	count += 1
	print("DELIVERY_TEST_ROUND", count, turn, overall)
	if count == 10 then
		finish(
			"PASS ten distinct scripted performer reveals, two clients, one crowd ballot and reaction each"
		)
	end
end)
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
