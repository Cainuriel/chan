# 🔐 UTXO Manager - Real Cryptographic Privacy System

[![Svelte](https://img.shields.io/badge/Svelte-FF3E00?style=flat&logo=svelte&logoColor=white)](https://svelte.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Solidity](https://img.shields.io/badge/Solidity-363636?style=flat&logo=solidity&logoColor=white)](https://soliditylang.org/)
[![Zenroom](https://img.shields.io/badge/Zenroom-8B5CF6?style=flat&logoColor=white)](https://zenroom.org/)
[![BN254](https://img.shields.io/badge/BN254-FF6B35?style=flat&logoColor=white)](https://eips.ethereum.org/EIPS/eip-196)

Un sistema avanzado de gestión de tokens ERC20 con **privacidad criptográfica real** usando UTXOs, Pedersen Commitments en BN254 y Zenroom.

## 🌟 Características Principales

### 🔒 **Criptografía Real BN254**
- **Pedersen Commitments** en curva elíptica BN254 (alt_bn128)
- **Zenroom** como motor criptográfico verificado
- **Bulletproofs-style Range Proofs** para validación de rangos
- **Hash-to-curve** para nullifiers criptográficamente seguros

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

## 🔬 How it Works (Real Cryptography)

### **Depósito Privado**
1. **ERC20 Transfer**: Los tokens se transfieren al contrato UTXOVault
2. **Pedersen Commitment**: Se crea un commitment `C = vG + rH` usando BN254
   - `v` = cantidad (secret)
   - `r` = blinding factor (random)
   - `G, H` = generadores BN254 verificados
3. **Range Proof**: Zenroom genera proof que `0 ≤ v ≤ 2^64` sin revelar `v`
4. **Coordinate Compression**: Solo se almacena coordenada X + bit de paridad Y
5. **On-chain Validation**: El contrato verifica matemáticamente el commitment

### **Transferencia Criptográfica**
1. **Input Nullification**: Se marca el UTXO gastado usando nullifier hash
2. **Output Commitment**: Nuevo Pedersen commitment para el destinatario
3. **Balance Conservation**: Proof criptográfico que `input_value = output_value`
4. **Coordinate Recovery**: El contrato reconstruye coordenada Y usando paridad
5. **Mathematical Verification**: Validación de ecuación de curva y commitments

### **Verificación BN254**
- **Curve Equation**: `y² = x³ + 3 (mod p)` donde `p` es el módulo de campo BN254
- **Point Validation**: Coordenadas dentro del campo y en la curva
- **Generator Trust**: Generadores G, H con NUMS (Nothing Up My Sleeve)
- **Homomorphic Addition**: `C₁ + C₂ = (v₁ + v₂)G + (r₁ + r₂)H`

## 🚀 Quick Start

### **1. Instalación**
```bash
npm install
npm run dev
```

### **2. Configuración Multi-Red**
- **Polygon Amoy**: `0xE4e35290Dda72e6fA426E23e8E805219246f415e`
- **Alastria**: `0x733bEe37FE6c2a6F4f445852Ea44E088EBe143D6` (gas-free)
- Auto-detección de red y configuración de gas inteligente

### **3. Operaciones Criptográficas**
1. **Connect MetaMask** → Detecta automáticamente la red
2. **Deposit** → Crea Pedersen commitment en BN254
3. **Transfer** → Transferencia con proofs criptográficos
4. **Split/Merge** → Operaciones homomorphic preservando privacidad

## 📖 Documentación Técnica

### **🧮 Fundamentos Matemáticos**
- **BN254 Curve**: Curva elíptica pairing-friendly con 254-bit prime
- **Field Modulus**: `p = 0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47`
- **Curve Equation**: `y² = x³ + 3` sobre campo finito Fp
- **Security Level**: 128-bit equivalente (estándar para aplicaciones financieras)

### **� Esquemas Criptográficos**
- **Pedersen Commitments**: `C = vG + rH` con perfect hiding, computational binding
- **Coordinate Compression**: Almacenamiento eficiente usando paridad de coordenada Y
- **Hash-to-curve**: Nullifier generation usando función hash verificable
- **Range Proofs**: Validación de rangos sin revelación usando técnicas bulletproof

### **⚡ Optimizaciones de Gas**
- **Stack Optimization**: Funciones auxiliares para evitar "stack too deep"
- **Gas-aware Networks**: Auto-detección de redes gas-free (Alastria) vs gas-required
- **Coordinate Recovery**: Reconstrucción matemática de puntos para minimizar storage
- **Batch Operations**: Múltiples operaciones en una sola transacción

## 🔄 Estado de Implementación

### ✅ **Criptografía Completa**
- [x] **BN254 Point Validation** - Verificación matemática de puntos en curva
- [x] **Pedersen Commitment Creation** - Generación con Zenroom
- [x] **Coordinate Compression** - Optimización de almacenamiento
- [x] **Range Proof Generation** - Proofs de rango sin revelación
- [x] **Nullifier Hash Creation** - Anti-double-spending criptográfico
- [x] **On-chain Verification** - Validación matemática en contratos

### ✅ **Smart Contracts BN254**
- [x] **UTXOVault Contract** - Desplegado en Polygon Amoy y Alastria
- [x] **CommitmentPoint Structures** - Tuplas (x,y) para coordenadas BN254
- [x] **Mathematical Validation** - Verificación de ecuación de curva
- [x] **Gas Optimization** - Funciones auxiliares para stack management
- [x] **Multi-network Support** - Gas inteligente según la red

### ✅ **Frontend Criptográfico**
- [x] **Zenroom Integration** - Motor criptográfico real
- [x] **BN254 Point Handling** - Manejo nativo de coordenadas
- [x] **Proof Generation UI** - Interfaz para operaciones criptográficas
- [x] **Network Detection** - Auto-configuración según blockchain
- [x] **Real Cryptography Mode** - Solo operaciones matemáticamente válidas

### 🏗️ **Almacenamiento de Datos - Seguridad Criptográfica**

#### 📋 **Desarrollo Actual (localStorage)**
Para este desarrollo, los datos privados se almacenan localmente:
- ✅ **Commitments BN254**: Puntos de curva verificables matemáticamente
- ✅ **Blinding Factors**: Valores secretos para reconstituir commitments
- ✅ **Range Proofs**: Pruebas criptográficas completas
- ⚠️ **Limitación**: Solo local, para testing de algoritmos criptográficos

#### 🔒 **Producción (Arquitectura Zero-Knowledge)**
En producción se implementará:
- 🗄️ **Encrypted Storage** con claves derivadas criptográficamente
- 🔐 **Commitment Recovery** usando solo datos públicos + secretos del usuario
- 🌐 **Multi-device Sync** preservando zero-knowledge properties
- 🛡️ **Cryptographic Backup** con threshold secret sharing

> **Nota Criptográfica**: El contrato UTXOVault mantiene **perfect privacy** - solo almacena commitments Pedersen que son computacionalmente indistinguibles de valores aleatorios sin los blinding factors.

### **🎯 Uso de Criptografía Real**
1. `npm run dev` → Servidor con motor criptográfico Zenroom
2. Abrir `http://localhost:5173`
3. **"Get Started"** → Inicialización de generadores BN254
4. **Conectar MetaMask** → Detección automática de red
5. **Deposit** → Creación de Pedersen commitment real
6. **Verify** → Validación matemática en blockchain

---

✅ **Sistema criptográfico completo** con implementación real de Pedersen Commitments en BN254, Zenroom para operaciones verificables, y validación matemática on-chain. **Zero shortcuts, only real cryptography.**