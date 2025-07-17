<script lang="ts">
  import { onMount } from 'svelte';
  import { ZenroomHelpers } from '../utils/zenroom.helpers.js';

  export let showDetails: boolean = false;
  
  let cryptoMode: 'full' | 'limited' | 'unavailable' | 'loading' | 'retrying' = 'loading';
  let isInitialized: boolean = false;
  let error: string = '';
  let retryCount: number = 0;
  let maxRetries: number = 3;
  
  // Reactive states
  $: statusIcon = getStatusIcon(cryptoMode);
  $: statusColor = getStatusColor(cryptoMode);
  $: statusMessage = getStatusMessage(cryptoMode, isInitialized);

  onMount(async () => {
    await checkCryptoStatus();
  });

  async function checkCryptoStatus() {
    try {
      cryptoMode = retryCount > 0 ? 'retrying' : 'loading';
      
      // Esperar un poco más en reintentos
      if (retryCount > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
      
      console.log(`🔄 Crypto status check attempt ${retryCount + 1}/${maxRetries + 1}`);
      
      // Intentar inicializar Zenroom con timeout
      const initPromise = ZenroomHelpers.initialize();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Initialization timeout')), 10000)
      );
      
      const success = await Promise.race([initPromise, timeoutPromise]) as boolean;
      
      if (success) {
        // Verificar el modo específico
        if (ZenroomHelpers.isFullCryptoAvailable) {
          cryptoMode = 'full';
          isInitialized = true;
          error = '';
          retryCount = 0;
        } else if (ZenroomHelpers.cryptoMode === 'limited') {
          cryptoMode = 'limited';
          isInitialized = true;
          error = 'Some advanced features unavailable';
          retryCount = 0;
        } else {
          throw new Error('Initialization succeeded but crypto mode is unavailable');
        }
      } else {
        throw new Error('Zenroom initialization returned false');
      }
      
    } catch (err) {
      console.error(`❌ Crypto status check failed (attempt ${retryCount + 1}):`, err);
      
      const errorMessage = err instanceof Error ? err.message : 'Unknown initialization error';
      
      if (retryCount < maxRetries) {
        cryptoMode = 'retrying';
        error = `${errorMessage} (retrying ${retryCount + 1}/${maxRetries})`;
        retryCount++;
        
        // Auto-retry después de un delay
        setTimeout(() => checkCryptoStatus(), 2000);
      } else {
        cryptoMode = 'unavailable';
        isInitialized = false;
        error = `${errorMessage} (failed after ${maxRetries + 1} attempts)`;
      }
    }
  }

  function getStatusIcon(mode: string): string {
    switch (mode) {
      case 'full': return '🔐';
      case 'limited': return '⚠️';
      case 'unavailable': return '❌';
      case 'loading': return '⏳';
      case 'retrying': return '🔄';
      default: return '❓';
    }
  }

  function getStatusColor(mode: string): string {
    switch (mode) {
      case 'full': return 'text-green-600';
      case 'limited': return 'text-yellow-600';
      case 'unavailable': return 'text-red-600';
      case 'loading': return 'text-blue-600';
      case 'retrying': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  }

  function getStatusMessage(mode: string, initialized: boolean): string {
    switch (mode) {
      case 'full': return 'Full BN254 Cryptography Available';
      case 'limited': return 'Limited Cryptography Mode';
      case 'unavailable': return 'Cryptography Unavailable';
      case 'loading': return 'Initializing Cryptography...';
      case 'retrying': return 'Retrying Initialization...';
      default: return 'Unknown Status';
    }
  }

  async function manualRetry() {
    console.log('🔄 Manual retry initiated');
    retryCount = 0; // Reset counter for manual retry
    await checkCryptoStatus();
  }
</script>

<div class="crypto-status-indicator bg-white border rounded-lg p-4 shadow-sm">
  <div class="flex items-center justify-between">
    <div class="flex items-center space-x-2">
      <span class="text-xl">{statusIcon}</span>
      <div class="flex flex-col">
        <span class="font-medium {statusColor}">{statusMessage}</span>
        {#if cryptoMode === 'retrying'}
          <span class="text-sm text-gray-500">Attempt {retryCount}/{maxRetries}</span>
        {:else if error && cryptoMode === 'unavailable'}
          <span class="text-sm text-gray-500">{error}</span>
        {/if}
      </div>
    </div>
    
    {#if cryptoMode === 'unavailable'}
      <button 
        on:click={manualRetry}
        class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
      >
        Retry
      </button>
    {/if}
  </div>

  {#if showDetails || cryptoMode !== 'full'}
    <div class="mt-3 pt-3 border-t text-sm text-gray-600">
      {#if cryptoMode === 'full'}
        <div class="space-y-1">
          <div class="flex justify-between">
            <span>Zenroom Status:</span>
            <span class="text-green-600">✅ Active</span>
          </div>
          <div class="flex justify-between">
            <span>BN254 Curve:</span>
            <span class="text-green-600">✅ Available</span>
          </div>
          <div class="flex justify-between">
            <span>Pedersen Commitments:</span>
            <span class="text-green-600">✅ Ready</span>
          </div>
          <div class="flex justify-between">
            <span>Attestations:</span>
            <span class="text-green-600">✅ Ready</span>
          </div>
        </div>
      {:else if cryptoMode === 'limited'}
        <div class="bg-yellow-50 border border-yellow-200 rounded p-3">
          <p class="text-yellow-800 font-medium">⚠️ Limited Functionality</p>
          <p class="text-yellow-700 mt-1">
            Some advanced cryptographic features are unavailable. Basic operations may still work.
          </p>
          {#if error}
            <p class="text-xs text-yellow-600 mt-2">Error: {error}</p>
          {/if}
        </div>
      {:else if cryptoMode === 'unavailable'}
        <div class="bg-red-50 border border-red-200 rounded p-3">
          <p class="text-red-800 font-medium">❌ Cryptography Unavailable</p>
          <p class="text-red-700 mt-1">
            Zenroom failed to initialize. Only basic wallet operations are available.
          </p>
          {#if error}
            <p class="text-xs text-red-600 mt-2">Error: {error}</p>
          {/if}
        </div>
      {:else if cryptoMode === 'loading' || cryptoMode === 'retrying'}
        <div class="bg-blue-50 border border-blue-200 rounded p-3">
          <p class="text-blue-800 font-medium">
            {cryptoMode === 'retrying' ? '🔄 Retrying...' : '⏳ Initializing...'}
          </p>
          <p class="text-blue-700 mt-1">
            {cryptoMode === 'retrying' 
              ? `Retry attempt ${retryCount}/${maxRetries}` 
              : 'Testing cryptographic functionality...'}
          </p>
          {#if cryptoMode === 'retrying' && error}
            <p class="text-xs text-blue-600 mt-2">Last error: {error}</p>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .crypto-status-indicator {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
</style>
