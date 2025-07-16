<script lang="ts">
  import { onMount } from 'svelte';
  import { privateUTXOManager } from '$lib/PrivateUTXOManager'; // ✅ Sin 'type' para la instancia
  import type { PrivateUTXO } from '$lib/PrivateUTXOManager'; // ✅ Solo el tipo
  import { PrivateUTXOStorage } from '$lib/PrivateUTXOStorage';
  import { WalletProviderType } from '../types/ethereum.types';
  import type { UTXOManagerStats, UTXOManagerConfig } from '../types/utxo.types'; // ✅ Desde utxo.types
  import type { EOAData } from '../types/ethereum.types';

  // ========================
  // STATE MANAGEMENT
  // ========================
  
  let isInitialized = false;
  let currentAccount: EOAData | null = null;
  let privateUTXOs: PrivateUTXO[] = [];
  let stats: UTXOManagerStats | null = null;
  let notifications: Array<{id: string, type: string, message: string}> = [];
  let config: UTXOManagerConfig = {
    autoConsolidate: false,
    consolidationThreshold: 5,
    maxUTXOAge: 7 * 24 * 60 * 60,
    privacyMode: true,
    defaultGasLimit: BigInt(500000),
    cacheTimeout: 30000,
    enableBackup: true
  };

  // Operation states
  let isConnecting = false;
  let isCreatingUTXO = false;
  let isTransferring = false;
  let isSplitting = false;
  let isWithdrawing = false;

  // Form data
  let createForm = {
    amount: '',
    tokenAddress: ''
  };
  let transferForm = {
    utxoId: '',
    newOwner: ''
  };
  let splitForm = {
    utxoId: '',
    outputValues: ['', '']
  };

  // ========================
  // NOTIFICATION SYSTEM
  // ========================
  
  function addNotification(type: 'success' | 'error' | 'info' | 'warning', message: string) {
    const id = Math.random().toString(36).substr(2, 9);
    notifications = [...notifications, { id, type, message }];
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      notifications = notifications.filter(n => n.id !== id);
    }, 5000);
  }

  function removeNotification(id: string) {
    notifications = notifications.filter(n => n.id !== id);
  }

  // ========================
  // EVENT LISTENERS
  // ========================
  
  function setupEventListeners() {
    // UTXO events
    privateUTXOManager.on('private:utxo:created', (utxo: PrivateUTXO) => {
      console.log('🔐 Private UTXO created:', utxo);
      addNotification('success', `Private UTXO created: ${utxo.value.toString()}`);
      refreshData();
    });

    privateUTXOManager.on('private:utxo:transferred', (data: any) => {
      console.log('🔄 Private UTXO transferred:', data);
      addNotification('success', 'Private UTXO transferred successfully');
      refreshData();
    });

    privateUTXOManager.on('private:utxo:split', (data: any) => {
      console.log('✂️ Private UTXO split:', data);
      addNotification('success', `Private UTXO split into ${data.outputUTXOIds.length} outputs`);
      refreshData();
    });

    privateUTXOManager.on('private:utxo:withdrawn', (utxoId: string) => {
      console.log('💸 Private UTXO withdrawn:', utxoId);
      addNotification('success', 'Private UTXO withdrawn successfully');
      refreshData();
    });

    // Blockchain events
    privateUTXOManager.on('blockchain:synced', (data: any) => {
      console.log('🔄 Blockchain synced:', data);
      addNotification('info', 'Data synchronized with blockchain');
    });

    privateUTXOManager.on('blockchain:sync:failed', (error: any) => {
      console.error('❌ Blockchain sync failed:', error);
      addNotification('error', 'Failed to sync with blockchain');
    });
  }

  // ========================
  // WALLET CONNECTION
  // ========================
  
  async function connectWallet() {
    if (isConnecting) return;
    
    isConnecting = true;
    try {
      console.log('🔌 Connecting wallet...');
      
      await privateUTXOManager.connectWallet(WalletProviderType.METAMASK);
      const account = privateUTXOManager.currentAccount;
      
      if (account) {
        currentAccount = account;
        isInitialized = true;
        addNotification('success', 'Wallet connected successfully');
        await refreshData();
      } else {
        throw new Error('No account found after connection');
      }
    } catch (error) {
      console.error('❌ Wallet connection failed:', error);
      addNotification('error', 'Failed to connect wallet');
    } finally {
      isConnecting = false;
    }
  }

  async function disconnectWallet() {
    try {
      await privateUTXOManager.disconnect();
      currentAccount = null;
      isInitialized = false;
      privateUTXOs = [];
      stats = null;
      addNotification('info', 'Wallet disconnected');
    } catch (error) {
      console.error('❌ Disconnect failed:', error);
      addNotification('error', 'Failed to disconnect wallet');
    }
  }

  // ========================
  // LIBRARY INITIALIZATION
  // ========================
  
  async function initializeLibrary() {
    try {
      console.log('🚀 Initializing library...');
      
      const success = await privateUTXOManager.initialize('default');
      if (success) {
        isInitialized = true;
        const account = privateUTXOManager.currentAccount;
        if (account) {
          currentAccount = account;
          await refreshData();
        }
        addNotification('success', 'Library initialized successfully');
      } else {
        throw new Error('Library initialization failed');
      }
    } catch (error) {
      console.error('❌ Library initialization failed:', error);
      addNotification('error', 'Failed to initialize library');
    }
  }

  // ========================
  // DATA REFRESH
  // ========================
  
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
      
      // Get private UTXOs (from localStorage)
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
      
      // Get stats - SOLO estadísticas, no configuración
      stats = privateUTXOManager.getUTXOStats();
      
      console.log('📊 Data refreshed successfully:', {
        totalPrivateUTXOs: privateUTXOs.length,
        availableForOperations: privateUTXOs.filter(u => !u.isSpent).length,
        stats,
        config
      });
    } catch (error) {
      console.error('Failed to refresh data:', error);
      addNotification('error', 'Failed to refresh data');
    }
  }

  // ========================
  // UTXO OPERATIONS
  // ========================
  
  async function createPrivateUTXO() {
    if (!createForm.amount || !createForm.tokenAddress || isCreatingUTXO) return;
    
    isCreatingUTXO = true;
    try {
      const amount = BigInt(createForm.amount);
      
      const result = await privateUTXOManager.createPrivateUTXO({
        amount,
        tokenAddress: createForm.tokenAddress,
        owner: currentAccount!.address
      });

      if (result.success) {
        addNotification('success', 'Private UTXO created successfully');
        createForm.amount = '';
        createForm.tokenAddress = '';
        await refreshData();
      } else {
        throw new Error(result.error || 'Failed to create private UTXO');
      }
    } catch (error) {
      console.error('❌ Create UTXO failed:', error);
      addNotification('error', error instanceof Error ? error.message : 'Failed to create private UTXO');
    } finally {
      isCreatingUTXO = false;
    }
  }

  async function transferPrivateUTXO() {
    if (!transferForm.utxoId || !transferForm.newOwner || isTransferring) return;
    
    isTransferring = true;
    try {
      const result = await privateUTXOManager.transferPrivateUTXO({
        utxoId: transferForm.utxoId,
        newOwner: transferForm.newOwner
      });

      if (result.success) {
        addNotification('success', 'Private UTXO transferred successfully');
        transferForm.utxoId = '';
        transferForm.newOwner = '';
        await refreshData();
      } else {
        throw new Error(result.error || 'Failed to transfer private UTXO');
      }
    } catch (error) {
      console.error('❌ Transfer failed:', error);
      addNotification('error', error instanceof Error ? error.message : 'Failed to transfer private UTXO');
    } finally {
      isTransferring = false;
    }
  }

  async function splitPrivateUTXO() {
    if (!splitForm.utxoId || isSplitting) return;
    
    const outputValues = splitForm.outputValues
      .filter(v => v.trim() !== '')
      .map(v => BigInt(v.trim()));
    
    if (outputValues.length < 2) {
      addNotification('error', 'Need at least 2 output values for split');
      return;
    }
    
    isSplitting = true;
    try {
      const result = await privateUTXOManager.splitPrivateUTXO({
        inputUTXOId: splitForm.utxoId,
        outputValues,
        outputOwners: new Array(outputValues.length).fill(currentAccount!.address)
      });

      if (result.success) {
        addNotification('success', `Private UTXO split into ${outputValues.length} outputs`);
        splitForm.utxoId = '';
        splitForm.outputValues = ['', ''];
        await refreshData();
      } else {
        throw new Error(result.error || 'Failed to split private UTXO');
      }
    } catch (error) {
      console.error('❌ Split failed:', error);
      addNotification('error', error instanceof Error ? error.message : 'Failed to split private UTXO');
    } finally {
      isSplitting = false;
    }
  }

  async function withdrawPrivateUTXO(utxoId: string) {
    if (isWithdrawing) return;
    
    isWithdrawing = true;
    try {
      const result = await privateUTXOManager.withdrawPrivateUTXO({
        utxoId,
        recipient: currentAccount!.address
      });

      if (result.success) {
        addNotification('success', 'Private UTXO withdrawn successfully');
        await refreshData();
      } else {
        throw new Error(result.error || 'Failed to withdraw private UTXO');
      }
    } catch (error) {
      console.error('❌ Withdraw failed:', error);
      addNotification('error', error instanceof Error ? error.message : 'Failed to withdraw private UTXO');
    } finally {
      isWithdrawing = false;
    }
  }

  // ========================
  // LIFECYCLE
  // ========================
  
  onMount(async () => {
    try {
      // Clear old contract data since we deployed a new one
      if (typeof window !== 'undefined') {
        const oldData = localStorage.getItem('private_utxos');
        if (oldData) {
          console.log('🗑️ Clearing old contract data...');
          localStorage.removeItem('private_utxos');
          localStorage.removeItem('utxo_cache');
          // Clear any other old keys that might exist
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('utxo_') || key.startsWith('private_utxo_') || key.startsWith('bbs_')) {
              localStorage.removeItem(key);
            }
          });
          addNotification('info', 'Cleared old contract data for new deployment');
        }
      }

      // Setup event listeners
      setupEventListeners();

      console.log('🔐 Private UTXO Manager initialized with REAL cryptography only');
      
      // Auto-initialize library and reconnect if possible
      await initializeLibrary();
      
    } catch (error) {
      console.error('❌ Failed to initialize Private UTXO Manager:', error);
      addNotification('error', 'Failed to initialize Private UTXO Manager');
    }
  });
</script>

<!-- ======================== -->
<!-- NOTIFICATIONS -->
<!-- ======================== -->
{#if notifications.length > 0}
  <div class="fixed top-4 right-4 z-50 space-y-2">
    {#each notifications as notification (notification.id)}
      <div 
        class="alert alert-{notification.type} shadow-lg max-w-sm"
        class:alert-success={notification.type === 'success'}
        class:alert-error={notification.type === 'error'}
        class:alert-info={notification.type === 'info'}
        class:alert-warning={notification.type === 'warning'}
      >
        <div class="flex justify-between items-center">
          <span class="text-sm">{notification.message}</span>
          <button 
            on:click={() => removeNotification(notification.id)}
            class="btn btn-ghost btn-xs"
          >✕</button>
        </div>
      </div>
    {/each}
  </div>
{/if}

<!-- ======================== -->
<!-- MAIN CONTENT -->
<!-- ======================== -->
<div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
  <div class="container mx-auto px-4 py-8">
    <div class="text-center mb-8">
      <h1 class="text-4xl font-bold text-white mb-2">Private UTXO Manager</h1>
      <p class="text-slate-300">Real BN254 Cryptography • Zero-Knowledge Proofs • Full Privacy</p>
    </div>

    <!-- Connection Status -->
    {#if !currentAccount}
      <div class="card bg-base-200 shadow-xl mb-8">
        <div class="card-body text-center">
          <h2 class="card-title justify-center text-2xl mb-4">Connect Your Wallet</h2>
          <p class="text-base-content/70 mb-6">Connect your wallet to start using private UTXOs with real BN254 cryptography</p>
          <button 
            class="btn btn-primary btn-lg"
            class:loading={isConnecting}
            on:click={connectWallet}
            disabled={isConnecting}
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        </div>
      </div>
    {:else}
      <!-- Connected Wallet Info -->
      <div class="card bg-base-200 shadow-xl mb-8">
        <div class="card-body">
          <div class="flex justify-between items-center">
            <div>
              <h2 class="card-title">Connected Account</h2>
              <p class="text-sm text-base-content/70">{currentAccount.address}</p>
            </div>
            <button class="btn btn-outline btn-sm" on:click={disconnectWallet}>
              Disconnect
            </button>
          </div>
        </div>
      </div>

      <!-- Debug info para configuración -->
      {#if config.privacyMode}
        <div class="bg-purple-600/20 border border-purple-500/30 rounded-lg p-4 mb-4">
          <div class="flex items-center space-x-2 text-purple-300">
            <span>🔐</span>
            <span class="text-sm">Privacy Mode: ON - Using real BN254 cryptography</span>
          </div>
        </div>
      {/if}

      <!-- Stats Display -->
      {#if stats}
        <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div class="stat bg-base-200 rounded-lg">
            <div class="stat-title">Private UTXOs</div>
            <div class="stat-value text-primary">{privateUTXOs.length}</div>
          </div>
          
          <div class="stat bg-base-200 rounded-lg">
            <div class="stat-title">Unspent</div>
            <div class="stat-value text-secondary">{stats.unspentUTXOs}</div>
          </div>
          
          <div class="stat bg-base-200 rounded-lg">
            <div class="stat-title">Unique Tokens</div>
            <div class="stat-value text-accent">{stats.uniqueTokens}</div>
          </div>
          
          <div class="stat bg-base-200 rounded-lg">
            <div class="stat-title">Total Balance</div>
            <div class="stat-value text-info">{stats.totalBalance.toString()}</div>
          </div>
          
          <div class="stat bg-base-200 rounded-lg">
            <div class="stat-title">BN254 UTXOs</div>
            <div class="stat-value text-success">{stats.bn254UTXOs || 0}</div>
          </div>
          
          <div class="stat bg-base-200 rounded-lg">
            <div class="stat-title">BN254 Ops</div>
            <div class="stat-value text-warning">{stats.bn254Operations || 0}</div>
          </div>
        </div>
      {/if}

      <!-- Operations Tabs -->
      <div class="tabs tabs-bordered mb-6">
        <input type="radio" name="tabs" role="tab" class="tab" aria-label="Create" checked />
        <div role="tabpanel" class="tab-content bg-base-100 border-base-300 rounded-box p-6">
          <h3 class="text-lg font-semibold mb-4">Create Private UTXO</h3>
          <div class="form-control w-full mb-4">
            <label class="label" for="create-amount">
              <span class="label-text">Amount</span>
            </label>
            <input 
              id="create-amount"
              type="number" 
              placeholder="Enter amount" 
              class="input input-bordered w-full" 
              bind:value={createForm.amount}
            />
          </div>
          <div class="form-control w-full mb-4">
            <label class="label" for="create-token">
              <span class="label-text">Token Address</span>
            </label>
            <input 
              id="create-token"
              type="text" 
              placeholder="0x..." 
              class="input input-bordered w-full" 
              bind:value={createForm.tokenAddress}
            />
          </div>
          <button 
            class="btn btn-primary"
            class:loading={isCreatingUTXO}
            on:click={createPrivateUTXO}
            disabled={isCreatingUTXO || !createForm.amount || !createForm.tokenAddress}
          >
            {isCreatingUTXO ? 'Creating...' : 'Create Private UTXO'}
          </button>
        </div>

        <input type="radio" name="tabs" role="tab" class="tab" aria-label="Transfer" />
        <div role="tabpanel" class="tab-content bg-base-100 border-base-300 rounded-box p-6">
          <h3 class="text-lg font-semibold mb-4">Transfer Private UTXO</h3>
          <div class="form-control w-full mb-4">
            <label class="label" for="transfer-utxo">
              <span class="label-text">UTXO ID</span>
            </label>
            <select 
              id="transfer-utxo"
              class="select select-bordered w-full" 
              bind:value={transferForm.utxoId}
            >
              <option value="">Select UTXO</option>
              {#each privateUTXOs.filter(u => !u.isSpent) as utxo}
                <option value={utxo.id}>{utxo.id.slice(0, 16)}... ({utxo.value.toString()})</option>
              {/each}
            </select>
          </div>
          <div class="form-control w-full mb-4">
            <label class="label" for="transfer-owner">
              <span class="label-text">New Owner Address</span>
            </label>
            <input 
              id="transfer-owner"
              type="text" 
              placeholder="0x..." 
              class="input input-bordered w-full" 
              bind:value={transferForm.newOwner}
            />
          </div>
          <button 
            class="btn btn-secondary"
            class:loading={isTransferring}
            on:click={transferPrivateUTXO}
            disabled={isTransferring || !transferForm.utxoId || !transferForm.newOwner}
          >
            {isTransferring ? 'Transferring...' : 'Transfer Private UTXO'}
          </button>
        </div>

        <input type="radio" name="tabs" role="tab" class="tab" aria-label="Split" />
        <div role="tabpanel" class="tab-content bg-base-100 border-base-300 rounded-box p-6">
          <h3 class="text-lg font-semibold mb-4">Split Private UTXO</h3>
          <div class="form-control w-full mb-4">
            <label class="label" for="split-utxo">
              <span class="label-text">UTXO to Split</span>
            </label>
            <select 
              id="split-utxo"
              class="select select-bordered w-full" 
              bind:value={splitForm.utxoId}
            >
              <option value="">Select UTXO</option>
              {#each privateUTXOs.filter(u => !u.isSpent) as utxo}
                <option value={utxo.id}>{utxo.id.slice(0, 16)}... ({utxo.value.toString()})</option>
              {/each}
            </select>
          </div>
          <div class="form-control w-full mb-4">
            <label class="label">
              <span class="label-text">Output Values</span>
            </label>
            <div class="space-y-2">
              {#each splitForm.outputValues as outputValue, i}
                <input 
                  type="number" 
                  placeholder="Output {i + 1} amount" 
                  class="input input-bordered w-full" 
                  bind:value={splitForm.outputValues[i]}
                />
              {/each}
              <button 
                class="btn btn-ghost btn-sm"
                on:click={() => splitForm.outputValues = [...splitForm.outputValues, '']}
              >
                Add Output
              </button>
            </div>
          </div>
          <button 
            class="btn btn-accent"
            class:loading={isSplitting}
            on:click={splitPrivateUTXO}
            disabled={isSplitting || !splitForm.utxoId}
          >
            {isSplitting ? 'Splitting...' : 'Split Private UTXO'}
          </button>
        </div>
      </div>

      <!-- Private UTXOs List -->
      {#if privateUTXOs.length > 0}
        <div class="card bg-base-200 shadow-xl">
          <div class="card-body">
            <h2 class="card-title">Your Private UTXOs</h2>
            <div class="overflow-x-auto">
              <table class="table table-zebra">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Value</th>
                    <th>Token</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {#each privateUTXOs as utxo}
                    <tr>
                      <td class="font-mono text-xs">{utxo.id.slice(0, 16)}...</td>
                      <td>{utxo.value.toString()}</td>
                      <td class="font-mono text-xs">{utxo.tokenAddress.slice(0, 10)}...</td>
                      <td>
                        <div class="badge" class:badge-success={!utxo.isSpent} class:badge-error={utxo.isSpent}>
                          {utxo.isSpent ? 'Spent' : 'Unspent'}
                        </div>
                      </td>
                      <td>{new Date(utxo.localCreatedAt).toLocaleString()}</td>
                      <td>
                        {#if !utxo.isSpent}
                          <button 
                            class="btn btn-error btn-sm"
                            class:loading={isWithdrawing}
                            on:click={() => withdrawPrivateUTXO(utxo.id)}
                            disabled={isWithdrawing}
                          >
                            Withdraw
                          </button>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>