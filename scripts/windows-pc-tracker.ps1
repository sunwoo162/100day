param(
  [string]$ApiBase = "http://localhost:4000/api",
  [string]$PairingToken = "",
  [string]$ConfigPath = "$env:USERPROFILE\.harufit-tracker.json",
  [int]$IntervalSeconds = 60,
  [int]$IdleLimitSeconds = 180
)

$ErrorActionPreference = "Stop"

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class Win32Tracker {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  [StructLayout(LayoutKind.Sequential)]
  public struct LASTINPUTINFO {
    public uint cbSize;
    public uint dwTime;
  }

  [DllImport("user32.dll")]
  public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

  [DllImport("kernel32.dll")]
  public static extern uint GetTickCount();
}
"@

function Read-Config {
  if (Test-Path $ConfigPath) {
    return Get-Content $ConfigPath -Raw | ConvertFrom-Json
  }
  return [pscustomobject]@{}
}

function Save-Config($config) {
  $config | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 $ConfigPath
}

function Get-IdleSeconds {
  $info = New-Object Win32Tracker+LASTINPUTINFO
  $info.cbSize = [Runtime.InteropServices.Marshal]::SizeOf($info)
  [Win32Tracker]::GetLastInputInfo([ref]$info) | Out-Null
  return [math]::Floor(([Win32Tracker]::GetTickCount() - $info.dwTime) / 1000)
}

function Get-ActiveAppName {
  $handle = [Win32Tracker]::GetForegroundWindow()
  if ($handle -eq [IntPtr]::Zero) { return "Unknown" }

  $processId = [uint32]0
  [Win32Tracker]::GetWindowThreadProcessId($handle, [ref]$processId) | Out-Null
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if (-not $process) { return "Unknown" }

  $name = $process.ProcessName
  switch -Regex ($name) {
    "^(Code|Cursor)$" { return "VS Code" }
    "^(chrome|msedge|firefox|brave|whale)$" { return "Chrome" }
    "^(WindowsTerminal|powershell|pwsh|cmd)$" { return "Terminal" }
    "^(devenv)$" { return "Visual Studio" }
    "^(idea64|webstorm64|pycharm64|rider64)$" { return "JetBrains" }
    "^(Discord)$" { return "Discord" }
    default { return $name }
  }
}

function Connect-Device($token) {
  $body = @{ token = $token } | ConvertTo-Json
  return Invoke-RestMethod -Method Post -Uri "$ApiBase/devices/connect" -ContentType "application/json" -Body $body
}

function Send-Usage($deviceToken, $appName, $minutes) {
  if ($minutes -le 0) { return }
  $body = @{
    app_name = $appName
    minutes = $minutes
    occurred_at = (Get-Date).ToUniversalTime().ToString("o")
  } | ConvertTo-Json

  Invoke-RestMethod `
    -Method Post `
    -Uri "$ApiBase/track/pc" `
    -Headers @{ Authorization = "Bearer $deviceToken" } `
    -ContentType "application/json" `
    -Body $body | Out-Null
}

$config = Read-Config

if ($PairingToken) {
  $device = Connect-Device $PairingToken
  $config = [pscustomobject]@{
    apiBase = $ApiBase
    deviceToken = $device.device_token
    deviceName = $device.name
    connectedAt = (Get-Date).ToUniversalTime().ToString("o")
  }
  Save-Config $config
  Write-Host "Harufit tracker connected: $($device.name)"
}

if (-not $config.deviceToken) {
  Write-Host "Pairing token is required."
  Write-Host "Example: pwsh scripts/windows-pc-tracker.ps1 -PairingToken YOUR_CODE"
  exit 1
}

if ($config.apiBase) {
  $ApiBase = $config.apiBase
}

Write-Host "Harufit PC tracker is running. Press Ctrl+C to stop."

$activeApp = $null
$activeSince = Get-Date

function Flush-ActiveUsage {
  if (-not $activeApp) { return $false }
  $elapsedMinutes = ((Get-Date) - $activeSince).TotalMinutes
  if ($elapsedMinutes -lt 0.01) { return $false }
  $roundedMinutes = [math]::Round($elapsedMinutes, 2)
  $nowText = Get-Date -Format "HH:mm:ss"
  Send-Usage $config.deviceToken $activeApp $roundedMinutes
  Write-Host ("{0} recorded: {1} {2} min" -f $nowText, $activeApp, $roundedMinutes)
  return $true
}

while ($true) {
  try {
    $idleSeconds = Get-IdleSeconds
    if ($idleSeconds -lt $IdleLimitSeconds) {
      $appName = Get-ActiveAppName
      if ($activeApp -and $activeApp -ne $appName) {
        Flush-ActiveUsage
        $activeSince = Get-Date
      }
      $activeApp = $appName
      if (((Get-Date) - $activeSince).TotalSeconds -ge $IntervalSeconds) {
        if (Flush-ActiveUsage) {
          $activeSince = Get-Date
        }
      }
      $nowText = Get-Date -Format "HH:mm:ss"
      Write-Host ("{0} tracking: {1}" -f $nowText, $appName)
    } else {
      Flush-ActiveUsage
      $activeApp = $null
      $activeSince = Get-Date
      $nowText = Get-Date -Format "HH:mm:ss"
      Write-Host ("{0} idle: not recorded" -f $nowText)
    }
  } catch {
    Write-Warning $_.Exception.Message
  }
  Start-Sleep -Seconds $IntervalSeconds
}
