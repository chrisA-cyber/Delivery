$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'build-qa.ps1') -Scenario 'campus'
