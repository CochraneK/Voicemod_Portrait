@echo off
setlocal

set "ROOT=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$root=(Resolve-Path '%ROOT%').Path; $port=8787; while (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { $port++ }; $python=Get-Command python -ErrorAction SilentlyContinue; if (-not $python) { Write-Host 'Python 3 is required.' -ForegroundColor Red; Read-Host 'Press Enter to close'; exit 1 }; Start-Process -WindowStyle Hidden -FilePath $python.Source -ArgumentList @('-m','http.server',[string]$port,'--bind','127.0.0.1') -WorkingDirectory $root; Start-Sleep -Milliseconds 900; Start-Process ('http://127.0.0.1:' + $port + '/')"

endlocal
