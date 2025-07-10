<!-- src/lib/components/TransactionHistory.svelte -->
<script lang="ts">
  import type { ExtendedUTXOData } from '../types/utxo.types';
  import type { PrivateUTXO } from '../lib/PrivateUTXOManager';
  import { UTXOType } from '../types/utxo.types';

  // Props
  export let utxos: ExtendedUTXOData[] = [];
  export let privateUTXOs: PrivateUTXO[] = [];
  export let privacyMode: boolean = true;

  // Local state
  let filterType: 'all' | UTXOType = 'all';
  let filterStatus: 'all' | 'confirmed' | 'pending' | 'spent' = 'all';
  let sortBy: 'timestamp' | 'value' | 'type' = 'timestamp';
  let sortOrder: 'asc' | 'desc' = 'desc';
  let searchQuery = '';

  // Computed values
  $: filteredUTXOs = utxos
    .filter(utxo => {
      // Type filter
      if (filterType !== 'all' && utxo.utxoType !== filterType) return false;
      
      // Status filter
      if (filterStatus === 'confirmed' && !utxo.confirmed) return false;
      if (filterStatus === 'pending' && utxo.confirmed) return false;
      if (filterStatus === 'spent' && !utxo.isSpent) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return utxo.id.toLowerCase().includes(query) ||
               utxo.creationTxHash?.toLowerCase().includes(query) ||
               utxo.tokenMetadata?.symbol?.toLowerCase().includes(query) ||
               utxo.tokenMetadata?.name?.toLowerCase().includes(query);
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
        case 'type':
          comparison = a.utxoType.localeCompare(b.utxoType);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Statistics
  $: stats = {
    total: utxos.length,
    confirmed: utxos.filter(u => u.confirmed).length,
    pending: utxos.filter(u => !u.confirmed).length,
    spent: utxos.filter(u => u.isSpent).length,
    byType: {
      [UTXOType.DEPOSIT]: utxos.filter(u => u.utxoType === UTXOType.DEPOSIT).length,
      [UTXOType.SPLIT]: utxos.filter(u => u.utxoType === UTXOType.SPLIT).length,
      [UTXOType.COMBINE]: utxos.filter(u => u.utxoType === UTXOType.COMBINE).length,
      [UTXOType.TRANSFER]: utxos.filter(u => u.utxoType === UTXOType.TRANSFER).length
    }
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
    
    // Less than 1 minute
    if (diffMs < 60000) {
      return 'Just now';
    }
    
    // Less than 1 hour
    if (diffMs < 3600000) {
      const minutes = Math.floor(diffMs / 60000);
      return `${minutes}m ago`;
    }
    
    // Less than 24 hours
    if (diffMs < 86400000) {
      const hours = Math.floor(diffMs / 3600000);
      return `${hours}h ago`;
    }
    
    // Less than 7 days
    if (diffMs < 604800000) {
      const days = Math.floor(diffMs / 86400000);
      return `${days}d ago`;
    }
    
    // Older than 7 days
    return date.toLocaleDateString();
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
      case UTXOType.DEPOSIT: return 'text-green-400 bg-green-400/20';
      case UTXOType.SPLIT: return 'text-blue-400 bg-blue-400/20';
      case UTXOType.COMBINE: return 'text-purple-400 bg-purple-400/20';
      case UTXOType.TRANSFER: return 'text-orange-400 bg-orange-400/20';
      default: return 'text-gray-400 bg-gray-400/20';
    }
  }

  function getStatusColor(utxo: ExtendedUTXOData): string {
    if (utxo.isSpent) return 'text-red-400 bg-red-400/20';
    if (!utxo.confirmed) return 'text-yellow-400 bg-yellow-400/20';
    return 'text-green-400 bg-green-400/20';
  }

  function getStatusText(utxo: ExtendedUTXOData): string {
    if (utxo.isSpent) return 'SPENT';
    if (!utxo.confirmed) return 'PENDING';
    return 'CONFIRMED';
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  function openInExplorer(txHash: string) {
    // This would open the transaction in a blockchain explorer
    // Implementation depends on the network
    const explorerUrl = `https://etherscan.io/tx/${txHash}`;
    window.open(explorerUrl, '_blank');
  }
</script>

<div class="space-y-6">
  <!-- Header with Stats -->
  <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
    <h2 class="text-xl font-bold text-white mb-4">Transaction History</h2>
    
    <!-- Quick Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="text-center">
        <div class="text-2xl font-bold text-white">{stats.total}</div>
        <div class="text-gray-400 text-sm">Total UTXOs</div>
      </div>
      <div class="text-center">
        <div class="text-2xl font-bold text-green-400">{stats.confirmed}</div>
        <div class="text-gray-400 text-sm">Confirmed</div>
      </div>
      <div class="text-center">
        <div class="text-2xl font-bold text-yellow-400">{stats.pending}</div>
        <div class="text-gray-400 text-sm">Pending</div>
      </div>
      <div class="text-center">
        <div class="text-2xl font-bold text-red-400">{stats.spent}</div>
        <div class="text-gray-400 text-sm">Spent</div>
      </div>
    </div>
  </div>

  <!-- Filters and Search -->
  <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
    <div class="flex flex-wrap items-center gap-4">
      <!-- Search -->
      <div class="flex-1 min-w-64">
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search by UTXO ID, tx hash, or token..."
          class="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200"
        />
      </div>

      <!-- Type Filter -->
      <select
        bind:value={filterType}
        class="bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white"
      >
        <option value="all">All Types</option>
        <option value={UTXOType.DEPOSIT}>Deposits</option>
        <option value={UTXOType.SPLIT}>Splits</option>
        <option value={UTXOType.COMBINE}>Combines</option>
        <option value={UTXOType.TRANSFER}>Transfers</option>
      </select>

      <!-- Status Filter -->
      <select
        bind:value={filterStatus}
        class="bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white"
      >
        <option value="all">All Status</option>
        <option value="confirmed">Confirmed</option>
        <option value="pending">Pending</option>
        <option value="spent">Spent</option>
      </select>

      <!-- Sort -->
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
    </div>
  </div>

  <!-- Transaction List -->
  <div class="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
    {#if filteredUTXOs.length === 0}
      <div class="text-center py-12">
        <div class="text-gray-400 text-6xl mb-4">📜</div>
        <div class="text-white text-xl font-semibold mb-2">No Transactions Found</div>
        <div class="text-gray-400">
          {#if utxos.length === 0}
            Your transaction history will appear here after creating UTXOs
          {:else}
            Try adjusting your search criteria
          {/if}
        </div>
      </div>
    {:else}
      <!-- Table Header -->
      <div class="grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/10 text-sm font-medium text-gray-400">
        <div class="col-span-3">UTXO / Transaction</div>
        <div class="col-span-2">Type</div>
        <div class="col-span-2">Amount</div>
        <div class="col-span-2">Status</div>
        <div class="col-span-2">Date</div>
        <div class="col-span-1">Actions</div>
      </div>

      <!-- Transaction Rows -->
      <div class="divide-y divide-white/10">
        {#each filteredUTXOs as utxo (utxo.id)}
          <div class="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-white/5 transition-all duration-200">
            <!-- UTXO Info -->
            <div class="col-span-3">
              <div class="text-white font-medium font-mono text-sm">
                {utxo.id.slice(0, 8)}...{utxo.id.slice(-8)}
              </div>
              {#if utxo.creationTxHash}
                <div class="text-gray-400 text-xs font-mono">
                  Tx: {utxo.creationTxHash.slice(0, 8)}...
                </div>
              {/if}
              {#if utxo.parentUTXO}
                <div class="text-gray-400 text-xs">
                  From: {utxo.parentUTXO.slice(0, 8)}...
                </div>
              {/if}
            </div>

            <!-- Type -->
            <div class="col-span-2">
              <span class="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium {getUTXOTypeColor(utxo.utxoType)}">
                <span>{getUTXOTypeIcon(utxo.utxoType)}</span>
                <span>{utxo.utxoType}</span>
              </span>
            </div>

            <!-- Amount -->
            <div class="col-span-2">
              <div class="text-white font-semibold">
                {formatValue(utxo.value, utxo.tokenMetadata?.decimals)}
              </div>
              <div class="text-gray-400 text-xs">
                {utxo.tokenMetadata?.symbol || 'Unknown'}
              </div>
            </div>

            <!-- Status -->
            <div class="col-span-2">
              <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium {getStatusColor(utxo)}">
                {getStatusText(utxo)}
              </span>
              {#if utxo.blockNumber}
                <div class="text-gray-400 text-xs">
                  Block {utxo.blockNumber}
                </div>
              {/if}
            </div>

            <!-- Date -->
            <div class="col-span-2">
              <div class="text-white text-sm">
                {formatTimestamp(utxo.timestamp)}
              </div>
              <div class="text-gray-400 text-xs">
                {new Date(Number(utxo.timestamp)).toLocaleTimeString()}
              </div>
            </div>

            <!-- Actions -->
            <div class="col-span-1 flex space-x-2">
              <button
                on:click={() => copyToClipboard(utxo.id)}
                class="text-gray-400 hover:text-white text-sm"
                title="Copy UTXO ID"
              >
                📋
              </button>
              {#if utxo.creationTxHash}
                <button
                  on:click={() => openInExplorer(utxo.creationTxHash || '')}
                  class="text-gray-400 hover:text-white text-sm"
                  title="View on explorer"
                >
                  🔗
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Type Distribution Chart -->
  {#if stats.total > 0}
    <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
      <h3 class="text-lg font-semibold text-white mb-4">UTXO Type Distribution</h3>
      
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        {#each Object.entries(stats.byType) as [type, count]}
          {#if count > 0}
            <div class="text-center">
              <div class="text-3xl mb-2">{getUTXOTypeIcon(type as UTXOType)}</div>
              <div class="text-xl font-bold text-white">{count}</div>
              <div class="text-gray-400 text-sm capitalize">{type}</div>
              <div class="text-gray-500 text-xs">
                {Math.round((count / stats.total) * 100)}%
              </div>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/if}
</div>