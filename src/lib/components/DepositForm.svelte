<!-- src/lib/components/DepositForm.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PrivateUTXOManager } from '../PrivateUTXOManager';
  import type { ERC20TokenData } from '../../types/ethereum.types';

  // Props
  export let utxoManager: PrivateUTXOManager;
  export let privacyMode: boolean = true;

  // Event dispatcher
  const dispatch = createEventDispatcher();

  // Form state
  let tokenAddress = '';
  let amount = '';
  let customBlindingFactor = '';
  let useCustomBlinding = false;
  let isDepositing = false;
  let tokenData: ERC20TokenData | null = null;
  let isLoadingToken = false;
  let tokenError = '';
  let depositError = '';

  // Common ERC20 tokens for quick selection
  const popularTokens = [
    {
      address: '0xA0b86a33E6441d5c97b57dc4a2B7C4b8A3B6A8A8',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6
    },
    {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6
    },
    {
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18
    }
  ];

  // Watch token address changes
  $: if (tokenAddress && tokenAddress.length === 42) {
    loadTokenData();
  }

  async function loadTokenData() {
    if (!tokenAddress || tokenAddress.length !== 42) {
      tokenData = null;
      return;
    }

    isLoadingToken = true;
    tokenError = '';

    try {
      const currentAccount = utxoManager.currentAccount;
      if (!currentAccount) {
        throw new Error('No account connected');
      }

      // Get token info from ethereum helpers
      tokenData = await utxoManager['ethereum'].getERC20TokenInfo(
        tokenAddress, 
        currentAccount.address
      );
      
      if (!tokenData.verified) {
        tokenError = 'Token not verified - proceed with caution';
      }
    } catch (error) {
      console.error('Failed to load token data:', error);
      tokenError = 'Failed to load token information';
      tokenData = null;
    } finally {
      isLoadingToken = false;
    }
  }

async function handleDeposit() {
    if (!tokenData || !amount || !utxoManager.currentAccount) {
      console.log('❌ Missing required data:', { tokenData: !!tokenData, amount, account: !!utxoManager.currentAccount });
      return;
    }

    isDepositing = true;
    depositError = '';

    try {
      console.log('🚀 Starting deposit process...');
      console.log('📊 Deposit data:', {
        amount,
        tokenAddress,
        tokenSymbol: tokenData.symbol,
        accountAddress: utxoManager.currentAccount.address
      });

      // Parse amount with token decimals - safer conversion
      const amountFloat = parseFloat(amount);
      if (isNaN(amountFloat) || amountFloat <= 0) {
        throw new Error('Invalid amount');
      }
      
      // Convert to string with proper decimals to avoid floating point issues
      const decimalsNum = Number(tokenData.decimals);
      const amountStr = amountFloat.toFixed(decimalsNum);
      const [integerPart, decimalPart = ''] = amountStr.split('.');
      const paddedDecimal = decimalPart.padEnd(decimalsNum, '0');
      const fullAmountStr = integerPart + paddedDecimal;
      const amountBigInt = BigInt(fullAmountStr);

      console.log('💰 Amount conversion:', {
        input: amount,
        float: amountFloat,
        decimals: decimalsNum,
        bigInt: amountBigInt.toString()
      });

      // Prepare deposit parameters
      const depositParams = {
        amount: amountBigInt,
        tokenAddress: tokenAddress,
        owner: utxoManager.currentAccount.address,
        blindingFactor: useCustomBlinding && customBlindingFactor ? 
          customBlindingFactor : undefined
      };

      console.log('🔐 Calling createPrivateUTXO...');
      // Execute deposit - always use createPrivateUTXO (simplified contract only supports private UTXOs)
      const result = await utxoManager.createPrivateUTXO(depositParams);

      console.log('📄 Deposit result:', result);

      if (result.success) {
        // Reset form
        amount = '';
        customBlindingFactor = '';
        useCustomBlinding = false;
        depositError = '';
        
        console.log('✅ Deposit successful!');
        
        // Notify parent
        dispatch('deposited', {
          utxoId: result.createdUTXOIds?.[0],
          amount: amountBigInt,
          tokenAddress,
          txHash: result.transactionHash
        });
      } else {
        console.error('❌ Deposit failed:', result.error);
        depositError = result.error || 'Deposit failed';
      }
    } catch (error) {
      console.error('❌ Deposit error:', error);
      
      // Extract user-friendly error messages
      let errorMessage = 'An unexpected error occurred';
      
      if (error instanceof Error) {
        if (error.message.includes('user rejected')) {
          errorMessage = 'Transaction was rejected. Please try again.';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for gas fees.';
        } else if (error.message.includes('Zenroom') || error.message.includes('nonce')) {
          errorMessage = 'Cryptographic operation failed. Please refresh the page and try again.';
        } else if (error.message.includes('Failed to approve token')) {
          errorMessage = 'Token approval failed. Please check your wallet and try again.';
        } else if (error.message.includes('execution reverted')) {
          errorMessage = 'Transaction failed. The token contract may not be valid.';
        } else if (error.message.includes('unsupported addressable value')) {
          errorMessage = 'UTXO contract not properly initialized. Please check the contract address configuration.';
        } else if (error.message.includes('UTXO contract not initialized')) {
          errorMessage = 'UTXO contract not initialized. Please verify the contract address and try reconnecting your wallet.';
        } else {
          errorMessage = error.message;
        }
      }
      
      depositError = errorMessage;
    } finally {
      isDepositing = false;
    }
  }

  function selectPopularToken(token: typeof popularTokens[0]) {
    tokenAddress = token.address;
  }

  function formatBalance(balance: bigint | undefined, decimals: number): string {
    if (!balance) return '0';
    const divisor = 10n ** BigInt(decimals);
    const quotient = balance / divisor;
    const remainder = balance % divisor;
    
    if (remainder === 0n) {
      return quotient.toString();
    }
    
    const remainderStr = remainder.toString().padStart(decimals, '0');
    const trimmedRemainder = remainderStr.replace(/0+$/, '');
    
    return trimmedRemainder ? `${quotient}.${trimmedRemainder}` : quotient.toString();
  }

  function setMaxAmount() {
    if (tokenData?.balance) {
      amount = formatBalance(tokenData.balance, tokenData.decimals);
    }
  }

  function isValidAmount(): boolean {

    if (!amount || !tokenData) {
      return false;
    }
    
    try {
      const amountFloat = parseFloat(amount);
      if (isNaN(amountFloat) || amountFloat <= 0) {
        return false;
      }
      
      // Convert to string with proper decimals to avoid floating point issues
      const decimalsNum = Number(tokenData.decimals);
      const amountStr = amountFloat.toFixed(decimalsNum);
      const [integerPart, decimalPart = ''] = amountStr.split('.');
      const paddedDecimal = decimalPart.padEnd(decimalsNum, '0');
      const fullAmountStr = integerPart + paddedDecimal;
      const amountBigInt = BigInt(fullAmountStr);
      
      const isValid = amountBigInt > 0n && (!tokenData.balance || amountBigInt <= tokenData.balance);
      console.log(`isValid`, isValid);

      return isValid;
    } catch (error) {
      return false;
    }
  }

  // Helper function to safely convert amount to BigInt
  function parseAmountToBigInt(amountStr: string, decimals: number): bigint {
    try {
      const amountFloat = parseFloat(amountStr);
      if (isNaN(amountFloat) || amountFloat <= 0) {
        return 0n;
      }
      
      const amountFixed = amountFloat.toFixed(decimals);
      const [integerPart, decimalPart = ''] = amountFixed.split('.');
      const paddedDecimal = decimalPart.padEnd(decimals, '0');
      const fullAmountStr = integerPart + paddedDecimal;
      return BigInt(fullAmountStr);
    } catch {
      return 0n;
    }
  }

  // Helper function to check if amount exceeds balance
  function exceedsBalance(): boolean {
    if (!amount || !tokenData || !tokenData.balance) return false;
    const amountBigInt = parseAmountToBigInt(amount, tokenData.decimals);
    return amountBigInt > tokenData.balance;
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
    <div class="flex items-center justify-between mb-2">
      <h2 class="text-xl font-bold text-white">Deposit ERC20 as Private UTXO</h2>
      <div class="flex items-center space-x-2 px-3 py-1 rounded-lg bg-purple-600/20 border border-purple-500/50">
        <span class="text-lg">🔐</span>
        <span class="text-sm font-medium text-purple-300">
          Private Mode Only
        </span>
      </div>
    </div>
    <p class="text-gray-300 text-sm">
      Convert your ERC20 tokens into privacy-preserving UTXOs using Pedersen commitments
    </p>
  </div>

  <!-- Popular Tokens -->
  <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
    <h3 class="text-lg font-semibold text-white mb-4">Popular Tokens</h3>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      {#each popularTokens as token}
        <button
          on:click={() => selectPopularToken(token)}
          class="flex items-center space-x-3 p-3 rounded-lg border border-white/20 hover:border-white/40 hover:bg-white/10 transition-all duration-200 text-left"
        >
          <div class="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
            <span class="text-white text-xs font-bold">
              {token.symbol.substring(0, 2)}
            </span>
          </div>
          <div>
            <div class="text-white font-medium">{token.symbol}</div>
            <div class="text-gray-400 text-sm">{token.name}</div>
          </div>
        </button>
      {/each}
    </div>
  </div>

  <!-- Deposit Form -->
  <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
    <form on:submit|preventDefault={handleDeposit} class="space-y-6">
      <!-- Token Address -->
      <div>
        <label for="token-address" class="block text-sm font-medium text-white mb-2">
          Token Contract Address
        </label>
        <input
          id="token-address"
          type="text"
          bind:value={tokenAddress}
          placeholder="0x..."
          class="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200"
          required
        />
        
        {#if isLoadingToken}
          <div class="mt-2 flex items-center space-x-2 text-blue-400 text-sm">
            <div class="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
            <span>Loading token information...</span>
          </div>
        {/if}
        
        {#if tokenError}
          <div class="mt-2 text-yellow-400 text-sm">
            ⚠️ {tokenError}
          </div>
        {/if}
      </div>

      <!-- Token Info -->
      {#if tokenData}
        <div class="bg-white/5 rounded-lg p-4 border border-white/10">
          <div class="flex items-center space-x-3 mb-3">
            <div class="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center">
              <span class="text-white font-bold">
                {tokenData.symbol.substring(0, 2)}
              </span>
            </div>
            <div>
              <div class="text-white font-semibold text-lg">{tokenData.symbol}</div>
              <div class="text-gray-400">{tokenData.name}</div>
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-gray-400">Decimals:</span>
              <span class="text-white ml-2">{tokenData.decimals}</span>
            </div>
            <div>
              <span class="text-gray-400">Your Balance:</span>
              <span class="text-white ml-2">
                {formatBalance(tokenData.balance, tokenData.decimals)} {tokenData.symbol}
              </span>
            </div>
          </div>
        </div>
      {/if}

      <!-- Amount -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <label for="deposit-amount" class="text-sm font-medium text-white">
            Amount to Deposit
          </label>
          {#if tokenData?.balance}
            <button
              type="button"
              on:click={setMaxAmount}
              class="text-purple-400 hover:text-purple-300 text-sm font-medium"
            >
              Max: {formatBalance(tokenData.balance, tokenData.decimals)}
            </button>
          {/if}
        </div>
        
        <div class="relative">
          <input
            id="deposit-amount"
            type="number"
            bind:value={amount}
            placeholder="0.00"
            step="any"
            min="0"
            class="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 pr-20 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200"
            required
          />
          {#if tokenData}
            <div class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 font-medium">
              {tokenData.symbol}
            </div>
          {/if}
        </div>
        
        {#if amount && tokenData && !isValidAmount()}
          <div class="mt-2 text-red-400 text-sm">
            {#if exceedsBalance()}
              Insufficient balance
            {:else}
              Invalid amount
            {/if}
          </div>
        {/if}
      </div>

      <!-- Advanced Options -->
      <div class="border-t border-white/10 pt-6">
        <button
          type="button"
          on:click={() => useCustomBlinding = !useCustomBlinding}
          class="flex items-center space-x-2 text-purple-400 hover:text-purple-300 mb-4"
        >
          <span>{useCustomBlinding ? '▼' : '▶'}</span>
          <span>Advanced Privacy Options</span>
        </button>
        
        {#if useCustomBlinding}
          <div class="pl-6 space-y-4">
            <div>
              <label for="custom-blinding-factor" class="block text-sm font-medium text-white mb-2">
                Custom Blinding Factor (Optional)
              </label>
              <input
                id="custom-blinding-factor"
                type="text"
                bind:value={customBlindingFactor}
                placeholder="Leave empty for auto-generation"
                class="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200"
              />
              <div class="mt-2 text-gray-400 text-sm">
                💡 A custom blinding factor allows you to reproduce the same commitment later. 
                Leave empty for maximum privacy.
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Submit Button -->
      <button
        type="submit"
        class="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
      >
        {#if isDepositing}
          <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          <span>Creating Private UTXO...</span>
        {:else}
          <span>🔐</span>
          <span>Deposit as Private UTXO</span>
        {/if}
      </button>
      
      {#if depositError}
        <div class="mt-4 p-4 bg-red-600/20 border border-red-600/30 rounded-lg">
          <div class="flex items-center space-x-2 text-red-400">
            <span>❌</span>
            <span class="font-medium">Deposit Failed</span>
          </div>
          <div class="mt-2 text-red-300 text-sm">
            {depositError}
          </div>
        </div>
      {/if}
    </form>
  </div>

  <!-- Info Box -->
  <div class="bg-blue-600/20 border border-blue-600/30 rounded-lg p-4">
    <div class="flex space-x-3">
      <div class="text-blue-400 text-xl">ℹ️</div>
      <div class="text-sm text-blue-200">
        <div class="font-medium mb-1">How it works:</div>
        <ol class="list-decimal list-inside space-y-1 text-blue-300">
          <li>Your ERC20 tokens are transferred to the UTXO Vault contract</li>
          <li>A Pedersen commitment is created using Zenroom cryptography on BN254</li>
          <li>Range proofs ensure the amount is valid without revealing it</li>
          <li>You receive a private UTXO with mathematical privacy guarantees</li>
          <li>All operations use real cryptographic verification - no shortcuts</li>
        </ol>
      </div>
    </div>
  </div>
</div>