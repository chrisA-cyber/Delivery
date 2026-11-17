$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
$file = Join-Path (Get-Location) '.delivery-qa.project.json'
try {
    & ./tools/build.ps1
    $project = Get-Content -Raw default.project.json | ConvertFrom-Json -AsHashtable
    $project.tree.ServerScriptService.Observer = @{ '$path' = 'tests/studio/Observer.server.luau' }
    $project.tree.StarterPlayer.StarterPlayerScripts.Driver = @{ '$path' = 'tests/studio/Driver.client.luau' }
    $project | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $file -Encoding utf8NoBOM
    & ./.tools/rojo.exe build $file -o build/Delivery-QA.rbxl
    if ($LASTEXITCODE) { throw 'QA place build failed' }
} finally {
    if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file }
    Pop-Location
}
