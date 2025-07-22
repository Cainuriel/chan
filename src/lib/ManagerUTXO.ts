/**
 * @fileoverview PrivateUTXOManager - Manager refactorizado usando composición
 * @description Implementa privacidad real usando SOLO Pedersen commitments, Range proofs y Equality proofs
 */

import { ethers, toBigInt, type BigNumberish } from 'ethers';
import { depositAsPrivateUTXOSimplified } from './DepositAsPrivateUTXO';
import { SplitPrivateUTXO, type SplitOperationResult, type SplitUTXOData } from './SplitPrivateUTXO';
import { AttestationService } from './AttestationService';
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
  private attestationService: AttestationService | null = null;
  
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

      // Initialize contract with SIGNER (not provider) to support transactions
      this.contract = await createUTXOVaultContract(contractAddressOrProvider, signer);
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
      
      // Initialize attestation service with contract
      this.attestationService = new AttestationService(this.contract as any);
      console.log('✅ Attestation service initialized');

      // Configure CryptoHelpers with the contract
      const { CryptoHelpers } = await import('../utils/crypto.helpers');
      CryptoHelpers.setContract(this.contract as any);
      
      // Load existing UTXOs from localStorage for the current user
      await this.loadUTXOsFromStorage();
      
      this.isInitialized = true;
      console.log('✅ PrivateUTXOManager (refactored) initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize PrivateUTXOManager:', error);
      return false;
    }
  }

  /**
   * Load UTXOs from localStorage for the current user
   */
  private async loadUTXOsFromStorage(): Promise<void> {
    if (!this.currentAccount) {
      console.log('⚠️ No account connected - cannot load UTXOs from storage');
      return;
    }

    try {
      const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
      const storedUTXOs = PrivateUTXOStorage.getPrivateUTXOs(this.currentAccount.address);
      
      console.log(`💾 Loading ${storedUTXOs.length} UTXOs from localStorage for user ${this.currentAccount.address}`);
      
      storedUTXOs.forEach(utxo => {
        this.privateUTXOs.set(utxo.id, utxo);
      });
      
      console.log(`✅ Loaded ${storedUTXOs.length} UTXOs into manager from localStorage`);
    } catch (error) {
      console.error('❌ Failed to load UTXOs from localStorage:', error);
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
        async (userAddress: string, utxo: any) => {
          console.log('💾 Saving UTXO to manager:', utxo.id);
          
          // Save to internal collection
          this.privateUTXOs.set(utxo.id, utxo);
          console.log('✅ UTXO saved to manager internal collection');
          
          // ALSO save to localStorage using PrivateUTXOStorage
          const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
          PrivateUTXOStorage.savePrivateUTXO(userAddress, utxo);
          console.log('✅ UTXO also saved to localStorage');
        },
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
      
      // Initialize crypto system if not already done
      const { CryptoHelpers } = await import('../utils/crypto.helpers');
      const isInitialized = await CryptoHelpers.initialize();
      if (!isInitialized) {
        throw new UTXOOperationError('Failed to initialize crypto system', 'splitPrivateUTXO');
      }
      console.log('✅ Crypto system initialized for split operation');
      console.log('🔍 Looking for UTXO ID:', params.inputUTXOId);
      
      // First, try to get from internal collection
      let inputUTXO = this.privateUTXOs.get(params.inputUTXOId);
      
      if (!inputUTXO) {
        // If not found in internal collection, try to load from localStorage
        console.log('⚠️ UTXO not found in internal collection, checking localStorage...');
        
        if (this.currentAccount) {
          const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
          const allStoredUTXOs = PrivateUTXOStorage.getAllUserUTXOs(this.currentAccount.address);
          
          const foundUTXO = allStoredUTXOs.all.find(utxo => utxo.id === params.inputUTXOId);
          
          if (foundUTXO) {
            console.log('✅ Found UTXO in localStorage, adding to internal collection');
            
            // Convert and add to internal collection
            const convertedUTXO: PrivateUTXO = {
              ...foundUTXO,
              blindingFactor: foundUTXO.blindingFactor || '',
              commitment: foundUTXO.commitment || '',
              nullifierHash: foundUTXO.nullifierHash || '',
              isPrivate: true as const,
              recovered: foundUTXO.recovered,
              recoveryReason: foundUTXO.recoveryReason,
              usable: foundUTXO.usable !== false
            };
            
            this.privateUTXOs.set(params.inputUTXOId, convertedUTXO);
            inputUTXO = convertedUTXO;
            
            console.log('🔄 UTXO synchronized from localStorage to manager');
          }
        }
      }
      
      if (!inputUTXO) {
        console.error('❌ UTXO not found in manager or localStorage');
        console.error('Available UTXOs in manager:', Array.from(this.privateUTXOs.keys()));
        throw new UTXONotFoundError(params.inputUTXOId);
      }
      
      // Check if UTXO is already spent
      if (inputUTXO.isSpent) {
        throw new UTXOAlreadySpentError(params.inputUTXOId);
      }
      
      console.log('✅ Found UTXO for split:', {
        id: inputUTXO.id,
        value: inputUTXO.value.toString(),
        isSpent: inputUTXO.isSpent,
        owner: inputUTXO.owner
      });

      // Convert to SplitUTXOData format
      console.log('🔄 Converting UTXO data for split operation...');
      
      // Validate required cryptographic data
      if (!inputUTXO.commitment || !inputUTXO.blindingFactor || !inputUTXO.nullifierHash) {
        throw new UTXOOperationError(
          'UTXO missing required cryptographic data (commitment, blindingFactor, or nullifierHash)',
          'splitPrivateUTXO'
        );
      }
      
      // Parse commitment coordinates
      let sourceCommitment;
      try {
        if (inputUTXO.commitment.startsWith('0x')) {
          // Handle hex string format (legacy or specific format)
          const commitmentHex = inputUTXO.commitment.slice(2);
          if (commitmentHex.length === 128) { // 64 chars for x + 64 chars for y
            sourceCommitment = {
              x: BigInt('0x' + commitmentHex.slice(0, 64)),
              y: BigInt('0x' + commitmentHex.slice(64))
            };
          } else if (commitmentHex.length === 64) {
            // This is a hash, try to get coordinates from notes
            console.log('🔍 Detected commitment hash, looking for coordinates in notes...');
            if (inputUTXO.notes) {
              try {
                const notes = JSON.parse(inputUTXO.notes);
                if (notes.commitmentX && notes.commitmentY) {
                  sourceCommitment = {
                    x: BigInt(notes.commitmentX),
                    y: BigInt(notes.commitmentY)
                  };
                  console.log('✅ Found coordinates in notes');
                } else {
                  throw new Error('Commitment coordinates not found in notes');
                }
              } catch (notesError) {
                throw new Error('Cannot parse coordinates from notes and commitment is a hash');
              }
            } else {
              throw new Error('Commitment is a hash but no notes available with coordinates');
            }
          } else {
            throw new Error(`Invalid hex commitment format: unexpected length ${commitmentHex.length}`);
          }
        } else if (inputUTXO.commitment.startsWith('{')) {
          // Handle JSON format (new format)
          const parsedCommitment = JSON.parse(inputUTXO.commitment);
          sourceCommitment = {
            x: BigInt(parsedCommitment.x),
            y: BigInt(parsedCommitment.y)
          };
        } else {
          // Try to parse as JSON without curly braces check
          const parsedCommitment = JSON.parse(inputUTXO.commitment);
          sourceCommitment = {
            x: BigInt(parsedCommitment.x),
            y: BigInt(parsedCommitment.y)
          };
        }
      } catch (error) {
        console.error('❌ Failed to parse commitment:', inputUTXO.commitment);
        console.error('❌ Available data:', {
          commitment: inputUTXO.commitment,
          hasNotes: !!inputUTXO.notes,
          notes: inputUTXO.notes
        });
        throw new UTXOOperationError(
          `Invalid commitment format: ${error instanceof Error ? error.message : error}`,
          'splitPrivateUTXO'
        );
      }
      
      console.log('🔐 Commitment parsed successfully:', {
        x: sourceCommitment.x.toString(16),
        y: sourceCommitment.y.toString(16)
      });
      
      // Generate NEW nullifier for this split transaction (never reuse old ones!)
      console.log('🔑 Generating NEW nullifier for split transaction...');
      
      // Extract address string properly
      const userAddress = this.currentAccount?.address || 
                         (typeof this.currentAccount === 'string' ? this.currentAccount : '');
      
      if (!userAddress) {
        throw new UTXOOperationError('User address not available for nullifier generation', 'splitPrivateUTXO');
      }
      
      const newNullifier = await ZenroomHelpers.generateNullifierHash(
        `${sourceCommitment.x}_${sourceCommitment.y}`, // commitment as string
        userAddress,                                   // user address as string
        `split_${Date.now()}_${Math.random()}`        // unique nonce for this transaction
      );
      
      console.log('✅ New nullifier generated:', newNullifier.substring(0, 20) + '...');
      
      const splitData: SplitUTXOData = {
        sourceCommitment,
        sourceValue: inputUTXO.value,
        sourceBlindingFactor: inputUTXO.blindingFactor,
        sourceNullifier: newNullifier, // Use NEW nullifier, not the stored one
        outputValues: params.outputValues,
        outputBlindingFactors: [], // Will be generated by the service
        tokenAddress: inputUTXO.tokenAddress,
        sourceUTXOId: params.inputUTXOId
      };

      // Store original UTXO state for rollback in case of failure
      const originalIsSpent = inputUTXO.isSpent;
      let transactionSuccessful = false;
      
      try {
        // Verify attestation service is ready
        if (!this.attestationService || !this.attestationService.isReady()) {
          throw new Error('❌ Attestation service not ready. Cannot create split attestation.');
        }

        // Use the split service with REAL backend attestation provider
        console.log('🚀 Executing split operation with REAL attestation...');
        const result = await this.splitService.executeSplit(
          splitData,
          this.attestationService.getSplitAttestationProvider()
        );
        
        // Convert SplitOperationResult to UTXOOperationResult
        const utxoResult: UTXOOperationResult = {
          success: result.success,
          transactionHash: result.transactionHash,
          createdUTXOIds: result.outputUTXOIds || [],
          error: result.error
        };

        // ONLY update UTXOs state if blockchain transaction was successful
        if (result.success && result.transactionHash) {
          console.log('✅ Blockchain transaction confirmed, updating UTXO state...');
          transactionSuccessful = true;
          
          // Mark input UTXO as spent ONLY after confirmed blockchain success
          console.log(`🔄 Marking UTXO ${params.inputUTXOId} as spent (NOT DELETING)`);
          inputUTXO.isSpent = true;
          console.log(`✅ UTXO ${params.inputUTXOId} marked as spent, preserved in memory`);
          
          // Update spent UTXO in localStorage too
          const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
          PrivateUTXOStorage.savePrivateUTXO(this.currentAccount?.address || '', inputUTXO);
          console.log(`💾 Updated spent UTXO ${params.inputUTXOId} in localStorage`);
          
          this.emit('private:utxo:spent', params.inputUTXOId);
          
          // Add output UTXOs
          if (result.outputUTXOIds) {
            result.outputUTXOIds.forEach(async (utxoId, index) => {
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
                confirmed: true, // Mark as confirmed since blockchain transaction succeeded
                nullifierHash: result.outputNullifiers?.[index] || '',
                blindingFactor: '', // Would need to be provided by the service
                isPrivate: true,
                cryptographyType: 'BN254'
              };
              
              // Save to internal collections
              this.privateUTXOs.set(utxoId, outputUTXO);
              this.utxos.set(utxoId, outputUTXO);
              
              // ALSO save to localStorage
              PrivateUTXOStorage.savePrivateUTXO(this.currentAccount?.address || '', outputUTXO);
              console.log(`💾 Saved new split UTXO ${utxoId} to localStorage`);
              
              this.emit('private:utxo:created', outputUTXO);
            });
          }
          
          this.emit('private:utxo:split', { 
            input: params.inputUTXOId, 
            outputs: result.outputUTXOIds || [] 
          });
          
          console.log('🎉 Split operation completed successfully');
        } else {
          console.error('❌ Split operation failed:', result.error);
          throw new UTXOOperationError(
            result.error || 'Split operation failed without specific error',
            'splitPrivateUTXO'
          );
        }
        
        return utxoResult;
        
      } catch (splitError) {
        // Rollback UTXO state if transaction failed
        if (!transactionSuccessful) {
          console.log('🔄 Rolling back UTXO state due to failed transaction...');
          inputUTXO.isSpent = originalIsSpent;
          console.log('✅ UTXO state rolled back successfully');
        }
        throw splitError;
      }
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
   * Get all private UTXOs (available - not spent)
   */
  getPrivateUTXOs(): PrivateUTXO[] {
    return Array.from(this.privateUTXOs.values()).filter(utxo => 
      !utxo.isSpent && 
      utxo.owner && 
      this.currentAccount && 
      utxo.owner.toLowerCase() === this.currentAccount.address.toLowerCase()
    );
  }

  /**
   * Get spent/historical UTXOs for the current user
   */
  getSpentUTXOs(): PrivateUTXO[] {
    return Array.from(this.privateUTXOs.values()).filter(utxo => 
      utxo.isSpent && 
      utxo.owner && 
      this.currentAccount && 
      utxo.owner.toLowerCase() === this.currentAccount.address.toLowerCase()
    );
  }

  /**
   * Get all UTXOs (spent + unspent) for the current user
   */
  getAllUserUTXOs(): PrivateUTXO[] {
    return Array.from(this.privateUTXOs.values()).filter(utxo => 
      utxo.owner && 
      this.currentAccount && 
      utxo.owner.toLowerCase() === this.currentAccount.address.toLowerCase()
    );
  }

  /**
   * Recover a UTXO by marking it as unspent (emergency function)
   */
  async recoverUTXO(utxoId: string, reason: string = 'Manual recovery'): Promise<boolean> {
    const utxo = this.privateUTXOs.get(utxoId);
    if (!utxo) {
      console.error(`❌ UTXO ${utxoId} not found for recovery`);
      return false;
    }

    if (!this.currentAccount || utxo.owner.toLowerCase() !== this.currentAccount.address.toLowerCase()) {
      console.error(`❌ Cannot recover UTXO ${utxoId}: not owned by current user`);
      return false;
    }

    if (!utxo.isSpent) {
      console.log(`⚠️ UTXO ${utxoId} is already unspent, no recovery needed`);
      return true;
    }

    // Mark as unspent and add recovery information
    utxo.isSpent = false;
    utxo.recovered = true;
    utxo.recoveryReason = reason;
    utxo.usable = true;

    // Update in localStorage too
    const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
    PrivateUTXOStorage.savePrivateUTXO(this.currentAccount.address, utxo);

    console.log(`✅ UTXO ${utxoId} recovered successfully. Reason: ${reason}`);
    this.emit('private:utxo:recovered', { utxoId, reason });
    
    return true;
  }

  /**
   * Batch recover multiple UTXOs
   */
  async recoverMultipleUTXOs(utxoIds: string[], reason: string = 'Batch recovery'): Promise<{ recovered: string[], failed: string[] }> {
    const recovered: string[] = [];
    const failed: string[] = [];

    for (const utxoId of utxoIds) {
      try {
        const success = await this.recoverUTXO(utxoId, reason);
        if (success) {
          recovered.push(utxoId);
        } else {
          failed.push(utxoId);
        }
      } catch (error) {
        console.error(`❌ Failed to recover UTXO ${utxoId}:`, error);
        failed.push(utxoId);
      }
    }

    console.log(`🔄 Batch recovery completed: ${recovered.length} recovered, ${failed.length} failed`);
    
    return { recovered, failed };
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
      utxo.owner && utxo.owner.toLowerCase() === ownerAddress.toLowerCase()
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
          
          // Emit wallet:connected event with account data
          console.log('🔌 Emitting wallet:connected event with account:', this.currentAccount);
          this.emit('wallet:connected', this.currentAccount);
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
    const wasConnected = this.currentAccount !== null;
    this.currentAccount = null;
    EthereumHelpers.disconnectWallet();
    
    // Emit wallet:disconnected event if wallet was connected
    if (wasConnected) {
      console.log('🔌 Emitting wallet:disconnected event');
      this.emit('wallet:disconnected');
    }
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
    const allUserUTXOs = this.getAllUserUTXOs();
    const unspentUTXOs = allUserUTXOs.filter(utxo => !utxo.isSpent);
    const spentUTXOs = allUserUTXOs.filter(utxo => utxo.isSpent);
    const recoveredUTXOs = allUserUTXOs.filter(utxo => utxo.recovered);
    
    // Calculate total balance from unspent UTXOs
    const totalBalance = unspentUTXOs.reduce((sum, utxo) => sum + utxo.value, BigInt(0));
    
    return {
      totalUTXOs: allUserUTXOs.length,
      unspentUTXOs: unspentUTXOs.length,
      spentUTXOs: spentUTXOs.length,
      recoveredUTXOs: recoveredUTXOs.length,
      uniqueTokens: 0, // TODO: Calculate unique tokens
      totalBalance,
      privateUTXOs: allUserUTXOs.length,
      confirmedUTXOs: allUserUTXOs.filter(utxo => utxo.confirmed).length,
      balanceByToken: {}, // TODO: Calculate balance by token
      averageUTXOValue: unspentUTXOs.length > 0 ? totalBalance / BigInt(unspentUTXOs.length) : BigInt(0),
      creationDistribution: [], // TODO: Calculate creation distribution
      bn254UTXOs: allUserUTXOs.length,
      bn254Operations: this.bn254OperationCount,
      cryptographyDistribution: {
        BN254: allUserUTXOs.length,
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

  /**
   * Debug UTXO state - show detailed information about all UTXOs
   */
  debugUTXOState(): void {
    if (!this.currentAccount) {
      console.log('⚠️ No account connected - cannot debug UTXO state');
      return;
    }

    const allUserUTXOs = this.getAllUserUTXOs();
    const unspentUTXOs = this.getPrivateUTXOs();
    const spentUTXOs = this.getSpentUTXOs();

    console.log('🔍 === UTXO STATE DEBUG ===');
    console.log(`👤 User: ${this.currentAccount.address}`);
    console.log(`📊 Total UTXOs: ${allUserUTXOs.length}`);
    console.log(`✅ Available UTXOs: ${unspentUTXOs.length}`);
    console.log(`❌ Spent UTXOs: ${spentUTXOs.length}`);
    
    console.log('\n📋 Available UTXOs:');
    unspentUTXOs.forEach(utxo => {
      console.log(`  - ${utxo.id}: ${utxo.value.toString()} ${utxo.recovered ? '(recovered)' : ''}`);
    });
    
    console.log('\n📋 Spent UTXOs:');
    spentUTXOs.forEach(utxo => {
      console.log(`  - ${utxo.id}: ${utxo.value.toString()} (spent) ${utxo.recovered ? '(recovered)' : ''}`);
    });
    
    console.log('🔍 === END DEBUG ===\n');
  }

  /**
   * Find UTXO by ID (including spent ones)
   */
  findUTXO(utxoId: string): PrivateUTXO | undefined {
    return this.privateUTXOs.get(utxoId);
  }

  /**
   * Check if UTXO belongs to current user
   */
  isUserUTXO(utxoId: string): boolean {
    const utxo = this.findUTXO(utxoId);
    return !!(utxo && this.currentAccount && 
      utxo.owner.toLowerCase() === this.currentAccount.address.toLowerCase());
  }
}

// Export singleton instance
export const privateUTXOManager = new PrivateUTXOManager();
export default privateUTXOManager;
