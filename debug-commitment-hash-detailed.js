import { ethers } from 'ethers';

/**
 * Debug detallado del problema de commitmentHash entre frontend y contrato
 */

// Simulación de commitment point
const exampleCommitment = {
  x: BigInt('98765432109876543210987654321098765432109876543210987654321098765432'),
  y: BigInt('12345678901234567890123456789012345678901234567890123456789012345678')
};

console.log('🔍 DEBUG: Análisis detallado del problema commitmentHash');
console.log('='.repeat(70));

// 1. Hash como lo hace el contrato Solidity
console.log('\n1️⃣ HASH DEL CONTRATO (Solidity):');
const contractHash = ethers.keccak256(
  ethers.solidityPacked(['uint256', 'uint256'], [exampleCommitment.x, exampleCommitment.y])
);
console.log('✅ Hash completo (32 bytes):', contractHash);
console.log('   Longitud:', contractHash.length, 'caracteres');

// 2. Hash truncado como se muestra en logs del frontend
console.log('\n2️⃣ HASH TRUNCADO (Frontend logs):');
const truncatedHash = contractHash.slice(0, 10) + '...';
console.log('❌ Hash truncado (solo logs):', truncatedHash);
console.log('   Longitud:', truncatedHash.length, 'caracteres');

// 3. Verificar si el problema está en comparación de strings
console.log('\n3️⃣ PROBLEMA POTENCIAL:');
console.log('   - Contrato espera:', contractHash);
console.log('   - Si frontend envía truncado:', truncatedHash);
console.log('   - ¿Son iguales?', contractHash === truncatedHash);

// 4. Simulación de búsqueda en mapping del contrato
console.log('\n4️⃣ SIMULACIÓN BÚSQUEDA EN CONTRATO:');
console.log('   mapping(bytes32 => UTXO) commitmentHashToUTXO');
console.log('   Búsqueda con hash completo ✅:', `commitmentHashToUTXO[${contractHash}]`);
console.log('   Búsqueda con hash truncado ❌:', `commitmentHashToUTXO[${truncatedHash}] -> NO EXISTE`);

// 5. Verificar encoding
console.log('\n5️⃣ VERIFICACIÓN ENCODING:');
console.log('   solidityPacked vs otras opciones:');

// Opciones de encoding
const option1 = ethers.keccak256(ethers.solidityPacked(['uint256', 'uint256'], [exampleCommitment.x, exampleCommitment.y]));
const option2 = ethers.keccak256(ethers.concat([
  ethers.zeroPadValue(ethers.toBeHex(exampleCommitment.x), 32),
  ethers.zeroPadValue(ethers.toBeHex(exampleCommitment.y), 32)
]));

console.log('   solidityPacked:', option1);
console.log('   concat/zeroPad:', option2);
console.log('   ¿Son iguales?', option1 === option2);

// 6. Simular cómo se almacena en UTXO
console.log('\n6️⃣ SIMULACIÓN ALMACENAMIENTO UTXO:');

// Como se almacena en DepositAsPrivateUTXO.ts (línea 307)
const storedCommitmentHash = ethers.keccak256(ethers.solidityPacked(['uint256', 'uint256'], [exampleCommitment.x, exampleCommitment.y]));
console.log('   Stored commitmentHash (completo):', storedCommitmentHash);

// Como se muestra en logs (línea 317)
const logCommitmentHash = ethers.keccak256(ethers.solidityPacked(['uint256', 'uint256'], [exampleCommitment.x, exampleCommitment.y])).slice(0, 10) + '...';
console.log('   Log commitmentHash (truncado):', logCommitmentHash);

// 7. Conclusión
console.log('\n7️⃣ CONCLUSIÓN:');
console.log('✅ El hash se almacena CORRECTAMENTE (completo) en el UTXO');
console.log('✅ Solo se trunca en los LOGS para legibilidad');
console.log('❌ El problema debe estar en otro lugar...');

// 8. Investigar otros problemas potenciales
console.log('\n8️⃣ OTRAS POSIBLES CAUSAS:');
console.log('   A) ¿El UTXO no se guardó correctamente en el contrato?');
console.log('   B) ¿La búsqueda en el contrato falla por otro motivo?');
console.log('   C) ¿El commitment se almacena como hash en lugar de coordenadas?');
console.log('   D) ¿El nullifier ya se usó en una operación anterior?');

console.log('\n' + '='.repeat(70));
