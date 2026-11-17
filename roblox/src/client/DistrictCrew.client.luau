--!strict
-- The town's robot residents and background townsfolk. Everything here is client-side set dressing:
-- the robots never collide, never block a prompt other than their own, and never affect play.
--
-- Update loop: one Heartbeat. Every walker's "brain" (route, waits, greetings, show reactions) runs each
-- frame with plain numbers and Vector3s; its pose is written with one BulkMoveTo per robot, every frame
-- within 60 studs of the camera, every third frame out to 150 studs, and not at all beyond that.
-- Paths and lines are built only when an event happens (arrival, lineup, reveal), never per frame.
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local client = script.Parent
local StreetRobot = require(client:WaitForChild("StreetRobot"))
local StreetBubble = require(client:WaitForChild("StreetBubble"))
local StreetShow = require(client:WaitForChild("StreetShow"))
local StreetTalk = require(client:WaitForChild("StreetTalk"))
local StreetCast = require(client:WaitForChild("StreetCast"))

if not game:IsLoaded() then
	game.Loaded:Wait()
end
local player = Players.LocalPlayer
local set = workspace:WaitForChild("ShowSet")

local POSE_NEAR = 60
local POSE_FAR = 150
local GREET_IN = 10
local GREET_OUT = 16
local LOOK_RANGE = 14
local ATTEND_IN = 7.5
local ATTEND_OUT = 9.5

local population = Instance.new("Folder")
population.Name = "DistrictCrew"
population.Parent = workspace

local rays = RaycastParams.new()
rays.FilterType = Enum.RaycastFilterType.Include
rays.FilterDescendantsInstances = { set, workspace.Terrain }
local function grounded(p: Vector3): Vector3
	local hit = workspace:Raycast(Vector3.new(p.X, 4, p.Z), Vector3.new(0, -12, 0), rays)
	local y = if hit and hit.Position.Y < 1.2 and hit.Position.Y > -1.5 then hit.Position.Y else 0.06
	return Vector3.new(p.X, y, p.Z)
end

type Stop = {
	at: Vector3,
	wait: number,
	act: string,
	look: Vector3?,
	seat: Vector3?,
	plaza: boolean,
}

type Walker = {
	member: StreetCast.Member,
	robot: StreetRobot.Robot,
	bubble: StreetBubble.Bubble,
	hero: boolean,
	stops: { Stop },
	plazaIndex: number,
	approach: { Vector3 },
	queueSpot: Vector3?,
	index: number,
	pos: Vector3,
	from: Vector3,
	segment: number,
	yaw: number,
	arrived: boolean,
	waitUntil: number,
	seat: Vector3?,
	sitting: boolean,
	jog: boolean,
	mode: string, -- "route", "path" (to or from the queue), "queue"
	path: { Vector3 },
	pathRoute: { number },
	pathStep: number,
	pathDone: string, -- mode to enter when the path ends
	holdUntil: number,
	cheerAt: number,
	cheerStage: number,
	attending: boolean,
	talkUntil: number,
	near: boolean,
	greetAt: number,
	parcelAt: number,
	barkAt: number,
	look: number,
	peer: Walker?,
	peerUntil: number,
	peerAt: number,
	tipCursor: number,
	poseDt: number,
	distance: number,
}

local walkers: { Walker } = {}
local partCount = 0

local function turn(a: number, b: number, k: number): number
	local d = (b - a + math.pi) % (2 * math.pi) - math.pi
	return a + d * k
end

-- Tram awareness: a robot about to cross the track waits while the Lot Line is close.
local tramRoot: BasePart? = nil
local tramCheckAt = 0
local function tramX(now: number): number?
	local root = tramRoot
	if root and root.Parent then
		return root.Position.X
	end
	if now < tramCheckAt then
		return nil
	end
	tramCheckAt = now + 3
	local network = workspace:FindFirstChild("DistrictRailway")
	local tram = network and network:FindFirstChild("LotLine")
	local found = tram and tram:IsA("Model") and tram.PrimaryPart
	tramRoot = if found then found else nil
	return if found then found.Position.X else nil
end
local function tramBlocks(a: Vector3, b: Vector3, now: number): boolean
	if math.min(a.Z, b.Z) > 78.4 or math.max(a.Z, b.Z) < 70.8 then
		return false
	end
	local x = tramX(now)
	if not x then
		return false
	end
	local t = if math.abs(b.Z - a.Z) > 0.01 then math.clamp((74.5 - a.Z) / (b.Z - a.Z), 0, 1) else 0.5
	return math.abs(a.X + (b.X - a.X) * t - x) < 15
end

local function bubbleHeight(spec: StreetRobot.Spec): number
	local s = spec.scale or 1
	local extra = if spec.hat == "baker" then 1.7 elseif spec.hat == "tophat" then 1.3 else 0.75
	return (0.66 + extra) * s
end

local function say(w: Walker, kind: string, ambient: boolean, hold: number?): boolean
	local line = StreetTalk.pick(
		if w.hero then w.member.name else nil,
		kind,
		nil,
		StreetShow.direction(),
		player:GetAttribute("CarryingParcel") :: string?
	)
	if not line then
		return false
	end
	return StreetBubble.say(w.bubble, line, hold, ambient)
end

local function beginSegment(w: Walker, target: Vector3)
	w.from = w.pos
	w.segment =
		math.max(0.01, (Vector3.new(target.X, 0, target.Z) - Vector3.new(w.pos.X, 0, w.pos.Z)).Magnitude)
end

local function arrive(w: Walker, stop: Stop, now: number)
	local r = w.robot
	w.arrived = true
	w.waitUntil = now + stop.wait * (0.8 + math.random() * 0.5)
	w.jog = stop.act == "jog"
	if stop.seat then
		w.seat = stop.seat
		w.sitting = true
		r.sitTarget = 1
		r.base = "sit"
	else
		r.base = if stop.act == "jog" or stop.act == "" then "idle" else stop.act
	end
	if r.gestureUntil == math.huge then
		r.gesture = r.base
		r.gestureAt = now
	end
end

local function build(member: StreetCast.Member, hero: boolean)
	local robot = StreetRobot.build(member.spec, population)
	partCount += #robot.parts
	local stops: { Stop } = {}
	local plazaIndex = 0
	for i, stop in member.route do
		table.insert(stops, {
			at = grounded(stop.at),
			wait = stop.wait or 0,
			act = stop.act or "",
			look = stop.look,
			seat = stop.seat,
			plaza = stop.plaza == true,
		})
		if stop.plaza then
			plazaIndex = i
		end
	end
	local approach: { Vector3 } = {}
	for _, p in member.approach or {} do
		table.insert(approach, grounded(p))
	end
	local start = math.random(1, #stops)
	local w: Walker = {
		member = member,
		robot = robot,
		bubble = StreetBubble.new(robot.head, member.name, member.voice, bubbleHeight(member.spec)),
		hero = hero,
		stops = stops,
		plazaIndex = plazaIndex,
		approach = approach,
		queueSpot = nil,
		index = start,
		pos = stops[start].at,
		from = stops[start].at,
		segment = 0.01,
		yaw = 0,
		arrived = false,
		waitUntil = 0,
		seat = nil,
		sitting = false,
		jog = false,
		mode = "route",
		path = {},
		pathRoute = {},
		pathStep = 0,
		pathDone = "route",
		holdUntil = 0,
		cheerAt = math.huge,
		cheerStage = 0,
		attending = false,
		talkUntil = 0,
		near = false,
		greetAt = 0,
		parcelAt = 0,
		barkAt = 0,
		look = 0,
		peer = nil,
		peerUntil = 0,
		peerAt = 0,
		tipCursor = 1,
		poseDt = 0,
		distance = 0,
	}
	local stop = stops[start]
	local now = os.clock()
	w.yaw = if stop.look then StreetRobot.yawTo(w.pos, stop.look) else math.random() * math.pi * 2
	arrive(w, stop, now)
	w.waitUntil = now + math.random() * math.max(stop.wait, 2)
	if w.sitting then
		robot.sit = 1
	end
	robot.root = CFrame.new(if w.seat and robot.sit > 0.5 then w.seat else w.pos) * CFrame.Angles(0, w.yaw, 0)
	StreetRobot.animate(robot, 0.1, now, true)

	if hero and member.prompt then
		local talk = Instance.new("ProximityPrompt")
		talk.Name = "AskTip"
		talk.ObjectText = if member.role then member.name .. " · " .. member.role else member.name
		talk.ActionText = "Ask for a tip"
		talk.MaxActivationDistance = 8
		talk.HoldDuration = 0
		talk.RequiresLineOfSight = false
		talk.Exclusivity = Enum.ProximityPromptExclusivity.OnePerButton
		talk.Parent = robot.head
		talk.Triggered:Connect(function()
			local now2 = os.clock()
			local line = StreetTalk.pick(member.name, "tips", w.tipCursor)
			w.tipCursor += 1
			if not line then
				return
			end
			local hold = math.clamp(3 + #line * 0.05, 6, 10)
			w.talkUntil = now2 + hold + #line / 48
			StreetRobot.play(robot, "talk", math.min(4, hold), now2)
			StreetBubble.say(w.bubble, line, hold, false)
		end)
	end
	table.insert(walkers, w)
end

for _, member in StreetCast.residents do
	build(member, true)
end
for _, member in StreetCast.walkers do
	build(member, false)
end
if partCount > 250 then
	warn(string.format("DistrictCrew uses %d parts (budget 250)", partCount))
end
population:SetAttribute("PartCount", partCount)

local queue: { Vector3 } = {}
for _, p in StreetCast.queue do
	table.insert(queue, grounded(p))
end

-- Lineup: fans leave their routes (along the route itself, so every segment is a checked one), cross the
-- plaza and wait at the theatre doors; when the show starts they walk back the same way.
local function setPath(w: Walker, points: { Vector3 }, routeIndex: { number }, done: string)
	w.path = points
	w.pathRoute = routeIndex
	w.pathStep = 1
	w.pathDone = done
	w.mode = "path"
	w.arrived = false
	w.jog = false
	w.robot.base = "idle"
	if w.robot.gestureUntil == math.huge then
		w.robot.gesture = "idle"
	end
	if w.sitting then
		-- Stand up first; the stand-up check in stepWalker holds the robot until it is upright.
		w.sitting = false
		w.robot.sitTarget = 0
	end
	if points[1] then
		beginSegment(w, points[1])
	end
end

local function routeLength(w: Walker, first: number, step: number, last: number): number
	local total = (w.stops[first].at - w.pos).Magnitude
	local i = first
	local guard = 0
	while i ~= last and guard < 64 do
		local j = (i + step - 1) % #w.stops + 1
		total += (w.stops[j].at - w.stops[i].at).Magnitude
		i = j
		guard += 1
	end
	return total
end

local function headToQueue(w: Walker, spot: Vector3)
	if w.plazaIndex == 0 or w.mode ~= "route" then
		return
	end
	w.queueSpot = spot
	local n = #w.stops
	local ahead = w.index
	local behind = if w.arrived then w.index else (w.index - 2) % n + 1
	local forward = routeLength(w, ahead, 1, w.plazaIndex)
	local backward = routeLength(w, behind, -1, w.plazaIndex)
	local step = if forward <= backward then 1 else -1
	local i = if step == 1 then ahead else behind
	local points: { Vector3 } = {}
	local route: { number } = {}
	local guard = 0
	while guard < 64 do
		table.insert(points, w.stops[i].at)
		table.insert(route, i)
		if i == w.plazaIndex then
			break
		end
		i = (i + step - 1) % n + 1
		guard += 1
	end
	for _, p in w.approach do
		table.insert(points, p)
		table.insert(route, 0)
	end
	table.insert(points, spot)
	table.insert(route, 0)
	setPath(w, points, route, "queue")
end

local function leaveQueue(w: Walker)
	if w.mode == "queue" or (w.mode == "path" and w.pathDone == "queue") then
		-- Still on the route part of the trip: simply carry on along the route from there.
		local target = w.pathRoute[w.pathStep]
		if w.mode == "path" and target and target > 0 then
			w.mode = "route"
			w.index = target
			w.arrived = false
			beginSegment(w, w.stops[target].at)
			return
		end
		local points: { Vector3 } = {}
		local route: { number } = {}
		for i = #w.approach, 1, -1 do
			table.insert(points, w.approach[i])
			table.insert(route, 0)
		end
		table.insert(points, w.stops[w.plazaIndex].at)
		table.insert(route, w.plazaIndex)
		setPath(w, points, route, "route")
	end
end

StreetShow.onPhase(function(phase: string)
	if phase == "lineup" then
		local slot = 0
		for _, w in walkers do
			if w.member.fan and w.plazaIndex > 0 then
				slot += 1
				if queue[slot] then
					headToQueue(w, queue[slot])
				end
			end
		end
	else
		for _, w in walkers do
			leaveQueue(w)
		end
	end
end)

-- Encore: everybody stops to cheer and clap, then strolls on with a spring in their step; the nearest
-- few quote the winning direction.
local encoreBarkAt = 0
StreetShow.onReveal(function(_band: number, encore: boolean)
	if not encore then
		return
	end
	local now = os.clock()
	local camera = workspace.CurrentCamera
	local eye = if camera then camera.CFrame.Position else Vector3.zero
	for _, w in walkers do
		local delay = math.random() * 1.2
		w.cheerAt = now + delay
		w.cheerStage = 0
		w.holdUntil = now + delay + 7
	end
	table.sort(walkers, function(a, b)
		return (a.pos - eye).Magnitude < (b.pos - eye).Magnitude
	end)
	for i = 1, 3 do
		local w = walkers[i]
		if w and (w.pos - eye).Magnitude < 60 then
			task.delay(0.6 + (i - 1) * 1.7, function()
				say(w, "encore", false, 5)
			end)
		end
	end
	encoreBarkAt = now + 14
end)

local function characterRoot(): BasePart?
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	return if root and root:IsA("BasePart") then root else nil
end

local function stepWalker(w: Walker, dt: number, now: number, playerPos: Vector3?, carrying: boolean)
	local r = w.robot
	local stopped = false
	local wantYaw = w.yaw
	local lookTarget: Vector3? = nil

	-- Show reactions.
	if now >= w.cheerAt then
		if w.cheerStage == 0 then
			w.cheerStage = 1
			StreetRobot.play(r, "cheer", 3.4, now)
		elseif w.cheerStage == 1 and now >= w.cheerAt + 3.4 then
			w.cheerStage = 2
			StreetRobot.play(r, "clap", 3, now)
			w.cheerAt = math.huge
		end
	end
	local happy = if StreetShow.encore() then 1 else 0
	r.happy += (happy - r.happy) * math.min(1, dt * 2)
	if now < w.holdUntil then
		stopped = true
	end

	-- The visitor.
	local d = math.huge
	if playerPos then
		d = (Vector3.new(playerPos.X, 0, playerPos.Z) - Vector3.new(w.pos.X, 0, w.pos.Z)).Magnitude
	end
	if d < GREET_IN and not w.near then
		w.near = true
		if now > w.greetAt and not w.bubble.live then
			w.greetAt = now + 25
			if w.hero or math.random() < 0.55 then
				StreetRobot.play(r, w.member.greet, 2.2, now)
			end
			if carrying and now > w.parcelAt then
				w.parcelAt = now + 45
				say(w, "parcel", true)
			elseif w.hero and math.random() < 0.6 then
				say(w, if StreetShow.lineup() and math.random() < 0.5 then "lineup" else "idle", true)
			end
		end
	elseif d > GREET_OUT then
		w.near = false
	end
	if w.hero then
		if d < ATTEND_IN then
			w.attending = true
		elseif d > ATTEND_OUT and now > w.talkUntil then
			w.attending = false
		end
		if w.attending then
			stopped = true
			if playerPos and not w.sitting then
				wantYaw = StreetRobot.yawTo(w.pos, playerPos)
			end
			if d < 12 and now > w.barkAt and not w.bubble.live and now > w.talkUntil + 4 then
				w.barkAt = now + 20 + math.random() * 12
				if math.random() < 0.5 then
					say(w, "idle", true)
				end
			end
		end
	end
	if playerPos and d < LOOK_RANGE then
		lookTarget = playerPos + Vector3.new(0, 1.5, 0)
	elseif w.peer and now < w.peerUntil then
		lookTarget = w.peer.pos + Vector3.new(0, 3, 0)
	end

	-- Moving.
	if r.sit > 0.05 and not w.sitting then
		stopped = true -- still standing up
	end
	r.walking = 0
	if w.mode == "route" then
		local stop = w.stops[w.index]
		if w.arrived then
			if stop.look then
				wantYaw = StreetRobot.yawTo(w.pos, stop.look)
			end
			if w.jog and not stopped then
				r.walking = 0.75
				r.stride += dt * 2.6
			end
			if now >= w.waitUntil and not stopped then
				if w.sitting then
					w.sitting = false
					r.sitTarget = 0
				else
					w.arrived = false
					w.jog = false
					r.base = "idle"
					if r.gestureUntil == math.huge then
						r.gesture = "idle"
					end
					w.index = w.index % #w.stops + 1
					beginSegment(w, w.stops[w.index].at)
				end
			end
		elseif not stopped then
			local target = stop.at
			local fresh = (w.pos - w.from).Magnitude < 0.3
			if fresh and tramBlocks(w.pos, target, now) then
				lookTarget = lookTarget or (if tramRoot then tramRoot.Position else nil)
			else
				local flat = Vector3.new(target.X - w.pos.X, 0, target.Z - w.pos.Z)
				local remaining = flat.Magnitude
				local step = math.min(remaining, w.member.speed * dt)
				if remaining < 0.05 then
					w.pos = target
					arrive(w, stop, now)
				else
					local moved = w.pos + flat.Unit * step
					local frac = 1 - (remaining - step) / w.segment
					w.pos = Vector3.new(
						moved.X,
						w.from.Y + (target.Y - w.from.Y) * math.clamp(frac, 0, 1),
						moved.Z
					)
					r.walking = 1
					r.stride += step
					wantYaw = StreetRobot.yawTo(w.pos, target)
				end
			end
		end
	elseif w.mode == "path" then
		local target = w.path[w.pathStep]
		if not target then
			if w.pathDone == "queue" then
				w.mode = "queue"
			else
				w.mode = "route"
				w.index = w.plazaIndex
				w.arrived = false
				beginSegment(w, w.stops[w.index].at)
			end
		elseif not stopped then
			local fresh = (w.pos - w.from).Magnitude < 0.3
			if fresh and tramBlocks(w.pos, target, now) then
				lookTarget = lookTarget or (if tramRoot then tramRoot.Position else nil)
			else
				local flat = Vector3.new(target.X - w.pos.X, 0, target.Z - w.pos.Z)
				local remaining = flat.Magnitude
				-- Hurrying to the doors.
				local step = math.min(remaining, w.member.speed * 1.3 * dt)
				if remaining < 0.05 then
					w.pos = target
					w.pathStep += 1
					local nextPoint = w.path[w.pathStep]
					if nextPoint then
						beginSegment(w, nextPoint)
					end
				else
					local moved = w.pos + flat.Unit * step
					local frac = 1 - (remaining - step) / w.segment
					w.pos = Vector3.new(
						moved.X,
						w.from.Y + (target.Y - w.from.Y) * math.clamp(frac, 0, 1),
						moved.Z
					)
					r.walking = 1
					r.stride += step * 1.1
					wantYaw = StreetRobot.yawTo(w.pos, target)
				end
			end
		end
	elseif w.mode == "queue" then
		wantYaw = StreetRobot.yawTo(w.pos, StreetCast.door)
	end

	-- Facing, head look and the root frame.
	local k = 1 - math.exp(-dt * 7)
	w.yaw = turn(w.yaw, wantYaw, k)
	local root = CFrame.new(w.pos) * CFrame.Angles(0, w.yaw, 0)
	local seat = w.seat
	if seat then
		if r.sit < 0.01 and not w.sitting then
			w.seat = nil
		else
			root = CFrame.new(w.pos:Lerp(seat, r.sit)) * CFrame.Angles(0, w.yaw, 0)
		end
	end
	r.root = root
	local wantLook = 0
	if lookTarget then
		local rel = root:PointToObjectSpace(lookTarget) - Vector3.new(0, 3 * r.scale, 0)
		local yaw = math.atan2(-rel.X, -rel.Z)
		if math.abs(yaw) < 2.1 then
			wantLook = 1
			r.lookYaw = yaw
			r.lookPitch = math.atan2(rel.Y, math.sqrt(rel.X * rel.X + rel.Z * rel.Z))
		end
	end
	w.look += (wantLook - w.look) * math.min(1, dt * 5)
	r.lookWeight = w.look
end

-- Two robots passing on a pavement glance at each other; one may wave.
local function socialise(now: number)
	for i = 1, #walkers do
		local a = walkers[i]
		if a.distance < POSE_NEAR and now > a.peerAt and a.robot.walking > 0 then
			for j = i + 1, #walkers do
				local b = walkers[j]
				if now > b.peerAt and (a.pos - b.pos).Magnitude < 6 then
					a.peer, b.peer = b, a
					a.peerUntil, b.peerUntil = now + 1.8, now + 1.8
					a.peerAt, b.peerAt = now + 20, now + 20
					if math.random() < 0.5 then
						StreetRobot.play(a.robot, "wave", 1.6, now)
					end
					break
				end
			end
		end
	end
end

local frame = 0
local slowClock = 0
local lineupBarkAt = 0
RunService.Heartbeat:Connect(function(dt: number)
	local camera = workspace.CurrentCamera
	if not camera then
		return
	end
	dt = math.min(dt, 0.1)
	frame += 1
	local now = os.clock()
	local eye = camera.CFrame.Position
	local root = characterRoot()
	local playerPos = if root then root.Position else nil
	local parcel = player:GetAttribute("CarryingParcel")
	local carrying = type(parcel) == "string" and parcel ~= ""
	for i, w in walkers do
		stepWalker(w, dt, now, playerPos, carrying)
		local distance = (w.pos - eye).Magnitude
		w.distance = distance
		w.poseDt += dt
		if distance < POSE_FAR and (distance < POSE_NEAR or (frame + i) % 3 == 0) then
			StreetRobot.animate(w.robot, w.poseDt, now, true)
			w.poseDt = 0
		end
	end
	slowClock += dt
	if slowClock < 0.5 then
		return
	end
	slowClock = 0
	socialise(now)
	-- The queue chats while it waits; the town keeps celebrating through an encore.
	if StreetShow.lineup() and now > lineupBarkAt then
		lineupBarkAt = now + 7 + math.random() * 6
		local start = math.random(1, #walkers)
		for n = 0, #walkers - 1 do
			local w = walkers[(start + n - 1) % #walkers + 1]
			if w.mode == "queue" and w.distance < 40 and not w.bubble.live then
				StreetRobot.play(w.robot, "talk", 3, now)
				say(w, "lineup", true)
				break
			end
		end
	end
	if StreetShow.encore() and now > encoreBarkAt then
		encoreBarkAt = now + 10 + math.random() * 6
		local start = math.random(1, #walkers)
		for n = 0, #walkers - 1 do
			local w = walkers[(start + n - 1) % #walkers + 1]
			if w.distance < 45 and not w.bubble.live then
				StreetRobot.play(w.robot, "cheer", 2.6, now)
				say(w, "encore", true)
				break
			end
		end
	end
end)
