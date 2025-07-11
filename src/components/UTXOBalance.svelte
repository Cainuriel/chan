<!-- src/lib/components/UTXOBalance.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ExtendedUTXOData, UTXOManagerStats } from '../types/utxo.types';
  import type { PrivateUTXO } from '../lib/PrivateUTXOManager';
  import type { ERC20TokenData } from '../types/ethereum.types';
  import { UTXOType } from '../types/utxo.types';
  import { EthereumHelpers } from '../utils/ethereum.helpers';

  // Props
  export let utxos: ExtendedUTXOData[] = [];
  export let privateUTXOs: PrivateUTXO[] = [];
  export let stats: UTXOManagerStats | null = null;
  export let privacyMode: boolean = true;

  // Event dispatcher
  const dispatch = createEventDispatcher();

  // Local state
  let selectedTokenAddress: string = 'all';
  let sortBy: 'value' | 'timestamp' | 'type' = 'timestamp';
  let sortOrder: 'asc' | 'desc' = 'desc';
  let showSpent = false;
  let showPrivateDetails = false; // Toggle for showing private UTXO details

  // Token metadata cache
  let tokenMetadataCache: Record<string, ERC20TokenData> = {};
  let isLoadingMetadata = false;
  let metadataLoaded = false;

  // Computed values
  let tokenBalances: Record<string, bigint> = {};
  let uniqueTokens: string[] = [];
  let filteredUTXOs: ExtendedUTXOData[]  = [];
  let filteredPrivateUTXOs: PrivateUTXO[] = [];
  
  $: if(utxos.length !== 0 || privateUTXOs.length !== 0) {
    // Get unique tokens from both regular and private UTXOs
    const regularTokens = utxos.map(u => u.tokenAddress);
    const privateTokens = privateUTXOs.map(u => u.tokenAddress);
    uniqueTokens = [...new Set([...regularTokens, ...privateTokens])];
    
    // Filter regular UTXOs
    filteredUTXOs = utxos
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
          case 'type':
            comparison = a.utxoType.localeCompare(b.utxoType);
            break;
        }
        
        return sortOrder === 'asc' ? comparison : -comparison;
      });
      
    tokenBalances = stats?.balanceByToken || {};
    
    // Load token metadata for unique tokens
    loadTokenMetadata();

  }
  
  // Load token metadata
  async function loadTokenMetadata() {
    if (uniqueTokens.length === 0) {
      metadataLoaded = true;
      return;
    }

    isLoadingMetadata = true;
    metadataLoaded = false;

    const loadPromises = uniqueTokens.map(async (tokenAddress) => {
      if (!tokenMetadataCache[tokenAddress]) {
        try {
          const tokenData = await EthereumHelpers.getERC20TokenInfo(tokenAddress);
          tokenMetadataCache[tokenAddress] = tokenData;
        } catch (error) {
          console.error('Failed to load token metadata for', tokenAddress, error);
          // Set default metadata
          tokenMetadataCache[tokenAddress] = {
            address: tokenAddress,
            name: 'Unknown Token',
            symbol: 'UNK',
            decimals: 18,
            balance: 0n,
            allowance: 0n,
            verified: false
          };
        }
      }
    });

    // Wait for all metadata to load
    await Promise.all(loadPromises);
    
    // Trigger reactivity
    tokenMetadataCache = { ...tokenMetadataCache };
    isLoadingMetadata = false;
    metadataLoaded = true;
  }

  // Helper function to get token metadata
  function getTokenMetadata(tokenAddress: string): ERC20TokenData | undefined {
    return tokenMetadataCache[tokenAddress];
  }

  function formatValue(value: bigint | string | number, decimals: number ): string {

    try {
      // Convert to BigInt if not already
      const bigintValue = typeof value === 'bigint' ? value : BigInt(value.toString());
      const safeDecimals = decimals || 18;
      const divisor = BigInt(10) ** BigInt(safeDecimals);
      const quotient = bigintValue / divisor;
      const remainder = bigintValue % divisor;
      
      if (remainder === BigInt(0)) {
        return quotient.toString();
      }
      
      const remainderStr = remainder.toString().padStart(safeDecimals, '0');
      const trimmedRemainder = remainderStr.replace(/0+$/, '');
      
      return trimmedRemainder ? `${quotient}.${trimmedRemainder}` : quotient.toString();
    } catch (error) {
      console.error('Error formatting value:', error, 'Value:', value, 'Decimals:', decimals);
      return '0';
    }
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
  <!-- Loading State -->
  {#if isLoadingMetadata && !metadataLoaded}
    <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
      <div class="flex items-center justify-center space-x-3">
        <div class="animate-spin w-6 h-6 border-2 border-white/20 border-t-white rounded-full"></div>
        <span class="text-white text-lg">Loading token metadata...</span>
      </div>
      <div class="mt-4 text-center text-gray-400 text-sm">
        Fetching information for {uniqueTokens.length} token{uniqueTokens.length === 1 ? '' : 's'}
      </div>
    </div>
  {:else if metadataLoaded || utxos.length === 0}
    <!-- Content only renders when metadata is loaded or no UTXOs exist -->
    
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
            {@const tokenData = getTokenMetadata(tokenAddress)}
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
                  {formatValue(balance, tokenData?.decimals || 18)}
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

  <!-- UTXO Lists -->
  <div class="space-y-6">
    
    <!-- Private UTXOs Section -->
    {#if privateUTXOs.length > 0}
      <div class="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
        <div class="p-6 border-b border-white/10">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-3">
              <h2 class="text-xl font-bold text-white">🔐 Private UTXOs</h2>
              <span class="px-2 py-1 bg-purple-600/20 border border-purple-500/50 rounded-lg text-purple-300 text-xs">
                BBS+ Encrypted
              </span>
            </div>
            <div class="flex items-center space-x-4">
              <button
                on:click={() => showPrivateDetails = !showPrivateDetails}
                class="text-gray-300 hover:text-white text-sm px-3 py-1 rounded-lg border border-white/20 hover:bg-white/10 transition-all duration-200"
              >
                {showPrivateDetails ? '🙈 Hide Details' : '👁️ Show Details'}
              </button>
              <div class="text-gray-300 text-sm">
                {filteredPrivateUTXOs.length} of {privateUTXOs.length} Private UTXOs
              </div>
            </div>
          </div>
        </div>

        <div class="p-6">
          {#if filteredPrivateUTXOs.length === 0}
            <div class="text-center text-gray-400 py-8">
              No private UTXOs match the current filters
            </div>
          {:else}
            <div class="space-y-4">
              {#each filteredPrivateUTXOs as utxo (utxo.id)}
                <div class="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-all duration-200">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                      <div class="text-purple-400 text-xl">
                        {getUTXOTypeIcon(utxo.utxoType)}
                      </div>
                      <div>
                        <div class="text-white font-medium">
                          {showPrivateDetails ? formatValue(utxo.value, getTokenMetadata(utxo.tokenAddress)?.decimals || 18) : '••••••'} 
                          {getTokenMetadata(utxo.tokenAddress)?.symbol || 'TOKEN'}
                        </div>
                        <div class="text-gray-400 text-sm">
                          Commitment: {utxo.commitment.slice(0, 10)}...{utxo.commitment.slice(-6)}
                        </div>
                      </div>
                    </div>
                    
                    <div class="text-right">
                      <div class="text-gray-300 text-sm">
                        {formatTimestamp(utxo.timestamp)}
                      </div>
                      <div class="flex items-center space-x-2 mt-1">
                        <span class="px-2 py-1 bg-purple-600/20 text-purple-300 text-xs rounded">
                          {UTXOType[utxo.utxoType]}
                        </span>
                        {#if utxo.isSpent}
                          <span class="px-2 py-1 bg-red-600/20 text-red-300 text-xs rounded">
                            Spent
                          </span>
                        {/if}
                      </div>
                    </div>
                  </div>
                  
                  {#if showPrivateDetails}
                    <div class="mt-3 pt-3 border-t border-white/10">
                      <div class="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span class="text-gray-400">UTXO ID:</span>
                          <div class="text-white font-mono break-all">{utxo.id}</div>
                        </div>
                        <div>
                          <span class="text-gray-400">Owner:</span>
                          <div class="text-white font-mono">{utxo.owner.slice(0, 8)}...{utxo.owner.slice(-6)}</div>
                        </div>
                      </div>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Regular UTXOs Section -->
    <div class="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
      <div class="p-6 border-b border-white/10">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center space-x-3">
            <h2 class="text-xl font-bold text-white">🔓 Regular UTXOs</h2>
            <span class="px-2 py-1 bg-blue-600/20 border border-blue-500/50 rounded-lg text-blue-300 text-xs">
              Transparent
            </span>
          </div>
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
            {@const tokenData = getTokenMetadata(tokenAddress)}
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
            {@const tokenData = getTokenMetadata(utxo.tokenAddress)}
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
                  {formatValue(utxo.value, tokenData?.decimals || 18)}
                </div>
                <div class="text-gray-400 text-sm">
                  {tokenData?.symbol || 'Unknown'} • 
                  {tokenData?.name || 'Unknown Token'}
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
  </div> <!-- Close Regular UTXOs section -->
  
  </div> <!-- Close UTXO Lists wrapper -->
  {/if}
</div>