--!strict
-- Theatre-local lighting cues. Only the stage rig, two follow spots and the proscenium bulbs change;
-- global Lighting belongs to the district and is never touched here, apart from the "ShowGrade" tint.
local Lighting = game:GetService("Lighting")
local Tween = game:GetService("TweenService")

local StageLights = {}

local bulbWarm = Color3.fromRGB(255, 220, 158)
local champagne = Color3.fromRGB(221, 180, 129)
local gold = Color3.fromRGB(255, 205, 110)
local cobalt = Color3.fromRGB(65, 91, 168)
local electric = Color3.fromRGB(105, 113, 255)
local powder = Color3.fromRGB(146, 154, 203)
local petal = Color3.fromRGB(213, 140, 165)
local rose = Color3.fromRGB(255, 94, 174)
local lacquer = Color3.fromRGB(91, 35, 56)
local white = Color3.new(1, 1, 1)
local black = Color3.new(0, 0, 0)

type Lamp = { light: PointLight, brightness: number, color: Color3, level: number, tint: Color3 }
type Bulb = { part: BasePart, color: Color3 }

export type Context = {
	phase: string,
	house: boolean,
	bucket: string,
	encore: boolean,
	performer: Vector3,
}

export type Lights = {
	step: (now: number, dt: number, amplitude: number, keyColor: Color3?) -> (),
	cue: (context: Context) -> (),
	burst: () -> (),
	rest: () -> (),
	grade: (onStage: boolean, reduced: boolean) -> (),
	flash: (amount: number) -> (),
}

local function inTheatre(p: Vector3): boolean
	return math.abs(p.X) < 30 and p.Z > -30 and p.Z < 2 and p.Y < 26
end

local function spot(
	parent: Instance,
	name: string,
	from: Vector3,
	to: Vector3,
	angle: number
): (SpotLight, BasePart)
	local rig = Instance.new("Part")
	rig.Name = name
	rig.Anchored = true
	rig.CanCollide = false
	rig.CanTouch = false
	rig.CanQuery = false
	rig.CastShadow = false
	rig.Transparency = 1
	rig.Size = Vector3.one * 0.2
	rig.CFrame = CFrame.lookAt(from, to)
	rig.Parent = parent
	local light = Instance.new("SpotLight")
	light.Name = name
	light.Face = Enum.NormalId.Front
	light.Angle = angle
	light.Range = (to - from).Magnitude + 6
	light.Brightness = 0
	light.Shadows = false
	light.Color = Color3.fromRGB(255, 236, 205)
	light.Enabled = false
	light.Parent = rig
	return light, rig
end

function StageLights.new(set: Instance, folder: Instance): Lights
	local lamps: { [string]: Lamp } = {}
	local function find(name: string): Lamp?
		local lamp = lamps[name]
		if lamp and lamp.light.Parent then
			return lamp
		end
		local rig = set:FindFirstChild("ShowRig")
		local holder = rig and rig:FindFirstChild(name)
		local light = holder and holder:FindFirstChildWhichIsA("PointLight")
		if light then
			local fresh: Lamp = {
				light = light,
				brightness = light.Brightness,
				color = light.Color,
				level = light.Brightness,
				tint = light.Color,
			}
			lamps[name] = fresh
			return fresh
		end
		return nil
	end

	local marquee: { Bulb } = {}
	local footlights: { Bulb } = {}
	for _, obj in set:GetDescendants() do
		if obj:IsA("BasePart") and inTheatre(obj.Position) then
			if obj.Name == "MarqueeBulb" then
				table.insert(marquee, { part = obj, color = obj.Color })
			elseif obj.Name == "ApronPin" then
				table.insert(footlights, { part = obj, color = obj.Color })
			end
		end
	end
	-- Order the arch from stage left to stage right, so a chase runs around it.
	table.sort(marquee, function(a, b)
		return math.atan2(a.part.Position.Y - 5, a.part.Position.X)
			> math.atan2(b.part.Position.Y - 5, b.part.Position.X)
	end)
	table.sort(footlights, function(a, b)
		return a.part.Position.X < b.part.Position.X
	end)

	local performerSpot, performerRig =
		spot(folder, "PerformerSpot", Vector3.new(5, 16.5, -0.5), Vector3.new(5, 2.1, -9.3), 22)
	local hostSpot =
		spot(folder, "HostSpot", Vector3.new(-9.4, 16.5, -1.5), Vector3.new(-10.4, 3.4, -10.2), 20)
	local performerLevel, hostLevel = 0, 0

	local context: Context = {
		phase = "lobby",
		house = false,
		bucket = "",
		encore = false,
		performer = Vector3.new(5, 2.1, -9.3),
	}
	local cueAt = os.clock()
	local burstAt = -100
	local flashAt, flashAmount = -100, 0
	local active = false
	local lastBulbs = 0

	local grade = Lighting:FindFirstChild("ShowGrade")
	if not (grade and grade:IsA("ColorCorrectionEffect")) then
		local fresh = Instance.new("ColorCorrectionEffect")
		fresh.Name = "ShowGrade"
		fresh.Parent = Lighting
		grade = fresh
	end
	local showGrade = grade :: ColorCorrectionEffect
	local stageLook =
		{ TintColor = Color3.fromRGB(255, 243, 230), Contrast = 0.06, Saturation = 0.08, Brightness = -0.02 }
	local streetLook = { TintColor = white, Contrast = 0, Saturation = 0, Brightness = 0 }
	local graded = false
	local gradeTween: Tween? = nil

	local function setBulbs(list: { Bulb }, now: number, mode: string, direction: number)
		for i, b in list do
			local c: Color3
			if mode == "chase" then
				local lit = (i * direction + math.floor(now * 9)) % 3 == 0
				c = if lit then bulbWarm else b.color:Lerp(black, 0.55)
			elseif mode == "fastchase" then
				local lit = (i * direction + math.floor(now * 16)) % 3 == 0
				c = if lit then bulbWarm else b.color:Lerp(black, 0.6)
			elseif mode == "steady" then
				c = b.color:Lerp(black, 0.35)
			elseif mode == "breathe" then
				local w = 0.5 + 0.5 * math.sin(now * 3 + i * 0.35)
				c = b.color:Lerp(black, 0.5):Lerp(powder, w * 0.45)
			elseif mode == "gold" then
				local fade = math.clamp((now - burstAt) / 1.4, 0, 1)
				c = Color3.fromRGB(255, 245, 210):Lerp(gold, fade)
			elseif mode == "encore" then
				local flip = (math.floor(now / 0.45) + i) % 2 == 0
				c = if flip then rose else electric
			elseif mode == "sad" then
				c = b.color:Lerp(black, 0.7)
			else
				c = b.color
			end
			b.part.Color = c
		end
	end

	local function restBulbs()
		for _, b in marquee do
			b.part.Color = b.color
		end
		for _, b in footlights do
			b.part.Color = b.color
		end
	end

	local function rest()
		if not active then
			return
		end
		active = false
		for _, lamp in lamps do
			if lamp.light.Parent then
				lamp.light.Brightness = lamp.brightness
				lamp.light.Color = lamp.color
				lamp.level = lamp.brightness
				lamp.tint = lamp.color
			end
		end
		restBulbs()
		performerSpot.Enabled = false
		hostSpot.Enabled = false
		performerLevel, hostLevel = 0, 0
	end

	local function approach(current: number, target: number, rate: number, dt: number): number
		return current + (target - current) * (1 - math.exp(-rate * dt))
	end

	local function step(now: number, dt: number, amplitude: number, keyColor: Color3?)
		active = true
		local phase = context.phase
		local t = now - cueAt
		local landed = now - burstAt
		local bucket = context.bucket
		local celebrating = phase == "reveal" and context.encore and landed > 0.9 and landed < 30
		local sad = phase == "reveal"
			and (bucket == "miss" or bucket == "low")
			and landed >= 0
			and landed < 30

		-- Targets as multiples of each light's own rest brightness.
		local key, wash, house, foot = 1, 1, 1, 1
		local blueTint, roseTint: Color3? = nil, nil
		local perf, host = 0, 0.35
		local bulbMode = "chase"
		if phase == "countdown" then
			bulbMode = "fastchase"
			perf = 1.2
			wash = 0.85
		elseif phase == "take" or phase == "read" then
			bulbMode = "steady"
			key = 0.8
			wash = 0.5
			house = 0.55
			foot = 0.8
			perf = if context.house then 0 else 3.2
			host = if context.house then 3.2 else 0.15
		elseif phase == "vote" then
			bulbMode = "breathe"
			wash = 1.25
			house = 1.45
			perf = 0.9
			local hue = (t * 0.35) % 3
			blueTint = if hue < 1
				then cobalt:Lerp(powder, hue)
				elseif hue < 2 then powder:Lerp(petal, hue - 1)
				else petal:Lerp(cobalt, hue - 2)
			roseTint = if hue < 1
				then petal:Lerp(lacquer, hue)
				elseif hue < 2 then lacquer:Lerp(rose, hue - 1)
				else rose:Lerp(petal, hue - 2)
		elseif phase == "host" then
			bulbMode = "steady"
			key = 0.7
			wash = 0.6
			perf = if context.house then 0 else 0.8
			host = 3.4
		elseif phase == "reveal" then
			bulbMode = if celebrating
				then "encore"
				elseif sad then "sad"
				elseif landed >= 0 then "gold"
				else "steady"
			perf = if context.house then 0 else 1.6
			host = if context.house then 1.6 else 0.6
			if landed >= 0 and landed < 1.2 and not sad then
				key = 1 + 1.1 * (1 - landed / 1.2)
				blueTint, roseTint = champagne, gold
				wash = 1.5
			elseif celebrating then
				local flip = math.floor(now / 0.45) % 2 == 0
				blueTint = if flip then electric else rose
				roseTint = if flip then rose else electric
				wash = 1.6
			elseif sad then
				wash = 0.45
				key = 0.75
				blueTint = cobalt
				roseTint = lacquer
			end
		end

		local function drive(name: string, level: number, tint: Color3?, extra: number, rate: number)
			local lamp = find(name)
			if not lamp then
				return
			end
			lamp.level = approach(lamp.level, lamp.brightness * level, rate, dt)
			lamp.tint = lamp.tint:Lerp(tint or lamp.color, 1 - math.exp(-rate * dt))
			lamp.light.Brightness = lamp.level + extra
			lamp.light.Color = lamp.tint
		end
		local flash = if now - flashAt < 0.6 then flashAmount * (1 - (now - flashAt) / 0.6) else 0
		drive("Key", key, keyColor, amplitude * 0.6 + flash * 2, 6)
		drive("BlueWash", wash, blueTint, flash, if celebrating then 14 else 5)
		drive("RoseWash", wash, roseTint, flash, if celebrating then 14 else 5)
		drive("House", house, nil, amplitude * 0.5, 4)
		drive("Footlights", foot, nil, flash, 5)

		performerLevel = approach(performerLevel, perf, 7, dt)
		hostLevel = approach(hostLevel, host, 7, dt)
		performerSpot.Enabled = performerLevel > 0.03
		performerSpot.Brightness = performerLevel + amplitude * 0.8
		performerSpot.Color = if keyColor
			then Color3.fromRGB(255, 240, 214):Lerp(keyColor, 0.5)
			else Color3.fromRGB(255, 240, 214)
		hostSpot.Enabled = hostLevel > 0.03
		hostSpot.Brightness = hostLevel

		-- Neon bulbs only need ~15 updates a second.
		if now - lastBulbs >= 1 / 15 then
			lastBulbs = now
			setBulbs(marquee, now, bulbMode, 1)
			-- The footlights chase the other way round.
			setBulbs(footlights, now, bulbMode, -1)
		end
	end

	return {
		step = step,
		cue = function(next: Context)
			if next.phase ~= context.phase then
				cueAt = os.clock()
				if next.phase ~= "reveal" then
					burstAt = -100
				end
			end
			context = next
			local target = next.performer
			local from = target + Vector3.new(0, 14.4, 8.8)
			performerRig.CFrame = CFrame.lookAt(from, target)
		end,
		burst = function()
			burstAt = os.clock()
		end,
		flash = function(amount: number)
			flashAt = os.clock()
			flashAmount = amount
		end,
		rest = rest,
		grade = function(onStage: boolean, reduced: boolean)
			if graded == onStage or not showGrade.Parent then
				return
			end
			graded = onStage
			if gradeTween then
				gradeTween:Cancel()
			end
			local goal = if onStage then stageLook else streetLook
			gradeTween = Tween:Create(showGrade, TweenInfo.new(if reduced then 0 else 0.3), goal)
			if gradeTween then
				gradeTween:Play()
			end
		end,
	}
end

return StageLights
