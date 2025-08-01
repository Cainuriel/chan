<!-- src/lib/components/WalletConnection.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { EOAData } from '../../types/ethereum.types';
  import { WalletProviderType } from '../../types/ethereum.types';

  // Import using default import only and infer type
  import privateUTXOManager  from '$lib/ManagerUTXO';
  type PrivateUTXOManager = typeof privateUTXOManager;

  // Props
  export let utxoManager: PrivateUTXOManager;
  export let currentAccount: EOAData | null = null;
  export let isInitialized: boolean = false;

  // Event dispatcher
  const dispatch = createEventDispatcher();

  // Local state
  let isConnecting = false;
  let isDisconnecting = false;

  // Only MetaMask provider for simplicity
  const provider = {
    type: WalletProviderType.METAMASK, 
    name: 'MetaMask', 
    icon: '🦊',
    description: 'Connect using MetaMask (Polygon Amoy Network)'
  };

  async function handleConnect() {
    isConnecting = true;

    try {
      // Si no estamos inicializados, dispatch para que el padre maneje el flujo controlado
      if (!isInitialized) {
        dispatch('needsFullSetup');
        return;
      }
      
      // Si ya estamos inicializados, intentar reconectar directamente
      console.log('🔌 Attempting reconnection from header button...');
      const result = await utxoManager.connectWallet(WalletProviderType.METAMASK);
      
      if (result) {
        console.log('✅ Reconnection successful');
        dispatch('reconnected');
      } else {
        console.error('❌ Reconnection failed');
        throw new Error('Failed to reconnect wallet');
      }
    } catch (error) {
      console.error('Connection error:', error);
      alert('Error al conectar con MetaMask. Por favor recarga la página e intenta de nuevo.');
    } finally {
      isConnecting = false;
    }
  }

  async function handleDisconnect() {
    isDisconnecting = true;

    try {
      console.log('🔌 Disconnecting wallet from header...');
      await utxoManager.disconnect();
      dispatch('disconnected');
    } catch (error) {
      console.error('Disconnection error:', error);
    } finally {
      isDisconnecting = false;
    }
  }

  function handleRefresh() {
    dispatch('refresh');
  }

  function formatAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  function getNetworkDisplayName(chainId: bigint): string {
    switch (Number(chainId)) {
      case 1: return 'Ethereum';
      case 137: return 'Polygon';
      case 80002: return 'Polygon Amoy';
      case 11155111: return 'Sepolia';
      default: return `Chain ${chainId}`;
    }
  }
</script>

{#if !currentAccount}
  <!-- Not Connected State -->
  <div class="flex flex-col items-end space-y-2">
    <button
      on:click={handleConnect}
      disabled={isConnecting}
      class="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-2"
    >
      {#if isConnecting}
        <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
        <span>Connecting...</span>
      {:else}
        <span>{provider.icon}</span>
        <span>Connect MetaMask</span>
      {/if}
    </button>
    <div class="text-xs text-gray-400 text-right">
      <div>Polygon Amoy Network</div>
      <div>Alastria Network</div>
      <div class="text-yellow-400 mt-1">
        {#if typeof window !== 'undefined' && !window.ethereum}
          ⚠️ MetaMask not installed
        {:else if typeof window !== 'undefined' && window.ethereum && !window.ethereum.isMetaMask}
          ⚠️ Please unlock MetaMask
        {/if}
      </div>
    </div>
  </div>
{:else}
  <!-- Connected State -->
  <div class="flex items-center space-x-4">
    <!-- Account Info -->
    <div class="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/20">
      <div class="flex items-center space-x-3">
        <!-- Provider Icon -->
        <div class="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center">
          <span class="text-white text-sm font-bold">
            {#if currentAccount.providerType === WalletProviderType.METAMASK}🦊
            {:else if currentAccount.providerType === WalletProviderType.WALLET_CONNECT}🔗
            {:else if currentAccount.providerType === WalletProviderType.COINBASE_WALLET}💙
            {:else}🌐{/if}
          </span>
        </div>
        
        <!-- Account Details -->
        <div class="text-sm">
          <div class="text-white font-medium">
            {formatAddress(currentAccount.address)}
          </div>
          <div class="text-gray-300 text-xs">
            {getNetworkDisplayName(currentAccount.chainId)}
            {#if currentAccount.ethBalance !== undefined}
              • {(Number(currentAccount.ethBalance) / 1e18).toFixed(4)} ETH
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex items-center space-x-2">
      <!-- Refresh Button -->
      <button
        on:click={handleRefresh}
        class="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
        title="Refresh data"
      >
        <span class="text-lg">🔄</span>
      </button>

      <!-- Account Menu -->
      <div class="relative">
        <button
          on:click={handleDisconnect}
          disabled={isDisconnecting}
          class="bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 hover:border-red-600/50 disabled:opacity-50 disabled:cursor-not-allowed text-red-300 px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2"
        >
          {#if isDisconnecting}
            <div class="w-4 h-4 border-2 border-red-300/30 border-t-red-300 rounded-full animate-spin"></div>
            <span>Disconnecting...</span>
          {:else}
            <span>🔌</span>
            <span>Disconnect</span>
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}