/**
 * Testing Operations - Testing script for UTXO contract operations validation
 * 
 * This script tests all main contract operations validation functions:
 * - validateDepositParams
 * - validateSplitParams (future)
 * - validateTransferParams (future) 
 * - validateWithdrawParams (future)
 * 
 * Focus on testing the best way to construct data from frontend for each operation.
 */

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

// Test data - using realistic values with proper checksums
const TEST_DATA = {
  tokenAddress: '0x1234567890123456789012345678901234567890',
  commitment: {
    x: '12345678901234567890123456789012345678901234567890123456789012345678',
    y: '98765432109876543210987654321098765432109876543210987654321098765432'
  },
  nullifierHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  amount: '1000000000000000000', // 1 ETH in wei
  sender: '0x9876543210987654321098765432109876543210'
};

// Get the expected backend signer from the error message
const EXPECTED_BACKEND_SIGNER = '0x86df4b738d592c31f4a9a657d6c8d6d05dc1d462';

// Contract configuration
const CONTRACT_CONFIG = {
  // Try different networks/contracts
  contracts: [
    {
      name: 'Amoy Testnet',
      rpcUrl: 'https://rpc-amoy.polygon.technology/',
      contractAddress: '0xB51fCb4Ba30cFA3deB2ceB062d2908D772777f6A', // From the app config
    },
    {
      name: 'Alastria Network',
      rpcUrl: 'http://65.109.121.58:8545',
      contractAddress: '0xfFc0B9175A53F98bE81e59bF0C3bf93DAe2d3260', // From the app config
    }
  ]
};

console.log('� === UTXO CONTRACT OPERATIONS TESTING ===\n');
console.log('Test data:', TEST_DATA);
console.log('Available contracts:', CONTRACT_CONFIG.contracts.map(c => `${c.name}: ${c.contractAddress}`));
console.log('\n');

/**
 * Load contract ABI and setup provider
 */
async function setupContract() {
  // Extended ABI for all validation functions we need
  const contractABI = [
    // Validation functions
    "function validateDepositParams((address tokenAddress, (uint256 x, uint256 y) commitment, bytes32 nullifierHash, uint256 amount, (string operation, bytes32 dataHash, uint256 nonce, uint256 timestamp, bytes signature) attestation), address sender) external view returns (bool success, string memory errorMessage)",
    
    // Hash calculation functions
    "function calculateDepositDataHash((address tokenAddress, (uint256 x, uint256 y) commitment, bytes32 nullifierHash, uint256 amount, (string operation, bytes32 dataHash, uint256 nonce, uint256 timestamp, bytes signature) attestation), address sender) external pure returns (bytes32)",
    "function calculateSplitDataHash((address, (uint256 x, uint256 y) inputCommitment, (uint256 x, uint256 y)[] outputCommitments, bytes32 inputNullifier, bytes32[] outputNullifiers, (string operation, bytes32 dataHash, uint256 nonce, uint256 timestamp, bytes signature) attestation), address sender) external pure returns (bytes32)",
    "function calculateTransferDataHash((address, (uint256 x, uint256 y) inputCommitment, (uint256 x, uint256 y) outputCommitment, bytes32 inputNullifier, bytes32 outputNullifier, (string operation, bytes32 dataHash, uint256 nonce, uint256 timestamp, bytes signature) attestation), address sender) external pure returns (bytes32)",
    "function calculateWithdrawDataHash((address, (uint256 x, uint256 y) commitment, bytes32 nullifierHash, uint256 revealedAmount, (string operation, bytes32 dataHash, uint256 nonce, uint256 timestamp, bytes signature) attestation), address sender) external pure returns (bytes32)",
    
    // Utility functions
    "function getCurrentNonce() external view returns (uint256)",
    "function isNullifierUsed(bytes32 nullifier) external view returns (bool)",
    "function getRegisteredTokens() external view returns (address[] memory)"
  ];
  
  // Try to connect to each contract until one works
  for (const config of CONTRACT_CONFIG.contracts) {
    try {
      console.log(`🔄 Trying to connect to ${config.name}...`);
      
      // Setup provider
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      
      // Test connection
      await provider.getNetwork();
      
      // Create contract instance
      const contract = new ethers.Contract(config.contractAddress, contractABI, provider);
      
      // Test contract call
      try {
        await contract.getCurrentNonce();
        console.log(`✅ Connected to ${config.name} successfully`);
        console.log(`📍 Contract address: ${config.contractAddress}`);
        console.log(`🌐 RPC URL: ${config.rpcUrl}\n`);
        return contract;
      } catch (contractError) {
        console.log(`⚠️ Contract at ${config.name} not responding: ${contractError.message}`);
      }
    } catch (error) {
      console.log(`❌ Failed to connect to ${config.name}: ${error.message}`);
    }
  }
  
  console.log('❌ Could not connect to any contract\n');
  return null;
}

/**
 * Create a proper signature for testing
 */
async function createTestSignature(operation, dataHash, nonce, timestamp, privateKey) {
  try {
    // Create a wallet from private key
    const wallet = new ethers.Wallet(privateKey);
    
    // Create the message hash that the contract expects
    const messageHash = ethers.keccak256(
      ethers.solidityPacked(
        ['string', 'bytes32', 'uint256', 'uint256'],
        [operation, dataHash, nonce, timestamp]
      )
    );
    
    // Sign the message
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));
    
    return { signature, signerAddress: wallet.address };
  } catch (error) {
    console.log('❌ Could not create signature:', error.message);
    return null;
  }
}

/**
 * Calculate hash for deposit operation
 */
function calculateDepositHash(tokenAddress, commitment, nullifierHash, amount, sender) {
  return ethers.keccak256(
    ethers.solidityPacked(
      ['address', 'uint256', 'uint256', 'bytes32', 'uint256', 'address'],
      [tokenAddress, commitment.x, commitment.y, nullifierHash, amount, sender]
    )
  );
}

/**
 * Test validateDepositParams function with different data combinations
 */
async function testValidateDepositParams(contract) {
  console.log('\n💰 === TESTING VALIDATE DEPOSIT PARAMS ===\n');
  
  if (!contract) {
    console.log('❌ No contract available for testing');
    return [];
  }

  // Get current nonce from contract
  let currentNonce;
  try {
    currentNonce = await contract.getCurrentNonce();
    console.log(`📊 Current contract nonce: ${currentNonce}`);
  } catch (error) {
    console.log('⚠️ Could not get nonce from contract, using 0');
    currentNonce = 0;
  }

  const testCases = [
    {
      name: 'Basic Valid Deposit',
      data: {
        tokenAddress: TEST_DATA.tokenAddress,
        commitment: TEST_DATA.commitment,
        nullifierHash: TEST_DATA.nullifierHash,
        amount: TEST_DATA.amount,
        sender: TEST_DATA.sender
      }
    },
    {
      name: 'Different Amount',
      data: {
        tokenAddress: TEST_DATA.tokenAddress,
        commitment: TEST_DATA.commitment,
        nullifierHash: TEST_DATA.nullifierHash,
        amount: '500000000000000000', // 0.5 ETH
        sender: TEST_DATA.sender
      }
    },
    {
      name: 'Different Token Address',
      data: {
        tokenAddress: '0xA0b86a33E6441398e2e2e95be90fE0b80c2d4F7c',
        commitment: TEST_DATA.commitment,
        nullifierHash: TEST_DATA.nullifierHash,
        amount: TEST_DATA.amount,
        sender: TEST_DATA.sender
      }
    }
  ];

  console.log(`🔐 Note: Expected backend signer: ${EXPECTED_BACKEND_SIGNER}`);
  console.log('📝 Testing with dummy signatures (will fail signature validation but test data structure)\n');

  const results = [];

  for (const [index, testCase] of testCases.entries()) {
    console.log(`${index + 1}. Testing: ${testCase.name}`);
    
    try {
      // Calculate the data hash
      const dataHash = calculateDepositHash(
        testCase.data.tokenAddress,
        testCase.data.commitment,
        testCase.data.nullifierHash,
        testCase.data.amount,
        testCase.data.sender
      );

      console.log(`   📊 Calculated dataHash: ${dataHash}`);

      // Create deposit params
      const depositParams = {
        tokenAddress: testCase.data.tokenAddress,
        commitment: {
          x: testCase.data.commitment.x,
          y: testCase.data.commitment.y
        },
        nullifierHash: testCase.data.nullifierHash,
        amount: testCase.data.amount,
        attestation: {
          operation: "DEPOSIT",
          dataHash: dataHash,
          nonce: BigInt(currentNonce) + BigInt(1),
          timestamp: Math.floor(Date.now() / 1000),
          signature: "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" // Dummy signature
        }
      };

      console.log(`   📋 Deposit params structure:`);
      console.log(`      Token: ${depositParams.tokenAddress}`);
      console.log(`      Commitment: (${depositParams.commitment.x}, ${depositParams.commitment.y})`);
      console.log(`      Nullifier: ${depositParams.nullifierHash}`);
      console.log(`      Amount: ${depositParams.amount}`);
      console.log(`      Operation: ${depositParams.attestation.operation}`);
      console.log(`      Nonce: ${depositParams.attestation.nonce}`);
      console.log(`      Timestamp: ${depositParams.attestation.timestamp}`);

      // Test against contract validateDepositParams
      try {
        const [success, errorMessage] = await contract.validateDepositParams(depositParams, testCase.data.sender);
        
        console.log(`   📊 Validation Result: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
        if (!success) {
          console.log(`   📝 Error: ${errorMessage}`);
          
          // Analyze the error type
          if (errorMessage.includes('InvalidDataHash')) {
            console.log(`   🔍 Hash mismatch detected - contract expects different hash`);
          } else if (errorMessage.includes('UnauthorizedBackend')) {
            console.log(`   🔐 Signature validation failed (expected with dummy signature)`);
          } else if (errorMessage.includes('InvalidNonce')) {
            console.log(`   🔢 Nonce issue - check nonce sequence`);
          } else if (errorMessage.includes('StaleAttestation')) {
            console.log(`   ⏰ Timestamp too old`);
          }
        }

        // Also test direct hash calculation to verify our frontend calculation
        try {
          const contractHash = await contract.calculateDepositDataHash(depositParams, testCase.data.sender);
          console.log(`   🏛️ Contract calculated hash: ${contractHash}`);
          
          const hashMatch = dataHash.toLowerCase() === contractHash.toLowerCase();
          console.log(`   🎯 Hash match: ${hashMatch ? '✅ YES' : '❌ NO'}`);
          
          if (!hashMatch) {
            console.log(`   ⚠️ Hash mismatch:`);
            console.log(`      Frontend: ${dataHash}`);
            console.log(`      Contract: ${contractHash}`);
          }

          results.push({
            name: testCase.name,
            validationSuccess: success,
            errorMessage: success ? null : errorMessage,
            frontendHash: dataHash,
            contractHash: contractHash,
            hashMatch: hashMatch,
            testData: testCase.data,
            success: true
          });

        } catch (hashError) {
          console.log(`   ❌ Contract hash calculation failed: ${hashError.message}`);
          results.push({
            name: testCase.name,
            validationSuccess: success,
            errorMessage: success ? null : errorMessage,
            frontendHash: dataHash,
            hashError: hashError.message,
            testData: testCase.data,
            success: false
          });
        }

      } catch (contractError) {
        console.log(`   ❌ Contract validation call failed: ${contractError.message}`);
        results.push({
          name: testCase.name,
          contractError: contractError.message,
          frontendHash: dataHash,
          testData: testCase.data,
          success: false
        });
      }

    } catch (error) {
      console.log(`   ❌ Test case setup failed: ${error.message}`);
      results.push({
        name: testCase.name,
        setupError: error.message,
        testData: testCase.data,
        success: false
      });
    }

    console.log('');
  }

  return results;
}

/**
 * Analyze results from validateDepositParams testing
 */
function analyzeDepositResults(results) {
  console.log('📊 === DEPOSIT VALIDATION ANALYSIS ===\n');
  
  const successfulTests = results.filter(r => r.success);
  const hashMatches = results.filter(r => r.hashMatch);
  const validationPasses = results.filter(r => r.validationSuccess);
  const signatureFailures = results.filter(r => !r.validationSuccess && r.errorMessage && r.errorMessage.includes('UnauthorizedBackend'));
  const hashMismatches = results.filter(r => !r.hashMatch && r.success);

  console.log(`� Summary:`);
  console.log(`   Total test cases: ${results.length}`);
  console.log(`   Successful test runs: ${successfulTests.length}`);
  console.log(`   Hash matches: ${hashMatches.length}`);
  console.log(`   Validation passes: ${validationPasses.length}`);
  console.log(`   Signature failures (expected): ${signatureFailures.length}`);
  console.log(`   Hash mismatches (unexpected): ${hashMismatches.length}\n`);

  if (hashMatches.length > 0) {
    console.log('✅ HASH CALCULATION WORKING CORRECTLY:');
    hashMatches.forEach(result => {
      console.log(`   ✓ ${result.name} - Frontend and contract hashes match`);
    });
    console.log('');
  }

  if (hashMismatches.length > 0) {
    console.log('❌ HASH CALCULATION ISSUES:');
    hashMismatches.forEach(result => {
      console.log(`   ✗ ${result.name}:`);
      console.log(`     Frontend: ${result.frontendHash}`);
      console.log(`     Contract: ${result.contractHash}`);
    });
    console.log('');
  }

  if (signatureFailures.length > 0) {
    console.log('🔐 SIGNATURE VALIDATION (Expected to fail with dummy signatures):');
    signatureFailures.forEach(result => {
      console.log(`   ⚠️ ${result.name} - ${result.errorMessage}`);
    });
    console.log('');
  }

  // Check for unexpected errors
  const unexpectedErrors = results.filter(r => 
    !r.success || 
    (!r.validationSuccess && r.errorMessage && 
     !r.errorMessage.includes('UnauthorizedBackend') && 
     !r.errorMessage.includes('InvalidDataHash'))
  );

  if (unexpectedErrors.length > 0) {
    console.log('⚠️ UNEXPECTED ISSUES:');
    unexpectedErrors.forEach(result => {
      console.log(`   ⚠️ ${result.name}:`);
      if (result.setupError) console.log(`     Setup Error: ${result.setupError}`);
      if (result.contractError) console.log(`     Contract Error: ${result.contractError}`);
      if (result.hashError) console.log(`     Hash Error: ${result.hashError}`);
      if (result.errorMessage && !result.errorMessage.includes('UnauthorizedBackend')) {
        console.log(`     Validation Error: ${result.errorMessage}`);
      }
    });
    console.log('');
  }

  return results;
}

/**
 * Generate sample code for successful deposit operation
 */
function generateDepositSampleCode(results) {
  console.log('\n💡 === SAMPLE CODE FOR DEPOSIT OPERATION ===\n');
  
  const workingCase = results.find(r => r.hashMatch && r.success);
  
  if (workingCase) {
    console.log('// ✅ Working deposit parameter construction:');
    console.log('');
    console.log('function createDepositParams(tokenAddress, commitment, nullifierHash, amount, sender) {');
    console.log('  // 1. Calculate the data hash');
    console.log('  const dataHash = ethers.keccak256(');
    console.log('    ethers.solidityPacked(');
    console.log('      ["address", "uint256", "uint256", "bytes32", "uint256", "address"],');
    console.log('      [tokenAddress, commitment.x, commitment.y, nullifierHash, amount, sender]');
    console.log('    )');
    console.log('  );');
    console.log('');
    console.log('  // 2. Get current nonce + 1');
    console.log('  const nonce = await contract.getCurrentNonce() + 1;');
    console.log('');
    console.log('  // 3. Create attestation with proper signature');
    console.log('  const timestamp = Math.floor(Date.now() / 1000);');
    console.log('  const signature = await createBackendSignature("DEPOSIT", dataHash, nonce, timestamp);');
    console.log('');
    console.log('  // 4. Construct deposit params');
    console.log('  return {');
    console.log('    tokenAddress,');
    console.log('    commitment: { x: commitment.x, y: commitment.y },');
    console.log('    nullifierHash,');
    console.log('    amount,');
    console.log('    attestation: {');
    console.log('      operation: "DEPOSIT",');
    console.log('      dataHash,');
    console.log('      nonce,');
    console.log('      timestamp,');
    console.log('      signature');
    console.log('    }');
    console.log('  };');
    console.log('}');
    console.log('');
    console.log('// ✅ Working example values:');
    console.log(`const tokenAddress = "${workingCase.testData.tokenAddress}";`);
    console.log(`const commitment = { x: "${workingCase.testData.commitment.x}", y: "${workingCase.testData.commitment.y}" };`);
    console.log(`const nullifierHash = "${workingCase.testData.nullifierHash}";`);
    console.log(`const amount = "${workingCase.testData.amount}";`);
    console.log(`const sender = "${workingCase.testData.sender}";`);
    console.log('');
  } else {
    console.log('❌ No working test case found. Check the hash calculation logic.');
  }
}

/**
 * Test utility functions
 */
async function testUtilityFunctions(contract) {
  console.log('\n🛠️ === TESTING UTILITY FUNCTIONS ===\n');
  
  if (!contract) {
    console.log('❌ No contract available');
    return;
  }

  try {
    // Test getCurrentNonce
    console.log('📊 Testing getCurrentNonce...');
    const nonce = await contract.getCurrentNonce();
    console.log(`   Current nonce: ${nonce}`);
    
    // Test isNullifierUsed
    console.log('� Testing isNullifierUsed...');
    const isUsed = await contract.isNullifierUsed(TEST_DATA.nullifierHash);
    console.log(`   Nullifier ${TEST_DATA.nullifierHash.slice(0, 10)}... is used: ${isUsed}`);
    
    // Test getRegisteredTokens
    console.log('💰 Testing getRegisteredTokens...');
    const tokens = await contract.getRegisteredTokens();
    console.log(`   Registered tokens count: ${tokens.length}`);
    if (tokens.length > 0) {
      console.log(`   First token: ${tokens[0]}`);
    }
    
  } catch (error) {
    console.log(`❌ Utility function test failed: ${error.message}`);
  }
  
  console.log('');
}

// ========================
// MAIN EXECUTION
// ========================

async function main() {
  console.log('Starting UTXO contract operations testing...\n');

  // Setup contract connection
  const contract = await setupContract();
  
  if (!contract) {
    console.log('❌ Could not connect to any contract. Make sure:');
    console.log('1. At least one network is accessible');
    console.log('2. Contract is deployed on that network');
    console.log('3. Contract addresses are correct');
    console.log('\nSkipping contract tests...\n');
    return;
  }

  // Test utility functions first
  await testUtilityFunctions(contract);

  // Test validateDepositParams extensively
  const depositResults = await testValidateDepositParams(contract);

  // Analyze deposit results
  analyzeDepositResults(depositResults);

  // Generate sample code for working cases
  generateDepositSampleCode(depositResults);

  console.log('\n🎯 === CONCLUSION ===');
  console.log('✅ Tested validateDepositParams function comprehensively');
  
  const workingCases = depositResults.filter(r => r.hashMatch && r.success);
  if (workingCases.length > 0) {
    console.log(`🎉 Found ${workingCases.length} working test case(s) for deposit operation!`);
    console.log('📋 Key findings:');
    console.log('   ✓ Hash calculation method is correct');
    console.log('   ✓ Data structure format is correct');
    console.log('   ✓ Ready for backend signature integration');
  } else {
    console.log('❌ No fully working test cases found');
    console.log('🔍 Check the hash calculation and data structure');
  }
  
  console.log('\n🚀 Next steps:');
  console.log('1. Integrate backend signature creation');
  console.log('2. Test with real token addresses and amounts');
  console.log('3. Add tests for split, transfer, and withdraw operations');
  console.log('4. Implement the working patterns in your frontend code\n');
}

// Run the test
main().catch(console.error);
