// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title UTXOVaultBase - Base contract with structures and view functions
 * @notice Contains all structs, enums, events, errors and view functions
 * @dev Base contract to be inherited by the main implementation
 */
abstract contract UTXOVaultBase is Ownable {
    
    // ========================
    // ESTRUCTURAS Y ENUMS
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
    
    /**
     * @dev Struct para devolver detalles de UTXO sin stack too deep
     */
    struct UTXODetails {
        bool exists;
        address tokenAddress;
        uint256 timestamp;
        bool isSpent;
        bytes32 parentUTXO;
        UTXOType utxoType;
        uint256 blockNumber;
        address owner;
    }
    
    /**
     * @dev Resultado de validación pre-transacción
     */
    struct ValidationResult {
        bool isValid;
        uint8 errorCode;
        string errorMessage;
    }
    
    // ========================
    // STORAGE DECLARATIONS
    // ========================
    
    // UTXOs (solo metadatos)
    mapping(bytes32 => PrivateUTXO) internal utxos;
    
    // Mapeos de usuarios para recuperación eficiente
    mapping(address => bytes32[]) internal userUTXOs;        // user -> array de commitments
    mapping(address => uint256) internal userUTXOCount;      // user -> cantidad total de UTXOs
    mapping(bytes32 => address) internal utxoToUser;         // commitment -> user owner
    
    // Nullifier tracking  
    mapping(bytes32 => bool) internal nullifiers;
    
    // Commitment tracking
    mapping(bytes32 => bytes32) internal commitmentHashToUTXO;
    
    // Token registry
    mapping(address => bool) public registeredTokens;
    address[] public allRegisteredTokens;
    
    // Backend autorizado
    address public authorizedBackend;
    
    // UTXO counter
    uint256 internal nextUTXOId;
    
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
    error InvalidArrayLength();
    error InvalidCommitment();
    
    // ========================
    // CONSTRUCTOR
    // ========================
    
    constructor(address _authorizedBackend) Ownable(msg.sender) {
        require(_authorizedBackend != address(0), "Invalid backend");
        authorizedBackend = _authorizedBackend;
        nextUTXOId = 1;
        lastNonce = 0;
    }
    
    // ========================
    // FUNCIONES VIEW - CONSULTAS BÁSICAS
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
    
    function getCurrentNonce() external view returns (uint256) {
        return lastNonce;
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
    
    // ========================
    // FUNCIONES VIEW - CONSULTAS DE USUARIOS
    // ========================
    
    /**
     * @notice Obtiene TODOS los UTXOs de un usuario (gastados y no gastados)
     */
    function getUserUTXOs(address user) external view returns (
        bytes32[] memory commitments,
        bool[] memory spentStatus,
        address[] memory tokens,
        uint256[] memory timestamps
    ) {
        bytes32[] storage userCommitments = userUTXOs[user];
        uint256 length = userCommitments.length;
        
        commitments = new bytes32[](length);
        spentStatus = new bool[](length);
        tokens = new address[](length);
        timestamps = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            bytes32 commitmentHash = userCommitments[i];
            bytes32 utxoId = commitmentHashToUTXO[commitmentHash];
            PrivateUTXO storage utxo = utxos[utxoId];
            
            commitments[i] = commitmentHash;
            spentStatus[i] = utxo.isSpent;
            tokens[i] = utxo.tokenAddress;
            timestamps[i] = utxo.timestamp;
        }
    }
    
    /**
     * @notice Obtiene solo UTXOs NO GASTADOS de un usuario
     */
    function getUserUnspentUTXOs(address user) external view returns (
        bytes32[] memory commitments,
        address[] memory tokens,
        uint256[] memory timestamps
    ) {
        bytes32[] storage userCommitments = userUTXOs[user];
        
        // Contar no gastados primero
        uint256 unspentCount = 0;
        for (uint256 i = 0; i < userCommitments.length; i++) {
            bytes32 utxoId = commitmentHashToUTXO[userCommitments[i]];
            if (!utxos[utxoId].isSpent) {
                unspentCount++;
            }
        }
        
        // Crear arrays del tamaño correcto
        commitments = new bytes32[](unspentCount);
        tokens = new address[](unspentCount);
        timestamps = new uint256[](unspentCount);
        
        uint256 resultIndex = 0;
        for (uint256 i = 0; i < userCommitments.length; i++) {
            bytes32 commitmentHash = userCommitments[i];
            bytes32 utxoId = commitmentHashToUTXO[commitmentHash];
            PrivateUTXO storage utxo = utxos[utxoId];
            
            if (!utxo.isSpent) {
                commitments[resultIndex] = commitmentHash;
                tokens[resultIndex] = utxo.tokenAddress;
                timestamps[resultIndex] = utxo.timestamp;
                resultIndex++;
            }
        }
    }
    
    function getUserUTXOCount(address user) external view returns (uint256) {
        return userUTXOCount[user];
    }
    
    function isUserUTXO(address user, bytes32 commitmentHash) external view returns (bool) {
        return utxoToUser[commitmentHash] == user;
    }
    
    function getUTXOOwner(bytes32 commitmentHash) external view returns (address) {
        return utxoToUser[commitmentHash];
    }
    
    function getUTXODetails(bytes32 commitmentHash) external view returns (UTXODetails memory details) {
        bytes32 utxoId = commitmentHashToUTXO[commitmentHash];
        PrivateUTXO storage utxo = utxos[utxoId];
        
        details = UTXODetails({
            exists: utxo.exists,
            tokenAddress: utxo.tokenAddress,
            timestamp: utxo.timestamp,
            isSpent: utxo.isSpent,
            parentUTXO: utxo.parentUTXO,
            utxoType: utxo.utxoType,
            blockNumber: utxo.blockNumber,
            owner: utxoToUser[commitmentHash]
        });
        
        return details;
    }
    
    // ========================
    // FUNCIONES DE VALIDACIÓN PRE-TRANSACCIÓN
    // ========================
    
    /**
     * @notice Valida parámetros de split SIN gastar gas
     */
    function preValidateSplit(
        bytes32 sourceCommitment,
        bytes32[] memory outputCommitments,
        bytes32 sourceNullifier
    ) public view returns (bool isValid, uint8 errorCode) {
        
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
     * @notice Valida parámetros de transfer SIN gastar gas
     */
    function preValidateTransfer(
        bytes32 sourceCommitment,
        bytes32 sourceNullifier,
        bytes32 outputCommitment
    ) public view returns (bool isValid, uint8 errorCode) {
        
        // 1. Verificar source existe y no está gastado
        bytes32 utxoId = commitmentHashToUTXO[sourceCommitment];
        if (utxoId == bytes32(0) || !utxos[utxoId].exists) {
            return (false, 2); // UTXO no existe
        }
        if (utxos[utxoId].isSpent) {
            return (false, 3); // UTXO ya gastado
        }

        // 2. Verificar nullifier no vacío
        if (sourceNullifier == bytes32(0)) {
            return (false, 4); // Nullifier inválido
        }
        
        // 3. Verificar que nullifier no ha sido usado
        if (nullifiers[sourceNullifier]) {
            return (false, 8); // Nullifier ya usado
        }

        // 4. Verificar output válido
        if (outputCommitment == bytes32(0)) {
            return (false, 5); // Commitment vacío
        }

        return (true, 0);
    }

    /**
     * @notice Valida parámetros de withdraw SIN gastar gas
     */
    function preValidateWithdraw(
        bytes32 sourceCommitment,
        bytes32 sourceNullifier,
        uint256 amount,
        address recipient
    ) public view returns (bool isValid, uint8 errorCode) {
        
        // 1. Verificar source existe y no está gastado
        bytes32 utxoId = commitmentHashToUTXO[sourceCommitment];
        if (utxoId == bytes32(0) || !utxos[utxoId].exists) {
            return (false, 2); // UTXO no existe
        }
        if (utxos[utxoId].isSpent) {
            return (false, 3); // UTXO ya gastado
        }

        // 2. Verificar nullifier no vacío
        if (sourceNullifier == bytes32(0)) {
            return (false, 4); // Nullifier inválido
        }
        
        // 3. Verificar que nullifier no ha sido usado
        if (nullifiers[sourceNullifier]) {
            return (false, 8); // Nullifier ya usado
        }

        // 4. Verificar recipient válido
        if (recipient == address(0)) {
            return (false, 6); // Recipient inválido
        }

        // 5. Verificar amount > 0
        if (amount == 0) {
            return (false, 7); // Amount inválido
        }

        return (true, 0);
    }
    
    /**
     * @dev Validar parámetros de depósito ANTES de ejecutar la transacción
     */
    function validateDepositParams(
        DepositParams calldata params,
        address sender
    ) external view returns (bool success, string memory errorMessage) {
        
        // 1. Validaciones básicas
        if (params.tokenAddress == address(0)) {
            return (false, "InvalidToken");
        }
        
        if (params.amount == 0) {
            return (false, "InvalidAmount");
        }
        
        if (nullifiers[params.nullifierHash]) {
            return (false, "NullifierAlreadyUsed");
        }
        
        // 2. Verificar operación correcta
        if (keccak256(bytes(params.attestation.operation)) != keccak256("DEPOSIT")) {
            return (false, "InvalidOperation");
        }
        
        // 3. Verificar dataHash
        bytes32 expectedDataHash = calculateDepositDataHash(params, sender);
        if (params.attestation.dataHash != expectedDataHash) {
            return (false, "InvalidDataHash");
        }
        
        // 4. Verificar nonce secuencial
        if (params.attestation.nonce != lastNonce + 1) {
            return (false, "InvalidNonce");
        }
        
        // 5. Verificar timestamp no muy antiguo (máximo 10 minutos)
        if (block.timestamp > params.attestation.timestamp + 600) {
            return (false, "StaleAttestation");
        }
        
        // 6. Verificar firma del backend
        bytes32 messageHash = keccak256(abi.encodePacked(
            params.attestation.operation,
            params.attestation.dataHash,
            params.attestation.nonce,
            params.attestation.timestamp
        ));
        
        if (!_verifyECDSASignatureView(messageHash, params.attestation.signature, authorizedBackend)) {
            return (false, "UnauthorizedBackend");
        }
        
        // 7. Verificar allowance y balance
        try IERC20(params.tokenAddress).allowance(sender, address(this)) returns (uint256 allowance) {
            if (allowance < params.amount) {
                return (false, "InsufficientAllowance");
            }
        } catch {
            return (false, "InvalidToken");
        }
        
        try IERC20(params.tokenAddress).balanceOf(sender) returns (uint256 balance) {
            if (balance < params.amount) {
                return (false, "InsufficientBalance");
            }
        } catch {
            return (false, "InvalidToken");
        }
        
        return (true, "");
    }
    
    // ========================
    // FUNCIONES DE CÁLCULO DE HASH
    // ========================
    
    function calculateDepositDataHash(
        DepositParams calldata params,
        address sender
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            params.tokenAddress,
            params.commitment.x,
            params.commitment.y,
            params.nullifierHash,
            params.amount,
            sender
        ));
    }
    
    function calculateSplitDataHash(
        SplitParams calldata params,
        address sender
    ) public pure returns (bytes32) {
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
        
        return keccak256(abi.encodePacked(
            commitmentData,
            sender
        ));
    }
    
    function calculateTransferDataHash(
        TransferParams calldata params,
        address sender
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            params.inputCommitment.x,
            params.inputCommitment.y,
            params.inputNullifier,
            params.outputCommitment.x,
            params.outputCommitment.y,
            params.outputNullifier,
            sender
        ));
    }
    
    function calculateWithdrawDataHash(
        WithdrawParams calldata params,
        address sender
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            params.commitment.x,
            params.commitment.y,
            params.nullifierHash,
            params.revealedAmount,
            sender
        ));
    }
    
    // ========================
    // FUNCIONES AUXILIARES INTERNAS
    // ========================
    
    function _hashCommitment(CommitmentPoint memory commitment) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(commitment.x, commitment.y));
    }
    
    function _verifyECDSASignatureView(
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
}