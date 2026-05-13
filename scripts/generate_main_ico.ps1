# PowerShell script to bundle main application PNGs into build/icon.ico
# Used as the primary .exe and installer icon by electron-builder

$assetsDir = "d:\my_Work\workspace\MTC\assets"
$buildDir = "d:\my_Work\workspace\MTC\build"

if (!(Test-Path $buildDir)) {
    New-Item -ItemType Directory -Force -Path $buildDir | Out-Null
}

$images = @(
    [PSCustomObject]@{Size=256; Path=(Join-Path $assetsDir "mongTang_ico256X256.png")}
    [PSCustomObject]@{Size=128; Path=(Join-Path $assetsDir "mongTang_ico128X128.png")}
    [PSCustomObject]@{Size=64;  Path=(Join-Path $assetsDir "mongTang_ico64X64.png")}
    [PSCustomObject]@{Size=32;  Path=(Join-Path $assetsDir "mongTang_ico32X32.png")}
    [PSCustomObject]@{Size=16;  Path=(Join-Path $assetsDir "mongTang_ico16X16.png")}
)

function New-IcoFile {
    param (
        [PSCustomObject[]]$ImageObjects,
        [string]$OutputPath
    )
    
    Write-Host "Bundling main app PNGs into $OutputPath..."
    
    $header = New-Object byte[] 6
    $header[2] = 1 # Type = 1
    $header[4] = $ImageObjects.Count # Count
    
    $directory = [System.Collections.Generic.List[byte]]::new()
    $imageData = [System.Collections.Generic.List[byte]]::new()
    
    $currentOffset = 6 + 16 * $ImageObjects.Count
    
    foreach ($imgObj in $ImageObjects) {
        if (!(Test-Path $imgObj.Path)) {
            Write-Error "Missing source file: $($imgObj.Path)"
            return
        }
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
    Write-Host "Main Application ICO Created successfully at $OutputPath!"
}

New-IcoFile -ImageObjects $images -OutputPath (Join-Path $buildDir "icon.ico")
