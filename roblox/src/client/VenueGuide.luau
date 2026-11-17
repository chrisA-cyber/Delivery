--!strict
-- Landmarks and personal objectives stay in sync with the player's physical position: the location
-- strip, the first-minute ticket stub, the objective chevron and the illustrated district map.
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Delivery")
local Players = game:GetService("Players")
local Input = game:GetService("UserInputService")
local Gui = game:GetService("GuiService")
local Venues = require(Shared:WaitForChild("Venues"))
local Modes = require(Shared.Modes)
local Instruments = require(script.Parent.DeliveryInstruments)
local FittingPreview = require(script.Parent.FittingPreview)
local DistrictMap = require(script.Parent.DistrictMap)
local TownCounters = require(script.Parent.TownCounters)
local Style = require(script.Parent.GuideStyle)
local Glyphs = require(script.Parent.GuideGlyphs)
local GuideShow = require(script.Parent.GuideShow)
local GuideStrip = require(script.Parent.GuideStrip)
local GuideStub = require(script.Parent.GuideStub)
local GuideChevron = require(script.Parent.GuideChevron)
local Guide = {}
local ink = Color3.fromRGB(31, 25, 42)
local muted = Color3.fromRGB(80, 64, 94)
local gold = Color3.fromRGB(255, 208, 111)
local cream = Color3.fromRGB(253, 243, 225)
-- Map card and strip copy. Directions use landmarks only: there is no compass on screen.
local rooms = {
	pier = {
		tag = "WATERFRONT / BUOY WATCH",
		hint = "Follow Lantern Street past Dockside Post to the boardwalk. Reel in when the buoy lamp flashes.",
		goal = "Reel in when the buoy lamp flashes.",
	},
	park = {
		tag = "SIGNAL PARK / SIGNAL RUN",
		hint = "Follow Lantern Street past Needle Drop to the park. Start Signal Run at the gate by the bandstand.",
		goal = "Start Signal Run at the gate by the bandstand.",
	},
	market = {
		tag = "MARKET SQUARE / NIGHT MARKET",
		hint = "Take Market Walk beside the rooftop terrace. Find the two wrapping supplies, then stamp the customer’s order.",
		goal = "Two wrapping supplies, then stamp the order.",
	},
	lobby = {
		tag = "ARRIVALS / LIVE SHOW",
		hint = "The live show is through the gold doors under the DELIVERY marquee. Lot Line cars stop on Lantern Street.",
		goal = "The show is through the gold doors.",
	},
	theatre = {
		tag = "LIVE SHOW",
		hint = "Take an audience seat. Direct, react and rate, or volunteer for a ten-second act.",
		goal = "Take a seat, react and vote.",
	},
	studio = {
		tag = "SOUND PRACTICE",
		hint = "Rehearse a three-cue soundtrack on the pads. Earn stage XP for timing.",
		goal = "Rehearse three sound cues at the console.",
	},
	writers = {
		tag = "CARD WORKSHOP",
		hint = "Mix a setup and a punchline. Stamp your card and perform it on the main stage.",
		goal = "Mix a setup and a punchline at the desk.",
	},
	warehouse = {
		tag = "PROP RUN",
		hint = "Check the dispatch order, find three props in sequence and bring them to the desk.",
		goal = "Take a three-prop order at the desk.",
	},
	atelier = {
		tag = "COSTUME FITTING",
		hint = "Try a stage look, inspect your wardrobe and check your dated playbill.",
		goal = "Try on a stage look at the mirror.",
	},
	balcony = {
		tag = "CRITICS’ BALCONY / PORTRAITS",
		hint = "Frame a cast portrait at the rooftop camera and optionally save it. From a seat, call three scores to earn Balcony Critic.",
		goal = "Frame a cast portrait at the rooftop camera.",
	},
	clock = {
		tag = "CLOCK COURT / BELLS",
		hint = "The clock tower's three bells, benches and the lane between Needle Drop and Market Walk.",
		goal = "Ring the three bells or take a bench.",
	},
}
for id, shop in TownCounters.shops do
	rooms[id] = shop
end
-- Title cards and strip titles for each part of town.
local places = {
	lobby = { "Broadcast Plaza", "Home of the Delivery live show" },
	theatre = { "Main Theatre", "Live comedy on the main stage" },
	balcony = { "Sky Lounge", "Rooftop portraits and the best seats" },
	studio = { "Studio B", "Sound practice" },
	writers = { "Writers’ Room", "Card workshop" },
	warehouse = { "Props Depot", "Dispatch desk" },
	atelier = { "Costume Atelier", "Fitting mirror" },
	pier = { "Waterfront Pier", "Buoy Watch · gulls · the sea" },
	park = { "Signal Park", "Start Signal Run at the gate by the bandstand" },
	market = { "Night Market", "Stalls, string lights and the wrap counter" },
	post = { "Dockside Post", "Parcels for the whole town" },
	records = { "Needle Drop Records", "The listening deck" },
	cafe = { "Copper Kettle Bakehouse", "Orders up at the counter" },
	gallery = { "Pocket Print Gallery", "The postcard press" },
	street = { "Lantern Street", "From the pier to the park" },
	marketWalk = { "Market Walk", "Bakehouse and print gallery" },
	clock = { "Clock Court", "Bells, benches and the clock tower" },
}
local function roomName(id)
	return if places[id]
		then places[id][1]
		elseif Venues.rooms[id] then Venues.rooms[id].title
		else "Broadcast District"
end
local function pick(p)
	local elapsed = workspace:GetServerTimeNow() - p.started
	for i, beat in p.beats do
		if not p.hits[tostring(i)] and not p.hits[i] and elapsed <= beat.at + 1.15 then
			return i, beat, beat.at - elapsed
		end
	end
	return nil, nil, 0
end

local recipientIds = {
	VenueCafe = "cafe",
	VenueRecords = "records",
	VenueGallery = "gallery",
	VenuePost = "post",
}
local targetNames = {
	ParkGate1 = "Gate 1",
	ParkGate2 = "Gate 2",
	ParkGate3 = "Gate 3",
	VenuePark = "Finish line",
	MarketPaper = "Paper stall",
	MarketRibbon = "Ribbon stall",
	VenueMarket = "Wrap counter",
}
local theatreDoor = Vector3.new(0, 3, 37)
local tramStops = {
	{ x = -104, title = "Waterfront Pier" },
	{ x = 0, title = "Broadcast Plaza" },
	{ x = 104, title = "Signal Park" },
}
local arrivals = {
	theatre = "You made it! Walk through the gold doors to join the show.",
	tram = "Wait by the stop. Hold the prompt when the Lot Line car pulls in.",
	shop = "Walk up to the glowing counter to start.",
}
function Guide.new(ui, send, openPage, notify)
	local player = Players.LocalPlayer
	local root = Style.townRoot(ui)
	local fitting = FittingPreview.new(ui.gui, root)
	local counters = TownCounters.new(ui, send, openPage)
	local chevron = GuideChevron.new(ui.gui.Parent :: PlayerGui, ui.gui)
	local strip = GuideStrip.new(ui.gui, root, function()
		return Style.navWidth(ui)
	end)
	local selectedLook = nil
	local soundedRun, soundedIndex = 0, 0
	local lastNotice = ""
	local noticeSeen = false
	local noticeUntil = 0
	local arrivalUntil = 0
	local arrivalText = ""
	local nextLocation = 0
	local exploreSince: number? = nil
	local lastPlace = ""
	local placeSince = 0
	local cardShownAt: { [string]: number } = {}
	local welcomed = false
	local latest = nil
	local function characterRoot(): BasePart?
		local character = player.Character
		local part = character and character:FindFirstChild("HumanoidRootPart")
		return if part and part:IsA("BasePart") then part else nil
	end
	local function readZone(fallback)
		local body = characterRoot()
		if not body then
			return fallback
		end
		local pos = body.Position
		return Venues.zone(pos.X, pos.Z, pos.Y)
	end
	local function notice(text: string, seconds: number?)
		arrivalText = text
		arrivalUntil = os.clock() + (seconds or 4.5)
		strip.setObjective(text, "arrive")
	end

	-- Chevron targets ------------------------------------------------------------------------------
	local function shopTarget(id: string): GuideChevron.Target
		local shop = Venues.rooms[id]
		return {
			key = "shop/" .. id,
			title = roomName(id),
			icon = Glyphs.place[id] or "pin",
			accent = Style.accent[id],
			anchor = shop and shop.anchor,
			position = shop and Vector3.new(shop.x, 0, shop.z),
			height = 3.4,
			arrive = 8,
		}
	end
	local function placeTarget(id: string): GuideChevron.Target
		if id == "theatre" then
			return {
				key = "place/theatre",
				title = "Main Theatre",
				icon = "theatre",
				accent = Style.accent.theatre,
				position = theatreDoor,
				height = 4,
				arrive = 8,
			}
		elseif id == "clock" then
			return {
				key = "place/clock",
				title = "Clock Court",
				icon = "clock",
				accent = Style.accent.clock,
				position = Vector3.new(91, 0, 128),
				height = 4,
				arrive = 9,
			}
		elseif TownCounters.shops[id] then
			return shopTarget(id)
		end
		local def = Venues.rooms[id]
		return {
			key = "place/" .. id,
			title = roomName(id),
			icon = Glyphs.place[id] or "pin",
			accent = Style.accent[id],
			anchor = def and def.anchor,
			position = def and Vector3.new(def.x, 0, def.z),
			height = 3.4,
			arrive = 9,
		}
	end
	local function nearestStop(): (number, string)
		local body = characterRoot()
		local best, title, gap = 0, "Broadcast Plaza", math.huge
		for _, stop in tramStops do
			local d = if body
				then math.abs(body.Position.X - stop.x) + math.abs(body.Position.Z - 79.5)
				else 0
			if d < gap then
				best, title, gap = stop.x, stop.title, d
			end
		end
		return best, title
	end
	local function errandShop(): string
		-- Dockside Post hands out parcels, so it wins unless another counter is much closer.
		local body = characterRoot()
		if not body then
			return "post"
		end
		local bestId, bestGap = "post", math.huge
		for _, id in { "post", "records", "cafe", "gallery" } do
			local shop = Venues.rooms[id]
			local gap = Vector2.new(body.Position.X - shop.x, body.Position.Z - shop.z).Magnitude
				- (if id == "post" then 40 else 0)
			if gap < bestGap then
				bestId, bestGap = id, gap
			end
		end
		return bestId
	end
	local function taskTarget(v): GuideChevron.Target?
		local parcel = v and v.business
		if parcel and parcel.kind == "post" and parcel.status == "active" and parcel.target then
			local id = parcel.recipientId or recipientIds[parcel.target] or "post"
			return {
				key = "parcel/" .. parcel.target .. "/" .. tostring(parcel.run),
				title = "Deliver to " .. roomName(id),
				icon = Glyphs.place[id] or "parcel",
				accent = Style.accent[id],
				anchor = parcel.target,
				height = 3.6,
				arrive = 5,
			}
		end
		local job = v and v.job
		if job and job.status == "active" then
			local item = job.order[job.picked + 1]
			return {
				key = "job/" .. tostring(job.picked) .. "/" .. tostring(item),
				title = if item then "Find the " .. item else "Dispatch desk",
				icon = "crate",
				accent = Style.accent.warehouse,
				anchor = if item then Venues.props[item] else Venues.rooms.warehouse.anchor,
				height = 2.6,
				arrive = 4,
			}
		end
		local trip = v and v.outdoor
		if trip and trip.status == "active" and trip.target and trip.kind ~= "pier" then
			return {
				key = "trip/" .. tostring(trip.run) .. "/" .. trip.target,
				title = targetNames[trip.target] or "Next stop",
				icon = if trip.kind == "park" then "flag" else "lantern",
				accent = Style.accent[trip.kind],
				anchor = trip.target,
				height = 3,
				arrive = 4,
			}
		end
		return nil
	end

	-- Ticket stub ----------------------------------------------------------------------------------
	local stub
	local function stubRows()
		local v = latest and latest.venue
		local b = v and v.business
		stub.setRow("show", {
			title = "Catch the show",
			detail = "Main Theatre · " .. GuideShow.line(),
			icon = "theatre",
			accent = Style.accent.theatre,
		})
		if b and b.kind == "post" and b.status == "active" then
			stub.setRow("errand", {
				title = "Deliver your parcel",
				detail = "To " .. (b.recipient or "the address label"),
				icon = "parcel",
				accent = Style.accent.post,
			})
		else
			local id = errandShop()
			stub.setRow("errand", {
				title = "Run an errand",
				detail = roomName(id) .. " · " .. (rooms[id].goal or ""),
				icon = Glyphs.place[id] or "parcel",
				accent = Style.accent[id],
			})
		end
		local _, stopTitle = nearestStop()
		stub.setRow("tram", {
			title = "Ride the Lot Line",
			detail = "Nearest stop · " .. stopTitle,
			icon = "tram",
			accent = Style.accent.tram,
		})
	end
	stub = GuideStub.new(ui.gui, root, strip.frame, function(choice)
		local v = latest and latest.venue
		local b = v and v.business
		if choice == "show" then
			chevron.set("plan", placeTarget("theatre"))
			notice("Follow the marker to the gold doors.", 4)
		elseif choice == "errand" then
			if b and b.kind == "post" and b.status == "active" then
				chevron.set("plan", nil)
				notice("Follow the marker to " .. (b.recipient or "the counter") .. ".", 4)
			else
				local id = errandShop()
				chevron.set("plan", shopTarget(id))
				notice("Follow the marker to " .. roomName(id) .. ".", 4)
			end
		else
			local x, title = nearestStop()
			chevron.set("plan", {
				key = "tram/" .. title,
				title = "Lot Line · " .. title,
				icon = "tram",
				accent = Style.accent.tram,
				position = Vector3.new(x, 0, 79.5),
				height = 3.6,
				arrive = 7,
			})
			notice("Follow the marker to the Lot Line stop.", 4)
		end
		stub.fold()
	end)
	strip.ticket.Activated:Connect(function()
		stubRows()
		stub.toggle()
	end)
	chevron.onArrive(function(t)
		if string.sub(t.key, 1, 5) == "tram/" then
			notice(arrivals.tram, 5)
		elseif t.key == "place/theatre" then
			notice(arrivals.theatre, 5)
		elseif string.sub(t.key, 1, 5) == "shop/" then
			notice(arrivals.shop, 4.5)
		else
			notice("You've arrived at " .. t.title .. ".", 4)
		end
		Style.click("confirm")
	end)
	GuideShow.changed:Connect(function()
		if stub.isOpen() then
			stubRows()
		end
	end)

	-- District map ---------------------------------------------------------------------------------
	local current = "lobby"
	local syncing = false
	local atlas
	local function travelLabel(id: string): string?
		return if id == "clock"
			then nil
			elseif id == "lobby" then "Explore plaza"
			elseif id == "balcony" then "Explore rooftop"
			elseif id == "theatre" then "Walk inside"
			elseif TownCounters.shops[id] then "Visit shop"
			elseif id == "pier" or id == "park" or id == "market" then "Visit landmark"
			else "Visit room"
	end
	local function afterTravel()
		task.delay(1.2, function()
			if syncing then
				syncing = false
				atlas.refresh()
			end
		end)
	end
	atlas = DistrictMap.new(root, {
		info = function(id: string): DistrictMap.Info
			local def = rooms[id] or rooms.lobby
			local here = id == current
			return {
				tag = (if here then "YOU ARE HERE  ·  " else "") .. def.tag,
				title = roomName(id),
				body = def.hint,
				travel = if syncing then "Travelling…" else travelLabel(id),
				watch = id == "theatre" or id == "balcony",
				here = here,
			}
		end,
		travel = function(id: string)
			if syncing or id == "clock" then
				return
			end
			syncing = true
			atlas.busy("Travelling…")
			send({
				op = "travel",
				room = id,
				walk = id == "balcony" or id == "theatre" or TownCounters.shops[id] ~= nil,
			})
			afterTravel()
		end,
		watch = function(id: string)
			if syncing then
				return
			end
			syncing = true
			send({ op = "travel", room = id })
			afterTravel()
		end,
		destination = function(id: string)
			chevron.set("plan", placeTarget(id))
			openPage("explore")
			notice("Follow the marker to " .. roomName(id) .. ".", 4)
		end,
		close = function()
			openPage("return")
		end,
		help = function()
			openPage("help")
		end,
	})

	-- Location strip -------------------------------------------------------------------------------
	local function placeKey(v): string
		local id = readZone(if v then v.room else "lobby")
		local body = characterRoot()
		if not body then
			return id
		end
		local pos = body.Position
		local clockCourt = (math.abs(pos.X - 99) <= 4.5 and pos.Z >= 92 and pos.Z <= 117)
			or (pos.X >= 78 and pos.X <= 104 and pos.Z >= 115 and pos.Z <= 140)
			or (math.abs(pos.X - 82) <= 4.5 and pos.Z > 140 and pos.Z <= 150)
		if clockCourt then
			return "clock"
		elseif id == "lobby" and math.abs(pos.X) > 27 and math.abs(pos.Z - 74.5) < 9 then
			return "street"
		elseif id == "promenade" then
			return "street"
		elseif id == "lobby" and pos.Z > 100 and pos.Z < 149 then
			return "marketWalk"
		end
		return id
	end
	local function objectiveFor(key: string, v): (string, GuideStrip.Tone)
		if os.clock() < noticeUntil and lastNotice ~= "" then
			return lastNotice, "notice"
		end
		if os.clock() < arrivalUntil and arrivalText ~= "" then
			return arrivalText, "arrive"
		end
		local job = v and v.job
		local trip = v and v.outdoor
		if trip and trip.status == "active" and (key == trip.kind or not job or job.status ~= "active") then
			local seconds = math.max(0, math.ceil(trip.deadline - workspace:GetServerTimeNow()))
			local nextStop = targetNames[trip.target]
				or (if trip.kind == "pier" then "Reel in on the flash" else "Follow the marker")
			return string.format("%d/%d  ·  %s  ·  %ds", trip.progress, trip.total, nextStop, seconds),
				"task"
		end
		local b = v and v.business
		if b and b.kind == "post" and b.status == "active" then
			return "Deliver the parcel to " .. (b.recipient or "its shop") .. ". Follow the marker.", "task"
		end
		if job and job.status == "active" then
			local item = job.order[job.picked + 1]
			return if item
				then string.format("Dispatch %d/%d  ·  Find the %s", job.picked, #job.order, item)
				else "Dispatch  ·  Bring the props to the desk.",
				"task"
		end
		local plan = chevron.get("plan")
		if plan then
			return "Heading to " .. plan.title .. "  ·  follow the marker", "normal"
		end
		if key == "lobby" then
			local status = GuideShow.read()
			return if status.live
				then "The show is on now! Walk through the gold doors."
				else rooms.lobby.goal,
				"normal"
		elseif key == "street" then
			return "Lot Line cars stop along this street. Shops on both sides.", "normal"
		elseif key == "marketWalk" then
			return "The bakehouse and print gallery are on this walk.", "normal"
		elseif rooms[key] and rooms[key].goal then
			return rooms[key].goal, "normal"
		end
		return "Lantern Street links the pier and the park.", "normal"
	end
	local function roaming(v)
		local key = placeKey(v)
		local info = places[key] or places.lobby
		strip.setPlace(key, info[1], Glyphs.place[key] or "pin", Style.accent[key])
		if key ~= lastPlace then
			lastPlace = key
			placeSince = os.clock()
		elseif placeSince > 0 and os.clock() - placeSince >= 0.6 then
			-- Debounced: a district card at most once every 25 s per place, skipped for the arrival plaza
			-- while the welcome toast is on screen.
			placeSince = 0
			local shown = cardShownAt[key]
			if (not shown or os.clock() - shown > 25) and not (key == "lobby" and not welcomed) then
				cardShownAt[key] = os.clock()
				strip.titleCard(info[1], info[2], Style.accent[key])
			end
			welcomed = true
		end
		local text, tone = objectiveFor(key, v)
		strip.setObjective(text, tone)
	end
	local setup, ending = 1, 1
	local draftInitialized = false
	local lastStamp = 0
	local padButtons = {}
	local pending = {}
	local activeRun = 0
	local function pad(s, padName)
		local p = s.venue.practice
		if not p or p.status ~= "playing" then
			return
		end
		local i, _, delta = pick(p)
		if not i then
			return
		end
		if delta > 1.15 then
			notify("Wait for GO before tapping.")
			return
		end
		if pending[i] then
			return
		end
		pending[i] = true
		send({ op = "practicePad", run = p.run, index = i, pad = padName })
		task.delay(0.5, function()
			if activeRun == p.run then
				pending[i] = nil
			end
		end)
	end
	local function setView(page, s)
		local v = s.venue
		latest = s
		counters.setView(page, v)
		current = if v and rooms[v.room] then v.room else "lobby"
		if v and not v.watching and (page == "map" or page == "explore") then
			local physical = readZone(current)
			if rooms[physical] then
				current = physical
			end
		end
		local explore = page == "explore"
		if page == "map" then
			local body = characterRoot()
			if not atlas.isOpen() then
				syncing = false
				atlas.open(current)
				if Input.PreferredInput == Enum.PreferredInput.Gamepad then
					Gui.SelectedObject = atlas.nodes[current]
				end
			elseif not syncing then
				atlas.refresh()
			end
			if body then
				atlas.track(body.Position, body.CFrame.LookVector)
			end
		elseif atlas.isOpen() then
			atlas.close()
		end
		-- A1: the first state (revision 0) carries the arrival welcome. Treat it as fresh and show it for
		-- its full duration, as a toast as well so the ticket stub never hides it.
		if v and v.notice and v.notice ~= lastNotice then
			local first = not noticeSeen
			noticeSeen = true
			lastNotice = v.notice
			local isTitle = Venues.rooms[v.room] and v.notice == Venues.rooms[v.room].title
			if isTitle then
				noticeUntil = 0
			else
				noticeUntil = os.clock() + math.clamp(#v.notice / 15, 3.5, 6.5)
				if first or (v.revision or 0) == 0 then
					Style.toast(v.notice, "info", nil, "arrival", math.clamp(#v.notice / 13, 4.5, 7))
				end
			end
		end
		chevron.set("task", taskTarget(v))
		chevron.setEnabled(explore)
		if explore then
			exploreSince = exploreSince or os.clock()
			roaming(v)
		else
			if stub.isOpen() then
				stub.hide()
			end
			strip.hideCard()
		end
		strip.setVisible(explore and not stub.isOpen())
		if page ~= "atelier" then
			selectedLook = nil
		end
		fitting.show(page == "atelier", selectedLook or (v and v.look) or "house")
		if page ~= "writers" then
			draftInitialized = false
		end
	end
	local function sheetCopy(kicker, main, note)
		ui.kicker.Text = kicker
		ui.card.Text = main
		ui.note.Text = note
	end
	local pulseButton = nil
	local lastStrike = 0
	local function outdoorSheet(page, v, standing)
		local trip = v.outdoor
		if trip and trip.kind ~= page then
			trip = nil
		end
		local active = trip and trip.status == "active"
		local name = if page == "pier"
			then "Buoy Watch"
			elseif page == "park" then "Signal Run"
			else "Wrap Counter"
		ui.phase.Text = string.upper(roomName(page)) .. "   /   " .. string.upper(name)
		if not active then
			local result = trip and trip.status == "done"
			local info = if result
				then (if page == "pier"
					then string.format("%d of 3 signals caught", trip.hits or 0)
					elseif page == "park" then string.format(
						"Finish time · %.1f seconds",
						trip.seconds or 0
					)
					else (trip.orderName or "Order") .. " packed") .. string.format(
					"   ·   +%d %s XP",
					trip.xp or 0,
					if page == "pier" then "stage" else "crowd"
				)
				elseif
					trip and trip.status == "expired"
				then "Time is up. Start a fresh ticket when you are ready."
				elseif page == "pier" then "Reel when the buoy lamp flashes. Catch all three signals."
				elseif
					page == "park"
				then "Start Signal Run at the gate by the bandstand. Cross the three marked arches, then race back."
				else "Collect two supplies and stamp the customer’s parcel."
			local record = "OUTDOOR ACTIVITY"
			if result then
				record = if page == "pier"
					then string.format(
						"PERSONAL BEST  ·  %d%%",
						standing and standing.pierBest or trip.score or 0
					)
					elseif page == "park" then string.format(
						"PERSONAL BEST  ·  %.2fs",
						(standing and standing.parkBestMs or 0) / 1000
					)
					else string.format(
						"ORDERS COMPLETED  ·  %d",
						standing and standing.marketOrders or 1
					)
			end
			sheetCopy(record, name, info)
			ui.button(
				if trip
					then "Play again"
					else (if page == "pier"
						then "Start Buoy Watch"
						elseif page == "park" then "Start Signal Run"
						else "Take market order"),
				function()
					send({ op = "outdoorStart", kind = page })
					if page ~= "pier" then
						openPage("explore")
					end
				end,
				true,
				if page == "pier" then "music" elseif page == "park" then "play" else "award"
			)
		elseif page == "pier" then
			sheetCopy("HARBOR SIGNAL", "Watch the buoy", "Tap as its light pulses.")
			pulseButton = ui.button("Reel in", function()
				if os.clock() - lastStrike < 0.15 then
					return
				end
				lastStrike = os.clock()
				send({ op = "outdoorTap", run = trip.run })
			end, true, "radio")
		elseif page == "market" and trip.target == "VenueMarket" then
			sheetCopy(
				"CUSTOMER TICKET",
				trip.orderName or "Stamp the parcel",
				(trip.notice or ("The ticket calls for " .. tostring(trip.stamp) .. "."))
			)
			for _, stamp in { "Sun", "Moon", "Star" } do
				ui.button(stamp, function()
					send({ op = "outdoorWrap", run = trip.run, stamp = stamp })
				end)
			end
		else
			local target = targetNames[trip.target] or "the next marker"
			sheetCopy(
				"ACTIVE TICKET",
				target,
				if page == "park"
					then "Cross the numbered gates in order, then race back to the gate by the bandstand."
					else "Collect both wrapping supplies from their marked stalls, then return to the counter."
			)
		end
		ui.button("Back to walking", function()
			openPage("explore")
		end)
	end
	local function draw(page, s)
		local v = s.venue
		table.clear(padButtons)
		pulseButton = nil
		if page == "explore" or page == "map" then
			return true
		end
		if not v then
			return false
		end
		if TownCounters.shops[page] then
			counters.draw(page, s)
		elseif page == "pier" or page == "park" or page == "market" then
			outdoorSheet(page, v, s.standing)
		elseif page == "studio" then
			ui.phase.Text = "STUDIO B   /   FOLEY REHEARSAL"
			local p = v.practice
			if p and p.status == "playing" then
				if activeRun ~= p.run then
					activeRun = p.run
					table.clear(pending)
				end
				sheetCopy("REHEARSAL", "Watch for GO", "Tap the named pad at the beat.")
				for _, sound in { "Bell", "Squeak", "Thump" } do
					padButtons[sound] = ui.button(
						sound,
						function()
							pad(s, sound)
						end,
						false,
						if sound == "Bell" then "bell" elseif sound == "Squeak" then "music" else "radio"
					)
				end
			else
				sheetCopy(
					"PRIVATE SOUND CHECK",
					if p and p.status == "done"
						then tostring(p.score or 0) .. "  /  100"
						else "Time the sound effects",
					if p and p.status == "done"
						then string.format("Rehearsal complete · +%d stage XP", p.xp or 0)
						else "Bell, squeak, thump. Hit the three cues as they turn gold. Your mic stays off."
				)
				ui.button(if p and p.status == "done" then "Rehearse again" else "Start rehearsal", function()
					send({ op = "practice" })
				end, true, "headphones")
				ui.button("Back to walking", function()
					openPage("explore")
				end)
			end
		elseif page == "writers" then
			ui.phase.Text = "WRITERS' ROOM   /   CARD PRESS"
			if not draftInitialized then
				draftInitialized = true
				if v.card and v.card.mix then
					setup = math.floor((v.card.mix - 1) / 3) + 1
					ending = (v.card.mix - 1) % 3 + 1
				end
			end
			local mix = (setup - 1) * 3 + ending
			local stamped = v.card and v.card.mix == mix
			sheetCopy(
				"YOUR CUE CARD",
				Modes.setups[setup] .. " " .. Modes.ends[ending],
				if stamped
					then "Stamped and ready. Queue this card for your next performance."
					else "Choose a setup and an ending, then stamp your card."
			)
			ui.button("Change setup", function()
				setup = setup % #Modes.setups + 1
				openPage("writers")
			end)
			ui.button("Change ending", function()
				ending = ending % #Modes.ends + 1
				openPage("writers")
			end)
			if stamped then
				ui.button("Perform this card", function()
					send({ op = "queueCard" })
					openPage("explore")
				end, true, "mic")
			else
				ui.button("Stamp this card", function()
					if os.clock() - lastStamp > 0.35 then
						lastStamp = os.clock()
						send({ op = "write", mix = mix })
					end
				end, true, "book-open")
			end
		elseif page == "atelier" then
			ui.phase.Text = "COSTUME ATELIER   /   FITTING MIRROR"
			local equipped = v.look or "house"
			selectedLook = selectedLook or equipped
			local info = Venues.looks[selectedLook] or Venues.looks.house
			local owned = not info.badge or (s.standing and s.standing.badges[info.badge])
			local note = if owned
				then (if selectedLook == equipped
					then "Equipped. Your stage look travels with you."
					else "Preview your light and microphone in the mirror, then equip this look.")
				elseif
					selectedLook == "cobalt"
				then "Earn this mic by landing two cues in a Studio B rehearsal."
				else "Earn this stand by delivering a Props Warehouse order."
			sheetCopy("FITTING MIRROR", info.name, note)
			for _, id in { "house", "apricot", "cobalt", "cherry" } do
				local look = Venues.looks[id]
				ui.button(look.name, function()
					selectedLook = id
					openPage("atelier")
				end, id == selectedLook)
			end
			if owned and selectedLook ~= equipped then
				ui.button("Equip this look", function()
					send({ op = "fit", look = selectedLook })
				end, true)
			end
			ui.button("Wardrobe shop", function()
				openPage("shop")
			end)
		elseif page == "warehouse" then
			ui.phase.Text = "PROP WAREHOUSE   /   DISPATCH"
			local job = v.job
			if job and job.status == "active" then
				local item = job.order[job.picked + 1]
				sheetCopy(
					"DISPATCH ORDER",
					if item then "Find the " .. item else "Deliver your props",
					if item
						then string.format(
							"%d of %d collected. Walk to the labeled prop and use its pickup prompt.",
							job.picked,
							#job.order
						)
						else "Return to the dispatch desk and use its delivery prompt."
				)
				ui.button("Walk the warehouse", function()
					openPage("explore")
				end, true)
			else
				sheetCopy(
					"BACKSTAGE DISPATCH",
					if job and job.status == "done" then "Props delivered" else "Run a prop order",
					if job and job.status == "done"
						then string.format("Delivery complete · +%d crowd XP", job.xp or 0)
						else "Pick up three props in the listed order and bring them back to this desk."
				)
				ui.button("Take an order", function()
					send({ op = "job" })
					openPage("explore")
				end, true)
			end
		else
			return false
		end
		return true
	end
	local nextRows = 0
	local function tick(page, s)
		latest = s
		counters.tick(page, s)
		if page == "explore" then
			-- Ticket stub: once per session, about 1.5 s after the first walking frame.
			if not stub.shown() and exploreSince and os.clock() - exploreSince >= 1.5 and characterRoot() then
				stubRows()
				stub.open(12)
			end
			stub.tick()
			if stub.isOpen() and os.clock() >= nextRows then
				nextRows = os.clock() + 1
				stubRows()
			end
			strip.setVisible(not stub.isOpen())
			strip.setTicket(stub.isOpen(), not stub.shown())
			if os.clock() >= nextLocation then
				nextLocation = os.clock() + 0.3
				chevron.set("task", taskTarget(s.venue))
				roaming(s.venue)
			end
		end
		if page == "map" then
			local body = characterRoot()
			if body then
				atlas.track(body.Position, body.CFrame.LookVector)
			end
		end
		if page == "pier" and pulseButton and s.venue and s.venue.outdoor then
			local trip = s.venue.outdoor
			local elapsed = workspace:GetServerTimeNow() - trip.started
			local delta, index = nil, nil
			for i, at in trip.beats or {} do
				if not (trip.reels and trip.reels[tostring(i)]) and elapsed < at + 0.8 then
					delta, index = at - elapsed, i
					break
				end
			end
			local go = delta and delta <= 0.25
			ui.kicker.Text = if index then string.format("BUOY SIGNAL %d / 3", index) else "HARBOR SIGNALS"
			ui.card.Text = if go
				then "PULSE  ·  Reel now"
				elseif delta then string.format("Signal in %.1fs", delta)
				else "Waiting for the result"
			ui.note.Text = string.format("%d of 3 caught", trip.hits or 0)
			pulseButton.BackgroundColor3 = if go then gold else muted
			pulseButton.TextColor3 = if go then ink else cream
			ui.clock(math.max(0, trip.deadline - workspace:GetServerTimeNow()), trip.deadline - trip.started)
			return
		end
		if page ~= "studio" then
			return
		end
		local p = s.venue and s.venue.practice
		if not p or p.status ~= "playing" then
			return
		end
		if p.last and (p.run ~= soundedRun or p.last.index ~= soundedIndex) then
			soundedRun, soundedIndex = p.run, p.last.index
			Instruments.strike(p.last.pad)
		end
		local i, beat, offset = pick(p)
		local go = beat and offset <= 0.18
		ui.kicker.Text = if i then "CUE " .. i .. " / " .. #p.beats else "REHEARSAL"
		ui.card.Text = if beat
			then (if go then "GO  ·  " .. beat.pad else string.format("%s in %.1fs", beat.pad, offset))
			else "Cues complete"
		ui.note.Text = if p.last
			then p.last.pad .. " · " .. p.last.label
			else "Match the sound when GO appears."
		for name, b in padButtons do
			local hot = go and beat.pad == name
			b.BackgroundColor3 = if hot then gold else muted
			b.TextColor3 = if hot then ink else cream
		end
		ui.clock(math.max(0, p.deadline - workspace:GetServerTimeNow()), p.deadline - p.started)
	end
	return {
		setView = setView,
		draw = draw,
		tick = tick,
		roomId = function()
			return readZone(current)
		end,
		-- Pages whose UI is drawn by the town (not the ControlDesk): Main can skip showing ui.panel.
		ownsSheet = function(page: string): boolean
			return TownCounters.shops[page] ~= nil
		end,
		-- Sets the chevron to a place id (e.g. from a HUD shortcut). Never teleports.
		guideTo = function(id: string)
			chevron.set("plan", placeTarget(id))
		end,
	}
end
return Guide
