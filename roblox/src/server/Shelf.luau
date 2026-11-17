--!strict
local Shelf = {}
function Shelf.new(items, provider, studio: boolean)
	local active = {}
	local busy = {}
	local simulated = {}
	local byKey = {}
	for _, item in items do
		byKey[item.key] = item
	end
	local function equip(p, key, preview: boolean)
		if type(key) ~= "string" or #key > 30 or not byKey[key] or busy[p] then
			return false
		end
		local item = byKey[key]
		local request = {}
		busy[p] = request
		local ok, allowed = pcall(function()
			if studio and preview then
				simulated[p] = simulated[p] or {}
				simulated[p][key] = true
				return true
			end
			if studio and simulated[p] and simulated[p][key] then
				return true
			end
			if item.passId <= 0 then
				return false
			end
			return provider(p, item.passId)
		end)
		if busy[p] ~= request then
			return false
		end
		busy[p] = nil
		if ok and allowed then
			active[p] = key
			return true
		end
		return false
	end
	local function leave(p)
		active[p] = nil
		busy[p] = nil
		simulated[p] = nil
	end
	return { equip = equip, active = active, leave = leave }
end
return Shelf
