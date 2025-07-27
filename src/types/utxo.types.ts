/**
 * @fileoverview TypeScript type definitions for UTXO system
 * @description Types for hybrid EOA + Zenroom + Smart Contract UTXO implementation
 */

/**
 * Supported cryptography types
 */
export type CryptographyType = 'BN254' | 'secp256k1' | 'Other';

/**
 * Core UTXO data structure (matches smart contract)
 */
export interface PrivateUTXO extends ExtendedUTXOData {
  // ===========================
  // CAMPOS REQUERIDOS PARA PRIVATE UTXOs
  // ===========================
  
  /** Blinding factor for commitment (requerido, no opcional) */
  blindingFactor: string;
  
  /** Nullifier hash para prevenir double-spending (requerido) */
  nullifierHash: string;
  
  /** Siempre true para PrivateUTXO */
  isPrivate: true;
  
  /** Cryptography type: 'secp256k1' for current implementation, 'BN254' for legacy compatibility */
  cryptographyType: 'BN254' | 'secp256k1';
  
  // ===========================
  // CAMPOS OPCIONALES PARA DIFERENTES TIPOS DE CRYPTOGRAFÍA
  // ===========================
  
  /** Range proof (Bulletproof format) - opcional */
  rangeProof?: string;
}

/**
 * UTXO creation types
 */
export enum UTXOType {
  DEPOSIT = 'DEPOSIT',
  SPLIT = 'SPLIT',
  COMBINE = 'COMBINE',
  TRANSFER = 'TRANSFER'
}

/**
 * Core UTXO data structure (matches smart contract PrivateUTXO struct)
 */
export interface UTXOData {
  /** Unique UTXO identifier */
  id: string;
  /** Whether UTXO exists on-chain */
  exists: boolean;
  /** Value in wei or token units */
  value: bigint;
  /** ERC20 token address */
  tokenAddress: string;
  /** Owner's address */
  owner: string;
  /** Creation timestamp */
  timestamp: bigint;
  /** Whether UTXO is spent */
  isSpent: boolean;
  
  // ===========================
  // COMMITMENT FIELDS
  // ===========================
  
  /** Pedersen commitment (required for private UTXOs) */
  commitment: string;
  /** Parent UTXO ID (for splits/combines) */
  parentUTXO: string;
  /** Type of UTXO operation */
  utxoType: UTXOType;
}

/**
 * Configuration for UTXO manager
 */
export interface UTXOManagerConfig {
  /** Auto-consolidate small UTXOs */
  autoConsolidate: boolean;
  /** Threshold for auto-consolidation (number of UTXOs) */
  consolidationThreshold: number;
  /** Maximum UTXO age in seconds before considered for consolidation */
  maxUTXOAge: number;
  /** Enable privacy mode for all operations */
  privacyMode: boolean;
  /** Default gas limit for transactions */
  defaultGasLimit: bigint;
  /** Cache timeout in milliseconds */
  cacheTimeout: number;
  /** Enable automatic backup of private UTXOs to localStorage */
  enableBackup: boolean;
}
/**
 * Enhanced UTXO with local metadata
 */
export interface ExtendedUTXOData extends UTXOData {
  /** Blinding factor for commitment (keep secret) - opcional en ExtendedUTXOData */
  blindingFactor?: string;
  
  /** Local creation timestamp */
  localCreatedAt: number;
  
  /** Whether this UTXO is confirmed on-chain */
  confirmed: boolean;
  
  /** Transaction hash where this UTXO was created */
  creationTxHash?: string;
  
  /** Block number where confirmed */
  blockNumber?: number;
  
  /** Local tags for organization */
  tags?: string[];
  
  /** Notes about this UTXO */
  notes?: string;
  
  /** Cached token metadata */
  tokenMetadata?: TokenMetadata;
  
  // ===========================
  // CRYPTOGRAPHY FIELDS (opcionales en ExtendedUTXOData)
  // ===========================
  
  /** Cryptography type used (secp256k1 is current implementation) */
  cryptographyType?: 'BN254' | 'secp256k1' | 'Other';
  
  /** Nullifier hash for preventing double-spending */
  nullifierHash?: string;
  
  /** Range proof (Bulletproof format) */
  rangeProof?: string;
  
  /** Whether this is a private UTXO */
  isPrivate?: boolean;
}

/**
 * Token metadata for display purposes
 */
export interface TokenMetadata {
  /** Token symbol (e.g., 'USDC') */
  symbol: string;
  /** Token name (e.g., 'USD Coin') */
  name: string;
  /** Number of decimals */
  decimals: number;
  /** Token logo URL */
  logoURI?: string;
}

/**
 * UTXO operation parameters for create
 */
export interface CreateUTXOParams {
  /** Amount of tokens to deposit */
  amount: bigint;
  /** ERC20 token address */
  tokenAddress: string;
  /** EOA performing the deposit */
  owner: string;
  /** Optional blinding factor (auto-generated if not provided) */
  blindingFactor?: string;
  /** Optional commitment (auto-generated if not provided) */
  commitment?: string;
}

/**
 * UTXO split operation parameters
 */
export interface SplitUTXOParams {
  /** Input UTXO to split */
  inputUTXOId: string;
  /** Output values (must sum to input value) */
  outputValues: bigint[];
  /** Output owner addresses */
  outputOwners: string[];
  /** Output commitments (auto-generated if not provided) */
  outputCommitments?: string[];
  /** Output blinding factors (auto-generated if not provided) */
  outputBlindingFactors?: string[];
}

/**
 * UTXO combine operation parameters
 */
export interface CombineUTXOParams {
  /** Input UTXO IDs to combine */
  inputUTXOIds: string[];
  /** Output owner address */
  outputOwner: string;
  /** Output commitment (auto-generated if not provided) */
  outputCommitment?: string;
  /** Output blinding factor (auto-generated if not provided) */
  outputBlindingFactor?: string;
}

/**
 * UTXO transfer operation parameters
 */
export interface TransferUTXOParams {
  /** UTXO to transfer */
  utxoId: string;
  /** New owner address */
  newOwner: string;
  /** Whether to generate new commitment for privacy */
  refreshCommitment?: boolean;
}

/**
 * Transfer operation data with REAL secp256k1 cryptography
 * ✅ Following DepositAsPrivateUTXO pattern for consistency
 */
export interface TransferUTXOData {
  /** Source UTXO identifier */
  sourceUTXOId?: string;
  /** Source UTXO nullifier for spending */
  sourceNullifier: string;
  /** Current owner address */
  fromAddress: string;
  /** New owner address */
  toAddress: string;
  /** Amount to transfer */
  transferAmount: bigint;
  /** Token contract address */
  tokenAddress: string;
  /** Blinding factor for output UTXO */
  outputBlindingFactor: string;
  /** Output commitment (filled by service) */
  outputCommitment: { x: bigint; y: bigint };
  /** Output nullifier (filled by service) */
  outputNullifier: string;
}

/**
 * UTXO withdrawal parameters
 */
export interface WithdrawUTXOParams {
  /** UTXO to withdraw */
  utxoId: string;
  /** Recipient EOA address */
  recipient: string;
}

/**
 * UTXO operation results
 */
export interface UTXOOperationResult {
  /** Whether operation was successful */
  success: boolean;
  /** Transaction hash */
  transactionHash?: string;
  /** Block number where transaction was included */
  blockNumber?: number;
  /** Gas used */
  gasUsed?: bigint;
  /** Created UTXO IDs (for split/combine) */
  createdUTXOIds?: string[];
  /** Spent UTXO IDs (for withdraw/transfer operations) */
  spentUTXOIds?: string[];
  /** Error message if failed */
  error?: string;
  /** Detailed error info */
  errorDetails?: any;
}

/**
 * Backend attestation for UTXO operations
 * ✅ Used across all UTXO services following DepositAsPrivateUTXO pattern
 */
export interface BackendAttestation {
  /** Cryptographic signature from backend */
  signature: string;
  /** Attestation timestamp */
  timestamp: bigint;
  /** Optional nonce for replay protection */
  nonce?: string;
  /** Optional operation context */
  operation?: string;
  /** Data hash that was signed */
  dataHash?: string;
}

/**
 * UTXO proof data structures
 */
export interface UTXOProofData {
  /** Type of proof */
  proofType: UTXOProofType;
  /** Zenroom-generated proof */
  zenroomProof: string;
  /** EOA signature component */
  eoaSignature?: string;
  /** Proof metadata */
  metadata?: Record<string, any>;
}

export enum UTXOProofType {
  OWNERSHIP = 'OWNERSHIP',
  SPLIT = 'SPLIT',
  COMBINE = 'COMBINE',
  BURN = 'BURN',
  OPENING = 'OPENING',
  TRANSFER = 'TRANSFER'
}

/**
 * UTXO selection criteria for automatic selection
 */
export interface UTXOSelectionCriteria {
  /** Minimum value required */
  minValue?: bigint;
  /** Maximum value allowed */
  maxValue?: bigint;
  /** Specific token address */
  tokenAddress?: string;
  /** Specific owner */
  owner?: string;
  /** Maximum age in seconds */
  maxAge?: number;
  /** Exclude specific UTXO IDs */
  excludeIds?: string[];
  /** Only confirmed UTXOs */
  confirmedOnly?: boolean;
  /** Maximum number of UTXOs to return */
  limit?: number;
}

/**
 * UTXO selection result
 */
export interface UTXOSelectionResult {
  /** Selected UTXOs */
  utxos: ExtendedUTXOData[];
  /** Total value of selected UTXOs */
  totalValue: bigint;
  /** Whether selection covers required amount */
  sufficientFunds: boolean;
  /** Change amount if overpaying */
  changeAmount?: bigint;
}

/**
 * UTXO manager statistics with multi-curve cryptography support
 */
export interface UTXOManagerStats {
  totalUTXOs: number;
  unspentUTXOs: number;
  uniqueTokens: number;
  totalBalance: bigint;
  privateUTXOs: number;
  spentUTXOs: number;
  recoveredUTXOs: number;
  confirmedUTXOs: number;
  balanceByToken: { [tokenAddress: string]: bigint };
  averageUTXOValue: bigint;
  creationDistribution: Array<{ date: string; count: number }>;
  
  // ===========================
  // CRYPTOGRAPHY STATS
  // ===========================
  
  /** Number of secp256k1 UTXOs (current implementation) */
  secp256k1UTXOs: number;
  /** Number of BN254 UTXOs (legacy/future compatibility) */
  bn254UTXOs: number;
  /** Number of crypto operations performed */
  cryptoOperations: number;
  /** Distribution by cryptography type */
  cryptographyDistribution: {
    secp256k1: number;
    BN254: number;
    Other: number;
  };
}

/**
 * Events emitted by UTXO manager
 */
export interface UTXOEvents {
  /** Emitted when a new UTXO is created */
  'utxo:created': (utxo: ExtendedUTXOData) => void;
  /** Emitted when a UTXO is spent */
  'utxo:spent': (utxoId: string) => void;
  /** Emitted when a UTXO is confirmed on-chain */
  'utxo:confirmed': (utxoId: string, blockNumber: number) => void;
  /** Emitted when an operation fails */
  'operation:failed': (error: UTXOOperationError) => void;
  /** Emitted when consolidation occurs */
  'consolidation:completed': (result: UTXOOperationResult) => void;
}

/**
 * UTXO operation errors
 */
export class UTXOOperationError extends Error {
  constructor(
    message: string,
    public operation: string,
    public utxoId?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'UTXOOperationError';
  }
}

export class UTXONotFoundError extends UTXOOperationError {
  constructor(utxoId: string) {
    super(`UTXO not found: ${utxoId}`, 'lookup', utxoId);
    this.name = 'UTXONotFoundError';
  }
}

export class InsufficientFundsError extends UTXOOperationError {
  constructor(
    required: bigint,
    available: bigint,
    tokenAddress?: string
  ) {
    super(
      `Insufficient funds: required ${required}, available ${available}`,
      'balance_check',
      undefined,
      { required, available, tokenAddress }
    );
    this.name = 'InsufficientFundsError';
  }
}

export class UTXOAlreadySpentError extends UTXOOperationError {
  constructor(utxoId: string) {
    super(`UTXO already spent: ${utxoId}`, 'spend', utxoId);
    this.name = 'UTXOAlreadySpentError';
  }
}

/**
 * Type guards for runtime type checking
 */
export function isExtendedUTXOData(obj: any): obj is ExtendedUTXOData {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.value === 'bigint' &&
    typeof obj.owner === 'string' &&
    typeof obj.commitment === 'string'
  );
}

export function isUTXOOperationResult(obj: any): obj is UTXOOperationResult {
  return (
    typeof obj === 'object' &&
    typeof obj.success === 'boolean'
  );
}