--!strict
-- The show HUD: top-right navigation pills and the ControlDesk sheet that every show, menu and counter
-- page draws into. Visuals come from UITheme; layout is in design px (screen px / UIScale).
local GuiService = game:GetService("GuiService")
local Input = game:GetService("UserInputService")
local Text = game:GetService("TextService")
local UITheme = require(script.Parent.UITheme)
local Hud = {}
export type PillState = {
	text: string,
	icon: string?,
	dot: string?, -- nil | "live" (static dot) | "pulse" (pulsing halo)
	pulse: boolean?, -- gentle attention pulse on the whole pill
	variant: string?,
	compact: boolean?, -- icon only (the label stays in the ActionLabel attribute)
}
local C = UITheme.Color
local F = UITheme.Font

-- Score bands: colour plus a written band name and a tier label, so colour is never the only signal.
local tierColours = {
	[0] = C.powder,
	[1] = C.harbor:Lerp(C.cream, 0.45),
	[2] = C.bulb,
	[3] = C.petal,
}

function Hud.new(parent: PlayerGui)
	local gui = Instance.new("ScreenGui")
	gui.Name = "DeliveryShow"
	gui.ResetOnSpawn = false
	gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	gui.ScreenInsets = Enum.ScreenInsets.CoreUISafeInsets
	gui.Parent = parent

	-- Town modules may parent here; it draws under the nav and the desk.
	local townLayer = Instance.new("Frame")
	townLayer.Name = "TownLayer"
	townLayer.BackgroundTransparency = 1
	townLayer.Size = UDim2.fromScale(1, 1)
	townLayer.ZIndex = 1
	townLayer.Parent = gui

	-- Navigation pills ----------------------------------------------------------------------
	local nav = Instance.new("Frame")
	nav.Name = "ShowNavigation"
	nav.BackgroundTransparency = 1
	nav.AnchorPoint = Vector2.new(1, 0)
	nav.Position = UDim2.new(1, -10, 0, 8)
	nav.AutomaticSize = Enum.AutomaticSize.X
	nav.Size = UDim2.fromOffset(0, 48)
	nav.ZIndex = 5
	nav.Parent = gui
	local navScale = UITheme.attachScale(nav)
	local navList = Instance.new("UIListLayout")
	navList.FillDirection = Enum.FillDirection.Horizontal
	navList.HorizontalAlignment = Enum.HorizontalAlignment.Right
	navList.VerticalAlignment = Enum.VerticalAlignment.Center
	navList.SortOrder = Enum.SortOrder.LayoutOrder
	navList.Padding = UDim.new(0, 8)
	navList.Parent = nav
	local navRole = UITheme.button(nav, { name = "SeatAction", pill = true, layoutOrder = 1, icon = "play" })
	local navTown = UITheme.button(nav, { name = "BackToTown", pill = true, layoutOrder = 2, icon = "home" })
	navTown.Text = "Town"
	navTown.Visible = false
	local navMenu =
		UITheme.button(nav, { name = "ShowMenu", pill = true, layoutOrder = 3, icon = "settings" })
	navMenu.Text = "Menu"
	local roleRow = navRole:FindFirstChild("Face") and (navRole :: any).Face:FindFirstChild("Row")
	local liveDot, setLiveDot = UITheme.liveDot(roleRow or navRole, 12)
	liveDot.LayoutOrder = 1
	local function publishNav()
		gui:SetAttribute("HudNavWidth", if nav.Visible then math.ceil(nav.AbsoluteSize.X + 10) else 0)
	end
	nav:GetPropertyChangedSignal("AbsoluteSize"):Connect(publishNav)
	nav:GetPropertyChangedSignal("Visible"):Connect(publishNav)

	-- ControlDesk sheet ---------------------------------------------------------------------
	local panel = UITheme.panel(gui, "ControlDesk")
	panel.AnchorPoint = Vector2.new(0.5, 1)
	panel.Position = UDim2.new(0.5, 0, 1, -8)
	panel.ZIndex = 4
	panel.Active = true
	local deskScale = UITheme.attachScale(panel)
	local ribbon, phase = UITheme.ribbon(panel, "")
	phase.Name = "Phase"
	ribbon.Position = UDim2.fromOffset(14, -14)
	local ribbonCap = Instance.new("UISizeConstraint")
	ribbonCap.MaxSize = Vector2.new(600, 28)
	ribbonCap.Parent = ribbon
	local ring = UITheme.ring(panel, 44, 4)
	ring.frame.AnchorPoint = Vector2.new(0.5, 0.5)
	local timer = ring.label

	local face = Instance.new("ScrollingFrame")
	face.Name = "CueCard"
	face.BorderSizePixel = 0
	face.BackgroundColor3 = C.paper
	face.ScrollingDirection = Enum.ScrollingDirection.Y
	face.ScrollBarImageColor3 = C.lacquer
	face.ScrollBarThickness = 3
	face.CanvasSize = UDim2.fromOffset(0, 0)
	face.ZIndex = 2
	face.Parent = panel
	UITheme.corner(face, UITheme.Radius.card)
	UITheme.stroke(face, C.champagne, 1.5, 0.1)
	UITheme.gradient(face, Color3.new(1, 1, 1), Color3.new(0.95, 0.93, 0.9))
	local stripe = Instance.new("Frame")
	stripe.Name = "BrassEdge"
	stripe.BorderSizePixel = 0
	stripe.BackgroundColor3 = C.champagne
	stripe.Size = UDim2.new(0, 4, 1, -20)
	stripe.Position = UDim2.fromOffset(6, 10)
	stripe.ZIndex = 3
	UITheme.corner(stripe, 2)
	stripe.Parent = face
	local kicker = UITheme.label(face, {
		name = "CardType",
		font = F.heading,
		size = 16,
		color = C.lacquer,
		wrap = false,
		z = 3,
	})
	kicker.Position = UDim2.fromOffset(18, 6)
	kicker.Size = UDim2.new(1, -30, 0, 20)
	kicker.TextTruncate = Enum.TextTruncate.AtEnd
	local card = UITheme.label(face, {
		name = "Card",
		font = F.heading,
		size = 32,
		color = C.ink,
		scaled = true,
		min = 16,
		alignY = Enum.TextYAlignment.Top,
		z = 3,
	})
	local cardSize = card:FindFirstChildOfClass("UITextSizeConstraint") :: UITextSizeConstraint
	local note = UITheme.label(face, {
		name = "Direction",
		font = F.body,
		size = 18,
		color = C.midnight,
		scaled = true,
		min = 16,
		alignY = Enum.TextYAlignment.Top,
		z = 3,
	})

	-- Score plate: shown over the headline during the reveal.
	local plate = Instance.new("Frame")
	plate.Name = "ScorePlate"
	plate.BackgroundTransparency = 1
	plate.Visible = false
	plate.ZIndex = 3
	plate.Parent = face
	local scoreNumber = UITheme.label(plate, {
		name = "Score",
		font = F.display,
		size = 60,
		color = C.ink,
		scaled = true,
		min = 24,
		wrap = false,
		z = 4,
	})
	scoreNumber.Size = UDim2.new(0, 120, 1, 0)
	local outOf = UITheme.label(plate, {
		name = "OutOf",
		text = "/100",
		font = F.bold,
		size = 16,
		color = C.midnight,
		wrap = false,
		alignY = Enum.TextYAlignment.Bottom,
		z = 4,
	})
	outOf.Size = UDim2.fromOffset(44, 22)
	local chips = Instance.new("Frame")
	chips.Name = "Chips"
	chips.BackgroundTransparency = 1
	chips.ZIndex = 4
	chips.Parent = plate
	local chipList = Instance.new("UIListLayout")
	chipList.FillDirection = Enum.FillDirection.Vertical
	chipList.VerticalAlignment = Enum.VerticalAlignment.Center
	chipList.SortOrder = Enum.SortOrder.LayoutOrder
	chipList.Padding = UDim.new(0, 6)
	chipList.Parent = chips
	local bandChip = UITheme.chip(chips, "", { icon = "award" })
	bandChip.Name = "Band"
	bandChip.LayoutOrder = 1
	local rewardChip = UITheme.chip(chips, "", { icon = "star", color = C.cream })
	rewardChip.Name = "Reward"
	rewardChip.LayoutOrder = 2
	UITheme.stroke(rewardChip, C.champagne, 1.5, 0)
	local function chipText(chip: Frame): TextLabel
		return chip:FindFirstChild("Text") :: TextLabel
	end

	local controls = Instance.new("ScrollingFrame")
	controls.Name = "Actions"
	controls.BackgroundTransparency = 1
	controls.BorderSizePixel = 0
	controls.ScrollBarThickness = 4
	controls.ScrollBarImageColor3 = C.champagne
	controls.CanvasSize = UDim2.new()
	controls.AutomaticCanvasSize = Enum.AutomaticSize.Y
	controls.ScrollingDirection = Enum.ScrollingDirection.Y
	controls.ZIndex = 2
	controls.Parent = panel
	local controlPad = Instance.new("UIPadding")
	controlPad.PaddingTop = UDim.new(0, 2)
	controlPad.PaddingBottom = UDim.new(0, 4)
	controlPad.PaddingLeft = UDim.new(0, 2)
	controlPad.PaddingRight = UDim.new(0, 2)
	controlPad.Parent = controls
	local standby = Instance.new("Frame")
	standby.Name = "NextCue"
	standby.BorderSizePixel = 0
	standby.BackgroundColor3 = C.panelRaised
	standby.BackgroundTransparency = 0.35
	standby.ZIndex = 2
	standby.Parent = panel
	UITheme.corner(standby, UITheme.Radius.card)
	UITheme.stroke(standby, C.powder, 1, 0.55)
	local nextLabel = UITheme.label(standby, {
		name = "NextLabel",
		text = "UP NEXT",
		font = F.heading,
		size = 16,
		color = C.champagne,
		wrap = false,
		z = 3,
	})
	nextLabel.Position = UDim2.fromOffset(14, 8)
	nextLabel.Size = UDim2.new(1, -28, 0, 18)
	local nextCue = UITheme.label(standby, {
		name = "Instruction",
		font = F.bold,
		size = 19,
		color = C.cream,
		scaled = true,
		min = 16,
		alignY = Enum.TextYAlignment.Top,
		z = 3,
	})
	nextCue.Position = UDim2.fromOffset(14, 28)
	nextCue.Size = UDim2.new(1, -28, 1, -34)
	local grid = Instance.new("UIGridLayout")
	grid.SortOrder = Enum.SortOrder.LayoutOrder
	grid.CellPadding = UDim2.fromOffset(8, 8)
	grid.Parent = controls

	local buttons: { TextButton } = {}
	local handlers: { () -> () } = {}
	local count = 0
	local menu = false
	local layoutKey = ""
	local freshKey = false
	local touchFree = false
	local wantPanel = false
	local closing = false
	local keyboard = Input.PreferredInput == Enum.PreferredInput.KeyboardAndMouse
	local keys = { Enum.KeyCode.One, Enum.KeyCode.Two, Enum.KeyCode.Three, Enum.KeyCode.Four }
	local short = false
	local designScale = UITheme.currentScale()

	-- Measure each string at a readable size. Unusually long transcripts and badge lists can scroll.
	local function fitCard()
		local k = math.max(deskScale.Scale, 0.1)
		local viewport = face.AbsoluteSize / k
		if viewport.X < 32 or viewport.Y < 27 then
			return
		end
		local width = Vector2.new(math.max(1, viewport.X - 32), 16384)
		local function textHeight(item: TextLabel, size: number): number
			if item.Text == "" then
				return 0
			end
			local ok, bounds = pcall(Text.GetTextSize, Text, item.Text, size, item.Font, width)
			return if ok then math.ceil(bounds.Y * 1.08) + 4 else size * 2
		end
		local top = 28
		local usable = math.max(0, math.floor(viewport.Y) - top - 6)
		local noteHeight = if note.Text == ""
			then 0
			else math.min(math.max(textHeight(note, 16), 22), math.floor(usable * 0.48))
		local cardHeight = math.max(textHeight(card, 16), usable - noteHeight)
		if plate.Visible then
			cardHeight = math.max(cardHeight, 52)
		end
		card.Position = UDim2.fromOffset(18, top)
		card.Size = UDim2.new(1, -30, 0, cardHeight)
		plate.Position = card.Position
		plate.Size = card.Size
		note.Position = UDim2.fromOffset(18, top + cardHeight + 2)
		note.Size = UDim2.new(1, -30, 0, noteHeight)
		local contentHeight = top + cardHeight + noteHeight + 8
		face.CanvasSize = UDim2.fromOffset(0, contentHeight)
		face.ScrollingEnabled = contentHeight > viewport.Y + 1
		if not face.ScrollingEnabled then
			face.CanvasPosition = Vector2.zero
		end
		-- The score number takes the plate height; the chips sit to its right.
		local plateHeight = cardHeight
		local numberSize = math.clamp(math.floor(plateHeight * 0.95), 28, 64)
		scoreNumber.Size = UDim2.fromOffset(math.floor(numberSize * 1.75), plateHeight)
		outOf.Position = UDim2.fromOffset(math.floor(numberSize * 1.75) + 2, math.max(0, plateHeight - 30))
		chips.Position = UDim2.fromOffset(math.floor(numberSize * 1.75) + 50, 0)
		chips.Size = UDim2.new(1, -(math.floor(numberSize * 1.75) + 50), 1, 0)
	end
	local fitQueued = false
	local function queueFit()
		if fitQueued then
			return
		end
		fitQueued = true
		task.defer(function()
			fitQueued = false
			fitCard()
		end)
	end
	card:GetPropertyChangedSignal("Text"):Connect(queueFit)
	note:GetPropertyChangedSignal("Text"):Connect(queueFit)
	face:GetPropertyChangedSignal("AbsoluteSize"):Connect(queueFit)

	local function publishDesk()
		gui:SetAttribute(
			"HudDeskTop",
			if panel.Visible then math.floor(panel.AbsolutePosition.Y - gui.AbsolutePosition.Y) else nil
		)
	end
	panel:GetPropertyChangedSignal("AbsolutePosition"):Connect(publishDesk)
	panel:GetPropertyChangedSignal("Visible"):Connect(publishDesk)

	local function layout()
		local k = UITheme.currentScale()
		designScale = k
		deskScale.Scale = k
		navScale.Scale = k
		local camera = workspace.CurrentCamera
		local screen = if camera then camera.ViewportSize else gui.AbsoluteSize
		local size = gui.AbsoluteSize
		local w, h = size.X / k, size.Y / k
		local screenH = screen.Y / k
		local bh = UITheme.touchHeight()
		local portrait = w < 560 and h > w
		short = h < 430 and not portrait
		local header = if short then 16 else 22
		local rowsFor = function(cols: number): number
			return math.max(1, math.ceil(count / cols))
		end
		local function actionHeight(rows: number): number
			if count == 0 then
				return if nextCue.Text ~= "" then 64 else 0
			end
			return rows * bh + (rows - 1) * 8
		end
		local cols = if count <= 1 then 1 else 2
		local pw, ph
		local ringSize = if short then 40 else 44
		if portrait then
			pw = w - 16
			local cardHeight = if menu then 112 else 122
			local rows = math.min(rowsFor(cols), if menu then 4 else 3)
			local need = header + cardHeight + 8 + actionHeight(rows) + 10
			ph = math.min(need, screenH * (if menu then 0.62 else 0.5), h - 70)
			face.Position = UDim2.fromOffset(10, header)
			face.Size = UDim2.new(1, -20, 0, cardHeight)
			controls.Position = UDim2.fromOffset(8, header + cardHeight + 8)
			controls.Size = UDim2.new(1, -16, 1, -(header + cardHeight + 16))
			if touchFree then
				panel.AnchorPoint = Vector2.new(0.5, 0)
				panel.Position = UDim2.new(0.5, 0, 0, math.floor((bh + 26) * k))
			else
				panel.AnchorPoint = Vector2.new(0.5, 1)
				panel.Position = UDim2.new(0.5, 0, 1, -math.floor(8 * k))
			end
		else
			-- Leave the thumbstick (bottom-left) and jump button (bottom-right) clear while walking is on.
			local left = if touchFree then math.clamp(w * 0.28, 170, 300) else 10
			local right = if touchFree then 104 else 10
			pw = math.min(w - left - right, if menu then 1000 else 960)
			local centre = left + (w - left - right) / 2
			local split = if menu then 0.46 elseif short then 0.5 else 0.54
			local actionsWidth = pw * (1 - split) - 14
			if menu and count > 4 and actionsWidth >= 450 then
				cols = 3
			end
			local rows = rowsFor(cols)
			local cardMin = if short then 96 else 124
			local need = header + math.max(cardMin, actionHeight(rows)) + 10
			local cap = if short
				then screenH * (if menu then 0.62 else 0.40)
				else math.min(screenH * (if menu then 0.5 else 0.36), if menu then 420 else 300)
			ph = math.clamp(need, math.min(header + cardMin + 10, cap), cap)
			face.Position = UDim2.fromOffset(10, header)
			face.Size = UDim2.new(split, -14, 1, -(header + 10))
			controls.Position = UDim2.new(split, 2, 0, header - 2)
			controls.Size = UDim2.new(1 - split, -10, 1, -(header + 6))
			panel.AnchorPoint = Vector2.new(0.5, 1)
			panel.Position = UDim2.new(0, math.floor(centre * k), 1, -math.floor(8 * k))
		end
		panel.Size = UDim2.fromOffset(math.floor(pw), math.floor(ph))
		if panel:GetAttribute("ThemeRestPosition") ~= nil then
			-- A resize mid-motion lands the sheet at its new rest spot (and finishes a close).
			UITheme.cancel(panel)
			panel:SetAttribute("ThemeRestPosition", nil)
			if closing then
				closing = false
				panel.Visible = false
			end
		end
		ring.frame.Size = UDim2.fromOffset(ringSize, ringSize)
		ring.frame.Position = UDim2.new(1, -(12 + math.floor(ringSize / 2)), 0, 4)
		ring.label.TextSize = math.floor(ringSize * 0.44)
		ribbonCap.MaxSize = Vector2.new(math.max(120, pw - ringSize - 52), 28)
		cardSize.MaxTextSize = if short then 28 else 34
		standby.Position = controls.Position
		standby.Size = controls.Size
		queueFit()
		grid.CellSize =
			UDim2.new(1 / cols, if cols == 1 then -4 else -math.ceil(8 * (cols - 1) / cols) - 2, 0, bh)
		for _, pill in { navRole, navMenu, navTown } do
			pill.Size = UDim2.fromOffset(pill.Size.X.Offset, bh)
		end
		nav.Size = UDim2.fromOffset(0, bh)
		publishNav()
	end
	local function begin(key: string, inMenu: boolean)
		menu = inMenu
		nextCue.Text = ""
		count = 0
		freshKey = key ~= layoutKey
		if freshKey then
			controls.CanvasPosition = Vector2.zero
			face.CanvasPosition = Vector2.zero
			layoutKey = key
		end
	end
	local function button(text: string, run: () -> (), primary: boolean?, icon: string?)
		count += 1
		local slot = count
		local b = buttons[slot]
		if not b then
			local made = UITheme.button(controls, { name = "Action", layoutOrder = slot })
			made.Activated:Connect(function()
				if made.Visible and handlers[slot] and UITheme.isEnabled(made) then
					local tag = made:GetAttribute("ThemeIcon")
					if type(tag) == "string" and string.sub(tag, 1, 6) == "emoji-" then
						UITheme.pop(made, 0.16)
					end
					handlers[slot]()
				end
			end)
			buttons[slot] = made
			b = made
		end
		handlers[slot] = run
		UITheme.setVariant(b, if primary then "primary" else "secondary")
		UITheme.setHot(b, false)
		UITheme.setEnabled(b, true)
		UITheme.setIcon(b, icon)
		UITheme.setKey(b, if keyboard and slot <= 4 then tostring(slot) else nil)
		b.Text = text
		b:SetAttribute("ActionLabel", text)
		b:SetAttribute("Primary", primary == true)
		if freshKey and not b.Visible then
			task.delay((slot - 1) * 0.03, function()
				if b.Visible then
					UITheme.pop(b, -0.1)
				end
			end)
		end
		b.Visible = true
		return b
	end
	local function focusGamepad()
		if Input.PreferredInput ~= Enum.PreferredInput.Gamepad or GuiService.MenuIsOpen then
			return
		end
		local selected = GuiService.SelectedObject
		if selected then
			if not selected:IsDescendantOf(gui) then
				return
			end
			local ancestor: Instance? = selected
			while ancestor and ancestor ~= gui do
				if ancestor:IsA("GuiObject") and not ancestor.Visible then
					break
				end
				ancestor = ancestor.Parent
			end
			if ancestor == gui then
				return
			end
		end
		GuiService.SelectedObject = if wantPanel and count > 0
			then buttons[1]
			elseif nav.Visible and navMenu.Visible then navMenu
			elseif nav.Visible and navRole.Visible then navRole
			else nil
	end
	local function applyPanel()
		if wantPanel and (closing or not panel.Visible) then
			closing = false
			UITheme.openPanel(panel, "slide")
		elseif not wantPanel and panel.Visible and not closing then
			closing = true
			UITheme.closePanel(panel, function()
				closing = false
			end)
		end
	end
	local function finish()
		standby.Visible = count == 0 and nextCue.Text ~= ""
		controls.Visible = count > 0
		for i = count + 1, #buttons do
			buttons[i].Visible = false
		end
		layout()
		applyPanel()
		focusGamepad()
	end
	Input:GetPropertyChangedSignal("PreferredInput"):Connect(function()
		keyboard = Input.PreferredInput == Enum.PreferredInput.KeyboardAndMouse
		focusGamepad()
		for i = 1, count do
			UITheme.setKey(buttons[i], if keyboard and i <= 4 then tostring(i) else nil)
		end
	end)
	Input.InputBegan:Connect(function(input, used)
		if
			not panel.Visible
			or used
			or Input:GetFocusedTextBox()
			or input.UserInputType ~= Enum.UserInputType.Keyboard
		then
			return
		end
		local index = table.find(keys, input.KeyCode)
		if index and index <= count and buttons[index].Visible and UITheme.isEnabled(buttons[index]) then
			UITheme.click("tap")
			UITheme.pop(buttons[index], -0.06)
			handlers[index]()
		end
	end)
	gui:GetPropertyChangedSignal("AbsoluteSize"):Connect(layout)
	UITheme.onScale(function()
		layout()
	end)
	layout()

	-- Nav pill: label, icon, live dot and attention pulse in one call.
	local function pill(b: TextButton, state: PillState)
		b:SetAttribute("ActionLabel", state.text)
		b.Text = if state.compact and state.icon then "" else state.text
		local f = b:FindFirstChild("Face")
		local row = f and f:FindFirstChild("Row")
		local label = row and row:FindFirstChild("Label")
		if label and label:IsA("TextLabel") then
			label.Visible = not (state.compact and state.icon)
		end
		local pad = row and row:FindFirstChildOfClass("UIPadding")
		if pad then
			local tight = state.compact and state.icon ~= nil
			pad.PaddingLeft = UDim.new(0, if tight then 13 else 16)
			pad.PaddingRight = UDim.new(0, if tight then 13 else 18)
		end
		UITheme.setVariant(b, state.variant or "secondary")
		UITheme.setIcon(b, if state.dot then nil else state.icon)
		if b == navRole then
			setLiveDot(state.dot ~= nil, state.dot == "pulse")
		end
		UITheme.pulse(b, state.pulse == true)
	end

	local lastScoreKey: string? = nil
	local cancelCount: (() -> ())? = nil
	local function score(value: number?, band: string?, tier: number?, key: string?, reward: string?)
		if value == nil then
			if plate.Visible then
				plate.Visible = false
				card.Visible = true
				queueFit()
			end
			lastScoreKey = nil
			return
		end
		local colour = tierColours[math.clamp(tier or 0, 0, 3)] or C.powder
		bandChip.BackgroundColor3 = colour
		chipText(bandChip).Text = band or ""
		bandChip.Visible = band ~= nil and band ~= ""
		chipText(rewardChip).Text = reward or ""
		rewardChip.Visible = reward ~= nil and reward ~= ""
		if not plate.Visible then
			plate.Visible = true
			card.Visible = false
			queueFit()
		end
		local id = key or tostring(value)
		if id ~= lastScoreKey then
			lastScoreKey = id
			if cancelCount then
				cancelCount()
			end
			cancelCount = UITheme.countUp(scoreNumber, 0, value, 1.1)
			task.delay(if UITheme.reducedMotion() then 0 else 1.1, function()
				if lastScoreKey == id then
					UITheme.pop(bandChip, 0.18)
				end
			end)
		else
			if not cancelCount then
				scoreNumber.Text = tostring(value)
			end
		end
	end

	local lastWhole = -1
	return {
		gui = gui,
		panel = panel,
		phase = phase,
		timer = timer,
		kicker = kicker,
		card = card,
		note = note,
		navRole = navRole,
		navMenu = navMenu,
		navTown = navTown,
		nav = nav,
		nextCue = nextCue,
		layers = { town = townLayer },
		begin = begin,
		button = button,
		finish = finish,
		buttons = buttons,
		pill = pill,
		score = score,
		hot = UITheme.setHot,
		-- Main decides visibility; the open and close motion runs on the next finish().
		showPanel = function(visible: boolean)
			wantPanel = visible
		end,
		-- True while the thumbstick is on: the desk then avoids the touch thumb zones.
		setTouchFree = function(free: boolean)
			local value = free and UITheme.isTouch()
			if value ~= touchFree then
				touchFree = value
				layout()
			end
		end,
		isShort = function(): boolean
			return short
		end,
		scale = function(): number
			return designScale
		end,
		clock = function(seconds: number?, span: number)
			ring.frame.Visible = seconds ~= nil
			if seconds then
				local left = math.max(seconds, 0)
				local whole = math.ceil(left)
				ring.set(left / math.max(span, 1), tostring(whole))
				local urgent = left <= 3.05 and left > 0
				ring.setColor(if urgent then C.live else C.bulb)
				timer.TextColor3 = if urgent then C.bulb else C.cream
				if urgent and whole ~= lastWhole then
					UITheme.pop(ring.frame, 0.12)
				end
				lastWhole = whole
			else
				timer.Text = ""
				lastWhole = -1
			end
		end,
	}
end
return Hud
