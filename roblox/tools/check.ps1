$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try {
    python tools/import.py --check
    if ($LASTEXITCODE) { throw 'Catalogue failed' }
    & ./.tools/lune.exe run tests/run
    if ($LASTEXITCODE) { throw 'Pure logic tests failed' }
    & ./.tools/stylua.exe --check src tests
    if ($LASTEXITCODE) { throw 'Format failed' }
    & ./.tools/selene.exe src tests
    if ($LASTEXITCODE) { throw 'Lint failed' }
    & ./tools/build.ps1
} finally { Pop-Location }
