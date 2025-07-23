/**
 * WithdrawPrivateUTXO.ts
 * Service for withdrawing private UTXOs to public tokens
 * Follows the same patte      // 6. Esperar confirmación
      const receipt = await tx.wait();
      if (!receipt) {
        return {
          success: false,
          error: 'Transaction receipt is null'
        };
      }
      
      console.log('✅ Transaction confirmed:', receipt.hash);

      // 7. Procesar resultado (after null check, receipt is guaranteed to be non-null)
      const result = this.processWithdrawResult(receipt as ethers.ContractTransactionReceipt, params);DepositAsPrivateUTXO and SplitPrivateUTXO
 */

import { ethers } from 'ethers';
import type { 
  UTXOVaultContract, 
  WithdrawParams,
  CommitmentPoint,
  BackendAttestation,
  UTXODetails
} from '../contracts/UTXOVault.types';
import {
  UTXOOperationError,
  UTXONotFoundError,
  InsufficientFundsError,
  UTXOAlreadySpentError
} from '../types/utxo.types';
import type { UTXOOperationResult } from '../types/utxo.types';
import { CryptoHelpers as ZenroomHelpers } from '../utils/crypto.helpers';

/**
 * Error específico para validación de withdraw
 */
export class WithdrawValidationError extends UTXOOperationError {
  constructor(message: string, public readonly errorCode?: number, context?: any) {
    super(message, 'validateWithdraw', context);
    this.name = 'WithdrawValidationError';
  }
}

/**
 * Datos necesarios para ejecutar un withdraw de UTXO con criptografía REAL
 */
export interface WithdrawUTXOData {
  // UTXO de entrada - con criptografía REAL
  sourceCommitment: CommitmentPoint;  // Commitment Pedersen REAL en BN254
  sourceValue: bigint;
  sourceBlindingFactor: string;       // Blinding factor criptográfico REAL
  sourceNullifier: string;            // Nullifier hash criptográfico REAL
  
  // Datos de withdraw
  revealedAmount: bigint;             // Cantidad a revelar públicamente
  recipient: string;                  // Dirección del destinatario
  tokenAddress: string;
  sourceUTXOId?: string;
}

export interface WithdrawAttestationProvider {
  createWithdrawAttestation(withdrawData: WithdrawUTXOData): Promise<BackendAttestation>;
}

export class WithdrawPrivateUTXO {
  constructor(
    private contract: UTXOVaultContract,
    private signer: ethers.Signer
  ) {}

  /**
   * Execute withdraw operation with real backend attestation
   */
  async executeWithdraw(
    params: WithdrawUTXOData,
    attestationProvider: WithdrawAttestationProvider
  ): Promise<UTXOOperationResult> {
    try {
      console.log('🔄 Starting withdraw operation...');
      console.log('💰 Withdraw params:', {
        sourceUTXOId: params.sourceUTXOId,
        revealedAmount: params.revealedAmount.toString(),
        recipient: params.recipient
      });

      // 1. Pre-validación usando el contrato (sin gastar gas)
      console.log('🔍 Pre-validating withdraw parameters...');
      const preValidationResult = await this.preValidateWithdraw(params);
      
      if (!preValidationResult.isValid) {
        throw new Error(`Pre-validation failed: ${this.getErrorMessage(preValidationResult.errorCode)}`);
      }
      console.log('✅ Pre-validation passed');

      // 2. Preparar datos para la attestation
      console.log('📋 Preparing withdraw attestation data...');
      const withdrawData: WithdrawUTXOData = {
        sourceCommitment: params.sourceCommitment,
        sourceValue: params.sourceValue,
        sourceBlindingFactor: params.sourceBlindingFactor,
        sourceNullifier: params.sourceNullifier,
        revealedAmount: params.revealedAmount,
        recipient: params.recipient,
        tokenAddress: params.tokenAddress,
        sourceUTXOId: params.sourceUTXOId
      };

      // 3. Crear attestation del backend
      console.log('🔐 Creating backend attestation...');
      const attestation = await attestationProvider.createWithdrawAttestation(withdrawData);
      console.log('✅ Backend attestation created');

      // 4. Preparar parámetros para el contrato
      const contractParams: WithdrawParams = {
        commitment: params.sourceCommitment,
        nullifierHash: params.sourceNullifier,
        revealedAmount: params.revealedAmount,
        attestation: attestation
      };

      console.log('📡 Calling contract withdrawFromPrivateUTXO...');
      
      // 5. Ejecutar transacción en el contrato
      const tx = await this.contract.withdrawFromPrivateUTXO(contractParams);
      console.log('📤 Transaction sent:', tx.hash);

      // 6. Esperar confirmación
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed:', receipt?.hash || 'no hash');

      // 7. Procesar eventos y resultado
      const result = this.processWithdrawResult(receipt, params);
      
      console.log('🎉 Withdraw operation completed successfully');
      return result;

    } catch (error: any) {
      console.error('❌ Withdraw operation failed:', error);
      return {
        success: false,
        error: error.message || 'Unknown withdraw error',
        transactionHash: undefined
      };
    }
  }

  /**
   * Pre-validate withdraw parameters without spending gas
   */
  private async preValidateWithdraw(params: WithdrawUTXOData): Promise<{ isValid: boolean; errorCode: number }> {
    try {
      // Calcular hashes criptográficos reales
      const sourceCommitmentHash = await this._calculateRealCommitmentHash(params.sourceCommitment);
      
      console.log('🔍 Detailed pre-validation debug:');
      console.log('  - sourceCommitment:', params.sourceCommitment);
      console.log('  - sourceCommitmentHash:', sourceCommitmentHash);
      console.log('  - sourceNullifier:', params.sourceNullifier);
      console.log('  - revealedAmount:', params.revealedAmount.toString());
      console.log('  - recipient:', params.recipient);
      
      // Llamar a la función de pre-validación del contrato
      const result = await this.contract.preValidateWithdraw(
        sourceCommitmentHash,       // sourceCommitment como hash
        params.sourceNullifier,     // sourceNullifier
        params.revealedAmount,      // amount
        params.recipient            // recipient
      );

      console.log('🔍 Pre-validation result:', { isValid: result[0], errorCode: result[1] });

      return {
        isValid: result[0], // bool isValid
        errorCode: result[1] // uint8 errorCode
      };
    } catch (error: any) {
      console.error('❌ Pre-validation error:', error);
      return {
        isValid: false,
        errorCode: 255 // Error code for validation failure
      };
    }
  }

  /**
   * Process withdraw transaction result
   */
  private processWithdrawResult(
    receipt: ethers.ContractTransactionReceipt | null, 
    params: WithdrawUTXOData
  ): UTXOOperationResult {
    if (!receipt) {
      return {
        success: false,
        error: 'Transaction receipt is null'
      };
    }
    
    try {
      // Buscar evento PrivateWithdraw en los logs
      const withdrawEventSignature = ethers.id("PrivateWithdraw(bytes32,address,uint256,address)");
      let withdrawEventFound = false;

      for (const log of receipt.logs) {
        try {
          if (log.topics.length > 0 && log.topics[0] === withdrawEventSignature) {
            withdrawEventFound = true;
            console.log('📊 Withdraw event found in logs');
            break;
          }
        } catch {
          continue;
        }
      }

      if (withdrawEventFound) {
        return {
          success: true,
          transactionHash: receipt.hash,
          gasUsed: receipt.gasUsed
        };
      } else {
        console.warn('⚠️ No PrivateWithdraw event found in transaction');
        return {
          success: true,
          transactionHash: receipt.hash,
          gasUsed: receipt.gasUsed
        };
      }

    } catch (error: any) {
      console.error('❌ Error processing withdraw result:', error);
      return {
        success: false,
        error: `Failed to process withdraw result: ${error.message}`,
        transactionHash: receipt.hash
      };
    }
  }

  /**
   * Get error message from error code (based on preValidateWithdraw in UTXOVaultBase.sol)
   */
  private getErrorMessage(errorCode: number): string {
    switch (errorCode) {
      case 1:
        return 'UTXO not found';
      case 2:
        return 'UTXO not found';
      case 3:
        return 'UTXO already spent';
      case 4:
        return 'Invalid nullifier (empty)';
      case 5:
        return 'Invalid nullifier';
      case 6:
        return 'Invalid recipient address (zero address)';
      case 7:
        return 'Invalid amount (amount is 0)';
      case 8:
        return 'Nullifier already used - UTXO already spent on-chain';
      case 255:
        return 'Validation failed';
      default:
        return `Unknown error (code: ${errorCode})`;
    }
  }

  /**
   * Calculate real cryptographic commitment hash (same as contract)
   */
  private async _calculateRealCommitmentHash(commitment: CommitmentPoint): Promise<string> {
    // Use real keccak256 as the Solidity contract
    return ethers.keccak256(
      ethers.solidityPacked(['uint256', 'uint256'], [commitment.x, commitment.y])
    );
  }

  /**
   * DEBUG: Check if nullifier is already used in contract
   */
  async debugCheckNullifier(nullifierHash: string): Promise<boolean> {
    try {
      console.log('🔍 Checking nullifier in contract:', nullifierHash);
      const isUsed = await this.contract.isNullifierUsed(nullifierHash);
      console.log('🔍 Nullifier status in contract:', { nullifierHash, isUsed });
      return isUsed;
    } catch (error) {
      console.error('❌ Error checking nullifier:', error);
      return false;
    }
  }
}
