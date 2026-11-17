--!strict
-- Every audio cue the game plays, by key. 0 keeps a cue silent: the show and pads fall back to their built-in
-- sketches, and the ambience skips the cue (a few one-shots use engine sounds instead). Fill in uploaded Roblox
-- asset ids (numbers). A string such as "rbxasset://sounds/impact_water.mp3" is also accepted by the ambience.
return {
	-- Show stings and the three Foley pads (original WAV masters in art/sound).
	places = 1841800152,
	reveal = 0,
	applause = 9113137785,
	roll = 0,
	chuckle = 0,
	Bell = 0,
	Squeak = 0,
	Thump = 0,

	-- Ambient beds: seamless loops, non-positional, cross-faded by where the camera is.
	AmbTownAir = 0, -- quiet evening air under everything outdoors
	AmbHarbour = 9112751378, -- waves on pilings, rigging, Waterfront Pier
	AmbStreet = 9112772284, -- soft city hum and distant traffic, Lantern Street and the plaza
	AmbMarket = 9112841064, -- relaxed crowd murmur, Night Market
	AmbPark = 9113444360, -- evening birdsong and crickets, Signal Park
	AmbClockCourt = 0, -- small fountain trickle in a stone court, Clock Court
	MusicTown = 9045469754, -- gentle lounge/jazz loop under the whole town

	-- Spot loops: positional, placed in the world.
	MusicMarket = 0, -- busker accordion/guitar at the Night Market
	ClockTick = 0, -- tower clock tick-tock, Clock Court
	TheatreSpill = 9048285483, -- muffled show music and crowd through the theatre doors while a round is live
	AmbTramRun = 0, -- streetcar motor hum and rail clatter while moving
	ShopPost = 0, -- Dockside Post room tone
	ShopRecords = 1842610926, -- Needle Drop Records: a record playing on the shop hi-fi
	ShopBakery = 0, -- Copper Kettle: oven crackle, cups, kettle
	ShopGallery = 0, -- Pocket Prints: quiet gallery with a print press

	-- One-shots.
	AmbGulls = 0, -- one or two gull calls over the harbour
	TramBell = 0, -- streetcar "ding-ding" bell at a stop
	DoorChime = 0, -- shop door bell on entering a shop
	TheatreLaugh = 0, -- a wave of audience laughter heard through the doors
	TheatreApplause = 9113137785, -- audience applause heard through the doors

	-- Town errands and transitions.
	stamp = 9118833449, -- parcel pickup stamp
	chime = 0, -- errand complete chime (built-in fallback)
	whoosh = 9114159642, -- curtain wipe into and out of the show camera

	-- Score landing stingers (StageJuice) by band, plus small show effects.
	stingTop = 9047103106, -- 90+: big brass button
	stingHigh = 9045295141, -- 75-89: funky retro talk-show brass
	stingMid = 1841800152, -- 60-74: hot trot sting
	stingLow = 9041915227, -- under 60: quirky waltz sting
	stingMiss = 0, -- a miss: built-in stand-in
	scoreTick = 0, -- score counter tick
	confetti = 0, -- confetti pop
	padPerfect = 0, -- chime on a Perfect pad hit

	-- Street life.
	CrewBlip = 0, -- soft robot speech blip (silent until assigned)
	HouseCheer = 9113137785, -- house-crowd clapping then applause at a reveal
	ConfettiPop = 0, -- party popper for the town encore
}
