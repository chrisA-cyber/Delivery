--!strict
-- The four shop counters. Each draws into its own compact bottom sheet (TownSheet) rather than the
-- show's ControlDesk, so the counter scene and the avatar stay visible above it on phones.
local Players = game:GetService("Players")
local Run = game:GetService("RunService")
local GuiService = game:GetService("GuiService")
local Instruments = require(script.Parent.DeliveryInstruments)
local Catalogue = require(game:GetService("ReplicatedStorage").Delivery.ShopCatalogue)
local Preview = require(script.Parent.PostcardPreview)
local TownSheet = require(script.Parent.TownSheet)
local Style = require(script.Parent.GuideStyle)
local Zoom = require(script.Parent.ShopWalkingZoom)
local Town = {}
Town.shops = {
	post = {
		tag = "LANTERN STREET / PARCELS",
		hint = "Pick up a parcel at the post office counter, then walk it to the shop on its label. Follow the gold marker.",
		goal = "Pick up a parcel at the counter.",
		game = "Parcel route",
		start = "Pick up a parcel",
		intro = "Take a parcel and walk it to the shop on the address label.",
		icon = "parcel",
		again = "Take another parcel",
	},
	records = {
		tag = "LANTERN STREET / RECORDS",
		hint = "Copy a riff at the listening deck. Clock Court's three bells are down the lane behind the shop.",
		goal = "Copy a riff at the listening deck.",
		game = "Listening booth",
		start = "Play a record",
		intro = "Listen to the riff, then copy the sounds in order.",
		icon = "record",
		again = "Play another side",
	},
	cafe = {
		tag = "MARKET WALK / BAKERY",
		hint = "Step into the bakehouse and work the counter. Add each customer’s ingredients in recipe order.",
		goal = "Serve an order at the counter.",
		game = "Bakehouse counter",
		start = "Take an order",
		intro = "Read the order and add its ingredients in sequence.",
		icon = "cup",
		again = "Take another order",
	},
	gallery = {
		tag = "MARKET WALK / PRINTS",
		hint = "Print a skyline postcard at the press. Clock Court's lane links the gallery with Needle Drop.",
		goal = "Print a skyline postcard.",
		game = "Postcard press",
		start = "Design a postcard",
		intro = "Pick a skyline, ink and greeting. Your latest print stays in the gallery.",
		icon = "postcard",
		again = "Design another print",
	},
}
local padGlyph = { Bell = "bell", Squeak = "music", Thump = "radio" }

function Town.new(ui, send, openPage)
	local player = Players.LocalPlayer
	local root = Style.townRoot(ui)
	local postcard = Preview.new(root, ui.gui)
	local lastStart = nil
	local lastNote = 0
	local viewedShop: string? = nil
	local approachPosition: Vector3? = nil
	local framing = false
	-- Progress memory for right/wrong feedback and the one-time completion celebration.
	local seenRun = -1
	local seenProgress = 0
	local seenNotice = ""
	local function walk()
		openPage("explore")
	end
	local sheet = TownSheet.new(root, ui.gui, walk)

	-- Keep the avatar's head above the sheet: runs after ShowFX's counter lens (Camera + 1).
	local function frame()
		local camera = workspace.CurrentCamera
		local character = player.Character
		local head = character and character:FindFirstChild("Head")
		if not camera or not head or not head:IsA("BasePart") or not sheet.isOpen() then
			return
		end
		if camera.CameraType ~= Enum.CameraType.Scriptable then
			return
		end
		local inset = GuiService:GetGuiInset()
		local top = sheet.frame.AbsolutePosition.Y + inset.Y
		camera.CFrame =
			Zoom.frameAbove(camera, head.Position + Vector3.new(0, head.Size.Y * 0.6, 0), top - 18)
	end
	local function setFraming(on: boolean)
		if on == framing then
			return
		end
		framing = on
		if on then
			Run:BindToRenderStep("DeliveryCounterFraming", Enum.RenderPriority.Camera.Value + 2, frame)
		else
			Run:UnbindFromRenderStep("DeliveryCounterFraming")
		end
	end

	local function setView(page, venue)
		local shopId = if Town.shops[page] then page else nil
		if shopId ~= viewedShop then
			viewedShop = shopId
			local character = player.Character
			approachPosition = if shopId and character then character:GetPivot().Position else nil
			if not shopId then
				sheet.close()
			end
		end
		setFraming(shopId ~= nil)
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

	local function feedback(b)
		if not b then
			return
		end
		local notice = b.notice or ""
		if b.run ~= seenRun then
			seenRun = b.run
			seenProgress = b.progress or 0
			seenNotice = notice
			return
		end
		local progress = b.progress or 0
		local wrong = notice ~= seenNotice
			and (
				string.find(notice, "Check the order slip", 1, true) ~= nil
				or string.find(notice, "slipped", 1, true) ~= nil
			)
		if progress > seenProgress then
			sheet.good(progress)
		elseif wrong then
			sheet.bad()
		end
		seenProgress = progress
		seenNotice = notice
	end

	local function draw(page, s)
		local venue = s.venue
		local shop = Town.shops[page]
		local info = Catalogue.shops[page]
		-- This sheet replaces the ControlDesk for shop pages. Hud applies showPanel in ui.finish(),
		-- which runs after this draw.
		if type(ui.showPanel) == "function" then
			ui.showPanel(false)
		else
			ui.panel.Visible = false
		end
		sheet.open({
			id = page,
			title = info.title,
			game = shop.game,
			icon = shop.icon,
			accent = Style.accent[page] or Style.color.bulb,
		})
		local b = venue.business
		if b and b.kind ~= page then
			b = nil
		end
		local row = s.standing or {}
		if not b or b.status ~= "active" then
			local done = b and b.status == "done"
			if done then
				sheet.steps(b.total or 0, b.total or 0)
				local heading = if page == "post"
					then "Parcel delivered"
					elseif page == "records" then (b.recordName or "Side") .. " complete"
					elseif page == "cafe" then (b.orderName or "Order") .. " served"
					else "Postcard printed"
				local result = if page == "post"
					then "Signed for at " .. (b.recipient or "the counter")
					elseif page == "records" then string.format("%d notes matched", b.total or 0)
					elseif page == "cafe" then "Order complete"
					else (b.print and b.print.greeting or "Your print is saved")
				local track = if page == "records" then "stage" else "crowd"
				local reward = if (b.xp or 0) > 0 then string.format("+%d %s XP", b.xp, track) else ""
				local count = row[info.counter]
				if type(count) == "number" and count > 0 then
					result ..= string.format(
						"  ·  %s #%d",
						if page == "post" then "Delivery" else "Ticket",
						count
					)
				end
				sheet.complete(heading, result, reward, {
					{
						text = shop.again,
						glyph = shop.icon,
						kind = "primary",
						run = function()
							sheet.resume()
							send({ op = "shopStart", kind = page })
						end,
					},
				})
				return
			end
			sheet.resume()
			sheet.steps(0, 0)
			sheet.listen(nil)
			local other = venue.business
			local note = if other
					and other.kind ~= page
					and other.status == "active"
				then "Starting here replaces your current " .. Catalogue.shops[other.kind].title .. " ticket."
				else shop.intro
			sheet.copy(shop.tag, shop.game, note)
			sheet.actions({
				{
					text = shop.start,
					glyph = shop.icon,
					kind = "primary",
					run = function()
						send({ op = "shopStart", kind = page })
					end,
				},
			})
			return
		end
		sheet.resume()
		feedback(b)
		local function sendChoice(choice)
			send({ op = "shopPick", run = b.run, choice = choice })
		end
		sheet.steps(b.total or 0, b.progress or 0)
		if page ~= "records" then
			sheet.listen(nil)
		end
		if page == "post" then
			sheet.copy(
				"DELIVERY ADDRESS",
				b.recipient or "Recipient",
				(b.parcel or "Parcel") .. ". Follow the gold marker to its counter."
			)
			sheet.actions({ { text = "Walk the parcel route", glyph = "pin", kind = "primary", run = walk } })
		elseif page == "records" then
			sheet.copy("LISTENING BOOTH", "Listen to the record", "Match the sequence after the last note.")
			local list = {}
			for _, name in b.choices do
				table.insert(list, {
					text = name,
					key = name,
					glyph = padGlyph[name],
					run = function()
						if workspace:GetServerTimeNow() < b.listenUntil then
							return
						end
						Instruments.strike(name)
						sendChoice(name)
					end,
				})
			end
			table.insert(list, {
				text = "Hear it again",
				glyph = "headphones",
				kind = "quiet",
				run = function()
					send({ op = "shopReplay", run = b.run })
				end,
			})
			sheet.actions(list)
		elseif page == "cafe" then
			local ingredient = b.recipe[b.progress + 1]
			local slip = {}
			for i, item in b.recipe do
				table.insert(slip, if i <= b.progress then "✓ " .. item else item)
			end
			sheet.copy(
				string.format(
					"STEP %d / %d  ·  ADD %s",
					b.progress + 1,
					b.total,
					string.upper(ingredient or "")
				),
				b.orderName or "Order",
				if b.notice and string.find(b.notice, "Check the order slip", 1, true)
					then b.notice
					else table.concat(slip, "  ›  ")
			)
			local list = {}
			for _, name in b.choices do
				table.insert(list, {
					text = name,
					run = function()
						sendChoice(name)
					end,
				})
			end
			sheet.actions(list)
		elseif page == "gallery" then
			local index = b.progress + 1
			local options = b.palette[index] or {}
			sheet.copy(
				string.format("POSTCARD PRESS  ·  %d / %d", index, b.total),
				if index == 1
					then "Choose the skyline"
					elseif index == 2 then "Choose an ink"
					else "Add your greeting",
				if index == 1
					then "Pick the landmark for your illustration."
					elseif index == 2 then "The press prints your scene in this colour."
					else "Choosing the greeting finishes your postcard."
			)
			local list = {}
			for _, name in options do
				table.insert(list, {
					text = name,
					glyph = if index == 1 then "postcard" else nil,
					run = function()
						sendChoice(name)
					end,
				})
			end
			sheet.actions(list)
		end
	end
	local function tick(page, s)
		if viewedShop and viewedShop == page and approachPosition then
			local character = player.Character
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
		sheet.kicker(
			if listening
				then "LISTEN  ·  " .. string.upper(b.recordName or "Needle Drop")
				else string.format("YOUR TURN  ·  %d / %d", b.progress, b.total)
		)
		sheet.title(if listening then (if beat then beat else "Needle down…") else "Play the riff")
		sheet.note(
			if listening
				then (if b.notice and string.find(b.notice, "slipped", 1, true)
					then "Try again. Listen to the full sequence."
					else "Listen and watch the pads light up.")
				else (if b.progress > 0
					then "Matched! Play the next sound."
					else "Tap the sounds in the same order.")
		)
		for _, name in b.choices do
			sheet.hot(name, name == beat)
		end
		sheet.listen(
			if listening
				then math.clamp((now - b.started) / math.max(0.1, b.listenUntil - b.started), 0, 1)
				else nil
		)
	end
	return {
		setView = setView,
		draw = draw,
		tick = tick,
		sheet = sheet,
	}
end
return Town
