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

  createZKUTXOVaultContract,
  type ZKUTXOVaultContract
} from '../contracts/ZKUTXOVault.types';

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
  protected contract: ZKUTXOVaultContract | null = null;
  protected currentAccount: any | null = null;
  protected utxos: Map<string, ExtendedUTXOData> = new Map();
  
  // State management
  private privateUTXOs: Map<string, PrivateUTXO> = new Map();
  private secp256k1OperationCount: number = 0; // ✅ Real secp256k1 operations counter
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
    
    console.log('🔐 PrivateUTXOManager (refactored) initialized with REAL secp256k1 cryptography only');
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
      this.contract = await createZKUTXOVaultContract(contractAddressOrProvider, signer);
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
      const storedUTXOs = await PrivateUTXOStorage.getPrivateUTXOs(this.currentAccount.address);
      
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
   * Create a private UTXO using REAL secp256k1 ZK cryptography
   */
  async createPrivateUTXO(params: CreateUTXOParams): Promise<UTXOOperationResult> {
    if (!this.isInitialized || !this.contract || !this.currentAccount) {
      throw new UTXOOperationError('Manager not initialized', 'createPrivateUTXO');
    }

    try {
      console.log('🔄 Creating private UTXO with REAL secp256k1 ZK privacy...');
      
      // Use DepositAsPrivateUTXO service with real cryptography
      const { depositAsPrivateUTXOSimplified } = await import('./DepositAsPrivateUTXO');
      
      const result = await depositAsPrivateUTXOSimplified(
        params,
        this.contract,
        this.currentAccount,
        EthereumHelpers, // ethereum helper
        this.utxos,
        async (address: string, utxo: any) => {
          // Save using PrivateUTXOStorage
          const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
          await PrivateUTXOStorage.savePrivateUTXO(address, utxo);
        },
        (event: string, data: any) => this.emit(event, data)
      );
      
      if (result.success && result.createdUTXOIds) {
        // Load the created UTXO into manager
        const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
        const savedUTXOs = await PrivateUTXOStorage.getPrivateUTXOs(this.currentAccount.address);
        
        for (const utxoId of result.createdUTXOIds) {
          const savedUTXO = savedUTXOs.find(u => u.id === utxoId);
          if (savedUTXO) {
            this.privateUTXOs.set(utxoId, savedUTXO);
            this.secp256k1OperationCount++; // ✅ INCREMENT secp256k1 operations
          }
        }
      }
      
      console.log('✅ secp256k1 ZK UTXO created successfully');
      return result;
      
    } catch (error) {
      console.error('❌ Failed to create private UTXO with secp256k1 ZK:', error);
      throw new UTXOOperationError(`Failed to create private UTXO: ${error}`, 'createPrivateUTXO');
    }
  }

  /**
   * Split a private UTXO using REAL secp256k1 ZK cryptography with CONTRACT CONFIRMATION
   */
  async splitPrivateUTXO(params: SplitUTXOParams): Promise<UTXOOperationResult> {
    if (!this.isInitialized || !this.contract || !this.currentAccount) {
      throw new UTXOOperationError('ZK Manager not initialized', 'splitPrivateUTXO');
    }

    try {
      console.log('🔄 Starting REAL secp256k1 ZK split with CONTRACT CONFIRMATION...');
      
      // 1. Find and validate input UTXO
      let inputUTXO = this.privateUTXOs.get(params.inputUTXOId);
      
      if (!inputUTXO) {
        console.log('⚠️ UTXO not found in internal collection, checking localStorage...');
        
        if (this.currentAccount) {
          const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
          const allStoredUTXOs = await PrivateUTXOStorage.getAllUserUTXOs(this.currentAccount.address);
          
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
      
      // 2. Validate outputOwners
      if (!params.outputOwners || params.outputOwners.length !== params.outputValues.length) {
        throw new UTXOOperationError(
          `outputOwners must be provided and match outputValues length. Got ${params.outputOwners?.length || 0} owners for ${params.outputValues.length} outputs`,
          'splitPrivateUTXO'
        );
      }
      
      // Validate owner addresses
      for (let i = 0; i < params.outputOwners.length; i++) {
        const owner = params.outputOwners[i];
        if (!owner || !ethers.isAddress(owner)) {
          throw new UTXOOperationError(
            `Invalid owner address at index ${i}: "${owner}". Must be a valid Ethereum address.`,
            'splitPrivateUTXO'
          );
        }
      }
      
      console.log('✅ Input UTXO and parameters validated:', {
        id: inputUTXO.id,
        value: inputUTXO.value.toString(),
        outputCount: params.outputValues.length,
        outputOwners: params.outputOwners
      });

      // 3. Use REAL SplitPrivateUTXO service
      const { SplitPrivateUTXO } = await import('./SplitPrivateUTXO');
      const signer = EthereumHelpers.getSigner();
      if (!signer) {
        throw new UTXOOperationError('No signer available', 'splitPrivateUTXO');
      }
      
      const splitService = new SplitPrivateUTXO(this.contract as any, signer);
      
      // 4. Create split data with REAL cryptography
      const splitData = {
        sourceCommitment: JSON.parse(inputUTXO.commitment),
        sourceValue: inputUTXO.value,
        sourceBlindingFactor: inputUTXO.blindingFactor,
        sourceNullifier: inputUTXO.nullifierHash,
        outputValues: params.outputValues,
        outputBlindingFactors: [], // Will be generated by service
        tokenAddress: inputUTXO.tokenAddress,
        sourceUTXOId: params.inputUTXOId
      };
      
      console.log('🔐 Split data created with REAL secp256k1 cryptography');
      
      // 5. Create attestation provider
      const attestationProvider = async (dataHash: string) => {
        if (!this.attestationService) {
          throw new Error('Attestation service not available');
        }
        
        // Create ZK split attestation with real backend service
        const zkSplitData = {
          sourceUTXOId: params.inputUTXOId,
          outputAmounts: params.outputValues,
          outputCommitments: [], // Will be filled by split service after cryptographic generation
          outputNullifiers: [], // Will be filled by split service after cryptographic generation
          outputBlindingFactors: [] // Will be filled by split service after cryptographic generation
        };
        
        const attestation = await this.attestationService.createZKSplitAttestation(zkSplitData);
        
        return {
          operation: attestation.operation,
          dataHash: attestation.dataHash,
          nonce: BigInt(attestation.nonce),
          timestamp: BigInt(attestation.timestamp),
          signature: attestation.signature
        };
      };
      
      // 6. Execute split with REAL contract interaction
      console.log('🚀 Executing REAL split with contract confirmation...');
      const splitResult = await splitService.executeSplit(splitData, attestationProvider);
      
      // 7. Convert to UTXOOperationResult
      const result: UTXOOperationResult = {
        success: splitResult.success,
        transactionHash: splitResult.transactionHash,
        createdUTXOIds: splitResult.outputUTXOIds || [],
        error: splitResult.error
      };
      
      // 8. ONLY save UTXOs if transaction was confirmed
      if (result.success && splitResult.outputUTXOIds && splitResult.outputUTXOIds.length > 0) {
        console.log('✅ Split transaction confirmed, creating and saving UTXOs...');
        
        // Create output UTXOs with REAL data from split service
        const outputUTXOs: PrivateUTXO[] = splitResult.outputUTXOIds.map((utxoId, index) => {
          return {
            id: utxoId,
            exists: true,
            value: params.outputValues[index],
            tokenAddress: inputUTXO.tokenAddress,
            owner: params.outputOwners[index], // ✅ USE CORRECT OWNER FROM PARAMS
            timestamp: BigInt(Math.floor(Date.now() / 1000)),
            isSpent: false,
            commitment: JSON.stringify(splitResult.outputCommitments?.[index] || { x: '0', y: '0' }),
            parentUTXO: params.inputUTXOId,
            utxoType: UTXOType.SPLIT,
            blindingFactor: splitData.outputBlindingFactors[index] || '',
            localCreatedAt: Date.now(),
            confirmed: true, // ✅ Only true because transaction was confirmed
            creationTxHash: splitResult.transactionHash || '',
            blockNumber: 0,
            nullifierHash: splitResult.outputNullifiers?.[index] || '',
            cryptographyType: 'secp256k1' as const, // ✅ REAL crypto type
            isPrivate: true as const,
            notes: JSON.stringify({
              splitFrom: params.inputUTXOId,
              cryptographyType: 'secp256k1',
              contractTransaction: splitResult.transactionHash,
              realCryptography: true
            })
          };
        });
        
        // Save UTXOs to correct owners and update internal state
        for (const outputUTXO of outputUTXOs) {
          console.log(`💾 Saving split UTXO for owner: ${outputUTXO.owner}`);
          
          // ✅ Solo añadir a colección interna si pertenece al usuario actual
          const isCurrentUserUTXO = outputUTXO.owner.toLowerCase() === this.currentAccount.address.toLowerCase();
          if (isCurrentUserUTXO) {
            this.privateUTXOs.set(outputUTXO.id, outputUTXO);
            console.log('✅ UTXO added to current user internal collection');
          } else {
            console.log('➡️ UTXO belongs to different user, NOT adding to internal collection');
          }
          
          // ✅ SIEMPRE guardar TODOS los UTXOs en localStorage asociados a SU PROPIETARIO
          const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
          await PrivateUTXOStorage.savePrivateUTXO(outputUTXO.owner, outputUTXO);
          console.log(`✅ Split UTXO saved for owner: ${outputUTXO.owner}`);
        }

        // Mark input UTXO as spent
        inputUTXO.isSpent = true;
        const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
        await PrivateUTXOStorage.savePrivateUTXO(this.currentAccount.address, inputUTXO);
        
        this.secp256k1OperationCount++; // ✅ INCREMENT secp256k1 operations
        
        // Emit events
        this.emit('private:utxo:spent', params.inputUTXOId);
        this.emit('private:utxo:split', { 
          input: params.inputUTXOId, 
          outputs: result.createdUTXOIds || [] 
        });
        
        console.log('🎉 REAL secp256k1 ZK Split operation completed successfully with contract confirmation');
      } else {
        console.error('❌ Split failed or no UTXOs were created');
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Failed to split private UTXO with REAL ZK:', error);
      throw new UTXOOperationError(`Failed to split private UTXO: ${error}`, 'splitPrivateUTXO');
    }
  }

  /**
   * Transfer a private UTXO using REAL secp256k1 ZK cryptography
   */
  async transferPrivateUTXO(params: TransferUTXOParams): Promise<UTXOOperationResult> {
    console.log('🔄 Starting REAL secp256k1 ZK transfer operation in ManagerUTXO...');
    console.log('📋 Transfer params:', {
      utxoId: params.utxoId,
      newOwner: params.newOwner,
      refreshCommitment: params.refreshCommitment
    });

    try {
      // 1. Validaciones básicas
      if (!this.currentAccount || !this.contract) {
        throw new UTXOOperationError('Manager not initialized', 'transferPrivateUTXO');
      }

      // 2. Buscar el UTXO a transferir
      const sourceUTXO = this.privateUTXOs.get(params.utxoId);
      if (!sourceUTXO) {
        throw new UTXONotFoundError(`UTXO ${params.utxoId} not found`);
      }

      if (sourceUTXO.isSpent) {
        throw new UTXOAlreadySpentError(`UTXO ${params.utxoId} already spent`);
      }

      // 3. Verificar ownership
      if (!sourceUTXO.owner || sourceUTXO.owner.toLowerCase() !== this.currentAccount.address.toLowerCase()) {
        throw new UTXOOperationError(
          `UTXO ${params.utxoId} not owned by current account`, 
          'transferPrivateUTXO'
        );
      }

      console.log('✅ Source UTXO found and validated for secp256k1 ZK transfer:', {
        id: sourceUTXO.id,
        amount: sourceUTXO.value.toString(),
        owner: sourceUTXO.owner,
        tokenAddress: sourceUTXO.tokenAddress
      });

      // 4. Use TransferPrivateUTXO service with REAL secp256k1 cryptography
      const { TransferPrivateUTXO } = await import('./TransferPrivateUTXO');
      const signer = EthereumHelpers.getSigner();
      if (!signer) {
        throw new UTXOOperationError('No signer available', 'transferPrivateUTXO');
      }
      
      const transferService = new TransferPrivateUTXO(this.contract as any, signer);
      await transferService.initialize(); // Initialize ZK services
      
      // 5. Create transfer data
      const transferData = await TransferPrivateUTXO.createTransferData(
        sourceUTXO,
        params.newOwner,
        sourceUTXO.value, // Transfer full amount
        'Private UTXO ownership transfer'
      );
      
      console.log('🚀 Executing transfer with REAL secp256k1 ZK cryptography...');
      
      // 6. Create attestation provider adapter
      const attestationProvider = {
        createTransferAttestation: async (data: any) => {
          if (!this.attestationService) {
            throw new Error('Attestation service not available');
          }
          
          // Convert transfer data to ZK attestation format
          const zkTransferData = {
            sourceUTXOId: data.sourceUTXOId || '',
            recipientAddress: data.toAddress,
            amount: data.transferAmount,
            outputCommitment: {
              x: data.outputCommitment.x,
              y: data.outputCommitment.y
            },
            outputNullifier: data.outputNullifier,
            outputBlindingFactor: data.outputBlindingFactor
          };
          
          const attestation = await this.attestationService.createZKTransferAttestation(zkTransferData);
          
          // Convert nonce from bigint to string for compatibility
          return {
            ...attestation,
            nonce: attestation.nonce.toString()
          };
        }
      };
      
      // 7. Execute transfer
      const transferResult = await transferService.executeTransfer(transferData, attestationProvider);
      
      // 8. Convert to UTXOOperationResult
      const result: UTXOOperationResult = {
        success: transferResult.success,
        transactionHash: transferResult.transactionHash,
        createdUTXOIds: transferResult.newUTXOId ? [transferResult.newUTXOId] : [],
        error: transferResult.error
      };
      
      if (result.success && transferResult.newUTXOId) {
        // 9. Mark source UTXO as spent
        sourceUTXO.isSpent = true;
        this.secp256k1OperationCount++; // ✅ INCREMENT secp256k1 operations
        
        // 10. Create new UTXO for the recipient
        const newUTXO: PrivateUTXO = {
          id: transferResult.newUTXOId,
          exists: true,
          value: sourceUTXO.value,
          tokenAddress: sourceUTXO.tokenAddress,
          owner: params.newOwner,
          timestamp: BigInt(Math.floor(Date.now() / 1000)),
          isSpent: false,
          commitment: JSON.stringify(transferData.outputCommitment),
          parentUTXO: params.utxoId,
          utxoType: UTXOType.TRANSFER,
          blindingFactor: transferData.outputBlindingFactor,
          localCreatedAt: Date.now(),
          confirmed: true,
          creationTxHash: transferResult.transactionHash || '',
          blockNumber: 0,
          nullifierHash: transferData.outputNullifier,
          cryptographyType: 'secp256k1' as const, // ✅ REAL crypto type
          isPrivate: true as const,
          notes: JSON.stringify({
            transferredFrom: params.utxoId,
            originalOwner: sourceUTXO.owner,
            cryptographyType: 'secp256k1',
            transferReason: 'Private UTXO ownership transfer'
          })
        };
        
        // 11. Update storage
        const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
        
        // Save spent source UTXO
        await PrivateUTXOStorage.savePrivateUTXO(this.currentAccount.address, sourceUTXO);
        
        // Save new UTXO for recipient (if we have storage for other users)
        // For now, just add to internal collection if it's for current user
        if (params.newOwner.toLowerCase() === this.currentAccount.address.toLowerCase()) {
          this.privateUTXOs.set(transferResult.newUTXOId, newUTXO);
          await PrivateUTXOStorage.savePrivateUTXO(this.currentAccount.address, newUTXO);
        }
        
        // 12. Emit events
        this.emit('utxoTransferred', {
          sourceUTXOId: params.utxoId,
          newUTXOId: transferResult.newUTXOId,
          fromAddress: sourceUTXO.owner,
          toAddress: params.newOwner,
          amount: sourceUTXO.value,
          transactionHash: result.transactionHash,
          cryptographyType: 'secp256k1'
        });
        
        console.log('🎉 secp256k1 ZK Transfer operation completed successfully!', {
          sourceUTXOId: params.utxoId.slice(0, 16) + '...',
          newUTXOId: transferResult.newUTXOId.slice(0, 16) + '...',
          fromAddress: sourceUTXO.owner.slice(0, 8) + '...',
          toAddress: params.newOwner.slice(0, 8) + '...',
          cryptographyType: 'secp256k1'
        });
      }
      
      return result;
      
    } catch (error: any) {
      console.error('❌ Error in secp256k1 ZK transferPrivateUTXO:', error);
      throw new UTXOOperationError(
        `secp256k1 ZK Transfer failed: ${error.message}`, 
        'transferPrivateUTXO', 
        error
      );
    }
  }

  /**
   * Withdraw a private UTXO to public tokens using REAL secp256k1 ZK cryptography
   */
  async withdrawPrivateUTXO(params: WithdrawUTXOParams): Promise<UTXOOperationResult> {
    console.log('🔄 Starting REAL secp256k1 ZK withdraw operation in ManagerUTXO...');
    console.log('📋 Withdraw params:', {
      utxoId: params.utxoId,
      recipient: params.recipient
    });

    try {
      // 1. Validaciones básicas
      if (!this.currentAccount || !this.contract) {
        throw new UTXOOperationError('Manager not initialized', 'withdrawPrivateUTXO');
      }

      // 2. Buscar el UTXO a retirar
      const sourceUTXO = this.privateUTXOs.get(params.utxoId);
      if (!sourceUTXO) {
        throw new UTXONotFoundError(`UTXO ${params.utxoId} not found`);
      }

      if (sourceUTXO.isSpent) {
        throw new UTXOAlreadySpentError(`UTXO ${params.utxoId} already spent`);
      }

      // 3. Verificar ownership
      if (!sourceUTXO.owner || sourceUTXO.owner.toLowerCase() !== this.currentAccount.address.toLowerCase()) {
        throw new UTXOOperationError(
          `UTXO ${params.utxoId} not owned by current account`, 
          'withdrawPrivateUTXO'
        );
      }

      console.log('✅ Source UTXO found and validated for secp256k1 ZK withdraw:', {
        id: sourceUTXO.id,
        amount: sourceUTXO.value.toString(),
        owner: sourceUTXO.owner,
        tokenAddress: sourceUTXO.tokenAddress
      });

      // 4. Use WithdrawPrivateUTXO service with REAL secp256k1 cryptography
      const { WithdrawPrivateUTXO } = await import('./WithdrawPrivateUTXO');
      const signer = EthereumHelpers.getSigner();
      if (!signer) {
        throw new UTXOOperationError('No signer available', 'withdrawPrivateUTXO');
      }
      
      const withdrawService = new WithdrawPrivateUTXO(this.contract as any, signer);
      await withdrawService.initialize(); // Initialize ZK services
      
      const withdrawData = {
        sourceCommitment: JSON.parse(sourceUTXO.commitment),
        sourceValue: sourceUTXO.value,
        sourceBlindingFactor: sourceUTXO.blindingFactor,
        sourceNullifier: sourceUTXO.nullifierHash,
        revealedAmount: sourceUTXO.value,
        recipient: params.recipient,
        tokenAddress: sourceUTXO.tokenAddress,
        sourceUTXOId: params.utxoId
      };
      
      console.log('🚀 Executing withdraw with REAL secp256k1 ZK cryptography...');
      
      // Create adapter for attestation service
      const attestationProvider = {
        createWithdrawAttestation: async (data: any) => {
          if (!this.attestationService) {
            throw new Error('Attestation service not available');
          }
          
          const zkWithdrawData = {
            sourceUTXOId: data.sourceUTXOId || '',
            nullifier: data.sourceNullifier,
            amount: data.sourceValue,
            tokenAddress: data.tokenAddress,
            recipient: data.recipient
          };
          
          return await this.attestationService.createZKWithdrawAttestation(zkWithdrawData);
        }
      };
      
      const result = await withdrawService.executeWithdraw(withdrawData, attestationProvider);
      
      if (result.success) {
        // 5. Marcar UTXO como gastado
        sourceUTXO.isSpent = true;
        this.secp256k1OperationCount++; // ✅ INCREMENT secp256k1 operations
        
        // Update in localStorage
        const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
        await PrivateUTXOStorage.savePrivateUTXO(this.currentAccount.address, sourceUTXO);
        
        // 6. Emitir evento
        this.emit('utxoWithdrawn', {
          utxoId: params.utxoId,
          recipient: params.recipient,
          amount: sourceUTXO.value,
          transactionHash: result.transactionHash,
          cryptographyType: 'secp256k1' // ✅ Real crypto type in event
        });
        
        console.log('🎉 secp256k1 ZK Withdraw operation completed successfully!');
      }
      
      return result;
      
    } catch (error: any) {
      console.error('❌ Error in secp256k1 ZK withdrawPrivateUTXO:', error);
      throw new UTXOOperationError(
        `secp256k1 ZK Withdraw failed: ${error.message}`, 
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
    await PrivateUTXOStorage.savePrivateUTXO(this.currentAccount.address, utxo);

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
   * Get manager statistics with REAL secp256k1 cryptography
   */
  getStats(): UTXOManagerStats {
    const allUserUTXOs = this.getAllUserUTXOs();
    const unspentUTXOs = allUserUTXOs.filter(utxo => !utxo.isSpent);
    const spentUTXOs = allUserUTXOs.filter(utxo => utxo.isSpent);
    const recoveredUTXOs = allUserUTXOs.filter(utxo => utxo.recovered);
    
    // Count by actual cryptography type
    const secp256k1UTXOs = allUserUTXOs.filter(utxo => utxo.cryptographyType === 'secp256k1').length;
    const bn254UTXOs = allUserUTXOs.filter(utxo => utxo.cryptographyType === 'BN254').length;
    const otherUTXOs = allUserUTXOs.filter(utxo => !utxo.cryptographyType || utxo.cryptographyType === 'Other').length;
    
    // Calculate total balance from unspent UTXOs
    const totalBalance = unspentUTXOs.reduce((sum, utxo) => sum + utxo.value, BigInt(0));
    
    return {
      totalUTXOs: allUserUTXOs.length,
      unspentUTXOs: unspentUTXOs.length,
      spentUTXOs: spentUTXOs.length,
      recoveredUTXOs: recoveredUTXOs.length,
      uniqueTokens: new Set(allUserUTXOs.map(utxo => utxo.tokenAddress)).size,
      totalBalance,
      privateUTXOs: allUserUTXOs.length,
      confirmedUTXOs: allUserUTXOs.filter(utxo => utxo.confirmed).length,
      balanceByToken: {}, // TODO: Calculate balance by token
      averageUTXOValue: unspentUTXOs.length > 0 ? totalBalance / BigInt(unspentUTXOs.length) : BigInt(0),
      creationDistribution: [], // TODO: Calculate creation distribution
      
      // ✅ CORRECTED: Real secp256k1 cryptography statistics
      secp256k1UTXOs,
      bn254UTXOs,
      cryptoOperations: this.secp256k1OperationCount,
      cryptographyDistribution: {
        secp256k1: secp256k1UTXOs,
        BN254: bn254UTXOs,
        Other: otherUTXOs
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
   * Generate secp256k1 ZK UTXO ID using REAL cryptography (corrected implementation)
   */
  private async generateSecp256k1UTXOId(amount: bigint, blindingFactor: string, owner: string): Promise<string> {
    // Use CryptoHelpers for real secp256k1 commitment
    const commitment = await CryptoHelpers.createPedersenCommitment(
      amount.toString(),
      blindingFactor
    );
    
    return ethers.keccak256(ethers.solidityPacked(
      ['uint256', 'uint256', 'address', 'string'],
      [commitment.x, commitment.y, owner, 'secp256k1-zk']
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
