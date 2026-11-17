--!strict
-- Each of the first two rotary switches also advances the lamp on its right.
local Marquee = {}
function Marquee.turn(lamps: { number }, slot: number)
	lamps[slot] = lamps[slot] % 3 + 1
	if slot < 3 then
		lamps[slot + 1] = lamps[slot + 1] % 3 + 1
	end
end
function Marquee.matches(a: { number }, b: { number }): boolean
	return a[1] == b[1] and a[2] == b[2] and a[3] == b[3]
end
return Marquee
