// Using dynamic imports since we're in ES module mode
import crypto from 'crypto';

// Mock Zenroom for testing
global.zenroom = {
  script: (script, options = {}) => {
    return new Promise((resolve) => {
      console.log(`🔧 Zenroom script execution simulated`);
      
      if (script.includes('curve generators')) {
        resolve({
          result: JSON.stringify({
            P: { x: "1", y: "2" },
            Q: { x: "3", y: "4" }
          })
        });
      } else if (script.includes('split')) {
        // Simulate split with unique nullifiers
        const nullifier1 = `0x${crypto.randomBytes(32).toString('hex')}`;
        const nullifier2 = `0x${crypto.randomBytes(32).toString('hex')}`;
        
        resolve({
          result: JSON.stringify({
            outputs: {
              commitments: [
                { x: "111", y: "222" },
                { x: "333", y: "444" }
              ],
              nullifiers: [nullifier1, nullifier2]
            }
          })
        });
      } else if (script.includes('withdraw')) {
        resolve({
          result: JSON.stringify({
            nullifier: `0x${crypto.randomBytes(32).toString('hex')}`,
            proof: {
              a: ["1", "2"],
              b: [["3", "4"], ["5", "6"]],
              c: ["7", "8"]
            }
          })
        });
      }
    });
  }
};

async function testWithdrawAfterSplit() {
  console.log('\n🎯 === TESTING WITHDRAW AFTER SPLIT ===\n');
  
  try {
    // Dynamic imports for ES modules
    const { ManagerUTXO } = await import('./src/lib/ManagerUTXO.ts');
    const { PrivateUTXOStorage } = await import('./src/lib/PrivateUTXOStorage.ts');
    const { AttestationService } = await import('./src/lib/AttestationService.ts');
    const { initializeProvider } = await import('./src/utils/providers/ethers.provider.ts');
    const { UTXOType } = await import('./src/types/utxo.types.ts');
    
    // Initialize provider
    await initializeProvider();
    
    // Mock attestation service
    AttestationService.getAttestation = async (operation, dataHash, nonce) => {
      return {
        operation,
        dataHash,
        nonce,
        timestamp: Math.floor(Date.now() / 1000),
        signature: '0x' + crypto.randomBytes(64).toString('hex')
      };
    };
    
    const manager = new ManagerUTXO();
    const testAddress = '0x1234567890123456789012345678901234567890';
    
    // Step 1: Create a test UTXO
    console.log('📝 Creating test UTXO...');
    const testUTXO = {
      id: 'test-utxo-' + Date.now(),
      amount: 1000,
      owner: testAddress,
      tokenAddress: '0xAbCdEf1234567890123456789012345678901234',
      commitment: '0x' + crypto.randomBytes(32).toString('hex'),
      nullifierHash: '0x' + crypto.randomBytes(32).toString('hex'),
      utxoType: UTXOType.DEPOSIT,
      localCreatedAt: Date.now(),
      confirmed: true,
      isPrivate: true,
      cryptographyType: 'BN254',
      blindingFactor: '123'
    };
    
    // Save test UTXO
    manager.privateUTXOs.set(testUTXO.id, testUTXO);
    PrivateUTXOStorage.savePrivateUTXO(testAddress, testUTXO);
    console.log(`✅ Created test UTXO: ${testUTXO.id}`);
    
    // Step 2: Perform split
    console.log('\n🔀 Performing split operation...');
    const splitParams = {
      inputUTXOId: testUTXO.id,
      outputAmounts: [400, 600],
      outputOwners: [testAddress, testAddress]
    };
    
    const splitResult = await manager.splitPrivateUTXO(splitParams);
    console.log('✅ Split completed successfully');
    console.log(`📦 Created ${splitResult.outputUTXOIds.length} output UTXOs:`);
    
    // Check nullifiers are unique
    const outputUTXOs = splitResult.outputUTXOIds.map(id => manager.privateUTXOs.get(id));
    const nullifiers = outputUTXOs.map(utxo => utxo.nullifierHash);
    
    console.log('🔍 Checking nullifiers uniqueness:');
    nullifiers.forEach((nullifier, index) => {
      console.log(`   UTXO ${index + 1}: ${nullifier}`);
    });
    
    const uniqueNullifiers = new Set(nullifiers);
    if (uniqueNullifiers.size === nullifiers.length) {
      console.log('✅ All nullifiers are unique!');
    } else {
      console.log('❌ Duplicate nullifiers found!');
      return;
    }
    
    // Step 3: Attempt withdraw from first output UTXO
    console.log('\n💰 Attempting withdraw from first split output...');
    const firstOutputUTXO = outputUTXOs[0];
    console.log(`📍 Withdrawing from UTXO: ${firstOutputUTXO.id}`);
    console.log(`💵 Amount: ${firstOutputUTXO.amount}`);
    console.log(`🔐 Nullifier: ${firstOutputUTXO.nullifierHash}`);
    
    const withdrawParams = {
      utxoId: firstOutputUTXO.id,
      recipient: testAddress,
      amount: firstOutputUTXO.amount
    };
    
    const withdrawResult = await manager.withdrawPrivateUTXO(withdrawParams);
    console.log('✅ Withdraw completed successfully!');
    console.log(`📝 Transaction hash: ${withdrawResult.transactionHash}`);
    
    // Step 4: Attempt withdraw from second output UTXO
    console.log('\n💰 Attempting withdraw from second split output...');
    const secondOutputUTXO = outputUTXOs[1];
    console.log(`📍 Withdrawing from UTXO: ${secondOutputUTXO.id}`);
    console.log(`💵 Amount: ${secondOutputUTXO.amount}`);
    console.log(`🔐 Nullifier: ${secondOutputUTXO.nullifierHash}`);
    
    const withdrawParams2 = {
      utxoId: secondOutputUTXO.id,
      recipient: testAddress,
      amount: secondOutputUTXO.amount
    };
    
    const withdrawResult2 = await manager.withdrawPrivateUTXO(withdrawParams2);
    console.log('✅ Second withdraw completed successfully!');
    console.log(`📝 Transaction hash: ${withdrawResult2.transactionHash}`);
    
    console.log('\n🎉 === ALL TESTS PASSED ===');
    console.log('✅ Split generates unique nullifiers');
    console.log('✅ Withdraw works with split outputs');
    console.log('✅ No nullifier reuse detected');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code) {
      console.error(`🚨 Error code: ${error.code}`);
    }
    console.error('📋 Full error:', error);
  }
}

// Run the test
testWithdrawAfterSplit().catch(console.error);
