<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { UTXOLibrary } from '../UTXOLibrary';
  import { WalletProviderType } from '../types/ethereum.types';
  import type { UTXOManagerStats, ExtendedUTXOData } from '../types/utxo.types';
  import type { EOAData } from '../types/ethereum.types';
  
  // Components
  import WalletConnection from '../components/WalletConnection.svelte';
  import UTXOBalance from '../components/UTXOBalance.svelte';
  import DepositForm from '../components/DepositForm.svelte';
  import OperationsPanel from '../components/OperationsPanel.svelte';
  import TransactionHistory from '../components/TransactionHistory.svelte';

  // State
  let utxoLibrary: UTXOLibrary;
  let isInitialized = false;
  let currentAccount: EOAData | null = null;
  let utxos: ExtendedUTXOData[] = [];
  let stats: UTXOManagerStats | null = null;
  let activeTab = 'balance';
  let notifications: Array<{id: string, type: string, message: string}> = [];

  // Configuration
  const CONTRACT_ADDRESS = '0xCA4D19D7129448743344A17E6846a8016172A599'; // amoy
  const PREFERRED_PROVIDER = WalletProviderType.METAMASK;

  onMount(async () => {
    try {
      // Initialize UTXO Library
      utxoLibrary = new UTXOLibrary({
        autoConsolidate: false,
        consolidationThreshold: 5,
        maxUTXOAge: 7 * 24 * 60 * 60, // 7 days
        privacyMode: true,
        defaultGasLimit: BigInt(500000),
        cacheTimeout: 30000,
        enableBackup: true
      });

      // Setup event listeners
      setupEventListeners();

      console.log('🚀 UTXO Manager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize UTXO Manager:', error);
      addNotification('error', 'Failed to initialize UTXO Manager');
    }
  });

  function setupEventListeners() {
    // Library events
    utxoLibrary.on('library:initialized', (data: any) => {
      isInitialized = true;
      addNotification('success', 'UTXO Library initialized successfully');
      refreshData();
    });

    // Wallet events
    utxoLibrary.on('wallet:connected', (eoa: EOAData) => {
      currentAccount = eoa;
      addNotification('success', `Wallet connected: ${eoa.address.slice(0, 6)}...${eoa.address.slice(-4)}`);
      refreshData();
    });

    utxoLibrary.on('wallet:disconnected', () => {
      currentAccount = null;
      utxos = [];
      stats = null;
      isInitialized = false;
      addNotification('info', 'Wallet disconnected');
    });

    // UTXO events
    utxoLibrary.on('utxo:created', (utxo: ExtendedUTXOData) => {
      addNotification('success', `UTXO created: ${utxo.value.toString()} tokens`);
      refreshData();
    });

    utxoLibrary.on('utxo:spent', (utxoId: string) => {
      addNotification('info', `UTXO spent: ${utxoId.slice(0, 8)}...`);
      refreshData();
    });

    // Operation events
    utxoLibrary.on('operation:failed', (error: any) => {
      addNotification('error', `Operation failed: ${error.message}`);
    });
  }

  async function initializeLibrary() {
    try {
      const success = await utxoLibrary.initialize(CONTRACT_ADDRESS, PREFERRED_PROVIDER);
      if (!success) {
        addNotification('error', 'Failed to initialize library');
      }
    } catch (error) {
      console.error('Initialization error:', error);
      addNotification('error', 'Library initialization failed');
    }
  }

  async function refreshData() {
    if (!isInitialized || !currentAccount) return;

    try {
      // Sync with blockchain
      await utxoLibrary.syncWithBlockchain();
      
      // Get UTXOs
      utxos = utxoLibrary.getUTXOsByOwner(currentAccount.address);
      
      // Get stats
      stats = utxoLibrary.getStats();
    } catch (error) {
      console.error('Failed to refresh data:', error);
      addNotification('error', 'Failed to refresh data');
    }
  }

  function addNotification(type: string, message: string) {
    const notification = {
      id: Date.now().toString(),
      type,
      message
    };
    notifications = [notification, ...notifications];
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      notifications = notifications.filter(n => n.id !== notification.id);
    }, 5000);
  }

  function removeNotification(id: string) {
    notifications = notifications.filter(n => n.id !== id);
  }

  function setActiveTab(tab: string) {
    activeTab = tab;
  }
</script>

<svelte:head>
  <title>UTXO Manager - Privacy-First Token Management</title>
  <meta name="description" content="Manage ERC20 tokens with privacy using UTXOs and Zenroom cryptography" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
  <!-- Notifications -->
  {#if notifications.length > 0}
    <div class="fixed top-4 right-4 z-50 space-y-2">
      {#each notifications as notification (notification.id)}
        <div 
          class="p-4 rounded-lg shadow-lg max-w-sm animate-slide-in"
          class:bg-green-600={notification.type === 'success'}
          class:bg-red-600={notification.type === 'error'}
          class:bg-blue-600={notification.type === 'info'}
          class:bg-yellow-600={notification.type === 'warning'}
        >
          <div class="flex items-center justify-between text-white">
            <span class="text-sm">{notification.message}</span>
            <button 
              on:click={() => removeNotification(notification.id)}
              class="ml-2 text-white hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Header -->
  <header class="bg-black/20 backdrop-blur-sm border-b border-white/10">
    <div class="container mx-auto px-4 py-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <div class="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
            <span class="text-white font-bold text-xl">U</span>
          </div>
          <div>
            <h1 class="text-2xl font-bold text-white">UTXO Manager</h1>
            <p class="text-gray-300 text-sm">Privacy-First Token Management</p>
          </div>
        </div>
        
        <div class="flex items-center space-x-4">
          {#if isInitialized}
            <div class="flex items-center space-x-2 text-green-400">
              <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span class="text-sm">Connected</span>
            </div>
          {/if}
          
          <WalletConnection 
            {utxoLibrary}
            {currentAccount}
            {isInitialized}
            on:initialize={initializeLibrary}
            on:refresh={refreshData}
          />
        </div>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="container mx-auto px-4 py-8">
    {#if !isInitialized}
      <!-- Welcome Screen -->
      <div class="text-center py-20">
        <div class="max-w-2xl mx-auto">
          <h2 class="text-4xl font-bold text-white mb-6">
            Welcome to UTXO Manager
          </h2>
          <p class="text-xl text-gray-300 mb-8">
            Transform your ERC20 tokens into privacy-preserving UTXOs using Zenroom cryptography
          </p>
          
          <div class="grid md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div class="text-purple-400 text-2xl mb-3">🔒</div>
              <h3 class="text-white font-semibold mb-2">Privacy First</h3>
              <p class="text-gray-300 text-sm">Your transactions are private using Zenroom zero-knowledge proofs</p>
            </div>
            
            <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div class="text-blue-400 text-2xl mb-3">⚡</div>
              <h3 class="text-white font-semibold mb-2">UTXO Model</h3>
              <p class="text-gray-300 text-sm">Efficient transaction model with better privacy and scalability</p>
            </div>
            
            <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div class="text-green-400 text-2xl mb-3">🔗</div>
              <h3 class="text-white font-semibold mb-2">ERC20 Compatible</h3>
              <p class="text-gray-300 text-sm">Use any ERC20 token with seamless conversion to UTXOs</p>
            </div>
          </div>

          <button 
            on:click={initializeLibrary}
            class="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Get Started
          </button>
        </div>
      </div>
    {:else}
      <!-- Dashboard -->
      <div class="space-y-8">
        <!-- Stats Overview -->
        {#if stats}
          <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div class="text-purple-400 text-sm font-medium mb-1">Total UTXOs</div>
              <div class="text-white text-2xl font-bold">{stats.unspentUTXOs}</div>
            </div>
            
            <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div class="text-blue-400 text-sm font-medium mb-1">Unique Tokens</div>
              <div class="text-white text-2xl font-bold">{stats.uniqueTokens}</div>
            </div>
            
            <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div class="text-green-400 text-sm font-medium mb-1">Avg UTXO Value</div>
              <div class="text-white text-2xl font-bold">{stats.averageUTXOValue.toString()}</div>
            </div>
            
            <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div class="text-yellow-400 text-sm font-medium mb-1">Confirmed</div>
              <div class="text-white text-2xl font-bold">{stats.confirmedUTXOs}</div>
            </div>
          </div>
        {/if}

        <!-- Tab Navigation -->
        <div class="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
          <div class="flex space-x-1 p-1">
            {#each [
              { id: 'balance', label: 'Balance', icon: '💰' },
              { id: 'deposit', label: 'Deposit', icon: '📥' },
              { id: 'operations', label: 'Operations', icon: '⚡' },
              { id: 'history', label: 'History', icon: '📜' }
            ] as tab}
              <button
                on:click={() => setActiveTab(tab.id)}
                class="flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium transition-all duration-200 {activeTab === tab.id ? 'bg-white/20 text-white' : 'text-gray-300 hover:bg-white/10'}"
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Tab Content -->
        <div class="space-y-6">
          {#if activeTab === 'balance'}
            <UTXOBalance {utxos} {stats} on:refresh={refreshData} />
          {:else if activeTab === 'deposit'}
            <DepositForm {utxoLibrary} on:deposited={refreshData} />
          {:else if activeTab === 'operations'}
            <OperationsPanel {utxoLibrary} {utxos} on:operation={refreshData} />
          {:else if activeTab === 'history'}
            <TransactionHistory {utxos} />
          {/if}
        </div>
      </div>
    {/if}
  </main>
</div>

<style>
  @keyframes slide-in {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  
  .animate-slide-in {
    animation: slide-in 0.3s ease-out;
  }
  
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  /* Custom scrollbar */
  :global(::-webkit-scrollbar) {
    width: 8px;
  }
  
  :global(::-webkit-scrollbar-track) {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }
  
  :global(::-webkit-scrollbar-thumb) {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 4px;
  }
  
  :global(::-webkit-scrollbar-thumb:hover) {
    background: rgba(255, 255, 255, 0.4);
  }
  
  /* Focus styles for accessibility */
  :global(button:focus, input:focus, select:focus) {
    outline: 2px solid #8b5cf6;
    outline-offset: 2px;
  }
  
  /* Mobile responsive improvements */
  @media (max-width: 768px) {
    .container {
      padding-left: 1rem;
      padding-right: 1rem;
    }
    
    .grid {
      gap: 1rem;
    }
    
    .text-4xl {
      font-size: 2rem;
    }
    
    .text-2xl {
      font-size: 1.5rem;
    }
  }
  
  /* Dark mode optimizations */
  :global(body) {
    background: #0f0f23;
    color: white;
  }
</style>
