/**
 * PrivateUTXOStorage - Sistema de almacenamiento local para UTXOs privados
 * Preserva privacidad total: solo el usuario puede ver sus propios UTXOs
 */

import type { PrivateUTXO } from './PrivateUTXOManager';

export class PrivateUTXOStorage {
  private static readonly STORAGE_KEY = 'private-utxos';
  private static readonly USER_PREFIX = 'user:';

  /**
   * Obtener clave específica del usuario
   */
  private static getUserKey(userAddress: string): string {
    return `${this.STORAGE_KEY}:${this.USER_PREFIX}${userAddress.toLowerCase()}`;
  }

  /**
   * Guardar UTXO privado del usuario
   */
  static savePrivateUTXO(userAddress: string, utxo: PrivateUTXO): void {
    try {
      const userKey = this.getUserKey(userAddress);
      const existingUTXOs = this.getPrivateUTXOs(userAddress);
      
      // Actualizar o añadir UTXO
      const utxoIndex = existingUTXOs.findIndex(u => u.id === utxo.id);
      if (utxoIndex >= 0) {
        existingUTXOs[utxoIndex] = utxo;
      } else {
        existingUTXOs.push(utxo);
      }

      localStorage.setItem(userKey, JSON.stringify(existingUTXOs));
      console.log(`💾 Private UTXO saved locally for user ${userAddress.substring(0, 8)}...`);
    } catch (error) {
      console.error('❌ Failed to save private UTXO:', error);
    }
  }

  /**
   * Obtener todos los UTXOs privados del usuario
   */
  static getPrivateUTXOs(userAddress: string): PrivateUTXO[] {
    try {
      const userKey = this.getUserKey(userAddress);
      const storedData = localStorage.getItem(userKey);
      
      if (!storedData) {
        return [];
      }

      const utxos = JSON.parse(storedData) as PrivateUTXO[];
      
      // Convertir bigint strings de vuelta a bigint
      return utxos.map(utxo => ({
        ...utxo,
        value: typeof utxo.value === 'string' ? BigInt(utxo.value) : utxo.value,
        timestamp: typeof utxo.timestamp === 'string' ? BigInt(utxo.timestamp) : utxo.timestamp
      }));
    } catch (error) {
      console.error('❌ Failed to load private UTXOs:', error);
      return [];
    }
  }

  /**
   * Marcar UTXO como gastado
   */
  static markUTXOAsSpent(userAddress: string, utxoId: string): void {
    try {
      const utxos = this.getPrivateUTXOs(userAddress);
      const utxoIndex = utxos.findIndex(u => u.id === utxoId);
      
      if (utxoIndex >= 0) {
        utxos[utxoIndex].isSpent = true;
        const userKey = this.getUserKey(userAddress);
        localStorage.setItem(userKey, JSON.stringify(utxos));
        console.log(`⛔ UTXO ${utxoId.substring(0, 8)}... marked as spent`);
      }
    } catch (error) {
      console.error('❌ Failed to mark UTXO as spent:', error);
    }
  }

  /**
   * Obtener UTXOs no gastados del usuario
   */
  static getUnspentUTXOs(userAddress: string): PrivateUTXO[] {
    return this.getPrivateUTXOs(userAddress).filter(utxo => !utxo.isSpent);
  }

  /**
   * Obtener balance total del usuario para un token específico
   */
  static getBalance(userAddress: string, tokenAddress?: string): bigint {
    const unspentUTXOs = this.getUnspentUTXOs(userAddress);
    
    return unspentUTXOs
      .filter(utxo => !tokenAddress || utxo.tokenAddress.toLowerCase() === tokenAddress.toLowerCase())
      .reduce((total, utxo) => total + utxo.value, BigInt(0));
  }

  /**
   * Obtener estadísticas del usuario
   */
  static getUserStats(userAddress: string): {
    totalUTXOs: number;
    unspentUTXOs: number;
    spentUTXOs: number;
    uniqueTokens: number;
    totalBalance: bigint;
  } {
    const allUTXOs = this.getPrivateUTXOs(userAddress);
    const unspentUTXOs = allUTXOs.filter(utxo => !utxo.isSpent);
    const uniqueTokens = new Set(allUTXOs.map(utxo => utxo.tokenAddress.toLowerCase())).size;
    const totalBalance = unspentUTXOs.reduce((total, utxo) => total + utxo.value, BigInt(0));

    return {
      totalUTXOs: allUTXOs.length,
      unspentUTXOs: unspentUTXOs.length,
      spentUTXOs: allUTXOs.length - unspentUTXOs.length,
      uniqueTokens,
      totalBalance
    };
  }

  /**
   * Limpiar todos los datos del usuario (para desconexión)
   */
  static clearUserData(userAddress: string): void {
    try {
      const userKey = this.getUserKey(userAddress);
      localStorage.removeItem(userKey);
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
   * Obtener el tamaño de datos almacenados para un usuario
   */
  static getUserDataSize(userAddress: string): number {
    try {
      const userKey = this.getUserKey(userAddress);
      const data = localStorage.getItem(userKey);
      return data ? data.length : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Verificar si hay datos guardados para el usuario
   */
  static hasUserData(userAddress: string): boolean {
    const userKey = this.getUserKey(userAddress);
    return localStorage.getItem(userKey) !== null;
  }

  /**
   * Exportar datos del usuario (para backup)
   */
  static exportUserData(userAddress: string): string | null {
    try {
      const userKey = this.getUserKey(userAddress);
      return localStorage.getItem(userKey);
    } catch (error) {
      console.error('❌ Failed to export user data:', error);
      return null;
    }
  }

  /**
   * Importar datos del usuario (desde backup)
   */
  static importUserData(userAddress: string, data: string): boolean {
    try {
      // Validar que los datos son JSON válido
      const parsedData = JSON.parse(data);
      if (!Array.isArray(parsedData)) {
        throw new Error('Invalid data format');
      }

      const userKey = this.getUserKey(userAddress);
      localStorage.setItem(userKey, data);
      console.log(`📥 Private UTXO data imported for user ${userAddress.substring(0, 8)}...`);
      return true;
    } catch (error) {
      console.error('❌ Failed to import user data:', error);
      return false;
    }
  }
}
