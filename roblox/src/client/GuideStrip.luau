--!strict
-- Top-left location strip (place name + one objective line) and the district title card that slides in
-- when the player walks into a new part of town.
local Style = require(script.Parent.GuideStyle)
local Glyphs = require(script.Parent.GuideGlyphs)
local C = Style.color

local Strip = {}

export type Tone = "normal" | "notice" | "task" | "arrive"

function Strip.new(gui: ScreenGui, root: Instance, navWidth: () -> number)
	local strip = Style.panel(root, "VenueLocation")
	strip.Position = UDim2.fromOffset(12, 8)
	strip.Size = UDim2.fromOffset(300, 0)
	strip.AutomaticSize = Enum.AutomaticSize.Y
	strip.Visible = false
	strip.ZIndex = 2
	local pad = Instance.new("UIPadding")
	pad.PaddingTop = UDim.new(0, 8)
	pad.PaddingBottom = UDim.new(0, 9)
	pad.PaddingLeft = UDim.new(0, 58)
	pad.PaddingRight = UDim.new(0, 60)
	pad.Parent = strip
	Style.attachScale(strip)
	local column = Style.frame(strip, "Text")
	column.Size = UDim2.fromScale(1, 0)
	column.AutomaticSize = Enum.AutomaticSize.Y
	local list = Instance.new("UIListLayout")
	list.SortOrder = Enum.SortOrder.LayoutOrder
	list.Padding = UDim.new(0, 1)
	list.Parent = column

	-- Place glyph disc, centred in the strip's left padding.
	local badge = Style.frame(strip, "PlaceBadge", C.bulb)
	badge.AnchorPoint = Vector2.new(0, 0.5)
	badge.Position = UDim2.new(0, -48, 0.5, 0)
	badge.Size = UDim2.fromOffset(38, 38)
	Style.corner(badge, 999)
	Style.stroke(badge, C.ink, 1.5, 0.3)
	local badgeIcon: Frame? = nil

	local place = Style.text(column, "Place", Style.font.title, C.bulb, 20, 14)
	place.LayoutOrder = 1
	place.Size = UDim2.new(1, 0, 0, 24)
	place.TextTruncate = Enum.TextTruncate.AtEnd
	local objective = Style.text(column, "Objective", Style.font.bold, C.cream, 15, 15)
	objective.LayoutOrder = 2
	objective.TextScaled = false
	objective.TextSize = 15
	objective.Size = UDim2.fromScale(1, 0)
	objective.AutomaticSize = Enum.AutomaticSize.Y
	objective.TextYAlignment = Enum.TextYAlignment.Top
	objective.LineHeight = 1.05

	-- Ticket chip: reopens the first-minute ticket stub. 48 x 48 touch target on the strip's right edge.
	local ticket = Instance.new("TextButton")
	ticket.Name = "TicketChip"
	ticket.Text = ""
	ticket.AutoButtonColor = false
	ticket.Selectable = true
	ticket.BackgroundColor3 = C.lacquer
	ticket.BorderSizePixel = 0
	ticket.AnchorPoint = Vector2.new(1, 0.5)
	ticket.Position = UDim2.new(1, 54, 0.5, 0)
	ticket.Size = UDim2.fromOffset(48, 48)
	Style.corner(ticket, 12)
	local ticketEdge = Style.stroke(ticket, C.champagne, 1.5, 0.2)
	Glyphs.mount(ticket, "ticket", 28, C.bulb, UDim2.new(0.5, -14, 0.5, -14))
	ticket.Parent = strip

	-- District title card: big spaced capitals between two deco rules.
	local card = Instance.new("CanvasGroup")
	card.Name = "DistrictTitleCard"
	card.BackgroundTransparency = 1
	card.AnchorPoint = Vector2.new(0.5, 0)
	card.Position = UDim2.fromScale(0.5, 0.28)
	card.Size = UDim2.fromOffset(560, 92)
	card.GroupTransparency = 1
	card.Visible = false
	card.ZIndex = 3
	card.Parent = root
	local cardScale = Instance.new("UIScale")
	cardScale.Parent = card
	local cardTitle = Style.text(card, "Title", Style.font.display, C.bulb, 40, 22)
	cardTitle.AnchorPoint = Vector2.new(0.5, 0)
	cardTitle.Position = UDim2.new(0.5, 0, 0, 4)
	cardTitle.Size = UDim2.new(1, -120, 0, 48)
	cardTitle.TextXAlignment = Enum.TextXAlignment.Center
	local shadow = Instance.new("UIStroke")
	shadow.Color = C.ink
	shadow.Thickness = 2
	shadow.Transparency = 0.25
	shadow.Parent = cardTitle
	local rules = {}
	for i, side in { -1, 1 } do
		local rule = Style.frame(card, "Rule", C.champagne)
		rule.AnchorPoint = Vector2.new(if side < 0 then 0 else 1, 0.5)
		rule.Position = UDim2.new(if side < 0 then 0 else 1, 0, 0, 28)
		rule.Size = UDim2.fromOffset(52, 2)
		local gem = Style.frame(rule, "Gem", C.bulb)
		gem.AnchorPoint = Vector2.new(0.5, 0.5)
		gem.Position = UDim2.fromScale(if side < 0 then 1 else 0, 0.5)
		gem.Size = UDim2.fromOffset(8, 8)
		gem.Rotation = 45
		rules[i] = rule
	end
	local cardSub = Style.text(card, "Subtitle", Style.font.bold, C.cream, 16, 13)
	cardSub.AnchorPoint = Vector2.new(0.5, 0)
	cardSub.Position = UDim2.new(0.5, 0, 0, 56)
	cardSub.Size = UDim2.new(1, -40, 0, 24)
	cardSub.TextXAlignment = Enum.TextXAlignment.Center
	local subStroke = Instance.new("UIStroke")
	subStroke.Color = C.ink
	subStroke.Thickness = 1.5
	subStroke.Transparency = 0.35
	subStroke.Parent = cardSub

	local placeKey = ""
	local cardToken = 0
	local function layout()
		local size = gui.AbsoluteSize
		local portrait = size.X < size.Y
		-- The town scale never drops below 1, so the objective stays at 15 px or more on phones.
		local k = Style.currentScale()
		if portrait then
			strip.Position = UDim2.fromOffset(12, 70)
			strip.Size = UDim2.fromOffset(math.max(200, (size.X - 24) / k), 0)
		else
			local room = size.X - 12 - navWidth() - 20
			strip.Position = UDim2.fromOffset(12, 8)
			strip.Size = UDim2.fromOffset(math.clamp(math.min(size.X * 0.44, room), 240, 400) / k, 0)
		end
		objective.TextSize = if size.Y >= 600 and not portrait then 17 else 16
		card.Size = UDim2.fromOffset(math.min(600, size.X - 24), 92)
		-- Below the toast stack's first row (76..122 design px) on short landscape screens.
		card.Position = UDim2.new(0.5, 0, 0, if portrait then 200 else math.max(size.Y * 0.28, 128))
		cardScale.Scale = math.clamp(size.X / 760, 0.72, 1.1)
		local titleWidth = math.min(cardTitle.TextBounds.X, card.AbsoluteSize.X)
		for _, rule in rules do
			rule.Size = UDim2.fromOffset(math.max(18, (card.Size.X.Offset - titleWidth) / 2 - 22), 2)
		end
	end
	gui:GetPropertyChangedSignal("AbsoluteSize"):Connect(layout)
	cardTitle:GetPropertyChangedSignal("TextBounds"):Connect(layout)
	layout()

	local api = {}
	api.frame = strip
	api.ticket = ticket
	function api.setVisible(on: boolean)
		strip.Visible = on
	end
	function api.hideCard()
		cardToken += 1
		card.Visible = false
	end
	function api.setPlace(key: string, title: string, icon: string, accent: Color3?)
		if key == placeKey then
			return
		end
		placeKey = key
		place.Text = title
		badge.BackgroundColor3 = accent or C.bulb
		if badgeIcon then
			badgeIcon:Destroy()
		end
		badgeIcon = Glyphs.mount(badge, icon, 22, C.ink, UDim2.new(0.5, -11, 0.5, -11))
		if strip.Visible and not Style.reduced() then
			place.TextTransparency = 1
			Style.tween(place, 0.35, { TextTransparency = 0 })
			Style.pop(badge, 0.5)
		else
			place.TextTransparency = 0
		end
	end
	local lastObjective = ""
	function api.setObjective(text: string, tone: Tone?)
		local colour = if tone == "notice"
			then C.bulb
			elseif tone == "task" then C.cream
			elseif tone == "arrive" then C.good
			else Color3.fromRGB(226, 222, 244)
		objective.TextColor3 = colour
		if text == lastObjective then
			return
		end
		lastObjective = text
		objective.Text = text
		if strip.Visible and tone ~= "task" and not Style.reduced() then
			objective.TextTransparency = 0.6
			Style.tween(objective, 0.3, { TextTransparency = 0 })
		end
	end
	function api.setTicket(open: boolean, attention: boolean)
		ticket.BackgroundColor3 = if open then C.bulb else C.lacquer
		Glyphs.tint(ticket:FindFirstChild("Glyph_ticket") or ticket, if open then C.ink else C.bulb)
		ticketEdge.Thickness = if attention then 2.5 else 1.5
		ticketEdge.Color = if attention then C.bulb else C.champagne
	end
	-- Slides the district name in, holds it, then fades it away.
	function api.titleCard(title: string, subtitle: string, accent: Color3?)
		cardToken += 1
		local token = cardToken
		cardTitle.Text = Style.spaced(title)
		cardTitle.TextColor3 = accent or C.bulb
		cardSub.Text = subtitle
		card.Visible = true
		card.GroupTransparency = 1
		local home = card.Position
		local reduced = Style.reduced()
		if not reduced then
			card.Position = home - UDim2.fromOffset(0, 18)
		end
		Style.tween(card, 0.55, { GroupTransparency = 0, Position = home }, Enum.EasingStyle.Quint)
		task.delay(2.6, function()
			if token ~= cardToken then
				return
			end
			Style.tween(card, 0.7, { GroupTransparency = 1 }, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
			task.delay(0.75, function()
				if token == cardToken then
					card.Visible = false
				end
			end)
		end)
	end
	api.layout = layout
	return api
end
return Strip
