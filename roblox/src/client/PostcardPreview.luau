--!strict
-- Live postcard proof beside the gallery press: skyline, ink and greeting update as they are picked.
local Style = require(script.Parent.GuideStyle)
local Preview = {}
local paper = Color3.fromRGB(251, 238, 211)
local swatches = {
	["Sea glass"] = Color3.fromRGB(36, 116, 111),
	["Cherry red"] = Color3.fromRGB(162, 58, 67),
	["Midnight blue"] = Color3.fromRGB(46, 62, 111),
}
local function slab(parent, name, x, y, w, h, color, angle)
	local f = Instance.new("Frame")
	f.Name = name
	f.BorderSizePixel = 0
	f.Position = UDim2.fromScale(x, y)
	f.Size = UDim2.fromScale(w, h)
	f.BackgroundColor3 = color
	f.Rotation = angle or 0
	f.Parent = parent
	return f
end
function Preview.new(root: Instance, gui: ScreenGui)
	local holder = slab(root, "GalleryPostcardHolder", 0, 0, 0, 0, paper)
	holder.BackgroundTransparency = 1
	holder.AnchorPoint = Vector2.new(0, 0)
	holder.Position = UDim2.fromOffset(14, 10)
	holder.Visible = false
	local shadow = slab(holder, "Shadow", 0, 0, 1, 1, Color3.fromRGB(8, 9, 22))
	shadow.Position = UDim2.fromOffset(4, 6)
	shadow.BackgroundTransparency = 0.55
	shadow.Rotation = -2.5
	Style.corner(shadow, 6)
	local card = slab(holder, "GalleryPostcard", 0, 0, 1, 1, paper)
	card.Rotation = -2.5
	Style.corner(card, 6)
	local outline = Instance.new("UIStroke")
	outline.Color = Style.color.champagne
	outline.Thickness = 2
	outline.Parent = card
	-- Stamp and postmark in the corner.
	local stamp = slab(card, "Stamp", 0.84, 0.06, 0.12, 0.2, Style.accent.gallery)
	Style.corner(stamp, 2)
	local perf = Instance.new("UIStroke")
	perf.Color = paper
	perf.Thickness = 2
	perf.Parent = stamp
	local postmark = slab(card, "Postmark", 0.7, 0.1, 0.16, 0.26, paper)
	postmark.BackgroundTransparency = 1
	postmark.Rotation = -12
	local ring = Instance.new("UIStroke")
	ring.Color = Color3.fromRGB(120, 100, 110)
	ring.Thickness = 1.5
	ring.Transparency = 0.35
	ring.Parent = postmark
	Style.corner(postmark, 999)
	local markText = Instance.new("TextLabel")
	markText.BackgroundTransparency = 1
	markText.Size = UDim2.fromScale(1, 1)
	markText.FontFace = Style.font.title
	markText.TextScaled = true
	markText.TextColor3 = Color3.fromRGB(120, 100, 110)
	markText.TextTransparency = 0.3
	markText.Text = "DELIVERY"
	markText.Parent = postmark
	local art = slab(card, "Illustration", 0.035, 0.065, 0.64, 0.67, paper)
	art.ClipsDescendants = true
	local tintParts = {}
	local function printShape(layer, name, x, y, w, h, angle)
		local part = slab(layer, name, x, y, w, h, swatches["Sea glass"], angle)
		table.insert(tintParts, part)
		return part
	end
	local sun = printShape(art, "Sun", 0.78, 0.05, 0.10, 0.25)
	local circle = Instance.new("UICorner")
	circle.CornerRadius = UDim.new(1, 0)
	circle.Parent = sun
	sun.BackgroundTransparency = 0.60
	for i = 0, 2 do
		local horizon = printShape(art, "Horizon", 0, 0.76 + i * 0.085, 1, 0.012)
		horizon.BackgroundTransparency = 0.55
	end
	local scenes = {}
	for _, name in { "Harbour crane", "Signal gazebo", "Lantern market" } do
		local layer = slab(art, name, 0, 0, 1, 1, paper)
		layer.BackgroundTransparency = 1
		scenes[name] = layer
		if name == "Harbour crane" then
			printShape(layer, "Pier", 0.04, 0.78, 0.50, 0.065)
			printShape(layer, "Leg", 0.18, 0.10, 0.035, 0.70)
			printShape(layer, "Cab", 0.16, 0.17, 0.12, 0.16)
			printShape(layer, "Jib", 0.12, 0.08, 0.55, 0.038)
			printShape(layer, "Stay", 0.20, 0.145, 0.32, 0.018, -9)
			printShape(layer, "Cable", 0.60, 0.10, 0.011, 0.32)
			printShape(layer, "Cargo", 0.55, 0.42, 0.12, 0.18)
			printShape(layer, "Hull", 0.66, 0.75, 0.28, 0.07)
			printShape(layer, "Cabin", 0.72, 0.64, 0.09, 0.11)
		elseif name == "Signal gazebo" then
			printShape(layer, "Cap", 0.48, 0.13, 0.027, 0.12)
			printShape(layer, "RoofLeft", 0.22, 0.275, 0.30, 0.055, -15)
			printShape(layer, "RoofRight", 0.49, 0.275, 0.30, 0.055, 15)
			printShape(layer, "Cornice", 0.20, 0.41, 0.60, 0.065)
			for i = 0, 3 do
				printShape(layer, "Column", 0.23 + i * 0.17, 0.47, 0.023, 0.30)
			end
			printShape(layer, "Balustrade", 0.25, 0.63, 0.50, 0.035)
			printShape(layer, "Landing", 0.18, 0.77, 0.64, 0.045)
			printShape(layer, "Steps", 0.14, 0.83, 0.72, 0.045)
		else
			for i = 0, 2 do
				local x = 0.06 + i * 0.30
				printShape(layer, "Awnings", x, 0.43 - i % 2 * 0.09, 0.26, 0.08)
				printShape(layer, "Posts", x + 0.025, 0.49 - i % 2 * 0.09, 0.016, 0.31 + i % 2 * 0.09)
				printShape(layer, "Posts", x + 0.22, 0.49 - i % 2 * 0.09, 0.016, 0.31 + i % 2 * 0.09)
				printShape(layer, "Counter", x, 0.70, 0.26, 0.12)
				for j = 0, 2 do
					local bulb =
						printShape(layer, "Lantern", x + 0.03 + j * 0.07, 0.28 - i % 2 * 0.08, 0.035, 0.09)
					local curve = Instance.new("UICorner")
					curve.CornerRadius = UDim.new(1, 0)
					curve.Parent = bulb
				end
			end
			printShape(layer, "Cable", 0.015, 0.21, 0.95, 0.013, -2)
		end
	end
	local caption = Instance.new("TextLabel")
	caption.Name = "PrintedGreeting"
	caption.BackgroundTransparency = 1
	caption.Position = UDim2.fromScale(0.035, 0.735)
	caption.Size = UDim2.fromScale(0.93, 0.23)
	-- Address lines on the right half, like the back of a real card.
	for i = 0, 2 do
		local line =
			slab(card, "AddressLine", 0.7, 0.44 + i * 0.1, 0.26, 0.012, Color3.fromRGB(170, 150, 140))
		line.BackgroundTransparency = 0.3
	end
	caption.TextScaled = true
	caption.FontFace = Style.font.heavy
	caption.Parent = card
	local cap = Instance.new("UITextSizeConstraint")
	cap.MinTextSize = 12
	cap.MaxTextSize = 20
	cap.Parent = caption
	-- Fits the space above the counter sheet (TownSheetTop) in the top-left corner.
	local function layout()
		local size = gui.AbsoluteSize
		local top = gui:GetAttribute("TownSheetTop")
		local room = (if type(top) == "number" then top else size.Y * 0.6) - 24
		local w = math.clamp(math.min(300, size.X * 0.36, room / 0.62), 150, 300)
		holder.Size = UDim2.fromOffset(w, math.floor(w * 0.62))
	end
	gui:GetPropertyChangedSignal("AbsoluteSize"):Connect(layout)
	gui:GetAttributeChangedSignal("TownSheetTop"):Connect(layout)
	layout()
	local shown = ""
	return function(visible, scene, ink, greeting)
		holder.Visible = visible
		if not visible then
			shown = ""
			return
		end
		local key = tostring(scene) .. "/" .. tostring(ink) .. "/" .. tostring(greeting)
		if key ~= shown then
			shown = key
			Style.pop(card, 0.9)
		end
		local color = swatches[ink or ""] or Color3.fromRGB(115, 101, 91)
		for _, part in tintParts do
			part.BackgroundColor3 = color
		end
		for name, layer in scenes do
			layer.Visible = name == scene
		end
		caption.TextColor3 = color
		caption.Text = greeting or (if scene then scene else "Choose a skyline")
	end
end
return Preview
