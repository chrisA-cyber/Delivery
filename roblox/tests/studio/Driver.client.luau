--!strict
-- Mount only in a disposable local test place.
local Players = game:GetService("Players")
local p = Players.LocalPlayer
local shared = game:GetService("ReplicatedStorage")
local stage = shared:WaitForChild("Delivery"):WaitForChild("Stage") :: RemoteEvent
local test = shared:WaitForChild("DeliveryTest") :: RemoteEvent
local last = ""
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
	if p.UserId == leader then
		if s.actor == p.UserId then
			if s.phase == "lineup" then
				act("accept")
			elseif s.phase == "take" then
				act("scripted")
			end
		elseif not s.queued then
			act("queue")
		end
		if s.phase == "intermission" and s.actor == p.UserId then
			task.delay(1.15, function()
				stage:FireServer("sync", 0)
			end)
		end
	elseif s.actor == leader then
		if s.phase == "direct" then
			act("direct", 2)
		elseif s.phase == "take" then
			act("react", "Rose")
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
				s.rated
			)
		end
	end
end)
test:GetAttributeChangedSignal("Performer"):Connect(function()
	stage:FireServer("sync", 0)
end)
stage:FireServer("sync", 0)
