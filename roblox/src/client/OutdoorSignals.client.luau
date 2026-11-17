--!strict
-- Each visitor sees the timing of their own buoy watch on the physical harbour lamp.
local shared = game:GetService("ReplicatedStorage"):WaitForChild("Delivery")
local run
local lamp
local light
local oldColour
local oldMaterial
local function release()
	if lamp and lamp.Parent then
		lamp.Color = oldColour
		lamp.Material = oldMaterial
	end
	if light then
		light:Destroy()
	end
	lamp = nil
	light = nil
end
shared:WaitForChild("Stage").OnClientEvent:Connect(function(s)
	local venue = s.venue
	local r = venue and venue.outdoor
	run = if venue
			and venue.room == "pier"
			and r
			and r.kind == "pier"
			and r.status == "active"
		then r
		else nil
	if not run then
		release()
	end
end)
while script.Parent do
	task.wait(if run then 0.07 else 0.3)
	if run then
		if not lamp or not lamp.Parent then
			release()
			local set = workspace:FindFirstChild("ShowSet")
			local found = set and set:FindFirstChild("BuoyLamp", true)
			if found and found:IsA("BasePart") then
				lamp = found
				oldColour = found.Color
				oldMaterial = found.Material
				light = Instance.new("PointLight")
				light.Color = Color3.fromRGB(255, 236, 140)
				light.Range = 13
				light.Shadows = false
				light.Parent = found
			end
		end
		if lamp and light then
			local elapsed = workspace:GetServerTimeNow() - run.started
			local pulse = false
			for i, beat in run.beats do
				if not run.reels[tostring(i)] and math.abs(elapsed - beat) <= 0.8 then
					pulse = true
					break
				end
			end
			lamp.Color = if pulse then Color3.fromRGB(255, 243, 152) else Color3.fromRGB(109, 73, 53)
			lamp.Material = if pulse then Enum.Material.Neon else Enum.Material.SmoothPlastic
			light.Brightness = if pulse then 3.5 else 0
		end
	end
end
release()
