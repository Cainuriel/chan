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
  UTXOVaultContract,
  SplitOperationContract,
  CombineOperationContract,
  DepositParams,
  ProofParams,
  GeneratorParams,
  DepositAsPrivateUTXOParams,
  SplitPrivateUTXOParams,
  TransferPrivateUTXOParams,
  WithdrawFromPrivateUTXOParams,
  PrivateUTXOCreatedEvent,
  PrivateTransferEvent,
  PrivateWithdrawalEvent,
  UTXO_VAULT_ABI,
  // Utility functions
  createUTXOVaultContract,
  isPrivateUTXOContract
} from '../contracts/UTXOVault.types';

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
