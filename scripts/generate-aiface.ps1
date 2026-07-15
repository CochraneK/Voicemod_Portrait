param(
  [Parameter(Mandatory = $true)]
  [string]$Source,
  [int]$Count = 300,
  [int]$Seed = 20260715,
  [int]$Size = 512,
  [string]$SourceLabel = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$outputRoot = Join-Path $projectRoot "assets\aiface"
$dataFile = Join-Path $projectRoot "js\aiface-data.js"

if (-not (Test-Path -LiteralPath $Source)) {
  throw "Source path does not exist: $Source"
}

$extensions = @(".jpg", ".jpeg", ".png", ".webp")
$sourceRoot = (Resolve-Path -LiteralPath $Source).Path
$projectFullPath = (Resolve-Path -LiteralPath $projectRoot).Path
if ([string]::IsNullOrWhiteSpace($SourceLabel)) {
  $SourceLabel = Split-Path -Leaf $sourceRoot
}

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
  $fileName = "aiface_{0:D3}.png" -f $index
  $target = Join-Path $outputRoot $fileName

  $sourceImage = [System.Drawing.Image]::FromFile($image.FullName)
  try {
    $side = [Math]::Min($sourceImage.Width, $sourceImage.Height)
    $cropX = [int](($sourceImage.Width - $side) / 2)
    $cropY = [int](($sourceImage.Height - $side) / 2)
    $cropRect = [System.Drawing.Rectangle]::new($cropX, $cropY, $side, $side)
    $targetRect = [System.Drawing.Rectangle]::new(0, 0, $Size, $Size)

    $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $clipPath = [System.Drawing.Drawing2D.GraphicsPath]::new()

    try {
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $clipPath.AddEllipse(0, 0, $Size, $Size)
      $graphics.SetClip($clipPath)
      $graphics.DrawImage($sourceImage, $targetRect, $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
      $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $clipPath.Dispose()
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  } finally {
    $sourceImage.Dispose()
  }

  $items.Add([ordered]@{
    id = "aiface_{0:D3}" -f $index
    name = "aiface{0}" -f $index
    path = "./assets/aiface/$fileName"
    order = $index
    dataset = $SourceLabel
  })
  $index++
}

$json = $items | ConvertTo-Json -Depth 4
$content = @"
// Generated from a local $SourceLabel dataset sample by scripts/generate-aiface.ps1.
export const AIFACE_ICONS = $json;
"@
Set-Content -LiteralPath $dataFile -Value $content -Encoding UTF8

Write-Host "Generated $selectedCount AI face avatars in assets/aiface and updated aiface-data.js"
