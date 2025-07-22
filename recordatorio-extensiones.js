#!/usr/bin/env node

// Script de recordatorio para deshabilitar extensiones problemáticas en VS Code
// Ejecutar: node recordatorio-extensiones.js

const { execSync } = require('child_process');
const os = require('os');

// Colores para la consola
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m'
};

function colorText(text, color) {
    return `${colors[color]}${text}${colors.reset}`;
}

function clearScreen() {
    console.clear();
}

function getProcessCount() {
    try {
        if (os.platform() === 'win32') {
            const output = execSync('Get-Process | Where-Object {$_.ProcessName -like "*Code*"} | Measure-Object | Select-Object -ExpandProperty Count', { encoding: 'utf8', shell: 'powershell' });
            return parseInt(output.trim()) || 0;
        } else {
            const output = execSync('ps aux | grep -i code | grep -v grep | wc -l', { encoding: 'utf8' });
            return parseInt(output.trim()) || 0;
        }
    } catch (error) {
        return 'Error al obtener';
    }
}

function getExtensionCount() {
    try {
        const output = execSync('code --list-extensions', { encoding: 'utf8' });
        return output.trim().split('\n').filter(line => line.trim()).length;
    } catch (error) {
        return 'Error al obtener';
    }
}

function showHeader() {
    console.log(colorText('===============================================', 'yellow'));
    console.log(colorText('🚨 RECORDATORIO: OPTIMIZAR VS CODE', 'red'));
    console.log(colorText('===============================================', 'yellow'));
    console.log('');
}

function showCurrentStatus() {
    const processCount = getProcessCount();
    const extensionCount = getExtensionCount();
    
    console.log(colorText('📊 ESTADO ACTUAL:', 'cyan'));
    console.log(colorText(`   Procesos VS Code: ${processCount}`, 'white'));
    console.log(colorText(`   Extensiones totales: ${extensionCount}`, 'white'));
    console.log('');
    
    if (typeof processCount === 'number' && processCount > 10) {
        console.log(colorText('⚠️  ATENCION: Demasiados procesos VS Code!', 'red'));
        console.log(colorText('   Objetivo: 3-5 procesos máximo', 'yellow'));
        console.log('');
    }
    
    return { processCount, extensionCount };
}

function showProblematicExtensions() {
    console.log(colorText('🎯 EXTENSIONES A DESHABILITAR MANUALMENTE:', 'yellow'));
    console.log(colorText('   (Ctrl+Shift+X - Buscar - Engranaje - Disable Workspace)', 'gray'));
    console.log('');
    
    const problematicExtensions = {
        'Flutter/Dart': {
            high: [
                'dart-code.dart-code',
                'dart-code.flutter'
            ],
            medium: [
                'alexisvt.flutter-snippets',
                'felixangelov.bloc',
                'jeroen-meijer.pubspec-assist',
                'nash.awesome-flutter-snippets',
                'robert-brunhage.flutter-riverpod-snippets'
            ]
        },
        'Docker': {
            high: [
                'docker.docker',
                'ms-azuretools.vscode-docker',
                'ms-azuretools.vscode-containers'
            ],
            medium: []
        },
        'Remote Development': {
            high: [
                'ms-vscode-remote.remote-containers'
            ],
            medium: [
                'ms-vscode-remote.remote-wsl',
                'ms-vscode.remote-explorer',
                'ms-vscode.remote-server'
            ]
        },
        'Colaboración': {
            high: [
                'ms-vsliveshare.vsliveshare'
            ],
            medium: []
        },
        'Testing/Desarrollo': {
            high: [],
            medium: [
                'rangav.vscode-thunder-client',
                'ritwickdey.liveserver',
                'ms-playwright.playwright',
                'octref.vetur'
            ]
        }
    };
    
    for (const [category, extensions] of Object.entries(problematicExtensions)) {
        console.log(colorText(`📁 ${category}:`, 'magenta'));
        
        if (extensions.high.length > 0) {
            console.log(colorText('   🔴 PRIORIDAD ALTA:', 'red'));
            extensions.high.forEach(ext => {
                console.log(colorText(`      ❌ ${ext}`, 'red'));
            });
        }
        
        if (extensions.medium.length > 0) {
            console.log(colorText('   🟡 PRIORIDAD MEDIA:', 'yellow'));
            extensions.medium.forEach(ext => {
                console.log(colorText(`      ⚠️  ${ext}`, 'yellow'));
            });
        }
        console.log('');
    }
}

function showEssentialExtensions() {
    console.log(colorText('✅ EXTENSIONES ESENCIALES (MANTENER):', 'green'));
    
    const essentialExtensions = [
        'github.copilot',
        'github.copilot-chat',
        'juanblanco.solidity',
        'nomicfoundation.hardhat-solidity',
        'svelte.svelte-vscode',
        'esbenp.prettier-vscode',
        'dbaeumer.vscode-eslint',
        'bradlc.vscode-tailwindcss',
        'pkief.material-icon-theme',
        'usernamehw.errorlens'
    ];
    
    essentialExtensions.forEach(ext => {
        console.log(colorText(`   ✓ ${ext}`, 'green'));
    });
    console.log('');
}

function showManualSteps() {
    console.log(colorText('🔧 PASOS MANUALES:', 'cyan'));
    console.log(colorText('   1. Ctrl+Shift+X (abrir Extensions)', 'white'));
    console.log(colorText('   2. Buscar primera extensión de la lista roja', 'white'));
    console.log(colorText('   3. Click en engranaje de la extensión', 'white'));
    console.log(colorText('   4. Seleccionar "Disable (Workspace)"', 'white'));
    console.log(colorText('   5. Repetir para todas las rojas/amarillas', 'white'));
    console.log(colorText('   6. Reiniciar VS Code al terminar', 'white'));
    console.log('');
}

function showConsoleCommands() {
    console.log(colorText('💻 COMANDOS DE CONSOLA ÚTILES:', 'cyan'));
    console.log('');
    
    console.log(colorText('📋 Listar todas las extensiones activas:', 'yellow'));
    console.log(colorText('   code --list-extensions', 'white'));
    console.log('');
    
    console.log(colorText('🔍 Buscar extensiones problemáticas específicas:', 'yellow'));
    if (os.platform() === 'win32') {
        console.log(colorText('   code --list-extensions | findstr /i "dart"', 'white'));
        console.log(colorText('   code --list-extensions | findstr /i "flutter"', 'white'));
        console.log(colorText('   code --list-extensions | findstr /i "docker"', 'white'));
        console.log(colorText('   code --list-extensions | findstr /i "remote"', 'white'));
        console.log(colorText('   code --list-extensions | findstr /i "live"', 'white'));
    } else {
        console.log(colorText('   code --list-extensions | grep -i dart', 'white'));
        console.log(colorText('   code --list-extensions | grep -i flutter', 'white'));
        console.log(colorText('   code --list-extensions | grep -i docker', 'white'));
        console.log(colorText('   code --list-extensions | grep -i remote', 'white'));
        console.log(colorText('   code --list-extensions | grep -i live', 'white'));
    }
    console.log('');
    
    console.log(colorText('📊 Contar extensiones totales:', 'yellow'));
    if (os.platform() === 'win32') {
        console.log(colorText('   (code --list-extensions).Count', 'white'));
    } else {
        console.log(colorText('   code --list-extensions | wc -l', 'white'));
    }
    console.log('');
    
    console.log(colorText('🔢 Contar procesos VS Code:', 'yellow'));
    if (os.platform() === 'win32') {
        console.log(colorText('   Get-Process | Where-Object {$_.ProcessName -like "*Code*"} | Measure-Object', 'white'));
    } else {
        console.log(colorText('   ps aux | grep -i code | grep -v grep | wc -l', 'white'));
    }
    console.log('');
    
    console.log(colorText('❌ Deshabilitar extensión específica:', 'yellow'));
    console.log(colorText('   code --disable-extension dart-code.dart-code', 'white'));
    console.log(colorText('   code --disable-extension docker.docker', 'white'));
    console.log('');
}

function showObjective(processCount) {
    console.log(colorText('📈 OBJETIVO:', 'green'));
    console.log(colorText(`   • Procesos: ${processCount} → 3-5`, 'cyan'));
    console.log(colorText('   • RAM: Reducir significativamente', 'cyan'));
    console.log(colorText('   • Velocidad: Arranque más rápido', 'cyan'));
    console.log('');
}

function showTips() {
    console.log(colorText('===============================================', 'yellow'));
    console.log(colorText('💡 TIPS:', 'gray'));
    console.log(colorText('   • Ejecuta este script cuando VS Code vaya lento', 'gray'));
    console.log(colorText('   • Prioriza las extensiones marcadas en ROJO', 'gray'));
    console.log(colorText('   • Siempre usa "Disable (Workspace)" no "Disable"', 'gray'));
    console.log(colorText('   • Reinicia VS Code después de deshabilitar', 'gray'));
    console.log(colorText('===============================================', 'yellow'));
}

async function promptUser() {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise((resolve) => {
        readline.question('¿Abrir VS Code con panel de Extensions? (y/n): ', (answer) => {
            readline.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

async function main() {
    clearScreen();
    showHeader();
    
    const { processCount } = showCurrentStatus();
    showProblematicExtensions();
    showEssentialExtensions();
    showManualSteps();
    showConsoleCommands();
    showObjective(processCount);
    showTips();
    
    console.log('');
    const shouldOpen = await promptUser();
    
    if (shouldOpen) {
        console.log(colorText('Abriendo VS Code con panel de extensiones...', 'green'));
        try {
            execSync('code --command workbench.view.extensions');
            console.log(colorText('💡 Busca "dart-code.dart-code" y deshabilítala primero', 'yellow'));
        } catch (error) {
            console.log(colorText('Error al abrir VS Code. Ábrelo manualmente con Ctrl+Shift+X', 'red'));
        }
    }
    
    console.log(colorText('\n¡Buena suerte optimizando VS Code! 🚀', 'green'));
}

// Ejecutar el script
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    showCurrentStatus,
    getProcessCount,
    getExtensionCount
};
