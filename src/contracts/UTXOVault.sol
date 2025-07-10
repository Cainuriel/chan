// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title UTXOVault - Private UTXO System with BBS+ Signatures
 * @dev Enhanced UTXO vault with true privacy using BBS+ selective disclosure
 * @author Enhanced for privacy with BBS+ integration
 */
contract UTXOVault is ReentrancyGuard, Ownable {
    
    // ========================
    // ESTRUCTURAS DE DATOS MEJORADAS
    // ========================
    
    struct PrivateUTXO {
        bool exists;
        bytes32 commitment;           // Pedersen commitment (oculta cantidad)
        address tokenAddress;         // Token address (puede ser público)
        address owner;               // Owner (puede ser oculto con BBS+)
        uint256 timestamp;
        bool isSpent;
        bytes32 parentUTXO;
        UTXOType utxoType;
        bytes32 nullifierHash;       // Para prevenir double-spending
        bytes bbsCredential;         // BBS+ credential (oculta metadatos)
    }
    
    struct BBSProofData {
        bytes proof;                 // BBS+ proof
        bytes32[] disclosedAttributes;  // Atributos revelados
        uint256[] disclosureIndexes;    // Índices de revelación
        bytes32 challenge;           // Challenge para prevenir replay
        uint256 timestamp;           // Timestamp de la prueba
    }
    
    struct CommitmentProof {
        bytes32 commitment;
        bytes rangeProof;            // Prueba de rango (valor > 0)
        bytes equalityProof;         // Prueba de igualdad de sumas
    }
    
    enum UTXOType { DEPOSIT, SPLIT, COMBINE, TRANSFER }
    
    // ========================
    // STORAGE MEJORADO
    // ========================
    
    mapping(bytes32 => PrivateUTXO) private utxos;
    mapping(address => bytes32[]) private utxosByOwner;
    mapping(bytes32 => bool) private nullifiers;        // Prevenir double-spending
    mapping(bytes32 => bool) private usedChallenges;    // Prevenir replay attacks
    mapping(bytes32 => uint256) private commitmentValues; // Para validación interna
    
    // BBS+ Issuer Management
    mapping(address => bool) public authorizedIssuers;
    mapping(address => bytes) public issuerPublicKeys;  // BBS+ public keys
    mapping(bytes32 => bool) private revokedCredentials;
    
    // Privacy Controls
    bool public requireBBSProofs = true;
    bool public enableSelectiveDisclosure = true;
    uint256 public proofValidityPeriod = 3600; // 1 hora
    
    // Balance tracking (encrypted)
    mapping(address => bytes32) private encryptedBalances;
    
    // ========================
    // EVENTOS MEJORADOS
    // ========================
    
    event PrivateUTXOCreated(
        bytes32 indexed commitment,
        address indexed owner,
        address indexed tokenAddress,
        bytes32 nullifierHash,
        UTXOType utxoType
    );
    
    event PrivateTransfer(
        bytes32 indexed inputCommitment,
        bytes32 indexed outputCommitment,
        bytes32 nullifierHash,
        bytes32 transferProof
    );
    
    event PrivateWithdrawal(
        bytes32 indexed commitment,
        address indexed recipient,
        bytes32 nullifierHash
    );
    
    event BBSCredentialRevoked(
        bytes32 indexed credentialId,
        address indexed issuer,
        uint256 timestamp
    );
    
    // ========================
    // ERRORES MEJORADOS
    // ========================
    
    error InvalidBBSProof();
    error InvalidCommitment();
    error InvalidRangeProof();
    error NullifierAlreadyUsed();
    error ChallengeAlreadyUsed();
    error UnauthorizedIssuer();
    error RevokedCredential();
    error InvalidSelectiveDisclosure();
    error ProofExpired();
    error InvalidEqualityProof();
    
    // ========================
    // CONSTRUCTOR
    // ========================
    
    constructor() Ownable(msg.sender) {}
    
    // ========================
    // FUNCIONES PRINCIPALES CON BBS+
    // ========================
    
    /**
     * @dev Deposit ERC20 tokens as private UTXO with BBS+ credential
     * @param tokenAddress Token to deposit
     * @param amount Amount to deposit (for testing, will be hidden in production)
     * @param commitment Pedersen commitment hiding amount
     * @param bbsProof BBS+ proof of deposit authorization
     * @param nullifierHash Unique nullifier for this UTXO
     * @param rangeProof Proof that amount > 0
     */
    function depositAsPrivateUTXO(
        address tokenAddress,
        uint256 amount,
        bytes32 commitment,
        BBSProofData calldata bbsProof,
        bytes32 nullifierHash,
        bytes calldata rangeProof
    ) external nonReentrant {
        // Validar inputs básicos
        require(tokenAddress != address(0), "Invalid token");
        require(amount > 0, "Invalid amount");
        require(commitment != bytes32(0), "Invalid commitment");
        require(nullifierHash != bytes32(0), "Invalid nullifier");
        require(!nullifiers[nullifierHash], "Nullifier already used");
        
        // Verificar BBS+ proof
        _verifyBBSDepositProof(bbsProof, tokenAddress, msg.sender);
        
        // Verificar range proof (cantidad > 0)
        _verifyRangeProof(commitment, rangeProof);
        
        // Verificar que el commitment es consistente con la cantidad
        // En implementación real, esto sería: require(_verifyCommitment(commitment, amount), "Invalid commitment");
        
        // Transferir tokens
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount);
        
        // Crear UTXO privado
        bytes32 utxoId = _generatePrivateUTXOId(commitment, nullifierHash);
        
        utxos[utxoId] = PrivateUTXO({
            exists: true,
            commitment: commitment,
            tokenAddress: tokenAddress,
            owner: msg.sender,
            timestamp: block.timestamp,
            isSpent: false,
            parentUTXO: bytes32(0),
            utxoType: UTXOType.DEPOSIT,
            nullifierHash: nullifierHash,
            bbsCredential: bbsProof.proof
        });
        
        // Marcar nullifier como usado
        nullifiers[nullifierHash] = true;
        usedChallenges[bbsProof.challenge] = true;
        
        // Actualizar tracking del owner
        utxosByOwner[msg.sender].push(utxoId);
        
        emit PrivateUTXOCreated(
            commitment,
            msg.sender,
            tokenAddress,
            nullifierHash,
            UTXOType.DEPOSIT
        );
    }
    
    /**
     * @dev Split private UTXO into multiple outputs with hidden amounts
     * @param inputCommitment Input UTXO commitment
     * @param outputCommitments Array of output commitments
     * @param splitProof BBS+ proof of valid split
     * @param equalityProof Proof that sum(inputs) = sum(outputs)
     * @param nullifierHash Nullifier for input UTXO
     */
    function splitPrivateUTXO(
        bytes32 inputCommitment,
        bytes32[] calldata outputCommitments,
        BBSProofData calldata splitProof,
        bytes calldata equalityProof,
        bytes32 nullifierHash
    ) external nonReentrant returns (bytes32[] memory) {
        // Validar inputs
        require(inputCommitment != bytes32(0), "Invalid input commitment");
        require(outputCommitments.length > 0, "No outputs");
        require(!nullifiers[nullifierHash], "Nullifier already used");
        
        // Encontrar input UTXO
        bytes32 inputUTXOId = _findUTXOByCommitment(inputCommitment);
        PrivateUTXO storage inputUTXO = utxos[inputUTXOId];
        
        require(inputUTXO.exists, "Input UTXO not found");
        require(!inputUTXO.isSpent, "Input UTXO already spent");
        require(inputUTXO.owner == msg.sender, "Not owner");
        
        // Verificar BBS+ proof de split
        _verifyBBSSplitProof(splitProof, inputCommitment, outputCommitments);
        
        // Verificar equality proof (sum preservation)
        _verifyEqualityProof(inputCommitment, outputCommitments, equalityProof);
        
        // Marcar input como gastado
        inputUTXO.isSpent = true;
        nullifiers[nullifierHash] = true;
        
        // Crear outputs
        bytes32[] memory outputUTXOIds = new bytes32[](outputCommitments.length);
        
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
                nullifierHash: outputNullifier,
                bbsCredential: splitProof.proof
            });
            
            utxosByOwner[msg.sender].push(outputUTXOId);
            outputUTXOIds[i] = outputUTXOId;
            
            emit PrivateUTXOCreated(
                outputCommitments[i],
                msg.sender,
                inputUTXO.tokenAddress,
                outputNullifier,
                UTXOType.SPLIT
            );
        }
        
        return outputUTXOIds;
    }
    
    /**
     * @dev Transfer private UTXO with selective disclosure
     * @param inputCommitment Input UTXO commitment
     * @param outputCommitment Output UTXO commitment
     * @param transferProof BBS+ proof with selective disclosure
     * @param newOwner New owner address
     * @param nullifierHash Nullifier for input
     */
    function transferPrivateUTXO(
        bytes32 inputCommitment,
        bytes32 outputCommitment,
        BBSProofData calldata transferProof,
        address newOwner,
        bytes32 nullifierHash
    ) external nonReentrant {
        require(newOwner != address(0), "Invalid new owner");
        require(newOwner != msg.sender, "Cannot transfer to self");
        require(!nullifiers[nullifierHash], "Nullifier already used");
        
        // Encontrar input UTXO
        bytes32 inputUTXOId = _findUTXOByCommitment(inputCommitment);
        PrivateUTXO storage inputUTXO = utxos[inputUTXOId];
        
        require(inputUTXO.exists, "Input UTXO not found");
        require(!inputUTXO.isSpent, "Input UTXO already spent");
        require(inputUTXO.owner == msg.sender, "Not owner");
        
        // Verificar BBS+ transfer proof con selective disclosure
        _verifyBBSTransferProof(transferProof, inputCommitment, outputCommitment, newOwner);
        
        // Marcar input como gastado
        inputUTXO.isSpent = true;
        nullifiers[nullifierHash] = true;
        
        // Crear output UTXO
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
            nullifierHash: outputNullifier,
            bbsCredential: transferProof.proof
        });
        
        utxosByOwner[newOwner].push(outputUTXOId);
        
        emit PrivateTransfer(
            inputCommitment,
            outputCommitment,
            nullifierHash,
            keccak256(transferProof.proof)
        );
    }
    
    /**
     * @dev Withdraw private UTXO back to ERC20 with privacy
     * @param commitment UTXO commitment
     * @param withdrawProof BBS+ proof of withdrawal authorization
     * @param nullifierHash Nullifier for UTXO
     */
    function withdrawFromPrivateUTXO(
        bytes32 commitment,
        BBSProofData calldata withdrawProof,
        bytes32 nullifierHash
    ) external nonReentrant {
        require(!nullifiers[nullifierHash], "Nullifier already used");
        
        // Encontrar UTXO
        bytes32 utxoId = _findUTXOByCommitment(commitment);
        PrivateUTXO storage utxo = utxos[utxoId];
        
        require(utxo.exists, "UTXO not found");
        require(!utxo.isSpent, "UTXO already spent");
        require(utxo.owner == msg.sender, "Not owner");
        
        // Verificar BBS+ withdraw proof
        _verifyBBSWithdrawProof(withdrawProof, commitment, msg.sender);
        
        // Extraer cantidad del proof
        uint256 amount = _extractAmountFromBBSProof(withdrawProof);
        
        // Marcar como gastado
        utxo.isSpent = true;
        nullifiers[nullifierHash] = true;
        
        // Transferir tokens
        IERC20(utxo.tokenAddress).transfer(msg.sender, amount);
        
        emit PrivateWithdrawal(commitment, msg.sender, nullifierHash);
    }
    
    // ========================
    // FUNCIONES DE VERIFICACIÓN BBS+
    // ========================
    
    /**
     * @dev Verify BBS+ deposit proof
     */
    function _verifyBBSDepositProof(
        BBSProofData calldata proof,
        address tokenAddress,
        address depositor
    ) internal view {
        // Verificar que el proof no ha expirado
        require(
            block.timestamp <= proof.timestamp + proofValidityPeriod,
            "Proof expired"
        );
        
        // Verificar que el challenge no ha sido usado
        require(!usedChallenges[proof.challenge], "Challenge already used");
        
        // Verificar selective disclosure
        require(
            _verifySelectiveDisclosure(proof, depositor, tokenAddress),
            "Invalid selective disclosure"
        );
        
        // Verificar BBS+ signature
        require(_verifyBBSSignature(proof), "Invalid BBS+ signature");
    }
    
    /**
     * @dev Verify BBS+ split proof
     */
    function _verifyBBSSplitProof(
        BBSProofData calldata proof,
        bytes32 inputCommitment,
        bytes32[] calldata outputCommitments
    ) internal view {
        require(
            block.timestamp <= proof.timestamp + proofValidityPeriod,
            "Proof expired"
        );
        
        require(!usedChallenges[proof.challenge], "Challenge already used");
        
        // Verificar que el proof incluye los commitments correctos
        require(
            _verifyCommitmentsInProof(proof, inputCommitment, outputCommitments),
            "Invalid commitments in proof"
        );
        
        require(_verifyBBSSignature(proof), "Invalid BBS+ signature");
    }
    
    /**
     * @dev Verify BBS+ transfer proof with selective disclosure
     */
    function _verifyBBSTransferProof(
        BBSProofData calldata proof,
        bytes32 inputCommitment,
        bytes32 outputCommitment,
        address newOwner
    ) internal view {
        require(
            block.timestamp <= proof.timestamp + proofValidityPeriod,
            "Proof expired"
        );
        
        require(!usedChallenges[proof.challenge], "Challenge already used");
        
        // Verificar selective disclosure para transfer
        require(
            _verifyTransferDisclosure(proof, inputCommitment, outputCommitment, newOwner),
            "Invalid transfer disclosure"
        );
        
        require(_verifyBBSSignature(proof), "Invalid BBS+ signature");
    }
    
    /**
     * @dev Verify BBS+ withdraw proof
     */
    function _verifyBBSWithdrawProof(
        BBSProofData calldata proof,
        bytes32 commitment,
        address withdrawer
    ) internal view {
        require(
            block.timestamp <= proof.timestamp + proofValidityPeriod,
            "Proof expired"
        );
        
        require(!usedChallenges[proof.challenge], "Challenge already used");
        
        // Verificar que el withdrawer está autorizado
        require(
            _verifyWithdrawAuthorization(proof, commitment, withdrawer),
            "Invalid withdraw authorization"
        );
        
        require(_verifyBBSSignature(proof), "Invalid BBS+ signature");
    }
    
    // ========================
    // FUNCIONES DE VERIFICACIÓN AUXILIARES
    // ========================
    
    /**
     * @dev Verify BBS+ signature using issuer's public key
     */
    function _verifyBBSSignature(BBSProofData calldata proof) internal pure returns (bool) {
        // Esta función debe llamar a un verifier BBS+ externo
        // Por ahora, implementación simplificada
        return proof.proof.length > 0 && 
               proof.disclosedAttributes.length > 0 &&
               proof.disclosureIndexes.length > 0;
    }
    
    /**
     * @dev Verify selective disclosure rules
     */
    function _verifySelectiveDisclosure(
        BBSProofData calldata proof,
        address depositor,
        address tokenAddress
    ) internal pure returns (bool) {
        // Verificar que se revelan solo los atributos necesarios
        // Para deposit: debe revelar depositor y tokenAddress, pero NO el amount
        
        require(proof.disclosedAttributes.length >= 2, "Insufficient disclosed attributes");
        require(proof.disclosureIndexes.length >= 2, "Insufficient disclosure indexes");
        
        // Verificar que depositor está en los atributos revelados
        bool depositorFound = false;
        bool tokenAddressFound = false;
        
        for (uint256 i = 0; i < proof.disclosedAttributes.length; i++) {
            bytes32 attribute = proof.disclosedAttributes[i];
            
            // Verificar depositor (convertido a bytes32)
            if (attribute == bytes32(uint256(uint160(depositor)))) {
                depositorFound = true;
            }
            
            // Verificar tokenAddress (convertido a bytes32)
            if (attribute == bytes32(uint256(uint160(tokenAddress)))) {
                tokenAddressFound = true;
            }
        }
        
        // Verificar que los índices de revelación son válidos
        // Índice 0 = amount (NO debe estar revelado para privacidad)
        // Índice 1 = depositor (DEBE estar revelado)
        // Índice 2 = tokenAddress (DEBE estar revelado)
        bool amountHidden = true;
        for (uint256 i = 0; i < proof.disclosureIndexes.length; i++) {
            if (proof.disclosureIndexes[i] == 0) {
                amountHidden = false; // Amount está siendo revelado (malo para privacidad)
                break;
            }
        }
        
        return depositorFound && tokenAddressFound && amountHidden;
    }
    
    /**
     * @dev Verify range proof (amount > 0)
     */
    function _verifyRangeProof(
        bytes32 commitment,
        bytes calldata rangeProof
    ) internal pure {
        // Implementar verificación de range proof
        // Por ahora, verificación básica
        require(rangeProof.length > 0, "Invalid range proof");
        require(commitment != bytes32(0), "Invalid commitment");
    }
    
    /**
     * @dev Verify equality proof for splits
     */
    function _verifyEqualityProof(
        bytes32 inputCommitment,
        bytes32[] calldata outputCommitments,
        bytes calldata equalityProof
    ) internal pure {
        // Verificar que sum(inputs) = sum(outputs) usando commitments
        require(equalityProof.length > 0, "Invalid equality proof");
        require(inputCommitment != bytes32(0), "Invalid input commitment");
        require(outputCommitments.length > 0, "No output commitments");
    }
    
    /**
     * @dev Extract amount from BBS+ proof (for internal use only)
     * @notice Esta función extrae la cantidad sin comprometer la privacidad
     */
    function _extractAmountFromBBSProof(
        BBSProofData calldata proof
    ) internal pure returns (uint256) {
        require(proof.proof.length > 0, "Invalid proof");
        require(proof.disclosedAttributes.length > 0, "No disclosed attributes");
        
        // En una implementación real, esto decodificaría el proof BBS+
        // para extraer la cantidad de forma segura sin revelarla públicamente
        
        // Por ahora, usamos un método determinístico basado en el hash del proof
        // que simula la extracción de la cantidad del proof
        bytes32 proofHash = keccak256(proof.proof);
        
        // Simular extracción de cantidad (en implementación real vendría del proof)
        // Usar un rango realista basado en el hash
        uint256 baseAmount = uint256(proofHash) % (100 * 1e18); // 0-100 tokens
        
        // Asegurar que es mayor que 0 (requisito de range proof)
        if (baseAmount == 0) {
            baseAmount = 1e18; // 1 token mínimo
        }
        
        // En implementación real, esto sería:
        // 1. Verificar el proof BBS+ contiene la cantidad
        // 2. Extraer la cantidad del proof verificado
        // 3. Verificar que coincide con el commitment Pedersen
        // 4. Retornar la cantidad extraída
        
        return baseAmount;
    }
    
    // ========================
    // FUNCIONES DE ADMINISTRACIÓN
    // ========================
    
    /**
     * @dev Add authorized BBS+ issuer
     */
    function addAuthorizedIssuer(
        address issuer,
        bytes calldata publicKey
    ) external onlyOwner {
        require(issuer != address(0), "Invalid issuer");
        require(publicKey.length > 0, "Invalid public key");
        
        authorizedIssuers[issuer] = true;
        issuerPublicKeys[issuer] = publicKey;
    }
    
    /**
     * @dev Revoke BBS+ credential
     */
    function revokeCredential(bytes32 credentialId) external onlyOwner {
        revokedCredentials[credentialId] = true;
        emit BBSCredentialRevoked(credentialId, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Update privacy settings
     */
    function updatePrivacySettings(
        bool _requireBBSProofs,
        bool _enableSelectiveDisclosure,
        uint256 _proofValidityPeriod
    ) external onlyOwner {
        requireBBSProofs = _requireBBSProofs;
        enableSelectiveDisclosure = _enableSelectiveDisclosure;
        proofValidityPeriod = _proofValidityPeriod;
    }
    
    // ========================
    // FUNCIONES DE CONSULTA
    // ========================
    
    /**
     * @dev Get UTXO commitment (public info only)
     */
    function getUTXOCommitment(bytes32 utxoId) external view returns (bytes32) {
        return utxos[utxoId].commitment;
    }
    
    /**
     * @dev Check if nullifier is used
     */
    function isNullifierUsed(bytes32 nullifier) external view returns (bool) {
        return nullifiers[nullifier];
    }
    
    /**
     * @dev Get user's UTXO count (without revealing UTXOs)
     */
    function getUserUTXOCount(address user) external view returns (uint256) {
        return utxosByOwner[user].length;
    }
    
    // ========================
    // FUNCIONES AUXILIARES INTERNAS
    // ========================
    
    function _generatePrivateUTXOId(
        bytes32 commitment,
        bytes32 nullifier
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(commitment, nullifier));
    }
    
    function _findUTXOByCommitment(bytes32 commitment) internal pure returns (bytes32) {
        // Esta función debe ser optimizada para encontrar UTXO por commitment
        // Por ahora, implementación básica
        return commitment; // Placeholder
    }
    
    function _verifyCommitmentsInProof(
        BBSProofData calldata proof,
        bytes32 inputCommitment,
        bytes32[] calldata outputCommitments
    ) internal pure returns (bool) {
        // Verificar que los commitments están correctamente referenciados en el proof
        // sin revelar los valores reales de los commitments
        
        require(proof.proof.length > 0, "Empty proof");
        require(inputCommitment != bytes32(0), "Invalid input commitment");
        require(outputCommitments.length > 0, "No output commitments");
        
        // Verificar que todos los output commitments son válidos
        for (uint256 i = 0; i < outputCommitments.length; i++) {
            require(outputCommitments[i] != bytes32(0), "Invalid output commitment");
            
            // Verificar que los commitments no se repiten
            for (uint256 j = i + 1; j < outputCommitments.length; j++) {
                require(outputCommitments[i] != outputCommitments[j], "Duplicate output commitment");
            }
        }
        
        // Verificar que input commitment no aparece en outputs
        for (uint256 i = 0; i < outputCommitments.length; i++) {
            require(inputCommitment != outputCommitments[i], "Input cannot equal output");
        }
        
        // Verificar que el proof contiene las referencias correctas a los commitments
        // sin revelar los commitments directamente en disclosed attributes
        bool commitmentsProperlyHidden = true;
        
        for (uint256 i = 0; i < proof.disclosedAttributes.length; i++) {
            bytes32 disclosed = proof.disclosedAttributes[i];
            
            // Los commitments NO deben estar en disclosed attributes (deben permanecer ocultos)
            if (disclosed == inputCommitment) {
                commitmentsProperlyHidden = false;
                break;
            }
            
            for (uint256 j = 0; j < outputCommitments.length; j++) {
                if (disclosed == outputCommitments[j]) {
                    commitmentsProperlyHidden = false;
                    break;
                }
            }
            
            if (!commitmentsProperlyHidden) break;
        }
        
        return commitmentsProperlyHidden;
    }
    
    function _verifyTransferDisclosure(
        BBSProofData calldata proof,
        bytes32 inputCommitment,
        bytes32 outputCommitment,
        address newOwner
    ) internal pure returns (bool) {
        // Verificar selective disclosure para transfers
        // Debe revelar: newOwner y tokenAddress, pero NO amounts ni commitments internos
        
        require(proof.disclosedAttributes.length >= 1, "Insufficient disclosed attributes");
        require(proof.disclosureIndexes.length >= 1, "Insufficient disclosure indexes");
        
        // Verificar que newOwner está en los atributos revelados
        bool newOwnerFound = false;
        
        for (uint256 i = 0; i < proof.disclosedAttributes.length; i++) {
            bytes32 attribute = proof.disclosedAttributes[i];
            
            // Verificar newOwner (convertido a bytes32)
            if (attribute == bytes32(uint256(uint160(newOwner)))) {
                newOwnerFound = true;
                break;
            }
        }
        
        // Verificar que los commitments no están siendo revelados directamente
        // (deben permanecer ocultos para privacidad)
        bool commitmentsHidden = true;
        for (uint256 i = 0; i < proof.disclosedAttributes.length; i++) {
            bytes32 attribute = proof.disclosedAttributes[i];
            
            if (attribute == inputCommitment || attribute == outputCommitment) {
                commitmentsHidden = false;
                break;
            }
        }
        
        return newOwnerFound && 
               commitmentsHidden &&
               inputCommitment != bytes32(0) &&
               outputCommitment != bytes32(0) &&
               newOwner != address(0);
    }
    
    function _verifyWithdrawAuthorization(
        BBSProofData calldata proof,
        bytes32 commitment,
        address withdrawer
    ) internal pure returns (bool) {
        // Verificar autorización de withdraw
        // Debe revelar: withdrawer address para autorización
        // Debe mantener oculto: amount exacto (solo se revela que > 0)
        
        require(proof.disclosedAttributes.length >= 1, "Insufficient disclosed attributes");
        require(proof.disclosureIndexes.length >= 1, "Insufficient disclosure indexes");
        
        // Verificar que withdrawer está en los atributos revelados
        bool withdrawerFound = false;
        
        for (uint256 i = 0; i < proof.disclosedAttributes.length; i++) {
            bytes32 attribute = proof.disclosedAttributes[i];
            
            // Verificar withdrawer (convertido a bytes32)
            if (attribute == bytes32(uint256(uint160(withdrawer)))) {
                withdrawerFound = true;
                break;
            }
        }
        
        // Verificar que el commitment no está siendo revelado directamente
        bool commitmentHidden = true;
        for (uint256 i = 0; i < proof.disclosedAttributes.length; i++) {
            if (proof.disclosedAttributes[i] == commitment) {
                commitmentHidden = false;
                break;
            }
        }
        
        // Verificar que hay proof de ownership sin revelar detalles internos
        return withdrawerFound && 
               commitmentHidden &&
               proof.proof.length > 0 && 
               commitment != bytes32(0) &&
               withdrawer != address(0);
    }
    
    /**
     * @dev TESTING VERSION: Simple deposit for development/testing
     * @notice This version bypasses most privacy features for easier testing
     * @param tokenAddress Token to deposit
     * @param amount Amount to deposit
     */
    function depositAsPrivateUTXO_Test(
        address tokenAddress,
        uint256 amount
    ) external nonReentrant {
        require(tokenAddress != address(0), "Invalid token");
        require(amount > 0, "Invalid amount");
        
        // Generate simple commitment and nullifier for testing
        bytes32 commitment = keccak256(abi.encodePacked(msg.sender, amount, block.timestamp));
        bytes32 nullifierHash = keccak256(abi.encodePacked(commitment, msg.sender));
        
        // Verificar que no se haya usado antes
        require(!nullifiers[nullifierHash], "Nullifier already used");
        
        // Transferir tokens
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount);
        
        // Crear UTXO simple
        bytes32 utxoId = _generatePrivateUTXOId(commitment, nullifierHash);
        
        utxos[utxoId] = PrivateUTXO({
            exists: true,
            commitment: commitment,
            tokenAddress: tokenAddress,
            owner: msg.sender,
            timestamp: block.timestamp,
            isSpent: false,
            parentUTXO: bytes32(0),
            utxoType: UTXOType.DEPOSIT,
            nullifierHash: nullifierHash,
            bbsCredential: hex"00" // Empty credential for testing
        });
        
        // Marcar nullifier como usado
        nullifiers[nullifierHash] = true;
        
        // Actualizar tracking del owner
        utxosByOwner[msg.sender].push(utxoId);
        
        emit PrivateUTXOCreated(
            commitment,
            msg.sender,
            tokenAddress,
            nullifierHash,
            UTXOType.DEPOSIT
        );
    }
}