param(
    [Parameter(Mandatory = $true)]
    [string]$ApiKey,

    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [Parameter(Mandatory = $true)]
    [string[]]$ScreenIds,

    [string]$OutputDir = "docs/stitch/document-import"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-StitchMcp {
    param(
        [string]$ApiKey,
        [hashtable]$Payload
    )

    $headers = @{
        "Content-Type"  = "application/json"
        "Accept"        = "application/json, text/event-stream"
        "X-Goog-Api-Key" = $ApiKey
    }

    $body = $Payload | ConvertTo-Json -Compress -Depth 20
    return Invoke-RestMethod -Uri "https://stitch.googleapis.com/mcp" -Method Post -Headers $headers -Body $body
}

function Get-SafeSlug {
    param([string]$Value)

    $slug = ($Value -replace "[^A-Za-z0-9]+", "-").Trim("-").ToLowerInvariant()
    if ([string]::IsNullOrWhiteSpace($slug)) {
        return "screen"
    }
    return $slug
}

function Save-UrlWithCurl {
    param(
        [string]$Url,
        [string]$Destination
    )

    if ([string]::IsNullOrWhiteSpace($Url)) {
        throw "Missing download URL for $Destination"
    }

    & curl.exe --fail --silent --show-error --location $Url --output $Destination
    if ($LASTEXITCODE -ne 0) {
        throw "curl.exe failed while downloading $Url"
    }
}

$outputRoot = Join-Path (Get-Location) $OutputDir
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

$screensResponse = Invoke-StitchMcp -ApiKey $ApiKey -Payload @{
    jsonrpc = "2.0"
    id = 1
    method = "tools/call"
    params = @{
        name = "list_screens"
        arguments = @{
            project_id = $ProjectId
        }
    }
}

if (($screensResponse.result.PSObject.Properties.Name -contains "isError") -and $screensResponse.result.isError) {
    $message = ($screensResponse.result.content | Where-Object type -eq "text" | Select-Object -First 1 -ExpandProperty text)
    throw "Stitch list_screens failed: $message"
}

$screensJson = ($screensResponse.result.content | Where-Object type -eq "text" | Select-Object -First 1 -ExpandProperty text)
$allScreens = (ConvertFrom-Json $screensJson).screens

$normalizedScreenIds = @()
foreach ($rawScreenId in $ScreenIds) {
    $normalizedScreenIds += ($rawScreenId -split "," | ForEach-Object { $_.Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

$selectedScreens = @()
$missingScreenIds = @()

foreach ($screenId in $normalizedScreenIds) {
    $match = $allScreens | Where-Object { $_.name -like "*/screens/$screenId" } | Select-Object -First 1
    if ($null -eq $match) {
        $missingScreenIds += $screenId
        continue
    }
    $selectedScreens += $match
}

if ($missingScreenIds.Count -gt 0) {
    throw "The following screen IDs were not found in project ${ProjectId}: $($missingScreenIds -join ', ')"
}

$manifest = [ordered]@{
    projectId = $ProjectId
    exportedAt = (Get-Date).ToString("o")
    screenCount = $normalizedScreenIds.Count
    screens = @()
}

for ($index = 0; $index -lt $selectedScreens.Count; $index++) {
    $screen = $selectedScreens[$index]
    $screenId = ($screen.name -split "/")[-1]
    $slug = Get-SafeSlug -Value $screen.title
    $folderName = "{0:D2}-{1}-{2}" -f ($index + 1), $slug, $screenId
    $screenDir = Join-Path $outputRoot $folderName
    New-Item -ItemType Directory -Force -Path $screenDir | Out-Null

    $screenshotPath = Join-Path $screenDir "screenshot.png"
    $htmlPath = Join-Path $screenDir "screen.html"
    $metadataPath = Join-Path $screenDir "metadata.json"

    Save-UrlWithCurl -Url $screen.screenshot.downloadUrl -Destination $screenshotPath
    Save-UrlWithCurl -Url $screen.htmlCode.downloadUrl -Destination $htmlPath

    $metadata = [ordered]@{
        id = $screenId
        title = $screen.title
        deviceType = $screen.deviceType
        width = $screen.width
        height = $screen.height
        stitchName = $screen.name
        screenshotUrl = $screen.screenshot.downloadUrl
        htmlUrl = $screen.htmlCode.downloadUrl
        files = [ordered]@{
            screenshot = $screenshotPath
            html = $htmlPath
        }
    }

    $metadata | ConvertTo-Json -Depth 10 | Set-Content -Path $metadataPath -Encoding utf8
    $manifest.screens += $metadata

    Write-Host ("Saved {0} -> {1}" -f $screen.title, $screenDir)
}

$manifestPath = Join-Path $outputRoot "manifest.json"
$manifest | ConvertTo-Json -Depth 10 | Set-Content -Path $manifestPath -Encoding utf8
Write-Host ("Manifest written to {0}" -f $manifestPath)
