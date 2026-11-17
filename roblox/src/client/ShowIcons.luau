--!strict
local paths = require(script.Parent.FeatherPaths)
local ShowIcons = {}

function ShowIcons.mount(
	parent: GuiObject,
	name: string,
	sizePx: number,
	color: Color3,
	position: UDim2?
): Frame
	local root = Instance.new("Frame")
	root.Name = "Icon_" .. name
	root.BackgroundTransparency = 1
	root.Size = UDim2.fromOffset(sizePx, sizePx)
	root.Position = position or UDim2.fromOffset(0, 0)
	root.ZIndex = parent.ZIndex + 1
	root.Parent = parent
	for _, stroke in paths[name] or {} do
		for i = 3, #stroke, 2 do
			local x1, y1, x2, y2 = stroke[i - 2], stroke[i - 1], stroke[i], stroke[i + 1]
			local dx, dy = x2 - x1, y2 - y1
			local length = math.sqrt(dx * dx + dy * dy)
			local segment = Instance.new("Frame")
			segment.Name = "Stroke"
			segment.AnchorPoint = Vector2.new(0.5, 0.5)
			segment.BackgroundColor3 = color
			segment.BorderSizePixel = 0
			segment.ZIndex = root.ZIndex
			segment.Position = UDim2.fromScale((x1 + x2) / 48, (y1 + y2) / 48)
			segment.Size = UDim2.fromScale((length + 1.0) / 24, 1.85 / 24)
			segment.Rotation = math.deg(math.atan2(dy, dx))
			segment.Parent = root
		end
	end
	return root
end
return ShowIcons
