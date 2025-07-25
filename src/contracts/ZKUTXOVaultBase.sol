// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ZKUTXOVaultBase - Simplified ZK base contract
 * @notice Contains minimal structs and functions for true ZK privacy
 * @dev Ultra-simplified base for ZK-UTXO system
 */
abstract contract ZKUTXOVaultBase is Ownable {
    
    // ========================
    // ESTRUCTURAS SIMPLIFICADAS ZK
    // ========================
    
    /**
     * @dev Attestation del backend - Backend verificó TODO en ZK
     */
    struct BackendAttestation {
        string operation;            // Tipo de operación ("DEPOSIT", "SPLIT", "TRANSFER", "WITHDRAW")
        bytes32 dataHash;           // Hash de todos los datos relevantes
        uint256 nonce;              // Nonce único secuencial
        uint256 timestamp;          // Timestamp de la attestation
        bytes signature;            // Firma ECDSA del backend autorizado
    }
    
    /**
     * @dev Parámetros para depósito ZK - Única operación con amount visible
     */
    struct ZKDepositParams {
        bytes32 utxoId;             // ID único del UTXO a crear
        bytes32 nullifierHash;      // Nullifier del UTXO
        address tokenAddress;       // Token a depositar
        uint256 amount;            // Amount (visible en deposit)
        BackendAttestation attestation;  // Backend verificó todo
    }
    
    /**
     * @dev Parámetros para split ZK - Sin amounts (privacidad total)
     */
    struct ZKSplitParams {
        bytes32 inputNullifier;           // Nullifier del UTXO a dividir
        bytes32[] outputUTXOIds;          // IDs de los UTXOs resultantes
        bytes32[] outputNullifiers;       // Nullifiers de los UTXOs resultantes
        BackendAttestation attestation;    // Backend verificó conservación de valor
    }
    
    /**
     * @dev Parámetros para transfer ZK - Sin amounts (privacidad total)
     */
    struct ZKTransferParams {
        bytes32 inputNullifier;           // Nullifier del UTXO a transferir
        bytes32 outputUTXOId;             // ID del UTXO para el receptor
        bytes32 outputNullifier;          // Nullifier del UTXO para el receptor
        BackendAttestation attestation;    // Backend verificó ownership
    }
    
    /**
     * @dev Parámetros para withdraw ZK - Amount visible (salida del sistema)
     */
    struct ZKWithdrawParams {
        bytes32 nullifier;               // Nullifier del UTXO a retirar
        address token;                   // Token a retirar
        uint256 amount;                  // Amount a retirar (visible en withdraw)
        BackendAttestation attestation;   // Backend verificó ownership y amount
    }
    
    // ========================
    // STORAGE MINIMAL ZK
    // ========================
    
    // ✅ ESENCIAL: Prevenir doble gasto
    mapping(bytes32 => bool) public nullifiersUsed;
    
    // ✅ ESENCIAL: Validar existencia de UTXOs (sin amounts)
    mapping(bytes32 => bool) public utxoExists;
    
    // ✅ ESENCIAL: Registry de tokens permitidos
    mapping(address => bool) public registeredTokens;
    address[] public allRegisteredTokens;
    
    // ✅ ESENCIAL: Backend autorizado para attestations
    address public authorizedBackend;
    
    // ✅ ESENCIAL: Nonce para prevenir replay attacks
    uint256 public lastNonce;
    
    // ========================
    // EVENTOS ZK
    // ========================
    
    /**
     * @dev Depósito ZK - Amount visible (entrada al sistema)
     */
    event ZKDeposit(
        bytes32 indexed utxoId,
        address indexed user,
        address indexed token,
        uint256 amount,          // ← Visible en deposit
        bytes32 nullifier,
        uint256 timestamp
    );
    
    /**
     * @dev Split ZK - Sin amounts (privacidad total)
     */
    event ZKSplit(
        bytes32 indexed inputNullifier,
        bytes32[] outputUTXOIds,     // ← Sin amounts
        bytes32[] outputNullifiers,
        uint256 timestamp
    );
    
    /**
     * @dev Transfer ZK - Sin amounts (privacidad total)
     */
    event ZKTransfer(
        bytes32 indexed inputNullifier,
        bytes32 indexed outputUTXOId,    // ← Sin amounts
        bytes32 indexed outputNullifier,
        uint256 timestamp
    );
    
    /**
     * @dev Withdraw ZK - Amount visible (salida del sistema)
     */
    event ZKWithdraw(
        bytes32 indexed nullifier,
        address indexed recipient,
        address indexed token,
        uint256 amount,          // ← Visible en withdraw
        uint256 timestamp
    );
    
    /**
     * @dev Backend actualizado
     */
    event BackendUpdated(address indexed oldBackend, address indexed newBackend);
    
    /**
     * @dev Token registrado
     */
    event TokenRegistered(address indexed tokenAddress, uint256 timestamp);
    
    // ========================
    // ERRORES SIMPLIFICADOS
    // ========================
    
    error InvalidToken();
    error InvalidAmount();
    error InvalidNullifier();
    error NullifierAlreadyUsed();
    error UTXONotFound();
    error UnauthorizedBackend();
    error InvalidAttestation();
    error StaleAttestation();
    error ReplayAttack();
    error InvalidArrayLength();
    error InsufficientBalance();
    
    // ========================
    // CONSTRUCTOR SIMPLIFICADO
    // ========================
    
    constructor(address _authorizedBackend) Ownable(msg.sender) {
        require(_authorizedBackend != address(0), "Invalid backend");
        authorizedBackend = _authorizedBackend;
        lastNonce = 0;
    }
    
    // ========================
    // FUNCIONES VIEW SIMPLIFICADAS
    // ========================
    
    /**
     * @notice Verificar si un nullifier ya fue usado
     */
    function isNullifierUsed(bytes32 nullifier) external view returns (bool) {
        return nullifiersUsed[nullifier];
    }
    
    /**
     * @notice Verificar si un UTXO existe
     */
    function doesUTXOExist(bytes32 utxoId) external view returns (bool) {
        return utxoExists[utxoId];
    }
    
    /**
     * @notice Obtener tokens registrados
     */
    function getRegisteredTokens() external view returns (address[] memory) {
        return allRegisteredTokens;
    }
    
    /**
     * @notice Verificar si token está registrado
     */
    function isTokenRegistered(address tokenAddress) external view returns (bool) {
        return registeredTokens[tokenAddress];
    }
    
    /**
     * @notice Obtener nonce actual
     */
    function getCurrentNonce() external view returns (uint256) {
        return lastNonce;
    }
    
    /**
     * @notice Obtener balance de un token en el contrato
     */
    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
    
    // ========================
    // VALIDACIONES PRE-TRANSACCIÓN ZK
    // ========================
    
    /**
     * @notice Pre-validar split ZK (solo nullifier)
     */
    function preValidateSplit(
        bytes32 inputNullifier
    ) public view returns (bool isValid, uint8 errorCode) {
        if (inputNullifier == bytes32(0)) {
            return (false, 1); // Invalid nullifier
        }
        if (nullifiersUsed[inputNullifier]) {
            return (false, 2); // Already spent
        }
        return (true, 0);
    }
    
    /**
     * @notice Pre-validar transfer ZK (solo nullifiers)
     */
    function preValidateTransfer(
        bytes32 inputNullifier,
        bytes32 outputNullifier
    ) public view returns (bool isValid, uint8 errorCode) {
        if (inputNullifier == bytes32(0) || outputNullifier == bytes32(0)) {
            return (false, 1); // Invalid nullifiers
        }
        if (nullifiersUsed[inputNullifier]) {
            return (false, 2); // Input already spent
        }
        if (nullifiersUsed[outputNullifier]) {
            return (false, 3); // Output nullifier collision
        }
        return (true, 0);
    }
    
    /**
     * @notice Pre-validar withdraw ZK (nullifier + balance)
     */
    function preValidateWithdraw(
        bytes32 nullifier,
        address token,
        uint256 amount
    ) public view returns (bool isValid, uint8 errorCode) {
        if (nullifier == bytes32(0)) {
            return (false, 1); // Invalid nullifier
        }
        if (nullifiersUsed[nullifier]) {
            return (false, 2); // Already spent
        }
        if (amount == 0) {
            return (false, 3); // Invalid amount
        }
        
        // Verificar balance del contrato
        try IERC20(token).balanceOf(address(this)) returns (uint256 contractBalance) {
            if (contractBalance < amount) {
                return (false, 4); // Insufficient contract balance
            }
        } catch {
            return (false, 5); // Invalid token
        }
        
        return (true, 0);
    }
    
    /**
     * @notice Pre-validar deposit ZK
     */
    function preValidateDeposit(
        bytes32 nullifier,
        address token,
        uint256 amount,
        address depositor
    ) public view returns (bool isValid, uint8 errorCode) {
        if (nullifier == bytes32(0)) {
            return (false, 1); // Invalid nullifier
        }
        if (nullifiersUsed[nullifier]) {
            return (false, 2); // Nullifier already used
        }
        if (token == address(0)) {
            return (false, 3); // Invalid token
        }
        if (amount == 0) {
            return (false, 4); // Invalid amount
        }
        
        // Verificar allowance y balance del depositante
        try IERC20(token).allowance(depositor, address(this)) returns (uint256 allowance) {
            if (allowance < amount) {
                return (false, 5); // Insufficient allowance
            }
        } catch {
            return (false, 6); // Invalid token
        }
        
        try IERC20(token).balanceOf(depositor) returns (uint256 balance) {
            if (balance < amount) {
                return (false, 7); // Insufficient balance
            }
        } catch {
            return (false, 6); // Invalid token
        }
        
        return (true, 0);
    }
    
    // ========================
    // VERIFICACIÓN DE ATTESTATIONS ZK
    // ========================
    
    /**
     * @notice Verificar attestation del backend (CRÍTICO en ZK)
     */
    function _verifyZKAttestation(
        BackendAttestation memory attestation,
        string memory expectedOperation
    ) internal returns (bool) {
        
        // 1. Verificar operación correcta
        if (keccak256(bytes(attestation.operation)) != keccak256(bytes(expectedOperation))) {
            return false;
        }
        
        // 2. Verificar nonce secuencial (prevenir replay)
        if (attestation.nonce != lastNonce + 1) {
            return false;
        }
        
        // 3. Verificar timestamp no muy antiguo (máximo 10 minutos)
        if (block.timestamp > attestation.timestamp + 600) {
            return false;
        }
        
        // 4. Verificar firma del backend
        bytes32 messageHash = keccak256(abi.encodePacked(
            attestation.operation,
            attestation.dataHash,
            attestation.nonce,
            attestation.timestamp
        ));
        
        if (!_verifyECDSASignature(messageHash, attestation.signature, authorizedBackend)) {
            return false;
        }
        
        // 5. Actualizar nonce (prevenir replay)
        lastNonce = attestation.nonce;
        
        return true;
    }
    
    /**
     * @notice Verificar firma ECDSA
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
    // FUNCIONES AUXILIARES ZK
    // ========================
    
    /**
     * @notice Registrar nuevo token
     */
    function _registerToken(address tokenAddress) internal {
        if (!registeredTokens[tokenAddress]) {
            registeredTokens[tokenAddress] = true;
            allRegisteredTokens.push(tokenAddress);
            
            emit TokenRegistered(tokenAddress, block.timestamp);
        }
    }
    
    /**
     * @notice Actualizar backend autorizado (solo owner)
     */
    function updateAuthorizedBackend(address newBackend) external onlyOwner {
        require(newBackend != address(0), "Invalid backend");
        
        address oldBackend = authorizedBackend;
        authorizedBackend = newBackend;
        
        emit BackendUpdated(oldBackend, newBackend);
    }
}
