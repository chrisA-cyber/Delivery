--!strict
-- Validates state independently reported by two networked Studio clients.
local Players = game:GetService("Players")
local service = game:GetService("StudioTestService")
local test = Instance.new("RemoteEvent")
test.Name = "CampusTest"
test.Parent = game:GetService("ReplicatedStorage")
local finished = false
local markers = {}
local firstStageStart, privateStart, privateEnd
local function finish(message)
	if finished then
		return
	end
	finished = true
	print("DELIVERY_CAMPUS_QA", message)
	service:EndTest(message)
end
local function reject(name, detail)
	finish("FAIL " .. name .. " · " .. detail)
end
test.OnServerEvent:Connect(function(p, name, row)
	if finished or markers[name] then
		return
	end
	local actor = p.UserId == test:GetAttribute("Performer")
	local step = test:GetAttribute("Step")
	local character = p.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	local hum = character and character:FindFirstChildOfClass("Humanoid")
	if type(row) ~= "table" or not root or not hum then
		reject(name, "missing client snapshot or character")
		return
	end
	if name == "studio ready" and step == "enter" and not actor then
		local console = workspace.ShowSet:FindFirstChild("VenueStudioB", true)
		if not console or (root.Position - console.Position).Magnitude > 14 or hum.SeatPart then
			reject(name, "physical studio arrival")
			return
		end
		markers[name] = true
		print("DELIVERY_CAMPUS_MARK", "studio-ready", "private console reached")
		test:SetAttribute("Step", "parallel")
	elseif name == "theatre ready" and step == "return" and not actor then
		local waitUntil = os.clock() + 3
		while not hum.SeatPart and os.clock() < waitUntil do
			task.wait(0.1)
		end
		if not hum.SeatPart then
			reject(name, "audience seat missing on server")
			return
		end
		markers[name] = true
		print("DELIVERY_CAMPUS_MARK", "audience-ready", "optional seat occupied")
		test:SetAttribute("Step", "audience")
	elseif
		(step == "parallel" or step == "audience")
		and (name == step .. " stage" or name == step .. " spectator")
	then
		local first = step == "parallel"
		if name == step .. " stage" and actor then
			if
				row.hits ~= 3
				or row.voters ~= (if first then 0 else 1)
				or row.otherPractice
				or not row.xp
				or row.xp < 10
				or type(row.score) ~= "number"
			then
				reject(
					name,
					string.format(
						"hits=%s voters=%s private-state-leak=%s xp=%s",
						tostring(row.hits),
						tostring(row.voters),
						tostring(row.otherPractice),
						tostring(row.xp)
					)
				)
				return
			end
			if first then
				firstStageStart = row.started
			end
			print(
				"DELIVERY_CAMPUS_MARK",
				name,
				row.turn,
				"hits",
				row.hits,
				"voters",
				row.voters,
				"XP",
				row.xp
			)
		elseif name == step .. " spectator" and not actor then
			if first then
				if
					row.room ~= "studio"
					or row.watching
					or row.privateStatus ~= "done"
					or row.privateScore ~= 100
					or row.privateXP ~= 6
					or row.crowd ~= 0
					or row.directed
					or row.rated
					or row.predicted
					or row.reacted
					or row.voters ~= 0
				then
					reject(
						name,
						string.format(
							"room=%s watching=%s drill=%s score=%s xp=%s crowd=%s voters=%s",
							tostring(row.room),
							tostring(row.watching),
							tostring(row.privateStatus),
							tostring(row.privateScore),
							tostring(row.privateXP),
							tostring(row.crowd),
							tostring(row.voters)
						)
					)
					return
				end
				privateStart, privateEnd = row.privateStarted, row.privateEnded
				print(
					"DELIVERY_CAMPUS_MARK",
					"private-drill",
					row.turn,
					"score",
					row.privateScore,
					"personal-XP",
					row.privateXP,
					"audience-XP",
					row.crowd,
					"voters",
					row.voters
				)
			else
				if
					row.room ~= "theatre"
					or not row.watching
					or row.voters ~= 1
					or row.directed ~= 2
					or row.reacted ~= "Rose"
					or row.rated ~= 75
					or row.predicted ~= 3
					or row.role ~= "crowd"
					or row.xp < 6
				then
					reject(
						name,
						string.format(
							"room=%s votes=%s dir=%s rating=%s xp=%s",
							tostring(row.room),
							tostring(row.voters),
							tostring(row.directed),
							tostring(row.rated),
							tostring(row.xp)
						)
					)
					return
				end
				print(
					"DELIVERY_CAMPUS_MARK",
					"audience-round",
					row.turn,
					"dir",
					row.directed,
					"rating",
					row.rated,
					"XP",
					row.xp
				)
			end
		else
			reject(name, "wrong client role")
			return
		end
		markers[name] = row.turn
		if markers[step .. " stage"] and markers[step .. " spectator"] then
			if markers[step .. " stage"] ~= markers[step .. " spectator"] then
				reject(name, "clients reported different turns")
				return
			end
			if first then
				if
					type(firstStageStart) ~= "number"
					or type(privateStart) ~= "number"
					or type(privateEnd) ~= "number"
				then
					reject(name, "missing performance timing")
					return
				end
				local overlap = math.min(privateEnd, firstStageStart + 10)
					- math.max(privateStart, firstStageStart)
				if overlap <= 0 then
					reject(name, "private and onstage takes did not overlap")
					return
				end
				print("DELIVERY_CAMPUS_MARK", "overlap-seconds", math.round(100 * overlap) / 100)
				test:SetAttribute("FirstTurn", row.turn)
				test:SetAttribute("Step", "return")
			else
				if row.turn == test:GetAttribute("FirstTurn") then
					reject(name, "reused turn")
					return
				end
				finish(
					"PASS separate private drill and stage performance overlapped, outside crowd actions rejected, returning audience seat directed/reacted/predicted/rated the next performer round"
				)
			end
		end
	end
end)
task.spawn(function()
	local start = os.clock()
	while os.clock() - start < 60 do
		local list = Players:GetPlayers()
		if
			#list == 2
			and list[1].Character
			and list[1].Character:FindFirstChild("HumanoidRootPart")
			and list[2].Character
			and list[2].Character:FindFirstChild("HumanoidRootPart")
		then
			test:SetAttribute("Performer", list[1].UserId)
			test:SetAttribute("Step", "enter")
			return
		end
		task.wait(0.2)
	end
	finish("FAIL two clients and live characters did not arrive")
end)
task.delay(195, function()
	finish("FAIL deadline while in " .. tostring(test:GetAttribute("Step")))
end)
