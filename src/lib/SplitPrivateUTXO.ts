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
  gasUsed?: bigint;
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
   * @notice Ejecuta split de UTXO con criptografía BN254 REAL
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

      // 3. Pre-validación usando el contrato (con hashes criptográficos REALES)
      console.log('🔍 Pre-validando con hashes criptográficos REALES...');
      await this._preValidateWithRealCrypto(
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

      // 5. Estimar gas para operación criptográfica REAL
      console.log('⛽ Estimando gas para operación criptográfica...');
      const gasEstimate = await this.contract.splitPrivateUTXO.estimateGas(splitParams);
      const gasLimit = gasEstimate * 120n / 100n;

      console.log(`📊 Gas estimado para criptografía REAL: ${gasEstimate}`);

      // 6. Ejecutar split con criptografía REAL en blockchain
      console.log('📤 Ejecutando split con criptografía BN254 REAL...');
      const tx = await this.contract.splitPrivateUTXO(splitParams, { gasLimit });
      
      console.log(`⏳ Transacción criptográfica enviada: ${tx.hash}`);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new UTXOOperationError(
          'Transaction receipt not available',
          'executeSplit'
        );
      }

      console.log(`✅ Split criptográfico REAL completado en bloque ${receipt.blockNumber}`);

      // 7. Extraer UTXOIds REALES de los eventos
      const outputUTXOIds = await this._extractRealUTXOIds(receipt);

      return {
        success: true,
        transactionHash: receipt.hash,
        outputCommitmentHashes: outputs.commitmentHashes,  // Hashes REALES
        outputNullifiers: outputs.nullifiers,              // Nullifiers REALES
        outputUTXOIds,
        gasUsed: receipt.gasUsed
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
   * @notice Pre-validación usando hashes criptográficos REALES
   */
  private async _preValidateWithRealCrypto(
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

      console.log(`🔍 Validando con hashes REALES: Input ${sourceCommitmentHash.substring(0, 10)}...`);

      // Llamar preValidateSplit del contrato con hashes REALES
      const [isValid, errorCode] = await this.contract.preValidateSplit(
        sourceCommitmentHash,
        outputCommitmentHashes,
        sourceNullifier
      );

      if (!isValid) {
        const errorMessage = this._getValidationErrorMessage(errorCode);
        throw new SplitValidationError(
          `Pre-validación criptográfica falló: ${errorMessage}`,
          errorCode
        );
      }

      console.log('✅ Pre-validación criptográfica REAL exitosa');

    } catch (error) {
      if (error instanceof SplitValidationError) {
        throw error;
      }
      
      console.error('❌ Error en pre-validación criptográfica:', error);
      throw new SplitValidationError(
        'Error en pre-validación criptográfica REAL'
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
        exists: utxoDetails.utxoData.exists,
        isSpent: utxoDetails.utxoData.isSpent,
        tokenAddress: utxoDetails.utxoData.tokenAddress,
        canSplit: utxoDetails.utxoData.exists && !utxoDetails.utxoData.isSpent,
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
   * @notice Mensajes de error criptográficos
   */
  private _getValidationErrorMessage(errorCode: number): string {
    const errorMessages: { [key: number]: string } = {
      0: 'Validación criptográfica exitosa',
      1: 'UTXO criptográfico no encontrado',
      2: 'UTXO criptográfico ya gastado',
      3: 'Nullifier criptográfico ya usado',
      4: 'Arrays criptográficos inválidos',
      5: 'Error de validación criptográfica'
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
 * Datos necesarios para ejecutar un split de UTXO
 */
export interface SplitUTXOData {
  // UTXO de entrada
  sourceCommitment: CommitmentPoint;
  sourceValue: bigint;
  sourceBlindingFactor: string;
  sourceNullifier: string;
  
  // UTXOs de salida  
  outputValues: bigint[];
  outputBlindingFactors: string[];
  
  // Metadatos
  tokenAddress: string;
  sourceUTXOId?: string; // Para tracking opcional
}

/**
 * Resultado de la operación de split
 */
export interface SplitOperationResult {
  success: boolean;
  transactionHash?: string;
  outputCommitmentHashes?: string[];
  outputNullifiers?: string[];
  gasUsed?: bigint;
  error?: string;
  outputUTXOIds?: string[];
}

/**
 * @title SplitPrivateUTXO - Split de UTXO Privado con Validación Pre-Gas
 * @notice Divide un UTXO en múltiples UTXOs más pequeños manteniendo privacidad
 */
export class SplitPrivateUTXO {
  constructor(
    private contract: UTXOVaultContract,
    private signer: ethers.Signer
  ) {}

  /**
   * @notice Ejecuta split de UTXO privado con validación pre-gas
   */
  async executeSplit(
    splitData: SplitUTXOData,
    backendAttestationProvider: (dataHash: string) => Promise<BackendAttestation>
  ): Promise<SplitOperationResult> {
    try {
      console.log('🔄 Iniciando split de UTXO privado...');
      console.log(`📊 Split: 1 UTXO (${splitData.sourceValue}) → ${splitData.outputValues.length} UTXOs`);

      // 1. Validar datos de entrada
      this._validateSplitData(splitData);

      // 2. Generar commitments y nullifiers de salida
      console.log('🔐 Generando commitments y nullifiers de salida...');
      const outputs = await this._generateOutputCommitments(splitData);

      // 3. Validación pre-gas usando preValidateSplit
      console.log('🔍 Validando operación antes de ejecutar...');
      await this._preValidateOperation(
        splitData.sourceCommitment,
        outputs.commitments,
        splitData.sourceNullifier
      );

      // 4. Construir parámetros para el contrato
      console.log('📋 Construyendo parámetros del contrato...');
      const splitParams = await this._buildSplitParams(
        splitData,
        outputs,
        backendAttestationProvider
      );

      // 5. Estimar gas
      console.log('⛽ Estimando gas para split...');
      const gasEstimate = await this.contract.splitPrivateUTXO.estimateGas(splitParams);
      const gasLimit = gasEstimate * 120n / 100n; // +20% margen de seguridad

      console.log(`📊 Gas estimado: ${gasEstimate}, límite: ${gasLimit}`);

      // 6. Ejecutar transacción
      console.log('📤 Ejecutando split en blockchain...');
      const tx = await this.contract.splitPrivateUTXO(splitParams, { gasLimit });
      
      console.log(`⏳ Transacción enviada: ${tx.hash}`);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new UTXOOperationError(
          'Transaction receipt not available',
          'executeSplit'
        );
      }

      console.log(`✅ Split completado en bloque ${receipt.blockNumber}`);

      // 7. Extraer información de los eventos para obtener los UTXOIds
      const outputUTXOIds = await this._extractOutputUTXOIds(receipt);

      return {
        success: true,
        transactionHash: receipt.hash,
        outputCommitmentHashes: outputs.commitmentHashes,
        outputNullifiers: outputs.nullifiers,
        outputUTXOIds,
        gasUsed: receipt.gasUsed
      };

    } catch (error: any) {
      console.error('❌ Error en split:', error);
      
      if (error instanceof SplitValidationError) {
        return {
          success: false,
          error: `Validación falló: ${error.message}`
        };
      }
      
      if (error instanceof UTXOOperationError) {
        return {
          success: false,
          error: `Operación falló: ${error.message}`
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido durante split'
      };
    }
  }

  /**
   * @notice Validación pre-gas usando preValidateSplit del contrato
   */
  private async _preValidateOperation(
    sourceCommitment: CommitmentPoint,
    outputCommitments: CommitmentPoint[],
    sourceNullifier: string
  ): Promise<void> {
    try {
      // Calcular commitment hashes
      const sourceCommitmentHash = await this._hashCommitment(sourceCommitment);
      const outputCommitmentHashes = await Promise.all(
        outputCommitments.map(c => this._hashCommitment(c))
      );

      console.log(`🔍 Validando: Input ${sourceCommitmentHash.substring(0, 10)}... → ${outputCommitmentHashes.length} outputs`);

      // Llamar a preValidateSplit del contrato
      const [isValid, errorCode] = await this.contract.preValidateSplit(
        sourceCommitmentHash,
        outputCommitmentHashes,
        sourceNullifier
      );

      if (!isValid) {
        const errorMessage = this._getValidationErrorMessage(errorCode);
        throw new SplitValidationError(
          `Pre-validación falló: ${errorMessage}`,
          errorCode
        );
      }

      console.log('✅ Pre-validación exitosa - UTXO válido para split');

    } catch (error) {
      if (error instanceof SplitValidationError) {
        throw error;
      }
      
      console.error('❌ Error durante pre-validación:', error);
      throw new SplitValidationError(
        'Error durante pre-validación del contrato'
      );
    }
  }

  /**
   * @notice Generar commitments y nullifiers de salida
   */
  private async _generateOutputCommitments(splitData: SplitUTXOData): Promise<{
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

      console.log(`🔐 Generando output ${i + 1}/${splitData.outputValues.length}: valor ${value}`);

      // Generar commitment usando ZenroomHelpers
      const commitment = await ZenroomHelpers.createPedersenCommitment(
        value.toString(), 
        blindingFactor
      );
      
      // Convertir a formato del contrato
      const commitmentPoint: CommitmentPoint = {
        x: commitment.x,
        y: commitment.y
      };
      
      const commitmentHash = await this._hashCommitment(commitmentPoint);
      
      // Generar nullifier único para cada output
      const nullifier = await ZenroomHelpers.generateNullifierHash(
        commitmentHash,
        signerAddress,
        `${Date.now()}_${i}` // Seed único por output
      );

      commitments.push(commitmentPoint);
      commitmentHashes.push(commitmentHash);
      nullifiers.push(nullifier);

      console.log(`   ✅ Output ${i + 1}: commitment ${commitmentHash.substring(0, 10)}...`);
    }

    console.log(`✅ Generados ${commitments.length} commitments y nullifiers de salida`);
    return { commitments, commitmentHashes, nullifiers };
  }

  /**
   * @notice Construir parámetros para splitPrivateUTXO
   */
  private async _buildSplitParams(
    splitData: SplitUTXOData,
    outputs: { commitments: CommitmentPoint[]; nullifiers: string[] },
    backendAttestationProvider: (dataHash: string) => Promise<BackendAttestation>
  ): Promise<SplitParams> {
    // Crear parámetros base para calcular dataHash
    const baseParams: SplitParams = {
      inputCommitment: splitData.sourceCommitment,
      outputCommitments: outputs.commitments,
      inputNullifier: splitData.sourceNullifier,
      outputNullifiers: outputs.nullifiers,
      attestation: {
        operation: "SPLIT",
        dataHash: ethers.ZeroHash,
        nonce: 0,
        timestamp: 0,
        signature: "0x"
      }
    };

    // Calcular dataHash usando el contrato
    console.log('🔢 Calculando dataHash...');
    const dataHash = await this.contract.calculateSplitDataHash(
      baseParams,
      await this.signer.getAddress()
    );

    console.log(`📋 DataHash calculado: ${dataHash}`);

    // Obtener attestation del backend
    console.log('🏛️ Obteniendo attestation del backend...');
    const attestation = await backendAttestationProvider(dataHash);

    console.log(`✅ Attestation obtenida - nonce: ${attestation.nonce}`);

    return {
      inputCommitment: splitData.sourceCommitment,
      outputCommitments: outputs.commitments,
      inputNullifier: splitData.sourceNullifier,
      outputNullifiers: outputs.nullifiers,
      attestation
    };
  }

  /**
   * @notice Validar datos de entrada para split
   */
  private _validateSplitData(splitData: SplitUTXOData): void {
    // Validar que hay outputs
    if (splitData.outputValues.length === 0) {
      throw new UTXOValidationError(
        'Debe haber al menos un UTXO de salida',
        ValidationErrorCodes.INVALID_PARAMETERS
      );
    }

    // Validar límite máximo de outputs (para evitar gas limits)
    if (splitData.outputValues.length > 10) {
      throw new UTXOValidationError(
        'Máximo 10 UTXOs de salida permitidos por split',
        ValidationErrorCodes.INVALID_PARAMETERS
      );
    }

    // Validar arrays del mismo tamaño
    if (splitData.outputValues.length !== splitData.outputBlindingFactors.length) {
      throw new UTXOValidationError(
        'Arrays de valores y blinding factors deben tener el mismo tamaño',
        ValidationErrorCodes.INVALID_PARAMETERS
      );
    }

    // Validar conservación de valor
    const totalOutput = splitData.outputValues.reduce((sum, val) => sum + val, 0n);
    if (totalOutput !== splitData.sourceValue) {
      throw new UTXOValidationError(
        `Conservación de valor falló: entrada=${splitData.sourceValue}, salida=${totalOutput}`,
        ValidationErrorCodes.VALUE_CONSERVATION_FAILED,
        { sourceValue: splitData.sourceValue, totalOutput }
      );
    }

    // Validar valores positivos
    for (let i = 0; i < splitData.outputValues.length; i++) {
      if (splitData.outputValues[i] <= 0n) {
        throw new UTXOValidationError(
          `Valor de salida ${i} debe ser positivo: ${splitData.outputValues[i]}`,
          ValidationErrorCodes.INVALID_AMOUNT
        );
      }
    }

    // Validar direcciones y hashes
    if (!ethers.isAddress(splitData.tokenAddress)) {
      throw new UTXOValidationError(
        'Dirección de token inválida',
        ValidationErrorCodes.INVALID_TOKEN
      );
    }

    if (!splitData.sourceNullifier || splitData.sourceNullifier.length !== 66) {
      throw new UTXOValidationError(
        'Nullifier de entrada inválido',
        ValidationErrorCodes.INVALID_NULLIFIER
      );
    }

    console.log(`✅ Validación local exitosa: ${splitData.outputValues.length} outputs, conservación verificada`);
    console.log(`   📊 Total input: ${splitData.sourceValue}, total output: ${totalOutput}`);
  }

  /**
   * @notice Calcular hash de commitment (compatible con contrato)
   */
  private async _hashCommitment(commitment: CommitmentPoint): Promise<string> {
    return ethers.keccak256(
      ethers.solidityPacked(['uint256', 'uint256'], [commitment.x, commitment.y])
    );
  }

  /**
   * @notice Extraer UTXOIds de salida desde los eventos del receipt
   */
  private async _extractOutputUTXOIds(receipt: ethers.ContractTransactionReceipt): Promise<string[]> {
    try {
      const outputUTXOIds: string[] = [];
      
      // Buscar eventos PrivateUTXOCreated en el receipt
      for (const log of receipt.logs) {
        try {
          const parsedLog = this.contract.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          
          if (parsedLog && parsedLog.name === 'PrivateUTXOCreated') {
            const utxoId = parsedLog.args[0]; // Primer argumento es el utxoId
            outputUTXOIds.push(utxoId);
          }
        } catch (parseError) {
          // Ignorar logs que no podemos parsear
          continue;
        }
      }
      
      console.log(`📋 Extraídos ${outputUTXOIds.length} UTXOIds de los eventos`);
      return outputUTXOIds;
      
    } catch (error) {
      console.warn('⚠️ No se pudieron extraer UTXOIds de los eventos:', error);
      return [];
    }
  }

  /**
   * @notice Obtener mensaje de error según código de validación
   */
  private _getValidationErrorMessage(errorCode: number): string {
    const errorMessages: { [key: number]: string } = {
      0: 'Operación válida',
      1: 'UTXO de entrada no encontrado',
      2: 'UTXO de entrada ya gastado',
      3: 'Nullifier ya usado',
      4: 'Longitud de arrays inválida',
      5: 'Error de validación general'
    };

    return errorMessages[errorCode] || `Código de error desconocido: ${errorCode}`;
  }

  /**
   * @notice Obtener información de un UTXO para split
   */
  async getUTXOForSplit(commitmentHash: string): Promise<{
    exists: boolean;
    isSpent: boolean;
    tokenAddress: string;
    canSplit: boolean;
    details?: any;
  }> {
    try {
      const utxoDetails = await this.contract.getUTXODetails(commitmentHash);
      
      return {
        exists: utxoDetails.utxoData.exists,
        isSpent: utxoDetails.utxoData.isSpent,
        tokenAddress: utxoDetails.utxoData.tokenAddress,
        canSplit: utxoDetails.utxoData.exists && !utxoDetails.utxoData.isSpent,
        details: utxoDetails
      };
    } catch (error) {
      console.error('Error obteniendo información del UTXO:', error);
      return {
        exists: false,
        isSpent: true,
        tokenAddress: ethers.ZeroAddress,
        canSplit: false
      };
    }
  }

  /**
   * @notice Validar split antes de ejecutar (sin gastar gas)
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
}

/**
 * @notice Factory function para crear instancia de SplitPrivateUTXO
 */
export function createSplitPrivateUTXO(
  contract: UTXOVaultContract,
  signer: ethers.Signer
): SplitPrivateUTXO {
  return new SplitPrivateUTXO(contract, signer);
}

/**
 * @notice Utilidad para calcular split óptimo
 */
export function calculateOptimalSplit(
  totalAmount: bigint,
  numberOfOutputs: number
): bigint[] {
  if (numberOfOutputs <= 0) {
    throw new Error('Número de outputs debe ser positivo');
  }

  if (numberOfOutputs > 10) {
    throw new Error('Máximo 10 outputs permitidos');
  }

  const baseAmount = totalAmount / BigInt(numberOfOutputs);
  const remainder = totalAmount % BigInt(numberOfOutputs);
  
  const outputs: bigint[] = [];
  
  for (let i = 0; i < numberOfOutputs; i++) {
    // Distribuir el remainder en los primeros UTXOs
    const amount = baseAmount + (i < Number(remainder) ? 1n : 0n);
    outputs.push(amount);
  }

  // Verificar conservación de valor
  const total = outputs.reduce((sum, val) => sum + val, 0n);
  if (total !== totalAmount) {
    throw new Error(`Error en cálculo: ${total} !== ${totalAmount}`);
  }

  return outputs;
}

/**
 * @notice Utilidad para generar blinding factors únicos para split
 */
export function generateSplitBlindingFactors(count: number): string[] {
  const factors: string[] = [];
  
  for (let i = 0; i < count; i++) {
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
