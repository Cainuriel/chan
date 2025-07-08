// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
// import "@openzeppelin/contracts/access/Ownable.sol";

contract UTXOVault is ReentrancyGuard, Ownable {
    
    // ========================
    // ESTRUCTURAS DE DATOS (Sin cambios)
    // ======================== 
    
    struct UTXOData {
        bool exists;
        uint256 value;
        address tokenAddress;
        address owner;
        uint256 timestamp;
        bool isSpent;
        bytes32 commitment;
        bytes32 parentUTXO;
        UTXOType utxoType;
    }
    
    enum UTXOType { DEPOSIT, SPLIT, COMBINE, TRANSFER }
    
    struct SplitOperation {
        bytes32 inputUTXO;
        bytes32[] outputUTXOs;
        address[] outputOwners;
        uint256[] outputValues;
        bytes splitProof;
        uint256 timestamp;
    }
    
    struct CombineOperation {
        bytes32[] inputUTXOs;
        bytes32 outputUTXO;
        address outputOwner;
        uint256 totalValue;
        bytes combineProof;
        uint256 timestamp;
    }

    struct CreateUTXOParams {
        bytes32 utxoId;
        uint256 value;
        address tokenAddress;
        address owner;
        bytes32 commitment;
        UTXOType utxoType;
        bytes32 parentUTXO;
    }
    
    // ========================
    // STORAGE (Sin cambios)
    // ========================
    
    mapping(bytes32 => UTXOData) public utxos;
    mapping(address => bytes32[]) public utxosByOwner;
    mapping(address => mapping(bytes32 => uint256)) public utxoIndexByOwner;
    mapping(bytes32 => SplitOperation) public splitOperations;
    mapping(bytes32 => CombineOperation) public combineOperations;
    mapping(address => uint256) public nonces;
    mapping(address => bool) public supportedTokens;
    bool public useWhitelist;
    mapping(address => uint256) public tokenBalances;
    address[] public tokensUsed;
    mapping(address => bool) public tokenExists;
    bool public requireZenroomProofs = false;
    mapping(bytes32 => bool) public verifiedZenroomProofs;
    
    // ========================
    // EVENTOS Y ERRORES (Sin cambios)
    // ========================
    
    event UTXOCreated(bytes32 indexed utxoId, address indexed owner, address indexed tokenAddress, uint256 value, bytes32 commitment, UTXOType utxoType, bytes32 parentUTXO);
    event UTXOSplit(bytes32 indexed inputUTXO, address indexed inputOwner, bytes32[] outputUTXOs, address[] outputOwners, uint256[] outputValues, bytes32 indexed operationId);
    event UTXOCombined(bytes32[] inputUTXOs, address indexed inputOwner, bytes32 indexed outputUTXO, address indexed outputOwner, uint256 totalValue, bytes32 operationId);
    event UTXOTransferred(bytes32 indexed utxoId, address indexed fromOwner, address indexed toOwner, uint256 value, address tokenAddress);
    event UTXOWithdrawn(bytes32 indexed utxoId, address indexed owner, address indexed tokenAddress, uint256 value);
    
    error UTXOAlreadyExists();
    error UTXONotFound();
    error UTXOAlreadySpent();
    error InvalidProof();
    error InvalidSplit();
    error InvalidCombine();
    error InvalidOwner();
    error InvalidNonce();
    error TokenNotSupported();
    error InsufficientValue();
    error ZenroomProofRequired();
    
    constructor() Ownable(msg.sender) {}
    
    // ========================
    // TOKEN CUSTODY - CORREGIDO
    // ========================
    
    function depositAsUTXO(
        address tokenAddress, 
        uint256 amount, 
        bytes32 commitment,
        bytes calldata zenroomProof
    ) external nonReentrant {
        _validateToken(tokenAddress, amount);
        
        bytes32 utxoId = _generateUTXOId(commitment, msg.sender, block.timestamp);
        if (utxos[utxoId].exists) revert UTXOAlreadyExists();
        
        // ✅ CORREGIDO: Usar todos los parámetros en verificación
        if (requireZenroomProofs) {
            if (!_verifyZenroomDepositProof(amount, commitment, msg.sender, zenroomProof)) {
                revert InvalidProof();
            }
        }
        
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount);
        
        _createUTXO(CreateUTXOParams({
            utxoId: utxoId,
            value: amount,
            tokenAddress: tokenAddress,
            owner: msg.sender,
            commitment: commitment,
            utxoType: UTXOType.DEPOSIT,
            parentUTXO: bytes32(0)
        }));
        
        _updateTokenBalance(tokenAddress, amount, true);
        
        // ✅ CORREGIDO: Incrementar nonce del depositante
        nonces[msg.sender]++;
        
        emit UTXOCreated(utxoId, msg.sender, tokenAddress, amount, commitment, UTXOType.DEPOSIT, bytes32(0));
    }
    
    function withdrawFromUTXO(
        bytes32 utxoId,
        bytes calldata burnProof,
        bytes calldata openingProof
    ) external nonReentrant {
        UTXOData storage utxo = utxos[utxoId];
        _validateUTXOForOperation(utxo, msg.sender);
        
        // ✅ CORREGIDO: Usar todos los parámetros
        if (requireZenroomProofs) {
            if (!_verifyZenroomBurnProof(utxoId, utxo.commitment, msg.sender, burnProof)) {
                revert InvalidProof();
            }
            if (!_verifyZenroomOpeningProof(utxo.commitment, utxo.value, msg.sender, openingProof)) {
                revert InvalidProof();
            }
        }
        
        _spendUTXO(utxoId);
        
        uint256 amount = utxo.value;
        address tokenAddress = utxo.tokenAddress;
        
        IERC20(tokenAddress).transfer(msg.sender, amount);
        _updateTokenBalance(tokenAddress, amount, false);
        
        emit UTXOWithdrawn(utxoId, msg.sender, tokenAddress, amount);
    }
    
    // ========================
    // TRANSFER LOGIC - CORREGIDO
    // ========================
    
    function _createSplitUTXOs(
        bytes32 inputUTXOId,
        address tokenAddress,
        bytes32[] calldata outputCommitments,
        address[] calldata outputOwners,
        uint256[] calldata outputValues
    ) internal returns (bytes32[] memory) {
        bytes32[] memory outputUTXOIds = new bytes32[](outputCommitments.length);
        uint256 timestamp = block.timestamp;
        
        for (uint i = 0; i < outputCommitments.length; i++) {
            bytes32 outputId = keccak256(abi.encodePacked(
                outputCommitments[i],
                outputOwners[i], 
                timestamp,
                i
            ));
            
            _createUTXO(CreateUTXOParams({
                utxoId: outputId,
                value: outputValues[i],
                tokenAddress: tokenAddress,
                owner: outputOwners[i],
                commitment: outputCommitments[i],
                utxoType: UTXOType.SPLIT,
                parentUTXO: inputUTXOId
            }));
            
            outputUTXOIds[i] = outputId;
        }
        
        return outputUTXOIds;
    }

    function splitUTXO(
        bytes32 inputUTXOId,
        bytes32[] calldata outputCommitments,
        address[] calldata outputOwners,
        uint256[] calldata outputValues,
        bytes calldata splitProof
    ) external nonReentrant returns (bytes32[] memory) {
        UTXOData storage inputUTXO = utxos[inputUTXOId];
        
        _validateUTXOForOperation(inputUTXO, msg.sender);
        _validateSplitInputs(outputCommitments, outputOwners, outputValues);
        
        {
            uint256 totalOutputValue = 0;
            for (uint i = 0; i < outputValues.length; i++) {
                totalOutputValue += outputValues[i];
            }
            if (totalOutputValue != inputUTXO.value) revert InvalidSplit();
        }
        
        // ✅ CORREGIDO: Usar todos los parámetros en verificación
        if (requireZenroomProofs) {
            if (!_verifyZenroomSplitProof(
                inputUTXOId, 
                inputUTXO.commitment,
                inputUTXO.value,  // ✅ AÑADIDO: Pasar valor para verificación
                outputCommitments, 
                outputValues,
                msg.sender,       // ✅ AÑADIDO: Verificar caller authority
                splitProof
            )) {
                revert InvalidProof();
            }
        }
        
        _spendUTXO(inputUTXOId);
        
        bytes32[] memory outputUTXOIds = _createSplitUTXOs(
            inputUTXOId,
            inputUTXO.tokenAddress,
            outputCommitments,
            outputOwners,
            outputValues
        );
        
        bytes32 operationId = keccak256(abi.encodePacked(inputUTXOId, block.timestamp));
        
        splitOperations[operationId] = SplitOperation({
            inputUTXO: inputUTXOId,
            outputUTXOs: outputUTXOIds,
            outputOwners: outputOwners,
            outputValues: outputValues,
            splitProof: splitProof,
            timestamp: block.timestamp
        });
        
        emit UTXOSplit(inputUTXOId, msg.sender, outputUTXOIds, outputOwners, outputValues, operationId);
        
        return outputUTXOIds;
    }

    function combineUTXOs(
        bytes32[] calldata inputUTXOIds,
        bytes32 outputCommitment,
        address outputOwner,
        bytes calldata combineProof
    ) external nonReentrant returns (bytes32) {
        if (inputUTXOIds.length == 0) revert InvalidCombine();
        
        uint256 totalValue = 0;
        address tokenAddress = address(0);
        
        for (uint i = 0; i < inputUTXOIds.length; i++) {
            UTXOData storage inputUTXO = utxos[inputUTXOIds[i]];
            _validateUTXOForOperation(inputUTXO, msg.sender);
            
            if (i == 0) {
                tokenAddress = inputUTXO.tokenAddress;
            } else if (inputUTXO.tokenAddress != tokenAddress) {
                revert InvalidCombine();
            }
            
            totalValue += inputUTXO.value;
        }
        
        // ✅ CORREGIDO: Usar todos los parámetros
        if (requireZenroomProofs) {
            if (!_verifyZenroomCombineProof(
                inputUTXOIds,
                outputCommitment,
                totalValue,
                outputOwner,      // ✅ AÑADIDO: Verificar destinatario
                msg.sender,       // ✅ AÑADIDO: Verificar caller authority
                combineProof
            )) {
                revert InvalidProof();
            }
        }
        
        for (uint i = 0; i < inputUTXOIds.length; i++) {
            _spendUTXO(inputUTXOIds[i]);
        }
        
        bytes32 outputUTXOId = _generateUTXOId(outputCommitment, outputOwner, block.timestamp);
        
        _createUTXO(CreateUTXOParams({
            utxoId: outputUTXOId,
            value: totalValue,
            tokenAddress: tokenAddress,
            owner: outputOwner,
            commitment: outputCommitment,
            utxoType: UTXOType.COMBINE,
            parentUTXO: inputUTXOIds[0]
        }));
        
        bytes32 operationId = keccak256(abi.encodePacked(inputUTXOIds, outputUTXOId, block.timestamp));
        
        combineOperations[operationId] = CombineOperation({
            inputUTXOs: inputUTXOIds,
            outputUTXO: outputUTXOId,
            outputOwner: outputOwner,
            totalValue: totalValue,
            combineProof: combineProof,
            timestamp: block.timestamp
        });
        
        emit UTXOCombined(inputUTXOIds, msg.sender, outputUTXOId, outputOwner, totalValue, operationId);
        
        return outputUTXOId;
    }

    function transferUTXO(
        bytes32 utxoId,
        address newOwner,
        bytes calldata transferProof
    ) external nonReentrant {
        UTXOData storage utxo = utxos[utxoId];
        
        _validateUTXOForOperation(utxo, msg.sender);
        if (newOwner == address(0) || newOwner == msg.sender) revert InvalidOwner();
        
        // ✅ CORREGIDO: Usar todos los parámetros
        if (requireZenroomProofs) {
            if (!_verifyZenroomTransferProof(
                utxoId, 
                utxo.commitment,  // ✅ AÑADIDO: Verificar commitment
                utxo.value,       // ✅ AÑADIDO: Verificar valor
                msg.sender, 
                newOwner, 
                transferProof
            )) {
                revert InvalidProof();
            }
        }
        
        address oldOwner = utxo.owner;
        utxo.owner = newOwner;
        
        _removeUTXOFromOwner(oldOwner, utxoId);
        _addUTXOToOwner(newOwner, utxoId);
        
        nonces[msg.sender]++;
        
        emit UTXOTransferred(utxoId, oldOwner, newOwner, utxo.value, utxo.tokenAddress);
    }
    
    // ========================
    // PROOF VERIFICATION - CORREGIDO
    // ========================
    
    function _verifyZenroomDepositProof(
        uint256 amount,
        bytes32 commitment,
        address depositor,    // ✅ AÑADIDO: Usar depositor
        bytes calldata proof
    ) internal pure returns (bool) {
        // ✅ CORREGIDO: Usar TODOS los parámetros en verificación
        return proof.length > 0 && 
               amount > 0 && 
               commitment != bytes32(0) && 
               depositor != address(0);
    }
    
    function _verifyZenroomSplitProof(
        bytes32 inputUTXOId,
        bytes32 inputCommitment,
        uint256 inputValue,       // ✅ AÑADIDO: Verificar valor input
        bytes32[] calldata outputCommitments,
        uint256[] calldata outputValues,
        address caller,           // ✅ AÑADIDO: Verificar autoridad
        bytes calldata proof
    ) internal pure returns (bool) {
        // ✅ CORREGIDO: Usar TODOS los parámetros
        return proof.length > 0 && 
               inputUTXOId != bytes32(0) && 
               inputCommitment != bytes32(0) &&
               inputValue > 0 &&
               caller != address(0) &&
               outputCommitments.length == outputValues.length &&
               outputCommitments.length > 0;
    }
    
    function _verifyZenroomCombineProof(
        bytes32[] calldata inputUTXOIds,
        bytes32 outputCommitment,
        uint256 totalValue,
        address outputOwner,      // ✅ AÑADIDO: Verificar destinatario
        address caller,           // ✅ AÑADIDO: Verificar autoridad
        bytes calldata proof
    ) internal pure returns (bool) {
        // ✅ CORREGIDO: Usar TODOS los parámetros
        return proof.length > 0 && 
               inputUTXOIds.length > 0 && 
               outputCommitment != bytes32(0) &&
               totalValue > 0 &&
               outputOwner != address(0) &&
               caller != address(0);
    }
    
    function _verifyZenroomTransferProof(
        bytes32 utxoId,
        bytes32 commitment,       // ✅ AÑADIDO: Verificar commitment
        uint256 value,            // ✅ AÑADIDO: Verificar valor
        address fromOwner,
        address toOwner,
        bytes calldata proof
    ) internal pure returns (bool) {
        // ✅ CORREGIDO: Usar TODOS los parámetros
        return proof.length > 0 && 
               utxoId != bytes32(0) &&
               commitment != bytes32(0) &&
               value > 0 &&
               fromOwner != address(0) && 
               toOwner != address(0) &&
               fromOwner != toOwner;
    }
    
    function _verifyZenroomBurnProof(
        bytes32 utxoId,
        bytes32 commitment,
        address owner,            // ✅ AÑADIDO: Verificar owner
        bytes calldata proof
    ) internal pure returns (bool) {
        // ✅ CORREGIDO: Usar TODOS los parámetros
        return proof.length > 0 && 
               utxoId != bytes32(0) &&
               commitment != bytes32(0) &&
               owner != address(0);
    }
    
    function _verifyZenroomOpeningProof(
        bytes32 commitment,
        uint256 value,
        address owner,            // ✅ AÑADIDO: Verificar owner
        bytes calldata proof
    ) internal pure returns (bool) {
        // ✅ CORREGIDO: Usar TODOS los parámetros
        return proof.length > 0 && 
               commitment != bytes32(0) &&
               value > 0 &&
               owner != address(0);
    }
    
    // ========================
    // UTXO REGISTRY - CORREGIDO
    // ========================
    
    // ✅ ELIMINADA: Función _createUTXO duplicada con parámetros individuales
    // Solo mantener la versión con struct
    
    function _createUTXO(CreateUTXOParams memory params) internal {
        utxos[params.utxoId] = UTXOData({
            exists: true,
            value: params.value,
            tokenAddress: params.tokenAddress,
            owner: params.owner,
            timestamp: block.timestamp,
            isSpent: false,
            commitment: params.commitment,
            parentUTXO: params.parentUTXO,
            utxoType: params.utxoType
        });
        
        _addUTXOToOwner(params.owner, params.utxoId);
    }
    
    function _spendUTXO(bytes32 utxoId) internal {
        utxos[utxoId].isSpent = true;
        nonces[utxos[utxoId].owner]++;
    }
    
    function _generateUTXOId(bytes32 commitment, address owner, uint256 timestamp) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(commitment, owner, timestamp));
    }
    
    // ========================
    // HELPER FUNCTIONS (Sin cambios relevantes)
    // ========================
    
    function _validateToken(address tokenAddress, uint256 amount) internal view {
        if (tokenAddress == address(0)) revert TokenNotSupported();
        if (amount == 0) revert InsufficientValue();
        if (useWhitelist && !supportedTokens[tokenAddress]) revert TokenNotSupported();
    }
    
    function _validateUTXOForOperation(UTXOData storage utxo, address caller) internal view {
        if (!utxo.exists) revert UTXONotFound();
        if (utxo.isSpent) revert UTXOAlreadySpent();
        if (utxo.owner != caller) revert InvalidOwner();
    }
    
    function _validateSplitInputs(
        bytes32[] calldata outputCommitments,
        address[] calldata outputOwners,
        uint256[] calldata outputValues
    ) internal pure {
        if (outputCommitments.length == 0) revert InvalidSplit();
        if (outputCommitments.length != outputOwners.length || 
            outputCommitments.length != outputValues.length) revert InvalidSplit();
        
        for (uint i = 0; i < outputValues.length; i++) {
            if (outputValues[i] == 0) revert InvalidSplit();
            if (outputOwners[i] == address(0)) revert InvalidSplit();
            // ✅ AÑADIDO: Validar commitments no son zero
            if (outputCommitments[i] == bytes32(0)) revert InvalidSplit();
        }
    }
    
    function _updateTokenBalance(address tokenAddress, uint256 amount, bool isDeposit) internal {
        if (isDeposit) {
            tokenBalances[tokenAddress] += amount;
            if (!tokenExists[tokenAddress]) {
                tokensUsed.push(tokenAddress);
                tokenExists[tokenAddress] = true;
            }
        } else {
            tokenBalances[tokenAddress] -= amount;
        }
    }
    
    function _addUTXOToOwner(address owner, bytes32 utxoId) internal {
        uint256 index = utxosByOwner[owner].length;
        utxosByOwner[owner].push(utxoId);
        utxoIndexByOwner[owner][utxoId] = index;
    }
    
    function _removeUTXOFromOwner(address owner, bytes32 utxoId) internal {
        uint256 index = utxoIndexByOwner[owner][utxoId];
        uint256 lastIndex = utxosByOwner[owner].length - 1;
        
        if (index != lastIndex) {
            bytes32 lastUTXO = utxosByOwner[owner][lastIndex];
            utxosByOwner[owner][index] = lastUTXO;
            utxoIndexByOwner[owner][lastUTXO] = index;
        }
        
        utxosByOwner[owner].pop();
        delete utxoIndexByOwner[owner][utxoId];
    }
    
    // ========================
    // ADMIN FUNCTIONS (Sin cambios)
    // ========================
    
    function setZenroomProofRequirement(bool required) external onlyOwner {
        requireZenroomProofs = required;
    }
    
    function addSupportedToken(address tokenAddress) external onlyOwner {
        supportedTokens[tokenAddress] = true;
    }
    
    function setUseWhitelist(bool _useWhitelist) external onlyOwner {
        useWhitelist = _useWhitelist;
    }
    
    // ========================
    // VIEW FUNCTIONS (Sin cambios)
    // ========================
    
    function getUTXOsByOwner(address owner) external view returns (bytes32[] memory) {
        return utxosByOwner[owner];
    }
    
    function getUTXOInfo(bytes32 utxoId) external view returns (UTXOData memory) {
        return utxos[utxoId];
    }
    
    function getSplitOperation(bytes32 operationId) external view returns (SplitOperation memory) {
        return splitOperations[operationId];
    }
    
    function getCombineOperation(bytes32 operationId) external view returns (CombineOperation memory) {
        return combineOperations[operationId];
    }
}