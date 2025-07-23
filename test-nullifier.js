import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// Configuración
const CONTRACT_ADDRESS = process.env.VITE_ADDRESS_CONTRACT_ALASTRIA;
const ALASTRIA_RPC = 'https://108.142.237.13:8545'; 

// ABI simplificada para isNullifierUsed
const CONTRACT_ABI = [
  "function isNullifierUsed(bytes32 nullifierHash) external view returns (bool)"
];

async function testNullifiers() {
  console.log('🔍 TESTING NULLIFIER STATUS');
  console.log('=====================================');
  
  // Conectar a Alastria
  const provider = new ethers.JsonRpcProvider(ALASTRIA_RPC);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  
  console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
  console.log(`🌐 Network: Alastria`);
  console.log('');

  // Nullifiers a verificar (los que mencionaste)
  const nullifiersToTest = [
    {
      name: "UTXO Original (isSpent: true)",
      nullifier: "0x31905a87e33e96cc8abe17c26c4090d0c257ebe1760f16801f6a190ba6a63985"
    },
    {
      name: "UTXO Split Output 1 (isSpent: false)", 
      nullifier: "0x39be37147e37c38396db6e0e093a536821d379716402464af0fa042d8ba9b10f"
    },
    {
      name: "UTXO Split Output 2 (el que intentas retirar)",
      nullifier: "0xda89b0b6825f39b1f073adaa875f2453b2c54c1cb56dc06139f12777f1b1dc39"
    }
  ];

  console.log('🔍 VERIFICANDO NULLIFIERS:\n');

  for (const testCase of nullifiersToTest) {
    try {
      console.log(`📋 ${testCase.name}`);
      console.log(`   Nullifier: ${testCase.nullifier}`);
      
      const isUsed = await contract.isNullifierUsed(testCase.nullifier);
      const status = isUsed ? '❌ USADO' : '✅ DISPONIBLE';
      
      console.log(`   Estado: ${status}`);
      console.log('');
      
    } catch (error) {
      console.error(`❌ Error verificando ${testCase.name}:`, error.message);
      console.log('');
    }
  }

  console.log('=====================================');
  console.log('🎯 ANÁLISIS:');
  console.log('Si todos muestran "DISPONIBLE" pero el withdraw falla');
  console.log('con NullifierAlreadyUsed, el problema está en OTRA');
  console.log('validación dentro del flujo del withdraw.');
  console.log('');
  console.log('Posibles causas:');
  console.log('1. preValidateWithdraw() tiene lógica incorrecta');
  console.log('2. Problema en _validateBasicNullifiers()');
  console.log('3. Inconsistencia en el flujo de validación');
}

// Ejecutar test
testNullifiers()
  .then(() => {
    console.log('✅ Test completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en test:', error);
    process.exit(1);
  });
