/**
 * @fileoverview AttestationService - Manejo de attestations firmadas para UTXOVault
 * @description Backend autorizado que firma attestations que Solidity confía
 */

import { ethers } from 'ethers';
import { EthereumHelpers } from '../utils/ethereum.helpers';

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
  inputCommitmentX: bigint;
  inputCommitmentY: bigint;
  outputCommitmentX: bigint;
  outputCommitmentY: bigint;
  nullifier: string;
  newOwner: string;
  userAddress: string;
}

export interface SplitData {
  inputCommitmentX: bigint;
  inputCommitmentY: bigint;
  outputCommitmentsX: bigint[];
  outputCommitmentsY: bigint[];
  outputValues: bigint[];
  outputOwners: string[];
  nullifier: string;
  userAddress: string;
}

export interface WithdrawData {
  commitmentX: bigint;
  commitmentY: bigint;
  amount: bigint;
  nullifier: string;
  recipient: string;
  userAddress: string;
}

/**
 * Servicio para crear y firmar attestations autorizadas
 */
export class AttestationService {
  private signer: ethers.Wallet | null = null;
  private nonceCounter: Map<string, bigint> = new Map();

  constructor() {
    this.initializeSigner();
  }

  /**
   * Inicializar el signer autorizado desde variables de entorno
   */
  private initializeSigner(): void {
    try {
      const privateKey = import.meta.env.VITE_PRIVATE_KEY_ADMIN || process.env.PRIVATE_KEY_ADMIN;
      
      if (!privateKey) {
        console.warn('⚠️ No admin private key found - attestations will not be available');
        return;
      }

      // Validar formato de clave privada
      if (!privateKey.match(/^[0-9a-fA-F]{64}$/)) {
        throw new Error('Invalid private key format - must be 64 hex characters');
      }

      const provider = EthereumHelpers.getProvider();
      this.signer = new ethers.Wallet('0x' + privateKey, provider);
      
      console.log('✅ Attestation service initialized with authorized signer:', this.signer.address);
      
    } catch (error) {
      console.error('❌ Failed to initialize attestation signer:', error);
      this.signer = null;
    }
  }

  /**
   * Obtener el siguiente nonce para un usuario
   */
  private getNextNonce(userAddress: string): bigint {
    const current = this.nonceCounter.get(userAddress.toLowerCase()) || 0n;
    const next = current + 1n;
    this.nonceCounter.set(userAddress.toLowerCase(), next);
    return next;
  }

  /**
   * Crear hash de datos para DEPOSIT
   */
  private createDepositDataHash(data: DepositData): string {
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256', 'uint256', 'bytes32', 'uint256', 'address'],
      [data.tokenAddress, data.commitmentX, data.commitmentY, data.nullifier, data.amount, data.userAddress]
    );
    return ethers.keccak256(encoded);
  }

  /**
   * Crear hash de datos para TRANSFER
   */
  private createTransferDataHash(data: TransferData): string {
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'uint256', 'uint256', 'uint256', 'bytes32', 'address', 'address'],
      [data.inputCommitmentX, data.inputCommitmentY, data.outputCommitmentX, data.outputCommitmentY, 
       data.nullifier, data.newOwner, data.userAddress]
    );
    return ethers.keccak256(encoded);
  }

  /**
   * Crear hash de datos para SPLIT
   */
  private createSplitDataHash(data: SplitData): string {
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'uint256', 'uint256[]', 'uint256[]', 'uint256[]', 'address[]', 'bytes32', 'address'],
      [data.inputCommitmentX, data.inputCommitmentY, data.outputCommitmentsX, data.outputCommitmentsY,
       data.outputValues, data.outputOwners, data.nullifier, data.userAddress]
    );
    return ethers.keccak256(encoded);
  }

  /**
   * Crear hash de datos para WITHDRAW
   */
  private createWithdrawDataHash(data: WithdrawData): string {
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'uint256', 'uint256', 'bytes32', 'address', 'address'],
      [data.commitmentX, data.commitmentY, data.amount, data.nullifier, data.recipient, data.userAddress]
    );
    return ethers.keccak256(encoded);
  }

  /**
   * Crear y firmar attestation genérica
   */
  private async createAttestation(
    operation: OperationType,
    dataHash: string,
    userAddress: string
  ): Promise<SignedAttestation> {
    if (!this.signer) {
      throw new Error('Attestation signer not initialized');
    }

    const nonce = this.getNextNonce(userAddress);
    const timestamp = BigInt(Math.floor(Date.now() / 1000)); // Unix timestamp

    const attestationData: AttestationData = {
      operation,
      dataHash,
      nonce,
      timestamp
    };

    // Crear mensaje para firmar
    const messageHash = ethers.solidityPackedKeccak256(
      ['string', 'bytes32', 'uint256', 'uint256'],
      [operation, dataHash, nonce, timestamp]
    );

    // Firmar con ECDSA
    const signature = await this.signer.signMessage(ethers.getBytes(messageHash));

    console.log(`✅ Created ${operation} attestation:`, {
      operation,
      dataHash: dataHash.slice(0, 10) + '...',
      nonce: nonce.toString(),
      timestamp: timestamp.toString(),
      signature: signature.slice(0, 10) + '...',
      signer: this.signer.address
    });

    return {
      ...attestationData,
      signature,
      signer: this.signer.address
    };
  }

  /**
   * Crear attestation para DEPOSIT
   */
  async createDepositAttestation(data: DepositData): Promise<SignedAttestation> {
    console.log('🔏 Creating DEPOSIT attestation...');
    const dataHash = this.createDepositDataHash(data);
    return this.createAttestation('DEPOSIT', dataHash, data.userAddress);
  }

  /**
   * Crear attestation para TRANSFER
   */
  async createTransferAttestation(data: TransferData): Promise<SignedAttestation> {
    console.log('🔏 Creating TRANSFER attestation...');
    const dataHash = this.createTransferDataHash(data);
    return this.createAttestation('TRANSFER', dataHash, data.userAddress);
  }

  /**
   * Crear attestation para SPLIT
   */
  async createSplitAttestation(data: SplitData): Promise<SignedAttestation> {
    console.log('🔏 Creating SPLIT attestation...');
    const dataHash = this.createSplitDataHash(data);
    return this.createAttestation('SPLIT', dataHash, data.userAddress);
  }

  /**
   * Crear attestation para WITHDRAW
   */
  async createWithdrawAttestation(data: WithdrawData): Promise<SignedAttestation> {
    console.log('🔏 Creating WITHDRAW attestation...');
    const dataHash = this.createWithdrawDataHash(data);
    return this.createAttestation('WITHDRAW', dataHash, data.userAddress);
  }

  /**
   * Verificar una attestation firmada (para testing)
   */
  async verifyAttestation(attestation: SignedAttestation): Promise<boolean> {
    try {
      const messageHash = ethers.solidityPackedKeccak256(
        ['string', 'bytes32', 'uint256', 'uint256'],
        [attestation.operation, attestation.dataHash, attestation.nonce, attestation.timestamp]
      );

      const recoveredAddress = ethers.verifyMessage(ethers.getBytes(messageHash), attestation.signature);
      const isValid = recoveredAddress.toLowerCase() === attestation.signer.toLowerCase();

      console.log('🔍 Attestation verification:', {
        operation: attestation.operation,
        expectedSigner: attestation.signer,
        recoveredSigner: recoveredAddress,
        isValid
      });

      return isValid;
    } catch (error) {
      console.error('❌ Attestation verification failed:', error);
      return false;
    }
  }

  /**
   * Obtener dirección del signer autorizado
   */
  getAuthorizedSigner(): string | null {
    return this.signer?.address || null;
  }

  /**
   * Verificar si el servicio está disponible
   */
  isAvailable(): boolean {
    return this.signer !== null;
  }
}

// Singleton instance
export const attestationService = new AttestationService();
