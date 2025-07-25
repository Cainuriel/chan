/**
 * UTXORecoveryService - Sistema de recuperación de UTXOs desde blockchain (Arquitectura Ultra-Simplificada)
 * Detecta UTXOIds creados en blockchain y recupera información desde localStorage cifrado
 * NOTA: Los contratos solo almacenan UTXOId + isSpent, toda la información privada está en localStorage
 */

import { ethers, type EventLog } from 'ethers';
import type { PrivateUTXO } from './ManagerUTXO';
import type { ExtendedUTXOData } from '../types/utxo.types';
import { UTXOType } from '../types/utxo.types';
import { PrivateUTXOStorage } from './PrivateUTXOStorage';

export interface UTXORecoveryResult {
  found: PrivateUTXO[];
  missing: {
    utxoId: string;
    isSpent: boolean;
    blockNumber: number;
    canRecover: boolean;
    reason?: string;
  }[];
  recovered: number;
  unrecoverable: number;
  syncedFromBlockchain: number; // UTXOs sincronizados desde blockchain
}

export class UTXORecoveryService {
  
  constructor(
    private contract: any, // Usar any para compatibilidad con diferentes tipos de contrato
    private provider: ethers.Provider
  ) {}

  /**
   * Escanear blockchain para UTXOIds del usuario y sincronizar con localStorage ZK cifrado
   * NUEVA ARQUITECTURA: Solo recuperamos UTXOIds + isSpent desde contrato
   */
  async scanAndRecoverUTXOs(userAddress: string, fromBlock: number = 0): Promise<UTXORecoveryResult> {
    console.log(`🔍 Scanning blockchain for UTXO IDs for user ${userAddress.substring(0, 8)}...`);
    console.log(`📋 NOTE: Contract only stores UTXOId + isSpent, private data in encrypted localStorage`);
    
    const result: UTXORecoveryResult = {
      found: [],
      missing: [],
      recovered: 0,
      unrecoverable: 0,
      syncedFromBlockchain: 0
    };

    try {
      // 1. Obtener UTXOs locales desde localStorage ZK cifrado
      const localUTXOs = PrivateUTXOStorage.getPrivateUTXOs(userAddress);
      const localUTXOIds = new Set(localUTXOs.map(u => u.id));
      
      console.log(`📂 Found ${localUTXOs.length} UTXOs in encrypted localStorage`);

      // 2. NUEVA ARQUITECTURA: Escanear eventos simplificados
      // Buscar eventos de creación de UTXOIds (no más commitment hashes)
      const filter = this.contract.filters.UTXOCreated ? 
        this.contract.filters.UTXOCreated(null, null) : // (utxoId, creator)
        this.contract.filters.PrivateUTXOCreated ? 
        this.contract.filters.PrivateUTXOCreated(null, null, null) : // Fallback a eventos antiguos
        null;

      if (!filter) {
        console.warn('⚠️ No UTXO creation events filter available in contract');
        return result;
      }

      const events = await this.contract.queryFilter(filter, fromBlock);
      console.log(`⛓️ Found ${events.length} UTXO creation events on blockchain`);

      // 3. Analizar cada evento de creación de UTXO
      for (const event of events) {
        if (!('args' in event) || !event.args) continue;

        // NUEVA ARQUITECTURA: Solo tenemos UTXOId y creator
        const utxoId = event.args[0]; // UTXOId
        const creator = event.args[1]; // Creator address
        
        // 4. Verificar si este UTXO pertenece al usuario
        if (creator?.toLowerCase() !== userAddress.toLowerCase()) {
          continue; // No es del usuario actual
        }

        // 5. NUEVA ARQUITECTURA: Verificar estado en contrato (solo isSpent disponible)
        let isSpent = false;
        try {
          isSpent = await this.contract.isUTXOSpent(utxoId);
        } catch (error) {
          console.warn(`⚠️ Could not check spent status for UTXO ${utxoId.substring(0, 8)}...`);
          continue;
        }

        const blockNumber = event.blockNumber || 0;

        // 6. Verificar si ya existe localmente
        if (localUTXOIds.has(utxoId)) {
          console.log(`✅ UTXO ${utxoId.substring(0, 8)}... already in encrypted localStorage`);
          
          // Actualizar estado isSpent desde blockchain si cambió
          const localUTXO = localUTXOs.find(u => u.id === utxoId);
          if (localUTXO && localUTXO.isSpent !== isSpent) {
            console.log(`� Updating spent status for UTXO ${utxoId.substring(0, 8)}... to ${isSpent}`);
            localUTXO.isSpent = isSpent;
            PrivateUTXOStorage.savePrivateUTXO(userAddress, localUTXO);
            result.syncedFromBlockchain++;
          }
          
          result.found.push(localUTXO!);
          continue;
        }

        // 7. UTXO encontrado en blockchain pero no localmente
        console.log(`🚨 Found UTXO ID on blockchain but not in localStorage: ${utxoId.substring(0, 8)}...`);
        
        const missingUTXO = {
          utxoId,
          isSpent,
          blockNumber,
          canRecover: false,
          reason: 'UTXO ID found on blockchain but no private data in encrypted localStorage - cannot recover without original creation data'
        };

        result.missing.push(missingUTXO);
        result.unrecoverable++;
      }

      console.log(`📊 Recovery summary for ultra-simplified architecture:
        - Found in localStorage: ${result.found.length}
        - Synced from blockchain: ${result.syncedFromBlockchain}
        - Missing private data: ${result.missing.length}
        - Unrecoverable: ${result.unrecoverable}`);

      return result;

    } catch (error) {
      console.error('❌ UTXO recovery failed:', error);
      throw error;
    }
  }

  /**
   * NUEVA ARQUITECTURA: Intentar recuperación limitada 
   * NOTA: Sin datos privados en contrato, solo podemos crear un registro placeholder
   */
  private async attemptLimitedRecovery(
    utxoId: string,
    userAddress: string,
    blockNumber: number,
    isSpent: boolean
  ): Promise<PrivateUTXO | null> {
    try {
      console.log(`⚠️ NUEVA ARQUITECTURA: Cannot recover private UTXO data`);
      console.log(`📋 Contract only stores UTXOId + isSpent, all private data is in encrypted localStorage`);
      console.log(`🔍 UTXO ${utxoId.substring(0, 8)}... exists on blockchain but no private data available`);

      // En la nueva arquitectura ultra-simplificada, NO podemos recuperar UTXOs
      // porque toda la información privada (commitments, blinding factors, valores)
      // está SOLO en localStorage cifrado y no en el contrato
      
      console.log(`❌ Recovery impossible: Private data not stored on blockchain`);
      return null;

    } catch (error) {
      console.error('❌ Limited recovery attempt failed:', error);
      return null;
    }
  }

  /**
   * NUEVA ARQUITECTURA: Verificar consistencia entre localStorage ZK cifrado y blockchain simplificado
   * Solo comparamos UTXOIds y estados isSpent
   */
  async auditUTXOConsistency(userAddress: string): Promise<{
    consistent: boolean;
    localOnly: string[];
    blockchainOnly: string[];
    spentStatusMismatches: { utxoId: string; localSpent: boolean; blockchainSpent: boolean }[];
    totalSynced: number;
  }> {
    console.log(`🔍 Auditing UTXO consistency for ultra-simplified architecture...`);
    console.log(`📋 User: ${userAddress.substring(0, 8)}... (checking UTXOIds + spent status only)`);

    const localUTXOs = PrivateUTXOStorage.getPrivateUTXOs(userAddress);
    const recovery = await this.scanAndRecoverUTXOs(userAddress);

    const localIds = new Set(localUTXOs.map(u => u.id));
    const blockchainIds = new Set([
      ...recovery.found.map(u => u.id),
      ...recovery.missing.map(m => m.utxoId)
    ]);

    // UTXOs que están en localStorage pero no en blockchain
    const localOnly = localUTXOs
      .filter(u => !blockchainIds.has(u.id))
      .map(u => u.id);

    // UTXOIds que están en blockchain pero no en localStorage (sin datos privados)
    const blockchainOnly = recovery.missing.map(m => m.utxoId);

    // Comparar estados isSpent entre localStorage y blockchain
    const spentStatusMismatches: { utxoId: string; localSpent: boolean; blockchainSpent: boolean }[] = [];
    
    for (const localUTXO of localUTXOs) {
      if (blockchainIds.has(localUTXO.id)) {
        try {
          const blockchainSpent = await this.contract.isUTXOSpent(localUTXO.id);
          if (localUTXO.isSpent !== blockchainSpent) {
            spentStatusMismatches.push({
              utxoId: localUTXO.id,
              localSpent: localUTXO.isSpent,
              blockchainSpent
            });
          }
        } catch (error) {
          console.warn(`⚠️ Could not check blockchain spent status for ${localUTXO.id.substring(0, 8)}...`);
        }
      }
    }

    const consistent = localOnly.length === 0 && 
                      blockchainOnly.length === 0 && 
                      spentStatusMismatches.length === 0;

    console.log(`📊 Consistency audit results (ultra-simplified architecture):
      - Consistent: ${consistent ? '✅' : '❌'}
      - Local only (not on blockchain): ${localOnly.length}
      - Blockchain only (missing private data): ${blockchainOnly.length}
      - Spent status mismatches: ${spentStatusMismatches.length}
      - Total synced from blockchain: ${recovery.syncedFromBlockchain}`);

    if (spentStatusMismatches.length > 0) {
      console.log(`🔄 Spent status mismatches found:`);
      spentStatusMismatches.forEach(mismatch => {
        console.log(`  - ${mismatch.utxoId.substring(0, 8)}...: local=${mismatch.localSpent}, blockchain=${mismatch.blockchainSpent}`);
      });
    }

    return {
      consistent,
      localOnly,
      blockchainOnly,
      spentStatusMismatches,
      totalSynced: recovery.syncedFromBlockchain
    };
  }

  /**
   * NUEVA ARQUITECTURA: Obtener estadísticas de UTXOs para arquitectura ultra-simplificada
   */
  static getRecoveryStats(userAddress: string): {
    totalUTXOs: number;
    usableUTXOs: number;
    spentUTXOs: number;
    unspentUTXOs: number;
    privateDataComplete: number;
    missingPrivateData: number;
  } {
    const utxos = PrivateUTXOStorage.getPrivateUTXOs(userAddress);
    
    const spentUTXOs = utxos.filter(u => u.isSpent);
    const unspentUTXOs = utxos.filter(u => !u.isSpent);
    
    // En la nueva arquitectura, todos los UTXOs en localStorage tienen datos privados completos
    // (porque es la única fuente de datos privados)
    const privateDataComplete = utxos.filter(u => 
      u.blindingFactor && 
      u.blindingFactor !== 'UNKNOWN' && 
      u.blindingFactor !== ''
    );
    
    const missingPrivateData = utxos.filter(u => 
      !u.blindingFactor || 
      u.blindingFactor === 'UNKNOWN' || 
      u.blindingFactor === ''
    );

    // Usable = tiene datos privados completos y no está gastado
    const usableUTXOs = utxos.filter(u => 
      u.blindingFactor && 
      u.blindingFactor !== 'UNKNOWN' && 
      u.blindingFactor !== '' &&
      !u.isSpent
    );

    console.log(`📊 UTXO Stats for ultra-simplified architecture:
      - Total UTXOs in encrypted localStorage: ${utxos.length}
      - Usable (unspent + complete private data): ${usableUTXOs.length}
      - Spent: ${spentUTXOs.length}
      - Unspent: ${unspentUTXOs.length}
      - Complete private data: ${privateDataComplete.length}
      - Missing private data: ${missingPrivateData.length}`);

    return {
      totalUTXOs: utxos.length,
      usableUTXOs: usableUTXOs.length,
      spentUTXOs: spentUTXOs.length,
      unspentUTXOs: unspentUTXOs.length,
      privateDataComplete: privateDataComplete.length,
      missingPrivateData: missingPrivateData.length
    };
  }

  /**
   * NUEVA ARQUITECTURA: Sincronizar estados spent desde blockchain
   */
  static async syncSpentStatusFromBlockchain(
    userAddress: string, 
    contract: any
  ): Promise<{
    updated: number;
    errors: number;
  }> {
    console.log(`🔄 Syncing spent status from blockchain for ultra-simplified architecture...`);
    
    const utxos = PrivateUTXOStorage.getPrivateUTXOs(userAddress);
    let updated = 0;
    let errors = 0;

    for (const utxo of utxos) {
      try {
        const blockchainSpent = await contract.isUTXOSpent(utxo.id);
        
        if (utxo.isSpent !== blockchainSpent) {
          console.log(`🔄 Updating spent status for ${utxo.id.substring(0, 8)}...: ${utxo.isSpent} → ${blockchainSpent}`);
          utxo.isSpent = blockchainSpent;
          PrivateUTXOStorage.savePrivateUTXO(userAddress, utxo);
          updated++;
        }
      } catch (error) {
        console.warn(`⚠️ Error syncing spent status for ${utxo.id.substring(0, 8)}...:`, error);
        errors++;
      }
    }

    console.log(`✅ Spent status sync complete: ${updated} updated, ${errors} errors`);
    
    return { updated, errors };
  }
}
