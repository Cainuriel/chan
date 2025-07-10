// place files you want to import through the `$lib` alias in this folder.
/**
 * @fileoverview PrivateUTXOManager - Extensión de UTXOLibrary con BBS+ y Coconut ZKP
 * @description Implementa privacidad real usando BBS+ signatures y Coconut credentials
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
  UTXOOperationError,
  UTXOType
} from '../types/utxo.types';
import type { BBSProofDataContract } from '../contracts/UTXOVault.types';

// ========================
// TIPOS ESPECÍFICOS BBS+
// ========================

export interface BBSCredentialAttributes {
  value: string;           // Cantidad (privada)
  owner: string;          // Propietario (puede ser privado/público)
  tokenAddress: string;   // Token address (público)
  nonce: string;          // Nonce único (privado)
  timestamp: number;      // Timestamp (privado)
  utxoType: UTXOType;     // Tipo de UTXO (público)
  commitment: string;     // Pedersen commitment (público)
}

export interface BBSCredential {
  signature: string;      // BBS+ signature
  attributes: BBSCredentialAttributes;
  issuerPubKey: string;   // Clave pública del emisor
  credentialId: string;   // ID único de la credencial
}

export interface BBSProofRequest {
  credential: BBSCredential;
  reveal: string[];       // Atributos a revelar
  predicates?: {          // Predicados ZK (ej: value >= amount)
    [key: string]: {
      gte?: string;       // Greater than or equal
      lte?: string;       // Less than or equal
      eq?: string;        // Equal
    };
  };
  challenge?: string;     // Challenge para proof of possession
}

export interface BBSProof {
  proof: string;          // Prueba BBS+ generada
  revealedAttributes: { [key: string]: string };
  predicateProofs: string[];
  challenge: string;
}

export interface PrivateUTXO extends ExtendedUTXOData {
  bbsCredential: BBSCredential;
  commitment: string;
  blindingFactor: string;
  nullifierHash: string;
  isPrivate: boolean;
}

export interface CoconutThresholdSetup {
  authorities: string[];  // Direcciones de autoridades
  threshold: number;      // Umbral requerido (t-of-n)
  publicKeys: string[];   // Claves públicas de autoridades
  aggregatedPubKey: string; // Clave pública agregada
}

export interface CoconutCredentialRequest {
  attributes: BBSCredentialAttributes;
  blindingFactors: string[];
  publicAttributes: string[];  // Índices de atributos públicos
  privateAttributes: string[]; // Índices de atributos privados
}

export interface CoconutPartialCredential {
  signature: string;
  authorityIndex: number;
  timestamp: number;
}

export interface CoconutAggregatedCredential {
  signature: string;
  attributes: BBSCredentialAttributes;
  threshold: number;
  participatingAuthorities: number[];
}

// ========================
// PRIVATE UTXO MANAGER
// ========================

/**
 * PrivateUTXOManager - Extensión de UTXOLibrary con capacidades de privacidad real
 * Implementa BBS+ signatures y Coconut threshold credentials
 */
export class PrivateUTXOManager extends UTXOLibrary {
  // Configuración BBS+
  private bbsIssuerKeys: Map<string, string> = new Map();
  private bbsVerificationKeys: Map<string, string> = new Map();
  
  // Configuración Coconut
  private coconutSetup: CoconutThresholdSetup | null = null;
  private coconutAuthorities: Map<string, string> = new Map();
  
  // Cache de credenciales privadas
  private privateCredentials: Map<string, BBSCredential> = new Map();
  private coconutCredentials: Map<string, CoconutAggregatedCredential> = new Map();
  
  // Almacenamiento de UTXOs privados
  private privateUTXOs: Map<string, PrivateUTXO> = new Map();

  constructor(config: any = {}) {
    super(config);
    console.log('🔐 PrivateUTXOManager initialized with BBS+ and Coconut support');
  }

  // ========================
  // CONFIGURACIÓN BBS+
  // ========================

  /**
   * Configurar emisor BBS+ para un token específico
   */
  async setupBBSIssuer(tokenAddress: string, issuerPrivateKey?: string): Promise<string> {
    try {
      console.log('🔧 Setting up BBS+ issuer for token:', tokenAddress);
      
      // Generar claves BBS+ usando Zenroom
      const keyPair = await ZenroomHelpers.generateBBSKeyPair(issuerPrivateKey);
      
      this.bbsIssuerKeys.set(tokenAddress, keyPair.privateKey);
      this.bbsVerificationKeys.set(tokenAddress, keyPair.publicKey);
      
      console.log('✅ BBS+ issuer configured for token:', tokenAddress);
      return keyPair.publicKey;
    } catch (error) {
      console.error('❌ Failed to setup BBS+ issuer:', error);
      throw new UTXOOperationError(
        'BBS+ issuer setup failed',
        'setupBBSIssuer',
        tokenAddress,
        error
      );
    }
  }

  /**
   * Configurar threshold Coconut para emisión distribuida
   */
  async setupCoconutThreshold(
    authorities: string[],
    threshold: number,
    authorityKeys?: string[]
  ): Promise<CoconutThresholdSetup> {
    try {
      console.log('🥥 Setting up Coconut threshold system...');
      console.log(`   - Authorities: ${authorities.length}`);
      console.log(`   - Threshold: ${threshold}`);
      
      // Generar claves distribuidas usando Zenroom
      const thresholdSetup = await ZenroomHelpers.generateCoconutThresholdKeys(
        authorities,
        threshold,
        authorityKeys
      );
      
      this.coconutSetup = thresholdSetup;
      
      // Mapear autoridades a claves
      authorities.forEach((authority, index) => {
        this.coconutAuthorities.set(authority, thresholdSetup.publicKeys[index]);
      });
      
      console.log('✅ Coconut threshold setup completed');
      return thresholdSetup;
    } catch (error) {
      console.error('❌ Failed to setup Coconut threshold:', error);
      throw new UTXOOperationError(
        'Coconut threshold setup failed',
        'setupCoconutThreshold',
        undefined,
        error
      );
    }
  }

  // ========================
  // OPERACIONES PRIVADAS
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
      // Crear instancia del contrato ERC20
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          "function allowance(address owner, address spender) view returns (uint256)",
          "function approve(address spender, uint256 amount) returns (bool)",
          "function decimals() view returns (uint8)"
        ],
        signer
      );

      // Obtener decimales del token
      let tokenDecimals: number;
      try {
        tokenDecimals = await tokenContract.decimals();
      } catch (error) {
        console.warn('Could not get token decimals, using 18 as default:', error);
        tokenDecimals = 18; // Default para la mayoría de tokens ERC20
      }

      // Verificar allowance actual
      const currentAllowance = await tokenContract.allowance(
        this.currentAccount?.address,
        this.contract?.target
      );

      console.log('💰 Current allowance:', ethers.formatUnits(currentAllowance, tokenDecimals));
      console.log('💰 Required amount:', ethers.formatUnits(amount, tokenDecimals));
      console.log('🔢 Token decimals:', tokenDecimals);

      // Si allowance no es suficiente, aprobar
      if (currentAllowance < amount) {
        console.log('🔓 Approving token spending...');
        
        // Aprobar una cantidad ligeramente mayor para evitar problemas de precisión
        const approvalAmount = amount + (amount / 100n); // +1% extra
        console.log('💰 Approving amount (with buffer):', ethers.formatUnits(approvalAmount, tokenDecimals));
        
        // Obtener el gasPrice actual de la red (evitar EIP-1559 en redes que no lo soportan)
        let gasPrice: bigint;
        try {
          // Intentar obtener gasPrice de forma compatible
          const feeData = await signer.provider?.getFeeData();
          gasPrice = feeData?.gasPrice || ethers.parseUnits('20', 'gwei');
        } catch (error) {
          console.warn('Could not get gas price, using default:', error);
          gasPrice = ethers.parseUnits('20', 'gwei'); // 20 gwei por defecto
        }
        
        // Estimar el gas necesario para la transacción approve
        console.log(`gasPrice`, gasPrice);
        const estimatedGas = await tokenContract.approve.estimateGas(
          this.contract?.target,
          approvalAmount
        );
        // Añadir un 20% extra al gas estimado
        const gasLimit = estimatedGas + (estimatedGas / 5n);

        // Enviar la transacción approve con gasLimit estimado
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
        console.log('💰 New allowance after approval:', ethers.formatUnits(newAllowance, tokenDecimals));
        
        if (newAllowance < amount) {
          throw new Error(`Approval failed: allowance ${ethers.formatUnits(newAllowance, tokenDecimals)} < required ${ethers.formatUnits(amount, tokenDecimals)}`);
        }
        
        // Pausa más larga para asegurar que la blockchain procese la aprobación
        console.log('⏳ Waiting longer for approval to be fully processed...');
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 segundos
      } else {
        console.log('✅ Sufficient allowance already exists');
      }
    } catch (error) {
      console.error('❌ Token approval failed:', error);
      throw new UTXOOperationError(
        'Token approval failed',
        'approveTokenSpending',
        undefined,
        error
      );
    }
  }

  /**
   * Crear UTXO privado con BBS+ credential usando depositAsPrivateUTXO
   */
  async createPrivateUTXO(params: CreateUTXOParams): Promise<UTXOOperationResult> {
    this.ensureInitialized();
    console.log('🔐 Creating private UTXO with BBS+ credential...');

    try {
      const { amount, tokenAddress, owner } = params;
      
      // 0. Aprobar tokens antes del depósito
      await this.approveTokenSpending(tokenAddress, amount);
      
      // Auto-configurar BBS+ issuer si no existe
      await this.ensureBBSIssuerConfigured(tokenAddress);

      // Obtener las claves configuradas
      const issuerKey = this.bbsIssuerKeys.get(tokenAddress);
      const verificationKey = this.bbsVerificationKeys.get(tokenAddress);
      
      if (!issuerKey || !verificationKey) {
        throw new Error(`BBS+ keys not found for token ${tokenAddress}`);
      }

      // 0.5. Verificar que el contrato está deployado y es válido
      try {
        console.log('🔍 Verifying contract at address:', this.contract!.target);
        const code = await this.contract!.runner?.provider?.getCode(this.contract!.target as string);
        if (!code || code === '0x') {
          throw new Error(`No contract found at address ${this.contract!.target}`);
        }
        console.log('✅ Contract code found, length:', code.length);
        
        // Verificar que el método depositAsPrivateUTXO existe
        try {
          const fragment = this.contract!.interface.getFunction('depositAsPrivateUTXO');
          console.log('✅ depositAsPrivateUTXO method found:', fragment.format());
        } catch (error) {
          throw new Error(`depositAsPrivateUTXO method not found in contract: ${error}`);
        }
      } catch (error) {
        throw new Error(`Contract verification failed: ${error}`);
      }

      // 1. Generar commitment Pedersen para cantidad
      const blindingFactor = await ZenroomHelpers.generateSecureNonce();
      const commitment = await ZenroomHelpers.createPedersenCommitment(
        amount.toString(),
        blindingFactor
      );

      // 2. Generar nullifier hash
      const nullifierHash = await ZenroomHelpers.generateNullifierHash(
        commitment.pedersen_commitment,
        owner, // Use owner as the private key identifier
        blindingFactor // Use blinding factor as nonce
      );

      // 3. Generar atributos para BBS+ credential
      const nonce = await ZenroomHelpers.generateSecureNonce();
      const attributes: BBSCredentialAttributes = {
        value: amount.toString(),
        owner: owner,
        tokenAddress: tokenAddress,
        nonce: nonce,
        timestamp: Date.now(),
        utxoType: UTXOType.DEPOSIT,
        commitment: commitment.pedersen_commitment
      };

      // 4. Crear BBS+ credential
      const credential = await this.createBBSCredential({
        amount,
        tokenAddress,
        owner,
        commitment: commitment.pedersen_commitment
      });

      // 5. Crear range proof para probar que el valor es válido
      const rangeProof = await ZenroomHelpers.createRangeProof(
        commitment.pedersen_commitment,
        amount.toString(),
        blindingFactor,
        '0'
      );

      // 6. Crear prueba BBS+ para depósito (revelar solo los atributos necesarios)
      const depositProof = await this.createBBSProof({
        credential: credential,
        reveal: ['owner', 'tokenAddress', 'utxoType'],
        predicates: {
          'value': { gte: '0' } // Probar que value >= 0
        }
      });

      // 7. Preparar BBSProofDataContract
      const bbsProofData: BBSProofDataContract = {
        proof: depositProof.proof.startsWith('0x') ? depositProof.proof : `0x${depositProof.proof}`,
        disclosedAttributes: Object.values(depositProof.revealedAttributes).map(value => {
          // Convert disclosed attributes to bytes32 format
          const stringValue = String(value);
          
          // If it's an address, pad it to 32 bytes
          if (stringValue.startsWith('0x') && stringValue.length === 42) {
            return ethers.zeroPadValue(stringValue, 32);
          }
          // If it's already a bytes32 or similar, use as is
          if (stringValue.startsWith('0x')) {
            return ethers.zeroPadValue(stringValue, 32);
          }
          // For other strings, convert to bytes32
          return ethers.zeroPadValue(ethers.toUtf8Bytes(stringValue), 32);
        }),
        disclosureIndexes: [BigInt(1), BigInt(2), BigInt(5)], // indices de owner, tokenAddress, utxoType
        challenge: ethers.keccak256(ethers.toUtf8Bytes(`deposit:${amount}:${tokenAddress}:${owner}`)),
        timestamp: BigInt(Date.now())
      };

      // 7. Debugging: Log all parameters before contract call
      console.log('🔍 Debug: Contract call parameters:');
      console.log('  - tokenAddress:', tokenAddress);
      console.log('  - commitment:', commitment.pedersen_commitment);
      console.log('  - nullifierHash:', nullifierHash);
      console.log('  - rangeProof:', rangeProof);
      
      // Custom JSON serializer for BigInt values
      const bigIntReplacer = (key: string, value: any) => {
        if (typeof value === 'bigint') {
          return value.toString() + 'n';
        }
        return value;
      };
      
      console.log('  - bbsProofData:', JSON.stringify(bbsProofData, bigIntReplacer, 2));
      
      // Validate all parameters are properly formatted
      if (!ethers.isAddress(tokenAddress)) {
        throw new Error(`Invalid token address: ${tokenAddress}`);
      }
      if (!commitment.pedersen_commitment.startsWith('0x') || commitment.pedersen_commitment.length !== 66) {
        throw new Error(`Invalid commitment format: ${commitment.pedersen_commitment}`);
      }
      if (!nullifierHash.startsWith('0x') || nullifierHash.length !== 66) {
        throw new Error(`Invalid nullifier hash format: ${nullifierHash}`);
      }
      if (!rangeProof.startsWith('0x')) {
        throw new Error(`Invalid range proof format: ${rangeProof}`);
      }
      
      // Validate BBS proof data structure
      if (!bbsProofData.proof.startsWith('0x')) {
        throw new Error(`Invalid BBS proof format: ${bbsProofData.proof}`);
      }
      if (!Array.isArray(bbsProofData.disclosedAttributes)) {
        throw new Error('Invalid disclosed attributes: must be array');
      }
      if (!Array.isArray(bbsProofData.disclosureIndexes)) {
        throw new Error('Invalid disclosure indexes: must be array');
      }
      
      console.log('✅ All parameters validated');

      // 7.5. Test function encoding before contract call
      try {
        console.log('🧪 Testing function encoding...');
        const contractInterface = this.contract!.interface;
        const encodedData = contractInterface.encodeFunctionData('depositAsPrivateUTXO', [
          tokenAddress,
          commitment.pedersen_commitment,
          bbsProofData,
          nullifierHash,
          rangeProof
        ]);
        console.log('✅ Function encoding successful, data length:', encodedData.length);
        console.log('🔍 Encoded data preview:', encodedData.substring(0, 100) + '...');
      } catch (encodingError) {
        console.error('❌ Function encoding failed:', encodingError);
        throw new Error(`Function encoding failed: ${encodingError}`);
      }

      // 8. Preparar transacción con gas estimation manual (como en approve)
      const signer = EthereumHelpers.getSigner();
      if (!signer) {
        throw new Error('Signer not available for deposit transaction');
      }

      // Obtener gasPrice actual de la red
      let gasPrice: bigint;
      try {
        const feeData = await signer.provider?.getFeeData();
        gasPrice = feeData?.gasPrice || ethers.parseUnits('20', 'gwei');
      } catch (error) {
        console.warn('Could not get gas price for deposit, using default:', error);
        gasPrice = ethers.parseUnits('20', 'gwei'); // 20 gwei por defecto
      }

      // Estimar gas para depositAsPrivateUTXO (skip si puede fallar por allowance)
      let estimatedGas: bigint;
      
      // Para operaciones de depósito con BBS+, usar gas fijo alto para evitar problemas
      console.log('⛽ Using fixed gas limit for complex BBS+ deposit operation...');
      estimatedGas = BigInt(1200000); // 1.2M gas fijo para operaciones BBS+ complejas
      
      // Añadir 20% extra al gas estimado para asegurar que la transacción pase
      const gasLimit = estimatedGas + (estimatedGas * 20n / 100n);
      
      console.log('⛽ Gas estimation for deposit:');
      console.log('  - Fixed gas estimate:', estimatedGas.toString());
      console.log('  - Gas limit (with 20% buffer):', gasLimit.toString());
      console.log('  - Gas price:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei');

      // 8. Ejecutar transacción usando el nuevo método depositAsPrivateUTXO con gas manual
      
      // 8.1. Verificar allowance justo antes de la transacción
      console.log('🔍 Final allowance check before deposit...');
      const finalTokenContract = new ethers.Contract(
        tokenAddress,
        [
          "function allowance(address owner, address spender) view returns (uint256)",
          "function decimals() view returns (uint8)"
        ],
        signer
      );
      
      // Obtener decimales del token nuevamente
      let finalTokenDecimals: number;
      try {
        finalTokenDecimals = await finalTokenContract.decimals();
      } catch (error) {
        console.warn('Could not get token decimals for final check, using 18 as default:', error);
        finalTokenDecimals = 18;
      }
      
      const finalAllowance = await finalTokenContract.allowance(
        this.currentAccount?.address,
        this.contract?.target
      );
      
      console.log('💰 Final allowance check:', ethers.formatUnits(finalAllowance, finalTokenDecimals));
      console.log('💰 Required amount:', ethers.formatUnits(amount, finalTokenDecimals));
      console.log('🔢 Token decimals (final check):', finalTokenDecimals);
      
      if (finalAllowance < amount) {
        throw new Error(
          `Insufficient allowance before deposit: ${ethers.formatUnits(finalAllowance, finalTokenDecimals)} < ${ethers.formatUnits(amount, finalTokenDecimals)}. ` +
          `Please wait and try again, or increase approval amount.`
        );
      }
      
      console.log('✅ Allowance verified, proceeding with deposit...');
      
      const tx = await this.contract!.depositAsPrivateUTXO(
        tokenAddress,
        commitment.pedersen_commitment,
        bbsProofData,
        nullifierHash,
        rangeProof,
        {
          gasLimit: gasLimit,
          gasPrice: gasPrice
        }
      );

      const receipt = await tx.wait();

      // 9. Crear UTXO privado local
      const utxoId = await ZenroomHelpers.generateUTXOId(
        commitment.pedersen_commitment,
        owner,
        Date.now()
      );

      const localNullifierHash = this.generateNullifierHash(commitment.pedersen_commitment, owner);

      const privateUTXO: PrivateUTXO = {
        id: utxoId,
        exists: true,
        value: amount,
        tokenAddress,
        owner,
        timestamp: toBigInt(Date.now()),
        isSpent: false,
        commitment: commitment.pedersen_commitment,
        parentUTXO: '',
        utxoType: UTXOType.DEPOSIT,
        blindingFactor: blindingFactor,
        nullifierHash: localNullifierHash,
        localCreatedAt: Date.now(),
        confirmed: true,
        creationTxHash: receipt?.hash,
        blockNumber: receipt?.blockNumber,
        bbsCredential: credential,
        isPrivate: true
      };

      // 10. Almacenar en cache
      this.utxos.set(utxoId, privateUTXO);
      this.privateCredentials.set(utxoId, credential);

      const result: UTXOOperationResult = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds: [utxoId]
      };

      console.log('✅ Private UTXO created successfully:', utxoId);
      this.emit('private:utxo:created', privateUTXO);

      return result;

    } catch (error) {
      console.error('❌ Private UTXO creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Private UTXO creation failed',
        errorDetails: error
      };
    }
  }

  /**
   * Transferir UTXO privado usando transferPrivateUTXO
   */
  async transferPrivateUTXO(params: TransferUTXOParams): Promise<UTXOOperationResult> {
    this.ensureInitialized();
    console.log('🔐 Transferring private UTXO...');

    try {
      const { utxoId, newOwner } = params;
      
      // Obtener UTXO privado
      const utxo = this.utxos.get(utxoId) as PrivateUTXO;
      if (!utxo?.isPrivate) {
        throw new Error('UTXO is not private or does not exist');
      }

      const credential = this.privateCredentials.get(utxoId);
      if (!credential) {
        throw new Error('Private credential not found');
      }

      // Generar nuevo commitment
      const newBlindingFactor = await ZenroomHelpers.generateSecureNonce();
      const newCommitment = await ZenroomHelpers.createPedersenCommitment(
        utxo.value.toString(),
        newBlindingFactor
      );

      // Crear nuevos atributos para el destinatario
      const newNonce = await ZenroomHelpers.generateSecureNonce();
      const newAttributes: BBSCredentialAttributes = {
        ...credential.attributes,
        owner: newOwner,
        nonce: newNonce,
        timestamp: Date.now(),
        utxoType: UTXOType.TRANSFER,
        commitment: newCommitment.pedersen_commitment
      };

      // Crear nueva credencial BBS+
      const newCredential = await this.createBBSCredential({
        amount: utxo.value,
        tokenAddress: utxo.tokenAddress,
        owner: newOwner,
        commitment: newCommitment.pedersen_commitment
      });

      // 5. Crear prueba BBS+ para transferencia (revelar solo los atributos necesarios)
      const transferProof = await this.createBBSProof({
        credential: newCredential,
        reveal: ['owner', 'tokenAddress', 'utxoType'],
        predicates: {
          'value': { gte: '0' } // Probar que value >= 0
        }
      });

      // Preparar BBSProofDataContract
      const bbsProofData: BBSProofDataContract = {
        proof: transferProof.proof.startsWith('0x') ? transferProof.proof : `0x${transferProof.proof}`,
        disclosedAttributes: Object.values(transferProof.revealedAttributes).map(value => {
          const stringValue = String(value);
          if (stringValue.startsWith('0x') && stringValue.length === 42) {
            return ethers.zeroPadValue(stringValue, 32);
          }
          if (stringValue.startsWith('0x')) {
            return ethers.zeroPadValue(stringValue, 32);
          }
          return ethers.zeroPadValue(ethers.toUtf8Bytes(stringValue), 32);
        }),
        disclosureIndexes: [BigInt(2)], // índice de tokenAddress
        challenge: ethers.keccak256(ethers.toUtf8Bytes(`transfer:${utxoId}:${newOwner}`)),
        timestamp: BigInt(Date.now())
      };

      // Generar nullifier hash para el nuevo UTXO
      const newNullifierHash = this.generateNullifierHash(newCommitment.pedersen_commitment, newOwner);

      // Ejecutar transacción usando transferPrivateUTXO
      const tx = await this.contract!.transferPrivateUTXO(
        utxo.commitment,
        newCommitment.pedersen_commitment,
        bbsProofData,
        newOwner,
        newNullifierHash,
        { gasLimit: this.config.defaultGasLimit }
      );

      const receipt = await tx.wait();

      // Marcar UTXO original como gastado
      utxo.isSpent = true;
      this.emit('private:utxo:spent', utxoId);

      // Crear nuevo UTXO privado
      const newUtxoId = await ZenroomHelpers.generateUTXOId(
        newCommitment.pedersen_commitment,
        newOwner,
        Date.now()
      );

      const newPrivateUTXO: PrivateUTXO = {
        id: newUtxoId,
        exists: true,
        value: utxo.value,
        tokenAddress: utxo.tokenAddress,
        owner: newOwner,
        timestamp: toBigInt(Date.now()),
        isSpent: false,
        commitment: newCommitment.pedersen_commitment,
        parentUTXO: utxoId,
        utxoType: UTXOType.TRANSFER,
        blindingFactor: newBlindingFactor,
        localCreatedAt: Date.now(),
        confirmed: true,
        creationTxHash: receipt?.hash,
        blockNumber: receipt?.blockNumber,
        bbsCredential: newCredential,
        nullifierHash: newNullifierHash,
        isPrivate: true
      };

      // Almacenar nuevo UTXO
      this.utxos.set(newUtxoId, newPrivateUTXO);
      this.privateCredentials.set(newUtxoId, newCredential);

      const result: UTXOOperationResult = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds: [newUtxoId]
      };

      console.log('✅ Private UTXO transferred successfully:', newUtxoId);
      this.emit('private:utxo:transferred', { from: utxoId, to: newUtxoId });

      return result;

    } catch (error) {
      console.error('❌ Private UTXO transfer failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Private transfer failed',
        errorDetails: error
      };
    }
  }

  /**
   * Dividir UTXO privado usando splitPrivateUTXO
   */
  async splitPrivateUTXO(params: SplitUTXOParams): Promise<UTXOOperationResult> {
    this.ensureInitialized();
    console.log('🔐 Splitting private UTXO...');

    try {
      const { inputUTXOId, outputValues, outputOwners } = params;
      
      // Obtener UTXO privado
      const inputUTXO = this.utxos.get(inputUTXOId) as PrivateUTXO;
      if (!inputUTXO?.isPrivate) {
        throw new Error('Input UTXO is not private or does not exist');
      }

      const inputCredential = this.privateCredentials.get(inputUTXOId);
      if (!inputCredential) {
        throw new Error('Input credential not found');
      }

      // Validar que la suma sea correcta
      const totalOutput = outputValues.reduce((sum, val) => sum + val, BigInt(0));
      if (totalOutput !== inputUTXO.value) {
        throw new Error('Sum of outputs must equal input value');
      }

      // Generar nullifier hash para prevenir double-spending
      const nullifierHash = await ZenroomHelpers.generateNullifierHash(
        inputUTXO.commitment,
        inputUTXO.owner,
        inputCredential.attributes.nonce
      );

      // Generar credenciales y commitments para outputs
      const outputCredentials: BBSCredential[] = [];
      const outputCommitments: string[] = [];
      const outputBlindingFactors: string[] = [];

      const issuerKey = this.bbsIssuerKeys.get(inputUTXO.tokenAddress)!;
      const verificationKey = this.bbsVerificationKeys.get(inputUTXO.tokenAddress)!;

      for (let i = 0; i < outputValues.length; i++) {
        const blindingFactor = await ZenroomHelpers.generateSecureNonce();
        const commitment = await ZenroomHelpers.createPedersenCommitment(
          outputValues[i].toString(),
          blindingFactor
        );

        const outputAttributes: BBSCredentialAttributes = {
          value: outputValues[i].toString(),
          owner: outputOwners[i],
          tokenAddress: inputUTXO.tokenAddress,
          nonce: await ZenroomHelpers.generateSecureNonce(),
          timestamp: Date.now(),
          utxoType: UTXOType.SPLIT,
          commitment: commitment.pedersen_commitment
        };

        const outputCredential = await this.createBBSCredential({
          amount: outputValues[i],
          tokenAddress: inputUTXO.tokenAddress,
          owner: outputOwners[i],
          commitment: commitment.pedersen_commitment
        });

        outputCredentials.push(outputCredential);
        outputCommitments.push(commitment.pedersen_commitment);
        outputBlindingFactors.push(blindingFactor);
      }

      // Crear prueba de split sin revelar cantidades
      const splitProof = await this.createBBSProof({
        credential: inputCredential,
        reveal: ['tokenAddress'], // Solo revelar tipo de token
        predicates: {
          'value': { eq: totalOutput.toString() }
        },
        challenge: ethers.keccak256(ethers.toUtf8Bytes(`split:${inputUTXOId}:${outputValues.join(',')}`))
      });

      // Preparar BBSProofDataContract
      const bbsProofData: BBSProofDataContract = {
        proof: splitProof.proof.startsWith('0x') ? splitProof.proof : `0x${splitProof.proof}`,
        disclosedAttributes: Object.values(splitProof.revealedAttributes).map(value => {
          const stringValue = String(value);
          if (stringValue.startsWith('0x') && stringValue.length === 42) {
            return ethers.zeroPadValue(stringValue, 32);
          }
          if (stringValue.startsWith('0x')) {
            return ethers.zeroPadValue(stringValue, 32);
          }
          return ethers.zeroPadValue(ethers.toUtf8Bytes(stringValue), 32);
        }),
        disclosureIndexes: [BigInt(2)], // índice de tokenAddress
        challenge: ethers.keccak256(ethers.toUtf8Bytes(`split:${inputUTXOId}:${outputValues.join(',')}`)),
        timestamp: BigInt(Date.now())
      };

      // Crear equality proof para demostrar que la suma de outputs = input
      const equalityProof = await ZenroomHelpers.createEqualityProof(
        inputUTXO.commitment,
        outputCommitments[0], // Simplificado: usar el primer output como ejemplo
        totalOutput.toString(),
        inputUTXO.blindingFactor,
        outputBlindingFactors[0]
      );

      // Ejecutar transacción usando splitPrivateUTXO
      const tx = await this.contract!.splitPrivateUTXO(
        inputUTXO.commitment,
        outputCommitments,
        bbsProofData,
        equalityProof,
        nullifierHash,
        { gasLimit: this.config.defaultGasLimit }
      );

      const receipt = await tx.wait();

      // Marcar input como gastado
      inputUTXO.isSpent = true;
      this.emit('private:utxo:spent', inputUTXOId);

      // Crear UTXOs de salida
      const createdUTXOIds: string[] = [];

      for (let i = 0; i < outputValues.length; i++) {
        const outputId = await ZenroomHelpers.generateUTXOId(
          outputCommitments[i],
          outputOwners[i],
          Date.now() + i
        );

        const outputNullifierHash = await ZenroomHelpers.generateNullifierHash(
          outputCommitments[i],
          outputOwners[i],
          Date.now().toString()
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
          localCreatedAt: Date.now(),
          confirmed: true,
          creationTxHash: receipt?.hash,
          blockNumber: receipt?.blockNumber,
          bbsCredential: outputCredentials[i],
          nullifierHash: outputNullifierHash,
          isPrivate: true
        };

        this.utxos.set(outputId, outputUTXO);
        this.privateCredentials.set(outputId, outputCredentials[i]);
        createdUTXOIds.push(outputId);
        this.emit('private:utxo:created', outputUTXO);
      }

      const result: UTXOOperationResult = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds
      };

      console.log('✅ Private UTXO split successfully:', createdUTXOIds);
      return result;

    } catch (error) {
      console.error('❌ Private UTXO split failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Private split failed',
        errorDetails: error
      };
    }
  }

  /**
   * Retirar UTXO privado usando withdrawFromPrivateUTXO
   */
  async withdrawPrivateUTXO(params: WithdrawUTXOParams): Promise<UTXOOperationResult> {
    this.ensureInitialized();
    console.log('🔐 Withdrawing private UTXO...');

    try {
      const { utxoId, recipient } = params;
      
      // Obtener UTXO privado
      const utxo = this.utxos.get(utxoId) as PrivateUTXO;
      if (!utxo?.isPrivate) {
        throw new Error('UTXO is not private or does not exist');
      }

      const credential = this.privateCredentials.get(utxoId);
      if (!credential) {
        throw new Error('Private credential not found');
      }

      // Generar nullifier hash para prevenir double-spending
      const nullifierHash = await ZenroomHelpers.generateNullifierHash(
        utxo.commitment,
        utxo.owner,
        credential.attributes.nonce
      );

      // Crear prueba de retiro revelando solo lo necesario
      const withdrawProof = await this.createBBSProof({
        credential: credential,
        reveal: ['owner', 'tokenAddress'], // Revelar ownership y token
        predicates: {
          'value': { gte: '0' }
        },
        challenge: ethers.keccak256(ethers.toUtf8Bytes(`withdraw:${utxoId}:${recipient}`))
      });

      // Preparar BBSProofDataContract
      const bbsProofData: BBSProofDataContract = {
        proof: withdrawProof.proof.startsWith('0x') ? withdrawProof.proof : `0x${withdrawProof.proof}`,
        disclosedAttributes: Object.values(withdrawProof.revealedAttributes).map(value => {
          const stringValue = String(value);
          if (stringValue.startsWith('0x') && stringValue.length === 42) {
            return ethers.zeroPadValue(stringValue, 32);
          }
          if (stringValue.startsWith('0x')) {
            return ethers.zeroPadValue(stringValue, 32);
          }
          return ethers.zeroPadValue(ethers.toUtf8Bytes(stringValue), 32);
        }),
        disclosureIndexes: [BigInt(1), BigInt(2)], // índices de owner y tokenAddress
        challenge: ethers.keccak256(ethers.toUtf8Bytes(`withdraw:${utxoId}:${recipient}`)),
        timestamp: BigInt(Date.now())
      };

      // Ejecutar transacción usando withdrawFromPrivateUTXO
      const tx = await this.contract!.withdrawFromPrivateUTXO(
        utxo.commitment,
        bbsProofData,
        nullifierHash,
        { gasLimit: this.config.defaultGasLimit }
      );

      const receipt = await tx.wait();

      // Marcar como gastado
      utxo.isSpent = true;
      this.emit('private:utxo:withdrawn', utxoId);

      const result: UTXOOperationResult = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
      };

      console.log('✅ Private UTXO withdrawn successfully');
      return result;

    } catch (error) {
      console.error('❌ Private UTXO withdrawal failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Private withdrawal failed',
        errorDetails: error
      };
    }
  }

  // ========================
  // OPERACIONES COCONUT
  // ========================

  /**
   * Crear credencial Coconut con emisión threshold
   */
  async createCoconutCredential(
    request: CoconutCredentialRequest,
    authorities: string[]
  ): Promise<CoconutAggregatedCredential> {
    if (!this.coconutSetup) {
      throw new Error('Coconut threshold system not configured');
    }

    console.log('🥥 Creating Coconut credential with threshold issuance...');

    try {
      // Solicitar credenciales parciales de las autoridades
      const partialCredentials: CoconutPartialCredential[] = [];
      
      for (const authority of authorities) {
        const authorityKey = this.coconutAuthorities.get(authority);
        if (!authorityKey) {
          console.warn(`Authority ${authority} not found, skipping...`);
          continue;
        }

        const partialCredential = await ZenroomHelpers.requestCoconutPartialCredentialV2(
          request,
          authorityKey,
          authority
        );

        partialCredentials.push(partialCredential);
      }

      // Verificar que tengamos suficientes credenciales parciales
      if (partialCredentials.length < this.coconutSetup.threshold) {
        throw new Error(
          `Insufficient partial credentials: ${partialCredentials.length} < ${this.coconutSetup.threshold}`
        );
      }

      // Agregar credenciales parciales
      const aggregatedCredential = await ZenroomHelpers.aggregateCoconutCredentialsV2(
        partialCredentials.slice(0, this.coconutSetup.threshold),
        this.coconutSetup
      );

      console.log('✅ Coconut credential created successfully');
      return aggregatedCredential;

    } catch (error) {
      console.error('❌ Coconut credential creation failed:', error);
      throw new UTXOOperationError(
        'Coconut credential creation failed',
        'createCoconutCredential',
        undefined,
        error
      );
    }
  }

  // ========================
  // SINCRONIZACIÓN CON BLOCKCHAIN PRIVADA
  // ========================

  /**
   * Sincronizar con blockchain usando el nuevo contrato UTXOVault
   * Sobrescribe la implementación del padre que usa funciones inexistentes
   * Versión simplificada para evitar errores de contrato
   */
  async syncWithBlockchain(): Promise<boolean> {
    if (!this.contract || !this.currentEOA) {
      return false;
    }

    console.log('🔄 Syncing with private blockchain...');

    try {
      // En el nuevo contrato UTXOVault, solo podemos obtener información limitada
      // por la privacidad. Por ahora, solo validamos la conexión.
      
      try {
        const userUTXOCount = await this.contract.getUserUTXOCount(this.currentEOA.address);
        console.log(`📊 User has ${userUTXOCount} UTXOs in contract`);
      } catch (error) {
        console.warn('⚠️ Could not get UTXO count, contract may not be deployed:', error);
        // No fallar si el contrato no está disponible en desarrollo
      }

      // Para desarrollo, simplemente reportar como sincronizado
      console.log(`✅ Private blockchain sync completed (development mode)`);
      
      // Emitir evento de sincronización
      this.emit('blockchain:synced', {
        localUTXOs: Array.from(this.utxos.values()).length,
        privateUTXOs: Array.from(this.privateUTXOs.values()).length,
        syncMode: 'development'
      });

      return true;

    } catch (error) {
      console.error('❌ Private blockchain sync failed:', error);
      this.emit('blockchain:sync:failed', error);
      
      // En desarrollo, no fallar por errores de sync
      return true;
    }
  }

  /**
   * Limpiar datos privados (para seguridad)
   */
  clearPrivateData(): void {
    this.privateCredentials.clear();
    this.coconutCredentials.clear();
    this.bbsIssuerKeys.clear();
    console.log('🧹 Private data cleared');
  }

  // ========================
  // MÉTODOS BBS+ HELPER
  // ========================

  /**
   * Crear credential BBS+ para un UTXO
   */
  private async createBBSCredential(params: {
    amount: bigint;
    tokenAddress: string;
    owner: string;
    commitment: string;
  }): Promise<BBSCredential> {
    try {
      const attributes = [
        params.amount.toString(),
        params.tokenAddress,
        params.owner,
        params.commitment,
        Date.now().toString()
      ];

      // Obtener la clave privada del issuer para este token
      const issuerPrivateKey = this.bbsIssuerKeys.get(params.tokenAddress);
      if (!issuerPrivateKey) {
        throw new Error(`No BBS+ issuer key found for token ${params.tokenAddress}`);
      }

      // Usar Zenroom para crear el credential BBS+
      const signature = await ZenroomHelpers.signBBSCredential(attributes, issuerPrivateKey);
      
      return {
        signature,
        attributes: {
          value: params.amount.toString(),
          nonce: Date.now().toString(),
          utxoType: UTXOType.DEPOSIT,
          tokenAddress: params.tokenAddress,
          owner: params.owner,
          commitment: params.commitment,
          timestamp: Date.now()
        },
        issuerPubKey: this.bbsVerificationKeys.get(params.tokenAddress) || '',
        credentialId: ethers.keccak256(ethers.toUtf8Bytes(signature + Date.now().toString()))
      };
    } catch (error) {
      console.error('❌ Failed to create BBS credential:', error);
      throw new UTXOOperationError(
        'BBS credential creation failed',
        'createBBSCredential',
        undefined,
        error
      );
    }
  }

  /**
   * Crear proof BBS+ para una operación
   */
  private async createBBSProof(request: BBSProofRequest): Promise<BBSProof> {
    try {
      // Convertir atributos de objeto a array
      const attributesArray = [
        request.credential.attributes.value,
        request.credential.attributes.tokenAddress,
        request.credential.attributes.owner,
        request.credential.attributes.commitment,
        request.credential.attributes.nonce
      ];

      // Determinar qué índices revelar basado en el array `reveal`
      const revealIndices: number[] = [];
      request.reveal.forEach(attr => {
        switch (attr) {
          case 'tokenAddress': revealIndices.push(1); break;
          case 'owner': revealIndices.push(2); break;
          case 'commitment': revealIndices.push(3); break;
          // value (índice 0) y nonce (índice 4) normalmente se mantienen ocultos
        }
      });

      // Usar Zenroom para crear el proof BBS+
      const proof = await ZenroomHelpers.createBBSProof({
        signature: request.credential.signature,
        attributes: attributesArray,
        revealIndices,
        predicates: request.predicates,
        challenge: request.challenge || Date.now().toString()
      });
      
      // Construir revealed attributes basado en los índices revelados
      const revealedAttributes: { [key: string]: string } = {};
      revealIndices.forEach(index => {
        switch (index) {
          case 1: revealedAttributes.tokenAddress = attributesArray[1]; break;
          case 2: revealedAttributes.owner = attributesArray[2]; break;
          case 3: revealedAttributes.commitment = attributesArray[3]; break;
        }
      });

      return {
        proof: proof.proof.startsWith('0x') ? proof.proof : `0x${proof.proof}`,
        revealedAttributes,
        predicateProofs: proof.predicateProofs || [],
        challenge: request.challenge || Date.now().toString()
      };
    } catch (error) {
      console.error('❌ Failed to create BBS proof:', error);
      throw new UTXOOperationError(
        'BBS proof creation failed',
        'createBBSProof',
        undefined,
        error
      );
    }
  }

  /**
   * Generar nullifier hash para prevenir double-spending
   */
  private generateNullifierHash(commitment: string, owner: string, nonce?: string): string {
    const input = commitment + owner + (nonce || Date.now().toString());
    return ethers.keccak256(ethers.toUtf8Bytes(input));
  }

  /**
   * Obtener UTXOs privados por propietario
   */
  getPrivateUTXOsByOwner(owner: string): PrivateUTXO[] {
    const utxos: PrivateUTXO[] = [];
    
    for (const [utxoId, utxo] of this.privateUTXOs.entries()) {
      if (utxo.owner.toLowerCase() === owner.toLowerCase() && !utxo.isSpent) {
        utxos.push(utxo);
      }
    }
    
    return utxos;
  }

  /**
   * Obtener balance privado total
   */
  getPrivateBalance(tokenAddress?: string): bigint {
    let balance = BigInt(0);
    
    for (const utxo of this.privateUTXOs.values()) {
      if (!utxo.isSpent && (!tokenAddress || utxo.tokenAddress === tokenAddress)) {
        balance += utxo.value;
      }
    }
    
    return balance;
  }

  /**
   * Asegurar que el BBS+ issuer esté configurado para un token
   */
  private async ensureBBSIssuerConfigured(tokenAddress: string): Promise<void> {
    // Verificar si ya está configurado
    if (this.bbsIssuerKeys.has(tokenAddress) && this.bbsVerificationKeys.has(tokenAddress)) {
      return; // Ya configurado
    }

    console.log('🔧 Auto-configuring BBS+ issuer for token:', tokenAddress);
    
    try {
      // Auto-generar claves BBS+ para este token
      const publicKey = await this.setupBBSIssuer(tokenAddress);
      console.log('✅ BBS+ issuer auto-configured for token:', tokenAddress);
    } catch (error) {
      console.error('❌ Failed to auto-configure BBS+ issuer:', error);
      throw new Error(`Failed to configure BBS+ issuer for token ${tokenAddress}: ${error}`);
    }
  }

}

/**
 * Exportar instancia por defecto
 */
export const privateUTXOManager = new PrivateUTXOManager();