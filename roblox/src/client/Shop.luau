--!strict
local Market = game:GetService("MarketplaceService")
local souvenir = require(game:GetService("ReplicatedStorage").Delivery.Programme)
-- Dressing room: cosmetic stage looks (game passes) and the dated playbill souvenir.
-- Purchases always go through Roblox's own prompt; Studio sessions get free previews.
local Shop = {}
function Shop.draw(ui, s, player, items, act, close, page, selectPage)
	if page == souvenir.name then
		ui.kicker.Text = "SOUVENIR SHELF"
		ui.card.Text = "Tonight's dated playbill"
		local latest = player:GetAttribute("LatestPlaybill")
		ui.note.Text = if latest
			then "Latest issue · " .. latest
			else "A dated souvenir from the show. Your latest issue stays on this shelf."
		ui.button(if s.studio then "Simulate a purchase" else "See playbill price", function()
			if s.studio then
				act("playbillPreview")
			else
				pcall(Market.PromptProductPurchase, Market, player, souvenir.productId)
			end
		end, true, "book-open")
	elseif page then
		for _, item in items do
			if item.key == page then
				ui.kicker.Text = if s.skin == item.key then "EQUIPPED STAGE LOOK" else "STAGE LOOK"
				ui.card.Text = item.name
				ui.note.Text = item.detail
				if s.studio then
					ui.button("Try it on", function()
						act("stylePreview", item.key)
					end, true, "award")
				else
					ui.button(if s.skin == item.key then "Equipped" else "Wear owned look", function()
						act("style", item.key)
					end, true, "award")
					ui.button("See pass price", function()
						pcall(Market.PromptGamePassPurchase, Market, player, item.passId)
					end)
				end
				break
			end
		end
	else
		ui.kicker.Text = "WARDROBE"
		ui.card.Text = "Dressing room"
		ui.note.Text = if s.studio
			then "Studio previews are free and last for this session."
			else "Wearing · " .. (s.skin or "House lights") .. ". Pick a look to try."
		ui.button("Back to backstage", close, true, "play")
		for _, item in items do
			if s.studio or item.passId > 0 then
				ui.button(item.name, function()
					selectPage(item.key)
				end, false, if s.skin == item.key then "award" else nil)
			end
		end
		if s.studio or souvenir.productId > 0 then
			ui.button(souvenir.name, function()
				selectPage(souvenir.name)
			end, false, "book-open")
		end
		return
	end
	ui.button("Back to the rail", function()
		selectPage(nil)
	end)
end
return Shop
