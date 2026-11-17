--!strict
-- Flip's verdict book. Every line is authored here; slots are filled only from catalogue text
-- (the direction label, the line's tagged noun, the pack name), never from a speech transcript.
-- Slots: {direction} = the chosen direction's label, {noun} = the card's tagged noun, {pack} = the card's pack.
local HostLines = {}

export type Slots = { direction: string?, noun: string?, pack: string? }

local book: { [string]: { string } } = {
	pads = {
		"Cue the squeak. Somebody get that bell an agent.",
		"Bell, squeak, thump. Cartoon physics fully restored.",
		"That thump landed so clean the floor asked for an encore.",
		"{direction}, performed live. The sound booth is shaking.",
		"Those pads had more timing than my Wi-Fi ever will.",
		"Sound booth W. That squeak goes straight into the hall of fame.",
		"No mic, all aura. That's how you work a sound booth.",
		"That bell rang so true the tram stopped to listen.",
		"Every cue on its mark. One cartoon, successfully delivered.",
		"{direction}? Nailed it. The thump wants your autograph.",
		"The booth lights are flashing. That squeak had main character energy.",
	},
	padsMiss = {
		"Three cues, one more try. Watch for the first bell.",
		"The pads stayed quiet. Even the squeak is waiting for you.",
		"The sound booth went AFK. Tap the bell when it glows.",
		"No hits that time. Bell first, then let the rest follow.",
		"The thump is still in the box. Retry and set it free.",
		"Quiet booth. The cartoon is frozen mid-jump, waiting on you.",
		"That round buffered. Watch for the glow, then tap the pad.",
		"The squeak missed its cue. It wants a rematch.",
		"{direction} is still waiting backstage. One more take?",
	},
	house = {
		"That was the house act. Your turn is one tap away.",
		"The house has read the card. Now the stage wants a real player.",
		"I did that one myself. Imagine what a human could do.",
		"Robot reading complete. Emotional range: one battery bar.",
		"That was me, Flip. Please rate me gently. I run on feelings.",
		"House reading done. The stage is open and so is the spotlight.",
		"I practiced that in an empty theatre. It showed.",
		"The house read it as {direction}. Your turn to top that.",
		"Our stage manager would like the last word back.",
		"That was the warm-up. The cue card is looking for its main character.",
	},
	miss = {
		"The words missed their entrance. The retake is on the house.",
		"No words came through. Even the NPCs leaned in for nothing.",
		"The mic went AFK. Tap retake and we'll run it again.",
		"A silent take. Bold choice. Let's try one with sound.",
		"The words lagged out. The stage is holding your checkpoint.",
		"Nothing reached the booth. Your spot in the spotlight is saved.",
		"That mic needs a second audition. The room can still call this one.",
		"The card was ready. The words were still loading. One more go?",
	},
	mishear = {
		"The caption took a scenic route through that sentence.",
		"A few words glitched through a wall. The bit stayed on stage.",
		"The captions heard a remix. Honestly, kind of a banger.",
		"Some words respawned in a different order. The vibe survived.",
		"That line had lag, but the delivery had aura.",
		"The captions are confused. The crowd is not. Keep going.",
		"A couple of words went AFK. The {noun} held it together.",
		"Close enough for the back row. The cue card is squinting.",
		"Plot twist: you wrote a new line. The writers' room is nervous.",
	},
	quiet = {
		"That whisper made the front row lean in.",
		"So quiet even the sleeping pets stayed asleep.",
		"Library mode activated. Nobody's parents woke up.",
		"Even the footlights kept quiet for that one.",
		"Stealth level cleared. Not one footstep heard.",
		"Whisper W. I'll say it quietly too: wow.",
		"{direction}, perfectly hushed. The balcony had to lip read.",
		"So soft the tram bell apologized for ringing.",
	},
	pace = {
		"The words caught the express elevator.",
		"That line had a speed coil equipped.",
		"Speedrun complete. The words beat the timer.",
		"That sentence made it backstage before the curtain did.",
		"So fast the captions asked for a rematch.",
		"Any percent, no glitches. Clean speedrun.",
		"{direction} at full speed. The tram is jealous.",
		"Faster than a rejoin. Respect.",
	},
	pause = {
		"That pause had time to pull up a chair.",
		"The silence got a speaking part.",
		"That pause loaded like a big update. Worth the wait.",
		"A perfect lag spike. The stage froze on purpose for once.",
		"That dramatic pause was so good the curtain checked its ping.",
		"Everyone held their breath. Then you delivered.",
		"{direction}, with a pause you could park a tram in.",
		"That beat of silence had main character energy.",
	},
	shape = {
		"{direction}, exactly as written. The cue card is framing it.",
		"That voice went exactly where the card pointed.",
		"Every word took the right path. No shortcuts, no lava.",
		"You followed that direction like a trail of checkpoints.",
		"Loud, soft or slow, you steered it. Smooth controls.",
		"That delivery had a whole story arc, intro to finale.",
		"{direction}, unlocked. The balcony felt that one.",
		"The volume knob in the booth just gave you a thumbs up.",
	},
	clear = {
		"Every word found its mark. The cue card can go home early.",
		"The cue card would like that reading framed.",
		"Word perfect. The captions didn't even need to try.",
		"Zero typos, out loud. That's a rare drop.",
		"Clean read. The {noun} bit has never sounded better.",
		"Every word landed right on its checkpoint.",
		"Flawless captions. The writers' room is crying happy tears.",
		"That read was so clean the stage got a polish.",
		"{direction}, word for word. Not a single glitch.",
	},
	encore = {
		"Encore! The string lights are already blinking for you.",
		"That's a standing ovation from a robot. My circuits are clapping.",
		"Legendary drop. Somebody tell the whole town.",
		"{direction}, perfectly delivered. That one goes in the hall of fame.",
		"The gulls on the pier just did a little dance.",
		"Main character event. The marquee is jealous.",
		"Nobody has ever delivered the {noun} like that.",
		"Full aura. The whole theatre is going to talk about this one.",
	},
	ordinary = {
		"The card has spoken. The chairs have opinions.",
		"Let's see what the back row made of that ending.",
		"The curtain heard the bit. Now it wants the numbers.",
		"Solid take. The scoreboard is doing its loading spin.",
		"Delivered, as promised. No signature required.",
		"That was a take. A real one. The crowd is deciding.",
		"The {pack} pack thanks you for your service.",
		"Decent run. Nobody touched the lava.",
		"The ballots are in. Even the NPCs voted.",
		"{direction}, received loud and clear. Mostly clear.",
		"That's going in the show notes, somewhere near the top.",
		"The crowd has the data. Let's see if it was a W.",
	},
}
HostLines.book = book

local reshaped = { rise = true, fall = true, slow = true }

-- Picks the bucket for a take. `claim` is the server's measured take, or nil when nothing landed.
function HostLines.options(house: boolean, claim, measure: string): (string, { string })
	if house then
		return "house", book.house
	end
	if measure == "pads" then
		if claim and (claim.accuracy or 0) > 0 then
			return "pads", book.pads
		end
		return "padsMiss", book.padsMiss
	end
	if not claim then
		return "miss", book.miss
	end
	if claim.accuracy and claim.accuracy < 80 then
		return "mishear", book.mishear
	end
	if claim.commitment and claim.commitment >= 90 and claim.accuracy and claim.accuracy >= 95 then
		return "encore", book.encore
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
		if reshaped[measure] then
			return "shape", book.shape
		end
	end
	if claim.accuracy == 100 then
		return "clear", book.clear
	end
	return "ordinary", book.ordinary
end

-- Deterministic fallback by turn, also used to resolve a generated digit. Returns the raw template.
function HostLines.choose(options: { string }, turn: number, generated: any): string
	if type(generated) == "string" then
		local index = string.match(generated, "^%s*([1-3])%s*$")
		if index and options[tonumber(index) :: number] then
			return options[tonumber(index) :: number]
		end
	end
	return options[(turn - 1) % #options + 1]
end

local function clean(value: any): string?
	if type(value) ~= "string" or #value == 0 or #value > 40 or string.find(value, "[{}]") then
		return nil
	end
	return value
end

-- Reads slot values from controlled show state only: the chosen cue, the card's noun and pack.
function HostLines.slots(s): Slots
	local cue = if type(s) == "table" then s.cue else nil
	local line = if type(s) == "table" then s.line else nil
	local catalogued = type(line) == "table"
		and type(line.id) == "string"
		and string.sub(line.id, 1, 3) == "rb-"
	return {
		direction = if type(cue) == "table" then clean(cue.label) else nil,
		noun = if catalogued then clean(line.noun) else nil,
		pack = if catalogued then clean(line.pack) else nil,
	}
end

-- Fills every {slot}; returns nil when the template needs a slot this take does not have.
function HostLines.fill(template: string, slots: Slots): string?
	local missing = false
	local text = string.gsub(template, "{(%a+)}", function(name: string): string
		local value = (slots :: any)[name]
		if type(value) ~= "string" then
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

local function seedOf(key: string): number
	local value = 7
	for i = 1, #key do
		value = (value * 131 + string.byte(key, i)) % 2147483647
	end
	return math.max(1, value)
end

-- A shuffle bag per bucket: no template repeats until its bucket is used up, and a refill never
-- opens with the line that closed the previous round. Templates whose slots cannot be filled are
-- passed over (they count as drawn) so the bag never stalls.
function HostLines.bag(key: string)
	local random = seedOf(key)
	local pools: { [string]: { number } } = {}
	local last: { [string]: number } = {}
	local function refill(category: string, size: number)
		local pool = table.create(size, 0)
		for i = 1, size do
			pool[i] = i
		end
		for i = size, 2, -1 do
			random = (random * 48271) % 2147483647
			local j = random % i + 1
			pool[i], pool[j] = pool[j], pool[i]
		end
		if size > 1 and pool[size] == last[category] then
			pool[1], pool[size] = pool[size], pool[1]
		end
		pools[category] = pool
		return pool
	end
	return function(category: string, options: { string }, slots: Slots): string
		for _ = 1, 2 * #options + 1 do
			local pool = pools[category]
			if not pool or #pool == 0 then
				pool = refill(category, #options)
			end
			local index = table.remove(pool) :: number
			last[category] = index
			local text = options[index] and HostLines.fill(options[index], slots)
			if text then
				return text
			end
		end
		return "The card has spoken. The chairs have opinions."
	end
end

return HostLines
