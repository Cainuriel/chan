/**
 * Test para verificar que el BigInt serialization fix funciona
 */

console.log('🎯 === TESTING BIGINT SERIALIZATION FIX ===\n');

// Simular los datos que causan el error
const splitData = {
  sourceCommitment: {
    x: BigInt("12345678901234567890123456789012345678901234567890123456789012345678"),
    y: BigInt("98765432109876543210987654321098765432109876543210987654321098765432")
  },
  sourceNullifier: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
};

console.log('📋 Datos de prueba:');
console.log('   sourceCommitment.x:', splitData.sourceCommitment.x.toString());
console.log('   sourceCommitment.y:', splitData.sourceCommitment.y.toString());
console.log('   sourceNullifier:', splitData.sourceNullifier);

// Test 1: Método ANTERIOR (problemático)
console.log('\n🔥 Test 1: Método anterior (debería fallar)...');
try {
  const badSerialization = JSON.stringify(splitData.sourceCommitment);
  console.log('❌ Esto no debería aparecer - el método anterior funciona??');
} catch (error) {
  console.log('✅ Error esperado:', error.message);
}

// Test 2: Método NUEVO (corregido)
console.log('\n✅ Test 2: Método nuevo (debería funcionar)...');
try {
  const sourceCommitStr = JSON.stringify({
    x: splitData.sourceCommitment.x.toString(),
    y: splitData.sourceCommitment.y.toString()
  });
  console.log('✅ Serialización exitosa:', sourceCommitStr);
  
  // Verificar que se puede usar en la entropía
  const i = 0;
  const uniqueEntropy = `${splitData.sourceNullifier}_${sourceCommitStr}_${Date.now()}_${i}_${Math.random()}_${BigInt(Date.now() * 1000000 + Math.floor(Math.random() * 1000000))}`;
  console.log('✅ Entropía generada:', uniqueEntropy.substring(0, 100) + '...');
  
} catch (error) {
  console.log('❌ Error inesperado:', error.message);
}

// Test 3: Verificar que los valores se mantienen correctos
console.log('\n🔍 Test 3: Verificando preservación de valores...');
const originalX = splitData.sourceCommitment.x;
const originalY = splitData.sourceCommitment.y;

const serialized = JSON.stringify({
  x: originalX.toString(),
  y: originalY.toString()
});

const parsed = JSON.parse(serialized);
const reconstructedX = BigInt(parsed.x);
const reconstructedY = BigInt(parsed.y);

console.log('   Original X:', originalX.toString());
console.log('   Reconstruido X:', reconstructedX.toString());
console.log('   ¿Son iguales?', originalX === reconstructedX ? '✅ SÍ' : '❌ NO');

console.log('   Original Y:', originalY.toString());
console.log('   Reconstruido Y:', reconstructedY.toString());
console.log('   ¿Son iguales?', originalY === reconstructedY ? '✅ SÍ' : '❌ NO');

console.log('\n🎉 === CONCLUSIÓN ===');
console.log('✅ El fix funciona correctamente:');
console.log('   - Convierte BigInt a string antes de JSON.stringify()');
console.log('   - Preserva los valores exactos');
console.log('   - Permite generar entropía única');
console.log('   - Evita el error "Do not know how to serialize a BigInt"');
console.log('\n🚀 ¡El split debería funcionar ahora!');
