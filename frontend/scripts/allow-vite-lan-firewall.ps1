# Allow Vite dev/preview ports through Windows Firewall (Private networks only).
# Right-click PowerShell -> Run as administrator, then:
#   cd C:\xamppp\htdocs\digital_agency\frontend
#   .\scripts\allow-vite-lan-firewall.ps1

$ErrorActionPreference = 'Stop'
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host "ERROR: Run PowerShell as Administrator (needed to add firewall rules)." -ForegroundColor Red
  exit 1
}

$ports = @(5173, 4173)
foreach ($p in $ports) {
  $name = "FlowPilot Vite TCP $p (LAN dev)"
  $existing = Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "Rule already exists: $name"
    continue
  }
  New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow -Protocol TCP -LocalPort $p -Profile Private -EdgeTraversalPolicy Block | Out-Null
  Write-Host "Added firewall rule: $name (TCP $p, Private profile)"
}

Write-Host ""
Write-Host "Done. On your phone use: http://<THIS_PC_IP>:5173" -ForegroundColor Green
Write-Host "Find IP: ipconfig -> IPv4 Address" -ForegroundColor Gray
