--!strict
local Market = game:GetService("MarketplaceService")
local Shop = {}
function Shop.draw(ui, s, player, items, act, close)
	ui.card.Text = "Dressing room"
	ui.note.Text = if s.studio
		then "Studio previews are free and last for this session."
		else "Choose a stage cosmetic. Equipped: " .. (s.skin or "House lights")
	ui.button("Back to backstage", close, true)
	for _, item in items do
		if s.studio or item.passId > 0 then
			ui.button(item.name, function()
				ui.clear()
				ui.card.Text = item.name
				ui.note.Text = item.detail
				if s.studio then
					ui.button("Try in Studio", function()
						act("stylePreview", item.key)
						close()
					end, true)
				else
					ui.button("Equip owned pass", function()
						act("style", item.key)
						close()
					end, true)
					ui.button("View pass price", function()
						pcall(Market.PromptGamePassPurchase, Market, player, item.passId)
					end)
				end
				ui.button("Back", close)
			end)
		end
	end
end
return Shop
