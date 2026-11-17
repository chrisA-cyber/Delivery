--!strict
-- Rooftop portrait booth: a viewfinder overlay, three framings, a countdown and a camera flash.
-- The capture excludes all UI, and saving always goes through Roblox's own gallery prompt.
local Players = game:GetService("Players")
local Run = game:GetService("RunService")
local Storage = game:GetService("ReplicatedStorage")
local Capture = game:GetService("CaptureService")
local Style = require(script.Parent:WaitForChild("GuideStyle"))
local Glyphs = require(script.Parent:WaitForChild("GuideGlyphs"))
local C = Style.color
local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")
local shared = Storage:WaitForChild("Delivery")
local invite = shared:WaitForChild("PortraitSession") :: RemoteEvent
local overlay = Instance.new("ScreenGui")
overlay.Name = "CastPortrait"
overlay.ResetOnSpawn = false
overlay.DisplayOrder = 20
overlay.Enabled = false
overlay.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
overlay.Parent = playerGui

-- Viewfinder: corner brackets and thirds, kept clear of the footer.
local finder = Style.frame(overlay, "Viewfinder")
finder.AnchorPoint = Vector2.new(0.5, 0)
finder.Position = UDim2.new(0.5, 0, 0, 14)
finder.Size = UDim2.new(0.86, 0, 1, -130)
for _, corner in { { 0, 0 }, { 1, 0 }, { 0, 1 }, { 1, 1 } } do
	for _, horizontal in { true, false } do
		local arm = Style.frame(finder, "Bracket", C.bulb)
		arm.AnchorPoint = Vector2.new(corner[1], corner[2])
		arm.Position = UDim2.fromScale(corner[1], corner[2])
		arm.Size = if horizontal then UDim2.fromOffset(34, 3) else UDim2.fromOffset(3, 34)
	end
end
for i = 1, 2 do
	local v = Style.frame(finder, "Third", C.cream, 0.82)
	v.Position = UDim2.fromScale(i / 3, 0)
	v.Size = UDim2.new(0, 1, 1, 0)
	local h = Style.frame(finder, "Third", C.cream, 0.82)
	h.Position = UDim2.fromScale(0, i / 3)
	h.Size = UDim2.new(1, 0, 0, 1)
end
local rec = Style.frame(finder, "Mode", C.panelDeep, 0.25)
rec.Position = UDim2.fromOffset(14, 12)
rec.Size = UDim2.fromOffset(180, 30)
Style.corner(rec, 999)
local recDot = Style.frame(rec, "Dot", C.live)
recDot.AnchorPoint = Vector2.new(0, 0.5)
recDot.Position = UDim2.new(0, 10, 0.5, 0)
recDot.Size = UDim2.fromOffset(10, 10)
Style.corner(recDot, 999)
local recText = Style.text(rec, "Text", Style.font.title, C.cream, 15, 11)
recText.Position = UDim2.fromOffset(28, 0)
recText.Size = UDim2.new(1, -36, 1, 0)

local count = Style.text(overlay, "Countdown", Style.font.friendly, C.bulb, 120, 40)
count.AnchorPoint = Vector2.new(0.5, 0.5)
count.Position = UDim2.fromScale(0.5, 0.42)
count.Size = UDim2.fromOffset(200, 140)
count.TextXAlignment = Enum.TextXAlignment.Center
count.Visible = false
local countStroke = Instance.new("UIStroke")
countStroke.Color = C.ink
countStroke.Thickness = 3
countStroke.Parent = count

local flash = Style.frame(overlay, "Flash", Color3.new(1, 1, 1), 1)
flash.Size = UDim2.fromScale(1, 1)
flash.ZIndex = 10

local footer = Style.panel(overlay, "PhotoDesk")
footer.AnchorPoint = Vector2.new(0.5, 1)
footer.Position = UDim2.new(0.5, 0, 1, -8)
footer.Size = UDim2.new(0.94, 0, 0, 104)
Style.attachScale(footer)
local max = Instance.new("UISizeConstraint")
max.MaxSize = Vector2.new(720, 104)
max.Parent = footer
local badge = Style.frame(footer, "Badge", Style.accent.balcony)
badge.Position = UDim2.fromOffset(12, 8)
badge.Size = UDim2.fromOffset(28, 28)
Style.corner(badge, 999)
Glyphs.mount(badge, "camera", 18, C.ink, UDim2.fromOffset(5, 5))
local hint = Style.text(footer, "Hint", Style.font.bold, C.cream, 17, 14)
hint.Size = UDim2.new(1, -60, 0, 30)
hint.Position = UDim2.fromOffset(48, 7)
local layouts = { "Cast photo", "Close-up", "Wide postcard" }
local mark = Vector3.zero
local shot = 1
local active = false
local busy = false
local token = 0
local previousType = Enum.CameraType.Custom
local previousFov = 70
local previousGui = true
local previousMarkers = true
local buttons: { TextButton } = {}
local function button(slot: number, text: string, glyph: string, callback: () -> (), primary: boolean)
	local b = Style.button(
		footer,
		"Shot" .. slot,
		text,
		if primary then "primary" else "secondary",
		Style.accent.balcony
	)
	b.Size = UDim2.new(1 / 3, -12, 0, 48)
	b.Position = UDim2.new((slot - 1) / 3, 8, 0, 44)
	Style.buttonGlyph(b, glyph)
	b.Activated:Connect(callback)
	buttons[slot] = b
	return b
end
local function setBusy(on: boolean)
	busy = on
	for _, b in buttons do
		Style.setEnabled(b, not on)
	end
end
local function framing()
	recText.Text = Style.spaced(layouts[shot])
	hint.Text = "Rooftop studio  ·  strike a pose, then take the photo."
end
local function leave()
	if not active then
		return
	end
	token += 1
	active = false
	setBusy(false)
	count.Visible = false
	overlay.Enabled = false
	Run:UnbindFromRenderStep("CastPhotographer")
	local cam = workspace.CurrentCamera
	if cam then
		cam.CameraType = previousType
		cam.FieldOfView = previousFov
	end
	local show = playerGui:FindFirstChild("DeliveryShow") :: ScreenGui?
	if show then
		show.Enabled = previousGui
	end
	local markers = playerGui:FindFirstChild("DeliveryGuideChevron") :: ScreenGui?
	if markers then
		markers.Enabled = previousMarkers
	end
end
button(1, "Change framing", "postcard", function()
	if busy then
		return
	end
	shot = shot % #layouts + 1
	framing()
	Style.pop(rec, 0.9)
end, false)
button(2, "Take photo", "camera", function()
	if busy or not active then
		return
	end
	local current = token
	setBusy(true)
	task.spawn(function()
		count.Visible = true
		for i = 3, 1, -1 do
			if not active or token ~= current then
				return
			end
			count.Text = tostring(i)
			hint.Text = "Hold your pose…"
			Style.pop(count, 0.6)
			Style.click("tap")
			task.wait(0.6)
		end
		count.Visible = false
		if token ~= current or not active then
			return
		end
		footer.Visible = false
		finder.Visible = false
		local ok = pcall(function()
			Capture:TakeScreenshotCaptureAsync(function(result, capture)
				if token ~= current or not active then
					return
				end
				footer.Visible = true
				finder.Visible = true
				setBusy(false)
				-- Camera flash after the capture so it never appears in the photo; skipped under reduced motion.
				if not Style.reduced() then
					flash.BackgroundTransparency = 0.15
					Style.tween(flash, 0.5, { BackgroundTransparency = 1 }, Enum.EasingStyle.Quad)
				end
				Style.click("confirm")
				if result == Enum.ScreenshotCaptureResult.Success and capture then
					hint.Text = "Your portrait is ready. Choose whether to save it."
					local prompted = pcall(function()
						Capture:PromptSaveCapturesToGallery({ capture }, function() end)
					end)
					if not prompted then
						hint.Text = "Gallery saving is unavailable in this session."
					end
				else
					hint.Text = "This session could not capture a photo. Try another framing."
				end
			end, { UICaptureMode = Enum.UICaptureMode.None })
		end)
		if not ok and active and current == token then
			footer.Visible = true
			finder.Visible = true
			setBusy(false)
			hint.Text = "Photo capture is unavailable here. Enjoy your cast portrait."
		end
		task.delay(8, function()
			if active and current == token and busy and not footer.Visible then
				footer.Visible = true
				finder.Visible = true
				setBusy(false)
				hint.Text = "Capture timed out. Try again."
			end
		end)
	end)
end, true)
button(3, "Leave booth", "close", leave, false)
invite.OnClientEvent:Connect(function(position)
	if typeof(position) ~= "Vector3" then
		return
	end
	if active then
		leave()
	end
	local cam = workspace.CurrentCamera
	if not cam then
		return
	end
	mark = position
	active = true
	token += 1
	setBusy(false)
	shot = 1
	previousType = cam.CameraType
	previousFov = cam.FieldOfView
	local show = playerGui:FindFirstChild("DeliveryShow") :: ScreenGui?
	if show then
		previousGui = show.Enabled
		show.Enabled = false
	end
	local markers = playerGui:FindFirstChild("DeliveryGuideChevron") :: ScreenGui?
	if markers then
		previousMarkers = markers.Enabled
		markers.Enabled = false
	end
	framing()
	footer.Visible = true
	finder.Visible = true
	count.Visible = false
	overlay.Enabled = true
	Run:BindToRenderStep("CastPhotographer", Enum.RenderPriority.Camera.Value + 4, function()
		local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
		if not root or not root:IsA("BasePart") or (root.Position - mark).Magnitude > 13 then
			task.defer(leave)
			return
		end
		local target = if shot == 2 then mark + Vector3.new(0, 1.05, 0) else Vector3.new(12, 8.65, 118.75)
		local offset = if shot == 2
			then Vector3.new(0.85, 0.3, 6.6)
			elseif shot == 3 then Vector3.new(5, 2.2, 14.4)
			else Vector3.new(0, 0.45, 12.6)
		cam.CameraType = Enum.CameraType.Scriptable
		cam.FieldOfView = if shot == 2 then 42 else 48
		cam.CFrame = CFrame.lookAt(target + offset, target)
	end)
end)
shared:WaitForChild("Stage").OnClientEvent:Connect(function(s)
	if active and s.actor == player.UserId and s.phase == "lineup" then
		leave()
	end
end)
player.CharacterRemoving:Connect(leave)
