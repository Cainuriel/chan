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

// 🚨 DATOS REALES CAPTURADOS DE LA APLICACIÓN (NUEVOS - PROBLEMA ENCONTRADO)
const REAL_DATA = {
  tokenAddress: '0xB058DadED40d0a020a492cE5Ed3eB368A78e6497',
  commitmentX: '33328068764261947090086695116018393458387350780185549786357764171789283296385',
  commitmentY: '35420491854987331529841883611583123367969004174431800530033953279768513729904',
  nullifierHash: '0xffecb93b249e02134289671d3ada4e84a54d5bf44b0c9c6aca302e9fafba4328',
  amount: '5000000000',
  sender: '0x86DF4B738D592c31F4A9A657D6c8d6D05DC1D462'
};

// 🚨 DATOS QUE REALMENTE SE ENVÍAN AL CONTRATO (DIFERENTES!)
const CONTRACT_DATA = {
  tokenAddress: '0xB058DadED40d0a020a492cE5Ed3eB368A78e6497',
  commitmentX: '66587332571241682828367850492306361513640920310834748932601118011419370482057',
  commitmentY: '109805568440526974947966924342243001438265122196475814917601383060199132281380',
  nullifierHash: '0x6ec354dde84f20999726e070bf4ee5f6d9cd27fd2b13ba78da9d975c86f531e0',
  amount: '5000000000',
  sender: '0x86DF4B738D592c31F4A9A657D6c8d6D05DC1D462'
};

// Attestation data capturada
const ATTESTATION_DATA = {
  operation: 'DEPOSIT',
  dataHash: '0x4581f410a11f189bceb4e437dcc845a702ceb685244e2e92a4008d96a6d0c198',
  nonce: '1753090321',
  timestamp: '1753090321364',
  signature: '0xc1b514905f6c086b13fa5fe9e41e1119bf57418cd56b07491c19c9b5bdd56009671063b8e69fd65836672f7e75c6b6083dbdfe8495fbcd67ceff3330ea0896c51b'
};

// Hash que calculó el frontend vs lo que espera el contrato
const FRONTEND_CALCULATED_HASH = '0x4581f410a11f189bceb4e437dcc845a702ceb685244e2e92a4008d96a6d0c198';
const CONTRACT_EXPECTED_HASH = '0xd93bf5e3c528943389efeb9c0c081fb42f8ab7445a5ccffcdafbfe4379a4aca1';

console.log('🔍 === DEBUG HASH MISMATCH ===\n');
console.log('📋 Error Info:');
console.log('  Expected:', ERROR_INFO.expectedHash);
console.log('  Received:', ERROR_INFO.receivedHash);
console.log('  Contract:', ERROR_INFO.contractAddress);
console.log('\n');

console.log('🎯 === PROBLEMA IDENTIFICADO ===');
console.log('✅ Hash calculation method: CORRECTO');
console.log('❌ Data inconsistency: Los datos que van al HashCalculator son DIFERENTES a los que van al contrato');
console.log('🔍 Esto explica por qué los hashes no coinciden');
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
    
    // 🚨 ANÁLISIS DE INCONSISTENCIA DE DATOS
    if (REAL_DATA.tokenAddress !== 'REPLACE_WITH_REAL_DATA') {
      console.log('🚨 === ANÁLISIS DE INCONSISTENCIA DE DATOS ===\n');
      
      console.log('📊 Datos que recibe HashCalculator:');
      console.log('  Token:', REAL_DATA.tokenAddress);
      console.log('  CommitmentX:', REAL_DATA.commitmentX);
      console.log('  CommitmentY:', REAL_DATA.commitmentY);
      console.log('  Nullifier:', REAL_DATA.nullifierHash);
      console.log('  Amount:', REAL_DATA.amount);
      console.log('  Sender:', REAL_DATA.sender);
      console.log('');
      
      console.log('📊 Datos que se envían al contrato:');
      console.log('  Token:', CONTRACT_DATA.tokenAddress);
      console.log('  CommitmentX:', CONTRACT_DATA.commitmentX);
      console.log('  CommitmentY:', CONTRACT_DATA.commitmentY);
      console.log('  Nullifier:', CONTRACT_DATA.nullifierHash);
      console.log('  Amount:', CONTRACT_DATA.amount);
      console.log('  Sender:', CONTRACT_DATA.sender);
      console.log('');
      
      // Calcular hash con datos del HashCalculator
      const realHashCalcHash = calculateDepositHash(
        REAL_DATA.tokenAddress,
        REAL_DATA.commitmentX,
        REAL_DATA.commitmentY,
        REAL_DATA.nullifierHash,
        REAL_DATA.amount,
        REAL_DATA.sender
      );
      
      // Calcular hash con datos del contrato
      const contractDataHash = calculateDepositHash(
        CONTRACT_DATA.tokenAddress,
        CONTRACT_DATA.commitmentX,
        CONTRACT_DATA.commitmentY,
        CONTRACT_DATA.nullifierHash,
        CONTRACT_DATA.amount,
        CONTRACT_DATA.sender
      );
      
      console.log('🔍 Resultados del análisis:');
      console.log('📱 Hash con datos de HashCalculator:', realHashCalcHash);
      console.log('�️ Hash con datos de contrato:', contractDataHash);
      console.log('📝 Frontend calculó:', FRONTEND_CALCULATED_HASH);
      console.log('� Contrato esperaba:', CONTRACT_EXPECTED_HASH);
      console.log('');
      
      console.log('✅ Verificaciones:');
      console.log('HashCalculator vs Frontend:', realHashCalcHash.toLowerCase() === FRONTEND_CALCULATED_HASH.toLowerCase() ? '✅ MATCH' : '❌ NO MATCH');
      console.log('Contract Data vs Contract Expected:', contractDataHash.toLowerCase() === CONTRACT_EXPECTED_HASH.toLowerCase() ? '✅ MATCH' : '❌ NO MATCH');
      console.log('');
      
      // Identificar las diferencias específicas
      console.log('� Diferencias encontradas:');
      if (REAL_DATA.commitmentX !== CONTRACT_DATA.commitmentX) {
        console.log('❌ CommitmentX es diferente!');
        console.log('  HashCalculator:', REAL_DATA.commitmentX);
        console.log('  Contract:', CONTRACT_DATA.commitmentX);
      }
      if (REAL_DATA.commitmentY !== CONTRACT_DATA.commitmentY) {
        console.log('❌ CommitmentY es diferente!');
        console.log('  HashCalculator:', REAL_DATA.commitmentY);
        console.log('  Contract:', CONTRACT_DATA.commitmentY);
      }
      if (REAL_DATA.nullifierHash !== CONTRACT_DATA.nullifierHash) {
        console.log('❌ NullifierHash es diferente!');
        console.log('  HashCalculator:', REAL_DATA.nullifierHash);
        console.log('  Contract:', CONTRACT_DATA.nullifierHash);
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
