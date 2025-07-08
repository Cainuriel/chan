<!-- src/lib/components/UTXOBalance.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ExtendedUTXOData, UTXOManagerStats } from '../types/utxo.types';
  import { UTXOType } from '../types/utxo.types';


  // Props
  export let utxos: ExtendedUTXOData[] = [];
  export let stats: UTXOManagerStats | null = null;

  // Event dispatcher
  const dispatch = createEventDispatcher();

  // Local state
  let selectedTokenAddress: string = 'all';
  let sortBy: 'value' | 'timestamp' | 'type' = 'timestamp';
  let sortOrder: 'asc' | 'desc' = 'desc';
  let showSpent = false;

  // Computed values
  $: uniqueTokens = [...new Set(utxos.map(u => u.tokenAddress))];
  
  $: filteredUTXOs = utxos
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
        case 'type':
          comparison = a.utxoType.localeCompare(b.utxoType);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  $: tokenBalances = stats?.balanceByToken || {};

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
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  function getUTXOTypeIcon(type: UTXOType): string {
    switch (type) {
      case UTXOType.DEPOSIT: return '📥';
      case UTXOType.SPLIT: return '✂️';
      case UTXOType.COMBINE: return '🔗';
      case UTXOType.TRANSFER: return '📤';
      default: return '💫';
    }
  }

  function getUTXOTypeColor(type: UTXOType): string {
    switch (type) {
      case UTXOType.DEPOSIT: return 'text-green-400';
      case UTXOType.SPLIT: return 'text-blue-400';
      case UTXOType.COMBINE: return 'text-purple-400';
      case UTXOType.TRANSFER: return 'text-orange-400';
      default: return 'text-gray-400';
    }
  }

  function handleRefresh() {
    dispatch('refresh');
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }
</script>

<div class="space-y-6">
  <!-- Balance Overview -->
  {#if stats}
    <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-bold text-white">Portfolio Overview</h2>
        <button
          on:click={handleRefresh}
          class="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
          title="Refresh balance"
        >
          🔄
        </button>
      </div>

      <!-- Token Balances -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each Object.entries(tokenBalances) as [tokenAddress, balance]}
          {@const tokenData = utxos.find(u => u.tokenAddress === tokenAddress)?.tokenMetadata}
          <div class="bg-white/5 rounded-lg p-4 border border-white/10">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center space-x-2">
                <div class="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                  <span class="text-white text-xs font-bold">
                    {tokenData?.symbol?.substring(0, 2) || 'TK'}
                  </span>
                </div>
                <div>
                  <div class="text-white font-medium">
                    {tokenData?.symbol || 'Unknown'}
                  </div>
                  <div class="text-gray-400 text-xs">
                    {tokenData?.name || 'Unknown Token'}
                  </div>
                </div>
              </div>
            </div>
            
            <div class="text-right">
              <div class="text-2xl font-bold text-white">
                {formatValue(balance, tokenData?.decimals)}
              </div>
              <div class="text-gray-400 text-sm">
                {utxos.filter(u => u.tokenAddress === tokenAddress && !u.isSpent).length} UTXOs
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- UTXO List -->
  <div class="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
    <div class="p-6 border-b border-white/10">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold text-white">UTXOs</h2>
        <div class="text-gray-300 text-sm">
          {filteredUTXOs.length} of {utxos.length} UTXOs
        </div>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-4">
        <!-- Token Filter -->
        <select
          bind:value={selectedTokenAddress}
          class="bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white"
        >
          <option value="all">All Tokens</option>
          {#each uniqueTokens as tokenAddress}
            {@const tokenData = utxos.find(u => u.tokenAddress === tokenAddress)?.tokenMetadata}
            <option value={tokenAddress}>
              {tokenData?.symbol || tokenAddress.slice(0, 8)}...
            </option>
          {/each}
        </select>

        <!-- Sort By -->
        <select
          bind:value={sortBy}
          class="bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white"
        >
          <option value="timestamp">Sort by Date</option>
          <option value="value">Sort by Value</option>
          <option value="type">Sort by Type</option>
        </select>

        <!-- Sort Order -->
        <button
          on:click={() => sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'}
          class="bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white hover:bg-white/10 transition-all duration-200"
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </button>

        <!-- Show Spent Toggle -->
        <label class="flex items-center space-x-2 text-white">
          <input
            type="checkbox"
            bind:checked={showSpent}
            class="rounded"
          />
          <span class="text-sm">Show Spent</span>
        </label>
      </div>
    </div>

    <!-- UTXO Cards -->
    <div class="p-6">
      {#if filteredUTXOs.length === 0}
        <div class="text-center py-12">
          <div class="text-gray-400 text-6xl mb-4">🫙</div>
          <div class="text-white text-xl font-semibold mb-2">No UTXOs Found</div>
          <div class="text-gray-400">
            {#if utxos.length === 0}
              Create your first UTXO by depositing tokens
            {:else}
              Try adjusting your filters
            {/if}
          </div>
        </div>
      {:else}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {#each filteredUTXOs as utxo (utxo.id)}
            <div 
              class="bg-white/5 rounded-lg p-4 border border-white/10 transition-all duration-200 hover:border-white/20"
              class:opacity-60={utxo.isSpent}
            >
              <!-- UTXO Header -->
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center space-x-2">
                  <span class="text-xl">{getUTXOTypeIcon(utxo.utxoType)}</span>
                  <span class="text-sm font-medium {getUTXOTypeColor(utxo.utxoType)}">
                    {utxo.utxoType}
                  </span>
                  {#if utxo.isSpent}
                    <span class="text-red-400 text-xs bg-red-400/20 px-2 py-1 rounded">
                      SPENT
                    </span>
                  {/if}
                  {#if !utxo.confirmed}
                    <span class="text-yellow-400 text-xs bg-yellow-400/20 px-2 py-1 rounded">
                      PENDING
                    </span>
                  {/if}
                </div>
                
                <button
                  on:click={() => copyToClipboard(utxo.id)}
                  class="text-gray-400 hover:text-white text-xs"
                  title="Copy UTXO ID"
                >
                  📋
                </button>
              </div>

              <!-- UTXO Value -->
              <div class="mb-3">
                <div class="text-2xl font-bold text-white">
                  {formatValue(utxo.value, utxo.tokenMetadata?.decimals)}
                </div>
                <div class="text-gray-400 text-sm">
                  {utxo.tokenMetadata?.symbol || 'Unknown'} • 
                  {utxo.tokenMetadata?.name || 'Unknown Token'}
                </div>
              </div>

              <!-- UTXO Details -->
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-400">ID:</span>
                  <span class="text-white font-mono">
                    {utxo.id.slice(0, 8)}...{utxo.id.slice(-8)}
                  </span>
                </div>
                
                <div class="flex justify-between">
                  <span class="text-gray-400">Created:</span>
                  <span class="text-white">
                    {formatTimestamp(utxo.timestamp)}
                  </span>
                </div>

                {#if utxo.parentUTXO}
                  <div class="flex justify-between">
                    <span class="text-gray-400">Parent:</span>
                    <span class="text-white font-mono">
                      {utxo.parentUTXO.slice(0, 8)}...
                    </span>
                  </div>
                {/if}

                {#if utxo.creationTxHash}
                  <div class="flex justify-between">
                    <span class="text-gray-400">Tx Hash:</span>
                    <button
                      on:click={() => copyToClipboard(utxo.creationTxHash || '')}
                      class="text-blue-400 hover:text-blue-300 font-mono"
                    >
                      {utxo.creationTxHash.slice(0, 8)}...
                    </button>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>