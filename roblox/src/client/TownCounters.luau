--!strict
local Instruments = require(script.Parent.DeliveryInstruments)
local Catalogue = require(game:GetService("ReplicatedStorage").Delivery.ShopCatalogue)
local Preview = require(script.Parent.PostcardPreview)
local Town = {}
Town.shops = {
	post = {
		tag = "WEST LANTERN / PARCELS",

		hint = "Pick up a parcel inside the post office. Walk it to another shop and hand it over at the marked counter.",
		game = "Parcel route",
		start = "Pick up a parcel",
		intro = "Take a parcel and walk it to the shop on the address label.",
		icon = "book-open",

		again = "Take another parcel",
	},
	records = {
		tag = "EAST LANTERN / RECORDS",

		hint = "Copy a riff at the listening deck. Walk south behind the shop to play the three bells in Clock Court.",
		game = "Listening booth",
		start = "Play a record",
		intro = "Listen to the riff, then copy the sounds in order.",
		icon = "headphones",

		again = "Play another side",
	},
	cafe = {
		tag = "WEST MARKET WALK / BAKERY",

		hint = "Step into the bakehouse and work the counter. Assemble each customer’s order in recipe order.",
		game = "Bakehouse counter",
		start = "Take an order",
		intro = "Read the order and add its ingredients in sequence.",
		icon = "bell",

		again = "Take another order",
	},
	gallery = {
		tag = "EAST MARKET WALK / PRINTS",

		hint = "Print a skyline postcard. From the east market gate, follow Clock Court’s lane back to Needle Drop.",
		game = "Postcard press",
		start = "Design a postcard",
		intro = "Pick a skyline, ink and greeting. Your latest print stays in the gallery.",
		icon = "award",

		again = "Design another print",
	},
}
local gold = Color3.fromRGB(255, 207, 107)
local cream = Color3.fromRGB(251, 240, 221)
local muted = Color3.fromRGB(63, 47, 80)
local dark = Color3.fromRGB(26, 22, 36)
function Town.new(ui, send, openPage)
	local postcard = Preview.new(ui.gui)
	local pads = {}
	local lastStart = nil
	local lastNote = 0
	local viewedShop = nil
	local approachPosition: Vector3? = nil
	local function setView(page, venue)
		local shopId = if Town.shops[page] then page else nil
		if shopId ~= viewedShop then
			viewedShop = shopId
			local character = game:GetService("Players").LocalPlayer.Character
			approachPosition = if shopId and character then character:GetPivot().Position else nil
		end
		if page ~= "gallery" or not venue then
			postcard(false)
			return
		end
		local b = venue.business
		local saved = venue.lastPrint
		if b and b.kind == "gallery" and b.status == "active" then
			local picks = b.picks or {}
			postcard(true, picks[1], picks[2], picks[3])
		elseif saved or (b and b.kind == "gallery" and b.print) then
			local savedPrint = saved or b.print
			postcard(true, savedPrint.scene, savedPrint.ink, savedPrint.greeting)
		else
			postcard(false)
		end
	end
	local function copy(kicker, card, note)
		ui.kicker.Text = kicker
		ui.card.Text = card
		ui.note.Text = note
	end
	local function walk()
		openPage("explore")
	end
	local function draw(page, s)
		local venue = s.venue
		local shop = Town.shops[page]
		local b = venue.business
		if b and b.kind ~= page then
			b = nil
		end
		local row = s.standing or {}
		table.clear(pads)
		ui.phase.Text = string.upper(Catalogue.shops[page].title) .. "   /   " .. string.upper(shop.game)
		if not b or b.status ~= "active" then
			local done = b and b.status == "done"
			if done then
				local title = if page == "post"
					then "Parcel delivered"
					elseif page == "records" then b.recordName or "Side complete"
					elseif page == "cafe" then (b.orderName or "Order") .. " served"
					else "Postcard printed"
				local result = if page == "post"
					then b.recipient
					elseif page == "records" then tostring(b.total) .. " notes matched"
					elseif page == "cafe" then "Order complete"
					else (b.print and b.print.greeting or "Your print is saved")
				copy(
					string.format("COMPLETED  ·  %d", row[Catalogue.shops[page].counter] or 1),
					title,
					string.format(
						"%s  ·  +%d %s XP",
						result or "",
						b.xp or 0,
						if page == "records" then "stage" else "crowd"
					)
				)
			else
				local other = venue.business
				local note = if other
						and other.kind ~= page
						and other.status == "active"
					then "Starting this activity replaces your current "
						.. Catalogue.shops[other.kind].title
						.. " ticket."
					else shop.intro
				copy(shop.tag, shop.game, note)
			end
			ui.button(if done then shop.again else shop.start, function()
				send({ op = "shopStart", kind = page })
			end, true, shop.icon)
			ui.button("Back to walking", walk)
			return
		end
		local function sendChoice(choice)
			send({ op = "shopPick", run = b.run, choice = choice })
		end
		if page == "post" then
			copy(
				"DELIVERY ADDRESS",
				b.recipient or "Recipient",
				(b.parcel or "Parcel") .. " · Bring it to the marked shop counter."
			)
			ui.button("Walk the parcel route", walk, true, "play")
		elseif page == "records" then
			copy("LISTENING BOOTH", "Listen to the record", "Match the sequence after the last note.")
			for _, name in b.choices do
				pads[name] = ui.button(name, function()
					if workspace:GetServerTimeNow() < b.listenUntil then
						return
					end
					Instruments.strike(name)
					sendChoice(name)
				end, false, if name == "Bell" then "bell" elseif name == "Squeak" then "music" else "radio")
			end
			ui.button("Hear it again", function()
				send({ op = "shopReplay", run = b.run })
			end)
		elseif page == "cafe" then
			local ingredient = b.recipe[b.progress + 1]
			copy(
				string.format(
					"STEP %d / %d   ·   ADD %s",
					b.progress + 1,
					b.total,
					string.upper(ingredient or "")
				),
				b.orderName,
				if b.notice and string.find(b.notice, "Check the order slip", 1, true)
					then b.notice
					else table.concat(b.recipe, "  ›  ")
			)
			for _, name in b.choices do
				ui.button(name, function()
					sendChoice(name)
				end)
			end
		elseif page == "gallery" then
			local index = b.progress + 1
			local options = b.palette[index] or {}
			copy(
				string.format("POSTCARD PRESS   ·   %d / %d", index, b.total),
				if index == 1
					then "Choose the skyline"
					elseif index == 2 then "Choose an ink"
					else "Add your greeting",
				if index == 1
					then "Pick the landmark for your illustration."
					elseif index == 2 then "The press prints your scene in this color."
					else "Choosing the greeting finishes your postcard."
			)
			for _, name in options do
				ui.button(name, function()
					sendChoice(name)
				end)
			end
		end
	end
	local function tick(page, s)
		if viewedShop and viewedShop == page and approachPosition then
			local character = game:GetService("Players").LocalPlayer.Character
			if character then
				local nowAt = character:GetPivot().Position
				local delta = nowAt - approachPosition
				local shop = Catalogue.shops[viewedShop]
				local distance = Vector2.new(nowAt.X - shop.x, nowAt.Z - shop.z).Magnitude
				local humanoid = character:FindFirstChildOfClass("Humanoid")
				if
					distance > 10
					or (
						humanoid
						and humanoid.MoveDirection.Magnitude > 0.1
						and Vector2.new(delta.X, delta.Z).Magnitude > 3.5
					)
				then
					walk()
					return
				end
			end
		end
		if page ~= "records" or not s.venue then
			lastStart = nil
			lastNote = 0
			return
		end
		local b = s.venue.business
		if not b or b.kind ~= "records" or b.status ~= "active" then
			return
		end
		if b.started ~= lastStart then
			lastStart = b.started
			lastNote = 0
		end
		local now = workspace:GetServerTimeNow()
		local listening = now < b.listenUntil
		local i = math.floor((now - b.started) / b.beatGap) + 1
		local beat = if listening and i >= 1 then b.notes[i] else nil
		if beat and i ~= lastNote then
			Instruments.strike(beat)
			lastNote = i
		end
		ui.kicker.Text = if listening
			then "LISTEN   ·   " .. (b.recordName or "Needle Drop")
			else string.format("YOUR TURN  ·  %d / %d", b.progress, b.total)
		ui.card.Text = if listening then (if beat then beat else "Needle down…") else "Play the riff"
		ui.note.Text = if listening
			then (if b.notice and string.find(b.notice, "slipped", 1, true)
				then "Try again. Listen to the full sequence."
				else "Listen and watch the pads.")
			else (if b.progress > 0
				then "Matched. Play the next sound."
				else "Tap the sounds in the same order.")
		for name, button in pads do
			local hot = name == beat
			button.BackgroundColor3 = if hot then gold else muted
			button.TextColor3 = if hot then dark else cream
		end
		if listening then
			ui.clock(b.listenUntil - now, b.listenUntil - b.started)
		else
			ui.clock(nil, 1)
		end
	end
	return { setView = setView, draw = draw, tick = tick }
end
return Town
