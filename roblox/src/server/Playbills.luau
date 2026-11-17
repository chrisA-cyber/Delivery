--!strict
-- Each platform receipt is its own collectible. Retried receipts keep their original stamp.
local Playbills = {}
function Playbills.stamp(store, receipt: string, time: number)
	return store:UpdateAsync(receipt, function(existing)
		return existing or time
	end)
end
function Playbills.start(catalogue)
	local players = game:GetService("Players")
	local market = game:GetService("MarketplaceService")
	local db = game:GetService("DataStoreService")
	local studio = game:GetService("RunService"):IsStudio()
	local function archive(id: number)
		return db:GetOrderedDataStore("DeliveryPlaybills_v1", tostring(id))
	end
	local function display(p, value)
		if p and p.Parent == players then
			p:SetAttribute("LatestPlaybill", os.date("!%d %b %Y  %H:%M UTC", value))
		end
	end
	if not studio and catalogue.productId > 0 then
		market.ProcessReceipt = function(receipt)
			if receipt.ProductId ~= catalogue.productId then
				return Enum.ProductPurchaseDecision.NotProcessedYet
			end
			local ok, value = pcall(function()
				return Playbills.stamp(archive(receipt.PlayerId), receipt.PurchaseId, os.time())
			end)
			if not ok or not value then
				return Enum.ProductPurchaseDecision.NotProcessedYet
			end
			display(players:GetPlayerByUserId(receipt.PlayerId), value)
			return Enum.ProductPurchaseDecision.PurchaseGranted
		end
	end
	local function load(p)
		if studio or catalogue.productId <= 0 then
			return
		end
		local ok, rows = pcall(function()
			return archive(p.UserId):GetSortedAsync(false, 1):GetCurrentPage()
		end)
		if ok and rows[1] then
			display(p, rows[1].value)
		end
	end
	local function preview(p)
		if not studio then
			return
		end
		local store = {
			UpdateAsync = function(_, _, fn)
				return fn(nil)
			end,
		}
		display(p, Playbills.stamp(store, "local-fixture", os.time()))
	end
	return { load = load, preview = preview }
end
return Playbills
