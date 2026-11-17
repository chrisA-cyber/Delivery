--!strict
-- Authored town dialogue. Lines come from ReplicatedStorage.Delivery.TownTalk (content team); the few
-- fallbacks below only cover a build where that module is missing. Every string here is controlled text:
-- the only substitutions are the show's catalogue direction label and a shop title.
local Storage = game:GetService("ReplicatedStorage")

local StreetTalk = {}

local fallback: { [string]: { [string]: { string } } } = {
	Marnie = {
		tips = { "Take a parcel at Dockside Post. The address on your ticket tells you which shop needs it." },
	},
	Bram = {
		tips = {
			"Smell the bread? Copper Kettle is just off Market Walk. Try the order ticket at the counter.",
		},
	},
	Linn = {
		tips = { "Pocket Print Gallery lets you choose the view, ink and greeting for a town postcard." },
	},
	Reed = { tips = { "Needle Drop is around the corner. Clock Court has three bells you can play." } },
	Capstan = { tips = { "Watch the buoy lamp. Reel each time it flashes, three times per shift." } },
	Pip = { tips = { "Start Signal Run at the gate by the bandstand. Run through each marked arch." } },
	Dot = {
		tips = { "Take an order, find the two supply stalls, and use the customer's stamp at the counter." },
	},
}
local fallbackShared: { [string]: { string } } = {
	idle = { "Lovely evening for it.", "Hello there!" },
	lineup = { "Doors are open. Shall we?", "I hope Flip saved me a seat!" },
	encore = { "An encore! Did you hear that?", "Bravo! Bravo!" },
	parcel = { "A parcel! Somebody's going to be pleased.", "Careful with that one!" },
}

local talk: any = nil
local function source(): any
	if talk ~= nil then
		return talk
	end
	local shared = Storage:FindFirstChild("Delivery")
	local module = shared and shared:FindFirstChild("TownTalk")
	if module and module:IsA("ModuleScript") then
		local ok, value = pcall(require, module)
		talk = if ok and type(value) == "table" then value else false
	end
	return talk
end

local function list(value: any): { string }?
	if type(value) ~= "table" or #value == 0 then
		return nil
	end
	return value :: { string }
end

-- kind is "tips" or "idle" for a named resident, or a shared kind ("lineup", "encore", "parcel").
function StreetTalk.lines(name: string?, kind: string): { string }?
	local data = source()
	if type(data) == "table" then
		if name then
			local residents = if type(data.residents) == "table" then data.residents else data
			local entry = residents[name]
			local own = if type(entry) == "table" then list(entry[kind]) else nil
			if own then
				return own
			end
		end
		local shared = if type(data.shared) == "table" then data.shared else data
		local common = list(shared[kind])
		if common then
			return common
		end
		if name and kind == "idle" then
			local commonIdle = list(shared.idle)
			if commonIdle then
				return commonIdle
			end
		end
	end
	if name then
		local own = fallback[name]
		local lines = own and own[kind]
		if lines then
			return lines
		end
	end
	return fallbackShared[kind]
end

local function slotValue(value: string?): string?
	return if value and value ~= "" then value else nil
end

-- Local stand-in for TownTalk.fill: a line whose slot cannot be filled is skipped, never shown half-done.
local function fill(line: string, slots: { direction: string?, shop: string? }): string?
	local missing = false
	local text = string.gsub(line, "{(%a+)}", function(key: string): string
		local value = (slots :: any)[key]
		if type(value) ~= "string" then
			missing = true
			return ""
		end
		return value
	end)
	return if missing then nil else text
end

-- Picks a line; `cursor` walks a resident's tips in order, otherwise the start is random. Lines whose
-- {direction}/{shop} slot cannot be filled are skipped (TownTalk.pick when the module is present).
function StreetTalk.pick(
	name: string?,
	kind: string,
	cursor: number?,
	direction: string?,
	shop: string?
): string?
	local lines = StreetTalk.lines(name, kind)
	if not lines then
		return nil
	end
	local index = cursor or math.random(1, #lines)
	local slots = { direction = slotValue(direction), shop = slotValue(shop) }
	local data = source()
	if type(data) == "table" and type(data.pick) == "function" then
		local ok, text = pcall(data.pick, lines, index, slots)
		if ok then
			return if type(text) == "string" then text else nil
		end
	end
	for offset = 0, #lines - 1 do
		local text = fill(lines[(index + offset - 1) % #lines + 1], slots)
		if text then
			return text
		end
	end
	return nil
end

return StreetTalk
