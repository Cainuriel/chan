/**
 * @fileoverview Ethereum helper functions for EOA and smart contract interaction
 * @description Utility functions for wallet connection, transaction handling, and contract interaction
 */

import { ethers, type BigNumberish } from 'ethers';
import {
  type EOAData,
  type EOAKeyDerivation,
  type EOASignatureResult,
  WalletProviderType,
  type MetaMaskProvider,
  type WalletConnectionResult,
  type EthereumTransactionParams,
  type EthereumTransactionReceipt,
  type ERC20TokenData,
  type GasEstimationResult,
  type NetworkConfig,
  type SmartContractCallParams,
  type AccountDerivationParams,
  AccountDerivationMethod,
  type UTXOVaultContract,
  type UTXOVaultCallParams,
  UTXOVaultFunctionName,
  WalletNotConnectedError,
  UnsupportedChainError,
  InsufficientGasError,
  TransactionRevertedError,
  EthereumError,
  ETHEREUM_NETWORKS,
  ERC20_ABI_FRAGMENTS
} from '../types/ethereum.types';

/**
 * Ethereum helper class for EOA and smart contract operations
 */
export class EthereumHelpers {
  private static provider: ethers.BrowserProvider | null = null;
  private static signer: ethers.Signer | null = null;
  private static currentEOA: EOAData | null = null;

  /**
   * Detect and connect to available wallet provider
   * @param preferredProvider - Preferred wallet type
   * @returns Promise resolving to connection result
   */
  static async connectWallet(
    preferredProvider: WalletProviderType = WalletProviderType.METAMASK
  ): Promise<WalletConnectionResult> {
    try {
      let provider: ethers.BrowserProvider;
      let signer: ethers.Signer;

      switch (preferredProvider) {
        case WalletProviderType.METAMASK:
          const result = await this.connectMetaMask();
          if (!result.success) {
            return result;
          }
          provider = result.provider!;
          signer = result.signer!;
          break;

        case WalletProviderType.INJECTED:
          if (!window.ethereum) {
            return {
              success: false,
              error: 'No injected provider found'
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

      // Get account info
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      const ethBalance = await provider.getBalance(address);

      const eoaData: EOAData = {
        address,
        chainId: network.chainId,
        networkName: network.name,
        connected: true,
        providerType: preferredProvider,
        ethBalance: BigInt(ethBalance.toString()),
        lastBalanceUpdate: Date.now()
      };

      // Store references
      this.provider = provider;
      this.signer = signer;
      this.currentEOA = eoaData;

      // Set up event listeners
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
        error: error instanceof Error ? error.message : 'Unknown connection error'
      };
    }
  }

  /**
   * Connect specifically to MetaMask
   * @returns Promise resolving to connection result
   */
  static async connectMetaMask(): Promise<WalletConnectionResult & { provider?: ethers.BrowserProvider }> {
    if (!window.ethereum || !this.isMetaMaskProvider(window.ethereum)) {
      return {
        success: false,
        error: 'MetaMask not detected'
      };
    }

    try {
      const metamask = window.ethereum as MetaMaskProvider;
      
      // Request account access
      const accounts = await metamask.request({
        method: 'eth_requestAccounts'
      });

      if (!accounts || accounts.length === 0) {
        return {
          success: false,
          error: 'No accounts available'
        };
      }

      const provider = new ethers.BrowserProvider(metamask);
      const signer = await provider.getSigner();
      
      return {
        success: true,
        provider,
        signer
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'MetaMask connection failed'
      };
    }
  }

  /**
   * Disconnect wallet and cleanup
   */
  static async disconnectWallet(): Promise<void> {
    this.provider = null;
    this.signer = null;
    this.currentEOA = null;
    
    // Remove event listeners if needed
    if (window.ethereum) {
      window.ethereum.removeAllListeners?.();
    }
  }

  /**
   * Get current connected EOA data
   * @returns Current EOA data or null if not connected
   */
  static getCurrentEOA(): EOAData | null {
    return this.currentEOA;
  }

  /**
   * Get current provider
   * @returns Current provider or throws if not connected
   */
  static getProvider(): ethers.BrowserProvider {
    if (!this.provider) {
      throw new WalletNotConnectedError();
    }
    return this.provider;
  }

  /**
   * Get current signer
   * @returns Current signer or throws if not connected
   */
  static getSigner(): ethers.Signer {
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
  static async signMessage(message: string): Promise<EOASignatureResult> {
    const signer = this.getSigner();
    const address = await signer.getAddress();

    try {
      const signature = await signer.signMessage(message);
      
      // Split signature into components using ethers v6 syntax
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
        'Failed to sign message',
        -32000,
        { message, error: error instanceof Error ? error.message : 'Unknown error' }
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
  static async signTypedData(
    domain: any,
    types: any,
    value: any
  ): Promise<EOASignatureResult> {
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
        'Failed to sign typed data',
        -32000,
        { domain, types, value, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Derive key from EOA for UTXO operations
   * @param params - Derivation parameters
   * @returns Promise resolving to key derivation data
   */
  static async deriveKeyFromEOA(params: AccountDerivationParams): Promise<EOAKeyDerivation> {
    const { baseAddress, purpose, nonce, context, method } = params;

    // Create deterministic message for signing
    const message = `UTXO Key Derivation
Address: ${baseAddress}
Purpose: ${purpose}
Nonce: ${nonce}
Context: ${context || ''}
Timestamp: ${Date.now()}`;

    let signature: string;
    
    switch (method) {
      case AccountDerivationMethod.MESSAGE_SIGNATURE:
        const sigResult = await this.signMessage(message);
        signature = sigResult.signature;
        break;
        
      case AccountDerivationMethod.TYPED_DATA_SIGNATURE:
        const typedData = {
          domain: { name: 'UTXO System', version: '1' },
          types: {
            KeyDerivation: [
              { name: 'baseAddress', type: 'address' },
              { name: 'purpose', type: 'string' },
              { name: 'nonce', type: 'string' },
              { name: 'timestamp', type: 'uint256' }
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

    // Derive deterministic key from signature
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
  static async getERC20TokenInfo(
    tokenAddress: string,
    userAddress?: string
  ): Promise<ERC20TokenData> {
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
        tokenContract.name().catch(() => 'Unknown'),
        tokenContract.symbol().catch(() => 'UNK'),
        tokenContract.decimals().catch(() => 18)
      ]);

      let balance: BigNumberish | undefined;
      let allowance: BigNumberish | undefined;

      if (userAddress) {
        [balance] = await Promise.all([
          tokenContract.balanceOf(userAddress).catch(() => 0n)
        ]);
      }

      return {
        address: tokenAddress,
        symbol,
        name,
        decimals,
        balance: balance ? BigInt(balance.toString()) : undefined,
        allowance: allowance ? BigInt(allowance.toString()) : undefined,
        verified: false // Would need external verification service
      };
    } catch (error) {
      throw new EthereumError(
        `Failed to get token info for ${tokenAddress}`,
        -32000,
        { tokenAddress, error: error instanceof Error ? error.message : 'Unknown error' }
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
  static async approveERC20(
    tokenAddress: string,
    spenderAddress: string,
    amount: bigint
  ): Promise<EthereumTransactionReceipt> {
    const signer = this.getSigner();
    const tokenContract = new ethers.Contract(
      tokenAddress,
      [ERC20_ABI_FRAGMENTS.approve],
      signer
    );

    try {
      console.log('🔄 Approving token spending...', {
        tokenAddress,
        spenderAddress,
        amount: amount.toString()
      });
      
      const tx = await tokenContract.approve(spenderAddress, amount);
      console.log('📝 Approval transaction sent:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('✅ Approval confirmed:', receipt.transactionHash);
      
      return this.formatTransactionReceipt(receipt);
    } catch (error) {
      console.error('❌ Token approval failed:', error);
      
      // Extract more detailed error information
      let errorMessage = 'Unknown error';
      let errorCode = -32000;
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Check for common error patterns
        if (error.message.includes('user rejected')) {
          errorMessage = 'Transaction was rejected by user';
          errorCode = 4001;
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for gas';
          errorCode = -32000;
        } else if (error.message.includes('execution reverted')) {
          errorMessage = 'Transaction reverted - contract may not exist or method failed';
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
  static async estimateGas(params: EthereumTransactionParams): Promise<GasEstimationResult> {
    const provider = this.getProvider();
    const signer = this.getSigner();

    try {
      // Estimate gas limit
      const gasLimit = await provider.estimateGas({
        to: params.to,
        value: params.value || undefined,
        data: params.data
      });

      // Get gas price info
      const feeData = await provider.getFeeData();
      
      let gasPrice = BigInt(0);
      let maxFeePerGas: bigint | undefined;
      let maxPriorityFeePerGas: bigint | undefined;

      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        // EIP-1559
        maxFeePerGas = BigInt(feeData.maxFeePerGas.toString());
        maxPriorityFeePerGas = BigInt(feeData.maxPriorityFeePerGas.toString());
        gasPrice = maxFeePerGas;
      } else if (feeData.gasPrice) {
        // Legacy
        gasPrice = BigInt(feeData.gasPrice.toString());
      }

      const estimatedCost = BigInt(gasLimit.toString()) * gasPrice;

      return {
        gasLimit: BigInt(gasLimit.toString()),
        gasPrice,
        maxFeePerGas,
        maxPriorityFeePerGas,
        estimatedCost,
        confidence: 0.9 // Static confidence, could be improved with historical data
      };
    } catch (error) {
      throw new EthereumError(
        'Failed to estimate gas',
        -32000,
        { params, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Send transaction with proper error handling
   * @param params - Transaction parameters
   * @returns Promise resolving to transaction receipt
   */
  static async sendTransaction(params: EthereumTransactionParams): Promise<EthereumTransactionReceipt> {
    const signer = this.getSigner();

    try {
      const txParams: any = {
        to: params.to,
        value: params.value || undefined,
        data: params.data,
        gasLimit: params.gasLimit || undefined,
        nonce: params.nonce
      };

      // Handle gas pricing (EIP-1559 vs legacy)
      if (params.maxFeePerGas && params.maxPriorityFeePerGas) {
        txParams.maxFeePerGas = params.maxFeePerGas;
        txParams.maxPriorityFeePerGas = params.maxPriorityFeePerGas;
        txParams.type = 2; // EIP-1559
      } else if (params.gasPrice) {
        txParams.gasPrice = params.gasPrice;
        txParams.type = 0; // Legacy
      }

      const tx = await signer.sendTransaction(txParams);
      const receipt = await tx.wait();

      if (!receipt || receipt.status === 0) {
        throw new TransactionRevertedError(undefined, receipt?.hash || tx.hash);
      }

      return this.formatTransactionReceipt(receipt);
    } catch (error) {
      if (error instanceof TransactionRevertedError) {
        throw error;
      }
      throw new EthereumError(
        'Transaction failed',
        -32000,
        { params, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Call smart contract function
   * @param params - Contract call parameters
   * @returns Promise resolving to transaction receipt
   */
  static async callSmartContract(params: SmartContractCallParams): Promise<EthereumTransactionReceipt> {
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
        -32000,
        { params, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Switch to a different network
   * @param networkConfig - Network configuration
   * @returns Promise resolving to success status
   */
  static async switchNetwork(networkConfig: NetworkConfig): Promise<boolean> {
    if (!window.ethereum) {
      throw new EthereumError('No wallet provider available');
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${networkConfig.chainId.toString(16)}` }]
      });
      return true;
    } catch (error: any) {
      // If the chain is not added, add it
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
  static async addNetwork(networkConfig: NetworkConfig): Promise<boolean> {
    if (!window.ethereum) {
      throw new EthereumError('No wallet provider available');
    }

    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
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
        -32000,
        { networkConfig, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Set up event listeners for wallet events
   */
  private static setupEventListeners(): void {
    if (!window.ethereum) return;

    window.ethereum.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length === 0) {
        this.disconnectWallet();
      } else if (this.currentEOA && accounts[0] !== this.currentEOA.address) {
        // Account changed, reconnect
        this.connectWallet(this.currentEOA.providerType);
      }
    });

    window.ethereum.on('chainChanged', (chainId: string) => {
      // Chain changed, update current EOA
      if (this.currentEOA) {
        this.currentEOA.chainId = BigInt(parseInt(chainId, 16));
        this.currentEOA.networkName = this.getNetworkName(Number(this.currentEOA.chainId));
      }
    });

    window.ethereum.on('disconnect', () => {
      this.disconnectWallet();
    });
  }

  /**
   * Helper to check if provider is MetaMask
   */
  private static isMetaMaskProvider(provider: any): provider is MetaMaskProvider {
    return provider && provider.isMetaMask === true;
  }

  /**
   * Get network name from chain ID
   */
  private static getNetworkName(chainId: number): string {
    const network = Object.values(ETHEREUM_NETWORKS).find(n => Number(n.chainId) === chainId);
    return network?.name || `Unknown (${chainId})`;
  }

  /**
   * Format ethers transaction receipt to our type
   */
  private static formatTransactionReceipt(receipt: any): EthereumTransactionReceipt {
    return {
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      gasUsed: BigInt(receipt.gasUsed.toString()),
      effectiveGasPrice: BigInt(receipt.gasPrice?.toString() || '0'),
      status: receipt.status,
      contractAddress: receipt.contractAddress,
      logs: receipt.logs.map((log: any) => ({
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
  static formatTokenAmount(amount: bigint, decimals: number): string {
    return ethers.formatUnits(amount.toString(), decimals);
  }

  /**
   * Utility to parse token amounts
   */
  static parseTokenAmount(amount: string, decimals: number): bigint {
    return BigInt(ethers.parseUnits(amount, decimals).toString());
  }

  /**
   * Check if address is valid Ethereum address
   */
  static isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  /**
   * Get short address format for display
   */
  static getShortAddress(address: string, start: number = 6, end: number = 4): string {
    if (!this.isValidAddress(address)) return address;
    return `${address.slice(0, start)}...${address.slice(-end)}`;
  }

  /**
   * Wait for transaction confirmation
   */
  static async waitForConfirmation(
    txHash: string,
    confirmations: number = 1
  ): Promise<EthereumTransactionReceipt> {
    const provider = this.getProvider();
    
    try {
      const receipt = await provider.waitForTransaction(txHash, confirmations);
      return this.formatTransactionReceipt(receipt);
    } catch (error) {
      throw new EthereumError(
        `Failed to wait for transaction confirmation: ${txHash}`,
        -32000,
        { txHash, confirmations, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }
}

/**
 * Export singleton instance for convenience
 */
export const ethereumHelpers = EthereumHelpers;

/**
 * Global window type augmentation for ethereum provider
 */
declare global {
  interface Window {
    ethereum?: any;
  }
}