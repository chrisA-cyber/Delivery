--!strict
local Players = game:GetService("Players")
local Storage = game:GetService("ReplicatedStorage")
local Social = game:GetService("SocialService")
local player = Players.LocalPlayer
local shared = Storage:WaitForChild("Delivery")
local stage = shared:WaitForChild("Stage") :: RemoteEvent
local ui = require(script.Parent.Hud).new(player:WaitForChild("PlayerGui") :: PlayerGui)
ui.panel.Visible = false
ui.nav.Visible = false
local fx = require(script.Parent.ShowFX).new(ui.gui, shared)
local Modes = require(shared.Modes)
local Shop = require(script.Parent.Shop)
local Capture = require(script.Parent.Capture)
local state
local page = "explore"
local openedRoomRevision = 0
local mode = "Main stage"
local shopPage = nil
local setup, ending = 1, 1

local phaseKey = ""
local clockStart = 0
local micNote = ""
local toast = ""
local toastUntil = 0
local fixtureTurn = -1
local padPending = {}
local padButtons = {}
local render
local function act(verb: string, arg: any?)
	if state then
		stage:FireServer(verb, state.turn, arg)
	end
end
local function showPage(nextPage: string)
	page = if nextPage == "return"
		then (if state and state.venue and not state.venue.watching then "explore" else "show")
		else nextPage
	toast = ""
	shopPage = nil
	if state then
		render(state)
	end
end
local function notify(message: string)
	toast = message
	toastUntil = os.clock() + 4
	ui.note.Text = message
end
local function venue(payload)
	act("venue", payload)
end
local guide = require(script.Parent.VenueGuide).new(ui, venue, showPage, notify)
local function watch()
	if state.venue and not state.venue.watching then
		venue({ op = "travel", room = if guide.roomId() == "balcony" then "balcony" else "theatre" })
	else
		showPage("show")
	end
end
local mic = require(script.Parent.Microphone).new(
	player,
	require(shared.Features).SpeechInput,
	function(turn, data)
		stage:FireServer("claim", turn, data)
	end,
	function(message)
		micNote = message
		if
			state
			and page == "show"
			and state.actor == player.UserId
			and (state.phase == "direct" or state.phase == "take")
		then
			ui.note.Text = message
		end
	end
)
local descriptions = {
	["Main stage"] = "Draw a line, follow the crowd's direction and read it aloud in ten seconds.",
	["Sound booth"] = "Flip reads the story. You perform three sound cues on the pads. No microphone needed.",
	Switch = "Repeat a short phrase four times. Watch for each new volume cue.",
	Echo = "Listen to Flip, then copy the line with the marked pause.",
	["Face-off"] = "Two volunteers perform the same line. The audience chooses a winner.",
	Daily = "Perform today's shared card. Your first successful Daily sets your score.",
	Custom = "Pair a setup and a punchline to make your own approved card.",
	["Pack night"] = "Draw from this week's featured pack and perform it for the room.",
}
local phaseNames = {
	lobby = "Seats open",
	lineup = "Stage invitation",
	direct = "Director's choice",
	countdown = "Get ready",
	take = "On air",
	read = "Call the score",
	vote = "Audience vote",
	host = "Flip's verdict",
	reveal = "Score reveal",
	intermission = "Curtain call",
}
local function queue(nextMode: string)
	mode = nextMode
	page = "show"
	act("queue", { mode = mode, mix = (setup - 1) * 3 + ending })
	render(state)
	notify("Requesting your stage invitation…")
end
local function scripted()
	if fixtureTurn == state.turn then
		return
	end
	fixtureTurn = state.turn
	act("scripted")
	render(state)
end
local function invite()
	local ok, allowed = pcall(Social.CanSendGameInviteAsync, Social, player)
	if ok and allowed then
		local opened = pcall(Social.PromptGameInvite, Social, player)
		if opened then
			act("inviteOpened")
		else
			notify("Invites are unavailable here.")
		end
	else
		notify("Invites are unavailable here.")
	end
end
local function copy(kicker: string, title: string, note: string)
	ui.kicker.Text = string.upper(kicker)
	ui.card.Text = title
	ui.note.Text = note
end
local function button(text: string, verb: string, value: any?, primary: boolean?, icon: string?)
	return ui.button(text, function()
		act(verb, value)
	end, primary, icon)
end
local function selectMode(name: string)
	mode = name
	showPage("choose")
end
local function menu(s)
	local row = s.standing
	if page == "welcome" then
		ui.phase.Text = "DELIVERY   /   LIVE SHOW"
		copy("Main Theatre", "Choose your part", "Sound pads work with your mic off.")
		ui.button("Play with sound pads", function()
			queue("Sound booth")
		end, true, "headphones")
		ui.button("Perform a voice line", function()
			queue("Main stage")
		end, false, "mic")
		ui.button("Join the audience", watch, false, "users")
		ui.button("Explore the district", function()
			showPage("explore")
		end, false, "radio")
	elseif page == "modes" then
		ui.phase.Text = "CASTING   /   PICK A FORMAT"
		copy(
			"Performer entrance",
			"Choose your act",
			"Sound booth uses three touch pads. Voice formats use your microphone only after you accept."
		)
		for _, name in Modes.names do
			if name ~= "Pack night" or (row and row.packs["Pack night"]) then
				ui.button(
					name,
					function()
						selectMode(name)
					end,
					name == "Sound booth",
					if name == "Sound booth" then "headphones" elseif name == "Main stage" then "mic" else nil
				)
			end
		end
	elseif page == "choose" then
		ui.phase.Text = "CASTING   /   " .. string.upper(mode)
		copy("Round format", mode, descriptions[mode] or "Join the stage and follow the cue.")
		if mode == "Custom" then
			ui.card.Text = Modes.setups[setup] .. " " .. Modes.ends[ending]
			ui.button("Change setup", function()
				setup = setup % #Modes.setups + 1
				render(state)
			end)
			ui.button("Change ending", function()
				ending = ending % #Modes.ends + 1
				render(state)
			end)
		end
		ui.button("Join this round", function()
			queue(mode)
		end, true, "play")
		ui.button("Other formats", function()
			showPage("modes")
		end)
	elseif page == "menu" then
		ui.phase.Text = "BACKSTAGE   /   SHOW MENU"
		copy(
			"Daily show",
			s.dailyLine or "Today's card",
			s.dailyCue and ("Today's direction · " .. s.dailyCue) or "One card for the whole theatre."
		)
		if not s.queued then
			ui.button("Play today's card", function()
				selectMode("Daily")
			end, true, "play")
		end
		if s.venue and s.venue.watching then
			ui.button("Leave seat & explore", function()
				venue({
					op = "travel",
					room = if s.venue.room == "balcony" then "balcony" else "theatre",
					walk = true,
				})
			end, false, "users")
		end
		ui.button("District map", function()
			showPage("map")
		end, false, "radio")
		ui.button("How to play", function()
			showPage("help")
		end, false, "help-circle")
		ui.button("My progress", function()
			showPage("progress")
		end, false, "award")
		ui.button("Dressing room", function()
			showPage("shop")
		end, false, "book-open")
		ui.button("Play with friends", function()
			showPage("friends")
		end, false, "users")
		ui.button(if fx.isReduced() then "Camera motion · off" else "Camera motion · on", function()
			fx.toggle()
			render(state)
		end)
	elseif page == "help" then
		ui.phase.Text = "DELIVERY   /   PLAYER GUIDE"
		copy(
			"Getting around",
			"Choose your route",
			"Explore the streets on foot, ride the streetcar, or choose a role at the live show."
		)
		ui.button("District guide", function()
			showPage("helpWalk")
		end, true, "radio")
		ui.button("Sound pads", function()
			showPage("helpPads")
		end, true, "headphones")
		ui.button("Voice", function()
			showPage("helpVoice")
		end, false, "mic")
		ui.button("Audience", function()
			showPage("helpCrowd")
		end, false, "users")
	elseif page == "helpWalk" then
		ui.phase.Text = "DELIVERY   /   DISTRICT GUIDE"
		copy(
			"Lantern Street",
			"Pier west. Park east.",
			"Walk south around the terrace for the Night Market. Board the streetcar at a marked stop and choose Get off when it arrives. Map shows both the street routes and the nearby studios."
		)
		ui.button("District map", function()
			showPage("map")
		end, true, "book-open")
		ui.button("Back to walking", function()
			showPage("explore")
		end)
		ui.button("Show roles", function()
			showPage("welcome")
		end, false, "mic")
		ui.button("District records", function()
			showPage("districtRecords")
		end, false, "award")
	elseif page == "districtRecords" and row then
		ui.phase.Text = "DELIVERY   /   DISTRICT RECORDS"
		local speed = if (row.parkBestMs or 0) > 0
			then string.format("%.2fs", row.parkBestMs / 1000)
			else "No finish yet"
		copy(
			"Your personal bests",
			"Signal Run   ·   " .. speed,
			string.format(
				"Buoy Watch best %d%%   ·   Park finishes %d   ·   Market orders %d",
				row.pierBest or 0,
				row.parkRuns or 0,
				row.marketOrders or 0
			)
		)
		ui.button("District map", function()
			showPage("map")
		end, true, "book-open")
		ui.button("My badges", function()
			showPage("badges")
		end, false, "award")
	elseif page == "helpPads" or page == "helpVoice" or page == "helpCrowd" then
		ui.phase.Text = "BACKSTAGE   /   HOW TO PLAY"
		if page == "helpPads" then
			copy(
				"Sound booth",
				"Follow the sound cue",
				"Choose Sound booth, accept your seat, then press the highlighted pad as each countdown reaches GO."
			)
		elseif page == "helpVoice" then
			copy(
				"Voice performance",
				"Speak when the card says On air",
				"Accept your mic, speak normally for the check, then perform the line in the chosen style. Words and volume are used for this take only."
			)
		else
			copy(
				"Audience",
				"Give the performer a direction",
				"Pick a style, send one reaction, predict the score and rate the take. Your choices earn crowd XP."
			)
		end
		ui.button("Return to show", function()
			watch()
		end, true, "play")
		ui.button("Other roles", function()
			showPage("help")
		end)
	elseif page == "progress" and row then
		ui.phase.Text = "BACKSTAGE   /   PROGRESS"
		local earned = {}
		for name in row.badges do
			table.insert(earned, (name:gsub("-", " ")))
		end
		table.sort(earned)
		copy(
			"Your standing",
			string.format(
				"Stage rank %d  ·  Crowd rank %d",
				1 + math.floor(row.stage / 40),
				1 + math.floor(row.crowd / 20)
			),
			string.format("%d stage XP · %d crowd XP · Best take %d", row.stage, row.crowd, row.best)
		)
		ui.button("My badges · " .. #earned, function()
			showPage("badges")
		end, true, "award")
		ui.button("Daily record", function()
			showPage("record")
		end)
		ui.button("District records", function()
			showPage("districtRecords")
		end, false, "radio")
	elseif page == "badges" and row then
		local earned = {}
		for name in row.badges do
			table.insert(earned, (name:gsub("-", " ")))
		end
		table.sort(earned)
		ui.phase.Text = "BACKSTAGE   /   BADGES"
		copy(
			"Earned badges",
			if #earned > 0 then table.concat(earned, "  ·  ") else "Your first badge is one take away.",
			"Complete a successful performance to collect First Take."
		)
		ui.button("My progress", function()
			showPage("progress")
		end, true)
	elseif page == "record" and row then
		ui.phase.Text = "BACKSTAGE   /   DAILY RECORD"
		copy(
			"Your Daily",
			if row.lastDaily > 0 then "Last Daily · " .. row.firstDailyScore else "Your Daily is open",
			string.format(
				"Current Daily streak · %d. The first successful Daily score counts.",
				row.dailyRun
			)
		)
		if not s.queued then
			ui.button("Play today's card", function()
				selectMode("Daily")
			end, true)
		end
		ui.button("My progress", function()
			showPage("progress")
		end)
	elseif page == "friends" then
		ui.phase.Text = "BACKSTAGE   /   FRIENDS"
		local total = if row then math.max(row.troupeTotal, row.weekly) else 0
		copy(
			"Troupe goal",
			string.format("%d / 50 weekly points", total),
			"Invite friends to play here. Join a friend's troupe before earning your first weekly points."
		)
		ui.button("Invite a friend", invite, true, "users")
		for _, other in Players:GetPlayers() do
			if other ~= player then
				ui.button("Join " .. other.DisplayName, function()
					act("troupe", other.UserId)
					notify("Checking troupe membership…")
				end)
			end
		end
		if s.alone then
			ui.button("Find a busier show", function()
				act("busier")
				notify("Looking for an open seat…")
			end)
		end
	elseif page == "shop" then
		ui.phase.Text = "BACKSTAGE   /   DRESSING ROOM"
		ui.kicker.Text = "WARDROBE"
		Shop.draw(
			ui,
			s,
			player,
			require(shared.Wardrobe),
			act,
			function()
				showPage("menu")
			end,
			shopPage,
			function(nextPage)
				shopPage = nextPage
				render(state)
			end
		)
	else
		copy("Progress", "Getting your standing…", "Your seat is ready while progression loads.")
	end
end

local function foleyHit(hits, index)
	return if hits then hits[tostring(index)] or hits[index] else nil
end
local function beatNow(s)
	local elapsed = 10 - (s.deadline - workspace:GetServerTimeNow())
	for i, beat in s.foley.beats do
		if not foleyHit(s.foley.hits, i) and not padPending[i] and elapsed <= beat.at + 1.15 then
			return i, beat, beat.at - elapsed
		end
	end
	return nil, nil, 0
end
local function padInput(pad)
	local s = state
	if not s.foley or s.phase ~= "take" or s.actor ~= player.UserId then
		return
	end
	local index, _, offset = beatNow(s)
	if not index then
		return
	end
	if offset > 1.15 then
		notify("Wait for GO before tapping.")
		return
	end
	padPending[index] = true
	act("foleyPad", { index = index, pad = pad })
	task.delay(0.5, function()
		if
			state.turn == s.turn
			and state.phase == "take"
			and state.foley
			and not foleyHit(state.foley.hits, index)
		then
			padPending[index] = nil
		end
	end)
end
local function cueLine(s)
	if s.mode == "Echo" and s.line then
		return Modes.beat(s.line.text)
	end
	return if s.line then s.line.text else "The next act is getting ready."
end
local function show(s, mine)
	local actor = Players:GetPlayerByUserId(s.actor)
	local house = s.actor == 0
	local cast = if mine then "YOU" elseif house then "FLIP" elseif actor then actor.DisplayName else "ON STAGE"
	ui.phase.Text = (phaseNames[s.phase] or "The show"):upper() .. "   /   " .. cast
	local padAct = s.mode == "Sound booth"
	local nextStep = {
		lobby = "A fresh card arrives next.",
		lineup = "The performer chooses whether to take this turn.",
		direct = if mine
			then "The selected direction appears on your card."
			else "Watch for the countdown to the take.",
		countdown = if mine
			then (if padAct
				then "Play the highlighted sound on GO."
				else "Perform the line when On air appears.")
			else "You can send a reaction during the performance.",
		take = if mine
			then "The audience predicts, then rates your performance."
			else "The audience ballot opens after the take.",
		read = "Voting opens next.",
		vote = "Flip announces the result.",
		host = "Watch for the score reveal.",
		reveal = "A fresh card is on its way.",
		intermission = "Another performer can take the stage.",
	}
	ui.nextCue.Text = nextStep[s.phase] or ""

	local cue = s.cue and (s.cue.label .. " · " .. s.cue.text) or ""
	copy(if mine then "Your cue card" else "On the card", cueLine(s), cue)
	if s.phase == "lineup" and mine then
		if padAct then
			copy(
				"Your stage invitation",
				"Ready on sound?",
				"Flip reads the story. You play Bell, Squeak and Thump on cue. Your microphone stays off."
			)
			button("Take the stage", "accept", "pads", true, "headphones")
		else
			copy(
				"Your stage invitation",
				"Ready for your line?",
				"Delivery listens to words and volume during your mic check and take. Nothing you say is kept."
			)
			button("Use my microphone", "accept", "mic", true, "mic")
			if s.studio then
				button("Try a scripted take", "accept", "rehearsal", false, "play")
			end
		end
		button("Pass this turn", "leave")
	elseif s.phase == "direct" then
		if not mine or (padAct and s.soloStage) then
			if s.directed then
				ui.note.Text = "Your choice is in · " .. s.cues[s.directed].label
			else
				ui.note.Text = if padAct
					then "Pick the sound cue sheet for this story."
					else "Choose how the performer should deliver this line."
				for i, c in s.cues do
					button(c.label, "direct", i, i == 1)
				end
			end
		else
			ui.note.Text = if padAct
				then "Read the story while the audience chooses your sound cues."
				else "Read ahead. The audience is choosing your acting direction."
		end
	elseif s.phase == "countdown" then
		ui.kicker.Text = if mine then "GET READY TO PERFORM" else "NEXT UP"
		ui.note.Text = if padAct then "Watch for the first sound cue." else cue
	elseif s.phase == "take" then
		if mine and padAct and s.foley then
			ui.kicker.Text = "SOUND BOOTH"
			for _, pad in { "Bell", "Squeak", "Thump" } do
				padButtons[pad] = ui.button(pad, function()
					padInput(pad)
				end, false, if pad == "Bell" then "bell" elseif pad == "Squeak" then "music" else "radio")
			end
		elseif mine then
			ui.kicker.Text = "SAY THIS LINE"
			if s.studio and not s.useMic then
				ui.note.Text = if fixtureTurn == s.turn
					then "Scripted performance in progress."
					else "Try the reading with a simulated voice sample."
				if fixtureTurn ~= s.turn then
					ui.button("Play scripted take", scripted, true, "play")
				end
			end
		elseif not s.reacted then
			ui.note.Text = if padAct
				then "React as the performer plays the sound cues."
				elseif house then "React to Flip's house reading."
				else "Send a reaction while they perform."
			for _, reaction in { "Rose", "Tomato", "Laugh", "Gasp" } do
				button(reaction, "react", reaction, reaction == "Rose")
			end
		end
	elseif s.phase == "read" and mine then
		if padAct then
			ui.note.Text = "Your sound cues are in. The audience votes next."
		elseif s.heard then
			ui.kicker.Text = "WHAT DELIVERY HEARD"
			ui.card.Text = s.heard
			ui.note.Text = if s.pace and s.relative
				then string.format(
					"%s%.1f words/sec · %.2f× your speaking level",
					if s.simulated then "Scripted · " else "",
					s.pace,
					s.relative
				)
				else "Your take goes to the audience."
		else
			ui.note.Text = "Reading this take. The audience votes next."
		end
	elseif s.phase == "vote" then
		if mine then
			ui.note.Text = "Your act is in. The room is voting."
		elseif not s.rated then
			ui.kicker.Text = "YOUR BALLOT"
			ui.note.Text = "How did this performance land?"
			for i, label in { "Warming up", "Got a smile", "That landed", "Encore!" } do
				button(label, "rate", 25 * i, i == 3)
			end
		else
			ui.note.Text = "Rating received. Flip reveals the score next."
		end
		if
			s.rated
			and s.duel
			and s.actor == s.duel.second
			and player.UserId ~= s.duel.first
			and not mine
			and not s.duelVoted
		then
			ui.note.Text = "Choose the winner of the face-off."
			button("First performer", "duelVote", 1, true)
			button("Second performer", "duelVote", 2)
		end
	elseif s.phase == "host" then
		copy("Flip · House host", s.hostLine or "The room has spoken.", "The score is coming up.")
	elseif s.phase == "reveal" or s.phase == "intermission" then
		local result = s.result
		if result then
			local stats = if padAct
				then string.format(
					"%d cues hit · %d perfect",
					result.foleyHits or 0,
					result.foleyPerfect or 0
				)
				elseif result.miss then "No words came through. You can try this card again."
				elseif s.simulated then "Studio rehearsal · simulated words and volume."
				else string.format(
					"Words %s · Commitment %s · Comedy %s · Chaos %s",
					tostring(result.accuracy or "—"),
					tostring(result.commitment or "—"),
					tostring(result.comedy or "—"),
					tostring(result.chaos or "—")
				)
			if s.lastAward and s.lastAward.turn == s.turn and s.lastAward.xp > 0 then
				stats = stats .. "  ·  +" .. s.lastAward.xp .. " " .. s.lastAward.role .. " XP"
			end
			copy(
				if mine then "Your result" else "Round result",
				if result.overall
					then string.format("%d   %s", result.overall, result.band)
					else "Take it again",
				stats
			)
			if mine and result.miss and not s.queued then
				button("Retry this card", "retake", nil, true, "play")
			elseif mine and s.encore and s.phase == "reveal" and not s.queued then
				button("Play the encore", "encore", nil, true, "play")
			end
			if mine and not s.queued and not result.miss and not (s.encore and s.phase == "reveal") then
				ui.button("Play again", function()
					queue(s.mode)
				end, true, "play")
			end
			if s.phase == "reveal" and (result.overall or 0) >= 75 then
				ui.button("Save show moment", function()
					Capture.reveal(notify)
				end)
			end
			if s.winner then
				local winner = Players:GetPlayerByUserId(s.winner)
				if winner then
					ui.kicker.Text = winner.DisplayName .. " wins the face-off"
				end
			end
		elseif s.honours and s.honours ~= "" then
			copy("Show honours", "Curtain call", s.honours)
		end
	end
	if not mine and (s.phase == "read" or (s.phase == "take" and s.reacted)) then
		if s.predicted then
			ui.note.Text = "Prediction locked. Rate the performance when voting opens."
		else
			ui.note.Text = (if s.reacted then s.reacted .. " sent. " else "")
				.. "Predict the final score for bonus crowd XP."
			for i, text in { "Under 60", "60–89", "90+" } do
				button(text, "predict", i, i == 2)
			end
		end
	end
	if mine and micNote ~= "" and (s.phase == "direct" or s.phase == "take") and not padAct then
		ui.note.Text = micNote
	end
	if not mine and not s.queued and (s.phase == "lobby" or s.phase == "intermission") then
		ui.button("Play with sound pads", function()
			queue("Sound booth")
		end, true, "headphones")
		ui.button("Perform a voice line", function()
			queue("Main stage")
		end, false, "mic")
	end
end
render = function(s)
	state = s
	local mine = s.actor == player.UserId
	local v = s.venue
	if v and (v.openRevision or 0) > openedRoomRevision then
		openedRoomRevision = v.openRevision
		if not mine then
			local destinations = {
				lobby = "explore",
				theatre = if v.watching then "show" else "explore",
				balcony = if v.watching then "show" else "explore",
				map = "map",
				studio = "studio",
				writers = "writers",
				warehouse = "warehouse",
				atelier = "atelier",
				pier = "pier",
				park = if v.outdoor
						and v.outdoor.kind == "park"
						and v.outdoor.status == "active"
					then "explore"
					else "park",
				market = if v.outdoor
						and v.outdoor.kind == "market"
						and v.outdoor.status == "active"
						and v.outdoor.target ~= "VenueMarket"
					then "explore"
					else "market",
			}
			page = destinations[v.open] or page
			shopPage = nil
			toast = ""
		end
	end
	local step = tostring(s.turn) .. "/" .. s.phase
	if phaseKey ~= step then
		phaseKey = step
		clockStart = workspace:GetServerTimeNow()
		toast = ""
		table.clear(padPending)
		if mine then
			page = "show"
		end
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
	local walking = page == "explore"
	local map = page == "map"
	local freeCamera = not mine
		and page ~= "welcome"
		and page ~= "show"
		and (walking or not v or not v.watching)
	fx.update(
		s,
		(page == "menu" or page == "record") and not mine and not freeCamera,
		false,
		freeCamera,
		page == "welcome"
	)
	game:GetService("GuiService").TouchControlsEnabled = walking
	local offstage = page ~= "show"
	ui.begin(if offstage then page .. (shopPage or "") else step, offstage)
	ui.panel.Visible = not walking and not map
	table.clear(padButtons)
	ui.nav.Visible = page ~= "welcome" and not map and not (mine and s.phase == "lineup")
	ui.navMenu.Visible = not mine
	ui.navMenu.Text = if walking
		then "Map"
		elseif offstage then (if v and not v.watching then "Walk" else "Show")
		else "Menu"
	ui.navRole.Visible = not offstage or walking
	ui.navRole.Text = if mine
		then "Leave stage"
		elseif s.queued then "Leave queue #" .. s.queued
		elseif walking then "Live show"
		else "Perform"
	local compactWalk = walking and ui.gui.AbsoluteSize.X < 500
	local roleWidth = if compactWalk then 88 else 124
	ui.navRole.Size = UDim2.fromOffset(roleWidth, 44)
	ui.navMenu.Size = UDim2.fromOffset(if compactWalk then 48 else 80, 44)
	ui.nav.Size = UDim2.fromOffset(
		if offstage and not walking then 84 elseif mine then 128 elseif compactWalk then 142 else 210,
		48
	)
	ui.navMenu.Position = UDim2.fromOffset(if offstage and not walking then 2 else roleWidth + 4, 2)
	guide.setView(page, s)
	if not guide.draw(page, s) then
		if offstage then
			menu(s)
		else
			show(s, mine)
		end
	end
	if toast ~= "" and os.clock() < toastUntil then
		ui.note.Text = toast
	end
	ui.finish()
	ui.clock(
		if offstage then nil else math.max(0, s.deadline - workspace:GetServerTimeNow()),
		s.deadline - clockStart
	)
end
ui.navRole.Activated:Connect(function()
	if not state or (page ~= "show" and page ~= "explore") then
		return
	end
	if state.actor == player.UserId then
		act("leave")
	elseif state.queued then
		act("leave")
		notify("Leaving the queue…")
	elseif page == "explore" then
		showPage("welcome")
	else
		showPage("modes")
	end
end)
ui.navMenu.Activated:Connect(function()
	if not state then
		return
	end
	if page == "explore" then
		showPage("map")
	elseif page ~= "show" then
		showPage("return")
	elseif state.actor ~= player.UserId then
		showPage("menu")
	else
		notify("Backstage opens when your turn ends.")
	end
end)
player:GetAttributeChangedSignal("LatestPlaybill"):Connect(function()
	if page == "shop" and state then
		render(state)
	end
end)
player:GetAttributeChangedSignal("RoomFinder"):Connect(function()
	if page == "friends" then
		notify(player:GetAttribute("RoomFinder") or "Room search complete.")
	end
end)
stage.OnClientEvent:Connect(render)
stage:FireServer("sync", 0)
task.spawn(function()
	while ui.panel.Parent do
		local s = state
		if s then
			guide.tick(page, s)
		end
		if s and page == "show" then
			local remaining = math.max(0, s.deadline - workspace:GetServerTimeNow())
			ui.clock(remaining, s.deadline - clockStart)
			if s.phase == "take" and s.actor == player.UserId then
				if s.foley then
					local i, beat, offset = beatNow(s)
					local go = beat ~= nil and offset <= 0.18
					if beat then
						ui.card.Text = if go
							then "GO  ·  " .. beat.pad
							else string.format("%s in %.1fs", beat.pad, offset)
						ui.kicker.Text = "SOUND CUE " .. i .. " / " .. #s.foley.beats
					else
						ui.card.Text = "Sound cues complete"
						ui.kicker.Text = "SOUND BOOTH"
					end
					local last = s.foley.last
					ui.note.Text = if i
							and i > 1
							and not foleyHit(s.foley.hits, i - 1)
						then "Last cue missed. Watch the next countdown."
						elseif last then last.pad .. " · " .. last.label
						elseif i and i > 1 then "Last cue missed. Watch the next countdown."
						else "Press the matching pad as it lights up."
					for pad, b in padButtons do
						local active = go and beat.pad == pad
						b.BackgroundColor3 = if active
							then Color3.fromRGB(255, 207, 107)
							else Color3.fromRGB(63, 47, 80)
						b.TextColor3 = if active
							then Color3.fromRGB(26, 22, 36)
							else Color3.fromRGB(251, 240, 221)
					end
				elseif s.mode == "Switch" then
					local index = math.clamp(1 + math.floor((10 - remaining) / 2.5), 1, 4)
					ui.note.Text = "Cue "
						.. index
						.. "/4 · "
						.. Modes.switchCues[index]
						.. "  —  repeat the phrase."
				end
			end
		end
		task.wait(0.1)
	end
end)
