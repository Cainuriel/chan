/**
 * @fileoverview ZK-PrivateUTXOManager - Manager with ZK privacy enhancements
 * @description Implements true ZK privacy using ultra-simplified contracts and backend attestations
 */

import { ethers, toBigInt, type BigNumberish } from 'ethers';
import { ZKCompatibilityAdapter } from './ZKCompatibilityAdapter';
import { ZKCryptoServiceImpl } from './ZKCryptoService';
import { AttestationService } from './AttestationService';
import { EthereumHelpers } from './../utils/ethereum.helpers';
import { CryptoHelpers } from './../utils/crypto.helpers';
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
 * ZKPrivateUTXOManager - Manager with ZK privacy enhancements
 * Uses ZK compatibility adapter and simplified contract architecture
 */
export class ZKPrivateUTXOManager extends EventEmitter {
  // ZK Services
  private zkAdapter: ZKCompatibilityAdapter | null = null;
  private zkCryptoService: ZKCryptoServiceImpl | null = null;
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
   * Initialize the manager and ZK services
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

      // Initialize ZK services with contract and signer
      this.zkCryptoService = ZKCryptoServiceImpl.getInstance();
      await this.zkCryptoService.initialize();
      
      this.zkAdapter = new ZKCompatibilityAdapter(this.contract as any);
      await this.zkAdapter.initialize();
      
      // Initialize attestation service with contract
      this.attestationService = new AttestationService(this.contract as any);
      console.log('✅ ZK services fully initialized with secure cryptography');
      
      // Load existing UTXOs from localStorage for the current user
      await this.loadUTXOsFromStorage();
      
      this.isInitialized = true;
      console.log('✅ ZKPrivateUTXOManager initialized successfully with ZK privacy');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize ZKPrivateUTXOManager:', error);
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
   * Create a private UTXO using ZK adapter
   */
  async createPrivateUTXO(params: CreateUTXOParams): Promise<UTXOOperationResult> {
    if (!this.isInitialized || !this.contract || !this.zkAdapter) {
      throw new UTXOOperationError('Manager not initialized', 'createPrivateUTXO');
    }

    try {
      console.log('🔄 Creating private UTXO with ZK privacy...');
      
      // Use ZK compatibility adapter for deposit
      const zkResult = await this.zkAdapter.createPrivateUTXO(
        params.amount.toString(),
        this.currentAccount.address,
        params.tokenAddress || ethers.ZeroAddress
      );
      
      // Convert ZK result to UTXOOperationResult
      const result: UTXOOperationResult = {
        success: true,
        transactionHash: undefined, // ZK operations are off-chain initially
        createdUTXOIds: [zkResult.utxoData.id],
        error: undefined
      };
      
      // Save UTXO using internal save logic
      const utxoData = zkResult.utxoData;
      console.log('💾 Saving ZK UTXO to manager:', utxoData.id);
      
      // Save to internal collection
      this.privateUTXOs.set(utxoData.id, utxoData);
      console.log('✅ ZK UTXO saved to manager internal collection');
      
      // ALSO save to localStorage using PrivateUTXOStorage
      const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
      PrivateUTXOStorage.savePrivateUTXO(this.currentAccount.address, utxoData);
      console.log('✅ ZK UTXO also saved to localStorage');
      
      return result;
    } catch (error) {
      console.error('❌ Failed to create private UTXO with ZK:', error);
      throw new UTXOOperationError(`Failed to create private UTXO: ${error}`, 'createPrivateUTXO');
    }
  }

  /**
   * Split a private UTXO using ZK adapter
   */
  async splitPrivateUTXO(params: SplitUTXOParams): Promise<UTXOOperationResult> {
    if (!this.isInitialized || !this.contract || !this.zkAdapter) {
      throw new UTXOOperationError('ZK Manager not initialized', 'splitPrivateUTXO');
    }

    try {
      console.log('🔄 Splitting private UTXO with ZK privacy...');
      
      // Find and validate input UTXO (same validation logic as before)
      let inputUTXO = this.privateUTXOs.get(params.inputUTXOId);
      
      if (!inputUTXO) {
        console.log('⚠️ UTXO not found in internal collection, checking localStorage...');
        
        if (this.currentAccount) {
          const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
          const allStoredUTXOs = PrivateUTXOStorage.getAllUserUTXOs(this.currentAccount.address);
          
          const foundUTXO = allStoredUTXOs.all.find(utxo => utxo.id === params.inputUTXOId);
          
          if (foundUTXO) {
            console.log('✅ Found UTXO in localStorage, adding to internal collection');
            
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
          }
        }
      }
      
      if (!inputUTXO) {
        throw new UTXONotFoundError(params.inputUTXOId);
      }
      
      if (inputUTXO.isSpent) {
        throw new UTXOAlreadySpentError(params.inputUTXOId);
      }
      
      console.log('✅ Found UTXO for ZK split:', {
        id: inputUTXO.id,
        value: inputUTXO.value.toString(),
        isSpent: inputUTXO.isSpent,
        owner: inputUTXO.owner
      });

      // Use ZK compatibility adapter for split
      const privateKey = await this.getPrivateKeyFromEnv();
      const zkResult = await this.zkAdapter.splitPrivateUTXO(
        params.inputUTXOId,
        inputUTXO.value,
        inputUTXO.blindingFactor,
        params.outputValues,
        privateKey
      );
      
      // Convert ZK result to UTXOOperationResult
      const result: UTXOOperationResult = {
        success: true,
        transactionHash: undefined, // ZK operations are off-chain initially
        createdUTXOIds: zkResult.outputUTXOs.map((utxo: any) => utxo.id),
        error: undefined
      };

      // Save output UTXOs and mark input as spent
      for (const outputUTXO of zkResult.outputUTXOs) {
        console.log('💾 Saving split ZK UTXO to manager:', outputUTXO.id);
        
        // Save to internal collection
        this.privateUTXOs.set(outputUTXO.id, outputUTXO);
        
        // Save to localStorage
        const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
        PrivateUTXOStorage.savePrivateUTXO(outputUTXO.owner, outputUTXO);
        console.log('✅ Split ZK UTXO saved');
      }

      // Mark input UTXO as spent
      inputUTXO.isSpent = true;
      const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
      PrivateUTXOStorage.savePrivateUTXO(this.currentAccount?.address || '', inputUTXO);
      
      this.emit('private:utxo:spent', params.inputUTXOId);
      this.emit('private:utxo:split', { 
        input: params.inputUTXOId, 
        outputs: result.createdUTXOIds || [] 
      });
      
      console.log('🎉 ZK Split operation completed successfully');
      
      return result;
      
    } catch (error) {
      console.error('❌ Failed to split private UTXO with ZK:', error);
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
   * Withdraw a private UTXO to public tokens using ZK adapter
   */
  async withdrawPrivateUTXO(params: WithdrawUTXOParams): Promise<UTXOOperationResult> {
    console.log('🔄 Starting ZK withdraw operation in ManagerUTXO...');
    console.log('📋 Withdraw params:', {
      utxoId: params.utxoId,
      recipient: params.recipient
    });

    try {
      // 1. Validaciones básicas
      if (!this.currentAccount) {
        throw new UTXOOperationError('No hay cuenta conectada', 'withdrawPrivateUTXO');
      }

      if (!this.contract || !this.zkAdapter) {
        throw new UTXOOperationError('ZK Manager no inicializado', 'withdrawPrivateUTXO');
      }

      // 2. Buscar el UTXO a retirar
      const sourceUTXO = this.privateUTXOs.get(params.utxoId);
      if (!sourceUTXO) {
        throw new UTXONotFoundError(`UTXO ${params.utxoId} no encontrado`);
      }

      if (sourceUTXO.isSpent) {
        throw new UTXOAlreadySpentError(`UTXO ${params.utxoId} ya gastado`);
      }

      // 3. Verificar ownership
      if (!sourceUTXO.owner || sourceUTXO.owner.toLowerCase() !== this.currentAccount.address.toLowerCase()) {
        throw new UTXOOperationError(
          `UTXO ${params.utxoId} no pertenece a la cuenta actual`, 
          'withdrawPrivateUTXO'
        );
      }

      console.log('✅ Source UTXO found and validated for ZK withdraw:', {
        id: sourceUTXO.id,
        amount: sourceUTXO.value.toString(),
        owner: sourceUTXO.owner,
        tokenAddress: sourceUTXO.tokenAddress
      });

      // 4. Use ZK compatibility adapter for withdraw (method needs implementation)
      console.log('🚀 Executing ZK withdraw operation...');
      
      if (!this.attestationService) {
        throw new UTXOOperationError('Attestation service not initialized', 'withdrawPrivateUTXO');
      }
      
      // Create ZK withdraw data
      const zkWithdrawData = {
        sourceUTXOId: params.utxoId,
        nullifier: sourceUTXO.nullifierHash,
        amount: sourceUTXO.value,
        tokenAddress: sourceUTXO.tokenAddress,
        recipient: params.recipient
      };
      
      // Create withdraw attestation using ZK service
      const attestation = await this.attestationService.createZKWithdrawAttestation(zkWithdrawData);
      
      // Execute withdraw on contract (using ZK contract method)
      const tx = await (this.contract as any).zkWithdraw(
        sourceUTXO.nullifierHash,
        sourceUTXO.value,
        sourceUTXO.tokenAddress,
        params.recipient,
        attestation.signature,
        attestation.timestamp
      );
      
      const receipt = await tx.wait();
      
      const result: UTXOOperationResult = {
        success: true,
        transactionHash: receipt.hash,
        createdUTXOIds: [],
        error: undefined
      };

      if (result.success) {
        // 5. Marcar UTXO como gastado
        sourceUTXO.isSpent = true;
        console.log(`✅ UTXO ${params.utxoId} marked as spent`);

        // Update in localStorage
        const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
        PrivateUTXOStorage.savePrivateUTXO(this.currentAccount.address, sourceUTXO);

        // 6. Emitir evento
        this.emit('utxoWithdrawn', {
          utxoId: params.utxoId,
          recipient: params.recipient,
          amount: sourceUTXO.value,
          transactionHash: result.transactionHash
        });

        console.log('🎉 ZK Withdraw operation completed successfully!');
      }

      return result;

    } catch (error: any) {
      console.error('❌ Error in ZK withdrawPrivateUTXO:', error);
      
      // Re-throw specific UTXO errors
      if (error instanceof UTXOOperationError || 
          error instanceof UTXONotFoundError || 
          error instanceof UTXOAlreadySpentError) {
        throw error;
      }
      
      // Wrap other errors
      throw new UTXOOperationError(
        `ZK Withdraw failed: ${error.message}`, 
        'withdrawPrivateUTXO', 
        error
      );
    }
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
   * Get ALL private UTXOs for owner (including spent ones)
   */
  getAllPrivateUTXOsByOwner(ownerAddress: string): PrivateUTXO[] {
    console.log('🔍 getAllPrivateUTXOsByOwner called with:', ownerAddress);
    
    const allUTXOs = Array.from(this.privateUTXOs.values());
    console.log('🔍 All UTXOs (including spent):', allUTXOs.length);
    
    const filteredUTXOs = allUTXOs.filter(utxo => {
      const hasOwner = utxo.owner;
      const matches = hasOwner && utxo.owner.toLowerCase() === ownerAddress.toLowerCase();
      console.log(`🔍 UTXO ${utxo.id.slice(0, 8)}... owner: ${utxo.owner || 'MISSING'} vs ${ownerAddress} spent: ${utxo.isSpent} = ${matches}`);
      return matches;
    });
    
    console.log('🔍 Filtered UTXOs (all) for owner:', filteredUTXOs.length);
    return filteredUTXOs;
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
    console.log('🔍 getPrivateUTXOsByOwner called with:', ownerAddress);
    
    const allUTXOs = this.getPrivateUTXOs();
    console.log('🔍 All available UTXOs (unspent):', allUTXOs.length);
    
    const filteredUTXOs = allUTXOs.filter(utxo => {
      const hasOwner = utxo.owner;
      const matches = hasOwner && utxo.owner.toLowerCase() === ownerAddress.toLowerCase();
      console.log(`🔍 UTXO ${utxo.id.slice(0, 8)}... owner: ${utxo.owner || 'MISSING'} vs ${ownerAddress} isSpent: ${utxo.isSpent} = ${matches}`);
      return matches;
    });
    
    console.log('🔍 Filtered available UTXOs for owner:', filteredUTXOs.length);
    return filteredUTXOs;
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
   * Get private key from environment using CryptoHelpers
   */
  private async getPrivateKeyFromEnv(): Promise<string> {
    return await CryptoHelpers.getPrivateKeyFromEnv();
  }

  /**
   * Generate secp256k1 ZK UTXO ID using ZK crypto service
   */
  private async generateSecp256k1UTXOId(amount: bigint, blindingFactor: string, owner: string): Promise<string> {
    if (!this.zkCryptoService) {
      throw new Error('ZK Crypto service not initialized');
    }
    
    const commitment = await this.zkCryptoService.generateCommitment(amount, blindingFactor);
    return ethers.keccak256(ethers.solidityPacked(
      ['string', 'string', 'address'],
      [commitment.x.toString(), commitment.y.toString(), owner]
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

  /**
   * DEBUG: Get all UTXOs and their nullifiers from localStorage
   */
  debugLocalNullifiers(): void {
    try {
      const allUTXOs = this.getAllPrivateUTXOsByOwner(this.currentAccount?.address || '');
      console.log('🔍 All UTXOs in localStorage:');
      allUTXOs.forEach((utxo, index) => {
        console.log(`  UTXO ${index + 1}:`, {
          id: utxo.id.slice(0, 12) + '...',
          nullifierHash: utxo.nullifierHash.slice(0, 12) + '...',
          isSpent: utxo.isSpent,
          value: utxo.value?.toString(),
          utxoType: utxo.utxoType
        });
      });
      
      // Check for duplicate nullifiers
      const nullifiers = allUTXOs.map(utxo => utxo.nullifierHash);
      const uniqueNullifiers = new Set(nullifiers);
      if (uniqueNullifiers.size !== nullifiers.length) {
        console.warn('⚠️ DUPLICATE NULLIFIERS FOUND!');
        const duplicates = nullifiers.filter((item, index) => nullifiers.indexOf(item) !== index);
        console.warn('Duplicate nullifiers:', duplicates);
      } else {
        console.log('✅ All nullifiers are unique in localStorage');
      }
    } catch (error) {
      console.error('❌ Error debugging local nullifiers:', error);
    }
  }
}

// Export singleton instance with ZK enhancements
export const zkPrivateUTXOManager = new ZKPrivateUTXOManager();

// Maintain backward compatibility
export const privateUTXOManager = zkPrivateUTXOManager;

export default zkPrivateUTXOManager;
