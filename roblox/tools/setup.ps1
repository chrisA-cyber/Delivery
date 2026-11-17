# Fetch pinned Windows x64 tools and verify each archive against its release digest.
$ErrorActionPreference = 'Stop'
$dest = Join-Path $PSScriptRoot '../.tools'
New-Item -ItemType Directory -Force $dest | Out-Null
$releases = @(
    @('rojo-rbx/rojo','v7.7.1','rojo-7.7.1-windows-x86_64.zip','rojo'),
    @('lune-org/lune','v0.11.1','lune-0.11.1-windows-x86_64.zip','lune'),
    @('Kampfkarren/selene','0.32.0','selene-0.32.0-windows.zip','selene'),
    @('JohnnyMorganz/StyLua','v2.6.0','stylua-windows-x86_64.zip','stylua')
)
foreach ($release in $releases) {
    $repo,$tag,$archive,$tool = $release
    $metadata = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/tags/$tag"
    $asset = $metadata.assets | Where-Object name -eq $archive
    if (-not $asset -or $asset.digest -notmatch '^sha256:[0-9a-f]{64}$') { throw "Missing digest for $tool" }
    $zip = Join-Path $dest $archive
    Invoke-WebRequest $asset.browser_download_url -OutFile $zip
    if (('sha256:' + (Get-FileHash $zip).Hash.ToLowerInvariant()) -ne $asset.digest) { throw "Checksum failed for $tool" }
    Expand-Archive $zip (Join-Path $dest $tool) -Force
    $exe = Get-ChildItem (Join-Path $dest $tool) -Recurse -Filter "$tool.exe" | Select-Object -First 1
    Copy-Item $exe.FullName (Join-Path $dest "$tool.exe") -Force
    & (Join-Path $dest "$tool.exe") --version
}
