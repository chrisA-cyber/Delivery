--!strict
local Players = game:GetService("Players")
local Shared = game:GetService("ReplicatedStorage").Delivery
local Venues = require(Shared.Venues)
local Foley = require(Shared.Foley)
local Modes = require(Shared.Modes)
local Activities = require(script.Parent.VenueActivities)
local Profiles = require(script.Parent.Profiles)
local Outdoor = require(script.Parent.Outdoor)
local Business = require(script.Parent.Business)
local ShopCatalogue = require(Shared.ShopCatalogue)
local Venue = {}
local function now()
	return workspace:GetServerTimeNow()
end
function Venue.new(options)
	local sessions = {}
	local returnSpots = {}
	local placedCharacters = {}
	local travelAt = {}
	local interactionAt = {}
	local anchors = {}
	local set = workspace:WaitForChild("ShowSet")
	anchors.ParkArrival = set:FindFirstChild("ParkArrival", true)
	local function session(p)
		if not sessions[p] then
			sessions[p] = Activities.new()
		end
		return sessions[p]
	end
	local function near(p, name, range)
		local root = p.Character and p.Character:FindFirstChild("HumanoidRootPart")
		local anchor = anchors[name]
		return root and anchor and (root.Position - anchor.Position).Magnitude <= range
	end
	local function walkTo(p, destination)
		local char = p.Character
		local hum = char and char:FindFirstChildOfClass("Humanoid")
		if not hum or hum.Health <= 0 then
			return false
		end
		local seat = hum.SeatPart
		if seat then
			local weld = seat:FindFirstChild("SeatWeld")
			if weld and weld:IsA("Weld") and weld.Part1 and weld.Part1:IsDescendantOf(char) then
				weld:Destroy()
			end
		end
		hum.Sit = false
		char:PivotTo(destination)
		local root = char:FindFirstChild("HumanoidRootPart")
		if root then
			root.AssemblyLinearVelocity = Vector3.zero
		end
		return true
	end
	local function finish(v, row, time)
		local result = Activities.finishPractice(v, Foley, time)
		if not result then
			return false
		end
		row.practiceBest = math.max(row.practiceBest, result.score)
		if result.xp > 0 then
			row.practiceCount += 1
		end
		if result.correct >= 2 then
			row.badges["sound-technician"] = true
		end
		row.stage += result.xp
		Profiles.week(row, math.floor((os.time() / 86400 + 3) / 7), result.xp)
		return true
	end
	local function awardOutdoor(v, row)
		if Outdoor.reward(v.outdoor, row) then
			Profiles.week(row, math.floor((os.time() / 86400 + 3) / 7), v.outdoor.xp)
		end
	end
	local function outdoorStep(p, v, row, station, time)
		local r = v.outdoor
		if
			not r
			or r.target ~= station
			or not Outdoor.step(v, r.kind, r.run, station, time, near(p, station, 7))
		then
			return false
		end
		if r.kind == "park" and r.status == "done" then
			Activities.open(v, "park", false)
			awardOutdoor(v, row)
		end
		return true
	end
	local function creditShop(v, row)
		local r = v.business
		if r.status == "done" then
			Profiles.week(row, math.floor((os.time() / 86400 + 3) / 7), r.xp)
		end
	end
	local function update(p)
		local v = session(p)
		v.revision += 1
		options.changed(p)
	end
	local function openRoom(p, v, id, teleport, walk)
		local def = Venues.rooms[id]
		local anchor = def and anchors[def.anchor]
		if not anchor then
			v.notice = "That room is unavailable."
			return false
		end
		if teleport or (id == "theatre" and not walk) then
			if not walkTo(p, anchor.CFrame) then
				v.notice = "Wait for your character to arrive."
				return false
			end
			Outdoor.cancelPark(v)
			if id == "theatre" and not walk then
				options.seat(p)
			end
		end
		v.notice = def.title
		Activities.open(v, id, not walk and (id == "theatre" or id == "balcony"))
		options.attendance(p)
		return true
	end
	local handle
	handle = function(p, input, physical)
		if type(input) ~= "table" or type(input.op) ~= "string" or p.Parent ~= Players then
			return
		end
		local row = options.profile(p)
		if not row then
			return
		end
		local v = session(p)
		local op = input.op
		local time = now()
		if time < (interactionAt[p] or 0) then
			return
		end
		interactionAt[p] = time + 0.12
		if not options.canExplore(p) then
			v.notice = "Finish or leave your stage turn first."
			update(p)
			return
		end
		if op == "travel" or (op == "open" and physical) then
			local id = input.room
			if type(id) ~= "string" or not Venues.rooms[id] or time < (travelAt[p] or 0) then
				return
			end
			local def = Venues.rooms[id]
			if physical and not near(p, def.anchor, 10) then
				return
			end
			travelAt[p] = time + 0.6
			openRoom(p, v, id, not physical or id == "balcony", input.walk == true)
			if ShopCatalogue.shops[id] and not physical and input.walk == true then
				v.open = "explore"
			end
			if physical and id == "lobby" then
				v.open = "map"
			end
		elseif op == "shopStart" then
			local kind = input.kind
			local shop = ShopCatalogue.shops[kind]
			if not shop or not Business.start(v, ShopCatalogue, kind, row, time, near(p, shop.anchor, 9)) then
				return
			end
			if kind == "post" then
				v.open = "explore"
				v.openRevision += 1
			end
		elseif op == "shopPick" or op == "shopReplay" then
			local r = v.business
			if not r or r.status ~= "active" then
				return
			end
			local close = near(p, ShopCatalogue.shops[r.kind].anchor, 9)
			if op == "shopReplay" then
				if not Business.replay(v, input.run, time, close) then
					return
				end
			elseif not Business.pick(v, ShopCatalogue, row, input.run, input.choice, time, close) then
				return
			end
			creditShop(v, row)
		elseif op == "practice" or op == "practicePad" then
			if not near(p, Venues.rooms.studio.anchor, 14) then
				v.notice = "Start a sound drill at Studio B's console."
				update(p)
				return
			end
			if physical then
				openRoom(p, v, "studio", false)
			end
			if v.room ~= "studio" then
				return
			end
			if op == "practice" then
				Activities.startPractice(v, Foley, time)
			elseif not Activities.pad(v, Foley, input, time) then
				return
			else
				finish(v, row, time)
			end
		elseif op == "write" or op == "queueCard" then
			if not near(p, Venues.rooms.writers.anchor, 12) or v.room ~= "writers" then
				v.notice = "Use the Writers’ Room desk."
				update(p)
				return
			end
			if op == "write" then
				local mix = input.mix
				if type(mix) ~= "number" or mix % 1 ~= 0 or mix < 1 or mix > 9 then
					return
				end
				row.writtenMix = mix
				row.badges["cue-writer"] = true
				v.notice = "Playbill stamped. Queue this card when you want to perform."
			elseif row.writtenMix >= 1 and row.writtenMix <= 9 then
				if options.queueCard(p, row.writtenMix) then
					v.notice = "Card queued. Accept your invitation when it appears."
				else
					v.notice = "Your stage invitation is already pending."
				end
			else
				v.notice = "Stamp a cue card before joining the show."
			end
		elseif op == "job" or op == "deliver" or op == "collect" then
			if op == "collect" then
				local name = type(input.prop) == "string" and Venues.props[input.prop]
				if not name then
					return
				end
				if v.room ~= "warehouse" or not v.job then
					v.notice = "Take a dispatch ticket first."
					update(p)
					return
				end
				Activities.collect(v, input.run, input.prop, near(p, name, 7), time)
			else
				if not near(p, Venues.rooms.warehouse.anchor, 8) then
					v.notice = "Return to the warehouse dispatch desk."
					update(p)
					return
				end
				if physical then
					openRoom(p, v, "warehouse", false)
				end
				if v.room ~= "warehouse" then
					return
				end
				if op == "job" then
					if not Activities.startJob(v, time) then
						v.notice = if v.job.picked == #v.job.order
							then "Return your props at dispatch."
							else "Find the " .. v.job.order[v.job.picked + 1] .. "."
					end
				elseif Activities.deliver(v, input.run, true, time) then
					row.propJobs += 1
					row.badges["prop-runner"] = true
					row.crowd += v.job.xp
					Profiles.week(row, math.floor((os.time() / 86400 + 3) / 7), v.job.xp)
				else
					v.notice = "Pack every prop in order before returning the ticket."
				end
			end
		elseif op == "outdoorStart" then
			local kind = input.kind
			if not Outdoor.destinations[kind] or not near(p, Venues.rooms[kind].anchor, 10) then
				return
			end
			if physical then
				openRoom(p, v, kind, false, true)
			end
			if v.room ~= kind then
				return
			end
			if Outdoor.tick(v, time) then
				awardOutdoor(v, row)
			end
			if not Outdoor.start(v, kind, time) and v.outdoor then
				v.notice = v.outdoor.notice
			end
		elseif op == "outdoorStation" and physical then
			local r = v.outdoor
			if not r or input.run ~= r.run or not outdoorStep(p, v, row, input.station, time) then
				return
			end
		elseif op == "outdoorTap" then
			if not Outdoor.tap(v, input.run, time, near(p, "VenuePier", 10)) then
				return
			end
			awardOutdoor(v, row)
		elseif op == "outdoorWrap" then
			if not Outdoor.wrap(v, input.run, input.stamp, time, near(p, "VenueMarket", 9)) then
				return
			end
			awardOutdoor(v, row)
		elseif op == "fit" then
			if not near(p, Venues.rooms.atelier.anchor, 12) or v.room ~= "atelier" then
				v.notice = "Choose a fitting at the atelier."
				update(p)
				return
			end
			local look = type(input.look) == "string" and Venues.looks[input.look]
			if not look then
				return
			end
			if look.badge and not row.badges[look.badge] then
				v.notice = if input.look == "cobalt"
					then "Land two cues in Studio B to unlock this mic."
					else "Deliver a prop order to unlock this stand."
			else
				row.atelierLook = look.index
				v.notice = look.name .. " fitted for your next show."
			end
		else
			return
		end
		update(p)
	end
	local function addPrompt(anchorName, title, action, id, op, onPrompt)
		local anchor = set:FindFirstChild(anchorName, true)
		if not anchor or not anchor:IsA("BasePart") then
			warn("Delivery venue missing anchor", anchorName)
			return
		end
		anchors[anchorName] = anchor
		local prompt = Instance.new("ProximityPrompt")
		prompt.Name = "DeliveryInteraction"
		prompt.ObjectText = title
		prompt.ActionText = action
		prompt.RequiresLineOfSight = false
		prompt.MaxActivationDistance = 7
		prompt.HoldDuration = 0.12
		prompt:SetAttribute("DeliveryActivity", id)
		prompt:SetAttribute("DeliveryOperation", op)
		prompt.Parent = anchor
		prompt.Triggered:Connect(onPrompt)
	end
	for _, id in Venues.order do
		local def = Venues.rooms[id]
		local op = if Outdoor.destinations[id]
			then "outdoorStart"
			elseif id == "studio" then "practice"
			elseif id == "warehouse" then "job"
			else "open"
		addPrompt(def.anchor, def.title, def.action, id, op, function(p)
			local v = session(p)
			local r = v.outdoor
			if Outdoor.destinations[id] then
				if r and r.kind == id and r.status == "active" and now() < r.deadline then
					if id == "pier" then
						handle(p, { op = "outdoorTap", run = r.run }, true)
					elseif id == "park" and r.target == "VenuePark" then
						handle(p, { op = "outdoorStation", station = r.target, run = r.run }, true)
					else
						handle(p, { op = "open", room = id, walk = true }, true)
					end
				else
					handle(p, { op = "outdoorStart", kind = id }, true)
				end
			elseif
				id == "warehouse"
				and v.job
				and v.job.status == "active"
				and v.job.picked == #v.job.order
			then
				handle(p, { op = "deliver", run = v.job.run }, true)
			else
				handle(p, { op = op, room = id }, true)
			end
		end)
	end
	for name, def in Outdoor.stations do
		addPrompt(name, def.title, def.action, def.room, "outdoorStation", function(p)
			local r = session(p).outdoor
			if r and r.kind == def.room then
				handle(p, { op = "outdoorStation", run = r.run, station = name }, true)
			end
		end)
	end
	for prop, name in Venues.props do
		addPrompt(name, prop, "Pack prop", "warehouse", "collect", function(p)
			local v = session(p)
			handle(p, { op = "collect", prop = prop, run = v.job and v.job.run }, true)
		end)
	end
	local function snapshot(p)
		local v = session(p)
		local row = options.profile(p)
		if row then
			if row.writtenMix >= 1 and row.writtenMix <= 9 then
				if not v.card or v.card.mix ~= row.writtenMix then
					v.card = { mix = row.writtenMix, text = Modes.mix(row.writtenMix).text }
				end
			end
			v.look = Venues.lookAt(row.atelierLook)
			if v.printCode ~= row.postcard then
				v.printCode = row.postcard
				v.lastPrint = ShopCatalogue.print(row.postcard)
			end
		end
		return v
	end
	local nextObservation = 0
	local nextGateCheck = 0
	local function tick(time)
		local checkGates = time >= nextGateCheck
		if checkGates then
			nextGateCheck = time + 0.15
		end
		local observe = time >= nextObservation
		if observe then
			nextObservation = time + 0.8
		end
		for p, v in sessions do
			local row = options.profile(p)
			local practice = v.practice
			if
				observe
				and row
				and p.Character == placedCharacters[p]
				and not v.watching
				and options.canExplore(p)
			then
				local root = p.Character and p.Character:FindFirstChild("HumanoidRootPart")
				if root then
					local pos = root.Position
					local zone = Venues.zone(pos.X, pos.Z, pos.Y)
					if zone ~= v.room then
						v.room = zone
						update(p)
					end
				end
			end
			local shop = v.business
			if
				row
				and checkGates
				and shop
				and shop.kind == "post"
				and shop.status == "active"
				and options.canExplore(p)
				and Business.delivery(v, ShopCatalogue, row, time, shop.target, near(p, shop.target, 7))
			then
				creditShop(v, row)
				update(p)
			end
			local r = v.outdoor
			if row and r and r.status == "active" then
				if Outdoor.tick(v, time) then
					awardOutdoor(v, row)
					update(p)
				elseif
					checkGates
					and r.kind == "park"
					and options.canExplore(p)
					and outdoorStep(p, v, row, r.target, time)
				then
					update(p)
				end
			end
			if row and practice and practice.status == "playing" then
				if not near(p, Venues.rooms.studio.anchor, 16) or not options.canExplore(p) then
					practice.status = "cancelled"
					v.notice = "Practice paused. Start another drill at the console."
					update(p)
				elseif finish(v, row, time) then
					update(p)
				end
			end
		end
	end
	local function beginStage(p)
		Outdoor.cancelPark(session(p))
		local char = p.Character
		if char then
			returnSpots[p] = char:GetPivot()
		end
	end
	local function endStage(p)
		placedCharacters[p] = p.Character
		local origin = returnSpots[p]
		returnSpots[p] = nil
		if session(p).watching and session(p).room == "theatre" then
			options.seat(p)
		elseif origin then
			walkTo(p, origin)
		end
	end
	local function respawn(p)
		local v = session(p)
		Outdoor.cancelPark(v)
		local anchor = anchors[Venues.arrival(v.room, v.openRevision)]
		placedCharacters[p] = p.Character
		if v.watching and v.room == "theatre" then
			options.seat(p)
		elseif anchor then
			walkTo(p, anchor.CFrame)
		end
	end
	local function leave(p)
		sessions[p] = nil
		returnSpots[p] = nil
		placedCharacters[p] = nil
		travelAt[p] = nil
		interactionAt[p] = nil
	end
	return {
		handle = handle,
		snapshot = snapshot,
		tick = tick,
		beginStage = beginStage,
		endStage = endStage,
		respawn = respawn,
		leave = leave,
	}
end
return Venue
