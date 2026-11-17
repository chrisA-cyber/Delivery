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
local Modes = require(shared.Modes)
local function daily()
	local day = os.date("!%Y-%m-%d")
	local line, cue = Deck.daily(catalogue, day)
	return line, cue, day
end
local state = Show.new(Deck.new(catalogue, tostring(os.time())), Score, Modes, daily)
local standings = {}
local lastAward = 0
local honours = ""
local function award()
	if state.turn == lastAward then
		return
	end
	lastAward = state.turn
	local result = state.result
	for id in state.online do
		local row = standings[id]
		if not row then
			continue
		end
		if id == state.actor then
			if result.overall and not result.miss then
				row.stage += 10
				row.best = math.max(row.best, result.overall)
				row.streak = if result.overall >= 70 then row.streak + 1 else 0
				row.roses = math.max(row.roses, state.reactionCount)
			end
		else
			local xp = (if state.ballots[id] then 2 else 0) + (if state.reactions[id] then 1 else 0)
			if state.ratings[id] then
				xp += 3
				if result.voters >= 2 and math.abs(state.ratings[id] - result.comedy) <= 15 then
					xp += 2
				end
			end
			if
				result.overall
				and state.predictions[id]
					== (if result.overall < 60 then 1 elseif result.overall < 90 then 2 else 3)
			then
				xp += 3
				row.calls += 1
			end
			row.crowd += xp
		end
	end
	if state.turn % 4 == 0 then
		local function leader(key)
			local high = 0
			local name = "—"
			for id, r in standings do
				local p = Players:GetPlayerByUserId(id)
				if p and r[key] > high then
					high = r[key]
					name = p.DisplayName
				end
			end
			return name
		end
		honours = "Best take: "
			.. leader("best")
			.. "   ·   Sharpest call: "
			.. leader("calls")
			.. "   ·   Most reactions: "
			.. leader("roses")
	end
end
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
	local accuracy = Score.accuracy(Modes.expected(state), data.words)
	local measured, pace, relative = Measure.read(data, state.cue.measure)
	if state.mode == "Switch" then
		measured = Modes.switchMeasure(data)
	end
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
		mode = state.mode,
		predicted = state.predictions[id],
		duel = state.duel and { first = state.duel.first, second = state.duel.second },
		duelVoted = state.duelVotes[id],
		winner = state.duelWinner,
		standing = standings[id],
		honours = honours,
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
	if state.phase == "reveal" then
		award()
	end
	if state.phase == "direct" and state.mode == "Echo" then
		host.speak(state.line.text, 2)
	elseif state.phase == "vote" then
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
	standings[p.UserId] = { stage = 0, crowd = 0, best = 0, streak = 0, roses = 0, calls = 0 }
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
	standings[p.UserId] = nil
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
			local sample = Measure.synthetic(Modes.expected(state))
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
