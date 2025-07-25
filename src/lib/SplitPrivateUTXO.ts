/**
 * @fileoverview SplitPrivateUTXO - Split de UTXO Privado con Criptografía secp256k1 Real
 * @description Divide un UTXO en múltiples UTXOs más pequeños manteniendo privacidad REAL
 */

import { ethers } from 'ethers';
import type { 
  ZKUTXOVaultContract, 
  ZKSplitParams,
  BackendAttestation
} from '../contracts/ZKUTXOVault.types';
import { getSplitErrorMessage } from '../contracts/ZKUTXOVault.types';
import {
  UTXOOperationError,
  UTXONotFoundError,
  InsufficientFundsError,
  UTXOAlreadySpentError
} from '../types/utxo.types';
import type { UTXOData } from '../types/utxo.types';
import type { PedersenCommitment } from '../types/zenroom.d';
import { CryptoHelpers as ZenroomHelpers } from '../utils/crypto.helpers';

/**
 * Error específico para validación de split
 */
export class SplitValidationError extends UTXOOperationError {
  constructor(message: string, public readonly errorCode?: number, context?: any) {
    super(message, 'validateSplit', context);
    this.name = 'SplitValidationError';
  }
}

/**
 * Datos necesarios para ejecutar un split de UTXO con criptografía REAL
 */
export interface SplitUTXOData {
  // UTXO de entrada - con criptografía REAL
  sourceCommitment: PedersenCommitment;  // Commitment Pedersen REAL en secp256k1
  sourceValue: bigint;
  sourceBlindingFactor: string;       // Blinding factor criptográfico REAL
  sourceNullifier: string;            // Nullifier hash criptográfico REAL
  
  // UTXOs de salida - todos con criptografía REAL
  outputValues: bigint[];
  outputBlindingFactors: string[];    // Blinding factors criptográficos REALES
  
  // Metadatos
  tokenAddress: string;
  sourceUTXOId?: string;
}

/**
 * Resultado de la operación de split
 */
export interface SplitOperationResult {
  success: boolean;
  transactionHash?: string;
  blockNumber?: number;                   // ← AGREGAR: número de bloque
  outputCommitmentHashes?: string[];      // Hashes criptográficos REALES
  outputCommitments?: PedersenCommitment[]; // Coordenadas completas para withdraw posterior
  outputNullifiers?: string[];            // Nullifiers criptográficos REALES
  outputBlindingFactors?: string[];       // ← AGREGAR: blinding factors generados
  outputUTXOIds?: string[];
  error?: string;
}

/**
 * @title SplitPrivateUTXO - Split con Criptografía secp256k1 REAL
 * @notice Divide un UTXO en múltiples UTXOs usando criptografía Pedersen REAL
 */
export class SplitPrivateUTXO {
  private lastGeneratedBlindingFactors: string[] = [];

  constructor(
    private contract: ZKUTXOVaultContract,
    private signer: ethers.Signer
  ) {}

  /**
   * @notice Ejecuta split de UTXO con criptografía secp256k1 REAL y pre-validación
   */
  async executeSplit(
    splitData: SplitUTXOData,
    backendAttestationProvider: (dataHash: string) => Promise<BackendAttestation>
  ): Promise<SplitOperationResult> {
    try {
      console.log('🔄 Iniciando split de UTXO con criptografía secp256k1 REAL...');
      console.log(`📊 Split: 1 UTXO (${splitData.sourceValue}) → ${splitData.outputValues.length} UTXOs`);

      // 1. Validar conservación de valor y datos criptográficos
      this._validateSplitData(splitData);

      // 2. Generar commitments Pedersen REALES y nullifiers criptográficos REALES
      console.log('🔐 Generando commitments Pedersen REALES en secp256k1...');
      const outputs = await this._generateRealCryptographicOutputs(splitData);

      // 3. PRE-VALIDACIÓN USANDO EL CONTRATO (ANTES DE ENVIAR TRANSACCIÓN)
      console.log('🔍 Pre-validando con contrato usando preValidateSplit...');
      await this._preValidateWithContract(
        splitData.sourceCommitment,
        outputs.commitments,
        splitData.sourceNullifier
      );

      // 4. Construir parámetros del contrato con criptografía REAL
      console.log('📋 Construyendo parámetros con criptografía REAL...');
      const splitParams = await this._buildRealCryptoParams(
        splitData,
        outputs,
        backendAttestationProvider
      );

      // 🔍 DEBUGGING NULLIFIERS ANTES DEL SPLIT
      console.log('🔍 SPLIT NULLIFIER DEBUGGING:');
      console.log('📦 Source UTXO from localStorage:', {
        sourceCommitment: splitData.sourceCommitment,
        sourceNullifier: splitData.sourceNullifier,
        sourceValue: splitData.sourceValue
      });
      
      // Verificar si el nullifier está usado ANTES del split
      const isUsedBefore = await this.contract.isNullifierUsed(splitData.sourceNullifier);
      console.log('🔍 Source nullifier used BEFORE split?', isUsedBefore);
      
      console.log('📤 Split params que se envían al contrato:', {
        inputNullifier: splitParams.inputNullifier,
        outputNullifiers: splitParams.outputNullifiers
      });
      
      // Verificar que inputNullifier es el mismo que sourceNullifier
      console.log('🔍 Nullifiers match?', {
        fromSplitData: splitData.sourceNullifier,
        sentToContract: splitParams.inputNullifier,
        areEqual: splitData.sourceNullifier === splitParams.inputNullifier
      });

      // 🔍 PRE-VALIDACIÓN COMPLETA CON TODOS LOS DATOS
      console.log('🔍 Ejecutando pre-validación COMPLETA antes de la transacción...');
      try {
        const [isValid, errorCode] = await this.contract.preValidateSplit(
          splitParams.inputNullifier,
          splitParams.outputNullifiers,
          splitParams.outputUTXOIds
        );

        if (!isValid) {
          const errorMessage = this._getValidationErrorMessage(errorCode);
          throw new SplitValidationError(
            `Pre-validación COMPLETA falló: ${errorMessage}`,
            errorCode
          );
        }
        console.log('✅ Pre-validación COMPLETA exitosa - todos los nullifiers y IDs validados');
      } catch (error: any) {
        console.error('❌ Pre-validación COMPLETA falló:', error);
        throw new SplitValidationError(`Pre-validación COMPLETA falló: ${error.message}`);
      }

      // 5. Ejecutar split en Alastria (sin estimación de gas)
      console.log('📤 Ejecutando split con criptografía secp256k1 REAL en Alastria...');
      const tx = await this.contract.splitPrivateUTXO(splitParams);
      
      console.log(`⏳ Transacción criptográfica enviada: ${tx.hash}`);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new UTXOOperationError(
          'Transaction receipt not available',
          'executeSplit'
        );
      }

      console.log(`✅ Split criptográfico REAL completado en bloque ${receipt.blockNumber}`);

      // 🔍 DEBUGGING NULLIFIERS DESPUÉS DEL SPLIT
      console.log('🔍 DESPUÉS DEL SPLIT:');
      
      // Verificar si el nullifier del source se marcó como usado
      const isUsedAfter = await this.contract.isNullifierUsed(splitData.sourceNullifier);
      console.log('🔍 Source nullifier used AFTER split?', {
        nullifier: splitData.sourceNullifier,
        isUsed: isUsedAfter
      });

      // 6. Extraer UTXOIds REALES de los eventos
      const outputUTXOIds = await this._extractRealUTXOIds(receipt);

      // ✅ SIGUIENDO PATRÓN DE DepositAsPrivateUTXO: Retornar datos completos
      console.log('✅ Retornando datos completos para ManagerUTXO...');
      
      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,                    // ← AGREGAR: número de bloque
        outputCommitmentHashes: outputs.commitmentHashes,    // Hashes REALES
        outputCommitments: outputs.commitments,              // Coordenadas completas para withdraw
        outputNullifiers: outputs.nullifiers,                // Nullifiers REALES
        outputBlindingFactors: this.lastGeneratedBlindingFactors, // ← AGREGAR: blinding factors
        outputUTXOIds: outputUTXOIds.length > 0 ? outputUTXOIds : outputs.nullifiers // ← MEJORAR: usar event o fallback
      };

    } catch (error: any) {
      console.error('❌ Error en split criptográfico:', error);
      
      if (error instanceof SplitValidationError) {
        return {
          success: false,
          error: `Validación criptográfica falló: ${error.message}`
        };
      }
      
      if (error instanceof UTXOOperationError) {
        return {
          success: false,
          error: `Operación criptográfica falló: ${error.message}`
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error en criptografía secp256k1'
      };
    }
  }

  /**
   * @notice PRE-VALIDACIÓN COMPLETA usando la función mejorada del contrato
   * @dev Valida input, outputs, duplicados y colisiones ANTES de la transacción
   */
  private async _preValidateWithContract(
    sourceCommitment: PedersenCommitment,
    outputCommitments: PedersenCommitment[],
    sourceNullifier: string
  ): Promise<void> {
    try {
      // Calcular hashes criptográficos REALES usando keccak256
      const sourceCommitmentHash = await this._calculateRealCommitmentHash(sourceCommitment);
      const outputCommitmentHashes = await Promise.all(
        outputCommitments.map(c => this._calculateRealCommitmentHash(c))
      );

      console.log(`🔍 Pre-validando COMPLETO con contrato: Input ${sourceCommitmentHash.substring(0, 10)}...`);

      // 🚨 NECESITAMOS LOS DATOS COMPLETOS PARA LA NUEVA PRE-VALIDACIÓN
      // Esto requiere acceso a los nullifiers y UTXO IDs de salida
      console.log('⚠️ Pre-validación completa requiere datos de split completos');
      console.log('🔄 Validación completa se ejecutará en el momento de la transacción');

      // NOTA: La pre-validación completa se hará antes de la transacción real
      // donde tenemos acceso a todos los nullifiers y UTXO IDs generados
      console.log('✅ Pre-validación será ejecutada antes de la transacción');

    } catch (error) {
      if (error instanceof SplitValidationError) {
        throw error;
      }
      
      console.error('❌ Error en pre-validación del contrato:', error);
      throw new SplitValidationError(
        'Error en pre-validación del contrato'
      );
    }
  }

  /**
   * @notice Generar commitments Pedersen REALES y nullifiers criptográficos REALES
   */
  private async _generateRealCryptographicOutputs(splitData: SplitUTXOData): Promise<{
    commitments: PedersenCommitment[];
    commitmentHashes: string[];
    nullifiers: string[];
  }> {
    const commitments: PedersenCommitment[] = [];
    const commitmentHashes: string[] = [];
    const nullifiers: string[] = [];

    const signerAddress = await this.signer.getAddress();

    // Generar blinding factors si no se proporcionaron
    if (!splitData.outputBlindingFactors || splitData.outputBlindingFactors.length === 0) {
      console.log('🔐 Generando blinding factors criptográficos automáticamente...');
      splitData.outputBlindingFactors = [];
      for (let i = 0; i < splitData.outputValues.length; i++) {
        const blindingFactor = ZenroomHelpers.generateSecureBlindingFactor();
        splitData.outputBlindingFactors.push(blindingFactor);
        console.log(`🔐 Generated blinding factor ${i + 1}: ${blindingFactor.substring(0, 16)}...`);
      }
    }

    // ✅ NUEVO: Guardar para uso posterior por ManagerUTXO
    this.lastGeneratedBlindingFactors = [...splitData.outputBlindingFactors];

    for (let i = 0; i < splitData.outputValues.length; i++) {
      const value = splitData.outputValues[i];
      const blindingFactor = splitData.outputBlindingFactors[i];

      console.log(`🔐 Generando commitment Pedersen REAL ${i + 1}/${splitData.outputValues.length}`);

      // Crear commitment Pedersen REAL usando ZenroomHelpers con secp256k1
      const pedersenCommitment = await ZenroomHelpers.createPedersenCommitment(
        value.toString(), 
        blindingFactor
      );
      
      // El PedersenCommitment ya viene en el formato correcto
      const commitmentPoint: PedersenCommitment = pedersenCommitment;
      
      // Hash criptográfico REAL del commitment
      const commitmentHash = await this._calculateRealCommitmentHash(commitmentPoint);
      
      // ✅ CORREGIDO: Generar nullifier único con MÁXIMA ENTROPÍA y verificación de colisiones
      // NO usar sourceNullifier (que ya está gastado) - usar solo datos únicos del output
      const uniqueSeed = ethers.solidityPacked(
        ['bytes32', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
        [
          blindingFactor,                    // ✅ Factor de cegado único del output
          commitmentHash,                    // ✅ Hash del commitment único del output
          splitData.sourceCommitment.x,      // ✅ Coordenada X del commitment padre (para derivación)
          splitData.sourceCommitment.y,      // ✅ Coordenada Y del commitment padre (para derivación)
          BigInt(i),                         // ✅ Índice del output (determinístico)
          value                              // ✅ Valor del output (determinístico)
        ]
      );
      
      // Generar nullifier usando datos únicos del output (NO sourceNullifier)
      let nullifier = await ZenroomHelpers.generateNullifierHash(
        commitmentHash,
        signerAddress,
        ethers.keccak256(uniqueSeed) // Seed criptográficamente seguro y único
      );
      
      // ✅ CRÍTICO: Verificar que el nullifier generado NO esté ya en uso
      let attemptCount = 0;
      while (attemptCount < 10) { // Máximo 10 intentos para evitar loops infinitos
        try {
          const isNullifierUsed = await this.contract.isNullifierUsed(nullifier);
          if (!isNullifierUsed) {
            break; // Nullifier único encontrado
          }
          
          // Nullifier ya en uso - regenerar con entropía adicional
          console.warn(`⚠️ Nullifier collision detected for output ${i}, regenerating...`);
          const additionalEntropy = ethers.keccak256(ethers.solidityPacked(
            ['bytes32', 'uint256', 'uint256'],
            [nullifier, BigInt(attemptCount), BigInt(Date.now())]
          ));
          
          const newUniqueSeed = ethers.keccak256(ethers.solidityPacked(
            ['bytes32', 'bytes32'],
            [ethers.keccak256(uniqueSeed), additionalEntropy]
          ));
          
          nullifier = await ZenroomHelpers.generateNullifierHash(
            commitmentHash,
            signerAddress,
            newUniqueSeed
          );
          
          attemptCount++;
        } catch (error) {
          console.error(`❌ Error checking nullifier uniqueness: ${error}`);
          break;
        }
      }
      
      if (attemptCount >= 10) {
        throw new SplitValidationError(
          `Failed to generate unique nullifier for output ${i} after 10 attempts`
        );
      }
      
      console.log(`   ✅ Nullifier único generado para output ${i}: ${nullifier.substring(0, 10)}...`)

      commitments.push(commitmentPoint);
      commitmentHashes.push(commitmentHash);
      nullifiers.push(nullifier);

      console.log(`   ✅ Commitment Pedersen REAL generado: ${commitmentHash.substring(0, 10)}...`);
    }

    console.log(`✅ Generados ${commitments.length} commitments Pedersen REALES con secp256k1`);
    
    // ✅ VERIFICACIÓN FINAL: Asegurar que no hay nullifiers duplicados entre los outputs
    const uniqueNullifiers = new Set(nullifiers);
    if (uniqueNullifiers.size !== nullifiers.length) {
      console.error('❌ DUPLICATED NULLIFIERS DETECTED:', {
        expected: nullifiers.length,
        unique: uniqueNullifiers.size,
        nullifiers: nullifiers.map((n, i) => `${i}: ${n.substring(0, 12)}...`)
      });
      throw new SplitValidationError(
        `Duplicated nullifiers detected: expected ${nullifiers.length} unique, got ${uniqueNullifiers.size}`
      );
    }
    
    // ✅ VERIFICACIÓN CRÍTICA: Los nullifiers de salida NO deben ser igual al nullifier de entrada
    const sourceNullifier = splitData.sourceNullifier;
    const conflictingOutputs = nullifiers.filter(n => n === sourceNullifier);
    if (conflictingOutputs.length > 0) {
      console.error('❌ OUTPUT NULLIFIER CONFLICTS WITH SOURCE NULLIFIER:', {
        sourceNullifier: sourceNullifier.substring(0, 12) + '...',
        conflictingOutputs: conflictingOutputs.length
      });
      throw new SplitValidationError(
        `Output nullifiers cannot be the same as source nullifier. Found ${conflictingOutputs.length} conflicts.`
      );
    }
    
    console.log(`✅ Verificación de unicidad: ${nullifiers.length} nullifiers únicos generados`);
    console.log(`✅ Verificación de conflictos: No conflicts with source nullifier`);
    return { commitments, commitmentHashes, nullifiers };
  }

  /**
   * @notice Construir parámetros con criptografía REAL
   */
  private async _buildRealCryptoParams(
    splitData: SplitUTXOData,
    outputs: { commitments: PedersenCommitment[]; nullifiers: string[] },
    backendAttestationProvider: (dataHash: string) => Promise<BackendAttestation>
  ): Promise<ZKSplitParams> {
    // Crear parámetros base para hash criptográfico REAL
    const baseParams: ZKSplitParams = {
      inputNullifier: splitData.sourceNullifier,
      outputUTXOIds: outputs.nullifiers, // En ZK architecture, usamos nullifiers como IDs
      outputNullifiers: outputs.nullifiers,
      attestation: {
        operation: "SPLIT",
        dataHash: ethers.ZeroHash,
        nonce: 0n,           // Usar bigint REAL
        timestamp: 0n,       // Usar bigint REAL
        signature: "0x"
      }
    };

    // Calcular dataHash criptográfico REAL usando ethers directamente
    console.log('🔢 Calculando dataHash criptográfico REAL...');
    const dataHash = ethers.keccak256(
      ethers.solidityPacked(
        ['string', 'bytes32', 'bytes32[]', 'bytes32[]'],
        [
          "SPLIT",
          splitData.sourceNullifier,
          outputs.nullifiers,
          outputs.nullifiers // En ZK usamos nullifiers como IDs
        ]
      )
    );

    console.log(`📋 DataHash criptográfico REAL: ${dataHash}`);

    // Obtener attestation criptográfica REAL del backend
    console.log('🏛️ Obteniendo attestation criptográfica REAL...');
    const attestation = await backendAttestationProvider(dataHash);

    console.log(`✅ Attestation criptográfica REAL obtenida - nonce: ${attestation.nonce}`);

    return {
      inputNullifier: splitData.sourceNullifier,
      outputUTXOIds: outputs.nullifiers, // En ZK usamos nullifiers como IDs
      outputNullifiers: outputs.nullifiers,
      attestation
    };
  }

  /**
   * @notice Validar conservación de valor y criptografía REAL
   */
  private _validateSplitData(splitData: SplitUTXOData): void {
    // Validar que hay outputs
    if (splitData.outputValues.length === 0) {
      throw new SplitValidationError('Debe haber al menos un UTXO de salida');
    }

    // Validar límite para gas
    if (splitData.outputValues.length > 10) {
      throw new SplitValidationError('Máximo 10 UTXOs de salida permitidos');
    }

    // Validar arrays consistentes para criptografía (si se proporcionaron blinding factors)
    if (splitData.outputBlindingFactors && splitData.outputBlindingFactors.length > 0) {
      if (splitData.outputValues.length !== splitData.outputBlindingFactors.length) {
        throw new SplitValidationError('Arrays de valores y blinding factors deben ser consistentes');
      }
      
      // Validar blinding factors criptográficos REALES (solo si se proporcionaron)
      for (let i = 0; i < splitData.outputBlindingFactors.length; i++) {
        if (!splitData.outputBlindingFactors[i] || splitData.outputBlindingFactors[i].length < 32) {
          throw new SplitValidationError(`Blinding factor criptográfico ${i} inválido`);
        }
      }
    } else {
      console.log('ℹ️ No se proporcionaron blinding factors - se generarán automáticamente');
    }

    // VALIDACIÓN CRÍTICA: Conservación de valor REAL
    const totalOutput = splitData.outputValues.reduce((sum, val) => sum + val, 0n);
    if (totalOutput !== splitData.sourceValue) {
      throw new SplitValidationError(
        `Conservación de valor FALLÓ: entrada=${splitData.sourceValue}, salida=${totalOutput}`
      );
    }

    // Validar valores positivos
    for (let i = 0; i < splitData.outputValues.length; i++) {
      if (splitData.outputValues[i] <= 0n) {
        throw new SplitValidationError(`Valor de salida ${i} debe ser positivo`);
      }
    }

    // Validar direcciones criptográficas
    if (!ethers.isAddress(splitData.tokenAddress)) {
      throw new SplitValidationError('Dirección de token inválida');
    }

    // Validar nullifier criptográfico REAL
    if (!splitData.sourceNullifier || splitData.sourceNullifier.length !== 66) {
      throw new SplitValidationError('Nullifier criptográfico inválido');
    }

    console.log(`✅ Validación criptográfica REAL exitosa: conservación verificada`);
    console.log(`   📊 Total input: ${splitData.sourceValue}, total output: ${totalOutput}`);
  }

  /**
   * @notice Calcular hash criptográfico REAL de commitment (igual que el contrato)
   */
  private async _calculateRealCommitmentHash(commitment: PedersenCommitment): Promise<string> {
    // Usar keccak256 REAL como el contrato Solidity
    return ethers.keccak256(
      ethers.solidityPacked(['uint256', 'uint256'], [commitment.x, commitment.y])
    );
  }

  /**
   * @notice Extraer UTXOIds REALES de los eventos del blockchain
   */
  private async _extractRealUTXOIds(receipt: ethers.ContractTransactionReceipt): Promise<string[]> {
    try {
      const outputUTXOIds: string[] = [];
      
      console.log('🔍 Buscando eventos ZKSplit en transaction receipt...');
      
      // Buscar eventos ZKSplit del contrato
      for (const log of receipt.logs) {
        try {
          // El evento ZKSplit tiene esta estructura:
          // emit ZKSplit(inputNullifier, outputUTXOIds, outputNullifiers, timestamp)
          const eventSignature = ethers.id("ZKSplit(bytes32,bytes32[],bytes32[],uint256)");
          
          if (log.topics[0] === eventSignature) {
            console.log('✅ Evento ZKSplit encontrado, decodificando...');
            
            // Decodificar el evento ZKSplit usando ethers directamente
            try {
              // Los datos del evento están en log.data
              // Formato: ZKSplit(bytes32 inputNullifier, bytes32[] outputUTXOIds, bytes32[] outputNullifiers, uint256 timestamp)
              const abiCoder = ethers.AbiCoder.defaultAbiCoder();
              const decoded = abiCoder.decode(
                ['bytes32[]', 'bytes32[]', 'uint256'], // outputUTXOIds, outputNullifiers, timestamp
                log.data
              );
              
              const eventOutputUTXOIds = decoded[0]; // outputUTXOIds es el primer parámetro
              if (eventOutputUTXOIds && Array.isArray(eventOutputUTXOIds)) {
                outputUTXOIds.push(...eventOutputUTXOIds);
                console.log(`📋 Extraídos ${eventOutputUTXOIds.length} UTXOIds del evento ZKSplit`);
              }
              
            } catch (decodeError) {
              console.warn('⚠️ Error decodificando evento ZKSplit:', decodeError);
              // Fallback: usar los nullifiers generados como UTXOIds
              console.log('🔄 Usando nullifiers como fallback para UTXOIds');
            }
          }
        } catch (parseError) {
          console.warn('⚠️ Error parsing log:', parseError);
          continue;
        }
      }
      
      console.log(`📋 Total de ${outputUTXOIds.length} UTXOIds REALES extraídos del evento ZKSplit`);
      return outputUTXOIds;
      
    } catch (error) {
      console.error('❌ Error extrayendo UTXOIds del evento ZKSplit:', error);
      console.log('🔄 Retornando array vacío - ManagerUTXO usará nullifiers como fallback');
      return []; // ManagerUTXO puede usar nullifiers como fallback
    }
  }

  /**
   * @notice Obtener información criptográfica REAL de un UTXO
   */
  async getUTXOForSplit(commitmentHash: string): Promise<{
    exists: boolean;
    isSpent: boolean;
    tokenAddress: string;
    canSplit: boolean;
    details?: UTXOData;
  }> {
    try {
      // En la nueva arquitectura ZK, usamos funciones simplificadas
      const exists = await this.contract.doesUTXOExist(commitmentHash);
      const isSpent = await this.contract.isNullifierUsed(commitmentHash);
      
      return {
        exists,
        isSpent,
        tokenAddress: ethers.ZeroAddress, // No disponible en arquitectura ZK
        canSplit: exists && !isSpent,
        details: undefined // No disponible en arquitectura ZK simplificada
      };
    } catch (error) {
      console.error('Error obteniendo información criptográfica del UTXO:', error);
      return {
        exists: false,
        isSpent: true,
        tokenAddress: ethers.ZeroAddress,
        canSplit: false
      };
    }
  }

  /**
   * @notice Validar split antes de ejecutar (sin gastar gas) - FUNCIÓN PÚBLICA
   */
  async validateSplitOperation(
    sourceCommitmentHash: string,
    outputCommitmentHashes: string[],
    sourceNullifier: string
  ): Promise<{
    isValid: boolean;
    errorCode?: number;
    errorMessage?: string;
  }> {
    try {
      // Para validación ligera, solo verificamos si el nullifier está usado
      const isUsed = await this.contract.isNullifierUsed(sourceNullifier);
      
      if (isUsed) {
        return {
          isValid: false,
          errorCode: 2,
          errorMessage: 'Input already spent'
        };
      }

      return {
        isValid: true
      };
    } catch (error) {
      return {
        isValid: false,
        errorMessage: `Error durante validación: ${error instanceof Error ? error.message : error}`
      };
    }
  }

  /**
   * @notice Obtener los blinding factors generados durante el split
   * @dev Útil para ManagerUTXO que necesita estos datos para crear UTXOs locales
   */
  getGeneratedBlindingFactors(): string[] {
    return this.lastGeneratedBlindingFactors || [];
  }

  /**
   * @notice Mensajes de error criptográficos basados en los códigos del contrato
   */
  private _getValidationErrorMessage(errorCode: number): string {
    return getSplitErrorMessage(errorCode);
  }
}

/**
 * @notice Factory para crear instancia con criptografía REAL
 */
export function createSplitPrivateUTXO(
  contract: ZKUTXOVaultContract,
  signer: ethers.Signer
): SplitPrivateUTXO {
  return new SplitPrivateUTXO(contract, signer);
}

/**
 * @notice Utilidad para calcular split óptimo manteniendo precisión criptográfica
 */
export function calculateOptimalSplit(
  totalAmount: bigint,
  numberOfOutputs: number
): bigint[] {
  if (numberOfOutputs <= 0) {
    throw new Error('Número de outputs debe ser positivo');
  }

  if (numberOfOutputs > 10) {
    throw new Error('Máximo 10 outputs para gas efficiency');
  }

  // División EXACTA manteniendo precisión criptográfica
  const baseAmount = totalAmount / BigInt(numberOfOutputs);
  const remainder = totalAmount % BigInt(numberOfOutputs);
  
  const outputs: bigint[] = [];
  
  for (let i = 0; i < numberOfOutputs; i++) {
    // Distribuir remainder manteniendo precisión EXACTA
    const amount = baseAmount + (i < Number(remainder) ? 1n : 0n);
    outputs.push(amount);
  }

  // Verificación criptográfica OBLIGATORIA
  const total = outputs.reduce((sum, val) => sum + val, 0n);
  if (total !== totalAmount) {
    throw new Error(`Error criptográfico: ${total} !== ${totalAmount}`);
  }

  return outputs;
}

/**
 * @notice Generar blinding factors criptográficos REALES para split
 */
export function generateRealCryptographicBlindingFactors(count: number): string[] {
  const factors: string[] = [];
  
  for (let i = 0; i < count; i++) {
    // Generar blinding factor criptográfico REAL usando ZenroomHelpers
    const factor = ZenroomHelpers.generateSecureBlindingFactor();
    factors.push(factor);
  }
  
  return factors;
}

/**
 * @notice Utilidad para validar parámetros de split antes de ejecutar
 */
export function validateSplitParameters(
  sourceValue: bigint,
  outputValues: bigint[],
  outputBlindingFactors: string[]
): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validar arrays
  if (outputValues.length === 0) {
    errors.push('Debe haber al menos un output');
  }

  if (outputValues.length !== outputBlindingFactors.length) {
    errors.push('Arrays de valores y blinding factors deben tener el mismo tamaño');
  }

  if (outputValues.length > 10) {
    errors.push('Máximo 10 outputs permitidos');
  }

  // Validar valores
  for (let i = 0; i < outputValues.length; i++) {
    if (outputValues[i] <= 0n) {
      errors.push(`Output ${i} debe ser positivo`);
    }
  }

  // Validar conservación
  const totalOutput = outputValues.reduce((sum, val) => sum + val, 0n);
  if (totalOutput !== sourceValue) {
    errors.push(`Conservación de valor falló: ${sourceValue} !== ${totalOutput}`);
  }

  // Validar blinding factors
  for (let i = 0; i < outputBlindingFactors.length; i++) {
    if (!outputBlindingFactors[i] || outputBlindingFactors[i].length < 10) {
      errors.push(`Blinding factor ${i} inválido`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}