--!strict
-- Landmarks and personal objectives stay in sync with the player's physical position.
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Delivery")
local Input = game:GetService("UserInputService")
local Gui = game:GetService("GuiService")
local Venues = require(Shared:WaitForChild("Venues"))
local Modes = require(Shared.Modes)
local Instruments = require(script.Parent.DeliveryInstruments)
local FittingPreview = require(script.Parent.FittingPreview)
local DistrictMap = require(script.Parent.DistrictMap)
local Guide = {}
local ink = Color3.fromRGB(31, 25, 42)
local paper = Color3.fromRGB(251, 239, 212)
local cream = Color3.fromRGB(253, 243, 225)
local muted = Color3.fromRGB(80, 64, 94)
local gold = Color3.fromRGB(255, 208, 111)
local violet = Color3.fromRGB(190, 151, 225)
local rooms = {
	pier = {
		tag = "WATERFRONT / BUOY WATCH",
		hint = "Follow Lantern Street west to the pier. Work the crane and reel when the buoy lamp flashes.",
	},
	park = {
		tag = "EAST DISTRICT / SIGNAL RUN",
		hint = "Follow Lantern Street east to the park. Cross the marked arches in ticket order, then return to the bandstand.",
	},
	market = {
		tag = "SOUTH DISTRICT / NIGHT MARKET",
		hint = "Follow the street around the rooftop terrace to the market. Find the two wrapping supplies, then stamp the customer’s order.",
	},
	lobby = {
		tag = "ARRIVALS",
		hint = "Take the streetcar to the waterfront or Signal Park. At the marquee, match the three bulbs to the ticket.",
	},
	theatre = {
		tag = "LIVE SHOW",
		hint = "Take an audience seat. Direct, react and rate, or volunteer for a ten-second act.",
	},
	studio = {
		tag = "SOUND PRACTICE",
		hint = "Rehearse a three-cue soundtrack on the pads. Earn stage XP for timing.",
	},
	writers = {
		tag = "CARD WORKSHOP",
		hint = "Mix a setup and a punchline. Stamp your card and perform it on the main stage.",
	},
	warehouse = {
		tag = "PROP RUN",
		hint = "Check the dispatch order, find three props in sequence and bring them to the desk.",
	},
	atelier = {
		tag = "COSTUME FITTING",
		hint = "Try a stage look, inspect your wardrobe and check your dated playbill.",
	},
	balcony = {
		tag = "VIEWING GALLERY",
		hint = "Frame a cast portrait at the rooftop camera and optionally save it. From a seat, call three scores to earn Balcony Critic.",
	},
}
local function box(parent, name, colour)
	local b = Instance.new("Frame")
	b.Name = name
	b.BorderSizePixel = 0
	b.BackgroundColor3 = colour
	b.Parent = parent
	return b
end
local function round(obj, r)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, r)
	c.Parent = obj
end
local function label(parent, name, font, colour, pixels)
	local t = Instance.new("TextLabel")
	t.Name = name
	t.Text = ""
	t.TextScaled = true
	t.TextWrapped = true
	t.BackgroundTransparency = 1
	t.TextColor3 = colour
	t.Font = font
	t.TextXAlignment = Enum.TextXAlignment.Left
	local size = Instance.new("UITextSizeConstraint")
	size.MinTextSize = 10
	size.MaxTextSize = pixels
	size.Parent = t
	t.Parent = parent
	return t
end
local function btn(parent, name)
	local b = Instance.new("TextButton")
	b.Name = name
	b.TextSize = 14
	b.TextWrapped = true
	b.Font = Enum.Font.GothamBold
	b.BorderSizePixel = 0
	b.BackgroundColor3 = muted
	b.TextColor3 = cream
	b.Selectable = true
	round(b, 6)
	b.Parent = parent
	return b
end
local function roomName(id)
	return if Venues.rooms[id] then Venues.rooms[id].title else "Broadcast District"
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

local targetNames = {
	ParkGate1 = "Gate 1",
	ParkGate2 = "Gate 2",
	ParkGate3 = "Gate 3",
	VenuePark = "Finish line",
	MarketPaper = "Paper stall",
	MarketRibbon = "Ribbon stall",
	VenueMarket = "Wrap counter",
}
function Guide.new(ui, send, openPage, notify)
	local fitting = FittingPreview.new(ui.gui)
	local selectedLook = nil
	local soundedRun, soundedIndex = 0, 0
	local lastNotice = ""
	local noticeUntil = 0
	local arrived = os.clock()
	local nextLocation = 0
	local waypoint: BillboardGui? = nil
	local waypointName: string? = nil
	local nextWaypointLookup = 0
	local function characterRoot()
		local character = game:GetService("Players").LocalPlayer.Character
		local root = character and character:FindFirstChild("HumanoidRootPart")
		return if root and root:IsA("BasePart") then root else nil
	end
	local function readZone(fallback)
		local root = characterRoot()
		if not root then
			return fallback
		end
		local pos = root.Position
		return Venues.zone(pos.X, pos.Z, pos.Y)
	end
	local function propWaypoint(page, venue)
		local job = venue and venue.job
		local trip = venue and venue.outdoor
		local root = characterRoot()
		local name: string? = nil
		local title = ""
		if page == "explore" and root then
			local pos = root.Position
			local id = Venues.zone(pos.X, pos.Z, pos.Y)
			if id == "warehouse" and job and job.status == "active" then
				local item = job.order[job.picked + 1]
				name = if item then Venues.props[item] else Venues.rooms.warehouse.anchor
				title = item or "Dispatch desk"
			elseif
				trip
				and trip.status == "active"
				and trip.kind == id
				and trip.target
				and trip.kind ~= "pier"
			then
				name = trip.target
				title = targetNames[name] or "Next stop"
			end
		end
		local target = waypoint and waypoint.Adornee
		if name ~= waypointName or (waypoint and (not target or not target:IsDescendantOf(workspace))) then
			if waypoint then
				waypoint:Destroy()
			end
			waypoint = nil
			waypointName = name
			nextWaypointLookup = 0
		end
		if not name or not root then
			return
		end
		if not waypoint and os.clock() >= nextWaypointLookup then
			nextWaypointLookup = os.clock() + 1
			local set = workspace:FindFirstChild("ShowSet")
			local anchor = set and set:FindFirstChild(name, true)
			if anchor and anchor:IsA("BasePart") then
				local pin = Instance.new("BillboardGui")
				pin.Name = "PersonalObjectiveWaypoint"
				pin.Size = UDim2.fromOffset(92, 22)
				pin.StudsOffsetWorldSpace = Vector3.new(0, 3.4, 0)
				pin.MaxDistance = 75
				pin.AlwaysOnTop = true
				pin.LightInfluence = 0
				pin.Active = false
				pin.Adornee = anchor
				local caption = label(pin, "Destination", Enum.Font.GothamBold, ink, 13)
				caption.Size = UDim2.fromScale(1, 1)
				caption.BackgroundTransparency = 0
				caption.BackgroundColor3 = gold
				caption.TextXAlignment = Enum.TextXAlignment.Center
				caption.Text = title
				round(caption, 6)
				pin.Parent = ui.gui.Parent
				waypoint = pin
			end
		end
		target = waypoint and waypoint.Adornee
		if waypoint and target and target:IsA("BasePart") then
			waypoint.Enabled = (root.Position - target.Position).Magnitude > 7
		end
	end
	local roam = box(ui.gui, "VenueLocation", ink)
	roam.Position = UDim2.fromOffset(12, 6)
	local cap = Instance.new("UISizeConstraint")
	cap.MaxSize = Vector2.new(360, 82)
	cap.Parent = roam
	round(roam, 9)
	local rail = box(roam, "Brass", gold)
	rail.Position = UDim2.fromOffset(0, 8)
	rail.Size = UDim2.new(0, 3, 1, -16)
	local place = label(roam, "Place", Enum.Font.GothamBold, cream, 17)
	place.Position = UDim2.fromOffset(11, 4)
	place.Size = UDim2.new(1, -17, 0, 20)
	local objective = label(roam, "Objective", Enum.Font.GothamMedium, violet, 13)
	objective.Position = UDim2.fromOffset(11, 26)
	objective.Size = UDim2.new(1, -17, 1, -29)
	roam.Visible = false

	local shade = box(ui.gui, "VenueMapShade", Color3.fromRGB(16, 13, 23))
	shade.Size = UDim2.fromScale(1, 1)
	shade.BackgroundTransparency = 0.35
	shade.ZIndex = 6
	shade.Visible = false
	shade.Active = true
	local sheet = box(shade, "FoldoutMap", paper)
	sheet.AnchorPoint = Vector2.new(0.5, 0.5)
	sheet.Position = UDim2.fromScale(0.5, 0.5)
	local sizeCap = Instance.new("UISizeConstraint")
	sizeCap.MaxSize = Vector2.new(790, 470)
	sizeCap.Parent = sheet
	round(sheet, 10)
	local heading = label(sheet, "MapTitle", Enum.Font.GothamBlack, ink, 25)
	heading.Text = "District map"
	heading.Position = UDim2.fromOffset(14, 2)
	local close = btn(sheet, "CloseMap")
	close.Text = "Close map"
	close.AnchorPoint = Vector2.new(1, 0)
	close.Position = UDim2.new(1, -8, 0, 3)
	close.Size = UDim2.fromOffset(96, 44)
	close.Activated:Connect(function()
		openPage("return")
	end)
	local guideButton = btn(sheet, "ShowGuide")
	guideButton.Text = "How to play"
	guideButton.AnchorPoint = Vector2.new(1, 0)
	guideButton.Position = UDim2.new(1, -108, 0, 3)
	guideButton.Size = UDim2.fromOffset(88, 44)
	guideButton.Activated:Connect(function()
		openPage("help")
	end)
	heading.Size = UDim2.new(1, -207, 0, 27)
	local legendDot = box(sheet, "YourPositionKey", Color3.fromRGB(45, 37, 45))
	legendDot.Position = UDim2.fromOffset(15, 34)
	legendDot.Size = UDim2.fromOffset(10, 10)
	round(legendDot, 6)
	local centre = box(legendDot, "PositionColour", Color3.fromRGB(75, 225, 225))
	centre.Position = UDim2.fromOffset(2, 2)
	centre.Size = UDim2.fromOffset(6, 6)
	round(centre, 4)
	local legend = label(sheet, "PositionLegend", Enum.Font.GothamMedium, ink, 12)
	legend.Text = "Your location"
	legend.Position = UDim2.fromOffset(30, 29)
	legend.Size = UDim2.new(1, -228, 0, 18)
	local floor = box(sheet, "FloorPlan", Color3.fromRGB(217, 200, 177))
	round(floor, 7)
	local aside = box(sheet, "RoomGuide", ink)
	round(aside, 7)
	local tag = label(aside, "Activity", Enum.Font.GothamBold, gold, 12)
	local title = label(aside, "SelectedRoom", Enum.Font.GothamBlack, cream, 23)
	local description = label(aside, "Description", Enum.Font.GothamMedium, cream, 15)
	local travel = btn(aside, "Travel")
	travel.BackgroundColor3 = gold
	travel.TextColor3 = ink
	local watch = btn(aside, "WatchHere")
	watch.Text = "Watch show"
	local selected = "park"
	local current = "park"
	local syncing = false
	local atlas
	local function describe(id)
		if not rooms[id] then
			id = "lobby"
		end
		selected = id
		tag.Text = (if current == id then "YOU ARE HERE  /  " else "") .. rooms[id].tag
		title.Text = roomName(id)
		description.Text = rooms[id].hint
		travel.Text = if id == "lobby"
			then "Explore plaza"
			elseif id == "balcony" then "Explore rooftop"
			elseif id == "theatre" then "Walk inside"
			elseif id == "pier" or id == "park" or id == "market" then "Visit landmark"
			else "Visit room"
		watch.Visible = id == "theatre" or id == "balcony"
		travel.Size = if watch.Visible then UDim2.new(0.5, -12, 0, 44) else UDim2.new(1, -18, 0, 44)
		atlas.select(id)
	end
	atlas = DistrictMap.new(floor, describe)
	travel.Activated:Connect(function()
		if syncing then
			return
		end
		syncing = true
		travel.Text = "Travelling…"
		send({ op = "travel", room = selected, walk = selected == "balcony" or selected == "theatre" })
		task.delay(1.2, function()
			if syncing then
				syncing = false
				describe(selected)
			end
		end)
	end)
	watch.Activated:Connect(function()
		if syncing then
			return
		end
		syncing = true
		send({ op = "travel", room = selected })
		task.delay(1.2, function()
			if syncing then
				syncing = false
				describe(selected)
			end
		end)
	end)
	local function layout()
		local size = ui.gui.AbsoluteSize
		roam.Size = UDim2.new(
			0,
			math.clamp(size.X - (if size.X < 500 then 168 else 236), 112, 360),
			0,
			if size.X < 590 then 66 else 55
		)
		local portrait = size.X < 510 and size.Y > size.X
		sheet.Size = UDim2.fromScale(0.965, if portrait then 0.90 else 0.94)
		if portrait then
			floor.Position = UDim2.fromOffset(9, 52)
			floor.Size = UDim2.new(1, -18, 0.53, -48)
			aside.Position = UDim2.new(0, 9, 0.53, 12)
			aside.Size = UDim2.new(1, -18, 0.47, -21)
		else
			floor.Position = UDim2.fromOffset(9, 51)
			floor.Size = UDim2.new(0.61, -13, 1, -61)
			aside.Position = UDim2.new(0.61, 3, 0, 51)
			aside.Size = UDim2.new(0.39, -13, 1, -61)
		end
		tag.Position = UDim2.fromOffset(10, 7)
		tag.Size = UDim2.new(1, -20, 0, 17)
		title.Position = UDim2.fromOffset(10, 25)
		title.Size = UDim2.new(1, -20, 0, 34)
		description.Position = UDim2.fromOffset(10, 61)
		description.Size = UDim2.new(1, -20, 1, -113)
		travel.Position = UDim2.new(0, 9, 1, -49)
		travel.Size = if watch.Visible then UDim2.new(0.5, -12, 0, 44) else UDim2.new(1, -18, 0, 44)
		watch.Position = UDim2.new(0.5, 2, 1, -49)
		watch.Size = UDim2.new(0.5, -11, 0, 44)
	end
	ui.gui:GetPropertyChangedSignal("AbsoluteSize"):Connect(layout)
	layout()
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
	local function roaming(v)
		local id = readZone(if v then v.room else "park")
		local root = characterRoot()
		local street = id == "lobby"
			and root
			and math.abs(root.Position.X) > 27
			and math.abs(root.Position.Z - 74.5) < 9
		local marketWalk = id == "lobby" and root and root.Position.Z > 100 and root.Position.Z < 149
		place.Text = if street or id == "promenade"
			then "Lantern Street"
			elseif marketWalk then "Market Walk"
			else roomName(id)
		local job = v and v.job
		if os.clock() < noticeUntil and lastNotice ~= "" then
			objective.Text = lastNotice
		elseif
			v
			and v.outdoor
			and v.outdoor.status == "active"
			and (id == v.outdoor.kind or not job or job.status ~= "active")
		then
			local trip = v.outdoor
			local seconds = math.max(0, math.ceil(trip.deadline - workspace:GetServerTimeNow()))
			local nextStop = targetNames[trip.target]
				or (if trip.kind == "pier" then "Work the buoy crane" else "Follow the marker")
			objective.Text =
				string.format("%d/%d  ·  %s  ·  %ds", trip.progress, trip.total, nextStop, seconds)
		elseif job and job.status == "active" then
			local target = job.order[job.picked + 1]
			objective.Text = if target
				then string.format("Dispatch · %d/%d · Find %s", job.picked, #job.order, target)
				else "Dispatch · Return all props to the desk."
		elseif street then
			objective.Text = "Pier to the west · Signal Park to the east · Streetcar stops on this road."
		elseif marketWalk then
			objective.Text = "Follow the terrace path south to the Night Market."
		elseif id == "park" then
			objective.Text = if os.clock() - arrived < 22
				then "Walk ahead to Signal Run, or board the streetcar on your left."
				else "Start Signal Run at the bandstand. The streetcar goes west to the plaza and pier."
		elseif id == "lobby" then
			objective.Text = "Ride the streetcar or match the bulbs at Marquee Relay."
		elseif rooms[id] then
			objective.Text = rooms[id].hint
		else
			objective.Text = "Lantern Street runs from the pier to the park. The Night Market is south."
		end
	end
	local function setView(page, s)
		local v = s.venue
		propWaypoint(page, v)
		current = if v and rooms[v.room] then v.room else "park"
		if v and not v.watching and (page == "map" or page == "explore") then
			local physical = readZone(current)
			if rooms[physical] then
				current = physical
			end
		end
		local wasOpen = shade.Visible
		shade.Visible = page == "map"
		roam.Visible = page == "explore"
		if shade.Visible then
			local root = characterRoot()
			if root then
				atlas.track(root.Position)
			end
			if not wasOpen then
				syncing = false
				atlas.open(current)
				describe(current)
				if Input.PreferredInput == Enum.PreferredInput.Gamepad then
					Gui.SelectedObject = atlas.nodes[current]
				end
			elseif not syncing then
				describe(selected)
			end
		end
		if v and v.notice and v.notice ~= lastNotice then
			lastNotice = v.notice
			noticeUntil = if (v.revision or 0) > 0 then os.clock() + 2.5 else 0
		end
		if roam.Visible then
			roaming(v)
		end
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
				elseif page == "park" then "Cross three marked arches and return to the bandstand."
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
					then "Cross the numbered gates in order, then return to the start."
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
		if page == "pier" or page == "park" or page == "market" then
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
	local function tick(page, s)
		if page == "explore" and os.clock() >= nextLocation then
			nextLocation = os.clock() + 0.35
			propWaypoint(page, s.venue)
			roaming(s.venue)
		end
		if page == "map" then
			local root = characterRoot()
			if root then
				atlas.track(root.Position)
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
	}
end
return Guide
