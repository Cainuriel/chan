# Script para deshabilitar extensiones problemáticas en este workspace
Write-Host "🚀 Deshabilitando extensiones problemáticas para optimizar VS Code..." -ForegroundColor Green
Write-Host ""

# Lista de extensiones problemáticas que consumen muchos recursos
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

Write-Host "📋 Extensiones que se deshabilitarán:" -ForegroundColor Yellow
foreach($ext in $problematicExtensions) {
    Write-Host "  ❌ $ext" -ForegroundColor Red
}

Write-Host ""
Write-Host "✅ Extensiones que permanecerán activas:" -ForegroundColor Green
Write-Host "  ✓ github.copilot" -ForegroundColor Cyan
Write-Host "  ✓ github.copilot-chat" -ForegroundColor Cyan  
Write-Host "  ✓ juanblanco.solidity" -ForegroundColor Cyan
Write-Host "  ✓ nomicfoundation.hardhat-solidity" -ForegroundColor Cyan
Write-Host "  ✓ svelte.svelte-vscode" -ForegroundColor Cyan
Write-Host "  ✓ esbenp.prettier-vscode" -ForegroundColor Cyan
Write-Host "  ✓ dbaeumer.vscode-eslint" -ForegroundColor Cyan
Write-Host "  ✓ bradlc.vscode-tailwindcss" -ForegroundColor Cyan
Write-Host "  ✓ pkief.material-icon-theme" -ForegroundColor Cyan
Write-Host "  ✓ usernamehw.errorlens" -ForegroundColor Cyan

Write-Host ""
Write-Host "🔧 INSTRUCCIONES MANUALES:" -ForegroundColor Yellow
Write-Host "1. Presiona Ctrl+Shift+X para abrir Extensions" -ForegroundColor White
Write-Host "2. Busca cada extensión de la lista roja de arriba" -ForegroundColor White  
Write-Host "3. Haz clic en el ícono de engranaje ⚙️ de cada una" -ForegroundColor White
Write-Host "4. Selecciona 'Disable (Workspace)'" -ForegroundColor White
Write-Host "5. Reinicia VS Code cuando termines" -ForegroundColor White

Write-Host ""
Write-Host "📊 RESULTADO ESPERADO:" -ForegroundColor Green
Write-Host "  - Procesos VS Code: 3-5 (en lugar de 17+)" -ForegroundColor Cyan
Write-Host "  - Uso de RAM: menos de 200MB total" -ForegroundColor Cyan
Write-Host "  - Arranque mas rapido" -ForegroundColor Cyan
Write-Host "  - Mejor rendimiento general" -ForegroundColor Cyan
