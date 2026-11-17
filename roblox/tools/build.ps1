$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try {
    if (-not (Test-Path .tools/rojo.exe)) { & ./tools/setup.ps1 }
    if (Test-Path tools/import.py) {
        python tools/import.py --check
        if ($LASTEXITCODE) { throw 'Catalogue validation failed' }
    }
    New-Item -ItemType Directory -Force build | Out-Null
    & ./.tools/rojo.exe build default.project.json -o build/Delivery.rbxl
    if ($LASTEXITCODE) { throw 'Place build failed' }
} finally { Pop-Location }
