// src/utils/zenroom.helpers.ts
import { AttestationService } from '../lib/AttestationService.js';
import type { 
  PedersenCommitment, 
  BulletproofRangeProof, 
  CoconutCredential, 
  EqualityProof,
  Attestation
} from '../types/zenroom.d.ts';

declare const zenroom: any;

/**
 * ZenroomHelpers - Pure Zenroom cryptography with attestation integration
 * Backend autorizado firma attestations que Solidity confía
 */
export class ZenroomHelpers {
  private static attestationService = new AttestationService();

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
   * Generar factor de cegado seguro para BN254
   */
  static async generateSecureBlindingFactor(): Promise<string> {
    const script = `
      rule input
      rule output
      Given nothing
      When I create the random object of '256' bits
      Then print the random object as 'hex'
    `;

    const result = await zenroom.exec(script);
    const randomHex = JSON.parse(result.result).random_object;
    return this.toBigInt('0x' + randomHex).toString(16).padStart(64, '0');
  }

  /**
   * Crear Pedersen commitment usando BN254
   */
  static async createPedersenCommitment(value: string, blindingFactor: string): Promise<PedersenCommitment> {
    const script = `
      Scenario 'ecdh': Create commitment
      Given I have a 'string' named 'value'
      Given I have a 'string' named 'blinding_factor'
      When I create the pedersen commitment of 'value' with blinding factor 'blinding_factor'
      Then print the 'pedersen commitment'
    `;

    const data = {
      value: value,
      blinding_factor: blindingFactor
    };

    const result = await zenroom.exec(script, { data: JSON.stringify(data) });
    const commitment = JSON.parse(result.result);
    
    // Convertir a coordenadas x,y de BN254
    const commitmentHex = commitment.pedersen_commitment;
    const x = BigInt('0x' + commitmentHex.substring(2, 66));
    const y = BigInt('0x' + commitmentHex.substring(66, 130));

    return {
      x,
      y,
      blindingFactor,
      value: BigInt(value)
    };
  }

  /**
   * Verificar Pedersen commitment
   */
  static async verifyPedersenCommitment(
    commitmentHex: string, 
    value: bigint, 
    blindingFactor: bigint
  ): Promise<boolean> {
    try {
      const script = `
        Scenario 'ecdh': Verify commitment
        Given I have a 'string' named 'commitment'
        Given I have a 'string' named 'value'
        Given I have a 'string' named 'blinding_factor'
        When I verify the pedersen commitment 'commitment' with value 'value' and blinding factor 'blinding_factor'
        Then print the string 'verified'
      `;

      const data = {
        commitment: commitmentHex,
        value: value.toString(),
        blinding_factor: blindingFactor.toString(16)
      };

      const result = await zenroom.exec(script, { data: JSON.stringify(data) });
      return JSON.parse(result.result) === 'verified';
    } catch (error) {
      console.warn('Pedersen commitment verification failed:', error);
      return false;
    }
  }

  /**
   * Generar Bulletproof range proof
   */
  static async generateBulletproof(
    value: bigint,
    blindingFactor: string,
    minRange: bigint = BigInt(0),
    maxRange: bigint = BigInt(2n ** 64n - 1n)
  ): Promise<BulletproofRangeProof> {
    const script = `
      Scenario 'bulletproof': Create range proof
      Given I have a 'string' named 'value'
      Given I have a 'string' named 'blinding_factor'
      Given I have a 'string' named 'min_range'
      Given I have a 'string' named 'max_range'
      When I create the bulletproof range proof of 'value' in range 'min_range' to 'max_range' with blinding factor 'blinding_factor'
      Then print the 'bulletproof range proof'
    `;

    const data = {
      value: value.toString(),
      blinding_factor: blindingFactor,
      min_range: minRange.toString(),
      max_range: maxRange.toString()
    };

    const result = await zenroom.exec(script, { data: JSON.stringify(data) });
    const proof = JSON.parse(result.result);

    return {
      A: proof.bulletproof_range_proof.A,
      S: proof.bulletproof_range_proof.S,
      T1: proof.bulletproof_range_proof.T1,
      T2: proof.bulletproof_range_proof.T2,
      taux: proof.bulletproof_range_proof.taux,
      mu: proof.bulletproof_range_proof.mu,
      proof: proof.bulletproof_range_proof.proof,
      commitment: proof.bulletproof_range_proof.commitment
    };
  }

  /**
   * Generar Coconut credential
   */
  static async generateCoconutCredential(
    attributes: string[],
    issuerKeys: any
  ): Promise<CoconutCredential> {
    const script = `
      Scenario 'coconut': Create credential
      Given I have a 'string array' named 'attributes'
      Given I have a 'coconut issuer keypair' named 'issuer_keys'
      When I create the coconut credential request
      When I create the coconut credential signature
      Then print the 'coconut credential'
    `;

    const data = {
      attributes,
      issuer_keys: issuerKeys
    };

    const result = await zenroom.exec(script, { data: JSON.stringify(data) });
    const credential = JSON.parse(result.result);

    return {
      signature: credential.coconut_credential.signature,
      proof: credential.coconut_credential.proof,
      attributes: attributes
    };
  }

  /**
   * Generar equality proof
   */
  static async generateEqualityProof(
    commitment1: PedersenCommitment,
    commitment2: PedersenCommitment
  ): Promise<EqualityProof> {
    const script = `
      Scenario 'ecdh': Create equality proof
      Given I have a 'string' named 'commitment1'
      Given I have a 'string' named 'commitment2'
      Given I have a 'string' named 'blinding1'
      Given I have a 'string' named 'blinding2'
      When I create the equality proof between 'commitment1' and 'commitment2'
      Then print the 'equality proof'
    `;

    const commitment1Hex = '0x' + commitment1.x.toString(16).padStart(64, '0') + commitment1.y.toString(16).padStart(64, '0');
    const commitment2Hex = '0x' + commitment2.x.toString(16).padStart(64, '0') + commitment2.y.toString(16).padStart(64, '0');

    const data = {
      commitment1: commitment1Hex,
      commitment2: commitment2Hex,
      blinding1: commitment1.blindingFactor,
      blinding2: commitment2.blindingFactor
    };

    const result = await zenroom.exec(script, { data: JSON.stringify(data) });
    const proof = JSON.parse(result.result);

    return {
      challenge: proof.equality_proof.challenge,
      response1: proof.equality_proof.response1,
      response2: proof.equality_proof.response2
    };
  }

  /**
   * Generar nullifier hash
   */
  static async generateNullifierHash(
    commitment: string,
    owner: string,
    nonce: string
  ): Promise<string> {
    const script = `
      rule input
      rule output
      Given I have a 'string' named 'commitment'
      Given I have a 'string' named 'owner'
      Given I have a 'string' named 'nonce'
      When I create the hash of 'commitment' and 'owner' and 'nonce'
      Then print the 'hash' as 'hex'
    `;

    const data = { commitment, owner, nonce };
    const result = await zenroom.exec(script, { data: JSON.stringify(data) });
    return JSON.parse(result.result).hash;
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
    const attestation = await this.attestationService.createDepositAttestation({
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
    
    const attestation = await this.attestationService.createTransferAttestation({
      inputCommitmentX: inputCommitment.x,
      inputCommitmentY: inputCommitment.y,
      outputCommitmentX: outputCommitment.x,
      outputCommitmentY: outputCommitment.y,
      nullifier: await this.generateNullifierHash(inputCommitmentHex, sender, Date.now().toString()),
      newOwner: outputRecipient,
      userAddress: sender
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

    // 1. Generar output commitments con Zenroom
    const outputCommitments: PedersenCommitment[] = [];
    for (const value of outputValues) {
      const blindingFactor = await this.generateSecureBlindingFactor();
      const commitment = await this.createPedersenCommitment(value.toString(), blindingFactor);
      outputCommitments.push(commitment);
    }

    // 2. Obtener attestation del backend autorizado
    const inputCommitmentHex = '0x' + inputCommitment.x.toString(16).padStart(64, '0') + inputCommitment.y.toString(16).padStart(64, '0');
    const outputCommitmentsX = outputCommitments.map(c => c.x);
    const outputCommitmentsY = outputCommitments.map(c => c.y);

    const attestation = await this.attestationService.createSplitAttestation({
      inputCommitmentX: inputCommitment.x,
      inputCommitmentY: inputCommitment.y,
      outputCommitmentsX,
      outputCommitmentsY,
      outputValues,
      outputOwners,
      nullifier: await this.generateNullifierHash(inputCommitmentHex, sender, Date.now().toString()),
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
    sender: string
  ): Promise<{ attestation: Attestation }> {
    console.log('🔐 Creating withdrawal with Backend attestation...');

    // Obtener attestation del backend autorizado
    const commitmentHex = '0x' + commitment.x.toString(16).padStart(64, '0') + commitment.y.toString(16).padStart(64, '0');

    const attestation = await this.attestationService.createWithdrawAttestation({
      commitmentX: commitment.x,
      commitmentY: commitment.y,
      amount: commitment.value,
      nullifier: await this.generateNullifierHash(commitmentHex, sender, Date.now().toString()),
      recipient,
      userAddress: sender
    });

    console.log('✅ Withdrawal attestation created');
    return { attestation };
  }
}
