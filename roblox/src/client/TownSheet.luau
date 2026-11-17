--!strict
-- Compact bottom sheet for the four shop counters. At most 40% of a landscape phone's height so the
-- counter scene and the avatar stay visible above it. Per-shop accent, deco header, step dots,
-- feedback for right and wrong picks, and a completion card with a reward chip.
local Input = game:GetService("UserInputService")
local GuiService = game:GetService("GuiService")
local Tween = game:GetService("TweenService")
local Style = require(script.Parent.GuideStyle)
local Glyphs = require(script.Parent.GuideGlyphs)
local C = Style.color

local Sheet = {}

export type Action = {
	text: string,
	run: () -> (),
	kind: Style.Kind?,
	glyph: string?,
	key: string?, -- identifies the button for setHot (e.g. a pad name)
}
export type Header = { id: string, title: string, game: string, icon: string, accent: Color3 }

local keys = { Enum.KeyCode.One, Enum.KeyCode.Two, Enum.KeyCode.Three, Enum.KeyCode.Four }

function Sheet.new(layer: Instance, gui: ScreenGui, onClose: () -> ())
	local sheet = Style.frame(layer, "CounterSheet", Color3.new(1, 1, 1), 0.04)
	sheet.AnchorPoint = Vector2.new(0.5, 1)
	sheet.Position = UDim2.new(0.5, 0, 1, -8)
	sheet.Visible = false
	-- Not Active: touches on the copy pass through to the thumbstick; only the buttons take input.
	sheet.Active = false
	sheet.ZIndex = 3
	Style.corner(sheet, 18)
	local edge = Style.stroke(sheet, C.champagne, 1.5, 0.2)
	local tone = Style.gradient(sheet, C.panelTop, C.panel)
	local scale = Style.attachScale(sheet)

	-- Accent rule across the top edge with a deco gem in its centre.
	local rule = Style.frame(sheet, "AccentRule", C.bulb)
	rule.AnchorPoint = Vector2.new(0.5, 0)
	rule.Position = UDim2.fromScale(0.5, 0)
	rule.Size = UDim2.new(1, -36, 0, 3)
	Style.corner(rule, 2)
	local gem = Style.frame(sheet, "Gem", C.bulb)
	gem.AnchorPoint = Vector2.new(0.5, 0.5)
	gem.Position = UDim2.new(0.5, 0, 0, 1)
	gem.Size = UDim2.fromOffset(10, 10)
	gem.Rotation = 45

	local body = Style.frame(sheet, "Body")
	body.Size = UDim2.fromScale(1, 1)

	-- Header: shop glyph, deco name, game line, step dots, close.
	local disc = Style.frame(body, "ShopBadge", C.bulb)
	disc.Position = UDim2.fromOffset(12, 10)
	disc.Size = UDim2.fromOffset(34, 34)
	Style.corner(disc, 999)
	Style.stroke(disc, C.ink, 1.5, 0.3)
	local discIcon: Frame? = nil
	local shopName = Style.text(body, "ShopName", Style.font.title, C.bulb, 16, 12)
	shopName.Position = UDim2.fromOffset(54, 8)
	shopName.TextTruncate = Enum.TextTruncate.AtEnd
	local gameName = Style.text(body, "Game", Style.font.bold, C.muted, 14, 12)
	gameName.Position = UDim2.fromOffset(54, 27)
	local dots = Style.frame(body, "Steps")
	dots.AnchorPoint = Vector2.new(1, 0.5)
	local dotList = Instance.new("UIListLayout")
	dotList.FillDirection = Enum.FillDirection.Horizontal
	dotList.VerticalAlignment = Enum.VerticalAlignment.Center
	dotList.HorizontalAlignment = Enum.HorizontalAlignment.Right
	dotList.Padding = UDim.new(0, 6)
	dotList.SortOrder = Enum.SortOrder.LayoutOrder
	dotList.Parent = dots
	local dotFrames: { Frame } = {}
	local close = Instance.new("TextButton")
	close.Name = "BackToWalking"
	close.Text = ""
	close.AutoButtonColor = false
	close.Selectable = true
	close.BackgroundColor3 = C.panelDeep
	close.BackgroundTransparency = 0.3
	close.Size = UDim2.fromOffset(48, 48)
	Style.corner(close, 12)
	Style.stroke(close, C.champagne, 1, 0.5)
	Glyphs.mount(close, "close", 18, C.cream, UDim2.new(0.5, -9, 0.5, -9))
	close.Parent = body
	close.Activated:Connect(onClose)

	-- Copy column.
	local kicker = Style.text(body, "Kicker", Style.font.heavy, C.bulb, 13, 11)
	local title = Style.text(body, "Card", Style.font.heavy, C.cream, 22, 15)
	local note = Style.text(body, "Note", Style.font.body, Color3.fromRGB(226, 222, 244), 16, 14)
	note.TextYAlignment = Enum.TextYAlignment.Top
	local meter = Style.frame(body, "Listen", C.panelDeep, 0.2)
	meter.Size = UDim2.fromOffset(0, 4)
	meter.Visible = false
	Style.corner(meter, 2)
	local meterFill = Style.frame(meter, "Fill", C.bulb)
	meterFill.Size = UDim2.fromScale(1, 1)
	Style.corner(meterFill, 2)

	-- Actions grid.
	local actions = Style.frame(body, "Actions")
	local grid = Instance.new("UIGridLayout")
	grid.SortOrder = Enum.SortOrder.LayoutOrder
	grid.CellPadding = UDim2.fromOffset(8, 8)
	grid.Parent = actions
	local pool: { TextButton } = {}
	local handlers: { () -> () } = {}
	local byKey: { [string]: TextButton } = {}
	local count = 0

	-- Completion card (covers the copy and actions).
	local done = Style.frame(body, "Completed")
	done.Visible = false
	done.Size = UDim2.fromScale(1, 1)
	local doneDisc = Style.frame(done, "Stamp", C.good)
	doneDisc.AnchorPoint = Vector2.new(0.5, 0.5)
	doneDisc.Size = UDim2.fromOffset(52, 52)
	Style.corner(doneDisc, 999)
	Style.stroke(doneDisc, C.cream, 2.5, 0)
	Glyphs.mount(doneDisc, "check", 30, C.ink, UDim2.new(0.5, -15, 0.5, -15), 3)
	local doneTitle = Style.text(done, "Title", Style.font.heavy, C.cream, 22, 15)
	local doneResult = Style.text(done, "Result", Style.font.body, Color3.fromRGB(226, 222, 244), 16, 14)
	local chip = Style.frame(done, "Reward", C.bulb)
	chip.Size = UDim2.fromOffset(150, 30)
	Style.corner(chip, 999)
	Style.gradient(chip, C.bulb, C.champagne)
	Glyphs.mount(chip, "star", 18, C.ink, UDim2.new(0, 10, 0.5, -9))
	local chipText = Style.text(chip, "Text", Style.font.friendly, C.ink, 17, 13)
	chipText.Position = UDim2.fromOffset(34, 0)
	chipText.Size = UDim2.new(1, -42, 1, 0)

	local accent = C.bulb
	local showing = false
	local completed = false
	local function rows(): number
		return math.max(1, math.ceil(count / 2))
	end
	local function layout()
		local size = gui.AbsoluteSize
		if size.X < 10 then
			return
		end
		local k = Style.currentScale()
		scale.Scale = k
		local w, h = size.X / k, size.Y / k
		local portrait = w < h
		-- While the thumbstick is on, keep the jump button's bottom-right 110 x 110 clear.
		local touch = GuiService.TouchControlsEnabled and Input.PreferredInput == Enum.PreferredInput.Touch
		local width =
			math.min(w - 16 - (if touch and not portrait then 118 else 0), if portrait then 560 else 800)
		if touch and not portrait then
			sheet.AnchorPoint = Vector2.new(0, 1)
			sheet.Position = UDim2.new(0, 8, 1, -8)
		else
			sheet.AnchorPoint = Vector2.new(0.5, 1)
			sheet.Position = UDim2.new(0.5, 0, 1, if touch then -118 else -8)
		end
		local actionRows = rows()
		local actionHeight = actionRows * 48 + (actionRows - 1) * 8
		-- Landscape: copy on the left, actions on the right. Portrait: copy above actions.
		local copyW = if portrait then width - 28 else math.floor(width * 0.46) - 14
		local height = if portrait then 54 + 88 + actionHeight + 12 else math.max(124, actionHeight + 20)
		-- Never taller than 40% of the screen (two rows of 48 px buttons fit a 338 px landscape phone).
		height = math.min(height, math.max(124, h * (if portrait then 0.42 else 0.4)))
		sheet.Size = UDim2.fromOffset(width, height)
		close.Position = UDim2.fromOffset(copyW + 14 - 48, 4)
		close.AnchorPoint = Vector2.new(0, 0)
		shopName.Size = UDim2.fromOffset(math.max(60, copyW - 46 - 54), 20)
		gameName.Size = UDim2.fromOffset(math.max(60, copyW - 46 - 54 - 90), 18)
		dots.Size = UDim2.fromOffset(90, 18)
		dots.Position = UDim2.fromOffset(copyW + 14 - 54, 27)
		local copyTop = 48
		kicker.Position = UDim2.fromOffset(14, copyTop)
		kicker.Size = UDim2.fromOffset(copyW, 16)
		title.Position = UDim2.fromOffset(14, copyTop + 15)
		title.Size = UDim2.fromOffset(copyW, 26)
		meter.Position = UDim2.fromOffset(14, copyTop + 43)
		meter.Size = UDim2.fromOffset(copyW, 4)
		local noteTop = copyTop + 42 + (if meter.Visible then 8 else 0)
		local actionTop = if portrait then height - actionHeight - 12 else 10
		local noteBottom = if portrait then actionTop - 6 else height - 8
		note.Position = UDim2.fromOffset(14, noteTop)
		note.Size = UDim2.fromOffset(copyW, math.max(18, noteBottom - noteTop))
		if portrait then
			actions.Position = UDim2.fromOffset(14, actionTop)
			actions.Size = UDim2.fromOffset(width - 28, actionHeight)
		else
			local left = copyW + 26
			actions.Position = UDim2.fromOffset(left, actionTop)
			actions.Size = UDim2.fromOffset(width - left - 12, height - 20)
		end
		local cols = if count <= 1 then 1 else 2
		grid.CellSize = UDim2.new(1 / cols, if cols == 1 then 0 else -4, 0, 48)
		-- Completion card sits where the copy was.
		doneDisc.Position = UDim2.fromOffset(40, copyTop + 34)
		doneTitle.Position = UDim2.fromOffset(76, copyTop)
		doneTitle.Size = UDim2.fromOffset(copyW - 64, 28)
		doneResult.Position = UDim2.fromOffset(76, copyTop + 27)
		doneResult.Size = UDim2.fromOffset(copyW - 64, 20)
		chip.Position = UDim2.fromOffset(76, copyTop + 49)
		gui:SetAttribute("TownSheetTop", if sheet.Visible then sheet.AbsolutePosition.Y else nil)
	end
	gui:GetPropertyChangedSignal("AbsoluteSize"):Connect(layout)
	GuiService:GetPropertyChangedSignal("TouchControlsEnabled"):Connect(layout)
	Input:GetPropertyChangedSignal("PreferredInput"):Connect(layout)
	sheet:GetPropertyChangedSignal("AbsolutePosition"):Connect(function()
		gui:SetAttribute("TownSheetTop", if sheet.Visible then sheet.AbsolutePosition.Y else nil)
	end)

	local api = {}
	api.frame = sheet

	local headerId = ""
	function api.open(header: Header)
		if header.id ~= headerId then
			headerId = header.id
			accent = header.accent
			rule.BackgroundColor3 = accent
			gem.BackgroundColor3 = accent
			edge.Color = accent:Lerp(C.champagne, 0.5)
			tone.Color = ColorSequence.new(C.panelTop:Lerp(accent, 0.12), C.panel)
			disc.BackgroundColor3 = accent
			if discIcon then
				discIcon:Destroy()
			end
			discIcon = Glyphs.mount(disc, header.icon, 20, C.ink, UDim2.new(0.5, -10, 0.5, -10))
			shopName.Text = if #header.title <= 14
				then Style.spaced(header.title)
				else string.upper(header.title)
			gameName.Text = header.game
		end
		if not showing then
			showing = true
			sheet.Visible = true
			layout()
			if not Style.reduced() then
				local home = sheet.Position
				sheet.Position = home + UDim2.fromOffset(0, 40)
				Style.tween(sheet, 0.32, { Position = home }, Enum.EasingStyle.Back)
			end
		end
	end
	function api.close()
		showing = false
		sheet.Visible = false
		completed = false
		done.Visible = false
		gui:SetAttribute("TownSheetTop", nil)
		if GuiService.SelectedObject and GuiService.SelectedObject:IsDescendantOf(sheet) then
			GuiService.SelectedObject = nil
		end
	end
	function api.isOpen(): boolean
		return showing
	end
	function api.copy(k: string, t: string, n: string)
		kicker.Text = k
		title.Text = t
		note.Text = n
	end
	function api.note(text: string)
		note.Text = text
	end
	function api.kicker(text: string)
		kicker.Text = text
	end
	function api.title(text: string)
		title.Text = text
	end
	function api.steps(total: number, filled: number)
		for i = 1, math.max(total, #dotFrames) do
			local d = dotFrames[i]
			if i <= total and not d then
				d = Style.frame(dots, "Step", C.panelDeep)
				d.LayoutOrder = i
				d.Size = UDim2.fromOffset(12, 12)
				Style.corner(d, 999)
				Style.stroke(d, C.champagne, 1.5, 0.3)
				dotFrames[i] = d
			end
			if d then
				d.Visible = i <= total
				local on = i <= filled
				d.BackgroundColor3 = if on then accent else C.panelDeep
				d.Size = if i == filled + 1 then UDim2.fromOffset(14, 14) else UDim2.fromOffset(12, 12)
			end
		end
		dots.Visible = total > 0
	end
	function api.listen(fraction: number?)
		if meter.Visible ~= (fraction ~= nil) then
			meter.Visible = fraction ~= nil
			layout()
		end
		if fraction then
			meterFill.Size = UDim2.fromScale(math.clamp(fraction, 0, 1), 1)
			meterFill.BackgroundColor3 = accent
		end
	end
	function api.actions(list: { Action })
		table.clear(byKey)
		count = #list
		for i, a in list do
			local b = pool[i]
			if not b then
				local made = Style.button(actions, "Action", "", "secondary")
				made.LayoutOrder = i
				made.Activated:Connect(function()
					local run = handlers[i]
					if made.Visible and run then
						run()
					end
				end)
				pool[i] = made
				b = made
			end
			handlers[i] = a.run
			b.Text = a.text
			local kind: Style.Kind = a.kind or "secondary"
			Style.paint(b, kind, if kind == "primary" then accent else nil)
			if b:GetAttribute("TownGlyph") ~= a.glyph then
				Style.buttonGlyph(b, a.glyph)
			end
			Style.tintGlyph(b)
			Style.setHot(b, false)
			b.Visible = true
			if a.key then
				byKey[a.key] = b
			end
		end
		for i = #list + 1, #pool do
			pool[i].Visible = false
			handlers[i] = nil
		end
		actions.Visible = not completed
		layout()
		if Input.PreferredInput == Enum.PreferredInput.Gamepad and showing then
			local selected = GuiService.SelectedObject
			if not selected or not selected:IsDescendantOf(sheet) or not (selected :: GuiObject).Visible then
				GuiService.SelectedObject = if count > 0 then pool[1] else close
			end
		end
	end
	function api.hot(key: string, on: boolean)
		local b = byKey[key]
		if b then
			Style.setHot(b, on)
		end
	end
	-- Pop + sparkle for a right pick; burst from the newest filled step dot (or the title).
	function api.good(step: number?)
		Style.click("confirm")
		local origin: GuiObject = if step and dotFrames[step] then dotFrames[step] else title
		if step and dotFrames[step] then
			Style.pop(dotFrames[step], 0.4)
		end
		if Style.reduced() then
			return
		end
		local centre = origin.AbsolutePosition + origin.AbsoluteSize / 2 - sheet.AbsolutePosition
		local k = scale.Scale
		for i = 1, 8 do
			local angle = (i / 8) * math.pi * 2 + 0.3
			local spark = Style.frame(sheet, "Sparkle", if i % 2 == 0 then accent else C.bulb)
			spark.AnchorPoint = Vector2.new(0.5, 0.5)
			spark.Rotation = 45
			spark.Size = UDim2.fromOffset(7, 7)
			spark.ZIndex = 8
			spark.Position = UDim2.fromOffset(centre.X / k, centre.Y / k)
			local reach = 26 + (i % 3) * 6
			local t =
				Tween:Create(spark, TweenInfo.new(0.45, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
					Position = UDim2.fromOffset(
						centre.X / k + math.cos(angle) * reach,
						centre.Y / k + math.sin(angle) * reach
					),
					BackgroundTransparency = 1,
					Size = UDim2.fromOffset(3, 3),
				})
			t.Completed:Once(function()
				spark:Destroy()
			end)
			t:Play()
		end
	end
	-- Shake and a red flash on the trim for a wrong pick.
	function api.bad()
		Style.shake(body)
		edge.Color = C.bad
		edge.Thickness = 3
		note.TextColor3 = C.bad
		task.delay(0.6, function()
			edge.Color = accent:Lerp(C.champagne, 0.5)
			edge.Thickness = 1.5
			note.TextColor3 = Color3.fromRGB(226, 222, 244)
		end)
	end
	-- Completion card. The actions grid is replaced with one row of follow-up actions.
	function api.complete(heading: string, result: string, reward: string, follow: { Action })
		local first = not completed
		completed = true
		done.Visible = true
		kicker.Visible = false
		title.Visible = false
		note.Visible = false
		doneTitle.Text = heading
		doneResult.Text = result
		chipText.Text = reward
		chip.Visible = reward ~= ""
		doneDisc.BackgroundColor3 = accent
		api.actions(follow)
		actions.Visible = true
		if first then
			Style.pop(doneDisc, 0.3)
			Style.pop(chip, 0.6)
			api.good(nil)
		end
	end
	function api.resume()
		if completed then
			completed = false
			done.Visible = false
			kicker.Visible = true
			title.Visible = true
			note.Visible = true
		end
	end
	function api.isComplete(): boolean
		return completed
	end
	Input.InputBegan:Connect(function(input, used)
		if
			not showing
			or used
			or Input:GetFocusedTextBox()
			or input.UserInputType ~= Enum.UserInputType.Keyboard
		then
			return
		end
		local index = table.find(keys, input.KeyCode)
		if index and index <= count and pool[index] and pool[index].Visible and handlers[index] then
			handlers[index]()
		end
	end)
	layout()
	return api
end
return Sheet
