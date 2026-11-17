--!strict
-- Separate milestones: a crowd-only player never implies a first take.
local Metrics = {}
local allowed = {
	join = true,
	first_vote = true,
	first_take = true,
	second_round = true,
	invite_opened = true,
	invite_join = true,
	next_day_return = true,
	mic_checked = true,
}
function Metrics.new(emit)
	local seen = {}
	local function once(p, key)
		if not allowed[key] then
			return
		end
		seen[p] = seen[p] or {}
		if seen[p][key] then
			return
		end
		seen[p][key] = true
		emit(p, key)
	end
	local function take(p, miss: boolean)
		emit(p, "voice_take")
		if miss then
			emit(p, "transcription_miss")
		end
	end
	return {
		once = once,
		take = take,
		leave = function(p)
			seen[p] = nil
		end,
	}
end
return Metrics
