/**
 * @fileoverview AttestationService - Manejo de attestations firmadas para UTXOVault
 * @description Backend autorizado que firma attestations que Solidity confía
 */

import { ethers } from 'ethers';
import { calculateAndValidateDepositHash, logAttestationData } from './HashCalculator';
import type { Contract } from 'ethers';
import { EthereumHelpers } from '../utils/ethereum.helpers';
import type { 
  ZKDepositParams, 
  ZKSplitParams, 
  ZKTransferParams, 
  ZKWithdrawParams,
  BackendAttestation,
  ZKAttestationService,
  ZKDepositData,
  ZKSplitData,
  ZKTransferData,
  ZKWithdrawData
} from '../contracts/ZKUTXOVault.types';

export type OperationType = 'DEPOSIT' | 'SPLIT' | 'TRANSFER' | 'WITHDRAW';

export interface AttestationData {
  operation: OperationType;
  dataHash: string;
  nonce: bigint;
  timestamp: bigint;
}

export interface SignedAttestation extends AttestationData {
  signature: string;
  signer: string;
}

export interface DepositData {
  tokenAddress: string;
  commitmentX: bigint;
  commitmentY: bigint;
  nullifier: string;
  amount: bigint;
  userAddress: string;
}

export interface TransferData {
  inputNullifier: string;
  outputCommitmentX: bigint;
  outputCommitmentY: bigint;
  amount: bigint;
  fromAddress: string;
  toAddress: string;
}

export interface SplitData {
  inputNullifier: string;
  outputCommitment1X: bigint;
  outputCommitment1Y: bigint;
  outputCommitment2X: bigint;
  outputCommitment2Y: bigint;
  amount1: bigint;
  amount2: bigint;
  userAddress: string;
}

export interface WithdrawData {
  nullifier: string;
  amount: bigint;
  tokenAddress: string;
  recipientAddress: string;
}

/**
 * Servicio de attestations firmadas para operaciones UTXO
 * ADVERTENCIA: Esta implementación expone claves privadas en el cliente
 * En producción, debe implementarse como servicio backend seguro
 */
export class AttestationService {
  private authorizedSigner: ethers.Wallet | null = null;
  private nonces: Map<string, bigint> = new Map();
  private contract: Contract | null = null;

  constructor(contract?: Contract) {
    console.log('🔐 Initializing AttestationService...');
    
    // Store contract reference for hash validation
    this.contract = contract || null;
    
    // Only initialize in browser context
    if (typeof window !== 'undefined') {
      this.initializeSigner();
    } else {
      console.log('📱 Skipping signer initialization in SSR context');
    }
  }

  /**
   * Inicializar el signer autorizado desde variables de entorno
   * NOTA: En producción, las attestations deberían firmarse en el servidor, no en el cliente
   */
  private initializeSigner(): void {
    try {
      // Verificar que estamos en contexto del navegador
      if (typeof window === 'undefined' || typeof import.meta === 'undefined') {
        console.warn('⚠️ Not in browser context - skipping signer initialization');
        return;
      }

      // Solo usar import.meta.env en el contexto del navegador
      // ADVERTENCIA: Las variables VITE_ son públicas y visibles en el cliente
      let privateKey = import.meta.env.VITE_PRIVATE_KEY_ADMIN;
      
      // Fallback: try accessing via global if import.meta.env is not available
      if (!privateKey && typeof window !== 'undefined' && (window as any).__VITE_ENV__) {
        privateKey = (window as any).__VITE_ENV__.VITE_PRIVATE_KEY_ADMIN;
      }
      
      if (!privateKey) {
        console.warn('⚠️ No admin private key found - attestations will not be available');
        console.warn('💡 For production: Move attestation signing to a secure server');
        return;
      }

      console.warn('🔐 SECURITY WARNING: Private key is exposed in client bundle!');
      console.warn('🏭 For production: Implement server-side attestation signing');

      // Ensure private key is a string and has proper format
      const privateKeyStr = String(privateKey).trim();
      
      // Always add 0x prefix if not present (expected format from .env)
      const formattedPrivateKey = privateKeyStr.startsWith('0x') ? 
        privateKeyStr : '0x' + privateKeyStr;

      // Validate hex format (64 chars + 0x prefix = 66 total)
      if (formattedPrivateKey.length !== 66) {
        throw new Error(`Private key must be 64 hex characters (32 bytes). Got length: ${formattedPrivateKey.length - 2}, raw length: ${privateKeyStr.length}`);
      }

      // Validate hex characters
      const hexPattern = /^0x[0-9a-fA-F]{64}$/;
      if (!hexPattern.test(formattedPrivateKey)) {
        throw new Error(`Private key must contain only valid hex characters. Pattern test failed for: ${formattedPrivateKey.substring(0, 10)}...`);
      }

      // Crear wallet desde la clave privada
      this.authorizedSigner = new ethers.Wallet(formattedPrivateKey);
      
      console.log('✅ Attestation signer initialized');
      console.log('📮 Signer address:', this.authorizedSigner.address);
      console.log('🔑 Expected address: 0x86DF4B738D592c31F4A9A657D6c8d6D05DC1D462');
      
      // Verificar que la dirección coincide con la esperada
      const expectedAddress = '0x86DF4B738D592c31F4A9A657D6c8d6D05DC1D462';
      if (this.authorizedSigner.address.toLowerCase() !== expectedAddress.toLowerCase()) {
        console.error('❌ Signer address mismatch!');
        console.error('Expected:', expectedAddress);
        console.error('Actual:', this.authorizedSigner.address);
        throw new Error('Signer address does not match expected admin address');
      }
      
      console.log('✅ Signer address verified successfully');
      
    } catch (error: any) {
      console.error('❌ Failed to initialize attestation signer:', error);
      this.authorizedSigner = null;
      throw error;
    }
  }

  /**
   * Set contract instance for hash validation
   */
  public setContract(contract: Contract): void {
    this.contract = contract;
    console.log('🏛️ Contract instance set for hash validation');
  }

  /**
   * Get next nonce from contract - ensures sequential nonce
   */
  private async getNextNonce(userAddress: string): Promise<bigint> {
    if (!this.contract) {
      throw new Error('Contract not set - cannot get current nonce');
    }

    try {
      // Get contract stats to obtain the current nonce
      const nonce = await this.contract.lastNonce();
      const currentNonce = BigInt(nonce);
      const nextNonce = currentNonce + BigInt(1);
      
      console.log(`📊 Contract nonce sync: current=${nonce}, next=${nextNonce}`);
      
      return nextNonce;
    } catch (error) {
      console.error('❌ Failed to get nonce from contract:', error);
      throw new Error(`Failed to get sequential nonce: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create hash for deposit data using CENTRALIZED function with validation
   */
  private async createDepositDataHash(data: DepositData): Promise<string> {
    console.log('🔐 AttestationService calculating deposit hash...');
    
    try {
      // Use the centralized hash calculator with contract validation
      const hash = calculateAndValidateDepositHash(
        data.tokenAddress,
        data.commitmentX,
        data.commitmentY,
        data.nullifier,
        data.amount,
        data.userAddress
      );
      
      console.log('✅ Hash calculated and validated by AttestationService:', hash);
      return hash;
    } catch (error) {
      console.error('❌ CRITICAL: AttestationService hash calculation failed:', error);
      // STOP THE ENTIRE FLOW - this is a critical error
      throw new Error(`AttestationService hash validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create hash for transfer data
   */
  private createTransferDataHash(data: TransferData): string {
    return ethers.keccak256(
      ethers.solidityPacked(
        ['bytes32', 'uint256', 'uint256', 'uint256', 'address', 'address'],
        [data.inputNullifier, data.outputCommitmentX, data.outputCommitmentY, data.amount, data.fromAddress, data.toAddress]
      )
    );
  }

  /**
   * Create hash for split data
   */
  private createSplitDataHash(data: SplitData): string {
    return ethers.keccak256(
      ethers.solidityPacked(
        ['bytes32', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'address'],
        [data.inputNullifier, data.outputCommitment1X, data.outputCommitment1Y, data.outputCommitment2X, data.outputCommitment2Y, data.amount1, data.amount2, data.userAddress]
      )
    );
  }

  /**
   * Create hash for withdraw data
   */
  private createWithdrawDataHash(data: WithdrawData): string {
    return ethers.keccak256(
      ethers.solidityPacked(
        ['bytes32', 'uint256', 'address', 'address'],
        [data.nullifier, data.amount, data.tokenAddress, data.recipientAddress]
      )
    );
  }

  // ========================
  // ZK HASH METHODS - Simplified for new architecture
  // ========================

  /**
   * Create hash for ZK deposit data (simplificado)
   */
  private createZKDepositDataHash(data: ZKDepositData): string {
    return ethers.keccak256(
      ethers.solidityPacked(
        ['address', 'uint256', 'uint256', 'uint256', 'bytes32'],
        [data.tokenAddress, data.amount, data.commitment.x, data.commitment.y, data.nullifierHash]
      )
    );
  }

  /**
   * Create hash for ZK split data (sin amounts - privacidad total)
   */
  private createZKSplitDataHash(data: ZKSplitData): string {
    // Solo sourceUTXOId y nullifiers - SIN amounts
    return ethers.keccak256(
      ethers.solidityPacked(
        ['bytes32', 'bytes32[]'],
        [data.sourceUTXOId, data.outputNullifiers]
      )
    );
  }

  /**
   * Create hash for ZK transfer data (sin amounts - privacidad total)
   */
  private createZKTransferDataHash(data: ZKTransferData): string {
    // Solo IDs y nullifier - SIN amounts
    return ethers.keccak256(
      ethers.solidityPacked(
        ['bytes32', 'address', 'bytes32'],
        [data.sourceUTXOId, data.recipientAddress, data.outputNullifier]
      )
    );
  }

  /**
   * Create hash for ZK withdraw data (amount visible en withdraw)
   */
  private createZKWithdrawDataHash(data: ZKWithdrawData): string {
    return ethers.keccak256(
      ethers.solidityPacked(
        ['bytes32', 'uint256', 'address', 'bytes32'],
        [data.sourceUTXOId, data.amount, data.recipient, data.nullifier]
      )
    );
  }

  /**
   * Create and sign deposit attestation (LEGACY)
   */
  async createLegacyDepositAttestation(data: DepositData): Promise<SignedAttestation> {
    if (!this.authorizedSigner) {
      throw new Error('Attestation service not properly initialized');
    }

    const userAddress = data.userAddress;
    const nonce = await this.getNextNonce(userAddress);
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const dataHash = await this.createDepositDataHash(data);

    const attestationData: AttestationData = {
      operation: 'DEPOSIT',
      dataHash,
      nonce,
      timestamp
    };

    // Create EIP-712 structured data
    const domain = {
      name: 'UTXOVault',
      version: '1',
      chainId: (await this.authorizedSigner.provider?.getNetwork())?.chainId || 1,
      verifyingContract: '0x0000000000000000000000000000000000000000' // Will be set by contract
    };

    const types = {
      Attestation: [
        { name: 'operation', type: 'string' },
        { name: 'dataHash', type: 'bytes32' },
        { name: 'nonce', type: 'uint256' },
        { name: 'timestamp', type: 'uint256' }
      ]
    };

    const value = {
      operation: attestationData.operation,
      dataHash: attestationData.dataHash,
      nonce: attestationData.nonce.toString(),
      timestamp: attestationData.timestamp.toString()
    };

    const signature = await this.authorizedSigner.signTypedData(domain, types, value);

    const signedAttestation = {
      ...attestationData,
      signature,
      signer: this.authorizedSigner.address
    };

    // 🚨 LOGGING CRÍTICO PARA DEBUGGING
    console.log('🚨 === CREATING DEPOSIT ATTESTATION ===');
    logAttestationData({
      operation: signedAttestation.operation,
      dataHash: signedAttestation.dataHash,
      nonce: signedAttestation.nonce.toString(),
      timestamp: signedAttestation.timestamp.toString(),
      signature: signedAttestation.signature
    }, 'DEPOSIT');

    return signedAttestation;
  }

  /**
   * Create and sign transfer attestation (LEGACY)
   */
  async createLegacyTransferAttestation(data: TransferData): Promise<SignedAttestation> {
    if (!this.authorizedSigner) {
      throw new Error('Attestation service not properly initialized');
    }

    const userAddress = data.fromAddress;
    const nonce = await this.getNextNonce(userAddress);
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const dataHash = this.createTransferDataHash(data);

    const attestationData: AttestationData = {
      operation: 'TRANSFER',
      dataHash,
      nonce,
      timestamp
    };

    // Create EIP-712 structured data (similar to deposit)
    const domain = {
      name: 'UTXOVault',
      version: '1',
      chainId: (await this.authorizedSigner.provider?.getNetwork())?.chainId || 1,
      verifyingContract: '0x0000000000000000000000000000000000000000'
    };

    const types = {
      Attestation: [
        { name: 'operation', type: 'string' },
        { name: 'dataHash', type: 'bytes32' },
        { name: 'nonce', type: 'uint256' },
        { name: 'timestamp', type: 'uint256' }
      ]
    };

    const value = {
      operation: attestationData.operation,
      dataHash: attestationData.dataHash,
      nonce: attestationData.nonce.toString(),
      timestamp: attestationData.timestamp.toString()
    };

    const signature = await this.authorizedSigner.signTypedData(domain, types, value);

    return {
      ...attestationData,
      signature,
      signer: this.authorizedSigner.address
    };
  }

  /**
   * Create and sign split attestation (LEGACY)
   */
  async createLegacySplitAttestation(data: SplitData): Promise<SignedAttestation> {
    if (!this.authorizedSigner) {
      throw new Error('Attestation service not properly initialized');
    }

    const userAddress = data.userAddress;
    const nonce = await this.getNextNonce(userAddress);
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const dataHash = this.createSplitDataHash(data);

    const attestationData: AttestationData = {
      operation: 'SPLIT',
      dataHash,
      nonce,
      timestamp
    };

    // Create EIP-712 structured data
    const domain = {
      name: 'UTXOVault',
      version: '1',
      chainId: (await this.authorizedSigner.provider?.getNetwork())?.chainId || 1,
      verifyingContract: '0x0000000000000000000000000000000000000000'
    };

    const types = {
      Attestation: [
        { name: 'operation', type: 'string' },
        { name: 'dataHash', type: 'bytes32' },
        { name: 'nonce', type: 'uint256' },
        { name: 'timestamp', type: 'uint256' }
      ]
    };

    const value = {
      operation: attestationData.operation,
      dataHash: attestationData.dataHash,
      nonce: attestationData.nonce.toString(),
      timestamp: attestationData.timestamp.toString()
    };

    const signature = await this.authorizedSigner.signTypedData(domain, types, value);

    return {
      ...attestationData,
      signature,
      signer: this.authorizedSigner.address
    };
  }

  /**
   * Create and sign withdraw attestation (LEGACY)
   */
  async createLegacyWithdrawAttestation(data: WithdrawData): Promise<SignedAttestation> {
    if (!this.authorizedSigner) {
      throw new Error('Attestation service not properly initialized');
    }

    const userAddress = data.recipientAddress;
    const nonce = await this.getNextNonce(userAddress);
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const dataHash = this.createWithdrawDataHash(data);

    const attestationData: AttestationData = {
      operation: 'WITHDRAW',
      dataHash,
      nonce,
      timestamp
    };

    // Create EIP-712 structured data
    const domain = {
      name: 'UTXOVault',
      version: '1',
      chainId: (await this.authorizedSigner.provider?.getNetwork())?.chainId || 1,
      verifyingContract: '0x0000000000000000000000000000000000000000'
    };

    const types = {
      Attestation: [
        { name: 'operation', type: 'string' },
        { name: 'dataHash', type: 'bytes32' },
        { name: 'nonce', type: 'uint256' },
        { name: 'timestamp', type: 'uint256' }
      ]
    };

    const value = {
      operation: attestationData.operation,
      dataHash: attestationData.dataHash,
      nonce: attestationData.nonce.toString(),
      timestamp: attestationData.timestamp.toString()
    };

    const signature = await this.authorizedSigner.signTypedData(domain, types, value);

    return {
      ...attestationData,
      signature,
      signer: this.authorizedSigner.address
    };
  }

  /**
   * Get signer address
   */
  getSignerAddress(): string | null {
    return this.authorizedSigner?.address || null;
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.authorizedSigner !== null;
  }

  /**
   * Simple provider function for creating attestations with just operation and dataHash
   * Compatible with existing service interfaces
   */
  async createSimpleAttestation(
    operation: OperationType,
    dataHash: string,
    customNonce?: bigint
  ): Promise<{
    operation: string;
    dataHash: string;
    nonce: bigint;
    timestamp: bigint;
    signature: string;
  }> {
    if (!this.authorizedSigner) {
      throw new Error('❌ Attestation service not initialized');
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const nonce = customNonce || await this.getNextNonce('0x0000000000000000000000000000000000000000'); // Use dummy address for contract nonce
    
    // Create attestation data structure
    const attestationData = {
      operation,
      dataHash,
      nonce,
      timestamp: BigInt(currentTime)
    };
    
    // Create message hash exactly as the contract expects
    const messageHash = ethers.keccak256(ethers.solidityPacked(
      ['string', 'bytes32', 'uint256', 'uint256'],
      [
        attestationData.operation,
        attestationData.dataHash,
        attestationData.nonce,
        attestationData.timestamp
      ]
    ));
    
    // Sign the message hash using Ethereum's standard format
    const signature = await this.authorizedSigner.signMessage(ethers.getBytes(messageHash));
    
    console.log(`✅ Simple attestation created for ${operation}:`, {
      messageHash: messageHash.substring(0, 20) + '...',
      signerAddress: this.authorizedSigner.address,
      signature: signature.substring(0, 20) + '...',
      nonce: nonce.toString(),
      timestamp: attestationData.timestamp.toString()
    });
    
    return {
      ...attestationData,
      signature
    };
  }

  /**
   * Provider function for SPLIT operations - compatible with SplitPrivateUTXO
   */
  getSplitAttestationProvider() {
    return async (dataHash: string) => {
      return this.createSimpleAttestation('SPLIT', dataHash);
    };
  }

  /**
   * Provider function for TRANSFER operations
   */
  getTransferAttestationProvider() {
    return async (dataHash: string) => {
      return this.createSimpleAttestation('TRANSFER', dataHash);
    };
  }

  /**
   * Provider function for WITHDRAW operations
   */
  getWithdrawAttestationProvider() {
    return async (dataHash: string) => {
      return this.createSimpleAttestation('WITHDRAW', dataHash);
    };
  }

  /**
   * Generic provider function for any operation
   */
  getGenericAttestationProvider(operation: OperationType) {
    return async (dataHash: string) => {
      return this.createSimpleAttestation(operation, dataHash);
    };
  }

  // ========================
  // ZK ATTESTATION METHODS - New architecture
  // ========================

  /**
   * Create ZK deposit attestation (compatible con ZKDepositParams)
   */
  async createZKDepositAttestation(data: ZKDepositData): Promise<BackendAttestation> {
    if (!this.authorizedSigner) {
      throw new Error('Attestation service not properly initialized');
    }

    const nonce = await this.getNextNonce('0x0000000000000000000000000000000000000000'); // Use contract nonce
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const dataHash = this.createZKDepositDataHash(data);

    const messageHash = ethers.keccak256(ethers.solidityPacked(
      ['string', 'bytes32', 'uint256', 'uint256'],
      ['DEPOSIT', dataHash, nonce, timestamp]
    ));

    const signature = await this.authorizedSigner.signMessage(ethers.getBytes(messageHash));

    console.log('✅ ZK Deposit attestation created:', {
      token: data.tokenAddress,
      amount: data.amount.toString(),
      nullifier: data.nullifierHash.substring(0, 10) + '...'
    });

    return {
      operation: 'DEPOSIT',
      dataHash,
      nonce,
      timestamp,
      signature
    };
  }

  /**
   * Create ZK split attestation (SIN amounts - privacidad total)
   */
  async createZKSplitAttestation(data: ZKSplitData): Promise<BackendAttestation> {
    if (!this.authorizedSigner) {
      throw new Error('Attestation service not properly initialized');
    }

    const nonce = await this.getNextNonce('0x0000000000000000000000000000000000000000'); // Use contract nonce
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const dataHash = this.createZKSplitDataHash(data);

    const messageHash = ethers.keccak256(ethers.solidityPacked(
      ['string', 'bytes32', 'uint256', 'uint256'],
      ['SPLIT', dataHash, nonce, timestamp]
    ));

    const signature = await this.authorizedSigner.signMessage(ethers.getBytes(messageHash));

    console.log('🔐 ZK Split attestation created (amounts hidden):', {
      sourceUTXO: data.sourceUTXOId.substring(0, 10) + '...',
      outputCount: data.outputNullifiers.length,
      // NO amounts logged - privacidad ZK
    });

    return {
      operation: 'SPLIT',
      dataHash,
      nonce,
      timestamp,
      signature
    };
  }

  /**
   * Create ZK transfer attestation (SIN amounts - privacidad total)
   */
  async createZKTransferAttestation(data: ZKTransferData): Promise<BackendAttestation> {
    if (!this.authorizedSigner) {
      throw new Error('Attestation service not properly initialized');
    }

    const nonce = await this.getNextNonce('0x0000000000000000000000000000000000000000'); // Use contract nonce
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const dataHash = this.createZKTransferDataHash(data);

    const messageHash = ethers.keccak256(ethers.solidityPacked(
      ['string', 'bytes32', 'uint256', 'uint256'],
      ['TRANSFER', dataHash, nonce, timestamp]
    ));

    const signature = await this.authorizedSigner.signMessage(ethers.getBytes(messageHash));

    console.log('🔐 ZK Transfer attestation created (amount hidden):', {
      sourceUTXO: data.sourceUTXOId.substring(0, 10) + '...',
      recipient: data.recipientAddress,
      // NO amount logged - privacidad ZK
    });

    return {
      operation: 'TRANSFER',
      dataHash,
      nonce,
      timestamp,
      signature
    };
  }

  /**
   * Create ZK withdraw attestation (amount visible en withdraw)
   */
  async createZKWithdrawAttestation(data: ZKWithdrawData): Promise<BackendAttestation> {
    if (!this.authorizedSigner) {
      throw new Error('Attestation service not properly initialized');
    }

    const nonce = await this.getNextNonce('0x0000000000000000000000000000000000000000'); // Use contract nonce
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const dataHash = this.createZKWithdrawDataHash(data);

    const messageHash = ethers.keccak256(ethers.solidityPacked(
      ['string', 'bytes32', 'uint256', 'uint256'],
      ['WITHDRAW', dataHash, nonce, timestamp]
    ));

    const signature = await this.authorizedSigner.signMessage(ethers.getBytes(messageHash));

    console.log('✅ ZK Withdraw attestation created (amount revealed):', {
      sourceUTXO: data.sourceUTXOId.substring(0, 10) + '...',
      amount: data.amount.toString(),
      recipient: data.recipient,
      nullifier: data.nullifier.substring(0, 10) + '...'
    });

    return {
      operation: 'WITHDRAW',
      dataHash,
      nonce,
      timestamp,
      signature
    };
  }

  // ========================
  // ZK COMPATIBILITY METHODS
  // ========================

  /**
   * Métodos de conveniencia para mantener compatibilidad con interfaz ZKAttestationService
   */
  async createDepositAttestation(data: ZKDepositData): Promise<BackendAttestation> {
    return this.createZKDepositAttestation(data);
  }

  async createSplitAttestation(data: ZKSplitData): Promise<BackendAttestation> {
    return this.createZKSplitAttestation(data);
  }

  async createTransferAttestation(data: ZKTransferData): Promise<BackendAttestation> {
    return this.createZKTransferAttestation(data);
  }

  async createWithdrawAttestation(data: ZKWithdrawData): Promise<BackendAttestation> {
    return this.createZKWithdrawAttestation(data);
  }

  /**
   * Factory method para crear instancia compatible con ZKAttestationService
   */
  static createZKCompatible(contract?: Contract): ZKAttestationService {
    const service = new AttestationService(contract);
    
    // Implementar interfaz ZKAttestationService
    return {
      createDepositAttestation: (data) => service.createZKDepositAttestation(data),
      createSplitAttestation: (data) => service.createZKSplitAttestation(data),
      createTransferAttestation: (data) => service.createZKTransferAttestation(data),
      createWithdrawAttestation: (data) => service.createZKWithdrawAttestation(data),
    } as ZKAttestationService;
  }
}
