--!strict
local Market = game:GetService("MarketplaceService")
local souvenir = require(game:GetService("ReplicatedStorage").Delivery.Programme)
local Shop = {}
function Shop.draw(ui, s, player, items, act, close, page, selectPage)
	if page == souvenir.name then
		ui.card.Text = "Delivery  /  Dated playbill"
		local latest = player:GetAttribute("LatestPlaybill")
		ui.note.Text = if latest
			then "Latest issue · " .. latest
			else "A dated souvenir from the show. Your latest issue stays on this shelf."
		ui.button(if s.studio then "Simulate a purchase" else "View playbill price", function()
			if s.studio then
				act("playbillPreview")
			else
				pcall(Market.PromptProductPurchase, Market, player, souvenir.productId)
			end
		end, true)
	elseif page then
		for _, item in items do
			if item.key == page then
				ui.card.Text = item.name
				ui.note.Text = if s.skin == item.key then "Equipped · " .. item.detail else item.detail
				if s.studio then
					ui.button("Try in Studio", function()
						act("stylePreview", item.key)
					end, true)
				else
					ui.button("Equip owned pass", function()
						act("style", item.key)
					end, true)
					ui.button("View pass price", function()
						pcall(Market.PromptGamePassPurchase, Market, player, item.passId)
					end)
				end
				break
			end
		end
	else
		ui.card.Text = "Dressing room"
		ui.note.Text = if s.studio
			then "Studio previews are free and last for this session."
			else "Equipped · " .. (s.skin or "House lights")
		ui.button("Back to backstage", close, true)
		for _, item in items do
			if s.studio or item.passId > 0 then
				ui.button(item.name, function()
					selectPage(item.key)
				end)
			end
		end
		if s.studio or souvenir.productId > 0 then
			ui.button(souvenir.name, function()
				selectPage(souvenir.name)
			end)
		end
		return
	end
	ui.button("Back to dressing room", function()
		selectPage(nil)
	end)
end
return Shop
