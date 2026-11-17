--!strict
-- Content checks for every authored string: run with ./.tools/lune.exe run tests/content
local Catalogue = require("../src/shared/Catalogue")
local HostLines = require("../src/shared/HostLines")
local Foley = require("../src/shared/Foley")
local Modes = require("../src/shared/Modes")
local ShopCatalogue = require("../src/shared/ShopCatalogue")
local TownTalk = require("../src/shared/TownTalk")

local passed = 0
local function test(name: string, fn: () -> ())
	fn()
	passed += 1
	print("PASS", name)
end

-- Whole words (after lowercasing and splitting on anything that is not a letter or apostrophe).
local bannedWords = {}
for _, word in
	string.split(
		"fuck shit bitch bastard ass damn dammit hell heck dang darn crap frick freaking piss wtf omg stfu bloody suck sucks "
			.. "sex sexy crush flirt flirty romance romantic date dates dating boyfriend girlfriend kiss kissed kissing "
			.. "married marry marriage wedding lover valentine rizz gyatt naked nude naughty "
			.. "kill killed killing kills murder dead die died dies dying death suicide gun guns shoot shooting shot stab "
			.. "blood bloody bomb knife knives weapon weapons fight fighting punch punched explode exploded explosion war "
			.. "attack hurt torture hostage terror grave corpse zombie "
			.. "drug drugs weed vape vaping smoke smoking cigarette beer wine drunk alcohol vodka "
			.. "gamble gambling casino bet betting lottery jackpot poker robux scam scammer hack hacker hacks exploit "
			.. "password discord snapchat tiktok youtube instagram twitch whatsapp telegram "
			.. "stupid idiot dumb loser ugly retard retarded "
			.. "poop fart pee toilet butt booty vomit puke diaper "
			.. "god jesus church pray religion president election politics "
			.. "roblox brookhaven bloxburg jailbreak arsenal minecraft fortnite skibidi fanum ohio sigma mewing "
			.. "tung sahur tralalero bombardiro crocodilo mrbeast",
		" "
	)
do
	if word ~= "" then
		bannedWords[word] = true
	end
end
local bannedPhrases = {
	"free robux",
	"real money",
	"credit card",
	"phone number",
	"home address",
	"your address",
	"real name",
	"how old are you",
	"what school",
	"where do you live",
	"dm me",
	"add me",
	"adopt me",
	"grow a garden",
	"pet simulator",
	"blox fruits",
	"among us",
	"murder mystery",
	"self harm",
	"slot machine",
	"shut up",
}

local function problem(text: string): string?
	local lower = " " .. string.gsub(string.lower(text), "[^%a']+", " ") .. " "
	for word in string.gmatch(lower, "[%a']+") do
		local bare = string.gsub(word, "'s$", "")
		if bannedWords[word] or bannedWords[bare] then
			return word
		end
	end
	for _, phrase in bannedPhrases do
		if string.find(lower, " " .. phrase .. " ", 1, true) then
			return phrase
		end
	end
	if string.find(text, "%d") or string.find(string.lower(text), "http", 1, true) then
		return "digits or links"
	end
	return nil
end

local function strings(value: any, out: { string }, seen: { [any]: boolean }?): { string }
	local visited = seen or {}
	if type(value) == "string" then
		table.insert(out, value)
	elseif type(value) == "table" and not visited[value] then
		visited[value] = true
		for key, child in value do
			if key ~= "id" then
				strings(child, out, visited)
			end
		end
	end
	return out
end

local function words(text: string): number
	local n = 0
	for _ in string.gmatch(text, "%S+") do
		n += 1
	end
	return n
end

test("catalogue sizes, packs and measures", function()
	assert(#Catalogue.lines >= 160, "at least 160 lines, got " .. #Catalogue.lines)
	assert(#Catalogue.directions >= 40, "at least 40 directions, got " .. #Catalogue.directions)
	local packs, packCount = {}, 0
	local ids, texts = {}, {}
	for _, line in Catalogue.lines do
		assert(not ids[line.id], "repeated id " .. line.id)
		ids[line.id] = true
		assert(not texts[string.lower(line.text)], "repeated line " .. line.text)
		texts[string.lower(line.text)] = true
		local n = words(line.text)
		assert(n >= 6 and n <= 18, "line length: " .. line.text)
		assert(type(line.pack) == "string" and line.pack ~= "", "line has a pack")
		local noun = (line :: any).noun
		if noun ~= nil then
			assert(
				string.find(string.lower(line.text), string.lower(noun), 1, true) and words(noun) <= 3,
				"noun must come from its line: " .. noun
			)
		end
		if not packs[line.pack] then
			packs[line.pack] = 0
			packCount += 1
		end
		packs[line.pack] += 1
	end
	assert(packCount >= 6 and packCount <= 8, "six to eight packs")
	for _, featured in { "Spawn Point", "Checkpoint Drama", "Tycoon Problems", "Control Room", "Backstage" } do
		assert((packs[featured] or 0) >= 8, "Pack night needs a full " .. featured .. " pack")
	end
	local measures = {}
	for _, cue in Catalogue.directions do
		assert(not ids[cue.id], "repeated id " .. cue.id)
		ids[cue.id] = true
		assert(words(cue.label) <= 3, "short label: " .. cue.label)
		assert(not string.find(cue.text, "[%.!?]%s"), "one-sentence instruction: " .. cue.text)
		measures[cue.measure] = (measures[cue.measure] or 0) + 1
	end
	for _, measure in { "quiet", "pause", "slow", "fast", "rise", "fall", "crowd" } do
		assert((measures[measure] or 0) > 0, "measure in use: " .. measure)
	end
	local known = 0
	for measure, count in measures do
		assert(table.find({ "quiet", "pause", "slow", "fast", "rise", "fall", "crowd" }, measure), measure)
		known += count
	end
	assert(measures.crowd <= 0.4 * known, "crowd directions stay at or under forty percent")
end)

test("no banned words in any authored text", function()
	local sources = {
		Catalogue = Catalogue,
		HostLines = HostLines.book,
		Foley = { Foley.card(1) },
		Modes = { Modes.setups, Modes.ends, Modes.switchCues },
		ShopCatalogue = ShopCatalogue,
		TownTalk = TownTalk,
	}
	local checked = 0
	for name, source in sources do
		for _, text in strings(source, {}) do
			local hit = problem(text)
			assert(not hit, name .. " contains '" .. tostring(hit) .. "': " .. text)
			checked += 1
		end
	end
	for turn = 1, 40 do
		local scene = Foley.card(turn)
		assert(not problem(scene.text), "Foley scene: " .. scene.text)
	end
	for i = 1, 9 do
		local card = Modes.mix(i)
		local n = words(card.text)
		assert(n >= 10 and n <= 18 and not problem(card.text), "custom card: " .. card.text)
	end
	for turn = 1, 8 do
		local s = { mode = "Switch", turn = turn }
		Modes.card(s, nil)
		assert(not problem(s.line.text) and words(s.line.text) <= 4, "switch phrase: " .. s.line.text)
	end
	assert(problem("what the hell") and problem("free robux") and problem("a dating game"), "screen catches")
	assert(not problem("shell hello update screenshot"), "screen respects whole words")
	assert(checked > 400, "screened every string")
end)

local fullSlots: HostLines.Slots =
	{ direction = "Admin announcement", noun = "villain origin story", pack = "Checkpoint Drama" }

test("every host bucket is non-empty and every slot fills", function()
	local total = 0
	for category, options in HostLines.book do
		assert(#options >= 6, category .. " needs at least six lines")
		total += #options
		for _, template in options do
			assert(#template > 5 and #template <= 100, "host line length: " .. template)
			for name in string.gmatch(template, "{(%a+)}") do
				assert(name == "direction" or name == "noun" or name == "pack", "unknown slot " .. name)
			end
			local filled = HostLines.fill(template, fullSlots)
			assert(filled and not string.find(filled, "[{}]") and #filled <= 130, "slot fill: " .. template)
			if string.find(template, "{", 1, true) then
				assert(HostLines.fill(template, {}) == nil, "missing slot is refused: " .. template)
			end
		end
	end
	assert(total >= 90, "Flip needs at least ninety lines, has " .. total)
	assert(#HostLines.book.pads >= 8 and #HostLines.book.padsMiss >= 8, "sound booth verdicts")
	local reached = {}
	for _, house in { true, false } do
		for _, measure in { "pads", "quiet", "fast", "pause", "slow", "rise", "fall", "crowd" } do
			for _, claim in
				{
					false,
					{ accuracy = 0, commitment = 0 },
					{ accuracy = 60, commitment = 80 },
					{ accuracy = 85, commitment = 80 },
					{ accuracy = 100, commitment = 40 },
					{ accuracy = 100, commitment = 95 },
				}
			do
				local category, options = HostLines.options(house, claim or nil, measure)
				assert(options == HostLines.book[category], "bucket table matches its name")
				reached[category] = true
			end
		end
	end
	for category in HostLines.book do
		assert(reached[category], "bucket is reachable: " .. category)
	end
end)

test("shuffle bag never repeats within a bucket before it is exhausted", function()
	for _, key in { "a", "b", "host/1731801600" } do
		local draw = HostLines.bag(key)
		for category, options in HostLines.book do
			local previous: string? = nil
			for cycle = 1, 3 do
				local seen = {}
				for i = 1, #options do
					local text = draw(category, options, fullSlots)
					assert(not seen[text], category .. " repeated before exhaustion: " .. text)
					assert(not string.find(text, "[{}]"), "bag returns filled text")
					if i == 1 and cycle > 1 then
						assert(text ~= previous, category .. " refill opens with the line that just played")
					end
					seen[text] = true
					previous = text
				end
			end
		end
	end
	-- With no slot data (e.g. a mode card), slotted templates are skipped and nothing leaks a brace.
	local draw = HostLines.bag("bare")
	for category, options in HostLines.book do
		local seen = {}
		for _ = 1, #options * 2 do
			local text = draw(category, options, {})
			assert(not string.find(text, "[{}]"), "unfilled slot reached the stage: " .. text)
			seen[text] = (seen[text] or 0) + 1
		end
	end
	local slots = HostLines.slots({
		cue = { label = "Lag spike" },
		line = { id = "rb-000000000000", text = "x", pack = "Control Room", noun = "ping" },
	})
	assert(slots.direction == "Lag spike" and slots.noun == "ping" and slots.pack == "Control Room", "slots")
	local mode =
		HostLines.slots({ cue = { label = "Four cues" }, line = { id = "switch-1", pack = "Switch" } })
	assert(mode.direction == "Four cues" and mode.noun == nil and mode.pack == nil, "mode cards fill no pack")
end)

test("sound booth scenes and cue sheets", function()
	local _, sheets = Foley.card(1)
	assert(#sheets == 3, "three cue sheets")
	local ids, town = {}, 0
	local turn = 1
	while true do
		local scene = Foley.card(turn)
		if ids[scene.id] then
			break
		end
		ids[scene.id] = true
		assert(scene.pack == "Sound booth" and words(scene.text) <= 18, "scene shape: " .. scene.id)
		for _, place in
			{
				"Lot Line",
				"Copper Kettle",
				"Dockside Post",
				"Needle Drop",
				"pier",
				"Clock Court",
				"print press",
				"marquee",
			}
		do
			if string.find(scene.text, place, 1, true) then
				town += 1
				break
			end
		end
		turn += 1
	end
	assert(turn - 1 >= 18, "at least eighteen scenes")
	assert(town * 3 >= turn - 1, "a third of the scenes are in town")
	for _, sheet in sheets do
		assert(#sheet.order == 3 and sheet.measure == "pads" and words(sheet.label) <= 3, sheet.id)
	end
end)

test("town talk tables", function()
	local compass = { "west", "east", "north", "south", "left", "right", "northwest", "southeast" }
	for _, name in { "Marnie", "Bram", "Linn", "Reed", "Capstan", "Pip", "Dot" } do
		local resident = TownTalk.residents[name]
		assert(resident, name .. " has lines")
		assert(#resident.tips >= 6 and #resident.idle >= 4, name .. " needs six tips and four idle barks")
		for _, tip in resident.tips do
			for word in string.gmatch(string.lower(tip), "%a+") do
				assert(not table.find(compass, word), name .. " gives a compass direction: " .. tip)
			end
			assert(#tip <= 110, "tip fits a speech bubble: " .. tip)
		end
	end
	assert(#TownTalk.lineup >= 8 and #TownTalk.encore >= 8 and #TownTalk.parcel >= 6, "shared tables")
	for _, list in { TownTalk.lineup, TownTalk.encore, TownTalk.parcel } do
		for i = 1, #list do
			local text = TownTalk.pick(list, i, { direction = "Boss intro", shop = "Needle Drop Records" })
			assert(text and not string.find(text, "[{}]"), "town slot fill")
			local bare = TownTalk.pick(list, i, nil)
			assert(bare and not string.find(bare, "[{}]"), "town line without slots")
		end
	end
	assert(TownTalk.fill("For {shop}?", {}) == nil, "missing shop is refused")
end)

test("shop text keeps its structure", function()
	assert(
		#ShopCatalogue.parcels == 6 and #ShopCatalogue.records == 6 and #ShopCatalogue.recipes == 6,
		"counts"
	)
	for _, parcel in ShopCatalogue.parcels do
		assert(ShopCatalogue.shops[parcel.recipient] and #parcel.label <= 44, parcel.label)
	end
	assert(#ShopCatalogue.palette == 3 and #ShopCatalogue.layers == 3, "postcard layers")
	for _, choices in ShopCatalogue.palette do
		assert(#choices == 3, "three choices per postcard layer")
	end
end)

print(passed .. " content checks passed")
