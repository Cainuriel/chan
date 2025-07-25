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
  PrivateUTXOContract,
  ZKUTXOVaultContract,
  SplitOperationContract,
  CombineOperationContract,
  ZKDepositParams,
  ZKSplitParams,
  ZKTransferParams,
  ZKWithdrawParams,
  DepositAsPrivateUTXOParams,
  SplitPrivateUTXOParams,
  TransferPrivateUTXOParams,
  WithdrawFromPrivateUTXOParams,
  PrivateUTXOCreatedEvent,
  PrivateTransferEvent,
  PrivateWithdrawalEvent,
  ZKUTXOVaultABI,
  // Utility functions
  createZKUTXOVaultContract,
  isPrivateUTXOContract
} from '../contracts/ZKUTXOVault.types';

// Re-export commonly used types for convenience
export type {
  PedersenCommitment,
  EqualityProof,
  BulletproofRangeProof,
  Attestation,
  DepositAttestationData,
  TransferAttestationData,
  SplitAttestationData,
  WithdrawAttestationData
} from './zenroom.d';
