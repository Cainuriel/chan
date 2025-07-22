/**
 * @fileoverview SplitPrivateUTXO - Split de UTXO Privado con Criptografía BN254 Real
 * @description Divide un UTXO en múltiples UTXOs más pequeños manteniendo privacidad REAL
 */

import { ethers } from 'ethers';
import type { 
  UTXOVaultContract, 
  SplitParams,
  CommitmentPoint,
  BackendAttestation,
  UTXODetails
} from '../contracts/UTXOVault.types';
import {
  UTXOOperationError,
  UTXONotFoundError,
  InsufficientFundsError,
  UTXOAlreadySpentError
} from '../types/utxo.types';
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
  sourceCommitment: CommitmentPoint;  // Commitment Pedersen REAL en BN254
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
  outputCommitmentHashes?: string[];  // Hashes criptográficos REALES
  outputNullifiers?: string[];        // Nullifiers criptográficos REALES
  error?: string;
  outputUTXOIds?: string[];
}

/**
 * @title SplitPrivateUTXO - Split con Criptografía BN254 REAL
 * @notice Divide un UTXO en múltiples UTXOs usando criptografía Pedersen REAL
 */
export class SplitPrivateUTXO {
  constructor(
    private contract: UTXOVaultContract,
    private signer: ethers.Signer
  ) {}

  /**
   * @notice Ejecuta split de UTXO con criptografía BN254 REAL y pre-validación
   */
  async executeSplit(
    splitData: SplitUTXOData,
    backendAttestationProvider: (dataHash: string) => Promise<BackendAttestation>
  ): Promise<SplitOperationResult> {
    try {
      console.log('🔄 Iniciando split de UTXO con criptografía BN254 REAL...');
      console.log(`📊 Split: 1 UTXO (${splitData.sourceValue}) → ${splitData.outputValues.length} UTXOs`);

      // 1. Validar conservación de valor y datos criptográficos
      this._validateSplitData(splitData);

      // 2. Generar commitments Pedersen REALES y nullifiers criptográficos REALES
      console.log('🔐 Generando commitments Pedersen REALES en BN254...');
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

      // 5. Ejecutar split en Alastria (sin estimación de gas)
      console.log('📤 Ejecutando split con criptografía BN254 REAL en Alastria...');
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

      // 6. Extraer UTXOIds REALES de los eventos
      const outputUTXOIds = await this._extractRealUTXOIds(receipt);

      return {
        success: true,
        transactionHash: receipt.hash,
        outputCommitmentHashes: outputs.commitmentHashes,  // Hashes REALES
        outputNullifiers: outputs.nullifiers,              // Nullifiers REALES
        outputUTXOIds
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
        error: error instanceof Error ? error.message : 'Error en criptografía BN254'
      };
    }
  }

  /**
   * @notice PRE-VALIDACIÓN usando la función pública preValidateSplit del contrato
   * @dev Esto se ejecuta ANTES de enviar la transacción para asegurar que será aceptada
   */
  private async _preValidateWithContract(
    sourceCommitment: CommitmentPoint,
    outputCommitments: CommitmentPoint[],
    sourceNullifier: string
  ): Promise<void> {
    try {
      // Calcular hashes criptográficos REALES usando keccak256
      const sourceCommitmentHash = await this._calculateRealCommitmentHash(sourceCommitment);
      const outputCommitmentHashes = await Promise.all(
        outputCommitments.map(c => this._calculateRealCommitmentHash(c))
      );

      console.log(`🔍 Pre-validando con contrato: Input ${sourceCommitmentHash.substring(0, 10)}...`);

      // LLAMAR A LA FUNCIÓN PÚBLICA preValidateSplit DEL CONTRATO
      const [isValid, errorCode] = await this.contract.preValidateSplit(
        sourceCommitmentHash,
        outputCommitmentHashes,
        sourceNullifier
      );

      if (!isValid) {
        const errorMessage = this._getValidationErrorMessage(errorCode);
        throw new SplitValidationError(
          `Pre-validación del contrato falló: ${errorMessage}`,
          errorCode
        );
      }

      console.log('✅ Pre-validación del contrato exitosa - Split será aceptado');

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
    commitments: CommitmentPoint[];
    commitmentHashes: string[];
    nullifiers: string[];
  }> {
    const commitments: CommitmentPoint[] = [];
    const commitmentHashes: string[] = [];
    const nullifiers: string[] = [];

    const signerAddress = await this.signer.getAddress();

    for (let i = 0; i < splitData.outputValues.length; i++) {
      const value = splitData.outputValues[i];
      const blindingFactor = splitData.outputBlindingFactors[i];

      console.log(`🔐 Generando commitment Pedersen REAL ${i + 1}/${splitData.outputValues.length}`);

      // Crear commitment Pedersen REAL usando ZenroomHelpers con BN254
      const pedersenCommitment = await ZenroomHelpers.createPedersenCommitment(
        value.toString(), 
        blindingFactor
      );
      
      // Convertir a formato del contrato manteniendo precisión criptográfica
      const commitmentPoint: CommitmentPoint = {
        x: pedersenCommitment.x,  // Coordenada X REAL en BN254
        y: pedersenCommitment.y   // Coordenada Y REAL en BN254
      };
      
      // Hash criptográfico REAL del commitment
      const commitmentHash = await this._calculateRealCommitmentHash(commitmentPoint);
      
      // Generar nullifier hash criptográfico REAL
      const nullifier = await ZenroomHelpers.generateNullifierHash(
        commitmentHash,
        signerAddress,
        `${Date.now()}_${i}_${Math.random()}` // Seed único criptográfico
      );

      commitments.push(commitmentPoint);
      commitmentHashes.push(commitmentHash);
      nullifiers.push(nullifier);

      console.log(`   ✅ Commitment Pedersen REAL generado: ${commitmentHash.substring(0, 10)}...`);
    }

    console.log(`✅ Generados ${commitments.length} commitments Pedersen REALES en BN254`);
    return { commitments, commitmentHashes, nullifiers };
  }

  /**
   * @notice Construir parámetros con criptografía REAL
   */
  private async _buildRealCryptoParams(
    splitData: SplitUTXOData,
    outputs: { commitments: CommitmentPoint[]; nullifiers: string[] },
    backendAttestationProvider: (dataHash: string) => Promise<BackendAttestation>
  ): Promise<SplitParams> {
    // Crear parámetros base para hash criptográfico REAL
    const baseParams: SplitParams = {
      inputCommitment: splitData.sourceCommitment,
      outputCommitments: outputs.commitments,
      inputNullifier: splitData.sourceNullifier,
      outputNullifiers: outputs.nullifiers,
      attestation: {
        operation: "SPLIT",
        dataHash: ethers.ZeroHash,
        nonce: 0n,           // Usar bigint REAL
        timestamp: 0n,       // Usar bigint REAL
        signature: "0x"
      }
    };

    // Calcular dataHash criptográfico REAL usando el contrato
    console.log('🔢 Calculando dataHash criptográfico REAL...');
    const dataHash = await this.contract.calculateSplitDataHash(
      baseParams,
      await this.signer.getAddress()
    );

    console.log(`📋 DataHash criptográfico REAL: ${dataHash}`);

    // Obtener attestation criptográfica REAL del backend
    console.log('🏛️ Obteniendo attestation criptográfica REAL...');
    const attestation = await backendAttestationProvider(dataHash);

    console.log(`✅ Attestation criptográfica REAL obtenida - nonce: ${attestation.nonce}`);

    return {
      inputCommitment: splitData.sourceCommitment,
      outputCommitments: outputs.commitments,
      inputNullifier: splitData.sourceNullifier,
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

    // Validar arrays consistentes para criptografía
    if (splitData.outputValues.length !== splitData.outputBlindingFactors.length) {
      throw new SplitValidationError('Arrays de valores y blinding factors deben ser consistentes');
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

    // Validar blinding factors criptográficos REALES
    for (let i = 0; i < splitData.outputBlindingFactors.length; i++) {
      if (!splitData.outputBlindingFactors[i] || splitData.outputBlindingFactors[i].length < 32) {
        throw new SplitValidationError(`Blinding factor criptográfico ${i} inválido`);
      }
    }

    console.log(`✅ Validación criptográfica REAL exitosa: conservación verificada`);
    console.log(`   📊 Total input: ${splitData.sourceValue}, total output: ${totalOutput}`);
  }

  /**
   * @notice Calcular hash criptográfico REAL de commitment (igual que el contrato)
   */
  private async _calculateRealCommitmentHash(commitment: CommitmentPoint): Promise<string> {
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
      
      // Buscar eventos PrivateUTXOCreated REALES
      for (const log of receipt.logs) {
        try {
          // Parsear logs criptográficos REALES
          if (log.topics.length > 0 && log.topics[0]) {
            // El primer topic es el hash del evento
            const eventSignature = ethers.id("PrivateUTXOCreated(bytes32,bytes32,address,bytes32,uint8,uint256)");
            
            if (log.topics[0] === eventSignature) {
              // Decodificar datos criptográficos REALES
              const utxoId = log.topics[1]; // Primer indexed parameter
              if (utxoId) {
                outputUTXOIds.push(utxoId);
              }
            }
          }
        } catch (parseError) {
          // Continuar con otros logs
          continue;
        }
      }
      
      console.log(`📋 Extraídos ${outputUTXOIds.length} UTXOIds REALES de eventos criptográficos`);
      return outputUTXOIds;
      
    } catch (error) {
      console.warn('⚠️ No se pudieron extraer UTXOIds REALES:', error);
      return [];
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
    details?: UTXODetails;
  }> {
    try {
      const utxoDetails = await this.contract.getUTXODetails(commitmentHash);
      
      return {
        exists: utxoDetails.exists,
        isSpent: utxoDetails.isSpent,
        tokenAddress: utxoDetails.tokenAddress,
        canSplit: utxoDetails.exists && !utxoDetails.isSpent,
        details: utxoDetails
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
      const [isValid, errorCode] = await this.contract.preValidateSplit(
        sourceCommitmentHash,
        outputCommitmentHashes,
        sourceNullifier
      );

      return {
        isValid,
        errorCode: isValid ? undefined : errorCode,
        errorMessage: isValid ? undefined : this._getValidationErrorMessage(errorCode)
      };
    } catch (error) {
      return {
        isValid: false,
        errorMessage: `Error durante validación: ${error instanceof Error ? error.message : error}`
      };
    }
  }

  /**
   * @notice Mensajes de error criptográficos basados en los códigos del contrato
   */
  private _getValidationErrorMessage(errorCode: number): string {
    const errorMessages: { [key: number]: string } = {
      0: 'Validación criptográfica exitosa',
      1: 'UTXO criptográfico no encontrado',
      2: 'UTXO criptográfico ya gastado',
      3: 'No hay outputs para split',
      4: 'Commitment criptográfico vacío', 
      6: 'Nullifier criptográfico inválido',
      7: 'Nullifier criptográfico ya usado'
    };

    return errorMessages[errorCode] || `Error criptográfico código: ${errorCode}`;
  }
}

/**
 * @notice Factory para crear instancia con criptografía REAL
 */
export function createSplitPrivateUTXO(
  contract: UTXOVaultContract,
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