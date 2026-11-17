--!strict
-- What the town's robot residents say. Authored text only.
-- Tips name real places and things to do; they never use compass or left/right directions.
-- Slots: {direction} = ShowStatus.Direction (a catalogue label), {shop} = the player's
-- CarryingParcel attribute (a shop title). Use TownTalk.fill so a missing slot is skipped, not shown.
export type Resident = { tips: { string }, idle: { string } }
export type Slots = { direction: string?, shop: string? }

local TownTalk = {}

TownTalk.residents = {
	Marnie = {
		tips = {
			"Grab a parcel at the Dockside Post counter. The label says which shop it's for.",
			"Pro tip: pick up the next parcel as soon as you deliver one. Combo time!",
			"Tired legs? Hop on the Lot Line streetcar. It stops at the pier, the plaza and Signal Park.",
			"Lost? Head for the glowing DELIVERY marquee in Broadcast Plaza. Everything starts there.",
			"Deliver enough parcels and you earn the town carrier badge. Collect them all!",
			"Bakehouse parcels smell amazing. Do not open them. I am watching. Lovingly.",
			"The show is in the theatre under the big marquee. Grab a seat and vote for your favourite take.",
		},
		idle = {
			"Stamp, stamp, stamp. Best sound in the world.",
			"Another parcel? Lowkey my favourite part of the day.",
			"I've delivered so many parcels my legs have rebirthed twice.",
			"If a parcel squeaks, do not ask. Just deliver.",
			"Signature not required. Good vibes required.",
		},
	},
	Bram = {
		tips = {
			"Copper Kettle Bakehouse is just off Market Walk. Follow the smell of warm bread.",
			"At the bakehouse counter, read the order ticket and add each ingredient in order.",
			"Wrong ingredient? No stress. Check the order slip and add the one it asks for next.",
			"Serve enough orders at Copper Kettle and you earn the counter crew badge.",
			"After baking, catch Flip's show at the theatre. Comedy tastes better with a snack.",
			"The Night Market has a wrapping counter too. Dot runs it like a speedrunner.",
		},
		idle = {
			"Bread is just an obby for flour.",
			"I tried to rebirth a croissant. It came back flakier.",
			"Cinnamon is the main character. Everything else is an NPC.",
			"Fresh rolls! No cap, still warm.",
		},
	},
	Linn = {
		tips = {
			"Pocket Print Gallery has a postcard press. Pick a view, an ink and a greeting.",
			"Every postcard you print gets saved, so you can come back and show it off.",
			"Try the harbour crane view with sea glass ink. It's giving masterpiece.",
			"Print enough postcards and you earn the town printmaker badge.",
			"Need inspiration? Walk Lantern Street when the lamps glow. Best view in town.",
			"The Waterfront Pier at blue hour is basically a postcard already.",
		},
		idle = {
			"Ink on my gloves again. Worth it.",
			"Every postcard is a screenshot you can hold.",
			"I printed a gull. The gull wants credit.",
			"Midnight blue isn't a colour. It's a mood.",
		},
	},
	Reed = {
		tips = {
			"Needle Drop Records has a listening deck. Hear the sounds, then play them back in order.",
			"Clock Court has three bells you can pull. Ring all three and listen to the chime.",
			"Need a break? Clock Court has a bench with the best view of the big clock.",
			"Every record side you finish counts toward the crate digger badge.",
			"Want to play sound pads in the show? Practice a cue sheet in Studio B first.",
			"The Lot Line streetcar rings its bell at every stop. That's my favourite song.",
		},
		idle = {
			"This record goes hard. Respectfully.",
			"Bell, squeak, thump. Name a better band.",
			"I only listen to lobby music on vinyl.",
			"Rare record found. Aura increased.",
		},
	},
	Capstan = {
		tips = {
			"Work the buoy crane on the Waterfront Pier. Reel the moment the buoy lamp flashes.",
			"Buoy Watch sends three signals. Watch the lamp, not the gulls.",
			"Reeled too early? Wait for the flash. Patience is a skill, not an issue.",
			"The Lot Line streetcar stops at the pier. Ride it to Broadcast Plaza for the show.",
			"Best sunset in town is from this pier. Touch grass? Touch boardwalk.",
			"The gulls here are loud. The buoy lamp is quiet. Trust the lamp.",
		},
		idle = {
			"Gulls again. They think they're admins.",
			"The sea never lags. Respect.",
			"Reel, wait, reel. That's the whole job. I love it.",
			"One day I'll reel in the moon. Just watch.",
		},
	},
	Pip = {
		tips = {
			"Start Signal Run at the bandstand. Run through every marked arch, then come back here.",
			"Signal Run is timed. Plan your path between the arches like a speedrunner.",
			"Missed an arch? The clock keeps going. Find it and keep moving.",
			"The Lot Line stops at Signal Park. Ride it to the plaza when you're done running.",
			"Warm up on the bandstand steps first. Stretch those pixels!",
			"Beat your Signal Run time, then go brag about it at Flip's show.",
		},
		idle = {
			"I don't walk. I speedrun.",
			"Personal best today: almost.",
			"Arches, arches, bandstand. Repeat.",
			"Out of breath, but the aura is worth it.",
		},
	},
	Dot = {
		tips = {
			"Take an order at the Night Market wrapping counter, then find the two supply stalls.",
			"Use the customer's stamp on the parcel before you hand it in.",
			"Wrap Counter orders are timed. Grab the supplies first, then come straight back.",
			"The Night Market looks best when the lanterns glow. Come wander.",
			"Want more to do? Ring the Clock Court bells, try Signal Run or work the buoy crane.",
			"Flip's show runs in the theatre all night. Sit in the audience and vote for the best take.",
		},
		idle = {
			"Ribbon, paper, stamp. Perfect combo.",
			"I've wrapped so many gifts I dream in bows.",
			"No order too small. Except that one. That one was tiny.",
			"Wrapped it so fast the ribbon lagged.",
		},
	},
} :: { [string]: Resident }

-- Said by any resident when a show is about to start (ShowStatus.Phase == "lineup").
TownTalk.lineup = {
	"Flip's on soon! Saving you a seat.",
	"Showtime! Everyone to the theatre. The curtain is loading.",
	"The marquee is blinking. That means a show is starting!",
	"Quick, the show's starting! Last one in sits behind the tall hat.",
	"Flip's warming up. I can hear the squeak from here.",
	"Show time in Broadcast Plaza! Front row is first come, first served.",
	"Someone's about to perform. Let's be the best audience ever.",
	"The theatre doors are open. Bring your best vote.",
	"The lineup is forming! Grab a seat before the spotlight does.",
}

-- Said after a top-band score (ShowStatus.LastBand == 3). {direction} is optional.
TownTalk.encore = {
	"Did you hear that? {direction}, perfectly done!",
	"Encore! The whole town felt that one.",
	"That was a main character performance. I'm still clapping.",
	"{direction}! Legendary. Even the gulls agree.",
	"Standing ovation from the street. That was a W.",
	"Someone just aced {direction}. The whole town is buzzing.",
	"That score has aura. I'm telling everyone.",
	"Best take tonight. No cap.",
	"Flip is beeping with joy. That means a top score!",
}

-- Said to a player carrying a parcel (player attribute CarryingParcel ~= ""). {shop} is optional.
TownTalk.parcel = {
	"Ooh, a parcel! Is that one for {shop}?",
	"Careful with that one. It's giving fragile.",
	"Delivery in progress! Go, go, go!",
	"That parcel's for {shop}. You've got this.",
	"Nice parcel. Very main character of you.",
	"Speedrun that delivery. I believe in you.",
	"Don't shake it. Okay, maybe a little.",
}

-- Replaces each {slot}; returns nil when a needed slot is missing, so callers pick another line.
function TownTalk.fill(template: string, slots: Slots?): string?
	local missing = false
	local values = (slots or {}) :: any
	local text = string.gsub(template, "{(%a+)}", function(name: string): string
		local value = values[name]
		if type(value) ~= "string" or #value == 0 or #value > 40 or string.find(value, "[{}]") then
			missing = true
			return ""
		end
		return value
	end)
	if missing then
		return nil
	end
	return text
end

-- Picks the line at `index` (wrapping), skipping any whose slots cannot be filled.
function TownTalk.pick(list: { string }, index: number, slots: Slots?): string?
	for offset = 0, #list - 1 do
		local text = TownTalk.fill(list[(index + offset - 1) % #list + 1], slots)
		if text then
			return text
		end
	end
	return nil
end

return TownTalk
