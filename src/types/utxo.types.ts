/**
 * @fileoverview TypeScript type definitions for UTXO system
 * @description Types for hybrid EOA + Zenroom + Smart Contract UTXO implementation
 */

/**
 * Core UTXO data structure (matches smart contract)
 */
export interface UTXOData {
  /** Unique UTXO identifier */
  id: string;
  /** Whether the UTXO exists */
  exists: boolean;
  /** Value in tokens (may be hidden in production) */
  value: bigint;
  /** ERC20 token contract address */
  tokenAddress: string;
  /** Current owner EOA address */
  owner: string;
  /** Creation timestamp */
  timestamp: bigint;
  /** Whether the UTXO has been spent */
  isSpent: boolean;
  /** Pedersen commitment (Zenroom generated) */
  commitment: string;
  /** Parent UTXO ID (for tracking lineage) */
  parentUTXO: string;
  /** Type of UTXO creation */
  utxoType: UTXOType;
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
 * Enhanced UTXO with local metadata
 */
export interface ExtendedUTXOData extends UTXOData {
  /** Blinding factor for commitment (keep secret) */
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
  /** Gas used */
  gasUsed?: bigint;
  /** Created UTXO IDs (for split/combine) */
  createdUTXOIds?: string[];
  /** Error message if failed */
  error?: string;
  /** Detailed error info */
  errorDetails?: any;
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
 * UTXO manager statistics
 */
export interface UTXOManagerStats {
  /** Total number of UTXOs */
  totalUTXOs: number;
  /** Number of unspent UTXOs */
  unspentUTXOs: number;
  /** Number of spent UTXOs */
  spentUTXOs: number;
  /** Number of confirmed UTXOs */
  confirmedUTXOs: number;
  /** Total balance across all UTXOs */
  totalBalance: bigint;
  /** Balance by token address */
  balanceByToken: Record<string, bigint>;
  /** Average UTXO value */
  averageUTXOValue: bigint;
  /** Number of unique tokens */
  uniqueTokens: number;
  /** Creation distribution by type */
  creationDistribution: Record<UTXOType, number>;
}

/**
 * UTXO manager configuration
 */
export interface UTXOManagerConfig {
  /** Enable automatic UTXO consolidation */
  autoConsolidate: boolean;
  /** Minimum number of UTXOs to trigger consolidation */
  consolidationThreshold: number;
  /** Maximum UTXO age before auto-consolidation (seconds) */
  maxUTXOAge: number;
  /** Enable privacy mode (generate new commitments on transfers) */
  privacyMode: boolean;
  /** Default gas limit for operations */
  defaultGasLimit: bigint;
  /** Cache duration for blockchain queries (ms) */
  cacheTimeout: number;
  /** Enable local backup of UTXO data */
  enableBackup: boolean;
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