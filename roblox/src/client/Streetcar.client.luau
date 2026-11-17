--!strict
local player = game:GetService("Players").LocalPlayer
local remote = game:GetService("ReplicatedStorage").Delivery:WaitForChild("StreetcarStop") :: RemoteEvent
local train = workspace:WaitForChild("DistrictRailway"):WaitForChild("LotLine")
local gui = Instance.new("ScreenGui")
gui.Name = "LotLineRide"
gui.ResetOnSpawn = false
gui.Enabled = false
gui.Parent = player:WaitForChild("PlayerGui")
local button = Instance.new("TextButton")
button.Name = "RequestStop"
button.AnchorPoint = Vector2.new(0.5, 1)
button.Position = UDim2.new(0.5, 0, 1, -18)
button.Size = UDim2.fromOffset(258, 46)
button.BackgroundColor3 = Color3.fromRGB(26, 64, 65)
button.TextColor3 = Color3.fromRGB(255, 242, 210)
button.Font = Enum.Font.GothamBold
button.TextSize = 15
button.Selectable = true
button.Parent = gui
local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 8)
corner.Parent = button
local requested = false
local seatedConnection
local function display()
	local stop = train:GetAttribute("Stop")
	local dest = train:GetAttribute("NextStop") or "next stop"
	button.Text = if type(stop) == "string" and stop ~= ""
		then "Get off  ·  " .. stop
		elseif requested then "Stopping at " .. dest
		else "Request stop  ·  " .. dest
end
local function watch(character)
	if seatedConnection then
		seatedConnection:Disconnect()
	end
	gui.Enabled = false
	requested = false
	local hum = character:WaitForChild("Humanoid") :: Humanoid
	seatedConnection = hum.Seated:Connect(function(active, seat)
		gui.Enabled = active and seat ~= nil and seat:GetAttribute("LotLineSeat") == true
		requested = false
		display()
	end)
end
button.Activated:Connect(function()
	if gui.Enabled then
		requested = true
		display()
		remote:FireServer()
	end
end)
train:GetAttributeChangedSignal("Stop"):Connect(display)
player.CharacterAdded:Connect(watch)
if player.Character then
	watch(player.Character)
end
