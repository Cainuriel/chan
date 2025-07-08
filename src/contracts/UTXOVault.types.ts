/**
 * @fileoverview TypeScript type definitions for UTXOVault smart contract
 * @description Types, ABI, and interfaces for UTXOVault contract interaction
 */

import { 
  ethers,
  type ContractTransactionResponse,
  type EventFilter,
  type ContractTransaction,
  type Result
} from 'ethers';

/**
 * UTXOVault contract data structures (matching Solidity structs)
 */
export interface UTXODataContract {
  exists: boolean;
  value: bigint;
  tokenAddress: string;
  owner: string;
  timestamp: bigint;
  isSpent: boolean;
  commitment: string; // bytes32 as hex string
  parentUTXO: string; // bytes32 as hex string
  utxoType: number; // enum as number
}

export interface SplitOperationContract {
  inputUTXO: string; // bytes32
  outputUTXOs: string[]; // bytes32[]
  outputOwners: string[]; // address[]
  outputValues: bigint[]; // uint256[]
  splitProof: string; // bytes as hex string
  timestamp: bigint;
}

export interface CombineOperationContract {
  inputUTXOs: string[]; // bytes32[]
  outputUTXO: string; // bytes32
  outputOwner: string; // address
  totalValue: bigint;
  combineProof: string; // bytes as hex string
  timestamp: bigint;
}

export interface CreateUTXOParamsContract {
  utxoId: string; // bytes32
  value: bigint;
  tokenAddress: string;
  owner: string;
  commitment: string; // bytes32
  utxoType: number; // enum
  parentUTXO: string; // bytes32
}

/**
 * UTXOVault function parameters (for contract calls)
 */
export interface DepositAsUTXOParams {
  tokenAddress: string;
  amount: bigint;
  commitment: string; // bytes32
  zenroomProof: string; // bytes
}

export interface WithdrawFromUTXOParams {
  utxoId: string; // bytes32
  burnProof: string; // bytes
  openingProof: string; // bytes
}

export interface SplitUTXOParams {
  inputUTXOId: string; // bytes32
  outputCommitments: string[]; // bytes32[]
  outputOwners: string[]; // address[]
  outputValues: bigint[]; // uint256[]
  splitProof: string; // bytes
}

export interface CombineUTXOsParams {
  inputUTXOIds: string[]; // bytes32[]
  outputCommitment: string; // bytes32
  outputOwner: string; // address
  combineProof: string; // bytes
}

export interface TransferUTXOParams {
  utxoId: string; // bytes32
  newOwner: string; // address
  transferProof: string; // bytes
}

/**
 * UTXOVault contract events
 */
export interface UTXOCreatedEvent {
  utxoId: string;
  owner: string;
  tokenAddress: string;
  value: bigint;
  commitment: string;
  utxoType: number;
  parentUTXO: string;
}

export interface UTXOSplitEvent {
  inputUTXO: string;
  inputOwner: string;
  outputUTXOs: string[];
  outputOwners: string[];
  outputValues: bigint[];
  operationId: string;
}

export interface UTXOCombinedEvent {
  inputUTXOs: string[];
  inputOwner: string;
  outputUTXO: string;
  outputOwner: string;
  totalValue: bigint;
  operationId: string;
}

export interface UTXOTransferredEvent {
  utxoId: string;
  fromOwner: string;
  toOwner: string;
  value: bigint;
  tokenAddress: string;
}

export interface UTXOWithdrawnEvent {
  utxoId: string;
  owner: string;
  tokenAddress: string;
  value: bigint;
}

/**
 * UTXOVault contract function return types
 */
export interface SplitUTXOResult {
  outputUTXOIds: string[]; // bytes32[]
  transactionHash: string;
  gasUsed: bigint;
}

export interface CombineUTXOsResult {
  outputUTXOId: string; // bytes32
  transactionHash: string;
  gasUsed: bigint;
}

/**
 * UTXOVault contract view function results
 */
export interface GetUTXOInfoResult extends UTXODataContract {}

export interface GetUTXOsByOwnerResult {
  utxoIds: string[]; // bytes32[]
}

export interface GetSplitOperationResult extends SplitOperationContract {}

export interface GetCombineOperationResult extends CombineOperationContract {}

/**
 * UTXOVault contract configuration
 */
export interface UTXOVaultConfig {
  /** Contract address */
  address: string;
  /** Deployment block number */
  deploymentBlock: number;
  /** Whether Zenroom proofs are required */
  requireZenroomProofs: boolean;
  /** Whether whitelist is enabled */
  useWhitelist: boolean;
  /** Supported tokens (if whitelist enabled) */
  supportedTokens: string[];
}

/**
 * Contract interaction options
 */
export interface ContractCallOptions {
  /** Gas limit override */
  gasLimit?: bigint;
  /** Gas price override */
  gasPrice?: bigint;
  /** Max fee per gas (EIP-1559) */
  maxFeePerGas?: bigint;
  /** Max priority fee per gas (EIP-1559) */
  maxPriorityFeePerGas?: bigint;
  /** Value to send with transaction */
  value?: bigint;
  /** Nonce override */
  nonce?: number;
}

/**
 * Event filter parameters
 */
export interface UTXOVaultEventFilter {
  /** Filter by UTXO ID */
  utxoId?: string;
  /** Filter by owner address */
  owner?: string;
  /** Filter by token address */
  tokenAddress?: string;
  /** Filter by block range */
  fromBlock?: number;
  toBlock?: number;
  /** Event topics to filter */
  topics?: (string | string[])[];
}

/**
 * Event filter factory for type-safe event filtering
 */
export interface UTXOVaultEventFilters {
  UTXOCreated(utxoId?: string | null, owner?: string | null, tokenAddress?: string | null): ethers.DeferredTopicFilter;
  UTXOSplit(inputUTXO?: string | null, inputOwner?: string | null, operationId?: string | null): ethers.DeferredTopicFilter;
  UTXOCombined(inputOwner?: string | null, outputUTXO?: string | null, outputOwner?: string | null): ethers.DeferredTopicFilter;
  UTXOTransferred(utxoId?: string | null, fromOwner?: string | null, toOwner?: string | null): ethers.DeferredTopicFilter;
  UTXOWithdrawn(utxoId?: string | null, owner?: string | null, tokenAddress?: string | null): ethers.DeferredTopicFilter;
}

/**
 * Contract error types (matching Solidity custom errors)
 */
export enum UTXOVaultErrorType {
  UTXOAlreadyExists = 'UTXOAlreadyExists',
  UTXONotFound = 'UTXONotFound',
  UTXOAlreadySpent = 'UTXOAlreadySpent',
  InvalidProof = 'InvalidProof',
  InvalidSplit = 'InvalidSplit',
  InvalidCombine = 'InvalidCombine',
  InvalidOwner = 'InvalidOwner',
  InvalidNonce = 'InvalidNonce',
  TokenNotSupported = 'TokenNotSupported',
  InsufficientValue = 'InsufficientValue',
  ZenroomProofRequired = 'ZenroomProofRequired'
}

/**
 * UTXOVault-specific errors
 */
export class UTXOVaultError extends Error {
  constructor(
    message: string,
    public errorType: UTXOVaultErrorType,
    public contractAddress?: string,
    public transactionHash?: string
  ) {
    super(message);
    this.name = 'UTXOVaultError';
  }
}

export class UTXOVaultProofError extends UTXOVaultError {
  constructor(
    proofType: string,
    reason?: string
  ) {
    super(
      `Invalid ${proofType} proof${reason ? `: ${reason}` : ''}`,
      UTXOVaultErrorType.InvalidProof
    );
    this.name = 'UTXOVaultProofError';
  }
}

/**
 * UTXOVault contract ABI
 */
export const UTXO_VAULT_ABI = [
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
  
  // Main functions
  "function depositAsUTXO(address tokenAddress, uint256 amount, bytes32 commitment, bytes calldata zenroomProof) external",
  "function withdrawFromUTXO(bytes32 utxoId, bytes calldata burnProof, bytes calldata openingProof) external",
  "function splitUTXO(bytes32 inputUTXOId, bytes32[] calldata outputCommitments, address[] calldata outputOwners, uint256[] calldata outputValues, bytes calldata splitProof) external returns (bytes32[] memory)",
  "function combineUTXOs(bytes32[] calldata inputUTXOIds, bytes32 outputCommitment, address outputOwner, bytes calldata combineProof) external returns (bytes32)",
  "function transferUTXO(bytes32 utxoId, address newOwner, bytes calldata transferProof) external",
  
  // View functions
  "function getUTXOsByOwner(address owner) external view returns (bytes32[] memory)",
  "function getUTXOInfo(bytes32 utxoId) external view returns (bool exists, uint256 value, address tokenAddress, address owner, uint256 timestamp, bool isSpent, bytes32 commitment, bytes32 parentUTXO, uint8 utxoType)",
  "function getSplitOperation(bytes32 operationId) external view returns (bytes32 inputUTXO, bytes32[] memory outputUTXOs, address[] memory outputOwners, uint256[] memory outputValues, bytes memory splitProof, uint256 timestamp)",
  "function getCombineOperation(bytes32 operationId) external view returns (bytes32[] memory inputUTXOs, bytes32 outputUTXO, address outputOwner, uint256 totalValue, bytes memory combineProof, uint256 timestamp)",
  
  // Admin functions
  "function setZenroomProofRequirement(bool required) external",
  "function addSupportedToken(address tokenAddress) external",
  "function setUseWhitelist(bool _useWhitelist) external",
  
  // Events
  "event UTXOCreated(bytes32 indexed utxoId, address indexed owner, address indexed tokenAddress, uint256 value, bytes32 commitment, uint8 utxoType, bytes32 parentUTXO)",
  "event UTXOSplit(bytes32 indexed inputUTXO, address indexed inputOwner, bytes32[] outputUTXOs, address[] outputOwners, uint256[] outputValues, bytes32 indexed operationId)",
  "event UTXOCombined(bytes32[] inputUTXOs, address indexed inputOwner, bytes32 indexed outputUTXO, address indexed outputOwner, uint256 totalValue, bytes32 operationId)",
  "event UTXOTransferred(bytes32 indexed utxoId, address indexed fromOwner, address indexed toOwner, uint256 value, address tokenAddress)",
  "event UTXOWithdrawn(bytes32 indexed utxoId, address indexed owner, address indexed tokenAddress, uint256 value)",
  
  // Inherited from Ownable
  "function owner() view returns (address)",
  "function transferOwnership(address newOwner) external",
  "function renounceOwnership() external",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)"
] as const;

/**
 * Contract interface for type-safe contract interaction
 */
export interface UTXOVaultInterface {
  // Function fragments
  getFunction(nameOrSignatureOrTopic: 
    | "depositAsUTXO"
    | "withdrawFromUTXO"
    | "splitUTXO"
    | "combineUTXOs"
    | "transferUTXO"
    | "getUTXOsByOwner"
    | "getUTXOInfo"
    | "getSplitOperation"
    | "getCombineOperation"
    | "setZenroomProofRequirement"
    | "addSupportedToken"
    | "setUseWhitelist"
  ): ethers.FunctionFragment;
  
  // Event fragments
  getEvent(nameOrSignatureOrTopic:
    | "UTXOCreated"
    | "UTXOSplit"
    | "UTXOCombined"
    | "UTXOTransferred"
    | "UTXOWithdrawn"
  ): ethers.EventFragment;
  
  // Encode function data
  encodeFunctionData(functionFragment: "depositAsUTXO", values: [string, bigint, string, string]): string;
  encodeFunctionData(functionFragment: "withdrawFromUTXO", values: [string, string, string]): string;
  encodeFunctionData(functionFragment: "splitUTXO", values: [string, string[], string[], bigint[], string]): string;
  encodeFunctionData(functionFragment: "combineUTXOs", values: [string[], string, string, string]): string;
  encodeFunctionData(functionFragment: "transferUTXO", values: [string, string, string]): string;
  
  // Decode function result
  decodeFunctionResult(functionFragment: "splitUTXO", data: string): Result;
  decodeFunctionResult(functionFragment: "combineUTXOs", data: string): Result;
  decodeFunctionResult(functionFragment: "getUTXOsByOwner", data: string): Result;
  decodeFunctionResult(functionFragment: "getUTXOInfo", data: string): Result;
}

/**
 * Type-safe contract instance
 */
export interface UTXOVaultContract {
  // Contract metadata
  readonly address: string;
  readonly interface: UTXOVaultInterface;
  readonly runner: ethers.ContractRunner | null;
  readonly target: string;
  
  // Read-only functions
  utxos(utxoId: string): Promise<UTXODataContract>;
  getUTXOsByOwner(owner: string): Promise<string[]>;
  getUTXOInfo(utxoId: string): Promise<UTXODataContract>;
  getSplitOperation(operationId: string): Promise<SplitOperationContract>;
  getCombineOperation(operationId: string): Promise<CombineOperationContract>;
  nonces(user: string): Promise<bigint>;
  requireZenroomProofs(): Promise<boolean>;
  useWhitelist(): Promise<boolean>;
  supportedTokens(token: string): Promise<boolean>;
  
  // State-changing functions
  depositAsUTXO(
    tokenAddress: string,
    amount: bigint,
    commitment: string,
    zenroomProof: string,
    overrides?: ContractCallOptions
  ): Promise<ContractTransactionResponse>;
  
  withdrawFromUTXO(
    utxoId: string,
    burnProof: string,
    openingProof: string,
    overrides?: ContractCallOptions
  ): Promise<ContractTransactionResponse>;
  
  splitUTXO(
    inputUTXOId: string,
    outputCommitments: string[],
    outputOwners: string[],
    outputValues: bigint[],
    splitProof: string,
    overrides?: ContractCallOptions
  ): Promise<ContractTransactionResponse>;
  
  combineUTXOs(
    inputUTXOIds: string[],
    outputCommitment: string,
    outputOwner: string,
    combineProof: string,
    overrides?: ContractCallOptions
  ): Promise<ContractTransactionResponse>;
  
  transferUTXO(
    utxoId: string,
    newOwner: string,
    transferProof: string,
    overrides?: ContractCallOptions
  ): Promise<ContractTransactionResponse>;
  
  // Admin functions
  setZenroomProofRequirement(required: boolean, overrides?: ContractCallOptions): Promise<ContractTransactionResponse>;
  addSupportedToken(tokenAddress: string, overrides?: ContractCallOptions): Promise<ContractTransactionResponse>;
  setUseWhitelist(useWhitelist: boolean, overrides?: ContractCallOptions): Promise<ContractTransactionResponse>;
  
  // Event methods
  on(event: string, listener: (...args: any[]) => void): UTXOVaultContract;
  off(event: string, listener?: (...args: any[]) => void): UTXOVaultContract;
  once(event: string, listener: (...args: any[]) => void): UTXOVaultContract;
  
  // Event filters - using a more compatible structure
  filters: UTXOVaultEventFilters;
  getEvent(eventName: string): ethers.EventFragment;
  queryFilter(event: string | ethers.EventFilter, fromBlock?: number, toBlock?: number): Promise<ethers.EventLog[]>;
}

/**
 * Type guards for contract data validation
 */
export function isUTXODataContract(obj: any): obj is UTXODataContract {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.exists === 'boolean' &&
    (typeof obj.value === 'bigint' || typeof obj.value === 'string' || typeof obj.value === 'number') &&
    typeof obj.tokenAddress === 'string' &&
    typeof obj.owner === 'string' &&
    (typeof obj.timestamp === 'bigint' || typeof obj.timestamp === 'string' || typeof obj.timestamp === 'number') &&
    typeof obj.isSpent === 'boolean' &&
    typeof obj.commitment === 'string' &&
    typeof obj.parentUTXO === 'string' &&
    typeof obj.utxoType === 'number'
  );
}

export function isSplitOperationContract(obj: any): obj is SplitOperationContract {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.inputUTXO === 'string' &&
    Array.isArray(obj.outputUTXOs) &&
    Array.isArray(obj.outputOwners) &&
    Array.isArray(obj.outputValues) &&
    typeof obj.splitProof === 'string' &&
    (typeof obj.timestamp === 'bigint' || typeof obj.timestamp === 'string' || typeof obj.timestamp === 'number')
  );
}

/**
 * Utility functions for contract interaction
 */
export function createUTXOVaultInterface(): ethers.Interface {
  return new ethers.Interface(UTXO_VAULT_ABI);
}

export function createUTXOVaultContract(
  address: string,
  signerOrProvider: ethers.Signer | ethers.Provider
): UTXOVaultContract {
  return new ethers.Contract(address, UTXO_VAULT_ABI, signerOrProvider) as unknown as UTXOVaultContract;
}

/**
 * Constants for contract interaction
 */
export const UTXO_VAULT_CONSTANTS = {
  // Enum values matching Solidity
  UTXO_TYPES: {
    DEPOSIT: 0,
    SPLIT: 1,
    COMBINE: 2,
    TRANSFER: 3
  } as const,
  
  // Event signatures
  EVENT_SIGNATURES: {
    UTXO_CREATED: "0x...", // Will be calculated from ABI
    UTXO_SPLIT: "0x...",
    UTXO_COMBINED: "0x...",
    UTXO_TRANSFERRED: "0x...",
    UTXO_WITHDRAWN: "0x..."
  } as const,
  
  // Error signatures
  ERROR_SIGNATURES: {
    UTXO_ALREADY_EXISTS: "0x...",
    UTXO_NOT_FOUND: "0x...",
    UTXO_ALREADY_SPENT: "0x...",
    INVALID_PROOF: "0x...",
    INVALID_SPLIT: "0x...",
    INVALID_COMBINE: "0x...",
    INVALID_OWNER: "0x...",
    TOKEN_NOT_SUPPORTED: "0x...",
    INSUFFICIENT_VALUE: "0x..."
  } as const
} as const;

/**
 * Example usage of the corrected types
 */
export type UTXOVaultContractUsageExample = {
  // Example of how to create and use a contract instance
  createContract: (address: string, signer: ethers.Signer) => UTXOVaultContract;
  
  // Example method signatures for common operations
  depositExample: (
    contract: UTXOVaultContract,
    tokenAddress: string,
    amount: bigint,
    commitment: string,
    proof: string
  ) => Promise<ContractTransactionResponse>;
  
  // Example of event filtering
  listenToEvents: (contract: UTXOVaultContract) => void;
  
  // Example of reading UTXO data
  readUTXOData: (contract: UTXOVaultContract, utxoId: string) => Promise<UTXODataContract>;
};