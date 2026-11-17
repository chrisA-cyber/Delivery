--!strict
local Score = {}
local numberWords = string.split(
	"zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty",
	" "
)
local contractions = {
	["i'm"] = "i am",
	["you're"] = "you are",
	["you've"] = "you have",
	["weren't"] = "were not",
	["they're"] = "they are",
	["we're"] = "we are",
	["don't"] = "do not",
	["can't"] = "cannot",
	["it's"] = "it is",
	["i've"] = "i have",
	["didn't"] = "did not",
}
local function tokens(text: string): { string }
	local words = {}
	text = string.lower(text):gsub("’", "'"):gsub("‘", "'")
	for word in text:gmatch("[%w']+") do
		for expanded in (contractions[word] or word):gmatch("[%w]+") do
			local index = table.find(numberWords, expanded)
			table.insert(words, if index then tostring(index - 1) else expanded)
		end
	end
	return words
end

function Score.accuracy(expected: string, heard: string): number?
	local target, actual = tokens(expected), tokens(heard)
	if #actual == 0 or #target == 0 then
		return nil
	end
	local prior = {}
	for j = 0, #actual do
		prior[j] = j
	end
	for i, word in target do
		local row = { [0] = i }
		for j, spoken in actual do
			row[j] = math.min(prior[j] + 1, row[j - 1] + 1, prior[j - 1] + (if word == spoken then 0 else 1))
		end
		prior = row
	end
	return math.round(100 * math.max(0, 1 - prior[#actual] / #target))
end

function Score.band(score: number): string
	if score >= 98 then
		return "Standing ovation"
	end
	if score >= 90 then
		return "Main-character event"
	end
	if score >= 75 then
		return "Certified delivery"
	end
	if score >= 60 then
		return "Committed"
	end
	if score >= 40 then
		return "Signs of life"
	end
	return "One more take"
end

function Score.result(
	accuracy: number?,
	measured: number?,
	crowdCue: boolean,
	votes: { [number]: number },
	reactionCount: number,
	audience: number
)
	local total, count = 0, 0
	for _, rating in votes do
		total += rating
		count += 1
	end
	local comedy = if count > 0 then math.round(total / count) else nil
	local commitment = if crowdCue then comedy else measured
	local chaos = if audience > 0 then math.round(100 * math.clamp(reactionCount / audience, 0, 1)) else nil
	local crowdScale = math.min(1, count / 3)
	local sum, weight = 0, 0
	local function add(value: number?, w: number)
		if value ~= nil then
			sum += value * w
			weight += w
		end
	end
	add(accuracy, 25)
	add(commitment, if crowdCue then 30 * crowdScale else 30)
	add(comedy, 25 * crowdScale)
	add(chaos, 20 * crowdScale)
	local overall = if weight > 0 then math.round(sum / weight) else nil
	return {
		overall = overall,
		band = if overall then Score.band(overall) else "Take it again",
		accuracy = accuracy,
		commitment = commitment,
		comedy = comedy,
		chaos = chaos,
		voters = count,
	}
end
return Score
