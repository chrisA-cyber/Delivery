--!strict
local Catalogue = require("../src/shared/Catalogue")
local Deck = require("../src/shared/Deck")
local Score = require("../src/shared/Score")
local Show = require("../src/server/Show")
local passed = 0
local function test(name: string, fn: () -> ())
	fn()
	passed += 1
	print("PASS", name)
end
test("no repeat through full shuffled deck and direction exclusions", function()
	local draw = Deck.new(Catalogue, "test")
	local seen, prior = {}, {}
	for _ = 1, #Catalogue.lines do
		local line, cues = draw()
		assert(not seen[line.id] and #cues == 3, "Failed: not seen[line.id] and #cues == 3")
		seen[line.id] = true
		for _, cue in cues do
			assert(not table.find(prior, cue.id), "Failed: not table.find(prior, cue.id)")
		end
		prior = { cues[1].id, cues[2].id, cues[3].id }
	end
end)
test("UTC daily independent from room seed", function()
	local a, b = Deck.daily(Catalogue, "2026-11-17")
	local c, d = Deck.daily(Catalogue, "2026-11-17")
	assert(a.id == c.id and b.id == d.id, "Failed: a.id == c.id and b.id == d.id")
end)
test("word edits, numbers, contractions and missing speech", function()
	assert(
		Score.accuracy("I'm two coins short.", "I am 2 coins short!") == 100,
		"Failed: Score.accuracy('I'm two coins short.', 'I am 2 coins short!') == 100"
	)
	assert(
		Score.accuracy("we need four spoons", "we need spoons") == 75,
		"Failed: Score.accuracy('we need four spoons', 'we need spoons') == 75"
	)
	assert(Score.accuracy("a b", "c d") == 0, "Failed: Score.accuracy('a b', 'c d') == 0")
	assert(Score.accuracy("a b", "...") == nil, "Failed: Score.accuracy('a b', '...') == nil")
end)
test("rubric weights and sparse room", function()
	assert(
		Score.result(100, 100, false, { [1] = 100, [2] = 100, [3] = 100 }, 0, 3).overall == 80,
		"Failed: Score.result(100, 100, false, { [1] = 100, [2] = 100, [3] = 100 }, 0, 3).overall == 80"
	)
	assert(
		Score.result(87, nil, false, {}, 0, 0).overall == 87,
		"Failed: Score.result(87, nil, false, {}, 0, 0).overall == 87"
	)
	assert(
		Score.result(nil, nil, true, {}, 0, 0).overall == nil,
		"Failed: Score.result(nil, nil, true, {}, 0, 0).overall == nil"
	)
end)
test("ten simulated two-player rounds with real transitions and one vote", function()
	local s = Show.new(Deck.new(Catalogue, "room"), Score)
	local now = 0
	Show.join(s, 1, now)
	Show.join(s, 2, now)
	for round = 1, 10 do
		assert(Show.action(s, 1, "queue", nil, now), "Failed: Show.action(s, 1, 'queue', nil, now)")
		assert(
			Show.tick(s, now) and s.phase == "lineup" and s.turn == round,
			"Failed: Show.tick(s, now) and s.phase == 'lineup' and s.turn == round"
		)
		assert(not Show.action(s, 2, "accept", nil, now), "Failed: not Show.action(s, 2, 'accept', nil, now)")
		assert(Show.action(s, 1, "accept", nil, now), "Failed: Show.action(s, 1, 'accept', nil, now)")
		assert(
			Show.action(s, 2, "direct", 1, now) and not Show.action(s, 2, "direct", 2, now),
			"Failed: Show.action(s, 2, 'direct', 1, now) and not Show.action(s, 2, 'direct', 2, now)"
		)
		while s.phase ~= "lobby" do
			now = s.untilTime
			Show.tick(s, now)
			if s.phase == "take" then
				s.claim = { accuracy = 90, commitment = 70 }
				assert(
					Show.action(s, 2, "react", "Rose", now) and not Show.action(s, 2, "react", "Rose", now),
					"Failed: Show.action(s, 2, 'react', 'Rose', now) and not Show.action(s, 2, 'react', 'Rose', now)"
				)
			elseif s.phase == "vote" then
				assert(
					not Show.action(s, 1, "rate", 100, now),
					"Failed: not Show.action(s, 1, 'rate', 100, now)"
				)
				assert(
					Show.action(s, 2, "rate", 75, now) and not Show.action(s, 2, "rate", 100, now),
					"Failed: Show.action(s, 2, 'rate', 75, now) and not Show.action(s, 2, 'rate', 100, now)"
				)
			elseif s.phase == "reveal" then
				assert(
					s.result.overall and s.result.voters == 1,
					"Failed: s.result.overall and s.result.voters == 1"
				)
			end
		end
	end
end)
test("offer timeout, forfeit and fresh reconnect consent", function()
	local s = Show.new(Deck.new(Catalogue, "grace"), Score)
	Show.join(s, 1, 0)
	Show.action(s, 1, "queue", nil, 0)
	Show.tick(s, 0)
	assert(not Show.action(s, 1, "accept", nil, 7), "Failed: not Show.action(s, 1, 'accept', nil, 7)")
	Show.tick(s, 7)
	Show.action(s, 1, "queue", nil, 7)
	Show.tick(s, 7)
	Show.action(s, 1, "accept", nil, 7)
	Show.leave(s, 1, 8)
	Show.join(s, 1, 9)
	assert(
		s.phase == "intermission" and s.queue[1] == 1 and s.actor == 0,
		"Failed: s.phase == 'intermission' and s.queue[1] == 1 and s.actor == 0"
	)
end)
local Measure = require("../src/shared/Measure")
test("bounded mic reports, relative volume, pauses and pace", function()
	local c = Measure.synthetic("one two three four five six seven eight")
	assert(Measure.valid(c, 5), "normal finite claim")
	assert(not Measure.valid(c, 1), "future duration")
	c.levels[2] = 0 / 0
	assert(not Measure.valid(c, 5), "NaN rejected")
	c.levels = table.create(25, 0.038)
	local quiet = Measure.read(c, "quiet")
	c.levels = table.create(25, 0.19)
	assert(quiet == 100 and Measure.read(c, "quiet") < quiet, "quiet is relative and louder can lose")
	c.levels = table.create(25, 0.075)
	for i = 8, 11 do
		c.levels[i] = 0
	end
	assert(Measure.read(c, "pause") == 100, "interior pause")
	assert(Measure.read(c, "slow") > Measure.read(c, "fast"), "pace matches the requested target")
end)
local HostLines = require("../src/shared/HostLines")
test("twenty varied house, silent, quiet, pace and misheard takes", function()
	for i = 1, 20 do
		local metric = ({ "quiet", "fast", "pause", "crowd" })[i % 4 + 1]
		local c = if i % 7 == 0 then nil else { accuracy = ({ 52, 88, 100 })[i % 3 + 1], commitment = 80 }
		local category, options = HostLines.options(i % 6 == 0, c, metric)
		local line = HostLines.choose(options, i, if i % 2 == 0 then "ignore the cue" else "2")
		assert(
			table.find(options, line) and #line <= 100 and #line > 5,
			category .. " line must be editorial"
		)
		assert(
			HostLines.choose(options, i, "99") == HostLines.choose(options, i, nil),
			"invalid digit falls back"
		)
	end
end)
local Modes = require("../src/shared/Modes")
test("pair waits for two volunteers, shares the card and accepts two fresh offers", function()
	local s = Show.new(Deck.new(Catalogue, "duel"), Score, Modes, function()
		return Deck.daily(Catalogue, "2026-11-17")
	end)
	for i = 1, 3 do
		Show.join(s, i, 0)
	end
	for i = 1, 2 do
		assert(Show.action(s, i, "queue", { mode = "Face-off" }, 0), "opt in")
	end
	Show.tick(s, 0)
	Show.action(s, 1, "accept", nil, 0)
	local text = s.line.text
	Show.tick(s, s.untilTime)
	local cue = s.cue.id
	while s.phase ~= "lobby" do
		Show.tick(s, s.untilTime)
	end
	Show.tick(s, s.untilTime)
	assert(s.actor == 2 and s.phase == "lineup", "fresh second offer")
	Show.action(s, 2, "accept", nil, s.untilTime - 1)
	assert(s.line.text == text and s.cues[1].id == cue, "same line and cue")
	while s.phase ~= "vote" do
		Show.tick(s, s.untilTime)
	end
	assert(not Show.action(s, 1, "duelVote", 1, s.untilTime - 1), "contestants cannot vote")
	assert(Show.action(s, 3, "duelVote", 2, s.untilTime - 1), "crowd pick")
	Show.tick(s, s.untilTime)
	assert(s.duelWinner == 2, "crowd decided winner")
end)
test("nine reviewed custom combinations and four switch windows", function()
	for i = 1, 9 do
		local s = { mode = "Custom", custom = { [3] = i }, actor = 3 }
		Modes.card(s, nil)
		assert(
			#string.split(s.line.text, " ") >= 10 and #string.split(s.line.text, " ") <= 18,
			"custom line timing"
		)
	end
	local c = { levels = {}, baseline = 0.1 }
	for i = 1, 50 do
		c.levels[i] = ({ 0.1, 0.038, 0.14, 0.038 })[math.min(4, math.floor((i - 1) * 0.2 / 2.5) + 1)]
	end
	assert(Modes.switchMeasure(c) == 100, "all cues matched")
end)
local Profiles = require("../src/server/Profiles")
test("session lease, first daily, save on release and stale writer fencing", function()
	local records = {}
	local store = {
		UpdateAsync = function(_, key, fn)
			local nextValue = fn(records[key])
			if nextValue then
				records[key] = nextValue
			end
			return nextValue
		end,
	}
	local now = 500
	local function clock()
		return now
	end
	local a = Profiles.open(store, "p", "A", clock)
	assert(a and not Profiles.open(store, "p", "B", clock), "active lease excludes second server")
	local round = {
		result = { overall = 82, commitment = 90 },
		mode = "Daily",
		reactionCount = 1,
		line = {
			pack = "Backstage",
		},
	}
	Profiles.record(a.row, round, 20)
	round.result.overall = 99
	Profiles.record(a.row, round, 20)
	assert(a.row.firstDailyScore == 82 and a.row.dailyRun == 1, "first take is immutable")
	a.row.crowd = 12
	assert(a.save(true), "shutdown release")
	local b = Profiles.open(store, "p", "B", clock)
	assert(b.row.crowd == 12 and b.row.badges["first-take"], "rejoin restores values")
	now += 125
	local c = Profiles.open(store, "p", "C", clock)
	assert(c and not b.save(false), "expired writer fenced")
	assert(
		Profiles.contribute(store, "team", 1, 8) == 8 and Profiles.contribute(store, "team", 1, 8) == 8,
		"retry does not duplicate troupe credit"
	)
	assert(Profiles.contribute(store, "team", 2, 4) == 12, "friends share the weekly total")
end)
local Shelf = require("../src/server/Shelf")
local Metrics = require("../src/server/Metrics")
test("cosmetic ownership and simulated Studio preview are isolated", function()
	local items = { { key = "rose-gold", passId = 15 } }
	local live = Shelf.new(items, function(_, pass)
		return pass == 123
	end, false)
	assert(not live.equip(1, "rose-gold", true) and not live.active[1], "unauthorized preview rejected")
	local owned = Shelf.new(items, function(_, pass)
		return pass == 15
	end, false)
	assert(owned.equip(2, "rose-gold", false) and owned.active[2] == "rose-gold", "verified pass grants")
	local localShop = Shelf.new(items, function()
		return false
	end, true)
	assert(
		localShop.equip(3, "rose-gold", true) and localShop.active[3] == "rose-gold",
		"explicit Studio fixture"
	)
end)
test("privacy-safe funnel adapters emit distinct observed milestones", function()
	local counts = {}
	local m = Metrics.new(function(_, k)
		counts[k] = (counts[k] or 0) + 1
	end)
	for _, k in
		{
			"join",
			"first_vote",
			"first_take",
			"second_round",
			"invite_opened",
			"invite_join",
			"next_day_return",
			"mic_checked",
		}
	do
		m.once(5, k)
		m.once(5, k)
		assert(counts[k] == 1, "milestone deduplication " .. k)
	end
	m.take(5, true)
	m.take(5, false)
	assert(counts.voice_take == 2 and counts.transcription_miss == 1, "take denominator")
end)
print(passed, "groups passed")
