# PowerShell script to generate optimized OPEN-SIDED FLOATING stacked icons

$outputDir = "d:\my_Work\workspace\MTC\assets"
$backupDir = "$outputDir\backup_old_icons"
$tempDir = "d:\my_Work\workspace\MTC\scratch"

# Function to generate HTML and render screenshot
function Generate-Icon {
    param (
        [int]$Size,
        [string]$InnerSvgContent,
        [string]$ViewBox = "0 0 256 256"
    )

    $htmlFile = Join-Path $tempDir "icon_${Size}.html"
    $pngFile = Join-Path $outputDir "mongTang_ico${Size}X${Size}.png"
    
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
    
    Write-Host "Rendering ${Size}x${Size} OPEN-SIDED FLOATING Icon..."
    
    $edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    $args = @(
        "--headless",
        "--disable-gpu",
        "--screenshot=""$pngFile""",
        "--window-size=$Size,$Size",
        "--hide-scrollbars",
        "--default-background-color=00000000",
        "--force-device-scale-factor=1",
        "file:///$($htmlFile.Replace('\', '/'))"
    )
    
    Start-Process -FilePath $edgePath -ArgumentList $args -Wait -WindowStyle Hidden
}

# ---------------------------------------------------------
# NEW OPEN-SIDED DESIGN:
# - NO Side walls!
# - Full bottom rhombus
# - Intersecting central axis
# ---------------------------------------------------------

# 1. Large/Medium Icons (256, 128, 64)
# Radius X = 115, Radius Y = 58. Top Center = (128, 100). Bottom Center = (128, 182).
# Visual bounds: Y=42 to Y=240. Height = 198px. Perfectly centered.
$largeSvg = @"
        <g transform="translate(0, -13)">
            <!-- 1. Bottom Rhombus (Complete, electric blue, high visibility) -->
            <!-- Top: (128,124), Right: (243,182), Bottom: (128,240), Left: (13,182) -->
            <polygon points="128,124 243,182 128,240 13,182" fill="none" stroke="#0284c7" stroke-width="6" stroke-linejoin="round" />
            
            <!-- 2. Central Floating Axis -->
            <path d="M128 100 V240" stroke="#0284c7" stroke-width="6" stroke-linecap="round" />
            
            <!-- 3. Top Rhombus (Bright Neon Sky Blue) -->
            <polygon points="128,42 243,100 128,158 13,100" fill="none" stroke="#38bdf8" stroke-width="8.5" stroke-linejoin="round"/>
            
            <!-- 4. Accent Pin Dot -->
            <circle cx="128" cy="100" r="8.5" fill="#38bdf8"/>
        </g>
"@

Generate-Icon -Size 256 -InnerSvgContent $largeSvg -ViewBox "0 0 256 256"
Generate-Icon -Size 128 -InnerSvgContent $largeSvg -ViewBox "0 0 256 256"
Generate-Icon -Size 64  -InnerSvgContent $largeSvg -ViewBox "0 0 256 256"

# 2. Medium-Small Icon (32)
# Radius X=14, Radius Y=7. Top: (16,12). Bottom: (16,22).
$smallSvg32 = @"
        <g transform="translate(0, -1)">
            <!-- Bottom Full Rhombus (Top: 15, Right: 30, Bottom: 29, Left: 2) -->
            <polygon points="16,15 30,22 16,29 2,22" fill="none" stroke="#0284c7" stroke-width="2.0" stroke-linejoin="round" />
            <path d="M16 12 V29" stroke="#0284c7" stroke-width="2.0" stroke-linecap="round" />
            <polygon points="16,5 30,12 16,19 2,12" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linejoin="round"/>
            <circle cx="16" cy="12" r="2.2" fill="#38bdf8"/>
        </g>
"@

Generate-Icon -Size 32 -InnerSvgContent $smallSvg32 -ViewBox "0 0 32 32"

# 3. Tiny Icon (16)
# Fully responsive microscopic version
$tinySvg16 = @"
        <g transform="translate(0, -0.5)">
            <polygon points="8,7.5 15,11 8,14.5 1,11" fill="none" stroke="#0284c7" stroke-width="1.2" stroke-linejoin="round" />
            <path d="M8 6 V14.5" stroke="#0284c7" stroke-width="1.2" stroke-linecap="round" />
            <polygon points="8,2.5 15,6 8,9.5 1,6" fill="none" stroke="#38bdf8" stroke-width="1.4" stroke-linejoin="round"/>
            <circle cx="8" cy="6" r="1.2" fill="#38bdf8"/>
        </g>
"@

Generate-Icon -Size 16 -InnerSvgContent $tinySvg16 -ViewBox "0 0 16 16"

Write-Host "All new Open-Sided Floating Icons generated!"
