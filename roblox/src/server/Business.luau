--!strict
local Business = {}
local function playback(r, time)
	r.started = time + 0.7
	r.listenUntil = r.started + #r.notes * r.beatGap
	r.progress = 0
	r.notice = "Listen to each labelled sound. Play the same sequence when the side ends."
end
function Business.start(v, catalog, kind, row, time, near)
	local shop = catalog.shops[kind]
	if not shop or not near or (v.business and v.business.kind == kind and v.business.status == "active") then
		return false
	end
	v.run += 1
	local r = {
		kind = kind,
		run = v.run,
		title = shop.title,
		progress = 0,
		status = "active",
		started = time,
		lastInput = time,
		xp = 0,
	}
	local count = row[shop.counter]
	if kind == "post" then
		local parcel = catalog.parcels[count % #catalog.parcels + 1]
		local recipient = catalog.shops[parcel.recipient]
		r.total = 1
		r.parcel = parcel.label
		r.recipient = recipient.title
		r.recipientId = parcel.recipient
		r.target = recipient.anchor
		r.notice = "Carry the parcel to " .. recipient.title .. ". Walk up to its marked counter."
	elseif kind == "records" then
		r.recordIndex = count % #catalog.records + 1
		local record = catalog.records[r.recordIndex]
		r.recordName = record.name
		r.notes = record.notes
		r.choices = catalog.sounds
		r.total = #record.notes
		r.beatGap = 0.75
		playback(r, time)
	elseif kind == "cafe" then
		local recipe = catalog.recipes[count % #catalog.recipes + 1]
		r.orderName = recipe.name
		r.recipe = recipe.recipe
		r.choices = recipe.choices
		r.total = #r.recipe
		r.notice = "Make the " .. r.orderName .. ". Follow the ingredients from the top of the ticket."
	else
		r.layers = catalog.layers
		r.palette = catalog.palette
		r.picks = {}
		r.total = #r.layers
		r.notice = "Choose the skyline for your postcard."
	end
	v.business = r
	v.notice = r.notice
	return true
end
local function finish(v, r, catalog, row, time)
	local shop = catalog.shops[r.kind]
	r.status = "done"
	r.finished = time
	r.progress = r.total
	r.xp = 3
	row[shop.counter] += 1
	row.badges[shop.badge] = true
	local track = if r.kind == "records" then "stage" else "crowd"
	row[track] += r.xp
	if r.kind == "records" then
		-- The completed riff becomes this player's entrance sting on their next stage turn.
		row.lastRecord = r.recordIndex
	elseif r.kind == "gallery" then
		row.postcard = catalog.encode(r.picks)
		r.print = catalog.print(row.postcard)
	end
	r.notice = if r.kind == "post"
		then "Signed for at " .. r.recipient .. "."
		elseif r.kind == "records" then "You played " .. r.recordName .. " from start to finish."
		elseif r.kind == "cafe" then r.orderName .. " is ready for pickup."
		else "Postcard printed. This design is saved in your gallery."
	v.notice = r.notice .. " +" .. r.xp .. " " .. track .. " XP."
end
function Business.delivery(v, catalog, row, time, station, near)
	local r = v.business
	if not r or r.kind ~= "post" or r.status ~= "active" or r.target ~= station or not near then
		return false
	end
	finish(v, r, catalog, row, time)
	return true
end
function Business.replay(v, run, time, near)
	local r = v.business
	if
		not r
		or r.kind ~= "records"
		or r.status ~= "active"
		or r.run ~= run
		or not near
		or time < r.listenUntil
	then
		return false
	end
	playback(r, time)
	v.notice = r.notice
	return true
end
function Business.pick(v, catalog, row, run, choice, time, near)
	local r = v.business
	if
		not r
		or r.run ~= run
		or r.status ~= "active"
		or r.kind == "post"
		or type(choice) ~= "string"
		or not near
		or time - r.lastInput < 0.14
	then
		return false
	end
	local nextIndex = r.progress + 1
	if r.kind == "records" then
		if time < r.listenUntil or not table.find(r.choices, choice) then
			return false
		end
		if choice ~= r.notes[nextIndex] then
			playback(r, time)
			r.notice = "That groove slipped. Listen to the sequence again, starting with the first sound."
			v.notice = r.notice
			return true
		end
	elseif r.kind == "cafe" then
		if not table.find(r.choices, choice) then
			return false
		end
		if choice ~= r.recipe[nextIndex] then
			r.notice = "Check the order slip. Add " .. r.recipe[nextIndex] .. " next."
			v.notice = r.notice
			return true
		end
	else
		if not table.find(r.palette[nextIndex], choice) then
			return false
		end
		table.insert(r.picks, choice)
	end
	r.lastInput = time
	r.progress = nextIndex
	if nextIndex == r.total then
		finish(v, r, catalog, row, time)
	else
		r.notice = if r.kind == "gallery"
			then "Choose your " .. string.lower(r.layers[nextIndex + 1]) .. "."
			elseif r.kind == "records" then "That sound matched. Play the next note."
			else "Added " .. choice .. ". Now add " .. r.recipe[nextIndex + 1] .. "."
		v.notice = r.notice
	end
	return true
end
return Business
