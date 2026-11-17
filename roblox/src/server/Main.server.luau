--!strict
local Players = game:GetService("Players")
local Storage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local shared = Storage:WaitForChild("Delivery")
local Deck = require(shared.Deck)
local catalogue = require(shared.Catalogue)
local Score = require(shared.Score)
local Show = require(script.Parent.Show)
local room = require(script.Parent.Room).build()
local state = Show.new(Deck.new(catalogue, tostring(os.time())), Score)
local remote = Instance.new("RemoteEvent")
remote.Name = "Stage"
remote.Parent = shared
local clock = function()
	return workspace:GetServerTimeNow()
end
local limits = {}
local function send(player: Player)
	local id = player.UserId
	remote:FireClient(player, {
		phase = state.phase,
		deadline = state.untilTime,
		turn = state.turn,
		actor = state.actor,
		line = state.line,
		cues = state.cues,
		cue = state.cue,
		result = state.result,
		queued = table.find(state.queue, id),
		directed = state.ballots[id],
		rated = state.ratings[id],
		reacted = state.reactions[id],
		reactions = state.reactionCount,
		lastReaction = state.lastReaction,
		studio = RunService:IsStudio(),
	})
end
local function publish()
	for _, player in Players:GetPlayers() do
		send(player)
	end
	local line = state.line
	room.sign.Text = if state.phase == "reveal" and state.result
		then (state.result.band .. "   " .. tostring(state.result.overall or "—"))
		elseif line then line.text
		else "DELIVERY"
end
local function phaseChanged()
	if state.phase == "countdown" and state.actor ~= 0 then
		local p = Players:GetPlayerByUserId(state.actor)
		if p then
			room.place(p, true)
		end
	elseif state.phase == "intermission" and state.actor ~= 0 then
		local p = Players:GetPlayerByUserId(state.actor)
		if p then
			room.place(p, false)
		end
	elseif state.phase == "take" and state.actor == 0 then
		-- The house bit is authored. It has no microphone, measurements or ranked score.
		state.claim = { accuracy = nil, commitment = nil }
	end
	publish()
end
local function join(p: Player)
	Show.join(state, p.UserId, clock())
	p.CharacterAdded:Connect(function(char)
		char:WaitForChild("Humanoid", 8)
		char:WaitForChild("HumanoidRootPart", 8)
		if p.Character == char and p.UserId ~= state.actor then
			room.place(p, false)
		end
	end)
end
Players.PlayerAdded:Connect(join)
for _, p in Players:GetPlayers() do
	join(p)
end
Players.PlayerRemoving:Connect(function(p)
	Show.leave(state, p.UserId, clock())
	limits[p.UserId] = nil
	phaseChanged()
end)
remote.OnServerEvent:Connect(function(p: Player, verb: any, turn: any, arg: any)
	local now = clock()
	local id = p.UserId
	if type(verb) ~= "string" or #verb > 20 or type(turn) ~= "number" then
		return
	end
	local bucket = limits[id]
	if not bucket or now - bucket.start >= 1 then
		bucket = { start = now, n = 0 }
		limits[id] = bucket
	end
	bucket.n += 1
	if bucket.n > 12 then
		return
	end
	if verb == "sync" then
		send(p)
		return
	end
	if turn ~= state.turn then
		return
	end
	if verb == "scripted" then
		if
			RunService:IsStudio()
			and state.actor == id
			and state.phase == "take"
			and now < state.untilTime
			and not state.claim
		then
			state.claim = { accuracy = Score.accuracy(state.line.text, state.line.text), commitment = nil }
			send(p)
		end
		return
	end
	local prior = state.phase
	if Show.action(state, id, verb, arg, now) then
		if prior ~= state.phase then
			phaseChanged()
		else
			publish()
		end
	end
end)
task.spawn(function()
	while true do
		if Show.tick(state, clock()) then
			phaseChanged()
		end
		task.wait(0.1)
	end
end)
