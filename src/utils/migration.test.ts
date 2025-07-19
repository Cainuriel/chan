// src/utils/migration.test.ts
import { CryptoHelpers as ZenroomHelpers } from './crypto.helpers';

export async function testMigration() {
  console.log('🧪 Testing crypto migration...');
  
  const results = {
    initialization: false,
    commitment: false,
    attestation: false,
    equalityProof: false,
    overall: false,
    data: {} as any
  };
  
  try {
    // 1. Test inicialización
    const success = await ZenroomHelpers.initialize();
    results.initialization = success;
    console.log(`✅ Initialization: ${success ? 'PASS' : 'FAIL'}`);
    
    // 2. Test commitment
    const commitment = await ZenroomHelpers.createPedersenCommitment('1000');
    results.commitment = !!(commitment.x && commitment.y);
    results.data.commitment = commitment;
    console.log(`✅ Commitment: ${results.commitment ? 'PASS' : 'FAIL'}`);
    console.log(`   x: ${commitment.x}`);
    console.log(`   y: ${commitment.y}`);
    
    // 3. Test attestation
    const attestation = await ZenroomHelpers.createDepositWithAttestation(
      BigInt(1000),
      '0x86df4b738d592c31f4a9a657d6c8d6d05dc1d462',
      '0x0000000000000000000000000000000000000000'
    );
    results.attestation = !!(attestation.commitment && attestation.attestation);
    results.data.attestation = attestation;
    console.log(`✅ Attestation: ${results.attestation ? 'PASS' : 'FAIL'}`);
    console.log(`   nullifier: ${attestation.attestation}`);
    
    // 4. Test equality proof
    const proof = await ZenroomHelpers.generateEqualityProof(commitment, commitment);
    results.equalityProof = proof.length > 0;
    results.data.proof = proof;
    console.log(`✅ Equality proof: ${results.equalityProof ? 'PASS' : 'FAIL'}`);
    console.log(`   proof length: ${proof.length}`);
    
    results.overall = results.initialization && results.commitment && results.attestation && results.equalityProof;
    
    console.log('🎉 Migration test completed successfully!');
    console.log('📊 Final Results:', results);
    return results;
    
  } catch (error) {
    console.error('❌ Migration test failed:', error);
    results.overall = false;
    return results;
  }
}