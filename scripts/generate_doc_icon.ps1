# PowerShell script to generate high-quality Windows Document Association Icon (.ico)
# NEW UPDATE: Completely removed heavy blacks! Shited plates to Vibrant Brand Blue for supreme lightness!
# Contains sizes: 256, 128, 64, 48, 32, 16

$outputDir = "d:\my_Work\workspace\MTC\assets"
$tempDir = "d:\my_Work\workspace\MTC\scratch"
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

# Function to render specific PNG sizes
function New-DocPng {
    param (
        [int]$Size,
        [string]$InnerSvgContent,
        [string]$ViewBox = "0 0 256 256"
    )

    $htmlFile = Join-Path $tempDir "doc_icon_${Size}.html"
    $pngFile = Join-Path $tempDir "doc_icon_${Size}.png"
    
    $HtmlContent = @"
<!DOCTYPE html>
<html>
<head>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body, html {
            background: transparent !important;
            width: ${Size}px;
            height: ${Size}px;
            overflow: hidden;
            position: relative;
        }
        svg {
            position: absolute;
            top: 0;
            left: 0;
            width: ${Size}px;
            height: ${Size}px;
            display: block;
        }
    </style>
</head>
<body>
    <svg viewBox="$ViewBox" fill="none" xmlns="http://www.w3.org/2000/svg">
        $InnerSvgContent
    </svg>
</body>
</html>
"@

    [System.IO.File]::WriteAllText($htmlFile, $HtmlContent)
    
    Write-Host "Rendering Doc Icon (Vibrant Blue Tone): ${Size}x${Size}..."
    
    $edgeArgs = @(
        "--headless",
        "--disable-gpu",
        "--screenshot=""$pngFile""",
        "--window-size=$Size,$Size",
        "--hide-scrollbars",
        "--default-background-color=00000000",
        "--force-device-scale-factor=1",
        "file:///$($htmlFile.Replace('\', '/'))"
    )
    
    Start-Process -FilePath $edgePath -ArgumentList $edgeArgs -Wait -WindowStyle Hidden
    return $pngFile
}

# Function to bundle PNGs into a single valid .ico file (pure binary packer)
function New-IcoFile {
    param (
        [PSCustomObject[]]$ImageObjects,
        [string]$OutputPath
    )
    
    Write-Host "Bundling PNGs into $OutputPath..."
    
    $header = New-Object byte[] 6
    $header[2] = 1 # Type = 1
    $header[4] = $ImageObjects.Count # Count
    
    $directory = [System.Collections.Generic.List[byte]]::new()
    $imageData = [System.Collections.Generic.List[byte]]::new()
    
    $currentOffset = 6 + 16 * $ImageObjects.Count
    
    foreach ($imgObj in $ImageObjects) {
        $bytes = [System.IO.File]::ReadAllBytes($imgObj.Path)
        
        $w = if ($imgObj.Size -ge 256) { 0 } else { $imgObj.Size }
        $h = if ($imgObj.Size -ge 256) { 0 } else { $imgObj.Size }
        
        $entry = New-Object byte[] 16
        $entry[0] = $w
        $entry[1] = $h
        $entry[2] = 0
        $entry[3] = 0
        $entry[4] = 1 # Planes
        $entry[5] = 0
        $entry[6] = 32 # BPP
        $entry[7] = 0
        
        $sizeBytes = [BitConverter]::GetBytes($bytes.Length)
        [Array]::Copy($sizeBytes, 0, $entry, 8, 4)
        
        $offsetBytes = [BitConverter]::GetBytes($currentOffset)
        [Array]::Copy($offsetBytes, 0, $entry, 12, 4)
        
        $directory.AddRange($entry)
        $imageData.AddRange($bytes)
        
        $currentOffset += $bytes.Length
    }
    
    $finalBytes = [System.Collections.Generic.List[byte]]::new()
    $finalBytes.AddRange($header)
    $finalBytes.AddRange($directory.ToArray())
    $finalBytes.AddRange($imageData.ToArray())
    
    [System.IO.File]::WriteAllBytes($OutputPath, $finalBytes.ToArray())
}

# ---------------------------------------------------------
# SVGs: Shifted to Lighter, Vibrant Royal/Sky Blue theme
# ---------------------------------------------------------

# Large Design (256, 128, 64)
# Swapped heavy slate black gradient for elegant Rich Royal Blue to Navy Deep Gradient!
$largeInnerSvg = @"
    <defs>
        <filter id="pageShadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000000" flood-opacity="0.2"/>
        </filter>
        <filter id="plateShadow" x="-20%" y="-20%" width="150%" height="150%">
            <feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#000000" flood-opacity="0.4"/>
        </filter>
        <linearGradient id="pageBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="100%" stop-color="#e2e8f0"/>
        </linearGradient>
        <linearGradient id="plateBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1e40af"/> <!-- Modern Royal Blue -->
            <stop offset="100%" stop-color="#0f172a"/> <!-- Deep Navy -->
        </linearGradient>
    </defs>
    
    <!-- Paper Sheet -->
    <path d="M75 40 H150 L206 96 V220 C206 225.5 201.5 230 196 230 H85 C79.5 230 75 225.5 75 220 Z" 
          fill="url(#pageBg)" stroke="#cbd5e1" stroke-width="2" filter="url(#pageShadow)"/>
    <path d="M150 40 V91 C150 93.8 152.2 96 155 96 H206 L150 40 Z" fill="#cbd5e1" opacity="0.95"/>
    
    <!-- Bold Texts -->
    <text x="142" y="185" font-family="'Segoe UI', system-ui, sans-serif" font-weight="900" font-size="42" fill="#0284c7" text-anchor="middle" letter-spacing="1.5">ZIP</text>
    <text x="142" y="210" font-family="'Segoe UI', system-ui, sans-serif" font-weight="800" font-size="18" fill="#64748b" text-anchor="middle" letter-spacing="1">CBZ</text>
    
    <!-- Royal Blue App Icon Plate (108x108) -->
    <g filter="url(#plateShadow)">
        <rect x="15" y="15" width="108" height="108" rx="24" fill="url(#plateBg)" stroke="#3b82f6" stroke-width="1.5" />
        <g transform="translate(19, 13) scale(0.38)">
            <g transform="translate(0, -13)">
                <polygon points="128,124 243,182 128,240 13,182" fill="none" stroke="#60a5fa" stroke-width="15" stroke-linejoin="round" />
                <path d="M128 100 V240" stroke="#60a5fa" stroke-width="15" stroke-linecap="round" />
                <polygon points="128,42 243,100 128,158 13,100" fill="none" stroke="#ffffff" stroke-width="20" stroke-linejoin="round"/>
                <circle cx="128" cy="100" r="22" fill="#ffffff"/>
            </g>
        </g>
    </g>
"@

# Medium Design (48, 32)
# Uses Vibrant Sky Blue Plate for amazing lightness. White crisp logo.
$mediumInnerSvg = @"
    <path d="M9 3 H21 L27 9 V28 C27 29.1 26.1 30 25 30 H11 C9.9 30 9 29.1 9 28 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.4" />
    <path d="M21 3 V8.2 C21 8.7 21.3 9 21.8 9 H27 Z" fill="#cbd5e1" />
    <text x="18.5" y="23.5" font-family="system-ui, sans-serif" font-weight="900" font-size="8.5" fill="#0284c7" text-anchor="middle" letter-spacing="0.2">ZIP</text>
    
    <!-- Beautiful Vibrant Sky Blue Plate (15x15) -->
    <rect x="1.5" y="1.5" width="15" height="15" rx="3.5" fill="#0284c7" />
    <g transform="translate(1, 1)">
        <polygon points="8,9.5 11,11.5 8,13.5 5,11.5" fill="none" stroke="#ffffff" stroke-width="0.8" stroke-linejoin="round" />
        <line x1="8" y1="7.5" x2="8" y2="13.5" stroke="#ffffff" stroke-width="0.8" />
        <polygon points="8,5 11,7 8,9 5,7" fill="none" stroke="#ffffff" stroke-width="1.0" stroke-linejoin="round"/>
        <circle cx="8" cy="7" r="0.8" fill="#ffffff" />
    </g>
"@

# Tiny Design (16)
# Perfectly traces the user's minimalist sketch: Dark-outlined tall document with two solid blue horizontal bars!
$tinyInnerSvg = @"
    <!-- 1. Tall Plain Document Sheet (Crisp dark outline) -->
    <rect x="3.5" y="1.5" width="11" height="13" fill="#ffffff" stroke="#111827" stroke-width="1.2" rx="0.5" />
    
    <!-- 2. Two Vibrant Blue Horizontal Stack Bars (Extremely legible at 16px!) -->
    <rect x="1.5" y="3.5" width="9" height="2.2" fill="#0284c7" rx="0.4" />
    <rect x="1.5" y="7.5" width="9" height="2.2" fill="#0284c7" rx="0.4" />
"@

# ---------------------------------------------------------
# Generate All Elements
# ---------------------------------------------------------
$renders = @()
$renders += [PSCustomObject]@{Size = 256; Path = (New-DocPng -Size 256 -InnerSvgContent $largeInnerSvg -ViewBox "0 0 256 256") }
$renders += [PSCustomObject]@{Size = 128; Path = (New-DocPng -Size 128 -InnerSvgContent $largeInnerSvg -ViewBox "0 0 256 256") }
$renders += [PSCustomObject]@{Size = 64; Path = (New-DocPng -Size 64  -InnerSvgContent $largeInnerSvg -ViewBox "0 0 256 256") }
$renders += [PSCustomObject]@{Size = 48; Path = (New-DocPng -Size 48  -InnerSvgContent $mediumInnerSvg -ViewBox "0 0 32 32") }
$renders += [PSCustomObject]@{Size = 32; Path = (New-DocPng -Size 32  -InnerSvgContent $mediumInnerSvg -ViewBox "0 0 32 32") }
$renders += [PSCustomObject]@{Size = 16; Path = (New-DocPng -Size 16  -InnerSvgContent $tinyInnerSvg -ViewBox "0 0 16 16") }

$finalIcoPath = Join-Path $outputDir "data-file-icon.ico"
New-IcoFile -ImageObjects $renders -OutputPath $finalIcoPath

Write-Host "Vibrant Blue Premium Doc Icon Packing completed!"
