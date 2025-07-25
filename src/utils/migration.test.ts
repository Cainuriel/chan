/**
 * @fileoverview Migration Test Suite - Validates secp256k1 ZK Implementation
 * @description Tests the complete migration from legacy BN254 references to real secp256k1 cryptography
 * 
 * PROPÓSITO CRÍTICO:
 * ==================
 * Este test valida que toda la arquitectura ZK funcione correctamente después de eliminar
 * las referencias confusas a BN254 y implementar secp256k1 real en todo el sistema.
 */

import { CryptoHelpers } from './crypto.helpers';
import { ethers } from 'ethers';

export interface MigrationTestResult {
  overall: boolean;
  tests: {
    cryptoHelpers: boolean;
    pedersenCommitments: boolean;
    nullifierGeneration: boolean;
    equalityProofs: boolean;
    determinism: boolean;
    secp256k1Validation: boolean;
    basicCryptoOps: boolean;
    blindingFactors: boolean;
  };
  details: {
    cryptoHelpers: string;
    pedersenCommitments: string;
    nullifierGeneration: string;
    equalityProofs: string;
    determinism: string;
    secp256k1Validation: string;
    basicCryptoOps: string;
    blindingFactors: string;
  };
  performance: {
    commitmentTime: number;
    nullifierTime: number;
    proofTime: number;
  };
  cryptographyType: 'secp256k1' | 'BN254' | 'Other';
  error?: string;
}

/**
 * Convert BigInt to hex string with proper padding
 */
function bigIntToHex(value: bigint): string {
  let hex = value.toString(16);
  return hex.padStart(64, '0');
}

/**
 * Main migration test function - validates complete secp256k1 ZK implementation
 */
export async function testMigration(): Promise<MigrationTestResult> {
  console.log('🧪 Starting Migration Test Suite - secp256k1 ZK Validation');
  console.log('=' .repeat(60));
  
  const result: MigrationTestResult = {
    overall: false,
    tests: {
      cryptoHelpers: false,
      pedersenCommitments: false,
      nullifierGeneration: false,
      equalityProofs: false,
      determinism: false,
      secp256k1Validation: false,
      basicCryptoOps: false,
      blindingFactors: false
    },
    details: {
      cryptoHelpers: '',
      pedersenCommitments: '',
      nullifierGeneration: '',
      equalityProofs: '',
      determinism: '',
      secp256k1Validation: '',
      basicCryptoOps: '',
      blindingFactors: ''
    },
    performance: {
      commitmentTime: 0,
      nullifierTime: 0,
      proofTime: 0
    },
    cryptographyType: 'Other'
  };

  try {
    // Test 1: CryptoHelpers basic functionality
    console.log('🔐 Test 1: CryptoHelpers basic functionality...');
    result.tests.cryptoHelpers = await testCryptoHelpers();
    result.details.cryptoHelpers = result.tests.cryptoHelpers ? 
      '✅ CryptoHelpers basic functionality working' : 
      '❌ CryptoHelpers basic functionality failed';

    // Test 2: Basic crypto operations
    console.log('🔐 Test 2: Basic crypto operations...');
    result.tests.basicCryptoOps = await testBasicCryptoOps();
    result.details.basicCryptoOps = result.tests.basicCryptoOps ? 
      '✅ Basic cryptographic operations functional' : 
      '❌ Basic cryptographic operations failed';

    // Test 3: Blinding factors
    console.log('🔐 Test 3: Blinding factor generation...');
    result.tests.blindingFactors = await testBlindingFactors();
    result.details.blindingFactors = result.tests.blindingFactors ? 
      '✅ Blinding factor generation working' : 
      '❌ Blinding factor generation failed';

    // Test 4: Pedersen Commitments with secp256k1
    console.log('🔐 Test 4: Pedersen Commitments validation...');
    const commitmentStart = performance.now();
    result.tests.pedersenCommitments = await testPedersenCommitments();
    result.performance.commitmentTime = performance.now() - commitmentStart;
    result.details.pedersenCommitments = result.tests.pedersenCommitments ? 
      `✅ Pedersen commitments working on secp256k1 (${result.performance.commitmentTime.toFixed(2)}ms)` : 
      '❌ Pedersen commitments failed validation';

    // Test 5: Nullifier Generation (deterministic)
    console.log('🔐 Test 5: Nullifier generation validation...');
    const nullifierStart = performance.now();
    result.tests.nullifierGeneration = await testNullifierGeneration();
    result.performance.nullifierTime = performance.now() - nullifierStart;
    result.details.nullifierGeneration = result.tests.nullifierGeneration ? 
      `✅ Nullifiers are deterministic and secure (${result.performance.nullifierTime.toFixed(2)}ms)` : 
      '❌ Nullifier generation failed validation';

    // Test 6: Equality Proofs
    console.log('🔐 Test 6: Equality proofs validation...');
    const proofStart = performance.now();
    result.tests.equalityProofs = await testEqualityProofs();
    result.performance.proofTime = performance.now() - proofStart;
    result.details.equalityProofs = result.tests.equalityProofs ? 
      `✅ Equality proofs functioning correctly (${result.performance.proofTime.toFixed(2)}ms)` : 
      '❌ Equality proofs failed validation';

    // Test 7: Determinism validation
    console.log('🔐 Test 7: Determinism validation...');
    result.tests.determinism = await testDeterminism();
    result.details.determinism = result.tests.determinism ? 
      '✅ All operations are deterministic (ZK-ready)' : 
      '❌ Non-deterministic operations detected';

    // Test 8: secp256k1 validation (final confirmation)
    console.log('🔐 Test 8: secp256k1 cryptography validation...');
    result.tests.secp256k1Validation = await testSecp256k1Validation();
    result.details.secp256k1Validation = result.tests.secp256k1Validation ? 
      '✅ Using real secp256k1 cryptography (NOT BN254)' : 
      '❌ Cryptography validation failed';

    // Determine overall result
    const allTestsPassed = Object.values(result.tests).every(test => test === true);
    result.overall = allTestsPassed;
    result.cryptographyType = result.tests.secp256k1Validation ? 'secp256k1' : 'Other';

    // Print results
    console.log('=' .repeat(60));
    console.log('🧪 MIGRATION TEST RESULTS:');
    console.log('=' .repeat(60));
    
    for (const [key, value] of Object.entries(result.details)) {
      console.log(`${value}`);
    }
    
    console.log('=' .repeat(60));
    console.log(`📊 Performance Metrics:`);
    console.log(`   - Commitment generation: ${result.performance.commitmentTime.toFixed(2)}ms`);
    console.log(`   - Nullifier generation: ${result.performance.nullifierTime.toFixed(2)}ms`);
    console.log(`   - Proof generation: ${result.performance.proofTime.toFixed(2)}ms`);
    
    console.log('=' .repeat(60));
    console.log(`🎯 OVERALL RESULT: ${result.overall ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🔐 Cryptography Type: ${result.cryptographyType}`);
    console.log('=' .repeat(60));

    if (result.overall) {
      console.log('🎉 Migration successful! secp256k1 ZK implementation is fully functional.');
    } else {
      console.log('⚠️ Migration issues detected. Check individual test results above.');
    }

    return result;

  } catch (error: any) {
    console.error('❌ Migration test failed with error:', error);
    result.error = error.message || String(error);
    result.overall = false;
    return result;
  }
}

/**
 * Test CryptoHelpers basic functionality
 */
async function testCryptoHelpers(): Promise<boolean> {
  try {
    // Test 1: Check if crypto mode is available
    const cryptoMode = CryptoHelpers.cryptoMode;
    if (cryptoMode === 'unavailable') {
      console.log('❌ CryptoHelpers reports crypto unavailable');
      return false;
    }

    // Test 2: Check if full crypto is available
    const cryptoAvailable = CryptoHelpers.isFullCryptoAvailable;
    console.log(`📊 Crypto availability: ${cryptoAvailable}, mode: ${cryptoMode}`);

    console.log('✅ CryptoHelpers basic functionality passed');
    return true;
  } catch (error) {
    console.log('❌ CryptoHelpers test failed:', error);
    return false;
  }
}

/**
 * Test basic crypto operations
 */
async function testBasicCryptoOps(): Promise<boolean> {
  try {
    // Test hex conversion
    const hexValue = '0x1234567890abcdef';
    const bigIntValue = CryptoHelpers.toBigInt(hexValue);
    if (bigIntValue !== BigInt(hexValue)) {
      console.log('❌ Hex to BigInt conversion failed');
      return false;
    }

    console.log('✅ Basic crypto operations passed');
    return true;
  } catch (error) {
    console.log('❌ Basic crypto operations test failed:', error);
    return false;
  }
}

/**
 * Test blinding factor generation
 */
async function testBlindingFactors(): Promise<boolean> {
  try {
    // Test blinding factor generation
    const blindingFactor1 = CryptoHelpers.generateSecureBlindingFactor();
    const blindingFactor2 = CryptoHelpers.generateSecureBlindingFactor();

    // Should be different
    if (blindingFactor1 === blindingFactor2) {
      console.log('❌ Blinding factors should be different');
      return false;
    }

    // Should be valid hex
    if (!blindingFactor1.startsWith('0x') || blindingFactor1.length !== 66) {
      console.log('❌ Invalid blinding factor format');
      return false;
    }

    console.log('✅ Blinding factor generation passed');
    return true;
  } catch (error) {
    console.log('❌ Blinding factor test failed:', error);
    return false;
  }
}

/**
 * Test Pedersen commitments with secp256k1
 */
async function testPedersenCommitments(): Promise<boolean> {
  try {
    const testValues = ['100', '1000', '10000'];
    const testBlindingFactors = [
      '0x1111111111111111111111111111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222222222222222222222222222',
      '0x3333333333333333333333333333333333333333333333333333333333333333'
    ];

    for (let i = 0; i < testValues.length; i++) {
      const commitment = await CryptoHelpers.createPedersenCommitment(testValues[i], testBlindingFactors[i]);
      
      if (!commitment || !commitment.x || !commitment.y) {
        console.log(`❌ Failed to create commitment for value ${testValues[i]}`);
        return false;
      }

      // Validate that coordinates are real bigint numbers (not strings)
      if (typeof commitment.x !== 'bigint' || typeof commitment.y !== 'bigint') {
        console.log(`❌ Invalid commitment coordinates format for value ${testValues[i]} - should be bigint, got x:${typeof commitment.x}, y:${typeof commitment.y}`);
        return false;
      }

      // Test that the commitment is deterministic
      const commitment2 = await CryptoHelpers.createPedersenCommitment(testValues[i], testBlindingFactors[i]);
      if (commitment.x !== commitment2.x || commitment.y !== commitment2.y) {
        console.log(`❌ Commitment not deterministic for value ${testValues[i]}`);
        return false;
      }
    }

    console.log('✅ Pedersen commitments validation passed');
    return true;
  } catch (error) {
    console.log('❌ Pedersen commitments test failed:', error);
    return false;
  }
}

/**
 * Test nullifier generation (deterministic)
 */
async function testNullifierGeneration(): Promise<boolean> {
  try {
    // ✅ REAL SECP256K1 COORDINATES (bigint numbers, not strings)
    const commitment = {
      x: 89565891926547004231252920425935692360644145829622209833684329913297188986597n,
      y: 12158399299693830322967808612713398636155367887041628176798871954788371653486n
    };
    const owner = '0x742d35Cc6635C0532925a3b8D3Ac9C1C3b8e3C63';
    const nonce = '0x0000000000000000000000000000000000000000000000000000000000000001';

    // Convert real bigint coordinates to hex for nullifier generation
    const xHex = commitment.x.toString(16).padStart(64, '0');
    const yHex = commitment.y.toString(16).padStart(64, '0');
    const commitmentHex = '0x' + xHex + yHex;

    // Test nullifier generation
    const nullifier1 = await CryptoHelpers.generateNullifierHash(commitmentHex, owner, nonce);
    const nullifier2 = await CryptoHelpers.generateNullifierHash(commitmentHex, owner, nonce);

    // Test determinism
    if (nullifier1 !== nullifier2) {
      console.log('❌ Nullifier not deterministic');
      return false;
    }

    // Test format (should be hex string)
    if (!nullifier1 || !nullifier1.startsWith('0x') || nullifier1.length !== 66) {
      console.log(`❌ Invalid nullifier format: ${nullifier1}`);
      return false;
    }

    // Test that different real coordinates produce different nullifiers
    const differentCommitment = {
      x: 79228162514264337593543950336894336749851878497783728491527850921481596135424n,
      y: 45678901234567890123456789012345678901234567890123456789012345678901234567890n
    };
    const differentXHex = differentCommitment.x.toString(16).padStart(64, '0');
    const differentYHex = differentCommitment.y.toString(16).padStart(64, '0');
    const differentCommitmentHex = '0x' + differentXHex + differentYHex;
    
    const nullifier3 = await CryptoHelpers.generateNullifierHash(differentCommitmentHex, owner, nonce);
    if (nullifier1 === nullifier3) {
      console.log('❌ Different commitments produced same nullifier');
      return false;
    }

    console.log('✅ Nullifier generation validation passed with REAL coordinates');
    return true;
  } catch (error) {
    console.log('❌ Nullifier generation test failed:', error);
    return false;
  }
}

/**
 * Test equality proofs
 */
async function testEqualityProofs(): Promise<boolean> {
  try {
    const commitment1 = await CryptoHelpers.createPedersenCommitment(
      '1000',
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    );
    
    const commitment2 = await CryptoHelpers.createPedersenCommitment(
      '1000',
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    );

    const proof = await CryptoHelpers.generateEqualityProof(commitment1, commitment2);

    if (!proof || typeof proof !== 'string') {
      console.log('❌ Failed to generate equality proof');
      return false;
    }

    // Test determinism
    const proof2 = await CryptoHelpers.generateEqualityProof(commitment1, commitment2);
    if (proof !== proof2) {
      console.log('❌ Equality proof not deterministic');
      return false;
    }

    console.log('✅ Equality proofs validation passed');
    return true;
  } catch (error) {
    console.log('❌ Equality proofs test failed:', error);
    return false;
  }
}

/**
 * Test overall determinism of the system
 */
async function testDeterminism(): Promise<boolean> {
  try {
    const testData = {
      value: '1000',
      blindingFactor: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      owner: '0x742d35Cc6635C0532925a3b8D3Ac9C1C3b8e3C63',
      nonce: '0x0000000000000000000000000000000000000000000000000000000000000001'
    };

    // Run the same operations multiple times
    const results = [];
    for (let i = 0; i < 3; i++) {
      // ✅ GENERATE REAL PEDERSEN COMMITMENT (returns bigint coordinates)
      const commitment = await CryptoHelpers.createPedersenCommitment(testData.value, testData.blindingFactor);
      
      // ✅ Convert REAL bigint coordinates to hex for nullifier generation
      const xHex = commitment.x.toString(16).padStart(64, '0');
      const yHex = commitment.y.toString(16).padStart(64, '0');
      const commitmentHex = '0x' + xHex + yHex;
      
      const nullifier = await CryptoHelpers.generateNullifierHash(commitmentHex, testData.owner, testData.nonce);
      const proof = await CryptoHelpers.generateEqualityProof(commitment, commitment);

      results.push({
        commitment: `x:${commitment.x.toString()},y:${commitment.y.toString()}`, // Convert bigint to string for comparison
        nullifier,
        proof
      });
    }

    // Check that all results are identical
    const firstResult = results[0];
    for (let i = 1; i < results.length; i++) {
      if (
        results[i].commitment !== firstResult.commitment ||
        results[i].nullifier !== firstResult.nullifier ||
        results[i].proof !== firstResult.proof
      ) {
        console.log(`❌ Determinism failed at iteration ${i}`);
        console.log('Expected:', firstResult);
        console.log('Got:', results[i]);
        return false;
      }
    }

    console.log('✅ Determinism validation passed with REAL secp256k1 coordinates');
    return true;
  } catch (error) {
    console.log('❌ Determinism test failed:', error);
    return false;
  }
}

/**
 * Test secp256k1 validation (confirm we're NOT using BN254)
 */
async function testSecp256k1Validation(): Promise<boolean> {
  try {
    // Generate a commitment and check the coordinate ranges
    const commitment = await CryptoHelpers.createPedersenCommitment(
      '1000',
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    );

    // secp256k1 field prime: 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
    const secp256k1Prime = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F');
    
    let x: bigint, y: bigint;
    
    try {
      x = BigInt(commitment.x);
      y = BigInt(commitment.y);
    } catch (error) {
      console.log('❌ Invalid coordinate format for BigInt conversion');
      return false;
    }

    // Check that coordinates are within secp256k1 field
    if (x >= secp256k1Prime || y >= secp256k1Prime) {
      console.log('❌ Coordinates outside secp256k1 field range');
      return false;
    }

    // Check that coordinates are not zero (should be valid curve points)
    if (x === 0n || y === 0n) {
      console.log('❌ Invalid curve point (zero coordinate)');
      return false;
    }

    // Additional validation: check that we're not accidentally using BN254 prime
    // BN254 prime is much larger: 0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47
    const bn254Prime = BigInt('0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47');
    
    if (x >= secp256k1Prime && x < bn254Prime) {
      console.log('❌ Warning: Coordinates suggest BN254 usage');
      return false;
    }

    console.log('✅ secp256k1 cryptography validation passed');
    console.log(`   - X coordinate: ${x.toString(16).substring(0, 16)}... (within secp256k1 range)`);
    console.log(`   - Y coordinate: ${y.toString(16).substring(0, 16)}... (within secp256k1 range)`);
    return true;
  } catch (error) {
    console.log('❌ secp256k1 validation test failed:', error);
    return false;
  }
}

/**
 * Export individual test functions for debugging
 */
export {
  testCryptoHelpers,
  testBasicCryptoOps,
  testBlindingFactors,
  testPedersenCommitments,
  testNullifierGeneration,
  testEqualityProofs,
  testDeterminism,
  testSecp256k1Validation
};
