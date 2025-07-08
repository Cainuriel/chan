/**
 * @fileoverview Examples of how to import and use Zenroom types
 * @description This file shows the correct way to import types after the fixes
 */

// ✅ CORRECT: Import types from the dedicated types file
import type {
  ZenroomExecutionResult,
  ZenroomExecutionOptions,
  ZenroomCommitmentResult,
  ZenroomSplitProofResult,
  ZenroomOwnershipProofResult,
  ZenroomKeyDerivationResult
} from '../types/zenroom.d';

// ✅ CORRECT: Import error classes (they are actual classes, not just types)
import { 
  ZenroomExecutionError, 
  ZenroomValidationError 
} from '../types/zenroom.d';

// ✅ CORRECT: Import from the centralized index
import type {
  UTXODataContract,
  UTXOVaultContract,
  ContractCallOptions
} from '../types/index';

// ✅ CORRECT: Import the actual Zenroom functions from the client wrapper
import { zencode_exec, zenroom_exec, introspect } from '../utils/zenroom.client';

/**
 * Example function showing proper type usage
 */
async function exampleZenroomUsage(): Promise<void> {
  // Using ZenroomExecutionOptions type
  const options: ZenroomExecutionOptions = {
    data: JSON.stringify({ value: 100 }),
    keys: JSON.stringify({ private_key: "abc123" })
  };

  try {
    // Using the actual zencode_exec function with proper types
    const result: ZenroomExecutionResult = await zencode_exec(`
      Given I have a 'number' named 'value'
      When I create the random array with '32' elements each of '8' bits
      Then print the 'random array' as 'hex'
    `, options);

    console.log('Zenroom result:', result.result);
    console.log('Zenroom logs:', result.logs);

  } catch (error) {
    if (error instanceof ZenroomExecutionError) {
      console.error('Zenroom execution failed:', error.message);
      console.error('Logs:', error.logs);
    } else {
      console.error('Unknown error:', error);
    }
  }
}

/**
 * Example of commitment generation with proper typing
 */
async function generateCommitmentExample(value: string): Promise<ZenroomCommitmentResult> {
  const zencode = `
    Given I have a 'number' named 'value'
    When I create the pedersen commitment of 'value'
    Then print the 'pedersen commitment' as 'hex'
    and print the 'blinding factor' as 'hex'
  `;

  const options: ZenroomExecutionOptions = {
    data: JSON.stringify({ value })
  };

  try {
    const result = await zencode_exec(zencode, options);
    const output = JSON.parse(result.result);
    
    return {
      pedersen_commitment: output.pedersen_commitment,
      blinding_factor: output.blinding_factor
    };
  } catch (error) {
    throw new ZenroomExecutionError(
      'Failed to generate commitment',
      error instanceof Error ? error.message : 'Unknown error',
      zencode
    );
  }
}

export {
  exampleZenroomUsage,
  generateCommitmentExample
};
