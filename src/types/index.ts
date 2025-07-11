/**
 * @fileoverview Type definitions index
 * @description Central export for all type definitions
 */

// Ethereum and UTXO types
export * from './ethereum.types';
export * from './utxo.types';

// Zenroom types
export * from './zenroom.d';

// UTXOVault contract types - export selectively to avoid conflicts
export type {
  UTXODataContract,
  UTXOVaultContract,
  UTXOVaultConfig,
  ContractCallOptions,
  UTXOVaultInterface,
  UTXOVaultEventFilters,
  UTXOVaultError,
  UTXOVaultProofError,
  UTXOVaultErrorType,
  UTXO_VAULT_ABI,
  UTXO_VAULT_CONSTANTS,
  // Contract-specific parameter types
  DepositAsUTXOParams as ContractDepositAsUTXOParams,
  WithdrawFromUTXOParams as ContractWithdrawFromUTXOParams,
  SplitUTXOParams as ContractSplitUTXOParams,
  CombineUTXOsParams as ContractCombineUTXOsParams,
  TransferUTXOParams as ContractTransferUTXOParams,
  // Contract events
  UTXOCreatedEvent,
  UTXOSplitEvent,
  UTXOCombinedEvent,
  UTXOTransferredEvent,
  UTXOWithdrawnEvent,
  // Contract results
  SplitUTXOResult,
  CombineUTXOsResult,
  GetUTXOInfoResult,
  GetUTXOsByOwnerResult,
  GetSplitOperationResult,
  GetCombineOperationResult,
  // Utility functions
  createUTXOVaultContract,
  createUTXOVaultInterface,
  isUTXODataContract,
  isSplitOperationContract
} from '../contracts/UTXOVault.types';

// Re-export commonly used types for convenience
export type {
  ZenroomExecutionResult,
  ZenroomExecutionOptions,
  ZenroomCommitmentResult,
  ZenroomSplitProofResult,
  ZenroomOwnershipProofResult,
  ZenroomKeyDerivationResult
} from './zenroom.d';
