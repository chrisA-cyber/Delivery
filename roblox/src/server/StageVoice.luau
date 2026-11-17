--!strict
local Players = game:GetService("Players")
local Voice = game:GetService("VoiceChatService")
local Chat = game:GetService("TextChatService")
local StageVoice = {}
function StageVoice.new(enabled: boolean, watching)
	local graph: Folder? = nil
	local currentMic: AudioDeviceInput? = nil
	local speaker: Player? = nil
	local allowed = {}
	local function removeListener(p)
		local index = table.find(allowed, p.UserId)
		if index then
			table.remove(allowed, index)
			if currentMic then
				currentMic:SetUserIdAccessList(allowed)
			end
		end
	end
	local function stop()
		currentMic = nil
		speaker = nil
		table.clear(allowed)
		if graph then
			graph:Destroy()
			graph = nil
		end
	end
	-- Routes the live microphone to one more watcher, after the same voice and chat permission checks.
	local function grant(listener: Player)
		local folder, mic, p = graph, currentMic, speaker
		if
			not folder
			or not mic
			or not p
			or listener == p
			or table.find(allowed, listener.UserId)
			or not watching(listener)
		then
			return
		end
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
			if
				graph == folder
				and ok
				and permitted
				and listener.Parent == Players
				and watching(listener)
				and not table.find(allowed, listener.UserId)
			then
				table.insert(allowed, listener.UserId)
				mic:SetUserIdAccessList(allowed)
			end
		end)
	end
	local function start(p: Player, echo: boolean?)
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
		currentMic = mic
		local output = Instance.new("AudioDeviceOutput")
		output.Parent = folder
		local wire = Instance.new("Wire")
		wire.SourceInstance = mic
		if echo then
			local effect = Instance.new("AudioEcho")
			effect.DelayTime = 0.11
			effect.WetLevel = -22
			effect.Feedback = 0.06
			effect.Parent = folder
			wire.TargetInstance = effect
			local final = Instance.new("Wire")
			final.SourceInstance = effect
			final.TargetInstance = output
			final.Parent = folder
		else
			wire.TargetInstance = output
		end
		wire.Parent = folder
		folder.Parent = workspace
		speaker = p
		for _, listener in Players:GetPlayers() do
			grant(listener)
		end
	end
	return { start = start, stop = stop, removeListener = removeListener, addListener = grant }
end
return StageVoice
