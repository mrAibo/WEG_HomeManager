# WEG HomeManager local Windows launcher (Docker not required for the app).
# Requires an existing PostgreSQL server, whether Windows-native or Docker test DB.
# Does not install, stop, start, or modify PostgreSQL, Docker, host accounts or firewall.
[CmdletBinding()]
param(
  [switch] $Dev,
  [switch] $OpenBrowser
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
Set-Location -LiteralPath $root
try {
  $nodeVersion = (& node --version 2>$null).Trim()
  if ($nodeVersion -notmatch '^v(\d+)\.') { throw "Node.js nicht gefunden" }
  if ([int]$Matches[1] -lt 24) { throw "Node.js 24+ erforderlich" }
  if (-not (Test-Path -LiteralPath (Join-Path $root ".env") -PathType Leaf)) {
    throw "Private .env nicht gefunden; zuerst lokale Einrichtung abschließen"
  }
  $listener = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
  if ($listener.Count -gt 0) {
    Write-Host "WEG HomeManager läuft bereits auf http://127.0.0.1:3000/de/login"
    if ($OpenBrowser) { Start-Process "http://127.0.0.1:3000/de/login" }
    exit 0
  }
  $db = @(Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue)
  if ($db.Count -eq 0) {
    throw "PostgreSQL nicht erreichbar unter localhost:5432. Windows PostgreSQL-Dienst starten oder vorhandene Testdatenbank."
  }
  if (-not $Dev -and -not (Test-Path -LiteralPath (Join-Path $root ".next/BUILD_ID") -PathType Leaf)) {
    throw "Kein Next.js Production Build. Erst 'npm run build' ausführen."
  }
  Write-Host "WEG HomeManager: http://127.0.0.1:3000/de/login"
  Write-Host "Zum Beenden Ctrl+C. Datenbank wird dabei nicht beendet."
  if ($OpenBrowser) { Start-Process "http://127.0.0.1:3000/de/login" }
  if ($Dev) { & npm.cmd run dev -- -H 127.0.0.1 -p 3000 }
  else { & npm.cmd run start -- -H 127.0.0.1 -p 3000 }
  exit $LASTEXITCODE
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
