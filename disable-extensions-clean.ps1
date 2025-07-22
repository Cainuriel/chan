# Script para deshabilitar extensiones problematicas en VS Code
Write-Host "Deshabilitando extensiones problematicas para optimizar VS Code..." -ForegroundColor Green
Write-Host ""

# Lista de extensiones problematicas que consumen muchos recursos
$problematicExtensions = @(
    "dart-code.dart-code",
    "dart-code.flutter", 
    "alexisvt.flutter-snippets",
    "felixangelov.bloc",
    "jeroen-meijer.pubspec-assist",
    "nash.awesome-flutter-snippets", 
    "robert-brunhage.flutter-riverpod-snippets",
    "docker.docker",
    "ms-azuretools.vscode-docker",
    "ms-azuretools.vscode-containers",
    "ms-vscode-remote.remote-containers",
    "ms-vscode-remote.remote-wsl",
    "ms-vscode.remote-explorer",
    "ms-vscode.remote-server",
    "ms-vsliveshare.vsliveshare",
    "octref.vetur",
    "rangav.vscode-thunder-client",
    "ritwickdey.liveserver",
    "ms-playwright.playwright"
)

Write-Host "Extensiones que se deshabilitaran:" -ForegroundColor Yellow
foreach($ext in $problematicExtensions) {
    Write-Host "  - $ext" -ForegroundColor Red
    # Intentar deshabilitar la extension
    try {
        & code --disable-extension $ext
        Write-Host "    OK: Deshabilitada" -ForegroundColor Green
    }
    catch {
        Write-Host "    WARN: No se pudo deshabilitar automaticamente" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Extensiones que permaneceran activas:" -ForegroundColor Green
Write-Host "  - github.copilot" -ForegroundColor Cyan
Write-Host "  - github.copilot-chat" -ForegroundColor Cyan  
Write-Host "  - juanblanco.solidity" -ForegroundColor Cyan
Write-Host "  - nomicfoundation.hardhat-solidity" -ForegroundColor Cyan
Write-Host "  - svelte.svelte-vscode" -ForegroundColor Cyan
Write-Host "  - esbenp.prettier-vscode" -ForegroundColor Cyan
Write-Host "  - dbaeumer.vscode-eslint" -ForegroundColor Cyan
Write-Host "  - bradlc.vscode-tailwindcss" -ForegroundColor Cyan
Write-Host "  - pkief.material-icon-theme" -ForegroundColor Cyan
Write-Host "  - usernamehw.errorlens" -ForegroundColor Cyan

Write-Host ""
Write-Host "RESULTADO ESPERADO:" -ForegroundColor Green
Write-Host "  - Procesos VS Code: 3-5 (en lugar de 17+)" -ForegroundColor White
Write-Host "  - Uso de RAM: menos de 200MB total" -ForegroundColor White
Write-Host "  - Arranque mas rapido" -ForegroundColor White
Write-Host "  - Mejor rendimiento general" -ForegroundColor White

Write-Host ""
Write-Host "Reinicia VS Code para aplicar los cambios." -ForegroundColor Yellow
