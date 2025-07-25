/**
 * ZKUTXOVault.types.ts - Types for ZK-UTXO System
 * Ultra-simplified types for true zero-knowledge privacy
 */

// ========================
// CORE STRUCTURES
// ========================

/**
 * @dev Attestation del backend - Backend verificó TODO en ZK
 */
export interface BackendAttestation {
  operation: string;    // "DEPOSIT", "SPLIT", "TRANSFER", "WITHDRAW"
  dataHash: string;     // bytes32 - Hash de todos los datos relevantes
  nonce: bigint;        // uint256 - Nonce único secuencial
  timestamp: bigint;    // uint256 - Timestamp de la attestation
  signature: string;    // bytes - Firma ECDSA del backend autorizado
}

/**
 * @dev Parámetros para depósito ZK - Única operación con amount visible
 */
export interface ZKDepositParams {
  utxoId: string;           // bytes32 - ID único del UTXO a crear
  nullifierHash: string;    // bytes32 - Nullifier del UTXO
  tokenAddress: string;     // address - Token a depositar
  amount: bigint;          // uint256 - Amount (visible en deposit)
  attestation: BackendAttestation;  // Backend verificó todo
}

/**
 * @dev Parámetros para split ZK - Sin amounts (privacidad total)
 */
export interface ZKSplitParams {
  inputNullifier: string;       // bytes32 - Nullifier del UTXO a dividir
  outputUTXOIds: string[];      // bytes32[] - IDs de los UTXOs resultantes
  outputNullifiers: string[];   // bytes32[] - Nullifiers de los UTXOs resultantes
  attestation: BackendAttestation;    // Backend verificó conservación de valor
}

/**
 * @dev Parámetros para transfer ZK - Sin amounts (privacidad total)
 */
export interface ZKTransferParams {
  inputNullifier: string;       // bytes32 - Nullifier del UTXO a transferir
  outputUTXOId: string;         // bytes32 - ID del UTXO para el receptor
  outputNullifier: string;      // bytes32 - Nullifier del UTXO para el receptor
  attestation: BackendAttestation;    // Backend verificó ownership
}

/**
 * @dev Parámetros para withdraw ZK - Amount visible (salida del sistema)
 */
export interface ZKWithdrawParams {
  nullifier: string;            // bytes32 - Nullifier del UTXO a retirar
  token: string;               // address - Token a retirar
  amount: bigint;              // uint256 - Amount a retirar (visible en withdraw)
  attestation: BackendAttestation;   // Backend verificó ownership y amount
}

// ========================
// RESULT TYPES
// ========================

export interface ZKOperationResult {
  success: boolean;
  error?: string;
  transactionHash?: string;
  gasUsed?: bigint;
}

export interface ContractStats {
  totalTokens: bigint;
  currentNonce: bigint;
  backend: string;
  isPaused: boolean;
}

// ========================
// VALIDATION TYPES
// ========================

export interface ValidationResult {
  isValid: boolean;
  errorCode: number;
}

export interface SplitValidationResult extends ValidationResult {
  errorMessage?: string;
  failedValidations?: string[];
}

export interface PreValidationParams {
  inputNullifier: string;
  outputNullifiers: string[];
  outputUTXOIds: string[];
}

export interface ValidationContext {
  operation: ZKOperation;
  userAddress: string;
  timestamp: number;
  blockNumber?: number;
}

// ========================
// CONTRACT INTERFACE TYPES
// ========================

export interface ZKUTXOVaultContract {
  // Deposit
  depositAsPrivateUTXO(params: ZKDepositParams): Promise<any>;
  
  // Split
  splitPrivateUTXO(params: ZKSplitParams): Promise<any>;
  
  // Transfer
  transferPrivateUTXO(params: ZKTransferParams): Promise<any>;
  
  // Withdraw
  withdrawFromPrivateUTXO(params: ZKWithdrawParams): Promise<any>;
  
  // Pre-validations
  preValidateDeposit(
    nullifier: string,
    token: string,
    amount: bigint,
    depositor: string
  ): Promise<[boolean, number]>;
  
  preValidateSplit(
    inputNullifier: string,
    outputNullifiers: string[],
    outputUTXOIds: string[]
  ): Promise<[boolean, number]>;
  
  preValidateTransfer(
    inputNullifier: string,
    outputNullifier: string
  ): Promise<[boolean, number]>;
  
  preValidateWithdraw(
    nullifier: string,
    token: string,
    amount: bigint
  ): Promise<[boolean, number]>;
  
  // View functions
  isNullifierUsed(nullifier: string): Promise<boolean>;
  doesUTXOExist(utxoId: string): Promise<boolean>;
  getRegisteredTokens(): Promise<string[]>;
  isTokenRegistered(token: string): Promise<boolean>;
  getCurrentNonce(): Promise<bigint>;
  getTokenBalance(token: string): Promise<bigint>;
  getContractStats(): Promise<[bigint, bigint, string, boolean]>;
  
  // Admin functions
  updateAuthorizedBackend(newBackend: string): Promise<any>;
  setEmergencyPause(paused: boolean): Promise<any>;
  emergencyWithdraw(token: string, amount: bigint): Promise<any>;
}

// ========================
// EVENT TYPES
// ========================

export interface ZKDepositEvent {
  utxoId: string;
  user: string;
  token: string;
  amount: bigint;       // ← Visible en deposit
  nullifier: string;
  timestamp: bigint;
}

export interface ZKSplitEvent {
  inputNullifier: string;
  outputUTXOIds: string[];     // ← Sin amounts
  outputNullifiers: string[];
  timestamp: bigint;
}

export interface ZKTransferEvent {
  inputNullifier: string;
  outputUTXOId: string;        // ← Sin amounts
  outputNullifier: string;
  timestamp: bigint;
}

export interface ZKWithdrawEvent {
  nullifier: string;
  recipient: string;
  token: string;
  amount: bigint;       // ← Visible en withdraw
  timestamp: bigint;
}

export interface BackendUpdatedEvent {
  oldBackend: string;
  newBackend: string;
}

export interface TokenRegisteredEvent {
  tokenAddress: string;
  timestamp: bigint;
}

// ========================
// FRONTEND SERVICE TYPES
// ========================

/**
 * Datos para crear un UTXO en el frontend (privados)
 */
export interface PrivateUTXOData {
  id: string;
  nullifierHash: string;
  commitment: {
    x: bigint;
    y: bigint;
  };
  value: bigint;
  blindingFactor: string;
  tokenAddress: string;
  owner: string;
  isSpent: boolean;
  localCreatedAt: number;
  confirmed: boolean;
  creationTxHash?: string;
  blockNumber?: number;
  notes?: string;
}

/**
 * Parámetros para operaciones del frontend
 */
export interface ZKDepositData {
  tokenAddress: string;
  amount: bigint;
  commitment: {
    x: bigint;
    y: bigint;
  };
  nullifierHash: string;
  blindingFactor: string;
}

export interface ZKSplitData {
  sourceUTXOId: string;
  outputAmounts: bigint[];
  outputCommitments: Array<{
    x: bigint;
    y: bigint;
  }>;
  outputNullifiers: string[];
  outputBlindingFactors: string[];
}

export interface ZKTransferData {
  sourceUTXOId: string;
  recipientAddress: string;
  amount: bigint;
  outputCommitment: {
    x: bigint;
    y: bigint;
  };
  outputNullifier: string;
  outputBlindingFactor: string;
}

export interface ZKWithdrawData {
  sourceUTXOId: string;
  amount: bigint;
  recipient: string;
  nullifier: string;
}

// ========================
// ERROR TYPES
// ========================

export class ZKOperationError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly context?: any
  ) {
    super(message);
    this.name = 'ZKOperationError';
  }
}

export class ZKValidationError extends ZKOperationError {
  constructor(
    message: string,
    public readonly errorCode: number,
    operation: string,
    context?: any
  ) {
    super(message, operation, context);
    this.name = 'ZKValidationError';
  }
}

// ========================
// ERROR CODE MAPPINGS
// ========================

export const SPLIT_ERROR_CODES = {
  1: 'Invalid input nullifier',
  2: 'Input already spent',
  3: 'No outputs provided',
  4: 'Array length mismatch',
  5: 'Output nullifier already used',
  6: 'Invalid output nullifier',
  7: 'Invalid output UTXO ID',
  8: 'Output nullifier same as input',
  9: 'Duplicate output nullifiers',
  10: 'Duplicate output UTXO IDs'
} as const;

export const DEPOSIT_ERROR_CODES = {
  1: 'Invalid nullifier',
  2: 'Nullifier already used',
  3: 'Invalid token',
  4: 'Invalid amount',
  5: 'Insufficient allowance',
  6: 'Invalid token contract',
  7: 'Insufficient balance'
} as const;

export const TRANSFER_ERROR_CODES = {
  1: 'Invalid nullifiers',
  2: 'Input already spent',
  3: 'Output nullifier collision'
} as const;

export const WITHDRAW_ERROR_CODES = {
  1: 'Invalid nullifier',
  2: 'Already spent',
  3: 'Invalid amount',
  4: 'Insufficient contract balance',
  5: 'Invalid token'
} as const;

/**
 * Get error message for split operation
 */
export function getSplitErrorMessage(errorCode: number): string {
  return SPLIT_ERROR_CODES[errorCode as keyof typeof SPLIT_ERROR_CODES] || `Unknown split error code: ${errorCode}`;
}

/**
 * Get error message for deposit operation
 */
export function getDepositErrorMessage(errorCode: number): string {
  return DEPOSIT_ERROR_CODES[errorCode as keyof typeof DEPOSIT_ERROR_CODES] || `Unknown deposit error code: ${errorCode}`;
}

/**
 * Get error message for transfer operation
 */
export function getTransferErrorMessage(errorCode: number): string {
  return TRANSFER_ERROR_CODES[errorCode as keyof typeof TRANSFER_ERROR_CODES] || `Unknown transfer error code: ${errorCode}`;
}

/**
 * Get error message for withdraw operation
 */
export function getWithdrawErrorMessage(errorCode: number): string {
  return WITHDRAW_ERROR_CODES[errorCode as keyof typeof WITHDRAW_ERROR_CODES] || `Unknown withdraw error code: ${errorCode}`;
}

// ========================
// UTILITY TYPES
// ========================

export type ZKOperation = 'DEPOSIT' | 'SPLIT' | 'TRANSFER' | 'WITHDRAW';

export interface ZKOperationContext {
  operation: ZKOperation;
  userAddress: string;
  timestamp: number;
  nonce: number;
}

// ========================
// BACKEND SERVICE TYPES
// ========================

export interface ZKAttestationService {
  createDepositAttestation(data: ZKDepositData): Promise<BackendAttestation>;
  createSplitAttestation(data: ZKSplitData): Promise<BackendAttestation>;
  createTransferAttestation(data: ZKTransferData): Promise<BackendAttestation>;
  createWithdrawAttestation(data: ZKWithdrawData): Promise<BackendAttestation>;
}

export interface ZKCryptoService {
  generateCommitment(value: bigint, blindingFactor: string): Promise<{
    x: bigint;
    y: bigint;
  }>;
  generateNullifier(utxoId: string, privateKey: string): Promise<string>;
  generateBlindingFactor(): Promise<string>;
}

// ========================
// STORAGE TYPES
// ========================

export interface ZKUTXOStorage {
  savePrivateUTXO(userAddress: string, utxo: PrivateUTXOData): void;
  getPrivateUTXOs(userAddress: string): PrivateUTXOData[];
  markUTXOAsSpent(userAddress: string, utxoId: string): void;
  deleteUTXO(userAddress: string, utxoId: string): void;
  clearAllUTXOs(userAddress: string): void;
}

// ========================
// CONTRACT ABI EXPORT
// ========================

// Import del ABI para usar en el frontend
import ZKUTXOVaultABI from './ZKUTXOVault.abi.json';

export { ZKUTXOVaultABI };

// ========================
// CONTRACT FACTORY FUNCTIONS
// ========================

import { ethers } from 'ethers';

/**
 * Create a ZKUTXOVault contract instance
 */
export function createZKUTXOVaultContract(
  addressOrProvider: string | ethers.Provider,
  signerOrProvider?: ethers.Signer | ethers.Provider
): ZKUTXOVaultContract {
  if (typeof addressOrProvider === 'string') {
    // Address provided, need provider
    const provider = signerOrProvider as ethers.Provider;
    return new ethers.Contract(addressOrProvider, ZKUTXOVaultABI, provider) as unknown as ZKUTXOVaultContract;
  } else {
    // Provider provided
    throw new Error('Contract address required for ZKUTXOVault creation');
  }
}

/**
 * Check if contract is a valid ZKUTXOVault contract
 */
export async function isPrivateUTXOContract(contract: any): Promise<boolean> {
  try {
    // Check if it has the required ZK functions
    return (
      typeof contract.depositAsPrivateUTXO === 'function' &&
      typeof contract.splitPrivateUTXO === 'function' &&
      typeof contract.transferPrivateUTXO === 'function' &&
      typeof contract.withdrawFromPrivateUTXO === 'function'
    );
  } catch {
    return false;
  }
}

/**
 * Validate split parameters before contract call
 */
export function validateSplitParams(params: ZKSplitParams): SplitValidationResult {
  const errors: string[] = [];
  
  // Check input nullifier
  if (!params.inputNullifier || params.inputNullifier === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    errors.push('Invalid input nullifier');
  }
  
  // Check arrays
  if (!params.outputNullifiers || params.outputNullifiers.length === 0) {
    errors.push('No output nullifiers provided');
  }
  
  if (!params.outputUTXOIds || params.outputUTXOIds.length === 0) {
    errors.push('No output UTXO IDs provided');
  }
  
  if (params.outputNullifiers.length !== params.outputUTXOIds.length) {
    errors.push('Array length mismatch');
  }
  
  // Check for duplicates
  const uniqueNullifiers = new Set(params.outputNullifiers);
  if (uniqueNullifiers.size !== params.outputNullifiers.length) {
    errors.push('Duplicate output nullifiers detected');
  }
  
  const uniqueUTXOIds = new Set(params.outputUTXOIds);
  if (uniqueUTXOIds.size !== params.outputUTXOIds.length) {
    errors.push('Duplicate output UTXO IDs detected');
  }
  
  // Check for input/output conflicts
  if (params.outputNullifiers.includes(params.inputNullifier)) {
    errors.push('Output nullifier same as input nullifier');
  }
  
  // Validate individual nullifiers and IDs
  for (const nullifier of params.outputNullifiers) {
    if (!nullifier || nullifier === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      errors.push('Invalid output nullifier found');
      break;
    }
  }
  
  for (const utxoId of params.outputUTXOIds) {
    if (!utxoId || utxoId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      errors.push('Invalid output UTXO ID found');
      break;
    }
  }
  
  if (errors.length > 0) {
    return {
      isValid: false,
      errorCode: 99, // Client-side validation error
      errorMessage: errors.join('; '),
      failedValidations: errors
    };
  }
  
  return {
    isValid: true,
    errorCode: 0
  };
}

/**
 * Create detailed error message from split validation result
 */
export function createSplitErrorMessage(result: SplitValidationResult): string {
  if (result.isValid) return 'No errors';
  
  if (result.errorCode === 99) {
    return `Client validation failed: ${result.errorMessage}`;
  }
  
  const baseMessage = getSplitErrorMessage(result.errorCode);
  return result.errorMessage ? `${baseMessage}: ${result.errorMessage}` : baseMessage;
}

// ========================
// LEGACY TYPE ALIASES (for backward compatibility)
// ========================

export type UTXOVaultContract = ZKUTXOVaultContract;
export type DepositParams = ZKDepositParams;
export type PrivateUTXOCreatedEvent = ZKDepositEvent;
export type PrivateTransferEvent = ZKTransferEvent;
export type PrivateWithdrawalEvent = ZKWithdrawEvent;

// Legacy function aliases
export const createUTXOVaultContract = createZKUTXOVaultContract;
export const UTXO_VAULT_ABI = ZKUTXOVaultABI;

// Legacy param type aliases
export interface DepositAsPrivateUTXOParams extends ZKDepositParams {}
export interface SplitPrivateUTXOParams extends ZKSplitParams {}
export interface TransferPrivateUTXOParams extends ZKTransferParams {}
export interface WithdrawFromPrivateUTXOParams extends ZKWithdrawParams {}

// Additional legacy types for compatibility
export interface SplitOperationContract extends ZKUTXOVaultContract {}
export interface CombineOperationContract extends ZKUTXOVaultContract {}
export interface PrivateUTXOContract extends ZKUTXOVaultContract {}

// Legacy proof params (for backward compatibility)
export interface ProofParams {
  proof: string;
  publicSignals: string[];
}

export interface GeneratorParams {
  g: { x: string; y: string };
  h: { x: string; y: string };
}
