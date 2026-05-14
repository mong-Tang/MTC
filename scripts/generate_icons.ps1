# PowerShell script to generate optimized OPEN-SIDED FLOATING stacked icons & Premium Document Icons
Add-Type -AssemblyName System.Drawing

# ---------------------------------------------------------
# ?썳截?0. Dynamic Repository Path Resolving
# ---------------------------------------------------------
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
if ([string]::IsNullOrEmpty($scriptRoot)) { $scriptRoot = Get-Location }
$repoRoot = (Get-Item $scriptRoot).Parent.FullName

$outputDir = Join-Path $repoRoot "assets"
$tempDir = Join-Path $repoRoot "scratch"

if (!(Test-Path $tempDir)) { New-Item -ItemType Directory -Force -Path $tempDir | Out-Null }

# ---------------------------------------------------------
# 0. Global GDI+ Helper Functions
# ---------------------------------------------------------
function Resize-IconPng {
    param([string]$SrcPath, [int]$Size, [string]$DstPath)
    $src = [System.Drawing.Bitmap]::FromFile($SrcPath)
    $dst = [System.Drawing.Bitmap]::new($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($dst)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($src, 0, 0, $Size, $Size)
    $dst.Save($DstPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $dst.Dispose(); $src.Dispose()
}

function New-AppIcon16 {
    $bmp = [System.Drawing.Bitmap]::new(16, 16)
    $trans = [System.Drawing.Color]::Transparent
    # Official Slate Gray plate color from master app icon
    $slatePlate = [System.Drawing.Color]::FromArgb(255, 29, 30, 34)
    # Vibrant Neon Cyan from master app icon logo
    $neonCyan = [System.Drawing.Color]::FromArgb(255, 0, 229, 255)

    # 1. Draw Wide Dark Squircle Background (Occupying full 16x16 for max breathing room)
    for ($x = 0; $x -lt 16; $x++) { for ($y = 0; $y -lt 16; $y++) { $bmp.SetPixel($x, $y, $slatePlate) } }
    # Round the extreme corners
    $bmp.SetPixel(0, 0, $trans); $bmp.SetPixel(15, 0, $trans); $bmp.SetPixel(0, 15, $trans); $bmp.SetPixel(15, 15, $trans)
    $bmp.SetPixel(1, 0, $trans); $bmp.SetPixel(14, 0, $trans); $bmp.SetPixel(0, 1, $trans); $bmp.SetPixel(15, 1, $trans)
    $bmp.SetPixel(1, 15, $trans); $bmp.SetPixel(14, 15, $trans); $bmp.SetPixel(0, 14, $trans); $bmp.SetPixel(15, 14, $trans)

    # 🎯 [The Grand Skeleton] 100% Exact Digital Reconstruction from test_16x16_exact_logo.png
    # 🌟 Top Ball & Spine Connector
    $bmp.SetPixel(6, 1, $neonCyan); $bmp.SetPixel(7, 1, $neonCyan); $bmp.SetPixel(8, 1, $neonCyan); $bmp.SetPixel(9, 1, $neonCyan)
    $bmp.SetPixel(6, 2, $neonCyan); $bmp.SetPixel(7, 2, $neonCyan); $bmp.SetPixel(8, 2, $neonCyan); $bmp.SetPixel(9, 2, $neonCyan)
    $bmp.SetPixel(7, 3, $neonCyan); $bmp.SetPixel(8, 3, $neonCyan)
    $bmp.SetPixel(7, 4, $neonCyan); $bmp.SetPixel(8, 4, $neonCyan)

    # 💍 Top Hollow Diamond Ring
    $bmp.SetPixel(4, 5, $neonCyan); $bmp.SetPixel(5, 5, $neonCyan); $bmp.SetPixel(6, 5, $neonCyan); $bmp.SetPixel(7, 5, $neonCyan); $bmp.SetPixel(8, 5, $neonCyan); $bmp.SetPixel(9, 5, $neonCyan); $bmp.SetPixel(10, 5, $neonCyan); $bmp.SetPixel(11, 5, $neonCyan)
    $bmp.SetPixel(1, 6, $neonCyan); $bmp.SetPixel(2, 6, $neonCyan); $bmp.SetPixel(3, 6, $neonCyan); $bmp.SetPixel(7, 6, $neonCyan); $bmp.SetPixel(8, 6, $neonCyan); $bmp.SetPixel(12, 6, $neonCyan); $bmp.SetPixel(13, 6, $neonCyan); $bmp.SetPixel(14, 6, $neonCyan)
    $bmp.SetPixel(4, 7, $neonCyan); $bmp.SetPixel(5, 7, $neonCyan); $bmp.SetPixel(6, 7, $neonCyan); $bmp.SetPixel(7, 7, $neonCyan); $bmp.SetPixel(8, 7, $neonCyan); $bmp.SetPixel(9, 7, $neonCyan); $bmp.SetPixel(10, 7, $neonCyan); $bmp.SetPixel(11, 7, $neonCyan)

    # 🦴 Main Central Spine Column
    $bmp.SetPixel(7, 8, $neonCyan); $bmp.SetPixel(8, 8, $neonCyan)
    $bmp.SetPixel(7, 9, $neonCyan); $bmp.SetPixel(8, 9, $neonCyan)
    $bmp.SetPixel(7, 10, $neonCyan); $bmp.SetPixel(8, 10, $neonCyan)
    $bmp.SetPixel(7, 11, $neonCyan); $bmp.SetPixel(8, 11, $neonCyan)

    # 💍 Bottom Hollow Diamond Ring
    $bmp.SetPixel(4, 12, $neonCyan); $bmp.SetPixel(5, 12, $neonCyan); $bmp.SetPixel(6, 12, $neonCyan); $bmp.SetPixel(7, 12, $neonCyan); $bmp.SetPixel(8, 12, $neonCyan); $bmp.SetPixel(9, 12, $neonCyan); $bmp.SetPixel(10, 12, $neonCyan); $bmp.SetPixel(11, 12, $neonCyan)
    $bmp.SetPixel(1, 13, $neonCyan); $bmp.SetPixel(2, 13, $neonCyan); $bmp.SetPixel(3, 13, $neonCyan); $bmp.SetPixel(7, 13, $neonCyan); $bmp.SetPixel(8, 13, $neonCyan); $bmp.SetPixel(12, 13, $neonCyan); $bmp.SetPixel(13, 13, $neonCyan); $bmp.SetPixel(14, 13, $neonCyan)
    $bmp.SetPixel(4, 14, $neonCyan); $bmp.SetPixel(5, 14, $neonCyan); $bmp.SetPixel(6, 14, $neonCyan); $bmp.SetPixel(7, 14, $neonCyan); $bmp.SetPixel(8, 14, $neonCyan); $bmp.SetPixel(9, 14, $neonCyan); $bmp.SetPixel(10, 14, $neonCyan); $bmp.SetPixel(11, 14, $neonCyan)

    # ⚓ Bottom Spine Anchor Tip
    $bmp.SetPixel(7, 15, $neonCyan); $bmp.SetPixel(8, 15, $neonCyan)

    return $bmp
}


# ---------------------------------------------------------
# PART 1: GENERATE MAIN APPLICATION ICONS (Native GDI+ Scaling)
# ---------------------------------------------------------
Write-Host "`nGenerating 3-Layer Master Icons from Master Assets..."
$masterPngPath = Join-Path $outputDir "app-logo-source.png"

if (!(Test-Path $masterPngPath)) {
    Write-Error "Master app icon source not found in assets: $masterPngPath"
    exit 1
}

# Generate 256, 128, 64, 32 from 3-Layer Master PNG
$targetSizes = @(256, 128, 64, 32)
foreach ($sz in $targetSizes) {
    $dst = Join-Path $tempDir "mongTang_ico${sz}X${sz}.png"
    Write-Host "Scaling ${sz}x${sz} 3-Layer Master..."
    Resize-IconPng -SrcPath $masterPngPath -Size $sz -DstPath $dst
}

# Dynamically Render and Save the pixel-perfect 16x16 centered masterpiece
Write-Host "Dynamically drawing custom 16x16 2-layer centered masterpiece..."
$app16 = New-AppIcon16
$app16Path = Join-Path $tempDir "mongTang_ico16X16.png"
$app16.Save($app16Path, [System.Drawing.Imaging.ImageFormat]::Png)
$app16.Dispose()

Write-Host "✔ PART 1: 3-Layer Master Application Icons generated successfully!"

# ---------------------------------------------------------
# PART 2: GENERATE PREMIUM DOCUMENT ICONS (data-file-icon.ico)
# ---------------------------------------------------------
Write-Host "`nGenerating DEFINITIVE Premium Ice-Glass Document Icons..."

function New-DocumentStamp {
    $bmp = [System.Drawing.Bitmap]::new(512, 512)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $brandBlue = [System.Drawing.Color]::FromArgb(255, 0, 102, 204)
    $darkColor = [System.Drawing.Color]::FromArgb(255, 29, 30, 34)
    $iceGlassBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 232, 248, 253))

    $framePen = [System.Drawing.Pen]::new($darkColor, 14)
    $framePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    
    $rectX = 21; $rectW = 470; $rectY = 85; $rectH = 330; $radius = 80
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddArc($rectX, $rectY, $radius, $radius, 180, 90)
    $path.AddArc($rectX + $rectW - $radius, $rectY, $radius, $radius, 270, 90)
    $path.AddArc($rectX + $rectW - $radius, $rectY + $rectH - $radius, $radius, $radius, 0, 90)
    $path.AddArc($rectX, $rectY + $rectH - $radius, $radius, $radius, 90, 90)
    $path.CloseAllFigures()

    $g.FillPath($iceGlassBrush, $path)
    $g.DrawPath($framePen, $path)

    # 🎯 [솔리드 대개혁] 내부 검은 테두리를 싹 제거하고, 24px 단일 로열 블루로 선명하게 각인!
    $centerX = 256; $wRadius = 195; $hRadius = 45; $baseY1 = 170; $baseY2 = 330
    
    $solidBluePen = [System.Drawing.Pen]::new($brandBlue, 24)
    $solidBluePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $solidBluePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $solidBluePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    function Get-RPoints($bY) {
        return @(
            [System.Drawing.Point]::new($centerX, $bY - $hRadius),
            [System.Drawing.Point]::new($centerX + $wRadius, $bY),
            [System.Drawing.Point]::new($centerX, $bY + $hRadius),
            [System.Drawing.Point]::new($centerX - $wRadius, $bY)
        )
    }
    $r1Pts = Get-RPoints $baseY1; $r2Pts = Get-RPoints $baseY2

    $g.DrawLine($solidBluePen, $centerX, $baseY1 + $hRadius, $centerX, $baseY2 + $hRadius)
    $g.DrawPolygon($solidBluePen, $r1Pts)
    $g.DrawPolygon($solidBluePen, $r2Pts)

    $solidBluePen.Dispose(); $framePen.Dispose(); $iceGlassBrush.Dispose(); $g.Dispose()
    return $bmp
}

function New-DocumentMaster($stampBmp) {
    $bmp = [System.Drawing.Bitmap]::new(512, 512)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $g.Clear([System.Drawing.Color]::Transparent)

    $paperBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 245, 246, 248))
    $shadowPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 200, 205, 210), 5)
    
    $pX = 150; $pY = 50; $pR = 35
    $paperPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $paperPath.AddArc($pX, $pY, $pR, $pR, 180, 90)
    $paperPath.AddLine($pX + $pR, $pY, 370, 50)
    $paperPath.AddLine(370, 50, 470, 150)
    $paperPath.AddLine(470, 150, 470, 470 - $pR)
    $paperPath.AddArc(470 - $pR, 470 - $pR, $pR, $pR, 0, 90)
    $paperPath.AddLine(470 - $pR, 470, $pX + $pR, 470)
    $paperPath.AddArc($pX, 470 - $pR, $pR, $pR, 90, 90)
    $paperPath.AddLine($pX, 470 - $pR, $pX, $pY + $pR)
    $paperPath.CloseAllFigures()
    $g.FillPath($paperBrush, $paperPath)
    $g.DrawPath($shadowPen, $paperPath)

    $flapBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 215, 220, 225))
    $flapPts = @(
        [System.Drawing.Point]::new(370, 50),
        [System.Drawing.Point]::new(370, 150),
        [System.Drawing.Point]::new(470, 150)
    )
    $g.FillPolygon($flapBrush, $flapPts); $g.DrawPolygon($shadowPen, $flapPts)

    $g.DrawImage($stampBmp, 40, 45, 280, 280)

    # GOLDEN RATIO BOLD TEXT: ZIP 62pt / CBZ 36pt
    $blueColor = [System.Drawing.Color]::FromArgb(255, 0, 102, 204)
    $grayColor = [System.Drawing.Color]::FromArgb(255, 80, 85, 90)
    $zipBrush = [System.Drawing.SolidBrush]::new($blueColor)
    $cbzBrush = [System.Drawing.SolidBrush]::new($grayColor)
    $zipFont = [System.Drawing.Font]::new("Segoe UI Black", 62, [System.Drawing.FontStyle]::Bold)
    $cbzFont = [System.Drawing.Font]::new("Segoe UI Semibold", 36, [System.Drawing.FontStyle]::Bold)
    $format = [System.Drawing.StringFormat]::new()
    $format.Alignment = [System.Drawing.StringAlignment]::Center

    $g.DrawString("ZIP", $zipFont, $zipBrush, 310, 300, $format)
    $g.DrawString("CBZ", $cbzFont, $cbzBrush, 310, 382, $format)

    $zipBrush.Dispose(); $cbzBrush.Dispose(); $zipFont.Dispose(); $cbzFont.Dispose(); $format.Dispose()
    $flapBrush.Dispose(); $paperBrush.Dispose(); $shadowPen.Dispose(); $paperPath.Dispose(); $g.Dispose()
    return $bmp
}

function New-Document16 {
    $bmp = [System.Drawing.Bitmap]::new(16, 16)
    $trans = [System.Drawing.Color]::Transparent
    $paper = [System.Drawing.Color]::FromArgb(255, 245, 246, 248)
    $border = [System.Drawing.Color]::FromArgb(255, 190, 195, 200)
    $dark = [System.Drawing.Color]::FromArgb(255, 29, 30, 34)    
    $brandBlue = [System.Drawing.Color]::FromArgb(255, 0, 102, 204)
    $iceColor = [System.Drawing.Color]::FromArgb(255, 215, 244, 252)
    
    for ($x = 0; $x -lt 16; $x++) { for ($y = 0; $y -lt 16; $y++) { $bmp.SetPixel($x, $y, $trans) } }
    for ($x = 3; $x -le 15; $x++) { for ($y = 2; $y -le 15; $y++) { $bmp.SetPixel($x, $y, $paper) } }
    $bmp.SetPixel(3, 2, $trans); $bmp.SetPixel(3, 15, $trans); $bmp.SetPixel(15, 15, $trans)
    $bmp.SetPixel(13, 2, $trans); $bmp.SetPixel(14, 2, $trans); $bmp.SetPixel(15, 2, $trans)
    $bmp.SetPixel(14, 3, $trans); $bmp.SetPixel(15, 3, $trans)
    for ($y = 3; $y -le 14; $y++) { $bmp.SetPixel(3, $y, $border) }
    for ($x = 4; $x -le 12; $x++) { $bmp.SetPixel($x, 2, $border) }
    for ($y = 5; $y -le 14; $y++) { $bmp.SetPixel(15, $y, $border) }
    for ($x = 4; $x -le 14; $x++) { $bmp.SetPixel($x, 15, $border) }
    $bmp.SetPixel(12, 2, $border); $bmp.SetPixel(13, 3, $border); $bmp.SetPixel(14, 4, $border); $bmp.SetPixel(15, 5, $border)
    $bmp.SetPixel(12, 3, $border); $bmp.SetPixel(12, 4, $border)
    
    for ($x = 1; $x -le 10; $x++) { for ($y = 2; $y -le 8; $y++) { $bmp.SetPixel($x, $y, $iceColor) } }
    for ($x = 1; $x -le 10; $x++) { $bmp.SetPixel($x, 1, $dark); $bmp.SetPixel($x, 9, $dark) }
    for ($y = 2; $y -le 8; $y++) { $bmp.SetPixel(0, $y, $dark); $bmp.SetPixel(11, $y, $dark) }

    # 🎯 [솔리드 대개혁] 16px 내부 검은 찌꺼기 제거 ➡ 순수 단색 로열 블루!
    # 1층 링
    $bmp.SetPixel(5, 2, $brandBlue); $bmp.SetPixel(6, 2, $brandBlue)
    $bmp.SetPixel(4, 3, $brandBlue); $bmp.SetPixel(7, 3, $brandBlue)
    for ($x = 2; $x -le 9; $x++) { $bmp.SetPixel($x, 4, $brandBlue) }
    $bmp.SetPixel(4, 5, $brandBlue); $bmp.SetPixel(7, 5, $brandBlue)
    $bmp.SetPixel(3, 3, $brandBlue); $bmp.SetPixel(8, 3, $brandBlue)

    # 2층 링
    $bmp.SetPixel(5, 6, $brandBlue); $bmp.SetPixel(6, 6, $brandBlue)
    $bmp.SetPixel(4, 7, $brandBlue); $bmp.SetPixel(7, 7, $brandBlue)
    for ($x = 2; $x -le 9; $x++) { $bmp.SetPixel($x, 8, $brandBlue) }
    $bmp.SetPixel(3, 7, $brandBlue); $bmp.SetPixel(8, 7, $brandBlue)

    # 기둥
    for ($y = 5; $y -le 8; $y++) {
        $bmp.SetPixel(5, $y, $brandBlue); $bmp.SetPixel(6, $y, $brandBlue)
    }

    for ($x = 7; $x -le 11; $x++) { $bmp.SetPixel($x, 14, $brandBlue) }
    return $bmp
}


function Convert-IconPngsToIco {
    param([string[]]$PngPaths, [string]$OutputPath)
    $stream = [System.IO.File]::Open($OutputPath, [System.IO.FileMode]::Create)
    $writer = [System.IO.BinaryWriter]::new($stream)
    $writer.Write([UInt16]0); $writer.Write([UInt16]1); $writer.Write([UInt16]$PngPaths.Count)
    $offset = 6 + ($PngPaths.Count * 16)
    $pngBytesArray = @()
    foreach ($path in $PngPaths) {
        $bytes = [System.IO.File]::ReadAllBytes($path)
        $pngBytesArray += , $bytes
        $bmp = [System.Drawing.Bitmap]::FromFile($path)
        $w = $bmp.Width; $h = $bmp.Height; $bmp.Dispose()
        if ($w -ge 256) { $byteW = [byte]0 } else { $byteW = [byte]$w }
        if ($h -ge 256) { $byteH = [byte]0 } else { $byteH = [byte]$h }
        $writer.Write($byteW); $writer.Write($byteH); $writer.Write([byte]0); $writer.Write([byte]0)
        $writer.Write([UInt16]1); $writer.Write([UInt16]32); $writer.Write([UInt32]$bytes.Length); $writer.Write([UInt32]$offset)
        $offset += $bytes.Length
    }
    foreach ($bytes in $pngBytesArray) { $writer.Write($bytes) }
    $writer.Close(); $stream.Close()
}

# Executing Document Icon generation
$stamp = New-DocumentStamp
$masterDoc = New-DocumentMaster $stamp
$masterDocPath = Join-Path $tempDir "master_doc_temp_512.png"
$masterDoc.Save($masterDocPath, [System.Drawing.Imaging.ImageFormat]::Png)
$masterDoc.Dispose(); $stamp.Dispose()

$doc16 = New-Document16
$doc16Path = Join-Path $tempDir "master_doc_temp_16.png"
$doc16.Save($doc16Path, [System.Drawing.Imaging.ImageFormat]::Png)
$doc16.Dispose()

$sizes = @(256, 48, 32)
$pngPaths = @()
foreach ($sz in $sizes) {
    $p = Join-Path $tempDir "doc_temp_${sz}.png"
    Resize-IconPng -SrcPath $masterDocPath -Size $sz -DstPath $p
    $pngPaths += $p
}
$pngPaths += $doc16Path

$targetFileIco = Join-Path $outputDir "data-file-icon.ico"
Convert-IconPngsToIco -PngPaths $pngPaths -OutputPath $targetFileIco

Write-Host "✔ PART 2: Definitive Premium Document Icons generated!"

# ---------------------------------------------------------
# PART 3: COMPILE MAIN APPLICATION ICON (build/icon.ico)
# ---------------------------------------------------------
Write-Host "`nCompiling Main Application Icon (.ico)..."
$appSizes = @(256, 128, 64, 32, 16)
$appPngPaths = @()
foreach ($sz in $appSizes) {
    $p = Join-Path $tempDir "mongTang_ico${sz}X${sz}.png"
    if (Test-Path $p) {
        $appPngPaths += $p
    }
    else {
        Write-Warning "Missing source png for application icon: $p"
    }
}

$buildDir = Join-Path $repoRoot "build"
if (!(Test-Path $buildDir)) { New-Item -ItemType Directory -Force -Path $buildDir | Out-Null }
$targetAppIco = Join-Path $buildDir "icon.ico"

Convert-IconPngsToIco -PngPaths $appPngPaths -OutputPath $targetAppIco

Write-Host "✔ PART 3: Main Application Icon compiled successfully to $targetAppIco!"


# ---------------------------------------------------------
# PART 4: AUTO CLEANUP SCRATCH FILES
# ---------------------------------------------------------
Write-Host "`nCleaning up temporary scratch files..."
if (Test-Path $tempDir) {
    # Delete all temporary contents to leave no trace!
    Remove-Item -Path (Join-Path $tempDir "*") -Force -Recurse -ErrorAction SilentlyContinue
    Write-Host "✔ PART 4: Auto Cleanup complete! Repository is perfectly clean."
}

Write-Host "`n🎉 All MTC Icons have been rebuilt, applied and successfully deployed!"


