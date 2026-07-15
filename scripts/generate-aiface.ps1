param(
  [Parameter(Mandatory = $true)]
  [string]$Source,
  [int]$Count = 300,
  [int]$Seed = 20260715
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$outputRoot = Join-Path $projectRoot "assets\aiface"
$dataFile = Join-Path $projectRoot "aiface-data.js"

if (-not (Test-Path -LiteralPath $Source)) {
  throw "Source path does not exist: $Source"
}

$extensions = @(".jpg", ".jpeg", ".png", ".webp")
$sourceRoot = (Resolve-Path -LiteralPath $Source).Path
$projectFullPath = (Resolve-Path -LiteralPath $projectRoot).Path

$images = Get-ChildItem -LiteralPath $sourceRoot -Recurse -File |
  Where-Object { $extensions -contains $_.Extension.ToLowerInvariant() -and -not $_.FullName.StartsWith($projectFullPath) }

if ($images.Count -eq 0) {
  throw "No supported images found in: $Source"
}

$selectedCount = [Math]::Min($Count, $images.Count)
$random = [Random]::new($Seed)
$selected = $images | Sort-Object { $random.NextDouble() } | Select-Object -First $selectedCount

if (Test-Path -LiteralPath $outputRoot) {
  Remove-Item -LiteralPath $outputRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $outputRoot | Out-Null

$items = New-Object System.Collections.Generic.List[object]
$index = 1
foreach ($image in $selected) {
  $extension = $image.Extension.ToLowerInvariant()
  $fileName = "aiface_{0:D3}{1}" -f $index, $extension
  $target = Join-Path $outputRoot $fileName
  Copy-Item -LiteralPath $image.FullName -Destination $target
  $items.Add([ordered]@{
    id = "aiface_{0:D3}" -f $index
    name = "aiface{0}" -f $index
    path = "./assets/aiface/$fileName"
    order = $index
    dataset = "SeePrettyFace"
  })
  $index++
}

$json = $items | ConvertTo-Json -Depth 4
$content = @"
// Generated from a local SeePrettyFace dataset sample by scripts/generate-aiface.ps1.
export const AIFACE_ICONS = $json;
"@
Set-Content -LiteralPath $dataFile -Value $content -Encoding UTF8

Write-Host "Generated $selectedCount AI face avatars in assets/aiface and updated aiface-data.js"
