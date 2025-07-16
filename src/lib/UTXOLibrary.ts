/**
 * @fileoverview UTXOLibrary - Hybrid EOA + Zenroom + Smart Contract UTXO System
 * @description Main library integrating all UTXO functionality with TypeScript support
 */

// Simple EventEmitter implementation for browser compatibility
class EventEmitter {
  private events: { [key: string]: Array<(...args: any[]) => void> } = {};

  on(event: string, listener: (...args: any[]) => void): this {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    if (!this.events[event]) {
      return false;
    }
    this.events[event].forEach(listener => listener(...args));
    return true;
  }

  off(event: string, listener: (...args: any[]) => void): this {
    if (!this.events[event]) {
      return this;
    }
    this.events[event] = this.events[event].filter(l => l !== listener);
    return this;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
    return this;
  }
}

import { ethers, toBigInt, type BigNumberish } from 'ethers';

// Type imports
import {
  type UTXOData,
  type ExtendedUTXOData,
  UTXOType,
  type CreateUTXOParams,
  type SplitUTXOParams,
  type CombineUTXOParams,
  type TransferUTXOParams,
  type WithdrawUTXOParams,
  type UTXOOperationResult,
  type UTXOSelectionCriteria,
  type UTXOSelectionResult,
  type UTXOManagerStats,
  type UTXOManagerConfig,
  type UTXOEvents,
  UTXOOperationError,
  UTXONotFoundError,
  InsufficientFundsError,
  UTXOAlreadySpentError
} from '../types/utxo.types';

import {
  type EOAData,
  type EOAKeyDerivation,
  WalletProviderType,
  type WalletConnectionResult,
  type ERC20TokenData,
  type EthereumTransactionReceipt
} from '../types/ethereum.types';

import {
  type UTXOVaultContract,
  type UTXODataContract,
  type DepositAsUTXOParams,
  type SplitUTXOParams as ContractSplitParams,
  type CombineUTXOsParams as ContractCombineParams,
  type TransferUTXOParams as ContractTransferParams,
  type WithdrawFromUTXOParams as ContractWithdrawParams,
  createUTXOVaultContract,
  UTXO_VAULT_CONSTANTS
} from '../contracts/UTXOVault.types';

import { ZenroomHelpers } from '../utils/zenroom.helpers';
import { EthereumHelpers } from '../utils/ethereum.helpers';
 
/**
 * Main UTXOLibrary class
 * Integrates EOA wallets, Zenroom cryptography, and smart contracts
 */
export class UTXOLibrary extends EventEmitter {
  // Core components
  private zenroom: typeof ZenroomHelpers;
  private ethereum: typeof EthereumHelpers;
  protected contract: UTXOVaultContract | null = null;
  // State management
  protected utxos: Map<string, ExtendedUTXOData> = new Map();
  protected config: UTXOManagerConfig;
  protected currentEOA: EOAData | null = null;
  private isInitialized: boolean = false;

  // Cache and sync
  private lastSyncTimestamp: number = 0;
  private syncInProgress: boolean = false;

  /**
   * Constructor
   * @param config - UTXO manager configuration
   */
  constructor(config: Partial<UTXOManagerConfig> = {}) {
    super();

    this.config = {
      autoConsolidate: false,
      consolidationThreshold: 10,
      maxUTXOAge: 7 * 24 * 60 * 60, // 7 days
      privacyMode: true,
      defaultGasLimit: BigInt(500000),
      cacheTimeout: 30000, // 30 seconds
      enableBackup: true,
      ...config
    };

    this.zenroom = ZenroomHelpers;
    this.ethereum = EthereumHelpers;

    console.log('🚀 UTXOLibrary initialized');
    console.log('   - Privacy mode:', this.config.privacyMode);
    console.log('   - Auto consolidation:', this.config.autoConsolidate);
    console.log('   - Cache timeout:', this.config.cacheTimeout, 'ms');
  }

  // ========================
  // INITIALIZATION & SETUP
  // ========================

  /**
   * Initialize the library
   * @param contractAddress - UTXOVault contract address
   * @param preferredProvider - Preferred wallet provider
   * @returns Promise resolving to initialization success
   */
  async initialize(
    contractAddress: string,
    preferredProvider: WalletProviderType = WalletProviderType.METAMASK
  ): Promise<boolean> {
    try {
      console.log('🔧 Initializing UTXOLibrary...');

      // Connect wallet
      const connectionResult = await this.connectWallet(preferredProvider);
      if (!connectionResult.success) {
        throw new Error(`Wallet connection failed: ${connectionResult.error}`);
      }

      // Initialize smart contract
      const signer = this.ethereum.getSigner();
      console.log('🔗 Connecting to UTXO contract at:', contractAddress);
      this.contract = createUTXOVaultContract(contractAddress, signer);

      // Verify contract is accessible (optional check)
      console.log('🔍 Verifying contract accessibility...');
      try {
        // Try a basic contract call to verify it exists
        const code = await this.ethereum.getProvider().getCode(contractAddress);
        if (code === '0x') {
          console.warn('⚠️ No contract code found at address, but continuing initialization');
        } else {
          console.log('✅ Contract code found at address');
          // Try to call a simple view method if available
          try {
            const count = await this.contract.getUserUTXOCount(this.currentEOA?.address || ethers.ZeroAddress);
            console.log('✅ Contract verification successful, UTXO count:', count.toString());
          } catch (methodError) {
            console.warn('⚠️ Contract method call failed, but contract exists:', methodError);
          }
        }
      } catch (verificationError) {
        console.warn('⚠️ Contract verification failed, but continuing initialization:', verificationError);
      }

      // Initial sync with blockchain
      await this.syncWithBlockchain();

      this.isInitialized = true;
      console.log('✅ UTXOLibrary initialized successfully');

      this.emit('library:initialized', {
        contractAddress,
        eoa: this.currentEOA,
        utxoCount: this.utxos.size
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize UTXOLibrary:', error);
      throw new UTXOOperationError(
        'Initialization failed',
        'initialize',
        undefined,
        error
      );
    }
  }

  /**
   * Connect wallet
   * @param preferredProvider - Preferred wallet provider
   * @returns Promise resolving to connection result
   */
  async connectWallet(
    preferredProvider: WalletProviderType = WalletProviderType.METAMASK
  ): Promise<WalletConnectionResult> {
    console.log('🔗 Connecting wallet...');

    try {
      const result = await this.ethereum.connectWallet(preferredProvider);
      
      if (result.success && result.eoa) {
        this.currentEOA = result.eoa;
        console.log('✅ Wallet connected:', result.eoa.address);
        
        this.emit('wallet:connected', result.eoa);
      } else {
        console.error('❌ Wallet connection failed:', result.error);
      }

      return result;
    } catch (error) {
      const result: WalletConnectionResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown connection error'
      };
      
      this.emit('wallet:connection_failed', error);
      return result;
    }
  }

  /**
   * Disconnect wallet and cleanup
   */
  async disconnect(): Promise<void> {
    console.log('🔌 Disconnecting wallet...');

    await this.ethereum.disconnectWallet();
    this.currentEOA = null;
    this.contract = null;
    this.utxos.clear();
    this.isInitialized = false;

    this.emit('wallet:disconnected');
    console.log('✅ Wallet disconnected');
  }

  // ========================
  // CORE UTXO OPERATIONS
  // ========================

  /**
   * Deposit ERC20 tokens as UTXO
   * @param params - Deposit parameters
   * @returns Promise resolving to operation result
   */
  /**
   * DEPRECATED: Usar PrivateUTXOManager para depósitos privados con structs y almacenamiento local
   * Este método solo sirve para depósitos públicos simples (sin privacidad)
   */
  async depositAsUTXO(params: CreateUTXOParams): Promise<UTXOOperationResult> {
    throw new Error('depositAsUTXO está deshabilitado. Usa PrivateUTXOManager.createPrivateUTXO para depósitos privados.');
  }

  /**
   * Guardar UTXO privado en localStorage usando PrivateUTXOStorage
   */
  protected async savePrivateUTXOToLocal(owner: string, utxo: any): Promise<void> {
    const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
    PrivateUTXOStorage.savePrivateUTXO(owner, utxo);
  }

  /**
   * Obtener todos los UTXOs privados de un usuario desde localStorage
   */
  protected async getPrivateUTXOsFromLocal(owner: string): Promise<any[]> {
    const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
    return PrivateUTXOStorage.getPrivateUTXOs(owner);
  }

  /**
   * Split UTXO into multiple outputs
   * @param params - Split parameters
   * @returns Promise resolving to operation result
   */
  async splitUTXO(params: SplitUTXOParams): Promise<UTXOOperationResult> {
    this.ensureInitialized();
    console.log(`✂️ Splitting UTXO ${params.inputUTXOId}...`);

    try {
      const { inputUTXOId, outputValues, outputOwners } = params;

      // 1. Get and validate input UTXO
      const inputUTXO = this.utxos.get(inputUTXOId);
      if (!inputUTXO) {
        throw new UTXONotFoundError(inputUTXOId);
      }
      if (inputUTXO.isSpent) {
        throw new UTXOAlreadySpentError(inputUTXOId);
      }

      // 2. Validate split
      const totalOutputValue = outputValues.reduce((sum, val) => sum + val, BigInt(0));
      if (totalOutputValue !== inputUTXO.value) {
        throw new Error(`Sum of outputs (${totalOutputValue}) != input value (${inputUTXO.value})`);
      }

      // 3. Generate output commitments and blinding factors
      const outputBlindings = params.outputBlindingFactors || await Promise.all(
        outputValues.map(() => this.zenroom.generateSecureNonce())
      );

      const outputCommitments = await Promise.all(
        outputValues.map(async (value, index) => {
          const result = await this.zenroom.createPedersenCommitment(
            value.toString(),
            outputBlindings[index]
          );
          return result.pedersen_commitment;
        })
      );

      // 4. Generate Zenroom split proof
      const splitProof = await this.zenroom.generateSplitProof(
        inputUTXO.commitment,
        inputUTXO.value.toString(),
        inputUTXO.blindingFactor!,
        outputValues.map(v => v.toString()),
        outputBlindings
      );

      // 5. Call smart contract
      const contractParams: ContractSplitParams = {
        inputUTXOId,
        outputCommitments,
        outputOwners,
        outputValues: outputValues.map(v => v),
        splitProof: splitProof.split_proof
      };

      const tx = await this.contract!.splitUTXO(
        contractParams.inputUTXOId,
        contractParams.outputCommitments,
        contractParams.outputOwners,
        contractParams.outputValues,
        contractParams.splitProof,
        { gasLimit: this.config.defaultGasLimit }
      );

      const receipt = await tx.wait();

      // 6. Update local state
      inputUTXO.isSpent = true;
      this.emit('utxo:spent', inputUTXOId);

      // 7. Create output UTXOs
      const createdUTXOIds: string[] = [];
      
      for (let i = 0; i < outputValues.length; i++) {
        const outputId = await this.zenroom.generateUTXOId(
          outputCommitments[i],
          outputOwners[i],
          Date.now() + i // Add index for uniqueness
        );

        const outputUTXO: ExtendedUTXOData = {
          id: outputId,
          exists: true,
          value: outputValues[i],
          tokenAddress: inputUTXO.tokenAddress,
          owner: outputOwners[i],
          timestamp: toBigInt(Date.now()),
          isSpent: false,
          commitment: outputCommitments[i],
          parentUTXO: inputUTXOId,
          utxoType: UTXOType.SPLIT,
          blindingFactor: outputBlindings[i],
          localCreatedAt: Date.now(),
          confirmed: true,
          creationTxHash: receipt?.hash,
          blockNumber: receipt?.blockNumber,
          tokenMetadata: inputUTXO.tokenMetadata
        };

        this.utxos.set(outputId, outputUTXO);
        createdUTXOIds.push(outputId);
        this.emit('utxo:created', outputUTXO);
      }

      const result: UTXOOperationResult = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds
      };

      console.log('✅ UTXO split successful:', createdUTXOIds);
      return result;

    } catch (error) {
      console.error('❌ UTXO split failed:', error);
      const result: UTXOOperationResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Split failed',
        errorDetails: error
      };

      this.emit('operation:failed', new UTXOOperationError(
        'Split failed',
        'split',
        params.inputUTXOId,
        error
      ));

      return result;
    }
  }

  /**
   * Withdraw UTXO back to ERC20 tokens
   * @param params - Withdraw parameters
   * @returns Promise resolving to operation result
   */
  async withdrawFromUTXO(params: WithdrawUTXOParams): Promise<UTXOOperationResult> {
    this.ensureInitialized();
    console.log(`💸 Withdrawing UTXO ${params.utxoId}...`);

    try {
      const { utxoId, recipient } = params;

      // 1. Get and validate UTXO
      const utxo = this.utxos.get(utxoId);
      if (!utxo) {
        throw new UTXONotFoundError(utxoId);
      }
      if (utxo.isSpent) {
        throw new UTXOAlreadySpentError(utxoId);
      }

      // 2. Generate Zenroom proofs
      const burnProof = await this.zenroom.generateBurnProof(
        utxoId,
        utxo.commitment,
        utxo.value.toString(),
        utxo.blindingFactor!,
        recipient
      );

      const openingProof = await this.generateOpeningProof(
        utxo.commitment,
        utxo.value.toString(),
        utxo.blindingFactor!
      );

      // 3. Call smart contract
      const contractParams: ContractWithdrawParams = {
        utxoId,
        burnProof,
        openingProof
      };

      const tx = await this.contract!.withdrawFromUTXO(
        contractParams.utxoId,
        contractParams.burnProof,
        contractParams.openingProof,
        { gasLimit: this.config.defaultGasLimit }
      );

      const receipt = await tx.wait();

      // 4. Update local state
      utxo.isSpent = true;
      this.emit('utxo:spent', utxoId);

      const result: UTXOOperationResult = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
      };

      console.log('✅ UTXO withdrawal successful');
      return result;

    } catch (error) {
      console.error('❌ UTXO withdrawal failed:', error);
      const result: UTXOOperationResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Withdrawal failed',
        errorDetails: error
      };

      this.emit('operation:failed', new UTXOOperationError(
        'Withdrawal failed',
        'withdraw',
        params.utxoId,
        error
      ));

      return result;
    }
  }

  // ========================
  // STATE MANAGEMENT
  // ========================

  /**
   * Get UTXOs owned by address
   * @param owner - Owner address (defaults to current EOA)
   * @returns Array of UTXOs
   */
  getUTXOsByOwner(owner?: string): ExtendedUTXOData[] {
    const targetOwner = owner || this.currentEOA?.address;
    if (!targetOwner) {
      throw new Error('No owner specified and no EOA connected');
    }

    return Array.from(this.utxos.values()).filter(
      utxo => utxo.owner === targetOwner && !utxo.isSpent
    );
  }

  /**
   * Get total balance by token
   * @param tokenAddress - Token address (optional)
   * @returns Balance by token or total balance
   */
  getBalance(tokenAddress?: string): bigint | Record<string, bigint> {
    if (tokenAddress) {
      return Array.from(this.utxos.values())
        .filter(utxo => !utxo.isSpent && utxo.tokenAddress === tokenAddress)
        .reduce((sum, utxo) => sum + utxo.value, BigInt(0));
    }

    const balances: Record<string, bigint> = {};
    Array.from(this.utxos.values())
      .filter(utxo => !utxo.isSpent)
      .forEach(utxo => {
        balances[utxo.tokenAddress] = (balances[utxo.tokenAddress] || BigInt(0)) + utxo.value;
      });

    return balances;
  }

  /**
   * Get manager statistics
   * @returns UTXO manager stats
   */
  getStats(): UTXOManagerStats {
    const allUTXOs = Array.from(this.utxos.values());
    const unspent = allUTXOs.filter(u => !u.isSpent);
    const spent = allUTXOs.filter(u => u.isSpent);
    const confirmed = allUTXOs.filter(u => u.confirmed);

    const balanceByToken: Record<string, bigint> = {};
    const creationDistribution: Record<UTXOType, number> = {
      [UTXOType.DEPOSIT]: 0,
      [UTXOType.SPLIT]: 0,
      [UTXOType.COMBINE]: 0,
      [UTXOType.TRANSFER]: 0
    };

    unspent.forEach(utxo => {
      balanceByToken[utxo.tokenAddress] = (balanceByToken[utxo.tokenAddress] || BigInt(0)) + utxo.value;
      creationDistribution[utxo.utxoType]++;
    });

    const totalBalance = Object.values(balanceByToken).reduce((sum, bal) => sum + bal, BigInt(0));
    const averageUTXOValue = unspent.length > 0 ? totalBalance / BigInt(unspent.length) : BigInt(0);

    return {
      totalUTXOs: allUTXOs.length,
      unspentUTXOs: unspent.length,
      spentUTXOs: spent.length,
      confirmedUTXOs: confirmed.length,
      totalBalance,
      balanceByToken,
      averageUTXOValue,
      uniqueTokens: Object.keys(balanceByToken).length,
      creationDistribution
    };
  }

  /**
   * Sync local state with blockchain
   * @returns Promise resolving to sync success
   */
  async syncWithBlockchain(): Promise<boolean> {
    if (this.syncInProgress || !this.contract || !this.currentEOA) {
      return false;
    }

    this.syncInProgress = true;
    console.log('🔄 Syncing with blockchain...');

    try {
      // Get UTXOs from contract
      const contractUTXOIds = await this.contract.getUTXOsByOwner(this.currentEOA.address);
      
      for (const utxoId of contractUTXOIds) {
        const contractUTXO = await this.contract.getUTXOInfo(utxoId);
        // contractUTXO: [exists, commitment, tokenAddress, owner, value, isSpent, parentUTXO, utxoType, timestamp, nullifierHash]
        if (!this.utxos.has(utxoId)) {
          const utxo: ExtendedUTXOData = {
            id: utxoId,
            exists: contractUTXO[0],
            commitment: contractUTXO[1],
            tokenAddress: contractUTXO[2],
            owner: contractUTXO[3],
            value: BigInt(contractUTXO[4].toString()),
            isSpent: contractUTXO[5],
            parentUTXO: contractUTXO[6],
            utxoType: this.mapContractUTXOType(contractUTXO[7]),
            timestamp: toBigInt(contractUTXO[8]),
            localCreatedAt: Date.now(),
            confirmed: true
          };
          this.utxos.set(utxoId, utxo);
          this.emit('utxo:synced', utxo);
        } else {
          const localUTXO = this.utxos.get(utxoId)!;
          localUTXO.isSpent = contractUTXO[5];
          localUTXO.confirmed = true;
        }
      }

      this.lastSyncTimestamp = Date.now();
      console.log('✅ Blockchain sync completed');
      
      return true;
    } catch (error) {
      console.error('❌ Blockchain sync failed:', error);
      return false;
    } finally {
      this.syncInProgress = false;
    }
  }

  // ========================
  // HELPER METHODS
  // ========================

  /**
   * Ensure library is initialized
   */
  protected ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('UTXOLibrary not initialized. Call initialize() first.');
    }
    if (!this.contract) {
      throw new Error('UTXO contract not initialized. Contract address may be invalid.');
    }
  }

  /**
   * Generate deposit proof using Zenroom
   */
  private async generateDepositProof(amount: bigint, commitment: string, owner: string): Promise<string> {
    // For now, return a placeholder proof
    // In production, this would generate a proper Zenroom proof
    return ethers.hexlify(ethers.toUtf8Bytes(
      JSON.stringify({ amount: amount.toString(), commitment, owner, timestamp: Date.now() })
    ));
  }

  /**
   * Generate opening proof using Zenroom
   */
  private async generateOpeningProof(commitment: string, value: string, blindingFactor: string): Promise<string> {
    // For now, return a placeholder proof
    // In production, this would generate a proper Zenroom opening proof
    return ethers.hexlify(ethers.toUtf8Bytes(
      JSON.stringify({ commitment, value, blindingFactor, timestamp: Date.now() })
    ));
  }

  /**
   * Map contract UTXO type to local enum
   */
  private mapContractUTXOType(contractType: number): UTXOType {
    switch (contractType) {
      case UTXO_VAULT_CONSTANTS.UTXO_TYPES.DEPOSIT: return UTXOType.DEPOSIT;
      case UTXO_VAULT_CONSTANTS.UTXO_TYPES.SPLIT: return UTXOType.SPLIT;
      case UTXO_VAULT_CONSTANTS.UTXO_TYPES.COMBINE: return UTXOType.COMBINE;
      case UTXO_VAULT_CONSTANTS.UTXO_TYPES.TRANSFER: return UTXOType.TRANSFER;
      default: return UTXOType.DEPOSIT;
    }
  }

  // ========================
  // PUBLIC GETTERS
  // ========================

  /**
   * Get current EOA data
   */
  get currentAccount(): EOAData | null {
    return this.currentEOA;
  }

  /**
   * Get initialization status
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get configuration
   */
  get configuration(): UTXOManagerConfig {
    return { ...this.config };
  }

  /**
   * Get contract address
   */
  get contractAddress(): string | null {
    return this.contract?.address || null;
  }
}

/**
 * Export default instance for convenience
 */
export const utxoLibrary = new UTXOLibrary();

/**
 * Export types for external use
 */
export * from '../types/utxo.types';
export * from '../types/ethereum.types';
export * from '../types/zenroom.d'; 
// Export specific contract types to avoid conflicts
export type {
  UTXODataContract,
  UTXOVaultConfig,
  ContractCallOptions,
  UTXOVaultInterface,
  UTXOVaultEventFilters,
  UTXOVaultError,
  UTXOVaultProofError,
  UTXOVaultErrorType,
  UTXO_VAULT_ABI,
  UTXO_VAULT_CONSTANTS,
  // Use aliases for conflicting types
  DepositAsUTXOParams as ContractDepositParams,
  WithdrawFromUTXOParams as ContractWithdrawParams,
  SplitUTXOParams as ContractSplitParams,
  CombineUTXOsParams as ContractCombineParams,
  TransferUTXOParams as ContractTransferParams,
  // Contract events
  UTXOCreatedEvent,
  UTXOSplitEvent,
  UTXOCombinedEvent,
  UTXOTransferredEvent,
  UTXOWithdrawnEvent,
  // Contract results
  SplitUTXOResult,
  CombineUTXOsResult,
  GetUTXOInfoResult,
  GetUTXOsByOwnerResult,
  GetSplitOperationResult,
  GetCombineOperationResult,
  // Utility functions
  createUTXOVaultContract,
  createUTXOVaultInterface,
  isUTXODataContract,
  isSplitOperationContract
} from '../contracts/UTXOVault.types';