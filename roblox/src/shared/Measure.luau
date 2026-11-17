--!strict
local Measure = {}
local function finite(x: any, low: number, high: number): boolean
	return type(x) == "number" and x == x and x >= low and x <= high
end
function Measure.valid(claim: any, elapsed: number): boolean
	if
		type(claim) ~= "table"
		or type(claim.words) ~= "string"
		or #claim.words > 384
		or not utf8.len(claim.words)
	then
		return false
	end
	if
		not finite(claim.baseline, 0.0001, 1)
		or not finite(claim.seconds, 0.3, 10.1)
		or claim.seconds > elapsed + 0.35
	then
		return false
	end
	if type(claim.levels) ~= "table" then
		return false
	end
	local n = #claim.levels
	if n < 2 or n > 51 or n > math.ceil(claim.seconds * 5) + 1 then
		return false
	end
	local count = 0
	for key, value in claim.levels do
		count += 1
		if count > 51 or not finite(key, 1, n) or key % 1 ~= 0 or not finite(value, 0, 1) then
			return false
		end
	end
	return count == n
end

function Measure.read(claim, spec: string)
	local first, last, volume, active = 0, 0, 0, 0
	local firstSum, lastSum, firstN, lastN = 0, 0, 0, 0
	local n = #claim.levels
	for i, level in claim.levels do
		local relative = level / claim.baseline
		if relative >= 0.10 then
			if first == 0 then
				first = i
			end
			last = i
			active += 1
			volume += relative
			if i <= n / 2 then
				firstSum += relative
				firstN += 1
			else
				lastSum += relative
				lastN += 1
			end
		end
	end
	if active == 0 then
		return nil, nil, nil
	end
	local span = math.max(0.2, (last - first + 1) * 0.2)
	local words = 0
	for _ in claim.words:gmatch("%S+") do
		words += 1
	end
	local pace = words / span
	local mean = volume / active
	local function match(value, target, tolerance)
		return math.round(100 * math.clamp(1 - math.abs(value - target) / tolerance, 0, 1))
	end
	local measured
	if spec == "quiet" then
		measured = match(mean, 0.38, 0.8)
	elseif spec == "fast" then
		measured = match(pace, 3.1, 2.6)
	elseif spec == "slow" then
		measured = match(pace, 1.55, 1.5)
	elseif spec == "pause" then
		local gap, longest = 0, 0
		for i = first, last do
			gap = if claim.levels[i] < claim.baseline * 0.10 then gap + 1 else 0
			longest = math.max(longest, gap)
		end
		measured = math.min(100, longest * 25)
	elseif (spec == "rise" or spec == "fall") and firstN > 0 and lastN > 0 then
		local delta = lastSum / lastN - firstSum / firstN
		measured = math.round(100 * math.clamp((if spec == "rise" then delta else -delta) / 0.65, 0, 1))
	end
	return measured, math.round(pace * 10) / 10, math.round(mean * 100) / 100
end
function Measure.synthetic(line: string)
	return { words = line, baseline = 0.1, seconds = 5, levels = table.create(25, 0.075) }
end
return Measure
