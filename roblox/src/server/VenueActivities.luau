--!strict
-- Private jobs and practice takes use monotonic server timestamps, separately from the public show.
local Activities = {}
local routes = {
	{ "Bell", "Lantern", "Hat" },
	{ "Hat", "Lantern", "Bell" },
	{ "Lantern", "Bell", "Hat" },
	{ "Bell", "Hat", "Lantern" },
	{ "Hat", "Bell", "Lantern" },
	{ "Lantern", "Hat", "Bell" },
}
function Activities.new()
	return {
		room = "lobby",
		watching = false,
		revision = 0,
		openRevision = 0,
		run = 0,
		notice = "Welcome to Broadcast Plaza! The show's on through the gold doors — or wander the town.",
		look = "house",
	}
end
function Activities.open(v, room, watching)
	v.room = room
	v.watching = watching
	v.open = room
	v.openRevision += 1
	if v.practice and v.practice.status == "playing" and room ~= "studio" then
		v.practice.status = "cancelled"
		v.notice = "Practice stopped. Start a new cue sheet in Studio B."
	end
end
function Activities.startPractice(v, foley, now)
	if v.practice and v.practice.status == "playing" then
		return false
	end
	v.run += 1
	local line, sheets = foley.card(v.run)
	local cue = sheets[(v.run - 1) % #sheets + 1]
	local sheet = foley.sheet(cue)
	sheet.title = cue.label
	sheet.story = line.text
	sheet.started = now
	sheet.deadline = now + 10
	sheet.run = v.run
	sheet.status = "playing"
	v.practice = sheet
	v.notice = "Watch each cue. Tap its sound at the mark."
	return true
end
function Activities.finishPractice(v, foley, now)
	local p = v.practice
	if
		not p
		or p.status ~= "playing"
		or (now < p.deadline and not (p.hits["1"] and p.hits["2"] and p.hits["3"]))
	then
		return nil
	end
	local result = foley.tally(p)
	p.status = "done"
	p.finished = now
	p.score = math.round((result.accuracy + result.commitment) / 2)
	p.correct = result.hits
	p.perfect = result.perfect
	p.xp = result.hits + result.perfect
	v.notice = string.format("Drill complete · %d/3 cues · +%d stage XP.", result.hits, p.xp)
	return p
end
function Activities.pad(v, foley, arg, now)
	local p = v.practice
	if not p or p.status ~= "playing" or arg.run ~= p.run or now >= p.deadline then
		return false
	end
	return foley.play(p, arg, now - p.started)
end
function Activities.startJob(v, now)
	if v.job and v.job.status == "active" then
		return false
	end
	v.run += 1
	v.job = {
		run = v.run,
		status = "active",
		order = routes[(v.run - 1) % #routes + 1],
		picked = 0,
		lastAt = now,
		xp = 0,
	}
	v.notice = "Dispatch ticket printed. Find the marked props in order."
	return true
end
function Activities.collect(v, run, prop, near, now)
	local j = v.job
	if not j or j.status ~= "active" or j.run ~= run or j.picked >= #j.order then
		return false
	end
	if prop ~= j.order[j.picked + 1] then
		v.notice = "Next on the ticket: " .. j.order[j.picked + 1] .. "."
		return false
	end
	if not near or now - j.lastAt < 0.35 then
		v.notice = "Walk up to the " .. prop .. " station."
		return false
	end
	j.lastAt = now
	j.picked += 1
	v.notice = if j.picked == #j.order
		then "All props packed. Return to the dispatch desk."
		else "Packed " .. prop .. ". Find the " .. j.order[j.picked + 1] .. "."
	return true
end
function Activities.deliver(v, run, near, now)
	local j = v.job
	if
		not j
		or j.run ~= run
		or j.status ~= "active"
		or j.picked ~= #j.order
		or not near
		or now - j.lastAt < 0.35
	then
		return false
	end
	j.status = "done"
	j.xp = 5
	v.notice = "Props delivered · +5 crowd XP. Cherry cue stand unlocked."
	return true
end
return Activities
