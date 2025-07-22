/**
 * PreGasValidationService - Validación SIN gastar gas
 * 
 * USO: Llamar ANTES de hacer transacciones para validar parámetros
 * BENEFICIO: Detecta errores SIN gastar gas, mejor UX
 * 
 * Usa las nuevas funciones preValidate* del contrato optimizado
 */

import { ethers } from 'ethers';

interface ValidationResult {
    isValid: boolean;
    errorCode: number;
    errorMessage: string;
}

export class PreGasValidationService {
    private contract: ethers.Contract;

    constructor(contractAddress: string, contractABI: any[], provider: ethers.Provider) {
        this.contract = new ethers.Contract(contractAddress, contractABI, provider);
    }

    /**
     * Valida parámetros de split ANTES de gastar gas
     */
    async validateSplit(
        sourceCommitment: string,
        outputCommitments: string[],
        sourceNullifier: string
    ): Promise<ValidationResult> {
        try {
            const [isValid, errorCode] = await this.contract.preValidateSplit(
                sourceCommitment,
                outputCommitments,
                sourceNullifier
            );

            return {
                isValid,
                errorCode: Number(errorCode),
                errorMessage: this.getSplitErrorMessage(Number(errorCode))
            };

        } catch (error) {
            console.error('❌ Split validation error:', error);
            return {
                isValid: false,
                errorCode: 255,
                errorMessage: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Valida parámetros de transfer ANTES de gastar gas
     */
    async validateTransfer(
        sourceCommitments: string[],
        sourceNullifiers: string[],
        outputCommitments: string[],
        recipient: string
    ): Promise<ValidationResult> {
        try {
            const [isValid, errorCode] = await this.contract.preValidateTransfer(
                sourceCommitments,
                sourceNullifiers,
                outputCommitments,
                recipient
            );

            return {
                isValid,
                errorCode: Number(errorCode),
                errorMessage: this.getTransferErrorMessage(Number(errorCode))
            };

        } catch (error) {
            console.error('❌ Transfer validation error:', error);
            return {
                isValid: false,
                errorCode: 255,
                errorMessage: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Valida parámetros de withdraw ANTES de gastar gas
     */
    async validateWithdraw(
        sourceCommitments: string[],
        sourceNullifiers: string[],
        amount: bigint,
        recipient: string
    ): Promise<ValidationResult> {
        try {
            const [isValid, errorCode] = await this.contract.preValidateWithdraw(
                sourceCommitments,
                sourceNullifiers,
                amount,
                recipient
            );

            return {
                isValid,
                errorCode: Number(errorCode),
                errorMessage: this.getWithdrawErrorMessage(Number(errorCode))
            };

        } catch (error) {
            console.error('❌ Withdraw validation error:', error);
            return {
                isValid: false,
                errorCode: 255,
                errorMessage: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Mensajes de error para split
     */
    private getSplitErrorMessage(errorCode: number): string {
        switch (errorCode) {
            case 0: return 'Validation successful';
            case 1: return 'Source UTXO does not exist';
            case 2: return 'Source UTXO is already spent';
            case 3: return 'Output arrays are malformed or empty';
            case 4: return 'Output commitment cannot be empty';
            case 5: return 'Balance is not conserved';
            case 6: return 'Source nullifier is invalid';
            case 7: return 'Nullifier has already been used';
            default: return `Unknown error code: ${errorCode}`;
        }
    }

    /**
     * Mensajes de error para transfer
     */
    private getTransferErrorMessage(errorCode: number): string {
        switch (errorCode) {
            case 0: return 'Validation successful';
            case 1: return 'Input/output arrays are malformed';
            case 2: return 'Source UTXO does not exist';
            case 3: return 'Source UTXO is already spent';
            case 4: return 'Source nullifier is invalid';
            case 5: return 'Output commitment cannot be empty';
            case 6: return 'Balance is not conserved';
            case 7: return 'Recipient address is invalid';
            case 8: return 'Nullifier has already been used';
            default: return `Unknown error code: ${errorCode}`;
        }
    }

    /**
     * Mensajes de error para withdraw
     */
    private getWithdrawErrorMessage(errorCode: number): string {
        switch (errorCode) {
            case 0: return 'Validation successful';
            case 1: return 'Input arrays are malformed';
            case 2: return 'Source UTXO does not exist';
            case 3: return 'Source UTXO is already spent';
            case 4: return 'Source nullifier is invalid';
            case 5: return 'Balance is not conserved';
            case 6: return 'Recipient address is invalid';
            case 7: return 'Withdraw amount must be greater than zero';
            case 8: return 'Nullifier has already been used';
            default: return `Unknown error code: ${errorCode}`;
        }
    }

    /**
     * Función utilitaria: Validar antes de cualquier operación
     */
    async preValidateOperation(operationType: 'split' | 'transfer' | 'withdraw', params: any): Promise<ValidationResult> {
        switch (operationType) {
            case 'split':
                return await this.validateSplit(
                    params.sourceCommitment,
                    params.outputCommitments,
                    params.sourceNullifier
                );
            
            case 'transfer':
                return await this.validateTransfer(
                    params.sourceCommitments,
                    params.sourceNullifiers,
                    params.outputCommitments,
                    params.recipient
                );
            
            case 'withdraw':
                return await this.validateWithdraw(
                    params.sourceCommitments,
                    params.sourceNullifiers,
                    params.amount,
                    params.recipient
                );
            
            default:
                return {
                    isValid: false,
                    errorCode: 255,
                    errorMessage: `Unknown operation type: ${operationType}`
                };
        }
    }
}

export default PreGasValidationService;
