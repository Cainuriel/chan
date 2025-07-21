import { ethers } from 'ethers';
import type { Contract } from 'ethers';

/**
 * @title HashCalculator - Función centralizada para cálculo de hashes UTXO
 * @notice Implementa el patrón VERIFICADO que coincide exactamente con el contrato
 * @dev Usa ethers.keccak256(ethers.solidityPacked(...)) - método probado como correcto
 */

export interface DepositHashParams {
  tokenAddress: string;
  commitmentX: string | bigint;
  commitmentY: string | bigint;
  nullifierHash: string;
  amount: string | bigint;
  sender: string;
}

export interface HashValidationResult {
  hash: string;
  success: boolean;
  error?: string;
}

/**
 * @dev FUNCIÓN PRINCIPAL VERIFICADA para calcular el hash de depósito
 * @notice Usa el patrón EXACTO que confirmamos funciona: ethers.keccak256(ethers.solidityPacked(...))
 * @dev Orden de parámetros VERIFICADO: [address, uint256, uint256, bytes32, uint256, address]
 * @param params Parámetros del depósito
 * @returns Hash calculado que coincide con el contrato
 */
export function calculateDepositDataHash(params: DepositHashParams): HashValidationResult {
  
  console.log('🔍 === HASH CALCULATOR (PATRÓN VERIFICADO) ===');
  console.log('📊 Input params:', {
    tokenAddress: params.tokenAddress,
    commitmentX: params.commitmentX.toString(),
    commitmentY: params.commitmentY.toString(),
    nullifierHash: params.nullifierHash,
    amount: params.amount.toString(),
    sender: params.sender
  });

  // 🚨 INTERCEPTAR DATOS PARA DEBUGGING - SIEMPRE ACTIVO
  console.log('🚨 === INTERCEPTING DEPOSIT DATA FOR DEBUGGING ===');
  console.log('Copy these EXACT values to debug-hash-mismatch.js:');
  console.log('const REAL_DATA = {');
  console.log(`  tokenAddress: '${params.tokenAddress}',`);
  console.log(`  commitmentX: '${params.commitmentX.toString()}',`);
  console.log(`  commitmentY: '${params.commitmentY.toString()}',`);
  console.log(`  nullifierHash: '${params.nullifierHash}',`);
  console.log(`  amount: '${params.amount.toString()}',`);
  console.log(`  sender: '${params.sender}'`);
  console.log('};');
  console.log('🚨 ================================================');

  try {
    // PATRÓN VERIFICADO: ethers.keccak256(ethers.solidityPacked(...))
    // Orden EXACTO del contrato: tokenAddress, commitment.x, commitment.y, nullifierHash, amount, sender
    const hash = ethers.keccak256(
      ethers.solidityPacked(
        ['address', 'uint256', 'uint256', 'bytes32', 'uint256', 'address'],
        [
          params.tokenAddress,
          params.commitmentX.toString(),
          params.commitmentY.toString(),
          params.nullifierHash,
          params.amount.toString(),
          params.sender
        ]
      )
    );
    
    console.log('✅ Hash calculado exitosamente:', hash);
    console.log('🎯 Método verificado: ethers.keccak256(ethers.solidityPacked(...))');
    
    return {
      hash,
      success: true
    };
    
  } catch (error) {
    const errorMessage = `Error calculando hash: ${error instanceof Error ? error.message : String(error)}`;
    console.error('❌', errorMessage);
    
    return {
      hash: '',
      success: false,
      error: errorMessage
    };
  }
}

/**
 * @dev Función de validación opcional contra contrato (solo para debugging)
 * @notice NO debe usarse en producción - solo para verificar implementación
 */
export async function validateHashAgainstContract(
  params: DepositHashParams,
  contract: Contract
): Promise<{ isValid: boolean; frontendHash: string; contractHash: string; error?: string }> {
  
  console.log('🔍 === VALIDACIÓN CONTRA CONTRATO (DEBUG) ===');
  
  try {
    // 1. Calcular con nuestro método verificado
    const result = calculateDepositDataHash(params);
    
    if (!result.success) {
      return {
        isValid: false,
        frontendHash: '',
        contractHash: '',
        error: result.error
      };
    }

    // 2. Construir params para el contrato (estructura exacta que espera)
    const contractParams = {
      tokenAddress: params.tokenAddress,
      commitment: {
        x: params.commitmentX.toString(),
        y: params.commitmentY.toString()
      },
      nullifierHash: params.nullifierHash,
      amount: params.amount.toString(),
      attestation: {
        operation: "DEPOSIT",
        dataHash: "0x0000000000000000000000000000000000000000000000000000000000000000", // dummy
        nonce: 1,
        timestamp: Math.floor(Date.now() / 1000),
        signature: "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" // dummy
      }
    };

    // 3. Llamar al contrato para calcular su hash
    const contractHash = await contract.calculateDepositDataHash(contractParams, params.sender);
    console.log('🏛️ Contract hash:', contractHash);
    console.log('📱 Frontend hash:', result.hash);

    // 4. Comparar
    const isValid = result.hash.toLowerCase() === contractHash.toLowerCase();
    
    if (isValid) {
      console.log('✅ ¡HASHES COINCIDEN! Implementación correcta.');
    } else {
      console.log('❌ Hashes no coinciden - revisar implementación');
    }

    return {
      isValid,
      frontendHash: result.hash,
      contractHash,
    };

  } catch (error) {
    const errorMessage = `Error validando contra contrato: ${error instanceof Error ? error.message : String(error)}`;
    console.error('❌', errorMessage);
    
    return {
      isValid: false,
      frontendHash: '',
      contractHash: '',
      error: errorMessage
    };
  }

}

/**
 * @dev Función de conveniencia para usar en AttestationService
 * @notice Usa el patrón VERIFICADO para calcular hashes de depósito
 */
export function calculateAndValidateDepositHash(
  tokenAddress: string,
  commitmentX: bigint,
  commitmentY: bigint,
  nullifier: string,
  amount: bigint,
  userAddress: string
): string {
  
  const result = calculateDepositDataHash({
    tokenAddress,
    commitmentX,
    commitmentY,
    nullifierHash: nullifier,
    amount,
    sender: userAddress
  });

  if (!result.success || !result.hash) {
    throw new Error(result.error || 'Hash calculation failed');
  }

  return result.hash;
}

/**
 * @dev Función de conveniencia para usar en CryptoHelpers
 * @notice Usa el patrón VERIFICADO para calcular hashes de depósito
 */
export function calculateCryptoHelperHash(
  tokenAddress: string,
  commitment: { x: bigint; y: bigint },
  nullifierHash: string,
  value: bigint,
  recipient: string
): string {
  
  const result = calculateDepositDataHash({
    tokenAddress,
    commitmentX: commitment.x,
    commitmentY: commitment.y,
    nullifierHash,
    amount: value,
    sender: recipient
  });

  if (!result.success || !result.hash) {
    throw new Error(result.error || 'Hash calculation failed');
  }

  return result.hash;
}

/**
 * @dev Función para crear parámetros de depósito completos
 * @notice Incluye el hash calculado con el patrón verificado
 */
export function createDepositParams(
  tokenAddress: string,
  commitment: { x: bigint; y: bigint },
  nullifierHash: string,
  amount: bigint,
  sender: string,
  nonce: bigint,
  signature: string
) {
  // Calcular hash con el patrón verificado
  const result = calculateDepositDataHash({
    tokenAddress,
    commitmentX: commitment.x,
    commitmentY: commitment.y,
    nullifierHash,
    amount,
    sender
  });

  if (!result.success) {
    throw new Error(result.error || 'Failed to calculate deposit hash');
  }

  // Retornar estructura completa para el contrato
  return {
    tokenAddress,
    commitment: {
      x: commitment.x.toString(),
      y: commitment.y.toString()
    },
    nullifierHash,
    amount: amount.toString(),
    attestation: {
      operation: "DEPOSIT",
      dataHash: result.hash,
      nonce: nonce.toString(),
      timestamp: Math.floor(Date.now() / 1000),
      signature
    }
  };
}

/**
 * @dev Nueva función para capturar datos de attestation para debugging
 * @notice Usa esto para debuggear problemas con attestation
 */
export function logAttestationData(attestation: any, operation: string = 'UNKNOWN') {
  console.log('🔍 === ATTESTATION DATA DEBUGGING ===');
  console.log(`📋 Operation: "${attestation?.operation || operation}"`);
  console.log(`🏷️  DataHash: ${attestation?.dataHash || 'NOT_SET'}`);
  console.log(`🔢 Nonce: ${attestation?.nonce || 'NOT_SET'}`);
  console.log(`⏰ Timestamp: ${attestation?.timestamp || 'NOT_SET'}`);
  console.log(`✍️  Signature: ${attestation?.signature ? attestation.signature.slice(0, 20) + '...' : 'NOT_SET'}`);
  console.log('🔍 =======================================');
  
  // Validaciones críticas
  if (attestation?.operation !== 'DEPOSIT') {
    console.warn('⚠️  WARNING: Operation is not "DEPOSIT":', attestation?.operation);
  }
  
  if (!attestation?.dataHash) {
    console.error('❌ CRITICAL: dataHash is missing!');
  }
  
  if (!attestation?.signature) {
    console.error('❌ CRITICAL: signature is missing!');
  }
  
  // 🚨 DATOS PARA DEBUG SCRIPT
  console.log('🚨 === COPY TO DEBUG SCRIPT ===');
  console.log('const ATTESTATION_DATA = {');
  console.log(`  operation: '${attestation?.operation || operation}',`);
  console.log(`  dataHash: '${attestation?.dataHash || 'NOT_SET'}',`);
  console.log(`  nonce: '${attestation?.nonce || 'NOT_SET'}',`);
  console.log(`  timestamp: '${attestation?.timestamp || 'NOT_SET'}',`);
  console.log(`  signature: '${attestation?.signature || 'NOT_SET'}'`);
  console.log('};');
  console.log('🚨 =============================');
  
  return attestation;
}
