--!strict
local Deck = {}

local function seed(text: string): number
	local value = 7
	for i = 1, #text do
		value = (value * 131 + string.byte(text, i)) % 2147483647
	end
	return math.max(1, value)
end

function Deck.shuffle<T>(items: { T }, key: string): { T }
	local pool = table.clone(items)
	local value = seed(key)
	for i = #pool, 2, -1 do
		value = (value * 48271) % 2147483647
		local j = value % i + 1
		pool[i], pool[j] = pool[j], pool[i]
	end
	return pool
end

function Deck.daily(catalogue, date: string)
	return Deck.shuffle(catalogue.lines, "line/" .. date)[1],
		Deck.shuffle(catalogue.directions, "cue/" .. date)[1]
end

function Deck.new(catalogue, key: string)
	local remaining = {}
	local cycle, turns = 0, 0
	local previous = ""
	local recent = {}
	return function()
		if #remaining == 0 then
			cycle += 1
			remaining = Deck.shuffle(catalogue.lines, key .. "/" .. cycle)
			if #remaining > 1 and remaining[#remaining].id == previous then
				remaining[1], remaining[#remaining] = remaining[#remaining], remaining[1]
			end
		end
		local line = assert(table.remove(remaining))
		previous = line.id
		turns += 1
		local choices = {}
		for _, cue in Deck.shuffle(catalogue.directions, key .. "/cue/" .. turns) do
			if not table.find(recent, cue.id) then
				table.insert(choices, cue)
				if #choices == 3 then
					break
				end
			end
		end
		for _, cue in choices do
			table.insert(recent, cue.id)
		end
		while #recent > 6 do
			table.remove(recent, 1)
		end
		return line, choices
	end
end
return Deck
