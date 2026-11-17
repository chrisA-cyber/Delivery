--!strict
local Players = game:GetService("Players")
local DataStore = game:GetService("DataStoreService")
local Studio = game:GetService("RunService"):IsStudio()
local Http = game:GetService("HttpService")
local Profiles = require(script.Parent.Profiles)
local Saves = {}
local function memoryStore()
	local records = {}
	return {
		UpdateAsync = function(_, key, fn)
			local updated = fn(records[key])
			if updated then
				records[key] = updated
			end
			return updated
		end,
	}
end
function Saves.new(standings)
	local localOnly = Studio or game.GameId == 0
	local store = if localOnly then memoryStore() else DataStore:GetDataStore("DeliveryProfiles_v1")
	local groups = if localOnly then memoryStore() else DataStore:GetDataStore("DeliveryTroupes_v1")
	local sessions = {}
	local status = {}
	local pending = {}
	local closing = false
	local function syncTroupe(p, row)
		local key = tostring(row.week) .. "/" .. tostring(row.troupe)
		local ok, total = pcall(Profiles.contribute, groups, key, p.UserId, row.weekly)
		if ok and total and key == tostring(row.week) .. "/" .. tostring(row.troupe) then
			row.troupeTotal = total
		end
	end
	local function load(p)
		local key = "p/" .. p.UserId
		local token = Http:GenerateGUID(false)
		status[p] = "Loading progression"
		pending[p] = true
		task.spawn(function()
			for attempt = 1, 4 do
				if p.Parent ~= Players or closing then
					break
				end
				local ok, session = pcall(Profiles.open, store, key, token, os.time)
				if ok and session then
					if p.Parent ~= Players or closing then
						session.save(true)
						break
					end
					sessions[p] = session
					local row = session.row
					row.returned = row.lastVisit == math.floor(os.time() / 86400) - 1
					row.lastVisit = math.floor(os.time() / 86400)
					if row.troupe == 0 then
						row.troupe = p.UserId
					end
					standings[p.UserId] = row
					status[p] = if localOnly then "Studio session" else "Progress saved"
					break
				end
				status[p] = "Waiting for save slot"
				task.wait(attempt * 2)
			end
			if p.Parent == Players and not sessions[p] then
				status[p] = "Session only · save unavailable"
			end
			pending[p] = nil
		end)
	end
	local function close(p)
		local session = sessions[p]
		if not session then
			status[p] = nil
			return
		end
		sessions[p] = nil
		local limit = os.clock() + 23
		repeat
			if not session.busy and (session.closed or session.save(true)) then
				break
			end
			task.wait(0.3)
		until os.clock() >= limit
		status[p] = nil
	end
	local function troupe(p, friendId)
		local row = standings[p.UserId]
		if not row or not sessions[p] or type(friendId) ~= "number" or friendId <= 0 or friendId % 1 ~= 0 then
			return
		end
		local friend = Players:GetPlayerByUserId(friendId)
		if not friend or friend == p or not sessions[friend] then
			return
		end
		local ok, isFriend = pcall(p.IsFriendsWithAsync, p, friendId)
		if not ok or not isFriend or not sessions[p] or not sessions[friend] then
			return
		end
		local target = sessions[friend].row.troupe
		if target == row.troupe or row.weekly > 0 then
			return
		end
		local week = math.floor((os.time() / 86400 + 3) / 7)
		local joined, total = pcall(Profiles.contribute, groups, tostring(week) .. "/" .. target, p.UserId, 0)
		if joined and total and sessions[p] and row.weekly == 0 then
			row.troupe = target
			row.troupeTotal = total
		end
	end
	task.spawn(function()
		while not closing do
			task.wait(35)
			for p, session in sessions do
				task.spawn(function()
					if not session.busy and not session.closed then
						syncTroupe(p, session.row)
						local ok = session.save(false)
						status[p] = if not ok
							then "Save pending"
							elseif localOnly then "Studio session"
							else "Progress saved"
					end
				end)
			end
		end
	end)
	game:BindToClose(function()
		closing = true
		local remaining = 0
		for p in sessions do
			remaining += 1
			task.spawn(function()
				close(p)
				remaining -= 1
			end)
		end
		local start = os.clock()
		while (remaining > 0 or next(pending)) and os.clock() - start < 25 do
			task.wait(0.1)
		end
	end)
	return { load = load, close = close, troupe = troupe, status = status }
end
return Saves
