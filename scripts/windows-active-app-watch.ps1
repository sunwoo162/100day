param(
  [int]$IntervalSeconds = 30,
  [int]$IdleLimitSeconds = 180
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class HarufitActiveWindowWatch {
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

function Get-ActiveAppSnapshot {
  $info = New-Object HarufitActiveWindowWatch+LASTINPUTINFO
  $info.cbSize = [Runtime.InteropServices.Marshal]::SizeOf($info)
  [HarufitActiveWindowWatch]::GetLastInputInfo([ref]$info) | Out-Null
  $idleSeconds = [math]::Floor(([HarufitActiveWindowWatch]::GetTickCount() - $info.dwTime) / 1000)

  $handle = [HarufitActiveWindowWatch]::GetForegroundWindow()
  $processName = "Unknown"
  $windowTitle = ""

  if ($handle -ne [IntPtr]::Zero) {
    $processId = [uint32]0
    [HarufitActiveWindowWatch]::GetWindowThreadProcessId($handle, [ref]$processId) | Out-Null
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($process) {
      $processName = $process.ProcessName
    }

    $title = New-Object System.Text.StringBuilder 256
    [HarufitActiveWindowWatch]::GetWindowText($handle, $title, $title.Capacity) | Out-Null
    $windowTitle = $title.ToString().Trim()
  }

  @{
    processName = $processName
    windowTitle = $windowTitle
    appName = $processName
    idleSeconds = $idleSeconds
    intervalSeconds = $IntervalSeconds
    active = $idleSeconds -lt $IdleLimitSeconds
  } | ConvertTo-Json -Compress
}

while ($true) {
  try {
    Get-ActiveAppSnapshot
    [Console]::Out.Flush()
  } catch {
    @{ error = $_.Exception.Message } | ConvertTo-Json -Compress
    [Console]::Out.Flush()
  }
  Start-Sleep -Seconds $IntervalSeconds
}
