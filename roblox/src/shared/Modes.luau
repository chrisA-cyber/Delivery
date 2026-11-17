--!strict
local Modes = {}
Modes.names = { "Main stage", "Switch", "Echo", "Face-off", "Daily", "Custom", "Pack night" }
Modes.setups = { "I missed the checkpoint.", "My pet ran the tycoon.", "My avatar did the dance." }
Modes.ends = {
	"The replay is currently under review.",
	"Please direct all questions to the floor.",
	"My entire server has requested a sequel.",
}
local phrases = { "Not my problem.", "I'm the manager.", "Please send help.", "I am cooked." }
Modes.switchCues = { "Normal", "Whisper", "Project", "Whisper" }
function Modes.card(s, daily)
	if s.mode == "Pack night" then
		local _, _, _, weekly = daily()
		if weekly then
			s.line = weekly[s.turn % #weekly + 1]
		end
	elseif s.mode == "Daily" then
		local line, cue, day = daily()
		s.line = line
		s.cues = { cue }
		s.day = day
	elseif s.mode == "Custom" then
		local combination = s.custom[s.actor] or 1
		local setup = math.floor((combination - 1) / 3) + 1
		local ending = (combination - 1) % 3 + 1
		s.line = {
			id = "mix-" .. combination,
			text = Modes.setups[setup] .. " " .. Modes.ends[ending],
			pack = "Writers' room",
		}
	elseif s.mode == "Switch" then
		local phrase = phrases[(s.turn - 1) % #phrases + 1]
		s.line = { id = "switch-" .. s.turn % 4, text = phrase, pack = "Switch" }
		s.cues = {
			{
				id = "switch",
				label = "Four cues",
				text = "Repeat the phrase each time the cue changes.",
				measure = "switch",
			},
		}
	elseif s.mode == "Echo" then
		s.cues = {
			{
				id = "echo",
				label = "Copy the beat",
				text = "Hear the host. Repeat the line in two groups with a beat of silence between.",
				measure = "pause",
			},
		}
	elseif s.mode == "Face-off" and s.duel and s.duel.second == s.actor and s.duel.line then
		s.line = s.duel.line
		s.cues = { s.duel.cue }
	end
end
function Modes.beat(text: string): string
	local groups = string.split(text, " ")
	if #groups < 2 then
		return text
	end
	local split = math.ceil(#groups / 2)
	return table.concat(groups, " ", 1, split) .. " … " .. table.concat(groups, " ", split + 1, #groups)
end
function Modes.expected(s): string
	if s.mode == "Switch" then
		return table.concat(table.create(4, s.line.text), " ")
	end
	return s.line.text
end
function Modes.switchMeasure(claim): number?
	local sums, counts = { 0, 0, 0, 0 }, { 0, 0, 0, 0 }
	for i, v in claim.levels do
		local segment = math.min(4, math.floor((i - 1) * 0.2 / 2.5) + 1)
		if v > claim.baseline * 0.10 then
			sums[segment] += v / claim.baseline
			counts[segment] += 1
		end
	end
	local total = 0
	for i, target in { 1, 0.38, 1.4, 0.38 } do
		if counts[i] > 0 then
			total += math.max(0, 1 - math.abs(sums[i] / counts[i] - target) / target)
		end
	end
	return math.round(total * 25)
end
return Modes
