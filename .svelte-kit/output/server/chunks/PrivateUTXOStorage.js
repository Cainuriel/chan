class PrivateUTXOStorage {
  static STORAGE_KEY = "private-utxos";
  static USER_PREFIX = "user:";
  /**
   * Obtener clave específica del usuario
   */
  static getUserKey(userAddress) {
    return `${this.STORAGE_KEY}:${this.USER_PREFIX}${userAddress.toLowerCase()}`;
  }
  /**
   * Guardar UTXO privado del usuario
   */
  static savePrivateUTXO(userAddress, utxo) {
    try {
      if (!utxo.id || !utxo.tokenAddress || !utxo.owner || typeof utxo.value === "undefined") {
        throw new Error("UTXO missing required fields");
      }
      const userKey = this.getUserKey(userAddress);
      console.log(`💾 Saving UTXO for user: ${userAddress}`);
      console.log(`💾 Using key: ${userKey}`);
      console.log(`💾 UTXO data:`, {
        id: utxo.id,
        value: utxo.value?.toString(),
        tokenAddress: utxo.tokenAddress,
        owner: utxo.owner,
        isSpent: utxo.isSpent
      });
      const existingUTXOs = this.getPrivateUTXOs(userAddress);
      console.log(`💾 Existing UTXOs count: ${existingUTXOs.length}`);
      const utxoIndex = existingUTXOs.findIndex((u) => u.id === utxo.id && u.owner.toLowerCase() === utxo.owner.toLowerCase());
      if (utxoIndex >= 0) {
        existingUTXOs[utxoIndex] = utxo;
        console.log(`💾 Updated existing UTXO at index ${utxoIndex}`);
      } else {
        existingUTXOs.push(utxo);
        console.log(`💾 Added new UTXO, total count: ${existingUTXOs.length}`);
      }
      const serializedData = JSON.stringify(existingUTXOs, (key, value) => {
        if (typeof value === "bigint") return value.toString();
        return value;
      });
      localStorage.setItem(userKey, serializedData);
      console.log(`💾 Saved to localStorage. Data length: ${serializedData.length}`);
      const verification = localStorage.getItem(userKey);
      console.log(`💾 Verification - data exists: ${verification !== null}`);
      console.log(`💾 Private UTXO saved locally for user ${userAddress.substring(0, 8)}...`);
    } catch (error) {
      console.error("❌ Failed to save private UTXO:", error);
    }
  }
  /**
   * Obtener todos los UTXOs privados del usuario
   */
  static getPrivateUTXOs(userAddress) {
    try {
      const userKey = this.getUserKey(userAddress);
      const storedData = localStorage.getItem(userKey);
      if (!storedData) {
        return [];
      }
      const utxos = JSON.parse(storedData);
      return utxos.map((utxo) => {
        const restored = {
          ...utxo,
          value: typeof utxo.value === "string" ? BigInt(utxo.value) : utxo.value,
          timestamp: typeof utxo.timestamp === "string" ? BigInt(utxo.timestamp) : utxo.timestamp
        };
        if (typeof utxo.blockNumber === "string") {
          const n = Number(utxo.blockNumber);
          restored.blockNumber = isNaN(n) ? void 0 : n;
        }
        return restored;
      });
    } catch (error) {
      console.error("❌ Failed to load private UTXOs:", error);
      return [];
    }
  }
  /**
   * Marcar UTXO como gastado
   */
  static markUTXOAsSpent(userAddress, utxoId) {
    try {
      const utxos = this.getPrivateUTXOs(userAddress);
      const utxoIndex = utxos.findIndex((u) => u.id === utxoId);
      if (utxoIndex >= 0) {
        utxos[utxoIndex].isSpent = true;
        const userKey = this.getUserKey(userAddress);
        localStorage.setItem(userKey, JSON.stringify(utxos));
        console.log(`⛔ UTXO ${utxoId.substring(0, 8)}... marked as spent`);
      }
    } catch (error) {
      console.error("❌ Failed to mark UTXO as spent:", error);
    }
  }
  /**
   * Obtener UTXOs no gastados del usuario
   */
  static getUnspentUTXOs(userAddress) {
    return this.getPrivateUTXOs(userAddress).filter((utxo) => !utxo.isSpent);
  }
  /**
   * Obtener balance total del usuario para un token específico
   */
  static getBalance(userAddress, tokenAddress) {
    const unspentUTXOs = this.getUnspentUTXOs(userAddress);
    return unspentUTXOs.filter((utxo) => !tokenAddress || utxo.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()).reduce((total, utxo) => total + utxo.value, BigInt(0));
  }
  /**
   * Obtener estadísticas del usuario
   */
  static getUserStats(userAddress) {
    const allUTXOs = this.getPrivateUTXOs(userAddress);
    const unspentUTXOs = allUTXOs.filter((utxo) => !utxo.isSpent);
    const uniqueTokens = new Set(allUTXOs.map((utxo) => utxo.tokenAddress.toLowerCase())).size;
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
  static clearUserData(userAddress) {
    try {
      const userKey = this.getUserKey(userAddress);
      localStorage.removeItem(userKey);
      console.log(`🧹 Private UTXO data cleared for user ${userAddress.substring(0, 8)}...`);
    } catch (error) {
      console.error("❌ Failed to clear user data:", error);
    }
  }
  /**
   * Limpiar todos los datos de UTXOs (para desarrollo)
   */
  static clearAllData() {
    try {
      const keys = Object.keys(localStorage);
      const utxoKeys = keys.filter((key) => key.startsWith(this.STORAGE_KEY));
      utxoKeys.forEach((key) => localStorage.removeItem(key));
      console.log(`🧹 All private UTXO data cleared (${utxoKeys.length} users)`);
    } catch (error) {
      console.error("❌ Failed to clear all data:", error);
    }
  }
  /**
   * Obtener el tamaño de datos almacenados para un usuario
   */
  static getUserDataSize(userAddress) {
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
  static hasUserData(userAddress) {
    const userKey = this.getUserKey(userAddress);
    return localStorage.getItem(userKey) !== null;
  }
  /**
   * Exportar datos del usuario (para backup)
   */
  static exportUserData(userAddress) {
    try {
      const userKey = this.getUserKey(userAddress);
      return localStorage.getItem(userKey);
    } catch (error) {
      console.error("❌ Failed to export user data:", error);
      return null;
    }
  }
  /**
   * Importar datos del usuario (desde backup)
   */
  static importUserData(userAddress, data) {
    try {
      const parsedData = JSON.parse(data);
      if (!Array.isArray(parsedData)) {
        throw new Error("Invalid data format");
      }
      const userKey = this.getUserKey(userAddress);
      localStorage.setItem(userKey, data);
      console.log(`📥 Private UTXO data imported for user ${userAddress.substring(0, 8)}...`);
      return true;
    } catch (error) {
      console.error("❌ Failed to import user data:", error);
      return false;
    }
  }
  /**
   * Guardar claves BBS+ del usuario (necesarias para operaciones criptográficas)
   */
  static saveBBSKeys(userAddress, tokenAddress, keys) {
    try {
      const keysKey = `${this.STORAGE_KEY}:bbs-keys:${userAddress.toLowerCase()}`;
      const existingKeys = this.getBBSKeys(userAddress);
      existingKeys[tokenAddress.toLowerCase()] = keys;
      localStorage.setItem(keysKey, JSON.stringify(existingKeys));
      console.log(`🔑 BBS+ keys saved for token ${tokenAddress.substring(0, 8)}...`);
    } catch (error) {
      console.error("❌ Failed to save BBS+ keys:", error);
    }
  }
  /**
   * Obtener claves BBS+ del usuario
   */
  static getBBSKeys(userAddress) {
    try {
      const keysKey = `${this.STORAGE_KEY}:bbs-keys:${userAddress.toLowerCase()}`;
      const storedData = localStorage.getItem(keysKey);
      if (!storedData) {
        return {};
      }
      return JSON.parse(storedData);
    } catch (error) {
      console.error("❌ Failed to load BBS+ keys:", error);
      return {};
    }
  }
  /**
   * Verificar si existen claves BBS+ para un token
   */
  static hasBBSKeys(userAddress, tokenAddress) {
    const keys = this.getBBSKeys(userAddress);
    return !!keys[tokenAddress.toLowerCase()];
  }
  /**
   * Eliminar claves BBS+ (logout/reset)
   */
  static clearBBSKeys(userAddress) {
    try {
      const keysKey = `${this.STORAGE_KEY}:bbs-keys:${userAddress.toLowerCase()}`;
      localStorage.removeItem(keysKey);
      console.log(`🗑️ BBS+ keys cleared for user ${userAddress.substring(0, 8)}...`);
    } catch (error) {
      console.error("❌ Failed to clear BBS+ keys:", error);
    }
  }
  /**
   * Función de depuración: mostrar todo el contenido de localStorage para un usuario
   */
  static debugStorage(userAddress) {
    try {
      console.log(`🔍 DEBUG: localStorage content for user ${userAddress}`);
      const { owned, received, all } = this.getAllUserUTXOs(userAddress);
      console.log(`📦 Owned UTXOs (${owned.length}):`, owned);
      console.log(`📥 Received UTXOs (${received.length}):`, received);
      console.log(`📊 All UTXOs (${all.length}):`, all);
      const bbsKeys = this.getBBSKeys(userAddress);
      console.log(`🔑 BBS+ Keys:`, Object.keys(bbsKeys));
      const enhancedStats = this.getEnhancedUserStats(userAddress);
      console.log(`📊 Enhanced Stats:`, enhancedStats);
      const allAccounts = this.getAllStoredAccounts();
      console.log(`👥 All stored accounts (${allAccounts.length}):`, allAccounts);
      const utxoKey = this.getUserKey(userAddress);
      const bbsKeyKey = `${this.STORAGE_KEY}:bbs-keys:${userAddress.toLowerCase()}`;
      console.log(`💾 Raw localStorage:`);
      console.log(`  - UTXOs key: ${utxoKey}`);
      console.log(`  - UTXOs data:`, localStorage.getItem(utxoKey));
      console.log(`  - BBS keys key: ${bbsKeyKey}`);
      console.log(`  - BBS keys data:`, localStorage.getItem(bbsKeyKey));
    } catch (error) {
      console.error("❌ Debug storage failed:", error);
    }
  }
  /**
   * Obtener todos los UTXOs relacionados con un usuario (propios + recibidos)
   */
  static getAllUserUTXOs(userAddress) {
    try {
      const normalizedAddress = userAddress.toLowerCase();
      const ownedUTXOs = this.getPrivateUTXOs(userAddress);
      const receivedUTXOs = [];
      const keys = Object.keys(localStorage);
      const utxoKeys = keys.filter((key) => key.startsWith(`${this.STORAGE_KEY}:${this.USER_PREFIX}`));
      utxoKeys.forEach((key) => {
        if (!key.includes(normalizedAddress)) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const utxos = JSON.parse(data);
              const receivedFromThisAccount = utxos.filter(
                (utxo) => utxo.owner.toLowerCase() === normalizedAddress && !key.includes(normalizedAddress)
                // Vienen de otra cuenta
              );
              receivedUTXOs.push(...receivedFromThisAccount);
            }
          } catch (error) {
            console.warn(`⚠️ Error reading UTXOs from key ${key}:`, error);
          }
        }
      });
      const processedReceived = receivedUTXOs.map((utxo) => ({
        ...utxo,
        value: typeof utxo.value === "string" ? BigInt(utxo.value) : utxo.value,
        timestamp: typeof utxo.timestamp === "string" ? BigInt(utxo.timestamp) : utxo.timestamp
      }));
      const allUTXOs = [...ownedUTXOs, ...processedReceived];
      return {
        owned: ownedUTXOs,
        received: processedReceived,
        all: allUTXOs
      };
    } catch (error) {
      console.error("❌ Failed to get all user UTXOs:", error);
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
  static getEnhancedUserStats(userAddress) {
    try {
      const { owned, received, all } = this.getAllUserUTXOs(userAddress);
      const unspentUTXOs = all.filter((utxo) => !utxo.isSpent);
      const uniqueTokens = [...new Set(all.map((utxo) => utxo.tokenAddress))];
      const ownedBalance = owned.filter((utxo) => !utxo.isSpent).reduce((sum, utxo) => sum + utxo.value, BigInt(0));
      const receivedBalance = received.filter((utxo) => !utxo.isSpent).reduce((sum, utxo) => sum + utxo.value, BigInt(0));
      return {
        ownedCount: owned.length,
        receivedCount: received.length,
        totalCount: all.length,
        totalBalance: ownedBalance + receivedBalance,
        unspentBalance: unspentUTXOs.reduce((sum, utxo) => sum + utxo.value, BigInt(0)),
        uniqueTokens,
        breakdown: {
          owned: { count: owned.filter((u) => !u.isSpent).length, balance: ownedBalance },
          received: { count: received.filter((u) => !u.isSpent).length, balance: receivedBalance }
        }
      };
    } catch (error) {
      console.error("❌ Failed to get enhanced user stats:", error);
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
   * Obtener listado de todas las cuentas que han usado el sistema
   */
  static getAllStoredAccounts() {
    try {
      const keys = Object.keys(localStorage);
      const utxoKeys = keys.filter((key) => key.startsWith(`${this.STORAGE_KEY}:${this.USER_PREFIX}`));
      return utxoKeys.map((key) => {
        const address = key.replace(`${this.STORAGE_KEY}:${this.USER_PREFIX}`, "");
        return address;
      }).filter((addr) => addr.length > 0);
    } catch (error) {
      console.error("❌ Failed to get stored accounts:", error);
      return [];
    }
  }
}
export {
  PrivateUTXOStorage
};
