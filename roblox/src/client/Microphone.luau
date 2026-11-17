--!strict
local Voice = game:GetService("VoiceChatService")
local Microphone = {}
local function wire(source: Instance, target: Instance): Wire
	local link = Instance.new("Wire")
	link.SourceInstance = source
	link.TargetInstance = target
	link.Parent = target
	return link
end
function Microphone.new(player: Player, enabled: boolean, submit, message)
	local session = 0
	local root: Folder? = nil
	local input: AudioDeviceInput? = nil
	local analyzer: AudioAnalyzer? = nil
	local baseline = 0
	local function stop()
		session += 1
		if root then
			root:Destroy()
		end
		root = nil
		input = nil
		analyzer = nil
		baseline = 0
	end
	local function check()
		stop()
		if not enabled then
			message("Speech input is off. The audience can still rate this take.")
			return
		end
		local token = session
		task.spawn(function()
			local ok, eligible = pcall(function()
				return Voice:IsVoiceEnabledForUserIdAsync(player.UserId)
			end)
			if token ~= session then
				return
			end
			if not ok or not eligible then
				message("Microphone unavailable. Stay in the crowd or use a Studio rehearsal.")
				return
			end
			local folder = Instance.new("Folder")
			folder.Name = "LocalTake"
			folder.Parent = player
			root = folder
			local mic = Instance.new("AudioDeviceInput")
			mic.Player = player
			mic.Parent = folder
			input = mic
			local meter = Instance.new("AudioAnalyzer")
			meter.SpectrumEnabled = false
			meter.Parent = folder
			wire(mic, meter)
			analyzer = meter
			message("Mic check · speak at your usual level for three seconds.")
			local samples = {}
			for _ = 1, 15 do
				task.wait(0.2)
				if session ~= token then
					return
				end
				local v = meter.RmsLevel
				if v > 0.0001 then
					table.insert(samples, math.min(1, v))
				end
			end
			table.sort(samples)
			if #samples < 3 then
				message("No mic level. Check your Roblox mute, then take another seat.")
				return
			end
			baseline = samples[math.ceil(#samples / 2)]
			message("Mic checked. Watch for the take.")
		end)
	end
	local function take(turn: number, deadline: number)
		if not root or not analyzer or not input or baseline <= 0 then
			message("Mic check incomplete. Try another take or play the crowd.")
			return
		end
		local token = session
		local stt = Instance.new("AudioSpeechToText")
		stt.Enabled = true
		stt.Parent = root
		local speechWire = wire(input, stt)
		local heard = {}
		local length = 0
		stt:GetPropertyChangedSignal("Text"):Connect(function()
			local text = stt.Text
			if text ~= "" and length + #text + 1 <= 384 then
				table.insert(heard, text)
				length += #text + 1
			end
			if text ~= "" then
				stt.Text = ""
			end
		end)
		local meter = analyzer
		local reference = baseline
		message("On air · read the card.")
		task.spawn(function()
			local start = workspace:GetServerTimeNow()
			local levels = {}
			while token == session and workspace:GetServerTimeNow() < deadline and #levels < 50 do
				local level = math.clamp(meter.RmsLevel, 0, 1)
				table.insert(levels, level)
				if #levels % 2 == 0 then
					local stage = game:GetService("ReplicatedStorage").Delivery.Stage
					stage:FireServer("wave", turn, math.clamp(level / reference / 2, 0, 1))
				end
				task.wait(0.2)
			end
			if token ~= session then
				return
			end
			speechWire:Destroy()
			local seconds = math.min(10, workspace:GetServerTimeNow() - start)
			task.wait(0.8) -- let the last segment settle without accepting more audio
			if token ~= session then
				return
			end
			submit(
				turn,
				{ words = table.concat(heard, " "), levels = levels, seconds = seconds, baseline = reference }
			)
			stop()
		end)
	end
	return { check = check, take = take, stop = stop }
end
return Microphone
