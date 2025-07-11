<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { PrivateUTXOManager, type PrivateUTXO } from '$lib/PrivateUTXOManager';
  import { PrivateUTXOStorage } from '$lib/PrivateUTXOStorage';
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
  let privateUTXOManager: PrivateUTXOManager;
  let isInitialized = false;
  let currentAccount: EOAData | null = null;
  let utxos: ExtendedUTXOData[] = [];
  let privateUTXOs: PrivateUTXO[] = [];
  let stats: UTXOManagerStats | null = null;
  let activeTab = 'balance';
  let notifications: Array<{id: string, type: string, message: string}> = [];
  let privacyMode = true; // Default to privacy mode

  // Configuration
  const CONTRACT_ADDRESS = '0x4735A18Ef4B63520C0AE9bC990ee234AAb95dE9c'; // amoy
  const PREFERRED_PROVIDER = WalletProviderType.METAMASK;

  onMount(async () => {
    try {
      // Initialize Private UTXO Manager
      privateUTXOManager = new PrivateUTXOManager({
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

      console.log('🔧 Private UTXO Manager initialized');
      
      // Auto-initialize library and reconnect if possible
      await initializeLibrary();
      
    } catch (error) {
      console.error('❌ Failed to initialize Private UTXO Manager:', error);
      addNotification('error', 'Failed to initialize Private UTXO Manager');
    }
  });

  function setupEventListeners() {
    // Library events
    privateUTXOManager.on('library:initialized', (data: any) => {
      isInitialized = true;
      addNotification('success', 'Private UTXO Manager initialized successfully');
      refreshData();
    });

    // Wallet events
    privateUTXOManager.on('wallet:connected', async (eoa: EOAData) => {
      currentAccount = eoa;
      addNotification('success', `Wallet connected: ${eoa.address.slice(0, 6)}...${eoa.address.slice(-4)}`);
      
      // Try full refresh first
      await refreshData();
      
      // If no private UTXOs loaded, try loading all user UTXOs
      if (privateUTXOs.length === 0) {
        console.log('🔄 No UTXOs from sync, trying to load stored UTXOs...');
        loadAllUserUTXOs();
      }
    });

    privateUTXOManager.on('wallet:disconnected', () => {
      currentAccount = null;
      utxos = [];
      privateUTXOs = [];
      stats = null;
      isInitialized = false;
      addNotification('info', 'Wallet disconnected');
    });

    // UTXO events
    privateUTXOManager.on('utxo:created', (utxo: ExtendedUTXOData) => {
      addNotification('success', `UTXO created: ${utxo.value.toString()} tokens`);
      refreshData();
      // Switch to balance tab to show the new UTXO
      setActiveTab('balance');
    });

    // Private UTXO events
    privateUTXOManager.on('private:utxo:created', (utxo: PrivateUTXO) => {
      addNotification('success', `🎉 Private UTXO created successfully! Check your balance.`);
      refreshData();
      // Switch to balance tab to show the new private UTXO
      setActiveTab('balance');
    });

    privateUTXOManager.on('private:utxo:transferred', (data: { from: string, to: string }) => {
      addNotification('success', `Private UTXO transferred successfully`);
      refreshData();
    });

    privateUTXOManager.on('private:utxo:spent', (utxoId: string) => {
      addNotification('info', `Private UTXO spent: ${utxoId.slice(0, 8)}...`);
      refreshData();
    });

    privateUTXOManager.on('private:utxo:withdrawn', (utxoId: string) => {
      addNotification('success', `Private UTXO withdrawn successfully`);
      refreshData();
    });

    // Operation events
    privateUTXOManager.on('operation:failed', (error: any) => {
      addNotification('error', `Operation failed: ${error.message}`);
    });
  }

  async function initializeLibrary() {
    try {
      console.log('🚀 Initializing library...');
      const success = await privateUTXOManager.initialize(CONTRACT_ADDRESS, PREFERRED_PROVIDER);
      if (!success) {
        addNotification('error', 'Failed to initialize Private UTXO Manager');
        return;
      }
      
      console.log('✅ Library initialized successfully');
      
      // Try to auto-reconnect if MetaMask is already connected
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            console.log('🔄 Auto-reconnecting to existing wallet session...');
            const reconnectResult = await privateUTXOManager.connectWallet(PREFERRED_PROVIDER);
            if (reconnectResult.success) {
              console.log('✅ Auto-reconnection successful');
            }
          }
        } catch (autoConnectError: any) {
          console.log('ℹ️ Auto-reconnect not available:', autoConnectError.message || autoConnectError);
        }
      }
      
    } catch (error) {
      console.error('Initialization error:', error);
      addNotification('error', 'Private UTXO Manager initialization failed');
    }
  }

  async function refreshData() {
    if (!isInitialized || !currentAccount) {
      console.log('⏸️ RefreshData skipped:', { isInitialized, currentAccount: !!currentAccount });
      return;
    }

    try {
      console.log('🔄 Starting refreshData...');
      
      // Sync with blockchain and localStorage
      const syncSuccess = await privateUTXOManager.syncWithBlockchain();
      console.log('🔄 Sync result:', syncSuccess);
      
      // Get regular UTXOs
      utxos = privateUTXOManager.getUTXOsByOwner(currentAccount.address);
      console.log('🔗 Regular UTXOs after refresh:', {
        total: utxos.length,
        unspent: utxos.filter(u => !u.isSpent).length,
        spent: utxos.filter(u => u.isSpent).length
      });
      
      // Get private UTXOs (now from localStorage)
      privateUTXOs = privateUTXOManager.getPrivateUTXOsByOwner(currentAccount.address);
      console.log('🔒 Private UTXOs after refresh:', {
        total: privateUTXOs.length,
        unspent: privateUTXOs.filter(u => !u.isSpent).length,
        spent: privateUTXOs.filter(u => u.isSpent).length,
        details: privateUTXOs.map(u => ({
          id: u.id.slice(0, 8) + '...',
          value: u.value.toString(),
          isSpent: u.isSpent,
          createdAt: new Date(u.localCreatedAt).toLocaleTimeString()
        }))
      });
      
      // Get stats
      stats = privateUTXOManager.getStats();
      
      console.log('📊 Data refreshed successfully:', {
        totalUTXOs: utxos.length + privateUTXOs.length,
        availableForOperations: utxos.filter(u => !u.isSpent && u.confirmed).length + privateUTXOs.filter(u => !u.isSpent).length,
        stats
      });
    } catch (error) {
      console.error('Failed to refresh data:', error);
      addNotification('error', 'Failed to refresh data');
    }
  }

  // Debug function for multi-account storage
  function debugMultiAccountStorage() {
    if (!currentAccount?.address) {
      addNotification('error', 'Please connect wallet first');
      return;
    }

    try {
      console.log('🔍 === MULTI-ACCOUNT STORAGE DEBUG ===');
      
      // Current account detailed info
      console.log(`\n👤 Current Account: ${currentAccount.address}`);
      PrivateUTXOStorage.debugStorage(currentAccount.address);
      
      // All accounts in system
      const allAccounts = PrivateUTXOStorage.getAllStoredAccounts();
      console.log(`\n👥 All accounts with data (${allAccounts.length}):`);
      allAccounts.forEach((account, i) => {
        console.log(`${i + 1}. ${account}`);
        const stats = PrivateUTXOStorage.getEnhancedUserStats(account);
        console.log(`   - Owned: ${stats.ownedCount} UTXOs, Received: ${stats.receivedCount} UTXOs`);
        console.log(`   - Total Balance: ${stats.totalBalance.toString()}`);
      });
      
      // Enhanced stats for current user
      const enhancedStats = PrivateUTXOStorage.getEnhancedUserStats(currentAccount.address);
      console.log(`\n📊 Enhanced Stats for ${currentAccount.address}:`);
      console.log(`- Owned UTXOs: ${enhancedStats.breakdown.owned.count} (${enhancedStats.breakdown.owned.balance.toString()})`);
      console.log(`- Received UTXOs: ${enhancedStats.breakdown.received.count} (${enhancedStats.breakdown.received.balance.toString()})`);
      console.log(`- Total: ${enhancedStats.totalCount} UTXOs (${enhancedStats.totalBalance.toString()})`);
      
      addNotification('success', `Debug complete! Found ${allAccounts.length} accounts with data. Check console for details.`);
      
    } catch (error: any) {
      console.error('❌ Multi-account debug failed:', error);
      addNotification('error', `Debug failed: ${error.message || error}`);
    }
  }

  // Load UTXOs with enhanced multi-account support
  function loadAllUserUTXOs() {
    if (!currentAccount?.address) {
      addNotification('error', 'Please connect wallet first');
      return;
    }

    try {
      console.log('🔄 Loading all UTXOs (owned + received)...');
      
      // Get all UTXOs for current user
      const { owned, received, all } = PrivateUTXOStorage.getAllUserUTXOs(currentAccount.address);
      
      console.log(`🔄 Found UTXOs:`);
      console.log(`  - Owned: ${owned.length}`);
      console.log(`  - Received: ${received.length}`);
      console.log(`  - Total: ${all.length}`);
      
      // Update the UI with all UTXOs
      privateUTXOs = all;
      
      // Show result
      if (all.length > 0) {
        addNotification('success', `Loaded ${all.length} UTXOs (${owned.length} owned + ${received.length} received)`);
        console.log('🔄 UTXO breakdown:', all.map((u: any) => ({ 
          id: u.id, 
          value: u.value, 
          owner: u.owner,
          type: typeof u.value,
          isOwned: u.owner.toLowerCase() === currentAccount?.address.toLowerCase()
        })));
      } else {
        addNotification('info', 'No UTXOs found. Create some deposits first.');
      }
      
    } catch (error: any) {
      console.error('❌ Failed to load all UTXOs:', error);
      addNotification('error', `Failed to load UTXOs: ${error.message || error}`);
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

  function togglePrivacyMode() {
    privacyMode = !privacyMode;
    addNotification('info', `Privacy mode ${privacyMode ? 'enabled' : 'disabled'}`);
    refreshData();
  }

  // Get combined balance (regular + private UTXOs)
  function getTotalBalance(tokenAddress?: string): bigint {
    const regularBalance = utxos
      .filter(utxo => !tokenAddress || utxo.tokenAddress === tokenAddress)
      .reduce((sum, utxo) => sum + utxo.value, BigInt(0));
    
    const privateBalance = privateUTXOManager?.getPrivateBalance(tokenAddress) || BigInt(0);
    
    return regularBalance + privateBalance;
  }

  // Expose debug function to global scope for development (optional)
  if (typeof window !== 'undefined') {
    (window as any).debugUTXOStorage = () => {
      if (currentAccount?.address) {
        debugMultiAccountStorage();
      } else {
        console.warn('No account connected. Connect wallet first.');
      }
    };
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
            <div class="flex items-center space-x-4">
              <!-- Privacy Mode Toggle -->
              <button
                on:click={togglePrivacyMode}
                class="flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 {privacyMode ? 'bg-purple-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}"
              >
                <span>{privacyMode ? '🔐' : '🔓'}</span>
                <span class="text-sm">{privacyMode ? 'Private' : 'Public'}</span>
              </button>
              
              <!-- Debug Tools -->
              {#if currentAccount}
                <button
                  on:click={loadAllUserUTXOs}
                  class="flex items-center space-x-2 px-3 py-2 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 transition-all duration-200"
                  title="Load all UTXOs (owned + received)"
                >
                  <span>�</span>
                  <span class="text-sm">Load All UTXOs</span>
                </button>
                
                <button
                  on:click={debugMultiAccountStorage}
                  class="flex items-center space-x-2 px-3 py-2 rounded-lg bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 transition-all duration-200"
                  title="Debug multi-account storage system"
                >
                  <span>�</span>
                  <span class="text-sm">Debug Storage</span>
                </button>
              {/if}
              
              <!-- Connection Status -->
              <div class="flex items-center space-x-2 text-green-400">
                <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span class="text-sm">Connected</span>
              </div>
            </div>
          {/if}
          
          <WalletConnection 
            utxoManager={privateUTXOManager}
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
          <div class="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div class="text-purple-400 text-sm font-medium mb-1">Regular UTXOs</div>
              <div class="text-white text-2xl font-bold">{stats.unspentUTXOs}</div>
            </div>
            
            <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div class="text-pink-400 text-sm font-medium mb-1">Private UTXOs</div>
              <div class="text-white text-2xl font-bold">{privateUTXOs.length}</div>
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
          {#if activeTab === 'balance' }
            {#if utxos.length === 0 && privateUTXOs.length === 0}
              <div class="text-center text-gray-400">
                No UTXOs found. Start by depositing tokens.
              </div>
            {:else}
              <UTXOBalance 
                {utxos} 
                {privateUTXOs}
                {stats} 
                {privacyMode}
                on:refresh={refreshData} 
              />
            {/if}
          {:else if activeTab === 'deposit'}
            <DepositForm 
              utxoManager={privateUTXOManager} 
              {privacyMode}
              on:deposited={refreshData} 
            />
          {:else if activeTab === 'operations'}
            <OperationsPanel 
              utxoManager={privateUTXOManager} 
              {utxos} 
              {privateUTXOs}
              {privacyMode}
              on:operation={refreshData} 
            />
          {:else if activeTab === 'history'}
            <TransactionHistory 
              {utxos} 
              {privateUTXOs}
              {privacyMode}
            />
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
