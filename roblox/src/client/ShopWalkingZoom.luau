--!strict
-- Uses the physical floor parts so a walking camera follows the avatar even between server snapshots.
local Zoom = {}
local groups = { "DocksidePost", "NeedleDrop", "CopperKettle", "PocketGallery" }
local limit = 5.5
function Zoom.new(player, set)
	local floors = {}
	local savedMaximum: number? = nil
	local appliedMaximum: number? = nil
	local arrivalFrames = 0
	local firstRootAt: number? = nil
	local arrivalChecked = false
	local function release()
		if savedMaximum and appliedMaximum and player.CameraMaxZoomDistance == appliedMaximum then
			player.CameraMaxZoomDistance = savedMaximum
		end
		savedMaximum, appliedMaximum = nil, nil
	end
	local function indoors(pos)
		for _, name in groups do
			local floor = floors[name]
			if not floor or not floor.Parent then
				local room = set:FindFirstChild(name)
				floor = room and room:FindFirstChild("ShopFloor")
				floors[name] = floor
			end
			if floor and floor:IsA("BasePart") then
				local p = floor.CFrame:PointToObjectSpace(pos)
				if
					math.abs(p.X) <= floor.Size.X / 2
					and math.abs(p.Z) <= floor.Size.Z / 2
					and p.Y >= 0
					and p.Y <= 10.55
				then
					return true
				end
			end
		end
		return false
	end
	local function update(walking, root)
		if not walking or not root or player.CameraMode == Enum.CameraMode.LockFirstPerson then
			release()
			arrivalFrames = 0
			return
		end
		if not arrivalChecked then
			firstRootAt = firstRootAt or os.clock()
			local pos = root.Position
			if math.abs(pos.X - 99) <= 5 and math.abs(pos.Z - 80) <= 5 and pos.Y < 12 then
				-- Let the default camera accept the shorter spawn distance, then restore its full range.
				arrivalFrames = 2
				arrivalChecked = true
			elseif os.clock() - firstRootAt > 1 then
				arrivalChecked = true
			end
		end
		if arrivalFrames == 0 and not indoors(root.Position) then
			release()
			return
		end
		arrivalFrames = math.max(0, arrivalFrames - 1)
		local current = player.CameraMaxZoomDistance
		if savedMaximum == nil or current ~= appliedMaximum then
			savedMaximum = current
		end
		local cap = math.min(savedMaximum, math.max(limit, player.CameraMinZoomDistance))
		appliedMaximum = cap
		if current ~= cap then
			player.CameraMaxZoomDistance = cap
		end
	end
	local function reset()
		release()
		arrivalFrames = 0
		firstRootAt = nil
		arrivalChecked = false
	end
	return { update = update, reset = reset, release = release, indoors = indoors }
end
return Zoom
