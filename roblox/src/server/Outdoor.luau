--!strict
-- Open-world activities keep their own clocks and never advance the public show.
local Outdoor = {}
-- Venue measures the start gate against the bandstand at runtime and sets this phrase to match.
Outdoor.parkStart = "the Signal Run gate"
function Outdoor.setParkStart(phrase: string)
	Outdoor.parkStart = phrase
end
Outdoor.destinations = { pier = true, park = true, market = true }
Outdoor.stations = {
	ParkGate1 = { room = "park", title = "First signal arch", action = "Cross arch" },
	ParkGate2 = { room = "park", title = "Second signal arch", action = "Cross arch" },
	ParkGate3 = { room = "park", title = "Final signal arch", action = "Cross arch" },
	MarketPaper = { room = "market", title = "Paper stall", action = "Pick up paper" },
	MarketRibbon = { room = "market", title = "Ribbon stall", action = "Pick up ribbon" },
}
local routes = {
	{ "ParkGate1", "ParkGate2", "ParkGate3", "VenuePark" },
	{ "ParkGate3", "ParkGate2", "ParkGate1", "VenuePark" },
}
local orders = {
	{ name = "Festival fan", stamp = "Sun", materials = { "MarketPaper", "MarketRibbon", "VenueMarket" } },
	{
		name = "Moonrise playbill",
		stamp = "Moon",
		materials = { "MarketRibbon", "MarketPaper", "VenueMarket" },
	},
	{
		name = "Opening-night parcel",
		stamp = "Star",
		materials = {
			"MarketPaper",
			"MarketRibbon",
			"VenueMarket",
		},
	},
	{
		name = "Starlight invitation",
		stamp = "Star",
		materials = {
			"MarketRibbon",
			"MarketPaper",
			"VenueMarket",
		},
	},
	{
		name = "Sunburst pennant",
		stamp = "Sun",
		materials = { "MarketRibbon", "MarketPaper", "VenueMarket" },
	},
	{
		name = "Midnight thank-you",
		stamp = "Moon",
		materials = { "MarketPaper", "MarketRibbon", "VenueMarket" },
	},
}
local timings = { { 1.9, 4.6, 7.9 }, { 2.4, 5.1, 8.3 }, { 1.65, 4.05, 7.35 } }
function Outdoor.start(v, kind, time)
	if not Outdoor.destinations[kind] then
		return false
	end
	local old = v.outdoor
	if old and old.status == "active" and old.kind == kind and time < old.deadline then
		return false
	end
	v.run += 1
	local run =
		{ kind = kind, run = v.run, started = time, lastAt = time, status = "active", progress = 0, xp = 0 }
	if kind == "pier" then
		run.title = "Buoy Watch"
		run.deadline = time + 10
		run.total = 3
		run.hits = 0
		run.beats = timings[(v.run - 1) % #timings + 1]
		run.reels = {}
		run.target = "VenuePier"
		run.notice = "Reel when the buoy lamp flashes. Three signals are coming."
	elseif kind == "park" then
		run.title = "Signal Run"
		run.deadline = time + 90
		run.total = 4
		run.route = routes[(v.run - 1) % #routes + 1]
		run.target = run.route[1]
		run.notice = "Run through the marked signal arches, then race back to " .. Outdoor.parkStart .. "."
	else
		local order = orders[(v.run - 1) % #orders + 1]
		run.title = "Wrap Counter"
		run.deadline = time + 120
		run.total = 3
		run.orderName = order.name
		run.stamp = order.stamp
		run.route = order.materials
		run.target = run.route[1]
		run.notice = "Fill the "
			.. order.name
			.. " order. Collect both materials and use the "
			.. order.stamp
			.. " stamp."
	end
	v.outdoor = run
	v.notice = run.notice
	return true
end
local function active(v, kind, runId, time)
	local r = v.outdoor
	return if r
			and r.kind == kind
			and r.run == runId
			and r.status == "active"
			and time < r.deadline
		then r
		else nil
end
local function finish(v, r, time, xp, message)
	r.status = "done"
	r.finished = time
	r.seconds = math.round((time - r.started) * 100) / 100
	r.xp = xp
	r.target = nil
	r.notice = message
	v.notice = message
end
local function finishPier(v, r, time)
	r.score = math.round(r.hits * 100 / 3)
	finish(
		v,
		r,
		time,
		r.hits,
		string.format("Buoy watch complete · %d/3 signals · +%d stage XP.", r.hits, r.hits)
	)
end
function Outdoor.tap(v, runId, time, near)
	local r = active(v, "pier", runId, time)
	if not r or not near or time - r.lastAt < 0.42 then
		return false
	end
	r.lastAt = time
	for i, beat in r.beats do
		if not r.reels[tostring(i)] and math.abs(time - r.started - beat) <= 0.8 then
			r.reels[tostring(i)] = true
			r.hits += 1
			r.progress = r.hits
			r.notice = "Signal caught · " .. r.hits .. "/3"
			v.notice = r.notice
			if r.hits == 3 then
				finishPier(v, r, time)
			end
			return true
		end
	end
	r.notice = "Wait for the buoy lamp, then reel."
	v.notice = r.notice
	return true
end
function Outdoor.step(v, kind, runId, station, time, near)
	local r = active(v, kind, runId, time)
	if
		not r
		or not near
		or r.target ~= station
		or time - r.lastAt < 0.55
		or (kind ~= "park" and kind ~= "market")
	then
		return false
	end
	if kind == "market" and station == "VenueMarket" then
		return false
	end
	r.lastAt = time
	r.progress += 1
	r.target = r.route[r.progress + 1]
	if kind == "park" and r.progress == r.total then
		finish(
			v,
			r,
			time,
			5,
			string.format("Circuit complete · %.2f seconds · +5 crowd XP.", time - r.started)
		)
	elseif kind == "park" then
		r.notice = if r.target == "VenuePark"
			then "Final arch cleared. Run back to " .. Outdoor.parkStart .. "."
			else "Arch cleared. Follow the next signal flag."
	elseif r.target == "VenueMarket" then
		r.notice = "Both materials ready. Return to the wrap counter and stamp " .. r.stamp .. "."
	else
		r.notice = "Material collected. Find the next marked stall."
	end
	v.notice = r.notice
	return true
end
function Outdoor.wrap(v, runId, stamp, time, near)
	local r = active(v, "market", runId, time)
	if not r or not near or r.target ~= "VenueMarket" or not table.find({ "Moon", "Sun", "Star" }, stamp) then
		return false
	end
	if stamp ~= r.stamp then
		r.notice = "The order calls for the " .. r.stamp .. " stamp. Check the ticket and try again."
		v.notice = r.notice
		return true
	end
	r.progress = r.total
	finish(v, r, time, 4, "Order wrapped · " .. r.orderName .. " · +4 crowd XP.")
	return true
end
function Outdoor.tick(v, time)
	local r = v.outdoor
	if not r or r.status ~= "active" or time < r.deadline then
		return false
	end
	if r.kind == "pier" then
		finishPier(v, r, time)
	else
		r.status = "expired"
		r.target = nil
		r.notice = "Time is up. Return to the start for a fresh ticket."
		v.notice = r.notice
	end
	return true
end
function Outdoor.cancelPark(v)
	local r = v.outdoor
	if r and r.kind == "park" and r.status == "active" then
		r.status = "expired"
		r.target = nil
		r.notice = "Timed run ended. Start a new circuit at " .. Outdoor.parkStart .. "."
		v.notice = r.notice
	end
end
function Outdoor.reward(r, row)
	if not r or r.status ~= "done" or r.rewarded then
		return false
	end
	r.rewarded = true
	if r.kind == "pier" then
		row.stage += r.xp
		row.pierBest = math.max(row.pierBest, r.score)
		if r.hits == 3 then
			row.badges["harbour-hand"] = true
		end
	elseif r.kind == "park" then
		row.crowd += r.xp
		row.parkRuns += 1
		local ms = math.round(r.seconds * 1000)
		if row.parkBestMs == 0 or ms < row.parkBestMs then
			row.parkBestMs = ms
		end
		row.badges["signal-sprinter"] = true
	else
		row.crowd += r.xp
		row.marketOrders += 1
		row.badges["market-maker"] = true
	end
	return true
end
return Outdoor
