--!strict
-- Mounted only in Delivery-CampusQA.rbxl, in two separate Studio clients.
local Players = game:GetService("Players")
local storage = game:GetService("ReplicatedStorage")
local player = Players.LocalPlayer
local stage = storage:WaitForChild("Delivery"):WaitForChild("Stage") :: RemoteEvent
local test = storage:WaitForChild("CampusTest") :: RemoteEvent
local sent = {}
local takeStarts = {}
local function once(key, callback)
	if sent[key] then
		return
	end
	sent[key] = true
	callback()
end
local function playSheet(s, sheet, started, private)
	for index, beat in sheet.beats do
		task.delay(math.max(0, started + beat.at - workspace:GetServerTimeNow()), function()
			local input = { pad = beat.pad, index = index }
			if private then
				input.op = "practicePad"
				input.run = sheet.run
				stage:FireServer("venue", s.turn, input)
			else
				stage:FireServer("foleyPad", s.turn, input)
			end
		end)
	end
end
stage.OnClientEvent:Connect(function(s)
	local performer = test:GetAttribute("Performer")
	local step = test:GetAttribute("Step")
	if performer == nil or not step then
		return
	end
	local actor = player.UserId == performer
	local function act(verb, arg)
		stage:FireServer(verb, s.turn, arg)
	end
	local function report(key, data)
		once(key, function()
			test:FireServer(key, data)
		end)
	end
	if not actor then
		if step == "enter" then
			once("studio travel", function()
				act("venue", { op = "travel", room = "studio" })
			end)
			if s.venue.room == "studio" and not s.venue.watching then
				report("studio ready", {})
			end
		elseif step == "return" then
			once("theatre travel", function()
				act("venue", { op = "travel", room = "theatre" })
			end)
			if s.venue.room == "theatre" and s.venue.watching then
				report("theatre ready", {})
			end
		end
	end
	if step ~= "parallel" and step ~= "audience" then
		return
	end
	local first = step == "parallel"
	if actor then
		if
			(s.actor ~= performer or (not first and (s.phase == "intermission" or s.phase == "reveal")))
			and not s.queued
		then
			once(step .. " queue", function()
				act("queue", { mode = "Sound booth" })
			end)
		end
	end
	if s.actor ~= performer or s.mode ~= "Sound booth" then
		return
	end
	-- A new step may begin before the previous turn leaves its reveal.
	if not first and s.turn == test:GetAttribute("FirstTurn") then
		return
	end
	local key = s.turn .. "/" .. s.phase
	if actor then
		if s.phase == "lineup" then
			once(key, function()
				act("accept", "pads")
			end)
		elseif s.phase == "take" then
			once(key, function()
				takeStarts[s.turn] = s.deadline - 10
				playSheet(s, s.foley, s.deadline - 10, false)
			end)
		elseif s.phase == "reveal" then
			report(step .. " stage", {
				turn = s.turn,
				started = takeStarts[s.turn],
				hits = s.result.foleyHits,
				voters = s.result.voters,
				stage = s.standing.stage,
				xp = s.lastAward.xp,
				otherPractice = s.venue.practice ~= nil,
				score = s.result.overall,
			})
		end
	else
		if first and s.venue.practice and s.venue.practice.status == "playing" then
			once("private beats", function()
				playSheet(s, s.venue.practice, s.venue.practice.started, true)
			end)
		end
		if s.phase == "direct" then
			once(key, function()
				act("direct", 2)
				if first then
					task.delay(0.4, function()
						act("venue", { op = "practice" })
					end)
				end
			end)
		elseif s.phase == "take" then
			once(key, function()
				act("react", "Rose")
				act("predict", 3)
			end)
		elseif s.phase == "vote" then
			once(key, function()
				act("rate", 75)
			end)
		elseif s.phase == "reveal" then
			local private = s.venue.practice
			report(step .. " spectator", {
				turn = s.turn,
				room = s.venue.room,
				watching = s.venue.watching,
				privateStarted = private and private.started,
				privateEnded = private and private.finished,
				privateStatus = private and private.status,
				privateScore = private and private.score,
				privateXP = private and private.xp,
				crowd = s.standing.crowd,
				directed = s.directed,
				rated = s.rated,
				predicted = s.predicted,
				reacted = s.reacted,
				voters = s.result.voters,
				role = s.lastAward and s.lastAward.role,
				xp = s.lastAward and s.lastAward.xp,
			})
		end
	end
end)
test:GetAttributeChangedSignal("Step"):Connect(function()
	stage:FireServer("sync", 0)
end)
stage:FireServer("sync", 0)
