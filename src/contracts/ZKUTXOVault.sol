// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ZKUTXOVaultBase.sol";

/**
 * @title ZKUTXOVault - Ultra-simplified ZK-UTXO System
 * @notice True zero-knowledge privacy with minimal on-chain state
 * @dev Backend handles ALL cryptography, contract only prevents double-spend
 */
contract ZKUTXOVault is ZKUTXOVaultBase, ReentrancyGuard {
    
    // ========================
    // CONSTRUCTOR
    // ========================
    
    constructor(address _authorizedBackend) ZKUTXOVaultBase(_authorizedBackend) {
        // La inicialización se hace en el contrato base
    }
    
    // ========================
    // DEPOSIT ZK - ÚNICA OPERACIÓN CON AMOUNT VISIBLE
    // ========================
    
    /**
     * @notice Depositar tokens como UTXO privado
     * @dev Amount visible (entrada al sistema ZK)
     */
    function depositAsPrivateUTXO(
        ZKDepositParams calldata params
    ) external nonReentrant {
        
        // 1. Pre-validación rápida
        (bool isValid, uint8 errorCode) = preValidateDeposit(
            params.nullifierHash,
            params.tokenAddress,
            params.amount,
            msg.sender
        );
        
        require(isValid, _getDepositErrorMessage(errorCode));
        
        // 2. Verificar attestation del backend
        require(
            _verifyZKAttestation(params.attestation, "DEPOSIT"),
            "Invalid attestation"
        );
        
        // 3. Registrar token si es necesario
        _registerToken(params.tokenAddress);
        
        // 4. Transferir tokens al contrato
        IERC20(params.tokenAddress).transferFrom(msg.sender, address(this), params.amount);
        
        // 5. Marcar UTXO como existente (sin almacenar amounts)
        utxoExists[params.utxoId] = true;
        
        // 6. Emitir evento (amount visible en deposit)
        emit ZKDeposit(
            params.utxoId,
            msg.sender,
            params.tokenAddress,
            params.amount,      // ← Visible en deposit
            params.nullifierHash,
            block.timestamp
        );
    }
    
    // ========================
    // SPLIT ZK - SIN AMOUNTS (PRIVACIDAD TOTAL)
    // ========================
    
    /**
     * @notice Split UTXO en múltiples UTXOs
     * @dev Amounts completamente privados (verdadero ZK)
     */
    function splitPrivateUTXO(
        ZKSplitParams calldata params
    ) external nonReentrant returns (bool) {
        
        // 1. Pre-validación COMPLETA (input + outputs + duplicados)
        (bool isValid, uint8 errorCode) = preValidateSplit(
            params.inputNullifier,
            params.outputNullifiers,
            params.outputUTXOIds
        );
        require(isValid, _getSplitErrorMessage(errorCode));
        
        // 2. Verificar attestation del backend (backend verificó conservación de valor)
        require(
            _verifyZKAttestation(params.attestation, "SPLIT"),
            "Invalid attestation"
        );
        
        // 3. Marcar input nullifier como usado (prevenir doble gasto)
        nullifiersUsed[params.inputNullifier] = true;
        
        // 4. Marcar outputs como existentes (sin amounts - privacidad ZK)
        for (uint256 i = 0; i < params.outputUTXOIds.length; i++) {
            utxoExists[params.outputUTXOIds[i]] = true;
        }
        
        // 5. Emitir evento (sin amounts - privacidad ZK)
        emit ZKSplit(
            params.inputNullifier,
            params.outputUTXOIds,     // ← Sin amounts
            params.outputNullifiers,
            block.timestamp
        );
        
        return true;
    }
    
    // ========================
    // TRANSFER ZK - SIN AMOUNTS (PRIVACIDAD TOTAL)
    // ========================
    
    /**
     * @notice Transferir UTXO a otro usuario
     * @dev Amounts completamente privados (verdadero ZK)
     */
    function transferPrivateUTXO(
        ZKTransferParams calldata params
    ) external nonReentrant returns (bool) {
        
        // 1. Pre-validación rápida
        (bool isValid, uint8 errorCode) = preValidateTransfer(
            params.inputNullifier,
            params.outputNullifier
        );
        require(isValid, _getTransferErrorMessage(errorCode));
        
        // 2. Verificar attestation del backend (backend verificó ownership)
        require(
            _verifyZKAttestation(params.attestation, "TRANSFER"),
            "Invalid attestation"
        );
        
        // 3. Verificar IDs válidos
        require(params.outputUTXOId != bytes32(0), "Invalid output UTXO ID");
        
        // 4. Destruir UTXO original (marcar nullifier como usado)
        nullifiersUsed[params.inputNullifier] = true;
        
        // 5. Crear nuevo UTXO para receptor (sin amount - privacidad ZK)
        utxoExists[params.outputUTXOId] = true;
      
        
        // 6. Emitir evento (sin amounts - privacidad ZK)
        emit ZKTransfer(
            params.inputNullifier,
            params.outputUTXOId,     // ← Sin amounts
            params.outputNullifier,
            block.timestamp
        );
        
        return true;
    }
    
    // ========================
    // WITHDRAW ZK - AMOUNT VISIBLE (SALIDA DEL SISTEMA)
    // ========================
    
    /**
     * @notice Retirar UTXO como tokens ERC20
     * @dev Amount visible (salida del sistema ZK)
     */
    function withdrawFromPrivateUTXO(
        ZKWithdrawParams calldata params
    ) external nonReentrant {
        
        // 1. Pre-validación rápida
        (bool isValid, uint8 errorCode) = preValidateWithdraw(
            params.nullifier,
            params.token,
            params.amount
        );
        require(isValid, _getWithdrawErrorMessage(errorCode));
        
        // 2. Verificar attestation del backend (backend verificó ownership y amount)
        require(
            _verifyZKAttestation(params.attestation, "WITHDRAW"),
            "Invalid attestation"
        );
        
        // 3. Marcar nullifier como usado (prevenir doble gasto)
        nullifiersUsed[params.nullifier] = true;
        
        // 4. Transferir tokens al usuario (amount visible en withdraw)
        IERC20(params.token).transfer(msg.sender, params.amount);
        
        // 5. Emitir evento (amount visible en withdraw)
        emit ZKWithdraw(
            params.nullifier,
            msg.sender,
            params.token,
            params.amount,      // ← Visible en withdraw
            block.timestamp
        );
    }
    
    // ========================
    // FUNCIONES DE ERROR
    // ========================
    
    function _getDepositErrorMessage(uint8 errorCode) internal pure returns (string memory) {
        if (errorCode == 1) return "Invalid nullifier";
        if (errorCode == 2) return "Nullifier already used";
        if (errorCode == 3) return "Invalid token";
        if (errorCode == 4) return "Invalid amount";
        if (errorCode == 5) return "Insufficient allowance";
        if (errorCode == 6) return "Invalid token contract";
        if (errorCode == 7) return "Insufficient balance";
        return "Unknown deposit error";
    }
    
    function _getSplitErrorMessage(uint8 errorCode) internal pure returns (string memory) {
        if (errorCode == 1) return "Invalid input nullifier";
        if (errorCode == 2) return "Input already spent";
        if (errorCode == 3) return "No outputs provided";
        if (errorCode == 4) return "Array length mismatch";
        if (errorCode == 5) return "Output nullifier already used";
        if (errorCode == 6) return "Invalid output nullifier";
        if (errorCode == 7) return "Invalid output UTXO ID";
        if (errorCode == 8) return "Output nullifier same as input";
        if (errorCode == 9) return "Duplicate output nullifiers";
        if (errorCode == 10) return "Duplicate output UTXO IDs";
        return "Unknown split error";
    }
    
    function _getTransferErrorMessage(uint8 errorCode) internal pure returns (string memory) {
        if (errorCode == 1) return "Invalid nullifiers";
        if (errorCode == 2) return "Input already spent";
        if (errorCode == 3) return "Output nullifier collision";
        return "Unknown transfer error";
    }
    
    function _getWithdrawErrorMessage(uint8 errorCode) internal pure returns (string memory) {
        if (errorCode == 1) return "Invalid nullifier";
        if (errorCode == 2) return "Already spent";
        if (errorCode == 3) return "Invalid amount";
        if (errorCode == 4) return "Insufficient contract balance";
        if (errorCode == 5) return "Invalid token";
        return "Unknown withdraw error";
    }
    
    // ========================
    // FUNCIONES DE EMERGENCIA
    // ========================
    
    bool public emergencyPaused = false;
    
    modifier whenNotPaused() {
        require(!emergencyPaused, "Contract is paused");
        _;
    }
    
    function setEmergencyPause(bool paused) external onlyOwner {
        emergencyPaused = paused;
    }
    
    /**
     * @notice Recuperar tokens en caso de emergencia (solo owner)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(emergencyPaused, "Must be paused for emergency withdrawal");
        IERC20(token).transfer(owner(), amount);
    }
    
    // ========================
    // FUNCIONES DE UTILIDAD
    // ========================
    
    /**
     * @notice Obtener estadísticas del contrato
     */
    function getContractStats() external view returns (
        uint256 totalTokens,
        uint256 currentNonce,
        address backend,
        bool isPaused
    ) {
        return (
            allRegisteredTokens.length,
            lastNonce,
            authorizedBackend,
            emergencyPaused
        );
    }
}
