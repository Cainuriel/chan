/**
 * Structs for grouped parameters in depositAsPrivateUTXO (matching simplified Solidity)
 */
export interface DepositParams {
  tokenAddress: string;
  commitment: string; // bytes32
  nullifierHash: string; // bytes32
  blindingFactor: bigint;
}

export interface ProofParams {
  rangeProof: string; // bytes - Range proof real (Bulletproof)
}

export interface GeneratorParams {
  gX: bigint;
  gY: bigint;
  hX: bigint;
  hY: bigint;
}
/**
 * @fileoverview TypeScript type definitions for UTXOVault smart contract (simplified)
 * @description Types, ABI, and interfaces for simplified UTXOVault contract interaction
 * Only includes Pedersen commitments, range proofs, and equality proofs - no BBS+ or issuer logic
 */

import { 
  ethers,
  type ContractTransactionResponse,
  type EventFilter,
  type ContractTransaction,
  type Result
} from 'ethers';

/**
 * UTXOVault contract data structures (simplified - matching Solidity structs)
 */
export interface PrivateUTXOContract {
  exists: boolean;
  commitment: string; // bytes32 - Pedersen commitment
  tokenAddress: string;
  owner: string;
  timestamp: bigint;
  isSpent: boolean;
  parentUTXO: string; // bytes32
  utxoType: number; // enum
  nullifierHash: string; // bytes32
}

/**
 * Enhanced function parameters for private operations (simplified)
 */
export interface DepositAsPrivateUTXOParams {
  tokenAddress: string;
  amount: bigint; // Cantidad real a depositar
  blindingFactor: bigint;
  gX: bigint;
  gY: bigint;
  hX: bigint;
  hY: bigint;
  commitment: string; // bytes32
  nullifierHash: string; // bytes32
  rangeProof: string; // bytes
}

export interface SplitPrivateUTXOParams {
  inputCommitment: string; // bytes32
  outputCommitments: string[]; // bytes32[]
  outputAmounts: bigint[]; // uint256[]
  outputBlindings: bigint[]; // uint256[]
  equalityProof: string; // bytes
  nullifierHash: string; // bytes32
}

export interface TransferPrivateUTXOParams {
  inputCommitment: string; // bytes32
  outputCommitment: string; // bytes32
  newOwner: string; // address
  amount: bigint; // uint256
  outputBlinding: bigint; // uint256
  nullifierHash: string; // bytes32
}

export interface WithdrawFromPrivateUTXOParams {
  commitment: string; // bytes32
  amount: bigint; // uint256
  blindingFactor: bigint; // uint256
  nullifierHash: string; // bytes32
}

/**
 * Enhanced events for private operations (simplified)
 */
export interface PrivateUTXOCreatedEvent {
  commitment: string;
  owner: string;
  tokenAddress: string;
  nullifierHash: string;
  utxoType: number;
  amount: bigint;
}

export interface PrivateTransferEvent {
  inputCommitment: string;
  outputCommitment: string;
  nullifierHash: string;
  newOwner: string;
}

export interface PrivateWithdrawalEvent {
  commitment: string;
  recipient: string;
  nullifierHash: string;
  amount: bigint;
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
 * UTXOVault contract view function results (simplified)
 */
export interface GetUTXOInfoResult extends PrivateUTXOContract {}

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
  // Original events
  UTXOCreated(utxoId?: string | null, owner?: string | null, tokenAddress?: string | null): ethers.DeferredTopicFilter;
  UTXOSplit(inputUTXO?: string | null, inputOwner?: string | null, operationId?: string | null): ethers.DeferredTopicFilter;
  UTXOCombined(inputOwner?: string | null, outputUTXO?: string | null, outputOwner?: string | null): ethers.DeferredTopicFilter;
  UTXOTransferred(utxoId?: string | null, fromOwner?: string | null, toOwner?: string | null): ethers.DeferredTopicFilter;
  UTXOWithdrawn(utxoId?: string | null, owner?: string | null, tokenAddress?: string | null): ethers.DeferredTopicFilter;
  
  // New private events
  PrivateUTXOCreated(commitment?: string | null, owner?: string | null, tokenAddress?: string | null): ethers.DeferredTopicFilter;
  PrivateTransfer(inputCommitment?: string | null, outputCommitment?: string | null): ethers.DeferredTopicFilter;
  PrivateWithdrawal(commitment?: string | null, recipient?: string | null): ethers.DeferredTopicFilter;
  BBSCredentialRevoked(credentialId?: string | null, issuer?: string | null): ethers.DeferredTopicFilter;
}

/**
 * Contract error types (matching simplified Solidity custom errors)
 */
export enum UTXOVaultErrorType {
  // Core UTXO errors
  UTXOAlreadyExists = 'UTXOAlreadyExists',
  UTXONotFound = 'UTXONotFound',
  UTXOAlreadySpent = 'UTXOAlreadySpent',
  InvalidOwner = 'InvalidOwner',
  TokenNotSupported = 'TokenNotSupported',
  InsufficientValue = 'InsufficientValue',
  
  // Privacy-related errors (simplified)
  InvalidCommitment = 'InvalidCommitment',
  InvalidRangeProof = 'InvalidRangeProof',
  NullifierAlreadyUsed = 'NullifierAlreadyUsed',
  InvalidEqualityProof = 'InvalidEqualityProof',
  NotOwner = 'NotOwner'
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
      UTXOVaultErrorType.InvalidRangeProof
    );
    this.name = 'UTXOVaultProofError';
  }
}

/**
 * UTXOVault contract ABI - Simplified without BBS+ and issuer logic
 */
export const UTXO_VAULT_ABI = [
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
] as const;

/**
 * Contract interface for type-safe contract interaction (simplified)
 */
export interface UTXOVaultInterface {
  // Function fragments
  getFunction(nameOrSignatureOrTopic: 
    | "depositAsPrivateUTXO"
    | "splitPrivateUTXO"
    | "transferPrivateUTXO"
    | "withdrawFromPrivateUTXO"
    | "getUTXOsByOwner"
    | "getUTXOInfo"
    | "getUTXOCommitment"
    | "isNullifierUsed"
    | "getUserUTXOCount"
    | "getRegisteredTokens"
    | "getTokenInfo"
    | "isTokenRegistered"
  ): ethers.FunctionFragment;
  
  // Event fragments
  getEvent(nameOrSignatureOrTopic:
    | "TokenRegistered"
    | "PrivateUTXOCreated"
    | "PrivateTransfer"
    | "PrivateWithdrawal"
  ): ethers.EventFragment;
  
  // Encode function data
  encodeFunctionData(functionFragment: "depositAsPrivateUTXO", values: [DepositParams, ProofParams, GeneratorParams, bigint]): string;
  encodeFunctionData(functionFragment: "splitPrivateUTXO", values: [string, string[], bigint[], bigint[], string, string, GeneratorParams]): string;
  encodeFunctionData(functionFragment: "transferPrivateUTXO", values: [string, string, string, bigint, bigint, string, GeneratorParams]): string;
  encodeFunctionData(functionFragment: "withdrawFromPrivateUTXO", values: [string, bigint, bigint, string, GeneratorParams]): string;
  
  // Decode function result
  decodeFunctionResult(functionFragment: "splitPrivateUTXO", data: string): Result;
  decodeFunctionResult(functionFragment: "transferPrivateUTXO", data: string): Result;
  decodeFunctionResult(functionFragment: "getUTXOsByOwner", data: string): Result;
  decodeFunctionResult(functionFragment: "getUTXOInfo", data: string): Result;
  decodeFunctionResult(functionFragment: "getUTXOCommitment", data: string): Result;
  decodeFunctionResult(functionFragment: "isNullifierUsed", data: string): Result;
  decodeFunctionResult(functionFragment: "getUserUTXOCount", data: string): Result;
}

/**
 * Type-safe contract instance (simplified)
 */
// ...existing code...

export interface UTXOVaultContract {
  // Contract metadata
  readonly address: string;
  readonly interface: UTXOVaultInterface;
  readonly runner: ethers.ContractRunner | null;
  readonly target: string;
  
  // Read-only functions
  registeredTokens(tokenAddress: string): Promise<boolean>;
  tokenRegistrationTime(tokenAddress: string): Promise<bigint>;
  tokenNames(tokenAddress: string): Promise<string>;
  tokenSymbols(tokenAddress: string): Promise<string>;
  tokenDecimals(tokenAddress: string): Promise<number>;
  allRegisteredTokens(index: bigint): Promise<string>;
  getUTXOsByOwner(owner: string): Promise<string[]>;
  getUTXOInfo(utxoId: string): Promise<[boolean, string, string, string, bigint, boolean, string, number, string]>;
  getUTXOCommitment(utxoId: string): Promise<string>;
  isNullifierUsed(nullifier: string): Promise<boolean>;
  getUserUTXOCount(user: string): Promise<bigint>;
  getRegisteredTokens(): Promise<string[]>;
  getTokenInfo(tokenAddress: string): Promise<[boolean, bigint, string, string, number]>;
  getRegisteredTokenCount(): Promise<bigint>;
  isTokenRegistered(tokenAddress: string): Promise<boolean>;
  getTokenName(tokenAddress: string): Promise<string>;
  getTokenSymbol(tokenAddress: string): Promise<string>;
  getTokenDecimals(tokenAddress: string): Promise<number>;
  
  // Private UTXO functions (simplified) with gas estimation
  depositAsPrivateUTXO: ((
    depositParams: DepositParams,
    proofParams: ProofParams,
    generators: GeneratorParams,
    amount: bigint,
    overrides?: ContractCallOptions
  ) => Promise<ContractTransactionResponse>) & {
    estimateGas(
      depositParams: DepositParams,
      proofParams: ProofParams,
      generators: GeneratorParams,
      amount: bigint,
      overrides?: ContractCallOptions
    ): Promise<bigint>;
  };

  splitPrivateUTXO: ((
    inputCommitment: string,
    outputCommitments: string[],
    outputAmounts: bigint[],
    outputBlindings: bigint[],
    equalityProof: string,
    nullifierHash: string,
    generators: GeneratorParams,
    overrides?: ContractCallOptions
  ) => Promise<ContractTransactionResponse>) & {
    estimateGas(
      inputCommitment: string,
      outputCommitments: string[],
      outputAmounts: bigint[],
      outputBlindings: bigint[],
      equalityProof: string,
      nullifierHash: string,
      generators: GeneratorParams,
      overrides?: ContractCallOptions
    ): Promise<bigint>;
  };

  transferPrivateUTXO: ((
    inputCommitment: string,
    outputCommitment: string,
    newOwner: string,
    amount: bigint,
    outputBlinding: bigint,
    nullifierHash: string,
    generators: GeneratorParams,
    overrides?: ContractCallOptions
  ) => Promise<ContractTransactionResponse>) & {
    estimateGas(
      inputCommitment: string,
      outputCommitment: string,
      newOwner: string,
      amount: bigint,
      outputBlinding: bigint,
      nullifierHash: string,
      generators: GeneratorParams,
      overrides?: ContractCallOptions
    ): Promise<bigint>;
  };

  withdrawFromPrivateUTXO: ((
    commitment: string,
    amount: bigint,
    blindingFactor: bigint,
    nullifierHash: string,
    generators: GeneratorParams,
    overrides?: ContractCallOptions
  ) => Promise<ContractTransactionResponse>) & {
    estimateGas(
      commitment: string,
      amount: bigint,
      blindingFactor: bigint,
      nullifierHash: string,
      generators: GeneratorParams,
      overrides?: ContractCallOptions
    ): Promise<bigint>;
  };

  // Método para obtener funciones específicas (Ethers v6)
  getFunction(name: string): ethers.BaseContractMethod<any[], any, any>;
  
  // Event methods
  on(event: string, listener: (...args: any[]) => void): UTXOVaultContract;
  off(event: string, listener?: (...args: any[]) => void): UTXOVaultContract;
  once(event: string, listener: (...args: any[]) => void): UTXOVaultContract;
  
  // Event filters - simplified
  filters: {
    TokenRegistered(tokenAddress?: string | null): ethers.DeferredTopicFilter;
    PrivateUTXOCreated(commitment?: string | null, owner?: string | null, tokenAddress?: string | null): ethers.DeferredTopicFilter;
    PrivateTransfer(inputCommitment?: string | null, outputCommitment?: string | null, newOwner?: string | null): ethers.DeferredTopicFilter;
    PrivateWithdrawal(commitment?: string | null, recipient?: string | null): ethers.DeferredTopicFilter;
  };
  getEvent(eventName: string): ethers.EventFragment;
  queryFilter(event: string | ethers.EventFilter, fromBlock?: number, toBlock?: number): Promise<ethers.EventLog[]>;
}

// ...existing code...

/**
 * Type guards for contract data validation (simplified)
 */

/**
 * Type guards for contract data validation (simplified)
 */
export function isPrivateUTXOContract(obj: any): obj is PrivateUTXOContract {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.exists === 'boolean' &&
    typeof obj.commitment === 'string' &&
    typeof obj.tokenAddress === 'string' &&
    typeof obj.owner === 'string' &&
    (typeof obj.timestamp === 'bigint' || typeof obj.timestamp === 'string' || typeof obj.timestamp === 'number') &&
    typeof obj.isSpent === 'boolean' &&
    typeof obj.parentUTXO === 'string' &&
    typeof obj.utxoType === 'number' &&
    typeof obj.nullifierHash === 'string'
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
 * Constants for contract interaction (simplified)
 */
export const UTXO_VAULT_CONSTANTS = {
  // Enum values matching Solidity
  UTXO_TYPES: {
    DEPOSIT: 0,
    SPLIT: 1,
    COMBINE: 2,
    TRANSFER: 3,
    WITHDRAW: 4
  } as const,
  
  // Error signatures (simplified)
  ERROR_SIGNATURES: {
    UTXO_NOT_FOUND: "0x...",
    UTXO_ALREADY_SPENT: "0x...",
    INVALID_COMMITMENT: "0x...",
    INVALID_RANGE_PROOF: "0x...",
    NULLIFIER_ALREADY_USED: "0x...",
    INVALID_EQUALITY_PROOF: "0x...",
    NOT_OWNER: "0x..."
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
  readUTXOData: (contract: UTXOVaultContract, utxoId: string) => Promise<PrivateUTXOContract>;
};