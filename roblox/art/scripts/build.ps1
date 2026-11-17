$ErrorActionPreference='Stop'
& blender -b -t 2 -P (Join-Path $PSScriptRoot 'theatre.py') --python-exit-code 1
if ($LASTEXITCODE) { throw 'Blender export failed' }
