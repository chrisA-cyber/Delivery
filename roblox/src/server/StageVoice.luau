--!strict
local Players = game:GetService("Players")
local Voice = game:GetService("VoiceChatService")
local Chat = game:GetService("TextChatService")
local StageVoice = {}
function StageVoice.new(enabled: boolean)
	local graph: Folder? = nil
	local function stop()
		if graph then
			graph:Destroy()
			graph = nil
		end
	end
	local function start(p: Player)
		stop()
		if not enabled then
			return
		end
		local folder = Instance.new("Folder")
		folder.Name = "StageAudio"
		graph = folder
		local mic = Instance.new("AudioDeviceInput")
		mic.AccessType = Enum.AccessModifierType.Allow
		mic:SetUserIdAccessList({})
		mic.Player = p
		mic.Parent = folder
		local output = Instance.new("AudioDeviceOutput")
		output.Parent = folder
		local wire = Instance.new("Wire")
		wire.SourceInstance = mic
		wire.TargetInstance = output
		wire.Parent = folder
		folder.Parent = workspace
		local allowed = {}
		for _, listener in Players:GetPlayers() do
			if listener ~= p then
				task.spawn(function()
					local ok, permitted = pcall(function()
						local groups = Voice:GetChatGroupsAsync({ p, listener })
						if #groups ~= 2 or not Chat:CanUsersChatAsync(p.UserId, listener.UserId) then
							return false
						end
						for _, group in groups[1] do
							if table.find(groups[2], group) then
								return true
							end
						end
						return false
					end)
					if graph == folder and ok and permitted and listener.Parent == Players then
						table.insert(allowed, listener.UserId)
						mic:SetUserIdAccessList(allowed)
					end
				end)
			end
		end
	end
	return { start = start, stop = stop }
end
return StageVoice
