--!strict
-- No services or clocks inside this module. The server passes one monotonic timestamp per action.
local Show = {}
local durations = {
	lineup = 6,
	direct = 5,
	countdown = 2,
	take = 10,
	read = 2,
	vote = 5,
	host = 1.5,
	reveal = 1.8,
	intermission = 1,
}
local nextPhase = {
	direct = "countdown",
	countdown = "take",
	take = "read",
	read = "vote",
	vote = "host",
	host = "reveal",
	reveal = "intermission",
	intermission = "lobby",
}
local function clearRound(s)
	s.ballots = {}
	s.ratings = {}
	s.reactions = {}
	s.reactionCount = 0
	s.observers = {}
	s.claim = nil
	s.result = nil
	s.line = nil
	s.cues = {}
	s.cue = nil
	s.lastReaction = nil
	s.predictions = {}
	s.duelVotes = {}
	s.day = nil
	s.hostLine = nil
	s.useMic = false
	s.duelWinner = nil
end

function Show.new(draw, score, modes, daily)
	local s = {
		phase = "lobby",
		untilTime = 0,
		turn = 0,
		actor = 0,
		queue = {},
		online = {},
		draw = draw,
		score = score,
		grace = {},
		revision = 0,
		modes = modes,
		daily = daily,
		choices = {},
		custom = {},
		mode = "Main stage",
	}
	clearRound(s)
	return s
end

local function enter(s, phase: string, now: number)
	s.phase = phase
	s.untilTime = now + (durations[phase] or 0)
	s.revision += 1
	if phase == "direct" then
		s.line, s.cues = s.draw()
		if s.modes then
			s.modes.card(s, s.daily)
		end
		for id in s.online do
			if id ~= s.actor then
				s.observers[id] = true
			end
		end
	elseif phase == "countdown" then
		local totals = { 0, 0, 0 }
		for _, slot in s.ballots do
			totals[slot] += 1
		end
		local best = 1
		for i = 2, #s.cues do
			if totals[i] > totals[best] then
				best = i
			end
		end
		s.cue = s.cues[best]
		if s.duel and s.duel.first == s.actor then
			s.duel.line = s.line
			s.duel.cue = s.cue
		end
	elseif phase == "take" then
		s.started = now
	elseif phase == "host" then
		local audience = 0
		for _ in s.observers do
			audience += 1
		end
		local c = s.claim
		s.result = s.score.result(
			if c then c.accuracy else nil,
			if c then c.commitment else nil,
			s.cue.measure == "crowd",
			s.ratings,
			s.reactionCount,
			audience
		)
		s.result.miss = not c
		if s.duel and s.duel.second == s.actor then
			local score = 0
			for _, v in s.duelVotes do
				score += if v == 1 then 1 else -1
			end
			s.duelWinner = if score > 0 then s.duel.first elseif score < 0 then s.duel.second else nil
			s.champion = s.duelWinner
		end
		if not c and s.result.voters == 0 then
			s.result.overall = nil
			s.result.band = "Take it again"
		end
	elseif phase == "lobby" then
		s.actor = 0
		clearRound(s)
	end
end

function Show.join(s, id: number, now: number)
	s.online[id] = true
	if s.grace[id] and s.grace[id] >= now and not table.find(s.queue, id) then
		table.insert(s.queue, 1, id)
	end
	s.grace[id] = nil
	if id ~= s.actor and (s.phase == "direct" or s.phase == "take" or s.phase == "countdown") then
		s.observers[id] = true
	end
end

function Show.leave(s, id: number, now: number)
	s.online[id] = nil
	if s.champion == id then
		s.champion = nil
	end
	if s.duel and (id == s.duel.first or id == s.duel.second) then
		s.duel = nil
	end
	local pos = table.find(s.queue, id)
	if pos then
		table.remove(s.queue, pos)
		s.grace[id] = now + 12
	end
	if s.actor == id then
		s.grace[id] = now + 12
		s.actor = 0
		enter(s, "intermission", now)
	end
end

function Show.tick(s, now: number)
	for id, expiry in s.grace do
		if now > expiry then
			s.grace[id] = nil
		end
	end
	if s.phase == "lobby" then
		if not next(s.online) then
			return false
		end
		clearRound(s)
		s.turn += 1
		s.actor = 0
		if s.duel and s.duel.line then
			local pos = table.find(s.queue, s.duel.second)
			if pos and s.online[s.duel.second] then
				s.actor = table.remove(s.queue, pos)
			else
				s.duel = nil
			end
		end
		if s.actor == 0 then
			s.duel = nil
			for index, id in s.queue do
				if s.choices[id] ~= "Face-off" then
					s.actor = table.remove(s.queue, index)
					break
				end
				local other = nil
				for j = index + 1, #s.queue do
					if s.choices[s.queue[j]] == "Face-off" then
						other = s.queue[j]
						break
					end
				end
				if other then
					s.duel = { first = id, second = other }
					s.actor = table.remove(s.queue, index)
					break
				end
			end
		end
		s.mode = if s.actor == 0 then "Main stage" else s.choices[s.actor] or "Main stage"
		enter(s, if s.actor == 0 then "direct" else "lineup", now)
	elseif now >= s.untilTime then
		if s.phase == "lineup" or (s.phase == "intermission" and s.duel and s.actor == s.duel.second) then
			s.duel = nil
		end
		enter(s, if s.phase == "lineup" then "lobby" else nextPhase[s.phase], now)
	else
		return false
	end
	return true
end

function Show.action(s, id: number, action: string, arg: any, now: number): boolean
	if not s.online[id] then
		return false
	end
	if action == "queue" then
		if id == s.actor or table.find(s.queue, id) then
			return false
		end
		local mode = "Main stage"
		if arg ~= nil then
			if not s.modes or type(arg) ~= "table" or not table.find(s.modes.names, arg.mode) then
				return false
			end
			mode = arg.mode
			if
				mode == "Custom"
				and (type(arg.mix) ~= "number" or not table.find({ 1, 2, 3, 4, 5, 6, 7, 8, 9 }, arg.mix))
			then
				return false
			end
			s.custom[id] = if mode == "Custom" then arg.mix else nil
		end
		s.choices[id] = mode
		if mode == "Face-off" and s.champion == id then
			table.insert(s.queue, 1, id)
		else
			table.insert(s.queue, id)
		end
	elseif action == "leave" then
		local index = table.find(s.queue, id)
		if index then
			table.remove(s.queue, index)
		elseif s.actor == id then
			s.actor = 0
			enter(s, "intermission", now)
		else
			return false
		end
	elseif now >= s.untilTime then
		return false
	elseif action == "accept" then
		if s.phase ~= "lineup" or id ~= s.actor then
			return false
		end
		if arg ~= nil and arg ~= "mic" and arg ~= "rehearsal" then
			return false
		end
		s.useMic = arg == "mic"
		enter(s, "direct", now)
	elseif id == s.actor then
		return false
	elseif action == "predict" then
		if
			(s.phase ~= "take" and s.phase ~= "read")
			or s.predictions[id]
			or not table.find({ 1, 2, 3 }, arg)
		then
			return false
		end
		s.predictions[id] = arg
	elseif action == "duelVote" then
		if
			s.phase ~= "vote"
			or not s.duel
			or s.actor ~= s.duel.second
			or id == s.duel.first
			or s.duelVotes[id]
			or not table.find({ 1, 2 }, arg)
		then
			return false
		end
		s.duelVotes[id] = arg
	elseif action == "direct" then
		if s.phase ~= "direct" or s.ballots[id] or not table.find({ 1, 2, 3 }, arg) or not s.cues[arg] then
			return false
		end
		s.ballots[id] = arg
	elseif action == "rate" then
		if s.phase ~= "vote" or s.ratings[id] or not table.find({ 25, 50, 75, 100 }, arg) then
			return false
		end
		s.ratings[id] = arg
	elseif action == "react" then
		if
			s.phase ~= "take"
			or s.reactions[id]
			or not table.find({ "Rose", "Tomato", "Laugh", "Gasp" }, arg)
		then
			return false
		end
		s.reactions[id] = arg
		s.lastReaction = arg
		s.reactionCount += 1
	else
		return false
	end
	return true
end
return Show
