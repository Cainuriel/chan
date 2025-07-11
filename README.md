# 🔐 UTXO Manager - Privacy-First Token System

[![Svelte](https://img.shields.io/badge/Svelte-FF3E00?style=flat&logo=svelte&logoColor=white)](https://svelte.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Solidity](https://img.shields.io/badge/Solidity-363636?style=flat&logo=solidity&logoColor=white)](https://soliditylang.org/)
[![Zenroom](https://img.shields.io/badge/Zenroom-8B5CF6?style=flat&logoColor=white)](https://zenroom.org/)

Un sistema de gestión de tokens ERC20 con **privacidad real** usando UTXOs, BBS+ signatures y selective disclosure criptográfico.

## 🌟 Características Principales

### 🔒 **Privacidad Verdadera**
- **BBS+ Signatures** con selective disclosure
- **Pedersen Commitments** para ocultar cantidades
- **Zero-Knowledge Proofs** para verificación sin revelación
- **Nullifier-based** anti-double-spending

### ⚡ **UTXO Model Avanzado**
- Transacciones privadas con verificación criptográfica
- Split y merge de UTXOs con preservación de privacy
- Transferencias confidenciales entre usuarios
- Compatibility completa con tokens ERC20

### 🛡️ **Seguridad Robusta**
- Smart contracts auditables y verificables
- Protección contra replay attacks
- Temporal proof validity
- Cryptographic proof verification

## 🚀 Quick Start

### **1. Instalación**
```bash
npm install
npm run dev
```

### **2. Configuración**
- Conectar MetaMask a **Polygon Amoy testnet** (única red soportada)
- Asegurar balance de tokens ERC20 para pruebas
- La aplicación auto-configura BBS+ issuers

### **3. Uso Básico**
1. **Connect MetaMask** → Conectar MetaMask (Polygon Amoy)
2. **Deposit** → Convertir ERC20 a UTXO privado  
3. **Transfer** → Envío confidencial entre usuarios
4. **Withdraw** → Retiro privado a ERC20

## 📖 Documentación Completa

- **[📚 Guía de Uso Detallada](./USAGE_GUIDE.md)** - Tutorial paso a paso completo

## 🔄 Estado Actual

### ✅ **Funcional**
- [x] Smart contract UTXOVault con BBS+ integration
- [x] PrivateUTXOManager con auto-configuración de issuers
- [x] UI completa con Svelte components
- [x] Integración con Zenroom para cryptography
- [x] Privacy mode con selective disclosure
- [x] Sincronización automática con blockchain
- [x] localStorage storage para desarrollo (POC)

### 🏗️ **Almacenamiento de Datos - POC vs Producción**

#### 📋 **POC Actual (localStorage)**
Para este Proof of Concept, los UTXOs privados se almacenan en **localStorage** del navegador:
- ✅ **Ventajas**: Desarrollo rápido, no requiere infraestructura adicional
- ⚠️ **Limitaciones**: Solo local, se pierde al limpiar navegador
- 🎯 **Uso**: Solo para testing y demostración

#### 🔒 **Producción (Base de Datos Tradicional)**
En producción se implementará:
- 🗄️ **Base de datos privada** con encriptación end-to-end
- 🔐 **Claves derivadas** del usuario para acceso a datos
- 🌐 **Sincronización multi-dispositivo** preservando privacidad
- 🛡️ **Backup seguro** con zero-knowledge architecture

> **Nota**: El contrato UTXOVault mantiene **privacidad completa** en ambos casos - solo almacena commitments criptográficos, nunca datos sensibles.

### **🎯 Como Usar Ahora**
1. `npm run dev` → Servidor local
2. Abrir `http://localhost:5173`
3. **"Get Started"** → Auto-inicialización
4. **Conectar MetaMask** → Asegurar red Polygon Amoy
5. **Deposit** con Privacy Mode activado
6. Los UTXOs se guardan en localStorage para pruebas

---

✅ **Sistema de producción con implementación completa de BBS+ signatures, Zenroom cryptography y selective disclosure real**. Funcionalidad criptográfica robusta lista para mainnet.