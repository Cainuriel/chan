<script lang="ts">
  import { onMount } from 'svelte';
  import { ethers } from 'ethers';
  import { privateUTXOManager } from '$lib/PrivateUTXOManager';
  import type { PrivateUTXO } from '$lib/PrivateUTXOManager'; 
  import { PrivateUTXOStorage } from '$lib/PrivateUTXOStorage';
  import { EthereumHelpers } from '../utils/ethereum.helpers';
  import { WalletProviderType } from '../types/ethereum.types';
  import type { UTXOManagerStats, UTXOManagerConfig } from '../types/utxo.types';
  import type { EOAData } from '../types/ethereum.types';
  
  // Types for networks
  type NetworkConfig = {
    name: string;
    chainId: number;
    rpcUrl: string;
    blockExplorer: string;
    nativeCurrency: { name: string; symbol: string; decimals: number };
    contractAddress: string;
    requiresGas: boolean; // Whether this network requires gas fees
  };
  
  type NetworkKey = 'amoy' | 'alastria';
  
  // Components
  import WalletConnection from '../lib/components/WalletConnection.svelte';
  import UTXOBalance from '../lib/components/UTXOBalance.svelte';
  import DepositForm from '../lib/components/DepositForm.svelte';
  import OperationsPanel from '../lib/components/OperationsPanel.svelte';
  import TransactionHistory from '../lib/components/TransactionHistory.svelte';

  // State
  let isInitialized = false;
  let currentAccount: EOAData | null = null;
  let privateUTXOs: PrivateUTXO[] = [];
  let stats: UTXOManagerStats | null = null;
  let activeTab = 'balance';
  let notifications: Array<{id: string, type: string, message: string}> = [];
  let selectedNetwork: NetworkKey = 'amoy'; // Default network
  
  // Controlled Flow State
  let isWalletConnected = false;
  let isNetworkSelected = false;
  let isLibraryInitialized = false;
  let currentStep = 1; // 1: Connect Wallet, 2: Select Network, 3: Initialize Library
  
  // Privacy mode - always true since we only support private UTXOs
  const privacyMode = true;

  // Network configurations
  const NETWORKS: Record<NetworkKey, NetworkConfig> = {
    amoy: {
      name: 'Polygon Amoy',
      chainId: 80002,
      rpcUrl: 'https://rpc-amoy.polygon.technology/',
      blockExplorer: 'https://amoy.polygonscan.com',
      nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
      contractAddress: import.meta.env.VITE_ADDRESS_CONTRACT_AMOY || '0x6500599274c436fb8018160aFe557dCCcF2b4A46',
      requiresGas: true // Polygon requires gas fees
    },
    alastria: {
      name: 'Alastria',
      chainId: 2020,
      rpcUrl: 'http://108.142.237.13:8545',
      blockExplorer: 'http://108.142.237.13', // Placeholder, adjust as needed
      nativeCurrency: { name: 'ALA', symbol: 'ALA', decimals: 18 },
      contractAddress: import.meta.env.VITE_ADDRESS_CONTRACT_ALASTRIA || '0xFDe88D0120f59131Ab295F39c95618eF30c282E2',
      requiresGas: false // Alastria is gas-free
    }
  };

  // Configuration - will be updated based on selected network
  let CONTRACT_ADDRESS = NETWORKS[selectedNetwork].contractAddress;
  const PREFERRED_PROVIDER = WalletProviderType.METAMASK;

  onMount(async () => {
    try {
      // Make test function available globally for console access
      if (typeof window !== 'undefined') {
        (window as any).runMigrationTest = runMigrationTest;
        console.log('🧪 Migration test available! Run: await window.runMigrationTest()');
      }

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

      console.log('🔐 Private UTXO Manager ready - waiting for user interaction');
      addNotification('info', '🚀 Ready! Please follow the steps to get started');
      
    } catch (error) {
      console.error('❌ Failed to initialize Private UTXO Manager:', error);
      addNotification('error', 'Failed to initialize Private UTXO Manager');
    }
  });

  function setupEventListeners() {
    // UTXO events
    privateUTXOManager.on('private:utxo:created', (utxo: PrivateUTXO) => {
      console.log('🔐 Private UTXO created:', utxo);
      addNotification('success', `🎉 Private UTXO created successfully! Check your balance.`);
      refreshData();
      setActiveTab('balance');
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
    
    // Wallet connection events
    privateUTXOManager.on('wallet:connected', (account: EOAData) => {
      console.log('🔌 Wallet connected:', account);
      currentAccount = account;
      
      // NO setear isInitialized aquí - solo cuando se complete el flujo completo
      // isInitialized solo debe ser true después de initializeLibrary()
      
      addNotification('success', `Wallet connected: ${account.address.slice(0, 6)}...${account.address.slice(-4)}`);
      
      // Si estamos en el flujo controlado, avanzar al siguiente paso
      if (currentStep === 1) {
        isWalletConnected = true;
        currentStep = 2;
        console.log('✅ Step 1 complete: Advancing to network selection');
      }
      
      // Solo refrescar datos si ya estamos completamente inicializados
      if (isInitialized && isLibraryInitialized) {
        refreshData();
        
        // If no private UTXOs loaded, try loading all user UTXOs
        if (privateUTXOs.length === 0) {
          console.log('🔄 No UTXOs from sync, trying to load stored UTXOs...');
          loadAllUserUTXOs();
        }
      }
    });
    
    privateUTXOManager.on('wallet:disconnected', () => {
      console.log('🔌 Wallet disconnected');
      currentAccount = null;
      isInitialized = false;
      isWalletConnected = false;
      isNetworkSelected = false;
      isLibraryInitialized = false;
      currentStep = 1;
      privateUTXOs = [];
      stats = null;
      addNotification('info', 'Wallet disconnected - Please restart the setup process');
    });
  }

  // ========================
  // NETWORK SWITCHING
  // ========================

  async function switchNetwork(networkKey: NetworkKey) {
    if (!NETWORKS[networkKey]) {
      addNotification('error', 'Unknown network');
      return;
    }

    try {
      const network = NETWORKS[networkKey];
      console.log(`🌐 Switching to ${network.name}...`);
      addNotification('info', `Switching to ${network.name}...`);

      // Check if contract is deployed on this network
      if (!network.contractAddress) {
        addNotification('warning', `⚠️ No contract deployed on ${network.name} yet. Deploy contract first.`);
        selectedNetwork = networkKey;
        CONTRACT_ADDRESS = '';
        return;
      }

      // Request network switch in MetaMask
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          // Try to switch to the network
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${network.chainId.toString(16)}` }],
          });
        } catch (switchError: any) {
          // If the network is not added to MetaMask, add it
          if (switchError.code === 4902) {
            console.log(`Adding ${network.name} to MetaMask...`);
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${network.chainId.toString(16)}`,
                chainName: network.name,
                rpcUrls: [network.rpcUrl],
                blockExplorerUrls: [network.blockExplorer],
                nativeCurrency: network.nativeCurrency
              }],
            });
          } else {
            throw switchError;
          }
        }
      }

      // Update local state
      selectedNetwork = networkKey;
      CONTRACT_ADDRESS = network.contractAddress;

      // Si ya estamos en el flujo y cambiamos de red, necesitamos reinicializar
      if (isLibraryInitialized) {
        console.log('🔄 Network changed after initialization, reinitializing...');
        isLibraryInitialized = false;
        isInitialized = false;
        currentStep = 3; // Volver al paso de inicialización
        addNotification('info', 'Network changed - Please reinitialize the library');
      }

      addNotification('success', `✅ Switched to ${network.name}`);

    } catch (error: any) {
      console.error('❌ Failed to switch network:', error);
      addNotification('error', `Failed to switch to ${NETWORKS[networkKey].name}: ${error.message || error}`);
    }
  }

  // Function to update contract address for current network
  function updateContractAddress(address: string) {
    if (!selectedNetwork || !NETWORKS[selectedNetwork]) {
      addNotification('error', 'No network selected');
      return;
    }

    NETWORKS[selectedNetwork].contractAddress = address;
    CONTRACT_ADDRESS = address;
    addNotification('success', `Contract address updated for ${NETWORKS[selectedNetwork].name}: ${address}`);
  }

  // Handle network change from header selector (when fully initialized)
  async function handleNetworkChange(networkKey: NetworkKey) {
    if (!isLibraryInitialized) {
      // Si no estamos inicializados, solo cambiar la selección
      selectedNetwork = networkKey;
      CONTRACT_ADDRESS = NETWORKS[selectedNetwork].contractAddress || '';
      console.log(`🌐 Network selection changed to ${NETWORKS[selectedNetwork].name} (not initialized yet)`);
      return;
    }

    // Si ya estamos inicializados, necesitamos reinicializar
    console.log(`🌐 Network change from ${NETWORKS[selectedNetwork].name} to ${NETWORKS[networkKey].name} - reinitializing...`);
    
    try {
      // Cambiar red
      await switchNetwork(networkKey);
      
      // El switchNetwork ya maneja la reinicialización
      
    } catch (error: any) {
      console.error('❌ Failed to change network:', error);
      addNotification('error', `Failed to change network: ${error.message || error}`);
    }
  }

  // ========================
  // GAS MANAGEMENT HELPERS
  // ========================
  
  // Check if current network requires gas
  function currentNetworkRequiresGas(): boolean {
    return NETWORKS[selectedNetwork]?.requiresGas ?? true; // Default to true for safety
  }
  
  // Get gas options for transaction based on network
  async function getGasOptions(): Promise<{ gasLimit?: bigint; gasPrice?: bigint; maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint } | null> {
    if (!currentNetworkRequiresGas()) {
      console.log('⛽ Gas-free network detected, skipping gas calculations');
      return null; // No gas options needed for Alastria
    }
    
    try {
      // For networks that require gas, calculate appropriate gas settings
      const provider = EthereumHelpers.getProvider();
      if (!provider) {
        console.warn('⚠️ No provider available for gas calculation');
        return null;
      }
      
      // Try to get current gas price
      const feeData = await provider.getFeeData();
      console.log('⛽ Fee data:', feeData);
      
      const gasOptions: any = {};
      
      // Set gas limit (reasonable default for UTXO operations)
      gasOptions.gasLimit = BigInt(500000); // 500k gas limit
      
      // Handle different gas pricing models
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        // EIP-1559 (Type 2) transactions
        gasOptions.maxFeePerGas = feeData.maxFeePerGas;
        gasOptions.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
        console.log('⛽ Using EIP-1559 gas pricing');
      } else if (feeData.gasPrice) {
        // Legacy (Type 0) transactions
        gasOptions.gasPrice = feeData.gasPrice;
        console.log('⛽ Using legacy gas pricing');
      }
      
      return gasOptions;
      
    } catch (error: any) {
      console.warn('⚠️ Failed to get gas options:', error.message);
      return {
        gasLimit: BigInt(500000), // Fallback gas limit
        gasPrice: BigInt(20000000000) // 20 Gwei fallback
      };
    }
  }
  
  // Wrapper function to add gas options to transaction parameters
  async function addGasOptionsToTx(txParams: any): Promise<any> {
    if (!currentNetworkRequiresGas()) {
      console.log('⛽ Skipping gas options for gas-free network');
      return txParams; // Return unchanged for gas-free networks
    }
    
    const gasOptions = await getGasOptions();
    if (gasOptions) {
      return { ...txParams, ...gasOptions };
    }
    
    return txParams;
  }

  // ========================
  // CONTROLLED FLOW FUNCTIONS
  // ========================
  
  async function step1_connectWallet() {
    try {
      console.log('🔌 Step 1: Connecting wallet...');
      addNotification('info', 'Connecting wallet...');
      
      const success = await privateUTXOManager.connectWallet(PREFERRED_PROVIDER);
      if (success) {
        // El estado se actualiza automáticamente en el evento 'wallet:connected'
        // isWalletConnected = true;
        // currentStep = 2;
        const account = privateUTXOManager.currentAccount;
        if (account) {
          currentAccount = account;
        }
        addNotification('success', '✅ Step 1 complete: Wallet connected!');
        console.log('✅ Step 1 complete: Wallet connected');
      } else {
        addNotification('error', 'Failed to connect wallet');
      }
    } catch (error: any) {
      console.error('❌ Failed to connect wallet:', error);
      addNotification('error', `Failed to connect wallet: ${error.message || error}`);
    }
  }

  async function step2_selectNetwork() {
    try {
      console.log('🌐 Step 2: Confirming network selection...');
      addNotification('info', `Confirming network: ${NETWORKS[selectedNetwork].name}...`);
      
      // Validate that we have a contract address for this network
      if (!NETWORKS[selectedNetwork].contractAddress) {
        addNotification('error', `No contract deployed on ${NETWORKS[selectedNetwork].name}. Please deploy contract first.`);
        return;
      }
      
      // Switch to the selected network
      await switchNetwork(selectedNetwork);
      
      isNetworkSelected = true;
      currentStep = 3;
      CONTRACT_ADDRESS = NETWORKS[selectedNetwork].contractAddress;
      
      addNotification('success', `✅ Step 2 complete: Network ${NETWORKS[selectedNetwork].name} selected!`);
      console.log('✅ Step 2 complete: Network selected');
      
    } catch (error: any) {
      console.error('❌ Failed to select network:', error);
      addNotification('error', `Failed to select network: ${error.message || error}`);
    }
  }

  async function step3_initializeLibrary() {
    try {
      console.log('🚀 Step 3: Initializing UTXO Library...');
      addNotification('info', 'Initializing UTXO Library...');
      
      const success = await initializeLibrary();
      if (success !== false) {
        isLibraryInitialized = true;
        isInitialized = true; // Solo aquí se marca como completamente inicializado
        currentStep = 4; // All steps complete
        addNotification('success', '✅ Step 3 complete: UTXO Library initialized!');
        addNotification('success', '🎉 All steps complete! You can now use the UTXO system.');
        console.log('✅ All steps complete! UTXO system ready');
        
        // Ahora sí podemos cargar datos
        await refreshData();
        if (privateUTXOs.length === 0) {
          console.log('🔄 Loading stored UTXOs after initialization...');
          loadAllUserUTXOs();
        }
      } else {
        addNotification('error', 'Failed to initialize UTXO Library');
      }
    } catch (error: any) {
      console.error('❌ Failed to initialize library:', error);
      addNotification('error', `Failed to initialize library: ${error.message || error}`);
    }
  }

  // Reset flow (for testing or if user wants to start over)
  function resetFlow() {
    console.log('🔄 Resetting flow - all states will be cleared');
    
    // Reset all flow states
    isWalletConnected = false;
    isNetworkSelected = false;
    isLibraryInitialized = false;
    currentStep = 1;
    isInitialized = false;
    
    // Clear data
    currentAccount = null;
    privateUTXOs = [];
    stats = null;
    
    // Disconnect wallet if connected
    if (privateUTXOManager.currentAccount) {
      privateUTXOManager.disconnect();
    }
    
    addNotification('info', '🔄 Flow reset complete. Please start from Step 1.');
    console.log('🔄 Flow reset complete - ready for new setup');
  }

  // ========================
  // LIBRARY INITIALIZATION
  // ========================
  
  async function initializeLibrary() {
    try {
      console.log('🚀 Initializing library with contract address:', CONTRACT_ADDRESS);
      console.log('🌐 Selected network:', NETWORKS[selectedNetwork].name);
      console.log('🔗 Network config:', {
        name: NETWORKS[selectedNetwork].name,
        chainId: NETWORKS[selectedNetwork].chainId,
        rpcUrl: NETWORKS[selectedNetwork].rpcUrl,
        contractAddress: CONTRACT_ADDRESS,
        requiresGas: NETWORKS[selectedNetwork].requiresGas
      });

      if (!CONTRACT_ADDRESS) {
        addNotification('warning', `⚠️ No contract deployed on ${NETWORKS[selectedNetwork].name}. Deploy contract first.`);
        console.error('❌ No contract address provided');
        return false;
      }

      // Verificar que la dirección del contrato es válida
      if (!CONTRACT_ADDRESS.match(/^0x[a-fA-F0-9]{40}$/)) {
        addNotification('error', `❌ Invalid contract address format: ${CONTRACT_ADDRESS}`);
        console.error('❌ Invalid contract address format:', CONTRACT_ADDRESS);
        return false;
      }

      console.log('📋 Starting library initialization...');
      addNotification('info', 'Connecting to contract and verifying deployment...');
      
      const success = await privateUTXOManager.initialize(CONTRACT_ADDRESS);
      if (success) {
        // NO setear isInitialized aquí - se hace en step3_initializeLibrary
        // isInitialized = true;
        const account = privateUTXOManager.currentAccount;
        if (account) {
          currentAccount = account;
          // NO llamar refreshData aquí - se hace después de marcar como completamente inicializado
        }
        console.log('✅ Library initialization completed successfully');
        addNotification('success', `Library initialized successfully on ${NETWORKS[selectedNetwork].name}`);
        return true;
      } else {
        console.error('❌ Library initialization returned false');
        throw new Error('Library initialization failed - returned false');
      }
    } catch (error: any) {
      console.error('❌ Library initialization failed:', error);
      
      // Provide more specific error messages based on error type
      if (error.message?.includes('getRegisteredTokenCount is not a function')) {
        addNotification('error', '❌ Contract missing required methods. This may not be a valid UTXOVault contract.');
        console.error('💡 Suggestion: Verify that the correct UTXOVault contract is deployed at:', CONTRACT_ADDRESS);
      } else if (error.message?.includes('No hay contrato desplegado')) {
        addNotification('error', '❌ No contract found at the specified address. Deploy the contract first.');
      } else if (error.message?.includes('Invalid contract address')) {
        addNotification('error', '❌ Invalid contract address format.');
      } else {
        addNotification('error', `Failed to initialize library: ${error.message || error}`);
      }
      
      return false;
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
        stats
      });
    } catch (error) {
      console.error('Failed to refresh data:', error);
      addNotification('error', 'Failed to refresh data');
    }
  }

  // ========================
  // DEBUG FUNCTIONS
  // ========================

  // Test crypto migration function
  async function runMigrationTest() {
    try {
      addNotification('info', '🧪 Testing crypto migration...');
      // Dynamic import to avoid SSR issues
      const { testMigration } = await import('../utils/migration.test');
      const result = await testMigration();
      if (result.overall) {
        addNotification('success', '✅ Migration test passed! Check console for details.');
      } else {
        addNotification('error', '❌ Migration test failed! Check console for details.');
      }
      return result; // ¡Importante! Retornar el resultado
    } catch (error: any) {
      console.error('❌ Migration test error:', error);
      addNotification('error', `Migration test failed: ${error.message || error}`);
      return { overall: false, error: error.message || error };
    }
  }

  // Clear all local data and start fresh
  function clearAllLocalData() {
    if (!currentAccount?.address) {
      addNotification('error', 'Please connect wallet first');
      return;
    }

    const confirmed = confirm('⚠️ This will DELETE ALL local UTXO data for the current account. This action cannot be undone. Are you sure?');
    if (!confirmed) return;

    try {
      console.log('🗑️ === CLEARING ALL LOCAL DATA ===');
      
      // Clear all localStorage keys related to UTXOs
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('private_utxo_') ||
          key.startsWith('utxo_') ||
          key.startsWith('bbs_keys_') ||
          key === 'private_utxos' ||
          key === 'utxo_cache'
        )) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`🗑️ Removed: ${key}`);
      });
      
      // Reset local state
      privateUTXOs = [];
      stats = null;
      
      addNotification('success', `Cleared ${keysToRemove.length} local storage keys. Please refresh data.`);
      console.log('✅ All local data cleared successfully');
      
    } catch (error: any) {
      console.error('❌ Failed to clear local data:', error);
      addNotification('error', `Failed to clear data: ${error.message || error}`);
    }
  }

  // Debug function to verify UTXO authenticity
  async function verifyUTXOAuthenticity() {
    if (!currentAccount?.address || !isInitialized || !privateUTXOManager) {
      addNotification('error', 'Please connect wallet and initialize first');
      return;
    }

    try {
      console.log('🔍 === UTXO AUTHENTICITY VERIFICATION ===');
      
      // Get local UTXOs
      const localUTXOs = privateUTXOManager.getPrivateUTXOsByOwner(currentAccount.address);
      console.log('📋 Local UTXOs:', localUTXOs.length);
      
      // For each local UTXO, verify blockchain confirmation
      for (const utxo of localUTXOs) {
        console.log(`\n🔍 Verifying UTXO: ${utxo.id}`);
        console.log('UTXO details:', {
          id: utxo.id,
          value: utxo.value?.toString(),
          isSpent: utxo.isSpent,
          creationTxHash: utxo.creationTxHash,
          blockNumber: utxo.blockNumber,
          confirmed: utxo.confirmed,
          localCreatedAt: utxo.localCreatedAt ? new Date(utxo.localCreatedAt).toISOString() : 'N/A'
        });
        
        // Check if this UTXO has blockchain confirmation
        if (!utxo.creationTxHash || !utxo.blockNumber) {
          console.warn('⚠️ UTXO has no blockchain confirmation - may be fake/local-only');
          continue;
        }
        
        console.log('✅ UTXO appears to have blockchain confirmation');
      }
      
      addNotification('success', `Verified ${localUTXOs.length} UTXOs. Check console for details.`);
      
    } catch (error: any) {
      console.error('❌ UTXO verification failed:', error);
      addNotification('error', `Verification failed: ${error.message || error}`);
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

  // Test contract debug function
  async function testContractDebug() {
    if (!currentAccount?.address || !isInitialized || !privateUTXOManager) {
      addNotification('error', 'Please connect wallet and initialize first');
      return;
    }

    try {
      console.log('🔍 === TESTING CONTRACT DEBUG ===');
      addNotification('info', 'Testing contract interaction...');
      
      // Create test parameters
      const testParams = {
        amount: 1000000000000000000n, // 1 token (18 decimals)
        tokenAddress: '0xCA4d19D712944874f8dd1472C6de5Dd8e5C9E5e2', // Test token with correct checksum
        owner: currentAccount.address
      };
      
      // Call debug function
      await privateUTXOManager.debugContractInteraction(testParams);
      
      addNotification('success', 'Contract debug test completed! Check console for details.');
      
    } catch (error: any) {
      console.error('❌ Contract debug test failed:', error);
      
      // Check if it's a network/RPC issue
      if (error.message?.includes('missing trie node') || error.message?.includes('JSON-RPC error') || error.message?.includes('Network node synchronization')) {
        addNotification('error', `Network/RPC issue detected. ${error.message}. Try the RPC Test button below.`);
      } else {
        addNotification('error', `Contract debug failed: ${error.message || error}`);
      }
    }
  }

  // Test different RPC endpoints
  async function testRPCEndpoints() {
    if (!currentAccount?.address) {
      addNotification('error', 'Please connect wallet first');
      return;
    }

    try {
      console.log('🔍 === TESTING RPC ENDPOINTS ===');
      addNotification('info', 'Testing RPC endpoints...');
      
      // Get RPC endpoints based on selected network
      let rpcEndpoints: string[] = [];
      
      if (selectedNetwork === 'amoy') {
        rpcEndpoints = [
          'https://rpc-amoy.polygon.technology/',
          'https://polygon-amoy.blockpi.network/v1/rpc/public',
          'https://polygon-amoy-bor-rpc.publicnode.com',
          'https://rpc.ankr.com/polygon_amoy'
        ];
      } else if (selectedNetwork === 'alastria') {
        rpcEndpoints = [
          'http://108.142.237.13:8545'
        ];
      }
      
      for (const rpc of rpcEndpoints) {
        try {
          console.log(`🌐 Testing RPC: ${rpc}`);
          
          // Create a temporary provider for testing
          const testProvider = new ethers.JsonRpcProvider(rpc);
          const blockNumber = await testProvider.getBlockNumber();
          const network = await testProvider.getNetwork();
          
          console.log(`✅ RPC ${rpc} - Block: ${blockNumber}, ChainID: ${network.chainId}`);
          
          // If we get here, this RPC is working
          addNotification('success', `✅ Working RPC found: ${rpc} (Block: ${blockNumber})`);
          
        } catch (rpcError: any) {
          console.warn(`❌ RPC ${rpc} failed:`, rpcError.message);
        }
      }
      
      console.log('🔍 RPC endpoint testing completed');
      addNotification('info', 'RPC testing completed. Check console for details.');
      
    } catch (error: any) {
      console.error('❌ RPC testing failed:', error);
      addNotification('error', `RPC testing failed: ${error.message || error}`);
    }
  }

  // Show network and contract information
  function showNetworkInfo() {
    try {
      console.log('🔍 === NETWORK INFORMATION ===');
      
      const network = NETWORKS[selectedNetwork];
      console.log(`\n🌐 Current Network: ${network.name}`);
      console.log(`- Chain ID: ${network.chainId}`);
      console.log(`- RPC URL: ${network.rpcUrl}`);
      console.log(`- Block Explorer: ${network.blockExplorer}`);
      console.log(`- Native Currency: ${network.nativeCurrency.symbol}`);
      console.log(`- Contract Address: ${network.contractAddress || 'NOT DEPLOYED'}`);
      
      console.log(`\n📋 All Networks:`);
      Object.entries(NETWORKS).forEach(([key, net]) => {
        console.log(`${key}: ${net.name} (ChainID: ${net.chainId}) - Contract: ${net.contractAddress || 'NOT DEPLOYED'}`);
      });
      
      const contractStatus = CONTRACT_ADDRESS ? 'deployed' : 'not deployed';
      addNotification('info', `${network.name} (ChainID: ${network.chainId}) - Contract: ${contractStatus}. Check console for details.`);
      
    } catch (error: any) {
      console.error('❌ Failed to show network info:', error);
      addNotification('error', `Failed to show network info: ${error.message || error}`);
    }
  }

  // Variable para generar IDs únicos
  let notificationCounter = 0;

  function addNotification(type: string, message: string) {
    // Crear ID único combinando timestamp con contador incremental
    const uniqueId = `${Date.now()}_${notificationCounter++}`;
    
    const notification = {
      id: uniqueId,
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

  // Handle events from components
  function handleDepositCreated(event: CustomEvent) {
    console.log('Deposit created:', event.detail);
    refreshData();
    setActiveTab('balance');
  }
  
  function handleOperationCompleted(event: CustomEvent) {
    console.log('Operation completed:', event.detail);
    refreshData();
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
  <meta name="description" content="Manage ERC20 tokens with privacy using UTXOs and modern cryptography" />
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
          {#if currentStep === 4 && isInitialized}
            <div class="flex items-center space-x-4">
              <!-- Private Mode Indicator (Always On) -->
              <div class="flex items-center space-x-2 px-3 py-2 rounded-lg bg-purple-600 text-white">
                <span>🔐</span>
                <span class="text-sm">Private Mode</span>
              </div>
              
              <!-- Network Selector -->
              <div class="relative">
                <select 
                  bind:value={selectedNetwork}
                  on:change={(e) => handleNetworkChange((e.target as HTMLSelectElement).value as NetworkKey)}
                  class="appearance-none bg-gray-800/50 text-white border border-gray-600 rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={currentStep < 4}
                >
                  <option value="amoy">🔵 Polygon Amoy</option>
                  <option value="alastria">⚡ Alastria</option>
                </select>
                <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-300">
                  <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                  </svg>
                </div>
                {#if currentStep < 4}
                  <div class="absolute inset-0 bg-gray-800/50 rounded-lg flex items-center justify-center">
                    <span class="text-xs text-gray-400">Complete setup first</span>
                  </div>
                {/if}
              </div>
              
              <!-- Network Status Indicator -->
              <div class="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-800/30 text-gray-300">
                <div class="w-2 h-2 rounded-full {CONTRACT_ADDRESS ? 'bg-green-400' : 'bg-yellow-400'}"></div>
                <span class="text-sm">
                  {CONTRACT_ADDRESS ? NETWORKS[selectedNetwork].name : `${NETWORKS[selectedNetwork].name} (No Contract)`}
                </span>
              </div>
              
              <!-- Debug Tools - Commented for production, uncomment for development -->
              <!--
              {#if currentAccount}
                <button
                  on:click={clearAllLocalData}
                  class="flex items-center space-x-2 px-3 py-2 rounded-lg bg-red-600/20 text-red-300 hover:bg-red-600/30 transition-all duration-200"
                  title="⚠️ Clear all local UTXO data"
                >
                  <span>🗑️</span>
                  <span class="text-sm">Clear Data</span>
                </button>
                
                <button
                  on:click={verifyUTXOAuthenticity}
                  class="flex items-center space-x-2 px-3 py-2 rounded-lg bg-orange-600/20 text-orange-300 hover:bg-orange-600/30 transition-all duration-200"
                  title="Verify UTXO authenticity on blockchain"
                >
                  <span>🔍</span>
                  <span class="text-sm">Verify UTXOs</span>
                </button>
                
                <button
                  on:click={loadAllUserUTXOs}
                  class="flex items-center space-x-2 px-3 py-2 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 transition-all duration-200"
                  title="Load all UTXOs (owned + received)"
                >
                  <span>📁</span>
                  <span class="text-sm">Load All UTXOs</span>
                </button>
                
                <button
                  on:click={debugMultiAccountStorage}
                  class="flex items-center space-x-2 px-3 py-2 rounded-lg bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 transition-all duration-200"
                  title="Debug multi-account storage system"
                >
                  <span>🐛</span>
                  <span class="text-sm">Debug Storage</span>
                </button>
                
                <button
                  on:click={testContractDebug}
                  class="flex items-center space-x-2 px-3 py-2 rounded-lg bg-yellow-600/20 text-yellow-300 hover:bg-yellow-600/30 transition-all duration-200"
                  title="Test contract interaction"
                >
                  <span>⚗️</span>
                  <span class="text-sm">Test Contract</span>
                </button>
                
                <button
                  on:click={testRPCEndpoints}
                  class="flex items-center space-x-2 px-3 py-2 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 transition-all duration-200"
                  title="Test RPC endpoints for network issues"
                >
                  <span>🌐</span>
                  <span class="text-sm">RPC Test</span>
                </button>
                
                <button
                  on:click={showNetworkInfo}
                  class="flex items-center space-x-2 px-3 py-2 rounded-lg bg-teal-600/20 text-teal-300 hover:bg-teal-600/30 transition-all duration-200"
                  title="Show network and contract information"
                >
                  <span>ℹ️</span>
                  <span class="text-sm">Network Info</span>
                </button>
              {/if}
              -->
              
              <!-- Connection Status -->
              <div class="flex items-center space-x-2 text-green-400">
                <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span class="text-sm">Connected</span>
              </div>
            </div>
          {/if}
          
          <!-- Wallet Connection Component -->
          <WalletConnection
            utxoManager={privateUTXOManager}
            {currentAccount}
            {isInitialized}
          />
        </div>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="container mx-auto px-4 py-8">
    {#if currentStep < 4}
      <!-- Controlled Flow Panel -->
      <div class="text-center py-12">
        <div class="max-w-4xl mx-auto">
          <h2 class="text-4xl font-bold text-white mb-6">
            Setup Your UTXO Wallet
          </h2>
          <p class="text-xl text-gray-300 mb-12">
            Follow these 3 simple steps to start using privacy-preserving UTXOs
          </p>
          
          <!-- Progress Steps -->
          <div class="flex justify-center items-center mb-12 space-x-4">
            <!-- Step 1: Connect Wallet -->
            <div class="flex flex-col items-center space-y-2">
              <div class="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg
                {currentStep >= 1 ? (isWalletConnected ? 'bg-green-500' : 'bg-blue-500') : 'bg-gray-600'}">
                {isWalletConnected ? '✅' : '1'}
              </div>
              <span class="text-sm {currentStep >= 1 ? 'text-white' : 'text-gray-400'}">Connect Wallet</span>
            </div>
            
            <!-- Arrow -->
            <div class="w-8 h-0.5 {currentStep >= 2 ? 'bg-blue-400' : 'bg-gray-600'}"></div>
            
            <!-- Step 2: Select Network -->
            <div class="flex flex-col items-center space-y-2">
              <div class="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg
                {currentStep >= 2 ? (isNetworkSelected ? 'bg-green-500' : 'bg-blue-500') : 'bg-gray-600'}">
                {isNetworkSelected ? '✅' : '2'}
              </div>
              <span class="text-sm {currentStep >= 2 ? 'text-white' : 'text-gray-400'}">Select Network</span>
            </div>
            
            <!-- Arrow -->
            <div class="w-8 h-0.5 {currentStep >= 3 ? 'bg-blue-400' : 'bg-gray-600'}"></div>
            
            <!-- Step 3: Initialize Library -->
            <div class="flex flex-col items-center space-y-2">
              <div class="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg
                {currentStep >= 3 ? (isLibraryInitialized ? 'bg-green-500' : 'bg-blue-500') : 'bg-gray-600'}">
                {isLibraryInitialized ? '✅' : '3'}
              </div>
              <span class="text-sm {currentStep >= 3 ? 'text-white' : 'text-gray-400'}">Initialize Library</span>
            </div>
          </div>
          
          <!-- Step Content -->
          <div class="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20 max-w-2xl mx-auto">
            {#if currentStep === 1}
              <!-- Step 1: Connect Wallet -->
              <div class="text-center">
                <div class="text-6xl mb-6">🔌</div>
                <h3 class="text-2xl font-bold text-white mb-4">Step 1: Connect Your Wallet</h3>
                <p class="text-gray-300 mb-8">Connect MetaMask or another compatible wallet to get started</p>
                
                <button
                  on:click={step1_connectWallet}
                  class="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                  disabled={isWalletConnected}
                >
                  {isWalletConnected ? '✅ Wallet Connected' : '🔌 Connect Wallet'}
                </button>
                
                {#if currentAccount}
                  <div class="mt-6 p-4 bg-green-600/20 rounded-lg border border-green-500/30">
                    <p class="text-green-300 text-sm">
                      <span class="font-semibold">Connected:</span> {currentAccount.address.slice(0, 6)}...{currentAccount.address.slice(-4)}
                    </p>
                  </div>
                {/if}
              </div>
              
            {:else if currentStep === 2}
              <!-- Step 2: Select Network -->
              <div class="text-center">
                <div class="text-6xl mb-6">🌐</div>
                <h3 class="text-2xl font-bold text-white mb-4">Step 2: Select Network</h3>
                <p class="text-gray-300 mb-8">Choose the blockchain network you want to use</p>
                
                <!-- Network Selection -->
                <div class="space-y-4 mb-8">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      on:click={() => selectedNetwork = 'amoy'}
                      class="p-6 rounded-lg border-2 transition-all duration-200 {selectedNetwork === 'amoy' ? 'border-blue-500 bg-blue-500/20' : 'border-gray-600 bg-gray-800/30 hover:border-gray-500'}"
                    >
                      <div class="text-3xl mb-3">🔵</div>
                      <h4 class="text-white font-semibold">Polygon Amoy</h4>
                      <p class="text-gray-400 text-sm mt-2">Testnet • ChainID: 80002</p>
                      <div class="mt-3 flex items-center justify-center space-x-2">
                        <div class="w-2 h-2 rounded-full {NETWORKS.amoy.contractAddress ? 'bg-green-400' : 'bg-yellow-400'}"></div>
                        <span class="text-xs {NETWORKS.amoy.contractAddress ? 'text-green-400' : 'text-yellow-400'}">
                          {NETWORKS.amoy.contractAddress ? 'Contract Available' : 'No Contract'}
                        </span>
                      </div>
                    </button>
                    
                    <button
                      on:click={() => selectedNetwork = 'alastria'}
                      class="p-6 rounded-lg border-2 transition-all duration-200 {selectedNetwork === 'alastria' ? 'border-purple-500 bg-purple-500/20' : 'border-gray-600 bg-gray-800/30 hover:border-gray-500'}"
                    >
                      <div class="text-3xl mb-3">⚡</div>
                      <h4 class="text-white font-semibold">Alastria</h4>
                      <p class="text-gray-400 text-sm mt-2">Private • ChainID: 2020</p>
                      <div class="mt-3 flex items-center justify-center space-x-2">
                        <div class="w-2 h-2 rounded-full {NETWORKS.alastria.contractAddress ? 'bg-green-400' : 'bg-yellow-400'}"></div>
                        <span class="text-xs {NETWORKS.alastria.contractAddress ? 'text-green-400' : 'text-yellow-400'}">
                          {NETWORKS.alastria.contractAddress ? 'Contract Available' : 'No Contract'}
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
                
                <button
                  on:click={step2_selectNetwork}
                  class="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                  disabled={isNetworkSelected || !NETWORKS[selectedNetwork].contractAddress}
                >
                  {isNetworkSelected ? '✅ Network Selected' : `🌐 Use ${NETWORKS[selectedNetwork].name}`}
                </button>
                
                {#if !NETWORKS[selectedNetwork].contractAddress}
                  <div class="mt-6 p-4 bg-yellow-600/20 rounded-lg border border-yellow-500/30">
                    <p class="text-yellow-300 text-sm">
                      ⚠️ No contract deployed on {NETWORKS[selectedNetwork].name}. Please deploy a contract first.
                    </p>
                  </div>
                {/if}
              </div>
              
            {:else if currentStep === 3}
              <!-- Step 3: Initialize Library -->
              <div class="text-center">
                <div class="text-6xl mb-6">🚀</div>
                <h3 class="text-2xl font-bold text-white mb-4">Step 3: Initialize UTXO Library</h3>
                <p class="text-gray-300 mb-8">Initialize the cryptographic library with your selected network</p>
                
                <div class="bg-gray-800/50 rounded-lg p-6 mb-8">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                    <div>
                      <span class="text-gray-400 text-sm">Network:</span>
                      <p class="text-white font-semibold">{NETWORKS[selectedNetwork].name}</p>
                    </div>
                    <div>
                      <span class="text-gray-400 text-sm">Contract:</span>
                      <p class="text-white font-mono text-sm">{CONTRACT_ADDRESS.slice(0, 10)}...{CONTRACT_ADDRESS.slice(-8)}</p>
                    </div>
                    <div>
                      <span class="text-gray-400 text-sm">Wallet:</span>
                      <p class="text-white font-mono text-sm">{currentAccount?.address.slice(0, 10)}...{currentAccount?.address.slice(-8)}</p>
                    </div>
                    <div>
                      <span class="text-gray-400 text-sm">Privacy Mode:</span>
                      <p class="text-green-400 font-semibold">🔐 Enabled</p>
                    </div>
                  </div>
                </div>
                
                <button
                  on:click={step3_initializeLibrary}
                  class="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                  disabled={isLibraryInitialized}
                >
                  {isLibraryInitialized ? '✅ Library Initialized' : '🚀 Initialize Library'}
                </button>
                
                <!-- Test Crypto Migration Button -->
                {#if isLibraryInitialized}
                  <div class="mt-4">
                    <button
                      on:click={runMigrationTest}
                      class="bg-gradient-to-r from-green-600 to-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-green-700 hover:to-teal-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      🧪 Test Migration
                    </button>
                    <p class="text-gray-400 text-sm mt-2">Test the new ethers.js + elliptic crypto system</p>
                  </div>
                {/if}
              </div>
            {/if}
            
            <!-- Reset Flow Button -->
            <div class="mt-8 pt-6 border-t border-white/10">
              <button
                on:click={resetFlow}
                class="text-gray-400 hover:text-white text-sm transition-colors duration-200"
              >
                🔄 Reset Flow
              </button>
            </div>
          </div>
        </div>
      </div>
      
    {:else if !isInitialized}
      <!-- Welcome Screen -->
      <div class="text-center py-20">
        <div class="max-w-2xl mx-auto">
          <h2 class="text-4xl font-bold text-white mb-6">
            Welcome to UTXO Manager
          </h2>
          <p class="text-xl text-gray-300 mb-8">
            Transform your ERC20 tokens into privacy-preserving UTXOs using modern cryptography
          </p>
          
          <div class="grid md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div class="text-purple-400 text-2xl mb-3">🔒</div>
              <h3 class="text-white font-semibold mb-2">Privacy First</h3>
              <p class="text-gray-300 text-sm">Your transactions are private using zero-knowledge proofs</p>
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
    {:else if currentStep === 4 && isInitialized}
      <!-- Dashboard -->
      <div class="space-y-8">
        <!-- Stats Overview -->
        {#if stats}
          <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div class="text-pink-400 text-sm font-medium mb-1">Private UTXOs</div>
              <div class="text-white text-2xl font-bold">{privateUTXOs.length}</div>
            </div>
            
            <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div class="text-blue-400 text-sm font-medium mb-1">Unique Tokens</div>
              <div class="text-white text-2xl font-bold">{stats.uniqueTokens}</div>
            </div>
            
            <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div class="text-green-400 text-sm font-medium mb-1">BN254 UTXOs</div>
              <div class="text-white text-2xl font-bold">{stats.bn254UTXOs || 0}</div>
            </div>
            
            <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div class="text-yellow-400 text-sm font-medium mb-1">BN254 Operations</div>
              <div class="text-white text-2xl font-bold">{stats.bn254Operations || 0}</div>
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
            {#if privateUTXOs.length === 0}
              <div class="bg-white/10 backdrop-blur-sm rounded-lg p-8 border border-white/20 text-center">
                <div class="text-gray-400 mb-4">
                  <span class="text-4xl">📦</span>
                </div>
                <h3 class="text-white text-lg font-semibold mb-2">No UTXOs Found</h3>
                <p class="text-gray-400 mb-4">Start by depositing tokens to create your first private UTXO.</p>
                <button 
                  on:click={() => setActiveTab('deposit')}
                  class="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-all duration-200"
                >
                  Create Deposit
                </button>
              </div>
            {:else}
              <UTXOBalance 
                {privateUTXOs}
                on:refresh={refreshData} 
              />
            {/if}
          {:else if activeTab === 'deposit'}
            <!-- Deposit Form Component -->
            <DepositForm 
              utxoManager={privateUTXOManager}
              on:deposit={handleDepositCreated}
            />
          {:else if activeTab === 'operations'}
            <OperationsPanel 
              utxoManager={privateUTXOManager} 
              {privateUTXOs}
              on:operation={handleOperationCompleted} 
            />
          {:else if activeTab === 'history'}
            <TransactionHistory 
              {privateUTXOs}
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