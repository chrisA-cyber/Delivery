--!strict
local Players = game:GetService("Players")
local Run = game:GetService("RunService")
local Storage = game:GetService("ReplicatedStorage")
local Capture = game:GetService("CaptureService")
local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")
local shared = Storage:WaitForChild("Delivery")
local invite = shared:WaitForChild("PortraitSession") :: RemoteEvent
local overlay = Instance.new("ScreenGui")
overlay.Name = "CastPortrait"
overlay.ResetOnSpawn = false
overlay.DisplayOrder = 20
overlay.Enabled = false
overlay.Parent = playerGui
local footer = Instance.new("Frame")
footer.Name = "PhotoDesk"
footer.AnchorPoint = Vector2.new(0.5, 1)
footer.Position = UDim2.new(0.5, 0, 1, -8)
footer.Size = UDim2.new(0.93, 0, 0, 89)
footer.BackgroundColor3 = Color3.fromRGB(35, 27, 49)
footer.Parent = overlay
local max = Instance.new("UISizeConstraint")
max.MaxSize = Vector2.new(700, 89)
max.Parent = footer
local corner = Instance.new("UICorner")
corner.Parent = footer
local hint = Instance.new("TextLabel")
hint.Size = UDim2.new(1, -16, 0, 30)
hint.Position = UDim2.fromOffset(8, 3)
hint.Font = Enum.Font.GothamBold
hint.TextScaled = true
hint.TextColor3 = Color3.fromRGB(255, 231, 188)
hint.BackgroundTransparency = 1
hint.Parent = footer
local clamp = Instance.new("UITextSizeConstraint")
clamp.MaxTextSize = 18
clamp.Parent = hint
local layouts = { "Cast photo", "Close-up", "Wide postcard" }
local mark = Vector3.zero
local shot = 1
local active = false
local busy = false
local token = 0
local previousType = Enum.CameraType.Custom
local previousFov = 70
local previousGui = true
local function button(slot, text, callback, primary)
	local b = Instance.new("TextButton")
	b.Size = UDim2.new(1 / 3, -9, 0, 44)
	b.Position = UDim2.new((slot - 1) / 3, 6, 0, 38)
	b.Font = Enum.Font.GothamBold
	b.Text = text
	b.TextWrapped = true
	b.TextSize = 15
	b.BackgroundColor3 = if primary then Color3.fromRGB(255, 208, 111) else Color3.fromRGB(74, 54, 90)
	b.TextColor3 = if primary then Color3.fromRGB(35, 27, 49) else Color3.fromRGB(255, 238, 209)
	b.Parent = footer
	local round = Instance.new("UICorner")
	round.Parent = b
	b.Activated:Connect(callback)
	return b
end
local function leave()
	if not active then
		return
	end
	token += 1
	active = false
	busy = false
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
end
button(1, "Change framing", function()
	if busy then
		return
	end
	shot = shot % #layouts + 1
	hint.Text = "ROOFTOP STUDIO   /   " .. layouts[shot]
end, false)
button(2, "Take photo", function()
	if busy or not active then
		return
	end
	local current = token
	busy = true
	task.spawn(function()
		for i = 3, 1, -1 do
			if not active or token ~= current then
				return
			end
			hint.Text = "Hold your pose  ·  " .. i
			task.wait(0.55)
		end
		if token ~= current or not active then
			return
		end
		footer.Visible = false
		local ok = pcall(function()
			Capture:TakeScreenshotCaptureAsync(function(result, capture)
				if token ~= current or not active then
					return
				end
				footer.Visible = true
				busy = false
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
			busy = false
			hint.Text = "Gallery capture is unavailable here. Enjoy your cast portrait."
		end
		task.delay(8, function()
			if active and current == token and busy and not footer.Visible then
				footer.Visible = true
				busy = false
				hint.Text = "Capture timed out. Try again."
			end
		end)
	end)
end, true)
button(3, "Back to the venue", leave, false)
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
	busy = false
	shot = 1
	previousType = cam.CameraType
	previousFov = cam.FieldOfView
	local show = playerGui:FindFirstChild("DeliveryShow") :: ScreenGui?
	if show then
		previousGui = show.Enabled
		show.Enabled = false
	end
	hint.Text = "ROOFTOP STUDIO   /   Cast photo"
	footer.Visible = true
	overlay.Enabled = true
	Run:BindToRenderStep("CastPhotographer", Enum.RenderPriority.Camera.Value + 4, function()
		local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
		if not root or (root.Position - mark).Magnitude > 13 then
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
