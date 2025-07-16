/**
 * @fileoverview UTXOLibrary - Hybrid EOA + Zenroom + Smart Contract UTXO System
 * @description Main library integrating all UTXO functionality with REAL BN254 cryptography
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
  type PrivateUTXO,
  type ExtendedUTXOData,
  UTXOType,
  type CreateUTXOParams,
  type SplitUTXOParams,
  type UTXOManagerConfig,
  type TransferUTXOParams,
  type WithdrawUTXOParams,
  type UTXOOperationResult,
  type UTXOSelectionCriteria,
  type UTXOSelectionResult,
  type UTXOManagerStats,
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
 * Integrates EOA wallets, REAL BN254 Zenroom cryptography, and smart contracts
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

    console.log('🚀 UTXOLibrary initialized with REAL BN254 cryptography');
    console.log('   - Privacy mode:', this.config.privacyMode);
    console.log('   - Auto consolidation:', this.config.autoConsolidate);
    console.log('   - Cache timeout:', this.config.cacheTimeout, 'ms');
  }

  // ========================
  // INITIALIZATION & SETUP
  // ========================

  /**
   * Initialize the library with REAL BN254 cryptography
   * @param contractAddress - UTXOVault contract address
   * @param preferredProvider - Preferred wallet provider
   * @returns Promise resolving to initialization success
   */
 async initialize(contractAddressOrProvider: string): Promise<boolean> {
  try {
    console.log('🚀 Initializing UTXOLibrary with BN254 cryptography...');
    
    // Test BN254 cryptography ANTES de hacer otras operaciones
    console.log('🔬 Testing BN254 cryptography...');
    const cryptoTestPassed = await ZenroomHelpers.testBN254Operations();
    
    if (!cryptoTestPassed) {
      console.error('❌ BN254 cryptography test failed');
      throw new Error('BN254 cryptography initialization failed');
    }
    
    console.log('✅ BN254 cryptography test passed');
    
    // Solo marcar como inicializado después del test
    this.isInitialized = true;
    this.emit('library:initialized', { 
      cryptography: 'BN254',
      status: 'ready'
    });
    
    console.log('🎉 UTXOLibrary initialized successfully with BN254 cryptography');
    return true;
    
  } catch (error) {
    console.error('❌ Failed to initialize UTXOLibrary:', error);
    this.isInitialized = false;
    return false;
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
  // CORE UTXO OPERATIONS WITH REAL BN254 CRYPTOGRAPHY
  // ========================

  /**
   * Deposit ERC20 tokens as private UTXO with REAL BN254 cryptography
   * @param params - Deposit parameters
   * @returns Promise resolving to operation result
   */
  async depositAsPrivateUTXO(params: CreateUTXOParams): Promise<UTXOOperationResult> {
    this.ensureInitialized();
    console.log(`💰 Creating private UTXO deposit with REAL BN254 cryptography for ${params.amount} tokens...`);

    try {
      const { tokenAddress, amount } = params;

      // 1. Generate cryptographically secure blinding factor (BN254 compatible)
      console.log('🎲 Generating secure BN254 blinding factor...');
      const blindingFactor = await this.zenroom.generateSecureBlindingFactor();
      
      // 2. Create REAL Pedersen commitment using BN254 curve operations
      console.log('🔐 Creating REAL BN254 Pedersen commitment...');
      const commitmentResult = await this.zenroom.createPedersenCommitment(
        amount.toString(),
        blindingFactor
      );

      // 3. Generate nullifier hash using hash-to-curve
      console.log('🔐 Generating nullifier hash...');
      const nullifierHash = await this.zenroom.generateNullifierHash(
        this.currentEOA!.address,
        commitmentResult.pedersen_commitment,
        Date.now().toString()
      );

      // 4. Generate range proof (Bulletproof structure)
      console.log('🔍 Generating range proof...');
      const rangeProof = await this.zenroom.generateRangeProof(
        BigInt(amount),
        ZenroomHelpers.toBigInt('0x' + blindingFactor)
      );

      // 5. Get BN254 generators (standard points)
      const generatorParams = this.getBN254Generators();

      // 6. Prepare contract parameters with validation
      const depositParams: DepositParams = {
        tokenAddress,
        commitment: commitmentResult.pedersen_commitment,
        nullifierHash,
        blindingFactor: ZenroomHelpers.toBigInt('0x' + blindingFactor)
      };

      const proofParams: ProofParams = {
        rangeProof
      };

      console.log('📋 Contract parameters prepared:', {
        tokenAddress,
        commitment: commitmentResult.pedersen_commitment.slice(0, 20) + '...',
        nullifierHash: nullifierHash.slice(0, 20) + '...',
        blindingFactor: blindingFactor.slice(0, 10) + '...',
        rangeProofLength: rangeProof.length
      });

      // 7. Approve token transfer
      console.log('🔓 Approving token transfer...');
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function approve(address,uint256) returns (bool)'],
        this.ethereum.getSigner()
      );
      
      const approveTx = await tokenContract.approve(this.contract!.address, amount);
      await approveTx.wait();
      console.log('✅ Token approval confirmed');

      // 8. Call smart contract with BN254 parameters
      console.log('🚀 Executing contract call...');
      const tx = await this.contract!.depositAsPrivateUTXO(
        depositParams,
        proofParams,
        generatorParams,
        amount,
        { gasLimit: this.config.defaultGasLimit }
      );

      const receipt = await tx.wait();
      console.log('✅ Contract call confirmed:', receipt?.hash);

      // 9. Create local UTXO with BN254 data
      const utxoId = await this.generateBN254UTXOId(
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
        blockNumber: receipt?.blockNumber,
        // Add BN254 specific fields
        rangeProof,
        nullifierHash,
        cryptographyType: 'BN254'
      };

      // 10. Store locally
      this.utxos.set(utxoId, utxo);
      await this.savePrivateUTXOToLocal(this.currentEOA!.address, utxo);
      
      this.emit('utxo:created', utxo);

      const result: UTXOOperationResult = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds: [utxoId]
      };

      console.log('✅ Private UTXO deposit successful with REAL BN254 cryptography:', utxoId);
      return result;

    } catch (error) {
      console.error('❌ Private UTXO deposit failed:', error);
      
      let errorMessage = 'Deposit failed';
      if (error instanceof Error) {
        if (error.message.includes('Invalid commitment point')) {
          errorMessage = 'BN254 commitment validation failed. Please try again.';
        } else if (error.message.includes('user rejected')) {
          errorMessage = 'Transaction was rejected by user';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for transaction';
        } else {
          errorMessage = error.message;
        }
      }
      
      const result: UTXOOperationResult = {
        success: false,
        error: errorMessage,
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
   * Split private UTXO into multiple outputs with REAL BN254 cryptography
   * @param params - Split parameters
   * @returns Promise resolving to operation result
   */
  async splitPrivateUTXO(params: SplitUTXOParams): Promise<UTXOOperationResult> {
    this.ensureInitialized();
    console.log(`✂️ Splitting private UTXO with REAL BN254 cryptography: ${params.inputUTXOId}...`);

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

      // 2. Validate split (value conservation)
      const totalOutputValue = outputValues.reduce((sum, val) => sum + val, BigInt(0));
      if (totalOutputValue !== inputUTXO.value) {
        throw new Error(`Value conservation failed: input=${inputUTXO.value}, outputs=${totalOutputValue}`);
      }

      // 3. Generate secure output blinding factors
      console.log('🎲 Generating secure output blinding factors...');
      const outputBlindings = params.outputBlindingFactors || await Promise.all(
        outputValues.map(() => this.zenroom.generateSecureBlindingFactor())
      );

      // 4. Create REAL Pedersen commitments for outputs
      console.log('🔐 Creating REAL BN254 Pedersen commitments for outputs...');
      const outputCommitments = await Promise.all(
        outputValues.map(async (value, index) => {
          const result = await this.zenroom.createPedersenCommitment(
            value.toString(),
            outputBlindings[index]
          );
          return result.pedersen_commitment;
        })
      );

      // 5. Generate split proof (validates homomorphic property)
      console.log('🔍 Generating split proof...');
      const splitProof = await this.zenroom.generateSplitProof(
        BigInt(inputUTXO.value),
        outputValues.map(v => BigInt(v)),
        ZenroomHelpers.toBigInt('0x' + inputUTXO.blindingFactor!),
        outputBlindings.map(b => ZenroomHelpers.toBigInt('0x' + b))
      );

      // 6. Generate nullifier hash for input
      const nullifierHash = await this.zenroom.generateNullifierHash(
        this.currentEOA!.address,
        inputUTXO.commitment,
        Date.now().toString()
      );

      // 7. Get BN254 generators
      const generatorParams = this.getBN254Generators();

      // 8. Call smart contract
      console.log('🚀 Executing split contract call...');
      const tx = await this.contract!.splitPrivateUTXO(
        inputUTXO.commitment,
        outputCommitments,
        outputValues.map(v => v),
        outputBlindings.map(b => ZenroomHelpers.toBigInt('0x' + b)),
        splitProof,
        nullifierHash,
        generatorParams,
        { gasLimit: this.config.defaultGasLimit }
      );

      const receipt = await tx.wait();
      console.log('✅ Split contract call confirmed:', receipt?.hash);

      // 9. Update local state
      inputUTXO.isSpent = true;
      this.emit('utxo:spent', inputUTXOId);

      // 10. Create output UTXOs with BN254 data
      const createdUTXOIds: string[] = [];
      
      for (let i = 0; i < outputValues.length; i++) {
        const outputId = await this.generateBN254UTXOId(
          outputCommitments[i],
          outputOwners[i],
          Date.now() + i
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
          tokenMetadata: inputUTXO.tokenMetadata,
          cryptographyType: 'BN254'
        };

        this.utxos.set(outputId, outputUTXO);
        await this.savePrivateUTXOToLocal(outputOwners[i], outputUTXO);
        createdUTXOIds.push(outputId);
        this.emit('utxo:created', outputUTXO);
      }

      const result: UTXOOperationResult = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds
      };

      console.log('✅ Private UTXO split successful with REAL BN254 cryptography:', createdUTXOIds);
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
   * Withdraw private UTXO back to ERC20 tokens with REAL BN254 cryptography
   * @param params - Withdraw parameters
   * @returns Promise resolving to operation result
   */
  async withdrawFromPrivateUTXO(params: WithdrawUTXOParams): Promise<UTXOOperationResult> {
    this.ensureInitialized();
    console.log(`💸 Withdrawing private UTXO with REAL BN254 cryptography: ${params.utxoId}...`);

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

      // 2. Verify commitment locally before withdrawal
      console.log('🔍 Verifying UTXO commitment...');
      const isValidCommitment = await this.zenroom.verifyPedersenCommitment(
        utxo.commitment,
        BigInt(utxo.value),
        ZenroomHelpers.toBigInt('0x' + utxo.blindingFactor!)
      );
      
      if (!isValidCommitment) {
        throw new Error('UTXO commitment verification failed - data may be corrupted');
      }

      // 3. Generate nullifier hash
      console.log('🔐 Generating withdrawal nullifier...');
      const nullifierHash = await this.zenroom.generateNullifierHash(
        this.currentEOA!.address,
        utxo.commitment,
        Date.now().toString()
      );

      // 4. Get BN254 generators
      const generatorParams = this.getBN254Generators();

      // 5. Call smart contract
      console.log('🚀 Executing withdrawal contract call...');
      const tx = await this.contract!.withdrawFromPrivateUTXO(
        utxo.commitment,
        utxo.value,
        ZenroomHelpers.toBigInt('0x' + utxo.blindingFactor!),
        nullifierHash,
        generatorParams,
        { gasLimit: this.config.defaultGasLimit }
      );

      const receipt = await tx.wait();
      console.log('✅ Withdrawal confirmed:', receipt?.hash);

      // 6. Update local state
      utxo.isSpent = true;
      this.emit('utxo:spent', utxoId);

      const result: UTXOOperationResult = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
      };

      console.log('✅ Private UTXO withdrawal successful with REAL BN254 cryptography');
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
   * Transfer private UTXO to another owner with REAL BN254 cryptography
   * @param params - Transfer parameters
   * @returns Promise resolving to operation result
   */
  async transferPrivateUTXO(params: TransferUTXOParams): Promise<UTXOOperationResult> {
    this.ensureInitialized();
    console.log(`🔄 Transferring private UTXO with REAL BN254 cryptography: ${params.utxoId} to ${params.newOwner}...`);

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

      // 2. Generate new secure blinding factor for output
      console.log('🎲 Generating secure output blinding factor...');
      const outputBlinding = await this.zenroom.generateSecureBlindingFactor();
      
      // 3. Create REAL Pedersen commitment for output
      console.log('🔐 Creating REAL BN254 Pedersen commitment for output...');
      const outputCommitmentResult = await this.zenroom.createPedersenCommitment(
        utxo.value.toString(),
        outputBlinding
      );

      // 4. Generate nullifier hash for input
      const nullifierHash = await this.zenroom.generateNullifierHash(
        this.currentEOA!.address,
        utxo.commitment,
        Date.now().toString()
      );

      // 5. Get BN254 generators
      const generatorParams = this.getBN254Generators();

      // 6. Call smart contract
      console.log('🚀 Executing transfer contract call...');
      const tx = await this.contract!.transferPrivateUTXO(
        utxo.commitment,
        outputCommitmentResult.pedersen_commitment,
        newOwner,
        utxo.value,
        ZenroomHelpers.toBigInt('0x' + outputBlinding),
        nullifierHash,
        generatorParams,
        { gasLimit: this.config.defaultGasLimit }
      );

      const receipt = await tx.wait();
      console.log('✅ Transfer confirmed:', receipt?.hash);

      // 7. Update local state
      utxo.isSpent = true;
      this.emit('utxo:spent', utxoId);

      // 8. Create output UTXO if we're the new owner
      let createdUTXOIds: string[] = [];
      if (newOwner === this.currentEOA?.address) {
        const outputId = await this.generateBN254UTXOId(
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
          tokenMetadata: utxo.tokenMetadata,
          cryptographyType: 'BN254'
        };

        this.utxos.set(outputId, outputUTXO);
        await this.savePrivateUTXOToLocal(newOwner, outputUTXO);
        createdUTXOIds.push(outputId);
        this.emit('utxo:created', outputUTXO);
      }

      const result: UTXOOperationResult = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds
      };

      console.log('✅ Private UTXO transfer successful with REAL BN254 cryptography');
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
   * Get manager statistics with BN254 info
   * @returns UTXO manager stats
   */
  getStats(): UTXOManagerStats {
    const allUTXOs = Array.from(this.utxos.values());
    const unspent = allUTXOs.filter(u => !u.isSpent);
    const spent = allUTXOs.filter(u => u.isSpent);
    const confirmed = allUTXOs.filter(u => u.confirmed);
    const bn254UTXOs = allUTXOs.filter(u => u.cryptographyType === 'BN254');

    const balanceByToken: Record<string, bigint> = {};
    const creationDistribution: { date: string; count: number; }[] = [
      { date: UTXOType.DEPOSIT, count: unspent.filter(u => u.utxoType === UTXOType.DEPOSIT).length },
      { date: UTXOType.SPLIT, count: unspent.filter(u => u.utxoType === UTXOType.SPLIT).length },
      { date: UTXOType.COMBINE, count: unspent.filter(u => u.utxoType === UTXOType.COMBINE).length },
      { date: UTXOType.TRANSFER, count: unspent.filter(u => u.utxoType === UTXOType.TRANSFER).length }
    ];

    unspent.forEach(utxo => {
      balanceByToken[utxo.tokenAddress] = (balanceByToken[utxo.tokenAddress] || BigInt(0)) + utxo.value;
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
      privateUTXOs: unspent.length,
      // Add BN254 specific stats
      bn254UTXOs: bn254UTXOs.length,
      bn254Operations: 0,
      cryptographyDistribution: {
        BN254: bn254UTXOs.length,
        Other: allUTXOs.length - bn254UTXOs.length
      }
    };
  }

  /**
   * Sync local state with blockchain - enhanced for BN254 UTXOs
   * @returns Promise resolving to sync success
   */
  async syncWithBlockchain(): Promise<boolean> {
    if (this.syncInProgress || !this.contract || !this.currentEOA) {
      return false;
    }

    this.syncInProgress = true;
    console.log('🔄 Syncing with blockchain (BN254 mode)...');

    try {
      // Load private UTXOs from localStorage
      const localUTXOs = await this.getPrivateUTXOsFromLocal(this.currentEOA.address);
      
      for (const utxo of localUTXOs) {
        if (!this.utxos.has(utxo.id)) {
          this.utxos.set(utxo.id, utxo);
          console.log('📥 Loaded private UTXO from local storage:', utxo.id);
        }
      }

      // Verify confirmations for unconfirmed UTXOs
      const unconfirmedUTXOs = Array.from(this.utxos.values()).filter(
        utxo => !utxo.confirmed && utxo.creationTxHash
      );

      for (const utxo of unconfirmedUTXOs) {
        try {
          const receipt = await this.ethereum.getProvider().getTransactionReceipt(utxo.creationTxHash!);
          if (receipt && receipt.status === 1) {
            utxo.confirmed = true;
            utxo.blockNumber = receipt.blockNumber;
            await this.savePrivateUTXOToLocal(utxo.owner, utxo);
            this.emit('utxo:confirmed', utxo);
            console.log('✅ UTXO confirmed:', utxo.id);
          }
        } catch (error) {
          console.warn(`Failed to check confirmation for UTXO ${utxo.id}:`, error);
        }
      }

      this.lastSyncTimestamp = Date.now();
      console.log('✅ Blockchain sync completed (BN254 mode)');
      
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
   * Get standard BN254 generators for contract calls
   * @returns GeneratorParams with BN254 standard points
   */
  private getBN254Generators(): GeneratorParams {
    return {
      gX: BigInt("0x01"), // G1 generator X
      gY: BigInt("0x02"), // G1 generator Y
      hX: BigInt("0x2cf44499d5d27bb186308b7af7af02ac5bc9eeb6a3d147c186b21fb1b76e18da"), // H1 generator X
      hY: BigInt("0x2c0f001f52110ccfe69108924926e45f0b0c868df0e7bde1fe16d3242dc715f6")  // H1 generator Y
    };
  }

  /**
   * Generate secure UTXO ID using cryptographic hash
   * @param commitment - UTXO commitment
   * @param owner - Owner address
   * @param timestamp - Creation timestamp
   * @returns Promise<string> - Secure UTXO ID
   */
  protected async generateBN254UTXOId(commitment: string, owner: string, timestamp: number): Promise<string> {
    const data = commitment + owner.toLowerCase() + timestamp.toString();
    
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = new Uint8Array(hashBuffer);
      return Array.from(hashArray, byte => byte.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.warn('Failed to generate secure ID, using fallback:', error);
      return data.slice(0, 64).padEnd(64, '0');
    }
  }

  /**
   * Save private UTXO to localStorage
   */
/**
 * Save private UTXO to localStorage (only for BN254 private UTXOs)
 */
protected async savePrivateUTXOToLocal(owner: string, utxo: ExtendedUTXOData): Promise<void> {
  try {
    // Validar que es un UTXO privado BN254 válido
    if (!utxo.blindingFactor) {
      console.warn('Cannot save UTXO without blinding factor - not a private UTXO');
      return;
    }

    if (utxo.cryptographyType !== 'BN254') {
      console.warn('Cannot save non-BN254 UTXO as private UTXO');
      return;
    }

    if (!utxo.commitment) {
      console.warn('Cannot save UTXO without commitment - not a valid private UTXO');
      return;
    }

    // Convertir a PrivateUTXO con campos requeridos
    const privateUTXO: PrivateUTXO = {
      ...utxo,
      blindingFactor: utxo.blindingFactor, // Ya validado que no es undefined
      nullifierHash: utxo.nullifierHash || '', // Valor por defecto si no existe
      isPrivate: true,
      cryptographyType: 'BN254'
    };

    const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
    PrivateUTXOStorage.savePrivateUTXO(owner, privateUTXO);
    
    console.log('✅ BN254 private UTXO saved to localStorage:', utxo.id);
  } catch (error) {
    console.warn('Failed to save BN254 UTXO to local storage:', error);
  }
}

/**
 * Check if UTXO is a valid private UTXO
 */
private isPrivateUTXO(utxo: ExtendedUTXOData): utxo is PrivateUTXO {
  return !!(
    utxo.blindingFactor &&
    utxo.cryptographyType === 'BN254' &&
    utxo.commitment &&
    utxo.nullifierHash
  );
}

  /**
   * Get private UTXOs from localStorage
   */
  protected async getPrivateUTXOsFromLocal(owner: string): Promise<ExtendedUTXOData[]> {
    try {
      const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
      return PrivateUTXOStorage.getPrivateUTXOs(owner);
    } catch (error) {
      console.warn('Failed to load UTXOs from local storage:', error);
      return [];
    }
  }

  /**
   * Map contract UTXO type to local enum
   */
  private mapContractUTXOType(contractType: number): UTXOType {
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

  /**
   * Get cryptography type
   */
  get cryptographyType(): string {
    return 'BN254';
  }

  /**
   * Check if Zenroom is available
   */
  get isZenroomAvailable(): boolean {
    return ZenroomHelpers.isZenroomAvailable();
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