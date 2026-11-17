--!strict
-- Nil-safe read of ReplicatedStorage.ShowStatus for town UI (ticket stub, map badge).
local Storage = game:GetService("ReplicatedStorage")
local GuideShow = {}

export type Status = {
	live: boolean, -- a round is on stage right now
	soon: boolean, -- performer is being invited
	curtain: boolean, -- between acts
	phase: string,
	format: string,
	performer: string,
	endsAt: number,
}

local live = {
	direct = true,
	countdown = true,
	take = true,
	read = true,
	vote = true,
	host = true,
	reveal = true,
}

local folder: Instance? = nil
local changed = Instance.new("BindableEvent")
GuideShow.changed = changed.Event

local function attach(found: Instance)
	folder = found
	found.AttributeChanged:Connect(function(name)
		if name == "Phase" or name == "Format" or name == "Performer" or name == "House" then
			changed:Fire()
		end
	end)
	changed:Fire()
end

task.spawn(function()
	local found = Storage:FindFirstChild("ShowStatus") or Storage:WaitForChild("ShowStatus", 120)
	if found then
		attach(found)
	else
		local connection: RBXScriptConnection? = nil
		connection = Storage.ChildAdded:Connect(function(child)
			if child.Name == "ShowStatus" and not folder then
				if connection then
					connection:Disconnect()
				end
				attach(child)
			end
		end)
	end
end)

local function text(name: string): string
	local value = folder and folder:GetAttribute(name)
	return if type(value) == "string" then value else ""
end

function GuideShow.read(): Status
	local phase = text("Phase")
	local endsAt = folder and folder:GetAttribute("PhaseEndsAt")
	return {
		live = live[phase] == true,
		soon = phase == "lineup",
		curtain = phase == "intermission",
		phase = phase,
		format = text("Format"),
		performer = text("Performer"),
		endsAt = if type(endsAt) == "number" then endsAt else 0,
	}
end

-- One short line for buttons and cards, e.g. "On now · Sound booth".
function GuideShow.line(): string
	local s = GuideShow.read()
	if s.live then
		return if s.format ~= "" then "On now · " .. s.format else "On now"
	elseif s.soon then
		return "Next act is about to start"
	elseif s.curtain then
		return "Curtain call · next act soon"
	end
	return "Seats open · join the audience"
end
return GuideShow
