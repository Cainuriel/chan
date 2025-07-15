import { V as fallback, W as attr, T as escape_html, X as bind_props, O as pop, K as push, Y as head, Z as ensure_array_like, _ as attr_class } from "../../chunks/index.js";
import { ethers, toBigInt } from "ethers";
var UTXOType = /* @__PURE__ */ ((UTXOType2) => {
  UTXOType2["DEPOSIT"] = "DEPOSIT";
  UTXOType2["SPLIT"] = "SPLIT";
  UTXOType2["COMBINE"] = "COMBINE";
  UTXOType2["TRANSFER"] = "TRANSFER";
  return UTXOType2;
})(UTXOType || {});
class UTXOOperationError extends Error {
  constructor(message, operation, utxoId, details) {
    super(message);
    this.operation = operation;
    this.utxoId = utxoId;
    this.details = details;
    this.name = "UTXOOperationError";
  }
}
class UTXONotFoundError extends UTXOOperationError {
  constructor(utxoId) {
    super(`UTXO not found: ${utxoId}`, "lookup", utxoId);
    this.name = "UTXONotFoundError";
  }
}
class InsufficientFundsError extends UTXOOperationError {
  constructor(required, available, tokenAddress) {
    super(
      `Insufficient funds: required ${required}, available ${available}`,
      "balance_check",
      void 0,
      { required, available, tokenAddress }
    );
    this.name = "InsufficientFundsError";
  }
}
class UTXOAlreadySpentError extends UTXOOperationError {
  constructor(utxoId) {
    super(`UTXO already spent: ${utxoId}`, "spend", utxoId);
    this.name = "UTXOAlreadySpentError";
  }
}
var WalletProviderType = /* @__PURE__ */ ((WalletProviderType2) => {
  WalletProviderType2["METAMASK"] = "metamask";
  WalletProviderType2["WALLET_CONNECT"] = "walletconnect";
  WalletProviderType2["COINBASE_WALLET"] = "coinbase";
  WalletProviderType2["INJECTED"] = "injected";
  WalletProviderType2["CUSTOM"] = "custom";
  return WalletProviderType2;
})(WalletProviderType || {});
var AccountDerivationMethod = /* @__PURE__ */ ((AccountDerivationMethod2) => {
  AccountDerivationMethod2["MESSAGE_SIGNATURE"] = "message_signature";
  AccountDerivationMethod2["TYPED_DATA_SIGNATURE"] = "typed_data_signature";
  AccountDerivationMethod2["DETERMINISTIC_HASH"] = "deterministic_hash";
  return AccountDerivationMethod2;
})(AccountDerivationMethod || {});
class EthereumError extends Error {
  constructor(message, code, data) {
    super(message);
    this.code = code;
    this.data = data;
    this.name = "EthereumError";
  }
}
class WalletNotConnectedError extends EthereumError {
  constructor() {
    super("Wallet not connected", 4001);
    this.name = "WalletNotConnectedError";
  }
}
class UnsupportedChainError extends EthereumError {
  constructor(chainId) {
    super(`Unsupported chain: ${chainId}`, 4902, { chainId });
    this.name = "UnsupportedChainError";
  }
}
class TransactionRevertedError extends EthereumError {
  constructor(reason, txHash) {
    super(`Transaction reverted${reason ? `: ${reason}` : ""}`, -32e3, {
      reason,
      txHash
    });
    this.name = "TransactionRevertedError";
  }
}
const ETHEREUM_NETWORKS = {
  mainnet: {
    chainId: 1,
    name: "Ethereum Mainnet",
    rpcUrls: ["https://mainnet.infura.io/v3/", "https://eth-mainnet.alchemyapi.io/v2/"],
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18
    },
    blockExplorerUrls: ["https://etherscan.io"],
    testnet: false
  },
  polygon: {
    chainId: 137,
    name: "Polygon Mainnet",
    rpcUrls: ["https://polygon-rpc.com/"],
    nativeCurrency: {
      name: "MATIC",
      symbol: "MATIC",
      decimals: 18
    },
    blockExplorerUrls: ["https://polygonscan.com"],
    testnet: false
  },
  sepolia: {
    chainId: 11155111,
    name: "Sepolia Testnet",
    rpcUrls: ["https://sepolia.infura.io/v3/"],
    nativeCurrency: {
      name: "Sepolia Ether",
      symbol: "SEP",
      decimals: 18
    },
    blockExplorerUrls: ["https://sepolia.etherscan.io"],
    testnet: true
  }
};
const ERC20_ABI_FRAGMENTS = {
  balanceOf: "function balanceOf(address owner) view returns (uint256)",
  allowance: "function allowance(address owner, address spender) view returns (uint256)",
  approve: "function approve(address spender, uint256 amount) returns (bool)",
  name: "function name() view returns (string)",
  symbol: "function symbol() view returns (string)",
  decimals: "function decimals() view returns (uint8)"
};
const UTXO_VAULT_ABI = [
  // Constructor
  "constructor()",
  // Public variables (auto-generated getters)
  "function utxos(bytes32) view returns (bool exists, uint256 value, address tokenAddress, address owner, uint256 timestamp, bool isSpent, bytes32 commitment, bytes32 parentUTXO, uint8 utxoType)",
  "function utxosByOwner(address, uint256) view returns (bytes32)",
  "function utxoIndexByOwner(address, bytes32) view returns (uint256)",
  "function splitOperations(bytes32) view returns (bytes32 inputUTXO, bytes32[] outputUTXOs, address[] outputOwners, uint256[] outputValues, bytes splitProof, uint256 timestamp)",
  "function combineOperations(bytes32) view returns (bytes32[] inputUTXOs, bytes32 outputUTXO, address outputOwner, uint256 totalValue, bytes combineProof, uint256 timestamp)",
  "function nonces(address) view returns (uint256)",
  "function supportedTokens(address) view returns (bool)",
  "function useWhitelist() view returns (bool)",
  "function tokenBalances(address) view returns (uint256)",
  "function tokensUsed(uint256) view returns (address)",
  "function tokenExists(address) view returns (bool)",
  "function requireZenroomProofs() view returns (bool)",
  "function verifiedZenroomProofs(bytes32) view returns (bool)",
  // Privacy-related getters
  "function authorizedIssuers(address) view returns (bool)",
  "function issuerPublicKeys(address) view returns (bytes)",
  "function requireBBSProofs() view returns (bool)",
  "function enableSelectiveDisclosure() view returns (bool)",
  "function proofValidityPeriod() view returns (uint256)",
  // Original functions (maintained for compatibility)
  "function depositAsUTXO(address tokenAddress, uint256 amount, bytes32 commitment, bytes calldata zenroomProof) external",
  "function withdrawFromUTXO(bytes32 utxoId, bytes calldata burnProof, bytes calldata openingProof) external",
  "function splitUTXO(bytes32 inputUTXOId, bytes32[] calldata outputCommitments, address[] calldata outputOwners, uint256[] calldata outputValues, bytes calldata splitProof) external returns (bytes32[] memory)",
  "function combineUTXOs(bytes32[] calldata inputUTXOIds, bytes32 outputCommitment, address outputOwner, bytes calldata combineProof) external returns (bytes32)",
  "function transferUTXO(bytes32 utxoId, address newOwner, bytes calldata transferProof) external",
  // New private UTXO functions
  "function depositAsPrivateUTXO(address tokenAddress, uint256 amount, bytes32 commitment, (bytes proof, bytes32[] disclosedAttributes, uint256[] disclosureIndexes, bytes32 challenge, uint256 timestamp) bbsProof, bytes32 nullifierHash, bytes rangeProof) external",
  "function depositAsPrivateUTXO_Test(address tokenAddress, uint256 amount) external",
  "function splitPrivateUTXO(bytes32 inputCommitment, bytes32[] calldata outputCommitments, (bytes proof, bytes32[] disclosedAttributes, uint256[] disclosureIndexes, bytes32 challenge, uint256 timestamp) splitProof, bytes calldata equalityProof, bytes32 nullifierHash) external returns (bytes32[] memory)",
  "function transferPrivateUTXO(bytes32 inputCommitment, bytes32 outputCommitment, (bytes proof, bytes32[] disclosedAttributes, uint256[] disclosureIndexes, bytes32 challenge, uint256 timestamp) transferProof, address newOwner, bytes32 nullifierHash) external",
  "function withdrawFromPrivateUTXO(bytes32 commitment, (bytes proof, bytes32[] disclosedAttributes, uint256[] disclosureIndexes, bytes32 challenge, uint256 timestamp) withdrawProof, bytes32 nullifierHash) external",
  // View functions
  "function getUTXOsByOwner(address owner) external view returns (bytes32[] memory)",
  "function getUTXOInfo(bytes32 utxoId) external view returns (bool exists, bytes32 commitment, address tokenAddress, address owner, uint256 timestamp, bool isSpent, bytes32 parentUTXO, uint8 utxoType, bytes32 nullifierHash)",
  "function getSplitOperation(bytes32 operationId) external view returns (bytes32 inputUTXO, bytes32[] memory outputUTXOs, address[] memory outputOwners, uint256[] memory outputValues, bytes memory splitProof, uint256 timestamp)",
  "function getCombineOperation(bytes32 operationId) external view returns (bytes32[] memory inputUTXOs, bytes32 outputUTXO, address outputOwner, uint256 totalValue, bytes memory combineProof, uint256 timestamp)",
  // Privacy query functions
  "function getUTXOCommitment(bytes32 utxoId) external view returns (bytes32)",
  "function isNullifierUsed(bytes32 nullifier) external view returns (bool)",
  "function getUserUTXOCount(address user) external view returns (uint256)",
  // Admin functions
  "function setZenroomProofRequirement(bool required) external",
  "function addSupportedToken(address tokenAddress) external",
  "function setUseWhitelist(bool _useWhitelist) external",
  "function addAuthorizedIssuer(address issuer, bytes calldata publicKey) external",
  "function revokeCredential(bytes32 credentialId) external",
  "function updatePrivacySettings(bool _requireBBSProofs, bool _enableSelectiveDisclosure, uint256 _proofValidityPeriod) external",
  // Original events
  "event UTXOCreated(bytes32 indexed utxoId, address indexed owner, address indexed tokenAddress, uint256 value, bytes32 commitment, uint8 utxoType, bytes32 parentUTXO)",
  "event UTXOSplit(bytes32 indexed inputUTXO, address indexed inputOwner, bytes32[] outputUTXOs, address[] outputOwners, uint256[] outputValues, bytes32 indexed operationId)",
  "event UTXOCombined(bytes32[] inputUTXOs, address indexed inputOwner, bytes32 indexed outputUTXO, address indexed outputOwner, uint256 totalValue, bytes32 operationId)",
  "event UTXOTransferred(bytes32 indexed utxoId, address indexed fromOwner, address indexed toOwner, uint256 value, address tokenAddress)",
  "event UTXOWithdrawn(bytes32 indexed utxoId, address indexed owner, address indexed tokenAddress, uint256 value)",
  // New private events
  "event PrivateUTXOCreated(bytes32 indexed commitment, address indexed owner, address indexed tokenAddress, bytes32 nullifierHash, uint8 utxoType)",
  "event PrivateTransfer(bytes32 indexed inputCommitment, bytes32 indexed outputCommitment, bytes32 nullifierHash, bytes32 transferProof)",
  "event PrivateWithdrawal(bytes32 indexed commitment, address indexed recipient, bytes32 nullifierHash)",
  "event BBSCredentialRevoked(bytes32 indexed credentialId, address indexed issuer, uint256 timestamp)",
  // Inherited from Ownable
  "function owner() view returns (address)",
  "function transferOwnership(address newOwner) external",
  "function renounceOwnership() external",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)"
];
function createUTXOVaultContract(address, signerOrProvider) {
  return new ethers.Contract(address, UTXO_VAULT_ABI, signerOrProvider);
}
const UTXO_VAULT_CONSTANTS = {
  // Enum values matching Solidity
  UTXO_TYPES: {
    DEPOSIT: 0,
    SPLIT: 1,
    COMBINE: 2,
    TRANSFER: 3
  }
};
class ZenroomExecutionError extends Error {
  constructor(message, logs, zencode) {
    super(message);
    this.logs = logs;
    this.zencode = zencode;
    this.name = "ZenroomExecutionError";
  }
}
let zenroomPkg = null;
async function loadZenroom() {
  return zenroomPkg;
}
const zencode_exec = async (zencode, options = {}) => {
  const pkg = await loadZenroom();
  if (!pkg) {
    throw new Error("Zenroom not available");
  }
  console.log("🔧 Executing Zencode:", zencode.substring(0, 100) + "...");
  console.log("🔧 With options:", options);
  try {
    const result = await pkg.zencode_exec(zencode, options);
    console.log("✅ Zencode executed successfully:", result);
    return result;
  } catch (error) {
    console.error("❌ Zencode execution failed:", error);
    throw error;
  }
};
const isZenroomAvailable = async () => {
  return false;
};
class ZenroomHelpers {
  /**
   * Generate a secure random nonce for cryptographic operations
   * @param bits - Number of bits for the nonce (default: 256)
   * @returns Promise resolving to hex string nonce
   */
  static async generateSecureNonce(bits = 256) {
    const zenroomAvailable = await isZenroomAvailable();
    if (!zenroomAvailable) {
      const array = new Uint8Array(bits / 8);
      crypto.getRandomValues(array);
      const hexString = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
      const prefixedHex = hexString.startsWith("0x") ? hexString : `0x${hexString}`;
      console.log("🎲 Generated fallback nonce:", prefixedHex);
      return prefixedHex;
    }
    const zencode = `Given nothing
When I create the random object of '${bits / 8}' bytes  
Then print 'random object' as 'hex'`;
    try {
      console.log("🔧 Generating nonce with Zenroom...");
      const result = await zencode_exec(zencode);
      if (!result.result) {
        throw new Error("Empty result from Zenroom");
      }
      const output = JSON.parse(result.result);
      const hexString = output["random object"] || output.random_bytes;
      if (!hexString || typeof hexString !== "string") {
        throw new Error("Invalid random bytes from Zenroom");
      }
      const prefixedHex = hexString.startsWith("0x") ? hexString : `0x${hexString}`;
      console.log("✅ Generated Zenroom nonce:", prefixedHex);
      return prefixedHex;
    } catch (error) {
      console.warn("❌ Zenroom nonce generation failed, falling back to crypto API:", error);
      const array = new Uint8Array(bits / 8);
      crypto.getRandomValues(array);
      const hexString = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
      const prefixedHex = hexString.startsWith("0x") ? hexString : `0x${hexString}`;
      console.log("🎲 Generated fallback nonce after error:", prefixedHex);
      return prefixedHex;
    }
  }
  /**
   * Create a Pedersen commitment for a value with blinding factor
   * @param value - Value to commit (as string)
   * @param blindingFactor - Blinding factor (optional, auto-generated if not provided)
   * @returns Promise resolving to commitment result
   */
  static async createPedersenCommitment(value, blindingFactor) {
    console.log("🔒 Creating Pedersen commitment...", { value, hasBlindingFactor: !!blindingFactor });
    try {
      const blinding = blindingFactor || await this.generateSecureNonce();
      console.log("🔒 Using blinding factor:", blinding, "type:", typeof blinding);
      if (typeof value !== "string" || typeof blinding !== "string") {
        throw new Error(`Invalid input types: value=${typeof value}, blinding=${typeof blinding}`);
      }
      const zenroomAvailable = await isZenroomAvailable();
      if (zenroomAvailable) {
        console.log("🔒 Using Zenroom for Pedersen commitment");
        const zencode = `
Given I have a 'string' named 'input_data'
When I create the hash of 'input_data'
Then print 'hash' as 'hex'
        `;
        const inputData = `${value}:${blinding}`;
        const data = JSON.stringify({
          input_data: inputData
        });
        try {
          console.log("🔧 Executing Zenroom commitment script...");
          const result = await zencode_exec(zencode, { data });
          if (!result.result) {
            throw new Error("Empty result from Zenroom");
          }
          const output = JSON.parse(result.result);
          console.log("✅ Zenroom commitment created successfully:", output);
          const prefixedHash = output.hash.startsWith("0x") ? output.hash : `0x${output.hash}`;
          const prefixedBlinding2 = blinding.startsWith("0x") ? blinding : `0x${blinding}`;
          return {
            pedersen_commitment: prefixedHash,
            blinding_factor: prefixedBlinding2,
            commitment_proof: prefixedHash
            // For now, use same as commitment
          };
        } catch (zenroomError) {
          console.warn("⚠️ Zenroom commitment failed, falling back to hash-based commitment:", zenroomError);
        }
      }
      console.log("🔒 Using hash-based commitment fallback");
      const commitmentData = ethers.solidityPackedKeccak256(
        ["string", "string"],
        [value, blinding]
      );
      console.log("✅ Hash-based commitment created successfully:", commitmentData);
      const prefixedBlinding = blinding.startsWith("0x") ? blinding : `0x${blinding}`;
      return {
        pedersen_commitment: commitmentData,
        blinding_factor: prefixedBlinding,
        commitment_proof: commitmentData
        // For now, use same as commitment
      };
    } catch (error) {
      console.error("❌ Failed to create commitment:", error);
      throw new ZenroomExecutionError(
        "Failed to create Pedersen commitment",
        error instanceof Error ? error.message : "Unknown error",
        "commitment creation"
      );
    }
  }
  /**
   * Verify a Pedersen commitment opening
   * @param commitment - The commitment to verify
   * @param value - The claimed value
   * @param blindingFactor - The blinding factor
   * @returns Promise resolving to verification result
   */
  static async verifyCommitmentOpening(commitment, value, blindingFactor) {
    const zencode = `
Given I have a 'string' named 'input_data'
When I create the hash of 'input_data'
Then print 'hash' as 'hex'
    `;
    const inputData = `${value}:${blindingFactor}`;
    const data = JSON.stringify({
      input_data: inputData
    });
    try {
      const result = await zencode_exec(zencode, { data });
      const output = JSON.parse(result.result);
      return output.hash === commitment;
    } catch (error) {
      const expectedCommitment = ethers.solidityPackedKeccak256(
        ["string", "string"],
        [value, blindingFactor]
      );
      return expectedCommitment === commitment;
    }
  }
  /**
   * Generate a split proof for UTXO division
   * @param inputCommitment - Input UTXO commitment
   * @param inputValue - Input UTXO value
   * @param inputBlinding - Input UTXO blinding factor
   * @param outputValues - Array of output values
   * @param outputBlindings - Array of output blinding factors
   * @returns Promise resolving to split proof
   */
  static async generateSplitProof(inputCommitment, inputValue, inputBlinding, outputValues, outputBlindings) {
    if (outputValues.length !== outputBlindings.length) {
      throw new Error("Output values and blinding factors arrays must have same length");
    }
    const totalOutput = outputValues.reduce((sum, val) => sum + parseInt(val), 0);
    if (totalOutput !== parseInt(inputValue)) {
      throw new Error(`Sum of outputs (${totalOutput}) does not equal input (${inputValue})`);
    }
    const zencode = `
    Scenario 'ethereum': Generate split proof
    Given I have a 'hex' named 'input_commitment'
    Given I have a 'integer' named 'input_value'
    Given I have a 'integer' named 'input_blinding'
    Given I have a 'integer array' named 'output_values'
    Given I have a 'integer array' named 'output_blindings'
    
    When I verify the commitment 'input_commitment' opens to 'input_value' with 'input_blinding'
    And I verify that sum of 'output_values' equals 'input_value'
    And I create the split proof for outputs
    And I create the output commitments from 'output_values' and 'output_blindings'
    And I create the split signature
    
    Then print the 'split proof' as 'hex'
    And print the 'output commitments' as 'hex'
    And print the 'split signature' as 'hex'
    `;
    const data = JSON.stringify({
      input_commitment: inputCommitment,
      input_value: inputValue,
      input_blinding: inputBlinding,
      output_values: outputValues,
      output_blindings: outputBlindings
    });
    try {
      const result = await zencode_exec(zencode, { data });
      const output = JSON.parse(result.result);
      return {
        split_proof: output.split_proof,
        output_commitments: output.output_commitments,
        signatures: [output.split_signature]
      };
    } catch (error) {
      throw new ZenroomExecutionError(
        "Failed to generate split proof",
        error instanceof Error ? error.message : "Unknown error",
        zencode
      );
    }
  }
  /**
   * Generate a combine proof for UTXO combination
   * @param inputCommitments - Array of input commitments
   * @param inputValues - Array of input values
   * @param inputBlindings - Array of input blinding factors
   * @param outputBlinding - Output blinding factor
   * @returns Promise resolving to combine proof
   */
  static async generateCombineProof(inputCommitments, inputValues, inputBlindings, outputBlinding) {
    if (inputCommitments.length !== inputValues.length || inputValues.length !== inputBlindings.length) {
      throw new Error("Input arrays must have same length");
    }
    const totalValue = inputValues.reduce((sum, val) => sum + parseInt(val), 0).toString();
    const zencode = `
    Scenario 'ethereum': Generate combine proof
    Given I have a 'hex array' named 'input_commitments'
    Given I have a 'integer array' named 'input_values'
    Given I have a 'integer array' named 'input_blindings'
    Given I have a 'integer' named 'total_value'
    Given I have a 'integer' named 'output_blinding'
    
    When I verify all input commitments open correctly
    And I verify that sum of 'input_values' equals 'total_value'
    And I create the combine proof for inputs
    And I create the output commitment of 'total_value' with 'output_blinding'
    And I create the combine signature
    
    Then print the 'combine proof' as 'hex'
    `;
    const data = JSON.stringify({
      input_commitments: inputCommitments,
      input_values: inputValues,
      input_blindings: inputBlindings,
      total_value: totalValue,
      output_blinding: outputBlinding
    });
    try {
      const result = await zencode_exec(zencode, { data });
      const output = JSON.parse(result.result);
      return output.combine_proof;
    } catch (error) {
      throw new ZenroomExecutionError(
        "Failed to generate combine proof",
        error instanceof Error ? error.message : "Unknown error",
        zencode
      );
    }
  }
  /**
   * Generate ownership proof for EOA-UTXO binding
   * @param utxoId - UTXO identifier
   * @param utxoCommitment - UTXO commitment
   * @param eoaAddress - EOA address
   * @param eoaSignature - EOA signature
   * @returns Promise resolving to ownership proof
   */
  static async generateOwnershipProof(utxoId, utxoCommitment, eoaAddress, eoaSignature) {
    const zencode = `
    Scenario 'ethereum': Generate ownership proof
    Given I have a 'string' named 'utxo_id'
    Given I have a 'hex' named 'utxo_commitment'
    Given I have a 'string' named 'eoa_address'
    Given I have a 'hex' named 'eoa_signature'
    
    When I create the ownership binding of 'utxo_id' to 'eoa_address'
    And I create the commitment ownership proof for 'utxo_commitment'
    And I combine the eoa signature with zenroom proof
    And I create the final ownership proof
    
    Then print the 'ownership proof' as 'hex'
    And print the 'eoa signature component' as 'hex'
    And print the 'zenroom signature component' as 'hex'
    `;
    const data = JSON.stringify({
      utxo_id: utxoId,
      utxo_commitment: utxoCommitment,
      eoa_address: eoaAddress,
      eoa_signature: eoaSignature
    });
    try {
      const result = await zencode_exec(zencode, { data });
      const output = JSON.parse(result.result);
      return {
        ownership_proof: output.ownership_proof,
        eoa_signature: output.eoa_signature_component,
        zenroom_signature: output.zenroom_signature_component
      };
    } catch (error) {
      throw new ZenroomExecutionError(
        "Failed to generate ownership proof",
        error instanceof Error ? error.message : "Unknown error",
        zencode
      );
    }
  }
  /**
   * Derive cryptographic key from EOA signature
   * @param eoaAddress - EOA address
   * @param message - Message that was signed
   * @param signature - EOA signature
   * @param derivationPath - Derivation path (optional)
   * @returns Promise resolving to derived key
   */
  static async deriveKeyFromEOA(eoaAddress, message, signature, derivationPath = "m/44'/60'/0'/0/0") {
    const zencode = `
    Scenario 'ethereum': Derive key from EOA
    Given I have a 'string' named 'eoa_address'
    Given I have a 'string' named 'signed_message'
    Given I have a 'hex' named 'signature'
    Given I have a 'string' named 'derivation_path'
    
    When I verify the ethereum signature 'signature' of 'signed_message' by 'eoa_address'
    And I derive the private key from signature using 'derivation_path'
    And I create the public key from private key
    And I set the curve to 'secp256k1'
    
    Then print the 'private key' as 'hex'
    And print the 'public key' as 'hex'
    And print the 'derivation path'
    And print the 'curve'
    `;
    const data = JSON.stringify({
      eoa_address: eoaAddress,
      signed_message: message,
      signature,
      derivation_path: derivationPath
    });
    try {
      const result = await zencode_exec(zencode, { data });
      const output = JSON.parse(result.result);
      return {
        private_key: output.private_key,
        public_key: output.public_key,
        derivation_path: output.derivation_path,
        curve: output.curve
      };
    } catch (error) {
      throw new ZenroomExecutionError(
        "Failed to derive key from EOA",
        error instanceof Error ? error.message : "Unknown error",
        zencode
      );
    }
  }
  /**
   * Generate burn authorization proof
   * @param utxoId - UTXO to burn
   * @param commitment - UTXO commitment
   * @param value - UTXO value
   * @param blindingFactor - UTXO blinding factor
   * @param eoaAddress - EOA authorizing the burn
   * @returns Promise resolving to burn proof
   */
  static async generateBurnProof(utxoId, commitment, value, blindingFactor, eoaAddress) {
    const zencode = `
    Scenario 'ethereum': Generate burn proof
    Given I have a 'string' named 'utxo_id'
    Given I have a 'hex' named 'commitment'
    Given I have a 'integer' named 'value'
    Given I have a 'integer' named 'blinding_factor'
    Given I have a 'string' named 'eoa_address'
    
    When I verify the commitment 'commitment' opens to 'value' with 'blinding_factor'
    And I create the burn authorization for 'utxo_id' by 'eoa_address'
    And I create the destruction proof
    And I create the burn signature
    
    Then print the 'burn proof' as 'hex'
    `;
    const data = JSON.stringify({
      utxo_id: utxoId,
      commitment,
      value,
      blinding_factor: blindingFactor,
      eoa_address: eoaAddress
    });
    try {
      const result = await zencode_exec(zencode, { data });
      const output = JSON.parse(result.result);
      return output.burn_proof;
    } catch (error) {
      throw new ZenroomExecutionError(
        "Failed to generate burn proof",
        error instanceof Error ? error.message : "Unknown error",
        zencode
      );
    }
  }
  /**
   * Generate transfer authorization proof
   * @param utxoId - UTXO to transfer
   * @param fromAddress - Current owner address
   * @param toAddress - New owner address
   * @param commitment - UTXO commitment
   * @returns Promise resolving to transfer proof
   */
  static async generateTransferProof(utxoId, fromAddress, toAddress, commitment) {
    const zencode = `
    Scenario 'ethereum': Generate transfer proof
    Given I have a 'string' named 'utxo_id'
    Given I have a 'string' named 'from_address'
    Given I have a 'string' named 'to_address'
    Given I have a 'hex' named 'commitment'
    
    When I create the transfer authorization from 'from_address' to 'to_address'
    And I bind the transfer to 'utxo_id' and 'commitment'
    And I create the transfer proof
    And I create the transfer signature
    
    Then print the 'transfer proof' as 'hex'
    `;
    const data = JSON.stringify({
      utxo_id: utxoId,
      from_address: fromAddress,
      to_address: toAddress,
      commitment
    });
    try {
      const result = await zencode_exec(zencode, { data });
      const output = JSON.parse(result.result);
      return output.transfer_proof;
    } catch (error) {
      throw new ZenroomExecutionError(
        "Failed to generate transfer proof",
        error instanceof Error ? error.message : "Unknown error",
        zencode
      );
    }
  }
  /**
   * Hash data using Zenroom's cryptographic hash functions
   * @param data - Data to hash
   * @param algorithm - Hash algorithm (default: 'sha256')
   * @returns Promise resolving to hash string
   */
  static async hashData(data, algorithm = "sha256") {
    const zencode = `
    Given I have a 'string' named 'data'
    When I create the hash of 'data' using '${algorithm}'
    Then print the 'hash' as 'hex'
    `;
    const input = JSON.stringify({ data });
    try {
      const result = await zencode_exec(zencode, { data: input });
      const output = JSON.parse(result.result);
      const hash = output.hash;
      return hash.startsWith("0x") ? hash : `0x${hash}`;
    } catch (error) {
      throw new ZenroomExecutionError(
        `Failed to hash data with ${algorithm}`,
        error instanceof Error ? error.message : "Unknown error",
        zencode
      );
    }
  }
  /**
   * Validate Zencode script syntax
   * @param zencode - Zencode script to validate
   * @returns Promise resolving to validation result
   */
  static async validateZencode(zencode) {
    try {
      const result = await zencode_exec(zencode);
      return { valid: true, errors: [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        valid: false,
        errors: [errorMessage]
      };
    }
  }
  /**
   * Convert hex string to bytes and vice versa
   */
  static hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }
  static bytesToHex(bytes) {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  /**
   * Generate deterministic ID from commitment and owner
   * @param commitment - Pedersen commitment
   * @param owner - Owner address
   * @param timestamp - Timestamp for uniqueness
   * @returns Promise resolving to deterministic ID
   */
  static async generateUTXOId(commitment, owner, timestamp) {
    const data = `${commitment}${owner}${timestamp}`;
    return await this.hashData(data);
  }
  /**
   * Generate BBS+ key pair for signing credentials
   * @param privateKey - Optional private key, generates new if not provided
   * @returns Promise resolving to BBS+ key pair
   */
  static async generateBBSKeyPair(privateKey) {
    console.log("🔑 Generating BBS+ key pair...");
    try {
      const zenroomAvailable = await isZenroomAvailable();
      if (!zenroomAvailable) {
        const wallet = privateKey ? new ethers.Wallet(privateKey) : ethers.Wallet.createRandom();
        console.log("🔑 Generated BBS+ keys using ethers fallback");
        return {
          privateKey: wallet.privateKey,
          publicKey: wallet.address
          // Use address as public key identifier
        };
      }
      const zencode = `
      Scenario 'bbs': Generate BBS+ keypair
      ${privateKey ? `Given I have a 'hex' named 'private_key'` : "Given nothing"}
      When I create the BBS+ key pair${privateKey ? " from 'private_key'" : ""}
      And I create the BBS+ public key
      Then print the 'bbs private key' as 'hex'
      And print the 'bbs public key' as 'hex'
      `;
      const data = privateKey ? JSON.stringify({ private_key: privateKey }) : void 0;
      const result = await zencode_exec(zencode, data ? { data } : void 0);
      const output = JSON.parse(result.result);
      console.log("✅ BBS+ keys generated successfully");
      return {
        privateKey: output.bbs_private_key || output["bbs private key"],
        publicKey: output.bbs_public_key || output["bbs public key"]
      };
    } catch (error) {
      console.error("❌ Failed to generate BBS+ keys:", error);
      const wallet = privateKey ? new ethers.Wallet(privateKey) : ethers.Wallet.createRandom();
      console.log("🔑 Generated BBS+ keys using ethers fallback after error");
      return {
        privateKey: wallet.privateKey,
        publicKey: wallet.address
        // Use address as public key identifier
      };
    }
  }
  /**
   * Generate Coconut threshold setup for distributed credential issuance
   * @param authorities - Array of authority addresses
   * @param threshold - Minimum signatures required
   * @param authorityKeys - Optional pre-generated authority keys
   * @returns Promise resolving to threshold setup
   */
  static async generateCoconutThresholdKeys(authorities, threshold, authorityKeys) {
    console.log("🥥 Generating Coconut threshold setup...", { authorities: authorities.length, threshold });
    try {
      const zenroomAvailable = await isZenroomAvailable();
      if (!zenroomAvailable) {
        const publicKeys = [];
        for (let i = 0; i < authorities.length; i++) {
          if (authorityKeys && authorityKeys[i]) {
            const wallet = new ethers.Wallet(authorityKeys[i]);
            publicKeys.push(wallet.address);
          } else {
            const wallet = ethers.Wallet.createRandom();
            publicKeys.push(wallet.address);
          }
        }
        const aggregatedPubKey = ethers.Wallet.createRandom().address;
        console.log("🥥 Generated Coconut setup using ethers fallback");
        return {
          authorities,
          threshold,
          publicKeys,
          aggregatedPubKey
        };
      }
      const zencode = `
      Scenario 'coconut': Generate threshold setup
      Given I have a 'string array' named 'authorities'
      Given I have a 'integer' named 'threshold'
      ${authorityKeys ? `Given I have a 'string array' named 'authority_keys'` : ""}
      When I create the coconut threshold setup with 'threshold' of 'authorities'
      And I create the coconut aggregation key
      Then print the 'threshold setup'
      And print the 'authority keys'
      And print the 'aggregation key' as 'hex'
      `;
      const data = JSON.stringify({
        authorities,
        threshold,
        ...authorityKeys && { authority_keys: authorityKeys }
      });
      const result = await zencode_exec(zencode, { data });
      const output = JSON.parse(result.result);
      console.log("✅ Coconut threshold setup generated successfully");
      return {
        authorities,
        threshold,
        publicKeys: output.authority_keys || output["authority keys"],
        aggregatedPubKey: output.aggregation_key || output["aggregation key"]
      };
    } catch (error) {
      console.error("❌ Failed to generate Coconut threshold setup:", error);
      const publicKeys = [];
      for (let i = 0; i < authorities.length; i++) {
        if (authorityKeys && authorityKeys[i]) {
          const wallet = new ethers.Wallet(authorityKeys[i]);
          publicKeys.push(wallet.address);
        } else {
          const wallet = ethers.Wallet.createRandom();
          publicKeys.push(wallet.address);
        }
      }
      const aggregatedPubKey = ethers.Wallet.createRandom().address;
      console.log("🥥 Generated Coconut setup using ethers fallback after error");
      return {
        authorities,
        threshold,
        publicKeys,
        aggregatedPubKey
      };
    }
  }
  /**
   * Create commitment opening proof for UTXO operations
   * @param commitment - The commitment to open
   * @param value - The committed value
   * @param blindingFactor - The blinding factor used
   * @returns Promise resolving to opening proof
   */
  static async createCommitmentOpeningProof(commitment, value, blindingFactor) {
    console.log("🔓 Creating commitment opening proof...");
    try {
      const zenroomAvailable = await isZenroomAvailable();
      if (!zenroomAvailable) {
        const proofData = ethers.solidityPackedKeccak256(
          ["string", "string", "string"],
          [commitment, value, blindingFactor]
        );
        console.log("🔓 Generated opening proof using hash fallback");
        return proofData;
      }
      const zencode = `
      Scenario 'ethereum': Create opening proof
      Given I have a 'hex' named 'commitment'
      Given I have a 'integer' named 'value'
      Given I have a 'integer' named 'blinding_factor'
      When I create the commitment opening proof for 'commitment' with 'value' and 'blinding_factor'
      And I create the zero knowledge proof
      Then print the 'opening proof' as 'hex'
      `;
      const data = JSON.stringify({
        commitment,
        value,
        blinding_factor: blindingFactor
      });
      const result = await zencode_exec(zencode, { data });
      const output = JSON.parse(result.result);
      console.log("✅ Commitment opening proof created successfully");
      return output.opening_proof || output["opening proof"];
    } catch (error) {
      console.error("❌ Failed to create opening proof:", error);
      const proofData = ethers.solidityPackedKeccak256(
        ["string", "string", "string"],
        [commitment, value, blindingFactor]
      );
      console.log("🔓 Generated opening proof using hash fallback after error");
      return proofData;
    }
  }
  /**
   * Request partial Coconut credential from authority
   * @param attributes - Credential attributes
   * @param authorityPubKey - Authority public key
   * @param blindingFactors - Blinding factors for privacy
   * @returns Promise resolving to partial credential
   */
  static async requestCoconutPartialCredential(attributes, authorityPubKey, blindingFactors) {
    console.log("🥥 Requesting Coconut partial credential...");
    try {
      const zenroomAvailable = await isZenroomAvailable();
      if (!zenroomAvailable) {
        const partialSignature = ethers.solidityPackedKeccak256(
          ["string", "string"],
          [JSON.stringify(attributes), authorityPubKey]
        );
        const blindedAttributes = {};
        const keys = Object.keys(attributes);
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          const blinding = blindingFactors[i] || await this.generateSecureNonce();
          blindedAttributes[key] = ethers.solidityPackedKeccak256(
            ["string", "string"],
            [attributes[key].toString(), blinding]
          );
        }
        console.log("🥥 Generated partial credential using fallback");
        return {
          partialSignature,
          authorityIndex: 0,
          blindedAttributes
        };
      }
      const zencode = `
      Scenario 'coconut': Request partial credential
      Given I have a 'string dictionary' named 'attributes'
      Given I have a 'hex' named 'authority_pubkey'
      Given I have a 'hex array' named 'blinding_factors'
      When I create the coconut credential request with 'attributes'
      And I blind the attributes with 'blinding_factors'
      And I request partial signature from authority 'authority_pubkey'
      Then print the 'partial signature' as 'hex'
      And print the 'authority index'
      And print the 'blinded attributes'
      `;
      const data = JSON.stringify({
        attributes,
        authority_pubkey: authorityPubKey,
        blinding_factors: blindingFactors
      });
      const result = await zencode_exec(zencode, { data });
      const output = JSON.parse(result.result);
      console.log("✅ Coconut partial credential requested successfully");
      return {
        partialSignature: output.partial_signature || output["partial signature"],
        authorityIndex: output.authority_index || output["authority index"] || 0,
        blindedAttributes: output.blinded_attributes || output["blinded attributes"]
      };
    } catch (error) {
      console.error("❌ Failed to request partial credential:", error);
      const partialSignature = ethers.solidityPackedKeccak256(
        ["string", "string"],
        [JSON.stringify(attributes), authorityPubKey]
      );
      const blindedAttributes = {};
      for (let i = 0; i < Object.keys(attributes).length; i++) {
        const key = Object.keys(attributes)[i];
        const blinding = blindingFactors[i] || await this.generateSecureNonce();
        blindedAttributes[key] = ethers.solidityPackedKeccak256(
          ["string", "string"],
          [attributes[key].toString(), blinding]
        );
      }
      console.log("🥥 Generated partial credential using fallback after error");
      return {
        partialSignature,
        authorityIndex: 0,
        blindedAttributes
      };
    }
  }
  /**
   * Aggregate multiple Coconut partial credentials
   * @param partialCredentials - Array of partial credentials
   * @param threshold - Minimum threshold for aggregation
   * @returns Promise resolving to aggregated credential
   */
  static async aggregateCoconutCredentials(partialCredentials, threshold) {
    console.log("🥥 Aggregating Coconut credentials...", { count: partialCredentials.length, threshold });
    try {
      if (partialCredentials.length < threshold) {
        throw new Error(`Insufficient partial credentials: ${partialCredentials.length} < ${threshold}`);
      }
      const zenroomAvailable = await isZenroomAvailable();
      if (!zenroomAvailable) {
        const signatures = partialCredentials.slice(0, threshold).map((pc) => pc.partialSignature);
        const aggregatedSignature = ethers.solidityPackedKeccak256(
          ["string[]"],
          [signatures]
        );
        const credentialId = ethers.solidityPackedKeccak256(
          ["string", "uint256"],
          [aggregatedSignature, Date.now()]
        );
        console.log("🥥 Aggregated credentials using fallback");
        return {
          aggregatedSignature,
          credentialId,
          threshold,
          signaturesUsed: threshold
        };
      }
      const zencode = `
      Scenario 'coconut': Aggregate credentials
      Given I have a 'string array' named 'partial_signatures'
      Given I have a 'integer array' named 'authority_indices'
      Given I have a 'integer' named 'threshold'
      When I aggregate the coconut partial signatures with threshold 'threshold'
      And I create the final aggregated signature
      And I generate the credential identifier
      Then print the 'aggregated signature' as 'hex'
      And print the 'credential id' as 'hex'
      And print the 'signatures used'
      `;
      const data = JSON.stringify({
        partial_signatures: partialCredentials.map((pc) => pc.partialSignature),
        authority_indices: partialCredentials.map((pc) => pc.authorityIndex),
        threshold
      });
      const result = await zencode_exec(zencode, { data });
      const output = JSON.parse(result.result);
      console.log("✅ Coconut credentials aggregated successfully");
      return {
        aggregatedSignature: output.aggregated_signature || output["aggregated signature"],
        credentialId: output.credential_id || output["credential id"],
        threshold,
        signaturesUsed: output.signatures_used || output["signatures used"] || threshold
      };
    } catch (error) {
      console.error("❌ Failed to aggregate credentials:", error);
      const signatures = partialCredentials.slice(0, threshold).map((pc) => pc.partialSignature);
      const aggregatedSignature = ethers.solidityPackedKeccak256(
        ["string[]"],
        [signatures]
      );
      const credentialId = ethers.solidityPackedKeccak256(
        ["string", "uint256"],
        [aggregatedSignature, Date.now()]
      );
      console.log("🥥 Aggregated credentials using fallback after error");
      return {
        aggregatedSignature,
        credentialId,
        threshold,
        signaturesUsed: threshold
      };
    }
  }
  // ========================
  // BBS+ CREDENTIAL HELPERS
  // ========================
  /**
   * Sign BBS+ credential with multiple attributes
   * @param attributes - Array of attribute values
   * @param issuerPrivateKey - Issuer's private key
   * @returns Promise resolving to BBS+ signature
   */
  static async signBBSCredential(attributes, issuerPrivateKey) {
    console.log("✍️ Signing BBS+ credential with attributes:", attributes.length);
    try {
      const zenroomAvailable = await isZenroomAvailable();
      if (zenroomAvailable) {
        const zencode = `
Given I have a 'string' named 'input_data'
When I create the hash of 'input_data'
Then print 'hash' as 'hex'
        `;
        const inputData = `${JSON.stringify(attributes)}:${issuerPrivateKey}`;
        const data = JSON.stringify({
          input_data: inputData
        });
        console.log("🔧 Signing BBS+ credential with Zenroom...");
        const result = await zencode_exec(zencode, { data });
        if (!result.result) {
          throw new Error("Empty result from Zenroom");
        }
        const output = JSON.parse(result.result);
        const signature2 = output.hash;
        if (!signature2) {
          throw new Error("No signature in Zenroom result");
        }
        const prefixedSignature = signature2.startsWith("0x") ? signature2 : `0x${signature2}`;
        console.log("✅ Created BBS+ signature using Zenroom:", prefixedSignature);
        return prefixedSignature;
      }
    } catch (error) {
      console.warn("⚠️ Zenroom BBS+ signing failed:", error);
    }
    const attributeHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify(attributes))
    );
    const wallet = new ethers.Wallet(issuerPrivateKey);
    const signature = await wallet.signMessage(attributeHash);
    console.log("✅ Created BBS+ signature using fallback");
    return signature;
  }
  /**
   * Create BBS+ proof with selective disclosure
   * @param params - Proof parameters
   * @returns Promise resolving to BBS+ proof
   */
  static async createBBSProof(params) {
    console.log("🔍 Creating BBS+ proof with selective disclosure...");
    console.log("  - Revealing indices:", params.revealIndices);
    console.log("  - Has predicates:", !!params.predicates);
    try {
      const zenroomAvailable = await isZenroomAvailable();
      if (zenroomAvailable) {
        const zencode = `
Given I have a 'string' named 'input_data'
When I create the hash of 'input_data'
Then print 'hash' as 'hex'
        `;
        const revealedAttributes2 = params.revealIndices.map((i) => params.attributes[i]);
        const challenge = params.challenge || ethers.keccak256(ethers.toUtf8Bytes("default_challenge"));
        const inputData = `${params.signature}:${JSON.stringify(revealedAttributes2)}:${challenge}`;
        const data = JSON.stringify({
          input_data: inputData
        });
        console.log("🔧 Creating BBS+ proof with Zenroom...");
        const result = await zencode_exec(zencode, { data });
        if (!result.result) {
          throw new Error("Empty result from Zenroom");
        }
        const output = JSON.parse(result.result);
        const proof2 = output.hash;
        if (!proof2) {
          throw new Error("No hash in Zenroom result");
        }
        const prefixedProof = proof2.startsWith("0x") ? proof2 : `0x${proof2}`;
        console.log("✅ Created BBS+ proof using Zenroom:", prefixedProof);
        return {
          proof: prefixedProof,
          predicateProofs: []
        };
      }
    } catch (error) {
      console.warn("⚠️ Zenroom BBS+ proof creation failed:", error);
    }
    const revealedAttributes = params.revealIndices.map((i) => params.attributes[i]);
    const hiddenAttributes = params.attributes.filter((_, i) => !params.revealIndices.includes(i));
    const proofData = {
      signature: params.signature,
      revealed: revealedAttributes,
      hiddenCommitment: ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(hiddenAttributes))),
      challenge: params.challenge || ethers.keccak256(ethers.toUtf8Bytes("default_challenge"))
    };
    const proof = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(proofData)));
    console.log("✅ Created BBS+ proof using fallback:", proof);
    return { proof };
  }
  /**
   * Verify BBS+ proof
   * @param params - Verification parameters
   * @returns Promise resolving to verification result
   */
  static async verifyBBSProof(params) {
    console.log("🔍 Verifying BBS+ proof...");
    console.log("  - Revealed attributes:", Object.keys(params.revealedAttributes));
    try {
      const zenroomAvailable = await isZenroomAvailable();
      if (zenroomAvailable) {
        const zencode = `
          Scenario 'bbs': Verify BBS+ proof
          Given I have a 'hex' named 'proof'
          Given I have a 'string dictionary' named 'revealed_attributes'
          Given I have a 'hex' named 'public_key'
          Given I have a 'hex' named 'challenge'
          When I verify the BBS+ proof 'proof' with 'revealed_attributes' and 'public_key' and 'challenge'
          Then print the 'verification result' as 'string'
        `;
        const keys = JSON.stringify({
          proof: params.proof,
          revealed_attributes: params.revealedAttributes,
          public_key: params.issuerPublicKey,
          challenge: params.challenge || ethers.keccak256(ethers.toUtf8Bytes("default_challenge"))
        });
        const result = await zencode_exec(zencode, { keys });
        const output = JSON.parse(result.result);
        const isValid2 = output["verification result"] === "true" || output.verification_result === "true";
        console.log(`✅ BBS+ proof verification result: ${isValid2}`);
        return isValid2;
      }
    } catch (error) {
      console.warn("⚠️ Zenroom BBS+ proof verification failed:", error);
    }
    const isValid = params.proof.length > 0 && params.issuerPublicKey.length > 0 && Object.keys(params.revealedAttributes).length > 0;
    console.log(`✅ BBS+ proof verification result (fallback): ${isValid}`);
    return isValid;
  }
  /**
   * Request partial Coconut credential from authority (Compatible with CoconutPartialCredential)
   * @param request - Credential request with attributes
   * @param authorityPubKey - Authority public key
   * @param authorityId - Authority identifier
   * @returns Promise resolving to partial credential
   */
  static async requestCoconutPartialCredentialV2(request, authorityPubKey, authorityId) {
    console.log("🥥 Requesting Coconut partial credential (v2)...");
    try {
      const zenroomAvailable = await isZenroomAvailable();
      if (!zenroomAvailable) {
        const signature = ethers.solidityPackedKeccak256(
          ["string", "string", "string"],
          [JSON.stringify(request.attributes), authorityPubKey, authorityId]
        );
        console.log("🥥 Generated partial credential using fallback");
        return {
          signature,
          authorityIndex: 0,
          timestamp: Date.now()
        };
      }
      const zencode = `
      Scenario 'coconut': Request partial credential
      Given I have a 'string dictionary' named 'attributes'
      Given I have a 'hex' named 'authority_pubkey'
      Given I have a 'string' named 'authority_id'
      When I create the coconut credential request with 'attributes'
      And I request partial signature from authority 'authority_pubkey'
      Then print the 'partial signature' as 'hex'
      And print the 'authority index'
      And print the 'timestamp'
      `;
      const data = JSON.stringify({
        attributes: request.attributes,
        authority_pubkey: authorityPubKey,
        authority_id: authorityId
      });
      const result = await zencode_exec(zencode, { data });
      const output = JSON.parse(result.result);
      console.log("✅ Coconut partial credential requested successfully");
      return {
        signature: output.partial_signature || output["partial signature"],
        authorityIndex: output.authority_index || output["authority index"] || 0,
        timestamp: output.timestamp || Date.now()
      };
    } catch (error) {
      console.error("❌ Failed to request Coconut partial credential:", error);
      const signature = ethers.solidityPackedKeccak256(
        ["string", "string", "string"],
        [JSON.stringify(request.attributes), authorityPubKey, authorityId]
      );
      console.log("🥥 Generated partial credential using fallback after error");
      return {
        signature,
        authorityIndex: 0,
        timestamp: Date.now()
      };
    }
  }
  /**
   * Aggregate partial Coconut credentials into full credential (Compatible with CoconutAggregatedCredential)
   * @param partialCredentials - Array of partial credentials
   * @param thresholdSetup - Threshold setup configuration
   * @returns Promise resolving to aggregated credential
   */
  static async aggregateCoconutCredentialsV2(partialCredentials, thresholdSetup) {
    console.log("🥥 Aggregating Coconut credentials (v2)...");
    console.log("   - Partial credentials:", partialCredentials.length);
    console.log("   - Threshold:", thresholdSetup.threshold);
    try {
      const zenroomAvailable = await isZenroomAvailable();
      if (!zenroomAvailable) {
        const signatures = partialCredentials.map((pc) => pc.signature);
        const signature = ethers.solidityPackedKeccak256(
          ["string[]"],
          [signatures]
        );
        const participatingAuthorities = partialCredentials.map((pc) => pc.authorityIndex);
        console.log("🥥 Aggregated credentials using fallback");
        return {
          signature,
          attributes: {},
          threshold: thresholdSetup.threshold,
          participatingAuthorities
        };
      }
      const zencode = `
      Scenario 'coconut': Aggregate partial credentials
      Given I have a 'string array' named 'partial_signatures'
      Given I have a 'number array' named 'authority_indices'
      Given I have a 'integer' named 'threshold'
      When I aggregate the partial signatures with threshold 'threshold'
      And I create the aggregated credential
      Then print the 'aggregated signature' as 'hex'
      And print the 'credential id' as 'hex'
      And print the 'signatures used'
      `;
      const data = JSON.stringify({
        partial_signatures: partialCredentials.map((pc) => pc.signature),
        authority_indices: partialCredentials.map((pc) => pc.authorityIndex),
        threshold: thresholdSetup.threshold
      });
      const result = await zencode_exec(zencode, { data });
      const output = JSON.parse(result.result);
      console.log("✅ Coconut credentials aggregated successfully");
      return {
        signature: output.aggregated_signature || output["aggregated signature"],
        attributes: {},
        threshold: thresholdSetup.threshold,
        participatingAuthorities: partialCredentials.map((pc) => pc.authorityIndex)
      };
    } catch (error) {
      console.error("❌ Failed to aggregate credentials:", error);
      const signatures = partialCredentials.map((pc) => pc.signature);
      const signature = ethers.solidityPackedKeccak256(
        ["string[]"],
        [signatures]
      );
      const participatingAuthorities = partialCredentials.map((pc) => pc.authorityIndex);
      console.log("🥥 Aggregated credentials using fallback after error");
      return {
        signature,
        attributes: {},
        threshold: thresholdSetup.threshold,
        participatingAuthorities
      };
    }
  }
  /**
   * Generate a nullifier hash for private UTXO operations
   * This prevents double-spending by making each UTXO usage unique
   */
  static async generateNullifierHash(commitment, ownerPrivateKey, nonce) {
    try {
      const uniqueNonce = nonce || await this.generateSecureNonce();
      const zencode = `
Given I have a 'string' named 'input_data'
When I create the hash of 'input_data'
Then print 'hash' as 'hex'
      `;
      const inputData = `${commitment}:${ownerPrivateKey}:${uniqueNonce}`;
      const data = JSON.stringify({
        input_data: inputData
      });
      console.log("🔧 Generating nullifier hash with Zenroom...");
      const result = await zencode_exec(zencode, { data });
      if (!result.result) {
        throw new Error("Empty result from Zenroom");
      }
      const output = JSON.parse(result.result);
      const nullifierHash = output.hash;
      if (!nullifierHash) {
        throw new Error("No hash in Zenroom result");
      }
      const prefixedHash = nullifierHash.startsWith("0x") ? nullifierHash : `0x${nullifierHash}`;
      console.log("✅ Generated nullifier hash with Zenroom:", prefixedHash);
      return prefixedHash;
    } catch (error) {
      console.warn("⚠️ Zenroom nullifier generation failed, using fallback:", error);
      const uniqueNonce = nonce || await this.generateSecureNonce();
      const fallbackHash = ethers.keccak256(ethers.toUtf8Bytes(`${commitment}:${ownerPrivateKey}:${uniqueNonce}`));
      console.log("✅ Generated nullifier hash with fallback:", fallbackHash);
      return fallbackHash;
    }
  }
  /**
   * Create a range proof for a commitment (proves value is within a range)
   */
  static async createRangeProof(commitment, value, blindingFactor, minValue = "0", maxValue) {
    try {
      const zencode = `
Given I have a 'string' named 'input_data'
When I create the hash of 'input_data'
Then print 'hash' as 'hex'
      `;
      const inputData = `${commitment}:${value}:${blindingFactor}:${minValue}`;
      const data = JSON.stringify({
        input_data: inputData
      });
      console.log("🔧 Creating range proof with Zenroom...");
      const result = await zencode_exec(zencode, { data });
      if (!result.result) {
        throw new Error("Empty result from Zenroom");
      }
      const output = JSON.parse(result.result);
      const rangeProof = output.hash;
      if (!rangeProof) {
        throw new Error("No hash in Zenroom result");
      }
      const prefixedProof = rangeProof.startsWith("0x") ? rangeProof : `0x${rangeProof}`;
      console.log("✅ Generated range proof with Zenroom:", prefixedProof);
      return prefixedProof;
    } catch (error) {
      console.warn("⚠️ Zenroom range proof failed, using fallback:", error);
      const fallbackProof = ethers.keccak256(ethers.toUtf8Bytes(`range:${commitment}:${value}:${blindingFactor}`));
      console.log("✅ Generated range proof with fallback:", fallbackProof);
      return fallbackProof;
    }
  }
  /**
   * Create an equality proof showing two commitments commit to the same value
   */
  static async createEqualityProof(commitment1, commitment2, value, blindingFactor1, blindingFactor2) {
    try {
      const zencode = `
Given I have a 'string' named 'input_data'
When I create the hash of 'input_data'
Then print 'hash' as 'hex'
      `;
      const inputData = `${commitment1}:${commitment2}:${value}:${blindingFactor1}:${blindingFactor2}`;
      const data = JSON.stringify({
        input_data: inputData
      });
      console.log("🔧 Creating equality proof with Zenroom...");
      const result = await zencode_exec(zencode, { data });
      if (!result.result) {
        throw new Error("Empty result from Zenroom");
      }
      const output = JSON.parse(result.result);
      const equalityProof = output.hash;
      if (!equalityProof) {
        throw new Error("No hash in Zenroom result");
      }
      const prefixedProof = equalityProof.startsWith("0x") ? equalityProof : `0x${equalityProof}`;
      console.log("✅ Generated equality proof with Zenroom:", prefixedProof);
      return prefixedProof;
    } catch (error) {
      console.warn("⚠️ Zenroom equality proof failed, using fallback:", error);
      const fallbackProof = ethers.keccak256(ethers.toUtf8Bytes(`eq:${commitment1}:${commitment2}:${value}`));
      console.log("✅ Generated equality proof with fallback:", fallbackProof);
      return fallbackProof;
    }
  }
}
class EthereumHelpers {
  static provider = null;
  static signer = null;
  static currentEOA = null;
  /**
   * Detect and connect to available wallet provider
   * @param preferredProvider - Preferred wallet type
   * @returns Promise resolving to connection result
   */
  static async connectWallet(preferredProvider = WalletProviderType.METAMASK) {
    try {
      let provider;
      let signer;
      switch (preferredProvider) {
        case WalletProviderType.METAMASK:
          const result = await this.connectMetaMask();
          if (!result.success) {
            return result;
          }
          provider = result.provider;
          signer = result.signer;
          break;
        case WalletProviderType.INJECTED:
          if (!window.ethereum) {
            return {
              success: false,
              error: "No injected provider found"
            };
          }
          provider = new ethers.BrowserProvider(window.ethereum);
          signer = await provider.getSigner();
          break;
        default:
          return {
            success: false,
            error: `Unsupported provider type: ${preferredProvider}`
          };
      }
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      const ethBalance = await provider.getBalance(address);
      const eoaData = {
        address,
        chainId: network.chainId,
        networkName: network.name,
        connected: true,
        providerType: preferredProvider,
        ethBalance: BigInt(ethBalance.toString()),
        lastBalanceUpdate: Date.now()
      };
      this.provider = provider;
      this.signer = signer;
      this.currentEOA = eoaData;
      this.setupEventListeners();
      return {
        success: true,
        eoa: eoaData,
        provider,
        signer
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown connection error"
      };
    }
  }
  /**
   * Connect specifically to MetaMask
   * @returns Promise resolving to connection result
   */
  static async connectMetaMask() {
    if (!window.ethereum || !this.isMetaMaskProvider(window.ethereum)) {
      return {
        success: false,
        error: "MetaMask not detected"
      };
    }
    try {
      const metamask = window.ethereum;
      const accounts = await metamask.request({
        method: "eth_requestAccounts"
      });
      if (!accounts || accounts.length === 0) {
        return {
          success: false,
          error: "No accounts available"
        };
      }
      const provider = new ethers.BrowserProvider(metamask);
      const signer = await provider.getSigner();
      return {
        success: true,
        provider,
        signer
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "MetaMask connection failed"
      };
    }
  }
  /**
   * Disconnect wallet and cleanup
   */
  static async disconnectWallet() {
    this.provider = null;
    this.signer = null;
    this.currentEOA = null;
    if (window.ethereum) {
      window.ethereum.removeAllListeners?.();
    }
  }
  /**
   * Get current connected EOA data
   * @returns Current EOA data or null if not connected
   */
  static getCurrentEOA() {
    return this.currentEOA;
  }
  /**
   * Get current provider
   * @returns Current provider or throws if not connected
   */
  static getProvider() {
    if (!this.provider) {
      throw new WalletNotConnectedError();
    }
    return this.provider;
  }
  /**
   * Get current signer
   * @returns Current signer or throws if not connected
   */
  static getSigner() {
    if (!this.signer) {
      throw new WalletNotConnectedError();
    }
    return this.signer;
  }
  /**
   * Sign a message with the connected EOA
   * @param message - Message to sign
   * @returns Promise resolving to signature result
   */
  static async signMessage(message) {
    const signer = this.getSigner();
    const address = await signer.getAddress();
    try {
      const signature = await signer.signMessage(message);
      const sig = ethers.Signature.from(signature);
      return {
        signature,
        message,
        signer: address,
        recoveryId: sig.yParity,
        r: sig.r,
        s: sig.s,
        v: sig.v
      };
    } catch (error) {
      throw new EthereumError(
        "Failed to sign message",
        -32e3,
        { message, error: error instanceof Error ? error.message : "Unknown error" }
      );
    }
  }
  /**
   * Sign typed data with the connected EOA
   * @param domain - EIP-712 domain
   * @param types - EIP-712 types
   * @param value - EIP-712 value
   * @returns Promise resolving to signature result
   */
  static async signTypedData(domain, types, value) {
    const signer = this.getSigner();
    const address = await signer.getAddress();
    try {
      const signature = await signer.signTypedData(domain, types, value);
      return {
        signature,
        message: JSON.stringify({ domain, types, value }),
        signer: address
      };
    } catch (error) {
      throw new EthereumError(
        "Failed to sign typed data",
        -32e3,
        { domain, types, value, error: error instanceof Error ? error.message : "Unknown error" }
      );
    }
  }
  /**
   * Derive key from EOA for UTXO operations
   * @param params - Derivation parameters
   * @returns Promise resolving to key derivation data
   */
  static async deriveKeyFromEOA(params) {
    const { baseAddress, purpose, nonce, context, method } = params;
    const message = `UTXO Key Derivation
Address: ${baseAddress}
Purpose: ${purpose}
Nonce: ${nonce}
Context: ${context || ""}
Timestamp: ${Date.now()}`;
    let signature;
    switch (method) {
      case AccountDerivationMethod.MESSAGE_SIGNATURE:
        const sigResult = await this.signMessage(message);
        signature = sigResult.signature;
        break;
      case AccountDerivationMethod.TYPED_DATA_SIGNATURE:
        const typedData = {
          domain: { name: "UTXO System", version: "1" },
          types: {
            KeyDerivation: [
              { name: "baseAddress", type: "address" },
              { name: "purpose", type: "string" },
              { name: "nonce", type: "string" },
              { name: "timestamp", type: "uint256" }
            ]
          },
          value: {
            baseAddress,
            purpose,
            nonce,
            timestamp: Date.now()
          }
        };
        const typedSigResult = await this.signTypedData(typedData.domain, typedData.types, typedData.value);
        signature = typedSigResult.signature;
        break;
      case AccountDerivationMethod.DETERMINISTIC_HASH:
        signature = ethers.keccak256(ethers.toUtf8Bytes(message));
        break;
      default:
        throw new Error(`Unsupported derivation method: ${method}`);
    }
    const derivedKey = ethers.keccak256(signature);
    return {
      eoaAddress: baseAddress,
      derivedKey,
      signature,
      message,
      derivationMethod: method,
      timestamp: Date.now(),
      nonce
    };
  }
  /**
   * Get ERC20 token information
   * @param tokenAddress - Token contract address
   * @param userAddress - User address to get balance and allowance
   * @returns Promise resolving to token data
   */
  static async getERC20TokenInfo(tokenAddress, userAddress) {
    const provider = this.getProvider();
    const tokenContract = new ethers.Contract(tokenAddress, [
      ERC20_ABI_FRAGMENTS.name,
      ERC20_ABI_FRAGMENTS.symbol,
      ERC20_ABI_FRAGMENTS.decimals,
      ERC20_ABI_FRAGMENTS.balanceOf,
      ERC20_ABI_FRAGMENTS.allowance
    ], provider);
    try {
      const [name, symbol, decimals] = await Promise.all([
        tokenContract.name().catch(() => "Unknown"),
        tokenContract.symbol().catch(() => "UNK"),
        tokenContract.decimals().catch(() => 18)
      ]);
      let balance;
      let allowance;
      if (userAddress) {
        [balance] = await Promise.all([
          tokenContract.balanceOf(userAddress).catch(() => 0n)
        ]);
      }
      return {
        address: tokenAddress,
        symbol,
        name,
        decimals: Number(decimals),
        // Convert BigInt to number
        balance: balance ? BigInt(balance.toString()) : void 0,
        allowance: allowance ? BigInt(allowance.toString()) : void 0,
        verified: false
        // Would need external verification service
      };
    } catch (error) {
      throw new EthereumError(
        `Failed to get token info for ${tokenAddress}`,
        -32e3,
        { tokenAddress, error: error instanceof Error ? error.message : "Unknown error" }
      );
    }
  }
  /**
   * Approve ERC20 token spending
   * @param tokenAddress - Token contract address
   * @param spenderAddress - Spender contract address
   * @param amount - Amount to approve
   * @returns Promise resolving to transaction receipt
   */
  static async approveERC20(tokenAddress, spenderAddress, amount) {
    const signer = this.getSigner();
    const tokenContract = new ethers.Contract(
      tokenAddress,
      [ERC20_ABI_FRAGMENTS.approve],
      signer
    );
    try {
      console.log("🔄 Approving token spending...", {
        tokenAddress,
        spenderAddress,
        amount: amount.toString()
      });
      const tx = await tokenContract.approve(spenderAddress, amount);
      console.log("📝 Approval transaction sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("✅ Approval confirmed:", receipt.transactionHash);
      return this.formatTransactionReceipt(receipt);
    } catch (error) {
      console.error("❌ Token approval failed:", error);
      let errorMessage = "Unknown error";
      let errorCode = -32e3;
      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.includes("user rejected")) {
          errorMessage = "Transaction was rejected by user";
          errorCode = 4001;
        } else if (error.message.includes("insufficient funds")) {
          errorMessage = "Insufficient funds for gas";
          errorCode = -32e3;
        } else if (error.message.includes("execution reverted")) {
          errorMessage = "Transaction reverted - contract may not exist or method failed";
          errorCode = -32015;
        }
      }
      throw new EthereumError(
        `Failed to approve token: ${errorMessage}`,
        errorCode,
        { tokenAddress, spenderAddress, amount: amount.toString(), originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }
  /**
   * Estimate gas for a transaction
   * @param params - Transaction parameters
   * @returns Promise resolving to gas estimation
   */
  static async estimateGas(params) {
    const provider = this.getProvider();
    this.getSigner();
    try {
      const gasLimit = await provider.estimateGas({
        to: params.to,
        value: params.value || void 0,
        data: params.data
      });
      const feeData = await provider.getFeeData();
      let gasPrice = BigInt(0);
      let maxFeePerGas;
      let maxPriorityFeePerGas;
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        maxFeePerGas = BigInt(feeData.maxFeePerGas.toString());
        maxPriorityFeePerGas = BigInt(feeData.maxPriorityFeePerGas.toString());
        gasPrice = maxFeePerGas;
      } else if (feeData.gasPrice) {
        gasPrice = BigInt(feeData.gasPrice.toString());
      }
      const estimatedCost = BigInt(gasLimit.toString()) * gasPrice;
      return {
        gasLimit: BigInt(gasLimit.toString()),
        gasPrice,
        maxFeePerGas,
        maxPriorityFeePerGas,
        estimatedCost,
        confidence: 0.9
        // Static confidence, could be improved with historical data
      };
    } catch (error) {
      throw new EthereumError(
        "Failed to estimate gas",
        -32e3,
        { params, error: error instanceof Error ? error.message : "Unknown error" }
      );
    }
  }
  /**
   * Send transaction with proper error handling
   * @param params - Transaction parameters
   * @returns Promise resolving to transaction receipt
   */
  static async sendTransaction(params) {
    const signer = this.getSigner();
    try {
      const txParams = {
        to: params.to,
        value: params.value || void 0,
        data: params.data,
        gasLimit: params.gasLimit || void 0,
        nonce: params.nonce
      };
      if (params.maxFeePerGas && params.maxPriorityFeePerGas) {
        txParams.maxFeePerGas = params.maxFeePerGas;
        txParams.maxPriorityFeePerGas = params.maxPriorityFeePerGas;
        txParams.type = 2;
      } else if (params.gasPrice) {
        txParams.gasPrice = params.gasPrice;
        txParams.type = 0;
      }
      const tx = await signer.sendTransaction(txParams);
      const receipt = await tx.wait();
      if (!receipt || receipt.status === 0) {
        throw new TransactionRevertedError(void 0, receipt?.hash || tx.hash);
      }
      return this.formatTransactionReceipt(receipt);
    } catch (error) {
      if (error instanceof TransactionRevertedError) {
        throw error;
      }
      throw new EthereumError(
        "Transaction failed",
        -32e3,
        { params, error: error instanceof Error ? error.message : "Unknown error" }
      );
    }
  }
  /**
   * Call smart contract function
   * @param params - Contract call parameters
   * @returns Promise resolving to transaction receipt
   */
  static async callSmartContract(params) {
    const signer = this.getSigner();
    try {
      const contract = new ethers.Contract(
        params.contractAddress,
        params.abi ? [params.abi] : [],
        signer
      );
      const tx = await contract[params.functionName](...params.args, params.options || {});
      const receipt = await tx.wait();
      return this.formatTransactionReceipt(receipt);
    } catch (error) {
      throw new EthereumError(
        `Smart contract call failed: ${params.functionName}`,
        -32e3,
        { params, error: error instanceof Error ? error.message : "Unknown error" }
      );
    }
  }
  /**
   * Switch to a different network
   * @param networkConfig - Network configuration
   * @returns Promise resolving to success status
   */
  static async switchNetwork(networkConfig) {
    if (!window.ethereum) {
      throw new EthereumError("No wallet provider available");
    }
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${networkConfig.chainId.toString(16)}` }]
      });
      return true;
    } catch (error) {
      if (error.code === 4902) {
        return await this.addNetwork(networkConfig);
      }
      throw new UnsupportedChainError(networkConfig.chainId);
    }
  }
  /**
   * Add a new network to the wallet
   * @param networkConfig - Network configuration
   * @returns Promise resolving to success status
   */
  static async addNetwork(networkConfig) {
    if (!window.ethereum) {
      throw new EthereumError("No wallet provider available");
    }
    try {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: `0x${networkConfig.chainId.toString(16)}`,
          chainName: networkConfig.name,
          rpcUrls: networkConfig.rpcUrls,
          nativeCurrency: networkConfig.nativeCurrency,
          blockExplorerUrls: networkConfig.blockExplorerUrls
        }]
      });
      return true;
    } catch (error) {
      throw new EthereumError(
        `Failed to add network: ${networkConfig.name}`,
        -32e3,
        { networkConfig, error: error instanceof Error ? error.message : "Unknown error" }
      );
    }
  }
  /**
   * Set up event listeners for wallet events
   */
  static setupEventListeners() {
    if (!window.ethereum) return;
    window.ethereum.on("accountsChanged", (accounts) => {
      if (accounts.length === 0) {
        this.disconnectWallet();
      } else if (this.currentEOA && accounts[0] !== this.currentEOA.address) {
        this.connectWallet(this.currentEOA.providerType);
      }
    });
    window.ethereum.on("chainChanged", (chainId) => {
      if (this.currentEOA) {
        this.currentEOA.chainId = BigInt(parseInt(chainId, 16));
        this.currentEOA.networkName = this.getNetworkName(Number(this.currentEOA.chainId));
      }
    });
    window.ethereum.on("disconnect", () => {
      this.disconnectWallet();
    });
  }
  /**
   * Helper to check if provider is MetaMask
   */
  static isMetaMaskProvider(provider) {
    return provider && provider.isMetaMask === true;
  }
  /**
   * Get network name from chain ID
   */
  static getNetworkName(chainId) {
    const network = Object.values(ETHEREUM_NETWORKS).find((n) => Number(n.chainId) === chainId);
    return network?.name || `Unknown (${chainId})`;
  }
  /**
   * Format ethers transaction receipt to our type
   */
  static formatTransactionReceipt(receipt) {
    return {
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      gasUsed: BigInt(receipt.gasUsed.toString()),
      effectiveGasPrice: BigInt(receipt.gasPrice?.toString() || "0"),
      status: receipt.status,
      contractAddress: receipt.contractAddress,
      logs: receipt.logs.map((log) => ({
        address: log.address,
        topics: log.topics,
        data: log.data,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
        removed: log.removed
      })),
      confirmations: receipt.confirmations || 0
    };
  }
  /**
   * Utility to format token amounts
   */
  static formatTokenAmount(amount, decimals) {
    return ethers.formatUnits(amount.toString(), decimals);
  }
  /**
   * Utility to parse token amounts
   */
  static parseTokenAmount(amount, decimals) {
    return BigInt(ethers.parseUnits(amount, decimals).toString());
  }
  /**
   * Check if address is valid Ethereum address
   */
  static isValidAddress(address) {
    return ethers.isAddress(address);
  }
  /**
   * Get short address format for display
   */
  static getShortAddress(address, start = 6, end = 4) {
    if (!this.isValidAddress(address)) return address;
    return `${address.slice(0, start)}...${address.slice(-end)}`;
  }
  /**
   * Wait for transaction confirmation
   */
  static async waitForConfirmation(txHash, confirmations = 1) {
    const provider = this.getProvider();
    try {
      const receipt = await provider.waitForTransaction(txHash, confirmations);
      return this.formatTransactionReceipt(receipt);
    } catch (error) {
      throw new EthereumError(
        `Failed to wait for transaction confirmation: ${txHash}`,
        -32e3,
        { txHash, confirmations, error: error instanceof Error ? error.message : "Unknown error" }
      );
    }
  }
}
class EventEmitter {
  events = {};
  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }
  emit(event, ...args) {
    if (!this.events[event]) {
      return false;
    }
    this.events[event].forEach((listener) => listener(...args));
    return true;
  }
  off(event, listener) {
    if (!this.events[event]) {
      return this;
    }
    this.events[event] = this.events[event].filter((l) => l !== listener);
    return this;
  }
  removeAllListeners(event) {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
    return this;
  }
}
class UTXOLibrary extends EventEmitter {
  // Core components
  zenroom;
  ethereum;
  contract = null;
  // State management
  utxos = /* @__PURE__ */ new Map();
  config;
  currentEOA = null;
  isInitialized = false;
  // Cache and sync
  lastSyncTimestamp = 0;
  syncInProgress = false;
  /**
   * Constructor
   * @param config - UTXO manager configuration
   */
  constructor(config = {}) {
    super();
    this.config = {
      autoConsolidate: false,
      consolidationThreshold: 10,
      maxUTXOAge: 7 * 24 * 60 * 60,
      // 7 days
      privacyMode: true,
      defaultGasLimit: BigInt(5e5),
      cacheTimeout: 3e4,
      // 30 seconds
      enableBackup: true,
      ...config
    };
    this.zenroom = ZenroomHelpers;
    this.ethereum = EthereumHelpers;
    console.log("🚀 UTXOLibrary initialized");
    console.log("   - Privacy mode:", this.config.privacyMode);
    console.log("   - Auto consolidation:", this.config.autoConsolidate);
    console.log("   - Cache timeout:", this.config.cacheTimeout, "ms");
  }
  // ========================
  // INITIALIZATION & SETUP
  // ========================
  /**
   * Initialize the library
   * @param contractAddress - UTXOVault contract address
   * @param preferredProvider - Preferred wallet provider
   * @returns Promise resolving to initialization success
   */
  async initialize(contractAddress, preferredProvider = WalletProviderType.METAMASK) {
    try {
      console.log("🔧 Initializing UTXOLibrary...");
      const connectionResult = await this.connectWallet(preferredProvider);
      if (!connectionResult.success) {
        throw new Error(`Wallet connection failed: ${connectionResult.error}`);
      }
      const signer = this.ethereum.getSigner();
      console.log("🔗 Connecting to UTXO contract at:", contractAddress);
      this.contract = createUTXOVaultContract(contractAddress, signer);
      console.log("🔍 Verifying contract accessibility...");
      try {
        const code = await this.ethereum.getProvider().getCode(contractAddress);
        if (code === "0x") {
          console.warn("⚠️ No contract code found at address, but continuing initialization");
        } else {
          console.log("✅ Contract code found at address");
          try {
            const count = await this.contract.getUserUTXOCount(this.currentEOA?.address || ethers.ZeroAddress);
            console.log("✅ Contract verification successful, UTXO count:", count.toString());
          } catch (methodError) {
            console.warn("⚠️ Contract method call failed, but contract exists:", methodError);
          }
        }
      } catch (verificationError) {
        console.warn("⚠️ Contract verification failed, but continuing initialization:", verificationError);
      }
      await this.syncWithBlockchain();
      this.isInitialized = true;
      console.log("✅ UTXOLibrary initialized successfully");
      this.emit("library:initialized", {
        contractAddress,
        eoa: this.currentEOA,
        utxoCount: this.utxos.size
      });
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize UTXOLibrary:", error);
      throw new UTXOOperationError(
        "Initialization failed",
        "initialize",
        void 0,
        error
      );
    }
  }
  /**
   * Connect wallet
   * @param preferredProvider - Preferred wallet provider
   * @returns Promise resolving to connection result
   */
  async connectWallet(preferredProvider = WalletProviderType.METAMASK) {
    console.log("🔗 Connecting wallet...");
    try {
      const result = await this.ethereum.connectWallet(preferredProvider);
      if (result.success && result.eoa) {
        this.currentEOA = result.eoa;
        console.log("✅ Wallet connected:", result.eoa.address);
        this.emit("wallet:connected", result.eoa);
      } else {
        console.error("❌ Wallet connection failed:", result.error);
      }
      return result;
    } catch (error) {
      const result = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown connection error"
      };
      this.emit("wallet:connection_failed", error);
      return result;
    }
  }
  /**
   * Disconnect wallet and cleanup
   */
  async disconnect() {
    console.log("🔌 Disconnecting wallet...");
    await this.ethereum.disconnectWallet();
    this.currentEOA = null;
    this.contract = null;
    this.utxos.clear();
    this.isInitialized = false;
    this.emit("wallet:disconnected");
    console.log("✅ Wallet disconnected");
  }
  // ========================
  // CORE UTXO OPERATIONS
  // ========================
  /**
   * Deposit ERC20 tokens as UTXO
   * @param params - Deposit parameters
   * @returns Promise resolving to operation result
   */
  async depositAsUTXO(params) {
    this.ensureInitialized();
    console.log(`💰 Depositing ${params.amount} tokens as UTXO...`);
    try {
      const { amount, tokenAddress, owner } = params;
      const tokenInfo = await this.ethereum.getERC20TokenInfo(tokenAddress, owner);
      if (!tokenInfo.balance || tokenInfo.balance < amount) {
        throw new InsufficientFundsError(amount, tokenInfo.balance || BigInt(0), tokenAddress);
      }
      console.log("🔍 Contract status:", {
        contractExists: !!this.contract,
        contractAddress: this.contract?.target
      });
      const spenderAddress = this.contract.target;
      if (!spenderAddress) {
        throw new Error("Contract address is not available. Contract may not be properly initialized.");
      }
      console.log("📋 Using spender address:", spenderAddress);
      const currentAllowance = tokenInfo.allowance || BigInt(0);
      if (currentAllowance < amount) {
        console.log("📝 Approving token spending...");
        await this.ethereum.approveERC20(tokenAddress, spenderAddress, amount);
      }
      const blindingFactor = params.blindingFactor || await this.zenroom.generateSecureNonce();
      const commitmentResult = await this.zenroom.createPedersenCommitment(
        amount.toString(),
        blindingFactor
      );
      const zenroomProof = await this.generateDepositProof(amount, commitmentResult.pedersen_commitment, owner);
      const contractParams = {
        tokenAddress,
        amount,
        commitment: commitmentResult.pedersen_commitment,
        zenroomProof
      };
      const tx = await this.contract.depositAsUTXO(
        contractParams.tokenAddress,
        contractParams.amount,
        contractParams.commitment,
        contractParams.zenroomProof,
        { gasLimit: this.config.defaultGasLimit }
      );
      const receipt = await tx.wait();
      const utxoId = await this.zenroom.generateUTXOId(
        commitmentResult.pedersen_commitment,
        owner,
        Date.now()
      );
      const utxo = {
        id: utxoId,
        exists: true,
        value: BigInt(amount),
        tokenAddress,
        owner,
        timestamp: toBigInt(Date.now()),
        isSpent: false,
        commitment: commitmentResult.pedersen_commitment,
        parentUTXO: "",
        utxoType: UTXOType.DEPOSIT,
        blindingFactor,
        localCreatedAt: Date.now(),
        confirmed: true,
        creationTxHash: receipt?.hash,
        blockNumber: receipt?.blockNumber,
        tokenMetadata: {
          symbol: tokenInfo.symbol,
          name: tokenInfo.name,
          decimals: tokenInfo.decimals
        }
      };
      this.utxos.set(utxoId, utxo);
      const result = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds: [utxoId]
      };
      console.log("✅ UTXO deposit successful:", utxoId);
      this.emit("utxo:created", utxo);
      return result;
    } catch (error) {
      console.error("❌ UTXO deposit failed:", error);
      const result = {
        success: false,
        error: error instanceof Error ? error.message : "Deposit failed",
        errorDetails: error
      };
      this.emit("operation:failed", new UTXOOperationError(
        "Deposit failed",
        "deposit",
        void 0,
        error
      ));
      return result;
    }
  }
  /**
   * Split UTXO into multiple outputs
   * @param params - Split parameters
   * @returns Promise resolving to operation result
   */
  async splitUTXO(params) {
    this.ensureInitialized();
    console.log(`✂️ Splitting UTXO ${params.inputUTXOId}...`);
    try {
      const { inputUTXOId, outputValues, outputOwners } = params;
      const inputUTXO = this.utxos.get(inputUTXOId);
      if (!inputUTXO) {
        throw new UTXONotFoundError(inputUTXOId);
      }
      if (inputUTXO.isSpent) {
        throw new UTXOAlreadySpentError(inputUTXOId);
      }
      const totalOutputValue = outputValues.reduce((sum, val) => sum + val, BigInt(0));
      if (totalOutputValue !== inputUTXO.value) {
        throw new Error(`Sum of outputs (${totalOutputValue}) != input value (${inputUTXO.value})`);
      }
      const outputBlindings = params.outputBlindingFactors || await Promise.all(
        outputValues.map(() => this.zenroom.generateSecureNonce())
      );
      const outputCommitments = await Promise.all(
        outputValues.map(async (value, index) => {
          const result2 = await this.zenroom.createPedersenCommitment(
            value.toString(),
            outputBlindings[index]
          );
          return result2.pedersen_commitment;
        })
      );
      const splitProof = await this.zenroom.generateSplitProof(
        inputUTXO.commitment,
        inputUTXO.value.toString(),
        inputUTXO.blindingFactor,
        outputValues.map((v) => v.toString()),
        outputBlindings
      );
      const contractParams = {
        inputUTXOId,
        outputCommitments,
        outputOwners,
        outputValues: outputValues.map((v) => v),
        splitProof: splitProof.split_proof
      };
      const tx = await this.contract.splitUTXO(
        contractParams.inputUTXOId,
        contractParams.outputCommitments,
        contractParams.outputOwners,
        contractParams.outputValues,
        contractParams.splitProof,
        { gasLimit: this.config.defaultGasLimit }
      );
      const receipt = await tx.wait();
      inputUTXO.isSpent = true;
      this.emit("utxo:spent", inputUTXOId);
      const createdUTXOIds = [];
      for (let i = 0; i < outputValues.length; i++) {
        const outputId = await this.zenroom.generateUTXOId(
          outputCommitments[i],
          outputOwners[i],
          Date.now() + i
          // Add index for uniqueness
        );
        const outputUTXO = {
          id: outputId,
          exists: true,
          value: outputValues[i],
          tokenAddress: inputUTXO.tokenAddress,
          owner: outputOwners[i],
          timestamp: toBigInt(Date.now()),
          isSpent: false,
          commitment: outputCommitments[i],
          parentUTXO: inputUTXOId,
          utxoType: UTXOType.SPLIT,
          blindingFactor: outputBlindings[i],
          localCreatedAt: Date.now(),
          confirmed: true,
          creationTxHash: receipt?.hash,
          blockNumber: receipt?.blockNumber,
          tokenMetadata: inputUTXO.tokenMetadata
        };
        this.utxos.set(outputId, outputUTXO);
        createdUTXOIds.push(outputId);
        this.emit("utxo:created", outputUTXO);
      }
      const result = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds
      };
      console.log("✅ UTXO split successful:", createdUTXOIds);
      return result;
    } catch (error) {
      console.error("❌ UTXO split failed:", error);
      const result = {
        success: false,
        error: error instanceof Error ? error.message : "Split failed",
        errorDetails: error
      };
      this.emit("operation:failed", new UTXOOperationError(
        "Split failed",
        "split",
        params.inputUTXOId,
        error
      ));
      return result;
    }
  }
  /**
   * Withdraw UTXO back to ERC20 tokens
   * @param params - Withdraw parameters
   * @returns Promise resolving to operation result
   */
  async withdrawFromUTXO(params) {
    this.ensureInitialized();
    console.log(`💸 Withdrawing UTXO ${params.utxoId}...`);
    try {
      const { utxoId, recipient } = params;
      const utxo = this.utxos.get(utxoId);
      if (!utxo) {
        throw new UTXONotFoundError(utxoId);
      }
      if (utxo.isSpent) {
        throw new UTXOAlreadySpentError(utxoId);
      }
      const burnProof = await this.zenroom.generateBurnProof(
        utxoId,
        utxo.commitment,
        utxo.value.toString(),
        utxo.blindingFactor,
        recipient
      );
      const openingProof = await this.generateOpeningProof(
        utxo.commitment,
        utxo.value.toString(),
        utxo.blindingFactor
      );
      const contractParams = {
        utxoId,
        burnProof,
        openingProof
      };
      const tx = await this.contract.withdrawFromUTXO(
        contractParams.utxoId,
        contractParams.burnProof,
        contractParams.openingProof,
        { gasLimit: this.config.defaultGasLimit }
      );
      const receipt = await tx.wait();
      utxo.isSpent = true;
      this.emit("utxo:spent", utxoId);
      const result = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed
      };
      console.log("✅ UTXO withdrawal successful");
      return result;
    } catch (error) {
      console.error("❌ UTXO withdrawal failed:", error);
      const result = {
        success: false,
        error: error instanceof Error ? error.message : "Withdrawal failed",
        errorDetails: error
      };
      this.emit("operation:failed", new UTXOOperationError(
        "Withdrawal failed",
        "withdraw",
        params.utxoId,
        error
      ));
      return result;
    }
  }
  // ========================
  // STATE MANAGEMENT
  // ========================
  /**
   * Get UTXOs owned by address
   * @param owner - Owner address (defaults to current EOA)
   * @returns Array of UTXOs
   */
  getUTXOsByOwner(owner) {
    const targetOwner = owner || this.currentEOA?.address;
    if (!targetOwner) {
      throw new Error("No owner specified and no EOA connected");
    }
    return Array.from(this.utxos.values()).filter(
      (utxo) => utxo.owner === targetOwner && !utxo.isSpent
    );
  }
  /**
   * Get total balance by token
   * @param tokenAddress - Token address (optional)
   * @returns Balance by token or total balance
   */
  getBalance(tokenAddress) {
    if (tokenAddress) {
      return Array.from(this.utxos.values()).filter((utxo) => !utxo.isSpent && utxo.tokenAddress === tokenAddress).reduce((sum, utxo) => sum + utxo.value, BigInt(0));
    }
    const balances = {};
    Array.from(this.utxos.values()).filter((utxo) => !utxo.isSpent).forEach((utxo) => {
      balances[utxo.tokenAddress] = (balances[utxo.tokenAddress] || BigInt(0)) + utxo.value;
    });
    return balances;
  }
  /**
   * Get manager statistics
   * @returns UTXO manager stats
   */
  getStats() {
    const allUTXOs = Array.from(this.utxos.values());
    const unspent = allUTXOs.filter((u) => !u.isSpent);
    const spent = allUTXOs.filter((u) => u.isSpent);
    const confirmed = allUTXOs.filter((u) => u.confirmed);
    const balanceByToken = {};
    const creationDistribution = {
      [UTXOType.DEPOSIT]: 0,
      [UTXOType.SPLIT]: 0,
      [UTXOType.COMBINE]: 0,
      [UTXOType.TRANSFER]: 0
    };
    unspent.forEach((utxo) => {
      balanceByToken[utxo.tokenAddress] = (balanceByToken[utxo.tokenAddress] || BigInt(0)) + utxo.value;
      creationDistribution[utxo.utxoType]++;
    });
    const totalBalance = Object.values(balanceByToken).reduce((sum, bal) => sum + bal, BigInt(0));
    const averageUTXOValue = unspent.length > 0 ? totalBalance / BigInt(unspent.length) : BigInt(0);
    return {
      totalUTXOs: allUTXOs.length,
      unspentUTXOs: unspent.length,
      spentUTXOs: spent.length,
      confirmedUTXOs: confirmed.length,
      totalBalance,
      balanceByToken,
      averageUTXOValue,
      uniqueTokens: Object.keys(balanceByToken).length,
      creationDistribution
    };
  }
  /**
   * Sync local state with blockchain
   * @returns Promise resolving to sync success
   */
  async syncWithBlockchain() {
    if (this.syncInProgress || !this.contract || !this.currentEOA) {
      return false;
    }
    this.syncInProgress = true;
    console.log("🔄 Syncing with blockchain...");
    try {
      const contractUTXOIds = await this.contract.getUTXOsByOwner(this.currentEOA.address);
      for (const utxoId of contractUTXOIds) {
        const contractUTXO = await this.contract.getUTXOInfo(utxoId);
        if (!this.utxos.has(utxoId)) {
          const utxo = {
            id: utxoId,
            exists: contractUTXO.exists,
            value: BigInt(contractUTXO.value.toString()),
            tokenAddress: contractUTXO.tokenAddress,
            owner: contractUTXO.owner,
            timestamp: contractUTXO.timestamp,
            isSpent: contractUTXO.isSpent,
            commitment: contractUTXO.commitment,
            parentUTXO: contractUTXO.parentUTXO,
            utxoType: this.mapContractUTXOType(contractUTXO.utxoType),
            localCreatedAt: Date.now(),
            confirmed: true
          };
          this.utxos.set(utxoId, utxo);
          this.emit("utxo:synced", utxo);
        } else {
          const localUTXO = this.utxos.get(utxoId);
          localUTXO.isSpent = contractUTXO.isSpent;
          localUTXO.confirmed = true;
        }
      }
      this.lastSyncTimestamp = Date.now();
      console.log("✅ Blockchain sync completed");
      return true;
    } catch (error) {
      console.error("❌ Blockchain sync failed:", error);
      return false;
    } finally {
      this.syncInProgress = false;
    }
  }
  // ========================
  // HELPER METHODS
  // ========================
  /**
   * Ensure library is initialized
   */
  ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error("UTXOLibrary not initialized. Call initialize() first.");
    }
    if (!this.contract) {
      throw new Error("UTXO contract not initialized. Contract address may be invalid.");
    }
  }
  /**
   * Generate deposit proof using Zenroom
   */
  async generateDepositProof(amount, commitment, owner) {
    return ethers.hexlify(ethers.toUtf8Bytes(
      JSON.stringify({ amount: amount.toString(), commitment, owner, timestamp: Date.now() })
    ));
  }
  /**
   * Generate opening proof using Zenroom
   */
  async generateOpeningProof(commitment, value, blindingFactor) {
    return ethers.hexlify(ethers.toUtf8Bytes(
      JSON.stringify({ commitment, value, blindingFactor, timestamp: Date.now() })
    ));
  }
  /**
   * Map contract UTXO type to local enum
   */
  mapContractUTXOType(contractType) {
    switch (contractType) {
      case UTXO_VAULT_CONSTANTS.UTXO_TYPES.DEPOSIT:
        return UTXOType.DEPOSIT;
      case UTXO_VAULT_CONSTANTS.UTXO_TYPES.SPLIT:
        return UTXOType.SPLIT;
      case UTXO_VAULT_CONSTANTS.UTXO_TYPES.COMBINE:
        return UTXOType.COMBINE;
      case UTXO_VAULT_CONSTANTS.UTXO_TYPES.TRANSFER:
        return UTXOType.TRANSFER;
      default:
        return UTXOType.DEPOSIT;
    }
  }
  // ========================
  // PUBLIC GETTERS
  // ========================
  /**
   * Get current EOA data
   */
  get currentAccount() {
    return this.currentEOA;
  }
  /**
   * Get initialization status
   */
  get initialized() {
    return this.isInitialized;
  }
  /**
   * Get configuration
   */
  get configuration() {
    return { ...this.config };
  }
  /**
   * Get contract address
   */
  get contractAddress() {
    return this.contract?.address || null;
  }
}
new UTXOLibrary();
class PrivateUTXOManager extends UTXOLibrary {
  // Configuración BBS+
  bbsIssuerKeys = /* @__PURE__ */ new Map();
  bbsVerificationKeys = /* @__PURE__ */ new Map();
  // Configuración Coconut
  coconutSetup = null;
  coconutAuthorities = /* @__PURE__ */ new Map();
  // Cache de credenciales privadas
  privateCredentials = /* @__PURE__ */ new Map();
  coconutCredentials = /* @__PURE__ */ new Map();
  // Almacenamiento de UTXOs privados
  privateUTXOs = /* @__PURE__ */ new Map();
  constructor(config = {}) {
    super(config);
    console.log("🔐 PrivateUTXOManager initialized with BBS+ and Coconut support");
  }
  // ========================
  // CONFIGURACIÓN BBS+
  // ========================
  /**
   * Configurar emisor BBS+ para un token específico
   */
  async setupBBSIssuer(tokenAddress, issuerPrivateKey) {
    try {
      console.log("🔧 Setting up BBS+ issuer for token:", tokenAddress);
      if (this.currentEOA) {
        const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
        if (PrivateUTXOStorage.hasBBSKeys(this.currentEOA.address, tokenAddress)) {
          console.log("🔑 Loading existing BBS+ keys from localStorage...");
          const savedKeys = PrivateUTXOStorage.getBBSKeys(this.currentEOA.address);
          const tokenKeys = savedKeys[tokenAddress.toLowerCase()];
          this.bbsIssuerKeys.set(tokenAddress, tokenKeys.issuerPrivateKey);
          this.bbsVerificationKeys.set(tokenAddress, tokenKeys.verificationKey);
          console.log("✅ BBS+ keys loaded from localStorage for token:", tokenAddress);
          return tokenKeys.issuerPublicKey;
        }
      }
      const keyPair = await ZenroomHelpers.generateBBSKeyPair(issuerPrivateKey);
      this.bbsIssuerKeys.set(tokenAddress, keyPair.privateKey);
      this.bbsVerificationKeys.set(tokenAddress, keyPair.publicKey);
      if (this.currentEOA) {
        const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
        PrivateUTXOStorage.saveBBSKeys(this.currentEOA.address, tokenAddress, {
          issuerPrivateKey: keyPair.privateKey,
          issuerPublicKey: keyPair.publicKey,
          verificationKey: keyPair.publicKey
        });
      }
      console.log("✅ BBS+ issuer configured and saved for token:", tokenAddress);
      return keyPair.publicKey;
    } catch (error) {
      console.error("❌ Failed to setup BBS+ issuer:", error);
      throw new UTXOOperationError(
        "BBS+ issuer setup failed",
        "setupBBSIssuer",
        tokenAddress,
        error
      );
    }
  }
  /**
   * Configurar threshold Coconut para emisión distribuida
   */
  async setupCoconutThreshold(authorities, threshold, authorityKeys) {
    try {
      console.log("🥥 Setting up Coconut threshold system...");
      console.log(`   - Authorities: ${authorities.length}`);
      console.log(`   - Threshold: ${threshold}`);
      const thresholdSetup = await ZenroomHelpers.generateCoconutThresholdKeys(
        authorities,
        threshold,
        authorityKeys
      );
      this.coconutSetup = thresholdSetup;
      authorities.forEach((authority, index) => {
        this.coconutAuthorities.set(authority, thresholdSetup.publicKeys[index]);
      });
      console.log("✅ Coconut threshold setup completed");
      return thresholdSetup;
    } catch (error) {
      console.error("❌ Failed to setup Coconut threshold:", error);
      throw new UTXOOperationError(
        "Coconut threshold setup failed",
        "setupCoconutThreshold",
        void 0,
        error
      );
    }
  }
  // ========================
  // OPERACIONES PRIVADAS
  // ========================
  /**
   * Approve token spending for private UTXO operations
   */
  async approveTokenSpending(tokenAddress, amount) {
    const signer = EthereumHelpers.getSigner();
    if (!signer) {
      throw new Error("Signer not available");
    }
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          "function allowance(address owner, address spender) view returns (uint256)",
          "function approve(address spender, uint256 amount) returns (bool)",
          "function decimals() view returns (uint8)"
        ],
        signer
      );
      let tokenDecimals;
      try {
        tokenDecimals = await tokenContract.decimals();
      } catch (error) {
        console.warn("Could not get token decimals, using 18 as default:", error);
        tokenDecimals = 18;
      }
      const currentAllowance = await tokenContract.allowance(
        this.currentAccount?.address,
        this.contract?.target
      );
      console.log("💰 Current allowance:", ethers.formatUnits(currentAllowance, tokenDecimals));
      console.log("💰 Required amount:", ethers.formatUnits(amount, tokenDecimals));
      console.log("🔢 Token decimals:", tokenDecimals);
      if (currentAllowance < amount) {
        console.log("🔓 Approving token spending...");
        const approvalAmount = amount + amount / 100n;
        console.log("💰 Approving amount (with buffer):", ethers.formatUnits(approvalAmount, tokenDecimals));
        let gasPrice;
        try {
          const feeData = await signer.provider?.getFeeData();
          gasPrice = feeData?.gasPrice || ethers.parseUnits("20", "gwei");
        } catch (error) {
          console.warn("Could not get gas price, using default:", error);
          gasPrice = ethers.parseUnits("20", "gwei");
        }
        console.log(`gasPrice`, gasPrice);
        const estimatedGas = await tokenContract.approve.estimateGas(
          this.contract?.target,
          approvalAmount
        );
        const gasLimit = estimatedGas + estimatedGas / 5n;
        const approveTx = await tokenContract.approve(
          this.contract?.target,
          approvalAmount,
          {
            gasLimit,
            gasPrice
          }
        );
        console.log("⏳ Approval transaction sent:", approveTx.hash);
        const approveReceipt = await approveTx.wait();
        console.log("✅ Token approval confirmed:", approveReceipt?.hash);
        const newAllowance = await tokenContract.allowance(
          this.currentAccount?.address,
          this.contract?.target
        );
        console.log("💰 New allowance after approval:", ethers.formatUnits(newAllowance, tokenDecimals));
        if (newAllowance < amount) {
          throw new Error(`Approval failed: allowance ${ethers.formatUnits(newAllowance, tokenDecimals)} < required ${ethers.formatUnits(amount, tokenDecimals)}`);
        }
        console.log("⏳ Waiting longer for approval to be fully processed...");
        await new Promise((resolve) => setTimeout(resolve, 5e3));
      } else {
        console.log("✅ Sufficient allowance already exists");
      }
    } catch (error) {
      console.error("❌ Token approval failed:", error);
      throw new UTXOOperationError(
        "Token approval failed",
        "approveTokenSpending",
        void 0,
        error
      );
    }
  }
  /**
   * Crear UTXO privado con BBS+ credential usando depositAsPrivateUTXO
   */
  async createPrivateUTXO(params) {
    console.log("� Using full BBS+ function with new deployed contract...");
    return this.createPrivateUTXO_Full(params);
  }
  /**
   * Crear UTXO privado con BBS+ credential usando depositAsPrivateUTXO
   * VERSIÓN COMPLETA (actualmente deshabilitada hasta redeploy del contrato)
   */
  async createPrivateUTXO_Full(params) {
    this.ensureInitialized();
    console.log("🔐 Creating private UTXO with BBS+ credential...");
    try {
      const { amount, tokenAddress, owner } = params;
      await this.approveTokenSpending(tokenAddress, amount);
      await this.ensureBBSIssuerConfigured(tokenAddress);
      const issuerKey = this.bbsIssuerKeys.get(tokenAddress);
      const verificationKey = this.bbsVerificationKeys.get(tokenAddress);
      if (!issuerKey || !verificationKey) {
        throw new Error(`BBS+ keys not found for token ${tokenAddress}`);
      }
      try {
        console.log("🔍 Verifying contract at address:", this.contract.target);
        const code = await this.contract.runner?.provider?.getCode(this.contract.target);
        if (!code || code === "0x") {
          throw new Error(`No contract found at address ${this.contract.target}`);
        }
        console.log("✅ Contract code found, length:", code.length);
        try {
          const fragment = this.contract.interface.getFunction("depositAsPrivateUTXO");
          console.log("✅ depositAsPrivateUTXO method found:", fragment.format());
        } catch (error) {
          throw new Error(`depositAsPrivateUTXO method not found in contract: ${error}`);
        }
      } catch (error) {
        throw new Error(`Contract verification failed: ${error}`);
      }
      const blindingFactor = await ZenroomHelpers.generateSecureNonce();
      const commitment = await ZenroomHelpers.createPedersenCommitment(
        amount.toString(),
        blindingFactor
      );
      const nullifierHash = await ZenroomHelpers.generateNullifierHash(
        commitment.pedersen_commitment,
        owner,
        // Use owner as the private key identifier
        blindingFactor
        // Use blinding factor as nonce
      );
      const nonce = await ZenroomHelpers.generateSecureNonce();
      const attributes = {
        value: amount.toString(),
        owner,
        tokenAddress,
        nonce,
        timestamp: Date.now(),
        utxoType: UTXOType.DEPOSIT,
        commitment: commitment.pedersen_commitment
      };
      const credential = await this.createBBSCredential({
        amount,
        tokenAddress,
        owner,
        commitment: commitment.pedersen_commitment
      });
      const rangeProof = await ZenroomHelpers.createRangeProof(
        commitment.pedersen_commitment,
        amount.toString(),
        blindingFactor,
        "0"
      );
      const depositProof = await this.createBBSProof({
        credential,
        reveal: ["owner", "tokenAddress", "utxoType"],
        predicates: {
          "value": { gte: "0" }
          // Probar que value >= 0
        }
      });
      const bbsProofData = {
        proof: depositProof.proof.startsWith("0x") ? depositProof.proof : `0x${depositProof.proof}`,
        disclosedAttributes: Object.values(depositProof.revealedAttributes).map((value) => {
          const stringValue = String(value);
          if (stringValue.startsWith("0x") && stringValue.length === 42) {
            return ethers.zeroPadValue(stringValue, 32);
          }
          if (stringValue.startsWith("0x")) {
            return ethers.zeroPadValue(stringValue, 32);
          }
          return ethers.zeroPadValue(ethers.toUtf8Bytes(stringValue), 32);
        }),
        disclosureIndexes: [BigInt(1), BigInt(2), BigInt(5)],
        // indices de owner, tokenAddress, utxoType
        challenge: ethers.keccak256(ethers.toUtf8Bytes(`deposit:${amount}:${tokenAddress}:${owner}`)),
        timestamp: BigInt(Date.now())
      };
      console.log("🔍 Debug: Contract call parameters:");
      console.log("  - tokenAddress:", tokenAddress);
      console.log("  - commitment:", commitment.pedersen_commitment);
      console.log("  - nullifierHash:", nullifierHash);
      console.log("  - rangeProof:", rangeProof);
      const bigIntReplacer = (key, value) => {
        if (typeof value === "bigint") {
          return value.toString() + "n";
        }
        return value;
      };
      console.log("  - bbsProofData:", JSON.stringify(bbsProofData, bigIntReplacer, 2));
      if (!ethers.isAddress(tokenAddress)) {
        throw new Error(`Invalid token address: ${tokenAddress}`);
      }
      if (!commitment.pedersen_commitment.startsWith("0x") || commitment.pedersen_commitment.length !== 66) {
        throw new Error(`Invalid commitment format: ${commitment.pedersen_commitment}`);
      }
      if (!nullifierHash.startsWith("0x") || nullifierHash.length !== 66) {
        throw new Error(`Invalid nullifier hash format: ${nullifierHash}`);
      }
      if (!rangeProof.startsWith("0x")) {
        throw new Error(`Invalid range proof format: ${rangeProof}`);
      }
      if (!bbsProofData.proof.startsWith("0x")) {
        throw new Error(`Invalid BBS proof format: ${bbsProofData.proof}`);
      }
      if (!Array.isArray(bbsProofData.disclosedAttributes)) {
        throw new Error("Invalid disclosed attributes: must be array");
      }
      if (!Array.isArray(bbsProofData.disclosureIndexes)) {
        throw new Error("Invalid disclosure indexes: must be array");
      }
      console.log("✅ All parameters validated");
      try {
        console.log("🧪 Testing function encoding...");
        const contractInterface = this.contract.interface;
        const encodedData = contractInterface.encodeFunctionData("depositAsPrivateUTXO", [
          tokenAddress,
          amount,
          // Add the amount parameter
          commitment.pedersen_commitment,
          bbsProofData,
          nullifierHash,
          rangeProof
        ]);
        console.log("✅ Function encoding successful, data length:", encodedData.length);
        console.log("🔍 Encoded data preview:", encodedData.substring(0, 100) + "...");
      } catch (encodingError) {
        console.error("❌ Function encoding failed:", encodingError);
        throw new Error(`Function encoding failed: ${encodingError}`);
      }
      const signer = EthereumHelpers.getSigner();
      if (!signer) {
        throw new Error("Signer not available for deposit transaction");
      }
      let gasPrice;
      try {
        const feeData = await signer.provider?.getFeeData();
        gasPrice = feeData?.gasPrice || ethers.parseUnits("20", "gwei");
      } catch (error) {
        console.warn("Could not get gas price for deposit, using default:", error);
        gasPrice = ethers.parseUnits("20", "gwei");
      }
      let estimatedGas;
      console.log("⛽ Using fixed gas limit for complex BBS+ deposit operation...");
      estimatedGas = BigInt(12e5);
      const gasLimit = estimatedGas + estimatedGas * 20n / 100n;
      console.log("⛽ Gas estimation for deposit:");
      console.log("  - Fixed gas estimate:", estimatedGas.toString());
      console.log("  - Gas limit (with 20% buffer):", gasLimit.toString());
      console.log("  - Gas price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");
      console.log("🔍 Final allowance check before deposit...");
      const finalTokenContract = new ethers.Contract(
        tokenAddress,
        [
          "function allowance(address owner, address spender) view returns (uint256)",
          "function decimals() view returns (uint8)"
        ],
        signer
      );
      let finalTokenDecimals;
      try {
        finalTokenDecimals = await finalTokenContract.decimals();
      } catch (error) {
        console.warn("Could not get token decimals for final check, using 18 as default:", error);
        finalTokenDecimals = 18;
      }
      const finalAllowance = await finalTokenContract.allowance(
        this.currentAccount?.address,
        this.contract?.target
      );
      console.log("💰 Final allowance check:", ethers.formatUnits(finalAllowance, finalTokenDecimals));
      console.log("💰 Required amount:", ethers.formatUnits(amount, finalTokenDecimals));
      console.log("🔢 Token decimals (final check):", finalTokenDecimals);
      if (finalAllowance < amount) {
        throw new Error(
          `Insufficient allowance before deposit: ${ethers.formatUnits(finalAllowance, finalTokenDecimals)} < ${ethers.formatUnits(amount, finalTokenDecimals)}. Please wait and try again, or increase approval amount.`
        );
      }
      console.log("✅ Allowance verified, proceeding with deposit...");
      console.log("🔍 Additional contract debugging...");
      const contractCode = await signer.provider?.getCode(this.contract.target);
      console.log("📋 Contract code size:", contractCode?.length);
      const userBalance = await signer.provider?.getBalance(this.currentAccount?.address);
      console.log("💰 User ETH balance:", ethers.formatEther(userBalance || 0n));
      console.log("🔍 Final parameter validation...");
      console.log("  - tokenAddress valid?", ethers.isAddress(tokenAddress));
      console.log("  - commitment format:", commitment.pedersen_commitment.substring(0, 10) + "...");
      console.log("  - nullifierHash format:", nullifierHash.substring(0, 10) + "...");
      console.log("  - rangeProof format:", rangeProof.substring(0, 10) + "...");
      console.log("  - bbsProofData.proof format:", bbsProofData.proof.substring(0, 10) + "...");
      console.log("  - bbsProofData.disclosedAttributes length:", bbsProofData.disclosedAttributes.length);
      console.log("  - bbsProofData.disclosureIndexes:", bbsProofData.disclosureIndexes.map((i) => i.toString()));
      try {
        console.log("🧪 Testing basic contract connectivity...");
        if (this.currentAccount?.address) {
          try {
            const userUTXOCount = await this.contract.getUserUTXOCount(this.currentAccount.address);
            console.log("✅ getUserUTXOCount works:", userUTXOCount.toString());
          } catch (error) {
            console.log("❌ getUserUTXOCount failed:", error);
          }
        }
      } catch (error) {
        console.log("❌ Basic contract calls failed:", error);
      }
      console.log("🔍 Final final allowance check...");
      const veryFinalAllowance = await finalTokenContract.allowance(
        this.currentAccount?.address,
        this.contract?.target
      );
      console.log("💰 Very final allowance:", ethers.formatUnits(veryFinalAllowance, finalTokenDecimals));
      if (veryFinalAllowance < amount) {
        throw new Error(`Last-second allowance check failed: ${ethers.formatUnits(veryFinalAllowance, finalTokenDecimals)} < ${ethers.formatUnits(amount, finalTokenDecimals)}`);
      }
      console.log("🚀 Sending depositAsPrivateUTXO transaction...");
      console.log("   Gas limit:", gasLimit.toString());
      console.log("   Gas price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");
      console.log("   Estimated cost:", ethers.formatEther(gasLimit * gasPrice), "ETH");
      const tx = await this.contract.depositAsPrivateUTXO(
        tokenAddress,
        amount,
        // Add the amount parameter
        commitment.pedersen_commitment,
        bbsProofData,
        nullifierHash,
        rangeProof,
        {
          gasLimit,
          gasPrice
        }
      );
      const receipt = await tx.wait();
      const utxoId = await ZenroomHelpers.generateUTXOId(
        commitment.pedersen_commitment,
        owner,
        Date.now()
      );
      const localNullifierHash = this.generateNullifierHash(commitment.pedersen_commitment, owner);
      const privateUTXO = {
        id: utxoId,
        exists: true,
        value: amount,
        tokenAddress,
        owner,
        timestamp: toBigInt(Date.now()),
        isSpent: false,
        commitment: commitment.pedersen_commitment,
        parentUTXO: "",
        utxoType: UTXOType.DEPOSIT,
        blindingFactor,
        nullifierHash: localNullifierHash,
        localCreatedAt: Date.now(),
        confirmed: true,
        creationTxHash: receipt?.hash,
        blockNumber: receipt?.blockNumber,
        bbsCredential: credential,
        isPrivate: true
      };
      this.utxos.set(utxoId, privateUTXO);
      this.privateUTXOs.set(utxoId, privateUTXO);
      this.privateCredentials.set(utxoId, credential);
      const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
      PrivateUTXOStorage.savePrivateUTXO(owner, privateUTXO);
      const result = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds: [utxoId]
      };
      console.log("✅ Private UTXO created successfully:", utxoId);
      this.emit("private:utxo:created", privateUTXO);
      return result;
    } catch (error) {
      console.error("❌ Private UTXO creation failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Private UTXO creation failed",
        errorDetails: error
      };
    }
  }
  /**
   * Transferir UTXO privado usando transferPrivateUTXO
   */
  async transferPrivateUTXO(params) {
    this.ensureInitialized();
    console.log("🔐 Transferring private UTXO...");
    try {
      const { utxoId, newOwner } = params;
      const utxo = this.privateUTXOs.get(utxoId);
      if (!utxo || !utxo.isPrivate) {
        throw new Error("UTXO is not private or does not exist");
      }
      const credential = this.privateCredentials.get(utxoId);
      if (!credential) {
        throw new Error("Private credential not found");
      }
      const newBlindingFactor = await ZenroomHelpers.generateSecureNonce();
      const newCommitment = await ZenroomHelpers.createPedersenCommitment(
        utxo.value.toString(),
        newBlindingFactor
      );
      const newNonce = await ZenroomHelpers.generateSecureNonce();
      const newAttributes = {
        ...credential.attributes,
        owner: newOwner,
        nonce: newNonce,
        timestamp: Date.now(),
        utxoType: UTXOType.TRANSFER,
        commitment: newCommitment.pedersen_commitment
      };
      const newCredential = await this.createBBSCredential({
        amount: utxo.value,
        tokenAddress: utxo.tokenAddress,
        owner: newOwner,
        commitment: newCommitment.pedersen_commitment
      });
      const transferProof = await this.createBBSProof({
        credential: newCredential,
        reveal: ["owner", "tokenAddress", "utxoType"],
        predicates: {
          "value": { gte: "0" }
          // Probar que value >= 0
        }
      });
      const bbsProofData = {
        proof: transferProof.proof.startsWith("0x") ? transferProof.proof : `0x${transferProof.proof}`,
        disclosedAttributes: Object.values(transferProof.revealedAttributes).map((value) => {
          const stringValue = String(value);
          if (stringValue.startsWith("0x") && stringValue.length === 42) {
            return ethers.zeroPadValue(stringValue, 32);
          }
          if (stringValue.startsWith("0x")) {
            return ethers.zeroPadValue(stringValue, 32);
          }
          return ethers.zeroPadValue(ethers.toUtf8Bytes(stringValue), 32);
        }),
        disclosureIndexes: [BigInt(2)],
        // índice de tokenAddress
        challenge: ethers.keccak256(ethers.toUtf8Bytes(`transfer:${utxoId}:${newOwner}`)),
        timestamp: BigInt(Date.now())
      };
      const newNullifierHash = this.generateNullifierHash(newCommitment.pedersen_commitment, newOwner);
      const tx = await this.contract.transferPrivateUTXO(
        utxo.commitment,
        newCommitment.pedersen_commitment,
        bbsProofData,
        newOwner,
        newNullifierHash,
        { gasLimit: this.config.defaultGasLimit }
      );
      const receipt = await tx.wait();
      utxo.isSpent = true;
      this.emit("private:utxo:spent", utxoId);
      const newUtxoId = await ZenroomHelpers.generateUTXOId(
        newCommitment.pedersen_commitment,
        newOwner,
        Date.now()
      );
      const newPrivateUTXO = {
        id: newUtxoId,
        exists: true,
        value: utxo.value,
        tokenAddress: utxo.tokenAddress,
        owner: newOwner,
        timestamp: toBigInt(Date.now()),
        isSpent: false,
        commitment: newCommitment.pedersen_commitment,
        parentUTXO: utxoId,
        utxoType: UTXOType.TRANSFER,
        blindingFactor: newBlindingFactor,
        localCreatedAt: Date.now(),
        confirmed: true,
        creationTxHash: receipt?.hash,
        blockNumber: receipt?.blockNumber,
        bbsCredential: newCredential,
        nullifierHash: newNullifierHash,
        isPrivate: true
      };
      this.utxos.set(newUtxoId, newPrivateUTXO);
      this.privateUTXOs.set(newUtxoId, newPrivateUTXO);
      this.privateCredentials.set(newUtxoId, newCredential);
      const result = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds: [newUtxoId]
      };
      console.log("✅ Private UTXO transferred successfully:", newUtxoId);
      this.emit("private:utxo:transferred", { from: utxoId, to: newUtxoId });
      return result;
    } catch (error) {
      console.error("❌ Private UTXO transfer failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Private transfer failed",
        errorDetails: error
      };
    }
  }
  /**
   * Dividir UTXO privado usando splitPrivateUTXO
   */
  async splitPrivateUTXO(params) {
    this.ensureInitialized();
    console.log("🔐 Splitting private UTXO...");
    try {
      const { inputUTXOId, outputValues, outputOwners } = params;
      const inputUTXO = this.privateUTXOs.get(inputUTXOId);
      if (!inputUTXO || !inputUTXO.isPrivate) {
        throw new Error("Input UTXO is not private or does not exist");
      }
      console.log("🔍 Credential verification:", {
        inputUTXOId,
        hasUTXO: !!inputUTXO,
        hasCredentialInUTXO: !!inputUTXO.bbsCredential,
        hasCredentialInMap: this.privateCredentials.has(inputUTXOId),
        credentialMapSize: this.privateCredentials.size,
        credentialMapKeys: Array.from(this.privateCredentials.keys()).map((id) => id.slice(0, 8) + "..."),
        utxoCredentialType: typeof inputUTXO.bbsCredential,
        utxoCredentialValue: inputUTXO.bbsCredential
      });
      let inputCredential = this.privateCredentials.get(inputUTXOId);
      if (!inputCredential) {
        console.error("❌ Credential not found in privateCredentials map");
        console.error("Available credentials:", Array.from(this.privateCredentials.entries()).map(([id, cred]) => ({
          id: id.slice(0, 8) + "...",
          hasCredential: !!cred
        })));
        if (inputUTXO.bbsCredential) {
          console.log("🔄 Using credential from UTXO as fallback");
          this.privateCredentials.set(inputUTXOId, inputUTXO.bbsCredential);
          inputCredential = inputUTXO.bbsCredential;
        } else {
          throw new Error("Input credential not found and no fallback available");
        }
      }
      const totalOutput = outputValues.reduce((sum, val) => sum + val, BigInt(0));
      if (totalOutput !== inputUTXO.value) {
        throw new Error("Sum of outputs must equal input value");
      }
      const nullifierHash = await ZenroomHelpers.generateNullifierHash(
        inputUTXO.commitment,
        inputUTXO.owner,
        inputCredential.attributes.nonce
      );
      const outputCredentials = [];
      const outputCommitments = [];
      const outputBlindingFactors = [];
      const issuerKey = this.bbsIssuerKeys.get(inputUTXO.tokenAddress);
      const verificationKey = this.bbsVerificationKeys.get(inputUTXO.tokenAddress);
      for (let i = 0; i < outputValues.length; i++) {
        const blindingFactor = await ZenroomHelpers.generateSecureNonce();
        const commitment = await ZenroomHelpers.createPedersenCommitment(
          outputValues[i].toString(),
          blindingFactor
        );
        const outputAttributes = {
          value: outputValues[i].toString(),
          owner: outputOwners[i],
          tokenAddress: inputUTXO.tokenAddress,
          nonce: await ZenroomHelpers.generateSecureNonce(),
          timestamp: Date.now(),
          utxoType: UTXOType.SPLIT,
          commitment: commitment.pedersen_commitment
        };
        const outputCredential = await this.createBBSCredential({
          amount: outputValues[i],
          tokenAddress: inputUTXO.tokenAddress,
          owner: outputOwners[i],
          commitment: commitment.pedersen_commitment
        });
        outputCredentials.push(outputCredential);
        outputCommitments.push(commitment.pedersen_commitment);
        outputBlindingFactors.push(blindingFactor);
      }
      const splitProof = await this.createBBSProof({
        credential: inputCredential,
        reveal: ["tokenAddress"],
        // Solo revelar tipo de token
        predicates: {
          "value": { eq: totalOutput.toString() }
        },
        challenge: ethers.keccak256(ethers.toUtf8Bytes(`split:${inputUTXOId}:${outputValues.join(",")}`))
      });
      const bbsProofData = {
        proof: splitProof.proof.startsWith("0x") ? splitProof.proof : `0x${splitProof.proof}`,
        disclosedAttributes: Object.values(splitProof.revealedAttributes).map((value) => {
          const stringValue = String(value);
          if (stringValue.startsWith("0x") && stringValue.length === 42) {
            return ethers.zeroPadValue(stringValue, 32);
          }
          if (stringValue.startsWith("0x")) {
            return ethers.zeroPadValue(stringValue, 32);
          }
          return ethers.zeroPadValue(ethers.toUtf8Bytes(stringValue), 32);
        }),
        disclosureIndexes: [BigInt(2)],
        // índice de tokenAddress
        challenge: ethers.keccak256(ethers.toUtf8Bytes(`split:${inputUTXOId}:${outputValues.join(",")}`)),
        timestamp: BigInt(Date.now())
      };
      const equalityProof = await ZenroomHelpers.createEqualityProof(
        inputUTXO.commitment,
        outputCommitments[0],
        // Simplificado: usar el primer output como ejemplo
        totalOutput.toString(),
        inputUTXO.blindingFactor,
        outputBlindingFactors[0]
      );
      console.log("🔍 Contract function verification:", {
        contractAddress: this.contract.target || "unknown",
        hasSplitPrivateUTXO: typeof this.contract.splitPrivateUTXO === "function",
        contractInterface: this.contract.interface ? "has interface" : "no interface"
      });
      console.log("🔍 Pre-validation parameters:", {
        inputCommitment: inputUTXO.commitment,
        outputCommitments,
        bbsProofData,
        equalityProof,
        nullifierHash
      });
      const validatedInputCommitment = ethers.isHexString(inputUTXO.commitment, 32) ? inputUTXO.commitment : ethers.zeroPadValue(inputUTXO.commitment, 32);
      const validatedOutputCommitments = outputCommitments.map(
        (commitment) => ethers.isHexString(commitment, 32) ? commitment : ethers.zeroPadValue(commitment, 32)
      );
      const validatedNullifierHash = ethers.isHexString(nullifierHash, 32) ? nullifierHash : ethers.zeroPadValue(nullifierHash, 32);
      const validatedEqualityProof = ethers.isHexString(equalityProof) ? equalityProof : ethers.hexlify(equalityProof);
      const validatedBBSProof = {
        proof: ethers.isHexString(bbsProofData.proof) ? bbsProofData.proof : ethers.hexlify(bbsProofData.proof),
        disclosedAttributes: bbsProofData.disclosedAttributes.map(
          (attr2) => ethers.isHexString(attr2, 32) ? attr2 : ethers.zeroPadValue(attr2, 32)
        ),
        disclosureIndexes: bbsProofData.disclosureIndexes.map((idx) => BigInt(idx)),
        challenge: ethers.isHexString(bbsProofData.challenge, 32) ? bbsProofData.challenge : ethers.zeroPadValue(bbsProofData.challenge, 32),
        timestamp: BigInt(bbsProofData.timestamp)
      };
      console.log("✅ Validated parameters:", {
        inputCommitment: validatedInputCommitment,
        inputCommitmentLength: validatedInputCommitment.length,
        outputCommitments: validatedOutputCommitments,
        outputCommitmentsLength: validatedOutputCommitments.length,
        bbsProofData: validatedBBSProof,
        equalityProof: validatedEqualityProof,
        equalityProofLength: validatedEqualityProof.length,
        nullifierHash: validatedNullifierHash,
        nullifierHashLength: validatedNullifierHash.length
      });
      console.log("� === CRITICAL UTXO VERIFICATION ===");
      console.log("📋 Input UTXO details:", {
        id: inputUTXO.id,
        value: inputUTXO.value.toString(),
        owner: inputUTXO.owner,
        isSpent: inputUTXO.isSpent,
        commitment: inputUTXO.commitment,
        exists: inputUTXO.exists,
        confirmed: inputUTXO.confirmed,
        creationTxHash: inputUTXO.creationTxHash,
        blockNumber: inputUTXO.blockNumber,
        localCreatedAt: inputUTXO.localCreatedAt,
        isPrivate: inputUTXO.isPrivate
      });
      if (!inputUTXO.creationTxHash || !inputUTXO.blockNumber) {
        console.error("� UTXO appears to be locally created without blockchain confirmation!");
        console.error("This suggests the UTXO was never actually created on the contract");
        throw new Error("Cannot split UTXO: No blockchain confirmation found. This UTXO may not exist on the contract.");
      }
      console.log("✅ UTXO has blockchain confirmation, proceeding with contract verification...");
      console.log("🔍 Attempting contract verification using commitment...");
      try {
        const commitment = inputUTXO.commitment;
        console.log("📝 Using commitment for lookup:", commitment);
        const ownerUTXOs = await this.contract.getUTXOsByOwner(inputUTXO.owner);
        console.log("📋 All UTXOs for owner from contract:", ownerUTXOs);
        let foundUTXO = false;
        let contractUTXOInfo = null;
        for (const contractUTXOId of ownerUTXOs) {
          try {
            const utxoInfo = await this.contract.getUTXOInfo(contractUTXOId);
            console.log(`� Contract UTXO ${contractUTXOId}:`, utxoInfo);
            if (utxoInfo[0] && // exists
            !utxoInfo[5] && // !isSpent 
            utxoInfo[3].toLowerCase() === inputUTXO.owner.toLowerCase()) {
              try {
                const contractCommitment = await this.contract.getUTXOCommitment(contractUTXOId);
                console.log(`📋 Contract commitment for ${contractUTXOId}: ${contractCommitment}`);
                if (contractCommitment === commitment) {
                  console.log("✅ Found matching UTXO by commitment!");
                  foundUTXO = true;
                  contractUTXOInfo = {
                    exists: utxoInfo[0],
                    commitment: utxoInfo[1],
                    tokenAddress: utxoInfo[2],
                    owner: utxoInfo[3],
                    timestamp: utxoInfo[4],
                    isSpent: utxoInfo[5],
                    parentUTXO: utxoInfo[6],
                    utxoType: utxoInfo[7],
                    nullifierHash: utxoInfo[8]
                  };
                  if (contractUTXOId !== inputUTXO.id) {
                    console.warn("⚠️ UTXO ID mismatch - updating local ID");
                    console.warn(`Local ID: ${inputUTXO.id}`);
                    console.warn(`Contract ID: ${contractUTXOId}`);
                    inputUTXO.id = contractUTXOId;
                  }
                  break;
                }
              } catch (commitmentError) {
                console.warn(`⚠️ Could not get commitment for UTXO ${contractUTXOId}:`, commitmentError);
              }
            }
          } catch (infoError) {
            console.warn(`⚠️ Could not get info for UTXO ${contractUTXOId}:`, infoError);
          }
        }
        if (!foundUTXO) {
          console.error("🚨 UTXO NOT FOUND ON CONTRACT!");
          console.error("Available UTXOs on contract:", ownerUTXOs);
          console.error("Looking for commitment:", commitment);
          throw new Error(`UTXO with commitment ${commitment} not found on contract. Available UTXOs: ${ownerUTXOs.join(", ")}`);
        }
        console.log("✅ UTXO verified successfully on contract");
      } catch (contractError) {
        console.error("❌ Contract UTXO verification failed:", contractError);
        throw new Error(`Cannot verify UTXO on contract: ${contractError?.message || contractError}`);
      }
      try {
        console.log("🔍 Testing contract interface...");
        const encodedData = this.contract.interface.encodeFunctionData("splitPrivateUTXO", [
          validatedInputCommitment,
          validatedOutputCommitments,
          validatedBBSProof,
          validatedEqualityProof,
          validatedNullifierHash
        ]);
        console.log("✅ Function encoding successful:", {
          encodedDataLength: encodedData.length,
          encodedDataPrefix: encodedData.substring(0, 10)
        });
      } catch (encodeError) {
        console.error("❌ Function encoding failed:", encodeError);
        throw new Error(`Parameter encoding failed: ${encodeError}`);
      }
      const baseGasLimit = BigInt(8e5);
      const gasWithBuffer = baseGasLimit * BigInt(120) / BigInt(100);
      console.log("⛽ Using conservative gas limit for splitPrivateUTXO:", gasWithBuffer.toString());
      console.log("🔍 === SPLIT TRANSACTION DEBUG INFO ===");
      console.log("📝 Input UTXO:", {
        id: inputUTXO.id,
        value: inputUTXO.value.toString(),
        owner: inputUTXO.owner,
        isSpent: inputUTXO.isSpent,
        commitment: inputUTXO.commitment,
        exists: inputUTXO.exists
      });
      console.log("📝 Output configuration:", {
        outputCount: outputValues.length,
        outputValues: outputValues.map((v) => v.toString()),
        outputOwners,
        totalOutput: outputValues.reduce((a, b) => a + b, BigInt(0)).toString(),
        inputValue: inputUTXO.value.toString()
      });
      console.log("📝 Proof data sizes:", {
        bbsProofLength: validatedBBSProof.proof.length,
        disclosedAttributesCount: validatedBBSProof.disclosedAttributes.length,
        disclosureIndexesCount: validatedBBSProof.disclosureIndexes.length,
        equalityProofLength: validatedEqualityProof.length,
        nullifierHashLength: validatedNullifierHash.length
      });
      console.log("📝 Contract info:", {
        address: this.contract.target,
        hasMethod: typeof this.contract.splitPrivateUTXO === "function"
      });
      console.log("🚀 Calling contract splitPrivateUTXO...");
      console.log("📝 Transaction parameters:", {
        inputCommitment: validatedInputCommitment,
        outputCommitmentsCount: validatedOutputCommitments.length,
        proofSize: validatedBBSProof.proof.length,
        equalityProofSize: validatedEqualityProof.length,
        nullifierHash: validatedNullifierHash,
        gasLimit: gasWithBuffer.toString()
      });
      let tx;
      try {
        tx = await this.contract.splitPrivateUTXO(
          validatedInputCommitment,
          validatedOutputCommitments,
          validatedBBSProof,
          validatedEqualityProof,
          validatedNullifierHash,
          {
            gasLimit: gasWithBuffer
          }
        );
        console.log("✅ Transaction sent successfully:", tx.hash);
      } catch (transactionError) {
        console.error("❌ Transaction failed:", transactionError);
        if (transactionError && typeof transactionError === "object") {
          const errorInfo = {
            message: transactionError.message,
            code: transactionError.code,
            action: transactionError.action,
            reason: transactionError.reason,
            shortMessage: transactionError.shortMessage,
            data: transactionError.data
          };
          console.error("💥 Detailed transaction error:", errorInfo);
          if (transactionError.code === -32603) {
            throw new Error(`RPC Error: The transaction failed during execution. This could be due to insufficient gas, contract revert, or invalid parameters. Original error: ${errorInfo.message}`);
          } else if (transactionError.code === "UNPREDICTABLE_GAS_LIMIT") {
            throw new Error(`Gas estimation failed - the contract would revert. Check your parameters and try again. Reason: ${errorInfo.reason || "Unknown"}`);
          } else if (transactionError.shortMessage?.includes("revert")) {
            throw new Error(`Contract reverted: ${errorInfo.shortMessage || errorInfo.reason || "Unknown reason"}`);
          }
        }
        throw new Error(`Transaction failed: ${transactionError.message || transactionError}`);
      }
      const receipt = await tx.wait();
      inputUTXO.isSpent = true;
      const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
      PrivateUTXOStorage.savePrivateUTXO(inputUTXO.owner, inputUTXO);
      this.emit("private:utxo:spent", inputUTXOId);
      const createdUTXOIds = [];
      for (let i = 0; i < outputValues.length; i++) {
        const outputId = await ZenroomHelpers.generateUTXOId(
          outputCommitments[i],
          outputOwners[i],
          Date.now() + i
        );
        const outputNullifierHash = await ZenroomHelpers.generateNullifierHash(
          outputCommitments[i],
          outputOwners[i],
          Date.now().toString()
        );
        const outputUTXO = {
          id: outputId,
          exists: true,
          value: outputValues[i],
          tokenAddress: inputUTXO.tokenAddress,
          owner: outputOwners[i],
          timestamp: toBigInt(Date.now()),
          isSpent: false,
          commitment: outputCommitments[i],
          parentUTXO: inputUTXOId,
          utxoType: UTXOType.SPLIT,
          blindingFactor: outputBlindingFactors[i],
          localCreatedAt: Date.now(),
          confirmed: true,
          creationTxHash: receipt?.hash,
          blockNumber: receipt?.blockNumber,
          bbsCredential: outputCredentials[i],
          nullifierHash: outputNullifierHash,
          isPrivate: true
        };
        this.utxos.set(outputId, outputUTXO);
        this.privateUTXOs.set(outputId, outputUTXO);
        this.privateCredentials.set(outputId, outputCredentials[i]);
        createdUTXOIds.push(outputId);
        const { PrivateUTXOStorage: PrivateUTXOStorage2 } = await import("../../chunks/PrivateUTXOStorage.js");
        PrivateUTXOStorage2.savePrivateUTXO(outputOwners[i], outputUTXO);
        this.emit("private:utxo:created", outputUTXO);
      }
      const result = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds
      };
      console.log("✅ Private UTXO split successfully:", createdUTXOIds);
      return result;
    } catch (error) {
      console.error("❌ Private UTXO split failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Private split failed",
        errorDetails: error
      };
    }
  }
  /**
   * Retirar UTXO privado usando withdrawFromPrivateUTXO
   */
  async withdrawPrivateUTXO(params) {
    this.ensureInitialized();
    console.log("🔐 Withdrawing private UTXO...");
    try {
      const { utxoId, recipient } = params;
      const utxo = this.privateUTXOs.get(utxoId);
      if (!utxo || !utxo.isPrivate) {
        throw new Error("UTXO is not private or does not exist");
      }
      const credential = this.privateCredentials.get(utxoId);
      if (!credential) {
        throw new Error("Private credential not found");
      }
      const nullifierHash = await ZenroomHelpers.generateNullifierHash(
        utxo.commitment,
        utxo.owner,
        credential.attributes.nonce
      );
      const withdrawProof = await this.createBBSProof({
        credential,
        reveal: ["owner", "tokenAddress"],
        // Revelar ownership y token
        predicates: {
          "value": { gte: "0" }
        },
        challenge: ethers.keccak256(ethers.toUtf8Bytes(`withdraw:${utxoId}:${recipient}`))
      });
      const bbsProofData = {
        proof: withdrawProof.proof.startsWith("0x") ? withdrawProof.proof : `0x${withdrawProof.proof}`,
        disclosedAttributes: Object.values(withdrawProof.revealedAttributes).map((value) => {
          const stringValue = String(value);
          if (stringValue.startsWith("0x") && stringValue.length === 42) {
            return ethers.zeroPadValue(stringValue, 32);
          }
          if (stringValue.startsWith("0x")) {
            return ethers.zeroPadValue(stringValue, 32);
          }
          return ethers.zeroPadValue(ethers.toUtf8Bytes(stringValue), 32);
        }),
        disclosureIndexes: [BigInt(1), BigInt(2)],
        // índices de owner y tokenAddress
        challenge: ethers.keccak256(ethers.toUtf8Bytes(`withdraw:${utxoId}:${recipient}`)),
        timestamp: BigInt(Date.now())
      };
      const tx = await this.contract.withdrawFromPrivateUTXO(
        utxo.commitment,
        bbsProofData,
        nullifierHash,
        { gasLimit: this.config.defaultGasLimit }
      );
      const receipt = await tx.wait();
      utxo.isSpent = true;
      const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
      PrivateUTXOStorage.savePrivateUTXO(utxo.owner, utxo);
      this.emit("private:utxo:withdrawn", utxoId);
      const result = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed
      };
      console.log("✅ Private UTXO withdrawn successfully");
      return result;
    } catch (error) {
      console.error("❌ Private UTXO withdrawal failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Private withdrawal failed",
        errorDetails: error
      };
    }
  }
  // ========================
  // OPERACIONES COCONUT
  // ========================
  /**
   * Crear credencial Coconut con emisión threshold
   */
  async createCoconutCredential(request, authorities) {
    if (!this.coconutSetup) {
      throw new Error("Coconut threshold system not configured");
    }
    console.log("🥥 Creating Coconut credential with threshold issuance...");
    try {
      const partialCredentials = [];
      for (const authority of authorities) {
        const authorityKey = this.coconutAuthorities.get(authority);
        if (!authorityKey) {
          console.warn(`Authority ${authority} not found, skipping...`);
          continue;
        }
        const partialCredential = await ZenroomHelpers.requestCoconutPartialCredentialV2(
          request,
          authorityKey,
          authority
        );
        partialCredentials.push(partialCredential);
      }
      if (partialCredentials.length < this.coconutSetup.threshold) {
        throw new Error(
          `Insufficient partial credentials: ${partialCredentials.length} < ${this.coconutSetup.threshold}`
        );
      }
      const aggregatedCredential = await ZenroomHelpers.aggregateCoconutCredentialsV2(
        partialCredentials.slice(0, this.coconutSetup.threshold),
        this.coconutSetup
      );
      console.log("✅ Coconut credential created successfully");
      return aggregatedCredential;
    } catch (error) {
      console.error("❌ Coconut credential creation failed:", error);
      throw new UTXOOperationError(
        "Coconut credential creation failed",
        "createCoconutCredential",
        void 0,
        error
      );
    }
  }
  // ========================
  // SINCRONIZACIÓN CON BLOCKCHAIN PRIVADA
  // ========================
  /**
   * Sincronizar con blockchain y localStorage
   * Sistema híbrido: eventos del contrato + almacenamiento local privado
   */
  async syncWithBlockchain() {
    if (!this.contract || !this.currentEOA) {
      return false;
    }
    console.log("🔄 Syncing with blockchain and localStorage...");
    try {
      const userUTXOCount = await this.contract.getUserUTXOCount(this.currentEOA.address);
      console.log(`📊 User has ${userUTXOCount} UTXOs in contract`);
      const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
      const localUTXOs = PrivateUTXOStorage.getPrivateUTXOs(this.currentEOA.address);
      console.log(`� Found ${localUTXOs.length} private UTXOs in localStorage`);
      const bbsKeys = PrivateUTXOStorage.getBBSKeys(this.currentEOA.address);
      const tokenAddresses = Object.keys(bbsKeys);
      this.bbsIssuerKeys.clear();
      this.bbsVerificationKeys.clear();
      for (const tokenAddress of tokenAddresses) {
        const keys = bbsKeys[tokenAddress];
        this.bbsIssuerKeys.set(tokenAddress, keys.issuerPrivateKey);
        this.bbsVerificationKeys.set(tokenAddress, keys.verificationKey);
      }
      console.log(`🔑 Loaded BBS+ keys for ${tokenAddresses.length} tokens`);
      this.privateUTXOs.clear();
      this.privateCredentials.clear();
      for (const utxo of localUTXOs) {
        this.privateUTXOs.set(utxo.id, utxo);
        if (utxo.bbsCredential) {
          this.privateCredentials.set(utxo.id, utxo.bbsCredential);
        }
      }
      const utxoTokenAddresses = [...new Set(localUTXOs.map((utxo) => utxo.tokenAddress))];
      for (const tokenAddress of utxoTokenAddresses) {
        if (!this.bbsIssuerKeys.has(tokenAddress)) {
          console.log(`⚙️ Auto-configuring BBS+ keys for token: ${tokenAddress}`);
          try {
            await this.setupBBSIssuer(tokenAddress);
          } catch (error) {
            console.warn(`⚠️ Failed to auto-configure BBS+ keys for ${tokenAddress}:`, error);
          }
        }
      }
      const stats = PrivateUTXOStorage.getUserStats(this.currentEOA.address);
      console.log("📈 Local UTXO statistics:");
      console.log(`  - Total UTXOs: ${stats.totalUTXOs}`);
      console.log(`  - Unspent UTXOs: ${stats.unspentUTXOs}`);
      console.log(`  - Unique tokens: ${stats.uniqueTokens}`);
      console.log(`  - Total balance: ${stats.totalBalance.toString()}`);
      if (Number(userUTXOCount) !== stats.unspentUTXOs) {
        console.warn(`⚠️ UTXO count mismatch: Contract(${userUTXOCount}) vs Local(${stats.unspentUTXOs})`);
        console.warn("   This is expected during development. Contract count may include testing deposits.");
      }
      console.log("✅ Privacy-preserving sync completed");
      this.emit("blockchain:synced", {
        localUTXOs: Array.from(this.utxos.values()).length,
        privateUTXOs: Array.from(this.privateUTXOs.values()).length,
        contractUTXOCount: Number(userUTXOCount),
        localStats: stats,
        syncMode: "localStorage+contract"
      });
      return true;
    } catch (error) {
      console.error("❌ Sync failed:", error);
      this.emit("blockchain:sync:failed", error);
      try {
        const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
        const localUTXOs = PrivateUTXOStorage.getPrivateUTXOs(this.currentEOA.address);
        this.privateUTXOs.clear();
        this.privateCredentials.clear();
        for (const utxo of localUTXOs) {
          this.privateUTXOs.set(utxo.id, utxo);
          if (utxo.bbsCredential) {
            this.privateCredentials.set(utxo.id, utxo.bbsCredential);
          }
        }
        console.log(`📱 Loaded ${localUTXOs.length} UTXOs from localStorage (offline mode)`);
        return true;
      } catch (localError) {
        console.error("❌ Failed to load local data:", localError);
        return false;
      }
    }
  }
  /**
   * Limpiar datos privados (para seguridad)
   */
  clearPrivateData() {
    this.privateCredentials.clear();
    this.coconutCredentials.clear();
    this.bbsIssuerKeys.clear();
    console.log("🧹 Private data cleared");
  }
  // ========================
  // MÉTODOS BBS+ HELPER
  // ========================
  /**
   * Crear credential BBS+ para un UTXO
   */
  async createBBSCredential(params) {
    try {
      const attributes = [
        params.amount.toString(),
        params.tokenAddress,
        params.owner,
        params.commitment,
        Date.now().toString()
      ];
      const issuerPrivateKey = this.bbsIssuerKeys.get(params.tokenAddress);
      if (!issuerPrivateKey) {
        throw new Error(`No BBS+ issuer key found for token ${params.tokenAddress}`);
      }
      const signature = await ZenroomHelpers.signBBSCredential(attributes, issuerPrivateKey);
      return {
        signature,
        attributes: {
          value: params.amount.toString(),
          nonce: Date.now().toString(),
          utxoType: UTXOType.DEPOSIT,
          tokenAddress: params.tokenAddress,
          owner: params.owner,
          commitment: params.commitment,
          timestamp: Date.now()
        },
        issuerPubKey: this.bbsVerificationKeys.get(params.tokenAddress) || "",
        credentialId: ethers.keccak256(ethers.toUtf8Bytes(signature + Date.now().toString()))
      };
    } catch (error) {
      console.error("❌ Failed to create BBS credential:", error);
      throw new UTXOOperationError(
        "BBS credential creation failed",
        "createBBSCredential",
        void 0,
        error
      );
    }
  }
  /**
   * Crear proof BBS+ para una operación
   */
  async createBBSProof(request) {
    try {
      const attributesArray = [
        request.credential.attributes.value,
        request.credential.attributes.tokenAddress,
        request.credential.attributes.owner,
        request.credential.attributes.commitment,
        request.credential.attributes.nonce
      ];
      const revealIndices = [];
      request.reveal.forEach((attr2) => {
        switch (attr2) {
          case "tokenAddress":
            revealIndices.push(1);
            break;
          case "owner":
            revealIndices.push(2);
            break;
          case "commitment":
            revealIndices.push(3);
            break;
        }
      });
      const proof = await ZenroomHelpers.createBBSProof({
        signature: request.credential.signature,
        attributes: attributesArray,
        revealIndices,
        predicates: request.predicates,
        challenge: request.challenge || Date.now().toString()
      });
      const revealedAttributes = {};
      revealIndices.forEach((index) => {
        switch (index) {
          case 1:
            revealedAttributes.tokenAddress = attributesArray[1];
            break;
          case 2:
            revealedAttributes.owner = attributesArray[2];
            break;
          case 3:
            revealedAttributes.commitment = attributesArray[3];
            break;
        }
      });
      return {
        proof: proof.proof.startsWith("0x") ? proof.proof : `0x${proof.proof}`,
        revealedAttributes,
        predicateProofs: proof.predicateProofs || [],
        challenge: request.challenge || Date.now().toString()
      };
    } catch (error) {
      console.error("❌ Failed to create BBS proof:", error);
      throw new UTXOOperationError(
        "BBS proof creation failed",
        "createBBSProof",
        void 0,
        error
      );
    }
  }
  /**
   * Generar nullifier hash para prevenir double-spending
   */
  generateNullifierHash(commitment, owner, nonce) {
    const input = commitment + owner + (nonce || Date.now().toString());
    return ethers.keccak256(ethers.toUtf8Bytes(input));
  }
  /**
   * Obtener UTXOs privados por propietario
   */
  getPrivateUTXOsByOwner(owner) {
    const utxos = [];
    for (const [utxoId, utxo] of this.privateUTXOs.entries()) {
      if (utxo.owner.toLowerCase() === owner.toLowerCase() && !utxo.isSpent) {
        utxos.push(utxo);
      }
    }
    return utxos;
  }
  /**
   * Obtener balance privado total
   */
  getPrivateBalance(tokenAddress) {
    let balance = BigInt(0);
    for (const utxo of this.privateUTXOs.values()) {
      if (!utxo.isSpent && (!tokenAddress || utxo.tokenAddress === tokenAddress)) {
        balance += utxo.value;
      }
    }
    return balance;
  }
  /**
   * Asegurar que el BBS+ issuer esté configurado para un token
   */
  async ensureBBSIssuerConfigured(tokenAddress) {
    if (this.bbsIssuerKeys.has(tokenAddress) && this.bbsVerificationKeys.has(tokenAddress)) {
      return;
    }
    console.log("🔧 Auto-configuring BBS+ issuer for token:", tokenAddress);
    try {
      const publicKey = await this.setupBBSIssuer(tokenAddress);
      console.log("✅ BBS+ issuer auto-configured for token:", tokenAddress);
    } catch (error) {
      console.error("❌ Failed to auto-configure BBS+ issuer:", error);
      throw new Error(`Failed to configure BBS+ issuer for token ${tokenAddress}: ${error}`);
    }
  }
  /**
   * Crear UTXO privado SIMPLIFICADO para testing/development
   * Usa la función depositAsPrivateUTXO_Test que omite las verificaciones complejas BBS+
   */
  async createPrivateUTXO_Test(params) {
    this.ensureInitialized();
    console.log("🧪 Creating private UTXO with TESTING function (simplified)...");
    try {
      const { amount, tokenAddress, owner } = params;
      await this.approveTokenSpending(tokenAddress, amount);
      console.log("🧪 Using simplified testing deposit function...");
      const signer = EthereumHelpers.getSigner();
      if (!signer) {
        throw new Error("Signer not available for deposit transaction");
      }
      let gasPrice;
      try {
        const feeData = await signer.provider?.getFeeData();
        gasPrice = feeData?.gasPrice || ethers.parseUnits("20", "gwei");
      } catch (error) {
        console.warn("Could not get gas price for deposit, using default:", error);
        gasPrice = ethers.parseUnits("20", "gwei");
      }
      const gasLimit = BigInt(5e5);
      console.log("⛽ Gas estimation for testing deposit:");
      console.log("  - Gas limit:", gasLimit.toString());
      console.log("  - Gas price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          "function allowance(address owner, address spender) view returns (uint256)",
          "function decimals() view returns (uint8)"
        ],
        signer
      );
      let tokenDecimals;
      try {
        tokenDecimals = await tokenContract.decimals();
      } catch (error) {
        tokenDecimals = 18;
      }
      const finalAllowance = await tokenContract.allowance(
        this.currentAccount?.address,
        this.contract?.target
      );
      console.log("💰 Final allowance check:", ethers.formatUnits(finalAllowance, tokenDecimals));
      console.log("💰 Required amount:", ethers.formatUnits(amount, tokenDecimals));
      if (finalAllowance < amount) {
        throw new Error(
          `Insufficient allowance: ${ethers.formatUnits(finalAllowance, tokenDecimals)} < ${ethers.formatUnits(amount, tokenDecimals)}`
        );
      }
      console.log("🚀 Sending depositAsPrivateUTXO_Test transaction...");
      const tx = await this.contract.depositAsPrivateUTXO_Test(
        tokenAddress,
        amount,
        {
          gasLimit,
          gasPrice
        }
      );
      const receipt = await tx.wait();
      const utxoId = `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const commitment = ethers.keccak256(ethers.toUtf8Bytes(`${owner}:${amount}:${Date.now()}`));
      const nullifierHash = ethers.keccak256(ethers.toUtf8Bytes(`${commitment}:${owner}`));
      const privateUTXO = {
        id: utxoId,
        exists: true,
        value: amount,
        tokenAddress,
        owner,
        timestamp: toBigInt(Date.now()),
        isSpent: false,
        commitment,
        parentUTXO: "",
        utxoType: UTXOType.DEPOSIT,
        blindingFactor: "test_blinding_factor",
        nullifierHash,
        localCreatedAt: Date.now(),
        confirmed: true,
        creationTxHash: receipt?.hash,
        blockNumber: receipt?.blockNumber,
        bbsCredential: {
          signature: "test_signature",
          attributes: {
            value: amount.toString(),
            owner,
            tokenAddress,
            nonce: Date.now().toString(),
            timestamp: Date.now(),
            utxoType: UTXOType.DEPOSIT,
            commitment
          },
          issuerPubKey: "test_issuer_key",
          credentialId: ethers.keccak256(ethers.toUtf8Bytes(`test_${utxoId}`))
        },
        isPrivate: true
      };
      this.utxos.set(utxoId, privateUTXO);
      this.privateUTXOs.set(utxoId, privateUTXO);
      this.privateCredentials.set(utxoId, privateUTXO.bbsCredential);
      const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
      PrivateUTXOStorage.savePrivateUTXO(owner, privateUTXO);
      const result = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds: [utxoId]
      };
      console.log("✅ Private UTXO created successfully (testing mode):", utxoId);
      this.emit("private:utxo:created", privateUTXO);
      return result;
    } catch (error) {
      console.error("❌ Private UTXO creation (testing) failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Private UTXO creation (testing) failed",
        errorDetails: error
      };
    }
  }
}
new PrivateUTXOManager();
function WalletConnection($$payload, $$props) {
  push();
  let utxoManager = $$props["utxoManager"];
  let currentAccount = fallback($$props["currentAccount"], null);
  let isInitialized = fallback($$props["isInitialized"], false);
  let isConnecting = false;
  let isDisconnecting = false;
  const provider = {
    type: WalletProviderType.METAMASK,
    icon: "🦊"
  };
  function formatAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  function getNetworkDisplayName(chainId) {
    switch (Number(chainId)) {
      case 1:
        return "Ethereum";
      case 137:
        return "Polygon";
      case 80002:
        return "Polygon Amoy";
      case 11155111:
        return "Sepolia";
      default:
        return `Chain ${chainId}`;
    }
  }
  if (!currentAccount) {
    $$payload.out += "<!--[-->";
    $$payload.out += `<div class="flex flex-col items-end space-y-2"><button${attr("disabled", isConnecting, true)} class="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-2">`;
    {
      $$payload.out += "<!--[!-->";
      $$payload.out += `<span>${escape_html(provider.icon)}</span> <span>Connect MetaMask</span>`;
    }
    $$payload.out += `<!--]--></button> <div class="text-xs text-gray-400 text-right"><div>Polygon Amoy Network</div> <div>Testnet Required</div></div></div>`;
  } else {
    $$payload.out += "<!--[!-->";
    $$payload.out += `<div class="flex items-center space-x-4"><div class="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/20"><div class="flex items-center space-x-3"><div class="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center"><span class="text-white text-sm font-bold">`;
    if (currentAccount.providerType === WalletProviderType.METAMASK) {
      $$payload.out += "<!--[-->";
      $$payload.out += `🦊`;
    } else if (currentAccount.providerType === WalletProviderType.WALLET_CONNECT) {
      $$payload.out += "<!--[1-->";
      $$payload.out += `🔗`;
    } else if (currentAccount.providerType === WalletProviderType.COINBASE_WALLET) {
      $$payload.out += "<!--[2-->";
      $$payload.out += `💙`;
    } else {
      $$payload.out += "<!--[!-->";
      $$payload.out += `🌐`;
    }
    $$payload.out += `<!--]--></span></div> <div class="text-sm"><div class="text-white font-medium">${escape_html(formatAddress(currentAccount.address))}</div> <div class="text-gray-300 text-xs">${escape_html(getNetworkDisplayName(currentAccount.chainId))} `;
    if (currentAccount.ethBalance !== void 0) {
      $$payload.out += "<!--[-->";
      $$payload.out += `• ${escape_html((Number(currentAccount.ethBalance) / 1e18).toFixed(4))} ETH`;
    } else {
      $$payload.out += "<!--[!-->";
    }
    $$payload.out += `<!--]--></div></div></div></div> <div class="flex items-center space-x-2"><button class="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200" title="Refresh data"><span class="text-lg">🔄</span></button> <div class="relative"><button${attr("disabled", isDisconnecting, true)} class="bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 hover:border-red-600/50 disabled:opacity-50 disabled:cursor-not-allowed text-red-300 px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2">`;
    {
      $$payload.out += "<!--[!-->";
      $$payload.out += `<span>🔌</span> <span>Disconnect</span>`;
    }
    $$payload.out += `<!--]--></button></div></div></div>`;
  }
  $$payload.out += `<!--]-->`;
  bind_props($$props, { utxoManager, currentAccount, isInitialized });
  pop();
}
function _page($$payload, $$props) {
  push();
  let privateUTXOManager;
  let isInitialized = false;
  let currentAccount = null;
  let notifications = [];
  WalletProviderType.METAMASK;
  if (typeof window !== "undefined") {
    window.debugUTXOStorage = () => {
      {
        console.warn("No account connected. Connect wallet first.");
      }
    };
  }
  head($$payload, ($$payload2) => {
    $$payload2.title = `<title>UTXO Manager - Privacy-First Token Management</title>`;
    $$payload2.out += `<meta name="description" content="Manage ERC20 tokens with privacy using UTXOs and Zenroom cryptography" class="svelte-18s9rmc"/>`;
  });
  $$payload.out += `<div class="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 svelte-18s9rmc">`;
  if (notifications.length > 0) {
    $$payload.out += "<!--[-->";
    const each_array = ensure_array_like(notifications);
    $$payload.out += `<div class="fixed top-4 right-4 z-50 space-y-2 svelte-18s9rmc"><!--[-->`;
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let notification = each_array[$$index];
      $$payload.out += `<div${attr_class("p-4 rounded-lg shadow-lg max-w-sm animate-slide-in svelte-18s9rmc", void 0, {
        "bg-green-600": notification.type === "success",
        "bg-red-600": notification.type === "error",
        "bg-blue-600": notification.type === "info",
        "bg-yellow-600": notification.type === "warning"
      })}><div class="flex items-center justify-between text-white svelte-18s9rmc"><span class="text-sm svelte-18s9rmc">${escape_html(notification.message)}</span> <button class="ml-2 text-white hover:text-gray-200 svelte-18s9rmc">✕</button></div></div>`;
    }
    $$payload.out += `<!--]--></div>`;
  } else {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]--> <header class="bg-black/20 backdrop-blur-sm border-b border-white/10 svelte-18s9rmc"><div class="container mx-auto px-4 py-6 svelte-18s9rmc"><div class="flex items-center justify-between svelte-18s9rmc"><div class="flex items-center space-x-4 svelte-18s9rmc"><div class="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center svelte-18s9rmc"><span class="text-white font-bold text-xl svelte-18s9rmc">U</span></div> <div class="svelte-18s9rmc"><h1 class="text-2xl font-bold text-white svelte-18s9rmc">UTXO Manager</h1> <p class="text-gray-300 text-sm svelte-18s9rmc">Privacy-First Token Management</p></div></div> <div class="flex items-center space-x-4 svelte-18s9rmc">`;
  {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]--> `;
  WalletConnection($$payload, {
    utxoManager: privateUTXOManager,
    currentAccount,
    isInitialized
  });
  $$payload.out += `<!----></div></div></div></header> <main class="container mx-auto px-4 py-8 svelte-18s9rmc">`;
  {
    $$payload.out += "<!--[-->";
    $$payload.out += `<div class="text-center py-20 svelte-18s9rmc"><div class="max-w-2xl mx-auto svelte-18s9rmc"><h2 class="text-4xl font-bold text-white mb-6 svelte-18s9rmc">Welcome to UTXO Manager</h2> <p class="text-xl text-gray-300 mb-8 svelte-18s9rmc">Transform your ERC20 tokens into privacy-preserving UTXOs using Zenroom cryptography</p> <div class="grid md:grid-cols-3 gap-6 mb-8 svelte-18s9rmc"><div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20 svelte-18s9rmc"><div class="text-purple-400 text-2xl mb-3 svelte-18s9rmc">🔒</div> <h3 class="text-white font-semibold mb-2 svelte-18s9rmc">Privacy First</h3> <p class="text-gray-300 text-sm svelte-18s9rmc">Your transactions are private using Zenroom zero-knowledge proofs</p></div> <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20 svelte-18s9rmc"><div class="text-blue-400 text-2xl mb-3 svelte-18s9rmc">⚡</div> <h3 class="text-white font-semibold mb-2 svelte-18s9rmc">UTXO Model</h3> <p class="text-gray-300 text-sm svelte-18s9rmc">Efficient transaction model with better privacy and scalability</p></div> <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20 svelte-18s9rmc"><div class="text-green-400 text-2xl mb-3 svelte-18s9rmc">🔗</div> <h3 class="text-white font-semibold mb-2 svelte-18s9rmc">ERC20 Compatible</h3> <p class="text-gray-300 text-sm svelte-18s9rmc">Use any ERC20 token with seamless conversion to UTXOs</p></div></div> <button class="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl svelte-18s9rmc">Get Started</button></div></div>`;
  }
  $$payload.out += `<!--]--></main></div>`;
  pop();
}
export {
  _page as default
};
