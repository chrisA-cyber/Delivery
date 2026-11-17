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
	local expiry = s.untilTime
	assert(not Show.action(s, 1, "accept", nil, expiry), "expired offer cannot be accepted")
	Show.tick(s, expiry)
	Show.action(s, 1, "queue", nil, expiry)
	Show.tick(s, expiry)
	Show.action(s, 1, "accept", nil, expiry)
	Show.leave(s, 1, expiry + 1)
	Show.join(s, 1, expiry + 2)
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
test("silent card recovery obtains a fresh offer and retains the card", function()
	local s = Show.new(Deck.new(Catalogue, "retake"), Score)
	Show.join(s, 1, 0)
	assert(Show.action(s, 1, "queue", nil, 0))
	Show.tick(s, 0)
	assert(Show.action(s, 1, "accept", "mic", 0) and s.useMic, "mic consent set")
	local line = s.line
	while s.phase ~= "reveal" do
		Show.tick(s, s.untilTime)
	end
	assert(s.result.miss and Show.action(s, 1, "retake", nil, s.untilTime - 0.5), "silent actor can retry")
	while s.phase ~= "lineup" do
		Show.tick(s, s.untilTime)
	end
	assert(
		not s.useMic and Show.action(s, 1, "accept", "rehearsal", s.untilTime - 1),
		"fresh consent required"
	)
	assert(s.line == line and not s.useMic and #s.cues == 1, "same card and direction without mic")
end)
test("loaded data merges an in-flight result and retains the first Daily", function()
	local row = Profiles.blank()
	row.streak = 2
	row.stage = 20
	row.lastDaily = 5
	row.firstDailyScore = 78
	local fresh = Profiles.blank()
	fresh.takes = 1
	fresh.stage = 10
	fresh.streak = 1
	fresh.lastDaily = 5
	fresh.firstDailyScore = 98
	Profiles.mergePending(row, fresh)
	assert(
		row.stage == 30 and row.streak == 3 and row.firstDailyScore == 78,
		"progress merged once and Daily score immutable"
	)
end)
test("a repeated souvenir receipt preserves its original stamp", function()
	local tickets = {}
	local store = {
		UpdateAsync = function(_, key, fn)
			tickets[key] = fn(tickets[key])
			return tickets[key]
		end,
	}
	local source = require("../src/server/Playbills")
	assert(
		source.stamp(store, "first", 25) == 25 and source.stamp(store, "first", 98) == 25,
		"same receipt grants once"
	)
	assert(source.stamp(store, "next", 99) == 99, "second purchase has a distinct issue")
end)
local Foley = require("../src/shared/Foley")
test("solo booth starts immediately, uses the chosen sheet and scores three timed sound effects", function()
	local s = Show.new(Deck.new(Catalogue, "solo-booth"), Score, Modes, nil, Foley)
	Show.join(s, 1, 0)
	Show.tick(s, 0)
	assert(s.actor == 0 and s.phase == "direct", "house is showing an idle card")
	assert(Show.action(s, 1, "queue", { mode = "Sound booth" }, 1), "request accepted")
	assert(s.phase == "lineup" and s.actor == 1, "solo gets a stage offer immediately")
	assert(not Show.action(s, 1, "accept", "mic", 1), "booth cannot opt into voice")
	assert(Show.action(s, 1, "accept", "pads", 1), "booth offer accepted explicitly")
	assert(Show.action(s, 1, "direct", 2, 1), "solo can direct their own sheet")
	Show.tick(s, s.untilTime)
	assert(s.foley.beats[1].pad == "Thump", "reverse sheet chosen")
	Show.tick(s, s.untilTime)
	local start = s.started
	assert(not Show.action(s, 1, "foleyPad", { index = 1, pad = "Thump" }, start), "early hits ignored")
	assert(Show.action(s, 1, "foleyPad", { index = 1, pad = "Thump" }, start + 2), "perfect pad lands")
	assert(
		not Show.action(s, 1, "foleyPad", { index = 1, pad = "Thump" }, start + 2.1),
		"replay cannot score twice"
	)
	assert(
		Show.action(s, 1, "foleyPad", { index = 2, pad = "Squeak" }, start + 5.8),
		"late, in-window pad lands"
	)
	assert(
		Show.action(s, 1, "foleyPad", { index = 3, pad = "Squeak" }, start + 8),
		"a wrong sound is an attempt"
	)
	while s.phase ~= "reveal" do
		Show.tick(s, s.untilTime)
	end
	assert(
		s.result.foleyHits == 2
			and s.result.foleyPerfect == 1
			and s.result.accuracy == 67
			and s.result.commitment == 57,
		"independent pad choice and timing scores"
	)
	assert(
		not s.useMic and not s.claim.simulated and not s.result.miss and s.result.voters == 0,
		"earned solo score without simulated speech or audience"
	)
	assert(
		Show.action(s, 1, "queue", { mode = "Sound booth" }, s.untilTime - 1),
		"play again joins the next queue directly from reveal"
	)
	while s.phase ~= "lineup" do
		Show.tick(s, s.untilTime)
	end
	assert(
		not s.useMic and not s.foley and s.actor == 1,
		"replay requires a fresh offer before pads or mic activate"
	)
end)
test("booth does not interrupt another crowd member; no tap is a recoverable miss", function()
	local s = Show.new(Deck.new(Catalogue, "shared-booth"), Score, Modes, nil, Foley)
	Show.join(s, 1, 0)
	Show.join(s, 2, 0)
	Show.tick(s, 0)
	local turn = s.turn
	Show.action(s, 1, "queue", { mode = "Sound booth" }, 1)
	assert(s.actor == 0 and s.turn == turn, "shared house runs to completion")
	while s.phase ~= "lineup" do
		Show.tick(s, s.untilTime)
	end
	Show.action(s, 1, "accept", "pads", s.untilTime - 1)
	assert(not Show.action(s, 1, "direct", 1, s.untilTime - 1), "only crowd directs in multiplayer")
	Show.tick(s, s.untilTime)
	Show.tick(s, s.untilTime)
	assert(
		not Show.action(s, 2, "foleyPad", { index = 1, pad = "Bell" }, s.started + 2),
		"crowd cannot fake stage input"
	)
	assert(
		not Show.action(s, 1, "foleyPad", { index = 1, pad = "Unknown" }, s.started + 2),
		"only authored pads"
	)
	while s.phase ~= "reveal" do
		Show.tick(s, s.untilTime)
	end
	assert(
		s.result.miss and s.result.foleyHits == 0 and s.result.overall == nil,
		"no fabricated performance on silence"
	)
	assert(Show.action(s, 1, "retake", nil, s.untilTime - 1), "retry is opt-in")
end)
test("voice calibration belongs to one fresh consented take", function()
	local s = Show.new(Deck.new(Catalogue, "check"), Score)
	Show.join(s, 1, 0)
	Show.join(s, 2, 0)
	Show.action(s, 1, "queue", nil, 0)
	Show.tick(s, 0)
	assert(not Show.action(s, 1, "micChecked", nil, 0), "seat offer has no calibration")
	Show.action(s, 1, "accept", "mic", 0)
	assert(not Show.action(s, 2, "micChecked", nil, 1), "crowd cannot authorize stage route")
	assert(Show.action(s, 1, "micChecked", nil, 3) and s.micChecked, "fresh positive check")
	Show.tick(s, s.untilTime)
	Show.tick(s, s.untilTime)
	assert(not Show.action(s, 1, "micChecked", nil, s.started + 1), "check closes before take")
	while s.phase ~= "lobby" do
		Show.tick(s, s.untilTime)
	end
	assert(not s.micChecked and not s.useMic, "previous check and consent cleared")
end)
local Activities = require("../src/server/VenueActivities")
local Venues = require("../src/shared/Venues")
test("Studio B drills have independent clocks, scored input, fresh run IDs and one reward", function()
	local a, b = Activities.new(), Activities.new()
	Activities.open(a, "studio", false)
	Activities.open(b, "warehouse", false)
	assert(
		Activities.startPractice(a, Foley, 100) and Activities.startJob(b, 100),
		"two players start different activities"
	)
	local drill = a.practice
	for i, beat in drill.beats do
		assert(
			not Activities.pad(
				a,
				Foley,
				{ run = drill.run - 1, index = i, pad = beat.pad },
				drill.started + beat.at
			),
			"stale drill rejected"
		)
		assert(
			Activities.pad(a, Foley, { run = drill.run, index = i, pad = beat.pad }, drill.started + beat.at),
			"timed pad accepted"
		)
	end
	assert(
		Activities.finishPractice(a, Foley, 108).xp == 6 and a.practice.score == 100,
		"three private perfect hits"
	)
	assert(
		not Activities.finishPractice(a, Foley, 109) and b.job.picked == 0,
		"duplicate reward rejected and partner unaffected"
	)
	Activities.startPractice(a, Foley, 110)
	Activities.open(a, "lobby", false)
	assert(
		a.practice.status == "cancelled" and not Activities.finishPractice(a, Foley, 130),
		"leaving private studio cancels that run"
	)
end)
test("warehouse dispatch validates distance, ordered packing, fresh tickets and physical return", function()
	local v = Activities.new()
	assert(Activities.startJob(v, 10) and not Activities.startJob(v, 11), "one dispatch ticket at a time")
	local j = v.job
	assert(not Activities.collect(v, j.run, j.order[2], true, 11), "wrong prop cannot advance")
	assert(not Activities.collect(v, j.run, j.order[1], false, 12), "pickup requires station proximity")
	assert(not Activities.collect(v, j.run - 1, j.order[1], true, 13), "stale ticket rejected")
	for i, prop in j.order do
		assert(Activities.collect(v, j.run, prop, true, 13 + i), "correct nearby pickup")
	end
	assert(
		not Activities.deliver(v, j.run, false, 20) and Activities.deliver(v, j.run, true, 21),
		"deliver only at dispatch"
	)
	assert(not Activities.deliver(v, j.run, true, 22) and j.xp == 5, "duplicate ticket cannot pay again")
end)
test("walkable venue map, earned fits and stamped writer cards survive profile load", function()
	local visitor = Activities.new()
	assert(
		visitor.room == "lobby"
			and not visitor.watching
			and Venues.arrival(visitor.room, visitor.openRevision) == "PlazaArrival"
			and Venues.fallbackArrival == "ParkArrival",
		"first arrival is in Broadcast Plaza facing the theatre, with the park gateway as fallback"
	)
	Activities.open(visitor, "lobby", false)
	assert(
		Venues.arrival(visitor.room, visitor.openRevision) == "VenueLobby",
		"selected plaza remains the respawn location"
	)
	Activities.open(visitor, "park", false)
	assert(
		Venues.arrival(visitor.room, visitor.openRevision) == "VenuePark",
		"explicit park travel returns to its workstation"
	)
	for id, room in Venues.rooms do
		assert(
			Venues.zone(room.x, room.z, if id == "balcony" then 9 else 3) == id,
			"arrival belongs to " .. id
		)
	end
	local row, fresh = Profiles.blank(), Profiles.blank()
	fresh.writtenMix = 8
	fresh.atelierLook = 3
	fresh.practiceCount = 2
	fresh.propJobs = 1
	fresh.practiceBest = 95
	fresh.badges["sound-technician"] = true
	Profiles.mergePending(row, fresh)
	assert(
		row.practiceCount == 2 and row.propJobs == 1 and row.practiceBest == 95,
		"late-loaded progress merged"
	)
	assert(
		Venues.lookAt(row.atelierLook) == "cobalt" and row.badges["sound-technician"],
		"earned fit retained"
	)
	local card = Modes.mix(row.writtenMix)
	local fake = { mode = "Custom", actor = 8, custom = { [8] = 8 } }
	Modes.card(fake, nil)
	assert(
		card.text == fake.line.text and card.id == fake.line.id,
		"stamped card is the actual queued stage card"
	)
end)
test("venue spectators determine direction, room weight and quick solo pickup", function()
	local watchers = {}
	local s = Show.new(Deck.new(Catalogue, "workshops"), Score, Modes, nil, Foley, function(id)
		return watchers[id]
	end)
	Show.join(s, 1, 0)
	Show.join(s, 2, 0)
	Show.tick(s, 0)
	assert(Show.solo(s, 1) and not next(s.observers), "workshop player does not dilute the audience")
	Show.action(s, 1, "queue", { mode = "Sound booth" }, 1)
	assert(
		s.phase == "lineup" and s.actor == 1,
		"a venue visitor outside the theatre cannot hold up the queue"
	)
	Show.action(s, 1, "accept", "pads", 2)
	watchers[2] = true
	Show.attendance(s, 2)
	assert(not Show.solo(s, 1) and s.observers[2], "voluntary spectator joins the audience")
	watchers[2] = false
	Show.attendance(s, 2)
	assert(not s.observers[2], "leaving restores outside-room attendance")
end)
local Outdoor = require("../src/server/Outdoor")
test("Buoy Watch scores fresh timed nearby reels, partial expiry, and one souvenir", function()
	local v, row = Activities.new(), Profiles.blank()
	assert(Outdoor.start(v, "pier", 40), "pier watch starts")
	local r = v.outdoor
	assert(not Outdoor.tap(v, r.run + 1, 40 + r.beats[1], true), "previous ticket cannot reel")
	assert(not Outdoor.tap(v, r.run, 40 + r.beats[1], false), "reel requires proximity")
	assert(Outdoor.tap(v, r.run, 40.7, true) and r.hits == 0, "early reel gives feedback without scoring")
	for i, beat in r.beats do
		assert(Outdoor.tap(v, r.run, 40 + beat, true) and r.reels[tostring(i)], "timed cue recorded by index")
		assert(not Outdoor.tap(v, r.run, 40 + beat + 0.01, true), "same reel cannot repeat")
	end
	assert(
		r.status == "done" and r.score == 100 and Outdoor.reward(r, row) and not Outdoor.reward(r, row),
		"final score and one-time payment"
	)
	assert(
		row.stage == 3 and row.pierBest == 100 and row.badges["harbour-hand"],
		"three signals unlock the souvenir"
	)
	assert(Outdoor.start(v, "pier", 100), "second pier watch starts")
	r = v.outdoor
	assert(Outdoor.tap(v, r.run, 100 + r.beats[2], true), "one mid-run signal lands")
	assert(
		Outdoor.tick(v, 111) and not Outdoor.tick(v, 112) and r.hits == 1 and Outdoor.reward(r, row),
		"partial result awarded on expiry"
	)
	assert(row.stage == 4 and row.pierBest == 100, "personal best survives partial run")
end)
test("park circuit enforces station order and foot travel, tracks repeat personal best", function()
	local v, row = Activities.new(), Profiles.blank()
	assert(Outdoor.start(v, "park", 30), "first circuit starts")
	Outdoor.cancelPark(v)
	assert(
		v.outdoor.status == "expired" and not Outdoor.reward(v.outdoor, row),
		"fast travel cancels a circuit"
	)
	for attempt = 1, 2 do
		local time = 100 * attempt
		assert(Outdoor.start(v, "park", time), "new circuit starts")
		local r = v.outdoor
		assert(not Outdoor.step(v, "park", r.run, r.route[2], time + 1, true), "wrong arch cannot count")
		assert(not Outdoor.step(v, "park", r.run, r.target, time + 1, false), "runner must reach the arch")
		for i, target in r.route do
			assert(
				Outdoor.step(v, "park", r.run, target, time + i * (4 - attempt), true),
				"ordered arches and finish advance"
			)
		end
		assert(
			r.status == "done" and Outdoor.reward(r, row) and not Outdoor.reward(r, row),
			"each race pays once"
		)
	end
	assert(
		row.parkRuns == 2 and row.parkBestMs == 8000 and row.badges["signal-sprinter"] and row.crowd == 10,
		"faster circuit updates the record"
	)
	assert(
		Outdoor.start(v, "park", 300) and Outdoor.tick(v, 390) and not Outdoor.reward(v.outdoor, row),
		"expired race pays no reward"
	)
end)
test("market requires ordered materials and matching stamp at counter, expiry cannot pay", function()
	local v, row = Activities.new(), Profiles.blank()
	assert(Outdoor.start(v, "market", 20), "market order starts")
	local r = v.outdoor
	assert(not Outdoor.step(v, "market", r.run, r.route[2], 22, true), "material pickup must match order")
	assert(
		not Outdoor.step(v, "market", r.run, r.route[1], 22, false),
		"material must be physically collected"
	)
	assert(not Outdoor.wrap(v, r.run, r.stamp, 22, true), "unfinished parcel cannot be stamped")
	for i = 1, 2 do
		assert(
			Outdoor.step(v, "market", r.run, r.route[i], 22 + i, true),
			"expected material accepted at stall"
		)
	end
	assert(not Outdoor.wrap(v, r.run, r.stamp, 28, false), "wrap requires physical kiosk")
	assert(
		Outdoor.wrap(v, r.run, if r.stamp == "Moon" then "Star" else "Moon", 29, true)
			and r.status == "active",
		"wrong stamp permits another attempt"
	)
	assert(
		Outdoor.wrap(v, r.run, r.stamp, 30, true) and Outdoor.reward(r, row) and not Outdoor.reward(r, row),
		"correct stamp completes and pays once"
	)
	assert(
		row.marketOrders == 1 and row.crowd == 4 and row.badges["market-maker"],
		"order and souvenir saved"
	)
	assert(
		Outdoor.start(v, "market", 100)
			and Outdoor.tick(v, 221)
			and not Outdoor.wrap(v, v.outdoor.run, v.outdoor.stamp, 222, true),
		"expired ticket cannot be stamped"
	)
	local saved = Profiles.blank()
	row.parkBestMs = 13750
	row.pierBest = 67
	Profiles.mergePending(saved, row)
	assert(
		saved.marketOrders == 1
			and saved.parkBestMs == 13750
			and saved.pierBest == 67
			and saved.badges["market-maker"],
		"late profile load preserves outdoor records"
	)
end)
local ShopCatalogue = require("../src/shared/ShopCatalogue")
local Business = require("../src/server/Business")
test("mail routes rotate recipients and delivered parcels reward only once at the address", function()
	local v, row = Activities.new(), Profiles.blank()
	assert(not Business.start(v, ShopCatalogue, "post", row, 10, false), "parcel collection requires counter")
	local seen = {}
	for n = 1, 3 do
		assert(Business.start(v, ShopCatalogue, "post", row, n * 10, true), "take next parcel")
		local r = v.business
		assert(not seen[r.target], "first three receipts have distinct recipients")
		seen[r.target] = true
		assert(not Business.delivery(v, ShopCatalogue, row, n * 10 + 1, "wrong", true), "address must match")
		assert(
			not Business.delivery(v, ShopCatalogue, row, n * 10 + 2, r.target, false),
			"walk up to destination"
		)
		assert(Business.delivery(v, ShopCatalogue, row, n * 10 + 3, r.target, true), "complete delivery")
		assert(
			not Business.delivery(v, ShopCatalogue, row, n * 10 + 4, r.target, true),
			"signed parcel cannot pay twice"
		)
	end
	assert(
		row.postDeliveries == 3 and row.crowd == 9 and row.badges["town-carrier"],
		"three saved mail receipts"
	)
end)
test(
	"record deck plays a full side before input, replays mistakes and validates at the listening deck",
	function()
		local v, row = Activities.new(), Profiles.blank()
		Business.start(v, ShopCatalogue, "records", row, 100, true)
		local r = v.business
		assert(
			not Business.pick(v, ShopCatalogue, row, r.run, r.notes[1], r.listenUntil - 0.01, true),
			"listen before playing"
		)
		assert(
			not Business.pick(v, ShopCatalogue, row, r.run, r.notes[1], r.listenUntil, false),
			"cannot play from another shop"
		)
		local wrong = if r.notes[1] == "Bell" then "Thump" else "Bell"
		local endOne = r.listenUntil
		assert(
			Business.pick(v, ShopCatalogue, row, r.run, wrong, endOne, true)
				and r.progress == 0
				and r.listenUntil > endOne,
			"mismatch restarts the side"
		)
		assert(
			Business.replay(v, r.run, r.listenUntil + 1, true),
			"manual replay starts another listening pass"
		)
		local time = r.listenUntil
		for i, note in r.notes do
			assert(
				Business.pick(v, ShopCatalogue, row, r.run, note, time + i * 0.3, true),
				"matching beat accepted"
			)
		end
		assert(
			r.status == "done" and row.recordSides == 1 and row.stage == 3 and row.badges["crate-digger"],
			"memorised side awards stage standing"
		)
		assert(
			Business.start(v, ShopCatalogue, "records", row, time + 10, true) and #v.business.notes == 4,
			"next pressing changes length"
		)
	end
)
test("café prepares six distinct slips in order, rejects distant or foreign ingredients", function()
	local v, row = Activities.new(), Profiles.blank()
	local completed = {}
	for n = 1, 6 do
		local time = n * 10
		assert(Business.start(v, ShopCatalogue, "cafe", row, time, true), "open order")
		local r = v.business
		assert(not completed[r.orderName], "distinct order slip")
		completed[r.orderName] = true
		assert(
			not Business.pick(v, ShopCatalogue, row, r.run, "off-menu", time + 1, true),
			"unknown input rejected"
		)
		assert(
			not Business.pick(v, ShopCatalogue, row, r.run, r.recipe[1], time + 1, false),
			"must stay at café"
		)
		assert(
			Business.pick(v, ShopCatalogue, row, r.run, r.recipe[2], time + 1, true) and r.progress == 0,
			"wrong ingredient leaves order intact"
		)
		for i, ingredient in r.recipe do
			assert(
				Business.pick(v, ShopCatalogue, row, r.run, ingredient, time + 2 + i / 3, true),
				"add next recipe ingredient"
			)
		end
	end
	assert(row.cafeOrders == 6 and row.crowd == 18 and row.badges["counter-crew"], "completed tickets saved")
end)
test("gallery prints all 27 curated designs and restores the most recent signed postcard", function()
	local v, row = Activities.new(), Profiles.blank()
	local seen = {}
	for _, scene in ShopCatalogue.palette[1] do
		for _, ink in ShopCatalogue.palette[2] do
			for _, greeting in ShopCatalogue.palette[3] do
				assert(Business.start(v, ShopCatalogue, "gallery", row, 10, true), "open press")
				local r = v.business
				assert(
					not Business.pick(v, ShopCatalogue, row, r.run, ink, 11, true),
					"wrong layer cannot change print"
				)
				for i, choice in { scene, ink, greeting } do
					assert(
						Business.pick(v, ShopCatalogue, row, r.run, choice, 11 + i, true),
						"stamp allowed preset layer"
					)
				end
				assert(not seen[row.postcard], "unique folded postcard index")
				seen[row.postcard] = true
				local print = ShopCatalogue.print(row.postcard)
				assert(
					print.scene == scene and print.ink == ink and print.greeting == greeting,
					"reloaded exact postcard"
				)
			end
		end
	end
	local saved = Profiles.blank()
	Profiles.mergePending(saved, row)
	assert(
		saved.galleryPrints == 27 and saved.postcard == 27 and saved.badges["town-printmaker"],
		"late-loaded gallery data preserves selections"
	)
	assert(not ShopCatalogue.print(28) and not ShopCatalogue.print(0), "unknown stored print stays blank")
end)
print(passed, "groups passed")
