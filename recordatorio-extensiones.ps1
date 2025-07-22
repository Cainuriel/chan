# Script de recordatorio para deshabilitar extensiones problematicas manualmente
# Ejecutar: .\recordatorio-extensiones.ps1

Clear-Host
Write-Host "===============================================" -ForegroundColor Yellow
Write-Host "🚨 RECORDATORIO: OPTIMIZAR VS CODE" -ForegroundColor Red
Write-Host "===============================================" -ForegroundColor Yellow
Write-Host ""

# Mostrar estado actual
$processCount = (Get-Process | Where-Object {$_.ProcessName -like "*Code*"}).Count
$totalExtensions = (code --list-extensions).Count

Write-Host "📊 ESTADO ACTUAL:" -ForegroundColor Cyan
Write-Host "   Procesos VS Code: $processCount" -ForegroundColor White
Write-Host "   Extensiones totales: $totalExtensions" -ForegroundColor White
Write-Host ""

if ($processCount -gt 10) {
    Write-Host "⚠️  ATENCION: Demasiados procesos VS Code!" -ForegroundColor Red
    Write-Host "   Objetivo: 3-5 procesos maximo" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "🎯 EXTENSIONES A DESHABILITAR MANUALMENTE:" -ForegroundColor Yellow
Write-Host "   (Ctrl+Shift+X - Buscar - Engranaje - Disable Workspace)" -ForegroundColor Gray
Write-Host ""

# Lista de extensiones problematicas con instrucciones claras
$problematicExtensions = @(
    @{Name="dart-code.dart-code"; Category="Flutter/Dart"; Priority="ALTA"},
    @{Name="dart-code.flutter"; Category="Flutter/Dart"; Priority="ALTA"},
    @{Name="alexisvt.flutter-snippets"; Category="Flutter/Dart"; Priority="MEDIA"},
    @{Name="felixangelov.bloc"; Category="Flutter/Dart"; Priority="MEDIA"},
    @{Name="jeroen-meijer.pubspec-assist"; Category="Flutter/Dart"; Priority="MEDIA"},
    @{Name="nash.awesome-flutter-snippets"; Category="Flutter/Dart"; Priority="MEDIA"},
    @{Name="robert-brunhage.flutter-riverpod-snippets"; Category="Flutter/Dart"; Priority="MEDIA"},
    @{Name="docker.docker"; Category="Docker"; Priority="ALTA"},
    @{Name="ms-azuretools.vscode-docker"; Category="Docker"; Priority="ALTA"},
    @{Name="ms-azuretools.vscode-containers"; Category="Docker"; Priority="ALTA"},
    @{Name="ms-vscode-remote.remote-containers"; Category="Remote"; Priority="ALTA"},
    @{Name="ms-vscode-remote.remote-wsl"; Category="Remote"; Priority="MEDIA"},
    @{Name="ms-vscode.remote-explorer"; Category="Remote"; Priority="MEDIA"},
    @{Name="ms-vscode.remote-server"; Category="Remote"; Priority="MEDIA"},
    @{Name="ms-vsliveshare.vsliveshare"; Category="Colaboracion"; Priority="ALTA"},
    @{Name="octref.vetur"; Category="Conflicto"; Priority="MEDIA"},
    @{Name="rangav.vscode-thunder-client"; Category="Testing"; Priority="MEDIA"},
    @{Name="ritwickdey.liveserver"; Category="Desarrollo"; Priority="MEDIA"},
    @{Name="ms-playwright.playwright"; Category="Testing"; Priority="MEDIA"}
)

# Agrupar por categoria y prioridad
$categories = $problematicExtensions | Group-Object Category
foreach ($category in $categories) {
    $categoryName = $category.Name
    $highPriority = $category.Group | Where-Object {$_.Priority -eq "ALTA"}
    $mediumPriority = $category.Group | Where-Object {$_.Priority -eq "MEDIA"}
    
    Write-Host "📁 $($categoryName):" -ForegroundColor Magenta
    
    if ($highPriority) {
        Write-Host "   🔴 PRIORIDAD ALTA:" -ForegroundColor Red
        foreach ($ext in $highPriority) {
            Write-Host "      ❌ $($ext.Name)" -ForegroundColor Red
        }
    }
    
    if ($mediumPriority) {
        Write-Host "   🟡 PRIORIDAD MEDIA:" -ForegroundColor Yellow
        foreach ($ext in $mediumPriority) {
            Write-Host "      ⚠️  $($ext.Name)" -ForegroundColor Yellow
        }
    }
    Write-Host ""
}

Write-Host "✅ EXTENSIONES ESENCIALES (MANTENER):" -ForegroundColor Green
$essentialExtensions = @(
    "github.copilot",
    "github.copilot-chat", 
    "juanblanco.solidity",
    "nomicfoundation.hardhat-solidity",
    "svelte.svelte-vscode",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "pkief.material-icon-theme",
    "usernamehw.errorlens"
)

foreach ($ext in $essentialExtensions) {
    Write-Host "   ✓ $ext" -ForegroundColor Green
}

Write-Host ""
Write-Host "🔧 PASOS MANUALES:" -ForegroundColor Cyan
Write-Host "   1. Ctrl+Shift+X (abrir Extensions)" -ForegroundColor White
Write-Host "   2. Buscar primera extension de la lista roja" -ForegroundColor White
Write-Host "   3. Click en engranaje de la extension" -ForegroundColor White
Write-Host "   4. Seleccionar 'Disable (Workspace)'" -ForegroundColor White
Write-Host "   5. Repetir para todas las rojas/amarillas" -ForegroundColor White
Write-Host "   6. Reiniciar VS Code al terminar" -ForegroundColor White
Write-Host ""

Write-Host "📈 OBJETIVO:" -ForegroundColor Green
Write-Host "   • Procesos: $processCount → 3-5" -ForegroundColor Cyan
Write-Host "   • RAM: Reducir significativamente" -ForegroundColor Cyan
Write-Host "   • Velocidad: Arranque mas rapido" -ForegroundColor Cyan
Write-Host ""

Write-Host "===============================================" -ForegroundColor Yellow
Write-Host "💡 TIP: Ejecuta este script cada vez que notes" -ForegroundColor Gray
Write-Host "    que VS Code va lento o tiene muchos procesos" -ForegroundColor Gray
Write-Host "===============================================" -ForegroundColor Yellow

# Preguntar si quiere abrir VS Code con la lista de extensiones
Write-Host ""
$response = Read-Host "¿Abrir VS Code con Extensions panel? (y/n)"
if ($response -eq "y" -or $response -eq "Y" -or $response -eq "yes") {
    Write-Host "Abriendo VS Code con panel de extensiones..." -ForegroundColor Green
    code --command workbench.view.extensions
}
