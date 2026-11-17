--!strict
-- Town-facing UI helpers built on ui-core's UITheme (design tokens, buttons, toasts). Every call is
-- nil-safe: if UITheme is missing or changes shape, matching local tokens keep the town UI working.
local Tween = game:GetService("TweenService")
local GuiService = game:GetService("GuiService")
local Glyphs = require(script.Parent.GuideGlyphs)
local themeModule = script.Parent:FindFirstChild("UITheme")
local Theme: any = nil
if themeModule and themeModule:IsA("ModuleScript") then
	local ok, loaded = pcall(require, themeModule)
	Theme = if ok then loaded else nil
end

local Style = {}
Style.theme = Theme

local function pick(key: string, fallback: Color3): Color3
	local colors = Theme and Theme.Color
	local value = colors and colors[key]
	return if typeof(value) == "Color3" then value else fallback
end

Style.color = {
	panel = pick("panel", Color3.fromRGB(27, 29, 58)),
	panelTop = pick("panelTop", Color3.fromRGB(41, 46, 96)),
	panelDeep = pick("panelDeep", Color3.fromRGB(19, 20, 42)),
	panelRaised = pick("panelRaised", Color3.fromRGB(46, 52, 112)),
	midnight = pick("midnight", Color3.fromHex("242957")),
	cobalt = pick("cobalt", Color3.fromHex("415ba8")),
	powder = pick("powder", Color3.fromHex("929acb")),
	lacquer = pick("lacquer", Color3.fromHex("5b2338")),
	champagne = pick("champagne", Color3.fromHex("ddb481")),
	bulb = pick("bulb", Color3.fromHex("ffdc9e")),
	petal = pick("petal", Color3.fromHex("d58ca5")),
	harbor = pick("harbor", Color3.fromHex("42838e")),
	copper = pick("copper", Color3.fromHex("875333")),
	cream = pick("cream", Color3.fromHex("fff0cf")),
	paper = pick("paper", Color3.fromRGB(255, 244, 222)),
	ink = pick("ink", Color3.fromRGB(26, 28, 56)),
	muted = pick("muted", Color3.fromRGB(184, 182, 214)),
	live = pick("live", Color3.fromRGB(255, 84, 98)),
	good = pick("good", Color3.fromRGB(126, 214, 168)),
	bad = pick("bad", Color3.fromRGB(232, 112, 122)),
	shadow = pick("shadow", Color3.fromRGB(8, 9, 22)),
}

-- One accent per place, shared by the strip, chevron, map pins and counter sheets.
Style.accent = {
	lobby = Style.color.bulb,
	theatre = Style.color.petal,
	balcony = Color3.fromRGB(190, 170, 240),
	studio = Color3.fromRGB(150, 176, 255),
	writers = Color3.fromRGB(240, 206, 140),
	warehouse = Color3.fromRGB(214, 160, 112),
	atelier = Color3.fromRGB(236, 150, 190),
	pier = Color3.fromRGB(110, 196, 204),
	park = Color3.fromRGB(150, 210, 140),
	market = Color3.fromRGB(255, 170, 110),
	post = Color3.fromRGB(104, 196, 196),
	records = Color3.fromRGB(232, 140, 172),
	cafe = Color3.fromRGB(236, 168, 96),
	gallery = Color3.fromRGB(150, 168, 246),
	clock = Color3.fromRGB(200, 196, 236),
	tram = Color3.fromRGB(110, 200, 170),
	street = Style.color.champagne,
	marketWalk = Color3.fromRGB(255, 190, 130),
}

local function enumFont(key: string, fallback: Enum.Font): Font
	local fonts = Theme and Theme.Font
	local value = fonts and fonts[key]
	if typeof(value) == "EnumItem" and (value :: EnumItem).EnumType == Enum.Font then
		return Font.fromEnum(value :: any)
	end
	return Font.fromEnum(fallback)
end

Style.font = {
	-- Geometric deco capitals for place names, title cards and the ticket stub.
	title = Font.new("rbxasset://fonts/families/JosefinSans.json", Enum.FontWeight.Bold),
	display = Font.new("rbxasset://fonts/families/JosefinSans.json", Enum.FontWeight.Bold),
	body = enumFont("body", Enum.Font.BuilderSansMedium),
	bold = enumFont("bold", Enum.Font.BuilderSansBold),
	heavy = enumFont("heading", Enum.Font.BuilderSansExtraBold),
	friendly = enumFont("display", Enum.Font.FredokaOne),
}

-- Spaced capitals echo the marquee lettering ("D E L I V E R Y").
function Style.spaced(text: string): string
	local out = {}
	for _, code in utf8.codes(string.upper(text)) do
		table.insert(out, utf8.char(code))
	end
	return (table.concat(out, " "):gsub("   ", "    "))
end

function Style.reduced(): boolean
	if Theme and type(Theme.reducedMotion) == "function" then
		local ok, value = pcall(Theme.reducedMotion)
		if ok and type(value) == "boolean" then
			return value
		end
	end
	local ok, value = pcall(function()
		return (GuiService :: any).ReducedMotionEnabled
	end)
	return ok and value == true
end

-- Town UI follows UITheme's scale on large screens but never shrinks below 1, so text stays >= 15 px
-- and buttons >= 48 px on the smallest landscape phones.
function Style.scaleFor(viewport: Vector2): number
	local base = 1
	if Theme and type(Theme.scaleFor) == "function" then
		local ok, value = pcall(Theme.scaleFor, viewport)
		if ok and type(value) == "number" then
			base = value
		end
	else
		base = math.clamp(1 + (math.min(viewport.X, viewport.Y) - 720) / 360 * 0.15, 1, 1.15)
	end
	return math.max(1, base)
end
local scaled: { [UIScale]: boolean } = setmetatable({}, { __mode = "k" }) :: any
local function viewport(): Vector2
	local camera = workspace.CurrentCamera
	return if camera then camera.ViewportSize else Vector2.new(1280, 720)
end
local function rescale()
	local value = Style.scaleFor(viewport())
	for item in scaled do
		if item.Parent then
			item.Scale = value
		end
	end
end
local cameraWatch: RBXScriptConnection? = nil
local function watchCamera()
	if cameraWatch then
		cameraWatch:Disconnect()
	end
	local camera = workspace.CurrentCamera
	cameraWatch = if camera then camera:GetPropertyChangedSignal("ViewportSize"):Connect(rescale) else nil
	rescale()
end
workspace:GetPropertyChangedSignal("CurrentCamera"):Connect(watchCamera)
watchCamera()
function Style.attachScale(target: GuiObject): UIScale
	local item = Instance.new("UIScale")
	item.Name = "TownScale"
	item.Scale = Style.scaleFor(viewport())
	item.Parent = target
	scaled[item] = true
	return item
end
function Style.currentScale(): number
	return Style.scaleFor(viewport())
end

function Style.corner(obj: GuiObject, radius: number?): UICorner
	local c = Instance.new("UICorner")
	c.CornerRadius = if radius and radius >= 999 then UDim.new(0.5, 0) else UDim.new(0, radius or 12)
	c.Parent = obj
	return c
end

function Style.stroke(obj: GuiObject, color: Color3?, thickness: number?, transparency: number?): UIStroke
	local s = Instance.new("UIStroke")
	s.Color = color or Style.color.champagne
	s.Thickness = thickness or 1.5
	s.Transparency = transparency or 0
	s.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	s.LineJoinMode = Enum.LineJoinMode.Round
	s.Parent = obj
	return s
end

function Style.gradient(obj: GuiObject, top: Color3, bottom: Color3, rotation: number?): UIGradient
	local g = Instance.new("UIGradient")
	g.Color = ColorSequence.new(top, bottom)
	g.Rotation = rotation or 90
	g.Parent = obj
	return g
end

function Style.frame(parent: Instance, name: string, color: Color3?, transparency: number?): Frame
	local f = Instance.new("Frame")
	f.Name = name
	f.BorderSizePixel = 0
	f.BackgroundColor3 = color or Style.color.panel
	f.BackgroundTransparency = if color then transparency or 0 else 1
	f.Parent = parent
	return f
end

-- Midnight panel with the house gradient and champagne trim (matches UITheme.panel's fill).
function Style.panel(parent: Instance, name: string): Frame
	local f = Style.frame(parent, name, Color3.new(1, 1, 1), 0.07)
	Style.corner(f, 16)
	Style.stroke(f, Style.color.champagne, 1.5, 0.3)
	Style.gradient(f, Style.color.panel:Lerp(Style.color.panelTop, 0.85), Style.color.panel)
	return f
end

function Style.text(
	parent: Instance,
	name: string,
	face: Font,
	color: Color3,
	size: number,
	minimum: number?
): TextLabel
	local t = Instance.new("TextLabel")
	t.Name = name
	t.Text = ""
	t.BackgroundTransparency = 1
	t.FontFace = face
	t.TextColor3 = color
	t.TextScaled = true
	t.TextWrapped = true
	t.TextXAlignment = Enum.TextXAlignment.Left
	t.TextYAlignment = Enum.TextYAlignment.Center
	local limit = Instance.new("UITextSizeConstraint")
	limit.MaxTextSize = size
	limit.MinTextSize = minimum or math.min(size, 12)
	limit.Parent = t
	t.Parent = parent
	return t
end

export type Kind = "primary" | "secondary" | "quiet"
local variants = { primary = "primary", secondary = "secondary", quiet = "ghost" }

-- A 48 px touch target. Uses UITheme's themed button (face, sheen, press bounce, click sound) when
-- available; otherwise a local look-alike.
function Style.button(
	parent: Instance,
	name: string,
	caption: string,
	kind: Kind?,
	accent: Color3?
): TextButton
	local k: Kind = kind or "secondary"
	if Theme and type(Theme.button) == "function" then
		local ok, made = pcall(Theme.button, parent, { name = name, text = caption, variant = variants[k] })
		if ok and typeof(made) == "Instance" and made:IsA("TextButton") then
			if accent and k == "primary" then
				made.BackgroundColor3 = accent
			end
			made:SetAttribute("TownKind", k)
			return made
		end
	end
	local b = Instance.new("TextButton")
	b.Name = name
	b.AutoButtonColor = false
	b.Selectable = true
	b.BorderSizePixel = 0
	b.Text = caption
	b.TextScaled = true
	b.TextWrapped = true
	b.FontFace = Style.font.heavy
	local limit = Instance.new("UITextSizeConstraint")
	limit.MaxTextSize = 18
	limit.MinTextSize = 14
	limit.Parent = b
	local pad = Instance.new("UIPadding")
	pad.PaddingLeft = UDim.new(0, 12)
	pad.PaddingRight = UDim.new(0, 12)
	pad.Parent = b
	Style.corner(b, 12)
	local edge = Style.stroke(b, Style.color.champagne, 1.5, 0.35)
	edge.Name = "Edge"
	b:SetAttribute("TownKind", k)
	Style.paint(b, k, accent)
	local scale = Instance.new("UIScale")
	scale.Name = "PressScale"
	scale.Parent = b
	b.MouseButton1Down:Connect(function()
		Tween:Create(scale, TweenInfo.new(0.08), { Scale = 0.94 }):Play()
	end)
	local function release()
		Tween:Create(scale, TweenInfo.new(0.22, Enum.EasingStyle.Back), { Scale = 1 }):Play()
	end
	b.MouseButton1Up:Connect(release)
	b.MouseLeave:Connect(release)
	b.Parent = parent
	return b
end

function Style.paint(b: TextButton, kind: Kind, accent: Color3?)
	b:SetAttribute("TownKind", kind)
	if b:GetAttribute("ThemeButton") and Theme and type(Theme.setVariant) == "function" then
		pcall(Theme.setVariant, b, variants[kind])
		if accent and kind == "primary" then
			b.BackgroundColor3 = accent
		end
		return
	end
	if kind == "primary" then
		b.BackgroundColor3 = accent or Style.color.bulb
		b.BackgroundTransparency = 0
		b.TextColor3 = Style.color.ink
	elseif kind == "quiet" then
		b.BackgroundColor3 = Style.color.panelRaised
		b.BackgroundTransparency = 0.45
		b.TextColor3 = Style.color.cream
	else
		b.BackgroundColor3 = Style.color.panelRaised
		b.BackgroundTransparency = 0.04
		b.TextColor3 = Style.color.cream
	end
end

-- Puts a town glyph at the left of a button (inside the themed Face so it presses with it).
function Style.buttonGlyph(b: TextButton, glyph: string?, size: number?)
	local face = b:FindFirstChild("Face")
	local holder: Instance = if face then face else b
	local old = holder:FindFirstChild("TownGlyph")
	if old then
		old:Destroy()
	end
	local label = face and face:FindFirstChild("Label")
	local pad = b:FindFirstChildOfClass("UIPadding")
	local left = if glyph then 44 else 12
	if label and label:IsA("TextLabel") then
		label.Position = UDim2.fromOffset(left, 2)
		label.Size = UDim2.new(1, -(left + 12), 1, -4)
	elseif pad then
		pad.PaddingLeft = UDim.new(0, left)
	end
	if not glyph then
		return
	end
	local px = size or 22
	local mounted = Glyphs.mount(
		holder,
		glyph,
		px,
		b.TextColor3,
		UDim2.new(0, 13 - (if face then 0 else left), 0.5, -px / 2)
	)
	mounted.Name = "TownGlyph"
	b:SetAttribute("TownGlyph", glyph)
end
function Style.tintGlyph(b: TextButton)
	local face = b:FindFirstChild("Face")
	local holder: Instance = if face then face else b
	local mounted = holder:FindFirstChild("TownGlyph")
	if mounted then
		Glyphs.tint(mounted, b.TextColor3)
	end
end

function Style.setEnabled(b: TextButton, on: boolean)
	if b:GetAttribute("ThemeButton") and Theme and type(Theme.setEnabled) == "function" then
		pcall(Theme.setEnabled, b, on)
		return
	end
	b.Active = on
	b.AutoButtonColor = false
	b.TextTransparency = if on then 0 else 0.45
end

function Style.setHot(b: TextButton, hot: boolean)
	if b:GetAttribute("ThemeButton") and Theme and type(Theme.setHot) == "function" then
		pcall(Theme.setHot, b, hot)
		return
	end
	local edge = b:FindFirstChild("Edge") :: UIStroke?
	if edge then
		edge.Thickness = if hot then 3 else 1.5
		edge.Color = if hot then Style.color.bulb else Style.color.champagne
		edge.Transparency = if hot then 0 else 0.35
	end
end

function Style.tween(
	obj: Instance,
	seconds: number,
	props: { [string]: any },
	style: Enum.EasingStyle?,
	direction: Enum.EasingDirection?
): Tween
	local t = Tween:Create(
		obj,
		TweenInfo.new(
			if Style.reduced() then math.min(seconds, 0.12) else seconds,
			style or Enum.EasingStyle.Quint,
			direction or Enum.EasingDirection.Out
		),
		props
	)
	t:Play()
	return t
end

-- Pops a GuiObject in with a UIScale overshoot. Skipped under reduced motion.
-- Uses its own UIScale, so only call it on objects without another UIScale.
function Style.pop(obj: GuiObject, from: number?)
	if Style.reduced() then
		return
	end
	local existing = obj:FindFirstChild("PopScale")
	local scale: UIScale = if existing and existing:IsA("UIScale") then existing else Instance.new("UIScale")
	scale.Name = "PopScale"
	scale.Parent = obj
	scale.Scale = from or 0.82
	Tween:Create(scale, TweenInfo.new(0.32, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Scale = 1 })
		:Play()
end

-- Horizontal shake for wrong answers; skipped under reduced motion.
function Style.shake(obj: GuiObject)
	if Style.reduced() then
		return
	end
	local home = obj:GetAttribute("ShakeHome")
	if typeof(home) ~= "UDim2" then
		home = obj.Position
		obj:SetAttribute("ShakeHome", home)
	end
	local origin = home :: UDim2
	task.spawn(function()
		for _, dx in { -10, 9, -7, 5, -3, 0 } do
			if not obj.Parent then
				return
			end
			obj.Position = origin + UDim2.fromOffset(dx, 0)
			task.wait(0.04)
		end
		obj.Position = origin
		obj:SetAttribute("ShakeHome", nil)
	end)
end

-- Shared toast (UITheme). kind: "info" | "success" | "warn" | "live" | "reward". Returns false when no
-- toast system is available so callers can fall back to their own line.
function Style.toast(message: string, kind: string?, icon: string?, key: string?, duration: number?): boolean
	if not Theme or type(Theme.toast) ~= "function" then
		return false
	end
	local ok = pcall(Theme.toast, message, { kind = kind, icon = icon, key = key, duration = duration })
	return ok
end

function Style.reward(amount: number, what: string): boolean
	if not Theme or type(Theme.reward) ~= "function" then
		return false
	end
	local ok = pcall(Theme.reward, amount, what)
	return ok
end

function Style.click(kind: string?)
	if Theme and type(Theme.click) == "function" then
		pcall(Theme.click, kind)
	end
end

-- Town UI parents into ui.layers.town when the HUD provides it (below the nav and the desk).
function Style.townRoot(ui: any): Instance
	local layers = ui and ui.layers
	local town = layers and layers.town
	if typeof(town) == "Instance" then
		return town
	end
	return ui.gui
end

-- Live width of the HUD's top-right navigation in screen px (falls back to its frame).
function Style.navWidth(ui: any): number
	local gui = ui and ui.gui
	local attr = gui and gui:GetAttribute("HudNavWidth")
	if type(attr) == "number" then
		return attr
	end
	local nav = ui and ui.nav
	return if nav and nav.Visible then nav.AbsoluteSize.X + 12 else 222
end
return Style
