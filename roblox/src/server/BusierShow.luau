--!strict
local Players = game:GetService("Players")
local Teleport = game:GetService("TeleportService")
local BusierShow = {}
function BusierShow.new()
	local enabled = game.GameId > 0
		and game.PrivateServerId == ""
		and not game:GetService("RunService"):IsStudio()
	if not enabled then
		return function()
			return "This local or private show stays together."
		end
	end
	local index = game:GetService("MemoryStoreService"):GetSortedMap("DeliveryPublicRooms_v1")
	local last = {}
	task.spawn(function()
		while true do
			local n = #Players:GetPlayers()
			if n > 0 and n < math.min(10, Players.MaxPlayers) then
				pcall(index.SetAsync, index, game.JobId, n, 65, n)
			else
				pcall(index.RemoveAsync, index, game.JobId)
			end
			task.wait(35)
		end
	end)
	Players.PlayerRemoving:Connect(function(p)
		last[p] = nil
	end)
	return function(p)
		if (last[p] or 0) > os.clock() then
			return "Give the room finder a moment."
		end
		last[p] = os.clock() + 15
		local ok, items = pcall(index.GetRangeAsync, index, Enum.SortDirection.Descending, 10)
		if ok then
			for _, item in items do
				if
					item.key ~= game.JobId
					and item.value > #Players:GetPlayers()
					and item.value < 10
					and p.Parent == Players
				then
					local options = Instance.new("TeleportOptions")
					options.ServerInstanceId = item.key
					local moved = pcall(Teleport.TeleportAsync, Teleport, game.PlaceId, { p }, options)
					if moved then
						return "Joining the show…"
					end
				end
			end
		end
		return "No busier room is available. Your seat is here."
	end
end
return BusierShow
