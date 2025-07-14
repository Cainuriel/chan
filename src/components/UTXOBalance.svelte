<!-- src/lib/components/UTXOBalance.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PrivateUTXO } from '../lib/PrivateUTXOManager';
  import type { ERC20TokenData } from '../types/ethereum.types';
  import { EthereumHelpers } from '../utils/ethereum.helpers';

  // Props - Only private UTXOs supported
  export let privateUTXOs: PrivateUTXO[] = [];

  // Event dispatcher
  const dispatch = createEventDispatcher();

  // Local state
  let selectedTokenAddress: string = 'all';
  let sortBy: 'value' | 'timestamp' = 'timestamp';
  let sortOrder: 'asc' | 'desc' = 'desc';
  let showSpent = false;

  // Token metadata cache
  let tokenMetadataCache: Record<string, ERC20TokenData> = {};
  let isLoadingMetadata = false;
  let metadataLoaded = false;

  // Filtered UTXOs
  let filteredPrivateUTXOs: PrivateUTXO[] = [];

  $: if(privateUTXOs.length !== 0) {
    // Load token metadata for unique tokens
    const uniqueTokens = [...new Set(privateUTXOs.map(u => u.tokenAddress))];
    loadTokenMetadata(uniqueTokens);

    // Filter private UTXOs
    filteredPrivateUTXOs = privateUTXOs
      .filter(utxo => selectedTokenAddress === 'all' || utxo.tokenAddress === selectedTokenAddress)
      .filter(utxo => showSpent || !utxo.isSpent)
      .sort((a, b) => {
        let comparison = 0;
        
        switch (sortBy) {
          case 'value':
            comparison = Number(a.value - b.value);
            break;
          case 'timestamp':
            comparison = Number(a.timestamp - b.timestamp);
            break;
        }
        
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }

  // Token metadata loading
  async function loadTokenMetadata(tokenAddresses: string[]) {
    isLoadingMetadata = true;
    
    for (const tokenAddress of tokenAddresses) {
      if (!tokenMetadataCache[tokenAddress]) {
        try {
          const tokenData = await EthereumHelpers.getERC20TokenInfo(tokenAddress);
          tokenMetadataCache[tokenAddress] = tokenData;
          tokenMetadataCache = { ...tokenMetadataCache };
        } catch (error) {
          console.error(`Failed to load token metadata for ${tokenAddress}:`, error);
        }
      }
    }
    
    isLoadingMetadata = false;
    metadataLoaded = true;
  }

  function getTokenMetadata(tokenAddress: string): ERC20TokenData {
    return tokenMetadataCache[tokenAddress] || {
      address: tokenAddress,
      symbol: 'Unknown',
      name: 'Unknown Token',
      decimals: 18,
      balance: BigInt(0),
      allowance: BigInt(0),
      verified: false
    };
  }

  function formatValue(value: bigint, decimals: number = 18): string {
    const divisor = BigInt(10 ** decimals);
    const quotient = value / divisor;
    const remainder = value % divisor;
    
    if (remainder === BigInt(0)) {
      return quotient.toString();
    }
    
    const remainderStr = remainder.toString().padStart(decimals, '0');
    const trimmedRemainder = remainderStr.replace(/0+$/, '');
    
    return trimmedRemainder ? `${quotient}.${trimmedRemainder}` : quotient.toString();
  }

  function formatTimestamp(timestamp: bigint): string {
    const date = new Date(Number(timestamp));
    return date.toLocaleString();
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  function refresh() {
    dispatch('refresh');
  }

  // Get unique token addresses for filter
  $: uniqueTokens = [...new Set(privateUTXOs.map(u => u.tokenAddress))];

  // Get balance for specific token
  function getTokenBalance(tokenAddress: string): bigint {
    return privateUTXOs
      .filter(u => u.tokenAddress === tokenAddress && !u.isSpent)
      .reduce((sum, u) => sum + u.value, BigInt(0));
  }
</script>

<div class="bg-gray-800 rounded-lg p-6">
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-xl font-bold text-white flex items-center gap-2">
      🔒 Private UTXO Balance
    </h2>
    <button
      on:click={refresh}
      class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
    >
      🔄 Refresh
    </button>
  </div>

  {#if isLoadingMetadata}
    <div class="text-center py-8">
      <div class="animate-spin text-purple-500 text-3xl mb-2">⚡</div>
      <p class="text-gray-400">Loading token metadata...</p>
    </div>
  {:else if metadataLoaded || privateUTXOs.length === 0}
    <!-- Token Summary Cards -->
    {#if uniqueTokens.length > 0}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {#each uniqueTokens as tokenAddress}
          {@const tokenData = getTokenMetadata(tokenAddress)}
          {@const balance = getTokenBalance(tokenAddress)}
          <div class="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:border-purple-500 transition-colors">
            <div class="flex justify-between items-start mb-2">
              <div>
                <h3 class="text-white font-medium">{tokenData.symbol}</h3>
                <p class="text-gray-400 text-sm">{tokenData.name}</p>
              </div>
              <div class="text-right">
                <div class="text-white font-bold text-lg">
                  {formatValue(balance, tokenData.decimals)}
                </div>
                <div class="text-gray-400 text-sm">
                  {privateUTXOs.filter(u => u.tokenAddress === tokenAddress && !u.isSpent).length} UTXOs
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Filters and Controls -->
    <div class="flex flex-wrap items-center gap-4 mb-6 p-4 bg-gray-700 rounded-lg">
      <div class="flex items-center gap-2">
        <label for="token-select" class="text-white text-sm">Token:</label>
        <select
          id="token-select"
          bind:value={selectedTokenAddress}
          class="bg-gray-600 border border-gray-500 rounded px-3 py-1 text-white text-sm"
        >
          <option value="all">All Tokens</option>
          {#each uniqueTokens as tokenAddress}
            {@const tokenData = getTokenMetadata(tokenAddress)}
            <option value={tokenAddress}>{tokenData.symbol}</option>
          {/each}
        </select>
      </div>

      <div class="flex items-center gap-2">
        <label for="sort-select" class="text-white text-sm">Sort:</label>
        <select
          id="sort-select"
          bind:value={sortBy}
          class="bg-gray-600 border border-gray-500 rounded px-3 py-1 text-white text-sm"
        >
          <option value="timestamp">Date</option>
          <option value="value">Value</option>
        </select>
      </div>

      <button
        on:click={() => sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'}
        class="bg-gray-600 border border-gray-500 rounded px-3 py-1 text-white text-sm hover:bg-gray-500"
      >
        {sortOrder === 'asc' ? '↑' : '↓'}
      </button>

      <div class="flex items-center gap-2">
        <input
          id="show-spent"
          type="checkbox"
          bind:checked={showSpent}
          class="rounded"
        />
        <label for="show-spent" class="text-white text-sm">Show Spent</label>
      </div>

      <div class="ml-auto text-sm text-gray-400">
        {filteredPrivateUTXOs.length} of {privateUTXOs.length} Private UTXOs
      </div>
    </div>

    <!-- UTXO List -->
    <div class="space-y-4">
      {#if filteredPrivateUTXOs.length === 0}
        <div class="text-center py-8">
          <div class="text-gray-400 text-lg mb-2">🔒</div>
          <p class="text-gray-400">No private UTXOs found</p>
          {#if privateUTXOs.length === 0}
            <p class="text-gray-500 text-sm">Create your first private UTXO to get started</p>
          {:else}
            <p class="text-gray-500 text-sm">Try adjusting your filters</p>
          {/if}
        </div>
      {:else}
        {#each filteredPrivateUTXOs as utxo (utxo.id)}
          {@const tokenData = getTokenMetadata(utxo.tokenAddress)}
          <div class="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:border-gray-500 transition-colors">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                  <div class="text-2xl">🔒</div>
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="text-white font-medium">
                        {formatValue(utxo.value, tokenData.decimals)} {tokenData.symbol}
                      </span>
                      <span class="px-2 py-1 rounded text-xs font-medium {utxo.isSpent ? 'text-red-400 bg-red-400/20' : 'text-green-400 bg-green-400/20'}">
                        {utxo.isSpent ? 'SPENT' : 'AVAILABLE'}
                      </span>
                    </div>
                    <div class="text-sm text-gray-400">
                      {formatTimestamp(utxo.timestamp)}
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-4 text-sm mt-3">
                  <div>
                    <span class="text-gray-400">ID:</span>
                    <div class="text-white font-mono text-xs break-all">
                      {utxo.id.slice(0, 20)}...
                    </div>
                  </div>
                  <div>
                    <span class="text-gray-400">Commitment:</span>
                    <div class="text-white font-mono text-xs break-all">
                      {utxo.commitment.slice(0, 20)}...
                    </div>
                  </div>
                </div>
              </div>

              <button
                on:click={() => copyToClipboard(utxo.id)}
                class="text-gray-400 hover:text-white transition-colors ml-4"
                title="Copy UTXO ID"
              >
                📋
              </button>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>
