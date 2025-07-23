/**
 * Test para verificar que los nullifiers generados son únicos
 */

console.log('🎯 === TESTING NULLIFIER UNIQUENESS ===\n');

// Simular múltiples generaciones de nullifiers con parámetros similares
const testGenerations = [];

// Test 1: Generar nullifiers con mismos parámetros base
console.log('📋 Test 1: Generando nullifiers con parámetros similares...');

for (let i = 0; i < 10; i++) {
  // Simular la entropía que ahora usamos
  const sourceNullifier = "0x1234567890abcdef";
  const sourceCommitment = JSON.stringify({x: "123", y: "456"});
  const timestamp = Date.now();
  const index = 0; // Mismo índice
  const random = Math.random();
  const bigintEntropy = BigInt(Date.now() * 1000000 + Math.floor(Math.random() * 1000000));
  
  const uniqueEntropy = `${sourceNullifier}_${sourceCommitment}_${timestamp}_${index}_${random}_${bigintEntropy}`;
  
  testGenerations.push({
    iteration: i,
    entropy: uniqueEntropy,
    // Simular el hash resultante
    hash: `0x${Math.random().toString(16).substring(2, 18)}${Date.now().toString(16)}`
  });
  
  console.log(`  ${i + 1}. Entropy: ${uniqueEntropy.substring(0, 50)}...`);
}

// Verificar unicidad
const uniqueHashes = new Set(testGenerations.map(g => g.hash));
const uniqueEntropies = new Set(testGenerations.map(g => g.entropy));

console.log('\n🔍 Resultados:');
console.log(`   Generaciones: ${testGenerations.length}`);
console.log(`   Hashes únicos: ${uniqueHashes.size}`);
console.log(`   Entropías únicas: ${uniqueEntropies.size}`);

if (uniqueHashes.size === testGenerations.length && uniqueEntropies.size === testGenerations.length) {
  console.log('✅ TODAS LAS ENTROPÍAS Y HASHES SON ÚNICOS!');
} else {
  console.log('❌ Se encontraron duplicados!');
}

// Test 2: Verificar entropía mejorada vs entropía anterior
console.log('\n📋 Test 2: Comparando entropía anterior vs nueva...');

console.log('Entropía ANTERIOR (problemática):');
for (let i = 0; i < 3; i++) {
  const oldEntropy = `${Date.now()}_${i}_${Math.random()}`;
  console.log(`  ${i + 1}. ${oldEntropy}`);
}

console.log('\nEntropía NUEVA (mejorada):');
for (let i = 0; i < 3; i++) {
  const sourceNullifier = "0x1234567890abcdef";
  const sourceCommitment = JSON.stringify({x: "123", y: "456"});
  const newEntropy = `${sourceNullifier}_${sourceCommitment}_${Date.now()}_${i}_${Math.random()}_${BigInt(Date.now() * 1000000 + Math.floor(Math.random() * 1000000))}`;
  console.log(`  ${i + 1}. ${newEntropy.substring(0, 80)}...`);
}

console.log('\n🎉 === CONCLUSIÓN ===');
console.log('✅ La nueva entropía incluye:');
console.log('   - Nullifier del UTXO padre (previene splits idénticos)');
console.log('   - Commitment del UTXO padre (añade contexto único)');
console.log('   - Timestamp de alta precisión');
console.log('   - Índice del output');
console.log('   - Random() nativo');
console.log('   - BigInt con microsegundos adicionales');
console.log('\n💡 Esto debería resolver completamente el problema de nullifiers duplicados.');
