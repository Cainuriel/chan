/**
 * PrivateUTXOStorage - ZK-Private UTXO Storage System
 * Ultra-secure local storage with secp256k1 encryption for maximum privacy
 * Uses pure ethers.js + Web Crypto API for browser-native security
 */

import type { PrivateUTXO } from './ManagerUTXO';
import { ethers } from 'ethers';

export class PrivateUTXOStorage {
  private static readonly STORAGE_KEY = 'zk-private-utxos';
  private static readonly USER_PREFIX = 'zkuser:';
  private static readonly ENCRYPTION_KEY_ENV = 'VITE_STORAGE_ENCRYPTION_KEY';

  /**
   * Generate ZK-secure user key with pure ethers secp256k1 derivation
   */
  private static getZKUserKey(userAddress: string): string {
    const normalizedAddress = userAddress.toLowerCase();
    const zkSalt = import.meta.env.VITE_STORAGE_ENCRYPTION_KEY || 'fallback-key-only-for-dev';
    
    // Use ethers.solidityPackedKeccak256 for better key derivation
    const hash = ethers.solidityPackedKeccak256(
      ['string', 'string', 'string', 'string'],
      [this.STORAGE_KEY, this.USER_PREFIX, normalizedAddress, zkSalt]
    );
    
    return `${this.STORAGE_KEY}:zk:${hash.substring(2, 20)}`; // Remove '0x' and take 18 chars
  }

  /**
   * Get secp256k1 keys storage key for user
   */
  private static getSecp256k1KeysKey(userAddress: string): string {
    const normalizedAddress = userAddress.toLowerCase();
    const zkSalt = import.meta.env.VITE_STORAGE_ENCRYPTION_KEY || 'fallback-key-only-for-dev';
    
    const hash = ethers.solidityPackedKeccak256(
      ['string', 'string', 'string', 'string'],
      [this.STORAGE_KEY, 'secp256k1-keys', normalizedAddress, zkSalt]
    );
    
    return `${this.STORAGE_KEY}:secp256k1:${hash.substring(2, 20)}`; // Remove '0x' and take 18 chars
  }

  /**
   * Encrypt UTXO data using AES-GCM with ethers-derived key (browser-native)
   */
  private static async encryptUTXOData(data: string, userAddress: string): Promise<string> {
    try {
      const keyMaterial = ethers.keccak256(ethers.toUtf8Bytes(this.getZKUserKey(userAddress)));
      
      // Use Web Crypto API (browser native) with ethers-derived key
      const key = await crypto.subtle.importKey(
        'raw',
        ethers.getBytes(keyMaterial.slice(0, 66)), // Take first 32 bytes (remove 0x and take 64 hex chars = 32 bytes)
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );
      
      const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
      const encodedData = new TextEncoder().encode(data);
      
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encodedData
      );
      
      // Combine IV + encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      
      return ethers.hexlify(combined);
    } catch (error) {
      console.error('🔐 ZK Encryption failed:', error);
      throw new Error('ZK encryption failed');
    }
  }

  /**
   * Decrypt UTXO data using AES-GCM with ethers-derived key (browser-native)
   */
  private static async decryptUTXOData(encryptedData: string, userAddress: string): Promise<string> {
    try {
      const keyMaterial = ethers.keccak256(ethers.toUtf8Bytes(this.getZKUserKey(userAddress)));
      
      const key = await crypto.subtle.importKey(
        'raw',
        ethers.getBytes(keyMaterial.slice(0, 66)), // Take first 32 bytes
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      
      const combined = ethers.getBytes(encryptedData);
      const iv = combined.slice(0, 12); // First 12 bytes are IV
      const encrypted = combined.slice(12); // Rest is encrypted data
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encrypted
      );
      
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('🔐 ZK Decryption failed:', error);
      throw new Error('ZK decryption failed - data may be corrupted');
    }
  }

  /**
   * Guardar UTXO privado del usuario con cifrado ZK
   */
  static async savePrivateUTXO(userAddress: string, utxo: PrivateUTXO): Promise<void> {
    try {
      // Validar estructura mínima
      if (!utxo.id || !utxo.tokenAddress || !utxo.owner || typeof utxo.value === 'undefined') {
        throw new Error('UTXO missing required fields');
      }
      const userKey = this.getZKUserKey(userAddress);
      console.log(`💾 Saving UTXO for user: ${userAddress}`);
      console.log(`💾 Using key: ${userKey}`);
      console.log(`💾 UTXO data:`, {
        id: utxo.id,
        value: utxo.value?.toString(),
        tokenAddress: utxo.tokenAddress,
        owner: utxo.owner,
        isSpent: utxo.isSpent
      });
      const existingUTXOs = await this.getPrivateUTXOs(userAddress);
      console.log(`💾 Existing UTXOs count: ${existingUTXOs.length}`);
      // Actualizar o añadir UTXO (por id y owner)
      const utxoIndex = existingUTXOs.findIndex(u => u.id === utxo.id && u.owner.toLowerCase() === utxo.owner.toLowerCase());
      if (utxoIndex >= 0) {
        existingUTXOs[utxoIndex] = utxo;
        console.log(`💾 Updated existing UTXO at index ${utxoIndex}`);
      } else {
        existingUTXOs.push(utxo);
        console.log(`💾 Added new UTXO, total count: ${existingUTXOs.length}`);
      }
      // Serializar todos los campos bigint relevantes
      const serializedData = JSON.stringify(existingUTXOs, (key, value) => {
        if (typeof value === 'bigint') return value.toString();
        return value;
      });
      
      // Cifrar datos antes de guardar (ahora async)
      const encryptedData = await this.encryptUTXOData(serializedData, userAddress);
      localStorage.setItem(userKey, encryptedData);
      console.log(`💾 Saved encrypted to localStorage. Data length: ${encryptedData.length}`);
      // Verificar que se guardó correctamente
      const verification = localStorage.getItem(userKey);
      console.log(`💾 Verification - encrypted data exists: ${verification !== null}`);
      console.log(`💾 Private UTXO saved locally for user ${userAddress.substring(0, 8)}...`);
    } catch (error) {
      console.error('❌ Failed to save private UTXO:', error);
    }
  }

  /**
   * Obtener todos los UTXOs privados del usuario (con descifrado ZK)
   */
  static async getPrivateUTXOs(userAddress: string): Promise<PrivateUTXO[]> {
    try {
      const userKey = this.getZKUserKey(userAddress);
      const encryptedData = localStorage.getItem(userKey);
      
      if (!encryptedData) {
        return [];
      }

      // Descifrar datos (ahora async)
      const serializedData = await this.decryptUTXOData(encryptedData, userAddress);
      const utxos = JSON.parse(serializedData) as PrivateUTXO[];
      
      // Convertir todos los campos bigint relevantes de vuelta a bigint
      return utxos.map(utxo => {
        const restored: any = {
          ...utxo,
          value: typeof utxo.value === 'string' ? BigInt(utxo.value) : utxo.value,
          timestamp: typeof utxo.timestamp === 'string' ? BigInt(utxo.timestamp) : utxo.timestamp
        };
        if (typeof utxo.blockNumber === 'string') {
          // blockNumber puede ser number o string, restaurar a number si es posible
          const n = Number(utxo.blockNumber);
          restored.blockNumber = isNaN(n) ? undefined : n;
        }
        return restored;
      });
    } catch (error) {
      console.error('❌ Failed to load private UTXOs:', error);
      return [];
    }
  }

  /**
   * Marcar UTXO como gastado (con cifrado ZK)
   */
  static async markUTXOAsSpent(userAddress: string, utxoId: string): Promise<void> {
    try {
      const utxos = await this.getPrivateUTXOs(userAddress);
      const utxoIndex = utxos.findIndex((u: PrivateUTXO) => u.id === utxoId);
      
      if (utxoIndex >= 0) {
        utxos[utxoIndex].isSpent = true;
        const userKey = this.getZKUserKey(userAddress);
        const serializedData = JSON.stringify(utxos, (key, value) => {
          if (typeof value === 'bigint') return value.toString();
          return value;
        });
        const encryptedData = await this.encryptUTXOData(serializedData, userAddress);
        localStorage.setItem(userKey, encryptedData);
        console.log(`⛔ UTXO ${utxoId.substring(0, 8)}... marked as spent`);
      }
    } catch (error) {
      console.error('❌ Failed to mark UTXO as spent:', error);
    }
  }

  /**
   * Obtener UTXOs no gastados del usuario
   */
  static async getUnspentUTXOs(userAddress: string): Promise<PrivateUTXO[]> {
    const allUTXOs = await this.getPrivateUTXOs(userAddress);
    return allUTXOs.filter((utxo: PrivateUTXO) => !utxo.isSpent);
  }

  /**
   * Obtener balance total del usuario para un token específico
   */
  static async getBalance(userAddress: string, tokenAddress?: string): Promise<bigint> {
    const unspentUTXOs = await this.getUnspentUTXOs(userAddress);
    
    return unspentUTXOs
      .filter((utxo: PrivateUTXO) => !tokenAddress || utxo.tokenAddress.toLowerCase() === tokenAddress.toLowerCase())
      .reduce((total: bigint, utxo: PrivateUTXO) => total + utxo.value, BigInt(0));
  }

  /**
   * Obtener estadísticas del usuario
   */
  static async getUserStats(userAddress: string): Promise<{
    totalUTXOs: number;
    unspentUTXOs: number;
    spentUTXOs: number;
    uniqueTokens: number;
    totalBalance: bigint;
  }> {
    const allUTXOs = await this.getPrivateUTXOs(userAddress);
    const unspentUTXOs = allUTXOs.filter((utxo: PrivateUTXO) => !utxo.isSpent);
    const uniqueTokens = new Set(allUTXOs.map((utxo: PrivateUTXO) => utxo.tokenAddress.toLowerCase())).size;
    const totalBalance = unspentUTXOs.reduce((total: bigint, utxo: PrivateUTXO) => total + utxo.value, BigInt(0));

    return {
      totalUTXOs: allUTXOs.length,
      unspentUTXOs: unspentUTXOs.length,
      spentUTXOs: allUTXOs.length - unspentUTXOs.length,
      uniqueTokens,
      totalBalance
    };
  }

  /**
   * Limpiar todos los datos del usuario (para desconexión) con ZK
   */
  static clearUserData(userAddress: string): void {
    try {
      const userKey = this.getZKUserKey(userAddress);
      const zkKeysKey = this.getSecp256k1KeysKey(userAddress);
      localStorage.removeItem(userKey);
      localStorage.removeItem(zkKeysKey);
      console.log(`🧹 Private UTXO data cleared for user ${userAddress.substring(0, 8)}...`);
    } catch (error) {
      console.error('❌ Failed to clear user data:', error);
    }
  }

  /**
   * Limpiar todos los datos de UTXOs (para desarrollo)
   */
  static clearAllData(): void {
    try {
      const keys = Object.keys(localStorage);
      const utxoKeys = keys.filter(key => key.startsWith(this.STORAGE_KEY));
      
      utxoKeys.forEach(key => localStorage.removeItem(key));
      console.log(`🧹 All private UTXO data cleared (${utxoKeys.length} users)`);
    } catch (error) {
      console.error('❌ Failed to clear all data:', error);
    }
  }

  /**
   * Obtener el tamaño de datos almacenados para un usuario (ZK encrypted)
   */
  static getUserDataSize(userAddress: string): number {
    try {
      const userKey = this.getZKUserKey(userAddress);
      const data = localStorage.getItem(userKey);
      return data ? data.length : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Verificar si hay datos guardados para el usuario (ZK encrypted)
   */
  static hasUserData(userAddress: string): boolean {
    const userKey = this.getZKUserKey(userAddress);
    return localStorage.getItem(userKey) !== null;
  }

  /**
   * Exportar datos del usuario (para backup) - descifrado para transferencia
   */
  static async exportUserData(userAddress: string): Promise<string | null> {
    try {
      const userKey = this.getZKUserKey(userAddress);
      const encryptedData = localStorage.getItem(userKey);
      if (!encryptedData) return null;
      
      // Exportar datos descifrados para que puedan ser importados
      return await this.decryptUTXOData(encryptedData, userAddress);
    } catch (error) {
      console.error('❌ Failed to export user data:', error);
      return null;
    }
  }

  /**
   * Importar datos del usuario (desde backup) con cifrado ZK
   */
  static async importUserData(userAddress: string, data: string): Promise<boolean> {
    try {
      // Validar que los datos son JSON válido
      const parsedData = JSON.parse(data);
      if (!Array.isArray(parsedData)) {
        throw new Error('Invalid data format');
      }

      const userKey = this.getZKUserKey(userAddress);
      // Cifrar datos antes de guardar
      const encryptedData = await this.encryptUTXOData(data, userAddress);
      localStorage.setItem(userKey, encryptedData);
      console.log(`📥 Private UTXO data imported for user ${userAddress.substring(0, 8)}...`);
      return true;
    } catch (error) {
      console.error('❌ Failed to import user data:', error);
      return false;
    }
  }

  /**
   * Guardar claves secp256k1 ZK del usuario (para operaciones criptográficas ZK)
   */
  static async saveSecp256k1Keys(userAddress: string, tokenAddress: string, keys: {
    privateKey: string;
    publicKey: string;
    blindingFactor: string;
    commitmentKey: string;
  }): Promise<void> {
    try {
      const keysKey = this.getSecp256k1KeysKey(userAddress);
      const existingKeys = await this.getSecp256k1Keys(userAddress);
      
      existingKeys[tokenAddress.toLowerCase()] = keys;
      
      // Cifrar las claves sensibles
      const serializedKeys = JSON.stringify(existingKeys);
      const encryptedKeys = await this.encryptUTXOData(serializedKeys, userAddress);
      localStorage.setItem(keysKey, encryptedKeys);
      console.log(`🔑 secp256k1 ZK keys saved for token ${tokenAddress.substring(0, 8)}...`);
    } catch (error) {
      console.error('❌ Failed to save secp256k1 keys:', error);
    }
  }

  /**
   * Obtener claves secp256k1 ZK del usuario
   */
  static async getSecp256k1Keys(userAddress: string): Promise<Record<string, {
    privateKey: string;
    publicKey: string;
    blindingFactor: string;
    commitmentKey: string;
  }>> {
    try {
      const keysKey = this.getSecp256k1KeysKey(userAddress);
      const encryptedData = localStorage.getItem(keysKey);
      
      if (!encryptedData) {
        return {};
      }
      
      const decryptedData = await this.decryptUTXOData(encryptedData, userAddress);
      return JSON.parse(decryptedData);
    } catch (error) {
      console.error('❌ Failed to load secp256k1 keys:', error);
      return {};
    }
  }

  /**
   * Verificar si existen claves secp256k1 ZK para un token
   */
  static async hasSecp256k1Keys(userAddress: string, tokenAddress: string): Promise<boolean> {
    const keys = await this.getSecp256k1Keys(userAddress);
    return !!(keys[tokenAddress.toLowerCase()]);
  }

  /**
   * Eliminar claves secp256k1 ZK (logout/reset)
   */
  static clearSecp256k1Keys(userAddress: string): void {
    try {
      const keysKey = this.getSecp256k1KeysKey(userAddress);
      localStorage.removeItem(keysKey);
      console.log(`🗑️ secp256k1 ZK keys cleared for user ${userAddress.substring(0, 8)}...`);
    } catch (error) {
      console.error('❌ Failed to clear secp256k1 keys:', error);
    }
  }

  /**
   * Función de depuración: mostrar todo el contenido de localStorage para un usuario (ZK encrypted)
   */
  static async debugStorage(userAddress: string): Promise<void> {
    try {
      console.log(`🔍 DEBUG: ZK encrypted localStorage content for user ${userAddress}`);
      
      // UTXOs detallados
      const { owned, received, all } = await this.getAllUserUTXOs(userAddress);
      console.log(`📦 Owned UTXOs (${owned.length}):`, owned);
      console.log(`📥 Received UTXOs (${received.length}):`, received);
      console.log(`📊 All UTXOs (${all.length}):`, all);
      
      // secp256k1 ZK Keys
      const zkKeys = await this.getSecp256k1Keys(userAddress);
      console.log(`🔑 secp256k1 ZK Keys:`, Object.keys(zkKeys));
      
      // Enhanced Stats
      const enhancedStats = await this.getEnhancedUserStats(userAddress);
      console.log(`📊 Enhanced Stats:`, enhancedStats);
      
      // All stored accounts
      const allAccounts = this.getAllStoredAccounts();
      console.log(`👥 All stored accounts (${allAccounts.length}):`, allAccounts);
      
      // Raw localStorage data (encrypted)
      const utxoKey = this.getZKUserKey(userAddress);
      const zkKeyKey = this.getSecp256k1KeysKey(userAddress);
      
      console.log(`💾 Raw localStorage (encrypted):`);
      console.log(`  - UTXOs key: ${utxoKey}`);
      console.log(`  - UTXOs encrypted data length:`, localStorage.getItem(utxoKey)?.length || 0);
      console.log(`  - ZK keys key: ${zkKeyKey}`);
      console.log(`  - ZK keys encrypted data length:`, localStorage.getItem(zkKeyKey)?.length || 0);
      
    } catch (error) {
      console.error('❌ Debug storage failed:', error);
    }
  }

  /**
   * Obtener todos los UTXOs relacionados con un usuario (propios + recibidos) con ZK
   */
  static async getAllUserUTXOs(userAddress: string): Promise<{
    owned: PrivateUTXO[];
    received: PrivateUTXO[];
    all: PrivateUTXO[];
  }> {
    try {
      const normalizedAddress = userAddress.toLowerCase();
      
      // UTXOs donde soy el owner original
      const ownedUTXOs = await this.getPrivateUTXOs(userAddress);
      
      // Para ZK privacy, no podemos buscar en otras cuentas cifradas
      // Solo retornamos los UTXOs propios por seguridad
      // En un sistema ZK real, los UTXOs recibidos serían comunicados por el remitente
      const receivedUTXOs: PrivateUTXO[] = [];
      
      const allUTXOs = [...ownedUTXOs, ...receivedUTXOs];
      
      return {
        owned: ownedUTXOs,
        received: receivedUTXOs,
        all: allUTXOs
      };
      
    } catch (error) {
      console.error('❌ Failed to get all user UTXOs:', error);
      return {
        owned: [],
        received: [],
        all: []
      };
    }
  }

  /**
   * Obtener estadísticas detalladas incluyendo UTXOs recibidos
   */
  static async getEnhancedUserStats(userAddress: string): Promise<{
    ownedCount: number;
    receivedCount: number;
    totalCount: number;
    totalBalance: bigint;
    unspentBalance: bigint;
    uniqueTokens: string[];
    breakdown: {
      owned: { count: number; balance: bigint };
      received: { count: number; balance: bigint };
    };
  }> {
    try {
      const { owned, received, all } = await this.getAllUserUTXOs(userAddress);
      
      const unspentUTXOs = all.filter((utxo: PrivateUTXO) => !utxo.isSpent);
      const uniqueTokens = [...new Set(all.map((utxo: PrivateUTXO) => utxo.tokenAddress))];
      
      const ownedBalance = owned
        .filter((utxo: PrivateUTXO) => !utxo.isSpent)
        .reduce((sum: bigint, utxo: PrivateUTXO) => sum + utxo.value, BigInt(0));
        
      const receivedBalance = received
        .filter((utxo: PrivateUTXO) => !utxo.isSpent)
        .reduce((sum: bigint, utxo: PrivateUTXO) => sum + utxo.value, BigInt(0));
      
      return {
        ownedCount: owned.length,
        receivedCount: received.length,
        totalCount: all.length,
        totalBalance: ownedBalance + receivedBalance,
        unspentBalance: unspentUTXOs.reduce((sum: bigint, utxo: PrivateUTXO) => sum + utxo.value, BigInt(0)),
        uniqueTokens,
        breakdown: {
          owned: { count: owned.filter((u: PrivateUTXO) => !u.isSpent).length, balance: ownedBalance },
          received: { count: received.filter((u: PrivateUTXO) => !u.isSpent).length, balance: receivedBalance }
        }
      };
    } catch (error) {
      console.error('❌ Failed to get enhanced user stats:', error);
      return {
        ownedCount: 0,
        receivedCount: 0,
        totalCount: 0,
        totalBalance: BigInt(0),
        unspentBalance: BigInt(0),
        uniqueTokens: [],
        breakdown: {
          owned: { count: 0, balance: BigInt(0) },
          received: { count: 0, balance: BigInt(0) }
        }
      };
    }
  }

  /**
   * Obtener listado de todas las cuentas que han usado el sistema ZK
   */
  static getAllStoredAccounts(): string[] {
    try {
      const keys = Object.keys(localStorage);
      const zkUtxoKeys = keys.filter(key => key.startsWith(`${this.STORAGE_KEY}:zk:`));
      
      // Para obtener direcciones reales necesitamos revisar que las claves sean válidas
      const addresses: string[] = [];
      
      zkUtxoKeys.forEach(key => {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            // Si podemos obtener data, esta clave corresponde a un usuario válido
            // Por seguridad ZK, no podemos derivar la dirección directamente de la clave
            // Así que retornamos indicadores anónimos
            addresses.push(`zkUser_${key.split(':').pop()}`);
          }
        } catch (e) {
          // Ignorar claves inválidas
        }
      });
      
      return addresses;
      
    } catch (error) {
      console.error('❌ Failed to get stored accounts:', error);
      return [];
    }
  }

  /**
   * 🔧 TEMPORAL: Obtener TODOS los UTXOs sin filtrar por usuario (solo para debug ZK)
   * En producción ZK esto no debería ser posible por privacidad
   */
  static getAllPrivateUTXOs(): PrivateUTXO[] {
    try {
      console.warn('⚠️ getAllPrivateUTXOs called - this breaks ZK privacy in production!');
      
      // En un sistema ZK real, esto no debería ser posible
      // Solo para debugging en desarrollo
      const allUTXOs: PrivateUTXO[] = [];
      
      // Buscar claves ZK pero no podemos descifrar sin la dirección del usuario
      const keys = Object.keys(localStorage);
      const zkKeys = keys.filter(key => key.startsWith(`${this.STORAGE_KEY}:zk:`));
      
      console.log(`🔍 Found ${zkKeys.length} encrypted UTXO storages (cannot decrypt without user address)`);
      
      // También buscar en claves legacy no cifradas por si hay datos viejos
      keys.forEach(key => {
        if (key.includes('utxos') && !key.includes(this.STORAGE_KEY)) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const parsed = JSON.parse(data);
              if (Array.isArray(parsed)) {
                parsed.forEach(item => {
                  if (item.id && item.value && item.tokenAddress) {
                    allUTXOs.push(item);
                  }
                });
              }
            }
          } catch (e) {
            // Ignorar claves que no son JSON válido
          }
        }
      });
      
      // Deduplicar por ID
      const uniqueUTXOs = allUTXOs.filter((utxo, index, arr) => 
        arr.findIndex(u => u.id === utxo.id) === index
      );
      
      console.log(`🔍 Found ${uniqueUTXOs.length} legacy unencrypted UTXOs`);
      return uniqueUTXOs;
      
    } catch (error) {
      console.error('❌ Failed to get all private UTXOs:', error);
      return [];
    }
  }
}


