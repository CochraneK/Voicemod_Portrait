param(
  [string]$ApiVersion = "10.x",
  [int]$CountPerStyle = 10
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$outputRoot = Join-Path $projectRoot "assets\dicebeer"

$styles = @(
  "lorelei",
  "adventurer",
  "avataaars",
  "big-ears",
  "big-smile",
  "croodles",
  "dylan",
  "micah",
  "miniavs",
  "notionists",
  "open-peeps",
  "personas",
  "toon-head"
)

# Visual constraints only: transparent canvas, warm light-to-medium skin tones,
# dark hair and eyes, and no facial-hair components.
$sharedOptions = [ordered]@{
  hairColor = "0b0b0b,1f1714,33231f,4a3028"
  topColor = "0b0b0b,1f1714,33231f"
  skinColor = "f7d4b2,efc0a0,e8ad8b,dda37a"
  baseColor = "f7d4b2,efc0a0,e8ad8b,dda37a"
  eyesColor = "2b1b17"
  eyeColor = "2b1b17"
  eyebrowsColor = "1f1714"
  facialHairProbability = "0"
  beardProbability = "0"
  mustacheProbability = "0"
  sideburnsProbability = "0"
  accessoriesProbability = "0"
  hatProbability = "0"
  maskProbability = "0"
}

$avataaarsHair = @(
  "bob",
  "bun",
  "curly",
  "curvy",
  "longButNotTooLong",
  "shaggy",
  "shaggyMullet",
  "shavedSides",
  "shortCurly",
  "shortFlat",
  "shortRound",
  "shortWaved",
  "sides",
  "straight01",
  "straight02",
  "straightAndStrand",
  "theCaesar",
  "theCaesarAndSidePart"
) -join ","

function ConvertTo-QueryString {
  param([System.Collections.IDictionary]$Options)

  return ($Options.GetEnumerator() | ForEach-Object {
    $key = [Uri]::EscapeDataString([string]$_.Key)
    $value = [Uri]::EscapeDataString([string]$_.Value).Replace("%2C", ",")
    "$key=$value"
  }) -join "&"
}

function Download-Avatar {
  param(
    [string]$Url,
    [string]$Destination
  )

  $temporary = "$Destination.download"
  for ($attempt = 1; $attempt -le 4; $attempt++) {
    try {
      Invoke-WebRequest -Uri $Url -OutFile $temporary -UseBasicParsing -TimeoutSec 45
      Move-Item -LiteralPath $temporary -Destination $Destination -Force
      return
    } catch {
      Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue
      if ($attempt -eq 4) { throw }
      Start-Sleep -Milliseconds (400 * $attempt)
    }
  }
}

function Remove-CanvasBackground {
  param([string]$Path)

  $svg = Get-Content -LiteralPath $Path -Raw
  $viewBox = [regex]::Match($svg, 'viewBox="0 0 (?<width>[0-9.]+) (?<height>[0-9.]+)"')
  if (-not $viewBox.Success) { return }

  $width = [regex]::Escape($viewBox.Groups["width"].Value)
  $height = [regex]::Escape($viewBox.Groups["height"].Value)
  $pattern = '(<g\b(?=[^>]*(?:clip-path|mask)=)[^>]*>)<rect\b(?=[^>]*\bwidth="' + $width + '")(?=[^>]*\bheight="' + $height + '")[^>]*/>'
  $cleaned = [regex]::Replace($svg, $pattern, '$1', 1)

  if ($cleaned -ne $svg) {
    [System.IO.File]::WriteAllText($Path, $cleaned, [System.Text.UTF8Encoding]::new($false))
  }
}

foreach ($style in $styles) {
  $styleDirectory = Join-Path $outputRoot $style
  New-Item -ItemType Directory -Path $styleDirectory -Force | Out-Null

  for ($index = 1; $index -le $CountPerStyle; $index++) {
    $number = $index.ToString("00")
    $options = [ordered]@{ seed = "cn-$style-$number" }
    foreach ($entry in $sharedOptions.GetEnumerator()) {
      $options[$entry.Key] = $entry.Value
    }
    if ($style -eq "avataaars") {
      $options["topVariant"] = $avataaarsHair
    }

    # backgroundColor is deliberately omitted: an unset DiceBear background is transparent.
    $query = ConvertTo-QueryString -Options $options
    $url = "https://api.dicebear.com/$ApiVersion/$style/svg?$query"
    $destination = Join-Path $styleDirectory "$style`_$number.svg"

    Download-Avatar -Url $url -Destination $destination
    Remove-CanvasBackground -Path $destination
    Start-Sleep -Milliseconds 80
  }
}

$files = Get-ChildItem -Path $outputRoot -Recurse -Filter "*.svg"
$backgroundFiles = @($files | Where-Object {
  (Get-Content -LiteralPath $_.FullName -Raw) -match 'backgroundLinear|backgroundColor|</defs><g[^>]*><rect\b'
})
$facialHairFiles = @($files | Where-Object {
  (Get-Content -LiteralPath $_.FullName -Raw) -match 'id="(?:facialHair|beard|mustache|sideburns)-'
})

if ($files.Count -ne ($styles.Count * $CountPerStyle)) {
  throw "Expected $($styles.Count * $CountPerStyle) SVG files, found $($files.Count)."
}
if ($backgroundFiles.Count -gt 0) {
  throw "Background markup remains in $($backgroundFiles.Count) SVG files."
}
if ($facialHairFiles.Count -gt 0) {
  throw "Facial-hair markup remains in $($facialHairFiles.Count) SVG files."
}

Write-Output "Generated $($files.Count) transparent avatars across $($styles.Count) styles."
