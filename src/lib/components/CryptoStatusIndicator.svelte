<script lang="ts">
  import { onMount } from 'svelte';
  import ManagerUTXO from '../ManagerUTXO';
  import type { CryptographyStatus } from '../../utils/crypto.types';
  import { ZKCryptoService } from '../../utils/crypto.helpers';
  
  // Estado del sistema criptográfico
  let cryptoStatus: CryptographyStatus = {
    cryptographyType: 'Other',
    isInitialized: false,
    hasErrors: false,
    errors: [],
    secp256k1Available: false,
    zkProofGeneration: false,
    lastCheck: new Date()
  };
  
  let isChecking = false;
  let manager = ManagerUTXO;
  
  onMount(() => {
    checkCryptoStatus();
    
    // Verificar estado cada 30 segundos
    const interval = setInterval(checkCryptoStatus, 30000);
    return () => clearInterval(interval);
  });
  
  async function checkCryptoStatus() {
    if (isChecking) return;
    isChecking = true;
    
    try {
      // Verificar inicialización de ZK
      const zkInitialized = await ZKCryptoService.isInitialized();
      
      // Verificar capacidades secp256k1
      const secp256k1Available = await ZKCryptoService.checkSecp256k1Support();
      
      // Verificar generación de pruebas ZK
      const zkProofGeneration = await ZKCryptoService.canGenerateProofs();
      
      // Obtener estadísticas del manager
      const stats = await manager.getStats();
      
      cryptoStatus = {
        cryptographyType: 'secp256k1',
        isInitialized: zkInitialized,
        hasErrors: !zkInitialized || !secp256k1Available,
        errors: [],
        secp256k1Available,
        zkProofGeneration,
        lastCheck: new Date(),
        // Estadísticas adicionales
        operationCount: stats.cryptoOperations,
        totalUTXOs: stats.totalUTXOs,
        cryptographyDistribution: stats.cryptographyDistribution
      };
      
      // Agregar errores específicos si los hay
      if (!zkInitialized) {
        cryptoStatus.errors.push('ZK system not initialized');
      }
      if (!secp256k1Available) {
        cryptoStatus.errors.push('secp256k1 curve not available');
      }
      if (!zkProofGeneration) {
        cryptoStatus.errors.push('ZK proof generation disabled');
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown crypto error';
      cryptoStatus = {
        ...cryptoStatus,
        hasErrors: true,
        errors: [`Crypto check failed: ${errorMessage}`],
        lastCheck: new Date()
      };
    } finally {
      isChecking = false;
    }
  }
  
  function getStatusColor(): string {
    if (cryptoStatus.hasErrors) return 'text-red-500';
    if (cryptoStatus.isInitialized && cryptoStatus.secp256k1Available) return 'text-green-500';
    return 'text-yellow-500';
  }
  
  function getStatusIcon(): string {
    if (cryptoStatus.hasErrors) return '❌';
    if (cryptoStatus.isInitialized && cryptoStatus.secp256k1Available) return '✅';
    return '⚠️';
  }
  
  function getStatusText(): string {
    if (cryptoStatus.hasErrors) return 'Error';
    if (cryptoStatus.isInitialized && cryptoStatus.secp256k1Available) return 'Active';
    return 'Initializing';
  }
</script>

<div class="crypto-status-indicator p-4 border rounded-lg bg-gray-50">
  <div class="flex items-center justify-between mb-2">
    <h3 class="text-lg font-semibold text-gray-800">
      Cryptographic System Status
    </h3>
    <button 
      on:click={checkCryptoStatus}
      disabled={isChecking}
      class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
    >
      {isChecking ? 'Checking...' : 'Refresh'}
    </button>
  </div>
  
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <!-- Estado principal -->
    <div class="space-y-2">
      <div class="flex items-center space-x-2">
        <span class="text-xl">{getStatusIcon()}</span>
        <span class={`font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>
      
      <div class="text-sm text-gray-600">
        <div>Cryptography: <span class="font-mono">{cryptoStatus.cryptographyType}</span></div>
        <div>Last check: {cryptoStatus.lastCheck.toLocaleTimeString()}</div>
      </div>
    </div>
    
    <!-- Capacidades técnicas -->
    <div class="space-y-2">
      <div class="text-sm">
        <div class="flex justify-between">
          <span>ZK Initialized:</span>
          <span class={cryptoStatus.isInitialized ? 'text-green-600' : 'text-red-600'}>
            {cryptoStatus.isInitialized ? 'Yes' : 'No'}
          </span>
        </div>
        <div class="flex justify-between">
          <span>secp256k1 Support:</span>
          <span class={cryptoStatus.secp256k1Available ? 'text-green-600' : 'text-red-600'}>
            {cryptoStatus.secp256k1Available ? 'Available' : 'Unavailable'}
          </span>
        </div>
        <div class="flex justify-between">
          <span>ZK Proof Generation:</span>
          <span class={cryptoStatus.zkProofGeneration ? 'text-green-600' : 'text-red-600'}>
            {cryptoStatus.zkProofGeneration ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Estadísticas de operaciones -->
  {#if cryptoStatus.operationCount !== undefined}
    <div class="mt-4 pt-4 border-t border-gray-200">
      <h4 class="text-sm font-semibold text-gray-700 mb-2">Operation Statistics</h4>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <div>
          <div class="text-gray-600">secp256k1 Ops:</div>
          <div class="font-mono">{cryptoStatus.operationCount}</div>
        </div>
        <div>
          <div class="text-gray-600">Total UTXOs:</div>
          <div class="font-mono">{cryptoStatus.totalUTXOs || 0}</div>
        </div>
        {#if cryptoStatus.cryptographyDistribution}
          <div>
            <div class="text-gray-600">secp256k1 %:</div>
            <div class="font-mono">
              {Math.round((cryptoStatus.cryptographyDistribution.secp256k1 / (cryptoStatus.totalUTXOs || 1)) * 100)}%
            </div>
          </div>
          <div>
            <div class="text-gray-600">Other %:</div>
            <div class="font-mono">
              {Math.round((cryptoStatus.cryptographyDistribution.Other / (cryptoStatus.totalUTXOs || 1)) * 100)}%
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
  
  <!-- Errores -->
  {#if cryptoStatus.hasErrors && cryptoStatus.errors.length > 0}
    <div class="mt-4 pt-4 border-t border-red-200">
      <h4 class="text-sm font-semibold text-red-700 mb-2">Errors</h4>
      <ul class="text-sm text-red-600 space-y-1">
        {#each cryptoStatus.errors as error}
          <li>• {error}</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .crypto-status-indicator {
    transition: all 0.3s ease;
  }
  
  .crypto-status-indicator:hover {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
</style>