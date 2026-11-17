--!strict
-- Town and show wiring: the ShowStatus mapping, poster copy, arrival, errands and the entrance sting.
local Catalogue = require("../src/shared/Catalogue")
local Deck = require("../src/shared/Deck")
local Score = require("../src/shared/Score")
local Modes = require("../src/shared/Modes")
local Foley = require("../src/shared/Foley")
local Venues = require("../src/shared/Venues")
local ShopCatalogue = require("../src/shared/ShopCatalogue")
local Show = require("../src/server/Show")
local TownBroadcast = require("../src/server/TownBroadcast")
local Activities = require("../src/server/VenueActivities")
local Outdoor = require("../src/server/Outdoor")
local Business = require("../src/server/Business")
local Profiles = require("../src/server/Profiles")
local passed = 0
local function test(name: string, fn: () -> ())
	fn()
	passed += 1
	print("PASS", name)
end

test("score bands follow the audience prediction buttons, and 3 is encore level", function()
	assert(TownBroadcast.band(nil) == 0, "no score is band 0")
	assert(TownBroadcast.band(0) == 1 and TownBroadcast.band(59) == 1, "under 60")
	assert(TownBroadcast.band(60) == 2 and TownBroadcast.band(89) == 2, "60 to 89")
	assert(TownBroadcast.band(90) == 3 and TownBroadcast.band(100) == 3, "90 and over")
	assert(TownBroadcast.band(0 / 0) == 0, "NaN is treated as no score")
	local record = TownBroadcast.newRecord()
	assert(record.round == 0 and record.lastScore == -1 and record.lastBand == 0, "fresh record")
	TownBroadcast.reveal(record, { overall = 92.4 })
	assert(record.round == 1 and record.lastScore == 92 and record.lastBand == 3, "encore reveal")
	TownBroadcast.reveal(record, { overall = nil, band = "Take it again" })
	assert(record.round == 2 and record.lastScore == -1 and record.lastBand == 0, "unscored reveal")
	TownBroadcast.reveal(record, nil)
	assert(record.round == 3 and record.lastScore == -1, "missing result still counts a reveal")
end)

local function attributeSafe(status)
	for _, key in TownBroadcast.keys do
		local value = (status :: any)[key]
		local kind = type(value)
		assert(kind == "string" or kind == "number" or kind == "boolean", key .. " is attribute-safe")
	end
end

test("status maps idle, the house act and a performer round from the authoritative show", function()
	local watchers = {}
	local s = Show.new(Deck.new(Catalogue, "town"), Score, Modes, nil, Foley, function(id)
		return watchers[id] == true
	end)
	local record = TownBroadcast.newRecord()
	local idle = TownBroadcast.status(s, record, "", 0)
	attributeSafe(idle)
	assert(
		idle.Phase == "idle"
			and idle.PhaseEndsAt == 0
			and idle.Format == ""
			and idle.Performer == ""
			and idle.CardLine == ""
			and idle.Direction == ""
			and not idle.House,
		"lobby is reported as idle with no card"
	)
	Show.join(s, 1, 0)
	Show.join(s, 2, 0)
	watchers[2] = true
	Show.tick(s, 0)
	local house = TownBroadcast.status(s, record, "", 1)
	attributeSafe(house)
	assert(house.Phase == "direct" and house.House and house.Performer == "Flip", "house act names Flip")
	assert(house.CardLine == s.line.text and house.CardLine ~= "", "card line is the drawn catalogue line")
	assert(house.Direction == "", "no direction before the audience chooses")
	assert(house.PhaseEndsAt == s.untilTime and house.Watchers == 1, "deadline and watcher count")
	-- Run the house act to its reveal; the record changes only at reveal.
	local seen = { direct = true }
	while s.phase ~= "lobby" do
		Show.tick(s, s.untilTime)
		local status = TownBroadcast.status(s, record, "", 1)
		assert(
			table.find(TownBroadcast.phases, status.Phase),
			"phase is part of the contract: " .. status.Phase
		)
		seen[status.Phase] = true
		if s.phase == "countdown" then
			assert(status.Direction == s.cue.label and status.Direction ~= "", "chosen direction label")
		end
		if s.phase == "reveal" then
			TownBroadcast.reveal(record, s.result)
		end
	end
	assert(seen.take and seen.vote and seen.reveal and record.round == 1, "full house round observed")
	Show.action(s, 1, "queue", { mode = "Sound booth" }, s.untilTime)
	Show.tick(s, s.untilTime)
	local lineup = TownBroadcast.status(s, record, "Ada", 1)
	assert(
		lineup.Phase == "lineup"
			and not lineup.House
			and lineup.Performer == "Ada"
			and lineup.Format == "Sound booth",
		"performer lineup carries the display name and format"
	)
end)

test("a player queued from town is an observer while they wait", function()
	local queued = {}
	local s
	s = Show.new(Deck.new(Catalogue, "queue"), Score, Modes, nil, Foley, function(id)
		return queued[id] == true or table.find(s.queue, id) ~= nil
	end)
	Show.join(s, 1, 0)
	Show.join(s, 2, 0)
	Show.tick(s, 0)
	Show.action(s, 1, "queue", { mode = "Sound booth" }, 1)
	assert(s.phase == "lineup" and s.actor == 1, "first player takes the stage")
	assert(Show.action(s, 2, "queue", nil, 2), "second player queues from town")
	Show.attendance(s, 2)
	assert(not Show.solo(s, 1), "the queued player counts as watching the act")
	Show.action(s, 1, "accept", "pads", 3)
	assert(s.phase == "direct" and s.observers[2], "queued player is in the audience at the direct phase")
	assert(Show.action(s, 2, "direct", 1, 3.5), "their direction ballot counts")
	local entered = 0
	while s.phase ~= "vote" do
		entered = s.untilTime
		Show.tick(s, entered)
	end
	assert(s.untilTime - entered == 5, "an audience of one keeps the full voting window")
	assert(Show.action(s, 2, "rate", 75, s.untilTime - 1), "their rating counts")
end)

test("poster copy: countdown, on now, verdict with band styling, and last act between shows", function()
	local base = {
		Phase = "lineup",
		PhaseEndsAt = 108,
		Format = "Main stage",
		House = false,
		Performer = "Ada",
		CardLine = "",
		Direction = "",
		LastScore = -1,
		LastBand = 0,
		Round = 0,
		Watchers = 2,
	}
	local lineup = TownBroadcast.poster(base, 100)
	assert(
		lineup.headline == "NEXT ACT IN 0:08" and lineup.ticking,
		"lineup counts down: " .. lineup.headline
	)
	assert(
		lineup.performer == "Ada is in the wings" and lineup.score == "",
		"no score before the first reveal"
	)
	assert(TownBroadcast.poster(base, 108.5).headline == "NEXT ACT SOON", "expired countdown")
	assert(TownBroadcast.clock(75.2) == "1:16" and TownBroadcast.clock(-3) == "0:00", "clock format")
	local live = table.clone(base)
	live.Phase = "take"
	live.CardLine = "A catalogue line."
	live.Direction = "Whispered fury"
	local onNow = TownBroadcast.poster(live, 100)
	assert(onNow.headline == "ON NOW" and onNow.live and not onNow.ticking, "on now")
	assert(onNow.performer == "Starring Ada" and onNow.line == "A catalogue line.", "performer and line")
	assert(onNow.direction == "Direction · Whispered fury", "direction label")
	live.Phase = "direct"
	live.Direction = ""
	assert(TownBroadcast.poster(live, 100).direction == "The audience is choosing a direction", "choosing")
	live.House = true
	assert(TownBroadcast.poster(live, 100).performer == "Flip performs the house act", "house act")
	local verdict = table.clone(base)
	verdict.Phase = "host"
	verdict.LastScore = 41
	verdict.LastBand = 1
	verdict.Round = 3
	local host = TownBroadcast.poster(verdict, 100)
	assert(
		host.headline == "THE VERDICT" and not string.find(host.score, "41"),
		"host phase hides the old score"
	)
	verdict.Phase = "reveal"
	verdict.LastScore = 92
	verdict.LastBand = 3
	local reveal = TownBroadcast.poster(verdict, 100)
	assert(reveal.score == "ENCORE! 92" and reveal.band == 3, "encore styling: " .. reveal.score)
	verdict.LastScore = 74
	verdict.LastBand = 2
	assert(TownBroadcast.poster(verdict, 100).score == "THAT LANDED · 74", "middle band")
	verdict.LastScore = -1
	verdict.LastBand = 0
	assert(TownBroadcast.poster(verdict, 100).score == "TAKE IT AGAIN", "unscored verdict")
	verdict.Phase = "idle"
	verdict.LastScore = 92
	verdict.LastBand = 3
	local idle = TownBroadcast.poster(verdict, 100)
	assert(idle.headline == "SEATS OPEN" and idle.score == "LAST ACT · ENCORE! 92", "last act between shows")
	for _, phase in TownBroadcast.phases do
		local any = table.clone(verdict)
		any.Phase = phase
		local poster = TownBroadcast.poster(any, 100)
		assert(poster.headline ~= "", "every phase has a headline: " .. phase)
	end
end)

test("fresh visitors arrive in Broadcast Plaza; the welcome uses no compass words", function()
	local v = Activities.new()
	assert(v.room == "lobby" and Venues.zone(0, 58, 3.05) == "lobby", "plaza arrival is in the lobby zone")
	assert(Venues.arrival(v.room, v.openRevision) == Venues.firstArrival, "first arrival anchor")
	assert(Venues.firstArrival == "PlazaArrival" and Venues.fallbackArrival == "ParkArrival", "anchor names")
	Activities.open(v, "market", false)
	assert(Venues.arrival(v.room, v.openRevision) == "VenueMarket", "later respawns use the chosen room")
	local lower = string.lower(v.notice)
	for _, word in { "north", "south", "east", "west", " left", " right" } do
		assert(not string.find(lower, word, 1, true), "welcome avoids '" .. word .. "'")
	end
	assert(string.find(Activities.new().notice, "Broadcast Plaza", 1, true), "welcome names the plaza")
end)

test("Signal Run copy names the gate the runner actually starts from", function()
	local v = Activities.new()
	Outdoor.setParkStart("the Signal Run gate")
	Outdoor.start(v, "park", 10)
	assert(
		string.find(v.notice, "the Signal Run gate", 1, true)
			and not string.find(v.notice, "bandstand", 1, true),
		"gate away from the bandstand"
	)
	Outdoor.cancelPark(v)
	assert(string.find(v.notice, "the Signal Run gate", 1, true), "cancel names the gate")
	Outdoor.setParkStart("the Signal Run gate by the bandstand")
	Outdoor.start(v, "park", 20)
	assert(string.find(v.notice, "gate by the bandstand", 1, true), "gate beside the bandstand")
	Outdoor.setParkStart("the Signal Run gate")
end)

test("parcels carry their recipient id and the finished riff becomes the entrance sting", function()
	local v, row = Activities.new(), Profiles.blank()
	assert(row.lastRecord == 0, "no sting before a side is played")
	assert(Business.start(v, ShopCatalogue, "post", row, 10, true), "parcel picked up")
	local parcel = v.business
	assert(
		ShopCatalogue.shops[parcel.recipientId]
			and ShopCatalogue.shops[parcel.recipientId].title == parcel.recipient,
		"recipient id matches the address label"
	)
	assert(Business.delivery(v, ShopCatalogue, row, 11, parcel.target, true), "delivered")
	assert(Business.start(v, ShopCatalogue, "records", row, 20, true), "listening deck")
	local r = v.business
	assert(ShopCatalogue.records[r.recordIndex].name == r.recordName, "record index names the side")
	for i, note in r.notes do
		assert(Business.pick(v, ShopCatalogue, row, r.run, note, r.listenUntil + i * 0.3, true), "note")
	end
	assert(r.status == "done" and row.lastRecord == r.recordIndex, "completed side stored")
	local saved = Profiles.blank()
	Profiles.mergePending(saved, row)
	assert(saved.lastRecord == row.lastRecord, "late profile load keeps the sting")
	local records = {}
	local store = {
		UpdateAsync = function(_, key, fn)
			local updated = fn(records[key])
			if updated then
				records[key] = updated
			end
			return updated
		end,
	}
	records.k = { v = 1, data = { lastRecord = 2, stage = 5 } }
	local session = Profiles.open(store, "k", "t", function()
		return 0
	end)
	assert(session and session.row.lastRecord == 2, "stored sting survives the schema cleaner")
	records.j = { v = 1, data = { lastRecord = "Last Tram Home" } }
	local other = Profiles.open(store, "j", "t", function()
		return 0
	end)
	assert(other and other.row.lastRecord == 0, "bad stored sting falls back to none")
end)

print(passed, "town groups passed")
