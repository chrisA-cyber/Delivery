--!strict
-- A player can solve every three-lamp ticket from every possible starting display.
local Marquee = require("../src/shared/Marquee")
for a = 1, 3 do
	for b = 1, 3 do
		for c = 1, 3 do
			local states = {}
			for left = 0, 2 do
				for middle = 0, 2 do
					for right = 0, 2 do
						local lamps = { a, b, c }
						for switch, count in { left, middle, right } do
							for _ = 1, count do
								Marquee.turn(lamps, switch)
							end
						end
						local key = table.concat(lamps, "/")
						assert(not states[key], "Two switch combinations produced the same ticket")
						states[key] = true
					end
				end
			end
			local n = 0
			for _ in states do
				n += 1
			end
			assert(n == 27, "A ticket cannot be reached")
		end
	end
end
local lamps = { 1, 1, 1 }
Marquee.turn(lamps, 1)
Marquee.turn(lamps, 2)
assert(Marquee.matches(lamps, { 2, 3, 2 }), "The opening ticket should teach two linked switches")
print("PASS 729 starting-display / target combinations and the opening marquee ticket")
