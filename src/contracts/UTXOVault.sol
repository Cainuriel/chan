// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./verifiers/RealPedersenVerifier.sol";

/**
 * @title UTXOVault - Private UTXO System with Full Backend Delegation
 * @notice Backend (Zenroom) hace TODA la criptografía, Solidity solo mantiene estado
 * @dev Confianza total en backend autorizado para todas las verificaciones complejas
 */
contract UTXOVault is ReentrancyGuard, Ownable {
    
    // ========================
    // ESTRUCTURAS SIMPLIFICADAS
    // ========================
    
    struct CommitmentPoint {
        uint256 x;
        uint256 y;
    }
    
    /**
     * @dev UTXO completamente privado - solo metadatos
     */
    struct PrivateUTXO {
        bool exists;
        bytes32 commitmentHash;       // Hash del commitment
        address tokenAddress;         // Token address
        uint256 timestamp;           // Timestamp
        bool isSpent;               // Estado
        bytes32 parentUTXO;         // Parent UTXO
        UTXOType utxoType;          // Tipo
        uint256 blockNumber;        // Block number
    }
    
    /**
     * @dev Attestation simple del backend - Zenroom verificó TODO
     */
    struct BackendAttestation {
        string operation;            // Tipo de operación ("DEPOSIT", "SPLIT", etc.)
        bytes32 dataHash;           // Hash de todos los datos relevantes
        uint256 nonce;              // Nonce único
        uint256 timestamp;          // Timestamp de la attestation
        bytes signature;            // Firma del backend autorizado
    }
    
    /**
     * @dev Parámetros para depósito - Backend verificó TODO
     */
    struct DepositParams {
        address tokenAddress;
        CommitmentPoint commitment;
        bytes32 nullifierHash;
        uint256 amount;             // Amount verificado por backend
        BackendAttestation attestation;  // Backend dice: "Todo está correcto"
    }
    
    /**
     * @dev Parámetros para split - Backend verificó TODO
     */
    struct SplitParams {
        CommitmentPoint inputCommitment;
        CommitmentPoint[] outputCommitments;
        bytes32 inputNullifier;
        bytes32[] outputNullifiers;
        BackendAttestation attestation;  // Backend dice: "Conservación de valor OK"
    }
    
    /**
     * @dev Parámetros para transferencia - Backend verificó TODO
     */
    struct TransferParams {
        CommitmentPoint inputCommitment;
        CommitmentPoint outputCommitment;
        bytes32 inputNullifier;
        bytes32 outputNullifier;
        BackendAttestation attestation;  // Backend dice: "Ownership y transfer OK"
    }
    
    /**
     * @dev Parámetros para retiro - Backend verificó TODO
     */
    struct WithdrawParams {
        CommitmentPoint commitment;
        bytes32 nullifierHash;
        uint256 revealedAmount;     // Amount verificado por backend
        BackendAttestation attestation;  // Backend dice: "Ownership y amount OK"
    }
    
    enum UTXOType { DEPOSIT, SPLIT, TRANSFER, WITHDRAW }
    
    // ========================
    // STORAGE MÍNIMO
    // ========================
    
    // UTXOs (solo metadatos)
    mapping(bytes32 => PrivateUTXO) private utxos;
    
    // Nullifier tracking
    mapping(bytes32 => bool) private nullifiers;
    
    // Commitment tracking
    mapping(bytes32 => bytes32) private commitmentHashToUTXO;
    
    // Token registry
    mapping(address => bool) public registeredTokens;
    address[] public allRegisteredTokens;
    
    // Backend autorizado
    address public authorizedBackend;
    
    // UTXO counter
    uint256 private nextUTXOId;
    
    // Nonce para prevenir replay
    uint256 public lastNonce;
    
    // ========================
    // EVENTOS
    // ========================
    
    event BackendUpdated(address indexed oldBackend, address indexed newBackend);
    
    event TokenRegistered(address indexed tokenAddress, uint256 timestamp);
    
    event PrivateUTXOCreated(
        bytes32 indexed utxoId,
        bytes32 indexed commitmentHash,
        address indexed tokenAddress,
        bytes32 nullifierHash,
        UTXOType utxoType,
        uint256 timestamp
    );
    
    event PrivateTransfer(
        bytes32 indexed inputCommitmentHash,
        bytes32 indexed outputCommitmentHash,
        bytes32 inputNullifier,
        bytes32 outputNullifier,
        uint256 timestamp
    );
    
    event PrivateSplit(
        bytes32 indexed inputCommitmentHash,
        bytes32[] outputCommitmentHashes,
        bytes32 inputNullifier,
        bytes32[] outputNullifiers,
        uint256 timestamp
    );
    
    event PrivateWithdrawal(
        bytes32 indexed commitmentHash,
        bytes32 nullifier,
        address indexed recipient,
        uint256 revealedAmount,
        uint256 timestamp
    );
    
    // ========================
    // ERRORES
    // ========================
    
    error InvalidToken();
    error InvalidAmount();
    error InvalidNullifier();
    error NullifierAlreadyUsed();
    error UTXONotFound();
    error UTXOAlreadySpent();
    error UnauthorizedBackend();
    error InvalidAttestation();
    error StaleAttestation();
    error ReplayAttack();
    
    // ========================
    // CONSTRUCTOR
    // ========================
    
    constructor(address _authorizedBackend) Ownable(msg.sender) {
        authorizedBackend = _authorizedBackend;
        nextUTXOId = 1;
        lastNonce = 0;
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
    // VERIFICACIÓN SIMPLIFICADA DE ATTESTATION
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
     * @dev Verificar firma ECDSA
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
    // DEPÓSITO - BACKEND VERIFICÓ TODO
    // ========================
    
    /**
     * @dev Depositar - Backend ya verificó que commitment corresponde a amount
     */
    function depositAsPrivateUTXO(
        DepositParams calldata params
    ) external nonReentrant {
        // Solo validaciones básicas de Solidity
        if (params.tokenAddress == address(0)) revert InvalidToken();
        if (params.amount == 0) revert InvalidAmount();
        if (nullifiers[params.nullifierHash]) revert NullifierAlreadyUsed();
        
        // Verificar que backend autorizó esta operación
        if (!_verifyAttestation(params.attestation)) revert InvalidAttestation();
        
        // Verificar que la operación es del tipo correcto
        if (keccak256(bytes(params.attestation.operation)) != keccak256("DEPOSIT")) revert InvalidAttestation();
        
        // Verificar que el dataHash incluye todos nuestros parámetros
        bytes32 expectedDataHash = keccak256(abi.encodePacked(
            params.tokenAddress,
            params.commitment.x,
            params.commitment.y,
            params.nullifierHash,
            params.amount,
            msg.sender
        ));
        
        if (params.attestation.dataHash != expectedDataHash) revert InvalidAttestation();
        
        // Si backend dice OK, confiamos completamente
        _registerToken(params.tokenAddress);
        
        // Transferir tokens
        IERC20(params.tokenAddress).transferFrom(msg.sender, address(this), params.amount);
        
        // Crear UTXO
        _createUTXO(
            params.commitment,
            params.tokenAddress,
            params.nullifierHash,
            UTXOType.DEPOSIT,
            bytes32(0)
        );
    }
    
    // ========================
    // SPLIT - BACKEND VERIFICÓ TODO
    // ========================
    
    /**
     * @dev Split - Backend ya verificó conservación de valor
     */
    function splitPrivateUTXO(
        SplitParams calldata params
    ) external nonReentrant returns (bytes32[] memory) {
        // Solo validaciones básicas
        if (nullifiers[params.inputNullifier]) revert NullifierAlreadyUsed();
        if (params.outputCommitments.length == 0) revert InvalidAttestation();
        if (params.outputCommitments.length != params.outputNullifiers.length) revert InvalidAttestation();
        
        // Verificar nullifiers únicos
        for (uint256 i = 0; i < params.outputNullifiers.length; i++) {
            if (nullifiers[params.outputNullifiers[i]]) revert NullifierAlreadyUsed();
        }
        
        // Verificar que input UTXO existe
        bytes32 inputCommitmentHash = _hashCommitment(params.inputCommitment);
        bytes32 inputUTXOId = commitmentHashToUTXO[inputCommitmentHash];
        if (inputUTXOId == bytes32(0)) revert UTXONotFound();
        if (utxos[inputUTXOId].isSpent) revert UTXOAlreadySpent();
        
        // Verificar attestation del backend
        if (!_verifyAttestation(params.attestation)) revert InvalidAttestation();
        
        if (keccak256(bytes(params.attestation.operation)) != keccak256("SPLIT")) revert InvalidAttestation();
        
        // Construir dataHash esperado
        bytes memory commitmentData = abi.encodePacked(
            params.inputCommitment.x,
            params.inputCommitment.y,
            params.inputNullifier
        );
        
        for (uint256 i = 0; i < params.outputCommitments.length; i++) {
            commitmentData = abi.encodePacked(
                commitmentData,
                params.outputCommitments[i].x,
                params.outputCommitments[i].y,
                params.outputNullifiers[i]
            );
        }
        
        bytes32 expectedDataHash = keccak256(abi.encodePacked(
            commitmentData,
            msg.sender
        ));
        
        if (params.attestation.dataHash != expectedDataHash) revert InvalidAttestation();
        
        // Si backend dice OK, ejecutar split
        return _executeSplit(inputUTXOId, params);
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
        }
        
        // Emitir evento
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
    // TRANSFERENCIA - BACKEND VERIFICÓ TODO
    // ========================
    
    /**
     * @dev Transferir - Backend ya verificó ownership
     */
    function transferPrivateUTXO(
        TransferParams calldata params
    ) external nonReentrant returns (bytes32) {
        // Solo validaciones básicas
        if (nullifiers[params.inputNullifier]) revert NullifierAlreadyUsed();
        if (nullifiers[params.outputNullifier]) revert NullifierAlreadyUsed();
        
        // Verificar input UTXO existe
        bytes32 inputCommitmentHash = _hashCommitment(params.inputCommitment);
        bytes32 inputUTXOId = commitmentHashToUTXO[inputCommitmentHash];
        if (inputUTXOId == bytes32(0)) revert UTXONotFound();
        if (utxos[inputUTXOId].isSpent) revert UTXOAlreadySpent();
        
        // Verificar attestation del backend
        if (!_verifyAttestation(params.attestation)) revert InvalidAttestation();
        
        if (keccak256(bytes(params.attestation.operation)) != keccak256("TRANSFER")) revert InvalidAttestation();
        
        bytes32 expectedDataHash = keccak256(abi.encodePacked(
            params.inputCommitment.x,
            params.inputCommitment.y,
            params.inputNullifier,
            params.outputCommitment.x,
            params.outputCommitment.y,
            params.outputNullifier,
            msg.sender
        ));
        
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
        
        // Emitir evento
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
    // RETIRO - BACKEND VERIFICÓ TODO
    // ========================
    
    /**
     * @dev Retirar - Backend ya verificó que commitment corresponde a revealedAmount
     */
    function withdrawFromPrivateUTXO(
        WithdrawParams calldata params
    ) external nonReentrant {
        // Solo validaciones básicas
        if (nullifiers[params.nullifierHash]) revert NullifierAlreadyUsed();
        if (params.revealedAmount == 0) revert InvalidAmount();
        
        // Verificar UTXO existe
        bytes32 commitmentHash = _hashCommitment(params.commitment);
        bytes32 utxoId = commitmentHashToUTXO[commitmentHash];
        if (utxoId == bytes32(0)) revert UTXONotFound();
        if (utxos[utxoId].isSpent) revert UTXOAlreadySpent();
        
        // Verificar attestation del backend
        if (!_verifyAttestation(params.attestation)) revert InvalidAttestation();
        
        if (keccak256(bytes(params.attestation.operation)) != keccak256("WITHDRAW")) revert InvalidAttestation();
        
        bytes32 expectedDataHash = keccak256(abi.encodePacked(
            params.commitment.x,
            params.commitment.y,
            params.nullifierHash,
            params.revealedAmount,
            msg.sender
        ));
        
        if (params.attestation.dataHash != expectedDataHash) revert InvalidAttestation();
        
        // Ejecutar retiro
        _executeWithdrawal(utxoId, params);
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
        
        // Transferir tokens
        address tokenAddress = utxos[utxoId].tokenAddress;
        IERC20(tokenAddress).transfer(msg.sender, params.revealedAmount);
        
        // Emitir evento
        emit PrivateWithdrawal(
            _hashCommitment(params.commitment),
            params.nullifierHash,
            msg.sender,
            params.revealedAmount,
            block.timestamp
        );
    }
    
    // ========================
    // FUNCIONES AUXILIARES SIMPLES
    // ========================
    
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
            block.timestamp
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
        nullifiers[nullifierHash] = true;
        
        // Emitir evento
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
     * @dev Hash de commitment
     */
    function _hashCommitment(CommitmentPoint memory commitment) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(commitment.x, commitment.y));
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
    // FUNCIONES DE CONSULTA
    // ========================
    
    function getRegisteredTokens() external view returns (address[] memory) {
        return allRegisteredTokens;
    }
    
    function isTokenRegistered(address tokenAddress) external view returns (bool) {
        return registeredTokens[tokenAddress];
    }
    
    function isNullifierUsed(bytes32 nullifier) external view returns (bool) {
        return nullifiers[nullifier];
    }
    
    function getUTXOInfo(bytes32 utxoId) external view returns (
        bool exists,
        bytes32 commitmentHash,
        address tokenAddress,
        uint256 timestamp,
        bool isSpent,
        bytes32 parentUTXO,
        UTXOType utxoType,
        uint256 blockNumber
    ) {
        PrivateUTXO storage utxo = utxos[utxoId];
        return (
            utxo.exists,
            utxo.commitmentHash,
            utxo.tokenAddress,
            utxo.timestamp,
            utxo.isSpent,
            utxo.parentUTXO,
            utxo.utxoType,
            utxo.blockNumber
        );
    }
    
    function doesCommitmentExist(CommitmentPoint calldata commitment) external view returns (bool) {
        bytes32 commitmentHash = _hashCommitment(commitment);
        bytes32 utxoId = commitmentHashToUTXO[commitmentHash];
        return utxoId != bytes32(0) && utxos[utxoId].exists;
    }
    
    function getUTXOByCommitment(CommitmentPoint calldata commitment) external view returns (bytes32) {
        bytes32 commitmentHash = _hashCommitment(commitment);
        return commitmentHashToUTXO[commitmentHash];
    }
    
    function getCurrentNonce() external view returns (uint256) {
        return lastNonce;
    }
}