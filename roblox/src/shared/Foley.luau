--!strict
-- The three cue sheets tell different versions of an authored physical gag.
local Foley = {}
local scenes = {
	{
		id = "lift",
		text = "The elevator dinged. The doors squeaked. An entire obby fell out.",
		pack = "Sound booth",
	},
	{
		id = "desk",
		text = "Someone pressed the reception bell. My chair squeaked. The desk folded itself.",
		pack = "Sound booth",
	},
	{
		id = "arcade",
		text = "I won the arcade jackpot. The prize chute squeaked. Out came another arcade.",
		pack = "Sound booth",
	},
	{
		id = "bus",
		text = "My stop rang. The bus doors squeaked. My very tall hat hit the roof.",
		pack = "Sound booth",
	},
	{
		id = "tycoon",
		text = "The tycoon rang for lunch. The conveyor squeaked. It delivered the entire break room.",
		pack = "Sound booth",
	},
	{
		id = "clock",
		text = "The alarm rang. I tiptoed across a squeaky floor. My backpack landed first.",
		pack = "Sound booth",
	},
}
local sheets = {
	{
		id = "foley-classic",
		label = "Classic cartoon",
		text = "Ring the bell, squeak, then land the thump.",
		measure = "pads",
		order = { "Bell", "Squeak", "Thump" },
	},
	{
		id = "foley-backward",
		label = "Play it backward",
		text = "Start with the thump. Rewind to the bell.",
		measure = "pads",
		order = { "Thump", "Squeak", "Bell" },
	},
	{
		id = "foley-reprise",
		label = "Double take",
		text = "Open with a squeak. Thump, then squeak again.",
		measure = "pads",
		order = { "Squeak", "Thump", "Squeak" },
	},
}
Foley.pads = { "Bell", "Squeak", "Thump" }
Foley.window = 1.15
function Foley.card(turn: number)
	return scenes[(turn - 1) % #scenes + 1], sheets
end
function Foley.sheet(cue)
	local beats = {}
	for index, pad in cue.order do
		beats[index] = { pad = pad, at = 2 + (index - 1) * 3 }
	end
	return { beats = beats, hits = {}, last = nil }
end
function Foley.play(sheet, arg, elapsed: number): boolean
	if
		type(arg) ~= "table"
		or type(arg.index) ~= "number"
		or arg.index % 1 ~= 0
		or arg.index < 1
		or arg.index > #sheet.beats
		or not table.find(Foley.pads, arg.pad)
	then
		return false
	end
	local key = tostring(arg.index)
	local beat = sheet.beats[arg.index]
	local offset = math.abs(elapsed - beat.at)
	if sheet.hits[key] or offset > Foley.window then
		return false
	end
	local correct = arg.pad == beat.pad
	local perfect = correct and offset <= 0.45
	local hit = {
		index = arg.index,
		pad = arg.pad,
		label = if perfect then "Perfect" elseif correct then "On cue" else "Off cue",
		points = if perfect then 100 elseif correct then 70 else 0,
	}
	sheet.hits[key] = hit
	sheet.last = hit
	return true
end
function Foley.tally(sheet)
	local hits, perfect, points = 0, 0, 0
	for _, hit in sheet.hits do
		if hit.points > 0 then
			hits += 1
		end
		if hit.points == 100 then
			perfect += 1
		end
		points += hit.points
	end
	return {
		attempted = next(sheet.hits) ~= nil,
		hits = hits,
		perfect = perfect,
		accuracy = math.round(100 * hits / #sheet.beats),
		commitment = math.round(points / #sheet.beats),
	}
end
return Foley
