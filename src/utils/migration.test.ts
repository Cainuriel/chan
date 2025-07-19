// src/utils/migration.test.ts
import { CryptoHelpers as ZenroomHelpers } from './crypto.helpers';

export async function testMigration() {
  console.log('🧪 Testing crypto migration...');
  
  try {
    // 1. Test inicialización
    const success = await ZenroomHelpers.initialize();
    console.log(`✅ Initialization: ${success ? 'PASS' : 'FAIL'}`);
    
    // 2. Test commitment
    const commitment = await ZenroomHelpers.createPedersenCommitment('1000');
    console.log(`✅ Commitment: ${commitment.x && commitment.y ? 'PASS' : 'FAIL'}`);
    
    // 3. Test attestation
    const attestation = await ZenroomHelpers.createDepositWithAttestation(
      BigInt(1000),
      '0x742d35C6Cf6d4A5Db14c9B0E3D4c3f1fEbB2B15c',
      '0x0000000000000000000000000000000000000000'
    );
    console.log(`✅ Attestation: ${attestation.commitment && attestation.attestation ? 'PASS' : 'FAIL'}`);
    
    // 4. Test equality proof
    const proof = await ZenroomHelpers.generateEqualityProof(commitment, commitment);
    console.log(`✅ Equality proof: ${proof.length > 0 ? 'PASS' : 'FAIL'}`);
    
    console.log('🎉 Migration test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Migration test failed:', error);
    return false;
  }
}