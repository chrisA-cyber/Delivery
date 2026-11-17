--!strict
--[[
UITheme: Delivery's client design system. Owned by ui-core. Client only.

	local UITheme = require(script.Parent.UITheme)

Mood: a late-night Art Deco variety show. Midnight panels, champagne trim, warm bulb highlights,
cream text. Every helper below is safe to call from any client module.

TOKENS (read-only tables)
	UITheme.Color.<key>   camelCase Color3: midnight, panel, panelTop, panelDeep, panelRaised, cobalt,
	                      powder, lacquer, champagne, bulb, petal, harbor, copper, cream, ink, muted,
	                      live, good, bad, shadow, paper
	UITheme.Colors.<Key>  the same colours with PascalCase keys (Panel, PanelDeep, Midnight, Ink, Good...)
	UITheme.Font.<key>    Enum.Font: display (FredokaOne), heading (BuilderSansExtraBold),
	                      bold (BuilderSansBold), body (BuilderSansMedium), button (BuilderSansExtraBold)
	                      Enum.Font is used on purpose so TextService:GetTextSize works synchronously.
	UITheme.Text.<key>    base text px BEFORE UIScale: caption 16, body 17, button 18, title 24,
	                      headline 30, hero 56. Never set text below 16 base: with the 0.88 phone
	                      scale floor that keeps every string >= 14 px on screen.
	UITheme.Radius        panel 16, card 12, button 12, chip 10 (UITheme.corner(obj, "pill") = fully round)
	UITheme.Space         gap 8, pad 12, margin 10
	UITheme.TouchTarget   48 (minimum button height, design px)
	UITheme.Motion        fast 0.12, base 0.22, slow 0.28 (seconds)
	UITheme.Z             shadow 0, fill 1, content 2. Inside a UITheme.panel, give content ZIndex >= 2
	                      (every UITheme factory already does).

SCALE AND SAFE AREA
	UITheme.scaleFor(viewport: Vector2): number    0.88 (short side <= 340) .. 1.0 (450..720) .. 1.15 (>= 1080)
	UITheme.currentScale(): number                  scaleFor(current camera viewport)
	UITheme.attachScale(target: GuiObject): UIScale adds/updates a UIScale named "ThemeScale" that tracks
	                                                the viewport. Put it on your top-level container, not
	                                                on the ScreenGui. Lay out in design px (screen px / scale).
	UITheme.onScale(callback: (number) -> ()): () -> ()  fires when the scale changes; returns disconnect
	UITheme.touchHeight(): number                   button height in design px that stays >= 48 screen px
	                                                (48 on desktop, 52-55 on phones)
	UITheme.isTouch(): boolean
	UITheme.reducedMotion(): boolean                Roblox ReducedMotion preference
	Shared HUD: the ScreenGui PlayerGui.DeliveryShow uses ScreenInsets.CoreUISafeInsets, so (0, 0) is
	already below the Roblox top bar and inside the notch. Reserved zones inside it:
	  * top-right: the show navigation pills. Live width in screen px = DeliveryShow:GetAttribute("HudNavWidth"),
	    height 64 design px. Keep other top-row UI left of it.
	  * top-centre 76..~260 design px: the toast stack (its own ScreenGui "DeliveryToasts", DisplayOrder 40).
	  * bottom: the ControlDesk sheet. Its live top edge in screen px is DeliveryShow:GetAttribute("HudDeskTop")
	    (nil/absent while hidden).
	  * touch: while GuiService.TouchControlsEnabled is true, keep the bottom-left 30% x 45% (thumbstick) and
	    the bottom-right 110 x 110 design px (jump) clear.
	Town modules (location strip, chevron, map) may parent straight into DeliveryShow, or into the frame
	ui.layers.town (a full-size transparent Frame named "TownLayer" below the nav and desk in draw order).

PRIMITIVES
	UITheme.corner(obj: GuiObject, radius: (number | "pill")?): UICorner
	UITheme.stroke(obj: GuiObject, color: Color3?, thickness: number?, transparency: number?): UIStroke
	UITheme.gradient(obj: GuiObject, top: Color3, bottom: Color3, rotation: number?): UIGradient
	UITheme.padding(obj: GuiObject, x: number, y: number?): UIPadding
	UITheme.label(parent: Instance, props: LabelProps): TextLabel
		LabelProps = { name: string?, text: string?, font: Enum.Font?, size: number?, color: Color3?,
		               alignX: Enum.TextXAlignment?, alignY: Enum.TextYAlignment?, wrap: boolean?,
		               scaled: boolean?, min: number?, z: number? }
		scaled = true uses TextScaled with a UITextSizeConstraint (min defaults to 16, max = size).
	UITheme.icon(parent: Instance, name: string, sizePx: number, color: Color3?, position: UDim2?): GuiObject
		Feather names (award bell book-open chevron-right headphones help-circle mic music play radio settings
		users) plus x check arrow-left map clock star home zap eye, and emoji names: emoji-rose emoji-tomato
		emoji-laugh emoji-gasp emoji-meh emoji-smile emoji-grin emoji-starstruck emoji-star emoji-party.
	UITheme.panel(parent: Instance, name: string, opts: PanelOpts?): (Frame, Frame)
		PanelOpts = { color: Color3?, transparency: number?, radius: number?, strokeColor: Color3?,
		              shadow: boolean? }
		Returns (container, fill). The container is transparent; "Shadow" (offset darker frame, ZIndex 0)
		and "Fill" (midnight gradient, champagne stroke, ZIndex 1) sit inside it. Parent content to the
		container with ZIndex >= 2.
	UITheme.ribbon(parent: Instance, text: string?): (Frame, TextLabel)   header ribbon with deco chevrons
	UITheme.chip(parent: Instance, text: string, opts: { color: Color3?, textColor: Color3?, icon: string? }?): Frame
	UITheme.liveDot(parent: Instance, sizePx: number?): (Frame, (on: boolean, pulsing: boolean?) -> ())

BUTTONS
	UITheme.button(parent: Instance, opts: ButtonOpts): TextButton
		ButtonOpts = { name: string?, text: string?, icon: string?, variant: string?, pill: boolean?,
		               size: UDim2?, layoutOrder: number?, onActivated: (() -> ())? }
		variant: "primary" (champagne-to-bulb, midnight text) | "secondary" (outlined) | "ghost" |
		         "danger" | "live". Default "secondary". pill = auto-width 48 px pill (icon + label).
	UITheme.styleButton(button: TextButton, variant: string?, pill: boolean?): TextButton
		Restyles an existing TextButton in place (idempotent). The button keeps working with code that
		sets .Text, .TextColor3 and .BackgroundColor3: those are mirrored onto the themed face.
	UITheme.attachFeedback(button: GuiButton): ()   hover brighten, press 0.94 + bounce back, click sound
	UITheme.setVariant(button: TextButton, variant: string): ()
	UITheme.setEnabled(button: GuiButton, enabled: boolean): ()   disabled = dimmed, ignores presses
	UITheme.isEnabled(button: GuiButton): boolean
	UITheme.setHot(button: TextButton, hot: boolean): ()          timing-pad highlight (bulb glow + pop)
	UITheme.setIcon(button: TextButton, icon: string?): ()
	UITheme.setKey(button: TextButton, key: string?): ()          small keycap hint ("1") for keyboards
	UITheme.setClickSound(play: ((kind: string) -> ())?): ()      replace the default click; nil restores it
	UITheme.click(kind: string?): ()                              "tap" | "confirm" | "toast" | "reward"

MOTION (all respect reduced motion: they jump to the end state)
	UITheme.tween(obj: Instance, duration: number, goals: { [string]: any }, style: Enum.EasingStyle?,
	              direction: Enum.EasingDirection?): Tween?
	UITheme.cancel(obj: Instance): ()                       stops tweens started by UITheme on obj
	UITheme.openPanel(obj: GuiObject, mode: ("slide" | "pop" | "drop")?): ()   show with motion
	UITheme.closePanel(obj: GuiObject, onDone: (() -> ())?): ()               hide with motion
	UITheme.pop(obj: GuiObject, amount: number?): ()        quick bounce. UIScale grows from the AnchorPoint, so
	                                                        use AnchorPoint 0.5 frames; themed buttons pop their Face.
	UITheme.pulse(obj: GuiObject, on: boolean): ()          gentle looping attention pulse (same rule)
	UITheme.countUp(label: TextLabel, from: number, to: number, duration: number?,
	                format: ((number) -> string)?): () -> ()   ticking number; returns cancel
	UITheme.ring(parent: Instance, sizePx: number, thickness: number?): Ring
		Ring = { frame: Frame, label: TextLabel, set: (fraction: number, text: string?) -> (),
		         setColor: (Color3) -> () }      animated countdown ring (fraction 1 = full)

TOASTS (own ScreenGui, never overlaps the nav pills or Roblox core UI)
	UITheme.toast(message: string, opts: ToastOpts?): ()
		ToastOpts = { kind: ("info" | "success" | "warn" | "live" | "reward")?, icon: string?,
		              duration: number?, key: string? }
		At most three on screen; the rest queue. A toast with the same key (default: the same text) that is
		still visible is updated in place and its timer restarts.
	UITheme.reward(amount: number, what: string, icon: string?): ()   "+10 stage XP" chip
	UITheme.clearToasts(): ()
]]
local Players = game:GetService("Players")
local GuiService = game:GetService("GuiService")
local Input = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")
local RunService = game:GetService("RunService")
local TextService = game:GetService("TextService")
local SoundService = game:GetService("SoundService")
local ShowIcons = require(script.Parent.ShowIcons)

local UITheme = {}

local C = {
	midnight = Color3.fromRGB(36, 41, 87),
	panel = Color3.fromRGB(27, 29, 58),
	panelTop = Color3.fromRGB(41, 46, 96),
	panelDeep = Color3.fromRGB(19, 20, 42),
	panelRaised = Color3.fromRGB(46, 52, 112),
	cobalt = Color3.fromRGB(65, 91, 168),
	powder = Color3.fromRGB(146, 154, 203),
	lacquer = Color3.fromRGB(91, 35, 56),
	champagne = Color3.fromRGB(221, 180, 129),
	bulb = Color3.fromRGB(255, 220, 158),
	petal = Color3.fromRGB(213, 140, 165),
	harbor = Color3.fromRGB(66, 131, 142),
	copper = Color3.fromRGB(135, 83, 51),
	cream = Color3.fromRGB(255, 240, 207),
	paper = Color3.fromRGB(255, 244, 222),
	ink = Color3.fromRGB(26, 28, 56),
	muted = Color3.fromRGB(184, 182, 214),
	live = Color3.fromRGB(255, 84, 98),
	good = Color3.fromRGB(126, 214, 168),
	bad = Color3.fromRGB(232, 112, 122),
	shadow = Color3.fromRGB(8, 9, 22),
}
UITheme.Color = C
UITheme.Colors = {
	Midnight = C.midnight,
	Panel = C.panel,
	PanelTop = C.panelTop,
	PanelDeep = C.panelDeep,
	PanelRaised = C.panelRaised,
	Cobalt = C.cobalt,
	Powder = C.powder,
	Lacquer = C.lacquer,
	Champagne = C.champagne,
	Bulb = C.bulb,
	Petal = C.petal,
	Harbor = C.harbor,
	Copper = C.copper,
	Cream = C.cream,
	Paper = C.paper,
	Ink = C.ink,
	Muted = C.muted,
	Live = C.live,
	Good = C.good,
	Bad = C.bad,
	Shadow = C.shadow,
}
UITheme.Font = {
	display = Enum.Font.FredokaOne,
	heading = Enum.Font.BuilderSansExtraBold,
	bold = Enum.Font.BuilderSansBold,
	body = Enum.Font.BuilderSansMedium,
	button = Enum.Font.BuilderSansExtraBold,
}
UITheme.Text = { caption = 16, body = 17, button = 18, title = 24, headline = 30, hero = 56 }
UITheme.Radius = { panel = 16, card = 12, button = 12, chip = 10 }
UITheme.Space = { gap = 8, pad = 12, margin = 10 }
UITheme.TouchTarget = 48
UITheme.Motion = { fast = 0.12, base = 0.22, slow = 0.28 }
UITheme.Z = { shadow = 0, fill = 1, content = 2 }

-- Preferences ---------------------------------------------------------------------------------

local reduced = false
pcall(function()
	reduced = GuiService.ReducedMotionEnabled
	GuiService:GetPropertyChangedSignal("ReducedMotionEnabled"):Connect(function()
		reduced = GuiService.ReducedMotionEnabled
	end)
end)
function UITheme.reducedMotion(): boolean
	return reduced
end
function UITheme.isTouch(): boolean
	return Input.PreferredInput == Enum.PreferredInput.Touch
end

-- Scale ---------------------------------------------------------------------------------------

function UITheme.scaleFor(viewport: Vector2): number
	local short = math.min(viewport.X, viewport.Y)
	if short <= 340 then
		return 0.88
	elseif short < 450 then
		return 0.88 + (short - 340) / 110 * 0.12
	elseif short <= 720 then
		return 1
	end
	return math.min(1.15, 1 + (short - 720) / 360 * 0.15)
end
local function viewport(): Vector2
	local camera = workspace.CurrentCamera
	return if camera then camera.ViewportSize else Vector2.new(1280, 720)
end
function UITheme.currentScale(): number
	return UITheme.scaleFor(viewport())
end
local scaled: { [UIScale]: boolean } = setmetatable({}, { __mode = "k" }) :: any
local scaleListeners: { [number]: (number) -> () } = {}
local listenerId = 0
local lastScale = UITheme.currentScale()
local cameraWatch: RBXScriptConnection? = nil
local function applyScale()
	local value = UITheme.currentScale()
	for item in scaled do
		if item.Parent then
			item.Scale = value
		end
	end
	if math.abs(value - lastScale) > 0.001 then
		lastScale = value
		for _, callback in scaleListeners do
			task.spawn(callback, value)
		end
	end
end
local function watchCamera()
	if cameraWatch then
		cameraWatch:Disconnect()
		cameraWatch = nil
	end
	local camera = workspace.CurrentCamera
	if camera then
		cameraWatch = camera:GetPropertyChangedSignal("ViewportSize"):Connect(applyScale)
	end
	applyScale()
end
workspace:GetPropertyChangedSignal("CurrentCamera"):Connect(watchCamera)
watchCamera()
-- Minimum hit height in design px so a target stays >= 48 screen px after UIScale shrinks it.
function UITheme.touchHeight(): number
	return math.max(UITheme.TouchTarget, math.ceil(UITheme.TouchTarget / UITheme.currentScale()))
end
function UITheme.attachScale(target: GuiObject): UIScale
	local existing = target:FindFirstChild("ThemeScale")
	local item: UIScale = if existing and existing:IsA("UIScale") then existing else Instance.new("UIScale")
	item.Name = "ThemeScale"
	item.Scale = UITheme.currentScale()
	item.Parent = target
	scaled[item] = true
	return item
end
function UITheme.onScale(callback: (number) -> ()): () -> ()
	listenerId += 1
	local id = listenerId
	scaleListeners[id] = callback
	return function()
		scaleListeners[id] = nil
	end
end

-- Primitives ----------------------------------------------------------------------------------

function UITheme.corner(obj: GuiObject, radius: any?): UICorner
	local item = obj:FindFirstChildOfClass("UICorner") or Instance.new("UICorner")
	item.CornerRadius = if radius == "pill"
		then UDim.new(0.5, 0)
		else UDim.new(0, if type(radius) == "number" then radius else UITheme.Radius.button)
	item.Parent = obj
	return item
end
function UITheme.stroke(obj: GuiObject, color: Color3?, thickness: number?, transparency: number?): UIStroke
	local item = obj:FindFirstChildOfClass("UIStroke") or Instance.new("UIStroke")
	item.Color = color or C.champagne
	item.Thickness = thickness or 1.5
	item.Transparency = transparency or 0.25
	item.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	item.LineJoinMode = Enum.LineJoinMode.Round
	item.Parent = obj
	return item
end
function UITheme.gradient(obj: GuiObject, top: Color3, bottom: Color3, rotation: number?): UIGradient
	local item = obj:FindFirstChildOfClass("UIGradient") or Instance.new("UIGradient")
	item.Color = ColorSequence.new(top, bottom)
	item.Rotation = rotation or 90
	item.Parent = obj
	return item
end
function UITheme.padding(obj: GuiObject, x: number, y: number?): UIPadding
	local item = obj:FindFirstChildOfClass("UIPadding") or Instance.new("UIPadding")
	item.PaddingLeft = UDim.new(0, x)
	item.PaddingRight = UDim.new(0, x)
	item.PaddingTop = UDim.new(0, y or x)
	item.PaddingBottom = UDim.new(0, y or x)
	item.Parent = obj
	return item
end
export type LabelProps = {
	name: string?,
	text: string?,
	font: Enum.Font?,
	size: number?,
	color: Color3?,
	alignX: Enum.TextXAlignment?,
	alignY: Enum.TextYAlignment?,
	wrap: boolean?,
	scaled: boolean?,
	min: number?,
	z: number?,
}
function UITheme.label(parent: Instance, props: LabelProps): TextLabel
	local item = Instance.new("TextLabel")
	item.Name = props.name or "Text"
	item.Text = props.text or ""
	item.BackgroundTransparency = 1
	item.BorderSizePixel = 0
	item.Font = props.font or UITheme.Font.body
	item.TextColor3 = props.color or C.cream
	item.TextSize = props.size or UITheme.Text.body
	item.TextWrapped = props.wrap ~= false
	item.TextXAlignment = props.alignX or Enum.TextXAlignment.Left
	item.TextYAlignment = props.alignY or Enum.TextYAlignment.Center
	item.ZIndex = props.z or UITheme.Z.content
	if props.scaled then
		item.TextScaled = true
		local bounds = Instance.new("UITextSizeConstraint")
		bounds.MinTextSize = math.min(props.min or 16, props.size or UITheme.Text.body)
		bounds.MaxTextSize = props.size or UITheme.Text.body
		bounds.Parent = item
	end
	item.Parent = parent
	return item
end
function UITheme.icon(
	parent: Instance,
	name: string,
	sizePx: number,
	color: Color3?,
	position: UDim2?
): GuiObject
	local glyph = ShowIcons.mount(parent :: any, name, sizePx, color or C.cream, position)
	glyph.Name = "Icon"
	glyph.ZIndex = UITheme.Z.content + 1
	for _, part in glyph:GetDescendants() do
		if part:IsA("GuiObject") then
			part.ZIndex = glyph.ZIndex
		end
	end
	return glyph
end
export type PanelOpts = {
	color: Color3?,
	transparency: number?,
	radius: number?,
	strokeColor: Color3?,
	shadow: boolean?,
}
function UITheme.panel(parent: Instance, name: string, opts: PanelOpts?): (Frame, Frame)
	local o: PanelOpts = opts or {}
	local radius = o.radius or UITheme.Radius.panel
	local container = Instance.new("Frame")
	container.Name = name
	container.BackgroundTransparency = 1
	container.BorderSizePixel = 0
	container.Parent = parent
	if o.shadow ~= false then
		local shadow = Instance.new("Frame")
		shadow.Name = "Shadow"
		shadow.BorderSizePixel = 0
		shadow.BackgroundColor3 = C.shadow
		shadow.BackgroundTransparency = 0.55
		shadow.Position = UDim2.fromOffset(0, 5)
		shadow.Size = UDim2.new(1, 0, 1, 2)
		shadow.ZIndex = UITheme.Z.shadow
		UITheme.corner(shadow, radius + 2)
		shadow.Parent = container
	end
	local fill = Instance.new("Frame")
	fill.Name = "Fill"
	fill.BorderSizePixel = 0
	fill.Size = UDim2.fromScale(1, 1)
	fill.BackgroundColor3 = Color3.new(1, 1, 1)
	fill.BackgroundTransparency = o.transparency or 0.07
	fill.ZIndex = UITheme.Z.fill
	UITheme.corner(fill, radius)
	local base = o.color or C.panel
	UITheme.gradient(fill, base:Lerp(C.panelTop, 0.85), base)
	UITheme.stroke(fill, o.strokeColor or C.champagne, 1.5, 0.3)
	fill.Parent = container
	return container, fill
end
local function diamond(parent: Instance, order: number, color: Color3, size: number)
	local d = Instance.new("Frame")
	d.Name = "Chevron"
	d.BorderSizePixel = 0
	d.BackgroundColor3 = color
	d.Rotation = 45
	d.Size = UDim2.fromOffset(size, size)
	d.LayoutOrder = order
	d.ZIndex = UITheme.Z.content + 1
	d.Parent = parent
	return d
end
function UITheme.ribbon(parent: Instance, text: string?): (Frame, TextLabel)
	local ribbon = Instance.new("Frame")
	ribbon.Name = "Ribbon"
	ribbon.BorderSizePixel = 0
	ribbon.BackgroundColor3 = Color3.new(1, 1, 1)
	ribbon.AutomaticSize = Enum.AutomaticSize.X
	ribbon.Size = UDim2.fromOffset(0, 28)
	ribbon.ZIndex = UITheme.Z.content
	UITheme.corner(ribbon, "pill")
	UITheme.gradient(ribbon, C.lacquer:Lerp(C.petal, 0.18), C.lacquer, 90)
	UITheme.stroke(ribbon, C.champagne, 1.5, 0.15)
	local list = Instance.new("UIListLayout")
	list.FillDirection = Enum.FillDirection.Horizontal
	list.VerticalAlignment = Enum.VerticalAlignment.Center
	list.SortOrder = Enum.SortOrder.LayoutOrder
	list.Padding = UDim.new(0, 8)
	list.Parent = ribbon
	UITheme.padding(ribbon, 12, 0)
	diamond(ribbon, 1, C.champagne, 6)
	local caption = UITheme.label(ribbon, {
		name = "Text",
		text = text or "",
		font = UITheme.Font.heading,
		size = UITheme.Text.caption,
		color = C.bulb,
		wrap = false,
		z = UITheme.Z.content + 1,
	})
	caption.AutomaticSize = Enum.AutomaticSize.X
	caption.Size = UDim2.fromScale(0, 1)
	caption.LayoutOrder = 2
	caption.TextTruncate = Enum.TextTruncate.AtEnd
	diamond(ribbon, 3, C.champagne, 6)
	ribbon.Parent = parent
	return ribbon, caption
end
function UITheme.chip(
	parent: Instance,
	text: string,
	opts: { color: Color3?, textColor: Color3?, icon: string? }?
): Frame
	local o = opts or {}
	local chip = Instance.new("Frame")
	chip.Name = "Chip"
	chip.BorderSizePixel = 0
	chip.BackgroundColor3 = o.color or C.bulb
	chip.AutomaticSize = Enum.AutomaticSize.X
	chip.Size = UDim2.fromOffset(0, 30)
	chip.ZIndex = UITheme.Z.content
	UITheme.corner(chip, "pill")
	local list = Instance.new("UIListLayout")
	list.FillDirection = Enum.FillDirection.Horizontal
	list.VerticalAlignment = Enum.VerticalAlignment.Center
	list.SortOrder = Enum.SortOrder.LayoutOrder
	list.Padding = UDim.new(0, 6)
	list.Parent = chip
	UITheme.padding(chip, 12, 0)
	local textColor = o.textColor or C.ink
	if o.icon then
		local glyph = UITheme.icon(chip, o.icon, 18, textColor)
		glyph.LayoutOrder = 1
	end
	local caption = UITheme.label(chip, {
		name = "Text",
		text = text,
		font = UITheme.Font.heading,
		size = UITheme.Text.caption,
		color = textColor,
		wrap = false,
		z = UITheme.Z.content + 1,
	})
	caption.AutomaticSize = Enum.AutomaticSize.X
	caption.Size = UDim2.fromScale(0, 1)
	caption.LayoutOrder = 2
	chip.Parent = parent
	return chip
end

-- Motion --------------------------------------------------------------------------------------

local active: { [Instance]: { Tween } } = setmetatable({}, { __mode = "k" }) :: any
function UITheme.cancel(obj: Instance)
	local list = active[obj]
	if list then
		active[obj] = nil
		for _, t in list do
			t:Cancel()
		end
	end
end
function UITheme.tween(
	obj: Instance,
	duration: number,
	goals: { [string]: any },
	style: Enum.EasingStyle?,
	direction: Enum.EasingDirection?
): Tween?
	if reduced or duration <= 0 then
		for key, value in goals do
			(obj :: any)[key] = value
		end
		return nil
	end
	local t = TweenService:Create(
		obj,
		TweenInfo.new(duration, style or Enum.EasingStyle.Quint, direction or Enum.EasingDirection.Out),
		goals
	)
	local list = active[obj]
	if not list then
		list = {}
		active[obj] = list
	end
	table.insert(list, t)
	t.Completed:Once(function()
		local now = active[obj]
		if now then
			local index = table.find(now, t)
			if index then
				table.remove(now, index)
			end
		end
	end)
	t:Play()
	return t
end
local function scaleOf(obj: GuiObject, name: string): UIScale
	local existing = obj:FindFirstChild(name)
	if existing and existing:IsA("UIScale") then
		return existing
	end
	local item = Instance.new("UIScale")
	item.Name = name
	item.Parent = obj
	return item
end
-- Only one UIScale per object takes effect, so motion reuses ThemeScale when the object has one.
-- Themed buttons animate their centred Face so a pulse or pop never shifts the layout.
local function motionScale(obj: GuiObject): (UIScale, number)
	if obj:GetAttribute("ThemeButton") then
		local f = obj:FindFirstChild("Face")
		if f and f:IsA("GuiObject") then
			obj = f
		end
	end
	local theme = obj:FindFirstChild("ThemeScale")
	if theme and theme:IsA("UIScale") then
		return theme, UITheme.currentScale()
	end
	return scaleOf(obj, "ThemeMotion"), 1
end
function UITheme.openPanel(obj: GuiObject, mode: string?)
	UITheme.cancel(obj)
	local target = obj:GetAttribute("ThemeRestPosition")
	if typeof(target) == "UDim2" then
		obj.Position = target
	end
	obj:SetAttribute("ThemeRestPosition", nil)
	local s, base = motionScale(obj)
	UITheme.cancel(s)
	s.Scale = base
	obj.Visible = true
	if reduced then
		return
	end
	if mode == "pop" then
		s.Scale = base * 0.9
		UITheme.tween(s, UITheme.Motion.base, { Scale = base }, Enum.EasingStyle.Back)
	else
		local rest = obj.Position
		obj:SetAttribute("ThemeRestPosition", rest)
		obj.Position = rest + UDim2.fromOffset(0, if mode == "drop" then -28 else 36)
		local t = UITheme.tween(obj, 0.26, { Position = rest }, Enum.EasingStyle.Back)
		if t then
			t.Completed:Once(function(state)
				if state == Enum.PlaybackState.Completed then
					obj:SetAttribute("ThemeRestPosition", nil)
				end
			end)
		end
	end
end
function UITheme.closePanel(obj: GuiObject, onDone: (() -> ())?)
	UITheme.cancel(obj)
	local rest = obj:GetAttribute("ThemeRestPosition")
	if typeof(rest) == "UDim2" then
		obj.Position = rest
	end
	obj:SetAttribute("ThemeRestPosition", nil)
	if reduced or not obj.Visible then
		obj.Visible = false
		if onDone then
			onDone()
		end
		return
	end
	local home = obj.Position
	obj:SetAttribute("ThemeRestPosition", home)
	local t = UITheme.tween(
		obj,
		0.16,
		{ Position = home + UDim2.fromOffset(0, 30) },
		Enum.EasingStyle.Quad,
		Enum.EasingDirection.In
	)
	local function finish()
		obj.Visible = false
		obj.Position = home
		obj:SetAttribute("ThemeRestPosition", nil)
		if onDone then
			onDone()
		end
	end
	if t then
		t.Completed:Once(function(state)
			if state == Enum.PlaybackState.Completed then
				finish()
			end
		end)
	else
		finish()
	end
end
function UITheme.pop(obj: GuiObject, amount: number?)
	if reduced then
		return
	end
	local s, base = motionScale(obj)
	UITheme.cancel(s)
	s.Scale = base * (1 + (amount or 0.12))
	UITheme.tween(s, 0.3, { Scale = base }, Enum.EasingStyle.Back)
end
local pulses: { [GuiObject]: Tween } = setmetatable({}, { __mode = "k" }) :: any
function UITheme.pulse(obj: GuiObject, on: boolean)
	local running = pulses[obj]
	if on == (running ~= nil) then
		return
	end
	local s, base = motionScale(obj)
	if running then
		running:Cancel()
		pulses[obj] = nil
		s.Scale = base
		return
	end
	if reduced then
		return
	end
	s.Scale = base
	local t = TweenService:Create(
		s,
		TweenInfo.new(0.7, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true),
		{ Scale = base * 1.06 }
	)
	pulses[obj] = t
	t:Play()
end
function UITheme.countUp(
	label: TextLabel,
	from: number,
	to: number,
	duration: number?,
	format: ((number) -> string)?
): () -> ()
	local show = format or function(n: number)
		return tostring(math.floor(n + 0.5))
	end
	local span = duration or 0.9
	if reduced or span <= 0 then
		label.Text = show(to)
		return function() end
	end
	local started = os.clock()
	local connection: RBXScriptConnection? = nil
	label.Text = show(from)
	connection = RunService.Heartbeat:Connect(function()
		local t = math.clamp((os.clock() - started) / span, 0, 1)
		local eased = 1 - (1 - t) ^ 3
		label.Text = show(from + (to - from) * eased)
		if t >= 1 and connection then
			connection:Disconnect()
			connection = nil
		end
	end)
	return function()
		if connection then
			connection:Disconnect()
			connection = nil
		end
	end
end

-- Countdown ring --------------------------------------------------------------------------------

export type Ring = {
	frame: Frame,
	label: TextLabel,
	set: (fraction: number, text: string?) -> (),
	setColor: (color: Color3) -> (),
}
function UITheme.ring(parent: Instance, sizePx: number, thickness: number?): Ring
	local t = thickness or 4
	local root = Instance.new("Frame")
	root.Name = "Ring"
	root.BackgroundTransparency = 1
	root.Size = UDim2.fromOffset(sizePx, sizePx)
	root.ZIndex = UITheme.Z.content
	root.Parent = parent
	local back = Instance.new("Frame")
	back.Name = "Track"
	back.BackgroundColor3 = C.panelDeep
	back.BackgroundTransparency = 0.25
	back.AnchorPoint = Vector2.new(0.5, 0.5)
	back.Position = UDim2.fromScale(0.5, 0.5)
	back.Size = UDim2.new(1, -t * 2, 1, -t * 2)
	back.ZIndex = UITheme.Z.content
	UITheme.corner(back, "pill")
	UITheme.stroke(back, C.powder, t, 0.75)
	back.Parent = root
	local edges: { UIStroke } = {}
	local fills: { UIGradient } = {}
	for i, side in { "Left", "Right" } do
		local half = Instance.new("Frame")
		half.Name = side
		half.BackgroundTransparency = 1
		half.ClipsDescendants = true
		half.Position = UDim2.fromScale(if i == 1 then 0 else 0.5, 0)
		half.Size = UDim2.fromScale(0.5, 1)
		half.ZIndex = UITheme.Z.content + 1
		half.Parent = root
		local arc = Instance.new("Frame")
		arc.Name = "Arc"
		arc.BackgroundTransparency = 1
		arc.Position = UDim2.new(if i == 1 then 0 else -1, t, 0, t)
		arc.Size = UDim2.new(2, -t * 2, 1, -t * 2)
		arc.ZIndex = UITheme.Z.content + 1
		UITheme.corner(arc, "pill")
		local edge = UITheme.stroke(arc, C.bulb, t, 0)
		local mask = Instance.new("UIGradient")
		mask.Transparency = NumberSequence.new({
			NumberSequenceKeypoint.new(0, 0),
			NumberSequenceKeypoint.new(0.499, 0),
			NumberSequenceKeypoint.new(0.5, 1),
			NumberSequenceKeypoint.new(1, 1),
		})
		mask.Parent = edge
		arc.Parent = half
		edges[i] = edge
		fills[i] = mask
	end
	local caption = UITheme.label(root, {
		name = "Clock",
		font = UITheme.Font.display,
		size = math.max(16, math.floor(sizePx * 0.42)),
		color = C.cream,
		alignX = Enum.TextXAlignment.Center,
		wrap = false,
		z = UITheme.Z.content + 2,
	})
	caption.Size = UDim2.fromScale(1, 1)
	local function set(fraction: number, text: string?)
		local p = math.clamp(fraction, 0, 1)
		-- Each half shows the arc clockwise from twelve o'clock; the hard gradient edge rotates with p.
		fills[2].Rotation = math.min(p, 0.5) * 360
		fills[1].Rotation = math.max(p, 0.5) * 360
		edges[1].Enabled = p > 0.5
		edges[2].Enabled = p > 0
		if text then
			caption.Text = text
		end
	end
	local function setColor(color: Color3)
		edges[1].Color = color
		edges[2].Color = color
	end
	set(1)
	return { frame = root, label = caption, set = set, setColor = setColor }
end

-- Live dot ------------------------------------------------------------------------------------

function UITheme.liveDot(parent: Instance, sizePx: number?): (Frame, (on: boolean, pulsing: boolean?) -> ())
	local size = sizePx or 10
	local holder = Instance.new("Frame")
	holder.Name = "LiveDot"
	holder.BackgroundTransparency = 1
	holder.Size = UDim2.fromOffset(size, size)
	holder.ZIndex = UITheme.Z.content
	holder.Parent = parent
	local halo = Instance.new("Frame")
	halo.Name = "Halo"
	halo.BorderSizePixel = 0
	halo.BackgroundColor3 = C.live
	halo.BackgroundTransparency = 1
	halo.AnchorPoint = Vector2.new(0.5, 0.5)
	halo.Position = UDim2.fromScale(0.5, 0.5)
	halo.Size = UDim2.fromScale(1, 1)
	halo.ZIndex = UITheme.Z.content
	UITheme.corner(halo, "pill")
	halo.Parent = holder
	local dot = Instance.new("Frame")
	dot.Name = "Dot"
	dot.BorderSizePixel = 0
	dot.BackgroundColor3 = C.live
	dot.Size = UDim2.fromScale(1, 1)
	dot.ZIndex = UITheme.Z.content + 1
	UITheme.corner(dot, "pill")
	dot.Parent = holder
	local loop: Tween? = nil
	local function set(on: boolean, pulsing: boolean?)
		holder.Visible = on
		local want = on and pulsing == true and not reduced
		if want and not loop then
			halo.Size = UDim2.fromScale(1, 1)
			halo.BackgroundTransparency = 0.35
			local t = TweenService:Create(
				halo,
				TweenInfo.new(0.9, Enum.EasingStyle.Quad, Enum.EasingDirection.Out, -1),
				{ Size = UDim2.fromScale(2.6, 2.6), BackgroundTransparency = 1 }
			)
			loop = t
			t:Play()
		elseif not want and loop then
			loop:Cancel()
			loop = nil
			halo.BackgroundTransparency = 1
		end
	end
	set(false)
	return holder, set
end

-- Click sounds --------------------------------------------------------------------------------

local clickHook: ((string) -> ())? = nil
local templates: { [string]: Sound } = {}
local function template(kind: string): Sound
	local existing = templates[kind]
	if existing then
		return existing
	end
	local sound = Instance.new("Sound")
	sound.Name = "UITheme_" .. kind
	sound.SoundId = "rbxasset://sounds/volume_slider.ogg"
	sound.Volume = if kind == "confirm" or kind == "reward" then 0.22 else 0.14
	sound.PlaybackSpeed = if kind == "confirm"
		then 1.5
		elseif kind == "reward" then 1.9
		elseif kind == "toast" then 1.15
		else 1.3
	templates[kind] = sound
	return sound
end
function UITheme.setClickSound(play: ((kind: string) -> ())?)
	clickHook = play
end
local lastClick = 0
function UITheme.click(kind: string?)
	local k = kind or "tap"
	if clickHook then
		clickHook(k)
		return
	end
	local now = os.clock()
	if now - lastClick < 0.05 then
		return
	end
	lastClick = now
	pcall(function()
		SoundService:PlayLocalSound(template(k))
	end)
end

-- Buttons -------------------------------------------------------------------------------------

type Style = { fill: Color3, text: Color3, shade: Color3, edge: Color3, edgeT: number, faceT: number }
local styles: { [string]: Style } = {
	primary = {
		fill = C.bulb,
		text = C.ink,
		-- bulb at the top, champagne at the bottom (gradient multiplies the fill)
		shade = Color3.new(221 / 255, 180 / 220, 129 / 158),
		edge = C.bulb,
		edgeT = 0.35,
		faceT = 0,
	},
	secondary = {
		fill = C.panelRaised,
		text = C.cream,
		shade = Color3.new(0.72, 0.72, 0.78),
		edge = C.champagne,
		edgeT = 0.35,
		faceT = 0.04,
	},
	ghost = {
		fill = C.panelRaised,
		text = C.cream,
		shade = Color3.new(0.8, 0.8, 0.85),
		edge = C.powder,
		edgeT = 0.6,
		faceT = 0.45,
	},
	danger = {
		fill = C.lacquer,
		text = C.cream,
		shade = Color3.new(0.75, 0.7, 0.75),
		edge = C.petal,
		edgeT = 0.35,
		faceT = 0,
	},
	live = {
		fill = Color3.fromRGB(200, 52, 72),
		text = C.cream,
		shade = Color3.new(0.78, 0.7, 0.74),
		edge = C.live,
		edgeT = 0.2,
		faceT = 0,
	},
}
local function face(b: TextButton): Frame?
	local f = b:FindFirstChild("Face")
	return if f and f:IsA("Frame") then f else nil
end
local function faceLabel(b: TextButton): TextLabel?
	local f = face(b)
	if not f then
		return nil
	end
	local direct = f:FindFirstChild("Label")
	if direct and direct:IsA("TextLabel") then
		return direct
	end
	local row = f:FindFirstChild("Row")
	local nested = row and row:FindFirstChild("Label")
	return if nested and nested:IsA("TextLabel") then nested else nil
end
local function layoutFill(b: TextButton)
	local f = face(b)
	local label = faceLabel(b)
	if not f or not label or b:GetAttribute("ThemePill") then
		return
	end
	local glyph = f:FindFirstChild("Icon")
	local key = f:FindFirstChild("Keycap")
	local left = if glyph then 44 else 12
	local right = if key and (key :: GuiObject).Visible then 34 else 12
	if glyph then
		(glyph :: GuiObject).Position = UDim2.new(0, 14, 0.5, -11)
	end
	label.Position = UDim2.fromOffset(left, 2)
	label.Size = UDim2.new(1, -(left + right), 1, -4)
end
function UITheme.setVariant(b: TextButton, variant: string)
	local style = styles[variant] or styles.secondary
	b:SetAttribute("ThemeVariant", variant)
	b.BackgroundColor3 = style.fill
	b.TextColor3 = style.text
	local f = face(b)
	if f then
		f.BackgroundTransparency = style.faceT
		local shade = f:FindFirstChild("Shade")
		if shade and shade:IsA("UIGradient") then
			shade.Color = ColorSequence.new(Color3.new(1, 1, 1), style.shade)
		end
		local edge = f:FindFirstChild("Edge")
		if edge and edge:IsA("UIStroke") then
			edge.Color = style.edge
			edge.Transparency = style.edgeT
			edge.Thickness = if b:GetAttribute("ThemeHot") then 3 else 1.5
		end
	end
	if b:GetAttribute("ThemeDisabled") then
		UITheme.setEnabled(b, false)
	end
end
local function mirror(b: TextButton)
	local f = face(b)
	local label = faceLabel(b)
	if not f or not label then
		return
	end
	f.BackgroundColor3 = b.BackgroundColor3
	label.Text = b.Text
	label.TextColor3 = b.TextColor3
	local glyph = f:FindFirstChild("Icon", true)
	if glyph and glyph:IsA("GuiObject") then
		ShowIcons.recolor(glyph, b.TextColor3)
	end
	local key = f:FindFirstChild("Keycap")
	if key and key:IsA("TextLabel") then
		key.TextColor3 = b.TextColor3
		local edge = key:FindFirstChildOfClass("UIStroke")
		if edge then
			edge.Color = b.TextColor3
		end
	end
end
function UITheme.styleButton(b: TextButton, variant: string?, pill: boolean?): TextButton
	if not b:GetAttribute("ThemeButton") then
		b:SetAttribute("ThemeButton", true)
		b:SetAttribute("ThemePill", pill == true)
		b.AutoButtonColor = false
		b.BackgroundTransparency = 1
		b.BorderSizePixel = 0
		b.TextTransparency = 1
		b.Font = UITheme.Font.button
		b.TextSize = UITheme.Text.button
		b.Selectable = true
		local f = Instance.new("Frame")
		f.Name = "Face"
		f.AnchorPoint = Vector2.new(0.5, 0.5)
		f.Position = UDim2.fromScale(0.5, 0.5)
		f.Size = UDim2.fromScale(1, 1)
		f.BorderSizePixel = 0
		f.ZIndex = b.ZIndex
		UITheme.corner(f, if pill then "pill" else UITheme.Radius.button)
		local shade = Instance.new("UIGradient")
		shade.Name = "Shade"
		shade.Rotation = 90
		shade.Parent = f
		local edge = Instance.new("UIStroke")
		edge.Name = "Edge"
		edge.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
		edge.Thickness = 1.5
		edge.Parent = f
		local sheen = Instance.new("Frame")
		sheen.Name = "Sheen"
		sheen.BackgroundColor3 = Color3.new(1, 1, 1)
		sheen.BackgroundTransparency = 1
		sheen.BorderSizePixel = 0
		sheen.Size = UDim2.fromScale(1, 1)
		sheen.ZIndex = f.ZIndex
		UITheme.corner(sheen, if pill then "pill" else UITheme.Radius.button)
		sheen.Parent = f
		local label: TextLabel
		if pill then
			-- Pills are sized from their measured label row. AutomaticSize on the button itself would
			-- feed back through the full-size Face and stretch the pill across its parent.
			b.AutomaticSize = Enum.AutomaticSize.None
			local row = Instance.new("Frame")
			row.Name = "Row"
			row.BackgroundTransparency = 1
			row.AutomaticSize = Enum.AutomaticSize.X
			row.Size = UDim2.fromScale(0, 1)
			row.ZIndex = f.ZIndex + 1
			local list = Instance.new("UIListLayout")
			list.FillDirection = Enum.FillDirection.Horizontal
			list.VerticalAlignment = Enum.VerticalAlignment.Center
			list.SortOrder = Enum.SortOrder.LayoutOrder
			list.Padding = UDim.new(0, 8)
			list.Parent = row
			local pad = Instance.new("UIPadding")
			pad.PaddingLeft = UDim.new(0, 16)
			pad.PaddingRight = UDim.new(0, 18)
			pad.Parent = row
			label = UITheme.label(row, {
				name = "Label",
				font = UITheme.Font.button,
				size = UITheme.Text.button,
				wrap = false,
				z = f.ZIndex + 2,
			})
			label.AutomaticSize = Enum.AutomaticSize.X
			label.Size = UDim2.fromScale(0, 1)
			label.LayoutOrder = 3
			row.Parent = f
			local function fit()
				local h = b.Size.Y.Offset
				local absH = b.AbsoluteSize.Y
				if h <= 0 or absH <= 0 then
					return
				end
				local w = math.ceil(row.AbsoluteSize.X * h / absH)
				if w > 0 and b.Size.X.Offset ~= w then
					b.Size = UDim2.new(0, w, b.Size.Y.Scale, h)
				end
			end
			row:GetPropertyChangedSignal("AbsoluteSize"):Connect(fit)
			b:GetPropertyChangedSignal("AbsoluteSize"):Connect(fit)
			task.defer(fit)
		else
			label = UITheme.label(f, {
				name = "Label",
				font = UITheme.Font.button,
				size = UITheme.Text.button,
				scaled = true,
				min = 16,
				alignX = Enum.TextXAlignment.Center,
				z = f.ZIndex + 2,
			})
			label.Position = UDim2.fromOffset(12, 2)
			label.Size = UDim2.new(1, -24, 1, -4)
		end
		f.Parent = b
		b:GetPropertyChangedSignal("Text"):Connect(function()
			mirror(b)
		end)
		b:GetPropertyChangedSignal("TextColor3"):Connect(function()
			mirror(b)
		end)
		b:GetPropertyChangedSignal("BackgroundColor3"):Connect(function()
			mirror(b)
		end)
		b:GetPropertyChangedSignal("ZIndex"):Connect(function()
			f.ZIndex = b.ZIndex
		end)
		UITheme.attachFeedback(b)
	end
	UITheme.setVariant(b, variant or (b:GetAttribute("ThemeVariant") :: string?) or "secondary")
	mirror(b)
	layoutFill(b)
	return b
end
function UITheme.setIcon(b: TextButton, icon: string?)
	local f = face(b)
	if not f then
		return
	end
	if b:GetAttribute("ThemeIcon") == icon then
		return
	end
	b:SetAttribute("ThemeIcon", icon)
	local holder: Instance = f:FindFirstChild("Row") or f
	local old = holder:FindFirstChild("Icon")
	if old then
		old:Destroy()
	end
	if icon then
		local glyph = UITheme.icon(holder, icon, 22, b.TextColor3)
		glyph.LayoutOrder = 2
		glyph.ZIndex = f.ZIndex + 2
	end
	layoutFill(b)
end
function UITheme.setKey(b: TextButton, key: string?)
	local f = face(b)
	if not f or b:GetAttribute("ThemePill") then
		return
	end
	local cap = f:FindFirstChild("Keycap") :: TextLabel?
	if key and not cap then
		local made = UITheme.label(f, {
			name = "Keycap",
			font = UITheme.Font.bold,
			size = 16,
			color = b.TextColor3,
			alignX = Enum.TextXAlignment.Center,
			wrap = false,
			z = f.ZIndex + 2,
		})
		made.AnchorPoint = Vector2.new(1, 0.5)
		made.Position = UDim2.new(1, -8, 0.5, 0)
		made.Size = UDim2.fromOffset(20, 20)
		made.TextTransparency = 0.3
		UITheme.corner(made, 5)
		UITheme.stroke(made, b.TextColor3, 1, 0.6)
		cap = made
	end
	if cap then
		cap.Visible = key ~= nil
		cap.Text = key or ""
	end
	layoutFill(b)
end
function UITheme.isEnabled(b: GuiButton): boolean
	return not b:GetAttribute("ThemeDisabled")
end
function UITheme.setEnabled(b: GuiButton, enabled: boolean)
	b:SetAttribute("ThemeDisabled", if enabled then nil else true)
	b.Active = enabled
	if b:IsA("TextButton") then
		local f = face(b)
		local label = faceLabel(b)
		local style = styles[(b:GetAttribute("ThemeVariant") :: string?) or "secondary"] or styles.secondary
		if f then
			f.BackgroundTransparency = if enabled then style.faceT else math.max(style.faceT, 0.55)
		end
		if label then
			label.TextTransparency = if enabled then 0 else 0.45
		end
	end
end
function UITheme.setHot(b: TextButton, hot: boolean)
	if (b:GetAttribute("ThemeHot") == true) == hot then
		return
	end
	b:SetAttribute("ThemeHot", hot)
	local f = face(b)
	local edge = f and f:FindFirstChild("Edge")
	if edge and edge:IsA("UIStroke") then
		edge.Thickness = if hot then 3 else 1.5
		edge.Color = if hot
			then C.bulb
			else (styles[(b:GetAttribute("ThemeVariant") :: string?) or ""] or styles.secondary).edge
		edge.Transparency = if hot then 0 else 0.35
	end
	if hot and f and not reduced then
		UITheme.cancel(f)
		f.Size = UDim2.fromScale(1.08, 1.08)
		UITheme.tween(f, 0.28, { Size = UDim2.fromScale(1, 1) }, Enum.EasingStyle.Back)
	end
end
function UITheme.attachFeedback(b: GuiButton)
	if b:GetAttribute("ThemeFeedback") then
		return
	end
	b:SetAttribute("ThemeFeedback", true)
	local function target(): GuiObject
		local f = b:FindFirstChild("Face")
		return if f and f:IsA("GuiObject") then f else b
	end
	local function sheen(alpha: number)
		local f = b:FindFirstChild("Face")
		local s = f and f:FindFirstChild("Sheen")
		if s and s:IsA("Frame") then
			UITheme.tween(s, UITheme.Motion.fast, { BackgroundTransparency = alpha }, Enum.EasingStyle.Quad)
		end
	end
	local pressed = false
	local releasedAt = 0
	local function press()
		if not UITheme.isEnabled(b) then
			return
		end
		pressed = true
		local t = target()
		if t ~= b then
			UITheme.cancel(t)
			UITheme.tween(t, 0.08, { Size = UDim2.fromScale(0.94, 0.94) }, Enum.EasingStyle.Quad)
		end
		sheen(0.8)
	end
	local function release()
		if not pressed then
			return
		end
		pressed = false
		releasedAt = os.clock()
		local t = target()
		if t ~= b then
			UITheme.cancel(t)
			UITheme.tween(t, 0.26, { Size = UDim2.fromScale(1, 1) }, Enum.EasingStyle.Back)
		end
		sheen(1)
	end
	b.InputBegan:Connect(function(input)
		if
			input.UserInputType == Enum.UserInputType.MouseButton1
			or input.UserInputType == Enum.UserInputType.Touch
		then
			press()
		end
	end)
	b.InputEnded:Connect(function(input)
		if
			input.UserInputType == Enum.UserInputType.MouseButton1
			or input.UserInputType == Enum.UserInputType.Touch
		then
			release()
		end
	end)
	b.MouseEnter:Connect(function()
		if UITheme.isEnabled(b) and not pressed then
			sheen(0.9)
		end
	end)
	b.MouseLeave:Connect(function()
		release()
		sheen(1)
	end)
	b.Activated:Connect(function()
		if not UITheme.isEnabled(b) then
			return
		end
		UITheme.click(if b:GetAttribute("ThemeVariant") == "primary" then "confirm" else "tap")
		if not pressed and os.clock() - releasedAt > 0.2 then
			-- gamepad or keyboard activation: a quick press-and-release
			press()
			task.delay(0.08, release)
		end
	end)
	b.SelectionGained:Connect(function()
		sheen(0.88)
	end)
	b.SelectionLost:Connect(function()
		sheen(1)
	end)
end
export type ButtonOpts = {
	name: string?,
	text: string?,
	icon: string?,
	variant: string?,
	pill: boolean?,
	size: UDim2?,
	layoutOrder: number?,
	onActivated: (() -> ())?,
}
function UITheme.button(parent: Instance, opts: ButtonOpts): TextButton
	local b = Instance.new("TextButton")
	b.Name = opts.name or "Button"
	b.Text = opts.text or ""
	local height = UITheme.touchHeight()
	b.Size = opts.size or (if opts.pill then UDim2.fromOffset(0, height) else UDim2.new(1, 0, 0, height))
	b.LayoutOrder = opts.layoutOrder or 0
	b.ZIndex = UITheme.Z.content
	UITheme.styleButton(b, opts.variant, opts.pill)
	if opts.icon then
		UITheme.setIcon(b, opts.icon)
	end
	local run = opts.onActivated
	if run then
		b.Activated:Connect(function()
			if UITheme.isEnabled(b) then
				run()
			end
		end)
	end
	b.Parent = parent
	return b
end

-- Toasts --------------------------------------------------------------------------------------

export type ToastOpts = { kind: string?, icon: string?, duration: number?, key: string? }
type ToastItem = {
	holder: Frame,
	body: Frame,
	label: TextLabel,
	key: string,
	text: string,
	expires: number,
	leaving: boolean,
	kind: string,
}
local toastGui: ScreenGui? = nil
local stack: Frame? = nil
local shown: { ToastItem } = {}
local waiting: { { message: string, opts: ToastOpts } } = {}
local order = 0
local toastLoop: thread? = nil
local function stackWidth(): number
	local k = UITheme.currentScale()
	local camera = workspace.CurrentCamera
	local width = if camera then camera.ViewportSize.X / k else 800
	return math.clamp(width - 24, 220, 460)
end
local function host(): Frame?
	if stack and stack.Parent and toastGui and toastGui.Parent then
		return stack
	end
	local player = Players.LocalPlayer
	local playerGui = player and player:FindFirstChildOfClass("PlayerGui")
	if not playerGui then
		return nil
	end
	local gui = Instance.new("ScreenGui")
	gui.Name = "DeliveryToasts"
	gui.ResetOnSpawn = false
	gui.DisplayOrder = 40
	gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	gui.ScreenInsets = Enum.ScreenInsets.CoreUISafeInsets
	local frame = Instance.new("Frame")
	frame.Name = "Stack"
	frame.BackgroundTransparency = 1
	frame.AnchorPoint = Vector2.new(0.5, 0)
	frame.Position = UDim2.fromScale(0.5, 0)
	frame.Size = UDim2.fromOffset(stackWidth(), 320)
	frame.Active = false
	UITheme.attachScale(frame)
	local pad = Instance.new("UIPadding")
	pad.PaddingTop = UDim.new(0, 76)
	pad.Parent = frame
	local list = Instance.new("UIListLayout")
	list.FillDirection = Enum.FillDirection.Vertical
	list.HorizontalAlignment = Enum.HorizontalAlignment.Center
	list.SortOrder = Enum.SortOrder.LayoutOrder
	list.Padding = UDim.new(0, 8)
	list.Parent = frame
	frame.Parent = gui
	gui.Parent = playerGui
	UITheme.onScale(function()
		frame.Size = UDim2.fromOffset(stackWidth(), 320)
	end)
	toastGui = gui
	stack = frame
	return frame
end
local function fade(root: Instance, visible: boolean, duration: number)
	local function each(item: Instance)
		if item:IsA("GuiObject") then
			local base = item:GetAttribute("ThemeBaseBg")
			if base == nil then
				base = item.BackgroundTransparency
				item:SetAttribute("ThemeBaseBg", base)
			end
			UITheme.tween(
				item,
				duration,
				{ BackgroundTransparency = if visible then base else 1 },
				Enum.EasingStyle.Quad
			)
			if item:IsA("TextLabel") then
				UITheme.tween(
					item,
					duration,
					{ TextTransparency = if visible then 0 else 1 },
					Enum.EasingStyle.Quad
				)
			end
		elseif item:IsA("UIStroke") then
			local base = item:GetAttribute("ThemeBaseT")
			if base == nil then
				base = item.Transparency
				item:SetAttribute("ThemeBaseT", base)
			end
			UITheme.tween(
				item,
				duration,
				{ Transparency = if visible then base else 1 },
				Enum.EasingStyle.Quad
			)
		end
	end
	each(root)
	for _, item in root:GetDescendants() do
		each(item)
	end
end
local function measure(text: string, font: Enum.Font, size: number, width: number): Vector2
	local ok, bounds = pcall(TextService.GetTextSize, TextService, text, size, font, Vector2.new(width, 1000))
	return if ok then bounds else Vector2.new(math.min(width, #text * size * 0.55), size * 1.3)
end
local function leave(item: ToastItem)
	if item.leaving then
		return
	end
	item.leaving = true
	fade(item.body, false, 0.2)
	UITheme.tween(
		item.body,
		0.2,
		{ Position = UDim2.fromOffset(0, -14) },
		Enum.EasingStyle.Quad,
		Enum.EasingDirection.In
	)
	task.delay(if reduced then 0 else 0.2, function()
		UITheme.tween(
			item.holder,
			0.16,
			{ Size = UDim2.fromOffset(item.holder.Size.X.Offset, 0) },
			Enum.EasingStyle.Quad
		)
		task.delay(if reduced then 0 else 0.17, function()
			item.holder:Destroy()
			local index = table.find(shown, item)
			if index then
				table.remove(shown, index)
			end
		end)
	end)
end
local spawnToast: (message: string, opts: ToastOpts) -> ()
local function pump()
	while #waiting > 0 do
		local live = 0
		for _, item in shown do
			if not item.leaving then
				live += 1
			end
		end
		if live >= 3 then
			break
		end
		local next = table.remove(waiting, 1)
		if next then
			spawnToast(next.message, next.opts)
		end
	end
end
local function ensureLoop()
	if toastLoop and coroutine.status(toastLoop) ~= "dead" then
		return
	end
	if #shown == 0 and #waiting == 0 then
		return
	end
	toastLoop = task.spawn(function()
		while #shown > 0 or #waiting > 0 do
			local now = os.clock()
			for _, item in table.clone(shown) do
				if not item.leaving and now >= item.expires then
					leave(item)
				end
			end
			pump()
			task.wait(0.1)
		end
		toastLoop = nil
	end)
end
local kinds: { [string]: { fill: Color3, edge: Color3, text: Color3, icon: string? } } = {
	info = { fill = C.panel, edge = C.champagne, text = C.cream, icon = nil },
	success = { fill = C.panel, edge = C.good, text = C.cream, icon = "check" },
	warn = { fill = C.panel, edge = C.petal, text = C.cream, icon = "help-circle" },
	live = { fill = C.panel, edge = C.live, text = C.cream, icon = nil },
	reward = { fill = C.bulb, edge = C.bulb, text = C.ink, icon = "star" },
}
spawnToast = function(message: string, opts: ToastOpts)
	local parent = host()
	if not parent then
		return
	end
	local kind = opts.kind or "info"
	local look = kinds[kind] or kinds.info
	local reward = kind == "reward"
	local iconName = opts.icon or look.icon
	local font = if reward then UITheme.Font.display else UITheme.Font.bold
	local size = if reward then 20 else UITheme.Text.body
	local maxText = stackWidth() - 32 - (if iconName or kind == "live" then 30 else 0)
	local bounds = measure(message, font, size, maxText)
	local width = math.ceil(bounds.X) + 32 + (if iconName or kind == "live" then 30 else 0)
	local height = math.max(if reward then 44 else 46, math.ceil(bounds.Y) + 20)
	order -= 1
	local holder = Instance.new("Frame")
	holder.Name = "Toast"
	holder.BackgroundTransparency = 1
	holder.Size = UDim2.fromOffset(width, height)
	holder.LayoutOrder = order
	local body = Instance.new("Frame")
	body.Name = "Body"
	body.BorderSizePixel = 0
	body.BackgroundColor3 = if reward then Color3.new(1, 1, 1) else look.fill
	body.BackgroundTransparency = if reward then 0 else 0.06
	body.Size = UDim2.fromScale(1, 1)
	body.ZIndex = 2
	UITheme.corner(body, "pill")
	if reward then
		UITheme.gradient(body, C.bulb, C.champagne)
	else
		UITheme.gradient(body, Color3.new(1, 1, 1), Color3.new(0.78, 0.78, 0.82))
	end
	UITheme.stroke(body, look.edge, if reward then 2 else 1.5, if reward then 0.1 else 0.2)
	local x = 16
	if kind == "live" and not iconName then
		local dot, setDot = UITheme.liveDot(body, 12)
		dot.Position = UDim2.new(0, x + 4, 0.5, -6)
		setDot(true, true)
		x += 30
	elseif iconName then
		local glyph = UITheme.icon(body, iconName, 22, look.text, UDim2.new(0, x, 0.5, -11))
		glyph.ZIndex = 4
		x += 30
	end
	local caption = UITheme.label(body, {
		name = "Message",
		text = message,
		font = font,
		size = size,
		color = look.text,
		z = 4,
	})
	caption.Position = UDim2.fromOffset(x, 0)
	caption.Size = UDim2.new(1, -(x + 14), 1, 0)
	body.Parent = holder
	holder.Parent = parent
	local item: ToastItem = {
		holder = holder,
		body = body,
		label = caption,
		key = opts.key or message,
		text = message,
		expires = os.clock() + (opts.duration or (if reward then 2.6 else 3.4)),
		leaving = false,
		kind = kind,
	}
	table.insert(shown, item)
	if not reduced then
		fade(body, false, 0)
		body.Position = UDim2.fromOffset(0, -18)
		fade(body, true, 0.22)
		UITheme.tween(body, 0.28, { Position = UDim2.fromOffset(0, 0) }, Enum.EasingStyle.Back)
		if reward then
			body.Size = UDim2.fromScale(0.6, 0.6)
			body.AnchorPoint = Vector2.new(0.5, 0.5)
			body.Position = UDim2.fromScale(0.5, 0.5) + UDim2.fromOffset(0, -18)
			UITheme.tween(body, 0.34, {
				Size = UDim2.fromScale(1, 1),
				Position = UDim2.fromScale(0.5, 0.5),
			}, Enum.EasingStyle.Back)
		end
	elseif reward then
		body.AnchorPoint = Vector2.new(0.5, 0.5)
		body.Position = UDim2.fromScale(0.5, 0.5)
	end
	UITheme.click(if reward then "reward" else "toast")
	ensureLoop()
end
function UITheme.toast(message: string, opts: ToastOpts?)
	if type(message) ~= "string" or message == "" then
		return
	end
	local o: ToastOpts = opts or {}
	local key = o.key or message
	local now = os.clock()
	for _, item in shown do
		if not item.leaving and item.key == key then
			if item.text ~= message then
				item.text = message
				item.label.Text = message
			end
			item.expires = now + (o.duration or 3.4)
			UITheme.pop(item.body, 0.05)
			return
		end
	end
	for _, entry in waiting do
		if (entry.opts.key or entry.message) == key then
			entry.message = message
			return
		end
	end
	table.insert(waiting, { message = message, opts = o })
	if #waiting > 6 then
		table.remove(waiting, 1)
	end
	pump()
	ensureLoop()
end
function UITheme.reward(amount: number, what: string, icon: string?)
	local text = (if amount >= 0 then "+" else "") .. tostring(math.floor(amount + 0.5)) .. " " .. what
	UITheme.toast(
		text,
		{ kind = "reward", icon = icon or "star", key = "reward/" .. text .. "/" .. os.clock() }
	)
end
function UITheme.clearToasts()
	table.clear(waiting)
	for _, item in table.clone(shown) do
		leave(item)
	end
end

return UITheme
