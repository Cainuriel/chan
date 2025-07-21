/**
 * Debug Hash Mismatch - Script para debuggear diferencias de hash entre frontend y contrato
 * 
 * Compara los hashes que está generando la aplicación vs lo que espera el contrato
 */

import { ethers } from 'ethers';

// Datos exactos del error reportado
const ERROR_INFO = {
  expectedHash: '0x32ddc1f81050540bcda4ac6795778c053d734400b70782d220b4364493d64c9c',
  receivedHash: '0xe7f56f712020a80c570921874219aca9f61bb2c251503bfc49eb8a8230c61f53',
  contractAddress: '0xfFc0B9175A53F98bE81e59bF0C3bf93DAe2d3260' // Alastria desde .env
};

// 🚨 DATOS REALES CAPTURADOS DE LA APLICACIÓN (NUEVOS)
const REAL_DATA = {
  tokenAddress: '0xB058DadED40d0a020a492cE5Ed3eB368A78e6497',
  commitmentX: '40164952100054088644172368984195258984582003648151981270050510730406419927508',
  commitmentY: '113001430366289626739174943439038331009376033485666511518297397630463826450746',
  nullifierHash: '0xbc8b2b6d374ff6ce1780dfcceaa347e9029ad6646756f2da01aed99243203c4c',
  amount: '1000000000',
  sender: '0x86DF4B738D592c31F4A9A657D6c8d6D05DC1D462'
};

// Hash que calculó el frontend según los datos capturados (NUEVO)
const FRONTEND_CALCULATED_HASH = '0xa191a069f75c1235d00b696fa649cecfd84b66a1bd5b6b94b608796f22da9b2b';

console.log('🔍 === DEBUG HASH MISMATCH ===\n');
console.log('📋 Error Info:');
console.log('  Expected:', ERROR_INFO.expectedHash);
console.log('  Received:', ERROR_INFO.receivedHash);
console.log('  Contract:', ERROR_INFO.contractAddress);
console.log('\n');

/**
 * Función para calcular hash exactamente como lo hace HashCalculator.ts
 */
function calculateDepositHash(tokenAddress, commitmentX, commitmentY, nullifierHash, amount, sender) {
  // Normalizar direcciones para evitar errores de checksum
  const normalizedTokenAddress = ethers.getAddress(tokenAddress);
  const normalizedSender = ethers.getAddress(sender);
  
  return ethers.keccak256(
    ethers.solidityPacked(
      ['address', 'uint256', 'uint256', 'bytes32', 'uint256', 'address'],
      [normalizedTokenAddress, commitmentX.toString(), commitmentY.toString(), nullifierHash, amount.toString(), normalizedSender]
    )
  );
}

/**
 * Conectar al contrato y probar diferentes combinaciones de datos
 */
async function debugHashMismatch() {
  try {
    // Setup provider - Red de Alastria con dirección correcta del .env
    const provider = new ethers.JsonRpcProvider('https://red-t.alastria.io/v0/9461d9f4292b41230527d57ee90652a6');
    
    // Contract ABI corregido con la estructura exacta de BackendAttestation
    const contractABI = [
      "function calculateDepositDataHash((address tokenAddress, (uint256 x, uint256 y) commitment, bytes32 nullifierHash, uint256 amount, (string operation, bytes32 dataHash, uint256 nonce, uint256 timestamp, bytes signature) attestation), address sender) external pure returns (bytes32)",
      "function validateDepositParams((address tokenAddress, (uint256 x, uint256 y) commitment, bytes32 nullifierHash, uint256 amount, (string operation, bytes32 dataHash, uint256 nonce, uint256 timestamp, bytes signature) attestation), address sender) external view returns (bool success, string memory errorMessage)",
      "function getCurrentNonce() external view returns (uint256)"
    ];
    
    const contract = new ethers.Contract(ERROR_INFO.contractAddress, contractABI, provider);
    
    console.log('🔗 Connected to Alastria network with correct contract address:', ERROR_INFO.contractAddress);
    console.log('📍 Contract: https://explorer.alastria.io/address/' + ERROR_INFO.contractAddress + '\n');
    
    // Obtener nonce actual del contrato
    let currentNonce;
    try {
      currentNonce = await contract.getCurrentNonce();
      console.log('📊 Current contract nonce:', currentNonce.toString());
    } catch (error) {
      console.log('⚠️ Could not get current nonce:', error.message);
      console.log('🔍 Esto puede ser normal si el contrato no tiene esta función o está recién desplegado');
      currentNonce = 0n;
    }
    
    // 🚨 PRIMERO: Probar con datos reales si están disponibles
    if (REAL_DATA.tokenAddress !== 'REPLACE_WITH_REAL_DATA') {
      console.log('🚨 === TESTING WITH REAL DATA FROM APPLICATION ===\n');
      
      console.log('Real data captured:');
      console.log('  Token:', REAL_DATA.tokenAddress);
      console.log('  CommitmentX:', REAL_DATA.commitmentX);
      console.log('  CommitmentY:', REAL_DATA.commitmentY);
      console.log('  Nullifier:', REAL_DATA.nullifierHash);
      console.log('  Amount:', REAL_DATA.amount);
      console.log('  Sender:', REAL_DATA.sender);
      console.log('  Frontend calculó:', FRONTEND_CALCULATED_HASH);
      console.log('');
      
      // Calcular hash con datos reales
      const realFrontendHash = calculateDepositHash(
        REAL_DATA.tokenAddress,
        REAL_DATA.commitmentX,
        REAL_DATA.commitmentY,
        REAL_DATA.nullifierHash,
        REAL_DATA.amount,
        REAL_DATA.sender
      );
      
      console.log('📱 Real frontend hash (recalculado):', realFrontendHash);
      console.log('📱 Real frontend hash (original):', FRONTEND_CALCULATED_HASH);
      console.log('🔍 ¿Coinciden recalculado vs original?:', realFrontendHash.toLowerCase() === FRONTEND_CALCULATED_HASH.toLowerCase() ? '✅ SÍ' : '❌ NO');
      
      // 🚨 NUEVA FUNCIÓN: Construir DepositParams completos con BackendAttestation
      function createDepositParams(data, nonce, dataHash) {
        return {
          tokenAddress: data.tokenAddress,
          commitment: {
            x: data.commitmentX,
            y: data.commitmentY
          },
          nullifierHash: data.nullifierHash,
          amount: data.amount,
          attestation: {
            operation: "DEPOSIT",
            dataHash: dataHash,
            nonce: nonce,
            timestamp: Math.floor(Date.now() / 1000),
            signature: "0x" + "00".repeat(65) // Firma dummy para testing
          }
        };
      }
      
      // Probar contra contrato con datos reales
      const realContractParams = createDepositParams(REAL_DATA, currentNonce + 1n, realFrontendHash);
      
      try {
        console.log('\n🏛️ === PROBANDO calculateDepositDataHash ===');
        const realContractHash = await contract.calculateDepositDataHash(realContractParams, REAL_DATA.sender);
        console.log('🏛️ Real contract hash:', realContractHash);
        console.log('📱 Real frontend hash:', realFrontendHash);
        
        const match = realFrontendHash.toLowerCase() === realContractHash.toLowerCase();
        console.log('🎯 Real data match:', match ? '✅ YES' : '❌ NO');
        
        if (realContractHash === ERROR_INFO.expectedHash) {
          console.log('🎉 ✅ REAL CONTRACT HASH MATCHES EXPECTED HASH!');
        }
        if (realContractHash === ERROR_INFO.receivedHash) {
          console.log('🎉 ✅ REAL CONTRACT HASH MATCHES RECEIVED HASH!');
        }
        
      } catch (error) {
        console.log('❌ Real contract calculateDepositDataHash failed:', error.message);
      }
      
      try {
        console.log('\n🔍 === PROBANDO validateDepositParams ===');
        const [isValid, errorMessage] = await contract.validateDepositParams(realContractParams, REAL_DATA.sender);
        
        console.log('Validation result:');
        console.log('  ✅ Valid:', isValid);
        console.log('  📝 Message:', errorMessage);
        
        if (!isValid) {
          console.log('🚨 ¡VALIDACIÓN FALLÓ! Mensaje:', errorMessage);
        } else {
          console.log('🎉 ¡VALIDACIÓN EXITOSA!');
        }
        
      } catch (error) {
        console.log('❌ validateDepositParams failed:', error.message);
        console.log('🔍 Esto puede indicar problemas con la firma o los parámetros');
      }
      
      // También probar con el hash que calculó originalmente el frontend
      if (realFrontendHash.toLowerCase() !== FRONTEND_CALCULATED_HASH.toLowerCase()) {
        console.log('\n🧪 === PROBANDO CON HASH ORIGINAL DEL FRONTEND ===');
        const originalContractParams = createDepositParams(REAL_DATA, currentNonce + 1n, FRONTEND_CALCULATED_HASH);
        
        try {
          const [isValidOriginal, errorMessageOriginal] = await contract.validateDepositParams(originalContractParams, REAL_DATA.sender);
          console.log('Validation with original frontend hash:');
          console.log('  ✅ Valid:', isValidOriginal);
          console.log('  📝 Message:', errorMessageOriginal);
        } catch (error) {
          console.log('❌ validateDepositParams with original hash failed:', error.message);
        }
      }
      
      console.log('\n' + '='.repeat(60) + '\n');
    }
    
    // Continuar con tests genéricos...
    
    // Vamos a probar con datos típicos y ver qué pasa
    const testCases = [
      {
        name: 'Test Case 1: Datos típicos',
        data: {
          tokenAddress: '0x1234567890123456789012345678901234567890',
          commitmentX: '12345678901234567890123456789012345678901234567890123456789012345678',
          commitmentY: '98765432109876543210987654321098765432109876543210987654321098765432',
          nullifierHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          amount: '1000000000000000000',
          sender: '0x9876543210987654321098765432109876543210'
        }
      },
      {
        name: 'Test Case 2: Datos con checksums correctos',
        data: {
          tokenAddress: ethers.getAddress('0xa0b86a33e6441398e2e2e95be90fe0b80c2d4f7c'), // Auto-genera checksum válido
          commitmentX: '12345678901234567890123456789012345678901234567890123456789012345678',
          commitmentY: '98765432109876543210987654321098765432109876543210987654321098765432',
          nullifierHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          amount: '1000000000000000000',
          sender: ethers.getAddress('0x86df4b738d592c31f4a9a657d6c8d6d05dc1d462') // Auto-genera checksum válido
        }
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`🧪 ${testCase.name}:`);
      
      // 1. Calcular hash con nuestro método
      const frontendHash = calculateDepositHash(
        testCase.data.tokenAddress,
        testCase.data.commitmentX,
        testCase.data.commitmentY,
        testCase.data.nullifierHash,
        testCase.data.amount,
        testCase.data.sender
      );
      
      console.log('  📱 Frontend hash:', frontendHash);
      
      // 2. Calcular hash con el contrato
      const contractParams = {
        tokenAddress: testCase.data.tokenAddress,
        commitment: {
          x: testCase.data.commitmentX,
          y: testCase.data.commitmentY
        },
        nullifierHash: testCase.data.nullifierHash,
        amount: testCase.data.amount,
        attestation: {
          operation: "DEPOSIT",
          dataHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
          nonce: 1,
          timestamp: Math.floor(Date.now() / 1000),
          signature: "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
        }
      };
      
      try {
        const contractHash = await contract.calculateDepositDataHash(contractParams, testCase.data.sender);
        console.log('  🏛️ Contract hash:', contractHash);
        
        const match = frontendHash.toLowerCase() === contractHash.toLowerCase();
        console.log('  🎯 Match:', match ? '✅ YES' : '❌ NO');
        
        // Verificar si alguno coincide con los hashes del error
        if (frontendHash === ERROR_INFO.expectedHash) {
          console.log('  🎉 Frontend hash matches EXPECTED hash from error!');
        }
        if (frontendHash === ERROR_INFO.receivedHash) {
          console.log('  🎉 Frontend hash matches RECEIVED hash from error!');
        }
        if (contractHash === ERROR_INFO.expectedHash) {
          console.log('  🎉 Contract hash matches EXPECTED hash from error!');
        }
        if (contractHash === ERROR_INFO.receivedHash) {
          console.log('  🎉 Contract hash matches RECEIVED hash from error!');
        }
        
      } catch (error) {
        console.log('  ❌ Contract error:', error.message);
      }
      
      console.log('');
    }
    
    // Análisis de los hashes del error
    console.log('🔍 === ANÁLISIS DE HASHES DEL ERROR ===\n');
    console.log('Vamos a intentar reverse-engineer los datos que produjeron estos hashes...\n');
    
    // Probar con diferentes tipos de datos para ver si alguno genera el hash esperado
    console.log('🔬 Probando diferentes formatos de datos...\n');
    
    // Intentar diferentes variaciones de datos
    const variations = [
      {
        name: 'BigInt values',
        commitmentX: BigInt('12345678901234567890123456789012345678901234567890123456789012345678'),
        commitmentY: BigInt('98765432109876543210987654321098765432109876543210987654321098765432'),
        amount: BigInt('1000000000000000000')
      },
      {
        name: 'Hex string values',
        commitmentX: '0x1b69b4bacd05f15d865ccfbf31bc7ef8',
        commitmentY: '0x15b3c7d4c5e6f7a8b9c0d1e2f3a4b5c6',
        amount: '0xde0b6b3a7640000'
      },
      {
        name: 'Small test values',
        commitmentX: '1',
        commitmentY: '2',
        amount: '1000000000000000000'
      }
    ];
    
    for (const variation of variations) {
      console.log(`🧬 Testing ${variation.name}:`);
      
      const hash = calculateDepositHash(
        '0x1234567890123456789012345678901234567890',
        variation.commitmentX,
        variation.commitmentY,
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        variation.amount,
        '0x9876543210987654321098765432109876543210'
      );
      
      console.log('  Hash:', hash);
      
      if (hash === ERROR_INFO.expectedHash) {
        console.log('  🎉 FOUND IT! This variation matches the expected hash!');
      }
      if (hash === ERROR_INFO.receivedHash) {
        console.log('  🎉 FOUND IT! This variation matches the received hash!');
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Función adicional para interceptar datos reales de la aplicación
console.log('💡 === INSTRUCCIONES PARA DEBUGGING ===\n');
console.log('1. Ejecuta este script: node debug-hash-mismatch.js');
console.log('2. En la aplicación, abre DevTools Console');
console.log('3. Antes de hacer un depósito, ejecuta:');
console.log('');
console.log('// Interceptar datos reales');
console.log('window.interceptDepositData = true;');
console.log('');
console.log('4. Intenta hacer el depósito que falla');
console.log('5. Copia los datos que se muestren en la consola');
console.log('6. Usa esos datos exactos en este script\n');

// Ejecutar debug
debugHashMismatch().catch(console.error);
