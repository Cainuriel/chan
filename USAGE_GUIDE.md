# 🔐 Guía de Uso - UTXO Manager con BBS+ Privacy

## 📋 Resumen

Esta aplicación implementa un sistema UTXO privado usando **BBS+ signatures** y **selective disclosure** para mantener la privacidad de las transacciones mientras permite verificación criptográfica.

## 🚀 Configuración Inicial

### 1. **Requisitos Previos**
- MetaMask instalado y configurado
- Conexión a red de prueba (Polygon Amoy)
- Tokens ERC20 para pruebas

### 2. **Inicialización Automática**
- La aplicación auto-configura los **BBS+ issuers** cuando detecta un nuevo token
- No requiere configuración manual previa
- Compatible con cualquier token ERC20

## 🔒 Características de Privacidad

### **BBS+ Signatures**
- **Selective Disclosure**: Solo revela atributos específicos según la operación
- **Zero-Knowledge Proofs**: Prueba ownership sin revelar valores
- **Unlinkability**: Las transacciones no pueden ser vinculadas fácilmente

### **Commitments Criptográficos**
- **Pedersen Commitments**: Ocultan cantidades mientras permiten verificación
- **Range Proofs**: Prueban que valores están en rangos válidos (> 0)
- **Equality Proofs**: Verifican que sum(inputs) = sum(outputs) sin revelar valores

## 📱 Uso de la Aplicación

### **Paso 1: Conexión**
1. Abrir la aplicación
2. Hacer clic en **"Get Started"** o conectar metamask
4. Verificar conexión exitosa

### **Paso 2: Depósito Privado**
1. Ir a la pestaña **"Deposit"**
2. Seleccionar token ERC20
3. Ingresar cantidad a depositar
4. **Activar Privacy Mode** (recomendado)
5. Confirmar transacción en MetaMask

**¿Qué sucede internamente?**
- Se auto-configura BBS+ issuer para el token
- Se genera Pedersen commitment ocultando la cantidad
- Se crea BBS+ credential con selective disclosure
- Se almacena UTXO privado en blockchain

### **Paso 3: Operaciones Privadas**

#### **Transfer Privado**
1. Pestaña **"Operations"** → **"Transfer"**
2. Seleccionar UTXO origen
3. Ingresar dirección destino
4. Especificar cantidad
5. La transacción ocultará:
   - ✅ Cantidad exacta transferida
   - ✅ Saldo restante
   - ❌ Solo revela: direcciones origen/destino

#### **Split de UTXO**
1. **"Operations"** → **"Split"**
2. Seleccionar UTXO a dividir
3. Especificar cantidades de salida
4. Genera múltiples UTXOs ocultos
5. Prueba cryptográfica: sum(outputs) = input

#### **Withdraw Privado**
1. **"Operations"** → **"Withdraw"**
2. Seleccionar UTXO privado
3. Confirmar retiro a tokens ERC20
4. Solo se revela que el retiro es válido (> 0)

### **Paso 4: Monitoreo**
- **Balance Tab**: Ver UTXOs públicos y privados
- **History Tab**: Historial de transacciones
- **Privacy Toggle**: Alternar entre modo público/privado

## 🔀 Privacy Mode: ¿Público o Privado?

### **🔓 Privacy Mode DESACTIVADO (Modo Público)**

Cuando **NO** activas Privacy Mode durante el depósito:

#### **Comportamiento:**
- Usa métodos del contrato **sin privacidad** (`createUTXO()`)
- Las **cantidades son completamente visibles** en blockchain
- **No se generan BBS+ credentials** ni commitments
- Funciona como un UTXO tradicional **transparente**
- **Menor costo de gas** (sin operaciones criptográficas)

#### **Información Pública Visible:**
- ✅ **Cantidades exactas** de depósitos y transfers
- ✅ **Balances totales** de cada dirección
- ✅ **Historial completo** de transacciones
- ✅ **Patrones de gasto** completamente trazables
- ✅ **Vinculación directa** entre transacciones

#### **Cuándo usar Modo Público:**
- 🏢 **Transparencia corporativa** requerida
- 📊 **Auditorías públicas** necesarias
- 💰 **Reducir costos de gas** en operaciones simples
- 🔍 **Compliance** con regulaciones de transparencia

---

### **🔐 Privacy Mode ACTIVADO (Modo Privado)**

Cuando **SÍ** activas Privacy Mode durante el depósito:

#### **Comportamiento:**
- Usa métodos del contrato **con privacidad** (`depositAsPrivateUTXO()`)
- Las **cantidades se ocultan** con Pedersen commitments
- **Se auto-configura BBS+ issuer** para el token
- **Genera BBS+ credentials** con selective disclosure
- **Mayor costo de gas** (operaciones criptográficas)

#### **Información Privada Oculta:**
- 🔒 **Cantidades exactas** (solo commitments visibles)
- 🔒 **Balances reales** de usuarios
- 🔒 **Vinculación** entre transacciones
- 🔒 **Patrones de gasto** detallados
- 🔒 **Metadatos** de transacciones

#### **Información Mínima Revelada:**
- ✅ **Solo lo necesario** para autorización (direcciones)
- ✅ **Token contracts** utilizados
- ✅ **Timestamps** de transacciones
- ✅ **Proofs de validez** (sin revelar valores)

#### **Cuándo usar Modo Privado:**
- 💼 **Transacciones confidenciales** de negocios
- 🏛️ **Protección de privacidad** personal
- 🛡️ **Prevención de análisis** de blockchain
- 🎯 **DeFi privado** y yield farming

---

### **⚖️ Comparación Práctica**

| Aspecto | Modo Público 🔓 | Modo Privado 🔐 |
|---------|------------------|------------------|
| **Cantidades** | Completamente visibles | Ocultas con commitments |
| **Balances** | Públicos y trazables | Privados y confidenciales |
| **Gas Cost** | Menor (operaciones simples) | Mayor (crypto operations) |
| **Configuración** | Automática e inmediata | Auto-config BBS+ issuer |
| **Verificación** | Transparente | Zero-knowledge proofs |
| **Compliance** | Auditoría completa | Selective disclosure |
| **Seguridad** | Transparencia total | Privacidad criptográfica |

### **🎛️ Toggle Dinámico**

Puedes cambiar entre modos durante el uso:

1. **Depósitos mixtos**: Algunos públicos, otros privados
2. **Operaciones cruzadas**: Transfer de UTXO público a privado (y viceversa)
3. **Estrategia híbrida**: Combinar transparencia y privacidad según necesidad

---

**💡 Recomendación**: Usa **Privacy Mode activado** por defecto para máxima privacidad, y desactívalo solo cuando necesites transparencia específica.

## 🔧 Configuración Avanzada

### **Manual BBS+ Setup** (Opcional)
```typescript
// Auto-configuración (predeterminado)
await privateUTXOManager.createPrivateUTXO(params);

// Configuración manual personalizada
await privateUTXOManager.setupBBSIssuer(
  tokenAddress, 
  customPrivateKey // opcional
);
```

### **Privacy Settings**
```typescript
const config = {
  privacyMode: true,           // Usar BBS+ por defecto
  autoConsolidate: false,      // No consolidar automáticamente
  enableBackup: true,         // Backup de credenciales privadas
  defaultGasLimit: 500000     // Gas limit para operaciones
};
```

## 🛡️ Modelo de Seguridad

### **Información Pública (Visible en Blockchain)**
- ✅ Addresses de participantes (cuando se requiere para autorización)
- ✅ Token contracts utilizados
- ✅ Timestamps de transacciones
- ✅ Commitments criptográficos (sin revelar valores)

### **Información Privada (Oculta)**
- 🔒 Cantidades exactas de tokens
- 🔒 Saldos de usuarios
- 🔒 Patrones de gasto detallados
- 🔒 Vinculación entre transacciones

### **Protecciones Implementadas**
- **Nullifier Hashes**: Previenen double-spending
- **Challenge-Response**: Previenen replay attacks
- **Temporal Proofs**: Validez limitada en tiempo
- **Selective Disclosure**: Control granular de información revelada

## 🔍 Verificación Cryptográfica

### **Para Depósitos**
- Revela: `depositor`, `tokenAddress`
- Oculta: `amount` (solo prueba que > 0)

### **Para Transfers**
- Revela: `newOwner`, `tokenAddress`
- Oculta: `amounts`, `commitments`, `previous owner`

### **Para Withdrawals**
- Revela: `withdrawer` (para autorización)
- Oculta: `amount` exacto (solo prueba ownership)

## 🎯 Casos de Uso

### **Privacy-First Payments**
- Pagos confidenciales entre usuarios
- Protección de información financiera
- Compliance con regulaciones de privacidad

### **Corporate Treasury**
- Gestión privada de fondos corporativos
- Auditoría selectiva con disclosed proofs
- Protección de estrategias financieras

### **DeFi Privacy Layer**
- Integración con protocolos DeFi
- Yield farming privado
- Liquidity provision anónima

## 🚨 Consideraciones Importantes

### **Limitaciones Actuales**
- Proofs BBS+ simplificados (demo purposes)
- Un solo emisor por token (auto-generado)
- Sin recuperación de claves perdidas

### **Roadmap de Mejoras**
- Integración con verifiers BBS+ reales
- Multi-signature para issuers
- Cross-chain privacy bridges
- Auditoría formal de contratos

## 🛠️ Desarrollo

### **Arquitectura**
```
Frontend (Svelte) 
    ↓
PrivateUTXOManager (TypeScript)
    ↓
Zenroom (Cryptography)
    ↓
UTXOVault.sol (Smart Contract)
    ↓
Blockchain (Polygon/Ethereum)
```

### **Flujo de Datos**
1. **UI Input** → Parámetros de operación
2. **Crypto Layer** → Generación de proofs BBS+
3. **Smart Contract** → Verificación y almacenamiento
4. **Blockchain** → Persistencia inmutable

---

