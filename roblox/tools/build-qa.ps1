param([ValidateSet('show','campus')][string]$Scenario='show')
$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
$file = Join-Path (Get-Location) ('.delivery-qa-'+$Scenario+'.project.json')
$fixture = if ($Scenario -eq 'campus') { 'tests/campus' } else { 'tests/studio' }
$output = if ($Scenario -eq 'campus') { 'build/Delivery-CampusQA.rbxl' } else { 'build/Delivery-QA.rbxl' }
try {
    & ./tools/build.ps1
    $project = Get-Content -Raw default.project.json | ConvertFrom-Json -AsHashtable
    $project.tree.ServerScriptService.Observer = @{ '$path' = ($fixture + '/Observer.server.luau') }
    $project.tree.StarterPlayer.StarterPlayerScripts.Driver = @{ '$path' = ($fixture + '/Driver.client.luau') }
    $project | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $file -Encoding utf8NoBOM
    & ./.tools/rojo.exe build $file -o $output
    if ($LASTEXITCODE) { throw 'QA place build failed' }
} finally {
    if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file }
    Pop-Location
}
