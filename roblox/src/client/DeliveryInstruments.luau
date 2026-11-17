--!strict
local SoundService = game:GetService("SoundService")
local Debris = game:GetService("Debris")
local ids = require(game:GetService("ReplicatedStorage").Delivery.SoundIds)
local kit = {
	C = "volume_slider.ogg",
	S = "action_jump.mp3",
	K = "action_jump_land.mp3",
	T = "action_footsteps_plastic.mp3",
}
-- Each row sets onset seconds, sample, playback speed, gain, and optional gate time.
local scores = {
	Bell = { { 0, "C", 1.55, 0.58 }, { 0.045, "C", 2.32, 0.17 } },
	Squeak = { { 0, "S", 1.32, 0.67 }, { 0.075, "S", 1.95, 0.34 } },
	Thump = { { 0, "K", 0.73, 0.80 }, { 0.022, "T", 0.70, 0.33, 0.12 } },
	places = { { 0, "C", 0.95, 0.65 }, { 0.11, "C", 1.2, 0.65 }, { 0.24, "C", 1.42, 0.80 } },
	reveal = {
		{ 0, "K", 0.9, 0.4 },
		{ 0, "C", 0.90, 0.70 },
		{ 0.11, "C", 1.14, 0.67 },
		{ 0.22, "C", 1.35, 0.68 },
		{ 0.39, "C", 1.80, 0.84 },
		{ 0.40, "C", 1.35, 0.27 },
	},
	roll = {
		{ 0, "T", 1.1, 0.44, 0.07 },
		{ 0.10, "T", 1.15, 0.52, 0.07 },
		{ 0.20, "T", 1.2, 0.60, 0.07 },
		{ 0.28, "T", 1.25, 0.68, 0.06 },
		{ 0.36, "T", 1.3, 0.78, 0.06 },
		{ 0.44, "K", 1.2, 0.51 },
	},
	applause = {
		{ 0, "T", 1.3, 0.52, 0.10 },
		{ 0.065, "K", 1.65, 0.42 },
		{ 0.13, "T", 1.55, 0.67, 0.09 },
		{ 0.20, "K", 1.45, 0.38 },
		{ 0.27, "T", 1.3, 0.42, 0.09 },
	},
	chuckle = { { 0, "S", 1.76, 0.45 }, { 0.11, "S", 1.57, 0.38 }, { 0.24, "S", 1.34, 0.38 } },
}
local templates = {}
for name, file in kit do
	local sound = Instance.new("Sound")
	sound.Name = "Delivery_" .. name
	sound.SoundId = "rbxasset://sounds/" .. file
	templates[name] = sound
end
task.spawn(function()
	local assets = {}
	for _, sound in templates do
		table.insert(assets, sound)
	end
	pcall(function()
		game:GetService("ContentProvider"):PreloadAsync(assets)
	end)
end)
local function sequence(kind: string, volume: number)
	local hits = scores[kind]
	if not hits then
		return
	end
	for _, hit in hits do
		task.delay(hit[1], function()
			local sound = templates[hit[2]]:Clone()
			sound.Volume = volume * hit[4]
			sound.PlaybackSpeed = hit[3]
			sound.Parent = SoundService
			sound:Play()
			Debris:AddItem(sound, hit[5] or 1.5)
		end)
	end
end
local Instruments = {}
function Instruments.strike(pad: string)
	if pad ~= "Bell" and pad ~= "Squeak" and pad ~= "Thump" then
		return
	end
	local asset = ids[pad]
	if asset and asset > 0 then
		local sound = Instance.new("Sound")
		sound.Name = "Foley_" .. pad
		sound.SoundId = "rbxassetid://" .. asset
		sound.Volume = 0.62
		sound.Parent = SoundService
		sound:Play()
		Debris:AddItem(sound, 3)
	else
		sequence(pad, 0.70)
	end
end
function Instruments.sting(kind: string, volume: number)
	sequence(kind, math.clamp(volume, 0, 1))
end
return Instruments
