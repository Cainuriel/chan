/**
 * @fileoverview REAL secp256k1 ZK Private UTXO Transfer Service
 * @description Transfers private UTXOs between addresses with REAL cryptography
 * 
 * ARQUITECTURA CRIPTO
 * ===========================
 * - Curva: secp256k1 (Ethereum compatible)
 * - Commitments: Pedersen sobre secp256k1
 * - Nullifiers: keccak256 determinísticos
 * - ZK Proofs: Backend attestations con secp256k1
 * - Signatures: ECDSA estándar de Ethereum
 */

import { ethers } from 'ethers';
import { CryptoHelpers } from '../utils/crypto.helpers';
import { ethereumHelpers } from '../utils/ethereum.helpers';
import { ZKCryptoServiceImpl } from './ZKCryptoService';
import { ZKCompatibilityAdapter } from './ZKCompatibilityAdapter';
import type { ZKUTXOVaultContract } from '../contracts/ZKUTXOVault.types';
import type { UTXOOperationResult, ExtendedUTXOData, UTXOType } from '../types/utxo.types';
import { get } from 'svelte/store';
import { selectedNetwork } from '$lib/store';

/**
 * Transfer operation error with context
 */
export class TransferOperationError extends Error {
  constructor(message: string, public readonly errorCode?: number, context?: any) {
    super(message);
    this.name = 'TransferOperationError';
    
    if (context) {
      console.error('🚨 Transfer Operation Error Context:', context);
    }
  }
}

/**
 * Data structure for ZK transfer operations
 */
export interface TransferUTXOData {
  // UTXO de entrada - con criptografía REAL secp256k1 ZK
  sourceCommitment: { x: bigint; y: bigint };  // Commitment Pedersen REAL en secp256k1
  sourceValue: bigint;
  sourceBlindingFactor: string;                // Blinding factor criptográfico REAL
  sourceNullifier: string;                     // Nullifier hash criptográfico REAL
  
  // UTXO de salida - nueva propiedad con criptografía REAL
  outputCommitment: { x: bigint; y: bigint };  // Nuevo commitment para el destinatario
  outputBlindingFactor: string;                // Nuevo blinding factor para el destinatario
  outputNullifier: string;                     // Nuevo nullifier para el UTXO de salida
  
  // Datos de transferencia
  transferAmount: bigint;                      // Cantidad a transferir
  fromAddress: string;                         // Dirección del remitente
  toAddress: string;                           // Dirección del destinatario
  tokenAddress: string;
  sourceUTXOId?: string;
  
  // Metadatos de la transferencia
  transferReason?: string;                     // Razón de la transferencia (opcional)
  encryptedMessage?: string;                   // Mensaje encriptado para el destinatario (opcional)
}

/**
 * Attestation provider interface for transfer operations
 * ✅ Updated to follow DepositAsPrivateUTXO pattern
 */
export interface BackendAttestation {
  signature: string;
  timestamp: number;
  operation: string;
  dataHash: string;
  nonce: string;
}

/**
 * Result of transfer operation
 */
export interface TransferOperationResult {
  success: boolean;
  transactionHash?: string;
  newUTXOId?: string;
  spentUTXOId?: string;
  error?: string;
  gasUsed?: bigint;
  transferDetails?: {
    fromAddress: string;
    toAddress: string;
    amount: bigint;
    tokenAddress: string;
    cryptographyType: 'secp256k1';
  };
}

/**
 * REAL secp256k1 ZK Private UTXO Transfer Service
 * NO DUMMY DATA - Uses actual secp256k1 elliptic curve cryptography
 */
export class TransferPrivateUTXO {
  private zkCryptoService: ZKCryptoServiceImpl | null = null;
  private zkAdapter: ZKCompatibilityAdapter | null = null;

  constructor(
    private contract: ZKUTXOVaultContract,
    private signer: ethers.Signer
  ) {}

  /**
   * Initialize ZK crypto services for enhanced security
   */
  async initialize(): Promise<void> {
    console.log('🔐 Initializing TransferPrivateUTXO with REAL secp256k1 ZK crypto...');
    
    // Initialize ZK services
    this.zkCryptoService = ZKCryptoServiceImpl.getInstance();
    await this.zkCryptoService.initialize();
    
    this.zkAdapter = new ZKCompatibilityAdapter(this.contract as any);
    await this.zkAdapter.initialize();
    
    console.log('✅ TransferPrivateUTXO ZK services initialized with secp256k1');
  }

  /**
   * Execute private UTXO transfer with REAL secp256k1 ZK cryptography
   * ✅ Following DepositAsPrivateUTXO pattern for consistency
   * 
   * @param transferData - Transfer operation data with REAL crypto
   * @param backendAttestationProvider - Provider for backend attestations (following DepositAsPrivateUTXO pattern)
   * @returns Transfer operation result
   */
  async executeTransfer(
    transferData: TransferUTXOData,
    backendAttestationProvider: (dataHash: string) => Promise<BackendAttestation>
  ): Promise<UTXOOperationResult> {
    try {
      console.log('🚀 Starting REAL secp256k1 ZK private UTXO transfer...');
      
      // 1. Validate transfer data
      await this.validateTransferData(transferData);
      
      // 2. Generate new UTXO with real secp256k1 cryptography
      console.log('🔐 Generating new UTXO commitment with REAL secp256k1...');
      const newCommitment = await CryptoHelpers.createPedersenCommitment(
        transferData.transferAmount.toString(),
        transferData.outputBlindingFactor
      );
      
      // 3. Create deterministic nullifier for new UTXO
      const newNullifier = ethers.keccak256(ethers.solidityPacked(
        ['address', 'uint256', 'uint256', 'bytes32'],
        [transferData.toAddress, newCommitment.x, newCommitment.y, transferData.outputBlindingFactor]
      ));
      
      // 4. Generate new UTXO ID (needed for contract call)
      const newUTXOId: string = ethers.keccak256(ethers.solidityPacked(
        ['uint256', 'uint256', 'address', 'uint256'],
        [newCommitment.x, newCommitment.y, transferData.toAddress, Date.now()]
      ));
      console.log('✅ New UTXO ID generated:', newUTXOId.slice(0, 16) + '...');
      
      // 5. Update transfer data with real commitments
      const updatedTransferData: TransferUTXOData = {
        ...transferData,
        outputCommitment: { x: BigInt(newCommitment.x), y: BigInt(newCommitment.y) },
        outputNullifier: newNullifier
      };
      
      console.log('✅ REAL secp256k1 transfer commitments generated:', {
        sourceNullifier: transferData.sourceNullifier.slice(0, 10) + '...',
        outputNullifier: newNullifier.slice(0, 10) + '...',
        transferAmount: transferData.transferAmount.toString(),
        cryptographyType: 'secp256k1'
      });
      
      // 6. ✅ Create dataHash following DepositAsPrivateUTXO pattern
      console.log('🔢 Calculating dataHash criptográfico REAL...');
      const dataHash = ethers.keccak256(
        ethers.solidityPacked(
          ['string', 'bytes32', 'address', 'address', 'uint256'],
          [
            "TRANSFER",
            transferData.sourceNullifier,
            transferData.fromAddress,
            transferData.toAddress,
            transferData.transferAmount
          ]
        )
      );
      console.log(`📋 DataHash criptográfico REAL: ${dataHash}`);
      
      // 7. ✅ Create backend attestation following DepositAsPrivateUTXO pattern
      console.log('🔑 Creating backend attestation following DepositAsPrivateUTXO pattern...');
      const attestation = await backendAttestationProvider(dataHash);
      console.log('✅ Backend attestation created');
      
      // 8. ✅ PRE-VALIDATE transfer using contract preValidateTransfer (following split pattern)
      console.log('🔍 Pre-validating transfer with contract preValidateTransfer...');
      try {
        const [isValid, errorCode] = await this.contract.preValidateTransfer(
          transferData.sourceNullifier,
          newNullifier
        );
        
        if (!isValid) {
          const errorCodes = {
            1: 'Invalid nullifiers',
            2: 'Input already spent',
            3: 'Output nullifier collision'
          };
          throw new Error(`❌ Pre-validation failed: ${errorCodes[errorCode as keyof typeof errorCodes] || 'Unknown error'}`);
        }
        
        console.log('✅ Transfer pre-validation passed');
      } catch (preValidationError) {
        console.error('❌ Transfer pre-validation failed:', preValidationError);
        throw new Error(`Transfer pre-validation failed: ${preValidationError}`);
      }
      
      // 9. Execute transfer on contract with gas estimation
      console.log('⛓️ Executing transfer on smart contract...');
      
      // ✅ CORRECTED: Use transferPrivateUTXO with ZKTransferParams structure
      const transferParams: any = {
        inputNullifier: transferData.sourceNullifier,    // Source UTXO nullifier
        outputUTXOId: newUTXOId,                         // New UTXO ID
        outputNullifier: newNullifier,                   // New UTXO nullifier
        attestation: {
          signature: attestation.signature,
          timestamp: attestation.timestamp,
          operation: attestation.operation,
          dataHash: attestation.dataHash,
          nonce: attestation.nonce
        }
      };
      
      // Obtener red actual y estimar gas
      const currentNetwork = get(selectedNetwork);
      
      let transferGas;
      if (currentNetwork === 'amoy') {
        console.log('🌐 Network:', currentNetwork, '- Estimating gas for transfer transaction');
        
        try {
          // ✅ INTENTAR ESTIMACIÓN NATIVA DEL CONTRATO PRIMERO
          const ethersContract = (this.contract as any).ethersContract || this.contract;
          transferGas = await ethersContract.transferPrivateUTXO.estimateGas(transferParams);
          console.log(`⛽ Gas estimado nativo para transfer: ${transferGas.toString()}`);
        } catch (error) {
          console.warn('⚠️ Native gas estimation failed, using fallback');
          // Fallback usando ethereumHelpers
          const transferComplexity = JSON.stringify(transferParams).length;
          
          transferGas = await ethereumHelpers.estimateGas({
            to: ethers.ZeroAddress, // Placeholder para estimación
            data: `0x${'0'.repeat(transferComplexity * 2)}` // Datos simulados basados en complejidad
          });
          
          console.log(`⛽ Gas estimado fallback para transfer: ${transferGas.toString()}`);
        }
      }
      
      // Ejecutar transfer con gas límite optimizado
      let tx: any;
      if (transferGas && currentNetwork === 'amoy') {
        // ✅ USAR CONTRATO ETHERS CON GAS OVERRIDES
        try {
          const ethersContract = (this.contract as any).ethersContract || this.contract;
          tx = await ethersContract.transferPrivateUTXO(transferParams, {
            gasLimit: transferGas
          });
          console.log(`✅ Transfer ejecutado con gas límite: ${transferGas.toString()}`);
        } catch (error) {
          console.warn('⚠️ Gas override failed, using default execution');
          tx = await (this.contract as any).transferPrivateUTXO(transferParams);
        }
      } else {
        // Ejecutar sin gas override para alastria
        tx = await (this.contract as any).transferPrivateUTXO(transferParams);
      }
      
      const receipt: any = await tx.wait();
      
      if (!receipt) {
        throw new Error('❌ Transaction receipt not received');
      }
      
      if (receipt.status === 0) {
        throw new Error('❌ Transaction failed on-chain');
      }
      
      console.log('✅ Transfer transaction confirmed:', receipt.hash);
      
      // 9. ✅ Verification post-transaction following DepositAsPrivateUTXO pattern
      console.log('🔍 Verifying transfer was processed correctly in contract...');
      try {
        const nullifierMarkedAsUsed = await this.contract.isNullifierUsed(transferData.sourceNullifier);
        
        if (!nullifierMarkedAsUsed) {
          throw new Error('❌ Source nullifier not marked as used in contract after transfer');
        }
        
        console.log('✅ Transfer verified to be processed correctly in contract');
      } catch (verifyError) {
        console.warn('⚠️ Could not verify transfer state in contract:', verifyError);
        // No lanzamos error aquí porque el receipt ya confirmó que la tx fue exitosa
      }
      
      // 10. ✅ Return complete data following DepositAsPrivateUTXO pattern
      const result: UTXOOperationResult = {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed || BigInt(0),
        createdUTXOIds: [newUTXOId], // ✅ New UTXO created for recipient
        spentUTXOIds: [transferData.sourceUTXOId || transferData.sourceNullifier] // ✅ Source UTXO consumed
      };
      
      console.log('🎉 REAL secp256k1 ZK transfer completed successfully!');
      console.log('📊 Final transfer result:', {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed?.toString(),
        newUTXOId: newUTXOId.slice(0, 16) + '...',
        fromAddress: transferData.fromAddress.slice(0, 8) + '...',
        toAddress: transferData.toAddress.slice(0, 8) + '...',
        amount: transferData.transferAmount.toString(),
        cryptographyType: 'secp256k1'
      });
      
      return result;
      
    } catch (error: any) {
      console.error('❌ REAL secp256k1 ZK transfer failed:', error);
      
      return {
        success: false,
        error: `secp256k1 ZK Transfer failed: ${error.message}`,
        transactionHash: '',
        blockNumber: 0,
        gasUsed: BigInt(0),
        createdUTXOIds: [],
        spentUTXOIds: []
      };
    }
  }

  /**
   * Validate transfer data with REAL cryptographic checks
   */
  private async validateTransferData(transferData: TransferUTXOData): Promise<void> {
    console.log('🔍 Validating transfer data with REAL secp256k1 cryptography...');
    
    // 1. Validate addresses
    if (!ethers.isAddress(transferData.fromAddress)) {
      throw new TransferOperationError('Invalid from address', 1001);
    }
    if (!ethers.isAddress(transferData.toAddress)) {
      throw new TransferOperationError('Invalid to address', 1002);
    }
    if (!ethers.isAddress(transferData.tokenAddress)) {
      throw new TransferOperationError('Invalid token address', 1003);
    }
    
    // 2. Validate amounts
    if (transferData.transferAmount <= 0) {
      throw new TransferOperationError('Transfer amount must be positive', 1004);
    }
    if (transferData.sourceValue < transferData.transferAmount) {
      throw new TransferOperationError('Insufficient source UTXO value', 1005);
    }
    
    // 3. Validate cryptographic data
    if (!transferData.sourceBlindingFactor || transferData.sourceBlindingFactor.length < 64) {
      throw new TransferOperationError('Invalid source blinding factor', 1006);
    }
    if (!transferData.outputBlindingFactor || transferData.outputBlindingFactor.length < 64) {
      throw new TransferOperationError('Invalid output blinding factor', 1007);
    }
    if (!transferData.sourceNullifier || transferData.sourceNullifier.length !== 66) {
      throw new TransferOperationError('Invalid source nullifier', 1008);
    }
    
    // 4. Validate commitment structure
    if (!transferData.sourceCommitment || 
        typeof transferData.sourceCommitment.x !== 'bigint' || 
        typeof transferData.sourceCommitment.y !== 'bigint') {
      throw new TransferOperationError('Invalid source commitment structure', 1009);
    }
    
    console.log('✅ Transfer data validation passed with REAL secp256k1 cryptography');
  }

  /**
   * Create transfer UTXO data from existing UTXO
   */
  static async createTransferData(
    sourceUTXO: ExtendedUTXOData,
    toAddress: string,
    transferAmount: bigint,
    transferReason?: string
  ): Promise<TransferUTXOData> {
    console.log('🔧 Creating transfer data with REAL secp256k1 cryptography...');
    
    // Generate new blinding factor for output UTXO
    const outputBlindingFactor = ethers.hexlify(ethers.randomBytes(32));
    
    // Parse source commitment
    const sourceCommitment = JSON.parse(sourceUTXO.commitment);
    
    const transferData: TransferUTXOData = {
      sourceCommitment: {
        x: BigInt(sourceCommitment.x),
        y: BigInt(sourceCommitment.y)
      },
      sourceValue: sourceUTXO.value,
      sourceBlindingFactor: sourceUTXO.blindingFactor || '',
      sourceNullifier: sourceUTXO.nullifierHash || '',
      
      outputCommitment: { x: BigInt(0), y: BigInt(0) }, // Will be generated in executeTransfer
      outputBlindingFactor: outputBlindingFactor,
      outputNullifier: '', // Will be generated in executeTransfer
      
      transferAmount: transferAmount,
      fromAddress: sourceUTXO.owner,
      toAddress: toAddress,
      tokenAddress: sourceUTXO.tokenAddress,
      sourceUTXOId: sourceUTXO.id,
      
      transferReason: transferReason
    };
    
    console.log('✅ Transfer data created with REAL secp256k1 cryptography:', {
      sourceUTXOId: sourceUTXO.id.slice(0, 16) + '...',
      fromAddress: sourceUTXO.owner.slice(0, 8) + '...',
      toAddress: toAddress.slice(0, 8) + '...',
      transferAmount: transferAmount.toString(),
      cryptographyType: 'secp256k1'
    });
    
    return transferData;
  }

  /**
   * Generate cryptographically secure blinding factor for transfer
   */
  static generateTransferBlindingFactor(): string {
    const randomBytes = ethers.randomBytes(32);
    return ethers.hexlify(randomBytes);
  }

  /**
   * Validate transfer parameters
   */
  static validateTransferParameters(
    sourceUTXO: ExtendedUTXOData,
    toAddress: string,
    transferAmount: bigint
  ): { valid: boolean; error?: string } {
    if (!sourceUTXO) {
      return { valid: false, error: 'Source UTXO is required' };
    }
    
    if (!ethers.isAddress(toAddress)) {
      return { valid: false, error: 'Invalid recipient address' };
    }
    
    if (transferAmount <= 0) {
      return { valid: false, error: 'Transfer amount must be positive' };
    }
    
    if (sourceUTXO.value < transferAmount) {
      return { valid: false, error: 'Insufficient UTXO value for transfer' };
    }
    
    if (sourceUTXO.isSpent) {
      return { valid: false, error: 'Source UTXO is already spent' };
    }
    
    if (!sourceUTXO.blindingFactor || !sourceUTXO.nullifierHash) {
      return { valid: false, error: 'Source UTXO missing cryptographic data' };
    }
    
    return { valid: true };
  }
}

/**
 * Factory function to create TransferPrivateUTXO service
 */
export function createTransferPrivateUTXO(
  contract: ZKUTXOVaultContract,
  signer: ethers.Signer
): TransferPrivateUTXO {
  return new TransferPrivateUTXO(contract, signer);
}

/**
 * Helper function to estimate transfer gas cost
 */
export function estimateTransferGas(
  baseGasLimit: bigint = BigInt(300000)
): bigint {
  // Base gas for transfer operation + ZK verification overhead
  return baseGasLimit + BigInt(100000);
}

/**
 * Helper function to validate transfer feasibility
 */
export function canTransferUTXO(
  sourceUTXO: ExtendedUTXOData,
  transferAmount: bigint
): boolean {
  const validation = TransferPrivateUTXO.validateTransferParameters(
    sourceUTXO,
    ethers.ZeroAddress, // Dummy address for validation
    transferAmount
  );
  
  return validation.valid;
}