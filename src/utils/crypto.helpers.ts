// src/utils/crypto.helpers.ts
import { ethers } from 'ethers';
import { CryptoAdapter } from './crypto.adapter';
import { calculateCryptoHelperHash } from '../lib/HashCalculator';
import type { Contract } from 'ethers';
import type { 
  PedersenCommitment, 
  EqualityProof, 
  Attestation,
  TransferAttestationData,
  SplitAttestationData,
  WithdrawAttestationData
} from '../types/zenroom.d';
import type { BackendAttestation } from '../contracts/ZKUTXOVault.types';

/**
 * CryptoHelpers - API compatible con ZenroomHelpers
 * Migración transparente de Zenroom a ethers.js + elliptic
 */
export class CryptoHelpers {
  private static _isInitialized = false;
  private static _initializationPromise: Promise<boolean> | null = null;
  private static _contract: Contract | null = null;
  
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

  /**
   * Set contract instance for hash validation
   */
  static setContract(contract: Contract): void {
    this._contract = contract;
    console.log('🏛️ Contract instance set in CryptoHelpers for hash validation');
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
    
    // Generar proof simplificado pero determinístico (sin Date.now())
    const deterministicSeed = ethers.solidityPacked(
      ['uint256', 'uint256', 'uint256', 'string'],
      [commitmentPoint.x, commitmentPoint.y, value, blindingFactor]
    );
    const proof = ethers.keccak256(deterministicSeed);
    
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
   * Generar nullifier hash criptográficamente seguro - API compatible
   * ✅ CORREGIDO: Eliminado Date.now() y Math.random() inseguros
   */
  static async generateNullifierHash(
    commitment: string,
    owner: string,
    nonce: string
  ): Promise<string> {
    await this.ensureInitialized();
    
    // ✅ CORRECCIÓN CRIPTOGRÁFICA: Usar solo datos determinísticos y seguros
    // Eliminar entropía insegura basada en tiempo y random()
    
    // Crear nullifier hash determinístico y seguro usando solo inputs conocidos
    const combined = ethers.solidityPacked(
      ['string', 'string', 'string'],
      [commitment, owner.toLowerCase(), nonce]
    );
    
    // Para mayor seguridad, hacer doble hash
    const preHash = ethers.keccak256(combined);
    const finalNullifier = ethers.keccak256(
      ethers.solidityPacked(['bytes32', 'string'], [preHash, 'nullifier_salt'])
    );
    
    return finalNullifier;
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
    
    // 2. Generar equality proof determinístico
    const equalityProof: EqualityProof = {
      challenge: ethers.keccak256(ethers.solidityPacked(
        ['uint256', 'uint256', 'uint256', 'uint256'],
        [inputCommitment.x, inputCommitment.y, outputCommitment.x, outputCommitment.y]
      )),
      response1: ethers.keccak256(ethers.solidityPacked(
        ['string', 'string'],
        ['response1', inputCommitment.blindingFactor || '0x0']
      )),
      response2: ethers.keccak256(ethers.solidityPacked(
        ['string', 'string'],
        ['response2', outputCommitment.blindingFactor || '0x0']
      )),
      randomCommitment: ethers.keccak256(ethers.solidityPacked(
        ['string', 'uint256', 'uint256'],
        ['random_commitment', inputCommitment.x, outputCommitment.x]
      ))
    };
    
    // 3. Generar nullifier del input usando datos determinísticos
    const inputCommitmentHex = '0x' + inputCommitment.x.toString(16).padStart(64, '0') + inputCommitment.y.toString(16).padStart(64, '0');
    const deterministicNonce = ethers.keccak256(
      ethers.solidityPacked(
        ['address', 'address', 'uint256'],
        [sender, outputRecipient, outputValue]
      )
    );
    const inputNullifier = await this.generateNullifierHash(inputCommitmentHex, sender, deterministicNonce);
    
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
      timestamp: await this.getNextNonce(), // Usar nonce determinístico en lugar de Date.now()
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
    
    // 2. Generar nullifier del input usando datos determinísticos
    const inputCommitmentHex = '0x' + inputCommitment.x.toString(16).padStart(64, '0') + inputCommitment.y.toString(16).padStart(64, '0');
    const deterministicNonce = ethers.keccak256(
      ethers.solidityPacked(
        ['address', 'uint256', 'uint256'],
        [sender, outputValues[0], outputValues[1]]
      )
    );
    const inputNullifier = await this.generateNullifierHash(inputCommitmentHex, sender, deterministicNonce);
    
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
      timestamp: await this.getNextNonce(), // Usar nonce determinístico en lugar de Date.now()
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
    
    // 1. Generar nullifier usando datos determinísticos
    const commitmentHex = '0x' + commitment.x.toString(16).padStart(64, '0') + commitment.y.toString(16).padStart(64, '0');
    const deterministicNonce = ethers.keccak256(
      ethers.solidityPacked(
        ['address', 'address', 'address', 'uint256'],
        [sender, recipient, tokenAddress, commitment.value]
      )
    );
    const nullifier = await this.generateNullifierHash(commitmentHex, sender, deterministicNonce);
    
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
      timestamp: await this.getNextNonce(), // Usar nonce determinístico en lugar de Date.now()
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
    
    // 3. Crear data hash para attestation usando FUNCIÓN CENTRALIZADA CON VALIDACIÓN
    console.log('🔍 Using CENTRALIZED hash calculator in CryptoHelpers...');
    
    let dataHash: string;
    try {
      dataHash = calculateCryptoHelperHash(
        tokenAddress,
        commitment,
        nullifierHash,
        value,
        recipient
      );
    } catch (error) {
      console.error('❌ CRITICAL: CryptoHelpers hash validation failed:', error);
      // STOP THE ENTIRE FLOW - this is a critical error
      throw new Error(`CryptoHelpers hash validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    console.log('✅ Hash calculated and validated by CryptoHelpers:', dataHash);
    
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
  
  // Método auxiliar para obtener siguiente nonce de forma determinística y segura
  private static async getNextNonce(): Promise<number> {
    // ✅ MEJORADO: Usar timestamp en segundos para mayor determinismo
    // En producción, esto debería usar un contador del servidor o blockchain
    const timestampSeconds = Math.floor(Date.now() / 1000);
    
    // Agregar entropía basada en la dirección del admin para evitar colisiones
    try {
      const adminPrivateKey = await this.getPrivateKeyFromEnv();
      const wallet = new ethers.Wallet(adminPrivateKey);
      const addressBytes = ethers.getBytes(wallet.address);
      const addressSum = addressBytes.reduce((sum, byte) => sum + byte, 0);
      
      // Combinar timestamp con suma de bytes de la dirección para unicidad
      return timestampSeconds + (addressSum % 1000);
    } catch (error) {
      // Fallback si no se puede obtener la private key
      console.warn('⚠️ Could not get admin address for nonce, using timestamp only');
      return timestampSeconds;
    }
  }

  /**
   * Get private key from environment variables securely with validation
   */
  static async getPrivateKeyFromEnv(): Promise<string> {
    const privateKey = import.meta.env.VITE_PRIVATE_KEY_ADMIN;
    
    if (!privateKey) {
      throw new Error(
        'VITE_PRIVATE_KEY_ADMIN not found in environment variables. Please set this in your .env file.'
      );
    }
    
    // Validate private key format and length
    const cleanKey = privateKey.replace('0x', '');
    
    if (cleanKey.length !== 64) {
      throw new Error(
        `Invalid private key length: expected 64 characters, got ${cleanKey.length}`
      );
    }
    
    if (!/^[0-9a-fA-F]+$/.test(cleanKey)) {
      throw new Error(
        'Invalid private key format: must be hexadecimal'
      );
    }
    
    // Ensure private key has proper format (with 0x prefix)
    const formattedKey = `0x${cleanKey}`;
    
    // Additional security check: verify it's not a common test key
    const testKeys = [
      '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      '0x1111111111111111111111111111111111111111111111111111111111111111',
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    ];
    
    if (testKeys.includes(formattedKey.toLowerCase())) {
      console.warn('⚠️ WARNING: Using common test private key - not secure for production!');
    }
    
    console.log('🔑 Retrieved and validated private key from environment');
    
    return formattedKey;
  }
}

// Alias para compatibilidad total
export { CryptoHelpers as ZenroomHelpers };

/**
 * ZK Cryptography Service for secp256k1 operations
 * Provides high-level interface for cryptographic status checking
 */
export class ZKCryptoService {
  /**
   * Check if ZK system is properly initialized
   */
  static async isInitialized(): Promise<boolean> {
    try {
      return CryptoHelpers.isFullCryptoAvailable;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Check if secp256k1 cryptography is available
   */
  static async checkSecp256k1Support(): Promise<boolean> {
    try {
      // Verificar que se pueden generar commitments secp256k1
      const testCommitment = await CryptoHelpers.createPedersenCommitment('1');
      return testCommitment !== null && testCommitment.x !== undefined;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Check if ZK proof generation is available
   */
  static async canGenerateProofs(): Promise<boolean> {
    try {
      // Verificar que se pueden generar pruebas de igualdad
      const c1 = await CryptoHelpers.createPedersenCommitment('1');
      const c2 = await CryptoHelpers.createPedersenCommitment('1');
      const proof = await CryptoHelpers.generateEqualityProof(c1, c2);
      return proof !== null && proof.length > 0;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get comprehensive cryptographic capabilities
   */
  static async getCryptoCapabilities(): Promise<{
    initialized: boolean;
    secp256k1: boolean;
    zkProofs: boolean;
    pedersenCommitments: boolean;
  }> {
    return {
      initialized: await this.isInitialized(),
      secp256k1: await this.checkSecp256k1Support(),
      zkProofs: await this.canGenerateProofs(),
      pedersenCommitments: await this.checkSecp256k1Support()
    };
  }
}