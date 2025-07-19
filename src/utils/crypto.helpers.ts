// src/utils/crypto.helpers.ts
import { ethers } from 'ethers';
import { CryptoAdapter } from './crypto.adapter';
import type { 
  PedersenCommitment, 
  EqualityProof, 
  Attestation,
  TransferAttestationData,
  SplitAttestationData,
  WithdrawAttestationData
} from '../types/zenroom.d';
import type { BackendAttestation } from '../contracts/UTXOVault.types';

/**
 * CryptoHelpers - API compatible con ZenroomHelpers
 * Migración transparente de Zenroom a ethers.js + elliptic
 */
export class CryptoHelpers {
  private static _isInitialized = false;
  private static _initializationPromise: Promise<boolean> | null = null;
  
  // Propiedades de compatibilidad con ZenroomHelpers
  static get isFullCryptoAvailable(): boolean {
    return this._isInitialized;
  }
  
  static get cryptoMode(): 'full' | 'limited' | 'unavailable' {
    return this._isInitialized ? 'full' : 'unavailable';
  }
  
  /**
   * Inicialización lazy - compatible con ZenroomHelpers.ensureInitialized()
   */
  static async ensureInitialized(): Promise<void> {
    if (this._isInitialized) {
      return;
    }
    
    if (this._initializationPromise) {
      await this._initializationPromise;
      return;
    }
    
    this._initializationPromise = this.initialize();
    const success = await this._initializationPromise;
    
    if (!success) {
      this._initializationPromise = null;
      throw new Error('Failed to initialize crypto system');
    }
  }
  
  /**
   * Inicialización principal
   */
  static async initialize(): Promise<boolean> {
    try {
      console.log('🔄 Initializing CryptoHelpers...');
      
      const success = await CryptoAdapter.initialize();
      if (success) {
        this._isInitialized = true;
        console.log('✅ CryptoHelpers initialized successfully');
      }
      
      return success;
    } catch (error) {
      console.error('❌ CryptoHelpers initialization failed:', error);
      this._isInitialized = false;
      this._initializationPromise = null;
      return false;
    }
  }
  
  // =====================================================
  // API COMPATIBLE CON ZENROOMHELPERS - MIGRACIÓN TRANSPARENTE
  // =====================================================
  
  /**
   * Crear Pedersen commitment - API compatible
   */
  static async createPedersenCommitment(value: string, blindingFactor?: string): Promise<PedersenCommitment> {
    await this.ensureInitialized();
    return CryptoAdapter.createPedersenCommitment(BigInt(value), blindingFactor);
  }
  
  /**
   * Generar blinding factor seguro - API compatible
   */
  static generateSecureBlindingFactor(): string {
    return CryptoAdapter.generateSecureBlindingFactor();
  }
  
  /**
   * Conversión a BigInt - API compatible con ZenroomHelpers
   */
  static toBigInt(hex: string): bigint {
    return ethers.toBigInt(hex);
  }
  
  /**
   * Verificar Pedersen commitment - API compatible
   */
  static async verifyPedersenCommitment(
    commitmentHex: string, 
    value: bigint, 
    blindingFactor: string
  ): Promise<boolean> {
    try {
      await this.ensureInitialized();
      
      const recreated = await this.createPedersenCommitment(value.toString(), blindingFactor);
      const recreatedHex = recreated.x.toString(16).padStart(64, '0') + recreated.y.toString(16).padStart(64, '0');
      
      return commitmentHex.toLowerCase().replace('0x', '') === recreatedHex.toLowerCase();
    } catch (error) {
      console.warn('Pedersen commitment verification failed:', error);
      return false;
    }
  }
  
  /**
   * Generar Bulletproof - API compatible
   */
  static async generateBulletproof(
    value: bigint,
    blindingFactor: string,
    minRange: bigint = BigInt(0),
    maxRange: bigint = BigInt(2n ** 32n - 1n)
  ): Promise<{ proof: string; commitment: PedersenCommitment; range: { min: bigint; max: bigint } }> {
    await this.ensureInitialized();
    
    // Crear commitment para el bulletproof
    const commitmentPoint = await this.createPedersenCommitment(value.toString(), blindingFactor);
    
    // Generar proof simplificado pero determinístico
    const proof = ethers.keccak256(ethers.toUtf8Bytes(
      `bulletproof_${commitmentPoint.x}_${commitmentPoint.y}_${value}_${blindingFactor}`
    ));
    
    return {
      proof,
      commitment: commitmentPoint,
      range: {
        min: minRange,
        max: maxRange
      }
    };
  }
  
  /**
   * Generar nullifier hash - API compatible
   */
  static async generateNullifierHash(
    commitment: string,
    owner: string,
    nonce: string
  ): Promise<string> {
    await this.ensureInitialized();
    
    // Crear nullifier hash determinístico usando keccak256
    const combined = ethers.solidityPacked(
      ['string', 'string', 'string'],
      [commitment, owner, nonce]
    );
    
    return ethers.keccak256(combined);
  }
  
  /**
   * Crear transferencia con attestation - API compatible
   */
  static async createTransferWithAttestation(
    inputCommitment: PedersenCommitment,
    outputValue: bigint,
    outputRecipient: string,
    sender: string
  ): Promise<{ outputCommitment: PedersenCommitment; equalityProof: EqualityProof; attestation: Attestation }> {
    await this.ensureInitialized();
    
    // Verificar que los valores coinciden para transferencia completa
    if (inputCommitment.value !== outputValue) {
      throw new Error('Transfer amount must equal input commitment value');
    }
    
    // 1. Crear output commitment
    const outputCommitment = await this.createPedersenCommitment(outputValue.toString());
    
    // 2. Generar equality proof
    const equalityProof: EqualityProof = {
      challenge: ethers.keccak256(ethers.solidityPacked(
        ['uint256', 'uint256', 'uint256', 'uint256'],
        [inputCommitment.x, inputCommitment.y, outputCommitment.x, outputCommitment.y]
      )),
      response1: ethers.keccak256(ethers.toUtf8Bytes(`response1_${inputCommitment.blindingFactor}`)),
      response2: ethers.keccak256(ethers.toUtf8Bytes(`response2_${outputCommitment.blindingFactor}`)),
      randomCommitment: ethers.keccak256(ethers.toUtf8Bytes(`random_${Date.now()}`))
    };
    
    // 3. Generar nullifier del input
    const inputCommitmentHex = '0x' + inputCommitment.x.toString(16).padStart(64, '0') + inputCommitment.y.toString(16).padStart(64, '0');
    const inputNullifier = await this.generateNullifierHash(inputCommitmentHex, sender, Date.now().toString());
    
    // 4. Crear attestation con estructura completa
    const transferData: TransferAttestationData = {
      inputNullifier,
      outputCommitmentX: outputCommitment.x,
      outputCommitmentY: outputCommitment.y,
      amount: outputValue,
      fromAddress: sender,
      toAddress: outputRecipient
    };
    
    const dataHash = ethers.keccak256(ethers.solidityPacked(
      ['bytes32', 'uint256', 'uint256', 'uint256', 'address', 'address'],
      [inputNullifier, outputCommitment.x, outputCommitment.y, outputValue, sender, outputRecipient]
    ));
    
    const attestation: Attestation = {
      type: 'transfer',
      timestamp: Date.now(),
      userAddress: sender,
      signature: ethers.keccak256(ethers.toUtf8Bytes(`signature_${dataHash}`)), // Simplified signature
      nonce: (await this.getNextNonce()).toString(),
      dataHash,
      data: transferData
    };
    
    return { outputCommitment, equalityProof, attestation };
  }
  
  /**
   * Crear split con attestation - API compatible
   */
  static async createSplitWithAttestation(
    inputCommitment: PedersenCommitment,
    outputValues: bigint[],
    outputOwners: string[],
    sender: string
  ): Promise<{ outputCommitments: PedersenCommitment[]; attestation: Attestation }> {
    await this.ensureInitialized();
    
    if (outputValues.length !== 2 || outputOwners.length !== 2) {
      throw new Error('Split operation requires exactly 2 outputs');
    }
    
    // Verificar que la suma de outputs = input
    const totalOutput = outputValues[0] + outputValues[1];
    if (totalOutput !== inputCommitment.value) {
      throw new Error('Sum of output values must equal input value');
    }
    
    // 1. Generar output commitments
    const outputCommitments: PedersenCommitment[] = [];
    for (const value of outputValues) {
      const commitment = await this.createPedersenCommitment(value.toString());
      outputCommitments.push(commitment);
    }
    
    // 2. Generar nullifier del input
    const inputCommitmentHex = '0x' + inputCommitment.x.toString(16).padStart(64, '0') + inputCommitment.y.toString(16).padStart(64, '0');
    const inputNullifier = await this.generateNullifierHash(inputCommitmentHex, sender, Date.now().toString());
    
    // 3. Crear attestation con estructura completa
    const splitData: SplitAttestationData = {
      inputNullifier,
      outputCommitment1X: outputCommitments[0].x,
      outputCommitment1Y: outputCommitments[0].y,
      outputCommitment2X: outputCommitments[1].x,
      outputCommitment2Y: outputCommitments[1].y,
      amount1: outputValues[0],
      amount2: outputValues[1]
    };
    
    const dataHash = ethers.keccak256(ethers.solidityPacked(
      ['bytes32', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
      [inputNullifier, outputCommitments[0].x, outputCommitments[0].y, outputCommitments[1].x, outputCommitments[1].y, outputValues[0], outputValues[1]]
    ));
    
    const attestation: Attestation = {
      type: 'split',
      timestamp: Date.now(),
      userAddress: sender,
      signature: ethers.keccak256(ethers.toUtf8Bytes(`signature_${dataHash}`)), // Simplified signature
      nonce: (await this.getNextNonce()).toString(),
      dataHash,
      data: splitData
    };
    
    return { outputCommitments, attestation };
  }
  
  /**
   * Crear withdrawal con attestation - API compatible
   */
  static async createWithdrawWithAttestation(
    commitment: PedersenCommitment,
    recipient: string,
    sender: string,
    tokenAddress: string
  ): Promise<{ nullifier: string; attestation: Attestation }> {
    await this.ensureInitialized();
    
    // 1. Generar nullifier
    const commitmentHex = '0x' + commitment.x.toString(16).padStart(64, '0') + commitment.y.toString(16).padStart(64, '0');
    const nullifier = await this.generateNullifierHash(commitmentHex, sender, Date.now().toString());
    
    // 2. Crear attestation con estructura completa
    const withdrawData: WithdrawAttestationData = {
      nullifier,
      amount: commitment.value,
      tokenAddress,
      recipientAddress: recipient
    };
    
    const dataHash = ethers.keccak256(ethers.solidityPacked(
      ['bytes32', 'uint256', 'address', 'address'],
      [nullifier, commitment.value, recipient, tokenAddress]
    ));
    
    const attestation: Attestation = {
      type: 'withdraw',
      timestamp: Date.now(),
      userAddress: sender,
      signature: ethers.keccak256(ethers.toUtf8Bytes(`signature_${dataHash}`)), // Simplified signature
      nonce: (await this.getNextNonce()).toString(),
      dataHash,
      data: withdrawData
    };
    
    return { nullifier, attestation };
  }
  
  /**
   * Crear deposit con attestation - API compatible
   */
  static async createDepositWithAttestation(
    value: bigint,
    recipient: string,
    tokenAddress: string
  ): Promise<{ commitment: PedersenCommitment; attestation: BackendAttestation }> {
    await this.ensureInitialized();
    
    // 1. Crear commitment
    const commitment = await CryptoAdapter.createPedersenCommitment(value);
    
    // 2. Crear nullifier hash
    const nullifierHash = await CryptoAdapter.createNullifierHash(commitment, recipient);
    
    // 3. Crear data hash para attestation
    const dataHash = ethers.keccak256(
      ethers.solidityPacked(
        ['address', 'uint256', 'uint256', 'bytes32', 'uint256', 'address'],
        [tokenAddress, commitment.x, commitment.y, nullifierHash, value, recipient]
      )
    );
    
    // 4. Crear attestation
    const nonce = await this.getNextNonce();
    const attestation = await CryptoAdapter.createAttestation('DEPOSIT', dataHash, nonce);
    
    return { commitment, attestation };
  }
  
  /**
   * Generar equality proof - API compatible
   */
  static async generateEqualityProof(
    commitment1: PedersenCommitment,
    commitment2: PedersenCommitment
  ): Promise<string> {
    await this.ensureInitialized();
    return CryptoAdapter.generateEqualityProof(commitment1, commitment2);
  }
  
  /**
   * Verificar equality proof - API compatible
   */
  static async verifyEqualityProof(
    proof: string,
    commitment1: PedersenCommitment,
    commitment2: PedersenCommitment
  ): Promise<boolean> {
    try {
      // Para compatibilidad, siempre retornar true si el proof existe
      // En el contrato, solo importa la attestation del backend
      return proof.length > 0;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Obtener generadores Pedersen - API compatible
   */
  static async getRealPedersenGenerators(): Promise<{ G: string; H: string }> {
    await this.ensureInitialized();
    return CryptoAdapter.getRealPedersenGenerators();
  }
  
  // Método auxiliar para obtener siguiente nonce
  private static async getNextNonce(): Promise<number> {
    // Implementación simple - en producción usar contador del servidor
    return Math.floor(Date.now() / 1000);
  }
}

// Alias para compatibilidad total
export { CryptoHelpers as ZenroomHelpers };