/**
 * Prueba simulando exactamente el flujo de zenroom.helpers.ts
 */

// Importar la clase real para probar
import { ZenroomHelpers } from './src/utils/zenroom.helpers.js';

async function testRealImplementation() {
  console.log('=== PRUEBA CON IMPLEMENTACIÓN REAL ===');
  
  try {
    // Probar los mismos valores que nuestra prueba exitosa
    const testValue = '1000000000000000000'; // 1 ETH en wei
    const testBlindingFactor = '123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01';
    
    console.log('📝 Input parameters:', {
      value: testValue,
      blindingFactor: testBlindingFactor.slice(0, 10) + '...'
    });
    
    const result = await ZenroomHelpers.createPedersenCommitment(testValue, testBlindingFactor);
    
    console.log('✅ SUCCESS with real implementation:', {
      commitment: result.pedersen_commitment.slice(0, 20) + '...',
      length: result.pedersen_commitment.length
    });
    
    // Simular la validación exacta que hace PrivateUTXOManager
    const commitmentHex = result.pedersen_commitment.substring(2);
    const fullCommitmentX = BigInt('0x' + commitmentHex.substring(0, 64));
    const fullCommitmentY = BigInt('0x' + commitmentHex.substring(64, 128));
    
    const FIELD_MODULUS = BigInt("0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47");
    
    // Validar ecuación de curva: y² = x³ + 3 (mod p)
    const ySquared = (fullCommitmentY * fullCommitmentY) % FIELD_MODULUS;
    const xCubed = (fullCommitmentX * fullCommitmentX * fullCommitmentX) % FIELD_MODULUS;
    const rightSide = (xCubed + 3n) % FIELD_MODULUS;
    
    const isValidPoint = (fullCommitmentX < FIELD_MODULUS && 
                         fullCommitmentY < FIELD_MODULUS && 
                         ySquared === rightSide);
    
    console.log('🔍 Validation result from PrivateUTXOManager logic:', {
      xInField: fullCommitmentX < FIELD_MODULUS,
      yInField: fullCommitmentY < FIELD_MODULUS,
      curveEquation: ySquared === rightSide,
      finalResult: isValidPoint
    });
    
    if (!isValidPoint) {
      console.error('❌ VALIDATION FAILED even though commitment was created!');
      console.error('Debug info:', {
        x: fullCommitmentX.toString(16),
        y: fullCommitmentY.toString(16),
        ySquared: ySquared.toString(16),
        xCubedPlus3: rightSide.toString(16)
      });
    }
    
  } catch (error) {
    console.error('❌ FAILED with real implementation:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Ejecutar la prueba
testRealImplementation().then(() => {
  console.log('✅ Test completed');
}).catch(error => {
  console.error('❌ Test failed:', error);
});
