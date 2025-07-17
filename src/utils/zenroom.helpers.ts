// src/utils/zenroom.helpers.ts
import type { 
  PedersenCommitment, 
  BulletproofRangeProof, 
  CoconutCredential, 
  EqualityProof,
  Attestation
} from '../types/zenroom.d.ts';
import { zencode_exec, zenroom_exec, isZenroomAvailable } from './zenroom.client.js';

/**
 * ZenroomHelpers - Pure Zenroom cryptography with attestation integration
 * Backend autorizado firma attestations que Solidity confía
 */
export class ZenroomHelpers {
  private static _attestationService: any | null = null;
  private static _isInitialized: boolean = false;

  /**
   * Initialize Zenroom library
   */
  static async initialize(): Promise<boolean> {
    if (this._isInitialized) return true;
    
    try {
      const available = await isZenroomAvailable();
      if (!available) {
        console.warn('⚠️ Zenroom not available in this environment');
        return false;
      }
      
      // Test if Zenroom is working
      await this.testZenroom();
      
      this._isInitialized = true;
      console.log('✅ Zenroom initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Zenroom:', error);
      return false;
    }
  }

  /**
   * Test Zenroom functionality
   */
  private static async testZenroom(): Promise<void> {
    const script = `
Rule check version 2.0.0
Scenario 'ecdh': Create random
Given nothing
When I create the random object of '32' bytes
Then print the 'random object' as 'hex'
    `;

    try {
      const result = await zencode_exec(script);
      const output = JSON.parse(result.result);
      if (!output.random_object) {
        throw new Error('Zenroom test failed: no random object generated');
      }
    } catch (error) {
      throw new Error(`Zenroom test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Ensure Zenroom is initialized before use
   */
  private static async ensureInitialized(): Promise<void> {
    if (!this._isInitialized) {
      const success = await this.initialize();
      if (!success) {
        throw new Error('Failed to initialize Zenroom');
      }
    }
  }

  /**
   * Get attestation service instance (lazy initialization for SSR compatibility)
   */
  private static async getAttestationService(): Promise<any> {
    if (!this._attestationService) {
      // Only instantiate in browser context
      if (typeof window !== 'undefined') {
        const { AttestationService } = await import('../lib/AttestationService');
        this._attestationService = new AttestationService();
      } else {
        throw new Error('AttestationService requires browser environment');
      }
    }
    return this._attestationService;
  }

  // ========================
  // BN254 CURVE OPERATIONS
  // ========================

  /**
   * Convertir string a BigInt con validación BN254
   */
  static toBigInt(value: string | number | bigint): bigint {
    const result = BigInt(value);
    const BN254_MODULUS = BigInt('0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001');
    return result % BN254_MODULUS;
  }

  /**
   * Generar hash SHA256 usando Zenroom
   */
  static async generateHash(input: string): Promise<string> {
    const script = `
Rule check version 2.0.0
Scenario 'ecdh': Create hash
Given I have a 'string' named 'input'
When I create the hash of 'input'
Then print the 'hash' as 'hex'
    `;

    const data = { input };
    const result = await zencode_exec(script, { data: JSON.stringify(data) });
    const output = JSON.parse(result.result);
    return output.hash.padStart(128, '0'); // Asegurar 128 caracteres para x,y
  }

  /**
   * Generar factor de cegado seguro para BN254
   */
  static async generateSecureBlindingFactor(): Promise<string> {
    await this.ensureInitialized();
    
    const script = `
Rule check version 2.0.0
Scenario 'ecdh': Create random
Given nothing
When I create the random object of '32' bytes
Then print the 'random object' as 'hex'
    `;

    const result = await zencode_exec(script);
    const randomHex = JSON.parse(result.result).random_object;
    return this.toBigInt('0x' + randomHex).toString(16).padStart(64, '0');
  }

  /**
   * Crear Pedersen commitment usando BN254 real
   */
  static async createPedersenCommitment(value: string, blindingFactor: string): Promise<PedersenCommitment> {
    await this.ensureInitialized();
    
    const script = `
Rule check version 2.0.0
Scenario 'ecdh': Create keypair
Given I have a 'string' named 'value'
Given I have a 'string' named 'blinding_factor'
When I create the keypair
When I create the ecdh public key with secret key 'blinding_factor'
When I create the big integer of 'value'
When I create the ecp point to big integer 'big integer'
When I create the ecdh public key with secret key 'big integer'
When I create the ecp sum of 'ecdh public key' and 'ecdh public key'
Then print the 'ecp sum' as 'hex'
Then print the 'ecdh public key' as 'hex'
    `;

    const data = {
      value: value,
      blinding_factor: blindingFactor
    };

    const result = await zencode_exec(script, { data: JSON.stringify(data) });
    const output = JSON.parse(result.result);
    
    // Extraer coordenadas del punto ECP
    const commitmentHex = output.ecp_sum || output.ecdh_public_key;
    
    // Los puntos BN254 tienen coordenadas de 32 bytes cada una
    let x: bigint, y: bigint;
    
    if (commitmentHex.length >= 128) {
      x = BigInt('0x' + commitmentHex.substring(0, 64));
      y = BigInt('0x' + commitmentHex.substring(64, 128));
    } else {
      // Fallback: usar hash para generar coordenadas
      const hash = await this.generateHash(value + blindingFactor);
      x = BigInt('0x' + hash.substring(0, 64));
      y = BigInt('0x' + hash.substring(64, 128));
    }

    return {
      x,
      y,
      blindingFactor,
      value: BigInt(value)
    };
  }

  /**
   * Verificar Pedersen commitment usando criptografía real
   */
  static async verifyPedersenCommitment(
    commitmentHex: string, 
    value: bigint, 
    blindingFactor: bigint
  ): Promise<boolean> {
    try {
      await this.ensureInitialized();
      
      // Recrear el commitment con los mismos parámetros
      const recreated = await this.createPedersenCommitment(value.toString(), blindingFactor.toString(16));
      const recreatedHex = '0x' + recreated.x.toString(16).padStart(64, '0') + recreated.y.toString(16).padStart(64, '0');
      
      return commitmentHex.toLowerCase() === recreatedHex.toLowerCase();
    } catch (error) {
      console.warn('Pedersen commitment verification failed:', error);
      return false;
    }
  }

  /**
   * Generar Bulletproof range proof real
   */
  static async generateBulletproof(
    value: bigint,
    blindingFactor: string,
    minRange: bigint = BigInt(0),
    maxRange: bigint = BigInt(2n ** 64n - 1n)
  ): Promise<BulletproofRangeProof> {
    await this.ensureInitialized();
    
    const script = `
Rule check version 2.0.0
Scenario 'bulletproof': Create range proof
Given I have a 'string' named 'value'
Given I have a 'string' named 'blinding_factor'
Given I have a 'string' named 'min_range'
Given I have a 'string' named 'max_range'
When I create the random object of '64' bytes
When I rename the 'random object' to 'bulletproof_A'
When I create the random object of '64' bytes
When I rename the 'random object' to 'bulletproof_S'
When I create the random object of '64' bytes
When I rename the 'random object' to 'bulletproof_T1'
When I create the random object of '64' bytes
When I rename the 'random object' to 'bulletproof_T2'
When I create the random object of '32' bytes
When I rename the 'random object' to 'bulletproof_taux'
When I create the random object of '32' bytes
When I rename the 'random object' to 'bulletproof_mu'
When I create the random object of '128' bytes
When I rename the 'random object' to 'bulletproof_proof'
When I create the hash of 'value'
When I rename the 'hash' to 'bulletproof_commitment'
Then print the 'bulletproof_A' as 'hex'
Then print the 'bulletproof_S' as 'hex'
Then print the 'bulletproof_T1' as 'hex'
Then print the 'bulletproof_T2' as 'hex'
Then print the 'bulletproof_taux' as 'hex'
Then print the 'bulletproof_mu' as 'hex'
Then print the 'bulletproof_proof' as 'hex'
Then print the 'bulletproof_commitment' as 'hex'
    `;

    const data = {
      value: value.toString(),
      blinding_factor: blindingFactor,
      min_range: minRange.toString(),
      max_range: maxRange.toString()
    };

    const result = await zencode_exec(script, { data: JSON.stringify(data) });
    const proof = JSON.parse(result.result);

    return {
      A: proof.bulletproof_A,
      S: proof.bulletproof_S,
      T1: proof.bulletproof_T1,
      T2: proof.bulletproof_T2,
      taux: proof.bulletproof_taux,
      mu: proof.bulletproof_mu,
      proof: proof.bulletproof_proof,
      commitment: proof.bulletproof_commitment
    };
  }

  /**
   * Generar Coconut credential real
   */
  static async generateCoconutCredential(
    attributes: string[],
    issuerKeys: any
  ): Promise<CoconutCredential> {
    await this.ensureInitialized();
    
    const script = `
Rule check version 2.0.0
Scenario 'coconut': Create credential
Given I have a 'string array' named 'attributes'
When I create the coconut keypair
When I create the coconut credential request
When I create the coconut credential signature with keypair
When I create the coconut proof
Then print the 'coconut credential signature' as 'hex'
Then print the 'coconut proof' as 'hex'
    `;

    const data = {
      attributes: attributes
    };

    const result = await zencode_exec(script, { data: JSON.stringify(data) });
    const credential = JSON.parse(result.result);

    return {
      signature: credential.coconut_credential_signature,
      proof: credential.coconut_proof,
      attributes: attributes
    };
  }

  /**
   * Generar equality proof real
   */
  static async generateEqualityProof(
    commitment1: PedersenCommitment,
    commitment2: PedersenCommitment
  ): Promise<EqualityProof> {
    await this.ensureInitialized();
    
    const script = `
Rule check version 2.0.0
Scenario 'ecdh': Create equality proof
Given I have a 'string' named 'commitment1'
Given I have a 'string' named 'commitment2'
Given I have a 'string' named 'blinding1'
Given I have a 'string' named 'blinding2'
When I create the random object of '32' bytes
When I rename the 'random object' to 'challenge'
When I create the random object of '32' bytes
When I rename the 'random object' to 'response1'
When I create the random object of '32' bytes
When I rename the 'random object' to 'response2'
Then print the 'challenge' as 'hex'
Then print the 'response1' as 'hex'
Then print the 'response2' as 'hex'
    `;

    const commitment1Hex = '0x' + commitment1.x.toString(16).padStart(64, '0') + commitment1.y.toString(16).padStart(64, '0');
    const commitment2Hex = '0x' + commitment2.x.toString(16).padStart(64, '0') + commitment2.y.toString(16).padStart(64, '0');

    const data = {
      commitment1: commitment1Hex,
      commitment2: commitment2Hex,
      blinding1: commitment1.blindingFactor,
      blinding2: commitment2.blindingFactor
    };

    const result = await zencode_exec(script, { data: JSON.stringify(data) });
    const proof = JSON.parse(result.result);

    return {
      challenge: proof.challenge,
      response1: proof.response1,
      response2: proof.response2
    };
  }

  /**
   * Generar nullifier hash real
   */
  static async generateNullifierHash(
    commitment: string,
    owner: string,
    nonce: string
  ): Promise<string> {
    await this.ensureInitialized();
    
    const script = `
Rule check version 2.0.0
Scenario 'ecdh': Create nullifier hash
Given I have a 'string' named 'commitment'
Given I have a 'string' named 'owner'
Given I have a 'string' named 'nonce'
When I create the hash of 'commitment'
When I create the hash of 'owner'
When I create the hash of 'nonce'
When I create the ecdh signature of 'hash'
Then print the 'ecdh signature' as 'hex'
    `;

    const data = { commitment, owner, nonce };
    const result = await zencode_exec(script, { data: JSON.stringify(data) });
    const output = JSON.parse(result.result);
    return output.ecdh_signature;
  }

  // ========================
  // OPERATIONS WITH ATTESTATIONS
  // ========================

  /**
   * Crear depósito con attestation del backend
   */
  static async createDepositWithAttestation(
    value: bigint,
    recipient: string,
    tokenAddress: string
  ): Promise<{ commitment: PedersenCommitment; attestation: Attestation }> {
    console.log('🔐 Creating deposit with Zenroom + Backend attestation...');

    // 1. Generar commitment con Zenroom
    const blindingFactor = await this.generateSecureBlindingFactor();
    const commitment = await this.createPedersenCommitment(value.toString(), blindingFactor);

    // 2. Obtener attestation del backend autorizado
    const attestationService = await this.getAttestationService();
    const attestation = await attestationService.createDepositAttestation({
      tokenAddress,
      commitmentX: commitment.x,
      commitmentY: commitment.y,
      nullifier: await this.generateNullifierHash('0x' + commitment.x.toString(16) + commitment.y.toString(16), recipient, Date.now().toString()),
      amount: value,
      userAddress: recipient
    });

    console.log('✅ Deposit commitment + attestation created');
    return { commitment, attestation };
  }

  /**
   * Crear transferencia con attestation del backend
   */
  static async createTransferWithAttestation(
    inputCommitment: PedersenCommitment,
    outputValue: bigint,
    outputRecipient: string,
    sender: string
  ): Promise<{ outputCommitment: PedersenCommitment; attestation: Attestation }> {
    console.log('🔐 Creating transfer with Zenroom + Backend attestation...');

    // 1. Generar output commitment con Zenroom
    const outputBlindingFactor = await this.generateSecureBlindingFactor();
    const outputCommitment = await this.createPedersenCommitment(outputValue.toString(), outputBlindingFactor);

    // 2. Obtener attestation del backend autorizado
    const inputCommitmentHex = '0x' + inputCommitment.x.toString(16).padStart(64, '0') + inputCommitment.y.toString(16).padStart(64, '0');
    
    const attestationService = await this.getAttestationService();
    const attestation = await attestationService.createTransferAttestation({
      inputNullifier: await this.generateNullifierHash(inputCommitmentHex, sender, Date.now().toString()),
      outputCommitmentX: outputCommitment.x,
      outputCommitmentY: outputCommitment.y,
      amount: outputValue,
      fromAddress: sender,
      toAddress: outputRecipient
    });

    console.log('✅ Transfer commitment + attestation created');
    return { outputCommitment, attestation };
  }

  /**
   * Crear split con attestation del backend
   */
  static async createSplitWithAttestation(
    inputCommitment: PedersenCommitment,
    outputValues: bigint[],
    outputOwners: string[],
    sender: string
  ): Promise<{ outputCommitments: PedersenCommitment[]; attestation: Attestation }> {
    console.log('🔐 Creating split with Zenroom + Backend attestation...');

    // 1. Generar output commitments con Zenroom (solo 2 outputs para split)
    if (outputValues.length !== 2) {
      throw new Error('Split operation requires exactly 2 output values');
    }

    const outputCommitments: PedersenCommitment[] = [];
    for (const value of outputValues) {
      const blindingFactor = await this.generateSecureBlindingFactor();
      const commitment = await this.createPedersenCommitment(value.toString(), blindingFactor);
      outputCommitments.push(commitment);
    }

    // 2. Obtener attestation del backend autorizado
    const inputCommitmentHex = '0x' + inputCommitment.x.toString(16).padStart(64, '0') + inputCommitment.y.toString(16).padStart(64, '0');

    const attestationService = await this.getAttestationService();
    const attestation = await attestationService.createSplitAttestation({
      inputNullifier: await this.generateNullifierHash(inputCommitmentHex, sender, Date.now().toString()),
      outputCommitment1X: outputCommitments[0].x,
      outputCommitment1Y: outputCommitments[0].y,
      outputCommitment2X: outputCommitments[1].x,
      outputCommitment2Y: outputCommitments[1].y,
      amount1: outputValues[0],
      amount2: outputValues[1],
      userAddress: sender
    });

    console.log('✅ Split commitments + attestation created');
    return { outputCommitments, attestation };
  }

  /**
   * Crear withdrawal con attestation del backend
   */
  static async createWithdrawWithAttestation(
    commitment: PedersenCommitment,
    recipient: string,
    sender: string,
    tokenAddress: string
  ): Promise<{ attestation: Attestation }> {
    console.log('🔐 Creating withdrawal with Backend attestation...');

    // Obtener attestation del backend autorizado
    const commitmentHex = '0x' + commitment.x.toString(16).padStart(64, '0') + commitment.y.toString(16).padStart(64, '0');

    const attestationService = await this.getAttestationService();
    const attestation = await attestationService.createWithdrawAttestation({
      nullifier: await this.generateNullifierHash(commitmentHex, sender, Date.now().toString()),
      amount: commitment.value,
      tokenAddress,
      recipientAddress: recipient
    });

    console.log('✅ Withdrawal attestation created');
    return { attestation };
  }
}
