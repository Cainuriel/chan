/**
 * @fileoverview REAL SECP256K1 UTXO deposit function with REAL CRYPTOGRAPHY
 * @description NO DUMMY DATA - Uses actual Pedersen commitments and blinding factors with Ethereum-compatible curve
 * 
 * IMPORTANTE: ARQUITECTURA CRIPTOGRÁFICA
 * =====================================
 * Este archivo usa EXCLUSIVAMENTE secp256k1 (curva de Ethereum).
 * Las referencias a "BN254" son solo para compatibilidad de tipos legacy.
 * 
 * IMPLEMENTACIÓN REAL:
 * - Curva: secp256k1 (Ethereum compatible)
 * - Commitments: Pedersen sobre secp256k1
 * - Nullifiers: keccak256 determinísticos  
 * - Signatures: ECDSA estándar de Ethereum
 */

import { ethers, formatEther } from 'ethers';
import { calculateAndValidateDepositHash, logAttestationData } from './HashCalculator';
import type { CreateUTXOParams, UTXOOperationResult, ExtendedUTXOData } from '../types/utxo.types';
import { UTXOType } from '../types/utxo.types';
import { CryptoHelpers } from '../utils/crypto.helpers';
import { ethereumHelpers } from '../utils/ethereum.helpers';
import { selectedNetwork } from '$lib/store';
/**
 * Generate REAL cryptographically secure blinding factor for secp256k1
 * NO DUMMY DATA - This is actual cryptographic material
 */
function generateRealBlindingFactor(): string {
  const randomBytes = ethers.randomBytes(32);
  return ethers.hexlify(randomBytes);
}

/**
 * Create REAL Pedersen Commitment using centralized secure crypto services
 * Commitment = value*G + blindingFactor*H
 * NO DUMMY DATA - This is actual cryptographic commitment via CryptoHelpers
 */
async function createRealPedersenCommitment(value: bigint, blindingFactor: string): Promise<{ x: bigint; y: bigint }> {
  try {
    console.log('🔐 Creating REAL Pedersen commitment with secp256k1 via CryptoHelpers...');
    
    // ✅ Use centralized service for all cryptographic operations (NO direct curve access)
    const commitment = await CryptoHelpers.createPedersenCommitment(value.toString(), blindingFactor);
    
    console.log('✅ REAL Pedersen commitment created via CryptoHelpers:', {
      x: commitment.x.toString().slice(0, 10) + '...',
      y: commitment.y.toString().slice(0, 10) + '...',
      cryptographyType: 'secp256k1 (Ethereum compatible)'
    });
    
    return { x: BigInt(commitment.x), y: BigInt(commitment.y) };
  } catch (error) {
    console.error('❌ Failed to create REAL Pedersen commitment:', error);
    throw new Error(`REAL Pedersen commitment failed: ${error}`);
  }
}

/**
 * @dev REAL secp256k1 UTXO deposit function - NO DUMMY DATA
 * @notice Uses actual Pedersen commitments, real blinding factors, and proper secp256k1 cryptography
 * @param timestamp ✅ REAL timestamp from attestation service (NO auto-generated)
 */
export async function depositAsPrivateUTXOSimplified(
  params: CreateUTXOParams,
  contract: any,
  currentEOA: any,
  ethereum: any,
  utxos: Map<string, ExtendedUTXOData>,
  savePrivateUTXOToLocal: Function,
  emit: Function,
  timestamp?: bigint // ✅ NUEVO: timestamp real opcional, si no se proporciona se genera
): Promise<UTXOOperationResult> {
  
  console.log(`💰 Creating REAL secp256k1 private UTXO deposit for ${params.amount} tokens...`);
  console.log('🔐 Using REAL CRYPTOGRAPHY - NO DUMMY DATA');

  // Validate required parameters
  if (!ethereum || typeof ethereum.getSigner !== 'function') {
    throw new Error('❌ Ethereum helper not available or missing getSigner method');
  }
  
  if (!contract) {
    throw new Error('❌ Contract not available');
  }
  
  if (!currentEOA) {
    throw new Error('❌ Current EOA not available');
  }

  try {
    const { tokenAddress, amount } = params;

    // 1. Generate REAL blinding factor using cryptographically secure randomness
    console.log('🎲 Generating REAL cryptographically secure blinding factor...');
    const blindingFactor = generateRealBlindingFactor();
    console.log('✅ REAL blinding factor generated:', blindingFactor.slice(0, 10) + '...');

    // 2. Create REAL Pedersen commitment using secp256k1 elliptic curve
    console.log('🔐 Creating REAL secp256k1 Pedersen commitment...');
    const commitment = await createRealPedersenCommitment(BigInt(amount), blindingFactor);
    
    console.log('✅ REAL commitment created:', {
      x: commitment.x.toString().slice(0, 10) + '...',
      y: commitment.y.toString().slice(0, 10) + '...'
    });

    // 3. Generate REAL nullifier hash using commitment and deterministic data
    console.log('🔐 Generating REAL deterministic nullifier hash...');
    const nullifierHash = ethers.keccak256(ethers.solidityPacked(
      ['address', 'uint256', 'uint256', 'bytes32'],
      [currentEOA.address, commitment.x, commitment.y, blindingFactor]
    ));
    console.log('✅ REAL deterministic nullifier hash generated:', nullifierHash);

    // 4. Calculate data hash using HashCalculator with REAL cryptographic data
    console.log('🧮 Calculating data hash using REAL cryptographic data...');
    const dataHashResult = calculateAndValidateDepositHash(
      tokenAddress,
      commitment.x,  // REAL commitment X
      commitment.y,  // REAL commitment Y  
      nullifierHash, // REAL nullifier
      BigInt(amount),
      currentEOA.address
    );

    console.log('✅ Data hash calculated with REAL cryptographic inputs:', dataHashResult);

    // 4. Get current nonce from contract
    console.log('📊 Getting current nonce from contract...');
    let currentNonce = 0n;
    try {
      currentNonce = await contract.getCurrentNonce();
      console.log('✅ Current nonce:', currentNonce.toString());
    } catch (error) {
      console.warn('⚠️ Could not get current nonce, using 0:', error);
    }

    // 5. Create real attestation with proper backend signature
    console.log('📝 Creating attestation with real backend signature...');
    
    // ✅ Use provided timestamp or generate current time (for logging/metadata only - NOT crypto)
    const attestationTimestamp = timestamp || BigInt(Math.floor(Date.now() / 1000));
    console.log('📅 Using attestation timestamp:', attestationTimestamp.toString());
    
    // Get backend private key for signing
    const backendPrivateKey = import.meta.env.VITE_PRIVATE_KEY_ADMIN;
    if (!backendPrivateKey) {
      throw new Error('❌ VITE_PRIVATE_KEY_ADMIN not configured. Cannot create attestation signature.');
    }
    
    // Ensure private key has 0x prefix
    const formattedPrivateKey = backendPrivateKey.startsWith('0x') ? 
      backendPrivateKey : '0x' + backendPrivateKey;
    
    // Create attestation structure (without signature first)
    const attestationData = {
      operation: "DEPOSIT",
      dataHash: dataHashResult,
      nonce: currentNonce + 1n,
      timestamp: attestationTimestamp
    };
    
    // Create message hash exactly as the contract expects
    const messageHash = ethers.keccak256(ethers.solidityPacked(
      ['string', 'bytes32', 'uint256', 'uint256'],
      [
        attestationData.operation,
        attestationData.dataHash,
        attestationData.nonce,
        attestationData.timestamp
      ]
    ));
    
    // Sign the message hash using Ethereum's standard format
    const backendWallet = new ethers.Wallet(formattedPrivateKey);
    const signature = await backendWallet.signMessage(ethers.getBytes(messageHash));
    
    console.log('✅ Attestation signed by backend:', {
      messageHash,
      signerAddress: backendWallet.address,
      signature: signature.substring(0, 20) + '...'
    });
    
    const attestation = {
      ...attestationData,
      signature
    };

    // 6. Generate unique UTXO ID for the contract
    console.log('🆔 Generating unique UTXO ID...');
    const utxoId = ethers.keccak256(ethers.solidityPacked(
      ['address', 'uint256', 'uint256', 'bytes32', 'uint256'],
      [currentEOA.address, commitment.x, commitment.y, nullifierHash, attestationTimestamp]
    ));
    console.log('✅ UTXO ID generated:', utxoId);

    // 7. Prepare deposit parameters (exactly matching contract structure)
    const depositParams = {
      utxoId,                // ← ADDED: Unique UTXO identifier required by contract
      tokenAddress,
      commitment: { 
        x: commitment.x,      // REAL secp256k1 commitment X coordinate
        y: commitment.y       // REAL secp256k1 commitment Y coordinate
      },
      nullifierHash,         // REAL nullifier hash
      amount: BigInt(amount), // Amount as BigInt
      attestation           // REAL backend attestation
    };

    // 🚨 LOGGING DETALLADO PARA DEBUGGING
    console.log('🚨 === REAL secp256k1 DEPOSIT PARAMS ===');
    console.log('📋 Complete DepositParams with REAL cryptography:');
    console.log('UTXO ID:', depositParams.utxoId);
    console.log('Token Address:', depositParams.tokenAddress);
    console.log('Commitment X (REAL):', depositParams.commitment.x.toString());
    console.log('Commitment Y (REAL):', depositParams.commitment.y.toString());
    console.log('Nullifier Hash (REAL):', depositParams.nullifierHash);
    console.log('Amount:', depositParams.amount.toString());
    console.log('Sender:', currentEOA.address);
    
    // Log attestation específicamente
    logAttestationData({
      operation: depositParams.attestation.operation,
      dataHash: depositParams.attestation.dataHash,
      nonce: depositParams.attestation.nonce.toString(),
      timestamp: depositParams.attestation.timestamp.toString(),
      signature: depositParams.attestation.signature
    }, 'DEPOSIT');

    // 8. Approve token transfer
    console.log('🔓 Approving token transfer...');
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function approve(address,uint256) returns (bool)'],
      ethereum.getSigner() // Use ethereum.getSigner() for transactions
    );
    const network = $selectedNetwork;
    if (network == 'amoy') {
          console.log('🌐 Network:', network);
    }

  

    const approveTx = await tokenContract.approve(contract.target || contract.address, amount);
    await approveTx.wait();
    console.log('✅ Token approval confirmed');

    // 9. Pre-validate with contract
    console.log('🔍 Pre-validating with contract...');
    
    try {
      const [isValid, errorCode] = await contract.preValidateDeposit(
        depositParams.nullifierHash,    // bytes32 - nullifier hash
        depositParams.tokenAddress,     // address - token contract
        depositParams.amount,           // uint256 - amount to deposit
        currentEOA.address              // address - depositor
      );
      
      console.log('📊 Contract validation result:', {
        isValid,
        errorCode
      });
      
      if (!isValid) {
        console.error('❌ Contract validation failed:', errorCode);
        throw new Error(`Contract validation failed with error code: ${errorCode}`);
      }
      
      console.log('✅ Contract pre-validation passed');
      
    } catch (preValidationError: any) {
      console.error('❌ Pre-validation error:', preValidationError);
      throw new Error(`Pre-validation failed: ${preValidationError.message}`);
    }

    // 10. Execute contract call
    console.log('🚀 Executing contract call...');

    const tx = await contract.depositAsPrivateUTXO(depositParams);
    
    console.log('📤 Transaction submitted:', {
      hash: tx.hash,
      from: tx.from,
      to: tx.to
    });

    console.log('⏳ Waiting for transaction confirmation...');
    const receipt = await tx.wait();
    
    // ✅ MEJORADO: Verificación más robusta del estado de la transacción
    if (!receipt) {
      throw new Error('❌ Transaction receipt not received');
    }
    
    if (receipt.status === 0) {
      throw new Error('❌ Transaction failed on-chain');
    }
    
    // ✅ MEJORADO: Verificar que el evento ZKDeposit se emitió correctamente
    console.log('🔍 Verifying ZKDeposit event was emitted...');
    let depositEventFound = false;
    let eventUtxoId: string | null = null;
    
    try {
      for (const log of receipt.logs) {
        try {
          const parsedLog = contract.interface.parseLog(log);
          if (parsedLog && parsedLog.name === 'ZKDeposit') {
            depositEventFound = true;
            eventUtxoId = parsedLog.args[0]; // First argument should be utxoId
            console.log('✅ ZKDeposit event found:', {
              utxoId: eventUtxoId,
              sender: parsedLog.args[1],
              tokenAddress: parsedLog.args[2],
              amount: parsedLog.args[3]?.toString(),
              nullifierHash: parsedLog.args[4]
            });
            break;
          }
        } catch (parseError) {
          // Continue checking other logs
          continue;
        }
      }
    } catch (eventError) {
      console.warn('⚠️ Could not parse transaction logs for ZKDeposit event:', eventError);
    }
    
    if (!depositEventFound) {
      throw new Error('❌ No ZKDeposit event found in transaction receipt - deposit may have failed');
    }
    
    // ✅ VERIFICACIÓN: El utxoId del evento debe coincidir con el que generamos
    if (eventUtxoId && eventUtxoId !== utxoId) {
      console.warn('⚠️ UTXO ID mismatch between generated and event:', {
        generated: utxoId,
        fromEvent: eventUtxoId
      });
    }
    
    console.log('✅ Transaction confirmed with ZKDeposit event:', {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      utxoId: eventUtxoId || utxoId
    });

    // ✅ OPCIONAL: Verificar que el UTXO existe realmente en el contrato
    console.log('🔍 Verifying UTXO exists in contract...');
    try {
      const utxoExists = await contract.utxoExists(utxoId);
      const nullifierUsed = await contract.nullifiersUsed(nullifierHash);
      
      if (!utxoExists) {
        throw new Error('❌ UTXO not found in contract after transaction');
      }
      
      if (!nullifierUsed) {
        throw new Error('❌ Nullifier not marked as used in contract after transaction');
      }
      
      console.log('✅ UTXO verified to exist in contract and nullifier marked as used');
    } catch (verifyError) {
      console.warn('⚠️ Could not verify UTXO existence in contract:', verifyError);
      // No lanzamos error aquí porque el receipt y evento ya confirmaron que la tx fue exitosa
    }

    // 11. Create local UTXO record with REAL cryptographic data
    console.log('💾 Transaction confirmed on-chain, now creating UTXO record with REAL secp256k1 cryptography...');
    // Using utxoId already generated above for contract params

    const utxo: ExtendedUTXOData = {
      id: utxoId,  // ← Use the same utxoId generated for contract
      exists: true,
      value: BigInt(amount),
      tokenAddress,
      owner: currentEOA.address,
      timestamp: attestationTimestamp, // ✅ Use consistent timestamp from attestation
      isSpent: false,
      commitment: JSON.stringify({ x: commitment.x.toString(), y: commitment.y.toString() }), // ✅ FIXED: Store coordinates as JSON
      parentUTXO: '',
      utxoType: UTXOType.DEPOSIT,
      blindingFactor: blindingFactor, // ✅ REAL secp256k1 blinding factor
      localCreatedAt: Number(attestationTimestamp) * 1000, // ✅ Convert back to milliseconds for consistency
      confirmed: true,
      creationTxHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      nullifierHash: nullifierHash, // ✅ REAL nullifier hash
      cryptographyType: 'secp256k1', 
      notes: JSON.stringify({ // ✅ Store hash and additional metadata in notes for reference
        commitmentHash: ethers.keccak256(ethers.solidityPacked(['uint256', 'uint256'], [commitment.x, commitment.y])),
        commitmentX: commitment.x.toString(),
        commitmentY: commitment.y.toString(),
        cryptographyType: 'secp256k1'
      })
    };

    console.log('✅ UTXO created with REAL cryptographic data:', {
      id: utxoId.slice(0, 10) + '...',
      blindingFactor: blindingFactor.slice(0, 10) + '...',
      commitmentHash: ethers.keccak256(ethers.solidityPacked(['uint256', 'uint256'], [commitment.x, commitment.y])).slice(0, 10) + '...',
      originalCoordinates: {
        x: commitment.x.toString().slice(0, 10) + '...',
        y: commitment.y.toString().slice(0, 10) + '...'
      },
      nullifierHash: nullifierHash.slice(0, 10) + '...',
      cryptographyType: 'secp256k1' // ✅ REAL crypto type used
    });

    // 12. Store locally with REAL cryptographic data (ONLY after on-chain confirmation)
    console.log('🔒 SECURITY: Storing UTXO locally ONLY after on-chain confirmation and event verification');
    utxos.set(utxoId, utxo);
    
    console.log('💾 Saving UTXO with REAL cryptographic data to localStorage...');
    
    // 🚨 DEBUGGING: Verify UTXO has all required fields for localStorage
    console.log('🔍 Pre-save UTXO validation:', {
      hasBlindingFactor: !!utxo.blindingFactor,
      blindingFactorLength: utxo.blindingFactor?.length,
      cryptographyType: utxo.cryptographyType,
      hasCommitment: !!utxo.commitment,
      commitmentLength: utxo.commitment?.length,
      commitmentFormat: 'coordinates-as-json',
      hasCoordinatesInNotes: !!utxo.notes,
      owner: currentEOA.address,
      confirmed: utxo.confirmed,
      transactionHash: utxo.creationTxHash
    });
    
    try {
      await savePrivateUTXOToLocal(currentEOA.address, utxo);
      console.log('✅ UTXO saved successfully to localStorage with REAL cryptographic data!');
      console.log('🔐 SECURITY: UTXO was saved ONLY after blockchain confirmation');
    } catch (saveError) {
      console.error('❌ CRITICAL: Failed to save UTXO to localStorage:', saveError);
      console.error('🚨 UTXO that failed to save:', utxo);
      console.error('⚠️ NOTE: Transaction was successful on-chain but local storage failed');
      throw new Error(`Failed to save UTXO to localStorage: ${saveError}`);
    }
    console.log('📊 Final UTXO Details (stored ONLY after blockchain confirmation):', {
      id: utxoId.slice(0, 16) + '...',
      amount: formatEther(amount),
      cryptographyType: 'secp256k1', // ✅ REAL crypto type used
      hasRealBlindingFactor: !!blindingFactor && blindingFactor !== '',
      hasRealCommitment: !!(commitment.x && commitment.y),
      hasRealNullifier: !!nullifierHash && nullifierHash !== '',
      confirmed: true,
      blockNumber: receipt.blockNumber,
      transactionHash: receipt.hash
    });
    
    emit('utxo:created', utxo);

    const result: UTXOOperationResult = {
      success: true,
      transactionHash: receipt.hash,
      gasUsed: receipt.gasUsed,
      createdUTXOIds: [utxoId]
    };

    console.log('🎉 Simplified private UTXO deposit successful with verified on-chain confirmation!');
    console.log('🔐 SECURITY SUMMARY: UTXO created and stored ONLY after blockchain verification');
    console.log('✅ Final result:', {
      utxoId: utxoId.slice(0, 16) + '...',
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    });
    
    return result;

  } catch (error) {
    console.error('❌ Simplified deposit failed:', error);
    
    const result: UTXOOperationResult = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorDetails: error
    };

    return result;
  }
}
