$ErrorActionPreference = 'Stop'

function Write-Step {
  param([string]$Message)
  Write-Host ''
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Fail {
  param([string]$Message)
  Write-Host ''
  Write-Host "[ERROR] $Message" -ForegroundColor Red
  exit 1
}

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Fail "Required command not found: $Name"
  }
}

function Run {
  param(
    [string]$Command,
    [string[]]$Args
  )

  & $Command @Args
  if ($LASTEXITCODE -ne 0) {
    Fail "Command failed: $Command $($Args -join ' ')"
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

Write-Step 'Checking required tools'
Require-Command git
Require-Command npm.cmd
Require-Command node
Require-Command gh

Write-Step 'Checking Git working tree'
$status = git status --porcelain
if ($status) {
  Fail "Working tree is not clean. Commit or discard changes first.`n$status"
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'main') {
  Fail "Current branch is not main: $branch"
}

Write-Step 'Checking remote sync'
Run git @('fetch', 'origin', 'main', '--tags')
$localHead = (git rev-parse HEAD).Trim()
$remoteHead = (git rev-parse origin/main).Trim()
if ($localHead -ne $remoteHead) {
  Fail 'Local main and origin/main are different. Sync first.'
}

Write-Step 'Checking GitHub CLI authentication'
Run gh @('auth', 'status')

Write-Step 'Reading package version'
$version = (node -p "require('./package.json').version").Trim()
if (-not $version) {
  Fail 'Could not read package.json version.'
}
$tag = "v$version"
Write-Host "version: $version"
Write-Host "tag: $tag"

Write-Step 'Checking existing tag and release'
$existingLocalTag = git tag --list $tag
if ($existingLocalTag) {
  Fail "Local tag already exists: $tag"
}

git ls-remote --exit-code --tags origin "refs/tags/$tag" *> $null
if ($LASTEXITCODE -eq 0) {
  Fail "Remote tag already exists: $tag"
}
if ($LASTEXITCODE -ne 2) {
  Fail 'Failed while checking remote tag.'
}

gh release view $tag *> $null
if ($LASTEXITCODE -eq 0) {
  Fail "GitHub Release already exists: $tag"
}

Write-Step 'Building Windows installer'
Run npm.cmd @('run', 'dist:win')

$setupPath = Join-Path $repoRoot "release/ZIP 이미지 뷰어 Setup $version.exe"
$zipPath = Join-Path $repoRoot "release/ZIP 이미지 뷰어-$version-win.zip"
$uploadDir = Join-Path $repoRoot 'release/upload-assets'
$uploadSetupPath = Join-Path $uploadDir "MTC-Setup-$version.exe"
$uploadZipPath = Join-Path $uploadDir "MTC-$version-win.zip"

Write-Step 'Checking release artifacts'
if (-not (Test-Path $setupPath)) {
  Fail "Installer not found: $setupPath"
}
if (-not (Test-Path $zipPath)) {
  Fail "ZIP package not found: $zipPath"
}
Get-Item $setupPath, $zipPath | Select-Object Length, LastWriteTime, FullName | Format-Table -AutoSize

Write-Step 'Preparing GitHub upload asset names'
New-Item -ItemType Directory -Force -Path $uploadDir | Out-Null
Copy-Item -LiteralPath $setupPath -Destination $uploadSetupPath -Force
Copy-Item -LiteralPath $zipPath -Destination $uploadZipPath -Force
Get-Item $uploadSetupPath, $uploadZipPath | Select-Object Length, LastWriteTime, FullName | Format-Table -AutoSize

Write-Step 'Creating and pushing tag'
Run git @('tag', '-a', $tag, '-m', "Release $tag")
Run git @('push', 'origin', $tag)

Write-Step 'Creating GitHub Release and uploading assets'
$notes = @"
## Changes
- Windows installer release

## Assets
- MTC-Setup-$version.exe
- MTC-$version-win.zip
"@

Run gh @(
  'release', 'create', $tag,
  $uploadSetupPath,
  $uploadZipPath,
  '--title', $tag,
  '--notes', $notes
)

Write-Step 'Release result'
Run gh @('release', 'view', $tag)
Write-Host ''
Write-Host "Release completed: $tag" -ForegroundColor Green
