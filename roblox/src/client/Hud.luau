--!strict
local Hud = {}
local ink, paper, yellow =
	Color3.fromRGB(21, 20, 26), Color3.fromRGB(245, 242, 232), Color3.fromRGB(255, 220, 102)
local function label(parent: Instance, name: string, height: number, font: Enum.Font, color: Color3)
	local t = Instance.new("TextLabel")
	t.Name = name
	t.BackgroundTransparency = 1
	t.Size = UDim2.new(1, 0, 0, height)
	t.TextXAlignment = Enum.TextXAlignment.Left
	t.Font = font
	t.TextColor3 = color
	t.TextScaled = true
	t.TextWrapped = true
	t.Text = ""
	t.Parent = parent
	local limit = Instance.new("UITextSizeConstraint")
	limit.MinTextSize = 11
	limit.MaxTextSize = if name == "Card" then 25 else 16
	limit.Parent = t
	return t
end
function Hud.new(parent: PlayerGui)
	local gui = Instance.new("ScreenGui")
	gui.Name = "DeliveryShow"
	gui.ResetOnSpawn = false
	gui.Parent = parent
	local panel = Instance.new("ScrollingFrame")
	panel.Size = UDim2.fromScale(0.94, 0.52)
	panel.AnchorPoint = Vector2.new(0.5, 1)
	panel.Position = UDim2.fromScale(0.5, 0.985)
	panel.BackgroundColor3 = ink
	panel.BorderSizePixel = 0
	panel.ScrollBarThickness = 4
	panel.AutomaticCanvasSize = Enum.AutomaticSize.Y
	panel.CanvasSize = UDim2.new()
	panel.Parent = gui
	local size = Instance.new("UISizeConstraint")
	size.MaxSize = Vector2.new(720, 370)
	size.Parent = panel
	local pad = Instance.new("UIPadding")
	pad.PaddingLeft = UDim.new(0, 12)
	pad.PaddingRight = UDim.new(0, 12)
	pad.PaddingTop = UDim.new(0, 8)
	pad.PaddingBottom = UDim.new(0, 8)
	pad.Parent = panel
	local list = Instance.new("UIListLayout")
	list.SortOrder = Enum.SortOrder.LayoutOrder
	list.Padding = UDim.new(0, 4)
	list.Parent = panel
	local phase = label(panel, "Phase", 20, Enum.Font.GothamBold, yellow)
	local card = label(panel, "Card", 55, Enum.Font.GothamBold, paper)
	local note = label(panel, "Direction", 36, Enum.Font.Gotham, paper)
	card.LayoutOrder = 1
	note.LayoutOrder = 2
	local controls = Instance.new("Frame")
	controls.Name = "Actions"
	controls.Size = UDim2.fromScale(1, 0)
	controls.AutomaticSize = Enum.AutomaticSize.Y
	controls.BackgroundTransparency = 1
	controls.LayoutOrder = 3
	controls.Parent = panel
	local grid = Instance.new("UIGridLayout")
	grid.CellSize = UDim2.new(0.49, -2, 0, 44)
	grid.CellPadding = UDim2.fromOffset(4, 4)
	grid.SortOrder = Enum.SortOrder.LayoutOrder
	grid.Parent = controls
	local function clear()
		for _, v in controls:GetChildren() do
			if v:IsA("GuiButton") then
				v:Destroy()
			end
		end
	end
	local idx = 0
	local function button(title: string, callback: () -> (), primary: boolean?)
		idx += 1
		local b = Instance.new("TextButton")
		b.Name = "Action"
		b.LayoutOrder = idx
		b.Text = title
		b.TextWrapped = true
		b.Font = Enum.Font.GothamBold
		b.TextSize = 14
		b.BackgroundColor3 = if primary then yellow else Color3.fromRGB(54, 51, 65)
		b.TextColor3 = if primary then ink else paper
		b.BorderSizePixel = 0
		b.Parent = controls
		b.Activated:Connect(callback)
	end
	return { phase = phase, card = card, note = note, clear = clear, button = button, panel = panel }
end
return Hud
