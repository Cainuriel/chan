import { ethers } from 'ethers';
import type { Contract } from 'ethers';

/**
 * @title HashCalculator - Función centralizada para cálculo de hashes UTXO con soporte ZK
 * @notice Implementa el patrón VERIFICADO que coincide exactamente con el contrato
 * @dev Usa ethers.keccak256(ethers.solidityPacked(...)) - método probado como correcto
 * @version 2.0 - Con soporte para operaciones ZK
 */

export interface DepositHashParams {
  tokenAddress: string;
  commitmentX: string | bigint;
  commitmentY: string | bigint;
  nullifierHash: string;
  amount: string | bigint;
  sender: string;
}

export interface ZKSplitHashParams {
  sourceNullifier: string;
  outputCommitments: Array<{ x: bigint; y: bigint }>;
  tokenAddress: string;
  operation: 'SPLIT';
}

export interface ZKWithdrawHashParams {
  nullifier: string;
  revealedAmount: bigint;
  tokenAddress: string;
  recipient: string;
  operation: 'WITHDRAW';
}

export interface ZKTransferHashParams {
  sourceNullifier: string;
  targetCommitment: { x: bigint; y: bigint };
  tokenAddress: string;
  recipient: string;
  operation: 'TRANSFER';
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
 * @param params Parámetros del depósito
 * @param contract Instancia del contrato
 * @param attestationData Datos reales de attestation (NO dummy data)
 */
export async function validateHashAgainstContract(
  params: DepositHashParams,
  contract: Contract,
  attestationData: {
    operation: string;
    nonce: bigint;
    timestamp: bigint; // ✅ REAL timestamp from attestation
    signature: string;
  }
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

    // 2. Construir params para el contrato usando DATOS REALES (NO dummy)
    const contractParams = {
      tokenAddress: params.tokenAddress,
      commitment: {
        x: params.commitmentX.toString(),
        y: params.commitmentY.toString()
      },
      nullifierHash: params.nullifierHash,
      amount: params.amount.toString(),
      attestation: {
        operation: attestationData.operation, // REAL operation
        dataHash: result.hash, // REAL hash calculado
        nonce: attestationData.nonce.toString(), // REAL nonce
        timestamp: attestationData.timestamp, // ✅ REAL timestamp from attestation
        signature: attestationData.signature // REAL signature
      }
    };

    console.log('📋 Using REAL attestation data:');
    console.log('   - Operation:', attestationData.operation);
    console.log('   - DataHash:', result.hash);
    console.log('   - Nonce:', attestationData.nonce.toString());
    console.log('   - Timestamp:', attestationData.timestamp.toString()); // ✅ REAL timestamp
    console.log('   - Signature:', attestationData.signature.slice(0, 20) + '...');

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
 * @param timestamp ✅ REAL timestamp from attestation service (NO auto-generated)
 */
export function createDepositParams(
  tokenAddress: string,
  commitment: { x: bigint; y: bigint },
  nullifierHash: string,
  amount: bigint,
  sender: string,
  nonce: bigint,
  timestamp: bigint, // ✅ REAL timestamp parameter
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
      timestamp: timestamp, // ✅ REAL timestamp from parameter
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

/**
 * @dev NUEVA FUNCIÓN ZK - Calcular hash para operaciones de split ZK
 * @notice Split operations con privacidad ZK - amounts ocultos
 * @param params Parámetros del split ZK
 * @returns Hash calculado para split ZK
 */
export function calculateZKSplitHash(params: ZKSplitHashParams): HashValidationResult {
  console.log('🔍 === ZK SPLIT HASH CALCULATOR ===');
  console.log('📊 Input params:', {
    sourceNullifier: params.sourceNullifier,
    outputCommitments: params.outputCommitments.length,
    tokenAddress: params.tokenAddress,
    operation: params.operation
  });

  try {
    // ZK Split: hash = keccak256(sourceNullifier, outputCommitments[], tokenAddress, operation)
    const commitmentData = params.outputCommitments.flatMap(c => [c.x.toString(), c.y.toString()]);
    const types = ['bytes32', ...Array(commitmentData.length).fill('uint256'), 'address', 'string'];
    const values = [params.sourceNullifier, ...commitmentData, params.tokenAddress, params.operation];

    const hash = ethers.keccak256(
      ethers.solidityPacked(types, values)
    );
    
    console.log('✅ ZK Split hash calculado:', hash);
    
    return {
      hash,
      success: true
    };
    
  } catch (error) {
    const errorMessage = `Error calculando ZK split hash: ${error instanceof Error ? error.message : String(error)}`;
    console.error('❌', errorMessage);
    
    return {
      hash: '',
      success: false,
      error: errorMessage
    };
  }
}

/**
 * @dev NUEVA FUNCIÓN ZK - Calcular hash para operaciones de withdraw ZK
 * @notice Withdraw operations con privacidad ZK
 * @param params Parámetros del withdraw ZK
 * @returns Hash calculado para withdraw ZK
 */
export function calculateZKWithdrawHash(params: ZKWithdrawHashParams): HashValidationResult {
  console.log('🔍 === ZK WITHDRAW HASH CALCULATOR ===');
  console.log('📊 Input params:', {
    nullifier: params.nullifier,
    revealedAmount: params.revealedAmount.toString(),
    tokenAddress: params.tokenAddress,
    recipient: params.recipient,
    operation: params.operation
  });

  try {
    // ZK Withdraw: hash = keccak256(nullifier, revealedAmount, tokenAddress, recipient, operation)
    const hash = ethers.keccak256(
      ethers.solidityPacked(
        ['bytes32', 'uint256', 'address', 'address', 'string'],
        [
          params.nullifier,
          params.revealedAmount.toString(),
          params.tokenAddress,
          params.recipient,
          params.operation
        ]
      )
    );
    
    console.log('✅ ZK Withdraw hash calculado:', hash);
    
    return {
      hash,
      success: true
    };
    
  } catch (error) {
    const errorMessage = `Error calculando ZK withdraw hash: ${error instanceof Error ? error.message : String(error)}`;
    console.error('❌', errorMessage);
    
    return {
      hash: '',
      success: false,
      error: errorMessage
    };
  }
}

/**
 * @dev NUEVA FUNCIÓN ZK - Calcular hash para operaciones de transfer ZK
 * @notice Transfer operations con privacidad ZK - amounts ocultos
 * @param params Parámetros del transfer ZK
 * @returns Hash calculado para transfer ZK
 */
export function calculateZKTransferHash(params: ZKTransferHashParams): HashValidationResult {
  console.log('🔍 === ZK TRANSFER HASH CALCULATOR ===');
  console.log('📊 Input params:', {
    sourceNullifier: params.sourceNullifier,
    targetCommitment: { x: params.targetCommitment.x.toString(), y: params.targetCommitment.y.toString() },
    tokenAddress: params.tokenAddress,
    recipient: params.recipient,
    operation: params.operation
  });

  try {
    // ZK Transfer: hash = keccak256(sourceNullifier, targetCommitment.x, targetCommitment.y, tokenAddress, recipient, operation)
    const hash = ethers.keccak256(
      ethers.solidityPacked(
        ['bytes32', 'uint256', 'uint256', 'address', 'address', 'string'],
        [
          params.sourceNullifier,
          params.targetCommitment.x.toString(),
          params.targetCommitment.y.toString(),
          params.tokenAddress,
          params.recipient,
          params.operation
        ]
      )
    );
    
    console.log('✅ ZK Transfer hash calculado:', hash);
    
    return {
      hash,
      success: true
    };
    
  } catch (error) {
    const errorMessage = `Error calculando ZK transfer hash: ${error instanceof Error ? error.message : String(error)}`;
    console.error('❌', errorMessage);
    
    return {
      hash: '',
      success: false,
      error: errorMessage
    };
  }
}

/**
 * @dev FUNCIONES DE CONVENIENCIA ZK para usar en servicios
 */

/**
 * Función de conveniencia para calcular hash de split ZK
 */
export function calculateZKSplitHashConvenience(
  sourceNullifier: string,
  outputCommitments: Array<{ x: bigint; y: bigint }>,
  tokenAddress: string
): string {
  const result = calculateZKSplitHash({
    sourceNullifier,
    outputCommitments,
    tokenAddress,
    operation: 'SPLIT'
  });

  if (!result.success || !result.hash) {
    throw new Error(result.error || 'ZK Split hash calculation failed');
  }

  return result.hash;
}

/**
 * Función de conveniencia para calcular hash de withdraw ZK
 */
export function calculateZKWithdrawHashConvenience(
  nullifier: string,
  revealedAmount: bigint,
  tokenAddress: string,
  recipient: string
): string {
  const result = calculateZKWithdrawHash({
    nullifier,
    revealedAmount,
    tokenAddress,
    recipient,
    operation: 'WITHDRAW'
  });

  if (!result.success || !result.hash) {
    throw new Error(result.error || 'ZK Withdraw hash calculation failed');
  }

  return result.hash;
}

/**
 * Función de conveniencia para calcular hash de transfer ZK
 */
export function calculateZKTransferHashConvenience(
  sourceNullifier: string,
  targetCommitment: { x: bigint; y: bigint },
  tokenAddress: string,
  recipient: string
): string {
  const result = calculateZKTransferHash({
    sourceNullifier,
    targetCommitment,
    tokenAddress,
    recipient,
    operation: 'TRANSFER'
  });

  if (!result.success || !result.hash) {
    throw new Error(result.error || 'ZK Transfer hash calculation failed');
  }

  return result.hash;
}
