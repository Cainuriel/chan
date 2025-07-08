/**
 * @fileoverview TypeScript type definitions for Ethereum EOA integration
 * @description Types for EOA, MetaMask, ethers.js, and smart contract interaction
 */

import { type BigNumberish, ethers } from 'ethers';

/**
 * Externally Owned Account (EOA) data
 */
export interface EOAData {
  /** Ethereum address */
  address: string;
  /** Chain ID */
  chainId: bigint;
  /** Network name */
  networkName: string;
  /** Whether this EOA is connected */
  connected: boolean;
  /** Provider type */
  providerType: WalletProviderType;
  /** Last known ETH balance */
  ethBalance?: bigint;
  /** Last balance update timestamp */
  lastBalanceUpdate?: number;
}

/**
 * Supported wallet provider types
 */
export enum WalletProviderType {
  METAMASK = 'metamask',
  WALLET_CONNECT = 'walletconnect',
  COINBASE_WALLET = 'coinbase',
  INJECTED = 'injected',
  CUSTOM = 'custom'
}

/**
 * EOA key derivation data for UTXO integration
 */
export interface EOAKeyDerivation {
  /** Original EOA address */
  eoaAddress: string;
  /** Derived key for UTXO */
  derivedKey: string;
  /** Signature used in derivation */
  signature: string;
  /** Message that was signed */
  message: string;
  /** Derivation path or method */
  derivationMethod: string;
  /** Timestamp of derivation */
  timestamp: number;
  /** Nonce used in derivation */
  nonce: string;
}

/**
 * Ethereum transaction parameters
 */
export interface EthereumTransactionParams {
  /** Recipient address */
  to: string;
  /** Transaction value in wei */
  value?: bigint;
  /** Transaction data */
  data?: string;
  /** Gas limit */
  gasLimit?: bigint;
  /** Gas price (legacy) */
  gasPrice?: bigint;
  /** Max fee per gas (EIP-1559) */
  maxFeePerGas?: bigint;
  /** Max priority fee per gas (EIP-1559) */
  maxPriorityFeePerGas?: bigint;
  /** Transaction nonce */
  nonce?: number;
  /** Transaction type (0, 1, 2) */
  type?: number;
}

/**
 * Ethereum transaction receipt
 */
export interface EthereumTransactionReceipt {
  /** Transaction hash */
  transactionHash: string;
  /** Block number */
  blockNumber: number;
  /** Block hash */
  blockHash: string;
  /** Gas used */
  gasUsed: bigint;
  /** Effective gas price */
  effectiveGasPrice: bigint;
  /** Transaction status (1 = success, 0 = failure) */
  status: number;
  /** Contract address (if deployment) */
  contractAddress?: string;
  /** Event logs */
  logs: EthereumLog[];
  /** Confirmation count */
  confirmations: number;
}

/**
 * Ethereum event log
 */
export interface EthereumLog {
  /** Contract address that emitted the log */
  address: string;
  /** Event topics */
  topics: string[];
  /** Event data */
  data: string;
  /** Block number */
  blockNumber: number;
  /** Transaction hash */
  transactionHash: string;
  /** Log index */
  logIndex: number;
  /** Whether log was removed */
  removed: boolean;
}

/**
 * ERC20 token data
 */
export interface ERC20TokenData {
  /** Token contract address */
  address: string;
  /** Token symbol */
  symbol: string;
  /** Token name */
  name: string;
  /** Number of decimals */
  decimals: number;
  /** Total supply */
  totalSupply?: bigint;
  /** User's balance */
  balance?: bigint;
  /** User's allowance for UTXOVault */
  allowance?: bigint;
  /** Token logo URI */
  logoURI?: string;
  /** Whether token is verified */
  verified: boolean;
}

/**
 * Smart contract interaction parameters
 */
export interface SmartContractCallParams {
  /** Contract address */
  contractAddress: string;
  /** Function name */
  functionName: string;
  /** Function arguments */
  args: any[];
  /** Transaction options */
  options?: EthereumTransactionParams;
  /** ABI fragment for the function */
  abi?: ethers.Fragment;
}

/**
 * MetaMask provider interface
 */
export interface MetaMaskProvider {
  /** Whether MetaMask is installed */
  isMetaMask: boolean;
  /** Request method */
  request: (args: MetaMaskRequestArgs) => Promise<any>;
  /** Event listener */
  on: (event: string, handler: (...args: any[]) => void) => void;
  /** Remove event listener */
  removeListener: (event: string, handler: (...args: any[]) => void) => void;
  /** Current chain ID */
  chainId?: string;
  /** Selected address */
  selectedAddress?: string;
}

/**
 * MetaMask request arguments
 */
export interface MetaMaskRequestArgs {
  /** RPC method */
  method: string;
  /** Method parameters */
  params?: any[];
}

/**
 * Wallet connection result
 */
export interface WalletConnectionResult {
  /** Whether connection was successful */
  success: boolean;
  /** Connected EOA data */
  eoa?: EOAData;
  /** Error message if failed */
  error?: string;
  /** Provider instance */
  provider?: ethers.Provider;
  /** Signer instance */
  signer?: ethers.Signer;
}

/**
 * Network configuration
 */
export interface NetworkConfig {
  /** Chain ID */
  chainId: number;
  /** Network name */
  name: string;
  /** RPC URLs */
  rpcUrls: string[];
  /** Native currency */
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  /** Block explorer URLs */
  blockExplorerUrls?: string[];
  /** Whether this is a testnet */
  testnet: boolean;
}

/**
 * Gas estimation result
 */
export interface GasEstimationResult {
  /** Estimated gas limit */
  gasLimit: bigint;
  /** Current gas price */
  gasPrice: bigint;
  /** Max fee per gas (EIP-1559) */
  maxFeePerGas?: bigint;
  /** Max priority fee per gas (EIP-1559) */
  maxPriorityFeePerGas?: bigint;
  /** Estimated total cost in wei */
  estimatedCost: bigint;
  /** Estimation confidence (0-1) */
  confidence: number;
}

/**
 * Signature result for EOA operations
 */
export interface EOASignatureResult {
  /** The signature */
  signature: string;
  /** Message that was signed */
  message: string;
  /** Signer address */
  signer: string;
  /** Recovery ID */
  recoveryId?: number;
  /** Signature components */
  r?: string;
  s?: string;
  v?: number;
}

/**
 * Ethereum account derivation parameters
 */
export interface AccountDerivationParams {
  /** Base EOA address */
  baseAddress: string;
  /** Derivation purpose */
  purpose: string;
  /** Nonce for uniqueness */
  nonce: string;
  /** Additional context */
  context?: string;
  /** Derivation method */
  method: AccountDerivationMethod;
}

export enum AccountDerivationMethod {
  MESSAGE_SIGNATURE = 'message_signature',
  TYPED_DATA_SIGNATURE = 'typed_data_signature',
  DETERMINISTIC_HASH = 'deterministic_hash'
}

/**
 * UTXOVault contract interaction types
 */
export interface UTXOVaultContract {
  /** Contract address */
  address: string;
  /** Contract ABI */
  abi: ethers.Interface;
  /** Ethers contract instance */
  contract: ethers.Contract;
  /** Connected signer */
  signer: ethers.Signer;
}

/**
 * UTXOVault function call parameters
 */
export interface UTXOVaultCallParams {
  /** Function name */
  functionName: UTXOVaultFunctionName;
  /** Function parameters */
  params: any[];
  /** Transaction options */
  options?: EthereumTransactionParams;
}

export enum UTXOVaultFunctionName {
  DEPOSIT_AS_UTXO = 'depositAsUTXO',
  WITHDRAW_FROM_UTXO = 'withdrawFromUTXO',
  SPLIT_UTXO = 'splitUTXO',
  COMBINE_UTXOS = 'combineUTXOs',
  TRANSFER_UTXO = 'transferUTXO',
  GET_UTXO_INFO = 'getUTXOInfo',
  GET_UTXOS_BY_OWNER = 'getUTXOsByOwner'
}

/**
 * Ethereum wallet manager configuration
 */
export interface EthereumWalletConfig {
  /** Preferred provider type */
  preferredProvider: WalletProviderType;
  /** Auto-connect on initialization */
  autoConnect: boolean;
  /** Network configurations */
  networks: NetworkConfig[];
  /** Default network chain ID */
  defaultChainId: number;
  /** Cache duration for balances (ms) */
  balanceCacheTimeout: number;
  /** Enable transaction watching */
  enableTxWatch: boolean;
  /** Transaction confirmation requirements */
  confirmationRequirements: number;
}

/**
 * Ethereum events
 */
export interface EthereumEvents {
  /** Emitted when wallet connects */
  'wallet:connected': (eoa: EOAData) => void;
  /** Emitted when wallet disconnects */
  'wallet:disconnected': () => void;
  /** Emitted when account changes */
  'account:changed': (newAddress: string) => void;
  /** Emitted when chain changes */
  'chain:changed': (chainId: number) => void;
  /** Emitted when transaction is sent */
  'transaction:sent': (txHash: string) => void;
  /** Emitted when transaction is confirmed */
  'transaction:confirmed': (receipt: EthereumTransactionReceipt) => void;
  /** Emitted when transaction fails */
  'transaction:failed': (error: EthereumError) => void;
}

/**
 * Ethereum-specific errors
 */
export class EthereumError extends Error {
  constructor(
    message: string,
    public code?: number,
    public data?: any
  ) {
    super(message);
    this.name = 'EthereumError';
  }
}

export class WalletNotConnectedError extends EthereumError {
  constructor() {
    super('Wallet not connected', 4001);
    this.name = 'WalletNotConnectedError';
  }
}

export class UnsupportedChainError extends EthereumError {
  constructor(chainId: number) {
    super(`Unsupported chain: ${chainId}`, 4902, { chainId });
    this.name = 'UnsupportedChainError';
  }
}

export class InsufficientGasError extends EthereumError {
  constructor(required: bigint, available: bigint) {
    super(`Insufficient gas: required ${required}, available ${available}`, -32000, {
      required,
      available
    });
    this.name = 'InsufficientGasError';
  }
}

export class TransactionRevertedError extends EthereumError {
  constructor(reason?: string, txHash?: string) {
    super(`Transaction reverted${reason ? `: ${reason}` : ''}`, -32000, {
      reason,
      txHash
    });
    this.name = 'TransactionRevertedError';
  }
}

/**
 * Type guards for runtime checking
 */
export function isEOAData(obj: any): obj is EOAData {
  return (
    typeof obj === 'object' &&
    typeof obj.address === 'string' &&
    typeof obj.chainId === 'number' &&
    typeof obj.connected === 'boolean'
  );
}

export function isEthereumTransactionReceipt(obj: any): obj is EthereumTransactionReceipt {
  return (
    typeof obj === 'object' &&
    typeof obj.transactionHash === 'string' &&
    typeof obj.blockNumber === 'number' &&
    typeof obj.status === 'number'
  );
}

export function isMetaMaskProvider(provider: any): provider is MetaMaskProvider {
  return (
    provider &&
    typeof provider.request === 'function' &&
    provider.isMetaMask === true
  );
}

/**
 * Common network configurations
 */
export const ETHEREUM_NETWORKS: Record<string, NetworkConfig> = {
  mainnet: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    rpcUrls: ['https://mainnet.infura.io/v3/', 'https://eth-mainnet.alchemyapi.io/v2/'],
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    blockExplorerUrls: ['https://etherscan.io'],
    testnet: false
  },
  polygon: {
    chainId: 137,
    name: 'Polygon Mainnet',
    rpcUrls: ['https://polygon-rpc.com/'],
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    },
    blockExplorerUrls: ['https://polygonscan.com'],
    testnet: false
  },
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    rpcUrls: ['https://sepolia.infura.io/v3/'],
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'SEP',
      decimals: 18
    },
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
    testnet: true
  }
};

/**
 * Standard ERC20 ABI fragments for common operations
 */
export const ERC20_ABI_FRAGMENTS = {
  balanceOf: 'function balanceOf(address owner) view returns (uint256)',
  allowance: 'function allowance(address owner, address spender) view returns (uint256)',
  approve: 'function approve(address spender, uint256 amount) returns (bool)',
  transfer: 'function transfer(address to, uint256 amount) returns (bool)',
  transferFrom: 'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  name: 'function name() view returns (string)',
  symbol: 'function symbol() view returns (string)',
  decimals: 'function decimals() view returns (uint8)'
};