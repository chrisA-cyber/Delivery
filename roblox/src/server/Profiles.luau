--!strict
-- Store adapter must implement UpdateAsync. Mutations use a fenced renewable lease.
local Profiles = {}
local counters = {
	"stage",
	"streak",
	"crowd",
	"best",
	"roses",
	"calls",
	"takes",
	"received",
	"dailyRun",
	"firstDailyScore",
	"dayTakes",
	"weekly",
	"week",
	"lastVisit",
	"troupe",
	"lastDaily",
	"takeDay",
	"troupeTotal",
}
local boolMaps = { "badges", "packs", "categories" }
function Profiles.blank()
	return {
		stage = 0,
		crowd = 0,
		best = 0,
		streak = 0,
		roses = 0,
		calls = 0,
		takes = 0,
		received = 0,
		dailyRun = 0,
		firstDailyScore = 0,
		lastDaily = 0,
		dayTakes = 0,
		takeDay = 0,
		weekly = 0,
		week = 0,
		lastVisit = 0,
		troupe = 0,
		troupeTotal = 0,
		badges = {},
		packs = {},
		categories = {},
	}
end
local function clean(old)
	local row = Profiles.blank()
	if type(old) == "table" then
		for _, k in counters do
			local v = old[k]
			if type(v) == "number" and v >= 0 and v < 2 ^ 53 then
				row[k] = math.floor(v)
			end
		end
		for _, k in boolMaps do
			if type(old[k]) == "table" then
				for name, value in old[k] do
					if type(name) == "string" and #name <= 40 and value == true then
						row[k][name] = true
					end
				end
			end
		end
	end
	return row
end
function Profiles.open(store, key: string, token: string, now)
	local time = now()
	local record = store:UpdateAsync(key, function(old)
		if old and (old.v ~= 1 or (old.lock and old.lock ~= token and old.expires > time)) then
			return nil
		end
		return { v = 1, lock = token, expires = time + 120, data = clean(if old then old.data else nil) }
	end)
	if not record or record.lock ~= token then
		return nil
	end
	local row = clean(record.data)
	local session = { row = row, busy = false, closed = false, key = key }
	function session.save(release: boolean)
		if session.busy or session.closed then
			return false
		end
		session.busy = true
		local snapshot = clean(row)
		local ok, result = pcall(function()
			return store:UpdateAsync(key, function(old)
				if not old or old.v ~= 1 or old.lock ~= token then
					return nil
				end
				return {
					v = 1,
					lock = if release then nil else token,
					expires = if release then 0 else now() + 120,
					data = snapshot,
				}
			end)
		end)
		session.busy = false
		if ok and result then
			session.closed = release
			return true
		end
		if ok then
			session.closed = true
		end
		return false
	end
	return session
end
function Profiles.record(row, s, day: number)
	local result = s.result
	if not result.overall or result.miss then
		return
	end
	row.takes += 1
	row.received += s.reactionCount
	if row.takeDay ~= day then
		row.takeDay = day
		row.dayTakes = 0
	end
	row.dayTakes += 1
	if s.mode == "Daily" and row.lastDaily < day then
		row.dailyRun = if row.lastDaily == day - 1 then row.dailyRun + 1 else 1
		row.lastDaily = day
		row.firstDailyScore = result.overall
	end
	local badges = row.badges
	badges["first-take"] = true
	if (result.commitment or 0) >= 90 then
		badges["committed-bit"] = true
	end
	if (result.chaos or 0) >= 95 then
		badges["chaos-agent"] = true
	end
	if result.overall == 100 then
		badges["perfectly-weird"] = true
	end
	if row.dayTakes >= 10 then
		badges["one-more-round"] = true
	end
	if row.dailyRun >= 5 then
		badges["daily-five"] = true
	end
	if row.dailyRun >= 30 then
		badges["daily-thirty"] = true
	end
	if row.received >= 100 then
		badges["crowd-favorite"] = true
	end
	if s.mode == "Face-off" then
		badges["friendly-fire"] = true
	end
	if result.overall >= 85 then
		row.categories[s.line.pack] = true
	end
	local count = 0
	for _ in row.categories do
		count += 1
	end
	if count >= 4 then
		badges.range = true
	end
end
function Profiles.week(row, week: number, points: number)
	if row.week ~= week then
		row.week = week
		row.weekly = 0
		row.troupeTotal = 0
	end
	row.weekly += points
	if row.stage >= 20 or row.crowd >= 20 then
		row.packs["Pack night"] = true
	end
end
function Profiles.mergePending(row, new)
	for _, key in { "crowd", "stage", "calls", "takes", "received" } do
		row[key] += new[key]
	end
	row.best = math.max(row.best, new.best)
	row.roses = math.max(row.roses, new.roses)
	if new.takes > 0 then
		row.streak = if new.streak == new.takes then row.streak + new.streak else new.streak
	end
	for _, key in boolMaps do
		for name in new[key] do
			row[key][name] = true
		end
	end
	if new.takeDay > 0 and new.takeDay >= row.takeDay then
		row.dayTakes = if new.takeDay == row.takeDay then row.dayTakes + new.dayTakes else new.dayTakes
		row.takeDay = new.takeDay
	end
	if new.lastDaily > row.lastDaily then
		row.dailyRun = if new.lastDaily == row.lastDaily + 1 then row.dailyRun + 1 else new.dailyRun
		row.lastDaily = new.lastDaily
		row.firstDailyScore = new.firstDailyScore
	end
	if new.week > 0 then
		Profiles.week(row, new.week, new.weekly)
	end
end
function Profiles.contribute(store, key: string, id: number, points: number)
	local result = store:UpdateAsync(key, function(old)
		local members = if old then table.clone(old) else {}
		local n = 0
		for _ in members do
			n += 1
		end
		local member = tostring(id)
		if not members[member] and n >= 6 then
			return nil
		end
		members[member] = math.max(members[member] or 0, math.min(50, points))
		return members
	end)
	if not result then
		return nil
	end
	local total = 0
	for _, v in result do
		total += v
	end
	return total
end
return Profiles
