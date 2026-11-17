$ErrorActionPreference='Stop'
& blender -b -t 2 --python-exit-code 1 -P (Join-Path $PSScriptRoot 'theatre.py')
if ($LASTEXITCODE) { throw 'Blender export failed' }
