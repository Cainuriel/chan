// place files you want to import through the `$lib` alias in this folder.
/**
 * @fileoverview PrivateUTXOManager - Extensión de UTXOLibrary con BBS+ y Coconut ZKP
 * @description Implementa privacidad real usando BBS+ signatures y Coconut credentials
 */

import { ethers, toBigInt, type BigNumberish } from 'ethers';
import { UTXOLibrary } from './UTXOLibrary';
import { ZenroomHelpers } from './../utils/zenroom.helpers';
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
   * Crear UTXO privado con BBS+ credential usando depositAsPrivateUTXO
   */
  async createPrivateUTXO(params: CreateUTXOParams): Promise<UTXOOperationResult> {
    this.ensureInitialized();
    console.log('🔐 Creating private UTXO with BBS+ credential...');

    try {
      const { amount, tokenAddress, owner } = params;
      
      // Verificar que tengamos issuer configurado
      const issuerKey = this.bbsIssuerKeys.get(tokenAddress);
      const verificationKey = this.bbsVerificationKeys.get(tokenAddress);
      
      if (!issuerKey || !verificationKey) {
        throw new Error(`BBS+ issuer not configured for token ${tokenAddress}`);
      }

      // 1. Generar atributos para BBS+ credential
      const nonce = await ZenroomHelpers.generateSecureNonce();
      const attributes: BBSCredentialAttributes = {
        value: amount.toString(),
        owner: owner,
        tokenAddress: tokenAddress,
        nonce: nonce,
        timestamp: Date.now(),
        utxoType: UTXOType.DEPOSIT
      };

      // 2. Crear BBS+ credential
      const credential = await this.createBBSCredential(
        attributes,
        issuerKey,
        verificationKey
      );

      // 3. Generar commitment Pedersen para cantidad
      const blindingFactor = await ZenroomHelpers.generateSecureNonce();
      const commitment = await ZenroomHelpers.createPedersenCommitment(
        amount.toString(),
        blindingFactor
      );

      // 4. Generar nullifier hash
      const nullifierHash = await ZenroomHelpers.generateNullifierHash(
        commitment.pedersen_commitment,
        owner, // En un sistema real esto sería la clave privada del owner
        nonce
      );

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
        proof: depositProof.proof,
        disclosedAttributes: Object.values(depositProof.revealedAttributes),
        disclosureIndexes: [BigInt(1), BigInt(2), BigInt(5)], // indices de owner, tokenAddress, utxoType
        challenge: ethers.keccak256(ethers.toUtf8Bytes(`deposit:${amount}:${tokenAddress}:${owner}`)),
        timestamp: BigInt(Date.now())
      };

      // 8. Ejecutar transacción usando el nuevo método depositAsPrivateUTXO
      const tx = await this.contract!.depositAsPrivateUTXO(
        tokenAddress,
        commitment.pedersen_commitment,
        bbsProofData,
        nullifierHash,
        rangeProof,
        { gasLimit: this.config.defaultGasLimit }
      );

      const receipt = await tx.wait();

      // 9. Crear UTXO privado local
      const utxoId = await ZenroomHelpers.generateUTXOId(
        commitment.pedersen_commitment,
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
        commitment: commitment.pedersen_commitment,
        parentUTXO: '',
        utxoType: UTXOType.DEPOSIT,
        blindingFactor: blindingFactor,
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

      // Crear nuevos atributos para el destinatario
      const newNonce = await ZenroomHelpers.generateSecureNonce();
      const newAttributes: BBSCredentialAttributes = {
        ...credential.attributes,
        owner: newOwner,
        nonce: newNonce,
        timestamp: Date.now(),
        utxoType: UTXOType.TRANSFER
      };

      // Crear nueva credencial BBS+
      const issuerKey = this.bbsIssuerKeys.get(utxo.tokenAddress)!;
      const verificationKey = this.bbsVerificationKeys.get(utxo.tokenAddress)!;
      
      const newCredential = await this.createBBSCredential(
        newAttributes,
        issuerKey,
        verificationKey
      );

      // Generar nuevo commitment
      const newBlindingFactor = await ZenroomHelpers.generateSecureNonce();
      const newCommitment = await ZenroomHelpers.createPedersenCommitment(
        utxo.value.toString(),
        newBlindingFactor
      );

      // Generar nullifier hash para prevenir double-spending
      const nullifierHash = await ZenroomHelpers.generateNullifierHash(
        utxo.commitment,
        utxo.owner, // En un sistema real sería la clave privada
        credential.attributes.nonce
      );

      // Crear prueba de transferencia
      const transferProof = await this.createBBSProof({
        credential: credential,
        reveal: ['tokenAddress'], // Solo revelar tipo de token
        predicates: {
          'value': { gte: '0' }
        },
        challenge: ethers.keccak256(ethers.toUtf8Bytes(`transfer:${utxoId}:${newOwner}`))
      });

      // Preparar BBSProofDataContract
      const bbsProofData: BBSProofDataContract = {
        proof: transferProof.proof,
        disclosedAttributes: Object.values(transferProof.revealedAttributes),
        disclosureIndexes: [BigInt(2)], // índice de tokenAddress
        challenge: ethers.keccak256(ethers.toUtf8Bytes(`transfer:${utxoId}:${newOwner}`)),
        timestamp: BigInt(Date.now())
      };

      // Ejecutar transacción usando transferPrivateUTXO
      const tx = await this.contract!.transferPrivateUTXO(
        utxo.commitment,
        newCommitment.pedersen_commitment,
        bbsProofData,
        newOwner,
        nullifierHash,
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
        const outputAttributes: BBSCredentialAttributes = {
          value: outputValues[i].toString(),
          owner: outputOwners[i],
          tokenAddress: inputUTXO.tokenAddress,
          nonce: await ZenroomHelpers.generateSecureNonce(),
          timestamp: Date.now(),
          utxoType: UTXOType.SPLIT
        };

        const outputCredential = await this.createBBSCredential(
          outputAttributes,
          issuerKey,
          verificationKey
        );

        const blindingFactor = await ZenroomHelpers.generateSecureNonce();
        const commitment = await ZenroomHelpers.createPedersenCommitment(
          outputValues[i].toString(),
          blindingFactor
        );

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
        proof: splitProof.proof,
        disclosedAttributes: Object.values(splitProof.revealedAttributes),
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
        proof: withdrawProof.proof,
        disclosedAttributes: Object.values(withdrawProof.revealedAttributes),
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
  // MÉTODOS AUXILIARES
  // ========================

  /**
   * Crear credencial BBS+ con atributos especificados
   */
  private async createBBSCredential(
    attributes: BBSCredentialAttributes,
    issuerPrivateKey: string,
    issuerPublicKey: string
  ): Promise<BBSCredential> {
    const attributeArray = [
      attributes.value,
      attributes.owner,
      attributes.tokenAddress,
      attributes.nonce,
      attributes.timestamp.toString(),
      attributes.utxoType.toString()
    ];

    const signature = await ZenroomHelpers.signBBSCredential(
      attributeArray,
      issuerPrivateKey
    );

    const credentialId = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify(attributes))
    );

    return {
      signature,
      attributes,
      issuerPubKey: issuerPublicKey,
      credentialId
    };
  }

  /**
   * Crear prueba BBS+ con revelación selectiva
   */
  private async createBBSProof(request: BBSProofRequest): Promise<BBSProof> {
    const attributeArray = [
      request.credential.attributes.value,
      request.credential.attributes.owner,
      request.credential.attributes.tokenAddress,
      request.credential.attributes.nonce,
      request.credential.attributes.timestamp.toString(),
      request.credential.attributes.utxoType.toString()
    ];

    const attributeNames = ['value', 'owner', 'tokenAddress', 'nonce', 'timestamp', 'utxoType'];
    const revealIndices = request.reveal.map(name => attributeNames.indexOf(name));

    const proof = await ZenroomHelpers.createBBSProof({
      signature: request.credential.signature,
      attributes: attributeArray,
      revealIndices,
      predicates: request.predicates,
      challenge: request.challenge
    });

    // Construir atributos revelados
    const revealedAttributes: { [key: string]: string } = {};
    request.reveal.forEach(name => {
      const index = attributeNames.indexOf(name);
      if (index !== -1) {
        revealedAttributes[name] = attributeArray[index];
      }
    });

    return {
      proof: proof.proof,
      revealedAttributes,
      predicateProofs: proof.predicateProofs || [],
      challenge: request.challenge || ''
    };
  }

  /**
   * Obtener UTXOs privados del propietario
   */
  getPrivateUTXOsByOwner(owner?: string): PrivateUTXO[] {
    const targetOwner = owner || this.currentEOA?.address;
    if (!targetOwner) {
      throw new Error('No owner specified and no EOA connected');
    }

    return Array.from(this.utxos.values())
      .filter((utxo): utxo is PrivateUTXO => {
        if (!utxo || typeof utxo !== 'object') return false;
        const privateUTXO = utxo as any;
        return (
          'isPrivate' in privateUTXO && 
          privateUTXO.isPrivate === true && 
          privateUTXO.owner === targetOwner && 
          !privateUTXO.isSpent
        );
      });
  }

  /**
   * Obtener balance privado agregado (sin revelar UTXOs individuales)
   */
  getPrivateBalance(tokenAddress?: string): bigint {
    const privateUTXOs = this.getPrivateUTXOsByOwner();
    
    return privateUTXOs
      .filter(utxo => !tokenAddress || utxo.tokenAddress === tokenAddress)
      .reduce((sum, utxo) => sum + utxo.value, BigInt(0));
  }

  /**
   * Verificar prueba BBS+ sin revelar contenido
   */
  async verifyBBSProof(
    proof: string,
    revealedAttributes: { [key: string]: string },
    issuerPublicKey: string
  ): Promise<boolean> {
    try {
      return await ZenroomHelpers.verifyBBSProof({
        proof,
        revealedAttributes,
        issuerPublicKey
      });
    } catch (error) {
      console.error('❌ BBS+ proof verification failed:', error);
      return false;
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
}

/**
 * Exportar instancia por defecto
 */
export const privateUTXOManager = new PrivateUTXOManager();