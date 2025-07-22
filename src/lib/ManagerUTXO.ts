/**
 * @fileoverview PrivateUTXOManager - Manager refactorizado usando composición
 * @description Implementa privacidad real usando SOLO Pedersen commitments, Range proofs y Equality proofs
 */

import { ethers, toBigInt, type BigNumberish } from 'ethers';
import { depositAsPrivateUTXOSimplified } from './DepositAsPrivateUTXO';
import { SplitPrivateUTXO, type SplitOperationResult, type SplitUTXOData } from './SplitPrivateUTXO';
import { CryptoHelpers as ZenroomHelpers } from '../utils/crypto.helpers.js';
import { EthereumHelpers } from './../utils/ethereum.helpers';
import { gasManager } from './GasManager';
import { UTXORecoveryService } from './UTXORecoveryService';
import {
  type UTXOOperationResult,
  type ExtendedUTXOData,
  type CreateUTXOParams,
  type SplitUTXOParams,
  type TransferUTXOParams,
  type WithdrawUTXOParams,
  type UTXOManagerStats,
  type UTXOManagerConfig,
  UTXOOperationError,
  UTXONotFoundError,          
  InsufficientFundsError,      
  UTXOAlreadySpentError,       
  UTXOType
} from '../types/utxo.types';
import {
  type DepositParams,
  type ProofParams,
  type GeneratorParams,
  type CommitmentPoint,
  createUTXOVaultContract,
  type UTXOVaultContract
} from '../contracts/UTXOVault.types';

// Simple EventEmitter implementation
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

// Extended PrivateUTXO interface
export interface PrivateUTXO extends ExtendedUTXOData {
  blindingFactor: string;
  commitment: string;
  nullifierHash: string;
  isPrivate: true;
  encryptedData?: string;
  recoveryData?: {
    encryptedBlindingFactor: string;
    encryptedAmount: string;
    recoveryCommitment: string;
    witnessSignature: string;
  };
  witnessSignature?: string;
  
  // Propiedades para UTXOs recuperados
  recovered?: boolean;
  recoveryReason?: string;
  usable?: boolean;
}

/**
 * PrivateUTXOManager - Manager refactorizado usando composición
 * No hereda de UTXOLibrary, usa servicios específicos
 */
export class PrivateUTXOManager extends EventEmitter {
  // Servicios de operaciones específicas
  private splitService: SplitPrivateUTXO | null = null;
  
  // Core components
  protected contract: UTXOVaultContract | null = null;
  protected currentAccount: any | null = null;
  protected utxos: Map<string, ExtendedUTXOData> = new Map();
  
  // State management
  private privateUTXOs: Map<string, PrivateUTXO> = new Map();
  private bn254OperationCount: number = 0;
  private currentChainId: number | null = null;
  private config: UTXOManagerConfig;
  private isInitialized: boolean = false;

  constructor(config: Partial<UTXOManagerConfig> = {}) {
    super();
    
    this.config = {
      autoConsolidate: false,
      consolidationThreshold: 5,
      maxUTXOAge: 7 * 24 * 60 * 60,
      privacyMode: true,
      defaultGasLimit: BigInt(500000),
      cacheTimeout: 30000,
      enableBackup: true,
      ...config
    };
    
    console.log('🔐 PrivateUTXOManager (refactored) initialized with REAL BN254 cryptography only');
  }

  /**
   * Initialize the manager and services
   */
  async initialize(contractAddressOrProvider: string): Promise<boolean> {
    try {
      // Get provider and signer first
      const provider = EthereumHelpers.getProvider();
      if (!provider) {
        throw new Error('No provider available');
      }

      const signer = await provider.getSigner();
      this.currentAccount = { address: await signer.getAddress() };

      // Initialize contract with provider  
      this.contract = await createUTXOVaultContract(contractAddressOrProvider, provider);
      if (!this.contract) {
        throw new Error('Failed to create contract instance');
      }

      // Get chain ID
      const network = await provider.getNetwork();
      this.currentChainId = Number(network.chainId);
      
      console.log(`⛽ Detected chain ID: ${this.currentChainId}`);
      console.log(`⛽ Network requires gas: ${gasManager.requiresGas(this.currentChainId)}`);

      // Initialize services with contract and signer
      this.splitService = new SplitPrivateUTXO(this.contract, signer);

      // Configure CryptoHelpers with the contract
      const { CryptoHelpers } = await import('../utils/crypto.helpers');
      CryptoHelpers.setContract(this.contract as any);
      
      this.isInitialized = true;
      console.log('✅ PrivateUTXOManager (refactored) initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize PrivateUTXOManager:', error);
      return false;
    }
  }

  /**
   * Create a private UTXO using the deposit function
   */
  async createPrivateUTXO(params: CreateUTXOParams): Promise<UTXOOperationResult> {
    if (!this.isInitialized || !this.contract) {
      throw new UTXOOperationError('Manager not initialized', 'createPrivateUTXO');
    }

    try {
      console.log('🔄 Creating private UTXO...');
      
      // Use the deposit function with all required parameters
      const result = await depositAsPrivateUTXOSimplified(
        params,
        this.contract,
        this.currentAccount,
        EthereumHelpers,
        this.utxos,
        (utxo: any) => this.privateUTXOs.set(utxo.id, utxo),
        (event: string, data: any) => this.emit(event, data)
      );
      
      return result;
    } catch (error) {
      console.error('❌ Failed to create private UTXO:', error);
      throw new UTXOOperationError(`Failed to create private UTXO: ${error}`, 'createPrivateUTXO');
    }
  }

  /**
   * Split a private UTXO using the split service
   */
  async splitPrivateUTXO(params: SplitUTXOParams): Promise<UTXOOperationResult> {
    if (!this.isInitialized || !this.contract || !this.splitService) {
      throw new UTXOOperationError('Manager not initialized', 'splitPrivateUTXO');
    }

    try {
      console.log('🔄 Splitting private UTXO...');
      
      // Get the input UTXO
      const inputUTXO = this.privateUTXOs.get(params.inputUTXOId);
      if (!inputUTXO) {
        throw new UTXONotFoundError(params.inputUTXOId);
      }

      // Convert to SplitUTXOData format
      const splitData: SplitUTXOData = {
        sourceCommitment: {
          x: BigInt(inputUTXO.commitment.slice(0, 66)),
          y: BigInt('0x' + inputUTXO.commitment.slice(66))
        },
        sourceValue: inputUTXO.value,
        sourceBlindingFactor: inputUTXO.blindingFactor,
        sourceNullifier: inputUTXO.nullifierHash,
        outputValues: params.outputValues,
        outputBlindingFactors: [], // Will be generated by the service
        tokenAddress: inputUTXO.tokenAddress,
        sourceUTXOId: params.inputUTXOId
      };

      // Use the split service with a dummy backend attestation provider
      const result = await this.splitService.executeSplit(
        splitData,
        async (dataHash: string) => ({
          operation: 'SPLIT',
          dataHash: dataHash,
          nonce: BigInt(Math.floor(Math.random() * 1000000)),
          timestamp: BigInt(Math.floor(Date.now() / 1000)),
          signature: '0x' + '0'.repeat(128), // Dummy signature
        })
      );
      
      // Convert SplitOperationResult to UTXOOperationResult
      const utxoResult: UTXOOperationResult = {
        success: result.success,
        transactionHash: result.transactionHash,
        createdUTXOIds: result.outputUTXOIds || [],
        error: result.error
      };

      // Update UTXOs state if successful
      if (result.success) {
        // Mark input UTXO as spent
        inputUTXO.isSpent = true;
        this.emit('private:utxo:spent', params.inputUTXOId);
        
        // Add output UTXOs
        if (result.outputUTXOIds) {
          result.outputUTXOIds.forEach((utxoId, index) => {
            const outputAmount = params.outputValues[index];
            const outputUTXO: PrivateUTXO = {
              id: utxoId,
              exists: true,
              value: outputAmount,
              tokenAddress: inputUTXO.tokenAddress,
              owner: this.currentAccount?.address || '',
              timestamp: BigInt(Date.now()),
              isSpent: false,
              commitment: result.outputCommitmentHashes?.[index] || '',
              parentUTXO: params.inputUTXOId,
              utxoType: UTXOType.SPLIT,
              localCreatedAt: Date.now(),
              confirmed: false,
              nullifierHash: result.outputNullifiers?.[index] || '',
              blindingFactor: '', // Would need to be provided by the service
              isPrivate: true,
              cryptographyType: 'BN254'
            };
            
            this.privateUTXOs.set(utxoId, outputUTXO);
            this.utxos.set(utxoId, outputUTXO);
            
            this.emit('private:utxo:created', outputUTXO);
          });
        }
        
        this.emit('private:utxo:split', { 
          input: params.inputUTXOId, 
          outputs: result.outputUTXOIds || [] 
        });
      }
      
      return utxoResult;
    } catch (error) {
      console.error('❌ Failed to split private UTXO:', error);
      throw new UTXOOperationError(`Failed to split private UTXO: ${error}`, 'splitPrivateUTXO');
    }
  }

  /**
   * Transfer a private UTXO (placeholder - to be implemented)
   */
  async transferPrivateUTXO(params: TransferUTXOParams): Promise<UTXOOperationResult> {
    throw new Error('Transfer operation not yet implemented');
  }

  /**
   * Withdraw a private UTXO (placeholder - to be implemented)
   */
  async withdrawPrivateUTXO(params: WithdrawUTXOParams): Promise<UTXOOperationResult> {
    throw new Error('Withdraw operation not yet implemented');
  }

  /**
   * Get all private UTXOs
   */
  getPrivateUTXOs(): PrivateUTXO[] {
    return Array.from(this.privateUTXOs.values()).filter(utxo => !utxo.isSpent);
  }

  /**
   * Get a specific private UTXO
   */
  getPrivateUTXO(utxoId: string): PrivateUTXO | undefined {
    return this.privateUTXOs.get(utxoId);
  }

  /**
   * Get current connected account
   */
  getCurrentAccount(): { address: string } | null {
    return this.currentAccount;
  }

  /**
   * Get private UTXOs by owner address
   */
  getPrivateUTXOsByOwner(ownerAddress: string): PrivateUTXO[] {
    return this.getPrivateUTXOs().filter(utxo => 
      utxo.owner.toLowerCase() === ownerAddress.toLowerCase()
    );
  }

  /**
   * Get ERC20 token information
   */
  async getERC20TokenInfo(tokenAddress: string, userAddress: string): Promise<any> {
    return await EthereumHelpers.getERC20TokenInfo(tokenAddress, userAddress);
  }

  /**
   * Connect wallet
   */
  async connectWallet(providerType: any): Promise<boolean> {
    try {
      const result = await EthereumHelpers.connectWallet(providerType);
      if (result.success) {
        const provider = EthereumHelpers.getProvider();
        if (provider) {
          const signer = await provider.getSigner();
          this.currentAccount = { address: await signer.getAddress() };
        }
      }
      return result.success;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      return false;
    }
  }

  /**
   * Disconnect wallet
   */
  disconnect(): void {
    this.currentAccount = null;
    EthereumHelpers.disconnectWallet();
  }

  /**
   * Sync with blockchain
   */
  async syncWithBlockchain(): Promise<boolean> {
    try {
      // Basic sync implementation - could be expanded
      console.log('🔄 Syncing with blockchain...');
      return true;
    } catch (error) {
      console.error('Sync failed:', error);
      return false;
    }
  }

  /**
   * Get UTXO stats (alias for getStats)
   */
  getUTXOStats(): UTXOManagerStats {
    return this.getStats();
  }

  /**
   * Scan and recover lost UTXOs
   */
  async scanAndRecoverLostUTXOs(fromBlock: number = 0): Promise<any> {
    if (!this.currentAccount || !this.contract) {
      throw new Error('Manager not initialized or no account connected');
    }
    
    const recoveryService = new UTXORecoveryService(this.contract, EthereumHelpers.getProvider()!);
    return await recoveryService.scanAndRecoverUTXOs(this.currentAccount.address, fromBlock);
  }

  /**
   * Audit UTXO consistency
   */
  async auditUTXOConsistency(): Promise<any> {
    if (!this.currentAccount || !this.contract) {
      throw new Error('Manager not initialized or no account connected');
    }
    
    const recoveryService = new UTXORecoveryService(this.contract, EthereumHelpers.getProvider()!);
    return await recoveryService.auditUTXOConsistency(this.currentAccount.address);
  }

  /**
   * Get recovery stats
   */
  getRecoveryStats(): any {
    if (!this.currentAccount) {
      return {
        totalUTXOs: 0,
        usableUTXOs: 0,
        recoveredUTXOs: 0,
        unusableUTXOs: 0
      };
    }
    
    return UTXORecoveryService.getRecoveryStats(this.currentAccount.address);
  }

  /**
   * Get manager statistics
   */
  getStats(): UTXOManagerStats {
    const allUTXOs = Array.from(this.privateUTXOs.values());
    const unspentUTXOs = allUTXOs.filter(utxo => !utxo.isSpent);
    
    return {
      totalUTXOs: allUTXOs.length,
      unspentUTXOs: unspentUTXOs.length,
      spentUTXOs: allUTXOs.length - unspentUTXOs.length,
      uniqueTokens: 0, // TODO: Calculate unique tokens
      totalBalance: BigInt(0), // TODO: Calculate total balance
      privateUTXOs: allUTXOs.length,
      confirmedUTXOs: allUTXOs.filter(utxo => utxo.confirmed).length,
      balanceByToken: {}, // TODO: Calculate balance by token
      averageUTXOValue: BigInt(0), // TODO: Calculate average value
      creationDistribution: [], // TODO: Calculate creation distribution
      bn254UTXOs: allUTXOs.length,
      bn254Operations: this.bn254OperationCount,
      cryptographyDistribution: {
        BN254: allUTXOs.length,
        Other: 0
      }
    };
  }

  /**
   * Generate BN254 UTXO ID
   */
  private async generateBN254UTXOId(amount: bigint, blindingFactor: string, owner: string): Promise<string> {
    const commitment = await ZenroomHelpers.createPedersenCommitment(amount.toString(), blindingFactor);
    return ethers.keccak256(ethers.solidityPacked(
      ['string', 'string', 'address'],
      [commitment.x, commitment.y, blindingFactor, owner]
    ));
  }

  /**
   * Prepare transaction parameters
   */
  private async prepareTransactionParams(
    customGasLimit?: bigint,
    gasOptions?: { maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint }
  ): Promise<any> {
    const txParams: any = {};

    if (customGasLimit) {
      txParams.gasLimit = customGasLimit;
    } else {
      txParams.gasLimit = this.config.defaultGasLimit;
    }

    if (gasOptions) {
      if (gasOptions.maxFeePerGas) {
        txParams.maxFeePerGas = gasOptions.maxFeePerGas;
      }
      if (gasOptions.maxPriorityFeePerGas) {
        txParams.maxPriorityFeePerGas = gasOptions.maxPriorityFeePerGas;
      }
    }

    // Only apply gas management for networks that require gas
    if (gasManager.requiresGas(this.currentChainId || 1)) {
      const gasManagerOptions = await gasManager.getGasOptions(
        this.currentChainId || 1,
        undefined,
        'deposit'
      );

      if (gasManagerOptions) {
        if (gasManagerOptions.maxFeePerGas && !txParams.maxFeePerGas) {
          txParams.maxFeePerGas = gasManagerOptions.maxFeePerGas;
        }
        if (gasManagerOptions.maxPriorityFeePerGas && !txParams.maxPriorityFeePerGas) {
          txParams.maxPriorityFeePerGas = gasManagerOptions.maxPriorityFeePerGas;
        }
        if (gasManagerOptions.gasPrice && !txParams.gasPrice) {
          txParams.gasPrice = gasManagerOptions.gasPrice;
        }
        if (gasManagerOptions.gasLimit && !txParams.gasLimit) {
          txParams.gasLimit = gasManagerOptions.gasLimit;
        }
      }
    }

    return txParams;
  }

  /**
   * Approve token spending
   */
  private async approveTokenSpending(tokenAddress: string, amount: bigint): Promise<void> {
    const signer = EthereumHelpers.getSigner();
    if (!signer) {
      throw new UTXOOperationError('No signer available', 'approveTokenSpending');
    }

    console.log(`🔄 Approving token spending: ${tokenAddress}, amount: ${amount}`);
  }

  /**
   * Debug contract interaction
   */
  async debugContractInteraction(params: CreateUTXOParams): Promise<void> {
    console.log('🔍 Debugging contract interaction...');
  }
}

// Export singleton instance
export const privateUTXOManager = new PrivateUTXOManager();
export default privateUTXOManager;
