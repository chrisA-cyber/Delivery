--!strict
-- One objective at a time: a floating marker over the goal while it is on screen, and a chevron on the
-- screen edge pointing toward it while it is not. Both hide within a few studs of the goal.
local Players = game:GetService("Players")
local Run = game:GetService("RunService")
local Tween = game:GetService("TweenService")
local GuiService = game:GetService("GuiService")
local Style = require(script.Parent.GuideStyle)
local Glyphs = require(script.Parent.GuideGlyphs)
local C = Style.color

local Chevron = {}

export type Target = {
	key: string,
	title: string,
	icon: string,
	accent: Color3?,
	anchor: string?, -- name of a part inside workspace.ShowSet
	part: BasePart?,
	position: Vector3?,
	height: number?, -- studs above the anchor
	arrive: number?, -- distance that counts as arrived (default 8)
}
export type Slot = "task" | "plan"

function Chevron.new(playerGui: PlayerGui, hud: ScreenGui)
	local player = Players.LocalPlayer
	local slots: { [string]: Target? } = {}
	local enabled = false
	local onArrive: ((Target) -> ())? = nil
	local current: Target? = nil
	local resolved: Vector3? = nil
	local nextLookup = 0
	local connection: RBXScriptConnection? = nil
	local lastDistance = -1
	local lastScale = -1

	-- Screen-edge chevron lives in its own full-screen layer so viewport maths needs no inset correction.
	local layer = Instance.new("ScreenGui")
	layer.Name = "DeliveryGuideChevron"
	layer.ResetOnSpawn = false
	layer.IgnoreGuiInset = true
	layer.ScreenInsets = Enum.ScreenInsets.None
	layer.DisplayOrder = 1
	layer.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	layer.Parent = playerGui

	local arrow = Style.frame(layer, "ObjectiveChevron")
	arrow.AnchorPoint = Vector2.new(0.5, 0.5)
	arrow.Size = UDim2.fromOffset(64, 64)
	arrow.Visible = false
	local pointer = Style.frame(arrow, "Pointer")
	pointer.Size = UDim2.fromScale(1, 1)
	local tip = Style.frame(pointer, "Tip", C.bulb)
	tip.AnchorPoint = Vector2.new(0.5, 0.5)
	tip.Position = UDim2.new(0.5, 0, 0, 7)
	tip.Size = UDim2.fromOffset(18, 18)
	tip.Rotation = 45
	Style.corner(tip, 3)
	Style.stroke(tip, C.ink, 1.5, 0.2)
	local disc = Style.frame(arrow, "Disc", C.midnight)
	disc.AnchorPoint = Vector2.new(0.5, 0.5)
	disc.Position = UDim2.fromScale(0.5, 0.5)
	disc.Size = UDim2.fromOffset(46, 46)
	Style.corner(disc, 999)
	local glow = Style.stroke(disc, C.bulb, 2.5, 0)
	local discIcon: Frame? = nil
	local distanceTag = Style.frame(arrow, "Distance", C.ink, 0.15)
	distanceTag.AnchorPoint = Vector2.new(0.5, 0)
	distanceTag.Position = UDim2.new(0.5, 0, 1, -4)
	distanceTag.Size = UDim2.fromOffset(58, 20)
	Style.corner(distanceTag, 999)
	Style.stroke(distanceTag, C.champagne, 1, 0.4)
	local arrowDistance = Style.text(distanceTag, "Studs", Style.font.bold, C.cream, 13, 11)
	arrowDistance.Size = UDim2.fromScale(1, 1)
	arrowDistance.TextXAlignment = Enum.TextXAlignment.Center

	-- World marker: a pin with the place glyph, title and distance, bobbing over the goal.
	local mount = Instance.new("Attachment")
	mount.Name = "DeliveryObjectivePoint"
	local marker = Instance.new("BillboardGui")
	marker.Name = "PersonalObjectiveWaypoint"
	marker.Size = UDim2.fromOffset(176, 92)
	marker.SizeOffset = Vector2.new(0, 0.5)
	marker.AlwaysOnTop = true
	marker.LightInfluence = 0
	marker.MaxDistance = 100000
	marker.Active = false
	marker.ResetOnSpawn = false
	marker.Enabled = false
	marker.Adornee = mount
	marker.Parent = playerGui
	local bob = Style.frame(marker, "Bob")
	bob.Size = UDim2.fromScale(1, 1)
	local markerScale = Instance.new("UIScale")
	markerScale.Parent = bob
	local body = Style.frame(bob, "Body")
	body.Size = UDim2.fromScale(1, 1)
	local pill = Style.frame(body, "Label", C.panel, 0.08)
	pill.AnchorPoint = Vector2.new(0.5, 0)
	pill.Position = UDim2.fromScale(0.5, 0)
	pill.Size = UDim2.fromOffset(170, 40)
	Style.corner(pill, 999)
	local pillEdge = Style.stroke(pill, C.champagne, 1.5, 0.1)
	local pillTitle = Style.text(pill, "Title", Style.font.bold, C.cream, 15, 11)
	pillTitle.Position = UDim2.fromOffset(12, 2)
	pillTitle.Size = UDim2.new(1, -24, 0, 21)
	pillTitle.TextXAlignment = Enum.TextXAlignment.Center
	local pillDistance = Style.text(pill, "Distance", Style.font.body, C.bulb, 13, 10)
	pillDistance.Position = UDim2.fromOffset(12, 21)
	pillDistance.Size = UDim2.new(1, -24, 0, 16)
	pillDistance.TextXAlignment = Enum.TextXAlignment.Center
	local pinDisc = Style.frame(body, "Pin", C.bulb)
	pinDisc.AnchorPoint = Vector2.new(0.5, 0)
	pinDisc.Position = UDim2.new(0.5, 0, 0, 44)
	pinDisc.Size = UDim2.fromOffset(36, 36)
	Style.corner(pinDisc, 999)
	Style.stroke(pinDisc, C.ink, 2, 0.1)
	local pinTip = Style.frame(body, "PinTip", C.bulb)
	pinTip.AnchorPoint = Vector2.new(0.5, 0.5)
	pinTip.Position = UDim2.new(0.5, 0, 0, 80)
	pinTip.Size = UDim2.fromOffset(12, 12)
	pinTip.Rotation = 45
	pinTip.ZIndex = 0
	local pinIcon: Frame? = nil

	local bobTween: Tween? = nil
	local glowTween: Tween? = nil
	local function animate(on: boolean)
		if bobTween then
			bobTween:Cancel()
			bobTween = nil
		end
		if glowTween then
			glowTween:Cancel()
			glowTween = nil
		end
		bob.Position = UDim2.fromOffset(0, 0)
		glow.Transparency = 0
		if not on or Style.reduced() then
			return
		end
		bobTween = Tween:Create(
			bob,
			TweenInfo.new(0.9, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true),
			{ Position = UDim2.fromOffset(0, -7) }
		)
		glowTween = Tween:Create(
			glow,
			TweenInfo.new(0.7, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true),
			{ Transparency = 0.65 }
		)
		bobTween:Play()
		glowTween:Play()
	end

	local function root(): BasePart?
		local character = player.Character
		local part = character and character:FindFirstChild("HumanoidRootPart")
		return if part and part:IsA("BasePart") then part else nil
	end

	local function resolve(t: Target): Vector3?
		local height = t.height or 3.2
		if t.part and t.part:IsDescendantOf(workspace) then
			return t.part.Position + Vector3.new(0, height, 0)
		end
		if t.anchor and os.clock() >= nextLookup then
			nextLookup = os.clock() + 1
			local set = workspace:FindFirstChild("ShowSet")
			local found = set and set:FindFirstChild(t.anchor, true)
			if found and found:IsA("BasePart") then
				t.part = found
				return found.Position + Vector3.new(0, height, 0)
			end
		end
		return if t.position then t.position + Vector3.new(0, height, 0) else nil
	end

	local function dress(t: Target)
		local accent = t.accent or C.bulb
		if discIcon then
			discIcon:Destroy()
		end
		if pinIcon then
			pinIcon:Destroy()
		end
		discIcon = Glyphs.mount(disc, t.icon, 24, C.cream, UDim2.new(0.5, -12, 0.5, -12))
		pinIcon = Glyphs.mount(pinDisc, t.icon, 22, C.ink, UDim2.new(0.5, -11, 0.5, -11))
		tip.BackgroundColor3 = accent
		glow.Color = accent
		pinDisc.BackgroundColor3 = accent
		pinTip.BackgroundColor3 = accent
		pillEdge.Color = accent
		pillTitle.Text = t.title
		lastDistance = -1
		Style.pop(body, 0.6)
		Style.pop(arrow, 0.6)
	end

	local update: (number) -> ()
	local function stop()
		if connection then
			connection:Disconnect()
			connection = nil
		end
		arrow.Visible = false
		marker.Enabled = false
		animate(false)
	end
	local function refresh()
		local nextTarget = slots.task or slots.plan
		if nextTarget ~= current then
			current = nextTarget
			resolved = nil
			nextLookup = 0
			if nextTarget then
				dress(nextTarget)
			end
		end
		if current and enabled then
			if not connection then
				animate(true)
				connection = Run.RenderStepped:Connect(update)
			end
		else
			stop()
		end
	end

	update = function()
		local t = current
		local avatar = root()
		local camera = workspace.CurrentCamera
		if not t or not avatar or not camera or not hud.Enabled then
			arrow.Visible = false
			marker.Enabled = false
			return
		end
		if not resolved or (t.part == nil and t.anchor ~= nil) then
			resolved = resolve(t)
		end
		local goal = resolved
		if not goal then
			arrow.Visible = false
			marker.Enabled = false
			return
		end
		if mount.Parent ~= workspace.Terrain then
			mount.Parent = workspace.Terrain
		end
		if mount.WorldPosition ~= goal then
			mount.WorldPosition = goal
		end
		local flat = Vector3.new(goal.X - avatar.Position.X, 0, goal.Z - avatar.Position.Z)
		local distance = flat.Magnitude
		if distance <= (t.arrive or 8) then
			arrow.Visible = false
			marker.Enabled = false
			if slots.plan == t and not slots.task then
				slots.plan = nil
				local callback = onArrive
				task.defer(function()
					refresh()
					if callback then
						callback(t)
					end
				end)
			end
			return
		end
		local whole = math.floor(distance + 0.5)
		if whole ~= lastDistance then
			lastDistance = whole
			arrowDistance.Text = tostring(whole)
			pillDistance.Text = whole .. " studs"
		end
		-- Large from afar, smaller up close so it never hides the counter it marks.
		local scale = math.floor(math.clamp(0.62 + (distance - 8) / 60, 0.62, 1) * 50) / 50
		if scale ~= lastScale then
			lastScale = scale
			markerScale.Scale = scale
		end
		local view = camera.ViewportSize
		local inset = GuiService:GetGuiInset()
		local left, right = 44, view.X - 44
		local top, bottom = inset.Y + 118, view.Y - 56
		if right - left < 40 or bottom - top < 40 then
			top, bottom = inset.Y + 30, view.Y - 30
		end
		local screen = camera:WorldToViewportPoint(goal)
		local inside = screen.Z > 0
			and screen.X >= left
			and screen.X <= right
			and screen.Y >= top
			and screen.Y <= bottom
		marker.Enabled = screen.Z > 0
		if inside then
			arrow.Visible = false
			return
		end
		local rel = camera.CFrame:PointToObjectSpace(goal)
		local dx, dy = rel.X, -rel.Y
		if rel.Z > 0 then
			-- Behind the camera: pin the chevron to the bottom edge, leaning toward the goal's side.
			dy = math.max(dy, 0) + math.abs(rel.Z) * 0.6
		end
		if math.abs(dx) < 1e-3 and math.abs(dy) < 1e-3 then
			dy = 1
		end
		local cx, cy = (left + right) / 2, (top + bottom) / 2
		local reach = math.min(
			if math.abs(dx) > 1e-3 then (right - left) / 2 / math.abs(dx) else math.huge,
			if math.abs(dy) > 1e-3 then (bottom - top) / 2 / math.abs(dy) else math.huge
		)
		arrow.Position = UDim2.fromOffset(cx + dx * reach, cy + dy * reach)
		pointer.Rotation = math.deg(math.atan2(dy, dx)) + 90
		arrow.Visible = true
	end

	return {
		-- slot "task" is the server-driven objective (parcel, prop run, outdoor ticket); "plan" is the
		-- player's own choice from the ticket stub or map. A task always wins while it is active.
		set = function(slot: Slot, target: Target?)
			local prior = slots[slot]
			if prior and target and prior.key == target.key then
				return
			end
			if prior == nil and target == nil then
				return
			end
			slots[slot] = target
			refresh()
		end,
		get = function(slot: Slot): Target?
			return slots[slot]
		end,
		active = function(): Target?
			return current
		end,
		setEnabled = function(on: boolean)
			if on ~= enabled then
				enabled = on
				refresh()
			end
		end,
		onArrive = function(callback: (Target) -> ())
			onArrive = callback
		end,
		destroy = function()
			stop()
			layer:Destroy()
			marker:Destroy()
			mount:Destroy()
		end,
	}
end
return Chevron
