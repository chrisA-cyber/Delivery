--!strict
-- Sound booth: each scene is a tiny Bell / Squeak / Thump story; the three cue sheets replay it in a different order.
-- About a third of the scenes happen in town (tram, bakehouse, post office, record shop, pier, Clock Court, gallery).
local Foley = {}
local scenes = {
	{
		id = "lift",
		text = "The elevator dinged. The doors squeaked. An entire obby fell out.",
		pack = "Sound booth",
	},
	{
		id = "respawn",
		text = "The checkpoint chimed. My sneakers squeaked on the lava edge. Thump, back to spawn.",
		pack = "Sound booth",
	},
	{
		id = "tycoon",
		text = "The tycoon bell rang. The conveyor squeaked. A whole pizza landed on my head.",
		pack = "Sound booth",
	},
	{
		id = "egg",
		text = "The egg timer dinged. The shell squeaked open. A very round pet flopped out.",
		pack = "Sound booth",
	},
	{
		id = "clock",
		text = "The alarm rang. I tiptoed across a squeaky floor. My backpack landed first.",
		pack = "Sound booth",
	},
	{
		id = "bus",
		text = "My stop rang. The bus doors squeaked. My very tall hat hit the roof.",
		pack = "Sound booth",
	},
	{
		id = "admin",
		text = "The admin rang a bell. I squeaked into a rubber duck. Then I flopped off the stage.",
		pack = "Sound booth",
	},
	{
		id = "boss",
		text = "The boss bell tolled. The giant gate creaked open. A tiny boss landed with a thump.",
		pack = "Sound booth",
	},
	{
		id = "dinner",
		text = "Mom rang the dinner bell. My gaming chair squeaked. I thumped down every stair.",
		pack = "Sound booth",
	},
	{
		id = "pet",
		text = "My pet's collar jingled. The pet door squeaked. Something large landed on the sofa.",
		pack = "Sound booth",
	},
	{
		id = "glitch",
		text = "The update bell chimed. The wall squeaked open. I dropped straight under the map.",
		pack = "Sound booth",
	},
	{
		id = "sleepover",
		text = "The doorbell rang at the sleepover. Six sleeping bags squeaked. The pizza hit the floor.",
		pack = "Sound booth",
	},
	{
		id = "tram",
		text = "The Lot Line bell clanged. The tram brakes squeaked. A suitcase tumbled off the roof.",
		pack = "Sound booth",
	},
	{
		id = "bakery",
		text = "The Copper Kettle oven dinged. The tray squeaked out. A loaf landed with a thump.",
		pack = "Sound booth",
	},
	{
		id = "post",
		text = "The Dockside Post bell rang. The parcel chute squeaked. The stamp came down, thump.",
		pack = "Sound booth",
	},
	{
		id = "records",
		text = "The Needle Drop door bell jingled. The turntable squeaked. A crate of records dropped.",
		pack = "Sound booth",
	},
	{
		id = "pier",
		text = "The buoy bell rang. A pier gull squeaked. A fish flopped onto my hat.",
		pack = "Sound booth",
	},
	{
		id = "court",
		text = "Clock Court chimed. The bench squeaked. Everyone sat down at once with a thump.",
		pack = "Sound booth",
	},
	{
		id = "gallery",
		text = "The print press bell rang. The roller squeaked. A fresh postcard slapped the table.",
		pack = "Sound booth",
	},
	{
		id = "marquee",
		text = "The marquee bell rang. The theatre door squeaked. Flip tripped onto the stage.",
		pack = "Sound booth",
	},
}
local sheets = {
	{
		id = "foley-classic",
		label = "Cartoon combo",
		text = "Bell, then squeak, then land the big thump.",
		measure = "pads",
		order = { "Bell", "Squeak", "Thump" },
	},
	{
		id = "foley-backward",
		label = "Rewind",
		text = "Start on the thump and rewind all the way to the bell.",
		measure = "pads",
		order = { "Thump", "Squeak", "Bell" },
	},
	{
		id = "foley-reprise",
		label = "Squeak sandwich",
		text = "Squeak, thump, then squeak again for the double take.",
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
