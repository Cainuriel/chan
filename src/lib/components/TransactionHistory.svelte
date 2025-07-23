<!-- src/lib/components/TransactionHistory.svelte -->
<script lang="ts">
  import type { PrivateUTXO } from '../../types/utxo.types';
  import type { ERC20TokenData } from '../../types/ethereum.types';
  import { EthereumHelpers } from '../../utils/ethereum.helpers';

  // Props - Solo private UTXOs
  export let privateUTXOs: PrivateUTXO[] = [];

  // Local state
  let filterStatus: 'all' | 'confirmed' | 'spent' = 'all';
  let sortBy: 'timestamp' | 'value' = 'timestamp';
  let sortOrder: 'asc' | 'desc' = 'desc';
  let searchQuery = '';

  // Token metadata cache
  let tokenMetadataCache: Record<string, ERC20TokenData> = {};
  let isLoadingMetadata = false;

  // Computed values
  $: filteredUTXOs = privateUTXOs
    .filter(utxo => {
      // Status filter
      if (filterStatus === 'confirmed' && utxo.isSpent) return false; // Confirmed = Available = No gastados
      if (filterStatus === 'spent' && !utxo.isSpent) return false;    // Spent = Gastados solamente
      // Si filterStatus === 'all', no filtrar (mostrar todos)
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return utxo.nullifierHash.toLowerCase().includes(query) ||
               utxo.commitment.toLowerCase().includes(query);
      }
      
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'timestamp':
          comparison = Number(a.timestamp - b.timestamp);
          break;
        case 'value':
          comparison = Number(a.value - b.value);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Debug filtered UTXOs
  $: {
    console.log('🔍 TransactionHistory - Filtered UTXOs:', filteredUTXOs.length);
    console.log('🔍 TransactionHistory - Filtered details:', filteredUTXOs.map(u => ({
      id: u.id.slice(0, 8) + '...',
      isSpent: u.isSpent,
      value: u.value?.toString(),
      status: u.isSpent ? 'SPENT' : 'AVAILABLE'
    })));
  }

  // Load token metadata when UTXOs change
  $: if (privateUTXOs.length > 0) {
    const uniqueTokens = [...new Set(privateUTXOs.map(u => u.tokenAddress))];
    loadTokenMetadata(uniqueTokens);
  }

  // Token metadata loading
  async function loadTokenMetadata(tokenAddresses: string[]) {
    isLoadingMetadata = true;
    
    for (const tokenAddress of tokenAddresses) {
      if (!tokenMetadataCache[tokenAddress]) {
        // 🔧 TEMPORARY: Set known token info immediately to avoid decimals issue
        if (tokenAddress.toLowerCase() === '0xca4d19d712944874f8dd1472c6de5dd8e5c9e5e2' ||
            tokenAddress.toLowerCase() === '0xb058daded40d0a020a492ce5ed3eb368a78e6497') {
          tokenMetadataCache[tokenAddress] = {
            address: tokenAddress,
            symbol: 'USDT',
            name: 'Tether USD',
            decimals: 6, // Correct decimals immediately
            balance: BigInt(0),
            allowance: BigInt(0),
            verified: true
          };
          tokenMetadataCache = { ...tokenMetadataCache };
        }
        
        try {
          const tokenData = await EthereumHelpers.getERC20TokenInfo(tokenAddress);
          tokenMetadataCache[tokenAddress] = tokenData;
          tokenMetadataCache = { ...tokenMetadataCache };
        } catch (error) {
          // Only use fallback if we don't have the hardcoded data
          if (!tokenMetadataCache[tokenAddress]) {
            tokenMetadataCache[tokenAddress] = {
              address: tokenAddress,
              symbol: 'Unknown',
              name: 'Unknown Token',
              decimals: 18, // ⚠️ DEFAULT FALLBACK - Could be wrong!
              balance: BigInt(0),
              allowance: BigInt(0),
              verified: false
            };
            tokenMetadataCache = { ...tokenMetadataCache };
          }
        }
      }
    }
    
    isLoadingMetadata = false;
  }

  function getTokenMetadata(tokenAddress: string): ERC20TokenData {
    const cached = tokenMetadataCache[tokenAddress];
    if (cached) {
      return cached;
    }
    
    // 🔧 TEMPORARY: Hardcode known token decimals
    let knownDecimals = 18; // Default fallback
    
    // Token specific overrides (add more as needed)
    if (tokenAddress.toLowerCase() === '0xca4d19d712944874f8dd1472c6de5dd8e5c9e5e2') {
      knownDecimals = 6; // Your token has 6 decimals
    }
    
    // Fallback when no cached data
    return {
      address: tokenAddress,
      symbol: 'Unknown',
      name: 'Unknown Token',
      decimals: knownDecimals,
      balance: BigInt(0),
      allowance: BigInt(0),
      verified: false
    };
  }

  // Statistics - Solo private UTXOs
  $: stats = {
    total: privateUTXOs.length,
    available: privateUTXOs.filter(u => !u.isSpent).length,
    spent: privateUTXOs.filter(u => u.isSpent).length
  };

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
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    if (diffMs < 60000) return 'Just now';
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
    if (diffMs < 604800000) return `${Math.floor(diffMs / 86400000)}d ago`;
    
    return date.toLocaleDateString();
  }

  function getStatusColor(utxo: PrivateUTXO): string {
    return utxo.isSpent ? 'text-red-400 bg-red-400/20' : 'text-green-400 bg-green-400/20';
  }

  function getStatusText(utxo: PrivateUTXO): string {
    return utxo.isSpent ? 'SPENT' : 'AVAILABLE';
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }
</script>

<div class="bg-gray-800 rounded-lg p-6">
  <h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
    🔒 Private UTXO History
    <span class="text-sm font-normal text-gray-400">
      ({privateUTXOs.length} UTXOs)
    </span>
    {#if isLoadingMetadata}
      <div class="animate-spin text-purple-500 text-sm ml-2">⚡</div>
    {/if}
  </h3>

  <!-- Quick Stats -->
  <div class="grid grid-cols-3 gap-4 mb-6">
    <div class="text-center bg-gray-700 rounded-lg p-3">
      <div class="text-2xl font-bold text-white">{stats.total}</div>
      <div class="text-gray-400 text-sm">Total UTXOs</div>
    </div>
    <div class="text-center bg-gray-700 rounded-lg p-3">
      <div class="text-2xl font-bold text-green-400">{stats.available}</div>
      <div class="text-gray-400 text-sm">Available</div>
    </div>
    <div class="text-center bg-gray-700 rounded-lg p-3">
      <div class="text-2xl font-bold text-red-400">{stats.spent}</div>
      <div class="text-gray-400 text-sm">Spent</div>
    </div>
  </div>

  <!-- Filters -->
  <div class="flex flex-wrap items-center gap-4 mb-6">
    <input
      type="text"
      bind:value={searchQuery}
      placeholder="Search UTXOs..."
      class="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
    />
    
    <select
      bind:value={filterStatus}
      class="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
    >
      <option value="all">All Status</option>
      <option value="confirmed">Available</option>
      <option value="spent">Spent</option>
    </select>

    <select
      bind:value={sortBy}
      class="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
    >
      <option value="timestamp">Sort by Date</option>
      <option value="value">Sort by Value</option>
    </select>

    <button
      on:click={() => sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'}
      class="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white hover:bg-gray-600"
    >
      {sortOrder === 'asc' ? '↑' : '↓'}
    </button>
  </div>

  <!-- UTXO List -->
  {#if filteredUTXOs.length === 0}
    <div class="text-center py-8">
      <div class="text-gray-400 text-lg mb-2">�</div>
      <p class="text-gray-400">No private UTXOs found</p>
      <p class="text-gray-500 text-sm">Your private transactions will appear here</p>
    </div>
  {:else}
    <div class="space-y-4">
      {#each filteredUTXOs as utxo, index (utxo.nullifierHash)}
        {@const tokenData = getTokenMetadata(utxo.tokenAddress)}
        <div class="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:border-gray-500 transition-colors">
          <div class="flex justify-between items-start mb-3">
            <div class="flex items-center gap-3">
              <div class="text-2xl">🔒</div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-medium text-white">Private UTXO #{index + 1}</span>
                  <span class="px-2 py-1 rounded text-xs font-medium {getStatusColor(utxo)}">
                    {getStatusText(utxo)}
                  </span>
                </div>
                <div class="text-sm text-gray-400 flex items-center gap-2 mt-1">
                  <span>🪙 {formatValue(utxo.value, tokenData.decimals)} {tokenData.symbol}</span>
                  <span>•</span>
                  <span>🕒 {formatTimestamp(utxo.timestamp)}</span>
                </div>
              </div>
            </div>
            
            <button 
              on:click={() => copyToClipboard(utxo.nullifierHash)}
              class="text-gray-400 hover:text-white transition-colors"
              title="Copy Nullifier Hash"
            >
              📋
            </button>
          </div>

          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-gray-400">Commitment:</span>
              <div class="text-white font-mono text-xs break-all">
                {utxo.commitment.slice(0, 20)}...
              </div>
            </div>
            <div>
              <span class="text-gray-400">Nullifier:</span>
              <div class="text-white font-mono text-xs break-all">
                {utxo.nullifierHash.slice(0, 20)}...
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>