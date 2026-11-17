--!strict
local Players = game:GetService("Players")
local Storage = game:GetService("ReplicatedStorage")
local player = Players.LocalPlayer
local stage = Storage:WaitForChild("Delivery"):WaitForChild("Stage") :: RemoteEvent
local ui = require(script.Parent.Hud).new(player:WaitForChild("PlayerGui") :: PlayerGui)
local fx = require(script.Parent.ShowFX).new(ui.gui, Storage.Delivery)
local state
local title = ""
local notice = false
local backstage = false
local shopping = false
local shopPage = nil
local Shop = require(script.Parent.Shop)
local Capture = require(script.Parent.Capture)
local Modes = require(Storage.Delivery.Modes)
local modeIndex, setup, ending = 1, 1, 1
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
	fx.update(s, backstage and not mine)
	local house = s.actor == 0
	local step = tostring(s.turn) .. "/" .. s.phase
	if lastPhase ~= step then
		lastPhase = step
		if mine and s.useMic and s.phase == "direct" then
			micNote = ""
			mic.check(s.turn)
		elseif mine and s.useMic and s.phase == "take" then
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
	title = string.upper(s.phase)
		.. "   /   "
		.. performer
		.. (if s.mode and s.mode ~= "Main stage" then "   ·   " .. s.mode else "")
	ui.card.Text = if s.line and s.mode == "Echo"
		then Modes.beat(s.line.text)
		elseif s.line then s.line.text
		else "The next seat is open."
	ui.note.Text = if s.cue
		then s.cue.label .. "  ·  " .. s.cue.text
		else "Choose a direction for the next take."
	ui.clear()
	local function action(label: string, verb: string, value: any?, primary: boolean?)
		ui.button(label, function()
			act(verb, value)
		end, primary)
	end
	if backstage and not mine then
		title = "BACKSTAGE   /   Daily show"
		local row = s.standing
		if shopping then
			Shop.draw(
				ui,
				s,
				player,
				require(Storage.Delivery.Wardrobe),
				act,
				function()
					shopPage = nil
					shopping = false
					render(s)
				end,
				shopPage,
				function(page)
					shopPage = page
					render(state)
				end
			)
			return
		end
		ui.card.Text = s.dailyLine or "Daily show"
		ui.note.Text = string.format(
			"Daily · %s   |   Stage %d · Crowd %d   |   Troupe %d/50   |   %s",
			s.dailyCue or "",
			row and row.stage or 0,
			row and row.crowd or 0,
			row and math.max(row.troupeTotal, row.weekly) or 0,
			s.saveStatus or "Session play"
		)
		ui.button("Back to the show", function()
			backstage = false
			render(s)
		end, true)
		if s.alone then
			ui.button("Find a busier show", function()
				act("busier")
				ui.note.Text = "Looking for an open seat…"
			end)
		end
		ui.button("Dressing room", function()
			shopping = true
			render(s)
		end)
		ui.button("Camera motion", function()
			ui.note.Text = if fx.toggle() then "Reduced motion on." else "Show camera on."
		end)
		ui.button("Invite a friend", function()
			local social = game:GetService("SocialService")
			local ok, can = pcall(social.CanSendGameInviteAsync, social, player)
			if ok and can then
				local opened = pcall(social.PromptGameInvite, social, player)
				if opened then
					act("inviteOpened")
				end
			else
				ui.note.Text = "Invites are unavailable in this session."
			end
		end)
		if row then
			local badges = {}
			for name in row.badges do
				table.insert(badges, name)
			end
			table.sort(badges)
			ui.button("My progress", function()
				ui.card.Text = if #badges > 0
					then table.concat(badges, " · ")
					else "Your first badge is one take away."
				ui.note.Text = string.format(
					"Daily streak %d   ·   Last Daily %s   ·   Best %d",
					row.dailyRun,
					if row.lastDaily > 0 then tostring(row.firstDailyScore) else "—",
					row.best
				)
			end)
			if not s.queued then
				ui.button("Play today's card", function()
					backstage = false
					notice = true
					modeIndex = table.find(Modes.names, "Daily")
					render(s)
				end)
			end
			for _, other in Players:GetPlayers() do
				if other ~= player then
					ui.button("Troupe · " .. other.DisplayName, function()
						act("troupe", other.UserId)
						ui.note.Text = "Troupes form with friends before your first points this week."
					end)
				end
			end
		end
		return
	end
	if s.phase == "lineup" and mine then
		ui.card.Text = "Take the stage?"
		ui.note.Text =
			"During your mic check and take, Delivery listens for volume and words. Nothing you say is kept."
		if s.studio then
			action("Studio rehearsal", "accept", "rehearsal", true)
		end
		action("Accept · use my mic", "accept", "mic", not s.studio)
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
		if mine and s.studio and not s.useMic then
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
			ui.note.Text = if s.simulated
				then "Studio rehearsal · simulated words and volume."
				elseif result.miss then "No words came through. You can try the same card again."
				else string.format(
					"Words %s   ·   Commitment %s   ·   Comedy %s   ·   Chaos %s",
					tostring(result.accuracy or "—"),
					tostring(result.commitment or "—"),
					tostring(result.comedy or "—"),
					tostring(result.chaos or "—")
				)
		end
	end
	if not mine and (s.phase == "read" or (s.phase == "take" and s.reacted)) and not s.predicted then
		for i, name in { "Under 60", "60–89", "90+" } do
			action("Call it: " .. name, "predict", i)
		end
	end
	if
		s.phase == "vote"
		and s.duel
		and s.actor == s.duel.second
		and player.UserId ~= s.duel.first
		and not mine
		and not s.duelVoted
	then
		action("First take wins", "duelVote", 1)
		action("Second take wins", "duelVote", 2)
	end
	if s.phase == "intermission" and s.standing then
		ui.card.Text = string.format(
			"Stage %d   ·   Crowd %d",
			1 + math.floor(s.standing.stage / 40),
			1 + math.floor(s.standing.crowd / 20)
		)
		ui.note.Text = if s.honours ~= ""
			then s.honours
			else "Crowd points: " .. s.standing.crowd .. "   ·   Hot streak: " .. s.standing.streak
	end
	if
		(s.phase == "reveal" or s.phase == "intermission")
		and mine
		and s.result
		and s.result.miss
		and not s.queued
	then
		action("Retake this card", "retake", nil, true)
	end
	if s.phase == "reveal" and mine and s.encore and not s.queued then
		action("Take the encore", "encore", nil, true)
	end
	if s.phase == "reveal" and s.result and (s.result.overall or 0) >= 75 then
		ui.button("Capture the reveal", function()
			Capture.reveal(function(msg)
				ui.note.Text = msg
			end)
		end)
	end
	if s.phase == "reveal" and s.duel and s.actor == s.duel.second then
		local winner = s.winner and Players:GetPlayerByUserId(s.winner)
		ui.note.Text = if winner
			then winner.DisplayName .. " wins the face-off! Join again to defend."
			else "Face-off · split decision."
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
	if not mine and not notice then
		ui.button("Backstage", function()
			backstage = true
			render(s)
		end)
	end
	if mine and s.phase ~= "lineup" then
		action("Leave stage", "leave")
	elseif s.queued then
		action("Leave queue  ·  " .. s.queued, "leave")
	elseif not mine then
		if notice then
			ui.note.Text =
				"During your mic check and take, Delivery listens for volume and words. Nothing you say is kept."
			ui.button("Mode · " .. Modes.names[modeIndex], function()
				repeat
					modeIndex = modeIndex % #Modes.names + 1
				until Modes.names[modeIndex] ~= "Pack night"
					or (s.standing and s.standing.packs["Pack night"])
				render(s)
			end)
			if Modes.names[modeIndex] == "Custom" then
				ui.card.Text = Modes.setups[setup] .. " " .. Modes.ends[ending]
				ui.button("Change setup", function()
					setup = setup % 3 + 1
					render(s)
				end)
				ui.button("Change ending", function()
					ending = ending % 3 + 1
					render(s)
				end)
			end
			ui.button("Join performer queue", function()
				notice = false
				act("queue", { mode = Modes.names[modeIndex], mix = (setup - 1) * 3 + ending })
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
player:GetAttributeChangedSignal("LatestPlaybill"):Connect(function()
	if shopping and state then
		render(state)
	end
end)
player:GetAttributeChangedSignal("RoomFinder"):Connect(function()
	if backstage then
		ui.note.Text = player:GetAttribute("RoomFinder")
	end
end)
stage.OnClientEvent:Connect(render)
stage:FireServer("sync", 0)
task.spawn(function()
	while ui.panel.Parent do
		if state then
			if not backstage and state.phase == "take" and state.mode == "Switch" then
				local idx = math.clamp(
					1 + math.floor((10 - state.deadline + workspace:GetServerTimeNow()) / 2.5),
					1,
					4
				)
				ui.note.Text = "Cue " .. idx .. "/4   ·   " .. Modes.switchCues[idx]
			end
			ui.phase.Text = title
				.. "   ·   "
				.. math.max(0, math.ceil(state.deadline - workspace:GetServerTimeNow()))
				.. "s"
		end
		task.wait(0.2)
	end
end)
