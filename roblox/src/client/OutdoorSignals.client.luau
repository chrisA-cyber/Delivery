--!strict
-- Outdoor signals and the town's encore party.
--  * Buoy Watch: each visitor sees the timing of their own watch on the physical harbour lamp (bright gold).
--    Between watches the buoy keeps a slow red navigation blink so the harbour never looks switched off.
--  * Encore (a LastBand 3 reveal): for two minutes the Night Market bulbs pulse through the show palette
--    and confetti and streamers drift over Broadcast Plaza. Only part Color is animated; the lights that
--    the atmosphere adds to those bulbs are left alone. Reduced Motion slows the pulse and thins the confetti.
local RunService = game:GetService("RunService")
local Storage = game:GetService("ReplicatedStorage")

local client = script.Parent
local StreetShow = require(client:WaitForChild("StreetShow"))
local StreetBubble = require(client:WaitForChild("StreetBubble"))

local shared = Storage:WaitForChild("Delivery")
if not game:IsLoaded() then
	game.Loaded:Wait()
end
local set = workspace:WaitForChild("ShowSet")

----------------------------------------------------------------------------------------------------
-- Buoy
----------------------------------------------------------------------------------------------------
local run: any = nil
local lamp: BasePart? = nil
local light: PointLight? = nil
local oldColour = Color3.new(1, 1, 1)
local oldMaterial = Enum.Material.Neon
local DARK = Color3.fromRGB(109, 73, 53)
local SIGNAL = Color3.fromRGB(255, 243, 152)
local NAV = Color3.fromRGB(255, 112, 92)

local function findLamp(): BasePart?
	local current = lamp
	if current and current.Parent then
		return current
	end
	local found = set:FindFirstChild("BuoyLamp", true)
	if found and found:IsA("BasePart") then
		lamp = found
		oldColour = found.Color
		oldMaterial = found.Material
		return found
	end
	return nil
end

local function dropLight()
	if light then
		light:Destroy()
		light = nil
	end
end

task.spawn(function()
	shared:WaitForChild("Stage").OnClientEvent:Connect(function(s)
		local venue = type(s) == "table" and s.venue
		local r = venue and venue.outdoor
		run = if venue
				and venue.room == "pier"
				and r
				and r.kind == "pier"
				and r.status == "active"
			then r
			else nil
		if not run then
			dropLight()
		end
	end)
end)

local function buoyWatch(target: BasePart)
	if not light then
		local l = Instance.new("PointLight")
		l.Color = Color3.fromRGB(255, 236, 140)
		l.Range = 13
		l.Shadows = false
		l.Parent = target
		light = l
	end
	local elapsed = workspace:GetServerTimeNow() - (tonumber(run.started) or 0)
	local pulse = false
	if type(run.beats) == "table" then
		local reels = if type(run.reels) == "table" then run.reels else {}
		for i, beat in run.beats do
			if not reels[tostring(i)] and math.abs(elapsed - beat) <= 0.8 then
				pulse = true
				break
			end
		end
	end
	target.Color = if pulse then SIGNAL else DARK
	target.Material = if pulse then Enum.Material.Neon else Enum.Material.SmoothPlastic
	if light then
		light.Brightness = if pulse then 3.5 else 0
	end
end

local function navBlink(target: BasePart, now: number)
	local on = now % 4 < 0.45
	target.Color = if on then NAV else oldColour:Lerp(DARK, 0.65)
	target.Material = if on then Enum.Material.Neon else Enum.Material.SmoothPlastic
end

----------------------------------------------------------------------------------------------------
-- Encore: market bulbs
----------------------------------------------------------------------------------------------------
local palette = {
	Color3.fromHex("ffdc9e"),
	Color3.fromHex("d58ca5"),
	Color3.fromHex("929acb"),
	Color3.fromHex("ddb481"),
}
local bulbs: { BasePart } = {}
local bulbRest: { Color3 } = {}
local bulbTint: { Color3 } = {}
local bulbPhase: { number } = {}
do
	local market = set:FindFirstChild("NightMarket")
	if market then
		for _, item in market:GetDescendants() do
			if
				item:IsA("BasePart")
				and (
					item.Name == "FestoonLamp"
					or item.Name == "MarketLantern"
					or string.sub(item.Name, 1, 4) == "Lamp"
				)
			then
				-- Marquee chases belong to the atmosphere's bulb chaser.
				local parent = item.Parent
				if not (parent and string.find(parent.Name, "Marquee")) then
					table.insert(bulbs, item)
					table.insert(bulbRest, item.Color)
					table.insert(bulbTint, palette[#bulbs % #palette + 1])
					table.insert(bulbPhase, item.Position.X * 0.25 + item.Position.Z * 0.08)
				end
			end
		end
	end
end
local MARKET = Vector3.new(0, 9, 178)
local bulbsLive = false

local function pulseBulbs(now: number, reduced: boolean)
	local speed = if reduced then 1.2 else 4.5
	local depth = if reduced then 0.35 else 0.7
	for i, part in bulbs do
		local wave = 0.5 + 0.5 * math.sin(now * speed + bulbPhase[i])
		part.Color = bulbRest[i]:Lerp(bulbTint[i], wave * depth)
	end
	bulbsLive = true
end

local function restoreBulbs()
	if not bulbsLive then
		return
	end
	bulbsLive = false
	for i, part in bulbs do
		part.Color = bulbRest[i]
	end
end

----------------------------------------------------------------------------------------------------
-- Encore: confetti and streamers over Broadcast Plaza
----------------------------------------------------------------------------------------------------
local sky = Instance.new("Part")
sky.Name = "PlazaConfetti"
sky.Anchored = true
sky.CanCollide = false
sky.CanQuery = false
sky.CanTouch = false
sky.Transparency = 1
sky.Size = Vector3.new(46, 1, 44)
sky.CFrame = CFrame.new(0, 26, 64)
sky.Parent = workspace

local emitters: { ParticleEmitter } = {}
local function emitter(colour: ColorSequence, squash: number, size: number, life: number): ParticleEmitter
	local e = Instance.new("ParticleEmitter")
	e.Shape = Enum.ParticleEmitterShape.Box
	e.ShapeStyle = Enum.ParticleEmitterShapeStyle.Volume
	e.EmissionDirection = Enum.NormalId.Bottom
	e.Color = colour
	e.Size = NumberSequence.new(size)
	e.Squash = NumberSequence.new(squash)
	e.Lifetime = NumberRange.new(life, life + 2.5)
	e.Speed = NumberRange.new(1.5, 4)
	e.SpreadAngle = Vector2.new(35, 35)
	e.Acceleration = Vector3.new(0.6, -2.6, 0)
	e.Drag = 0.5
	e.Rotation = NumberRange.new(0, 360)
	e.RotSpeed = NumberRange.new(-220, 220)
	e.LightEmission = 0.3
	e.LightInfluence = 0.4
	e.Transparency = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0),
		NumberSequenceKeypoint.new(0.85, 0),
		NumberSequenceKeypoint.new(1, 1),
	})
	e.Rate = 0
	e.Enabled = true
	e.Parent = sky
	table.insert(emitters, e)
	return e
end
for _, colour in palette do
	emitter(ColorSequence.new(colour), 0.6, 0.38, 5)
end
local streamers =
	emitter(ColorSequence.new(Color3.fromHex("ddb481"), Color3.fromHex("d58ca5")), 2.6, 0.3, 6.5)
streamers.RotSpeed = NumberRange.new(-60, 60)

local popSound: Sound? = nil
do
	local id = StreetBubble.soundId("ConfettiPop")
	if id then
		local sound = Instance.new("Sound")
		sound.SoundId = id
		sound.Volume = 0.5
		sound.RollOffMinDistance = 20
		sound.RollOffMaxDistance = 140
		sound.Parent = sky
		popSound = sound
	end
end

local burstAt = 0
local partying = false
StreetShow.onReveal(function(_band: number, encore: boolean)
	if not encore then
		return
	end
	partying = true
	burstAt = 0
	local sound = popSound
	if sound then
		sound:Play()
	end
end)

local function confetti(now: number, reduced: boolean)
	local progress = StreetShow.encoreProgress()
	-- A heavy first fall, then a light drift with a burst every fifteen seconds.
	local base = if progress < 0.08 then 70 else 6
	local rate = if reduced then base * 0.3 else base
	for _, e in emitters do
		e.Rate = rate / #emitters
	end
	if progress >= 0.08 and now >= burstAt then
		burstAt = now + 15
		for _, e in emitters do
			e:Emit(if reduced then 6 else 18)
		end
	end
end

local function stopConfetti()
	for _, e in emitters do
		e.Rate = 0
	end
end

----------------------------------------------------------------------------------------------------
-- Loop
----------------------------------------------------------------------------------------------------
local clock = 0
RunService.Heartbeat:Connect(function(dt: number)
	clock += dt
	if clock < 0.066 then
		return
	end
	clock = 0
	local now = os.clock()
	local target = findLamp()
	if target then
		if run then
			buoyWatch(target)
		else
			navBlink(target, now)
		end
	end
	local camera = workspace.CurrentCamera
	local eye = if camera then camera.CFrame.Position else Vector3.zero
	if StreetShow.encore() then
		local reduced = StreetShow.reduced()
		if #bulbs > 0 and (eye - MARKET).Magnitude < 160 then
			pulseBulbs(now, reduced)
		end
		if partying then
			confetti(now, reduced)
		end
	else
		restoreBulbs()
		if partying then
			partying = false
			stopConfetti()
		end
	end
end)

script.Destroying:Connect(function()
	dropLight()
	local current = lamp
	if current and current.Parent then
		current.Color = oldColour
		current.Material = oldMaterial
	end
	restoreBulbs()
end)
