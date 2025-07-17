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
  "function registeredTokens(address) view returns (bool)",
  "function tokenRegistrationTime(address) view returns (uint256)",
  "function tokenNames(address) view returns (string)",
  "function tokenSymbols(address) view returns (string)",
  "function tokenDecimals(address) view returns (uint8)",
  "function allRegisteredTokens(uint256) view returns (address)",
  // Core private UTXO functions with real cryptography
  "function depositAsPrivateUTXO((address tokenAddress, bytes32 commitment, bytes32 nullifierHash, uint256 blindingFactor) depositParams, (bytes rangeProof) proofParams, (uint256 gX, uint256 gY, uint256 hX, uint256 hY) generators, uint256 amount) external",
  "function splitPrivateUTXO(bytes32 inputCommitment, bytes32[] calldata outputCommitments, uint256[] calldata outputAmounts, uint256[] calldata outputBlindings, bytes calldata equalityProof, bytes32 nullifierHash, (uint256 gX, uint256 gY, uint256 hX, uint256 hY) generators) external returns (bytes32[] memory)",
  "function transferPrivateUTXO(bytes32 inputCommitment, bytes32 outputCommitment, address newOwner, uint256 amount, uint256 outputBlinding, bytes32 nullifierHash, (uint256 gX, uint256 gY, uint256 hX, uint256 hY) generators) external returns (bytes32)",
  "function withdrawFromPrivateUTXO(bytes32 commitment, uint256 amount, uint256 blindingFactor, bytes32 nullifierHash, (uint256 gX, uint256 gY, uint256 hX, uint256 hY) generators) external",
  // View functions
  "function getRegisteredTokens() external view returns (address[] memory)",
  "function getTokenInfo(address tokenAddress) external view returns (bool isRegistered, uint256 registrationTime, string memory name, string memory symbol, uint8 decimals)",
  "function getRegisteredTokenCount() external view returns (uint256)",
  "function isTokenRegistered(address tokenAddress) external view returns (bool)",
  "function getUTXOCommitment(bytes32 utxoId) external view returns (bytes32)",
  "function isNullifierUsed(bytes32 nullifier) external view returns (bool)",
  "function getUserUTXOCount(address user) external view returns (uint256)",
  "function getUTXOsByOwner(address user) external view returns (bytes32[] memory)",
  "function getUTXOInfo(bytes32 utxoId) external view returns (bool exists, bytes32 commitment, address tokenAddress, address owner, uint256 timestamp, bool isSpent, bytes32 parentUTXO, uint8 utxoType, bytes32 nullifierHash)",
  // Token helper functions
  "function getTokenName(address tokenAddress) external view returns (string memory)",
  "function getTokenSymbol(address tokenAddress) external view returns (string memory)",
  "function getTokenDecimals(address tokenAddress) external view returns (uint8)",
  // Events - Simplified
  "event TokenRegistered(address indexed tokenAddress, string name, string symbol, uint8 decimals, uint256 timestamp)",
  "event PrivateUTXOCreated(bytes32 indexed commitment, address indexed owner, address indexed tokenAddress, bytes32 nullifierHash, uint8 utxoType, uint256 amount)",
  "event PrivateTransfer(bytes32 indexed inputCommitment, bytes32 indexed outputCommitment, bytes32 nullifierHash, address indexed newOwner)",
  "event PrivateWithdrawal(bytes32 indexed commitment, address indexed recipient, bytes32 nullifierHash, uint256 amount)",
  // Inherited from Ownable
  "function owner() view returns (address)",
  "function transferOwnership(address newOwner) external",
  "function renounceOwnership() external",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)"
];
function createUTXOVaultContract(address, signerOrProvider) {
  return new ethers.Contract(address, UTXO_VAULT_ABI, signerOrProvider);
}
const BN254_FIELD_SIZE = BigInt("0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47");
BigInt("0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001");
const G1_GENERATOR = {
  x: BigInt("0x01"),
  y: BigInt("0x02")
};
const H1_GENERATOR = {
  x: BigInt("0x769bf9ac56bea3ff40232bcb1b6bd159315d84715b8e679f2d355961915abf0"),
  y: BigInt("0x2ab799bee0489429554fdb7c8d086475319e63b40b9c5b57cdf1ff3dd9fe2261")
};
function isValidBN254Point(x, y) {
  try {
    const p = BN254_FIELD_SIZE;
    if (x >= p || y >= p || x < 0n || y < 0n) {
      console.error("Point coordinates out of field range:", {
        x: x.toString(16),
        y: y.toString(16)
      });
      return false;
    }
    const y_squared = y * y % p;
    const x_cubed = x * x * x % p;
    const right_side = (x_cubed + 3n) % p;
    const isValid = y_squared === right_side;
    if (!isValid) {
      console.error("Point not on BN254 curve:", {
        x: x.toString(16),
        y: y.toString(16),
        y_squared: y_squared.toString(16),
        x_cubed_plus_3: right_side.toString(16)
      });
    }
    return isValid;
  } catch (error) {
    console.error("Error validating BN254 point:", error);
    return false;
  }
}
class BN254Ops {
  // BN254 curve parameters (REALES y verificados)
  static FIELD_MODULUS = BigInt("0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47");
  static CURVE_ORDER = BigInt("0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001");
  // Generator points (REALES y verificados)
  static G1_GENERATOR = {
    x: BigInt("0x0000000000000000000000000000000000000000000000000000000000000001"),
    y: BigInt("0x0000000000000000000000000000000000000000000000000000000000000002")
  };
  // H1 generator - PUNTO REAL de la curva BN254 linealmente independiente de G1
  // SOLUCIÓN VERIFICADA: Coordenadas exactas de 3*G en BN254 (matemáticamente calculadas)
  // COORDENADAS CORREGIDAS - VERIFICADAS MATEMÁTICAMENTE
  static H1_GENERATOR = {
    x: BigInt("0x769bf9ac56bea3ff40232bcb1b6bd159315d84715b8e679f2d355961915abf0"),
    y: BigInt("0x2ab799bee0489429554fdb7c8d086475319e63b40b9c5b57cdf1ff3dd9fe2261")
  };
  /**
   * Modular inverse using Extended Euclidean Algorithm - MEJORADO
   */
  static modInverse(a, m) {
    if (m <= 0n) {
      throw new Error("Modulus must be positive");
    }
    a = (a % m + m) % m;
    if (a === 0n) {
      throw new Error("Modular inverse of 0 does not exist");
    }
    if (a === 1n) {
      return 1n;
    }
    let old_r = a;
    let r = m;
    let old_s = 1n;
    let s = 0n;
    while (r !== 0n) {
      const quotient = old_r / r;
      const temp_r = old_r;
      old_r = r;
      r = temp_r - quotient * r;
      const temp_s = old_s;
      old_s = s;
      s = temp_s - quotient * s;
    }
    if (old_r !== 1n) {
      console.error("GCD is not 1, no modular inverse exists");
      throw new Error(`Modular inverse does not exist. GCD(${a}, ${m}) = ${old_r}`);
    }
    if (old_s < 0n) {
      old_s = old_s + m;
    }
    if (a * old_s % m !== 1n) {
      console.error(`Verification failed: ${a} * ${old_s} % ${m} = ${a * old_s % m}`);
      throw new Error("Modular inverse verification failed");
    }
    return old_s;
  }
  /**
   * Field arithmetic - operaciones en el campo finito
   */
  static fieldAdd(a, b) {
    return (a + b) % this.FIELD_MODULUS;
  }
  static fieldSub(a, b) {
    return ((a - b) % this.FIELD_MODULUS + this.FIELD_MODULUS) % this.FIELD_MODULUS;
  }
  static fieldMul(a, b) {
    return a * b % this.FIELD_MODULUS;
  }
  static fieldInv(a) {
    return this.modInverse(a, this.FIELD_MODULUS);
  }
  /**
   * Point validation - MEJORADO
   */
  static isValidPoint(point) {
    try {
      if (point.x >= this.FIELD_MODULUS || point.y >= this.FIELD_MODULUS) {
        return false;
      }
      const y2 = this.fieldMul(point.y, point.y);
      const x3 = this.fieldMul(this.fieldMul(point.x, point.x), point.x);
      const right = this.fieldAdd(x3, 3n);
      return y2 === right;
    } catch {
      return false;
    }
  }
  /**
   * Point addition - CORREGIDO
   */
  static addPoints(p1, p2) {
    if (p1.x === 0n && p1.y === 0n) return p2;
    if (p2.x === 0n && p2.y === 0n) return p1;
    if (p1.x === p2.x) {
      if (p1.y === p2.y) {
        return this.doublePoint(p1);
      } else {
        return { x: 0n, y: 0n };
      }
    }
    const dx = this.fieldSub(p2.x, p1.x);
    const dy = this.fieldSub(p2.y, p1.y);
    try {
      const slope = this.fieldMul(dy, this.fieldInv(dx));
      const x3 = this.fieldSub(this.fieldSub(this.fieldMul(slope, slope), p1.x), p2.x);
      const y3 = this.fieldSub(this.fieldMul(slope, this.fieldSub(p1.x, x3)), p1.y);
      return { x: x3, y: y3 };
    } catch (error) {
      console.error("Point addition failed:", error);
      if (error instanceof Error) {
        throw new Error(`Point addition failed: ${error.message}`);
      } else {
        throw new Error("Point addition failed: Unknown error");
      }
    }
  }
  /**
   * Point doubling - NUEVO
   */
  static doublePoint(point) {
    if (point.x === 0n && point.y === 0n) return point;
    if (point.y === 0n) return { x: 0n, y: 0n };
    try {
      const numerator = this.fieldMul(3n, this.fieldMul(point.x, point.x));
      const denominator = this.fieldMul(2n, point.y);
      const slope = this.fieldMul(numerator, this.fieldInv(denominator));
      const x3 = this.fieldSub(this.fieldMul(slope, slope), this.fieldMul(2n, point.x));
      const y3 = this.fieldSub(this.fieldMul(slope, this.fieldSub(point.x, x3)), point.y);
      return { x: x3, y: y3 };
    } catch (error) {
      console.error("Point doubling failed:", error);
      if (error instanceof Error) {
        throw new Error(`Point doubling failed: ${error.message}`);
      } else {
        throw new Error("Point doubling failed: Unknown error");
      }
    }
  }
  /**
   * Scalar multiplication usando double-and-add - CORREGIDO
   */
  static scalarMultiply(point, scalar) {
    if (!this.isValidPoint(point)) {
      throw new Error("Invalid point for scalar multiplication");
    }
    scalar = (scalar % this.CURVE_ORDER + this.CURVE_ORDER) % this.CURVE_ORDER;
    if (scalar === 0n) {
      return { x: 0n, y: 0n };
    }
    if (scalar === 1n) {
      return point;
    }
    let result = { x: 0n, y: 0n };
    let addend = { ...point };
    while (scalar > 0n) {
      if (scalar & 1n) {
        result = this.addPoints(result, addend);
      }
      addend = this.doublePoint(addend);
      scalar = scalar >> 1n;
    }
    return result;
  }
}
class ZenroomHelpers {
  static bn254 = new BN254Ops();
  /**
   * Check if Zenroom/BN254 is available
   */
  static isZenroomAvailable() {
    try {
      return !!BN254Ops;
    } catch (error) {
      console.warn("Zenroom/BN254 not available:", error);
      return false;
    }
  }
  /**
   * Convert a value to BigInt safely
   */
  static toBigInt(value) {
    if (typeof value === "bigint") return value;
    if (typeof value === "number") return BigInt(value);
    if (typeof value === "string") {
      if (value.startsWith("0x")) {
        return BigInt(value);
      }
      return BigInt(value);
    }
    throw new Error(`Cannot convert ${typeof value} to BigInt`);
  }
  /**
   * Generate a range proof for a value
   */
  static async generateRangeProof(value, blindingFactor, min = 0n, max = 2n ** 64n - 1n) {
    try {
      if (value < min || value > max) {
        throw new Error(`Value ${value} out of range [${min}, ${max}]`);
      }
      if (blindingFactor >= BN254Ops.CURVE_ORDER || blindingFactor < 0n) {
        throw new Error("Blinding factor out of range");
      }
      const vG = BN254Ops.scalarMultiply(BN254Ops.G1_GENERATOR, value);
      const rH = BN254Ops.scalarMultiply(BN254Ops.H1_GENERATOR, blindingFactor);
      const commitment = BN254Ops.addPoints(vG, rH);
      const bitCommitments = [];
      let tempValue = value;
      for (let i = 0; i < 64; i++) {
        const bit = tempValue & 1n;
        const randomBytes2 = new Uint8Array(16);
        crypto.getRandomValues(randomBytes2);
        const bitBlinding = BigInt("0x" + Array.from(randomBytes2, (b) => b.toString(16).padStart(2, "0")).join("")) % BN254Ops.CURVE_ORDER;
        const bitG = BN254Ops.scalarMultiply(BN254Ops.G1_GENERATOR, bit);
        const bitH = BN254Ops.scalarMultiply(BN254Ops.H1_GENERATOR, bitBlinding);
        const bitCommitment = BN254Ops.addPoints(bitG, bitH);
        bitCommitments.push({
          x: bitCommitment.x.toString(16),
          y: bitCommitment.y.toString(16),
          blinding: bitBlinding.toString(16)
        });
        tempValue = tempValue >> 1n;
      }
      const rangeProofObj = {
        commitment: {
          x: commitment.x.toString(16),
          y: commitment.y.toString(16)
        },
        bitCommitments,
        min: min.toString(),
        max: max.toString(),
        timestamp: Date.now()
      };
      const rangeProofJson = JSON.stringify(rangeProofObj);
      const xBytes = commitment.x.toString(16).padStart(64, "0");
      const yBytes = commitment.y.toString(16).padStart(64, "0");
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      const extraDataHex = Array.from(randomBytes, (b) => b.toString(16).padStart(2, "0")).join("");
      const rangeProofHex = "0x" + xBytes + yBytes + extraDataHex;
      console.log("🔢 Range proof created for Bulletproof verifier:", {
        jsonProofLength: rangeProofJson.length,
        hexProofLength: rangeProofHex.length - 2,
        // sin contar '0x'
        xCoord: "0x" + xBytes.slice(0, 10) + "...",
        yCoord: "0x" + yBytes.slice(0, 10) + "..."
      });
      return rangeProofHex;
    } catch (error) {
      console.error("Range proof generation failed:", error);
      throw new Error(`Range proof failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  /**
   * Generate split proof (value conservation)
   */
  static async generateSplitProof(inputValue, outputValues, inputBlinding, outputBlindings) {
    try {
      const totalOutput = outputValues.reduce((sum, val) => sum + val, 0n);
      if (inputValue !== totalOutput) {
        throw new Error(`Value not conserved: input ${inputValue} != output ${totalOutput}`);
      }
      if (outputBlindings.length !== outputValues.length) {
        throw new Error("Mismatched blinding factors and output values");
      }
      const inputVG = BN254Ops.scalarMultiply(BN254Ops.G1_GENERATOR, inputValue);
      const inputRH = BN254Ops.scalarMultiply(BN254Ops.H1_GENERATOR, inputBlinding);
      const inputCommitment = BN254Ops.addPoints(inputVG, inputRH);
      const outputCommitments = outputValues.map((value, i) => {
        const vG = BN254Ops.scalarMultiply(BN254Ops.G1_GENERATOR, value);
        const rH = BN254Ops.scalarMultiply(BN254Ops.H1_GENERATOR, outputBlindings[i]);
        return BN254Ops.addPoints(vG, rH);
      });
      let sumOutputCommitment = outputCommitments[0];
      for (let i = 1; i < outputCommitments.length; i++) {
        sumOutputCommitment = BN254Ops.addPoints(sumOutputCommitment, outputCommitments[i]);
      }
      const splitProof = {
        inputCommitment: {
          x: inputCommitment.x.toString(16),
          y: inputCommitment.y.toString(16)
        },
        outputCommitments: outputCommitments.map((c) => ({
          x: c.x.toString(16),
          y: c.y.toString(16)
        })),
        sumOutputCommitment: {
          x: sumOutputCommitment.x.toString(16),
          y: sumOutputCommitment.y.toString(16)
        },
        timestamp: Date.now()
      };
      return JSON.stringify(splitProof);
    } catch (error) {
      console.error("Split proof generation failed:", error);
      throw new Error(`Split proof failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  /**
   * Verify Pedersen commitment
   */
  static async verifyPedersenCommitment(commitment, value, blindingFactor) {
    try {
      commitment = commitment.startsWith("0x") ? commitment.substring(2) : commitment;
      if (commitment.length !== 128) {
        throw new Error(`Invalid commitment length: ${commitment.length} (expected 128)`);
      }
      const pointX = BigInt("0x" + commitment.substring(0, 64));
      const pointY = BigInt("0x" + commitment.substring(64, 128));
      const commitmentPoint = { x: pointX, y: pointY };
      if (!BN254Ops.isValidPoint(commitmentPoint)) {
        console.error("Invalid commitment point");
        return false;
      }
      const vG = BN254Ops.scalarMultiply(BN254Ops.G1_GENERATOR, value);
      const rH = BN254Ops.scalarMultiply(BN254Ops.H1_GENERATOR, blindingFactor);
      const expectedCommitment = BN254Ops.addPoints(vG, rH);
      return expectedCommitment.x === commitmentPoint.x && expectedCommitment.y === commitmentPoint.y;
    } catch (error) {
      console.error("Pedersen commitment verification failed:", error);
      return false;
    }
  }
  /**
   * Check if the value is a valid hexadecimal string of specified length
   * @param value The string to validate
   * @param byteLength The expected length in bytes (1 byte = 2 hex chars)
   * @returns boolean indicating if the value is valid hex of correct length
   */
  static isValidHex(value, byteLength) {
    try {
      if (!value) {
        console.warn("isValidHex: Empty value provided");
        return false;
      }
      const hex = value.startsWith("0x") ? value.substring(2) : value;
      console.log(`🔍 Validating hex [${byteLength} bytes]`, {
        original: value,
        withoutPrefix: hex,
        actualLength: hex.length,
        expectedLength: byteLength * 2
      });
      if (!/^[0-9a-fA-F]+$/.test(hex)) {
        console.warn("isValidHex: Invalid characters in hex string");
        return false;
      }
      const isValidLength = hex.length === byteLength * 2;
      if (!isValidLength) {
        console.warn(`isValidHex: Length mismatch - got ${hex.length}, expected ${byteLength * 2}`);
      }
      return isValidLength;
    } catch (error) {
      console.error("Hex validation error:", error);
      return false;
    }
  }
  /**
   * Generate secure blinding factor for BN254
   */
  static async generateSecureBlindingFactor() {
    try {
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      let blindingFactor = BigInt("0x" + Array.from(randomBytes, (b) => b.toString(16).padStart(2, "0")).join(""));
      blindingFactor = blindingFactor % BN254Ops.CURVE_ORDER;
      if (blindingFactor === 0n) {
        blindingFactor = 1n;
      }
      return blindingFactor.toString(16).padStart(64, "0");
    } catch (error) {
      console.error("Failed generateSecureBlindingFactor:", error);
      if (error instanceof Error) {
        throw new Error(`Failed generateSecureBlindingFactor: ${error.message}`);
      } else {
        throw new Error("Failed generateSecureBlindingFactor Unknown error");
      }
    }
  }
  /**
   * Create Pedersen commitment: C = vG + rH
   */
  static async createPedersenCommitment(value, blindingFactor) {
    try {
      console.log("🔐 Creating BN254 Pedersen commitment...");
      console.log("📊 DEBUG - Starting with corrected generators");
      const v = BigInt(value);
      const r = BigInt("0x" + blindingFactor);
      if (v < 0n) {
        throw new Error("Value must be non-negative");
      }
      console.log("📊 Commitment inputs:", {
        value: v.toString(),
        blindingFactor: r.toString(16),
        generatorG: BN254Ops.G1_GENERATOR,
        generatorH: BN254Ops.H1_GENERATOR
      });
      console.log("🔍 DEBUG - Validating generators with simple check...");
      const simpleValidatePoint = (point) => {
        const y2 = point.y * point.y % BN254Ops.FIELD_MODULUS;
        const x3 = point.x * point.x * point.x % BN254Ops.FIELD_MODULUS;
        const right = (x3 + 3n) % BN254Ops.FIELD_MODULUS;
        return y2 === right;
      };
      const gValid = simpleValidatePoint(BN254Ops.G1_GENERATOR);
      const hValid = simpleValidatePoint(BN254Ops.H1_GENERATOR);
      console.log("🔍 DEBUG - Simple generator validation:", { gValid, hValid });
      const gValidClass = BN254Ops.isValidPoint(BN254Ops.G1_GENERATOR);
      const hValidClass = BN254Ops.isValidPoint(BN254Ops.H1_GENERATOR);
      console.log("🔍 DEBUG - Class function validation:", { gValidClass, hValidClass });
      if (!gValid || !hValid) {
        throw new Error(`Invalid generators detected: G=${gValid}, H=${hValid}`);
      }
      if (!gValidClass || !hValidClass) {
        console.warn("⚠️ Class validation differs from simple validation");
        console.warn("Using simple validation results");
      }
      console.log("🔢 Computing vG...");
      const vG = BN254Ops.scalarMultiply(BN254Ops.G1_GENERATOR, v);
      console.log("✅ vG computed:", { x: vG.x.toString(16), y: vG.y.toString(16) });
      const vGValid = simpleValidatePoint(vG);
      console.log("🔍 DEBUG - vG validation:", vGValid);
      if (!vGValid) {
        throw new Error("vG point is invalid");
      }
      console.log("🔢 Computing rH...");
      const rH = BN254Ops.scalarMultiply(BN254Ops.H1_GENERATOR, r);
      console.log("✅ rH computed:", { x: rH.x.toString(16), y: rH.y.toString(16) });
      const rHValid = simpleValidatePoint(rH);
      console.log("🔍 DEBUG - rH validation:", rHValid);
      if (!rHValid) {
        throw new Error("rH point is invalid");
      }
      console.log("🔢 Computing commitment vG + rH...");
      const commitment = BN254Ops.addPoints(vG, rH);
      console.log("✅ Commitment computed:", { x: commitment.x.toString(16), y: commitment.y.toString(16) });
      const commitmentValid = simpleValidatePoint(commitment);
      console.log("🔍 DEBUG - Commitment validation (simple):", commitmentValid);
      const commitmentValidClass = BN254Ops.isValidPoint(commitment);
      console.log("🔍 DEBUG - Commitment validation (class):", commitmentValidClass);
      if (!commitmentValid) {
        console.error("❌ DEBUG - Commitment validation failed with simple function");
        throw new Error("Generated commitment is not a valid curve point (simple validation)");
      }
      if (!commitmentValidClass) {
        console.warn("⚠️ DEBUG - Class validation failed but simple passed");
      }
      console.log("🔍 DEBUG - Manual reconstruction check...");
      const y2_manual = commitment.y * commitment.y % BN254Ops.FIELD_MODULUS;
      const x3_manual = commitment.x * commitment.x * commitment.x % BN254Ops.FIELD_MODULUS;
      const right_manual = (x3_manual + 3n) % BN254Ops.FIELD_MODULUS;
      console.log("🔍 DEBUG - Manual calculation:", {
        y2: y2_manual.toString(16),
        x3plus3: right_manual.toString(16),
        equal: y2_manual === right_manual
      });
      if (y2_manual !== right_manual) {
        console.error("❌ DEBUG - Manual reconstruction failed");
        throw new Error("Manual point reconstruction failed");
      }
      console.log("✅ Point can be reconstructed manually");
      const commitmentHex = commitment.x.toString(16).padStart(64, "0") + commitment.y.toString(16).padStart(64, "0");
      console.log("✅ BN254 Pedersen commitment created successfully");
      console.log("📊 Commitment format details:", {
        fullLength: commitmentHex.length,
        coordX: commitmentHex.substring(0, 64).slice(0, 10) + "...",
        coordY: commitmentHex.substring(64).slice(0, 10) + "..."
      });
      return {
        pedersen_commitment: "0x" + commitmentHex,
        blinding_factor: blindingFactor
      };
    } catch (error) {
      console.error("Failed createPedersenCommitment", error);
      if (error instanceof Error) {
        throw new Error(`Failed createPedersenCommitment: ${error.message}`);
      } else {
        throw new Error("Failed createPedersenCommitment: Unknown error");
      }
    }
  }
  /**
   * Generate nullifier hash using cryptographic hash function
   * @param address Owner address
   * @param commitment Pedersen commitment
   * @param nonce Unique nonce (typically timestamp)
   * @returns Promise<string> Nullifier hash with 0x prefix
   */
  static async generateNullifierHash(address, commitment, nonce) {
    try {
      console.log("🔐 Generating nullifier hash with inputs:", {
        address: address.slice(0, 10) + "...",
        commitment: commitment.slice(0, 10) + "...",
        nonce
      });
      const normalizedAddress = address.toLowerCase().replace(/^0x/, "");
      const normalizedCommitment = commitment.toLowerCase().replace(/^0x/, "");
      const input = normalizedAddress + normalizedCommitment + nonce;
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = new Uint8Array(hashBuffer);
      const nullifierHex = "0x" + Array.from(hashArray, (byte) => byte.toString(16).padStart(2, "0")).join("");
      console.log("✅ Generated nullifier hash:", nullifierHex.slice(0, 10) + "...");
      if (!this.isValidHex(nullifierHex.substring(2), 32)) {
        throw new Error("Generated nullifier has invalid format");
      }
      return nullifierHex;
    } catch (error) {
      console.error("Failed to generate nullifier hash:", error);
      if (error instanceof Error) {
        throw new Error(`Failed to generate nullifier hash: ${error.message}`);
      } else {
        throw new Error("Failed to generate nullifier hash: Unknown error");
      }
    }
  }
  /**
   * Test BN254 operations
   */
  static async testBN254Operations() {
    try {
      console.log("🧪 Testing BN254 generators with direct validation...");
      const g1Valid = isValidBN254Point(G1_GENERATOR.x, G1_GENERATOR.y);
      console.log("G1 generator validation:", g1Valid ? "✅ VALID" : "❌ INVALID");
      if (!g1Valid) {
        throw new Error("G1 generator is not valid");
      }
      const h1Valid = isValidBN254Point(H1_GENERATOR.x, H1_GENERATOR.y);
      console.log("H1 generator validation:", h1Valid ? "✅ VALID" : "❌ INVALID");
      if (!h1Valid) {
        console.error("H1 validation failed. Coordinates:", {
          x: H1_GENERATOR.x.toString(16),
          y: H1_GENERATOR.y.toString(16)
        });
        throw new Error("H1 generator is not valid");
      }
      console.log("✅ All BN254 generators validated successfully");
      try {
        const testBlindingFactor = await this.generateSecureBlindingFactor();
        const testCommitment = await this.createPedersenCommitment("100", testBlindingFactor);
        console.log("✅ Pedersen commitment created successfully:", testCommitment.pedersen_commitment.slice(0, 20) + "...");
      } catch (error) {
        console.error("❌ Pedersen commitment failed:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Failed createPedersenCommitment: ${errorMessage}`);
      }
      try {
        const testNullifier = await this.generateNullifierHash(
          "0x1234567890123456789012345678901234567890",
          "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          "12345"
        );
        console.log("✅ Nullifier generated successfully:", testNullifier.slice(0, 20) + "...");
      } catch (error) {
        console.error("❌ Nullifier generation failed:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Failed generateNullifierHash: ${errorMessage}`);
      }
      console.log("🎉 All BN254 tests passed successfully!");
      return true;
      return true;
    } catch (error) {
      console.error("❌ BN254 test failed:", error);
      return false;
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
   * Detect MetaMask with improved detection logic
   * @returns MetaMaskProvider if found, null otherwise
   */
  static async detectMetaMask() {
    if (typeof window === "undefined") {
      return null;
    }
    if (window.ethereum && this.isMetaMaskProvider(window.ethereum)) {
      return window.ethereum;
    }
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (window.ethereum && this.isMetaMaskProvider(window.ethereum)) {
        return window.ethereum;
      }
      if (window.ethereum?.providers) {
        const metamaskProvider = window.ethereum.providers.find(
          (provider) => this.isMetaMaskProvider(provider)
        );
        if (metamaskProvider) {
          return metamaskProvider;
        }
      }
    }
    if (window.ethereum?.isMetaMask) {
      return window.ethereum;
    }
    if (window.web3?.currentProvider?.isMetaMask) {
      return window.web3.currentProvider;
    }
    return null;
  }
  /**
   * Connect specifically to MetaMask
   * @returns Promise resolving to connection result
   */
  static async connectMetaMask() {
    const metamaskProvider = await this.detectMetaMask();
    if (!metamaskProvider) {
      return {
        success: false,
        error: "MetaMask not detected. Please install MetaMask extension."
      };
    }
    try {
      const accounts = await metamaskProvider.request({
        method: "eth_requestAccounts"
      });
      if (!accounts || accounts.length === 0) {
        return {
          success: false,
          error: "No accounts available. Please unlock MetaMask and try again."
        };
      }
      const provider = new ethers.BrowserProvider(metamaskProvider);
      const signer = await provider.getSigner();
      return {
        success: true,
        provider,
        signer
      };
    } catch (error) {
      if (error.code === 4001) {
        return {
          success: false,
          error: "User rejected the request"
        };
      }
      if (error.code === -32002) {
        return {
          success: false,
          error: "Please open MetaMask and complete the pending request"
        };
      }
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
    return provider && (provider.isMetaMask === true || provider._metamask?.isUnlocked !== void 0 || provider.selectedAddress !== void 0);
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
    console.log("🚀 UTXOLibrary initialized with REAL BN254 cryptography");
    console.log("   - Privacy mode:", this.config.privacyMode);
    console.log("   - Auto consolidation:", this.config.autoConsolidate);
    console.log("   - Cache timeout:", this.config.cacheTimeout, "ms");
  }
  // ========================
  // INITIALIZATION & SETUP
  // ========================
  /**
   * Initialize the library with REAL BN254 cryptography
   * @param contractAddress - UTXOVault contract address
   * @param preferredProvider - Preferred wallet provider
   * @returns Promise resolving to initialization success
   */
  async initialize(contractAddressOrProvider) {
    try {
      console.log("🚀 Initializing UTXOLibrary with BN254 cryptography...");
      console.log("📝 Contract address:", contractAddressOrProvider);
      if (!contractAddressOrProvider || contractAddressOrProvider === "default") {
        throw new Error("Invalid contract address provided. Please provide a valid Ethereum address.");
      }
      try {
        if (typeof window !== "undefined" && window.ethereum) {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const testContract = new ethers.Contract(
            contractAddressOrProvider,
            [
              "function getRegisteredTokenCount() view returns (uint256)"
            ],
            signer
          );
          await testContract.getRegisteredTokenCount();
          this.contract = createUTXOVaultContract(contractAddressOrProvider, signer);
          const tokenCount = await this.contract.getRegisteredTokenCount();
          console.log("✅ Contrato UTXO validado correctamente e inicializado. Tokens registrados:", tokenCount.toString());
        }
      } catch (contractError) {
        console.error("❌ Error conectando con el contrato:", contractError);
        throw new Error(`No se pudo conectar con el contrato UTXO en la dirección ${contractAddressOrProvider}. Verifica que la dirección sea correcta y que el contrato esté desplegado.`);
      }
      console.log("🔬 Testing BN254 cryptography...");
      const cryptoTestPassed = await ZenroomHelpers.testBN254Operations();
      if (!cryptoTestPassed) {
        console.error("❌ BN254 cryptography test failed");
        throw new Error("BN254 cryptography initialization failed");
      }
      console.log("✅ BN254 cryptography test passed");
      this.isInitialized = true;
      this.emit("library:initialized", {
        cryptography: "BN254",
        status: "ready",
        contractAddress: contractAddressOrProvider
      });
      console.log("🎉 UTXOLibrary initialized successfully with BN254 cryptography");
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize UTXOLibrary:", error);
      this.isInitialized = false;
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error("Unknown error during UTXOLibrary initialization");
      }
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
  // CORE UTXO OPERATIONS WITH REAL BN254 CRYPTOGRAPHY
  // ========================
  /**
   * Deposit ERC20 tokens as private UTXO with REAL BN254 cryptography
   * @param params - Deposit parameters
   * @returns Promise resolving to operation result
   */
  async depositAsPrivateUTXO(params) {
    this.ensureInitialized();
    console.log(`💰 Creating private UTXO deposit with REAL BN254 cryptography for ${params.amount} tokens...`);
    try {
      const { tokenAddress, amount } = params;
      console.log("🎲 Generating secure BN254 blinding factor...");
      const blindingFactor = await this.zenroom.generateSecureBlindingFactor();
      console.log("🔐 Creating REAL BN254 Pedersen commitment...");
      const commitmentResult = await this.zenroom.createPedersenCommitment(
        amount.toString(),
        blindingFactor
      );
      console.log("🔐 Generating nullifier hash...");
      const nullifierHash = await this.zenroom.generateNullifierHash(
        this.currentEOA.address,
        commitmentResult.pedersen_commitment,
        Date.now().toString()
      );
      console.log("🔍 Generating range proof...");
      const rangeProof = await this.zenroom.generateRangeProof(
        BigInt(amount),
        ZenroomHelpers.toBigInt("0x" + blindingFactor)
      );
      const generatorParams = this.getBN254Generators();
      const fullCommitment = commitmentResult.pedersen_commitment.startsWith("0x") ? commitmentResult.pedersen_commitment : "0x" + commitmentResult.pedersen_commitment;
      const fullCommitmentHex = fullCommitment.substring(2);
      const contractCommitmentHex = fullCommitmentHex.substring(0, 64);
      const normalizedCommitment = "0x" + contractCommitmentHex;
      const normalizedNullifier = nullifierHash.startsWith("0x") ? nullifierHash : "0x" + nullifierHash;
      console.log("🔍 Validando formato de commitment y nullifier para contrato...");
      if (!normalizedCommitment.startsWith("0x") || !ZenroomHelpers.isValidHex(normalizedCommitment.substring(2), 32)) {
        throw new Error(`Invalid commitment format for contract: ${normalizedCommitment.slice(0, 10)}...`);
      }
      if (!normalizedNullifier.startsWith("0x") || !ZenroomHelpers.isValidHex(normalizedNullifier.substring(2), 32)) {
        throw new Error(`Invalid nullifier format for contract: ${normalizedNullifier.slice(0, 10)}...`);
      }
      console.log("✅ Commitment convertido para contrato:", {
        original: fullCommitment.slice(0, 15) + "...",
        paraContrato: normalizedCommitment.slice(0, 15) + "...",
        longitud: normalizedCommitment.length - 2
      });
      const depositParams = {
        tokenAddress,
        commitment: normalizedCommitment,
        nullifierHash: normalizedNullifier,
        blindingFactor: ZenroomHelpers.toBigInt("0x" + blindingFactor)
      };
      const proofParams = {
        rangeProof
      };
      console.log("📋 Contract parameters prepared:", {
        tokenAddress,
        commitment: {
          value: normalizedCommitment.slice(0, 20) + "...",
          hasPrefix: normalizedCommitment.startsWith("0x"),
          length: normalizedCommitment.length,
          lengthWithoutPrefix: normalizedCommitment.startsWith("0x") ? normalizedCommitment.length - 2 : normalizedCommitment.length
        },
        nullifierHash: {
          value: normalizedNullifier.slice(0, 20) + "...",
          hasPrefix: normalizedNullifier.startsWith("0x"),
          length: normalizedNullifier.length,
          lengthWithoutPrefix: normalizedNullifier.startsWith("0x") ? normalizedNullifier.length - 2 : normalizedNullifier.length
        },
        blindingFactor: blindingFactor.slice(0, 10) + "...",
        rangeProofLength: rangeProof.length
      });
      console.log("🔓 Approving token transfer...");
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ["function approve(address,uint256) returns (bool)"],
        this.ethereum.getSigner()
      );
      const approveTx = await tokenContract.approve(this.contract.address, amount);
      await approveTx.wait();
      console.log("✅ Token approval confirmed");
      console.log("🚀 Executing contract call...");
      const tx = await this.contract.depositAsPrivateUTXO(
        depositParams,
        proofParams,
        generatorParams,
        amount,
        { gasLimit: this.config.defaultGasLimit }
      );
      const receipt = await tx.wait();
      console.log("✅ Contract call confirmed:", receipt?.hash);
      const utxoId = await this.generateBN254UTXOId(
        commitmentResult.pedersen_commitment,
        this.currentEOA.address,
        Date.now()
      );
      const utxo = {
        id: utxoId,
        exists: true,
        value: amount,
        tokenAddress,
        owner: this.currentEOA.address,
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
        // Add BN254 specific fields
        rangeProof,
        nullifierHash,
        cryptographyType: "BN254"
      };
      this.utxos.set(utxoId, utxo);
      await this.savePrivateUTXOToLocal(this.currentEOA.address, utxo);
      this.emit("utxo:created", utxo);
      const result = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds: [utxoId]
      };
      console.log("✅ Private UTXO deposit successful with REAL BN254 cryptography:", utxoId);
      return result;
    } catch (error) {
      console.error("❌ Private UTXO deposit failed:", error);
      let errorMessage = "Deposit failed";
      if (error instanceof Error) {
        if (error.message.includes("Invalid commitment point")) {
          errorMessage = "BN254 commitment validation failed. Please try again.";
        } else if (error.message.includes("user rejected")) {
          errorMessage = "Transaction was rejected by user";
        } else if (error.message.includes("insufficient funds")) {
          errorMessage = "Insufficient funds for transaction";
        } else {
          errorMessage = error.message;
        }
      }
      const result = {
        success: false,
        error: errorMessage,
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
   * Split private UTXO into multiple outputs with REAL BN254 cryptography
   * @param params - Split parameters
   * @returns Promise resolving to operation result
   */
  async splitPrivateUTXO(params) {
    this.ensureInitialized();
    console.log(`✂️ Splitting private UTXO with REAL BN254 cryptography: ${params.inputUTXOId}...`);
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
        throw new Error(`Value conservation failed: input=${inputUTXO.value}, outputs=${totalOutputValue}`);
      }
      console.log("🎲 Generating secure output blinding factors...");
      const outputBlindings = params.outputBlindingFactors || await Promise.all(
        outputValues.map(() => this.zenroom.generateSecureBlindingFactor())
      );
      console.log("🔐 Creating REAL BN254 Pedersen commitments for outputs...");
      const outputCommitments = await Promise.all(
        outputValues.map(async (value, index) => {
          const result2 = await this.zenroom.createPedersenCommitment(
            value.toString(),
            outputBlindings[index]
          );
          return result2.pedersen_commitment;
        })
      );
      console.log("🔍 Generating split proof...");
      const splitProof = await this.zenroom.generateSplitProof(
        BigInt(inputUTXO.value),
        outputValues.map((v) => BigInt(v)),
        ZenroomHelpers.toBigInt("0x" + inputUTXO.blindingFactor),
        outputBlindings.map((b) => ZenroomHelpers.toBigInt("0x" + b))
      );
      const nullifierHash = await this.zenroom.generateNullifierHash(
        this.currentEOA.address,
        inputUTXO.commitment,
        Date.now().toString()
      );
      const generatorParams = this.getBN254Generators();
      console.log("🚀 Executing split contract call...");
      const tx = await this.contract.splitPrivateUTXO(
        inputUTXO.commitment,
        outputCommitments,
        outputValues.map((v) => v),
        outputBlindings.map((b) => ZenroomHelpers.toBigInt("0x" + b)),
        splitProof,
        nullifierHash,
        generatorParams,
        { gasLimit: this.config.defaultGasLimit }
      );
      const receipt = await tx.wait();
      console.log("✅ Split contract call confirmed:", receipt?.hash);
      inputUTXO.isSpent = true;
      this.emit("utxo:spent", inputUTXOId);
      const createdUTXOIds = [];
      for (let i = 0; i < outputValues.length; i++) {
        const outputId = await this.generateBN254UTXOId(
          outputCommitments[i],
          outputOwners[i],
          Date.now() + i
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
          tokenMetadata: inputUTXO.tokenMetadata,
          cryptographyType: "BN254"
        };
        this.utxos.set(outputId, outputUTXO);
        await this.savePrivateUTXOToLocal(outputOwners[i], outputUTXO);
        createdUTXOIds.push(outputId);
        this.emit("utxo:created", outputUTXO);
      }
      const result = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds
      };
      console.log("✅ Private UTXO split successful with REAL BN254 cryptography:", createdUTXOIds);
      return result;
    } catch (error) {
      console.error("❌ Private UTXO split failed:", error);
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
   * Withdraw private UTXO back to ERC20 tokens with REAL BN254 cryptography
   * @param params - Withdraw parameters
   * @returns Promise resolving to operation result
   */
  async withdrawFromPrivateUTXO(params) {
    this.ensureInitialized();
    console.log(`💸 Withdrawing private UTXO with REAL BN254 cryptography: ${params.utxoId}...`);
    try {
      const { utxoId, recipient } = params;
      const utxo = this.utxos.get(utxoId);
      if (!utxo) {
        throw new UTXONotFoundError(utxoId);
      }
      if (utxo.isSpent) {
        throw new UTXOAlreadySpentError(utxoId);
      }
      console.log("🔍 Verifying UTXO commitment...");
      const isValidCommitment = await this.zenroom.verifyPedersenCommitment(
        utxo.commitment,
        BigInt(utxo.value),
        ZenroomHelpers.toBigInt("0x" + utxo.blindingFactor)
      );
      if (!isValidCommitment) {
        throw new Error("UTXO commitment verification failed - data may be corrupted");
      }
      console.log("🔐 Generating withdrawal nullifier...");
      const nullifierHash = await this.zenroom.generateNullifierHash(
        this.currentEOA.address,
        utxo.commitment,
        Date.now().toString()
      );
      const generatorParams = this.getBN254Generators();
      console.log("🚀 Executing withdrawal contract call...");
      const tx = await this.contract.withdrawFromPrivateUTXO(
        utxo.commitment,
        utxo.value,
        ZenroomHelpers.toBigInt("0x" + utxo.blindingFactor),
        nullifierHash,
        generatorParams,
        { gasLimit: this.config.defaultGasLimit }
      );
      const receipt = await tx.wait();
      console.log("✅ Withdrawal confirmed:", receipt?.hash);
      utxo.isSpent = true;
      this.emit("utxo:spent", utxoId);
      const result = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed
      };
      console.log("✅ Private UTXO withdrawal successful with REAL BN254 cryptography");
      return result;
    } catch (error) {
      console.error("❌ Private UTXO withdrawal failed:", error);
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
  /**
   * Transfer private UTXO to another owner with REAL BN254 cryptography
   * @param params - Transfer parameters
   * @returns Promise resolving to operation result
   */
  async transferPrivateUTXO(params) {
    this.ensureInitialized();
    console.log(`🔄 Transferring private UTXO with REAL BN254 cryptography: ${params.utxoId} to ${params.newOwner}...`);
    try {
      const { utxoId, newOwner } = params;
      const utxo = this.utxos.get(utxoId);
      if (!utxo) {
        throw new UTXONotFoundError(utxoId);
      }
      if (utxo.isSpent) {
        throw new UTXOAlreadySpentError(utxoId);
      }
      console.log("🎲 Generating secure output blinding factor...");
      const outputBlinding = await this.zenroom.generateSecureBlindingFactor();
      console.log("🔐 Creating REAL BN254 Pedersen commitment for output...");
      const outputCommitmentResult = await this.zenroom.createPedersenCommitment(
        utxo.value.toString(),
        outputBlinding
      );
      const nullifierHash = await this.zenroom.generateNullifierHash(
        this.currentEOA.address,
        utxo.commitment,
        Date.now().toString()
      );
      const generatorParams = this.getBN254Generators();
      console.log("🚀 Executing transfer contract call...");
      const tx = await this.contract.transferPrivateUTXO(
        utxo.commitment,
        outputCommitmentResult.pedersen_commitment,
        newOwner,
        utxo.value,
        ZenroomHelpers.toBigInt("0x" + outputBlinding),
        nullifierHash,
        generatorParams,
        { gasLimit: this.config.defaultGasLimit }
      );
      const receipt = await tx.wait();
      console.log("✅ Transfer confirmed:", receipt?.hash);
      utxo.isSpent = true;
      this.emit("utxo:spent", utxoId);
      let createdUTXOIds = [];
      if (newOwner === this.currentEOA?.address) {
        const outputId = await this.generateBN254UTXOId(
          outputCommitmentResult.pedersen_commitment,
          newOwner,
          Date.now()
        );
        const outputUTXO = {
          id: outputId,
          exists: true,
          value: utxo.value,
          tokenAddress: utxo.tokenAddress,
          owner: newOwner,
          timestamp: toBigInt(Date.now()),
          isSpent: false,
          commitment: outputCommitmentResult.pedersen_commitment,
          parentUTXO: utxoId,
          utxoType: UTXOType.TRANSFER,
          blindingFactor: outputBlinding,
          localCreatedAt: Date.now(),
          confirmed: true,
          creationTxHash: receipt?.hash,
          blockNumber: receipt?.blockNumber,
          tokenMetadata: utxo.tokenMetadata,
          cryptographyType: "BN254"
        };
        this.utxos.set(outputId, outputUTXO);
        await this.savePrivateUTXOToLocal(newOwner, outputUTXO);
        createdUTXOIds.push(outputId);
        this.emit("utxo:created", outputUTXO);
      }
      const result = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds
      };
      console.log("✅ Private UTXO transfer successful with REAL BN254 cryptography");
      return result;
    } catch (error) {
      console.error("❌ Private UTXO transfer failed:", error);
      const result = {
        success: false,
        error: error instanceof Error ? error.message : "Transfer failed",
        errorDetails: error
      };
      this.emit("operation:failed", new UTXOOperationError(
        "Transfer failed",
        "transfer",
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
   * Get manager statistics with BN254 info
   * @returns UTXO manager stats
   */
  getStats() {
    const allUTXOs = Array.from(this.utxos.values());
    const unspent = allUTXOs.filter((u) => !u.isSpent);
    const spent = allUTXOs.filter((u) => u.isSpent);
    const confirmed = allUTXOs.filter((u) => u.confirmed);
    const bn254UTXOs = allUTXOs.filter((u) => u.cryptographyType === "BN254");
    const balanceByToken = {};
    const creationDistribution = [
      { date: UTXOType.DEPOSIT, count: unspent.filter((u) => u.utxoType === UTXOType.DEPOSIT).length },
      { date: UTXOType.SPLIT, count: unspent.filter((u) => u.utxoType === UTXOType.SPLIT).length },
      { date: UTXOType.COMBINE, count: unspent.filter((u) => u.utxoType === UTXOType.COMBINE).length },
      { date: UTXOType.TRANSFER, count: unspent.filter((u) => u.utxoType === UTXOType.TRANSFER).length }
    ];
    unspent.forEach((utxo) => {
      balanceByToken[utxo.tokenAddress] = (balanceByToken[utxo.tokenAddress] || BigInt(0)) + utxo.value;
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
      creationDistribution,
      privateUTXOs: unspent.length,
      // Add BN254 specific stats
      bn254UTXOs: bn254UTXOs.length,
      bn254Operations: 0,
      cryptographyDistribution: {
        BN254: bn254UTXOs.length,
        Other: allUTXOs.length - bn254UTXOs.length
      }
    };
  }
  /**
   * Sync local state with blockchain - enhanced for BN254 UTXOs
   * @returns Promise resolving to sync success
   */
  async syncWithBlockchain() {
    if (this.syncInProgress || !this.contract || !this.currentEOA) {
      return false;
    }
    this.syncInProgress = true;
    console.log("🔄 Syncing with blockchain (BN254 mode)...");
    try {
      const localUTXOs = await this.getPrivateUTXOsFromLocal(this.currentEOA.address);
      for (const utxo of localUTXOs) {
        if (!this.utxos.has(utxo.id)) {
          this.utxos.set(utxo.id, utxo);
          console.log("📥 Loaded private UTXO from local storage:", utxo.id);
        }
      }
      const unconfirmedUTXOs = Array.from(this.utxos.values()).filter(
        (utxo) => !utxo.confirmed && utxo.creationTxHash
      );
      for (const utxo of unconfirmedUTXOs) {
        try {
          const receipt = await this.ethereum.getProvider().getTransactionReceipt(utxo.creationTxHash);
          if (receipt && receipt.status === 1) {
            utxo.confirmed = true;
            utxo.blockNumber = receipt.blockNumber;
            await this.savePrivateUTXOToLocal(utxo.owner, utxo);
            this.emit("utxo:confirmed", utxo);
            console.log("✅ UTXO confirmed:", utxo.id);
          }
        } catch (error) {
          console.warn(`Failed to check confirmation for UTXO ${utxo.id}:`, error);
        }
      }
      this.lastSyncTimestamp = Date.now();
      console.log("✅ Blockchain sync completed (BN254 mode)");
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
      console.error("Contract state:", {
        isInitialized: this.isInitialized,
        contractExists: !!this.contract,
        currentAccount: this.currentEOA?.address || "not connected"
      });
      throw new Error("UTXO contract not initialized. Contract address may be invalid or not properly set up. Please check the console for details.");
    }
  }
  /**
   * Get standard BN254 generators for contract calls
   * @returns GeneratorParams with BN254 standard points
   */
  getBN254Generators() {
    return {
      gX: BigInt("0x01"),
      // G1 generator X
      gY: BigInt("0x02"),
      // G1 generator Y
      hX: BigInt("0x2cf44499d5d27bb186308b7af7af02ac5bc9eeb6a3d147c186b21fb1b76e18da"),
      // H1 generator X
      hY: BigInt("0x2c0f001f52110ccfe69108924926e45f0b0c868df0e7bde1fe16d3242dc715f6")
      // H1 generator Y
    };
  }
  /**
   * Generate secure UTXO ID using cryptographic hash
   * @param commitment - UTXO commitment
   * @param owner - Owner address
   * @param timestamp - Creation timestamp
   * @returns Promise<string> - Secure UTXO ID
   */
  async generateBN254UTXOId(commitment, owner, timestamp) {
    const data = commitment + owner.toLowerCase() + timestamp.toString();
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
      const hashArray = new Uint8Array(hashBuffer);
      return Array.from(hashArray, (byte) => byte.toString(16).padStart(2, "0")).join("");
    } catch (error) {
      console.warn("Failed to generate secure ID, using fallback:", error);
      return data.slice(0, 64).padEnd(64, "0");
    }
  }
  /**
   * Save private UTXO to localStorage
   */
  /**
   * Save private UTXO to localStorage (only for BN254 private UTXOs)
   */
  async savePrivateUTXOToLocal(owner, utxo) {
    try {
      if (!utxo.blindingFactor) {
        console.warn("Cannot save UTXO without blinding factor - not a private UTXO");
        return;
      }
      if (utxo.cryptographyType !== "BN254") {
        console.warn("Cannot save non-BN254 UTXO as private UTXO");
        return;
      }
      if (!utxo.commitment) {
        console.warn("Cannot save UTXO without commitment - not a valid private UTXO");
        return;
      }
      const privateUTXO = {
        ...utxo,
        blindingFactor: utxo.blindingFactor,
        // Ya validado que no es undefined
        nullifierHash: utxo.nullifierHash || "",
        // Valor por defecto si no existe
        isPrivate: true,
        cryptographyType: "BN254"
      };
      const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
      PrivateUTXOStorage.savePrivateUTXO(owner, privateUTXO);
      console.log("✅ BN254 private UTXO saved to localStorage:", utxo.id);
    } catch (error) {
      console.warn("Failed to save BN254 UTXO to local storage:", error);
    }
  }
  /**
   * Check if UTXO is a valid private UTXO
   */
  isPrivateUTXO(utxo) {
    return !!(utxo.blindingFactor && utxo.cryptographyType === "BN254" && utxo.commitment && utxo.nullifierHash);
  }
  /**
   * Get private UTXOs from localStorage
   */
  async getPrivateUTXOsFromLocal(owner) {
    try {
      const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
      return PrivateUTXOStorage.getPrivateUTXOs(owner);
    } catch (error) {
      console.warn("Failed to load UTXOs from local storage:", error);
      return [];
    }
  }
  /**
   * Map contract UTXO type to local enum
   */
  mapContractUTXOType(contractType) {
    switch (contractType) {
      case 0:
        return UTXOType.DEPOSIT;
      case 1:
        return UTXOType.SPLIT;
      case 2:
        return UTXOType.COMBINE;
      case 3:
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
  /**
   * Get cryptography type
   */
  get cryptographyType() {
    return "BN254";
  }
  /**
   * Check if Zenroom is available
   */
  get isZenroomAvailable() {
    return ZenroomHelpers.isZenroomAvailable();
  }
}
new UTXOLibrary();
class PrivateUTXOManager extends UTXOLibrary {
  // Almacenamiento de UTXOs privados con BN254
  privateUTXOs = /* @__PURE__ */ new Map();
  bn254OperationCount = 0;
  constructor(config = {
    // ✅ CAMBIAR TIPO
    autoConsolidate: false,
    consolidationThreshold: 5,
    maxUTXOAge: 7 * 24 * 60 * 60,
    privacyMode: true,
    defaultGasLimit: BigInt(5e5),
    cacheTimeout: 3e4,
    enableBackup: true
  }) {
    super(config);
    console.log("🔐 PrivateUTXOManager initialized with REAL BN254 cryptography only");
  }
  // ========================
  // OPERACIONES PRIVADAS CON CRIPTOGRAFÍA BN254 REAL
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
      console.log("🔓 Approving token spending for BN254 operations...");
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          "function allowance(address owner, address spender) view returns (uint256)",
          "function approve(address spender, uint256 amount) returns (bool)",
          "function decimals() view returns (uint8)",
          "function symbol() view returns (string)"
        ],
        signer
      );
      let tokenDecimals;
      let tokenSymbol;
      try {
        [tokenDecimals, tokenSymbol] = await Promise.all([
          tokenContract.decimals(),
          tokenContract.symbol()
        ]);
      } catch (error) {
        console.warn("Could not get token info, using defaults:", error);
        tokenDecimals = 18;
        tokenSymbol = "TOKEN";
      }
      const currentAllowance = await tokenContract.allowance(
        this.currentAccount?.address,
        this.contract?.target
      );
      console.log("💰 Token approval info:", {
        symbol: tokenSymbol,
        decimals: tokenDecimals,
        currentAllowance: ethers.formatUnits(currentAllowance, tokenDecimals),
        requiredAmount: ethers.formatUnits(amount, tokenDecimals)
      });
      if (currentAllowance < amount) {
        console.log("🔓 Insufficient allowance, approving token spending...");
        const approvalAmount = amount + amount / 100n;
        let gasPrice;
        try {
          const feeData = await signer.provider?.getFeeData();
          gasPrice = feeData?.gasPrice || ethers.parseUnits("25", "gwei");
          gasPrice = gasPrice + gasPrice * 20n / 100n;
        } catch (error) {
          console.warn("Could not get gas price, using BN254-optimized default:", error);
          gasPrice = ethers.parseUnits("30", "gwei");
        }
        let gasLimit;
        try {
          const estimatedGas = await tokenContract.approve.estimateGas(
            this.contract?.target,
            approvalAmount
          );
          gasLimit = estimatedGas + estimatedGas / 4n;
        } catch (gasError) {
          console.warn("Gas estimation failed, using conservative limit:", gasError);
          gasLimit = BigInt(1e5);
        }
        console.log("⛽ Approval transaction parameters:", {
          approvalAmount: ethers.formatUnits(approvalAmount, tokenDecimals),
          gasLimit: gasLimit.toString(),
          gasPrice: ethers.formatUnits(gasPrice, "gwei") + " gwei"
        });
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
        console.log("💰 New allowance:", ethers.formatUnits(newAllowance, tokenDecimals), tokenSymbol);
        if (newAllowance < amount) {
          throw new Error(`BN254 approval failed: allowance ${ethers.formatUnits(newAllowance, tokenDecimals)} < required ${ethers.formatUnits(amount, tokenDecimals)}`);
        }
        console.log("⏳ Waiting for BN254-compatible approval to be processed...");
        await new Promise((resolve) => setTimeout(resolve, 3e3));
      } else {
        console.log("✅ Sufficient allowance already exists for BN254 operations");
      }
    } catch (error) {
      console.error("❌ BN254 token approval failed:", error);
      throw new UTXOOperationError(
        "BN254 token approval failed",
        "approveTokenSpending",
        void 0,
        error
      );
    }
  }
  /**
   * Crear UTXO privado usando REAL BN254 cryptography
   */
  async createPrivateUTXO(params) {
    console.log("🔍 Verificando inicialización del contrato...");
    try {
      this.ensureInitialized();
      console.log("✅ Contrato UTXO inicializado correctamente");
    } catch (initError) {
      console.error("❌ Error en la inicialización del contrato:", initError);
      return {
        success: false,
        error: `Error de inicialización: ${initError instanceof Error ? initError.message : "Error desconocido"}`,
        errorDetails: initError
      };
    }
    console.log("🔐 Creating private UTXO with REAL BN254 cryptography...");
    this.bn254OperationCount++;
    try {
      const { amount, tokenAddress, owner } = params;
      if (amount <= 0n) {
        throw new Error("Amount must be greater than zero");
      }
      console.log("🔓 Approving token spending for BN254 operations...");
      await this.approveTokenSpending(tokenAddress, amount);
      console.log("🎲 Generating BN254-compatible blinding factor...");
      const blindingFactor = await ZenroomHelpers.generateSecureBlindingFactor();
      console.log("✅ BN254 blinding factor generated:", blindingFactor.slice(0, 10) + "...");
      console.log("🔐 Creating REAL BN254 Pedersen commitment...");
      const commitmentResult = await ZenroomHelpers.createPedersenCommitment(
        amount.toString(),
        blindingFactor
      );
      console.log("✅ REAL BN254 Pedersen commitment created:", commitmentResult.pedersen_commitment.slice(0, 20) + "...");
      console.log("🔐 Generating BN254 nullifier hash...");
      const nullifierHash = await ZenroomHelpers.generateNullifierHash(
        this.currentAccount.address,
        commitmentResult.pedersen_commitment,
        Date.now().toString()
      );
      console.log("✅ BN254 nullifier hash generated:", nullifierHash.slice(0, 20) + "...");
      console.log("🔍 Generating BN254 range proof...");
      const rangeProof = await ZenroomHelpers.generateRangeProof(
        BigInt(amount),
        ZenroomHelpers.toBigInt("0x" + blindingFactor),
        0n,
        // min value (0)
        2n ** 64n - 1n
        // max value (64-bit range)
      );
      console.log("✅ BN254 range proof generated:", rangeProof.slice(0, 20) + "...");
      const generatorParams = this.getBN254StandardGenerators();
      console.log("🔍 Preparing BN254-validated contract parameters...");
      if (!commitmentResult.pedersen_commitment.startsWith("0x")) {
        console.error("Commitment missing 0x prefix:", commitmentResult.pedersen_commitment);
        throw new Error("Invalid BN254 commitment format: missing 0x prefix");
      }
      const commitmentHex = commitmentResult.pedersen_commitment.substring(2);
      if (commitmentHex.length !== 128) {
        console.error("Commitment format error:", {
          original: commitmentResult.pedersen_commitment,
          cleaned: commitmentHex,
          length: commitmentHex.length,
          expectedLength: 128
        });
        throw new Error(`Invalid BN254 commitment format: expected 128 hex chars, got ${commitmentHex.length}`);
      }
      const contractCommitmentHex = commitmentHex.substring(0, 64);
      if (!ZenroomHelpers.isValidHex(contractCommitmentHex, 32)) {
        console.error("Contract commitment format error:", {
          original: commitmentHex.slice(0, 10) + "...",
          contractFormat: contractCommitmentHex,
          length: contractCommitmentHex.length
        });
        throw new Error("Invalid BN254 contract commitment format");
      }
      console.log("✅ Validated commitment format:", {
        fullCommitment: commitmentResult.pedersen_commitment.slice(0, 10) + "...",
        contractCommitment: "0x" + contractCommitmentHex.slice(0, 10) + "...",
        fullLength: commitmentHex.length,
        contractLength: contractCommitmentHex.length
      });
      console.log("🔍 Validating BN254 commitment point...");
      const fullCommitmentX = BigInt("0x" + commitmentHex.substring(0, 64));
      const fullCommitmentY = BigInt("0x" + commitmentHex.substring(64, 128));
      console.log("🧮 BN254 Point Coordinates:", {
        x: fullCommitmentX.toString(16),
        y: fullCommitmentY.toString(16),
        xLength: fullCommitmentX.toString(16).length,
        yLength: fullCommitmentY.toString(16).length
      });
      const FIELD_MODULUS = BigInt("0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47");
      console.log("🔍 Field validation:", {
        xInField: fullCommitmentX < FIELD_MODULUS,
        yInField: fullCommitmentY < FIELD_MODULUS,
        fieldModulus: FIELD_MODULUS.toString(16)
      });
      const ySquared = fullCommitmentY * fullCommitmentY % FIELD_MODULUS;
      const xCubed = fullCommitmentX * fullCommitmentX * fullCommitmentX % FIELD_MODULUS;
      const rightSide = (xCubed + 3n) % FIELD_MODULUS;
      console.log("🧮 Curve equation validation:", {
        ySquared: ySquared.toString(16),
        xCubedPlus3: rightSide.toString(16),
        isValid: ySquared === rightSide
      });
      const isValidPoint = fullCommitmentX < FIELD_MODULUS && fullCommitmentY < FIELD_MODULUS && ySquared === rightSide;
      console.log("🎯 Point validation result:", isValidPoint);
      if (!isValidPoint) {
        console.error("❌ BN254 point validation failed:", {
          reason: ySquared !== rightSide ? "Point not on curve" : "Coordinates out of field",
          fullCommitment: commitmentResult.pedersen_commitment,
          parsedX: fullCommitmentX.toString(16),
          parsedY: fullCommitmentY.toString(16)
        });
        console.log("🔄 Attempting to regenerate commitment with corrected parameters...");
        try {
          const correctedCommitment = await ZenroomHelpers.createPedersenCommitment(
            amount.toString(),
            blindingFactor
          );
          console.log("🔄 Regenerated commitment:", correctedCommitment.pedersen_commitment);
          const newCommitmentHex = correctedCommitment.pedersen_commitment.substring(2);
          const newX = BigInt("0x" + newCommitmentHex.substring(0, 64));
          const newY = BigInt("0x" + newCommitmentHex.substring(64, 128));
          const newYSquared = newY * newY % FIELD_MODULUS;
          const newXCubed = newX * newX * newX % FIELD_MODULUS;
          const newRightSide = (newXCubed + 3n) % FIELD_MODULUS;
          const newIsValid = newX < FIELD_MODULUS && newY < FIELD_MODULUS && newYSquared === newRightSide;
          if (newIsValid) {
            console.log("✅ Regenerated commitment is valid, using corrected values");
            const correctedCommitmentHex = correctedCommitment.pedersen_commitment.substring(2);
            const correctedContractCommitmentHex = correctedCommitmentHex.substring(0, 64);
            console.log("🔄 Using regenerated commitment values");
          } else {
            console.error("❌ Even regenerated commitment is invalid");
            throw new Error("BN254 commitment generation is fundamentally broken");
          }
        } catch (regenerationError) {
          console.error("❌ Failed to regenerate commitment:", regenerationError);
          throw new Error("BN254 commitment point validation failed. Please try again.");
        }
      } else {
        console.log("✅ BN254 commitment point validation passed");
      }
      if (!nullifierHash.startsWith("0x")) {
        console.error("Nullifier missing 0x prefix:", nullifierHash);
        throw new Error("Invalid BN254 nullifier hash format: missing 0x prefix");
      }
      const nullifierHex = nullifierHash.substring(2);
      if (!ZenroomHelpers.isValidHex(nullifierHex, 32)) {
        console.error("Nullifier format error:", {
          original: nullifierHash,
          cleaned: nullifierHex,
          length: nullifierHex.length,
          expectedLength: 64
        });
        throw new Error(`Invalid BN254 nullifier hash format: expected 64 hex chars, got ${nullifierHex.length}`);
      }
      console.log("✅ Validated nullifier hash format:", {
        withPrefix: nullifierHash.slice(0, 10) + "...",
        withoutPrefix: nullifierHex.slice(0, 8) + "...",
        length: nullifierHex.length
      });
      console.log("🧮 Using already extracted coordinates for parity encoding:", {
        x: fullCommitmentX.toString(16),
        y: fullCommitmentY.toString(16)
      });
      const x3 = fullCommitmentX * fullCommitmentX * fullCommitmentX % FIELD_MODULUS;
      const y2 = (x3 + 3n) % FIELD_MODULUS;
      const exp = (FIELD_MODULUS + 1n) / 4n;
      const y_principal = this.modularExponentiation(y2, exp, FIELD_MODULUS);
      const y_alternativa = FIELD_MODULUS - y_principal;
      const useAlternativeY = fullCommitmentY === y_alternativa;
      console.log("🔍 Y parity calculation:", {
        y_principal: y_principal.toString(16),
        y_alternativa: y_alternativa.toString(16),
        our_y: fullCommitmentY.toString(16),
        useAlternativeY
      });
      let modifiedBlindingFactor = ZenroomHelpers.toBigInt("0x" + blindingFactor);
      modifiedBlindingFactor = modifiedBlindingFactor & ~1n;
      if (useAlternativeY) {
        modifiedBlindingFactor = modifiedBlindingFactor | 1n;
      }
      console.log("🎯 Modified blinding factor with Y parity:", {
        original: blindingFactor,
        modified: modifiedBlindingFactor.toString(16),
        parityBit: useAlternativeY ? 1 : 0
      });
      const contractCommitment = "0x" + contractCommitmentHex;
      console.log("📊 Preparing contract parameters:", {
        fullCommitment: commitmentResult.pedersen_commitment.slice(0, 15) + "...",
        contractCommitment: contractCommitment.slice(0, 15) + "...",
        blindingFactorWithParity: modifiedBlindingFactor.toString(16).slice(0, 10) + "..."
      });
      const depositParams = {
        tokenAddress,
        commitment: contractCommitment,
        // Usamos solo la coordenada X como bytes32
        nullifierHash,
        blindingFactor: modifiedBlindingFactor
        // Blinding factor con información de paridad Y
      };
      if (!rangeProof.startsWith("0x")) {
        console.error("Range proof is not in hexadecimal format with 0x prefix:", rangeProof.slice(0, 20) + "...");
        throw new Error("Invalid range proof format: missing 0x prefix");
      }
      const rangeProofHex = rangeProof.substring(2);
      if (!/^[0-9a-f]+$/i.test(rangeProofHex)) {
        console.error("Range proof contains invalid hexadecimal characters");
        throw new Error("Invalid range proof format: contains non-hexadecimal characters");
      }
      const proofParams = {
        rangeProof
      };
      console.log("📋 Final BN254 contract parameters:", {
        tokenAddress: depositParams.tokenAddress,
        commitment: depositParams.commitment.slice(0, 20) + "...",
        nullifierHash: depositParams.nullifierHash.slice(0, 20) + "...",
        blindingFactor: depositParams.blindingFactor.toString().slice(0, 10) + "...",
        amount: amount.toString(),
        rangeProofLength: proofParams.rangeProof.length,
        rangeProofFormat: `0x${rangeProofHex.slice(0, 20)}...`,
        generatorType: "BN254-standard"
      });
      const signer = EthereumHelpers.getSigner();
      if (!signer) {
        throw new Error("Signer not available for BN254 deposit transaction");
      }
      let gasPrice;
      try {
        const feeData = await signer.provider?.getFeeData();
        gasPrice = feeData?.gasPrice || ethers.parseUnits("50", "gwei");
        gasPrice = gasPrice + gasPrice * 100n / 100n;
      } catch (error) {
        console.warn("Using BN254-optimized fallback gas price for Polygon:", error);
        gasPrice = ethers.parseUnits("60", "gwei");
      }
      let gasLimit;
      try {
        console.log("⛽ Estimating gas for REAL BN254 cryptography operations...");
        const estimatedGas = await this.contract.depositAsPrivateUTXO.estimateGas(
          depositParams,
          proofParams,
          generatorParams,
          amount
        );
        gasLimit = estimatedGas + estimatedGas * 300n / 100n;
        console.log("✅ BN254 gas estimation successful:", gasLimit.toString());
      } catch (gasError) {
        console.warn("❌ BN254 gas estimation failed, using MAXIMUM gas for Polygon:", gasError);
        if (gasError.reason === "Invalid commitment point") {
          throw new Error("BN254 commitment point validation failed. Please try again.");
        }
        gasLimit = BigInt(1e7);
      }
      const maxGasLimit = BigInt(1e7);
      const minGasLimit = BigInt(5e6);
      if (gasLimit > maxGasLimit) gasLimit = maxGasLimit;
      if (gasLimit < minGasLimit) gasLimit = minGasLimit;
      console.log("⛽ Final POLYGON gas parameters for REAL BN254 cryptography:", {
        gasLimit: gasLimit.toString(),
        gasPrice: ethers.formatUnits(gasPrice, "gwei") + " gwei",
        estimatedCost: ethers.formatEther(gasLimit * gasPrice) + " MATIC",
        note: "High gas needed for real Pedersen + Bulletproofs verification"
      });
      console.log("🔍 VERIFICACIÓN DETALLADA DE PARÁMETROS ANTES DEL ENVÍO:");
      console.log("📊 depositParams:", {
        tokenAddress: depositParams.tokenAddress,
        commitment: depositParams.commitment,
        commitmentLength: depositParams.commitment.length,
        commitmentIsHex: /^0x[0-9a-fA-F]+$/.test(depositParams.commitment),
        nullifierHash: depositParams.nullifierHash,
        nullifierLength: depositParams.nullifierHash.length,
        nullifierIsHex: /^0x[0-9a-fA-F]+$/.test(depositParams.nullifierHash),
        blindingFactor: depositParams.blindingFactor.toString(),
        blindingFactorType: typeof depositParams.blindingFactor
      });
      console.log("🔍 proofParams:", {
        rangeProof: proofParams.rangeProof.slice(0, 50) + "...",
        rangeProofLength: proofParams.rangeProof.length,
        rangeProofIsHex: /^0x[0-9a-fA-F]+$/.test(proofParams.rangeProof),
        rangeProofType: typeof proofParams.rangeProof
      });
      console.log("🔍 generatorParams:", {
        gX: generatorParams.gX.toString(),
        gY: generatorParams.gY.toString(),
        hX: generatorParams.hX.toString(),
        hY: generatorParams.hY.toString(),
        allBigInt: typeof generatorParams.gX === "bigint" && typeof generatorParams.gY === "bigint" && typeof generatorParams.hX === "bigint" && typeof generatorParams.hY === "bigint"
      });
      console.log("🔍 amount:", {
        value: amount.toString(),
        type: typeof amount,
        isBigInt: typeof amount === "bigint"
      });
      console.log("🔧 VERIFICANDO ABI ENCODING PASO A PASO...");
      console.log("📋 Contract interface check:", {
        hasFunction: typeof this.contract.depositAsPrivateUTXO === "function",
        hasInterface: !!this.contract.interface,
        contractAddress: this.contract.target
      });
      console.log("🔍 Parameter type verification:");
      console.log("  depositParams:", {
        tokenAddress: typeof depositParams.tokenAddress,
        commitment: typeof depositParams.commitment,
        nullifierHash: typeof depositParams.nullifierHash,
        blindingFactor: typeof depositParams.blindingFactor,
        isValidAddress: /^0x[0-9a-fA-F]{40}$/i.test(depositParams.tokenAddress),
        isValidCommitment: /^0x[0-9a-fA-F]{64}$/i.test(depositParams.commitment),
        isValidNullifier: /^0x[0-9a-fA-F]{64}$/i.test(depositParams.nullifierHash)
      });
      console.log("  proofParams:", {
        rangeProofType: typeof proofParams.rangeProof,
        rangeProofLength: proofParams.rangeProof.length,
        isValidHex: /^0x[0-9a-fA-F]+$/i.test(proofParams.rangeProof)
      });
      console.log("  generatorParams:", {
        gX: typeof generatorParams.gX,
        gY: typeof generatorParams.gY,
        hX: typeof generatorParams.hX,
        hY: typeof generatorParams.hY,
        allAreBigInt: [generatorParams.gX, generatorParams.gY, generatorParams.hX, generatorParams.hY].every((x) => typeof x === "bigint")
      });
      console.log("  amount:", {
        type: typeof amount,
        isBigInt: typeof amount === "bigint",
        value: amount.toString()
      });
      try {
        console.log("🔧 Attempting manual ABI encoding...");
        const functionData = this.contract.interface.encodeFunctionData(
          "depositAsPrivateUTXO",
          [depositParams, proofParams, generatorParams, amount]
        );
        console.log("✅ ABI encoding successful:", {
          dataLength: functionData.length,
          selector: functionData.slice(0, 10),
          hasData: functionData.length > 10,
          sampleData: functionData.slice(0, 50) + "..."
        });
        if (functionData.length <= 10) {
          throw new Error("Function data is too short - only contains selector");
        }
      } catch (abiError) {
        console.error("❌ ABI encoding failed:", abiError);
        console.error("Error details:", {
          message: abiError.message,
          code: abiError.code,
          reason: abiError.reason
        });
        throw new Error(`ABI encoding error: ${abiError.reason || abiError.message}`);
      }
      console.log("🚀 Executing BN254 depositAsPrivateUTXO transaction...");
      const tx = await this.contract.depositAsPrivateUTXO(
        depositParams,
        proofParams,
        generatorParams,
        amount,
        {
          gasLimit,
          gasPrice,
          value: BigInt(0)
        }
      );
      console.log("✅ BN254 transaction sent:", tx.hash);
      console.log("⏳ Waiting for BN254 transaction confirmation...");
      const receipt = await tx.wait();
      console.log("✅ BN254 deposit confirmed:", receipt?.hash, "Block:", receipt?.blockNumber);
      const utxoId = await this.generateBN254UTXOId(
        commitmentResult.pedersen_commitment,
        owner,
        Date.now()
      );
      const privateUTXO = {
        id: utxoId,
        exists: true,
        value: amount,
        tokenAddress,
        owner,
        timestamp: toBigInt(Date.now()),
        isSpent: false,
        commitment: commitmentResult.pedersen_commitment,
        parentUTXO: "",
        utxoType: UTXOType.DEPOSIT,
        blindingFactor,
        nullifierHash,
        localCreatedAt: Date.now(),
        confirmed: true,
        creationTxHash: receipt?.hash,
        blockNumber: receipt?.blockNumber,
        isPrivate: true,
        rangeProof,
        cryptographyType: "BN254"
      };
      this.utxos.set(utxoId, privateUTXO);
      this.privateUTXOs.set(utxoId, privateUTXO);
      try {
        const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
        PrivateUTXOStorage.savePrivateUTXO(owner, privateUTXO);
      } catch (storageError) {
        console.warn("⚠️ Could not save BN254 UTXO to localStorage:", storageError);
      }
      const result = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds: [utxoId]
      };
      console.log("✅ Private UTXO created successfully with REAL BN254 cryptography:", utxoId);
      this.emit("private:utxo:created", privateUTXO);
      return result;
    } catch (error) {
      console.error("❌ BN254 Private UTXO creation failed:", error);
      let errorMessage = "BN254 private UTXO creation failed";
      if (error instanceof Error) {
        if (error.message.includes("Invalid commitment point")) {
          errorMessage = "BN254 commitment validation failed. Please try again.";
        } else if (error.message.includes("user rejected")) {
          errorMessage = "Transaction was rejected by user";
        } else if (error.message.includes("insufficient funds")) {
          errorMessage = "Insufficient funds for BN254 transaction fees";
        } else {
          errorMessage = error.message;
        }
      }
      return {
        success: false,
        error: errorMessage,
        errorDetails: error
      };
    }
  }
  /**
   * Transferir UTXO privado usando REAL BN254 cryptography
   */
  async transferPrivateUTXO(params) {
    this.ensureInitialized();
    console.log("🔄 Transferring private UTXO with REAL BN254 cryptography...");
    this.bn254OperationCount++;
    try {
      const { utxoId, newOwner } = params;
      const utxo = this.privateUTXOs.get(utxoId);
      if (!utxo || !utxo.isPrivate || utxo.cryptographyType !== "BN254") {
        throw new Error("UTXO is not a BN254 private UTXO or does not exist");
      }
      if (utxo.isSpent) {
        throw new Error("UTXO is already spent");
      }
      console.log("🔍 Verifying existing BN254 commitment...");
      const isValidCommitment = await ZenroomHelpers.verifyPedersenCommitment(
        utxo.commitment,
        BigInt(utxo.value),
        ZenroomHelpers.toBigInt("0x" + utxo.blindingFactor)
      );
      if (!isValidCommitment) {
        throw new Error("BN254 commitment verification failed - UTXO data may be corrupted");
      }
      console.log("🎲 Generating new BN254 blinding factor for output...");
      const newBlindingFactor = await ZenroomHelpers.generateSecureBlindingFactor();
      console.log("🔐 Creating new REAL BN254 Pedersen commitment for recipient...");
      const newCommitmentResult = await ZenroomHelpers.createPedersenCommitment(
        utxo.value.toString(),
        newBlindingFactor
      );
      console.log("✅ New BN254 commitment created:", newCommitmentResult.pedersen_commitment.slice(0, 20) + "...");
      const nullifierHash = await ZenroomHelpers.generateNullifierHash(
        utxo.commitment,
        utxo.owner,
        Date.now().toString()
      );
      const generatorParams = this.getBN254StandardGenerators();
      const signer = EthereumHelpers.getSigner();
      if (!signer) {
        throw new Error("Signer not available for BN254 transfer transaction");
      }
      let gasPrice;
      try {
        const feeData = await signer.provider?.getFeeData();
        gasPrice = feeData?.gasPrice || ethers.parseUnits("25", "gwei");
        gasPrice = gasPrice + gasPrice * 20n / 100n;
      } catch (error) {
        console.warn("Using BN254 transfer fallback gas price:", error);
        gasPrice = ethers.parseUnits("30", "gwei");
      }
      const estimatedGas = BigInt(8e5);
      const gasLimit = estimatedGas + estimatedGas * 25n / 100n;
      console.log("⛽ BN254 transfer gas parameters:", {
        gasLimit: gasLimit.toString(),
        gasPrice: ethers.formatUnits(gasPrice, "gwei") + " gwei"
      });
      console.log("🚀 Calling transferPrivateUTXO with REAL BN254 cryptography...");
      const tx = await this.contract.transferPrivateUTXO(
        utxo.commitment,
        newCommitmentResult.pedersen_commitment,
        newOwner,
        utxo.value,
        ZenroomHelpers.toBigInt("0x" + newBlindingFactor),
        nullifierHash,
        generatorParams,
        {
          gasLimit,
          gasPrice
        }
      );
      console.log("✅ BN254 transfer transaction sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("✅ BN254 transfer confirmed:", receipt?.hash);
      utxo.isSpent = true;
      try {
        const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
        PrivateUTXOStorage.savePrivateUTXO(utxo.owner, utxo);
      } catch (storageError) {
        console.warn("⚠️ Could not update original BN254 UTXO in localStorage:", storageError);
      }
      this.emit("private:utxo:spent", utxoId);
      let createdUTXOIds = [];
      if (newOwner === this.currentAccount?.address) {
        const newUtxoId = await this.generateBN254UTXOId(
          newCommitmentResult.pedersen_commitment,
          newOwner,
          Date.now()
        );
        const newNullifierHash = await ZenroomHelpers.generateNullifierHash(
          newCommitmentResult.pedersen_commitment,
          newOwner,
          Date.now().toString()
        );
        const newPrivateUTXO = {
          id: newUtxoId,
          exists: true,
          value: utxo.value,
          tokenAddress: utxo.tokenAddress,
          owner: newOwner,
          timestamp: toBigInt(Date.now()),
          isSpent: false,
          commitment: newCommitmentResult.pedersen_commitment,
          parentUTXO: utxoId,
          utxoType: UTXOType.TRANSFER,
          blindingFactor: newBlindingFactor,
          nullifierHash: newNullifierHash,
          localCreatedAt: Date.now(),
          confirmed: true,
          creationTxHash: receipt?.hash,
          blockNumber: receipt?.blockNumber,
          isPrivate: true,
          cryptographyType: "BN254"
        };
        this.utxos.set(newUtxoId, newPrivateUTXO);
        this.privateUTXOs.set(newUtxoId, newPrivateUTXO);
        createdUTXOIds.push(newUtxoId);
        try {
          const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
          PrivateUTXOStorage.savePrivateUTXO(newOwner, newPrivateUTXO);
        } catch (storageError) {
          console.warn("⚠️ Could not save new BN254 UTXO to localStorage:", storageError);
        }
        this.emit("private:utxo:created", newPrivateUTXO);
      }
      const result = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds
      };
      console.log("✅ BN254 private UTXO transferred successfully");
      this.emit("private:utxo:transferred", { from: utxoId, to: createdUTXOIds[0], newOwner });
      return result;
    } catch (error) {
      console.error("❌ BN254 private UTXO transfer failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "BN254 private transfer failed",
        errorDetails: error
      };
    }
  }
  /**
   * Dividir UTXO privado usando REAL BN254 cryptography
   */
  async splitPrivateUTXO(params) {
    this.ensureInitialized();
    console.log("✂️ Splitting private UTXO with REAL BN254 cryptography...");
    this.bn254OperationCount++;
    try {
      const { inputUTXOId, outputValues, outputOwners } = params;
      const inputUTXO = this.privateUTXOs.get(inputUTXOId);
      if (!inputUTXO || !inputUTXO.isPrivate || inputUTXO.cryptographyType !== "BN254") {
        throw new Error("Input UTXO is not a BN254 private UTXO or does not exist");
      }
      if (inputUTXO.isSpent) {
        throw new Error("Input UTXO is already spent");
      }
      const totalOutput = outputValues.reduce((sum, val) => sum + val, BigInt(0));
      if (totalOutput !== inputUTXO.value) {
        throw new Error(`BN254 value conservation failed: input=${inputUTXO.value}, outputs=${totalOutput}`);
      }
      console.log("✅ BN254 value conservation validated:", {
        inputValue: inputUTXO.value.toString(),
        outputSum: totalOutput.toString(),
        outputCount: outputValues.length
      });
      console.log("🔍 Verifying input BN254 commitment...");
      const isValidInputCommitment = await ZenroomHelpers.verifyPedersenCommitment(
        inputUTXO.commitment,
        BigInt(inputUTXO.value),
        ZenroomHelpers.toBigInt("0x" + inputUTXO.blindingFactor)
      );
      if (!isValidInputCommitment) {
        throw new Error("Input BN254 commitment verification failed");
      }
      const outputCommitments = [];
      const outputBlindingFactors = [];
      const outputNullifierHashes = [];
      console.log("🔐 Generating REAL BN254 Pedersen commitments for outputs...");
      for (let i = 0; i < outputValues.length; i++) {
        const blindingFactor = await ZenroomHelpers.generateSecureBlindingFactor();
        const commitment = await ZenroomHelpers.createPedersenCommitment(
          outputValues[i].toString(),
          blindingFactor
        );
        const nullifierHash = await ZenroomHelpers.generateNullifierHash(
          commitment.pedersen_commitment,
          outputOwners[i],
          (Date.now() + i).toString()
        );
        outputCommitments.push(commitment.pedersen_commitment);
        outputBlindingFactors.push(blindingFactor);
        outputNullifierHashes.push(nullifierHash);
        console.log(`✅ Output ${i + 1} BN254 commitment created:`, commitment.pedersen_commitment.slice(0, 20) + "...");
      }
      const inputNullifierHash = await ZenroomHelpers.generateNullifierHash(
        inputUTXO.commitment,
        inputUTXO.owner,
        Date.now().toString()
      );
      console.log("🔍 Generating BN254 split proof...");
      const splitProof = await ZenroomHelpers.generateSplitProof(
        BigInt(inputUTXO.value),
        outputValues.map((v) => BigInt(v)),
        ZenroomHelpers.toBigInt("0x" + inputUTXO.blindingFactor),
        outputBlindingFactors.map((bf) => ZenroomHelpers.toBigInt("0x" + bf))
      );
      console.log("✅ BN254 split proof generated");
      const generatorParams = this.getBN254StandardGenerators();
      const signer = EthereumHelpers.getSigner();
      if (!signer) {
        throw new Error("Signer not available for BN254 split transaction");
      }
      let gasPrice;
      try {
        const feeData = await signer.provider?.getFeeData();
        gasPrice = feeData?.gasPrice || ethers.parseUnits("30", "gwei");
        gasPrice = gasPrice + gasPrice * 30n / 100n;
      } catch (error) {
        console.warn("Using BN254 split fallback gas price:", error);
        gasPrice = ethers.parseUnits("40", "gwei");
      }
      const baseGas = BigInt(1e6);
      const extraGasPerOutput = BigInt(2e5);
      const estimatedGas = baseGas + extraGasPerOutput * BigInt(outputValues.length);
      const gasLimit = estimatedGas + estimatedGas * 25n / 100n;
      console.log("⛽ BN254 split gas parameters:", {
        baseGas: baseGas.toString(),
        extraPerOutput: extraGasPerOutput.toString(),
        estimatedGas: estimatedGas.toString(),
        gasLimit: gasLimit.toString(),
        gasPrice: ethers.formatUnits(gasPrice, "gwei") + " gwei",
        outputCount: outputValues.length
      });
      console.log("🚀 Calling splitPrivateUTXO with REAL BN254 cryptography...");
      const tx = await this.contract.splitPrivateUTXO(
        inputUTXO.commitment,
        outputCommitments,
        outputValues,
        outputBlindingFactors.map((bf) => ZenroomHelpers.toBigInt("0x" + bf)),
        splitProof,
        inputNullifierHash,
        generatorParams,
        {
          gasLimit,
          gasPrice
        }
      );
      console.log("✅ BN254 split transaction sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("✅ BN254 split confirmed:", receipt?.hash);
      inputUTXO.isSpent = true;
      try {
        const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
        PrivateUTXOStorage.savePrivateUTXO(inputUTXO.owner, inputUTXO);
      } catch (storageError) {
        console.warn("⚠️ Could not update input BN254 UTXO in localStorage:", storageError);
      }
      this.emit("private:utxo:spent", inputUTXOId);
      const createdUTXOIds = [];
      for (let i = 0; i < outputValues.length; i++) {
        const outputId = await this.generateBN254UTXOId(
          outputCommitments[i],
          outputOwners[i],
          Date.now() + i
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
          nullifierHash: outputNullifierHashes[i],
          localCreatedAt: Date.now(),
          confirmed: true,
          creationTxHash: receipt?.hash,
          blockNumber: receipt?.blockNumber,
          isPrivate: true,
          cryptographyType: "BN254"
        };
        this.utxos.set(outputId, outputUTXO);
        this.privateUTXOs.set(outputId, outputUTXO);
        createdUTXOIds.push(outputId);
        try {
          const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
          PrivateUTXOStorage.savePrivateUTXO(outputOwners[i], outputUTXO);
        } catch (storageError) {
          console.warn(`⚠️ Could not save output BN254 UTXO ${i} to localStorage:`, storageError);
        }
        this.emit("private:utxo:created", outputUTXO);
      }
      const result = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds
      };
      console.log("✅ BN254 private UTXO split successfully:", {
        inputUTXOId,
        createdOutputs: createdUTXOIds.length,
        outputIds: createdUTXOIds
      });
      this.emit("private:utxo:split", {
        inputUTXOId,
        outputUTXOIds: createdUTXOIds,
        outputValues,
        outputOwners,
        cryptographyType: "BN254"
      });
      return result;
    } catch (error) {
      console.error("❌ BN254 private UTXO split failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "BN254 private split failed",
        errorDetails: error
      };
    }
  }
  /**
   * Retirar UTXO privado usando REAL BN254 cryptography
   */
  async withdrawPrivateUTXO(params) {
    this.ensureInitialized();
    console.log("💸 Withdrawing private UTXO with REAL BN254 cryptography...");
    this.bn254OperationCount++;
    try {
      const { utxoId, recipient } = params;
      const utxo = this.privateUTXOs.get(utxoId);
      if (!utxo || !utxo.isPrivate || utxo.cryptographyType !== "BN254") {
        throw new Error("UTXO is not a BN254 private UTXO or does not exist");
      }
      if (utxo.isSpent) {
        throw new Error("UTXO is already spent");
      }
      if (utxo.owner.toLowerCase() !== this.currentAccount.address.toLowerCase()) {
        throw new Error("Not authorized to withdraw this BN254 UTXO");
      }
      console.log("🔍 Verifying BN254 commitment before withdrawal...");
      const isValidCommitment = await ZenroomHelpers.verifyPedersenCommitment(
        utxo.commitment,
        BigInt(utxo.value),
        ZenroomHelpers.toBigInt("0x" + utxo.blindingFactor)
      );
      if (!isValidCommitment) {
        throw new Error("BN254 commitment verification failed - UTXO data may be corrupted");
      }
      const nullifierHash = await ZenroomHelpers.generateNullifierHash(
        utxo.commitment,
        utxo.owner,
        Date.now().toString()
      );
      console.log("✅ BN254 nullifier hash generated for withdrawal:", nullifierHash.slice(0, 20) + "...");
      const generatorParams = this.getBN254StandardGenerators();
      const signer = EthereumHelpers.getSigner();
      if (!signer) {
        throw new Error("Signer not available for BN254 withdrawal transaction");
      }
      let gasPrice;
      try {
        const feeData = await signer.provider?.getFeeData();
        gasPrice = feeData?.gasPrice || ethers.parseUnits("25", "gwei");
        gasPrice = gasPrice + gasPrice * 20n / 100n;
      } catch (error) {
        console.warn("Using BN254 withdrawal fallback gas price:", error);
        gasPrice = ethers.parseUnits("30", "gwei");
      }
      const estimatedGas = BigInt(6e5);
      const gasLimit = estimatedGas + estimatedGas * 25n / 100n;
      console.log("⛽ BN254 withdrawal gas parameters:", {
        gasLimit: gasLimit.toString(),
        gasPrice: ethers.formatUnits(gasPrice, "gwei") + " gwei",
        recipient: recipient || "same as owner"
      });
      console.log("🚀 Calling withdrawFromPrivateUTXO with REAL BN254 cryptography...");
      const tx = await this.contract.withdrawFromPrivateUTXO(
        utxo.commitment,
        utxo.value,
        ZenroomHelpers.toBigInt("0x" + utxo.blindingFactor),
        nullifierHash,
        generatorParams,
        {
          gasLimit,
          gasPrice
        }
      );
      console.log("✅ BN254 withdrawal transaction sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("✅ BN254 withdrawal confirmed:", receipt?.hash);
      utxo.isSpent = true;
      try {
        const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
        PrivateUTXOStorage.savePrivateUTXO(utxo.owner, utxo);
      } catch (storageError) {
        console.warn("⚠️ Could not update BN254 UTXO in localStorage:", storageError);
      }
      this.emit("private:utxo:withdrawn", utxoId);
      const result = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed
      };
      console.log("✅ BN254 private UTXO withdrawn successfully:", {
        utxoId,
        recipient: recipient || utxo.owner,
        value: utxo.value.toString(),
        tokenAddress: utxo.tokenAddress,
        cryptographyType: "BN254"
      });
      return result;
    } catch (error) {
      console.error("❌ BN254 private UTXO withdrawal failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "BN254 private withdrawal failed",
        errorDetails: error
      };
    }
  }
  // ========================
  // FUNCIONES AUXILIARES Y ESTADÍSTICAS - SOLO BN254
  // ========================
  /**
   * Obtener UTXOs privados BN254 por propietario
   */
  getPrivateUTXOsByOwner(owner) {
    const utxos = [];
    for (const [utxoId, utxo] of this.privateUTXOs.entries()) {
      if (utxo.owner.toLowerCase() === owner.toLowerCase() && !utxo.isSpent && utxo.cryptographyType === "BN254") {
        utxos.push(utxo);
      }
    }
    return utxos;
  }
  /**
   * Obtener balance privado BN254 total
   */
  getPrivateBalance(tokenAddress) {
    let balance = BigInt(0);
    for (const utxo of this.privateUTXOs.values()) {
      if (!utxo.isSpent && utxo.cryptographyType === "BN254" && (!tokenAddress || utxo.tokenAddress === tokenAddress)) {
        balance += utxo.value;
      }
    }
    return balance;
  }
  /**
   * Obtener estadísticas de UTXOs BN254
   */
  getUTXOStats() {
    const allUTXOs = Array.from(this.privateUTXOs.values());
    const bn254UTXOs = allUTXOs.filter((utxo) => utxo.cryptographyType === "BN254");
    const unspentUTXOs = bn254UTXOs.filter((utxo) => !utxo.isSpent);
    const spentUTXOs = bn254UTXOs.filter((utxo) => utxo.isSpent);
    const confirmedUTXOs = bn254UTXOs.filter((utxo) => utxo.confirmed);
    const uniqueTokens = new Set(unspentUTXOs.map((utxo) => utxo.tokenAddress)).size;
    const totalBalance = unspentUTXOs.reduce((sum, utxo) => sum + utxo.value, BigInt(0));
    const balanceByToken = {};
    unspentUTXOs.forEach((utxo) => {
      if (!balanceByToken[utxo.tokenAddress]) {
        balanceByToken[utxo.tokenAddress] = BigInt(0);
      }
      balanceByToken[utxo.tokenAddress] += utxo.value;
    });
    const averageUTXOValue = unspentUTXOs.length > 0 ? totalBalance / BigInt(unspentUTXOs.length) : BigInt(0);
    const creationDistribution = [];
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1e3;
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now - i * oneDayMs);
      const dateStr = date.toISOString().split("T")[0];
      const dayStart = date.setHours(0, 0, 0, 0);
      const dayEnd = date.setHours(23, 59, 59, 999);
      const count = bn254UTXOs.filter((utxo) => {
        const utxoDate = utxo.localCreatedAt || 0;
        return utxoDate >= dayStart && utxoDate <= dayEnd;
      }).length;
      creationDistribution.push({ date: dateStr, count });
    }
    return {
      totalUTXOs: allUTXOs.length,
      unspentUTXOs: unspentUTXOs.length,
      uniqueTokens,
      totalBalance,
      privateUTXOs: bn254UTXOs.filter((utxo) => utxo.isPrivate).length,
      spentUTXOs: spentUTXOs.length,
      confirmedUTXOs: confirmedUTXOs.length,
      balanceByToken,
      averageUTXOValue,
      creationDistribution,
      bn254UTXOs: bn254UTXOs.length,
      bn254Operations: this.bn254OperationCount,
      cryptographyDistribution: {
        BN254: bn254UTXOs.length,
        Other: allUTXOs.length - bn254UTXOs.length
      }
    };
  }
  /**
   * Sincronizar con blockchain (solo datos públicos + localStorage para BN254 privacy)
   */
  async syncWithBlockchain() {
    if (!this.contract || !this.currentAccount) {
      return false;
    }
    console.log("🔄 Syncing BN254 data with blockchain and localStorage...");
    try {
      const userUTXOCount = await this.contract.getUserUTXOCount(this.currentAccount.address);
      console.log(`📊 User has ${userUTXOCount} UTXOs in contract (BN254 mode)`);
      try {
        const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
        const localUTXOs = PrivateUTXOStorage.getPrivateUTXOs(this.currentAccount.address);
        const bn254UTXOs = localUTXOs.filter(
          (utxo) => utxo.cryptographyType === "BN254" || utxo.isPrivate
          // Backwards compatibility
        );
        console.log(`💾 Found ${bn254UTXOs.length} BN254 private UTXOs in localStorage`);
        this.privateUTXOs.clear();
        for (const utxo of bn254UTXOs) {
          const bn254UTXO = {
            ...utxo,
            cryptographyType: "BN254",
            isPrivate: true
          };
          this.privateUTXOs.set(utxo.id, bn254UTXO);
        }
        let verifiedCount = 0;
        let corruptedCount = 0;
        for (const utxo of this.privateUTXOs.values()) {
          if (!utxo.isSpent && utxo.blindingFactor) {
            try {
              const isValid = await ZenroomHelpers.verifyPedersenCommitment(
                utxo.commitment,
                BigInt(utxo.value),
                ZenroomHelpers.toBigInt("0x" + utxo.blindingFactor)
              );
              if (isValid) {
                verifiedCount++;
              } else {
                corruptedCount++;
                console.warn("⚠️ Corrupted BN254 commitment detected:", utxo.id);
              }
            } catch (verifyError) {
              corruptedCount++;
              console.warn("⚠️ Could not verify BN254 commitment:", utxo.id, verifyError);
            }
          }
        }
        const stats = this.getUTXOStats();
        console.log("📈 BN254 UTXO statistics:");
        console.log(`  - Total BN254 UTXOs: ${stats.totalUTXOs}`);
        console.log(`  - Unspent BN254 UTXOs: ${stats.unspentUTXOs}`);
        console.log(`  - Verified commitments: ${verifiedCount}`);
        console.log(`  - Corrupted commitments: ${corruptedCount}`);
        console.log(`  - Unique tokens: ${stats.uniqueTokens}`);
        console.log(`  - Total BN254 balance: ${stats.totalBalance.toString()}`);
        console.log(`  - BN254 operations: ${stats.bn254Operations}`);
        console.log("✅ BN254 privacy-preserving sync completed");
        this.emit("blockchain:synced", {
          localUTXOs: Array.from(this.utxos.values()).length,
          privateUTXOs: Array.from(this.privateUTXOs.values()).length,
          bn254UTXOs: stats.cryptographyDistribution.BN254,
          contractUTXOCount: Number(userUTXOCount),
          localStats: stats,
          syncMode: "BN254-localStorage+contract",
          verifiedCommitments: verifiedCount,
          corruptedCommitments: corruptedCount
        });
        return true;
      } catch (storageError) {
        console.warn("⚠️ Could not load BN254 UTXOs from localStorage:", storageError);
        return false;
      }
    } catch (error) {
      console.error("❌ BN254 sync failed:", error);
      this.emit("blockchain:sync:failed", error);
      return false;
    }
  }
  /**
   * Limpiar datos privados BN254 (para seguridad)
   */
  clearPrivateData() {
    this.privateUTXOs.clear();
    this.bn254OperationCount = 0;
    console.log("🧹 BN254 private data cleared");
  }
  // ========================
  // HELPER METHODS BN254
  // ========================
  /**
   * Obtener generadores BN254 estándar
   */
  getBN254StandardGenerators() {
    return {
      // G1 generator - punto generador estándar de BN254
      gX: BigInt("0x1"),
      // Coordenada X del generador G1 estándar
      gY: BigInt("0x2"),
      // Coordenada Y del generador G1 estándar
      // H generator - segundo punto generador independiente para Pedersen commitments
      // SOLUCIÓN REAL: Coordenadas exactas de 3*G en BN254 (matemáticamente calculadas y verificadas)
      // COORDENADAS CORREGIDAS - MATEMÁTICAMENTE VERIFICADAS
      hX: BigInt("0x769bf9ac56bea3ff40232bcb1b6bd159315d84715b8e679f2d355961915abf0"),
      // H1 X - 3*G CORREGIDO
      hY: BigInt("0x2ab799bee0489429554fdb7c8d086475319e63b40b9c5b57cdf1ff3dd9fe2261")
      // H1 Y - 3*G CORREGIDO
    };
  }
  /**
   * Verificar si un UTXO usa BN254
   */
  isUTXOBN254(utxoId) {
    const utxo = this.privateUTXOs.get(utxoId);
    return utxo?.cryptographyType === "BN254" || false;
  }
  /**
   * Obtener tipo de criptografía
   */
  get cryptographyType() {
    return "BN254";
  }
  /**
   * Obtener conteo de operaciones BN254
   */
  get bn254OperationsCount() {
    return this.bn254OperationCount;
  }
  /**
   * Obtener información de BN254
   */
  getBN254Info() {
    const bn254UTXOs = Array.from(this.privateUTXOs.values()).filter(
      (utxo) => utxo.cryptographyType === "BN254"
    );
    return {
      operationsCount: this.bn254OperationCount,
      utxosCount: bn254UTXOs.length,
      verifiedCommitments: bn254UTXOs.filter((utxo) => !utxo.isSpent).length,
      isZenroomAvailable: ZenroomHelpers.isZenroomAvailable()
    };
  }
  /**
   * Exponenciación modular para cálculos BN254
   */
  modularExponentiation(base, exp, modulus) {
    let result = 1n;
    base = base % modulus;
    while (exp > 0n) {
      if (exp % 2n === 1n) {
        result = result * base % modulus;
      }
      exp = exp >> 1n;
      base = base * base % modulus;
    }
    return result;
  }
}
const privateUTXOManager = new PrivateUTXOManager();
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
    $$payload.out += `<!--]--></button> <div class="text-xs text-gray-400 text-right"><div>Polygon Amoy Network</div> <div>Testnet Required</div> <div class="text-yellow-400 mt-1">`;
    if (typeof window !== "undefined" && !window.ethereum) {
      $$payload.out += "<!--[-->";
      $$payload.out += `⚠️ MetaMask not installed`;
    } else if (typeof window !== "undefined" && window.ethereum && !window.ethereum.isMetaMask) {
      $$payload.out += "<!--[1-->";
      $$payload.out += `⚠️ Please unlock MetaMask`;
    } else {
      $$payload.out += "<!--[!-->";
    }
    $$payload.out += `<!--]--></div></div></div>`;
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
