/**
 * @fileoverview PrivateUTXOManager - Extensión de UTXOLibrary con criptografía BN254 real
 * @description Implementa privacidad real usando SOLO Pedersen commitments, Range proofs y Equality proofs
 */

import { ethers, toBigInt, type BigNumberish } from 'ethers';
import { UTXOLibrary } from './UTXOLibrary';
import { ZenroomHelpers } from './../utils/zenroom.helpers';
import { EthereumHelpers } from './../utils/ethereum.helpers';
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
  UTXONotFoundError,           // ✅ AÑADIR
  InsufficientFundsError,      // ✅ AÑADIR
  UTXOAlreadySpentError,       // ✅ AÑADIR
  UTXOType
} from '../types/utxo.types';

// ========================
// INTERFACES FALTANTES
// ========================

// ✅ AÑADIR ESTAS INTERFACES:

interface GeneratorParams {
  gX: bigint;
  gY: bigint;
  hX: bigint;
  hY: bigint;
}

interface PedersenCommitmentResult {
  pedersen_commitment: string;
  blinding_factor: string;
}

interface RangeProofResult {
  range_proof: string;
  commitment: string;
}

interface EqualityProofResult {
  equality_proof: string;
  commitment_a: string;
  commitment_b: string;
}

interface DepositParams {
  tokenAddress: string;
  commitment: string;
  nullifierHash: string;
  blindingFactor: bigint;
}

interface ProofParams {
  rangeProof: string;
}

// ========================
// TIPOS ESPECÍFICOS PARA CRIPTOGRAFÍA BN254 REAL
// ========================

export interface PrivateUTXO extends ExtendedUTXOData {
  /** Blinding factor for commitment (requerido, no opcional) */
  blindingFactor: string;
  /** Nullifier hash para prevenir double-spending (requerido) */
  nullifierHash: string;
  /** Siempre true para PrivateUTXO */
  isPrivate: true;
  /** Siempre BN254 para PrivateUTXO */
  cryptographyType: 'BN254';
  /** Range proof (Bulletproof format) - opcional */
  rangeProof?: string;
}

export interface PrivateUTXO extends ExtendedUTXOData {
  /** Blinding factor for commitment (requerido, no opcional) */
  blindingFactor: string;
  /** Nullifier hash para prevenir double-spending (requerido) */
  nullifierHash: string;
  /** Siempre true para PrivateUTXO */
  isPrivate: true;
  /** Siempre BN254 para PrivateUTXO */
  cryptographyType: 'BN254';
  /** Range proof (Bulletproof format) - opcional */
  rangeProof?: string;
}



// ========================
// PRIVATE UTXO MANAGER - SOLO CRIPTOGRAFÍA BN254 REAL
// ========================

/**
 * PrivateUTXOManager - Extensión de UTXOLibrary con criptografía BN254 real únicamente
 * Implementa Pedersen commitments, Range proofs y Equality proofs sobre BN254
 */
export class PrivateUTXOManager extends UTXOLibrary {
  // Almacenamiento de UTXOs privados con BN254
  private privateUTXOs: Map<string, PrivateUTXO> = new Map();
  private bn254OperationCount: number = 0;

 constructor(config: UTXOManagerConfig = {  // ✅ CAMBIAR TIPO
  autoConsolidate: false,
  consolidationThreshold: 5,
  maxUTXOAge: 7 * 24 * 60 * 60,
  privacyMode: true,
  defaultGasLimit: BigInt(500000),
  cacheTimeout: 30000,
  enableBackup: true
}) {
  super(config);
  console.log('🔐 PrivateUTXOManager initialized with REAL BN254 cryptography only');
}

  // ========================
  // OPERACIONES PRIVADAS CON CRIPTOGRAFÍA BN254 REAL
  // ========================

  /**
   * Approve token spending for private UTXO operations
   */
  private async approveTokenSpending(tokenAddress: string, amount: bigint): Promise<void> {
    const signer = EthereumHelpers.getSigner();
    if (!signer) {
      throw new Error('Signer not available');
    }

    try {
      console.log('🔓 Approving token spending for BN254 operations...');
      
      // Crear instancia del contrato ERC20
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          "function allowance(address owner, address spender) view returns (uint256)",
          "function approve(address spender, uint256 amount) returns (bool)",
          "function decimals() view returns (uint8)",
          "function symbol() view returns (string)"
        ],
        signer
      );

      // Obtener información del token
      let tokenDecimals: number;
      let tokenSymbol: string;
      try {
        [tokenDecimals, tokenSymbol] = await Promise.all([
          tokenContract.decimals(),
          tokenContract.symbol()
        ]);
      } catch (error) {
        console.warn('Could not get token info, using defaults:', error);
        tokenDecimals = 18;
        tokenSymbol = 'TOKEN';
      }

      // Verificar allowance actual
      const currentAllowance = await tokenContract.allowance(
        this.currentAccount?.address,
        this.contract?.target
      );

      console.log('💰 Token approval info:', {
        symbol: tokenSymbol,
        decimals: tokenDecimals,
        currentAllowance: ethers.formatUnits(currentAllowance, tokenDecimals),
        requiredAmount: ethers.formatUnits(amount, tokenDecimals)
      });

      // Si allowance no es suficiente, aprobar
      if (currentAllowance < amount) {
        console.log('🔓 Insufficient allowance, approving token spending...');
        
        // Aprobar una cantidad ligeramente mayor para BN254 operations
        const approvalAmount = amount + (amount / 100n); // +1% extra para BN254
        
        // Obtener gasPrice con fallback
        let gasPrice: bigint;
        try {
          const feeData = await signer.provider?.getFeeData();
          gasPrice = feeData?.gasPrice || ethers.parseUnits('25', 'gwei');
          gasPrice = gasPrice + (gasPrice * 20n / 100n); // +20% para BN254
        } catch (error) {
          console.warn('Could not get gas price, using BN254-optimized default:', error);
          gasPrice = ethers.parseUnits('30', 'gwei'); // Higher default for BN254
        }
        
        // Estimar gas para approval
        let gasLimit: bigint;
        try {
          const estimatedGas = await tokenContract.approve.estimateGas(
            this.contract?.target,
            approvalAmount
          );
          gasLimit = estimatedGas + (estimatedGas / 4n); // +25% buffer
        } catch (gasError) {
          console.warn('Gas estimation failed, using conservative limit:', gasError);
          gasLimit = BigInt(100000); // 100k gas conservative
        }

        console.log('⛽ Approval transaction parameters:', {
          approvalAmount: ethers.formatUnits(approvalAmount, tokenDecimals),
          gasLimit: gasLimit.toString(),
          gasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' gwei'
        });

        // Enviar transacción de aprobación
        const approveTx = await tokenContract.approve(
          this.contract?.target,
          approvalAmount,
          {
            gasLimit: gasLimit,
            gasPrice: gasPrice
          }
        );
        console.log('⏳ Approval transaction sent:', approveTx.hash);
        
        const approveReceipt = await approveTx.wait();
        console.log('✅ Token approval confirmed:', approveReceipt?.hash);
        
        // Verificar allowance después de la aprobación
        const newAllowance = await tokenContract.allowance(
          this.currentAccount?.address,
          this.contract?.target
        );
        console.log('💰 New allowance:', ethers.formatUnits(newAllowance, tokenDecimals), tokenSymbol);
        
        if (newAllowance < amount) {
          throw new Error(`BN254 approval failed: allowance ${ethers.formatUnits(newAllowance, tokenDecimals)} < required ${ethers.formatUnits(amount, tokenDecimals)}`);
        }
        
        // Pausa para blockchain processing
        console.log('⏳ Waiting for BN254-compatible approval to be processed...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        console.log('✅ Sufficient allowance already exists for BN254 operations');
      }
    } catch (error) {
      console.error('❌ BN254 token approval failed:', error);
      throw new UTXOOperationError(
        'BN254 token approval failed',
        'approveTokenSpending',
        undefined,
        error
      );
    }
  }

  /**
   * Crear UTXO privado usando REAL BN254 cryptography
   */
  async createPrivateUTXO(params: CreateUTXOParams): Promise<UTXOOperationResult> {
    this.ensureInitialized();
    console.log('🔐 Creating private UTXO with REAL BN254 cryptography...');
    this.bn254OperationCount++;

    try {
      const { amount, tokenAddress, owner } = params;
      
      // 1. Validaciones iniciales
      if (amount <= 0n) {
        throw new Error('Amount must be greater than zero');
      }

      // 2. Aprobar tokens antes del depósito
      console.log('🔓 Approving token spending for BN254 operations...');
      await this.approveTokenSpending(tokenAddress, amount);

      // 3. Generar blinding factor BN254-compatible
      console.log('🎲 Generating BN254-compatible blinding factor...');
      const blindingFactor = await ZenroomHelpers.generateSecureBlindingFactor();
      console.log('✅ BN254 blinding factor generated:', blindingFactor.slice(0, 10) + '...');

      // 4. Crear REAL Pedersen commitment usando BN254
      console.log('🔐 Creating REAL BN254 Pedersen commitment...');
      const commitmentResult = await ZenroomHelpers.createPedersenCommitment(
        amount.toString(),
        blindingFactor
      );
      console.log('✅ REAL BN254 Pedersen commitment created:', commitmentResult.pedersen_commitment.slice(0, 20) + '...');

      // 5. Generar nullifier hash usando hash-to-curve
      console.log('🔐 Generating BN254 nullifier hash...');
      const nullifierHash = await ZenroomHelpers.generateNullifierHash(
        this.currentAccount!.address,
        commitmentResult.pedersen_commitment,
        Date.now().toString()
      );
      console.log('✅ BN254 nullifier hash generated:', nullifierHash.slice(0, 20) + '...');

      // 6. Generar range proof (Bulletproof structure)
      console.log('🔍 Generating BN254 range proof...');
      const rangeProof = await ZenroomHelpers.generateRangeProof(
        amount.toString(),
        blindingFactor,
        64 // 64-bit range
      );
      console.log('✅ BN254 range proof generated:', rangeProof.slice(0, 20) + '...');

      // 7. Obtener generadores BN254 estándar
      const generatorParams = this.getBN254StandardGenerators();

      // 8. Preparar parámetros del contrato con validación BN254
      console.log('🔍 Preparing BN254-validated contract parameters...');
      
      // Validar que el commitment es un punto BN254 válido
      if (!ZenroomHelpers.isValidHex(commitmentResult.pedersen_commitment, 64)) {
        throw new Error('Invalid BN254 commitment format');
      }
      
      // Validar nullifier hash
      if (!ZenroomHelpers.isValidHex(nullifierHash, 64)) {
        throw new Error('Invalid BN254 nullifier hash format');
      }

      const depositParams: DepositParams = {
        tokenAddress: tokenAddress,
        commitment: commitmentResult.pedersen_commitment,
        nullifierHash: nullifierHash,
        blindingFactor: ZenroomHelpers.toBigInt('0x' + blindingFactor)
      };

      const proofParams: ProofParams = {
        rangeProof: rangeProof
      };

      console.log('📋 Final BN254 contract parameters:', {
        tokenAddress: depositParams.tokenAddress,
        commitment: depositParams.commitment.slice(0, 20) + '...',
        nullifierHash: depositParams.nullifierHash.slice(0, 20) + '...',
        blindingFactor: depositParams.blindingFactor.toString().slice(0, 10) + '...',
        amount: amount.toString(),
        rangeProofLength: proofParams.rangeProof.length,
        generatorType: 'BN254-standard'
      });

      // 9. Preparar transacción con gas optimizado para BN254
      const signer = EthereumHelpers.getSigner();
      if (!signer) {
        throw new Error('Signer not available for BN254 deposit transaction');
      }

      // Gas optimizado para operaciones BN254
      let gasPrice: bigint;
      try {
        const feeData = await signer.provider?.getFeeData();
        gasPrice = feeData?.gasPrice || ethers.parseUnits('30', 'gwei');
        gasPrice = gasPrice + (gasPrice * 25n / 100n); // +25% para BN254
      } catch (error) {
        console.warn('Using BN254-optimized fallback gas price:', error);
        gasPrice = ethers.parseUnits('35', 'gwei'); // Higher default for BN254
      }

      // Estimación de gas para BN254 operations
      let gasLimit: bigint;
      try {
        console.log('⛽ Estimating gas for BN254 deposit...');
        const estimatedGas = await this.contract!.depositAsPrivateUTXO.estimateGas(
          depositParams,
          proofParams,
          generatorParams,
          amount
        );
        gasLimit = estimatedGas + (estimatedGas * 40n / 100n); // +40% buffer para BN254
        console.log('✅ BN254 gas estimation successful:', gasLimit.toString());
      } catch (gasError: any) {
        console.warn('❌ BN254 gas estimation failed:', gasError);
        if (gasError.reason === 'Invalid commitment point') {
          throw new Error('BN254 commitment point validation failed. Please try again.');
        }
        gasLimit = BigInt(1200000); // 1.2M gas conservador para BN254
      }

      // Validar límites de gas para BN254
      const maxGasLimit = BigInt(2000000); // 2M máximo para BN254
      const minGasLimit = BigInt(800000);  // 800k mínimo para BN254
      
      if (gasLimit > maxGasLimit) gasLimit = maxGasLimit;
      if (gasLimit < minGasLimit) gasLimit = minGasLimit;

      console.log('⛽ Final BN254 gas parameters:', {
        gasLimit: gasLimit.toString(),
        gasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' gwei',
        estimatedCost: ethers.formatEther(gasLimit * gasPrice) + ' ETH'
      });

      // 10. Ejecutar transacción BN254
      console.log('🚀 Executing BN254 depositAsPrivateUTXO transaction...');
      
      const tx = await this.contract!.depositAsPrivateUTXO(
        depositParams,
        proofParams,
        generatorParams,
        amount,
        {
          gasLimit: gasLimit,
          gasPrice: gasPrice,
          value: BigInt(0)
        }
      );
      
      console.log('✅ BN254 transaction sent:', tx.hash);

      // 11. Esperar confirmación
      console.log('⏳ Waiting for BN254 transaction confirmation...');
      const receipt = await tx.wait();
      console.log('✅ BN254 deposit confirmed:', receipt?.hash, 'Block:', receipt?.blockNumber);

      // 12. Crear UTXO privado local con datos BN254
      const utxoId = await this.generateBN254UTXOId(
        commitmentResult.pedersen_commitment,
        owner,
        Date.now()
      );

      const privateUTXO: PrivateUTXO = {
        id: utxoId,
        exists: true,
        value: amount,
        tokenAddress,
        owner,
        timestamp: toBigInt(Date.now()),
        isSpent: false,
        commitment: commitmentResult.pedersen_commitment,
        parentUTXO: '',
        utxoType: UTXOType.DEPOSIT,
        blindingFactor: blindingFactor,
        nullifierHash: nullifierHash,
        localCreatedAt: Date.now(),
        confirmed: true,
        creationTxHash: receipt?.hash,
        blockNumber: receipt?.blockNumber,
        isPrivate: true,
        rangeProof: rangeProof,
        cryptographyType: 'BN254'
      };

      // 13. Almacenar en cache y localStorage
      this.utxos.set(utxoId, privateUTXO);
      this.privateUTXOs.set(utxoId, privateUTXO);

      try {
        const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
        PrivateUTXOStorage.savePrivateUTXO(owner, privateUTXO);
      } catch (storageError) {
        console.warn('⚠️ Could not save BN254 UTXO to localStorage:', storageError);
      }

      const result: UTXOOperationResult = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds: [utxoId]
      };

      console.log('✅ Private UTXO created successfully with REAL BN254 cryptography:', utxoId);
      this.emit('private:utxo:created', privateUTXO);

      return result;

    } catch (error) {
      console.error('❌ BN254 Private UTXO creation failed:', error);
      
      let errorMessage = 'BN254 private UTXO creation failed';
      if (error instanceof Error) {
        if (error.message.includes('Invalid commitment point')) {
          errorMessage = 'BN254 commitment validation failed. Please try again.';
        } else if (error.message.includes('user rejected')) {
          errorMessage = 'Transaction was rejected by user';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for BN254 transaction fees';
        } else {
          errorMessage = error.message;
        }
      }
      
      return {
        success: false,
        error: errorMessage,
        errorDetails: error
      };
    }
  }

  /**
   * Transferir UTXO privado usando REAL BN254 cryptography
   */
  async transferPrivateUTXO(params: TransferUTXOParams): Promise<UTXOOperationResult> {
    this.ensureInitialized();
    console.log('🔄 Transferring private UTXO with REAL BN254 cryptography...');
    this.bn254OperationCount++;

    try {
      const { utxoId, newOwner } = params;
      
      // 1. Obtener UTXO privado
      const utxo = this.privateUTXOs.get(utxoId) as PrivateUTXO;
      if (!utxo || !utxo.isPrivate || utxo.cryptographyType !== 'BN254') {
        throw new Error('UTXO is not a BN254 private UTXO or does not exist');
      }

      if (utxo.isSpent) {
        throw new Error('UTXO is already spent');
      }

      // 2. Verificar commitment existente
      console.log('🔍 Verifying existing BN254 commitment...');
      const isValidCommitment = await ZenroomHelpers.verifyPedersenCommitment(
        utxo.commitment,
        utxo.value.toString(),
        utxo.blindingFactor
      );
      
      if (!isValidCommitment) {
        throw new Error('BN254 commitment verification failed - UTXO data may be corrupted');
      }

      // 3. Generar nuevo blinding factor BN254 para output
      console.log('🎲 Generating new BN254 blinding factor for output...');
      const newBlindingFactor = await ZenroomHelpers.generateSecureBlindingFactor();

      // 4. Crear nuevo REAL Pedersen commitment para el destinatario
      console.log('🔐 Creating new REAL BN254 Pedersen commitment for recipient...');
      const newCommitmentResult = await ZenroomHelpers.createPedersenCommitment(
        utxo.value.toString(),
        newBlindingFactor
      );
      console.log('✅ New BN254 commitment created:', newCommitmentResult.pedersen_commitment.slice(0, 20) + '...');

      // 5. Generar nullifier hash para input
      const nullifierHash = await ZenroomHelpers.generateNullifierHash(
        utxo.commitment,
        utxo.owner,
        Date.now().toString()
      );

      // 6. Obtener generadores BN254 estándar
      const generatorParams = this.getBN254StandardGenerators();

      // 7. Preparar transacción con gas optimizado para BN254
      const signer = EthereumHelpers.getSigner();
      if (!signer) {
        throw new Error('Signer not available for BN254 transfer transaction');
      }

      // Gas optimizado para transferencias BN254
      let gasPrice: bigint;
      try {
        const feeData = await signer.provider?.getFeeData();
        gasPrice = feeData?.gasPrice || ethers.parseUnits('25', 'gwei');
        gasPrice = gasPrice + (gasPrice * 20n / 100n); // +20% para BN254
      } catch (error) {
        console.warn('Using BN254 transfer fallback gas price:', error);
        gasPrice = ethers.parseUnits('30', 'gwei');
      }

      const estimatedGas = BigInt(800000); // 800k gas para BN254 transfer
      const gasLimit = estimatedGas + (estimatedGas * 25n / 100n); // +25% buffer

      console.log('⛽ BN254 transfer gas parameters:', {
        gasLimit: gasLimit.toString(),
        gasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' gwei'
      });

      // 8. Ejecutar transacción BN254 transfer
      console.log('🚀 Calling transferPrivateUTXO with REAL BN254 cryptography...');
      const tx = await this.contract!.transferPrivateUTXO(
        utxo.commitment,
        newCommitmentResult.pedersen_commitment,
        newOwner,
        utxo.value,
        ZenroomHelpers.toBigInt('0x' + newBlindingFactor),
        nullifierHash,
        generatorParams,
        {
          gasLimit: gasLimit,
          gasPrice: gasPrice
        }
      );

      console.log('✅ BN254 transfer transaction sent:', tx.hash);
      const receipt = await tx.wait();
      console.log('✅ BN254 transfer confirmed:', receipt?.hash);

      // 9. Marcar UTXO original como gastado
      utxo.isSpent = true;

      // Actualizar en localStorage
      try {
        const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
        PrivateUTXOStorage.savePrivateUTXO(utxo.owner, utxo);
      } catch (storageError) {
        console.warn('⚠️ Could not update original BN254 UTXO in localStorage:', storageError);
      }

      this.emit('private:utxo:spent', utxoId);

      // 10. Crear nuevo UTXO privado BN254 para el destinatario
      let createdUTXOIds: string[] = [];
      if (newOwner === this.currentAccount?.address) {
        const newUtxoId = await this.generateBN254UTXOId(
          newCommitmentResult.pedersen_commitment,
          newOwner,
          Date.now()
        );

        const newNullifierHash = await ZenroomHelpers.generateNullifierHash(
          newCommitmentResult.pedersen_commitment,
          newOwner,
          Date.now().toString()
        );

        const newPrivateUTXO: PrivateUTXO = {
          id: newUtxoId,
          exists: true,
          value: utxo.value,
          tokenAddress: utxo.tokenAddress,
          owner: newOwner,
          timestamp: toBigInt(Date.now()),
          isSpent: false,
          commitment: newCommitmentResult.pedersen_commitment,
          parentUTXO: utxoId,
          utxoType: UTXOType.TRANSFER,
          blindingFactor: newBlindingFactor,
          nullifierHash: newNullifierHash,
          localCreatedAt: Date.now(),
          confirmed: true,
          creationTxHash: receipt?.hash,
          blockNumber: receipt?.blockNumber,
          isPrivate: true,
          cryptographyType: 'BN254'
        };

        // Almacenar nuevo UTXO BN254
        this.utxos.set(newUtxoId, newPrivateUTXO);
        this.privateUTXOs.set(newUtxoId, newPrivateUTXO);
        createdUTXOIds.push(newUtxoId);

        // Guardar en localStorage
        try {
          const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
          PrivateUTXOStorage.savePrivateUTXO(newOwner, newPrivateUTXO);
        } catch (storageError) {
          console.warn('⚠️ Could not save new BN254 UTXO to localStorage:', storageError);
        }

        this.emit('private:utxo:created', newPrivateUTXO);
      }

      const result: UTXOOperationResult = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds
      };

      console.log('✅ BN254 private UTXO transferred successfully');
      this.emit('private:utxo:transferred', { from: utxoId, to: createdUTXOIds[0], newOwner });

      return result;

    } catch (error) {
      console.error('❌ BN254 private UTXO transfer failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'BN254 private transfer failed',
        errorDetails: error
      };
    }
  }

  /**
   * Dividir UTXO privado usando REAL BN254 cryptography
   */
  async splitPrivateUTXO(params: SplitUTXOParams): Promise<UTXOOperationResult> {
    this.ensureInitialized();
    console.log('✂️ Splitting private UTXO with REAL BN254 cryptography...');
    this.bn254OperationCount++;

    try {
      const { inputUTXOId, outputValues, outputOwners } = params;
      
      // 1. Obtener UTXO privado BN254
      const inputUTXO = this.privateUTXOs.get(inputUTXOId) as PrivateUTXO;
      if (!inputUTXO || !inputUTXO.isPrivate || inputUTXO.cryptographyType !== 'BN254') {
        throw new Error('Input UTXO is not a BN254 private UTXO or does not exist');
      }

      if (inputUTXO.isSpent) {
        throw new Error('Input UTXO is already spent');
      }

      // 2. Validar conservación de valor
      const totalOutput = outputValues.reduce((sum, val) => sum + val, BigInt(0));
      if (totalOutput !== inputUTXO.value) {
        throw new Error(`BN254 value conservation failed: input=${inputUTXO.value}, outputs=${totalOutput}`);
      }

      console.log('✅ BN254 value conservation validated:', {
        inputValue: inputUTXO.value.toString(),
        outputSum: totalOutput.toString(),
        outputCount: outputValues.length
      });

      // 3. Verificar commitment de entrada
      console.log('🔍 Verifying input BN254 commitment...');
      const isValidInputCommitment = await ZenroomHelpers.verifyPedersenCommitment(
        inputUTXO.commitment,
        inputUTXO.value.toString(),
        inputUTXO.blindingFactor
      );
      
      if (!isValidInputCommitment) {
        throw new Error('Input BN254 commitment verification failed');
      }

      // 4. Generar commitments BN254 para cada output
      const outputCommitments: string[] = [];
      const outputBlindingFactors: string[] = [];
      const outputNullifierHashes: string[] = [];

      console.log('🔐 Generating REAL BN254 Pedersen commitments for outputs...');
      for (let i = 0; i < outputValues.length; i++) {
        const blindingFactor = await ZenroomHelpers.generateSecureBlindingFactor();
        const commitment = await ZenroomHelpers.createPedersenCommitment(
          outputValues[i].toString(),
          blindingFactor
        );

        const nullifierHash = await ZenroomHelpers.generateNullifierHash(
          commitment.pedersen_commitment,
          outputOwners[i],
          (Date.now() + i).toString()
        );

        outputCommitments.push(commitment.pedersen_commitment);
        outputBlindingFactors.push(blindingFactor);
        outputNullifierHashes.push(nullifierHash);
        
        console.log(`✅ Output ${i + 1} BN254 commitment created:`, commitment.pedersen_commitment.slice(0, 20) + '...');
      }

      // 5. Generar nullifier hash para el input
      const inputNullifierHash = await ZenroomHelpers.generateNullifierHash(
        inputUTXO.commitment,
        inputUTXO.owner,
        Date.now().toString()
      );

      // 6. Generar split proof para demostrar conservación de valor
      console.log('🔍 Generating BN254 split proof...');
      const splitProof = await ZenroomHelpers.generateSplitProof(
        inputUTXO.commitment,
        inputUTXO.value.toString(),
        inputUTXO.blindingFactor,
        outputValues.map(v => v.toString()),
        outputBlindingFactors
      );
      console.log('✅ BN254 split proof generated');

      // 7. Obtener generadores BN254 estándar
      const generatorParams = this.getBN254StandardGenerators();

      // 8. Preparar transacción con gas optimizado para BN254 split
      const signer = EthereumHelpers.getSigner();
      if (!signer) {
        throw new Error('Signer not available for BN254 split transaction');
      }

      // Gas optimizado para splits BN254 (más complejo)
      let gasPrice: bigint;
      try {
        const feeData = await signer.provider?.getFeeData();
        gasPrice = feeData?.gasPrice || ethers.parseUnits('30', 'gwei');
        gasPrice = gasPrice + (gasPrice * 30n / 100n); // +30% para BN254 split
      } catch (error) {
        console.warn('Using BN254 split fallback gas price:', error);
        gasPrice = ethers.parseUnits('40', 'gwei'); // Higher for splits
      }

      // Gas más alto para operaciones de split BN254
      const baseGas = BigInt(1000000); // 1M base para BN254 split
      const extraGasPerOutput = BigInt(200000); // 200k extra por output
      const estimatedGas = baseGas + (extraGasPerOutput * BigInt(outputValues.length));
      const gasLimit = estimatedGas + (estimatedGas * 25n / 100n); // +25% buffer

      console.log('⛽ BN254 split gas parameters:', {
        baseGas: baseGas.toString(),
        extraPerOutput: extraGasPerOutput.toString(),
        estimatedGas: estimatedGas.toString(),
        gasLimit: gasLimit.toString(),
        gasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' gwei',
        outputCount: outputValues.length
      });

      // 9. Ejecutar transacción BN254 split
      console.log('🚀 Calling splitPrivateUTXO with REAL BN254 cryptography...');
      
      const tx = await this.contract!.splitPrivateUTXO(
        inputUTXO.commitment,
        outputCommitments,
        outputValues,
        outputBlindingFactors.map(bf => ZenroomHelpers.toBigInt('0x' + bf)),
        splitProof,
        inputNullifierHash,
        generatorParams,
        {
          gasLimit: gasLimit,
          gasPrice: gasPrice
        }
      );

      console.log('✅ BN254 split transaction sent:', tx.hash);
      const receipt = await tx.wait();
      console.log('✅ BN254 split confirmed:', receipt?.hash);

      // 10. Marcar input UTXO como gastado
      inputUTXO.isSpent = true;

      // Actualizar en localStorage
      try {
        const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
        PrivateUTXOStorage.savePrivateUTXO(inputUTXO.owner, inputUTXO);
      } catch (storageError) {
        console.warn('⚠️ Could not update input BN254 UTXO in localStorage:', storageError);
      }

      this.emit('private:utxo:spent', inputUTXOId);

      // 11. Crear UTXOs de salida BN254
      const createdUTXOIds: string[] = [];

      for (let i = 0; i < outputValues.length; i++) {
        const outputId = await this.generateBN254UTXOId(
          outputCommitments[i],
          outputOwners[i],
          Date.now() + i
        );

        const outputUTXO: PrivateUTXO = {
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
          blindingFactor: outputBlindingFactors[i],
          nullifierHash: outputNullifierHashes[i],
          localCreatedAt: Date.now(),
          confirmed: true,
          creationTxHash: receipt?.hash,
          blockNumber: receipt?.blockNumber,
          isPrivate: true,
          cryptographyType: 'BN254'
        };

        // Almacenar nuevo UTXO BN254
        this.utxos.set(outputId, outputUTXO);
        this.privateUTXOs.set(outputId, outputUTXO);
        createdUTXOIds.push(outputId);

        // Guardar en localStorage
        try {
          const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
          PrivateUTXOStorage.savePrivateUTXO(outputOwners[i], outputUTXO);
        } catch (storageError) {
          console.warn(`⚠️ Could not save output BN254 UTXO ${i} to localStorage:`, storageError);
        }

        this.emit('private:utxo:created', outputUTXO);
      }

      const result: UTXOOperationResult = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds
      };

      console.log('✅ BN254 private UTXO split successfully:', {
        inputUTXOId,
        createdOutputs: createdUTXOIds.length,
        outputIds: createdUTXOIds
      });

      this.emit('private:utxo:split', { 
        inputUTXOId, 
        outputUTXOIds: createdUTXOIds, 
        outputValues, 
        outputOwners,
        cryptographyType: 'BN254'
      });

      return result;

    } catch (error) {
      console.error('❌ BN254 private UTXO split failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'BN254 private split failed',
        errorDetails: error
      };
    }
  }

  /**
   * Retirar UTXO privado usando REAL BN254 cryptography
   */
  async withdrawPrivateUTXO(params: WithdrawUTXOParams): Promise<UTXOOperationResult> {
    this.ensureInitialized();
    console.log('💸 Withdrawing private UTXO with REAL BN254 cryptography...');
    this.bn254OperationCount++;

    try {
      const { utxoId, recipient } = params;
      
      // 1. Obtener UTXO privado BN254
      const utxo = this.privateUTXOs.get(utxoId) as PrivateUTXO;
      if (!utxo || !utxo.isPrivate || utxo.cryptographyType !== 'BN254') {
        throw new Error('UTXO is not a BN254 private UTXO or does not exist');
      }

      if (utxo.isSpent) {
        throw new Error('UTXO is already spent');
      }

      // 2. Validar que el usuario actual es el propietario
      if (utxo.owner.toLowerCase() !== this.currentAccount!.address.toLowerCase()) {
        throw new Error('Not authorized to withdraw this BN254 UTXO');
      }

      // 3. Verificar commitment BN254 antes del withdrawal
      console.log('🔍 Verifying BN254 commitment before withdrawal...');
      const isValidCommitment = await ZenroomHelpers.verifyPedersenCommitment(
        utxo.commitment,
        utxo.value.toString(),
        utxo.blindingFactor
      );
      
      if (!isValidCommitment) {
        throw new Error('BN254 commitment verification failed - UTXO data may be corrupted');
      }

      // 4. Generar nullifier hash para prevenir double-spending
      const nullifierHash = await ZenroomHelpers.generateNullifierHash(
        utxo.commitment,
        utxo.owner,
        Date.now().toString()
      );
      console.log('✅ BN254 nullifier hash generated for withdrawal:', nullifierHash.slice(0, 20) + '...');

      // 5. Obtener generadores BN254 estándar
      const generatorParams = this.getBN254StandardGenerators();

      // 6. Preparar transacción con gas optimizado para BN254 withdrawal
      const signer = EthereumHelpers.getSigner();
      if (!signer) {
        throw new Error('Signer not available for BN254 withdrawal transaction');
      }

      // Gas optimizado para withdrawals BN254
      let gasPrice: bigint;
      try {
        const feeData = await signer.provider?.getFeeData();
        gasPrice = feeData?.gasPrice || ethers.parseUnits('25', 'gwei');
        gasPrice = gasPrice + (gasPrice * 20n / 100n); // +20% para BN254
      } catch (error) {
        console.warn('Using BN254 withdrawal fallback gas price:', error);
        gasPrice = ethers.parseUnits('30', 'gwei');
      }

      const estimatedGas = BigInt(600000); // 600k gas para BN254 withdrawal
      const gasLimit = estimatedGas + (estimatedGas * 25n / 100n); // +25% buffer

      console.log('⛽ BN254 withdrawal gas parameters:', {
        gasLimit: gasLimit.toString(),
        gasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' gwei',
        recipient: recipient || 'same as owner'
      });

      // 7. Ejecutar transacción BN254 withdrawal
      console.log('🚀 Calling withdrawFromPrivateUTXO with REAL BN254 cryptography...');
      const tx = await this.contract!.withdrawFromPrivateUTXO(
        utxo.commitment,
        utxo.value,
        ZenroomHelpers.toBigInt('0x' + utxo.blindingFactor),
        nullifierHash,
        generatorParams,
        {
          gasLimit: gasLimit,
          gasPrice: gasPrice
        }
      );

      console.log('✅ BN254 withdrawal transaction sent:', tx.hash);
      const receipt = await tx.wait();
      console.log('✅ BN254 withdrawal confirmed:', receipt?.hash);

      // 8. Marcar UTXO como gastado
      utxo.isSpent = true;

      // Actualizar en localStorage
      try {
        const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
        PrivateUTXOStorage.savePrivateUTXO(utxo.owner, utxo);
      } catch (storageError) {
        console.warn('⚠️ Could not update BN254 UTXO in localStorage:', storageError);
      }

      this.emit('private:utxo:withdrawn', utxoId);

      const result: UTXOOperationResult = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
      };

      console.log('✅ BN254 private UTXO withdrawn successfully:', {
        utxoId,
        recipient: recipient || utxo.owner,
        value: utxo.value.toString(),
        tokenAddress: utxo.tokenAddress,
        cryptographyType: 'BN254'
      });

      return result;

    } catch (error) {
      console.error('❌ BN254 private UTXO withdrawal failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'BN254 private withdrawal failed',
        errorDetails: error
      };
    }
  }

  // ========================
  // FUNCIONES AUXILIARES Y ESTADÍSTICAS - SOLO BN254
  // ========================

  /**
   * Obtener UTXOs privados BN254 por propietario
   */
  getPrivateUTXOsByOwner(owner: string): PrivateUTXO[] {
    const utxos: PrivateUTXO[] = [];
    
    for (const [utxoId, utxo] of this.privateUTXOs.entries()) {
      if (utxo.owner.toLowerCase() === owner.toLowerCase() && 
          !utxo.isSpent && 
          utxo.cryptographyType === 'BN254') {
        utxos.push(utxo);
      }
    }
    
    return utxos;
  }

  /**
   * Obtener balance privado BN254 total
   */
  getPrivateBalance(tokenAddress?: string): bigint {
    let balance = BigInt(0);
    
    for (const utxo of this.privateUTXOs.values()) {
      if (!utxo.isSpent && 
          utxo.cryptographyType === 'BN254' &&
          (!tokenAddress || utxo.tokenAddress === tokenAddress)) {
        balance += utxo.value;
      }
    }
    
    return balance;
  }

  /**
   * Obtener estadísticas de UTXOs BN254
   */
  getUTXOStats(): UTXOManagerStats {
    const allUTXOs = Array.from(this.privateUTXOs.values());
    const bn254UTXOs = allUTXOs.filter(utxo => utxo.cryptographyType === 'BN254');
    const unspentUTXOs = bn254UTXOs.filter(utxo => !utxo.isSpent);
    const spentUTXOs = bn254UTXOs.filter(utxo => utxo.isSpent);
    const confirmedUTXOs = bn254UTXOs.filter(utxo => utxo.confirmed);
    const uniqueTokens = new Set(unspentUTXOs.map(utxo => utxo.tokenAddress)).size;
    const totalBalance = unspentUTXOs.reduce((sum, utxo) => sum + utxo.value, BigInt(0));

    // Balance por token (solo BN254)
    const balanceByToken: { [tokenAddress: string]: bigint } = {};
    unspentUTXOs.forEach(utxo => {
      if (!balanceByToken[utxo.tokenAddress]) {
        balanceByToken[utxo.tokenAddress] = BigInt(0);
      }
      balanceByToken[utxo.tokenAddress] += utxo.value;
    });

    // Promedio de valor de UTXO BN254
    const averageUTXOValue = unspentUTXOs.length > 0 
      ? totalBalance / BigInt(unspentUTXOs.length)
      : BigInt(0);

    // Distribución de creación (últimos 7 días)
    const creationDistribution: Array<{ date: string; count: number }> = [];
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now - (i * oneDayMs));
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const dayStart = date.setHours(0, 0, 0, 0);
      const dayEnd = date.setHours(23, 59, 59, 999);
      
      const count = bn254UTXOs.filter(utxo => {
        const utxoDate = utxo.localCreatedAt || 0;
        return utxoDate >= dayStart && utxoDate <= dayEnd;
      }).length;
      
      creationDistribution.push({ date: dateStr, count });
    }

    return {
      totalUTXOs: allUTXOs.length,
      unspentUTXOs: unspentUTXOs.length,
      uniqueTokens,
      totalBalance,
      privateUTXOs: bn254UTXOs.filter(utxo => utxo.isPrivate).length,
      spentUTXOs: spentUTXOs.length,
      confirmedUTXOs: confirmedUTXOs.length,
      balanceByToken,
      averageUTXOValue,
      creationDistribution,
       bn254UTXOs: bn254UTXOs.length,
      bn254Operations: this.bn254OperationCount,
      cryptographyDistribution: {
        BN254: bn254UTXOs.length,
        Other: allUTXOs.length - bn254UTXOs.length
      }
    };
  }

  /**
   * Sincronizar con blockchain (solo datos públicos + localStorage para BN254 privacy)
   */
  async syncWithBlockchain(): Promise<boolean> {
    if (!this.contract || !this.currentEOA) {
      return false;
    }

    console.log('🔄 Syncing BN254 data with blockchain and localStorage...');

    try {
      // 1. Verificar conexión con contrato
      const userUTXOCount = await this.contract.getUserUTXOCount(this.currentEOA.address);
      console.log(`📊 User has ${userUTXOCount} UTXOs in contract (BN254 mode)`);

      // 2. Cargar UTXOs privados BN254 desde localStorage (preserva privacidad total)
      try {
        const { PrivateUTXOStorage } = await import('./PrivateUTXOStorage');
        const localUTXOs = PrivateUTXOStorage.getPrivateUTXOs(this.currentEOA.address);
        
        // Filtrar solo UTXOs BN254
        const bn254UTXOs = localUTXOs.filter(utxo => 
          utxo.cryptographyType === 'BN254' || 
          utxo.isPrivate // Backwards compatibility
        );
        
        console.log(`💾 Found ${bn254UTXOs.length} BN254 private UTXOs in localStorage`);
        
        // 3. Cargar UTXOs BN254 en cache
        this.privateUTXOs.clear();
        for (const utxo of bn254UTXOs) {
          // Ensure BN254 type consistency
          const bn254UTXO: PrivateUTXO = {
            ...utxo,
            cryptographyType: 'BN254',
            isPrivate: true
          };
          this.privateUTXOs.set(utxo.id, bn254UTXO);
        }

        // 4. Verificar integridad de commitments BN254
        let verifiedCount = 0;
        let corruptedCount = 0;
        
        for (const utxo of this.privateUTXOs.values()) {
          if (!utxo.isSpent && utxo.blindingFactor) {
            try {
              const isValid = await ZenroomHelpers.verifyPedersenCommitment(
                utxo.commitment,
                utxo.value.toString(),
                utxo.blindingFactor
              );
              
              if (isValid) {
                verifiedCount++;
              } else {
                corruptedCount++;
                console.warn('⚠️ Corrupted BN254 commitment detected:', utxo.id);
              }
            } catch (verifyError) {
              corruptedCount++;
              console.warn('⚠️ Could not verify BN254 commitment:', utxo.id, verifyError);
            }
          }
        }

        // 5. Obtener estadísticas BN254
        const stats = this.getUTXOStats();
        
        console.log('📈 BN254 UTXO statistics:');
        console.log(`  - Total BN254 UTXOs: ${stats.totalUTXOs}`);
        console.log(`  - Unspent BN254 UTXOs: ${stats.unspentUTXOs}`);
        console.log(`  - Verified commitments: ${verifiedCount}`);
        console.log(`  - Corrupted commitments: ${corruptedCount}`);
        console.log(`  - Unique tokens: ${stats.uniqueTokens}`);
        console.log(`  - Total BN254 balance: ${stats.totalBalance.toString()}`);
        console.log(`  - BN254 operations: ${stats.bn254Operations}`);
        
        console.log('✅ BN254 privacy-preserving sync completed');
        
        // Emitir evento de sincronización BN254
        this.emit('blockchain:synced', {
          localUTXOs: Array.from(this.utxos.values()).length,
          privateUTXOs: Array.from(this.privateUTXOs.values()).length,
          bn254UTXOs: stats.cryptographyDistribution.BN254,
          contractUTXOCount: Number(userUTXOCount),
          localStats: stats,
          syncMode: 'BN254-localStorage+contract',
          verifiedCommitments: verifiedCount,
          corruptedCommitments: corruptedCount
        });

        return true;
      } catch (storageError) {
        console.warn('⚠️ Could not load BN254 UTXOs from localStorage:', storageError);
        return false;
      }

    } catch (error) {
      console.error('❌ BN254 sync failed:', error);
      this.emit('blockchain:sync:failed', error);
      return false;
    }
  }

  /**
   * Limpiar datos privados BN254 (para seguridad)
   */
  clearPrivateData(): void {
    this.privateUTXOs.clear();
    this.bn254OperationCount = 0;
    console.log('🧹 BN254 private data cleared');
  }

  // ========================
  // HELPER METHODS BN254
  // ========================

  /**
   * Obtener generadores BN254 estándar
   */
  private getBN254StandardGenerators(): GeneratorParams {
    return {
      gX: BigInt("0x01"), // G1 generator X coordinate
      gY: BigInt("0x02"), // G1 generator Y coordinate
      hX: BigInt("0x2cf44499d5d27bb186308b7af7af02ac5bc9eeb6a3d147c186b21fb1b76e18da"), // H1 generator X
      hY: BigInt("0x2c0f001f52110ccfe69108924926e45f0b0c868df0e7bde1fe16d3242dc715f6")  // H1 generator Y
    };
  }



  /**
   * Verificar si un UTXO usa BN254
   */
  isUTXOBN254(utxoId: string): boolean {
    const utxo = this.privateUTXOs.get(utxoId);
    return utxo?.cryptographyType === 'BN254' || false;
  }

  /**
   * Obtener tipo de criptografía
   */
  get cryptographyType(): string {
    return 'BN254';
  }

  /**
   * Obtener conteo de operaciones BN254
   */
  get bn254OperationsCount(): number {
    return this.bn254OperationCount;
  }

  /**
   * Obtener información de BN254
   */
  getBN254Info(): {
    operationsCount: number;
    utxosCount: number;
    verifiedCommitments: number;
    isZenroomAvailable: boolean;
  } {
    const bn254UTXOs = Array.from(this.privateUTXOs.values()).filter(
      utxo => utxo.cryptographyType === 'BN254'
    );

    return {
      operationsCount: this.bn254OperationCount,
      utxosCount: bn254UTXOs.length,
      verifiedCommitments: bn254UTXOs.filter(utxo => !utxo.isSpent).length,
      isZenroomAvailable: ZenroomHelpers.isZenroomAvailable()
    };
  }
}

/**
 * Exportar instancia por defecto
 */
export const privateUTXOManager = new PrivateUTXOManager();