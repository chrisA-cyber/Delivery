--!strict
local Players = game:GetService("Players")
local Storage = game:GetService("ReplicatedStorage")
local player = Players.LocalPlayer
local stage = Storage:WaitForChild("Delivery"):WaitForChild("Stage") :: RemoteEvent
local ui = require(script.Parent.Hud).new(player:WaitForChild("PlayerGui") :: PlayerGui)
local state
local title = ""
local notice = false
local micNote = ""
local lastPhase = ""
local mic = require(script.Parent.Microphone).new(
	player,
	require(Storage.Delivery.Features).SpeechInput,
	function(turn, data)
		stage:FireServer("claim", turn, data)
	end,
	function(msg)
		micNote = msg
		if state and state.actor == player.UserId then
			ui.note.Text = msg
		end
	end
)
local function act(verb: string, arg: any?)
	if state then
		stage:FireServer(verb, state.turn, arg)
	end
end
local function render(s)
	state = s
	local mine = s.actor == player.UserId
	local house = s.actor == 0
	local step = tostring(s.turn) .. "/" .. s.phase
	if lastPhase ~= step then
		lastPhase = step
		if mine and s.phase == "direct" then
			micNote = ""
			mic.check()
		elseif mine and s.phase == "take" then
			mic.take(s.turn, s.deadline)
		elseif not mine or (s.phase ~= "countdown" and s.phase ~= "read") then
			mic.stop()
			micNote = ""
		end
	end
	local p = Players:GetPlayerByUserId(s.actor)
	local performer = if house
		then "House rehearsal"
		elseif mine then "Your take"
		elseif p then p.DisplayName
		else "On stage"
	title = string.upper(s.phase) .. "   /   " .. performer
	ui.card.Text = if s.line then s.line.text else "The next seat is open."
	ui.note.Text = if s.cue
		then s.cue.label .. "  ·  " .. s.cue.text
		else "Choose a direction for the next take."
	ui.clear()
	local function action(label: string, verb: string, value: any?, primary: boolean?)
		ui.button(label, function()
			act(verb, value)
		end, primary)
	end
	if s.phase == "lineup" and mine then
		ui.card.Text = "Take the stage?"
		ui.note.Text =
			"During your mic check and take, Delivery listens for volume and words. Nothing you say is kept."
		action("Accept seat", "accept", nil, true)
		action("Pass", "leave")
	elseif s.phase == "direct" then
		if not mine and not s.directed then
			for i, cue in s.cues do
				action(cue.label, "direct", i, i == 1)
			end
		elseif s.directed then
			ui.note.Text = "Your direction vote is in."
		end
	elseif s.phase == "countdown" then
		ui.note.Text = "Get ready  ·  " .. s.cue.text
	elseif s.phase == "take" then
		if house then
			ui.note.Text = "Scripted house take  ·  " .. s.cue.label
		end
		if mine and s.studio then
			action("Use scripted take", "scripted", nil, true)
		end
		if not mine and not s.reacted then
			for _, r in { "Rose", "Tomato", "Laugh", "Gasp" } do
				action(r, "react", r)
			end
		elseif s.reacted then
			ui.note.Text = "Sent " .. s.reacted .. "   ·   " .. s.reactions .. " reactions"
		end
	elseif s.phase == "vote" then
		ui.note.Text = if mine
			then "The room is voting."
			elseif s.rated then "Your rating is in."
			else "How did the bit land?"
		if not mine and not s.rated then
			for i, label in { "Warming up", "Got a smile", "That landed", "Encore!" } do
				action(label, "rate", 25 * i, i == 3)
			end
		end
	elseif s.phase == "host" then
		ui.card.Text = s.hostLine or "The room has spoken."
		ui.note.Text = "House host"
	elseif s.phase == "reveal" then
		local result = s.result
		if result then
			ui.card.Text = if result.overall
				then tostring(result.overall) .. "   " .. result.band
				else "Another take?"
			ui.note.Text = if result.miss
				then "No words came through. Queue again for a fresh take."
				else string.format(
					"Words %s   ·   Commitment %s   ·   Comedy %s   ·   Chaos %s",
					tostring(result.accuracy or "—"),
					tostring(result.commitment or "—"),
					tostring(result.comedy or "—"),
					tostring(result.chaos or "—")
				)
		end
	end
	if mine and micNote ~= "" and (s.phase == "direct" or s.phase == "take") then
		ui.note.Text = micNote
	end
	if s.phase == "read" then
		ui.note.Text = if s.heard
			then "Heard: " .. s.heard
			elseif s.actor == 0 then "House rehearsal · crowd score only"
			else "Reading the take…"
		if s.pace then
			ui.card.Text = string.format(
				"%s%.1f words/sec   ·   %.2f× mic check",
				if s.simulated then "Simulated   ·   " else "",
				s.pace,
				s.relative
			)
		end
	end
	if mine and s.phase ~= "lineup" then
		action("Leave stage", "leave")
	elseif s.queued then
		action("Leave queue  ·  " .. s.queued, "leave")
	elseif not mine then
		if notice then
			ui.note.Text =
				"During your mic check and take, Delivery listens for volume and words. Nothing you say is kept."
			ui.button("Join performer queue", function()
				notice = false
				act("queue")
			end, true)
			ui.button("Stay in crowd", function()
				notice = false
				render(s)
			end)
		else
			ui.button("Step up", function()
				notice = true
				render(s)
			end)
		end
	end
end
stage.OnClientEvent:Connect(render)
stage:FireServer("sync", 0)
task.spawn(function()
	while ui.panel.Parent do
		if state then
			ui.phase.Text = title
				.. "   ·   "
				.. math.max(0, math.ceil(state.deadline - workspace:GetServerTimeNow()))
				.. "s"
		end
		task.wait(0.2)
	end
end)
local camera = workspace.CurrentCamera
if camera then
	camera.CameraType = Enum.CameraType.Scriptable
	camera.CFrame = CFrame.lookAt(Vector3.new(16, 13, 24), Vector3.new(0, 4, -10))
end
