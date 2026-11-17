--!strict
local ShopCatalogue = if script then require(script.Parent.ShopCatalogue) else require("./ShopCatalogue")
local Venues = {}
Venues.order =
	{ "lobby", "theatre", "studio", "writers", "warehouse", "atelier", "balcony", "pier", "park", "market" }
Venues.rooms = {
	pier = {
		title = "Waterfront Pier",
		anchor = "VenuePier",
		x = -122,
		z = 74,
		action = "Work the buoy crane",
	},
	park = {
		title = "Signal Park",
		anchor = "VenuePark",
		x = 126.6,
		z = 90.6,
		action = "Enter the signal circuit",
	},
	market = {
		title = "Night Market",
		anchor = "VenueMarket",
		x = 0,
		z = 171,
		action = "Use the wrapping counter",
	},
	lobby = { title = "Broadcast Plaza", anchor = "VenueLobby", x = 0, z = 62, action = "Open venue map" },
	theatre = {
		title = "Main Theatre",
		anchor = "VenueTheatre",
		x = 0,
		z = 24,
		action = "Take an audience seat",
	},
	studio = { title = "Studio B", anchor = "VenueStudioB", x = -51, z = 53, action = "Start a sound drill" },
	writers = {
		title = "Writers’ Room",
		anchor = "VenueWriters",
		x = -51,
		z = 89,
		action = "Write a cue card",
	},
	warehouse = {
		title = "Props Warehouse",
		anchor = "VenueWarehouse",
		x = 51,
		z = 53,
		action = "Use dispatch desk",
	},
	atelier = {
		title = "Costume Atelier",
		anchor = "VenueAtelier",
		x = 51,
		z = 89,
		action = "Enter fitting room",
	},
	balcony = {
		title = "Critics’ Balcony",
		anchor = "VenueBalcony",
		x = 0,
		z = 118,
		action = "Watch the show",
	},
}
local shopOrder = { "post", "records", "cafe", "gallery" }
for _, id in shopOrder do
	table.insert(Venues.order, id)
	Venues.rooms[id] = ShopCatalogue.shops[id]
end
Venues.props = { Bell = "PropBell", Lantern = "PropLantern", Hat = "PropHat" }
Venues.looks = {
	house = { name = "House lights", index = 1 },
	apricot = { name = "Apricot follow spot", index = 2 },
	cobalt = { name = "Cobalt studio mic", index = 3, badge = "sound-technician" },
	cherry = { name = "Cherry cue stand", index = 4, badge = "prop-runner" },
}
function Venues.zone(x: number, z: number, y: number): string
	for _, id in shopOrder do
		local room = Venues.rooms[id]
		if math.abs(x - room.x) <= 9 and math.abs(z - room.z) <= 9 then
			return id
		end
	end
	if x >= 87 and x <= 164 and z >= 39 and z <= 111 then
		return "park"
	end
	if x <= -85 and x >= -165 and z >= 41 and z <= 109 then
		return "pier"
	end
	if math.abs(x) <= 34 and z >= 145 and z <= 209 then
		return "market"
	end
	if math.abs(x) <= 32 and z >= -28 and z <= 30 then
		return "theatre"
	end
	if math.abs(x) <= 30 and z >= 103 and z <= 140 and y >= 4 then
		return "balcony"
	end
	for _, key in { "studio", "writers", "warehouse", "atelier" } do
		local room = Venues.rooms[key]
		if math.abs(x - room.x) <= 19 and math.abs(z - room.z) <= 16 then
			return key
		end
	end
	return "lobby"
end
-- A fresh visitor arrives in Broadcast Plaza facing the theatre doors. Venue falls back to the older
-- ParkArrival anchor when a place file predates PlazaArrival.
Venues.firstArrival = "PlazaArrival"
Venues.fallbackArrival = "ParkArrival"
function Venues.arrival(room, openRevision)
	if openRevision == 0 and (room == "lobby" or room == "park") then
		return Venues.firstArrival
	end
	return Venues.rooms[room].anchor
end
function Venues.lookAt(index)
	for key, look in Venues.looks do
		if look.index == index then
			return key
		end
	end
	return "house"
end
return Venues
