--!strict
local GuiService = game:GetService("GuiService")
local Input = game:GetService("UserInputService")
local Text = game:GetService("TextService")
local ShowIcons = require(script.Parent.ShowIcons)
local Hud = {}
local ink = Color3.fromRGB(26, 22, 36)
local shell = Color3.fromRGB(32, 26, 43)
local velvet = Color3.fromRGB(63, 47, 80)
local paper = Color3.fromRGB(255, 244, 218)
local cream = Color3.fromRGB(251, 240, 221)
local gold = Color3.fromRGB(255, 207, 107)
local plum = Color3.fromRGB(88, 58, 101)
local violet = Color3.fromRGB(193, 152, 242)

local function corners(parent: GuiObject, radius: number)
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, radius)
	corner.Parent = parent
end
local function outline(parent: GuiObject, colour: Color3, transparency: number)
	local edge = Instance.new("UIStroke")
	edge.Color = colour
	edge.Transparency = transparency
	edge.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	edge.Parent = parent
end
local function frame(parent: Instance, name: string, colour: Color3)
	local item = Instance.new("Frame")
	item.Name = name
	item.BorderSizePixel = 0
	item.BackgroundColor3 = colour
	item.Parent = parent
	return item
end
local function label(parent: Instance, name: string, colour: Color3, font: Enum.Font, max: number)
	local item = Instance.new("TextLabel")
	item.Name = name
	item.Text = ""
	item.BackgroundTransparency = 1
	item.TextColor3 = colour
	item.Font = font
	item.TextScaled = true
	item.TextWrapped = true
	item.TextXAlignment = Enum.TextXAlignment.Left
	local bounds = Instance.new("UITextSizeConstraint")
	bounds.MinTextSize = 11
	bounds.MaxTextSize = max
	bounds.Parent = item
	item.Parent = parent
	return item
end
local function push(parent: Instance, name: string)
	local b = Instance.new("TextButton")
	b.Name = name
	b.AutoButtonColor = true
	b.Selectable = true
	b.TextWrapped = true
	b.Font = Enum.Font.GothamBold
	b.TextSize = 14
	b.BackgroundColor3 = velvet
	b.TextColor3 = cream
	b.BorderSizePixel = 0
	corners(b, 7)
	outline(b, violet, 0.67)
	b.Parent = parent
	return b
end

function Hud.new(parent: PlayerGui)
	local gui = Instance.new("ScreenGui")
	gui.Name = "DeliveryShow"
	gui.ResetOnSpawn = false
	gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	gui.Parent = parent
	local nav = frame(gui, "ShowNavigation", shell)
	nav.AnchorPoint = Vector2.new(1, 0)
	nav.Position = UDim2.new(1, -12, 0, 6)
	nav.Size = UDim2.fromOffset(210, 48)
	corners(nav, 10)
	outline(nav, violet, 0.47)
	local navRole = push(nav, "SeatAction")
	navRole.Size = UDim2.fromOffset(124, 44)
	navRole.Position = UDim2.fromOffset(2, 2)
	navRole.BackgroundColor3 = plum
	local navMenu = push(nav, "ShowMenu")
	navMenu.Size = UDim2.fromOffset(80, 44)
	navMenu.Position = UDim2.fromOffset(128, 2)
	navMenu.Text = "Menu"

	local panel = frame(gui, "ControlDesk", shell)
	panel.AnchorPoint = Vector2.new(0.5, 1)
	panel.Position = UDim2.new(0.5, 0, 1, -8)
	corners(panel, 12)
	outline(panel, Color3.fromRGB(187, 145, 138), 0.27)
	local limit = Instance.new("UISizeConstraint")
	limit.MaxSize = Vector2.new(1030, 340)
	limit.Parent = panel
	local phase = label(panel, "Phase", gold, Enum.Font.GothamBold, 14)
	phase.Position = UDim2.fromOffset(14, 3)
	phase.Size = UDim2.new(1, -98, 0, 26)
	local timer = label(panel, "Clock", cream, Enum.Font.Code, 17)
	timer.AnchorPoint = Vector2.new(1, 0)
	timer.Position = UDim2.new(1, -13, 0, 3)
	timer.Size = UDim2.fromOffset(68, 26)
	timer.TextXAlignment = Enum.TextXAlignment.Right

	local backing = frame(panel, "VioletBacking", plum)
	corners(backing, 7)
	local face = Instance.new("ScrollingFrame")
	face.Name = "CueCard"
	face.BorderSizePixel = 0
	face.BackgroundColor3 = paper
	face.ScrollingDirection = Enum.ScrollingDirection.Y
	face.ScrollBarImageColor3 = plum
	face.ScrollBarThickness = 3
	face.CanvasSize = UDim2.fromOffset(0, 0)
	face.Parent = panel
	corners(face, 7)
	local stripe = frame(face, "BrassEdge", gold)
	stripe.Size = UDim2.new(0, 4, 1, -16)
	stripe.Position = UDim2.fromOffset(0, 8)
	local kicker = label(face, "CardType", plum, Enum.Font.GothamBold, 12)
	kicker.Position = UDim2.fromOffset(13, 4)
	kicker.Size = UDim2.new(1, -24, 0, 16)
	local card = label(face, "Card", ink, Enum.Font.GothamBlack, 32)
	local note = label(face, "Direction", plum, Enum.Font.GothamMedium, 16)
	local meter = frame(panel, "TimeTrack", velvet)
	meter.AnchorPoint = Vector2.new(0, 1)
	meter.Position = UDim2.new(0, 14, 1, -3)
	meter.Size = UDim2.new(1, -28, 0, 3)
	local fill = frame(meter, "TimeLeft", gold)
	fill.Size = UDim2.fromScale(1, 1)

	local controls = Instance.new("ScrollingFrame")
	controls.Name = "Actions"
	controls.BackgroundTransparency = 1
	controls.BorderSizePixel = 0
	controls.ScrollBarThickness = 4
	controls.ScrollBarImageColor3 = violet
	controls.CanvasSize = UDim2.new()
	controls.AutomaticCanvasSize = Enum.AutomaticSize.Y
	controls.ScrollingDirection = Enum.ScrollingDirection.Y
	controls.Parent = panel
	local standby = frame(panel, "NextCue", velvet)
	corners(standby, 7)
	local nextLabel = label(standby, "NextLabel", violet, Enum.Font.GothamBold, 12)
	nextLabel.Position = UDim2.fromOffset(12, 7)
	nextLabel.Size = UDim2.new(1, -24, 0, 16)
	nextLabel.Text = "UP NEXT"
	local nextCue = label(standby, "Instruction", cream, Enum.Font.GothamBold, 18)
	nextCue.Position = UDim2.fromOffset(12, 24)
	nextCue.Size = UDim2.new(1, -24, 1, -30)
	local grid = Instance.new("UIGridLayout")
	grid.SortOrder = Enum.SortOrder.LayoutOrder
	grid.CellPadding = UDim2.fromOffset(5, 5)
	grid.Parent = controls
	local buttons: { TextButton } = {}
	local handlers: { () -> () } = {}
	local count = 0
	local menu = false
	local layoutKey = ""
	local keyboard = Input.PreferredInput == Enum.PreferredInput.KeyboardAndMouse
	local keys = { Enum.KeyCode.One, Enum.KeyCode.Two, Enum.KeyCode.Three, Enum.KeyCode.Four }
	-- Measure each string at a readable size. Unusually long transcripts and badge lists can scroll.
	local function fitCard()
		local viewport = face.AbsoluteSize
		if viewport.X < 32 or viewport.Y < 27 then
			return
		end
		local width = Vector2.new(math.max(1, viewport.X - 31), 16384)
		local function textHeight(item, size)
			if item.Text == "" then
				return 0
			end
			return math.ceil(Text:GetTextSize(item.Text, size, item.Font, width).Y * 1.12) + 3
		end
		local usable = math.max(0, math.floor(viewport.Y) - 28)
		local noteHeight = math.max(textHeight(note, 13), math.floor(usable * 0.35))
		local cardHeight = math.max(textHeight(card, 15), usable - noteHeight)
		card.Position = UDim2.fromOffset(13, 20)
		card.Size = UDim2.new(1, -27, 0, cardHeight)
		note.Position = UDim2.fromOffset(13, 23 + cardHeight)
		note.Size = UDim2.new(1, -27, 0, noteHeight)
		local contentHeight = 28 + cardHeight + noteHeight
		face.CanvasSize = UDim2.fromOffset(0, contentHeight)
		face.ScrollingEnabled = contentHeight > viewport.Y + 1
		if not face.ScrollingEnabled then
			face.CanvasPosition = Vector2.zero
		end
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
	local function layout()
		local size = gui.AbsoluteSize
		local stacked = size.X < 530 and size.Y > size.X
		local short = size.Y < 430 and not stacked
		local rows = math.clamp(math.ceil(count / 2), 1, if menu then 5 else 2)
		local actionHeight = rows * 44 + (rows - 1) * 5
		if stacked then
			panel.Size = UDim2.new(0.965, 0, 0, math.min(size.Y * 0.66, 158 + actionHeight))
			face.Position = UDim2.fromOffset(10, 31)
			face.Size = UDim2.new(1, -23, 0, 105)
			controls.Position = UDim2.fromOffset(10, 145)
			controls.Size = UDim2.new(1, -20, 1, -157)
		else
			local height = if short
				then math.clamp(41 + actionHeight, 162, math.min(224, math.max(162, size.Y - 52)))
				else math.max(156, 50 + actionHeight)
			panel.Size = UDim2.new(0.96, 0, 0, height)
			local split = if short then 0.51 else 0.56
			face.Position = UDim2.fromOffset(10, 31)
			face.Size = UDim2.new(split, -14, 1, -44)
			controls.Position = UDim2.new(split, 6, 0, 31)
			controls.Size = UDim2.new(1 - split, -18, 1, -38)
		end
		standby.Position = controls.Position
		standby.Size = controls.Size
		backing.Position = face.Position + UDim2.fromOffset(3, 3)
		backing.Size = face.Size
		queueFit()
		local cols = if count <= 1 then 1 else 2
		grid.CellSize = UDim2.new(1 / cols, if cols == 1 then -4 else -5, 0, 44)
	end
	local function begin(key: string, inMenu: boolean)
		menu = inMenu
		nextCue.Text = ""
		count = 0
		if key ~= layoutKey then
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
			b = push(controls, "Action")
			b.LayoutOrder = slot
			b.Activated:Connect(function()
				if b.Visible and handlers[slot] then
					handlers[slot]()
				end
			end)
			buttons[slot] = b
		end
		local prev = b:GetAttribute("IconName")
		local nextIcon = if icon then icon .. (if primary then "/gold" else "/velvet") else nil
		if prev ~= nextIcon then
			local old = b:FindFirstChild("Glyph")
			if old then
				old:Destroy()
			end
			local padding = b:FindFirstChildOfClass("UIPadding")
			if icon then
				local glyph =
					ShowIcons.mount(b, icon, 18, if primary then ink else cream, UDim2.new(0, 8, 0.5, -9))
				glyph.Name = "Glyph"
				if not padding then
					padding = Instance.new("UIPadding")
					padding.Parent = b
				end
				padding.PaddingLeft = UDim.new(0, 22)
				glyph.Position = UDim2.new(0, -14, 0.5, -9)
			elseif padding then
				padding:Destroy()
			end
			b:SetAttribute("IconName", nextIcon)
		end
		handlers[slot] = run
		b.Text = (if keyboard and slot <= 4 then tostring(slot) .. "  " else "") .. text
		b:SetAttribute("ActionLabel", text)
		b:SetAttribute("Primary", primary == true)
		b.BackgroundColor3 = if primary then gold else velvet
		b.TextColor3 = if primary then ink else cream
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
		GuiService.SelectedObject = if panel.Visible and count > 0
			then buttons[1]
			elseif nav.Visible and navMenu.Visible then navMenu
			elseif nav.Visible and navRole.Visible then navRole
			else nil
	end
	local function finish()
		standby.Visible = count == 0 and nextCue.Text ~= ""
		controls.Visible = count > 0
		for i = count + 1, #buttons do
			buttons[i].Visible = false
		end
		layout()
		focusGamepad()
	end
	Input:GetPropertyChangedSignal("PreferredInput"):Connect(function()
		keyboard = Input.PreferredInput == Enum.PreferredInput.KeyboardAndMouse
		focusGamepad()
		for i = 1, count do
			local b = buttons[i]
			b.Text = (if keyboard and i <= 4 then tostring(i) .. "  " else "")
				.. tostring(b:GetAttribute("ActionLabel"))
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
		if index and index <= count and buttons[index].Visible then
			handlers[index]()
		end
	end)
	gui:GetPropertyChangedSignal("AbsoluteSize"):Connect(layout)
	layout()
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
		nav = nav,
		nextCue = nextCue,
		begin = begin,
		button = button,
		finish = finish,
		buttons = buttons,
		clock = function(seconds: number?, span: number)
			timer.Text = if seconds then tostring(math.ceil(math.max(seconds, 0))) .. "s" else ""
			meter.Visible = seconds ~= nil
			if seconds then
				fill.Size = UDim2.fromScale(math.clamp(seconds / math.max(span, 1), 0, 1), 1)
			end
		end,
	}
end
return Hud
