param(
  [string]$ApiBase = "http://localhost:4000/api",
  [string]$PairingToken = "",
  [string]$ConfigPath = "$env:USERPROFILE\.harufit-tracker.json",
  [int]$IntervalSeconds = 1,
  [int]$IdleLimitSeconds = 180,
  [switch]$InstallStartup
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

function Install-StartupTask {
  $scriptPath = $PSCommandPath
  $action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`" -ConfigPath `"$ConfigPath`" -ApiBase `"$ApiBase`" -IntervalSeconds $IntervalSeconds -IdleLimitSeconds $IdleLimitSeconds"
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
  Register-ScheduledTask -TaskName "Harufit PC Tracker" -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
  Write-Host "Windows 시작 시 하루핏 PC 트래커가 자동 실행되도록 등록했습니다."
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

  $title = New-Object System.Text.StringBuilder 256
  [Win32Tracker]::GetWindowText($handle, $title, $title.Capacity) | Out-Null
  $windowTitle = $title.ToString().Trim()
  if ($windowTitle) {
    return "$($process.ProcessName) - $windowTitle"
  }
  return $process.ProcessName
}

function Connect-Device($token) {
  $body = @{ token = $token } | ConvertTo-Json
  return Invoke-RestMethod -Method Post -Uri "$ApiBase/devices/connect" -ContentType "application/json" -Body $body
}

function Send-Usage($deviceToken, $appName, $minutes) {
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
  Write-Host "하루핏 트래커 연결 완료: $($device.name)"
}

if ($InstallStartup) {
  Install-StartupTask
}

if (-not $config.deviceToken) {
  Write-Host "기기 연결 코드가 필요합니다."
  Write-Host "예: pwsh scripts/windows-pc-tracker.ps1 -PairingToken 연결코드"
  exit 1
}

if ($config.apiBase) {
  $ApiBase = $config.apiBase
}

Write-Host "하루핏 PC 트래커 실행 중. 중지하려면 Ctrl+C를 누르세요."

while ($true) {
  try {
    $idleSeconds = Get-IdleSeconds
    if ($idleSeconds -lt $IdleLimitSeconds) {
      $appName = Get-ActiveAppName
      Send-Usage $config.deviceToken $appName ([math]::Max(0.0167, $IntervalSeconds / 60))
      Write-Host "$(Get-Date -Format HH:mm:ss) 기록: $appName"
    } else {
      Write-Host "$(Get-Date -Format HH:mm:ss) 유휴 상태라 기록하지 않음"
    }
  } catch {
    Write-Warning $_.Exception.Message
  }
  Start-Sleep -Seconds $IntervalSeconds
}
