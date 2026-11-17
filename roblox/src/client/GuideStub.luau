--!strict
-- The first-minute ticket stub: three tappable rows that set a route on the objective chevron.
-- It never blocks movement or teleports, and folds itself into the strip's ticket chip once the player
-- walks about ten studs or after twelve seconds.
local Players = game:GetService("Players")
local GuiService = game:GetService("GuiService")
local Input = game:GetService("UserInputService")
local Style = require(script.Parent.GuideStyle)
local Glyphs = require(script.Parent.GuideGlyphs)
local C = Style.color

local Stub = {}

export type Choice = "show" | "errand" | "tram"
export type Row = { title: string, detail: string, icon: string, accent: Color3 }

local paper = Color3.fromRGB(255, 240, 207)
local paperShade = Color3.fromRGB(242, 222, 184)
local inkText = Color3.fromRGB(36, 30, 58)
local inkMuted = Color3.fromRGB(96, 78, 104)

function Stub.new(gui: ScreenGui, layer: Instance, anchor: GuiObject, onPick: (Choice) -> ())
	local player = Players.LocalPlayer
	local ticket = Instance.new("CanvasGroup")
	ticket.Name = "TicketStub"
	ticket.BackgroundColor3 = paper
	ticket.BorderSizePixel = 0
	ticket.Visible = false
	ticket.ZIndex = 4
	ticket.Size = UDim2.fromOffset(300, 222)
	ticket.Parent = layer
	Style.corner(ticket, 14)
	local edge = Style.stroke(ticket, C.champagne, 2, 0)
	edge.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	local scale = Style.attachScale(ticket)

	local header = Style.frame(ticket, "Header", C.lacquer)
	header.Size = UDim2.new(1, 0, 0, 44)
	Style.gradient(header, Color3.fromRGB(120, 48, 76), Color3.fromRGB(78, 28, 50))
	local stamp = Glyphs.mount(header, "ticket", 22, C.bulb, UDim2.fromOffset(12, 11))
	stamp.Name = "Stamp"
	local admit = Style.text(header, "Admit", Style.font.title, C.bulb, 15, 11)
	admit.Position = UDim2.fromOffset(42, 4)
	admit.Size = UDim2.new(1, -100, 0, 20)
	admit.Text = Style.spaced("Admit one")
	local where = Style.text(header, "Where", Style.font.bold, C.cream, 13, 11)
	where.Position = UDim2.fromOffset(42, 23)
	where.Size = UDim2.new(1, -100, 0, 17)
	where.Text = "Where to first?"
	local close = Instance.new("TextButton")
	close.Name = "Fold"
	close.Text = ""
	close.AutoButtonColor = false
	close.BackgroundTransparency = 1
	close.AnchorPoint = Vector2.new(1, 0)
	close.Position = UDim2.new(1, 0, 0, -2)
	close.Size = UDim2.fromOffset(48, 48)
	close.Parent = header
	Glyphs.mount(close, "close", 18, C.bulb, UDim2.new(0.5, -9, 0.5, -9))

	-- Perforation between the header and the rows, with half-moon notches on both edges.
	local perforation = Style.frame(ticket, "Perforation")
	perforation.Position = UDim2.fromOffset(14, 47)
	perforation.Size = UDim2.new(1, -28, 0, 2)
	for i = 0, 22 do
		local dot = Style.frame(perforation, "Hole", paperShade)
		dot.Position = UDim2.fromScale(i / 23, 0)
		dot.Size = UDim2.fromOffset(5, 2)
	end
	for _, side in { 0, 1 } do
		local notch = Style.frame(ticket, "Notch", C.panelDeep, 0.1)
		notch.AnchorPoint = Vector2.new(0.5, 0.5)
		notch.Position = UDim2.new(side, 0, 0, 48)
		notch.Size = UDim2.fromOffset(14, 14)
		Style.corner(notch, 999)
	end

	local rowsHolder = Style.frame(ticket, "Rows")
	rowsHolder.Position = UDim2.fromOffset(8, 54)
	rowsHolder.Size = UDim2.new(1, -16, 1, -60)
	local list = Instance.new("UIListLayout")
	list.Padding = UDim.new(0, 8)
	list.SortOrder = Enum.SortOrder.LayoutOrder
	list.Parent = rowsHolder

	local order: { Choice } = { "show", "errand", "tram" }
	local rowButtons: { [Choice]: TextButton } = {}
	local rowTitle: { [Choice]: TextLabel } = {}
	local rowDetail: { [Choice]: TextLabel } = {}
	local rowDisc: { [Choice]: Frame } = {}
	local rowIcon: { [Choice]: string } = {}
	for index, choice in order do
		local row = Instance.new("TextButton")
		row.Name = "Row_" .. choice
		row.Text = ""
		row.AutoButtonColor = false
		row.Selectable = true
		row.BackgroundColor3 = paper
		row.BorderSizePixel = 0
		row.LayoutOrder = index
		row.Size = UDim2.new(1, 0, 0, 48)
		row.Parent = rowsHolder
		Style.corner(row, 10)
		local disc = Style.frame(row, "Disc", C.bulb)
		disc.AnchorPoint = Vector2.new(0, 0.5)
		disc.Position = UDim2.new(0, 6, 0.5, 0)
		disc.Size = UDim2.fromOffset(36, 36)
		Style.corner(disc, 999)
		Style.stroke(disc, inkText, 1.5, 0.4)
		local title = Style.text(row, "Title", Style.font.heavy, inkText, 17, 13)
		title.Position = UDim2.fromOffset(50, 4)
		title.Size = UDim2.new(1, -82, 0, 22)
		local detail = Style.text(row, "Detail", Style.font.bold, inkMuted, 13, 11)
		detail.Position = UDim2.fromOffset(50, 25)
		detail.Size = UDim2.new(1, -82, 0, 18)
		detail.TextTruncate = Enum.TextTruncate.AtEnd
		Glyphs.mount(row, "chevron-right", 20, inkMuted, UDim2.new(1, -28, 0.5, -10))
		if index < #order then
			local rule = Style.frame(row, "Dash", paperShade)
			rule.AnchorPoint = Vector2.new(0, 1)
			rule.Position = UDim2.new(0, 50, 1, 4)
			rule.Size = UDim2.new(1, -60, 0, 1)
		end
		row.MouseButton1Down:Connect(function()
			row.BackgroundColor3 = paperShade
		end)
		row.MouseLeave:Connect(function()
			row.BackgroundColor3 = paper
		end)
		row.SelectionGained:Connect(function()
			row.BackgroundColor3 = paperShade
		end)
		row.SelectionLost:Connect(function()
			row.BackgroundColor3 = paper
		end)
		row.Activated:Connect(function()
			row.BackgroundColor3 = paper
			Style.pop(row, 0.92)
			onPick(choice)
		end)
		rowButtons[choice] = row
		rowTitle[choice] = title
		rowDetail[choice] = detail
		rowDisc[choice] = disc
	end

	local open = false
	local shownOnce = false
	local openedAt = 0
	local openedFrom: Vector3? = nil
	local lifetime = 12
	local foldToken = 0
	local folding: { Tween } = {}
	local function rootPosition(): Vector3?
		local character = player.Character
		local root = character and character:FindFirstChild("HumanoidRootPart")
		return if root and root:IsA("BasePart") then root.Position else nil
	end
	local function layout()
		local k = Style.currentScale()
		scale.Scale = k
		local width = math.min(anchor.AbsoluteSize.X / k, 340)
		ticket.Size = UDim2.fromOffset(math.max(width, 268), 222)
		ticket.Position = anchor.Position
	end
	gui:GetPropertyChangedSignal("AbsoluteSize"):Connect(layout)
	anchor:GetPropertyChangedSignal("AbsoluteSize"):Connect(layout)
	anchor:GetPropertyChangedSignal("Position"):Connect(layout)

	local api = {}
	function api.setRow(choice: Choice, row: Row)
		rowTitle[choice].Text = row.title
		rowDetail[choice].Text = row.detail
		local disc = rowDisc[choice]
		disc.BackgroundColor3 = row.accent
		if rowIcon[choice] ~= row.icon then
			rowIcon[choice] = row.icon
			local old = disc:FindFirstChildWhichIsA("Frame")
			if old then
				old:Destroy()
			end
			Glyphs.mount(disc, row.icon, 22, inkText, UDim2.new(0.5, -11, 0.5, -11))
		end
	end
	function api.isOpen(): boolean
		return open
	end
	function api.shown(): boolean
		return shownOnce
	end
	-- Folds the ticket into the strip's chip: shrink toward the chip and fade.
	function api.fold()
		if not open then
			return
		end
		open = false
		foldToken += 1
		local token = foldToken
		local chip = anchor:FindFirstChild("TicketChip") :: GuiObject?
		local origin = if layer:IsA("GuiObject") then layer.AbsolutePosition else gui.AbsolutePosition
		local target = if chip
			then UDim2.fromOffset(chip.AbsolutePosition.X - origin.X, chip.AbsolutePosition.Y - origin.Y)
			else ticket.Position
		folding = {
			Style.tween(
				ticket,
				0.32,
				{ GroupTransparency = 1, Position = target },
				Enum.EasingStyle.Quad,
				Enum.EasingDirection.In
			),
			Style.tween(scale, 0.32, { Scale = 0.35 }, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
		}
		if chip then
			task.delay(0.3, function()
				if token == foldToken then
					Style.pop(chip, 0.7)
				end
			end)
		end
		task.delay(0.34, function()
			if token == foldToken and not open then
				ticket.Visible = false
				layout()
			end
		end)
		if GuiService.SelectedObject and GuiService.SelectedObject:IsDescendantOf(ticket) then
			GuiService.SelectedObject = nil
		end
	end
	function api.open(seconds: number?)
		foldToken += 1
		for _, t in folding do
			t:Cancel()
		end
		table.clear(folding)
		open = true
		shownOnce = true
		openedAt = os.clock()
		openedFrom = rootPosition()
		lifetime = seconds or 12
		layout()
		ticket.Visible = true
		ticket.GroupTransparency = 1
		local home = ticket.Position
		if Style.reduced() then
			ticket.GroupTransparency = 0
		else
			ticket.Position = home - UDim2.fromOffset(0, 14)
			Style.tween(ticket, 0.45, { GroupTransparency = 0, Position = home }, Enum.EasingStyle.Back)
		end
		if Input.PreferredInput == Enum.PreferredInput.Gamepad then
			GuiService.SelectedObject = rowButtons.show
		end
	end
	function api.toggle()
		if open then
			api.fold()
		else
			api.open(20)
		end
	end
	-- Call a few times per second while walking; folds after ~10 studs of travel or the timeout.
	function api.tick()
		if not open then
			return
		end
		local now = rootPosition()
		if not openedFrom then
			openedFrom = now
		end
		local travelled = if now and openedFrom
			then Vector2.new(now.X - openedFrom.X, now.Z - openedFrom.Z).Magnitude
			else 0
		if travelled >= 10 or os.clock() - openedAt >= lifetime then
			api.fold()
		end
	end
	function api.hide()
		if open then
			open = false
			foldToken += 1
		end
		ticket.Visible = false
	end
	close.Activated:Connect(function()
		api.fold()
	end)
	layout()
	return api
end
return Stub
