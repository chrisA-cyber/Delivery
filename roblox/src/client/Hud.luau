--!strict
local Hud = {}
local ink = Color3.fromRGB(25, 20, 32)
local paper = Color3.fromRGB(249, 238, 213)
local honey = Color3.fromRGB(255, 215, 125)
local function corners(obj: GuiObject, r: number)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, r)
	c.Parent = obj
end
local function stroke(obj: GuiObject, col: Color3, transparency: number)
	local s = Instance.new("UIStroke")
	s.Color = col
	s.Transparency = transparency
	s.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	s.Parent = obj
end
local function frame(parent, name, col)
	local f = Instance.new("Frame")
	f.Name = name
	f.BorderSizePixel = 0
	f.BackgroundColor3 = col
	f.Parent = parent
	return f
end
local function label(parent, name, font, col, maxSize)
	local t = Instance.new("TextLabel")
	t.Name = name
	t.Text = ""
	t.Font = font
	t.TextScaled = true
	t.TextWrapped = true
	t.BackgroundTransparency = 1
	t.TextColor3 = col
	t.TextXAlignment = Enum.TextXAlignment.Left
	t.Parent = parent
	local constraint = Instance.new("UITextSizeConstraint")
	constraint.MinTextSize = 10
	constraint.MaxTextSize = maxSize
	constraint.Parent = t
	return t
end
function Hud.new(parent: PlayerGui)
	local gui = Instance.new("ScreenGui")
	gui.Name = "DeliveryShow"
	gui.ResetOnSpawn = false
	gui.Parent = parent
	local panel = frame(gui, "ControlDesk", ink)
	panel.AnchorPoint = Vector2.new(0.5, 1)
	panel.Position = UDim2.fromScale(0.5, 0.986)
	panel.BackgroundTransparency = 0.04
	corners(panel, 12)
	stroke(panel, Color3.fromRGB(190, 139, 97), 0.3)
	local cap = Instance.new("UISizeConstraint")
	cap.MaxSize = Vector2.new(940, 190)
	cap.Parent = panel
	local phase = label(panel, "Phase", Enum.Font.GothamBold, honey, 15)
	phase.Position = UDim2.fromOffset(16, 5)
	phase.Size = UDim2.new(1, -32, 0, 23)
	local backing = frame(panel, "VioletBacking", Color3.fromRGB(123, 68, 160))
	corners(backing, 7)
	local face = frame(panel, "CueCard", paper)
	corners(face, 7)
	local stripe = frame(face, "Index", Color3.fromRGB(209, 148, 77))
	stripe.Size = UDim2.new(0, 5, 1, -12)
	stripe.Position = UDim2.fromOffset(0, 6)
	local card = label(face, "Card", Enum.Font.GothamBlack, ink, 27)
	card.Position = UDim2.fromOffset(13, 2)
	card.Size = UDim2.new(1, -24, 0.6, -1)
	local note = label(face, "Direction", Enum.Font.GothamMedium, Color3.fromRGB(76, 56, 96), 15)
	note.Position = UDim2.new(0, 13, 0.60, 0)
	note.Size = UDim2.new(1, -23, 0.4, -4)
	local controls = Instance.new("ScrollingFrame")
	controls.Name = "Actions"
	controls.BorderSizePixel = 0
	controls.BackgroundTransparency = 1
	controls.ScrollBarThickness = 4
	controls.ScrollBarImageColor3 = honey
	controls.AutomaticCanvasSize = Enum.AutomaticSize.Y
	controls.CanvasSize = UDim2.new()
	controls.Parent = panel
	local grid = Instance.new("UIGridLayout")
	grid.SortOrder = Enum.SortOrder.LayoutOrder
	grid.CellSize = UDim2.new(0.5, -5, 0, 44)
	grid.CellPadding = UDim2.fromOffset(5, 5)
	grid.Parent = controls
	local function layout()
		local camera = workspace.CurrentCamera
		if not camera then
			return
		end
		local compact = camera.ViewportSize.X < 610
		panel.Size = if compact then UDim2.fromScale(0.96, 0.38) else UDim2.fromScale(0.92, 0.26)
		cap.MaxSize = if compact then Vector2.new(940, 236) else Vector2.new(940, 159)
		if compact then
			face.Position = UDim2.fromOffset(10, 29)
			face.Size = UDim2.new(1, -24, 0.46, -5)
			controls.Position = UDim2.new(0, 11, 0.46, 31)
			controls.Size = UDim2.new(1, -22, 0.54, -37)
		else
			face.Position = UDim2.fromOffset(13, 32)
			face.Size = UDim2.new(0.57, -18, 1, -47)
			controls.Position = UDim2.new(0.57, 9, 0, 31)
			controls.Size = UDim2.new(0.43, -20, 1, -39)
		end
		backing.Position = face.Position + UDim2.fromOffset(3, 4)
		backing.Size = face.Size
	end
	if workspace.CurrentCamera then
		workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(layout)
	end
	layout()
	local index = 0
	local function clear()
		index = 0
		controls.CanvasPosition = Vector2.zero
		for _, v in controls:GetChildren() do
			if v:IsA("GuiButton") then
				v:Destroy()
			end
		end
	end
	local function button(title: string, callback: () -> (), primary: boolean?)
		index += 1
		local b = Instance.new("TextButton")
		b.Name = "Action"
		b.LayoutOrder = index
		b.Text = title
		b.TextSize = 14
		b.TextWrapped = true
		b.Font = Enum.Font.GothamBold
		b.BackgroundColor3 = if primary then honey else Color3.fromRGB(62, 46, 73)
		b.TextColor3 = if primary then ink else paper
		b.BorderSizePixel = 0
		corners(b, 6)
		stroke(b, Color3.fromRGB(135, 101, 143), 0.55)
		b.Parent = controls
		b.Activated:Connect(callback)
	end
	return {
		phase = phase,
		card = card,
		note = note,
		clear = clear,
		button = button,
		panel = panel,
		gui = gui,
	}
end
return Hud
