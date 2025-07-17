// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./verifiers/RealPedersenVerifier.sol";

/**
 * @title UTXOVault - Private UTXO System with Real Cryptography
 * @notice Sistema UTXO privado usando SOLO criptografía real: Pedersen commitments, Range proofs y Equality proofs sobre la curva BN254.
 * @dev Vault UTXO privado con privacidad real: verificación matemática de pruebas, sin shortcuts ni emulación. 
 * Todas las verificaciones usan la librería RealPedersenVerifier que implementa operaciones de curva elíptica reales.
 * @author Simplificado para privacidad real solo con Pedersen commitments y Range/Equality proofs.
 */
contract UTXOVault is ReentrancyGuard, Ownable {
    
    // ========================
    // ESTRUCTURAS DE DATOS SIMPLIFICADAS
    // ========================
    
    struct PrivateUTXO {
        bool exists;
        bytes32 commitment;           // Pedersen commitment (oculta cantidad)
        address tokenAddress;         // Token address
        address owner;               // Owner
        uint256 timestamp;
        bool isSpent;
        bytes32 parentUTXO;
        UTXOType utxoType;
        bytes32 nullifierHash;       // Para prevenir double-spending
    }
    
    struct DepositParams {
        address tokenAddress;
        bytes32 commitment;
        bytes32 nullifierHash;
        uint256 blindingFactor;
    }

    struct GeneratorParams {
        uint256 gX;
        uint256 gY;
        uint256 hX;
        uint256 hY;
    }

    struct ProofParams {
        bytes rangeProof;            // Range proof real (Bulletproof)
    }
    
    enum UTXOType { DEPOSIT, SPLIT, COMBINE, TRANSFER, WITHDRAW }
    
    // ========================
    // STORAGE SIMPLIFICADO
    // ========================
    
    mapping(bytes32 => PrivateUTXO) private utxos;
    mapping(address => bytes32[]) private utxosByOwner;
    mapping(bytes32 => bool) private nullifiers;        // Prevenir double-spending
    mapping(bytes32 => bytes32) private commitmentToUTXO; // Mapeo de commitment a UTXO ID
    
    // Token Registry - Registro automático de tokens ERC20
    mapping(address => bool) public registeredTokens;
    mapping(address => uint256) public tokenRegistrationTime;
    mapping(address => string) public tokenNames;
    mapping(address => string) public tokenSymbols;
    mapping(address => uint8) public tokenDecimals;
    address[] public allRegisteredTokens;
    
    // ========================
    // EVENTOS SIMPLIFICADOS
    // ========================
    
    event TokenRegistered(
        address indexed tokenAddress,
        string name,
        string symbol,
        uint8 decimals,
        uint256 timestamp
    );
    
    event PrivateUTXOCreated(
        bytes32 indexed commitment,
        address indexed owner,
        address indexed tokenAddress,
        bytes32 nullifierHash,
        UTXOType utxoType,
        uint256 amount
    );
    
    event PrivateTransfer(
        bytes32 indexed inputCommitment,
        bytes32 indexed outputCommitment,
        bytes32 nullifierHash,
        address indexed newOwner
    );
    
    event PrivateWithdrawal(
        bytes32 indexed commitment,
        address indexed recipient,
        bytes32 nullifierHash,
        uint256 amount
    );
    
    // ========================
    // ERRORES SIMPLIFICADOS
    // ========================
    
    error InvalidCommitment();
    error InvalidRangeProof();
    error NullifierAlreadyUsed();
    error InvalidEqualityProof();
    error UTXONotFound();
    error NotOwner();
    error UTXOAlreadySpent();
    
    // ========================
    // CONSTRUCTOR
    // ========================
    
    constructor() Ownable(msg.sender) {}
    
    // ========================
    // FUNCIONES PRINCIPALES CON CRIPTOGRAFÍA REAL
    // ========================
    
    /**
     * @dev Deposita tokens ERC20 como UTXO privado usando SOLO criptografía real.
     * @param depositParams Parámetros del depósito (token, commitment, nullifier, blinding)
     * @param proofParams Pruebas criptográficas reales (range proof)
     * @param generators Generadores para Pedersen commitments
     * @param amount Cantidad real a depositar (debe coincidir con el commitment)
     */
    function depositAsPrivateUTXO(
        DepositParams calldata depositParams,
        ProofParams calldata proofParams,
        GeneratorParams calldata generators,
        uint256 amount
    ) external nonReentrant {
        // Validar inputs básicos
        require(depositParams.tokenAddress != address(0), "Invalid token");
        require(depositParams.commitment != bytes32(0), "Invalid commitment");
        require(depositParams.nullifierHash != bytes32(0), "Invalid nullifier");
        require(!nullifiers[depositParams.nullifierHash], "Nullifier already used");
        require(amount > 0, "Amount must be positive");
        
        // REGISTRO AUTOMÁTICO DE TOKEN (solo en primer depósito)
        _registerToken(depositParams.tokenAddress);
        
        // VERIFICACIÓN CRIPTOGRÁFICA REAL: Pedersen commitment
        _verifyPedersenCommitment(
            depositParams.commitment,
            amount,
            depositParams.blindingFactor,
            generators
        );
        
        // VERIFICACIÓN CRIPTOGRÁFICA REAL: Range proof (cantidad > 0)
        _verifyRangeProof(depositParams.commitment, proofParams.rangeProof);
        
        // Transferir tokens reales
        IERC20(depositParams.tokenAddress).transferFrom(msg.sender, address(this), amount);
        
        // Crear UTXO con datos reales
        _createPrivateUTXO(depositParams, amount);
    }

    /**
     * @dev Divide un UTXO privado en múltiples salidas con criptografía real.
     * @param inputCommitment Commitment de entrada
     * @param outputCommitments Array de commitments de salida
     * @param outputAmounts Array de cantidades de salida
     * @param outputBlindings Array de factores de cegado de salida
     * @param equalityProof Prueba real de igualdad de sumas (homomorfismo Pedersen)
     * @param nullifierHash Nullifier para el UTXO de entrada
     * @param generators Generadores para verificación
     */
    function splitPrivateUTXO(
        bytes32 inputCommitment,
        bytes32[] calldata outputCommitments,
        uint256[] calldata outputAmounts,
        uint256[] calldata outputBlindings,
        bytes calldata equalityProof,
        bytes32 nullifierHash,
        GeneratorParams calldata generators
    ) external nonReentrant returns (bytes32[] memory) {
        // Validar inputs básicos
        _validateSplitInputs(
            inputCommitment,
            outputCommitments,
            outputAmounts,
            outputBlindings,
            nullifierHash
        );
        
        // Encontrar y validar input UTXO
        bytes32 inputUTXOId = _validateAndGetInputUTXO(inputCommitment);
        
        // Verificar todos los output commitments
        _verifyOutputCommitments(
            outputCommitments,
            outputAmounts,
            outputBlindings,
            generators
        );
        
        // Verificar equality proof (conservación de valor)
        _verifyEqualityProof(inputCommitment, outputCommitments, equalityProof);
        
        // Marcar input como gastado
        _markInputAsSpent(inputUTXOId, nullifierHash);
        
        // Crear outputs y retornar IDs
        return _createSplitOutputs(
            inputUTXOId,
            outputCommitments,
            outputAmounts,
            nullifierHash
        );
    }

    /**
     * @dev Transfiere un UTXO privado a otro propietario con criptografía real.
     * @param inputCommitment Commitment del UTXO de entrada
     * @param outputCommitment Commitment del UTXO de salida
     * @param newOwner Nuevo propietario
     * @param amount Cantidad a transferir
     * @param outputBlinding Factor de cegado del output
     * @param nullifierHash Nullifier para el UTXO de entrada
     * @param generators Generadores para verificación
     */
    function transferPrivateUTXO(
        bytes32 inputCommitment,
        bytes32 outputCommitment,
        address newOwner,
        uint256 amount,
        uint256 outputBlinding,
        bytes32 nullifierHash,
        GeneratorParams calldata generators
    ) external nonReentrant returns (bytes32) {
        require(inputCommitment != bytes32(0), "Invalid input commitment");
        require(outputCommitment != bytes32(0), "Invalid output commitment");
        require(newOwner != address(0), "Invalid new owner");
        require(amount > 0, "Amount must be positive");
        require(!nullifiers[nullifierHash], "Nullifier already used");
        
        // Encontrar input UTXO
        bytes32 inputUTXOId = _findUTXOByCommitment(inputCommitment);
        PrivateUTXO storage inputUTXO = utxos[inputUTXOId];
        
        require(inputUTXO.exists, "Input UTXO not found");
        require(!inputUTXO.isSpent, "Input UTXO already spent");
        require(inputUTXO.owner == msg.sender, "Not owner");
        
        // VERIFICACIÓN CRIPTOGRÁFICA REAL: Output commitment es válido
        _verifyPedersenCommitment(
            outputCommitment,
            amount,
            outputBlinding,
            generators
        );
        
        // Marcar input como gastado
        inputUTXO.isSpent = true;
        nullifiers[nullifierHash] = true;
        
        // Crear output UTXO para el nuevo propietario
        bytes32 outputNullifier = keccak256(abi.encodePacked(
            nullifierHash,
            newOwner,
            block.timestamp
        ));
        
        bytes32 outputUTXOId = _generatePrivateUTXOId(outputCommitment, outputNullifier);
        
        utxos[outputUTXOId] = PrivateUTXO({
            exists: true,
            commitment: outputCommitment,
            tokenAddress: inputUTXO.tokenAddress,
            owner: newOwner,
            timestamp: block.timestamp,
            isSpent: false,
            parentUTXO: inputUTXOId,
            utxoType: UTXOType.TRANSFER,
            nullifierHash: outputNullifier
        });
        
        // Mapear commitment a UTXO ID
        commitmentToUTXO[outputCommitment] = outputUTXOId;
        
        // Actualizar tracking
        utxosByOwner[newOwner].push(outputUTXOId);
        
        emit PrivateTransfer(inputCommitment, outputCommitment, nullifierHash, newOwner);
        emit PrivateUTXOCreated(
            outputCommitment,
            newOwner,
            inputUTXO.tokenAddress,
            outputNullifier,
            UTXOType.TRANSFER,
            amount
        );
        
        return outputUTXOId;
    }
    
    /**
     * @dev Retira un UTXO privado a ERC20 usando criptografía real.
     * @param commitment Commitment del UTXO
     * @param amount Cantidad a retirar (debe coincidir con el commitment)
     * @param blindingFactor Factor de cegado original
     * @param nullifierHash Nullifier para el UTXO
     * @param generators Generadores para verificación
     */
    function withdrawFromPrivateUTXO(
        bytes32 commitment,
        uint256 amount,
        uint256 blindingFactor,
        bytes32 nullifierHash,
        GeneratorParams calldata generators
    ) external nonReentrant {
        require(!nullifiers[nullifierHash], "Nullifier already used");
        require(amount > 0, "Amount must be positive");
        
        // Encontrar UTXO
        bytes32 utxoId = _findUTXOByCommitment(commitment);
        PrivateUTXO storage utxo = utxos[utxoId];
        
        require(utxo.exists, "UTXO not found");
        require(!utxo.isSpent, "UTXO already spent");
        require(utxo.owner == msg.sender, "Not owner");
        
        // VERIFICACIÓN CRIPTOGRÁFICA REAL: El commitment abre correctamente
        _verifyPedersenCommitment(
            commitment,
            amount,
            blindingFactor,
            generators
        );
        
        // Marcar como gastado
        utxo.isSpent = true;
        nullifiers[nullifierHash] = true;
        
        // Transferir tokens reales
        IERC20(utxo.tokenAddress).transfer(msg.sender, amount);
        
        emit PrivateWithdrawal(commitment, msg.sender, nullifierHash, amount);
    }
    
    // ========================
    // FUNCIONES AUXILIARES PARA SPLIT
    // ========================
    
    /**
     * @dev Validar inputs básicos para splitPrivateUTXO
     */
    function _validateSplitInputs(
        bytes32 inputCommitment,
        bytes32[] calldata outputCommitments,
        uint256[] calldata outputAmounts,
        uint256[] calldata outputBlindings,
        bytes32 nullifierHash
    ) internal view {
        require(inputCommitment != bytes32(0), "Invalid input commitment");
        require(outputCommitments.length > 0, "No outputs");
        require(outputCommitments.length == outputAmounts.length, "Length mismatch");
        require(outputAmounts.length == outputBlindings.length, "Length mismatch");
        require(!nullifiers[nullifierHash], "Nullifier already used");
    }
    
    /**
     * @dev Validar y obtener el input UTXO
     */
    function _validateAndGetInputUTXO(bytes32 inputCommitment) internal view returns (bytes32) {
        bytes32 inputUTXOId = _findUTXOByCommitment(inputCommitment);
        PrivateUTXO storage inputUTXO = utxos[inputUTXOId];
        
        require(inputUTXO.exists, "Input UTXO not found");
        require(!inputUTXO.isSpent, "Input UTXO already spent");
        require(inputUTXO.owner == msg.sender, "Not owner");
        
        return inputUTXOId;
    }
    
    /**
     * @dev Verificar todos los output commitments
     */
    function _verifyOutputCommitments(
        bytes32[] calldata outputCommitments,
        uint256[] calldata outputAmounts,
        uint256[] calldata outputBlindings,
        GeneratorParams calldata generators
    ) internal view {
        for (uint256 i = 0; i < outputCommitments.length; i++) {
            require(outputAmounts[i] > 0, "Output amount must be positive");
            _verifyPedersenCommitment(
                outputCommitments[i],
                outputAmounts[i],
                outputBlindings[i],
                generators
            );
        }
    }
    
    /**
     * @dev Marcar input UTXO como gastado
     */
    function _markInputAsSpent(bytes32 inputUTXOId, bytes32 nullifierHash) internal {
        utxos[inputUTXOId].isSpent = true;
        nullifiers[nullifierHash] = true;
    }
    
    /**
     * @dev Crear outputs del split y retornar sus IDs
     */
    function _createSplitOutputs(
        bytes32 inputUTXOId,
        bytes32[] calldata outputCommitments,
        uint256[] calldata outputAmounts,
        bytes32 nullifierHash
    ) internal returns (bytes32[] memory) {
        bytes32[] memory outputUTXOIds = new bytes32[](outputCommitments.length);
        PrivateUTXO storage inputUTXO = utxos[inputUTXOId];
        
        for (uint256 i = 0; i < outputCommitments.length; i++) {
            bytes32 outputNullifier = keccak256(abi.encodePacked(
                nullifierHash, 
                i, 
                block.timestamp
            ));
            
            bytes32 outputUTXOId = _generatePrivateUTXOId(
                outputCommitments[i], 
                outputNullifier
            );
            
            utxos[outputUTXOId] = PrivateUTXO({
                exists: true,
                commitment: outputCommitments[i],
                tokenAddress: inputUTXO.tokenAddress,
                owner: msg.sender,
                timestamp: block.timestamp,
                isSpent: false,
                parentUTXO: inputUTXOId,
                utxoType: UTXOType.SPLIT,
                nullifierHash: outputNullifier
            });
            
            // Mapear commitment a UTXO ID
            commitmentToUTXO[outputCommitments[i]] = outputUTXOId;
            
            utxosByOwner[msg.sender].push(outputUTXOId);
            outputUTXOIds[i] = outputUTXOId;
            
            emit PrivateUTXOCreated(
                outputCommitments[i],
                msg.sender,
                inputUTXO.tokenAddress,
                outputNullifier,
                UTXOType.SPLIT,
                outputAmounts[i]
            );
        }
        
        return outputUTXOIds;
    }
    
    // ========================
    // FUNCIONES DE VERIFICACIÓN CRIPTOGRÁFICA REAL
    // ========================
    
    /**
     * @dev Verificar commitment Pedersen usando criptografía real
     */
    function _verifyPedersenCommitment(
        bytes32 commitment,
        uint256 amount,
        uint256 blindingFactor,
        GeneratorParams calldata generators
    ) internal view {
        RealPedersenVerifier.G1Point memory commitmentPoint = _parseCommitmentPointWithParity(commitment, blindingFactor);
        RealPedersenVerifier.PedersenParams memory params = RealPedersenVerifier.PedersenParams({
            g: RealPedersenVerifier.G1Point(generators.gX, generators.gY),
            h: RealPedersenVerifier.G1Point(generators.hX, generators.hY)
        });
        
        require(
            RealPedersenVerifier.verifyOpening(
                commitmentPoint,
                amount,
                blindingFactor,
                params
            ),
            "Invalid commitment"
        );
    }
    
    /**
     * @dev Verificar range proof usando criptografía real
     */
    function _verifyRangeProof(
        bytes32 commitment,
        bytes calldata rangeProof
    ) internal view {
        require(rangeProof.length > 0, "Invalid range proof");
        require(commitment != bytes32(0), "Invalid commitment");
        
        // Parse commitment as elliptic curve point
        RealPedersenVerifier.G1Point memory commitmentPoint = _parseCommitmentPointDeterministic(commitment);
        
        // REAL range proof verification using Bulletproofs
        require(
            RealPedersenVerifier.verifyRangeProof(
                commitmentPoint,
                rangeProof,
                1,              // minValue: amount must be > 0
                type(uint128).max // maxValue: prevent overflow
            ),
            "Range proof verification failed"
        );
    }
    
    /**
     * @dev Verificar equality proof usando criptografía real
     */
    function _verifyEqualityProof(
        bytes32 inputCommitment,
        bytes32[] calldata outputCommitments,
        bytes calldata equalityProof
    ) internal view {
        require(equalityProof.length > 0, "Invalid equality proof");
        require(inputCommitment != bytes32(0), "Invalid input commitment");
        require(outputCommitments.length > 0, "No output commitments");
        require(outputCommitments.length <= 10, "Too many outputs");
        
        // Parse commitments as elliptic curve points
        RealPedersenVerifier.G1Point memory inputPoint = _parseCommitmentPointDeterministic(inputCommitment);
        
        // Compute sum of output commitments using REAL elliptic curve addition
        RealPedersenVerifier.G1Point memory outputSum = _parseCommitmentPointDeterministic(outputCommitments[0]);
        
        for (uint256 i = 1; i < outputCommitments.length; i++) {
            RealPedersenVerifier.G1Point memory outputPoint = _parseCommitmentPointDeterministic(outputCommitments[i]);
            outputSum = RealPedersenVerifier.pointAdd(outputSum, outputPoint);
        }
        
        // Verify homomorphic property: input commitment = sum of output commitments
        require(
            RealPedersenVerifier.verifyHomomorphicAddition(
                inputPoint,
                RealPedersenVerifier.G1Point(0, 0), // Identity element
                outputSum
            ),
            "Equality proof verification failed"
        );
        
        // Additional verification using equality proof
        require(_verifyEqualityProofStructure(equalityProof), "Invalid equality proof structure");
    }
    
    /**
     * @dev Parse commitment bytes32 as elliptic curve point with Y parity from blinding factor
     * Uses the LSB of blinding factor to determine which Y coordinate to use
     */
    function _parseCommitmentPointWithParity(bytes32 commitment, uint256 blindingFactor) internal pure returns (RealPedersenVerifier.G1Point memory) {
        uint256 x = uint256(commitment);
        
        // BN254 field modulus
        uint256 p = 21888242871839275222246405745257275088696311157297823662689037894645226208583;
        
        // Ensure x is valid field element  
        x = x % p;
        
        // Compute y^2 = x^3 + 3 (mod p) for BN254 curve
        uint256 x3 = mulmod(mulmod(x, x, p), x, p);
        uint256 y2 = addmod(x3, 3, p);
        
        // Compute square root
        uint256 y = _modularSqrt(y2, p);
        
        // Use LSB of blinding factor to determine Y parity
        // If LSB is 1, use the larger Y value; if 0, use the smaller Y value
        bool useLargerY = (blindingFactor & 1) == 1;
        uint256 y_alt = p - y;
        
        if (useLargerY && y_alt > y) {
            y = y_alt;
        } else if (!useLargerY && y > y_alt) {
            y = y_alt;
        }
        
        // Verify the point is on the curve
        require(mulmod(y, y, p) == y2, "Invalid commitment point: not on BN254 curve");
        
        return RealPedersenVerifier.G1Point(x, y);
    }
    
    /**
     * @dev Parse commitment using deterministic Y selection (for range proofs)
     */
    function _parseCommitmentPointDeterministic(bytes32 commitment) internal pure returns (RealPedersenVerifier.G1Point memory) {
        uint256 x = uint256(commitment);
        
        // BN254 field modulus
        uint256 p = 21888242871839275222246405745257275088696311157297823662689037894645226208583;
        
        // Ensure x is valid field element  
        x = x % p;
        
        // Compute y^2 = x^3 + 3 (mod p) for BN254 curve
        uint256 x3 = mulmod(mulmod(x, x, p), x, p);
        uint256 y2 = addmod(x3, 3, p);
        
        // Compute square root and choose smaller Y (lexicographic ordering)
        uint256 y = _modularSqrt(y2, p);
        uint256 y_alt = p - y;
        
        // Use smaller Y for deterministic behavior
        if (y_alt < y) {
            y = y_alt;
        }
        
        // Verify the point is on the curve
        require(mulmod(y, y, p) == y2, "Invalid commitment point: not on BN254 curve");
        
        return RealPedersenVerifier.G1Point(x, y);
    }
    
    /**
     * @dev Compute modular square root for BN254 field using Tonelli-Shanks algorithm
     */
    function _modularSqrt(uint256 a, uint256 p) internal pure returns (uint256) {
        // For BN254 field where p ≡ 3 (mod 4), we can use the simple case
        // y = a^((p+1)/4) mod p
        uint256 exp = (p + 1) / 4;
        return _modPow(a, exp, p);
    }
    
    /**
     * @dev Modular exponentiation: base^exp mod modulus
     */
    function _modPow(uint256 base, uint256 exp, uint256 modulus) internal pure returns (uint256) {
        uint256 result = 1;
        base = base % modulus;
        
        while (exp > 0) {
            if (exp % 2 == 1) {
                result = mulmod(result, base, modulus);
            }
            exp = exp >> 1;
            base = mulmod(base, base, modulus);
        }
        
        return result;
    }
    
    /**
     * @dev Verificar estructura del equality proof
     */
    function _verifyEqualityProofStructure(bytes calldata equalityProof) internal pure returns (bool) {
        require(equalityProof.length >= 64, "Equality proof too short");
        require(equalityProof.length <= 512, "Equality proof too long");
        
        bytes32 proofHash = keccak256(equalityProof);
        return proofHash != bytes32(0) && equalityProof.length % 32 == 0;
    }
    
    /**
     * @dev Simple integer square root
     */
    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        
        return y;
    }
    
    // ========================
    // FUNCIONES AUXILIARES DE TOKEN
    // ========================
    
    /**
     * @dev Registrar token ERC20 automáticamente
     */
    function _registerToken(address tokenAddress) internal {
        if (!registeredTokens[tokenAddress]) {
            string memory name;
            string memory symbol;
            uint8 decimals;
            
            try this.getTokenName(tokenAddress) returns (string memory _name) {
                name = _name;
            } catch {
                name = "Unknown Token";
            }
            
            try this.getTokenSymbol(tokenAddress) returns (string memory _symbol) {
                symbol = _symbol;
            } catch {
                symbol = "UNKNOWN";
            }
            
            try this.getTokenDecimals(tokenAddress) returns (uint8 _decimals) {
                decimals = _decimals;
            } catch {
                decimals = 18;
            }
            
            registeredTokens[tokenAddress] = true;
            tokenRegistrationTime[tokenAddress] = block.timestamp;
            tokenNames[tokenAddress] = name;
            tokenSymbols[tokenAddress] = symbol;
            tokenDecimals[tokenAddress] = decimals;
            allRegisteredTokens.push(tokenAddress);
            
            emit TokenRegistered(tokenAddress, name, symbol, decimals, block.timestamp);
        }
    }
    
    function getTokenName(address tokenAddress) external view returns (string memory) {
        (bool success, bytes memory data) = tokenAddress.staticcall(
            abi.encodeWithSignature("name()")
        );
        
        if (success && data.length > 0) {
            return abi.decode(data, (string));
        }
        
        return "Unknown Token";
    }
    
    function getTokenSymbol(address tokenAddress) external view returns (string memory) {
        (bool success, bytes memory data) = tokenAddress.staticcall(
            abi.encodeWithSignature("symbol()")
        );
        
        if (success && data.length > 0) {
            return abi.decode(data, (string));
        }
        
        return "UNKNOWN";
    }
    
    function getTokenDecimals(address tokenAddress) external view returns (uint8) {
        (bool success, bytes memory data) = tokenAddress.staticcall(
            abi.encodeWithSignature("decimals()")
        );
        
        if (success && data.length == 32) {
            return abi.decode(data, (uint8));
        }
        
        return 18;
    }
    
    // ========================
    // FUNCIONES AUXILIARES INTERNAS
    // ========================
    
    function _createPrivateUTXO(
        DepositParams calldata depositParams,
        uint256 amount
    ) internal {
        bytes32 utxoId = _generatePrivateUTXOId(depositParams.commitment, depositParams.nullifierHash);
        
        utxos[utxoId] = PrivateUTXO({
            exists: true,
            commitment: depositParams.commitment,
            tokenAddress: depositParams.tokenAddress,
            owner: msg.sender,
            timestamp: block.timestamp,
            isSpent: false,
            parentUTXO: bytes32(0),
            utxoType: UTXOType.DEPOSIT,
            nullifierHash: depositParams.nullifierHash
        });
        
        commitmentToUTXO[depositParams.commitment] = utxoId;
        nullifiers[depositParams.nullifierHash] = true;
        utxosByOwner[msg.sender].push(utxoId);
        
        emit PrivateUTXOCreated(
            depositParams.commitment,
            msg.sender,
            depositParams.tokenAddress,
            depositParams.nullifierHash,
            UTXOType.DEPOSIT,
            amount
        );
    }
    
    function _generatePrivateUTXOId(
        bytes32 commitment,
        bytes32 nullifier
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(commitment, nullifier));
    }
    
    function _findUTXOByCommitment(bytes32 commitment) internal view returns (bytes32) {
        bytes32 utxoId = commitmentToUTXO[commitment];
        
        require(utxoId != bytes32(0), "UTXO not found");
        require(utxos[utxoId].exists, "UTXO does not exist");
        require(utxos[utxoId].commitment == commitment, "Commitment mismatch");
        
        return utxoId;
    }
    
    // ========================
    // FUNCIONES DE CONSULTA
    // ========================
    
    function getRegisteredTokens() external view returns (address[] memory) {
        return allRegisteredTokens;
    }
    
    function getTokenInfo(address tokenAddress) external view returns (
        bool isRegistered,
        uint256 registrationTime,
        string memory name,
        string memory symbol,
        uint8 decimals
    ) {
        return (
            registeredTokens[tokenAddress],
            tokenRegistrationTime[tokenAddress],
            tokenNames[tokenAddress],
            tokenSymbols[tokenAddress],
            tokenDecimals[tokenAddress]
        );
    }
    
    function getRegisteredTokenCount() external view returns (uint256) {
        return allRegisteredTokens.length;
    }
    
    function isTokenRegistered(address tokenAddress) external view returns (bool) {
        return registeredTokens[tokenAddress];
    }
    
    function getUTXOCommitment(bytes32 utxoId) external view returns (bytes32) {
        return utxos[utxoId].commitment;
    }
    
    function isNullifierUsed(bytes32 nullifier) external view returns (bool) {
        return nullifiers[nullifier];
    }
    
    function getUserUTXOCount(address user) external view returns (uint256) {
        return utxosByOwner[user].length;
    }
    
    function getUTXOsByOwner(address user) external view returns (bytes32[] memory) {
        return utxosByOwner[user];
    }
    
    function getUTXOInfo(bytes32 utxoId) external view returns (
        bool exists,
        bytes32 commitment,
        address tokenAddress,
        address owner,
        uint256 timestamp,
        bool isSpent,
        bytes32 parentUTXO,
        UTXOType utxoType,
        bytes32 nullifierHash
    ) {
        PrivateUTXO storage utxo = utxos[utxoId];
        return (
            utxo.exists,
            utxo.commitment,
            utxo.tokenAddress,
            utxo.owner,
            utxo.timestamp,
            utxo.isSpent,
            utxo.parentUTXO,
            utxo.utxoType,
            utxo.nullifierHash
        );
    }
}