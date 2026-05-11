Add-Type -AssemblyName System.Drawing
$imgPath = "C:\Users\mongTang\.gemini\antigravity\brain\ac682167-b06c-4667-ab95-bea3a5d35b73\media__1778412220777.png"
$bmp = New-Object System.Drawing.Bitmap($imgPath)
$c = $bmp.GetPixel(5, 5)
Write-Output ("Target Sidebar Ash: #" + $c.R.ToString("X2") + $c.G.ToString("X2") + $c.B.ToString("X2"))
$bmp.Dispose()
