--!strict
local CaptureService = game:GetService("CaptureService")
local Capture = {}
local busy = false
function Capture.reveal(message)
	if busy then
		return
	end
	busy = true
	task.spawn(function()
		local ok, result = pcall(function()
			return CaptureService:StartVideoCaptureAsync(function(status, capture)
				busy = false
				if status == Enum.VideoCaptureResult.Success and capture then
					pcall(function()
						CaptureService:PromptSaveCapturesToGallery({ capture }, function() end)
					end)
				end
			end)
		end)
		if not ok or result ~= Enum.VideoCaptureStartedResult.Success then
			busy = false
			message("Video capture is unavailable here.")
			return
		end
		task.delay(3, function()
			if busy then
				pcall(function()
					CaptureService:StopVideoCapture()
				end)
			end
		end)
	end)
end
return Capture
