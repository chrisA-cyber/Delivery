--!strict
local HostLines = {}
local book = {
	pads = {
		"Cue the squeak. Somebody get that bell an agent.",
		"The sound booth turned a little scene into a very big noise.",
	},
	padsMiss = { "Three cues, one more try. Watch for the first bell." },
	house = {
		"The house has read the card. The jury has the good chairs.",
		"That was our rehearsal. Somebody give the cue card a dressing room.",
		"Our stage manager would like the last word back.",
	},
	miss = {
		"The words missed their entrance. There's another seat with this take on it.",
		"That mic needs a second audition. The room can still call this one.",
	},
	mishear = {
		"The caption took a scenic route through that sentence.",
		"A few words found their own exit. The bit stayed on stage.",
		"The cue card and the captions would like separate dressing rooms.",
	},
	quiet = { "That whisper made the front row lean in.", "Even the footlights kept quiet for that one." },
	pace = {
		"The words caught the express elevator.",
		"That sentence made it backstage before the curtain did.",
	},
	pause = { "That pause had time to pull up a chair.", "The silence got a speaking part." },
	clear = {
		"Every word found its mark. The cue card can go home early.",
		"The cue card would like that reading framed.",
	},
	ordinary = {
		"The card has spoken. The chairs have opinions.",
		"Let's see what the back row made of that ending.",
		"The curtain heard the bit. Now it wants the numbers.",
	},
}
function HostLines.options(house: boolean, claim, measure: string)
	if house then
		return "house", book.house
	end
	if measure == "pads" then
		return if claim then "pads" else "padsMiss", if claim then book.pads else book.padsMiss
	end
	if not claim then
		return "miss", book.miss
	end
	if claim.accuracy and claim.accuracy < 80 then
		return "mishear", book.mishear
	end
	if claim.commitment and claim.commitment >= 75 then
		if measure == "quiet" then
			return "quiet", book.quiet
		end
		if measure == "fast" then
			return "pace", book.pace
		end
		if measure == "pause" then
			return "pause", book.pause
		end
	end
	if claim.accuracy == 100 then
		return "clear", book.clear
	end
	return "ordinary", book.ordinary
end
function HostLines.choose(options: { string }, turn: number, generated: any): string
	if type(generated) == "string" then
		local index = string.match(generated, "^%s*([1-3])%s*$")
		if index and options[tonumber(index) :: number] then
			return options[tonumber(index) :: number]
		end
	end
	return options[(turn - 1) % #options + 1]
end
return HostLines
