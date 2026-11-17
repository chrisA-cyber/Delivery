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
local Measure = require(shared.Measure)
local features = require(shared.Features)
local audio = require(script.Parent.StageVoice).new(features.StageVoice)
local captions = {}
local host = require(script.Parent.Host).new(require(shared.HostLines), features)
local function claim(p, data, simulated)
	local now = clock()
	if
		state.actor ~= p.UserId
		or state.claim
		or (state.phase ~= "take" and state.phase ~= "read")
		or now >= state.untilTime
	then
		return false
	end
	if not Measure.valid(data, now - state.started) then
		return false
	end
	local accuracy = Score.accuracy(state.line.text, data.words)
	local measured, pace, relative = Measure.read(data, state.cue.measure)
	if accuracy == nil or pace == nil then
		return false
	end
	state.claim = {
		accuracy = accuracy,
		commitment = measured,
		pace = pace,
		relative = relative,
		simulated = simulated,
	}
	local turn = state.turn
	captions[p.UserId] = nil
	if simulated then
		captions[p.UserId] = state.line.text
	else
		task.spawn(function()
			local ok, filtered = pcall(function()
				return game:GetService("TextService")
					:FilterStringAsync(data.words, p.UserId)
					:GetNonChatStringForBroadcastAsync()
			end)
			if
				state.turn == turn
				and state.actor == p.UserId
				and p.Parent == Players
				and ok
				and type(filtered) == "string"
				and filtered:match("[^#%s]")
			then
				captions[p.UserId] = filtered
			end
		end)
	end
	return true
end
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
		hostLine = if state.phase == "host" or state.phase == "reveal" then state.hostLine else nil,
		queued = table.find(state.queue, id),
		directed = state.ballots[id],
		rated = state.ratings[id],
		reacted = state.reactions[id],
		reactions = state.reactionCount,
		lastReaction = state.lastReaction,
		studio = RunService:IsStudio(),
		heard = if id == state.actor and state.claim then (captions[id] or "Caption unavailable") else nil,
		pace = if state.claim then state.claim.pace else nil,
		relative = if state.claim then state.claim.relative else nil,
		simulated = state.claim and state.claim.simulated,
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
	if state.phase == "vote" then
		host.prepare(state)
	elseif state.phase == "host" then
		host.speak(state.hostLine or "The room has spoken.", 1.5)
	elseif state.phase == "take" and state.actor == 0 then
		host.speak(state.line.text, 4)
	elseif state.phase == "direct" or state.phase == "read" or state.phase == "intermission" then
		host.silence()
	end
	if state.phase ~= "take" then
		audio.stop()
	end
	if state.phase == "lobby" or state.phase == "intermission" then
		table.clear(captions)
	end
	if state.phase == "take" and state.actor ~= 0 then
		local p = Players:GetPlayerByUserId(state.actor)
		if p then
			audio.start(p)
		end
	end
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
	captions[p.UserId] = nil
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
	if verb == "claim" then
		if features.SpeechInput and claim(p, arg, false) then
			send(p)
		end
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
			local sample = Measure.synthetic(state.line.text)
			-- A fixture follows the same duration and validation path as a real report.
			local key = state.turn
			task.delay(math.max(0, 5 - (now - state.started)), function()
				if state.turn == key and claim(p, sample, true) then
					send(p)
				end
			end)
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
