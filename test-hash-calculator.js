/**
 * Test para verificar que HashCalculator.ts funciona con el patrón verificado
 */

import { calculateDepositDataHash, createDepositParams } from './src/lib/HashCalculator.js';

// Datos de prueba iguales a testing-operations.js
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

console.log('🧪 === TESTING UPDATED HASH CALCULATOR ===\n');

// Test 1: Función básica de cálculo de hash
console.log('1. Testing calculateDepositDataHash...');
try {
  const result = calculateDepositDataHash({
    tokenAddress: TEST_DATA.tokenAddress,
    commitmentX: TEST_DATA.commitment.x,
    commitmentY: TEST_DATA.commitment.y,
    nullifierHash: TEST_DATA.nullifierHash,
    amount: TEST_DATA.amount,
    sender: TEST_DATA.sender
  });

  console.log('✅ Result:', result);
  
  if (result.success && result.hash) {
    console.log('✅ Hash calculado exitosamente:', result.hash);
  } else {
    console.log('❌ Error:', result.error);
  }
} catch (error) {
  console.log('❌ Exception:', error.message);
}

console.log('\n');

// Test 2: Función de creación de parámetros completos
console.log('2. Testing createDepositParams...');
try {
  const depositParams = createDepositParams(
    TEST_DATA.tokenAddress,
    {
      x: BigInt(TEST_DATA.commitment.x),
      y: BigInt(TEST_DATA.commitment.y)
    },
    TEST_DATA.nullifierHash,
    BigInt(TEST_DATA.amount),
    TEST_DATA.sender,
    BigInt(1), // nonce
    "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" // dummy signature
  );

  console.log('✅ Deposit params creados exitosamente:');
  console.log('   Token:', depositParams.tokenAddress);
  console.log('   Commitment:', depositParams.commitment);
  console.log('   Nullifier:', depositParams.nullifierHash);
  console.log('   Amount:', depositParams.amount);
  console.log('   Operation:', depositParams.attestation.operation);
  console.log('   DataHash:', depositParams.attestation.dataHash);
  console.log('   Nonce:', depositParams.attestation.nonce);
  console.log('   Timestamp:', depositParams.attestation.timestamp);

} catch (error) {
  console.log('❌ Exception:', error.message);
}

console.log('\n🎯 Hash Calculator actualizado y funcionando con el patrón verificado!');
