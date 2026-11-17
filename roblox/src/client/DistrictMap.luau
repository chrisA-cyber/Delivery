--!strict
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Delivery")
local Venues = require(Shared:WaitForChild("Venues"))
local Icons = require(script.Parent.ShowIcons)
local Map = {}
local paper = Color3.fromRGB(251, 239, 212)
local ink = Color3.fromRGB(45, 37, 45)
local gold = Color3.fromRGB(255, 204, 109)
local ground = Color3.fromRGB(225, 211, 176)
local water = Color3.fromRGB(141, 184, 181)
local green = Color3.fromRGB(172, 189, 146)
local block = Color3.fromRGB(204, 180, 162)
local stone = Color3.fromRGB(183, 159, 129)
local entries = {
	lobby = { "Plaza", "radio" },
	theatre = { "Theatre", "mic" },
	balcony = { "Rooftop", "users" },
	studio = { "Studio B", "headphones" },
	writers = { "Writers", "book-open" },
	warehouse = { "Props", "bell" },
	atelier = { "Atelier", "award" },
	pier = { "Pier", "music" },
	park = { "Signal Park", "radio" },
	market = { "Market", "award" },
}
local groups = {
	district = { lobby = true, theatre = true, balcony = true, pier = true, park = true, market = true },
	studios = {
		lobby = true,
		theatre = true,
		balcony = true,
		studio = true,
		writers = true,
		warehouse = true,
		atelier = true,
	},
}
local function corner(o, r)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, r)
	c.Parent = o
end
local function slab(parent, name, color)
	local f = Instance.new("Frame")
	f.Name = name
	f.BorderSizePixel = 0
	f.BackgroundColor3 = color
	f.Parent = parent
	return f
end
local function button(parent, name, caption)
	local b = Instance.new("TextButton")
	b.Name = name
	b.Text = caption
	b.TextSize = 13
	b.Font = Enum.Font.GothamBold
	b.TextColor3 = ink
	b.BackgroundColor3 = paper
	b.BorderSizePixel = 0
	b.Selectable = true
	b.Parent = parent
	corner(b, 6)
	return b
end
-- A schematic spaces stops evenly along the avenue; landmarks and the player's dot use the same projection.
local function project(which, x, z)
	local span = if which == "district" then 122 else 51
	local extent = if which == "district" then { 24, 62, 118, 171 } else { 24, 53, 89, 118 }
	local pz = 0.1
	for i = 1, 3 do
		pz += math.clamp((z - extent[i]) / (extent[i + 1] - extent[i]), 0, 1) * 0.265
	end
	return 0.5 + x / span * 0.34, pz
end
function Map.new(parent, onSelect)
	local tabs = slab(parent, "MapKey", ink)
	tabs.Size = UDim2.new(1, 0, 0, 46)
	corner(tabs, 6)
	local scroll = Instance.new("ScrollingFrame")
	scroll.Name = "StreetAtlas"
	scroll.Position = UDim2.fromOffset(0, 47)
	scroll.Size = UDim2.new(1, 0, 1, -47)
	scroll.BorderSizePixel = 0
	scroll.BackgroundColor3 = ground
	scroll.ScrollBarThickness = 3
	scroll.ScrollingDirection = Enum.ScrollingDirection.Y
	scroll.Parent = parent
	corner(scroll, 6)
	local canvas = slab(scroll, "StreetPlan", ground)
	canvas.ClipsDescendants = true
	local backgrounds = {}
	local nodes = {}
	local tabButtons = {}
	local selected = "park"
	local which = "district"
	local function rectangle(parentLayer, x1, z1, x2, z2, color, name, groupId)
		local x, y = project(groupId, x1, z1)
		local xx, yy = project(groupId, x2, z2)
		local p = slab(parentLayer, name, color)
		p.Position = UDim2.fromScale(math.min(x, xx), math.min(y, yy))
		p.Size = UDim2.fromScale(math.abs(xx - x), math.abs(yy - y))
		return p
	end
	local function street(layer, groupId, x1, z1, x2, z2, name)
		local x, y = project(groupId, x1, z1)
		local xx, yy = project(groupId, x2, z2)
		local base = slab(layer, name, stone)
		base.AnchorPoint = Vector2.new(0.5, 0.5)
		base.Position = UDim2.fromScale((x + xx) / 2, (y + yy) / 2)
		base.Size = UDim2.new(math.abs(xx - x), 8, math.abs(yy - y), 8)
		local stripe = slab(base, "WalkingRoute", paper)
		stripe.AnchorPoint = Vector2.new(0.5, 0.5)
		stripe.Position = UDim2.fromScale(0.5, 0.5)
		stripe.Size = UDim2.new(1, -4, 1, -4)
	end
	for _, groupId in { "district", "studios" } do
		local layer = slab(canvas, groupId .. "Features", ground)
		layer.Size = UDim2.fromScale(1, 1)
		backgrounds[groupId] = layer
		if groupId == "district" then
			local shore = slab(layer, "Waterfront", water)
			shore.Size = UDim2.fromScale(0.21, 1)
			rectangle(layer, 81, 42, 177, 116, green, "SignalPark", groupId)
			rectangle(layer, -31, 147, 31, 171, block, "MarketSquare", groupId)
			street(layer, groupId, -137, 74, 136, 74, "LanternStreet")
			street(layer, groupId, 0, 24, 0, 118, "PlazaWalk")
			for _, side in { -32, 32 } do
				street(layer, groupId, side, 74, side, 155, "MarketWalk")
				street(layer, groupId, side, 155, 0, 155, "MarketApproach")
			end
			street(layer, groupId, 0, 155, 0, 171, "MarketEntry")
		else
			for _, x in { -51, 51 } do
				for _, z in { 53, 89 } do
					rectangle(layer, x - 18, z - 12, x + 18, z + 12, block, "StudioFrontage", groupId)
				end
			end
			street(layer, groupId, 0, 24, 0, 118, "PlazaWalk")
			street(layer, groupId, -62, 74, 62, 74, "LanternStreet")
			for _, x in { -51, 51 } do
				street(layer, groupId, x, 53, x, 89, "ShopWalk")
			end
		end
	end
	local position = slab(canvas, "PlayerLocation", ink)
	position.AnchorPoint = Vector2.new(0.5, 0.5)
	position.Size = UDim2.fromOffset(12, 12)
	position.ZIndex = 5
	position.Visible = false
	corner(position, 10)
	local centre = slab(position, "Indicator", Color3.fromRGB(75, 225, 225))
	centre.Position = UDim2.fromOffset(2, 2)
	centre.Size = UDim2.fromOffset(8, 8)
	centre.ZIndex = 6
	corner(centre, 6)
	local function show(groupId)
		which = groupId
		for id, layer in backgrounds do
			layer.Visible = id == which
		end
		for id, b in tabButtons do
			b.BackgroundColor3 = if id == which then gold else ink
			b.TextColor3 = if id == which then ink else paper
		end
		for id, node in nodes do
			node.Visible = groups[which][id] == true
			local def = Venues.rooms[id]
			local x, y = project(which, def.x, def.z)
			node.Position = UDim2.fromScale(x, y)
			node.BackgroundColor3 = if selected == id then gold else paper
		end
	end
	for index, groupId in { "district", "studios" } do
		local b = button(
			tabs,
			groupId .. "Tab",
			if groupId == "district" then "Outdoor district" else "Theatre block"
		)
		b.Position = UDim2.new((index - 1) * 0.5, 2, 0, 1)
		b.Size = UDim2.new(0.5, -4, 0, 44)
		tabButtons[groupId] = b
		b.Activated:Connect(function()
			show(groupId)
			onSelect(if groups[which][selected] then selected else "lobby")
		end)
	end
	for _, id in Venues.order do
		local entry = entries[id]
		if not entry then
			continue
		end
		local b = button(canvas, "Room_" .. id, "")
		b.AnchorPoint = Vector2.new(0.5, 0.5)
		b.Size = UDim2.new(0.3, -3, 0, 44)
		b.ZIndex = 2
		local border = Instance.new("UIStroke")
		border.Color = stone
		border.Thickness = 1
		border.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
		border.Parent = b
		local icon = Icons.mount(b, entry[2], 15, ink, UDim2.new(0.5, -7, 0, 4))
		icon.Name = "LandmarkSymbol"
		local txt = Instance.new("TextLabel")
		txt.BackgroundTransparency = 1
		txt.Position = UDim2.fromOffset(2, 20)
		txt.Size = UDim2.new(1, -4, 0, 21)
		txt.TextScaled = true
		txt.Font = Enum.Font.GothamBold
		txt.TextColor3 = ink
		txt.Text = entry[1]
		txt.ZIndex = 3
		local limit = Instance.new("UITextSizeConstraint")
		limit.MaxTextSize = 14
		limit.MinTextSize = 10
		limit.Parent = txt
		txt.Parent = b
		nodes[id] = b
		b.Activated:Connect(function()
			onSelect(id)
		end)
	end
	local function layout()
		local height = math.max(228, scroll.AbsoluteSize.Y)
		scroll.CanvasSize = UDim2.fromOffset(0, height)
		canvas.Size = UDim2.new(1, 0, 0, height)
	end
	scroll:GetPropertyChangedSignal("AbsoluteSize"):Connect(layout)
	layout()
	show(which)
	return {
		select = function(id)
			selected = id
			show(if groups[which][id] then which elseif groups.district[id] then "district" else "studios")
		end,
		open = function(id)
			show(if groups.district[id] then "district" else "studios")
			if nodes[id] then
				scroll.CanvasPosition = Vector2.zero
			end
		end,
		track = function(pos)
			local x, y = project(which, pos.X, pos.Z)
			position.Visible = x >= 0
				and x <= 1
				and pos.Z >= 14
				and pos.Z <= (if which == "district" then 200 else 132)
			position.Position = UDim2.fromScale(math.clamp(x, 0.03, 0.97), y)
		end,
		nodes = nodes,
	}
end
return Map
