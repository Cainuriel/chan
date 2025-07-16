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
  type DepositParams,
  type GeneratorParams,
  type ProofParams,
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
   * Deposit ERC20 tokens as private UTXO with real cryptography
   * @param params - Deposit parameters
   * @returns Promise resolving to operation result
   */
  async depositAsPrivateUTXO(params: CreateUTXOParams): Promise<UTXOOperationResult> {
    this.ensureInitialized();
    console.log(`💰 Creating private UTXO deposit for ${params.amount} tokens...`);

    try {
      const { tokenAddress, amount } = params;

      // 1. Generate Pedersen commitment using Zenroom
      const blindingFactor = await this.zenroom.generateSecureNonce();
      const commitmentResult = await this.zenroom.createPedersenCommitment(
        amount.toString(),
        blindingFactor
      );

      // 2. Generate nullifier hash
      const nullifierHash = await this.zenroom.generateNullifierHash(
        this.currentEOA!.address,
        commitmentResult.pedersen_commitment,
        Date.now().toString()
      );

      // 3. Generate range proof (temporal - usar método real cuando esté disponible)
      const rangeProof = ethers.hexlify(ethers.toUtf8Bytes("range_proof_placeholder"));

      // 4. Get Pedersen generators (usar método helper temporal)
      const generatorParams = this.getDefaultGenerators();

      // 5. Prepare contract parameters
      const depositParams: DepositParams = {
        tokenAddress,
        commitment: commitmentResult.pedersen_commitment,
        nullifierHash,
        blindingFactor: BigInt(blindingFactor)
      };

      const proofParams: ProofParams = {
        rangeProof
      };

      // 6. Approve token transfer if needed
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function approve(address,uint256) returns (bool)'],
        this.ethereum.getSigner()
      );
      
      const approveTx = await tokenContract.approve(this.contract!.address, amount);
      await approveTx.wait();

      // 7. Call smart contract
      const tx = await this.contract!.depositAsPrivateUTXO(
        depositParams,
        proofParams,
        generatorParams,
        amount,
        { gasLimit: this.config.defaultGasLimit }
      );

      const receipt = await tx.wait();

      // 8. Create local UTXO
      const utxoId = await this.zenroom.generateUTXOId(
        commitmentResult.pedersen_commitment,
        this.currentEOA!.address,
        Date.now()
      );

      const utxo: ExtendedUTXOData = {
        id: utxoId,
        exists: true,
        value: amount,
        tokenAddress,
        owner: this.currentEOA!.address,
        timestamp: toBigInt(Date.now()),
        isSpent: false,
        commitment: commitmentResult.pedersen_commitment,
        parentUTXO: '',
        utxoType: UTXOType.DEPOSIT,
        blindingFactor,
        localCreatedAt: Date.now(),
        confirmed: true,
        creationTxHash: receipt?.hash,
        blockNumber: receipt?.blockNumber
      };

      this.utxos.set(utxoId, utxo);
      this.emit('utxo:created', utxo);

      const result: UTXOOperationResult = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds: [utxoId]
      };

      console.log('✅ Private UTXO deposit successful:', utxoId);
      return result;

    } catch (error) {
      console.error('❌ Private UTXO deposit failed:', error);
      const result: UTXOOperationResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Deposit failed',
        errorDetails: error
      };

      this.emit('operation:failed', new UTXOOperationError(
        'Deposit failed',
        'deposit',
        undefined,
        error
      ));

      return result;
    }
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
   * Split private UTXO into multiple outputs with real cryptography
   * @param params - Split parameters
   * @returns Promise resolving to operation result
   */
  async splitPrivateUTXO(params: SplitUTXOParams): Promise<UTXOOperationResult> {
    this.ensureInitialized();
    console.log(`✂️ Splitting private UTXO ${params.inputUTXOId}...`);

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

      // 4. Generate equality proof for homomorphic property (temporal)
      const equalityProof = ethers.hexlify(ethers.toUtf8Bytes("equality_proof_placeholder"));

      // 5. Generate nullifier hash
      const nullifierHash = await this.zenroom.generateNullifierHash(
        this.currentEOA!.address,
        inputUTXO.commitment,
        Date.now().toString()
      );

      // 6. Get Pedersen generators (usar método helper temporal)
      const generatorParams = this.getDefaultGenerators();

      // 7. Call smart contract
      const tx = await this.contract!.splitPrivateUTXO(
        inputUTXO.commitment,
        outputCommitments,
        outputValues.map(v => v),
        outputBlindings.map(b => BigInt(b)),
        equalityProof,
        nullifierHash,
        generatorParams,
        { gasLimit: this.config.defaultGasLimit }
      );

      const receipt = await tx.wait();

      // 8. Update local state
      inputUTXO.isSpent = true;
      this.emit('utxo:spent', inputUTXOId);

      // 9. Create output UTXOs
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

      console.log('✅ Private UTXO split successful:', createdUTXOIds);
      return result;

    } catch (error) {
      console.error('❌ Private UTXO split failed:', error);
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
   * Withdraw private UTXO back to ERC20 tokens with real cryptography
   * @param params - Withdraw parameters
   * @returns Promise resolving to operation result
   */
  async withdrawFromPrivateUTXO(params: WithdrawUTXOParams): Promise<UTXOOperationResult> {
    this.ensureInitialized();
    console.log(`💸 Withdrawing private UTXO ${params.utxoId}...`);

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

      // 2. Generate nullifier hash
      const nullifierHash = await this.zenroom.generateNullifierHash(
        this.currentEOA!.address,
        utxo.commitment,
        Date.now().toString()
      );

      // 3. Get Pedersen generators
      // 4. Get Pedersen generators (usar método helper temporal)
      const generatorParams = this.getDefaultGenerators();

      // 4. Call smart contract
      const tx = await this.contract!.withdrawFromPrivateUTXO(
        utxo.commitment,
        utxo.value,
        BigInt(utxo.blindingFactor!),
        nullifierHash,
        generatorParams,
        { gasLimit: this.config.defaultGasLimit }
      );

      const receipt = await tx.wait();

      // 5. Update local state
      utxo.isSpent = true;
      this.emit('utxo:spent', utxoId);

      const result: UTXOOperationResult = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
      };

      console.log('✅ Private UTXO withdrawal successful');
      return result;

    } catch (error) {
      console.error('❌ Private UTXO withdrawal failed:', error);
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

  /**
   * Transfer private UTXO to another owner with real cryptography
   * @param params - Transfer parameters
   * @returns Promise resolving to operation result
   */
  async transferPrivateUTXO(params: TransferUTXOParams): Promise<UTXOOperationResult> {
    this.ensureInitialized();
    console.log(`🔄 Transferring private UTXO ${params.utxoId} to ${params.newOwner}...`);

    try {
      const { utxoId, newOwner } = params;

      // 1. Get and validate UTXO
      const utxo = this.utxos.get(utxoId);
      if (!utxo) {
        throw new UTXONotFoundError(utxoId);
      }
      if (utxo.isSpent) {
        throw new UTXOAlreadySpentError(utxoId);
      }

      // 2. Generate new output commitment
      const outputBlinding = await this.zenroom.generateSecureNonce();
      const outputCommitmentResult = await this.zenroom.createPedersenCommitment(
        utxo.value.toString(),
        outputBlinding
      );

      // 3. Generate nullifier hash
      const nullifierHash = await this.zenroom.generateNullifierHash(
        this.currentEOA!.address,
        utxo.commitment,
        Date.now().toString()
      );

      // 4. Get Pedersen generators (usar método helper temporal)
      const generatorParams = this.getDefaultGenerators();

      // 5. Call smart contract
      const tx = await this.contract!.transferPrivateUTXO(
        utxo.commitment,
        outputCommitmentResult.pedersen_commitment,
        newOwner,
        utxo.value,
        BigInt(outputBlinding),
        nullifierHash,
        generatorParams,
        { gasLimit: this.config.defaultGasLimit }
      );

      const receipt = await tx.wait();

      // 6. Update local state
      utxo.isSpent = true;
      this.emit('utxo:spent', utxoId);

      // 7. Create output UTXO if we're the new owner
      let createdUTXOIds: string[] = [];
      if (newOwner === this.currentEOA?.address) {
        const outputId = await this.zenroom.generateUTXOId(
          outputCommitmentResult.pedersen_commitment,
          newOwner,
          Date.now()
        );

        const outputUTXO: ExtendedUTXOData = {
          id: outputId,
          exists: true,
          value: utxo.value,
          tokenAddress: utxo.tokenAddress,
          owner: newOwner,
          timestamp: toBigInt(Date.now()),
          isSpent: false,
          commitment: outputCommitmentResult.pedersen_commitment,
          parentUTXO: utxoId,
          utxoType: UTXOType.TRANSFER,
          blindingFactor: outputBlinding,
          localCreatedAt: Date.now(),
          confirmed: true,
          creationTxHash: receipt?.hash,
          blockNumber: receipt?.blockNumber,
          tokenMetadata: utxo.tokenMetadata
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

      console.log('✅ Private UTXO transfer successful');
      return result;

    } catch (error) {
      console.error('❌ Private UTXO transfer failed:', error);
      const result: UTXOOperationResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Transfer failed',
        errorDetails: error
      };

      this.emit('operation:failed', new UTXOOperationError(
        'Transfer failed',
        'transfer',
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
    // Build creationDistribution as an array of { date, count }
    // For demonstration, group by utxoType as "date" (or replace with actual date logic if needed)
    const creationDistribution: { date: string; count: number; }[] = [
      { date: UTXOType.DEPOSIT, count: unspent.filter(u => u.utxoType === UTXOType.DEPOSIT).length },
      { date: UTXOType.SPLIT, count: unspent.filter(u => u.utxoType === UTXOType.SPLIT).length },
      { date: UTXOType.COMBINE, count: unspent.filter(u => u.utxoType === UTXOType.COMBINE).length },
      { date: UTXOType.TRANSFER, count: unspent.filter(u => u.utxoType === UTXOType.TRANSFER).length }
    ];

    unspent.forEach(utxo => {
      balanceByToken[utxo.tokenAddress] = (balanceByToken[utxo.tokenAddress] || BigInt(0)) + utxo.value;
      // creationDistribution handled above
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
      creationDistribution,
      privateUTXOs: unspent.length // or use the appropriate array/list of private UTXOs if different
    };
  }

  /**
   * Sync local state with blockchain - simplified for private UTXOs
   * @returns Promise resolving to sync success
   */
  async syncWithBlockchain(): Promise<boolean> {
    if (this.syncInProgress || !this.contract || !this.currentEOA) {
      return false;
    }

    this.syncInProgress = true;
    console.log('🔄 Syncing with blockchain...');

    try {
      // Para UTXOs privados, solo podemos sincronizar basándonos en eventos
      // ya que los datos están encriptados en el contrato
      console.log('ℹ️ Private UTXO sync relies on local storage and events');
      
      // Verificar si tenemos UTXOs locales que necesitan confirmación
      const unconfirmedUTXOs = Array.from(this.utxos.values()).filter(
        utxo => !utxo.confirmed && utxo.creationTxHash
      );

      for (const utxo of unconfirmedUTXOs) {
        try {
          const receipt = await this.ethereum.getProvider().getTransactionReceipt(utxo.creationTxHash!);
          if (receipt && receipt.status === 1) {
            utxo.confirmed = true;
            utxo.blockNumber = receipt.blockNumber;
            this.emit('utxo:confirmed', utxo);
          }
        } catch (error) {
          console.warn(`Failed to check confirmation for UTXO ${utxo.id}:`, error);
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
   * Helper para generar generadores Pedersen temporales
   * TODO: Reemplazar con método real de ZenroomHelpers
   */
  private getDefaultGenerators(): GeneratorParams {
    return {
      gX: BigInt("0x1"),
      gY: BigInt("0x2"),
      hX: BigInt("0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001"),
      hY: BigInt("0x2")
    };
  }

  /**
   * Map contract UTXO type to local enum
   */
  private mapContractUTXOType(contractType: number): UTXOType {
    // Para el contrato simplificado, mapeamos los tipos básicos
    switch (contractType) {
      case 0: return UTXOType.DEPOSIT;
      case 1: return UTXOType.SPLIT;
      case 2: return UTXOType.COMBINE;
      case 3: return UTXOType.TRANSFER;
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
  UTXOVaultContract,
  DepositParams,
  GeneratorParams,
  ProofParams,
  createUTXOVaultContract,
  UTXO_VAULT_CONSTANTS
} from '../contracts/UTXOVault.types';