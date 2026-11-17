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
local dailyCache = {}
local function daily()
	local day = os.date("!%Y-%m-%d")
	if dailyCache.day ~= day then
		local line, cue = Deck.daily(catalogue, day)
		local featured = ({
			"Spawn Point",
			"Checkpoint Drama",
			"Tycoon Problems",
			"Control Room",
			"Backstage",
		})[math.floor((os.time() / 86400 + 3) / 7) % 5 + 1]
		local weekly = {}
		for _, item in catalogue.lines do
			if item.pack == featured then
				table.insert(weekly, item)
			end
		end
		dailyCache = { day = day, line = line, cue = cue, weekly = weekly }
	end
	return dailyCache.line, dailyCache.cue, day, dailyCache.weekly
end
local state = Show.new(Deck.new(catalogue, tostring(os.time())), Score, Modes, daily)
local standings = {}
local Market = game:GetService("MarketplaceService")
local Analytics = game:GetService("AnalyticsService")
local wardrobe = require(shared.Wardrobe)
local shelf = require(script.Parent.Shelf).new(wardrobe, function(p, pass)
	return Market:UserOwnsGamePassAsync(p.UserId, pass)
end, RunService:IsStudio())
local metrics = require(script.Parent.Metrics).new(function(p, key)
	if RunService:IsStudio() then
		print("Delivery metric", key)
	else
		task.spawn(function()
			pcall(Analytics.LogCustomEvent, Analytics, p, "delivery_" .. key, 1)
		end)
	end
end)
local findShow = require(script.Parent.BusierShow).new()
local programme = require(script.Parent.Playbills).start(require(shared.Programme))
local participation = {}
local function observed(p, turn)
	local entry = participation[p]
	if not entry then
		participation[p] = { turn = turn }
	elseif entry.turn ~= turn then
		metrics.once(p, "second_round")
	end
end
local Profiles = require(script.Parent.Profiles)
local saves = require(script.Parent.Saves).new(standings)
local friends = {}
local function checkFriends(p)
	friends[p] = {}
	for _, other in Players:GetPlayers() do
		if other ~= p and friends[other] then
			task.spawn(function()
				local ok, connected = pcall(p.IsFriendsWithAsync, p, other.UserId)
				if ok and connected and friends[p] and friends[other] then
					friends[p][other] = true
					friends[other][p] = true
				end
			end)
		end
	end
end
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
		local before = row.stage + row.crowd
		local player = Players:GetPlayerByUserId(id)
		if player and row.returned then
			metrics.once(player, "next_day_return")
		end
		if id == state.actor and player then
			observed(player, state.turn)
			if state.useMic then
				metrics.take(player, result.miss)
				if not result.miss then
					metrics.once(player, "first_take")
				end
			end
		end
		if id == state.actor then
			local day = if state.day
				then math.floor(DateTime.fromIsoDate(state.day .. "T00:00:00Z").UnixTimestamp / 86400)
				else math.floor(os.time() / 86400)
			Profiles.record(row, state, day)
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
		if row.stage + row.crowd > before and player and friends[player] and next(friends[player]) then
			if id == state.actor then
				row.stage += 1
			else
				row.crowd += 1
			end
		end
		Profiles.week(row, math.floor((os.time() / 86400 + 3) / 7), row.stage + row.crowd - before)
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
local wave = Instance.new("RemoteEvent")
wave.Name = "Meter"
wave.Parent = shared
local lastWave = 0
local limits = {}
local Measure = require(shared.Measure)
local features = require(shared.Features)
local audio = require(script.Parent.StageVoice).new(features.StageVoice)
local captions = {}
local host = require(script.Parent.Host).new(require(shared.HostLines), features)
local send
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
				send(p)
			end
		end)
	end
	return true
end
send = function(player: Player)
	local id = player.UserId
	local today, dailyCue = daily()
	local actor = Players:GetPlayerByUserId(state.actor)
	local reactor = state.lastReactor and Players:GetPlayerByUserId(state.lastReactor)
	remote:FireClient(player, {
		phase = state.phase,
		mode = state.mode,
		useMic = state.useMic,
		skin = shelf.active[player],
		actorSkin = if actor
			then shelf.active[actor] or (if standings[actor.UserId]
					and standings[actor.UserId].stage >= 40
				then "house-entrance"
				else nil)
			else nil,
		reactionSkin = if reactor then shelf.active[reactor] else nil,
		actorStage = if actor and standings[actor.UserId] then standings[actor.UserId].stage else 0,
		reactorCrowd = if reactor and standings[reactor.UserId] then standings[reactor.UserId].crowd else 0,
		predicted = state.predictions[id],
		duel = state.duel and { first = state.duel.first, second = state.duel.second },
		duelVoted = state.duelVotes[id],
		winner = state.duelWinner,
		encore = state.encore and state.result ~= nil and (state.result.overall or 0) >= 75,
		alone = #Players:GetPlayers() == 1,
		standing = standings[id],
		saveStatus = saves.status[player],
		dailyLine = today.text,
		dailyCue = dailyCue.label,
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
	local today, cue = daily()
	room.daily.Text = "DAILY SHOW\n" .. today.text .. "\n" .. cue.label
	local line = state.line
	room.sign.Text = if state.phase == "reveal" and state.result
		then (state.result.band .. "   " .. tostring(state.result.overall or "—"))
		elseif state.phase == "host" and state.hostLine then state.hostLine
		elseif line and state.mode == "Echo" then Modes.beat(line.text) .. "\nCopy the beat"
		elseif line and state.cue then line.text .. "\n" .. state.cue.label
		elseif line then line.text
		else "DELIVERY"
end
local lastPerformer: Player? = nil
local function phaseChanged()
	if state.phase == "lobby" or state.phase == "intermission" then
		state.claim = nil
	end
	if state.phase == "reveal" then
		award()
	end
	if state.phase == "direct" and state.mode == "Echo" then
		host.speak(Modes.beat(state.line.text), 5)
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
	if state.phase == "take" and state.actor ~= 0 and state.useMic then
		local p = Players:GetPlayerByUserId(state.actor)
		if p then
			audio.start(
				p,
				state.mode == "Echo"
					and standings[p.UserId]
					and standings[p.UserId].packs["Pack night"] == true
			)
		end
	end
	if state.phase == "countdown" and state.actor ~= 0 then
		local p = Players:GetPlayerByUserId(state.actor)
		if p then
			lastPerformer = p
			room.place(p, true)
		end
	elseif state.phase == "lobby" and lastPerformer then
		local p = lastPerformer
		lastPerformer = nil
		if p and p.Parent == Players then
			room.place(p, false)
		end
	elseif state.phase == "take" and state.actor == 0 then
		-- The house bit is authored. It has no microphone, measurements or ranked score.
		state.claim = { accuracy = nil, commitment = nil }
	end
	publish()
end
local function join(p: Player)
	checkFriends(p)
	task.spawn(programme.load, p)
	metrics.once(p, "join")
	local arrival = p:GetJoinData()
	if (arrival.ReferredByPlayerId or 0) > 0 then
		metrics.once(p, "invite_join")
	end
	standings[p.UserId] = Profiles.blank()
	saves.load(p)
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
	friends[p] = nil
	for _, peers in friends do
		peers[p] = nil
	end
	metrics.leave(p)
	shelf.leave(p)
	participation[p] = nil
	local previous = state.phase
	Show.leave(state, p.UserId, clock())
	standings[p.UserId] = nil
	task.spawn(saves.close, p)
	limits[p.UserId] = nil
	captions[p.UserId] = nil
	if previous ~= state.phase then
		phaseChanged()
	else
		publish()
	end
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
	if verb == "busier" then
		if not bucket.match and not state.useMic and state.actor ~= id then
			bucket.match = true
			task.spawn(function()
				local message = findShow(p)
				if p.Parent == Players then
					p:SetAttribute("RoomFinder", message)
				end
			end)
		end
		return
	end
	if verb == "accept" and not RunService:IsStudio() and arg ~= "mic" then
		return
	end
	if verb == "encore" and (not state.result or (state.result.overall or 0) < 75) then
		return
	end
	if verb == "micChecked" then
		if state.useMic and state.actor == id and (state.phase == "direct" or state.phase == "countdown") then
			metrics.once(p, "mic_checked")
		end
		return
	end
	if verb == "inviteOpened" then
		metrics.once(p, "invite_opened")
		return
	end
	if verb == "playbillPreview" and RunService:IsStudio() then
		programme.preview(p)
		send(p)
		return
	end
	if verb == "style" or verb == "stylePreview" then
		if verb == "stylePreview" and not RunService:IsStudio() then
			return
		end
		if not bucket.style then
			bucket.style = true
			task.spawn(function()
				if shelf.equip(p, arg, verb == "stylePreview") and p.Parent == Players then
					send(p)
				end
			end)
		end
		return
	end
	if verb == "wave" then
		if
			state.phase == "take"
			and state.actor == id
			and state.useMic
			and now < state.untilTime
			and now - lastWave >= 0.24
			and type(arg) == "number"
			and arg >= 0
			and arg <= 1
		then
			lastWave = now
			wave:FireAllClients(state.turn, arg)
		end
		return
	end
	if verb == "troupe" then
		if not bucket.troupe then
			bucket.troupe = true
			task.spawn(saves.troupe, p, arg)
		end
		return
	end
	if
		verb == "queue"
		and type(arg) == "table"
		and arg.mode == "Pack night"
		and (not standings[id] or not standings[id].packs["Pack night"])
	then
		return
	end
	if verb == "claim" then
		if state.useMic and features.SpeechInput and claim(p, arg, false) then
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
			and not state.fixturePending
			and not state.useMic
		then
			state.fixturePending = true
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
		if verb == "rate" or verb == "direct" then
			metrics.once(p, "first_vote")
			observed(p, state.turn)
		end
		if prior ~= state.phase then
			phaseChanged()
		else
			publish()
		end
	end
end)
Market.PromptGamePassPurchaseFinished:Connect(function(p, pass, success)
	if not success then
		return
	end
	for _, item in wardrobe do
		if item.passId == pass and pass > 0 and shelf.equip(p, item.key, false) and p.Parent == Players then
			send(p)
			break
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
