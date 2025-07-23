// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./UTXOVaultBase.sol";

/**
 * @title UTXOVault - Private UTXO System with Full Backend Delegation  
 * @notice Backend hace TODA la criptografía, Solidity solo mantiene estado
 * @dev Confianza total en backend autorizado para todas las verificaciones complejas
 * @dev OPTIMIZADO: Con mappings de usuarios para recuperación eficiente sin scanning
 */
contract UTXOVault is UTXOVaultBase, ReentrancyGuard {
    
    // ========================
    // CONSTRUCTOR
    // ========================
    
    constructor(address _authorizedBackend) UTXOVaultBase(_authorizedBackend) {
        // La inicialización se hace en el contrato base
    }
    
    // ========================
    // ADMINISTRACIÓN
    // ========================
    
    /**
     * @dev Actualizar backend autorizado
     */
    function updateAuthorizedBackend(address newBackend) external onlyOwner {
        require(newBackend != address(0), "Invalid backend");
        
        address oldBackend = authorizedBackend;
        authorizedBackend = newBackend;
        
        emit BackendUpdated(oldBackend, newBackend);
    }
    
    // ========================
    // VERIFICACIÓN DE ATTESTATION
    // ========================
    
    /**
     * @dev Verificar attestation del backend - SOLO esto importa
     */
    function _verifyAttestation(BackendAttestation memory attestation) internal returns (bool) {
        // Verificar nonce secuencial (prevenir replay)
        if (attestation.nonce != lastNonce + 1) revert ReplayAttack();
        
        // Verificar timestamp no muy antiguo (máximo 10 minutos)
        if (block.timestamp > attestation.timestamp + 600) revert StaleAttestation();
        
        // Construir mensaje para verificar firma
        bytes32 messageHash = keccak256(abi.encodePacked(
            attestation.operation,
            attestation.dataHash,
            attestation.nonce,
            attestation.timestamp
        ));
        
        // Verificar firma ECDSA del backend
        bool validSignature = _verifyECDSASignature(messageHash, attestation.signature, authorizedBackend);
        
        if (!validSignature) revert UnauthorizedBackend();
        
        // Actualizar nonce SOLO si todo es válido
        lastNonce = attestation.nonce;
        
        return true;
    }
    
    /**
     * @dev Verificar firma ECDSA (versión state-changing)
     */
    function _verifyECDSASignature(
        bytes32 messageHash,
        bytes memory signature,
        address expectedSigner
    ) internal pure returns (bool) {
        if (signature.length != 65) return false;
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        
        if (v < 27) v += 27;
        
        address recoveredAddress = ecrecover(
            keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)),
            v,
            r,
            s
        );
        
        return recoveredAddress == expectedSigner;
    }
    
    // ========================
    // DEPÓSITO
    // ========================
    
    /**
     * @dev Depositar - Versión simplificada con validación mejorada
     */
    function depositAsPrivateUTXO(
        DepositParams calldata params
    ) external nonReentrant whenNotPaused {
        // Usar validación externa para consistencia
        (bool isValid, string memory errorMessage) = this.validateDepositParams(params, msg.sender);
        
        if (!isValid) {
            // Mapeo simplificado de errores basado en el mensaje
            _revertWithAppropriateError(errorMessage);
        }
        
        // Actualizar nonce (CRÍTICO: Solo aquí, no en el getter)
        lastNonce = params.attestation.nonce;
        
        // Registrar token si es necesario
        _registerToken(params.tokenAddress);
        
        // Transferir tokens
        IERC20(params.tokenAddress).transferFrom(msg.sender, address(this), params.amount);
        
        // Crear UTXO
        bytes32 utxoId = _createUTXO(
            params.commitment,
            params.tokenAddress,
            params.nullifierHash,
            UTXOType.DEPOSIT,
            bytes32(0)
        );
        
        // NUEVO: Almacenar la attestation
        _storeAttestation(utxoId, params.attestation, msg.sender);
    }
    
    /**
     * @dev Mapear mensaje de error a custom error apropiado
     */
    function _revertWithAppropriateError(string memory errorMessage) internal pure {
        bytes32 errorHash = keccak256(bytes(errorMessage));
        
        if (errorHash == keccak256("InvalidToken")) {
            revert InvalidToken();
        } else if (errorHash == keccak256("InvalidAmount")) {
            revert InvalidAmount();
        } else if (errorHash == keccak256("NullifierAlreadyUsed")) {
            revert NullifierAlreadyUsed();
        } else if (errorHash == keccak256("UnauthorizedBackend")) {
            revert UnauthorizedBackend();
        } else if (errorHash == keccak256("InvalidNonce")) {
            revert ReplayAttack();
        } else if (errorHash == keccak256("StaleAttestation")) {
            revert StaleAttestation();
        } else {
            // Para cualquier otro error de validación
            revert InvalidAttestation();
        }
    }
    
    // ========================
    // SPLIT
    // ========================
    
    /**
     * @dev Split - Backend ya verificó conservación de valor
     */
    function splitPrivateUTXO(
        SplitParams calldata params
    ) external nonReentrant whenNotPaused returns (bytes32[] memory) {
        
        // Pre-validación PRIMERO para coherencia con frontend
        bytes32 inputCommitmentHash = _hashCommitment(params.inputCommitment);
        bytes32[] memory outputCommitmentHashes = new bytes32[](params.outputCommitments.length);
        for (uint256 i = 0; i < params.outputCommitments.length; i++) {
            outputCommitmentHashes[i] = _hashCommitment(params.outputCommitments[i]);
        }
        
        // Validar usando preValidateSplit (coherencia con frontend)
        (bool isValid, uint8 errorCode) = preValidateSplit(
            inputCommitmentHash,
            outputCommitmentHashes,
            params.inputNullifier
        );

        if (!isValid) {
            // Mapear errorCode a custom errors apropiados
            _revertWithSplitError(errorCode);
        }
        
        // Verificar nullifiers únicos en outputs (no incluido en preValidateSplit)
        for (uint256 i = 0; i < params.outputNullifiers.length; i++) {
            _validateBasicNullifiers(params.outputNullifiers[i]);
        }
        
        // Verificar attestation del backend
        if (!_verifyAttestation(params.attestation)) revert InvalidAttestation();
        
        if (keccak256(bytes(params.attestation.operation)) != keccak256("SPLIT")) {
            revert InvalidAttestation();
        }
        
        // Verificar dataHash
        bytes32 expectedDataHash = calculateSplitDataHash(params, msg.sender);
        if (params.attestation.dataHash != expectedDataHash) revert InvalidAttestation();
        
        // Ejecutar split (preValidateSplit ya verificó que el UTXO existe)
        bytes32 inputUTXOId = commitmentHashToUTXO[inputCommitmentHash];
        return _executeSplit(inputUTXOId, params);
    }

    /**
     * @dev Versión memory de preValidateSplit para uso interno
     */
    function _preValidateSplitMemory(
        bytes32 sourceCommitment,
        bytes32[] memory outputCommitments,
        bytes32 sourceNullifier
    ) internal view returns (bool isValid, uint8 errorCode) {
        
        // 1. Verificar que UTXO source existe y no está gastado
        bytes32 utxoId = commitmentHashToUTXO[sourceCommitment];
        if (utxoId == bytes32(0) || !utxos[utxoId].exists) {
            return (false, 1); // UTXO no existe
        }
        if (utxos[utxoId].isSpent) {
            return (false, 2); // UTXO ya gastado
        }

        // 2. Verificar que hay outputs
        if (outputCommitments.length == 0) {
            return (false, 3); // No hay outputs
        }

        // 3. Verificar que commitments no están vacíos
        for (uint256 i = 0; i < outputCommitments.length; i++) {
            if (outputCommitments[i] == bytes32(0)) {
                return (false, 4); // Commitment vacío
            }
        }

        // 4. Verificar nullifier correcto
        if (sourceNullifier == bytes32(0)) {
            return (false, 6); // Nullifier inválido
        }

        // 5. Verificar que nullifier no ha sido usado
        if (nullifiers[sourceNullifier]) {
            return (false, 7); // Nullifier ya usado
        }

        return (true, 0);
    }

    /**
     * @dev Mapear código de error de preValidateSplit a custom error
     */
    function _revertWithSplitError(uint8 errorCode) internal pure {
        if (errorCode == 1) {
            revert UTXONotFound();
        } else if (errorCode == 2) {
            revert UTXOAlreadySpent();
        } else if (errorCode == 3) {
            revert InvalidArrayLength(); // No hay outputs
        } else if (errorCode == 4) {
            revert InvalidAttestation(); // Commitment vacío
        } else if (errorCode == 6) {
            revert InvalidAttestation(); // Nullifier inválido
        } else if (errorCode == 7) {
            revert NullifierAlreadyUsed(); // Nullifier ya usado
        } else {
            revert InvalidAttestation();
        }
    }
    
    /**
     * @dev Ejecutar split
     */
    function _executeSplit(
        bytes32 inputUTXOId,
        SplitParams calldata params
    ) internal returns (bytes32[] memory) {
        // Marcar input como gastado
        utxos[inputUTXOId].isSpent = true;
        nullifiers[params.inputNullifier] = true;
        
        // Crear outputs
        bytes32[] memory outputUTXOIds = new bytes32[](params.outputCommitments.length);
        address tokenAddress = utxos[inputUTXOId].tokenAddress;
        
        for (uint256 i = 0; i < params.outputCommitments.length; i++) {
            outputUTXOIds[i] = _createUTXO(
                params.outputCommitments[i],
                tokenAddress,
                params.outputNullifiers[i],
                UTXOType.SPLIT,
                inputUTXOId
            );
            
            // NUEVO: Almacenar attestation para cada UTXO de salida
            _storeAttestation(outputUTXOIds[i], params.attestation, msg.sender);
        }
        
        // Preparar evento
        bytes32[] memory outputHashes = new bytes32[](params.outputCommitments.length);
        for (uint256 i = 0; i < params.outputCommitments.length; i++) {
            outputHashes[i] = _hashCommitment(params.outputCommitments[i]);
        }
        
        emit PrivateSplit(
            _hashCommitment(params.inputCommitment),
            outputHashes,
            params.inputNullifier,
            params.outputNullifiers,
            block.timestamp
        );
        
        return outputUTXOIds;
    }
    
    // ========================
    // TRANSFERENCIA
    // ========================
    
    /**
     * @dev Transferir - Backend ya verificó ownership
     */
    function transferPrivateUTXO(
        TransferParams calldata params
    ) external nonReentrant whenNotPaused returns (bytes32) {
        // Validaciones básicas usando funciones comunes
        _validateBasicNullifiers(params.inputNullifier);
        _validateBasicNullifiers(params.outputNullifier);
        
        // Verificar input UTXO existe usando función común
        bytes32 inputCommitmentHash = _hashCommitment(params.inputCommitment);
        bytes32 inputUTXOId = _validateUTXOExists(inputCommitmentHash);
        
        // Verificar attestation del backend
        if (!_verifyAttestation(params.attestation)) revert InvalidAttestation();
        
        if (keccak256(bytes(params.attestation.operation)) != keccak256("TRANSFER")) {
            revert InvalidAttestation();
        }
        
        // Verificar dataHash
        bytes32 expectedDataHash = calculateTransferDataHash(params, msg.sender);
        if (params.attestation.dataHash != expectedDataHash) revert InvalidAttestation();
        
        // Ejecutar transferencia
        return _executeTransfer(inputUTXOId, params);
    }
    
    /**
     * @dev Ejecutar transferencia
     */
    function _executeTransfer(
        bytes32 inputUTXOId,
        TransferParams calldata params
    ) internal returns (bytes32) {
        // Marcar input como gastado
        utxos[inputUTXOId].isSpent = true;
        nullifiers[params.inputNullifier] = true;
        
        // Crear output UTXO
        bytes32 outputUTXOId = _createUTXO(
            params.outputCommitment,
            utxos[inputUTXOId].tokenAddress,
            params.outputNullifier,
            UTXOType.TRANSFER,
            inputUTXOId
        );
        
        // NUEVO: Almacenar la attestation
        _storeAttestation(outputUTXOId, params.attestation, msg.sender);
        
        emit PrivateTransfer(
            _hashCommitment(params.inputCommitment),
            _hashCommitment(params.outputCommitment),
            params.inputNullifier,
            params.outputNullifier,
            block.timestamp
        );
        
        return outputUTXOId;
    }
    
    // ========================
    // RETIRO
    // ========================
    
    /**
     * @dev Retirar - Backend ya verificó que commitment corresponde a revealedAmount
     */
      function withdrawFromPrivateUTXO(
        WithdrawParams calldata params
    ) external nonReentrant whenNotPaused {
        // Validaciones básicas usando funciones comunes
        _validateBasicNullifiers(params.nullifierHash);
        if (params.revealedAmount == 0) revert InvalidAmount();
        
        // Verificar UTXO existe usando función común
        bytes32 commitmentHash = _hashCommitment(params.commitment);
        bytes32 utxoId = _validateUTXOExists(commitmentHash);
        
        // Pre-validación para coherencia con frontend
        (bool isValid, uint8 errorCode) = preValidateWithdraw(
            commitmentHash,           // sourceCommitment
            params.nullifierHash,     // sourceNullifier  
            params.revealedAmount,    // amount
            msg.sender                // recipient ← Siempre quien ejecuta
        );

        if (!isValid) {
            // Mapear errorCode a custom errors apropiados
            _revertWithWithdrawError(errorCode);
        }
        
        // Verificar attestation del backend
        if (!_verifyAttestation(params.attestation)) revert InvalidAttestation();
        
        if (keccak256(bytes(params.attestation.operation)) != keccak256("WITHDRAW")) {
            revert InvalidAttestation();
        }
        
        // Verificar dataHash
        bytes32 expectedDataHash = calculateWithdrawDataHash(params, msg.sender);
        if (params.attestation.dataHash != expectedDataHash) revert InvalidAttestation();
        
        // Ejecutar retiro
        _executeWithdrawal(utxoId, params);
    }

        /**
     * @dev Mapear código de error de preValidateWithdraw a custom error
     */
    function _revertWithWithdrawError(uint8 errorCode) internal pure {
        if (errorCode == 1) {
            revert UTXONotFound();
        } else if (errorCode == 2) {
            revert UTXOAlreadySpent();
        } else if (errorCode == 3) {
            revert InvalidAmount(); // Amount es 0
        } else if (errorCode == 4) {
            revert InvalidAttestation(); // Commitment inválido
        } else if (errorCode == 5) {
            revert InvalidAttestation(); // Nullifier inválido
        } else if (errorCode == 6) {
            revert NullifierAlreadyUsed(); // Nullifier ya usado
        } else {
            revert InvalidAttestation();
        }
    }
    
    /**
     * @dev Ejecutar retiro
     */
    function _executeWithdrawal(
        bytes32 utxoId,
        WithdrawParams calldata params
    ) internal {
        // Marcar como gastado
        utxos[utxoId].isSpent = true;
        nullifiers[params.nullifierHash] = true;
        
        // NUEVO: Almacenar la attestation del withdraw
        _storeAttestation(utxoId, params.attestation, msg.sender);
        
        // Transferir tokens
        address tokenAddress = utxos[utxoId].tokenAddress;
        IERC20(tokenAddress).transfer(msg.sender, params.revealedAmount);
  
        emit PrivateWithdrawal(
            _hashCommitment(params.commitment),
            params.nullifierHash,
            msg.sender,
            params.revealedAmount,
            block.timestamp
        );
    }
    
    // ========================
    // FUNCIONES AUXILIARES INTERNAS
    // ========================
    
    /**
     * @dev Validación común de nullifiers para todas las operaciones
     * @param nullifierHash El nullifier a verificar
     * @notice Revierte si el nullifier ya ha sido usado
     */
    function _validateBasicNullifiers(bytes32 nullifierHash) internal view {
        if (nullifiers[nullifierHash]) revert NullifierAlreadyUsed();
    }
    
    /**
     * @dev Validación común de UTXO existence
     * @param commitmentHash El hash del commitment a verificar
     * @return utxoId El ID del UTXO si existe y no está gastado
     * @notice Revierte si el UTXO no existe o ya está gastado
     */
    function _validateUTXOExists(bytes32 commitmentHash) internal view returns (bytes32 utxoId) {
        utxoId = commitmentHashToUTXO[commitmentHash];
        if (utxoId == bytes32(0)) revert UTXONotFound();
        if (utxos[utxoId].isSpent) revert UTXOAlreadySpent();
        return utxoId;
    }
    
    /**
     * @dev Crear UTXO
     */
    function _createUTXO(
        CommitmentPoint memory commitment,
        address tokenAddress,
        bytes32 nullifierHash,
        UTXOType utxoType,
        bytes32 parentUTXO
    ) internal returns (bytes32) {
        // Generar ID único
        bytes32 utxoId = keccak256(abi.encodePacked(
            nextUTXOId++,
            nullifierHash,
            block.timestamp,
            blockhash(block.number - 1)
        ));
        
        // Hash del commitment
        bytes32 commitmentHash = _hashCommitment(commitment);
        
        // Crear UTXO
        utxos[utxoId] = PrivateUTXO({
            exists: true,
            commitmentHash: commitmentHash,
            tokenAddress: tokenAddress,
            timestamp: block.timestamp,
            isSpent: false,
            parentUTXO: parentUTXO,
            utxoType: utxoType,
            blockNumber: block.number
        });
        
        // Actualizar mappings
        commitmentHashToUTXO[commitmentHash] = utxoId;

        
        // Tracking de usuarios para recuperación eficiente
        address user = msg.sender;
        userUTXOs[user].push(commitmentHash);
        userUTXOCount[user]++;
        utxoToUser[commitmentHash] = user;
        
        emit PrivateUTXOCreated(
            utxoId,
            commitmentHash,
            tokenAddress,
            nullifierHash,
            utxoType,
            block.timestamp
        );
        
        return utxoId;
    }
    
    /**
     * @dev Registrar token
     */
    function _registerToken(address tokenAddress) internal {
        if (!registeredTokens[tokenAddress]) {
            registeredTokens[tokenAddress] = true;
            allRegisteredTokens.push(tokenAddress);
            
            emit TokenRegistered(tokenAddress, block.timestamp);
        }
    }
    
    // ========================
    // FUNCIONES DE EMERGENCIA
    // ========================
    
    /**
     * @dev Pausar/despausar operaciones en caso de emergencia
     */
    bool public emergencyPaused = false;
    
    modifier whenNotPaused() {
        require(!emergencyPaused, "Contract is paused");
        _;
    }
    
    function setEmergencyPause(bool paused) external onlyOwner {
        emergencyPaused = paused;
    }
    
    /**
     * @dev Recuperar tokens en caso de emergencia (solo owner)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(emergencyPaused, "Must be paused for emergency withdrawal");
        IERC20(token).transfer(owner(), amount);
    }
    
    // ========================
    // FUNCIONES DE UTILIDAD ADICIONALES
    // ========================
    
    /**
     * @dev Obtener estadísticas generales del contrato
     */
    function getContractStats() external view returns (
        uint256 totalUTXOs,
        uint256 totalTokens,
        uint256 currentNonce,
        address backend,
        bool isPaused
    ) {
        return (
            nextUTXOId - 1,
            allRegisteredTokens.length,
            lastNonce,
            authorizedBackend,
            emergencyPaused
        );
    }
    
    /**
     * @dev Verificar balance total de un token en el contrato
     */
    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}