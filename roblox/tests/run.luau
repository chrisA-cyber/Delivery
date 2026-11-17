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
print(passed, "groups passed")
