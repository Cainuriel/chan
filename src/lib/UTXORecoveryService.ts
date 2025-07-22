/**
 * UTXORecoveryService - Sistema de recuperación de UTXOs desde blockchain
 * Detecta UTXOs creados en blockchain pero perdidos localmente
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
    commitmentHash: string;
    tokenAddress: string;
    blockNumber: number;
    canRecover: boolean;
    reason?: string;
  }[];
  recovered: number;
  unrecoverable: number;
}

export class UTXORecoveryService {
  
  constructor(
    private contract: any, // Usar any para compatibilidad con diferentes tipos de contrato
    private provider: ethers.Provider
  ) {}

  /**
   * Escanear blockchain para UTXOs del usuario y compararlos con localStorage
   */
  async scanAndRecoverUTXOs(userAddress: string, fromBlock: number = 0): Promise<UTXORecoveryResult> {
    console.log(`🔍 Scanning blockchain for UTXOs for user ${userAddress.substring(0, 8)}...`);
    
    const result: UTXORecoveryResult = {
      found: [],
      missing: [],
      recovered: 0,
      unrecoverable: 0
    };

    try {
      // 1. Obtener UTXOs locales
      const localUTXOs = PrivateUTXOStorage.getPrivateUTXOs(userAddress);
      const localUTXOIds = new Set(localUTXOs.map(u => u.id));
      
      console.log(`📂 Found ${localUTXOs.length} UTXOs in localStorage`);

      // 2. Escanear eventos de creación de UTXOs en blockchain
      const filter = this.contract.filters.PrivateUTXOCreated(null, null, null, null, null, null);
      const events = await this.contract.queryFilter(filter, fromBlock);
      
      console.log(`⛓️ Found ${events.length} UTXO creation events on blockchain`);

      // 3. Analizar cada evento
      for (const event of events) {
        // Verificar que es un EventLog con args
        if (!('args' in event) || !event.args) continue;

        const [utxoId, commitmentHash, tokenAddress, nullifierHash, utxoType, timestamp] = event.args;
        
        // 4. Verificar información del UTXO en el contrato
        const utxoInfo = await this.contract.getUTXOInfo(utxoId);
        const [exists, , , , isSpent, , , blockNumber] = utxoInfo;

        if (!exists) continue;

        // 5. Verificar si el UTXO pertenece al usuario
        // Necesitamos una forma de verificar ownership - por ahora usamos un heurístico
        const belongsToUser = await this.checkUTXOOwnership(
          utxoId, 
          commitmentHash, 
          userAddress, 
          event.blockNumber || 0
        );

        if (!belongsToUser) continue;

        // 6. Verificar si ya existe localmente
        if (localUTXOIds.has(utxoId)) {
          console.log(`✅ UTXO ${utxoId.substring(0, 8)}... already in localStorage`);
          result.found.push(localUTXOs.find(u => u.id === utxoId)!);
          continue;
        }

        // 7. UTXO encontrado en blockchain pero no localmente
        console.log(`🚨 Found missing UTXO: ${utxoId.substring(0, 8)}...`);
        
        const missingUTXO = {
          utxoId,
          commitmentHash,
          tokenAddress,
          blockNumber: Number(blockNumber),
          canRecover: false,
          reason: 'Missing blinding factor - cannot reconstruct private UTXO'
        };

        // 8. Intentar recuperar si es posible
        const recoveredUTXO = await this.attemptRecovery(
          utxoId,
          commitmentHash,
          tokenAddress,
          userAddress,
          Number(blockNumber),
          isSpent
        );

        if (recoveredUTXO) {
          result.found.push(recoveredUTXO);
          result.recovered++;
          console.log(`✅ Successfully recovered UTXO: ${utxoId.substring(0, 8)}...`);
        } else {
          result.missing.push(missingUTXO);
          result.unrecoverable++;
        }
      }

      console.log(`📊 Recovery summary:
        - Found: ${result.found.length}
        - Recovered: ${result.recovered}
        - Unrecoverable: ${result.unrecoverable}
        - Missing: ${result.missing.length}`);

      return result;

    } catch (error) {
      console.error('❌ UTXO recovery failed:', error);
      throw error;
    }
  }

  /**
   * Verificar si un UTXO pertenece al usuario
   * Nota: Esta es una aproximación - en un sistema real necesitaríamos más información
   */
  private async checkUTXOOwnership(
    utxoId: string,
    commitmentHash: string,
    userAddress: string,
    blockNumber: number
  ): Promise<boolean> {
    try {
      // Heurística: buscar transacciones del usuario en el mismo bloque
      const block = await this.provider.getBlock(blockNumber);
      if (!block) return false;

      // Buscar transacciones del usuario en el bloque
      for (const txHash of block.transactions) {
        const tx = await this.provider.getTransaction(txHash);
        if (tx && tx.from?.toLowerCase() === userAddress.toLowerCase()) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.warn('Could not verify UTXO ownership:', error);
      return false;
    }
  }

  /**
   * Intentar recuperar UTXO (limitado sin blinding factor)
   */
  private async attemptRecovery(
    utxoId: string,
    commitmentHash: string,
    tokenAddress: string,
    userAddress: string,
    blockNumber: number,
    isSpent: boolean
  ): Promise<PrivateUTXO | null> {
    try {
      // IMPORTANTE: Sin blinding factor, no podemos crear un UTXO privado completo
      // Solo podemos crear un registro de "UTXO conocido pero no utilizable"
      
      console.log(`⚠️ Attempting limited recovery for UTXO ${utxoId.substring(0, 8)}...`);
      console.log(`⚠️ WARNING: Without blinding factor, this UTXO will be read-only`);

      // Crear UTXO marcado como "no privado utilizable"
      const recoveredUTXO: PrivateUTXO = {
        id: utxoId,
        exists: true,
        value: BigInt(0), // No conocemos el valor sin el blinding factor
        tokenAddress,
        owner: userAddress,
        timestamp: BigInt(Date.now()),
        isSpent,
        commitment: commitmentHash,
        parentUTXO: '',
        utxoType: UTXOType.DEPOSIT,
        blindingFactor: 'UNKNOWN', // Marcador especial
        nullifierHash: 'UNKNOWN', // No lo conocemos
        localCreatedAt: Date.now(),
        confirmed: true,
        blockNumber,
        isPrivate: true,
        cryptographyType: 'BN254',
        // Metadatos especiales para UTXOs recuperados
        recovered: true,
        recoveryReason: 'Found on blockchain but missing locally',
        usable: false // No se puede usar para operaciones criptográficas
      };

      // Guardar en localStorage como registro histórico
      PrivateUTXOStorage.savePrivateUTXO(userAddress, recoveredUTXO);

      return recoveredUTXO;

    } catch (error) {
      console.error('Recovery attempt failed:', error);
      return null;
    }
  }

  /**
   * Verificar inconsistencias entre localStorage y blockchain
   */
  async auditUTXOConsistency(userAddress: string): Promise<{
    consistent: boolean;
    localOnly: string[];
    blockchainOnly: string[];
    mismatched: string[];
  }> {
    console.log(`🔍 Auditing UTXO consistency for user ${userAddress.substring(0, 8)}...`);

    const localUTXOs = PrivateUTXOStorage.getPrivateUTXOs(userAddress);
    const recovery = await this.scanAndRecoverUTXOs(userAddress);

    const localIds = new Set(localUTXOs.map(u => u.id));
    const blockchainIds = new Set([
      ...recovery.found.map(u => u.id),
      ...recovery.missing.map(m => m.utxoId)
    ]);

    const localOnly = localUTXOs
      .filter(u => !blockchainIds.has(u.id))
      .map(u => u.id);

    const blockchainOnly = recovery.missing.map(m => m.utxoId);

    const mismatched: string[] = [];
    // Aquí podríamos comparar estados específicos si tuviéramos más información

    const consistent = localOnly.length === 0 && blockchainOnly.length === 0 && mismatched.length === 0;

    console.log(`📊 Consistency audit results:
      - Consistent: ${consistent ? '✅' : '❌'}
      - Local only: ${localOnly.length}
      - Blockchain only: ${blockchainOnly.length}
      - Mismatched: ${mismatched.length}`);

    return {
      consistent,
      localOnly,
      blockchainOnly,
      mismatched
    };
  }

  /**
   * Obtener estadísticas de recuperación
   */
  static getRecoveryStats(userAddress: string): {
    totalUTXOs: number;
    usableUTXOs: number;
    recoveredUTXOs: number;
    unusableUTXOs: number;
  } {
    const utxos = PrivateUTXOStorage.getPrivateUTXOs(userAddress);
    
    const recoveredUTXOs = utxos.filter(u => (u as any).recovered === true);
    const usableUTXOs = utxos.filter(u => 
      u.blindingFactor && 
      u.blindingFactor !== 'UNKNOWN' && 
      !u.isSpent &&
      !(u as any).recovered
    );
    const unusableUTXOs = utxos.filter(u => 
      u.blindingFactor === 'UNKNOWN' || 
      (u as any).usable === false
    );

    return {
      totalUTXOs: utxos.length,
      usableUTXOs: usableUTXOs.length,
      recoveredUTXOs: recoveredUTXOs.length,
      unusableUTXOs: unusableUTXOs.length
    };
  }
}
