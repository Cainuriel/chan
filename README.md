#  CHAN

# 🔐 UTXO Manager - Real Cryptographic Privacy System with Attestations

[![Svelte](https://img.shields.io/badge/Svelte-FF3E00?style=flat&logo=svelte&logoColor=white)](https://svelte.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Solidity](https://img.shields.io/badge/Solidity-363636?style=flat&logo=solidity&logoColor=white)](https://soliditylang.org/)
[![Zenroom](https://img.shields.io/badge/Zenroom-8B5CF6?style=flat&logoColor=white)](https://zenroom.org/)
[![BN254](https://img.shields.io/badge/BN254-FF6B35?style=flat&logoColor=white)](https://eips.ethereum.org/EIPS/eip-196)

Un sistema avanzado de gestión de tokens ERC20 con **privacidad criptográfica real** usando UTXOs, Pedersen Commitments en BN254, Zenroom y **attestations criptográficas**.

## 🌟 Características Principales

### 🔒 **Criptografía Real BN254 + Zenroom**
- **Zenroom v5.23.2** como motor criptográfico completo
- **Pedersen Commitments** reales en curva elíptica BN254 (alt_bn128)
- **Bulletproofs Range Proofs** para validación sin revelación
- **Equality Proofs** usando protocolo Sigma real
- **Hash-to-curve** para nullifiers criptográficamente seguros

### 🛡️ **Arquitectura de Attestations**
- **Backend Attestations** con firmas criptográficas reales
- **Coconut Credentials** para autenticación sin revelación
- **ECDH Operations** para intercambio seguro de claves
- **Zencode DSL** para todos los algoritmos criptográficos

### ⚠️ **ADVERTENCIAS DE SEGURIDAD - SOLO DESARROLLO**
- 🚨 **Clave privada expuesta**: Las variables `VITE_*` son **públicas** en el navegador
- 🚨 **Backend simulado**: localStorage actúa como backend para pruebas
- 🚨 **No usar en producción**: Implementación actual solo para testing criptográfico

### ⚡ **UTXO Model Criptográfico**
- Transacciones privadas con **commitments verificables en chain**
- Split y merge preservando **homomorphic properties**
- Transferencias confidenciales usando **coordinate compression**
- **Zero-knowledge** proofs para validación sin revelación

### 🛡️ **Seguridad Matemática**
- **BN254 pairing-friendly curve** con 128-bit security
- **Commitment schemes** con binding y hiding properties
- **Nullifier uniqueness** prevents double-spending
- **On-chain verification** de todas las pruebas criptográficas

## 🔬 Arquitectura Criptográfica con Attestations

### **Depósito Privado con Attestation**
1. **ERC20 Transfer**: Los tokens se transfieren al contrato UTXOVault
2. **Zenroom Commitment**: `await ZenroomHelpers.createPedersenCommitment(value, blindingFactor)`
   - Usa **Zencode DSL** para operaciones BN254 reales
   - Generadores G, H obtenidos desde `ZenroomHelpers.getRealPedersenGenerators()`
3. **Attestation Criptográfica**: `await ZenroomHelpers.createDepositWithAttestation()`
   - **Firma ECDH** real usando Zenroom
   - **Nullifier hash** con hash-to-curve verificable
   - **Nonce** único para prevenir replay attacks
4. **Range Proof Real**: `await ZenroomHelpers.generateBulletproof(value, blindingFactor)`
5. **On-chain Validation**: Contrato verifica matemáticamente todo

### **Split con Equality Proofs Reales**
1. **Input Validation**: Verifica commitment Pedersen original
2. **Output Generation**: Múltiples commitments para valores de salida
3. **Equality Proof Real**: `await ZenroomHelpers.generateEqualityProof(inputCommitment, outputCommitment)`
   - Usa **protocolo Sigma** implementado en Zencode
   - Prueba criptográfica que `input_value = sum(output_values)`
4. **Homomorphic Properties**: Preserva propiedades matemáticas de BN254

### **Backend Simulado (localStorage)**
⚠️ **SOLO PARA DESARROLLO** - El "backend" actual es localStorage:
- **AttestationService**: Firma usando clave privada expuesta
- **PrivateUTXOStorage**: Guarda datos sensibles en navegador
- **ZenroomHelpers**: Toda la criptografía real delegada a Zenroom



### **1. Instalación**
```bash
npm install
npm run dev
```


### **2. Configuración Multi-Red**
- **Polygon Amoy**: `0xE4e35290Dda72e6fA426E23e8E805219246f415e`
- **Alastria**: `0x733bEe37FE6c2a6F4f445852Ea44E088EBe143D6` (gas-free)
- Auto-detección de red y configuración de gas inteligente

### .env
```bash
# ⚠️ ADVERTENCIA: Variables VITE_ son PÚBLICAS y visibles en el navegador
# Solo para desarrollo - EN PRODUCCIÓN mover al servidor backend
VITE_ADDRESS_CONTRACT_AMOY=0x2182f69deed71D8D1c13FF3d329141E306221101
VITE_ADDRESS_CONTRACT_ALASTRIA=0x7722ba597c02C61128084d9C2AeB1Fd3A1a35915
VITE_PRIVATE_KEY_ADMIN=2c8296af8a5f0f5e29d4e60b7b8efcb263aff8e54f9efc5d927aca976c349917
```

### **3. Operaciones Criptográficas Reales**
1. **Connect MetaMask** → Detecta automáticamente la red
2. **Deposit** → `ZenroomHelpers.createDepositWithAttestation()` - Criptografía real
3. **Transfer** → Equality proofs con protocolo Sigma usando Zencode
4. **Split/Merge** → Homomorphic operations preservando privacidad matemática

## 📖 Documentación Técnica

### **🔧 Arquitectura Zenroom**
- **Zenroom v5.23.2**: Motor criptográfico principal para TODA la criptografía
- **Zencode DSL**: Lenguaje específico para operaciones criptográficas
- **BN254 Context**: Inicialización automática de contexto de curva
- **Real Generators**: Puntos G, H obtenidos dinámicamente desde Zenroom
- **Performance Monitoring**: Tracking de operaciones criptográficas

### **🛡️ Sistema de Attestations**
- **Backend Signatures**: Firmas ECDH reales usando `ZenroomHelpers`
- **Nonce Management**: Prevención de replay attacks
- **Data Integrity**: Hash de datos para verificación
- **Coconut Integration**: Credenciales sin revelación para autenticación

### **🧮 Fundamentos Matemáticos (Zenroom)**
- **BN254 Curve**: Curva elíptica pairing-friendly con 254-bit prime
- **Field Modulus**: `p = 0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47`
- **Curve Equation**: `y² = x³ + 3` sobre campo finito Fp
- **Security Level**: 128-bit equivalente (estándar para aplicaciones financieras)
- **Zenroom Implementation**: Toda la matemática delegada a Zenroom verificado

### **🔐 Esquemas Criptográficos Reales**
- **Pedersen Commitments**: `C = vG + rH` implementado con `ZenroomHelpers.createPedersenCommitment()`
- **Equality Proofs**: Protocolo Sigma usando `ZenroomHelpers.generateEqualityProof()`
- **Range Proofs**: Bulletproofs con `ZenroomHelpers.generateBulletproof()`
- **ECDH Operations**: Intercambio de claves usando `ZenroomHelpers.curvePointOperation()`
- **Hash-to-curve**: Nullifiers con `ZenroomHelpers.generateNullifierHash()`

### **⚠️ Limitaciones de Desarrollo vs Producción**
#### 🚨 **ACTUAL (Solo Desarrollo)**
- **Clave privada pública**: `VITE_PRIVATE_KEY_ADMIN` visible en navegador
- **localStorage como backend**: Datos sensibles en almacenamiento local
- **Sin servidor**: Attestations firmadas en cliente
- **Zenroom real**: La criptografía SÍ es de producción

#### 🔒 **PRODUCCIÓN (Requerido)**
- **Backend servidor**: Attestations firmadas en servidor seguro
- **Clave privada protegida**: HSM o ambiente controlado
- **Base de datos encriptada**: Storage profesional para metadatos
- **API endpoints**: `/api/create-attestation`, `/api/verify-proof`

### **⚡ Optimizaciones de Gas**
- **Stack Optimization**: Funciones auxiliares para evitar "stack too deep"
- **Gas-aware Networks**: Auto-detección de redes gas-free (Alastria) vs gas-required
- **Coordinate Recovery**: Reconstrucción matemática de puntos para minimizar storage
- **Batch Operations**: Múltiples operaciones en una sola transacción

## 🔄 Estado de Implementación

### ✅ **Criptografía Completa con Zenroom**
- [x] **ZenroomHelpers Integration** - Toda la criptografía delegada a Zenroom
- [x] **Real Pedersen Commitments** - `createPedersenCommitment()` con BN254
- [x] **Equality Proofs Reales** - `generateEqualityProof()` con protocolo Sigma
- [x] **Bulletproof Range Proofs** - `generateBulletproof()` sin revelación
- [x] **ECDH Operations** - `curvePointOperation()` para intercambio de claves
- [x] **Real Generators** - `getRealPedersenGenerators()` desde Zenroom
- [x] **Coconut Credentials** - `generateCoconutCredential()` para autenticación
- [x] **Performance Monitoring** - Tracking de operaciones criptográficas

### ✅ **Sistema de Attestations**
- [x] **AttestationService** - Firma criptográfica real (clave expuesta para dev)
- [x] **Deposit Attestations** - `createDepositWithAttestation()` completo
- [x] **Transfer Attestations** - `createTransferWithAttestation()` implementado
- [x] **Split Attestations** - `createSplitWithAttestation()` funcional
- [x] **Withdraw Attestations** - `createWithdrawWithAttestation()` operativo

### ✅ **Smart Contracts BN254**
- [x] **UTXOVault Contract** - Desplegado en Polygon Amoy y Alastria
- [x] **CommitmentPoint Structures** - Tuplas (x,y) para coordenadas BN254
- [x] **Mathematical Validation** - Verificación de ecuación de curva
- [x] **Gas Optimization** - Funciones auxiliares para stack management
- [x] **Multi-network Support** - Gas inteligente según la red

### ✅ **Frontend Criptográfico con Zenroom**
- [x] **Zenroom v5.23.2 Integration** - Motor criptográfico completo
- [x] **Real BN254 Operations** - Toda la matemática usando Zencode DSL
- [x] **Attestation UI** - Interfaz para operaciones con backend simulado
- [x] **Performance Tracking** - Monitoreo de operaciones criptográficas
- [x] **Error Handling** - Manejo robusto de errores Zenroom
- [x] **Network Detection** - Auto-configuración según blockchain

### ⚠️ **Limitaciones Actuales (Solo Desarrollo)**
- [ ] 🚨 **Clave privada expuesta** - `VITE_PRIVATE_KEY_ADMIN` pública en navegador
- [ ] 🚨 **localStorage backend** - Datos sensibles sin protección servidor
- [ ] 🚨 **Sin autenticación** - AttestationService sin validación real
- [ ] 🚨 **Client-side signing** - Firmas en navegador vs servidor seguro

###  **Almacenamiento de Datos - ADVERTENCIAS DE SEGURIDAD**

#### � **Desarrollo Actual (INSEGURO - Solo testing)**
Para este desarrollo, los datos privados se almacenan **inseguramente**:
- ⚠️ **localStorage**: Blinding factors y commitments en navegador
- ⚠️ **Clave privada expuesta**: `VITE_PRIVATE_KEY_ADMIN` visible públicamente
- ⚠️ **Sin encriptación**: Datos sensibles sin protección
- ⚠️ **AttestationService simulado**: Firma en cliente en lugar de servidor
- ✅ **Criptografía real**: Los algoritmos Zenroom SÍ son de producción

#### 🔒 **Producción Requerida (Segura)**
En producción se DEBE implementar:
- 🗄️ **Backend Server** con autenticación y base de datos segura
- 🔐 **HSM/Vault** para claves privadas protegidas
- 🌐 **API Endpoints** para operaciones de attestation
- �️ **Encrypted Storage** para metadatos sensibles
- 🔑 **Zero-Knowledge Storage** usando solo datos públicos + secretos del usuario

#### 📋 **Migración a Producción**
```javascript
// DESARROLLO (ACTUAL):
const attestation = await ZenroomHelpers.createDepositWithAttestation(
  amount, recipient, tokenAddress
); // ⚠️ Clave privada expuesta

// PRODUCCIÓN (REQUERIDO):
const attestation = await fetch('/api/create-deposit-attestation', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${userJWT}` },
  body: JSON.stringify({ amount, recipient, tokenAddress })
}); // ✅ Clave privada segura en servidor
```

> **Nota Criptográfica**: Todos los algoritmos criptográficos (Pedersen commitments, equality proofs, range proofs) usan Zenroom real y son matemáticamente seguros. Solo la **gestión de claves** y **almacenamiento** son inseguros en esta versión de desarrollo.

---

🔬 **Sistema en desarrollo** con criptografía real de Zenroom pero arquitectura de seguridad simulada para testing de algoritmos. **NO USAR EN PRODUCCIÓN** sin migrar attestations a servidor seguro. 