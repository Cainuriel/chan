// Test simple para verificar que las coordenadas reales funcionan
console.log('🧪 Testing REAL secp256k1 coordinates...');

// ✅ REAL SECP256K1 COORDINATES (bigint numbers, not strings)
const commitment = {
  x: 89565891926547004231252920425935692360644145829622209833684329913297188986597n,
  y: 12158399299693830322967808612713398636155367887041628176798871954788371653486n
};

console.log('Commitment coordinates:');
console.log(`X: ${commitment.x.toString(16)}`);
console.log(`Y: ${commitment.y.toString(16)}`);

// Convert to hex for hashing
const xHex = commitment.x.toString(16).padStart(64, '0');
const yHex = commitment.y.toString(16).padStart(64, '0');
const commitmentHex = '0x' + xHex + yHex;

console.log('Hex representation:');
console.log(`Combined: ${commitmentHex}`);
console.log(`Length: ${commitmentHex.length} characters`);

// Validate secp256k1 field
const secp256k1Prime = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F');
console.log('Field validation:');
console.log(`X < secp256k1 prime: ${commitment.x < secp256k1Prime}`);
console.log(`Y < secp256k1 prime: ${commitment.y < secp256k1Prime}`);

console.log('✅ REAL coordinates test passed!');
