# WEG HomeManager E6 - read-only single-PC Windows preflight.
# Does not create users, firewall rules, ACLs, services, DB roles, or secrets.
[CmdletBinding()]
param(
  [string] $ProjectRoot = "",
  [switch] $Json
)
$ErrorActionPreference = 'Stop'
$checks = [System.Collections.Generic.List[object]]::new()
function Add-Check([string]$Name,[string]$Status,[string]$Reason) {
  $checks.Add([pscustomobject]@{ Check=$Name; Status=$Status; Detail=$Reason })
}
function Local-Listener([int]$Port) {
  @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}
function Bind-Status([int]$Port, [bool]$Required) {
  $listeners = @(Local-Listener $Port)
  if ($listeners.Count -eq 0) {
    Add-Check "port:$Port" $(if ($Required) { 'FAIL' } else { 'WARN' }) 'Port currently not listening; service may be stopped.'
    return
  }
  $nonLocal = @($listeners | Where-Object { $_.LocalAddress -notin @('127.0.0.1','::1') })
  if ($nonLocal.Count -gt 0) {
    Add-Check "port:$Port" 'FAIL' 'Listener is reachable beyond loopback; isolate WEG service.'
  } else {
    Add-Check "port:$Port" 'PASS' 'Listening on loopback only.'
  }
}
function Test-PrivateAcl([string]$Path, [string]$Label) {
  if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
    Add-Check $Label 'WARN' 'Directory not created; verify permissions before real files.'
    return
  }
  try {
    # Direct .NET call also works when the PowerShell.Security module fails to load.
    $acl = [System.IO.Directory]::GetAccessControl($Path)
    $broad = @('S-1-1-0','S-1-5-11','S-1-5-32-545')
    $risky = $false
    $writeMask = [int][System.Security.AccessControl.FileSystemRights]::Write -bor
      [int][System.Security.AccessControl.FileSystemRights]::Modify -bor
      [int][System.Security.AccessControl.FileSystemRights]::FullControl -bor
      [int][System.Security.AccessControl.FileSystemRights]::Delete
    foreach ($rule in $acl.Access) {
      if ($rule.AccessControlType -ne 'Allow') { continue }
      $sid = ''
      try {
        $sid = $rule.IdentityReference.Translate(
          [System.Security.Principal.SecurityIdentifier]).Value
      } catch { continue }
      if ($sid -in $broad -and (([int]$rule.FileSystemRights -band $writeMask) -ne 0)) {
        $risky = $true
      }
    }
    if ($risky) {
      Add-Check $Label 'FAIL' 'Generic Everyone/Users/Authenticated Users can modify this private directory.'
    } else {
      Add-Check $Label 'PASS' 'No broad generic write grants detected (review service identity separately).'
    }
  } catch {
    Add-Check $Label 'WARN' 'ACL could not be evaluated; manual review required.'
  }
}
if (-not $ProjectRoot) { $ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath) }
$root = [IO.Path]::GetFullPath($ProjectRoot)
if (-not (Test-Path -LiteralPath (Join-Path $root 'package.json') -PathType Leaf)) {
  Write-Error 'Not a WEG HomeManager project root.'
  exit 2
}
try {
  $nodeVersion = (& node --version 2>$null).Trim()
  $major = [int]([regex]::Match($nodeVersion,'^v(\d+)').Groups[1].Value)
  if ($major -ge 24) {
    Add-Check 'node-runtime' 'PASS' 'Node.js 24+ supports isolated PDF worker permissions.'
  } else {
    Add-Check 'node-runtime' 'FAIL' 'Node.js 24+ required for PDF worker.'
  }
} catch { Add-Check 'node-runtime' 'FAIL' 'Node.js runtime not detected.' }
$worker = Join-Path $root 'src/server/workers/pdf-inspect-worker.mjs'
$pdfLib = Join-Path $root 'node_modules/pdf-lib/package.json'
if ((Test-Path $worker -PathType Leaf) -and (Test-Path $pdfLib -PathType Leaf)) {
  Add-Check 'worker-assets' 'PASS' 'PDF worker and pdf-lib package available at deployment paths.'
} else {
  Add-Check 'worker-assets' 'FAIL' 'PDF worker or pdf-lib missing from installation.'
}
if (Test-Path (Join-Path $root '.next/BUILD_ID') -PathType Leaf) {
  Add-Check 'next-build' 'PASS' 'Production Next.js build artifacts exist.'
} else {
  Add-Check 'next-build' 'WARN' 'No production Next.js build; run npm run build before installation.'
}
$envPath = Join-Path $root '.env'
if (Test-Path $envPath -PathType Leaf) {
  # Secrets must NEVER be emitted to logs; inspect only flags.
  $envText = [IO.File]::ReadAllText($envPath)
  $dbMatch = [regex]::Match($envText, '(?m)^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?\s*$')
  if (-not $dbMatch.Success) {
    Add-Check 'database-configuration' 'FAIL' 'DATABASE_URL missing from private .env.'
  } else {
    try {
      $uri = [uri]$dbMatch.Groups[1].Value.Trim()
      $userinfo = $uri.UserInfo.Split(':', 2)
      $password = if ($userinfo.Count -ge 2) {
        [uri]::UnescapeDataString($userinfo[1])
      } else { '' }
      if ($uri.Host -notin @('localhost','127.0.0.1') -or $uri.Port -ne 5432) {
        Add-Check 'database-configuration' 'FAIL' 'DATABASE_URL is not loopback:5432.'
      } elseif ($password -in @('', 'havewa', 'postgres', 'password', 'changeme')) {
        Add-Check 'database-configuration' 'FAIL' 'Weak or default database password: rotate before real deployment.'
      } else {
        Add-Check 'database-configuration' 'PASS' 'Local database address and non-demo password configured.'
      }
    } catch {
      Add-Check 'database-configuration' 'FAIL' 'DATABASE_URL invalid; no secret content disclosed.'
    }
  }
  $secret = [regex]::Match($envText, '(?m)^AUTH_SECRET\s*=\s*"?([^"\r\n]+)"?\s*$')
  if (-not $secret.Success -or $secret.Groups[1].Value.Length -lt 32 -or
      $secret.Groups[1].Value -match '(?i)change.?me|default|example|placeholder') {
    Add-Check 'auth-secret' 'FAIL' 'Missing, short or example Auth.js secret.'
  } else {
    Add-Check 'auth-secret' 'PASS' 'Auth.js secret present with expected minimum length.'
  }
} else {
  Add-Check 'database-configuration' 'FAIL' 'Private .env not present.'
  Add-Check 'auth-secret' 'FAIL' 'Private Auth.js environment configuration missing.'
}
Bind-Status 5432 $true
Bind-Status 3000 $false
try {
  $dockerPort = (& docker port havewa-db '5432/tcp' 2>$null) -join ' '
  if ($LASTEXITCODE -ne 0) { throw 'missing container' }
  $published = @($dockerPort -split '\s+' | Where-Object { $_ })
  if ($published.Count -gt 0 -and
      @($published | Where-Object { $_ -notmatch '^(127\.0\.0\.1|\[::1\]):5432$' }).Count -eq 0) {
    Add-Check 'postgres-docker-bind' 'PASS' 'PostgreSQL Docker port is loopback-only.'
  } else {
    Add-Check 'postgres-docker-bind' 'FAIL' 'PostgreSQL Docker binding is not restricted to loopback.'
  }
} catch { Add-Check 'postgres-docker-bind' 'WARN' 'Docker compose database not available for inspection.' }
Test-PrivateAcl (Join-Path $root 'storage/documents') 'evidence-storage-acl'
try {
  $products = @(Get-CimInstance -Namespace 'root/SecurityCenter2' -ClassName AntivirusProduct -ErrorAction Stop)
  if ($products.Count -gt 0) {
    Add-Check 'host-antivirus' 'PASS' 'Windows Security Center lists an AV product (coverage still needs manual test).'
  } else {
    Add-Check 'host-antivirus' 'WARN' 'No AV product reported; verify third-party coverage.'
  }
} catch {
  Add-Check 'host-antivirus' 'WARN' 'AV registration could not be queried; manual check needed.'
}
try {
  if (Get-Command Get-MpPreference -ErrorAction SilentlyContinue) {
    $exclusions = @((Get-MpPreference -ErrorAction Stop).ExclusionPath)
    $storage = [IO.Path]::GetFullPath((Join-Path $root 'storage/documents'))
    $excluded = $false
    foreach ($entry in $exclusions) {
      if (-not $entry) { continue }
      $path = [IO.Path]::GetFullPath($entry)
      if ($storage.StartsWith($path.TrimEnd('\') + '\',[StringComparison]::OrdinalIgnoreCase) -or
          $storage.Equals($path,[StringComparison]::OrdinalIgnoreCase)) { $excluded = $true }
    }
    if ($excluded) {
      Add-Check 'defender-exclusion' 'WARN' 'Evidence storage lies under a Defender exclusion: review.'
    } else {
      Add-Check 'defender-exclusion' 'PASS' 'No direct Defender path exclusion found (not proof of active scanning).'
    }
  }
} catch {
  Add-Check 'defender-exclusion' 'WARN' 'Defender path exclusions unavailable.'
}
try {
  $p = @((Local-Listener 3000) | Select-Object -ExpandProperty OwningProcess -Unique)
  if ($p.Count -eq 0) {
    Add-Check 'service-identity' 'WARN' 'Web app not running: independent service account not verified.'
  } else {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($p[0])" -ErrorAction Stop
    $owner = Invoke-CimMethod -InputObject $process -MethodName GetOwner -ErrorAction Stop
    $currentUser = [Environment]::UserName
    if ($owner.User -ieq $currentUser) {
      Add-Check 'service-identity' 'WARN' 'App runs under current interactive user, not a verified dedicated service account.'
    } else {
      Add-Check 'service-identity' 'WARN' 'Separate owner detected; verify non-admin account and minimum file ACLs manually.'
    }
  }
} catch {
  Add-Check 'service-identity' 'WARN' 'Could not verify WEG service account.'
}
if ($Json) {
  $checks | ConvertTo-Json -Depth 5
} else {
  $checks | Format-Table -AutoSize | Out-String -Width 185 | Write-Output
  Write-Output ("Summary: PASS={0} WARN={1} FAIL={2}" -f
    @($checks | Where-Object Status -eq 'PASS').Count,
    @($checks | Where-Object Status -eq 'WARN').Count,
    @($checks | Where-Object Status -eq 'FAIL').Count)
}
if (@($checks | Where-Object Status -eq 'FAIL').Count -gt 0) { exit 1 }
