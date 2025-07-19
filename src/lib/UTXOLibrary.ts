/**
 * @fileoverview UTXOLibrary - Hybrid EOA + Zenroom + Smart Contract UTXO System
 * @description Main library integrating all UTXO functionality with REAL BN254 cryptography
 */

// Ya deben estar importados en otra parte del archivo

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
  createUTXOVaultContract,
  UTXO_VAULT_CONSTANTS
} from '../contracts/UTXOVault.types';

import { CryptoHelpers as ZenroomHelpers } from '../utils/crypto.helpers';
import { EthereumHelpers } from '../utils/ethereum.helpers';
 
/**
 * Main UTXOLibrary class
 * Integrates EOA wallets, REAL BN254 ethers.js + elliptic cryptography, and smart contracts
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
    console.log('📝 Contract address:', contractAddressOrProvider);
    
    // Validar la dirección del contrato
    if (!contractAddressOrProvider || contractAddressOrProvider === 'default') {
      throw new Error('Invalid contract address provided. Please provide a valid Ethereum address.');
    }
    
    // Intentar conectar con el contrato
    try {
      // Primero validar que la dirección es válida
      if (!ethers.isAddress(contractAddressOrProvider)) {
        throw new Error(`Dirección de contrato inválida: ${contractAddressOrProvider}`);
      }

      console.log('🔌 Conectando a contrato UTXO en:', contractAddressOrProvider);
      
      if (typeof window !== 'undefined' && window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        
        // Verificar que hay código en la dirección del contrato
        const code = await provider.getCode(contractAddressOrProvider);
        if (code === '0x') {
          throw new Error(`No hay contrato desplegado en la dirección ${contractAddressOrProvider}. Verifica que el contrato esté desplegado correctamente.`);
        }

        console.log('✅ Código del contrato encontrado:', code.substring(0, 20) + '...');

        // Crear un contrato de prueba con una ABI mínima para verificar conectividad
        const basicAbi = [
          "function getRegisteredTokens() view returns (address[])",
          "function owner() view returns (address)",
          "function authorizedBackend() view returns (address)"
        ];
        
        const testContract = new ethers.Contract(
          contractAddressOrProvider,
          basicAbi,
          provider
        );
        
        // Intentar varias llamadas para verificar que el contrato responde
        let contractValidated = false;
        
        try {
          // Primer intento: getRegisteredTokens (método específico del UTXOVault)
          const tokens = await testContract.getRegisteredTokens();
          console.log('✅ Método getRegisteredTokens() funciona. Tokens registrados:', tokens.length);
          contractValidated = true;
        } catch (tokensError: any) {
          console.warn('⚠️ getRegisteredTokens() no disponible:', tokensError.message);
          
          // Segundo intento: owner (método común en contratos Ownable)
          try {
            const owner = await testContract.owner();
            console.log('✅ Método owner() funciona. Owner:', owner);
            console.log('⚠️ Este contrato no parece ser un UTXOVault completo (sin getRegisteredTokens)');
            contractValidated = true;
          } catch (ownerError: any) {
            console.warn('⚠️ owner() no disponible:', ownerError.message);
            
            // Tercer intento: authorizedBackend (método específico de UTXOVault)
            try {
              const backend = await testContract.authorizedBackend();
              console.log('✅ Método authorizedBackend() funciona. Backend:', backend);
              console.log('⚠️ Este contrato responde pero no tiene la interfaz UTXOVault completa');
              contractValidated = true;
            } catch (backendError: any) {
              console.warn('⚠️ authorizedBackend() no disponible:', backendError.message);
            }
          }
        }
        
        if (!contractValidated) {
          throw new Error(`El contrato en ${contractAddressOrProvider} no responde a ningún método conocido. Puede que no sea un contrato UTXOVault válido.`);
        }
        
        // Crear la instancia real del contrato con la ABI completa
        this.contract = createUTXOVaultContract(contractAddressOrProvider, signer);
        
        // Verificar el contrato real
        try {
          const tokens = await this.contract.getRegisteredTokens();
          console.log('✅ Contrato UTXO validado correctamente e inicializado. Tokens registrados:', tokens.length);
          
          // Verificar que el authorizedBackend coincida con nuestra clave pública
          await this.verifyAuthorizedBackend();
          
        } catch (finalTestError: any) {
          console.warn('⚠️ Contrato conectado pero getRegisteredTokens() no funciona en el contrato final:', finalTestError.message);
          console.log('📢 Continuando con la inicialización - el contrato puede estar desplegado pero sin tokens registrados aún');
        }
      }
    } catch (contractError) {
      console.error('❌ Error conectando con el contrato:', contractError);
      throw new Error(`No se pudo conectar con el contrato UTXO en la dirección ${contractAddressOrProvider}. Verifica que la dirección sea correcta y que el contrato esté desplegado.`);
    }
    
    // Enhanced cryptography initialization with fallback modes
    console.log('🔬 Initializing cryptography with enhanced error handling...');
    
    let cryptoMode: 'full' | 'limited' | 'unavailable' = 'unavailable';
    
    try {
      // Attempt to initialize Zenroom with enhanced error handling
      const zenroomInitialized = await ZenroomHelpers.initialize();
      
      if (zenroomInitialized) {
        console.log('✅ Crypto library initialized successfully - full cryptography available');
        cryptoMode = 'full';
        
        // Test cryptographic functionality if full mode
        try {
          const testBlinding = await ZenroomHelpers.generateSecureBlindingFactor();
          const testCommitment = await ZenroomHelpers.createPedersenCommitment("100", testBlinding);
          console.log('✅ BN254 cryptography test passed - commitment created successfully');
        } catch (cryptoTestError) {
          console.warn('⚠️ Cryptographic test failed, but continuing:', cryptoTestError);
          cryptoMode = 'limited';
        }
      } else {
        console.warn('⚠️ Crypto initialization failed - using limited crypto mode');
        cryptoMode = 'limited';
      }
      
    } catch (initError) {
      console.warn('⚠️ Crypto initialization error, continuing with limited functionality:', initError);
      cryptoMode = 'limited';
    }
    
    // Always mark as initialized regardless of crypto mode
    this.isInitialized = true;
    this.emit('library:initialized', { 
      cryptography: cryptoMode === 'full' ? 'BN254' : 'limited',
      status: 'ready',
      contractAddress: contractAddressOrProvider,
      cryptoMode
    });
    
    if (cryptoMode === 'full') {
      console.log('🎉 UTXOLibrary initialized successfully with full BN254 cryptography');
    } else if (cryptoMode === 'limited') {
      console.log('⚠️ UTXOLibrary initialized with limited cryptography - some features may be unavailable');
    } else {
      console.log('🚨 UTXOLibrary initialized without cryptography - only basic operations available');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to initialize UTXOLibrary:', error);
    this.isInitialized = false;
    
    // Propagar error específico para mejor depuración
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Unknown error during UTXOLibrary initialization');
    }
    
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
   * Verificar que el authorizedBackend del contrato coincida con nuestra clave pública
   */
  private async verifyAuthorizedBackend(): Promise<void> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }
    
    const expectedPublicKey = import.meta.env.VITE_PUBLIC_KEY_ADMIN;
    if (!expectedPublicKey) {
      console.warn('⚠️ VITE_PUBLIC_KEY_ADMIN not configured - skipping backend verification');
      return;
    }
    
    try {
      const authorizedBackend = await this.contract.authorizedBackend();
      
      if (authorizedBackend.toLowerCase() !== expectedPublicKey.toLowerCase()) {
        console.error('❌ Backend mismatch:', {
          contractBackend: authorizedBackend,
          expectedBackend: expectedPublicKey
        });
        throw new Error(`Contract authorizedBackend (${authorizedBackend}) does not match VITE_PUBLIC_KEY_ADMIN (${expectedPublicKey}). The contract needs to be deployed with the correct backend address.`);
      }
      
      console.log('✅ Authorized backend verified:', {
        contractBackend: authorizedBackend,
        matches: true
      });
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('Contract authorizedBackend')) {
        throw error; // Re-throw our custom error
      }
      console.warn('⚠️ Could not verify authorized backend:', error);
      // Don't throw here - the contract might not have this method
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
      // Ensure Zenroom cryptography is available
      await ZenroomHelpers.ensureInitialized();
      
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

      // Convert PedersenCommitment to hex format for contract and storage
      const commitmentHex = '0x' + commitmentResult.x.toString(16).padStart(64, '0') + commitmentResult.y.toString(16).padStart(64, '0');

      // 3. Generate nullifier hash using hash-to-curve
      console.log('🔐 Generating nullifier hash...');
      const nullifierHash = await this.zenroom.generateNullifierHash(
        this.currentEOA!.address,
        commitmentHex,
        Date.now().toString()
      );

      // 4. Generate range proof using bulletproof
      console.log('🔍 Generating range proof...');
      const rangeProof = await this.zenroom.generateBulletproof(
        BigInt(amount),
        blindingFactor
      );

      // 5. Get REAL BN254 generators from Zenroom
      const generatorParams = await this.getBN254Generators();

      // 6. Prepare contract parameters with validation and formato normalizado
      // El commitment completo tiene formato 0x + 128 caracteres (coordenadas X e Y)
      const fullCommitment = commitmentHex;
      
      // Para el contrato necesitamos solo los primeros 32 bytes (coordenada X) como bytes32
      const fullCommitmentHex = fullCommitment.substring(2); // sin 0x
      const contractCommitmentHex = fullCommitmentHex.substring(0, 64); // primeros 64 caracteres (32 bytes)
      const normalizedCommitment = '0x' + contractCommitmentHex;
        
      const normalizedNullifier = nullifierHash.startsWith('0x') ? 
        nullifierHash : '0x' + nullifierHash;
        
      // Validar formato correcto
      console.log('🔍 Validando formato de commitment y nullifier para contrato...');
      
      // Simple hex validation function
      function isValidHex(hex: string, expectedBytes: number): boolean {
        return /^[0-9a-fA-F]+$/.test(hex) && hex.length === expectedBytes * 2;
      }
      
      // El commitment para el contrato debe ser bytes32 (64 caracteres hex)
      if (!normalizedCommitment.startsWith('0x') || !isValidHex(normalizedCommitment.substring(2), 32)) {
        throw new Error(`Invalid commitment format for contract: ${normalizedCommitment.slice(0, 10)}...`);
      }
      
      // El nullifier también debe ser bytes32 (64 caracteres hex)
      if (!normalizedNullifier.startsWith('0x') || !isValidHex(normalizedNullifier.substring(2), 32)) {
        throw new Error(`Invalid nullifier format for contract: ${normalizedNullifier.slice(0, 10)}...`);
      }
      
      console.log('✅ Commitment convertido para contrato:', {
        original: fullCommitment.slice(0, 15) + '...',
        paraContrato: normalizedCommitment.slice(0, 15) + '...',
        longitud: normalizedCommitment.length - 2
      });
      
      // 6. Create REAL attestation with cryptographic signature
      console.log('🔐 Creating REAL cryptographic attestation...');
      const attestationResult = await this.zenroom.createDepositWithAttestation(
        amount,
        this.currentEOA!.address,
        tokenAddress
      );

      const depositParams = {
        tokenAddress,
        commitment: { 
          x: commitmentResult.x, 
          y: commitmentResult.y 
        }, // Use CommitmentPoint structure exactly as Solidity expects
        nullifierHash: normalizedNullifier,
        amount: amount, // Amount as uint256
        attestation: {
          operation: "DEPOSIT",
          dataHash: attestationResult.attestation.dataHash,
          nonce: BigInt(attestationResult.attestation.nonce),
          timestamp: BigInt(Date.now()),
          signature: attestationResult.attestation.signature
        }
      };

      console.log('📋 Contract parameters prepared:', {
        tokenAddress,
        commitment: {
          value: normalizedCommitment.slice(0, 20) + '...',
          hasPrefix: normalizedCommitment.startsWith('0x'),
          length: normalizedCommitment.length,
          lengthWithoutPrefix: normalizedCommitment.startsWith('0x') ? normalizedCommitment.length - 2 : normalizedCommitment.length
        },
        nullifierHash: {
          value: normalizedNullifier.slice(0, 20) + '...',
          hasPrefix: normalizedNullifier.startsWith('0x'),
          length: normalizedNullifier.length,
          lengthWithoutPrefix: normalizedNullifier.startsWith('0x') ? normalizedNullifier.length - 2 : normalizedNullifier.length
        },
        blindingFactor: blindingFactor.slice(0, 10) + '...',
        amount: amount.toString()
      });

      // 7. Approve token transfer
      console.log('🔓 Approving token transfer...');
      
      // Double-check contract is still available before using it
      if (!this.contract) {
        throw new Error('❌ Contract became null during execution. Please reinitialize the library.');
      }
      
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function approve(address,uint256) returns (bool)'],
        this.ethereum.getSigner()
      );

      console.log(`Approving ${amount} tokenAddress ${tokenAddress}`);
      const approveTx = await tokenContract.approve(this.contract, amount);
      await approveTx.wait();
      console.log('✅ Token approval confirmed');

      // 8. PRE-VALIDAR CON EL CONTRATO ANTES DE EJECUTAR
      console.log('🔍 Pre-validating with contract...');
      console.log('📋 Sending validation parameters:', {
        tokenAddress: depositParams.tokenAddress,
        commitment: {
          x: depositParams.commitment.x.toString(),
          y: depositParams.commitment.y.toString()
        },
        nullifierHash: depositParams.nullifierHash,
        amount: depositParams.amount.toString(),
        attestation: {
          operation: depositParams.attestation.operation,
          dataHash: depositParams.attestation.dataHash,
          nonce: depositParams.attestation.nonce.toString(),
          timestamp: depositParams.attestation.timestamp.toString(),
          signature: depositParams.attestation.signature.substring(0, 20) + '...'
        },
        sender: this.currentEOA!.address
      });
      
      try {
        const [isValid, errorMessage] = await this.contract.validateDepositParams(
          depositParams,
          this.currentEOA!.address
        );
        
        console.log('📊 Contract validation result:', {
          isValid,
          errorMessage,
          contractAddress: this.contract.address
        });
        
        if (!isValid) {
          console.error('❌ Contract validation failed:', errorMessage);
          throw new Error(`❌ Contract validation failed: ${errorMessage}`);
        }
        
        console.log('✅ Contract pre-validation passed:', errorMessage);
        
        // Información adicional sobre el estado del contrato
        try {
          const currentNonce = await this.contract.lastNonce();
          const authorizedBackend = await this.contract.authorizedBackend();
          const registeredTokens = await this.contract.getRegisteredTokens();
          
          console.log('📋 Contract state verification:', {
            currentNonce: currentNonce.toString(),
            authorizedBackend,
            expectedBackend: import.meta.env.VITE_PUBLIC_KEY_ADMIN,
            backendMatch: authorizedBackend.toLowerCase() === import.meta.env.VITE_PUBLIC_KEY_ADMIN?.toLowerCase(),
            registeredTokens,
            isTokenRegistered: registeredTokens.some(
              (token: string) => token.toLowerCase() === tokenAddress.toLowerCase()
            )
          });
        } catch (stateError) {
          console.warn('⚠️ Could not fetch additional contract state:', stateError);
        }
        
      } catch (preValidationError: any) {
        console.error('❌ Pre-validation error details:', {
          error: preValidationError,
          message: preValidationError.message,
          code: preValidationError.code,
          data: preValidationError.data,
          contractAddress: this.contract.address,
          senderAddress: this.currentEOA!.address
        });
        
        // Mejorar el mensaje de error basado en el tipo
        let enhancedMessage = preValidationError.message;
        
        if (preValidationError.message?.includes('InvalidToken')) {
          enhancedMessage = `Invalid token address: ${tokenAddress}. Make sure the token contract exists and is valid.`;
        } else if (preValidationError.message?.includes('InvalidAmount')) {
          enhancedMessage = `Invalid amount: ${amount}. Amount must be greater than 0.`;
        } else if (preValidationError.message?.includes('NullifierAlreadyUsed')) {
          enhancedMessage = `This nullifier has been used before: ${depositParams.nullifierHash}. Each deposit must use a unique nullifier.`;
        } else if (preValidationError.message?.includes('UnauthorizedBackend')) {
          const contractBackend = await this.contract.authorizedBackend().catch(() => 'unknown');
          enhancedMessage = `Backend not authorized. Contract backend: ${contractBackend}, Expected: ${import.meta.env.VITE_PUBLIC_KEY_ADMIN}`;
        } else if (preValidationError.message?.includes('InvalidAttestation')) {
          enhancedMessage = `Invalid attestation signature or data. Check that the backend signed the correct parameters.`;
        } else if (preValidationError.message?.includes('StaleAttestation')) {
          enhancedMessage = `Attestation is too old. Attestations expire after 10 minutes for security.`;
        } else if (preValidationError.message?.includes('InvalidNonce')) {
          const currentNonce = await this.contract.lastNonce().catch(() => 0n);
          enhancedMessage = `Invalid nonce. Expected: ${currentNonce + 1n}, got: ${depositParams.attestation.nonce}`;
        } else if (preValidationError.message?.includes('InsufficientAllowance')) {
          enhancedMessage = `Insufficient token allowance. You need to approve the contract to spend your tokens first.`;
        } else if (preValidationError.message?.includes('InsufficientBalance')) {
          enhancedMessage = `Insufficient token balance. You don't have enough tokens to make this deposit.`;
        }
        
        throw new Error(`Pre-validation failed: ${enhancedMessage}`);
      }
      
      // 9. Si llegamos aquí, el contrato acepta los parámetros
      console.log('🚀 Executing contract call (validation passed)...');
      console.log('⏳ Submitting transaction to blockchain...');
      
      // Final contract check before calling
      if (!this.contract) {
        throw new Error('❌ Contract became null before deposit call. Please reinitialize the library.');
      }
      
      const tx = await this.contract.depositAsPrivateUTXO(
        depositParams,
        { gasLimit: this.config.defaultGasLimit }
      );

      console.log('📤 Transaction submitted:', {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        gasLimit: tx.gasLimit?.toString(),
        gasPrice: tx.gasPrice?.toString()
      });

      console.log('⏳ Waiting for transaction confirmation...');
      const receipt = await tx.wait();
      
      // Verificar que la transacción fue exitosa
      if (!receipt || receipt.status === 0) {
        console.error('❌ Transaction failed details:', {
          hash: receipt?.hash || tx.hash,
          status: receipt?.status,
          gasUsed: receipt?.gasUsed?.toString(),
          blockNumber: receipt?.blockNumber,
          logs: receipt?.logs
        });
        
        throw new Error(`Transaction failed: ${receipt?.hash || tx.hash}. The contract rejected the transaction despite pre-validation passing.`);
      }
      
      console.log('✅ Transaction confirmed successfully:', {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status
      });

      // 9. SOLO AHORA guardamos el UTXO localmente (después de confirmación exitosa)
      const utxoId = await this.generateBN254UTXOId(
        commitmentHex,
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
        commitment: commitmentHex,
        parentUTXO: '',
        utxoType: UTXOType.DEPOSIT,
        blindingFactor,
        localCreatedAt: Date.now(),
        confirmed: true,
        creationTxHash: receipt?.hash,
        blockNumber: receipt?.blockNumber,
        // Add BN254 specific fields
        rangeProof: JSON.stringify(rangeProof),
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
        if (error.message.includes('UnauthorizedBackend')) {
          errorMessage = 'Backend signature verification failed. Check that the contract authorizedBackend matches VITE_PUBLIC_KEY_ADMIN.';
        } else if (error.message.includes('ReplayAttack')) {
          errorMessage = 'Nonce replay attack detected. The nonce may be out of sync.';
        } else if (error.message.includes('StaleAttestation')) {
          errorMessage = 'Attestation is too old. Please try again.';
        } else if (error.message.includes('InvalidAttestation')) {
          errorMessage = 'Attestation verification failed. Data hash mismatch.';
        } else if (error.message.includes('NullifierAlreadyUsed')) {
          errorMessage = 'This nullifier has already been used. Possible double-spend attempt.';
        } else if (error.message.includes('Transaction failed')) {
          errorMessage = 'Contract transaction was reverted. Check the transaction details.';
        } else if (error.message.includes('Invalid commitment point')) {
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
      // Ensure Zenroom cryptography is available
      await ZenroomHelpers.ensureInitialized();
      
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
          // Convert to hex format
          return '0x' + result.x.toString(16).padStart(64, '0') + result.y.toString(16).padStart(64, '0');
        })
      );

      // 5. Generate REAL equality proof (validates homomorphic property) using BN254
      console.log('🔍 Generating REAL BN254 equality proof for split validation...');
      
      // Convert hex commitments back to PedersenCommitment format
      const inputCommitmentHex = inputUTXO.commitment;
      const inputCommitmentX = BigInt('0x' + inputCommitmentHex.slice(2, 66)); // First 64 chars after 0x
      const inputCommitmentY = BigInt('0x' + inputCommitmentHex.slice(66, 130)); // Next 64 chars
      
      const outputCommitmentHex = outputCommitments[0];
      const outputCommitmentX = BigInt('0x' + outputCommitmentHex.slice(2, 66));
      const outputCommitmentY = BigInt('0x' + outputCommitmentHex.slice(66, 130));
      
      const inputPedersenCommitment: import('../types/zenroom.d').PedersenCommitment = {
        x: inputCommitmentX,
        y: inputCommitmentY,
        blindingFactor: inputUTXO.blindingFactor!,
        value: inputUTXO.value
      };
      
      const outputPedersenCommitment: import('../types/zenroom.d').PedersenCommitment = {
        x: outputCommitmentX,
        y: outputCommitmentY,
        blindingFactor: outputBlindings[0],
        value: outputValues[0]
      };
      
      const splitProofResult = await this.zenroom.generateEqualityProof(
        inputPedersenCommitment,
        outputPedersenCommitment
      );
      
      // Convert proof to string format for contract
      const splitProof = JSON.stringify(splitProofResult);

      // 6. Generate nullifier hash for input
      const nullifierHash = await this.zenroom.generateNullifierHash(
        this.currentEOA!.address,
        inputUTXO.commitment,
        Date.now().toString()
      );

      // 7. Get REAL BN254 generators from Zenroom
      const generatorParams = await this.getBN254Generators();

      // 8. Call smart contract
      console.log('🚀 Executing split contract call...');
      
      // Crear estructura SplitParams según la nueva interfaz
      const splitParams = {
        inputCommitment: {
          x: inputCommitmentX,
          y: inputCommitmentY
        },
        outputCommitments: outputCommitments.map(commitment => {
          const x = BigInt('0x' + commitment.slice(2, 66));
          const y = BigInt('0x' + commitment.slice(66, 130));
          return { x, y };
        }),
        inputNullifier: nullifierHash,
        outputNullifiers: outputCommitments.map((_, index) => 
          nullifierHash + index.toString() // Unique nullifier per output
        ),
        attestation: {
          operation: "SPLIT",
          dataHash: ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
            ["string", "uint256[]", "string"],
            [inputUTXO.commitment, outputValues, nullifierHash]
          )),
          nonce: toBigInt(Date.now()),
          timestamp: toBigInt(Date.now()),
          signature: "0x" // Placeholder - would be generated by backend
        }
      };
      
      const tx = await this.contract!.splitPrivateUTXO(
        splitParams,
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
      // Ensure Zenroom cryptography is available
      await ZenroomHelpers.ensureInitialized();
      
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
        utxo.blindingFactor!
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

      // 4. Get REAL BN254 generators from Zenroom
      const generatorParams = await this.getBN254Generators();

      // 5. Call smart contract
      console.log('🚀 Executing withdrawal contract call...');
      
      // Parse commitment to get x,y coordinates
      const commitmentX = BigInt('0x' + utxo.commitment.slice(2, 66));
      const commitmentY = BigInt('0x' + utxo.commitment.slice(66, 130));
      
      // Crear estructura WithdrawParams según la nueva interfaz
      const withdrawParams = {
        commitment: {
          x: commitmentX,
          y: commitmentY
        },
        nullifierHash: nullifierHash,
        revealedAmount: utxo.value,
        attestation: {
          operation: "WITHDRAW",
          dataHash: ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
            ["string", "uint256", "string"],
            [utxo.commitment, utxo.value, nullifierHash]
          )),
          nonce: toBigInt(Date.now()),
          timestamp: toBigInt(Date.now()),
          signature: "0x" // Placeholder - would be generated by backend
        }
      };
      
      const tx = await this.contract!.withdrawFromPrivateUTXO(
        withdrawParams,
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
      // Ensure Zenroom cryptography is available
      await ZenroomHelpers.ensureInitialized();
      
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
      
      // Convert to hex format
      const outputCommitmentHex = '0x' + outputCommitmentResult.x.toString(16).padStart(64, '0') + outputCommitmentResult.y.toString(16).padStart(64, '0');

      // 4. Generate nullifier hash for input
      const nullifierHash = await this.zenroom.generateNullifierHash(
        this.currentEOA!.address,
        utxo.commitment,
        Date.now().toString()
      );

      // 5. Get REAL BN254 generators from Zenroom
      const generatorParams = await this.getBN254Generators();

      // 6. Call smart contract
      console.log('🚀 Executing transfer contract call...');
      
      // Parse commitments to get x,y coordinates
      const inputCommitmentX = BigInt('0x' + utxo.commitment.slice(2, 66));
      const inputCommitmentY = BigInt('0x' + utxo.commitment.slice(66, 130));
      const outputCommitmentX = BigInt('0x' + outputCommitmentHex.slice(2, 66));
      const outputCommitmentY = BigInt('0x' + outputCommitmentHex.slice(66, 130));
      
      // Crear estructura TransferParams según la nueva interfaz
      const transferParams = {
        inputCommitment: {
          x: inputCommitmentX,
          y: inputCommitmentY
        },
        outputCommitment: {
          x: outputCommitmentX,
          y: outputCommitmentY
        },
        inputNullifier: nullifierHash,
        outputNullifier: nullifierHash + "_output",
        attestation: {
          operation: "TRANSFER",
          dataHash: ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
            ["string", "string", "address", "uint256"],
            [utxo.commitment, outputCommitmentHex, newOwner, utxo.value]
          )),
          nonce: toBigInt(Date.now()),
          timestamp: toBigInt(Date.now()),
          signature: "0x" // Placeholder - would be generated by backend
        }
      };
      
      const tx = await this.contract!.transferPrivateUTXO(
        transferParams,
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
          outputCommitmentHex,
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
          commitment: outputCommitmentHex,
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
      console.error('Contract state:', {
        isInitialized: this.isInitialized,
        contractExists: !!this.contract,
        currentAccount: this.currentEOA?.address || 'not connected'
      });
      throw new Error('UTXO contract not initialized. Contract address may be invalid or not properly set up. Please check the console for details.');
    }
  }

 
  /**
   * Get REAL BN254 generators from CryptoHelpers for contract calls
   * @returns GeneratorParams with actual BN254 points from CryptoHelpers cryptography
   */
  private async getBN254Generators(): Promise<GeneratorParams> {
    try {
      const generators = await ZenroomHelpers.getRealPedersenGenerators();
      
      // Convert CryptoHelpers generator format to contract format
      // The generators come as hex strings from CryptoHelpers
      let gPoint = generators.G;
      let hPoint = generators.H;
      
      // Remove '0x' prefix if present
      if (gPoint.startsWith('0x')) {
        gPoint = gPoint.substring(2);
      }
      if (hPoint.startsWith('0x')) {
        hPoint = hPoint.substring(2);
      }
      
      // Parse hex coordinates (assuming they're in x,y format)
      const gX = BigInt('0x' + gPoint.substring(0, 64));
      const gY = BigInt('0x' + gPoint.substring(64, 128));
      const hX = BigInt('0x' + hPoint.substring(0, 64));
      const hY = BigInt('0x' + hPoint.substring(64, 128));
      
      console.log('✅ BN254 generators parsed successfully:', {
        gX: gX.toString(16).substring(0, 10) + '...',
        gY: gY.toString(16).substring(0, 10) + '...',
        hX: hX.toString(16).substring(0, 10) + '...',
        hY: hY.toString(16).substring(0, 10) + '...'
      });
      
      return {
        gX,
        gY,
        hX,
        hY
      };
    } catch (error) {
      console.warn('Failed to get real generators from CryptoHelpers, using fallback:', error);
      // Fallback to known working BN254 points if CryptoHelpers fails
      return {
        gX: BigInt("0x01"),
        gY: BigInt("0x02"),
        hX: BigInt("0x2cf44499d5d27bb186308b7af7af02ac5bc9eeb6a3d147c186b21fb1b76e18da"),
        hY: BigInt("0x2c0f001f52110ccfe69108924926e45f0b0c868df0e7bde1fe16d3242dc715f6")
      };
    }
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
    return typeof this.zenroom !== 'undefined';
  }

  /**
   * Debug contract interaction - test various contract methods and new validation
   */
  async debugContractInteraction(params: { amount: bigint; tokenAddress: string; owner: string }): Promise<void> {
    if (!this.contract) {
      throw new Error('Contract not initialized. Call initialize() first.');
    }

    console.log('🔍 === CONTRACT DEBUG SESSION WITH NEW VALIDATION ===');
    console.log('Contract address:', this.contract.address);
    console.log('Test parameters:', params);

    try {
      // 1. Test basic contract connectivity
      console.log('\n1️⃣ Testing basic contract connectivity...');
      const registeredTokens = await this.contract.getRegisteredTokens();
      console.log('✅ Registered tokens:', registeredTokens);

      // 2. Test backend authorization
      console.log('\n2️⃣ Testing backend authorization...');
      const authorizedBackend = await this.contract.authorizedBackend();
      const expectedBackend = import.meta.env.VITE_PUBLIC_KEY_ADMIN;
      console.log('Contract authorized backend:', authorizedBackend);
      console.log('Expected backend (VITE_PUBLIC_KEY_ADMIN):', expectedBackend);
      console.log('Backend match:', authorizedBackend.toLowerCase() === expectedBackend?.toLowerCase());

      // 3. Test nonce sequence
      console.log('\n3️⃣ Testing nonce sequence...');
      const currentNonce = await this.contract.lastNonce();
      console.log('Current contract nonce:', currentNonce.toString());
      console.log('Next expected nonce:', (currentNonce + 1n).toString());

      // 4. Create test deposit parameters
      console.log('\n4️⃣ Creating test deposit parameters...');
      const testBlinding = await ZenroomHelpers.generateSecureBlindingFactor();
      const testCommitment = await ZenroomHelpers.createPedersenCommitment(
        params.amount.toString(),
        testBlinding
      );
      
      const testAttestation = await ZenroomHelpers.createDepositWithAttestation(
        params.amount,
        params.owner,
        params.tokenAddress
      );
      
      const testDepositParams = {
        tokenAddress: params.tokenAddress,
        commitment: {
          x: testCommitment.x,
          y: testCommitment.y
        },
        nullifierHash: testAttestation.attestation.dataHash, // Use dataHash as nullifier for test
        amount: params.amount,
        attestation: testAttestation.attestation
      };

      // 5. TEST NEW VALIDATION FUNCTION
      console.log('\n5️⃣ 🆕 Testing new contract validation function...');
      try {
        const [isValid, errorMessage] = await this.contract.validateDepositParams(
          testDepositParams,
          params.owner
        );
        
        console.log('✅ Validation result:', {
          isValid,
          errorMessage
        });
        
        if (!isValid) {
          console.log('❌ Validation failed - analyzing error for debugging...');
          console.log('📋 Error details:', errorMessage);
          
          // Analyze the error to provide guidance
          if (errorMessage.includes('InvalidToken')) {
            console.log('💡 Issue: Token not valid or zero address');
          } else if (errorMessage.includes('UnauthorizedBackend')) {
            console.log('💡 Issue: Backend signature verification failed');
          } else if (errorMessage.includes('InvalidNonce')) {
            console.log('💡 Issue: Nonce sequence is wrong');
          } else if (errorMessage.includes('TokenNotRegistered')) {
            console.log('💡 Issue: Token not registered in contract');
          }
        } else {
          console.log('🎉 Validation passed! The contract would accept this deposit.');
        }
        
      } catch (validationError: any) {
        console.error('❌ Validation function call failed:', validationError);
      }

      console.log('\n✅ Contract debug session completed!');

    } catch (error) {
      console.error('❌ Contract debug failed:', error);
      throw error;
    }
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
  createUTXOVaultContract,
  UTXO_VAULT_CONSTANTS
} from '../contracts/UTXOVault.types';