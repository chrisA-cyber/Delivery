--!strict
-- Mount only in a disposable local test place.
local Players = game:GetService("Players")
local p = Players.LocalPlayer
local shared = game:GetService("ReplicatedStorage")
local stage = shared:WaitForChild("Delivery"):WaitForChild("Stage") :: RemoteEvent
local test = shared:WaitForChild("DeliveryTest") :: RemoteEvent
local last = ""
local rounds = 0
local modes = { "Sound booth", "Main stage", "Switch", "Echo", "Daily", "Custom" }
local previewed = false
local seated = false
stage.OnClientEvent:Connect(function(s)
	local leader = test:GetAttribute("Performer")
	if not leader then
		return
	end
	local key = tostring(s.turn) .. s.phase
	if key == last then
		return
	end
	last = key
	local function act(verb: string, arg: any?)
		stage:FireServer(verb, s.turn, arg)
	end
	if p.UserId ~= leader and not seated then
		seated = true
		act("venue", { op = "travel", room = "theatre" })
	end
	if p.UserId == leader then
		if s.actor == p.UserId then
			if s.phase == "lineup" then
				act("accept", if s.mode == "Sound booth" then "pads" else "rehearsal")
			elseif s.phase == "take" then
				if s.foley then
					for index, beat in s.foley.beats do
						task.delay(
							math.max(0, s.deadline - 10 + beat.at - workspace:GetServerTimeNow()),
							function()
								stage:FireServer("foleyPad", s.turn, { index = index, pad = beat.pad })
							end
						)
					end
				else
					act("scripted")
				end
			elseif s.phase == "reveal" then
				rounds += 1
			end
		elseif not s.queued then
			act("queue", { mode = modes[rounds % #modes + 1], mix = 5 })
		end
		if s.phase == "intermission" and s.actor == p.UserId then
			task.delay(1.15, function()
				stage:FireServer("sync", 0)
			end)
		end
	elseif s.actor == leader then
		if not previewed then
			previewed = true
			act("stylePreview", "rose-gold")
		end
		if s.phase == "direct" then
			act("direct", math.min(2, #s.cues))
		elseif s.phase == "take" then
			act("react", "Rose")
			act("predict", 2)
		elseif s.phase == "vote" then
			act("rate", 75)
		elseif s.phase == "reveal" then
			test:FireServer(
				s.turn,
				s.result.accuracy,
				s.result.voters,
				s.result.overall,
				s.directed,
				s.reacted,
				s.rated,
				s.mode,
				s.predicted,
				s.standing.crowd,
				s.skin,
				s.simulated,
				s.useMic,
				s.heard,
				s.dailyLine,
				s.result.foleyHits,
				s.lastAward and s.lastAward.xp
			)
		end
	end
end)
test:GetAttributeChangedSignal("Performer"):Connect(function()
	stage:FireServer("sync", 0)
end)
stage:FireServer("sync", 0)
