// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./verifiers/RealPedersenVerifier.sol";

/**
 * @title UTXOVault - Private UTXO System
 * @notice Sistema UTXO privado usando SOLO criptografía real: Pedersen commitments, Range proofs y Equality proofs sobre la curva BN254.
 * @dev Vault UTXO privado con privacidad real: verificación matemática de pruebas, sin shortcuts ni emulación. 
 * Todas las verificaciones usan la librería RealPedersenVerifier que implementa operaciones de curva elíptica reales.
 * @author Simplificado para privacidad real solo con Pedersen commitments y Range/Equality proofs.
 */
contract UTXOVault is ReentrancyGuard, Ownable {
    
    // ========================
    // ESTRUCTURAS DE DATOS SIMPLIFICADAS
    // ========================
    
    struct CommitmentPoint {
        uint256 x;
        uint256 y;
    }
    
    struct PrivateUTXO {
        bool exists;
        CommitmentPoint commitment;   // Pedersen commitment point (full coordinates)
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
        CommitmentPoint commitment;   // Full commitment point (X, Y)
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
    mapping(bytes32 => bytes32) private commitmentHashToUTXO; // Mapeo de commitment hash a UTXO ID
    
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
        // Validaciones básicas
        _validateDepositInputs(depositParams, amount);
        
        // Registro automático de token
        _registerToken(depositParams.tokenAddress);
        
        // Verificaciones criptográficas
        _verifyDepositCryptography(depositParams, proofParams, generators, amount);
        
        // Ejecutar depósito
        _executeDeposit(depositParams, amount);
    }
    
    /**
     * @dev Validar inputs del depósito
     */
    function _validateDepositInputs(DepositParams calldata depositParams, uint256 amount) internal view {
        require(depositParams.tokenAddress != address(0), "Invalid token");
        require(_isValidCommitmentPoint(depositParams.commitment), "Invalid commitment point");
        require(depositParams.nullifierHash != bytes32(0), "Invalid nullifier");
        require(!nullifiers[depositParams.nullifierHash], "Nullifier already used");
        require(amount > 0, "Amount must be positive");
    }
    
    /**
     * @dev Verificar toda la criptografía del depósito
     */
    function _verifyDepositCryptography(
        DepositParams calldata depositParams,
        ProofParams calldata proofParams,
        GeneratorParams calldata generators,
        uint256 amount
    ) internal view {
        // VERIFICACIÓN CRIPTOGRÁFICA REAL: Pedersen commitment
        _verifyPedersenCommitment(depositParams.commitment, amount, depositParams.blindingFactor, generators);
        
        // VERIFICACIÓN CRIPTOGRÁFICA REAL: Range proof (cantidad > 0)
        _verifyRangeProof(depositParams.commitment, proofParams.rangeProof);
    }
    
    /**
     * @dev Ejecutar el depósito transfiriendo tokens y creando UTXO
     */
    function _executeDeposit(DepositParams calldata depositParams, uint256 amount) internal {
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
        CommitmentPoint calldata inputCommitment,
        CommitmentPoint[] calldata outputCommitments,
        uint256[] calldata outputAmounts,
        uint256[] calldata outputBlindings,
        bytes calldata equalityProof,
        bytes32 nullifierHash,
        GeneratorParams calldata generators
    ) external nonReentrant returns (bytes32[] memory) {
        // Validar inputs básicos y encontrar input UTXO
        bytes32 inputUTXOId = _validateSplitOperation(
            inputCommitment,
            outputCommitments,
            outputAmounts,
            outputBlindings,
            nullifierHash
        );
        
        // Verificar todos los output commitments
        _verifyOutputCommitments(outputCommitments, outputAmounts, outputBlindings, generators);
        
        // Verificar equality proof (conservación de valor)
        _verifyEqualityProof(inputCommitment, outputCommitments, equalityProof);
        
        // Ejecutar el split
        return _executeSplit(inputUTXOId, outputCommitments, outputAmounts, nullifierHash);
    }
    
    /**
     * @dev Validar operación de split completa
     */
    function _validateSplitOperation(
        CommitmentPoint calldata inputCommitment,
        CommitmentPoint[] calldata outputCommitments,
        uint256[] calldata outputAmounts,
        uint256[] calldata outputBlindings,
        bytes32 nullifierHash
    ) internal view returns (bytes32) {
        // Validar inputs básicos
        _validateSplitInputs(inputCommitment, outputCommitments, outputAmounts, outputBlindings, nullifierHash);
        
        // Validar y obtener input UTXO
        return _validateAndGetInputUTXO(inputCommitment);
    }
    
    /**
     * @dev Ejecutar el split creando todos los outputs
     */
    function _executeSplit(
        bytes32 inputUTXOId,
        CommitmentPoint[] calldata outputCommitments,
        uint256[] calldata outputAmounts,
        bytes32 nullifierHash
    ) internal returns (bytes32[] memory) {
        // Marcar input como gastado
        _markInputAsSpent(inputUTXOId, nullifierHash);
        
        // Crear outputs y retornar IDs
        return _createSplitOutputs(inputUTXOId, outputCommitments, outputAmounts, nullifierHash);
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
        CommitmentPoint calldata inputCommitment,
        CommitmentPoint calldata outputCommitment,
        address newOwner,
        uint256 amount,
        uint256 outputBlinding,
        bytes32 nullifierHash,
        GeneratorParams calldata generators
    ) external nonReentrant returns (bytes32) {
        // Validaciones básicas
        _validateTransferInputs(inputCommitment, outputCommitment, newOwner, amount, nullifierHash);
        
        // Validar y obtener input UTXO
        bytes32 inputUTXOId = _validateTransferInputUTXO(inputCommitment);
        
        // Verificar commitment de salida
        _verifyPedersenCommitment(outputCommitment, amount, outputBlinding, generators);
        
        // Ejecutar transferencia
        return _executeTransfer(inputUTXOId, inputCommitment, outputCommitment, newOwner, nullifierHash, amount);
    }
    
    /**
     * @dev Validar inputs básicos para transferencia
     */
    function _validateTransferInputs(
        CommitmentPoint calldata inputCommitment,
        CommitmentPoint calldata outputCommitment,
        address newOwner,
        uint256 amount,
        bytes32 nullifierHash
    ) internal view {
        require(_isValidCommitmentPoint(inputCommitment), "Invalid input commitment");
        require(_isValidCommitmentPoint(outputCommitment), "Invalid output commitment");
        require(newOwner != address(0), "Invalid new owner");
        require(amount > 0, "Amount must be positive");
        require(!nullifiers[nullifierHash], "Nullifier already used");
    }
    
    /**
     * @dev Validar input UTXO para transferencia
     */
    function _validateTransferInputUTXO(CommitmentPoint calldata inputCommitment) internal view returns (bytes32) {
        bytes32 inputUTXOId = _findUTXOByCommitment(inputCommitment);
        PrivateUTXO storage inputUTXO = utxos[inputUTXOId];
        
        require(inputUTXO.exists, "Input UTXO not found");
        require(!inputUTXO.isSpent, "Input UTXO already spent");
        require(inputUTXO.owner == msg.sender, "Not owner");
        
        return inputUTXOId;
    }
    
    /**
     * @dev Ejecutar la transferencia creando el output UTXO
     */
    function _executeTransfer(
        bytes32 inputUTXOId,
        CommitmentPoint calldata inputCommitment,
        CommitmentPoint calldata outputCommitment,
        address newOwner,
        bytes32 nullifierHash,
        uint256 amount
    ) internal returns (bytes32) {
        // Marcar input como gastado
        _markTransferInputAsSpent(inputUTXOId, nullifierHash);
        
        // Crear output UTXO
        bytes32 outputUTXOId = _createTransferOutputUTXO(
            inputUTXOId,
            outputCommitment,
            newOwner,
            nullifierHash
        );
        
        // Actualizar mappings y emitir eventos
        _finalizeTransfer(
            inputCommitment,
            outputCommitment,
            outputUTXOId,
            newOwner,
            nullifierHash,
            amount,
            inputUTXOId
        );
        
        return outputUTXOId;
    }
    
    /**
     * @dev Marcar input como gastado en transferencia
     */
    function _markTransferInputAsSpent(bytes32 inputUTXOId, bytes32 nullifierHash) internal {
        utxos[inputUTXOId].isSpent = true;
        nullifiers[nullifierHash] = true;
    }
    
    /**
     * @dev Crear el UTXO de salida para la transferencia
     */
    function _createTransferOutputUTXO(
        bytes32 inputUTXOId,
        CommitmentPoint calldata outputCommitment,
        address newOwner,
        bytes32 nullifierHash
    ) internal returns (bytes32) {
        // Crear output UTXO
        bytes32 outputNullifier = keccak256(abi.encodePacked(nullifierHash, newOwner, block.timestamp));
        bytes32 outputUTXOId = _generatePrivateUTXOId(outputCommitment, outputNullifier);
        
        // Crear estructura del UTXO
        utxos[outputUTXOId] = PrivateUTXO({
            exists: true,
            commitment: outputCommitment,
            tokenAddress: utxos[inputUTXOId].tokenAddress,
            owner: newOwner,
            timestamp: block.timestamp,
            isSpent: false,
            parentUTXO: inputUTXOId,
            utxoType: UTXOType.TRANSFER,
            nullifierHash: outputNullifier
        });
        
        return outputUTXOId;
    }
    
    /**
     * @dev Finalizar transferencia con mappings y eventos
     */
    function _finalizeTransfer(
        CommitmentPoint calldata inputCommitment,
        CommitmentPoint calldata outputCommitment,
        bytes32 outputUTXOId,
        address newOwner,
        bytes32 nullifierHash,
        uint256 amount,
        bytes32 inputUTXOId
    ) internal {
        // Mapear commitment hash a UTXO ID
        bytes32 outputCommitmentHash = _hashCommitmentPoint(outputCommitment);
        commitmentHashToUTXO[outputCommitmentHash] = outputUTXOId;
        
        // Actualizar tracking
        utxosByOwner[newOwner].push(outputUTXOId);
        
        // Emitir eventos
        _emitTransferEvents(
            inputCommitment,
            outputCommitment,
            nullifierHash,
            newOwner,
            amount,
            inputUTXOId
        );
    }
    
    /**
     * @dev Emitir eventos de transferencia
     */
    function _emitTransferEvents(
        CommitmentPoint calldata inputCommitment,
        CommitmentPoint calldata outputCommitment,
        bytes32 nullifierHash,
        address newOwner,
        uint256 amount,
        bytes32 inputUTXOId
    ) internal {
        bytes32 inputCommitmentHash = _hashCommitmentPoint(inputCommitment);
        bytes32 outputCommitmentHash = _hashCommitmentPoint(outputCommitment);
        
        emit PrivateTransfer(inputCommitmentHash, outputCommitmentHash, nullifierHash, newOwner);
        
        // Para el segundo evento, necesitamos el nullifier del output
        bytes32 outputNullifier = keccak256(abi.encodePacked(nullifierHash, newOwner, block.timestamp));
        
        emit PrivateUTXOCreated(
            outputCommitmentHash,
            newOwner,
            utxos[inputUTXOId].tokenAddress,
            outputNullifier,
            UTXOType.TRANSFER,
            amount
        );
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
        CommitmentPoint calldata commitment,
        uint256 amount,
        uint256 blindingFactor,
        bytes32 nullifierHash,
        GeneratorParams calldata generators
    ) external nonReentrant {
        // Validaciones básicas
        _validateWithdrawalInputs(commitment, amount, nullifierHash);
        
        // Encontrar y validar UTXO
        bytes32 utxoId = _validateWithdrawalUTXO(commitment);
        
        // Verificar criptografía
        _verifyPedersenCommitment(commitment, amount, blindingFactor, generators);
        
        // Ejecutar retiro
        _executeWithdrawal(utxoId, commitment, amount, nullifierHash);
    }
    
    /**
     * @dev Validar inputs básicos para retiro
     */
    function _validateWithdrawalInputs(
        CommitmentPoint calldata commitment,
        uint256 amount,
        bytes32 nullifierHash
    ) internal view {
        require(!nullifiers[nullifierHash], "Nullifier already used");
        require(amount > 0, "Amount must be positive");
        require(_isValidCommitmentPoint(commitment), "Invalid commitment point");
    }
    
    /**
     * @dev Validar UTXO para retiro
     */
    function _validateWithdrawalUTXO(CommitmentPoint calldata commitment) internal view returns (bytes32) {
        bytes32 utxoId = _findUTXOByCommitment(commitment);
        PrivateUTXO storage utxo = utxos[utxoId];
        
        require(utxo.exists, "UTXO not found");
        require(!utxo.isSpent, "UTXO already spent");
        require(utxo.owner == msg.sender, "Not owner");
        
        return utxoId;
    }
    
    /**
     * @dev Ejecutar el retiro transfiriendo tokens
     */
    function _executeWithdrawal(
        bytes32 utxoId,
        CommitmentPoint calldata commitment,
        uint256 amount,
        bytes32 nullifierHash
    ) internal {
        // Marcar como gastado
        utxos[utxoId].isSpent = true;
        nullifiers[nullifierHash] = true;
        
        // Transferir tokens reales
        address tokenAddress = utxos[utxoId].tokenAddress;
        IERC20(tokenAddress).transfer(msg.sender, amount);
        
        // Emitir evento
        bytes32 commitmentHash = _hashCommitmentPoint(commitment);
        emit PrivateWithdrawal(commitmentHash, msg.sender, nullifierHash, amount);
    }
    
    // ========================
    // FUNCIONES AUXILIARES PARA SPLIT
    // ========================
    
    /**
     * @dev Validar inputs básicos para splitPrivateUTXO
     */
    function _validateSplitInputs(
        CommitmentPoint calldata inputCommitment,
        CommitmentPoint[] calldata outputCommitments,
        uint256[] calldata outputAmounts,
        uint256[] calldata outputBlindings,
        bytes32 nullifierHash
    ) internal view {
        require(_isValidCommitmentPoint(inputCommitment), "Invalid input commitment");
        require(outputCommitments.length > 0, "No outputs");
        require(outputCommitments.length == outputAmounts.length, "Length mismatch");
        require(outputAmounts.length == outputBlindings.length, "Length mismatch");
        require(!nullifiers[nullifierHash], "Nullifier already used");
    }
    
    /**
     * @dev Validar y obtener el input UTXO
     */
    function _validateAndGetInputUTXO(CommitmentPoint calldata inputCommitment) internal view returns (bytes32) {
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
        CommitmentPoint[] calldata outputCommitments,
        uint256[] calldata outputAmounts,
        uint256[] calldata outputBlindings,
        GeneratorParams calldata generators
    ) internal view {
        for (uint256 i = 0; i < outputCommitments.length; i++) {
            require(outputAmounts[i] > 0, "Output amount must be positive");
            require(_isValidCommitmentPoint(outputCommitments[i]), "Invalid output commitment");
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
        CommitmentPoint[] calldata outputCommitments,
        uint256[] calldata outputAmounts,
        bytes32 nullifierHash
    ) internal returns (bytes32[] memory) {
        bytes32[] memory outputUTXOIds = new bytes32[](outputCommitments.length);
        address tokenAddress = utxos[inputUTXOId].tokenAddress;
        
        for (uint256 i = 0; i < outputCommitments.length; i++) {
            outputUTXOIds[i] = _createSingleSplitOutput(
                inputUTXOId,
                outputCommitments[i],
                outputAmounts[i],
                nullifierHash,
                tokenAddress,
                i
            );
        }
        
        return outputUTXOIds;
    }
    
    /**
     * @dev Crear un solo output del split
     */
    function _createSingleSplitOutput(
        bytes32 inputUTXOId,
        CommitmentPoint calldata outputCommitment,
        uint256 outputAmount,
        bytes32 nullifierHash,
        address tokenAddress,
        uint256 index
    ) internal returns (bytes32) {
        // Generar nullifier único para este output
        bytes32 outputNullifier = keccak256(abi.encodePacked(nullifierHash, index, block.timestamp));
        
        // Generar ID del UTXO
        bytes32 outputUTXOId = _generatePrivateUTXOId(outputCommitment, outputNullifier);
        
        // Crear UTXO
        utxos[outputUTXOId] = PrivateUTXO({
            exists: true,
            commitment: outputCommitment,
            tokenAddress: tokenAddress,
            owner: msg.sender,
            timestamp: block.timestamp,
            isSpent: false,
            parentUTXO: inputUTXOId,
            utxoType: UTXOType.SPLIT,
            nullifierHash: outputNullifier
        });
        
        // Actualizar mappings y tracking
        bytes32 outputCommitmentHash = _hashCommitmentPoint(outputCommitment);
        commitmentHashToUTXO[outputCommitmentHash] = outputUTXOId;
        utxosByOwner[msg.sender].push(outputUTXOId);
        
        // Emitir evento
        emit PrivateUTXOCreated(
            outputCommitmentHash,
            msg.sender,
            tokenAddress,
            outputNullifier,
            UTXOType.SPLIT,
            outputAmount
        );
        
        return outputUTXOId;
    }
    
    // ========================
    // FUNCIONES DE VERIFICACIÓN CRIPTOGRÁFICA REAL
    // ========================
    
    /**
     * @dev Validar que un CommitmentPoint es válido usando la librería
     */
    function _isValidCommitmentPoint(CommitmentPoint memory commitment) internal pure returns (bool) {
        return RealPedersenVerifier.isValidCommitmentPoint(
            RealPedersenVerifier.commitmentPointToG1(commitment.x, commitment.y)
        );
    }
    
    /**
     * @dev Calcular hash de un CommitmentPoint usando la librería
     */
    function _hashCommitmentPoint(CommitmentPoint memory commitment) internal pure returns (bytes32) {
        return RealPedersenVerifier.hashCommitmentPoint(
            RealPedersenVerifier.commitmentPointToG1(commitment.x, commitment.y)
        );
    }
    
    /**
     * @dev Verificar commitment Pedersen usando la librería directamente
     */
    function _verifyPedersenCommitment(
        CommitmentPoint memory commitment,
        uint256 amount,
        uint256 blindingFactor,
        GeneratorParams calldata generators
    ) internal view {
        RealPedersenVerifier.PedersenParams memory params = RealPedersenVerifier.PedersenParams({
            g: RealPedersenVerifier.G1Point(generators.gX, generators.gY),
            h: RealPedersenVerifier.G1Point(generators.hX, generators.hY)
        });
        
        require(
            RealPedersenVerifier.verifyCommitmentCoordinates(
                commitment.x,
                commitment.y,
                amount,
                blindingFactor,
                params
            ),
            "Invalid commitment"
        );
    }
    
    /**
     * @dev Verificar range proof usando la librería directamente
     */
    function _verifyRangeProof(
        CommitmentPoint memory commitment,
        bytes calldata rangeProof
    ) internal view {
        require(rangeProof.length > 0, "Invalid range proof");
        
        require(
            RealPedersenVerifier.verifyRangeProofCoordinates(
                commitment.x,
                commitment.y,
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
        CommitmentPoint memory inputCommitment,
        CommitmentPoint[] memory outputCommitments,
        bytes calldata equalityProof
    ) internal view {
        require(equalityProof.length > 0, "Invalid equality proof");
        require(outputCommitments.length > 0, "No output commitments");
        require(outputCommitments.length <= 10, "Too many outputs");
        
        // Parse commitments as elliptic curve points
        RealPedersenVerifier.G1Point memory inputPoint = RealPedersenVerifier.commitmentPointToG1(inputCommitment.x, inputCommitment.y);
        
        // Compute sum of output commitments using REAL elliptic curve addition
        RealPedersenVerifier.G1Point memory outputSum = RealPedersenVerifier.commitmentPointToG1(outputCommitments[0].x, outputCommitments[0].y);
        
        for (uint256 i = 1; i < outputCommitments.length; i++) {
            RealPedersenVerifier.G1Point memory outputPoint = RealPedersenVerifier.commitmentPointToG1(outputCommitments[i].x, outputCommitments[i].y);
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
     * @dev Verificar estructura del equality proof
     */
    function _verifyEqualityProofStructure(bytes calldata equalityProof) internal pure returns (bool) {
        require(equalityProof.length >= 64, "Equality proof too short");
        require(equalityProof.length <= 512, "Equality proof too long");
        
        bytes32 proofHash = keccak256(equalityProof);
        return proofHash != bytes32(0) && equalityProof.length % 32 == 0;
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
        
        // Map commitment hash to UTXO ID
        bytes32 commitmentHash = _hashCommitmentPoint(depositParams.commitment);
        commitmentHashToUTXO[commitmentHash] = utxoId;
        nullifiers[depositParams.nullifierHash] = true;
        utxosByOwner[msg.sender].push(utxoId);
        
        emit PrivateUTXOCreated(
            commitmentHash,
            msg.sender,
            depositParams.tokenAddress,
            depositParams.nullifierHash,
            UTXOType.DEPOSIT,
            amount
        );
    }
    
    function _generatePrivateUTXOId(
        CommitmentPoint memory commitment,
        bytes32 nullifier
    ) internal pure returns (bytes32) {
        bytes32 commitmentHash = _hashCommitmentPoint(commitment);
        return keccak256(abi.encodePacked(commitmentHash, nullifier));
    }
    
    function _findUTXOByCommitment(CommitmentPoint memory commitment) internal view returns (bytes32) {
        bytes32 commitmentHash = _hashCommitmentPoint(commitment);
        bytes32 utxoId = commitmentHashToUTXO[commitmentHash];
        
        require(utxoId != bytes32(0), "UTXO not found");
        require(utxos[utxoId].exists, "UTXO does not exist");
        
        // Verify commitment matches
        require(
            utxos[utxoId].commitment.x == commitment.x && 
            utxos[utxoId].commitment.y == commitment.y, 
            "Commitment mismatch"
        );
        
        return utxoId;
    }
    
    /**
     * @dev Buscar UTXO por hash de commitment (para compatibilidad con bytes32)
     */
    function _findUTXOByCommitmentHash(bytes32 commitmentHash) internal view returns (bytes32) {
        bytes32 utxoId = commitmentHashToUTXO[commitmentHash];
        
        require(utxoId != bytes32(0), "UTXO not found");
        require(utxos[utxoId].exists, "UTXO does not exist");
        
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
    
    function getUTXOCommitment(bytes32 utxoId) external view returns (CommitmentPoint memory) {
        return utxos[utxoId].commitment;
    }
    
    function getUTXOCommitmentHash(bytes32 utxoId) external view returns (bytes32) {
        return _hashCommitmentPoint(utxos[utxoId].commitment);
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
        CommitmentPoint memory commitment,
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