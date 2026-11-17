--!strict
-- Client-side puppetry for Flip, the part-built radio robot who hosts the show.
-- Every frame is rebuilt from cached rest CFrames, so nothing accumulates or drifts.
local StageHost = {}

local headNames = {
	Cabinet = true,
	CaseBumper = true,
	CabinetRivet = true,
	RadioFace = true,
	BlackGlassVisor = true,
	SpeakerLouvre = true,
	TuningRidge = true,
	EyeRim = true,
	EyeGlass = true,
	AnimatedPupil = true,
	EyeGlint = true,
	AnimatedBrow = true,
	HandlePost = true,
	SideKnob = true,
	CarryHandle = true,
	LeatherGrip = true,
	Aerial = true,
	OnAirBeacon = true,
	HostMouth = true,
	BowTie = true,
}
local armNames = {
	ShoulderGear = true,
	Sleeve = true,
	Hinge = true,
	Cuff = true,
	Glove = true,
	Finger = true,
	HostCardFoil = true,
	HostCardPaper = true,
	HostCardLine = true,
}
local BODY, HEAD, ARM_L, ARM_R = 1, 2, 3, 4

-- Gesture lengths in seconds. The envelope eases in and out of every pose.
local lengths = {
	point = 2.6,
	facepalm = 2.4,
	shrug = 1.4,
	cheer = 1.6,
	bow = 1.5,
	hop = 0.5,
	spin = 1.1,
}

export type Host = {
	step: (now: number, reduced: boolean) -> (),
	rest: () -> (),
	talk: (seconds: number) -> (),
	silence: () -> (),
	gesture: (name: string) -> (),
	look: (mode: string) -> (),
	active: () -> boolean,
}

local function smooth(u: number): number
	u = math.clamp(u, 0, 1)
	return u * u * (3 - 2 * u)
end
local function envelope(u: number, length: number): number
	local rise = math.min(0.18, length * 0.25) / length
	local fall = math.min(0.32, length * 0.35) / length
	if u < rise then
		return smooth(u / rise)
	elseif u > 1 - fall then
		return smooth((1 - u) / fall)
	end
	return 1
end

function StageHost.new(flip: Instance?): Host
	local parts: { BasePart } = {}
	local rests: { CFrame } = {}
	local groups: { number } = {}
	local pupils: { [number]: boolean } = {}
	local frames: { CFrame } = {}
	local mouths: { { part: BasePart, size: Vector3 } } = {}
	local glasses: { { part: BasePart, color: Color3 } } = {}
	local irises: { BasePart } = {}
	local beacon: BasePart? = nil
	local beaconColor = Color3.fromRGB(255, 84, 191)

	if flip then
		for _, obj in flip:GetChildren() do
			if obj:IsA("BasePart") then
				table.insert(parts, obj)
				table.insert(rests, obj.CFrame)
				table.insert(frames, obj.CFrame)
				local index = #parts
				groups[index] = if headNames[obj.Name] then HEAD elseif armNames[obj.Name] then 0 else BODY
				if obj.Name == "AnimatedPupil" or obj.Name == "EyeGlint" then
					pupils[index] = true
					table.insert(irises, obj)
				elseif obj.Name == "HostMouth" then
					table.insert(mouths, { part = obj, size = obj.Size })
				elseif obj.Name == "EyeGlass" then
					table.insert(glasses, { part = obj, color = obj.Color })
				elseif obj.Name == "OnAirBeacon" then
					beacon = obj
					beaconColor = obj.Color
				end
			end
		end
	end

	-- Pivots: the base sits under the shoes, the neck at the bottom of the radio cabinet, and each arm
	-- swings from its shoulder gear. Facing is derived from the eyes so a rotated rebuild still works.
	local minY = math.huge
	local sum, count = Vector3.zero, 0
	local headSum, headCount = Vector3.zero, 0
	local headLow = math.huge
	local eyeSum, eyeCount = Vector3.zero, 0
	for i, part in parts do
		local p = rests[i].Position
		minY = math.min(minY, p.Y - part.Size.Y / 2)
		sum += p
		count += 1
		if groups[i] == HEAD and (part.Name == "Cabinet" or part.Name == "RadioFace") then
			headSum += p
			headCount += 1
			headLow = math.min(headLow, p.Y - 0.9)
		end
		if part.Name == "EyeGlass" then
			eyeSum += p
			eyeCount += 1
		end
	end
	local centre = if count > 0 then sum / count else Vector3.zero
	local headCentre = if headCount > 0 then headSum / headCount else centre
	local forward = Vector3.new(0, 0, 1)
	if eyeCount > 0 then
		local d = eyeSum / eyeCount - headCentre
		d = Vector3.new(d.X, 0, d.Z)
		if d.Magnitude > 0.05 then
			forward = d.Unit
		end
	end
	local base = CFrame.lookAt(
		Vector3.new(headCentre.X, minY, headCentre.Z),
		Vector3.new(headCentre.X, minY, headCentre.Z) + forward
	)
	local neck = CFrame.lookAt(
		Vector3.new(headCentre.X, if headLow < math.huge then headLow else centre.Y, headCentre.Z),
		Vector3.new(headCentre.X, if headLow < math.huge then headLow else centre.Y, headCentre.Z) + forward
	)
	local baseInv, neckInv = base:Inverse(), neck:Inverse()

	-- Split the arms by side in Flip's own space: local -X is the card hand, nearest the performer.
	local shoulderL, shoulderR = neck, neck
	for i, part in parts do
		if groups[i] == 0 then
			local localX = neck:PointToObjectSpace(rests[i].Position).X
			groups[i] = if localX < 0 then ARM_L else ARM_R
			if part.Name == "ShoulderGear" then
				local pivot = CFrame.lookAt(rests[i].Position, rests[i].Position + forward)
				if localX < 0 then
					shoulderL = pivot
				else
					shoulderR = pivot
				end
			end
		end
	end
	local shoulderLInv, shoulderRInv = shoulderL:Inverse(), shoulderR:Inverse()

	local enabled = false
	local talkUntil = 0
	local gestureName = ""
	local gestureAt = 0
	local lookMode = "idle"
	local glanceX, glanceY = 0, 0
	local nextDart = 0
	local dartX, dartY = 0, 0
	local blinkAt = os.clock() + 2
	local blinking = false
	local lastStep = 0

	local function setBlink(closed: boolean)
		if blinking == closed then
			return
		end
		blinking = closed
		for _, iris in irises do
			iris.LocalTransparencyModifier = if closed then 1 else 0
		end
		for _, g in glasses do
			g.part.Color = if closed then Color3.fromRGB(44, 38, 66) else g.color
		end
	end

	local function rest()
		if not enabled then
			return
		end
		enabled = false
		if #parts > 0 then
			workspace:BulkMoveTo(parts, rests, Enum.BulkMoveMode.FireCFrameChanged)
		end
		for _, m in mouths do
			m.part.Size = m.size
		end
		setBlink(false)
		if beacon then
			beacon.Color = beaconColor
		end
	end

	local function step(now: number, reduced: boolean)
		if #parts == 0 then
			return
		end
		local spinning = gestureName == "spin" or gestureName == "hop"
		-- 30 Hz is plenty for idle breathing; full rate while Flip hops or spins.
		if not spinning and now - lastStep < 1 / 30 and enabled then
			return
		end
		lastStep = now
		enabled = true
		local talking = now < talkUntil
		local still = reduced

		-- Idle life. Arm angles follow Flip's own space: +armLz / -armRz swing a hand out and down,
		-- the opposite sign lifts it toward the cabinet. The arms are short, so the big gestures
		-- also slide the whole arm along its shoulder like a telescoping robot limb.
		local bob = if still then 0 else 0.045 * math.sin(now * 2.1)
		local tiltX = if still then 0 else 0.025 * math.sin(now * 1.3)
		local tiltZ = if still then 0 else 0.05 * math.sin(now * 0.7)
		local armLz = if still then 0 else 0.05 * math.sin(now * 1.7)
		local armRz = if still then 0 else -0.05 * math.sin(now * 1.7 + 1.1)
		local armLx, armRx = 0, 0
		local lOut, lUp, lFwd, rOut, rUp, rFwd = 0, 0, 0, 0, 0, 0
		local hop, spin = 0, 0
		if talking and not still then
			bob += 0.06 * math.abs(math.sin(now * 4.6))
			tiltX += -0.05 * math.sin(now * 3.1)
			tiltZ += 0.04 * math.sin(now * 2.3)
			armRz += 0.12 * math.sin(now * 3.4)
		end

		-- Gestures overlay the idle pose.
		local length = lengths[gestureName]
		if length then
			local u = (now - gestureAt) / length
			if u >= 1 then
				gestureName = ""
			else
				local e = envelope(u, length)
				local t = now - gestureAt
				if gestureName == "point" then
					-- The card hand shoots out toward the performer with two little jabs.
					local jab = if still
						then 0
						else 0.14 * math.max(0, math.sin(t * 11)) * math.max(0, 1 - t / 0.9)
					lOut += (0.5 + jab) * e
					lUp += 0.22 * e
					lFwd += 0.3 * e
					armLz += 0.18 * e
					armLx += -0.2 * e
					tiltZ += 0.12 * e
					tiltX += -0.04 * e
				elseif gestureName == "facepalm" then
					-- Right glove comes up over the speaker grille; the head droops.
					armRz += 1.7 * e
					armRx += -0.45 * e
					rFwd += 0.12 * e
					tiltX += -0.1 * e
					tiltZ += -0.06 * e
					bob += -0.06 * e
				elseif gestureName == "shrug" then
					local beat = math.sin(math.min(u * 2.2, 1) * math.pi)
					armLz += 0.45 * e
					armRz += -0.45 * e
					lUp += 0.26 * beat
					rUp += 0.26 * beat
					lOut += 0.15 * e
					rOut += 0.15 * e
					tiltZ += 0.1 * math.sin(u * math.pi * 2) * e
				elseif gestureName == "cheer" then
					local pump = if still then 0 else math.abs(math.sin(t * 9))
					lOut += 0.35 * e
					rOut += 0.35 * e
					lUp += (0.3 + 0.15 * pump) * e
					rUp += (0.3 + 0.15 * pump) * e
					armLz += 0.25 * e
					armRz += -0.25 * e
					tiltX += 0.08 * e
					hop = if still then 0 else 0.4 * math.abs(math.sin(u * math.pi * 3)) * e
				elseif gestureName == "bow" then
					tiltX += -0.3 * e
					bob += -0.1 * e
					lFwd += 0.15 * e
					rFwd += 0.15 * e
				elseif gestureName == "hop" then
					local arc = math.sin(math.pi * u)
					hop = if still then 0 else 0.6 * arc
					armLz += 0.35 * arc
					armRz += -0.35 * arc
					lUp += 0.12 * arc
					rUp += 0.12 * arc
				elseif gestureName == "spin" then
					spin = if still then 0 else smooth(u) * math.pi * 2
					hop = if still then 0 else 0.55 * math.sin(math.pi * u)
					armLz += 0.35 * e
					armRz += -0.35 * e
					lOut += 0.3 * e
					rOut += 0.3 * e
					lUp += 0.2 * e
					rUp += 0.2 * e
				end
			end
		end

		-- Eye glance, in world space before the head transform.
		if lookMode == "idle" then
			if now >= nextDart then
				nextDart = now + 1.4 + math.random() * 2.2
				dartX = (math.random() - 0.5) * 0.22
				dartY = (math.random() - 0.5) * 0.08
			end
		end
		local wantX, wantY = 0, 0
		if lookMode == "performer" then
			wantX, wantY = 0.07, 0
		elseif lookMode == "audience" then
			wantX, wantY = -0.13, -0.02
		elseif lookMode == "down" then
			wantX, wantY = -0.08, -0.12
		elseif lookMode == "up" then
			wantX, wantY = -0.1, 0.1
		else
			wantX, wantY = dartX - 0.06, dartY
		end
		glanceX += (wantX - glanceX) * 0.35
		glanceY += (wantY - glanceY) * 0.35
		local glance = CFrame.new(glanceX, glanceY, 0)

		-- Blink every few seconds; double-blink now and then.
		if now >= blinkAt then
			setBlink(true)
			if now >= blinkAt + 0.11 then
				setBlink(false)
				blinkAt = now + (if math.random() < 0.18 then 0.18 else 2.2 + math.random() * 3.2)
			end
		end

		local root = base * CFrame.new(0, hop, 0) * CFrame.Angles(0, spin, 0) * baseInv
		local head = neck * CFrame.new(0, bob, 0) * CFrame.Angles(tiltX, 0, tiltZ) * neckInv
		-- Shoulder space: local -X points out of Flip's card side, +X out of the other, -Z forward.
		local armL = shoulderL * CFrame.new(-lOut, lUp, -lFwd) * CFrame.Angles(armLx, 0, armLz) * shoulderLInv
		local armR = shoulderR * CFrame.new(rOut, rUp, -rFwd) * CFrame.Angles(armRx, 0, armRz) * shoulderRInv
		for i, restCF in rests do
			local g = groups[i]
			if g == HEAD then
				frames[i] = root * head * (if pupils[i] then glance * restCF else restCF)
			elseif g == ARM_L then
				frames[i] = root * armL * restCF
			elseif g == ARM_R then
				frames[i] = root * armR * restCF
			else
				frames[i] = root * restCF
			end
		end
		workspace:BulkMoveTo(parts, frames, Enum.BulkMoveMode.FireCFrameChanged)

		for i, m in mouths do
			local scale = if talking and not still
				then 0.45 + 1.05 * math.abs(math.sin(now * 13 + i * 1.9) * math.sin(now * 7.3 + i))
				else 0.92 + 0.08 * math.sin(now * 2 + i)
			m.part.Size = Vector3.new(m.size.X, m.size.Y * scale, m.size.Z)
		end
		if beacon then
			local pulse = if talking then 0.5 + 0.5 * math.sin(now * 9) else 0.15 + 0.15 * math.sin(now * 1.6)
			beacon.Color = beaconColor:Lerp(Color3.fromRGB(255, 214, 236), pulse)
		end
	end

	return {
		step = step,
		rest = rest,
		talk = function(seconds: number)
			talkUntil = math.max(talkUntil, os.clock() + seconds)
		end,
		silence = function()
			talkUntil = 0
		end,
		gesture = function(name: string)
			if lengths[name] then
				gestureName = name
				gestureAt = os.clock()
			end
		end,
		look = function(mode: string)
			lookMode = mode
		end,
		active = function()
			return enabled
		end,
	}
end

return StageHost
