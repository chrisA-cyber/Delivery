--!strict
local Catalogue = {}
Catalogue.shops = {
	post = {
		title = "Dockside Post",
		anchor = "VenuePost",
		x = -87,
		z = 56,
		action = "Open parcel counter",
		counter = "postDeliveries",
		badge = "town-carrier",
	},
	records = {
		title = "Needle Drop Records",
		anchor = "VenueRecords",
		x = 85,
		z = 90,
		action = "Use listening deck",
		counter = "recordSides",
		badge = "crate-digger",
	},
	cafe = {
		title = "Copper Kettle Bakehouse",
		anchor = "VenueCafe",
		x = -52,
		z = 121,
		action = "Read order ticket",
		counter = "cafeOrders",
		badge = "counter-crew",
	},
	gallery = {
		title = "Pocket Print Gallery",
		anchor = "VenueGallery",
		x = 52,
		z = 130,
		action = "Use postcard press",
		counter = "galleryPrints",
		badge = "town-printmaker",
	},
}
Catalogue.parcels = {
	{ label = "First pressing in a striped sleeve", recipient = "records" },
	{ label = "A tin of orange blossom peel", recipient = "cafe" },
	{ label = "Blue ink from the harbour press", recipient = "gallery" },
	{ label = "Grand opening invitation", recipient = "cafe" },
	{ label = "Three lantern-market negatives", recipient = "gallery" },
	{ label = "Signal Park field recording", recipient = "records" },
}
Catalogue.sounds = { "Bell", "Thump", "Squeak" }
Catalogue.records = {
	{ name = "Last Tram Home", notes = { "Bell", "Thump", "Bell" } },
	{ name = "The Turnstile", notes = { "Squeak", "Thump", "Bell", "Thump" } },
	{ name = "Lantern Parade", notes = { "Bell", "Bell", "Squeak", "Thump", "Bell" } },
	{ name = "Coffee Break", notes = { "Thump", "Squeak", "Squeak" } },
	{ name = "Harbour Shuffle", notes = { "Thump", "Bell", "Thump", "Squeak" } },
	{ name = "The Encore", notes = { "Squeak", "Bell", "Thump", "Thump", "Bell" } },
}
Catalogue.recipes = {
	{
		name = "Honey cloud",
		recipe = { "Brioche", "Honey", "Cream" },
		choices = {
			"Honey",
			"Cream",
			"Brioche",
			"Cinnamon",
		},
	},
	{
		name = "Dockside swirl",
		recipe = { "Croissant", "Chocolate", "Cinnamon" },
		choices = { "Cinnamon", "Berry jam", "Croissant", "Chocolate" },
	},
	{
		name = "Lantern cocoa",
		recipe = { "Cocoa", "Cream", "Orange peel" },
		choices = { "Cream", "Cocoa", "Honey", "Orange peel" },
	},
	{
		name = "Market morning",
		recipe = { "Brioche", "Berry jam", "Orange peel" },
		choices = { "Chocolate", "Orange peel", "Berry jam", "Brioche" },
	},
	{
		name = "Signal roll",
		recipe = { "Croissant", "Honey", "Cinnamon" },
		choices = { "Cinnamon", "Honey", "Cream", "Croissant" },
	},
	{
		name = "Midnight cocoa",
		recipe = { "Cocoa", "Chocolate", "Cream" },
		choices = { "Cream", "Orange peel", "Cocoa", "Chocolate" },
	},
}
Catalogue.layers = { "Skyline", "Ink", "Greeting" }
Catalogue.palette = {
	{ "Harbour crane", "Signal gazebo", "Lantern market" },
	{ "Sea glass", "Cherry red", "Midnight blue" },
	{ "Wish you were here!", "Meet me at curtain call.", "Greetings from Signal Park!" },
}
function Catalogue.encode(picks)
	local n = 0
	for i, palette in Catalogue.palette do
		local choice = table.find(palette, picks[i])
		if not choice then
			return nil
		end
		n = n * #palette + choice - 1
	end
	return n + 1
end
function Catalogue.print(code)
	if type(code) ~= "number" or code % 1 ~= 0 or code < 1 or code > 27 then
		return nil
	end
	local index = code - 1
	local picks = {}
	for i = #Catalogue.palette, 1, -1 do
		local palette = Catalogue.palette[i]
		picks[i] = palette[index % #palette + 1]
		index = math.floor(index / #palette)
	end
	return { scene = picks[1], ink = picks[2], greeting = picks[3] }
end
return Catalogue
