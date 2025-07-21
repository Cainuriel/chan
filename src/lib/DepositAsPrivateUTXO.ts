/**
 * @fileoverview Simplified UTXO deposit function using only HashCalculator
 * @description Clean implementation without Zenroom dependencies
 */

import { ethers, toBigInt } from 'ethers';
import { calculateAndValidateDepositHash, logAttestationData } from './HashCalculator';
import type { CreateUTXOParams, UTXOOperationResult, ExtendedUTXOData } from '../types/utxo.types';
import { UTXOType } from '../types/utxo.types';

/**
 * @dev Simplified deposit function using only HashCalculator
 * @notice This version eliminates Zenroom dependencies and aligns perfectly with contract
 */
export async function depositAsPrivateUTXOSimplified(
  params: CreateUTXOParams,
  contract: any,
  currentEOA: any,
  ethereum: any,
  utxos: Map<string, ExtendedUTXOData>,
  savePrivateUTXOToLocal: Function,
  emit: Function
): Promise<UTXOOperationResult> {
  
  console.log(`💰 Creating simplified private UTXO deposit for ${params.amount} tokens...`);

  try {
    const { tokenAddress, amount } = params;

    // 1. Generate commitment points as uint256 (exactly what contract expects)
    console.log('🔐 Generating commitment points (uint256 format)...');
    
    const commitmentX = ethers.getBigInt(ethers.hexlify(ethers.randomBytes(32)));
    const commitmentY = ethers.getBigInt(ethers.hexlify(ethers.randomBytes(32)));
    
    console.log('📊 Generated commitment:', {
      x: commitmentX.toString(),
      y: commitmentY.toString()
    });

    // 2. Generate nullifier hash (bytes32 format)
    console.log('🔐 Generating nullifier hash...');
    const nullifierHash = ethers.keccak256(ethers.solidityPacked(
      ['address', 'uint256', 'uint256', 'uint256'],
      [currentEOA.address, commitmentX, commitmentY, Date.now()]
    ));

    // 3. Calculate data hash using HashCalculator (our verified method)
    console.log('🧮 Calculating data hash using HashCalculator...');
    const dataHashResult = calculateAndValidateDepositHash(
      tokenAddress,
      commitmentX,
      commitmentY,
      nullifierHash,
      BigInt(amount),
      currentEOA.address
    );

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
    const currentTime = Math.floor(Date.now() / 1000);
    
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
      timestamp: BigInt(currentTime)
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

    // 6. Prepare deposit parameters (exactly matching contract structure)
    const depositParams = {
      tokenAddress,
      commitment: { 
        x: commitmentX,      // uint256 as BigInt
        y: commitmentY       // uint256 as BigInt
      },
      nullifierHash,         // bytes32
      amount: BigInt(amount), // uint256 as BigInt
      attestation           // BackendAttestation structure
    };

    // 🚨 LOGGING DETALLADO PARA DEBUGGING
    console.log('🚨 === SIMPLIFIED DEPOSIT PARAMS ===');
    console.log('📋 Complete DepositParams:');
    console.log('Token Address:', depositParams.tokenAddress);
    console.log('Commitment X:', depositParams.commitment.x.toString());
    console.log('Commitment Y:', depositParams.commitment.y.toString());
    console.log('Nullifier Hash:', depositParams.nullifierHash);
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

    // 7. Approve token transfer
    console.log('🔓 Approving token transfer...');
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function approve(address,uint256) returns (bool)'],
      ethereum.getSigner() // Use ethereum.getSigner() for transactions
    );

    const approveTx = await tokenContract.approve(contract.target || contract.address, amount);
    await approveTx.wait();
    console.log('✅ Token approval confirmed');

    // 8. Pre-validate with contract
    console.log('🔍 Pre-validating with contract...');
    
    try {
      const [isValid, errorMessage] = await contract.validateDepositParams(
        depositParams,
        currentEOA.address
      );
      
      console.log('📊 Contract validation result:', {
        isValid,
        errorMessage
      });
      
      if (!isValid) {
        console.error('❌ Contract validation failed:', errorMessage);
        throw new Error(`Contract validation failed: ${errorMessage}`);
      }
      
      console.log('✅ Contract pre-validation passed');
      
    } catch (preValidationError: any) {
      console.error('❌ Pre-validation error:', preValidationError);
      throw new Error(`Pre-validation failed: ${preValidationError.message}`);
    }

    // 9. Execute contract call
    console.log('🚀 Executing contract call...');
    
    const tx = await contract.depositAsPrivateUTXO(depositParams);
    
    console.log('📤 Transaction submitted:', {
      hash: tx.hash,
      from: tx.from,
      to: tx.to
    });

    console.log('⏳ Waiting for transaction confirmation...');
    const receipt = await tx.wait();
    
    if (!receipt || receipt.status === 0) {
      throw new Error(`Transaction failed: ${receipt?.hash || tx.hash}`);
    }
    
    console.log('✅ Transaction confirmed:', {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    });

    // 10. Create local UTXO record
    const utxoId = ethers.keccak256(ethers.solidityPacked(
      ['address', 'uint256', 'uint256', 'uint256'],
      [currentEOA.address, commitmentX, commitmentY, receipt.blockNumber]
    ));

    const utxo: ExtendedUTXOData = {
      id: utxoId,
      exists: true,
      value: BigInt(amount),
      tokenAddress,
      owner: currentEOA.address,
      timestamp: toBigInt(Date.now()),
      isSpent: false,
      commitment: ethers.solidityPacked(['uint256', 'uint256'], [commitmentX, commitmentY]),
      parentUTXO: '',
      utxoType: UTXOType.DEPOSIT,
      blindingFactor: '', // Not used in simplified version
      localCreatedAt: Date.now(),
      confirmed: true,
      creationTxHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      nullifierHash,
      cryptographyType: 'Other'
    };

    // 11. Store locally
    utxos.set(utxoId, utxo);
    await savePrivateUTXOToLocal(currentEOA.address, utxo);
    
    emit('utxo:created', utxo);

    const result: UTXOOperationResult = {
      success: true,
      transactionHash: receipt.hash,
      gasUsed: receipt.gasUsed,
      createdUTXOIds: [utxoId]
    };

    console.log('✅ Simplified private UTXO deposit successful:', utxoId);
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
