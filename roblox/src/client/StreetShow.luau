--!strict
-- Read-only view of ReplicatedStorage.ShowStatus for the town's set dressing. Everything here is nil-safe:
-- the folder may arrive late or never, and every reader then sees an idle town.
local Players = game:GetService("Players")
local GuiService = game:GetService("GuiService")
local Storage = game:GetService("ReplicatedStorage")

local StreetShow = {}

-- Seconds of town-wide celebration after an encore-level reveal.
StreetShow.ENCORE_SECONDS = 120

local status: Instance? = nil
local encoreUntil = 0
local encoreStarted = 0
local lastRound: number? = nil
local revealListeners: { (band: number, encore: boolean) -> () } = {}
local phaseListeners: { (phase: string) -> () } = {}

local themeModule = script.Parent:FindFirstChild("UITheme")
local Theme: any = nil
if themeModule and themeModule:IsA("ModuleScript") then
	local ok, value = pcall(require, themeModule)
	if ok then
		Theme = value
	end
end

local function attribute(name: string): any
	local folder = status
	if not folder or not folder.Parent then
		return nil
	end
	return folder:GetAttribute(name)
end

function StreetShow.phase(): string
	local value = attribute("Phase")
	return if type(value) == "string" then value else "idle"
end

-- A show is running from the lineup to the reveal; the town is quiet when idle or between shows.
function StreetShow.showOn(): boolean
	local phase = StreetShow.phase()
	return phase ~= "idle" and phase ~= "intermission" and phase ~= ""
end

function StreetShow.lineup(): boolean
	return StreetShow.phase() == "lineup"
end

function StreetShow.direction(): string
	local value = attribute("Direction")
	return if type(value) == "string" then value else ""
end

function StreetShow.watchers(): number
	local value = attribute("Watchers")
	return if type(value) == "number" then value else 0
end

function StreetShow.lastBand(): number
	local value = attribute("LastBand")
	return if type(value) == "number" then value else -1
end

function StreetShow.encore(): boolean
	return os.clock() < encoreUntil
end

-- 0 at the start of a celebration, 1 when it ends.
function StreetShow.encoreProgress(): number
	if encoreUntil <= encoreStarted then
		return 1
	end
	return math.clamp((os.clock() - encoreStarted) / (encoreUntil - encoreStarted), 0, 1)
end

function StreetShow.onReveal(callback: (band: number, encore: boolean) -> ())
	table.insert(revealListeners, callback)
end

function StreetShow.onPhase(callback: (phase: string) -> ())
	table.insert(phaseListeners, callback)
end

-- Big or screen-filling motion yields to Roblox's Reduced Motion, the show's "Camera motion" switch
-- (when it publishes a player attribute) and the shared UI theme when one exists.
function StreetShow.reduced(): boolean
	if Theme and type(Theme.reducedMotion) == "function" then
		local ok, value = pcall(Theme.reducedMotion)
		if ok and value == true then
			return true
		end
	end
	local player = Players.LocalPlayer
	if player and player:GetAttribute("ReducedMotion") == true then
		return true
	end
	local ok, value = pcall(function()
		return (GuiService :: any).ReducedMotionEnabled
	end)
	return ok and value == true
end

local function fireReveal(band: number)
	local encore = band >= 3
	if encore then
		encoreStarted = os.clock()
		encoreUntil = encoreStarted + StreetShow.ENCORE_SECONDS
	end
	for _, callback in revealListeners do
		task.spawn(callback, band, encore)
	end
end

local function watch(folder: Instance)
	status = folder
	local round = folder:GetAttribute("Round")
	lastRound = if type(round) == "number" then round else nil
	folder:GetAttributeChangedSignal("Round"):Connect(function()
		local value = folder:GetAttribute("Round")
		if type(value) ~= "number" then
			return
		end
		local previous = lastRound
		lastRound = value
		if previous ~= nil and value <= previous then
			return
		end
		-- The server may write LastBand just after Round; read it once the batch has landed.
		task.delay(0.15, function()
			fireReveal(StreetShow.lastBand())
		end)
	end)
	folder:GetAttributeChangedSignal("Phase"):Connect(function()
		local phase = StreetShow.phase()
		for _, callback in phaseListeners do
			task.spawn(callback, phase)
		end
	end)
end

-- QA hook for Studio play tests: set workspace attribute "StreetEncoreTest" to any value to celebrate.
workspace:GetAttributeChangedSignal("StreetEncoreTest"):Connect(function()
	fireReveal(3)
end)

task.spawn(function()
	local folder = Storage:WaitForChild("ShowStatus", 60)
	while not folder do
		folder = Storage:WaitForChild("ShowStatus", 60)
	end
	watch(folder)
end)

return StreetShow
