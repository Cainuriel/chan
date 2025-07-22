# RECORDATORIO: DESHABILITAR EXTENSIONES PROBLEMATICAS
# Ejecutar: .\recordatorio-extensiones-simple.ps1

Clear-Host
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host "RECORDATORIO: OPTIMIZAR VS CODE" -ForegroundColor Red
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host ""

# Mostrar estado actual
$processCount = (Get-Process | Where-Object {$_.ProcessName -like "*Code*"}).Count
$totalExtensions = (code --list-extensions).Count

Write-Host "ESTADO ACTUAL:" -ForegroundColor Cyan
Write-Host "   Procesos VS Code: $processCount" -ForegroundColor White
Write-Host "   Extensiones totales: $totalExtensions" -ForegroundColor White
Write-Host ""

if ($processCount -gt 10) {
    Write-Host "ATENCION: Demasiados procesos VS Code!" -ForegroundColor Red
    Write-Host "Objetivo: 3-5 procesos maximo" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "EXTENSIONES A DESHABILITAR MANUALMENTE:" -ForegroundColor Yellow
Write-Host "(Ctrl+Shift+X > Buscar > Engranaje > Disable Workspace)" -ForegroundColor Gray
Write-Host ""

Write-Host "PRIORIDAD ALTA (deshabilitar primero):" -ForegroundColor Red
Write-Host "   - dart-code.dart-code" -ForegroundColor Red
Write-Host "   - dart-code.flutter" -ForegroundColor Red  
Write-Host "   - docker.docker" -ForegroundColor Red
Write-Host "   - ms-azuretools.vscode-docker" -ForegroundColor Red
Write-Host "   - ms-vscode-remote.remote-containers" -ForegroundColor Red
Write-Host "   - ms-vsliveshare.vsliveshare" -ForegroundColor Red
Write-Host ""

Write-Host "PRIORIDAD MEDIA (deshabilitar si tienes tiempo):" -ForegroundColor Yellow
Write-Host "   - alexisvt.flutter-snippets" -ForegroundColor Yellow
Write-Host "   - felixangelov.bloc" -ForegroundColor Yellow
Write-Host "   - jeroen-meijer.pubspec-assist" -ForegroundColor Yellow
Write-Host "   - nash.awesome-flutter-snippets" -ForegroundColor Yellow
Write-Host "   - robert-brunhage.flutter-riverpod-snippets" -ForegroundColor Yellow
Write-Host "   - ms-azuretools.vscode-containers" -ForegroundColor Yellow
Write-Host "   - ms-vscode-remote.remote-wsl" -ForegroundColor Yellow
Write-Host "   - ms-vscode.remote-explorer" -ForegroundColor Yellow
Write-Host "   - octref.vetur" -ForegroundColor Yellow
Write-Host "   - rangav.vscode-thunder-client" -ForegroundColor Yellow
Write-Host "   - ritwickdey.liveserver" -ForegroundColor Yellow
Write-Host "   - ms-playwright.playwright" -ForegroundColor Yellow
Write-Host ""

Write-Host "EXTENSIONES ESENCIALES (NO TOCAR):" -ForegroundColor Green
Write-Host "   - github.copilot" -ForegroundColor Green
Write-Host "   - github.copilot-chat" -ForegroundColor Green
Write-Host "   - juanblanco.solidity" -ForegroundColor Green
Write-Host "   - nomicfoundation.hardhat-solidity" -ForegroundColor Green
Write-Host "   - svelte.svelte-vscode" -ForegroundColor Green
Write-Host "   - esbenp.prettier-vscode" -ForegroundColor Green
Write-Host "   - dbaeumer.vscode-eslint" -ForegroundColor Green
Write-Host "   - bradlc.vscode-tailwindcss" -ForegroundColor Green
Write-Host "   - pkief.material-icon-theme" -ForegroundColor Green
Write-Host "   - usernamehw.errorlens" -ForegroundColor Green
Write-Host ""

Write-Host "PASOS MANUALES:" -ForegroundColor Cyan
Write-Host "   1. Ctrl+Shift+X (abrir Extensions)" -ForegroundColor White
Write-Host "   2. Buscar 'dart-code.dart-code'" -ForegroundColor White
Write-Host "   3. Click en engranaje de la extension" -ForegroundColor White
Write-Host "   4. Seleccionar 'Disable (Workspace)'" -ForegroundColor White
Write-Host "   5. Repetir para todas las de PRIORIDAD ALTA" -ForegroundColor White
Write-Host "   6. Reiniciar VS Code al terminar" -ForegroundColor White
Write-Host ""

Write-Host "OBJETIVO DESPUES DE DESHABILITAR:" -ForegroundColor Green
Write-Host "   • Procesos: $processCount -> 3-5" -ForegroundColor Cyan
Write-Host "   • RAM: Reducir significativamente" -ForegroundColor Cyan
Write-Host "   • Velocidad: Arranque mas rapido" -ForegroundColor Cyan
Write-Host ""

Write-Host "=============================================" -ForegroundColor Yellow
Write-Host "TIP: Ejecuta este script cuando VS Code vaya lento" -ForegroundColor Gray
Write-Host "=============================================" -ForegroundColor Yellow

# Preguntar si quiere abrir Extensions
Write-Host ""
$response = Read-Host "Abrir VS Code con panel de Extensions? (y/n)"
if ($response -eq "y" -or $response -eq "Y") {
    Write-Host "Abriendo Extensions..." -ForegroundColor Green
    code --command workbench.view.extensions
    Write-Host "Busca 'dart-code.dart-code' y deshabilitala primero" -ForegroundColor Yellow
}
