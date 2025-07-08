/**
 * @fileoverview Zenroom helper functions for UTXO operations
 * @description Utility functions for Zenroom cryptographic operations
 */

import { ethers } from 'ethers';

import type { 
  ZenroomExecutionResult, 
  ZenroomCommitmentResult,
  ZenroomSplitProofResult,
  ZenroomOwnershipProofResult,
  ZenroomKeyDerivationResult,
  ZenroomExecutionOptions
} from '../types/zenroom.d';

import { ZenroomExecutionError } from '../types/zenroom.d';

// Import the actual zenroom functions from the client wrapper
import { zencode_exec, zenroom_exec, introspect, isZenroomAvailable } from './zenroom.client';

/**
 * Zenroom helper class for UTXO cryptographic operations
 */
export class ZenroomHelpers {
  
  /**
   * Generate a secure random nonce for cryptographic operations
   * @param bits - Number of bits for the nonce (default: 256)
   * @returns Promise resolving to hex string nonce
   */
  static async generateSecureNonce(bits: number = 256): Promise<string> {
    if (!isZenroomAvailable()) {
      // Fallback to browser crypto API if zenroom is not available
      const array = new Uint8Array(bits / 8);
      crypto.getRandomValues(array);
      const hexString = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
      console.log('🎲 Generated fallback nonce:', hexString);
      return hexString;
    }
    const zencode = `
    Given nothing
    When I create the random array with '${bits / 8}' elements each of '8' bits
    Then print the 'random array' as 'hex'
    `;

    try {
      const result = await zencode_exec(zencode);
      const output = JSON.parse(result.result);
      const randomArray = output.random_array;
      
      // Ensure we return a proper hex string
      let hexString: string;
      if (Array.isArray(randomArray)) {
        hexString = randomArray.join('');
      } else {
        hexString = randomArray;
      }
      
      console.log('🎲 Generated Zenroom nonce:', hexString, typeof hexString);
      return hexString;
    } catch (error) {
      console.log('❌ Zenroom nonce generation failed, falling back to crypto API');
      // Fallback to crypto API if Zenroom fails
      const array = new Uint8Array(bits / 8);
      crypto.getRandomValues(array);
      const hexString = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
      console.log('🎲 Generated fallback nonce after error:', hexString);
      return hexString;
    }
  }

  /**
   * Create a Pedersen commitment for a value with blinding factor
   * @param value - Value to commit (as string)
   * @param blindingFactor - Blinding factor (optional, auto-generated if not provided)
   * @returns Promise resolving to commitment result
   */
  static async createPedersenCommitment(
    value: string,
    blindingFactor?: string
  ): Promise<ZenroomCommitmentResult> {
    console.log('🔒 Creating Pedersen commitment...', { value, hasBlindingFactor: !!blindingFactor });
    
    try {
      // Generate blinding factor if not provided
      const blinding = blindingFactor || await this.generateSecureNonce();
      
      console.log('🔒 Using blinding factor:', blinding, 'type:', typeof blinding);
      
      // Validate inputs
      if (typeof value !== 'string' || typeof blinding !== 'string') {
        throw new Error(`Invalid input types: value=${typeof value}, blinding=${typeof blinding}`);
      }

      // Try to use Zenroom for proper Pedersen commitment if available
      if (isZenroomAvailable()) {
        console.log('🔒 Using Zenroom for Pedersen commitment');
        
        const zencode = `
        Scenario 'ethereum': Create commitment
        Given I have a 'integer' named 'value'
        Given I have a 'integer' named 'blinding_factor'
        When I create the pedersen commitment of 'value' with 'blinding_factor'
        And I create the commitment proof
        Then print the 'pedersen commitment' as 'hex'
        And print the 'blinding_factor' as 'hex'
        And print the 'commitment proof' as 'hex'
        `;

        const data = JSON.stringify({
          value: value,
          blinding_factor: blinding
        });

        try {
          const result = await zencode_exec(zencode, { data });
          const output = JSON.parse(result.result);
          
          console.log('✅ Zenroom Pedersen commitment created successfully');
          
          return {
            pedersen_commitment: output.pedersen_commitment,
            blinding_factor: output.blinding_factor,
            commitment_proof: output.commitment_proof
          };
        } catch (zenroomError) {
          console.warn('⚠️ Zenroom commitment failed, falling back to hash-based commitment:', zenroomError);
          // Fall through to hash-based commitment
        }
      }

      // Fallback: create a simple hash-based commitment
      console.log('🔒 Using hash-based commitment fallback');
      const commitmentData = ethers.solidityPackedKeccak256(
        ['string', 'string'],
        [value, blinding]
      );
      
      console.log('✅ Hash-based commitment created successfully:', commitmentData);
      
      return {
        pedersen_commitment: commitmentData,
        blinding_factor: blinding,
        commitment_proof: commitmentData // For now, use same as commitment
      };
      
    } catch (error) {
      console.error('❌ Failed to create commitment:', error);
      throw new ZenroomExecutionError(
        'Failed to create Pedersen commitment',
        error instanceof Error ? error.message : 'Unknown error',
        'commitment creation'
      );
    }
  }

  /**
   * Verify a Pedersen commitment opening
   * @param commitment - The commitment to verify
   * @param value - The claimed value
   * @param blindingFactor - The blinding factor
   * @returns Promise resolving to verification result
   */
  static async verifyCommitmentOpening(
    commitment: string,
    value: string,
    blindingFactor: string
  ): Promise<boolean> {
    const zencode = `
    Scenario 'ethereum': Verify commitment
    Given I have a 'hex' named 'commitment'
    Given I have a 'integer' named 'value'
    Given I have a 'integer' named 'blinding_factor'
    When I verify the commitment 'commitment' opens to 'value' with 'blinding_factor'
    Then print the 'verification result'
    `;

    const data = JSON.stringify({
      commitment: commitment,
      value: value,
      blinding_factor: blindingFactor
    });

    try {
      const result = await zencode_exec(zencode, { data });
      const output = JSON.parse(result.result);
      return output.verification_result === true;
    } catch (error) {
      // If verification fails, Zenroom might throw, so we catch and return false
      return false;
    }
  }

  /**
   * Generate a split proof for UTXO division
   * @param inputCommitment - Input UTXO commitment
   * @param inputValue - Input UTXO value
   * @param inputBlinding - Input UTXO blinding factor
   * @param outputValues - Array of output values
   * @param outputBlindings - Array of output blinding factors
   * @returns Promise resolving to split proof
   */
  static async generateSplitProof(
    inputCommitment: string,
    inputValue: string,
    inputBlinding: string,
    outputValues: string[],
    outputBlindings: string[]
  ): Promise<ZenroomSplitProofResult> {
    if (outputValues.length !== outputBlindings.length) {
      throw new Error('Output values and blinding factors arrays must have same length');
    }

    // Verify sum of outputs equals input
    const totalOutput = outputValues.reduce((sum, val) => sum + parseInt(val), 0);
    if (totalOutput !== parseInt(inputValue)) {
      throw new Error(`Sum of outputs (${totalOutput}) does not equal input (${inputValue})`);
    }

    const zencode = `
    Scenario 'ethereum': Generate split proof
    Given I have a 'hex' named 'input_commitment'
    Given I have a 'integer' named 'input_value'
    Given I have a 'integer' named 'input_blinding'
    Given I have a 'integer array' named 'output_values'
    Given I have a 'integer array' named 'output_blindings'
    
    When I verify the commitment 'input_commitment' opens to 'input_value' with 'input_blinding'
    And I verify that sum of 'output_values' equals 'input_value'
    And I create the split proof for outputs
    And I create the output commitments from 'output_values' and 'output_blindings'
    And I create the split signature
    
    Then print the 'split proof' as 'hex'
    And print the 'output commitments' as 'hex'
    And print the 'split signature' as 'hex'
    `;

    const data = JSON.stringify({
      input_commitment: inputCommitment,
      input_value: inputValue,
      input_blinding: inputBlinding,
      output_values: outputValues,
      output_blindings: outputBlindings
    });

    try {
      const result = await zencode_exec(zencode, { data });
      const output = JSON.parse(result.result);
      
      return {
        split_proof: output.split_proof,
        output_commitments: output.output_commitments,
        signatures: [output.split_signature]
      };
    } catch (error) {
      throw new ZenroomExecutionError(
        'Failed to generate split proof',
        error instanceof Error ? error.message : 'Unknown error',
        zencode
      );
    }
  }

  /**
   * Generate a combine proof for UTXO combination
   * @param inputCommitments - Array of input commitments
   * @param inputValues - Array of input values
   * @param inputBlindings - Array of input blinding factors
   * @param outputBlinding - Output blinding factor
   * @returns Promise resolving to combine proof
   */
  static async generateCombineProof(
    inputCommitments: string[],
    inputValues: string[],
    inputBlindings: string[],
    outputBlinding: string
  ): Promise<string> {
    if (inputCommitments.length !== inputValues.length || 
        inputValues.length !== inputBlindings.length) {
      throw new Error('Input arrays must have same length');
    }

    const totalValue = inputValues.reduce((sum, val) => sum + parseInt(val), 0).toString();

    const zencode = `
    Scenario 'ethereum': Generate combine proof
    Given I have a 'hex array' named 'input_commitments'
    Given I have a 'integer array' named 'input_values'
    Given I have a 'integer array' named 'input_blindings'
    Given I have a 'integer' named 'total_value'
    Given I have a 'integer' named 'output_blinding'
    
    When I verify all input commitments open correctly
    And I verify that sum of 'input_values' equals 'total_value'
    And I create the combine proof for inputs
    And I create the output commitment of 'total_value' with 'output_blinding'
    And I create the combine signature
    
    Then print the 'combine proof' as 'hex'
    `;

    const data = JSON.stringify({
      input_commitments: inputCommitments,
      input_values: inputValues,
      input_blindings: inputBlindings,
      total_value: totalValue,
      output_blinding: outputBlinding
    });

    try {
      const result = await zencode_exec(zencode, { data });
      const output = JSON.parse(result.result);
      return output.combine_proof;
    } catch (error) {
      throw new ZenroomExecutionError(
        'Failed to generate combine proof',
        error instanceof Error ? error.message : 'Unknown error',
        zencode
      );
    }
  }

  /**
   * Generate ownership proof for EOA-UTXO binding
   * @param utxoId - UTXO identifier
   * @param utxoCommitment - UTXO commitment
   * @param eoaAddress - EOA address
   * @param eoaSignature - EOA signature
   * @returns Promise resolving to ownership proof
   */
  static async generateOwnershipProof(
    utxoId: string,
    utxoCommitment: string,
    eoaAddress: string,
    eoaSignature: string
  ): Promise<ZenroomOwnershipProofResult> {
    const zencode = `
    Scenario 'ethereum': Generate ownership proof
    Given I have a 'string' named 'utxo_id'
    Given I have a 'hex' named 'utxo_commitment'
    Given I have a 'string' named 'eoa_address'
    Given I have a 'hex' named 'eoa_signature'
    
    When I create the ownership binding of 'utxo_id' to 'eoa_address'
    And I create the commitment ownership proof for 'utxo_commitment'
    And I combine the eoa signature with zenroom proof
    And I create the final ownership proof
    
    Then print the 'ownership proof' as 'hex'
    And print the 'eoa signature component' as 'hex'
    And print the 'zenroom signature component' as 'hex'
    `;

    const data = JSON.stringify({
      utxo_id: utxoId,
      utxo_commitment: utxoCommitment,
      eoa_address: eoaAddress,
      eoa_signature: eoaSignature
    });

    try {
      const result = await zencode_exec(zencode, { data });
      const output = JSON.parse(result.result);
      
      return {
        ownership_proof: output.ownership_proof,
        eoa_signature: output.eoa_signature_component,
        zenroom_signature: output.zenroom_signature_component
      };
    } catch (error) {
      throw new ZenroomExecutionError(
        'Failed to generate ownership proof',
        error instanceof Error ? error.message : 'Unknown error',
        zencode
      );
    }
  }

  /**
   * Derive cryptographic key from EOA signature
   * @param eoaAddress - EOA address
   * @param message - Message that was signed
   * @param signature - EOA signature
   * @param derivationPath - Derivation path (optional)
   * @returns Promise resolving to derived key
   */
  static async deriveKeyFromEOA(
    eoaAddress: string,
    message: string,
    signature: string,
    derivationPath: string = "m/44'/60'/0'/0/0"
  ): Promise<ZenroomKeyDerivationResult> {
    const zencode = `
    Scenario 'ethereum': Derive key from EOA
    Given I have a 'string' named 'eoa_address'
    Given I have a 'string' named 'signed_message'
    Given I have a 'hex' named 'signature'
    Given I have a 'string' named 'derivation_path'
    
    When I verify the ethereum signature 'signature' of 'signed_message' by 'eoa_address'
    And I derive the private key from signature using 'derivation_path'
    And I create the public key from private key
    And I set the curve to 'secp256k1'
    
    Then print the 'private key' as 'hex'
    And print the 'public key' as 'hex'
    And print the 'derivation path'
    And print the 'curve'
    `;

    const data = JSON.stringify({
      eoa_address: eoaAddress,
      signed_message: message,
      signature: signature,
      derivation_path: derivationPath
    });

    try {
      const result = await zencode_exec(zencode, { data });
      const output = JSON.parse(result.result);
      
      return {
        private_key: output.private_key,
        public_key: output.public_key,
        derivation_path: output.derivation_path,
        curve: output.curve
      };
    } catch (error) {
      throw new ZenroomExecutionError(
        'Failed to derive key from EOA',
        error instanceof Error ? error.message : 'Unknown error',
        zencode
      );
    }
  }

  /**
   * Generate burn authorization proof
   * @param utxoId - UTXO to burn
   * @param commitment - UTXO commitment
   * @param value - UTXO value
   * @param blindingFactor - UTXO blinding factor
   * @param eoaAddress - EOA authorizing the burn
   * @returns Promise resolving to burn proof
   */
  static async generateBurnProof(
    utxoId: string,
    commitment: string,
    value: string,
    blindingFactor: string,
    eoaAddress: string
  ): Promise<string> {
    const zencode = `
    Scenario 'ethereum': Generate burn proof
    Given I have a 'string' named 'utxo_id'
    Given I have a 'hex' named 'commitment'
    Given I have a 'integer' named 'value'
    Given I have a 'integer' named 'blinding_factor'
    Given I have a 'string' named 'eoa_address'
    
    When I verify the commitment 'commitment' opens to 'value' with 'blinding_factor'
    And I create the burn authorization for 'utxo_id' by 'eoa_address'
    And I create the destruction proof
    And I create the burn signature
    
    Then print the 'burn proof' as 'hex'
    `;

    const data = JSON.stringify({
      utxo_id: utxoId,
      commitment: commitment,
      value: value,
      blinding_factor: blindingFactor,
      eoa_address: eoaAddress
    });

    try {
      const result = await zencode_exec(zencode, { data });
      const output = JSON.parse(result.result);
      return output.burn_proof;
    } catch (error) {
      throw new ZenroomExecutionError(
        'Failed to generate burn proof',
        error instanceof Error ? error.message : 'Unknown error',
        zencode
      );
    }
  }

  /**
   * Generate transfer authorization proof
   * @param utxoId - UTXO to transfer
   * @param fromAddress - Current owner address
   * @param toAddress - New owner address
   * @param commitment - UTXO commitment
   * @returns Promise resolving to transfer proof
   */
  static async generateTransferProof(
    utxoId: string,
    fromAddress: string,
    toAddress: string,
    commitment: string
  ): Promise<string> {
    const zencode = `
    Scenario 'ethereum': Generate transfer proof
    Given I have a 'string' named 'utxo_id'
    Given I have a 'string' named 'from_address'
    Given I have a 'string' named 'to_address'
    Given I have a 'hex' named 'commitment'
    
    When I create the transfer authorization from 'from_address' to 'to_address'
    And I bind the transfer to 'utxo_id' and 'commitment'
    And I create the transfer proof
    And I create the transfer signature
    
    Then print the 'transfer proof' as 'hex'
    `;

    const data = JSON.stringify({
      utxo_id: utxoId,
      from_address: fromAddress,
      to_address: toAddress,
      commitment: commitment
    });

    try {
      const result = await zencode_exec(zencode, { data });
      const output = JSON.parse(result.result);
      return output.transfer_proof;
    } catch (error) {
      throw new ZenroomExecutionError(
        'Failed to generate transfer proof',
        error instanceof Error ? error.message : 'Unknown error',
        zencode
      );
    }
  }

  /**
   * Hash data using Zenroom's cryptographic hash functions
   * @param data - Data to hash
   * @param algorithm - Hash algorithm (default: 'sha256')
   * @returns Promise resolving to hash string
   */
  static async hashData(data: string, algorithm: string = 'sha256'): Promise<string> {
    const zencode = `
    Given I have a 'string' named 'data'
    When I create the hash of 'data' using '${algorithm}'
    Then print the 'hash' as 'hex'
    `;

    const input = JSON.stringify({ data });

    try {
      const result = await zencode_exec(zencode, { data: input });
      const output = JSON.parse(result.result);
      return output.hash;
    } catch (error) {
      throw new ZenroomExecutionError(
        `Failed to hash data with ${algorithm}`,
        error instanceof Error ? error.message : 'Unknown error',
        zencode
      );
    }
  }

  /**
   * Validate Zencode script syntax
   * @param zencode - Zencode script to validate
   * @returns Promise resolving to validation result
   */
  static async validateZencode(zencode: string): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    try {
      // Use introspection to validate
      const result = await zencode_exec(zencode);
      return { valid: true, errors: [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { 
        valid: false, 
        errors: [errorMessage] 
      };
    }
  }

  /**
   * Convert hex string to bytes and vice versa
   */
  static hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  static bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generate deterministic ID from commitment and owner
   * @param commitment - Pedersen commitment
   * @param owner - Owner address
   * @param timestamp - Timestamp for uniqueness
   * @returns Promise resolving to deterministic ID
   */
  static async generateUTXOId(
    commitment: string,
    owner: string,
    timestamp: number
  ): Promise<string> {
    const data = `${commitment}${owner}${timestamp}`;
    return await this.hashData(data);
  }
}

/**
 * Pre-defined Zencode templates for common operations
 */
export const ZENCODE_TEMPLATES = {
  CREATE_COMMITMENT: `
    Scenario 'ethereum': Create commitment
    Given I have a 'integer' named 'value'
    Given I have a 'integer' named 'blinding_factor'
    When I create the pedersen commitment of 'value' with 'blinding_factor'
    Then print the 'pedersen commitment' as 'hex'
  `,
  
  VERIFY_COMMITMENT: `
    Scenario 'ethereum': Verify commitment
    Given I have a 'hex' named 'commitment'
    Given I have a 'integer' named 'value'
    Given I have a 'integer' named 'blinding_factor'
    When I verify the commitment 'commitment' opens to 'value' with 'blinding_factor'
    Then print the 'verification result'
  `,
  
  GENERATE_RANDOM: `
    Given nothing
    When I create the random array with '32' elements each of '8' bits
    Then print the 'random array' as 'hex'
  `,
  
  HASH_DATA: `
    Given I have a 'string' named 'data'
    When I create the hash of 'data' using 'sha256'
    Then print the 'hash' as 'hex'
  `
} as const;

/**
 * Export singleton instance for convenience
 */
export const zenroomHelpers = ZenroomHelpers;