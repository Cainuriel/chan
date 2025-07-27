<!--
  @fileoverview Transfer Panel Simple - Frontend para transferir UTXOs
  @description Panel simplificado para transferencias UTXO con validaciones
-->

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { zkPrivateUTXOManager } from '../ManagerUTXO';
  import type { PrivateUTXO, UTXOOperationResult } from '../../types/utxo.types';
  
  const dispatch = createEventDispatcher();

  // Props
  export let availableUTXOs: PrivateUTXO[] = [];
  export let tokenMetadataCache: Record<string, any> = {};

  // Helper function to get token metadata (same as OperationsPanel)
  function getTokenMetadata(tokenAddress: string) {
    const metadata = tokenMetadataCache[tokenAddress];

    if (!metadata) {
      console.warn(`⚠️ Token metadata not found for ${tokenAddress}, using defaults`);
      return {
        address: tokenAddress,
        name: `Token ${tokenAddress.slice(0, 6)}...`,
        symbol: 'UNK',
        decimals: 18,
        balance: 0n,
        allowance: 0n,
        verified: false
      };
    }
    
    return {
      address: metadata.address,
      name: metadata.name,
      symbol: metadata.symbol,
      decimals: metadata.decimals,
      balance: metadata.balance ?? 0n,
      allowance: metadata.allowance ?? 0n,
      verified: metadata.verified ?? false
    };
  }

  // Helper function to format values with decimals (same as OperationsPanel)
  function formatValue(value: bigint | string | number, decimals: number = 18): string {
    try {
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

  // Component state
  let selectedUTXOId = '';
  let recipientAddress = '';
  let isExecuting = false;
  let error = '';
  let success = '';

  // Reactive computed values
  $: selectedUTXO = availableUTXOs.find(utxo => utxo.id === selectedUTXOId);
  $: isValidAddress = recipientAddress && recipientAddress.length === 42 && recipientAddress.startsWith('0x');
  $: canExecute = selectedUTXOId && isValidAddress && !isExecuting;

  function clearForm() {
    selectedUTXOId = '';
    recipientAddress = '';
    error = '';
    success = '';
  }

  async function executeTransfer() {
    if (!canExecute || !selectedUTXO) return;

    isExecuting = true;
    error = '';
    success = '';

    try {
      console.log('🚀 Starting FULL UTXO transfer from TransferPanelSimple...');
      
      // ✅ Transfer the COMPLETE UTXO (always full amount)
      const result: UTXOOperationResult = await zkPrivateUTXOManager.transferPrivateUTXOSimple(
        selectedUTXOId,
        recipientAddress,
        selectedUTXO.value // ← ALWAYS the complete UTXO value
      );

      if (result.success) {
        const tokenData = getTokenMetadata(selectedUTXO.tokenAddress);
        success = `Complete UTXO transferred successfully! ${formatValue(selectedUTXO.value, tokenData.decimals)} ${tokenData.symbol} → TX: ${result.transactionHash?.slice(0, 16)}...`;
        
        // Emit event to parent component
        dispatch('transferCompleted', {
          sourceUTXOId: selectedUTXOId,
          recipientAddress,
          amount: selectedUTXO.value.toString(), // Full amount
          transactionHash: result.transactionHash
        });

        // Clear form after successful transfer
        setTimeout(() => {
          clearForm();
        }, 2000);
      } else {
        error = result.error || 'Transfer failed for unknown reason';
      }

    } catch (err: any) {
      console.error('❌ Full UTXO transfer failed in TransferPanelSimple:', err);
      error = err.message || 'Transfer operation failed';
    } finally {
      isExecuting = false;
    }
  }
</script>

<div class="transfer-panel bg-gray-900 border border-gray-700 rounded-lg p-6">
  <h3 class="text-lg font-semibold text-white mb-6">🔄 Transfer Private UTXO</h3>
  
  {#if error}
    <div class="error bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg mb-4">❌ {error}</div>
  {/if}
  
  {#if success}
    <div class="success bg-green-500/10 border border-green-500/30 text-green-400 p-3 rounded-lg mb-4">✅ {success}</div>
  {/if}

  <div class="form-group">
    <label for="utxo-select" class="block text-sm font-medium text-white mb-2">Select UTXO to Transfer:</label>
    <select 
      id="utxo-select" 
      bind:value={selectedUTXOId} 
      disabled={isExecuting}
      class="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none"
    >
      <option value="">Choose a UTXO...</option>
      {#each availableUTXOs as utxo}
        {@const tokenData = getTokenMetadata(utxo.tokenAddress)}
        <option value={utxo.id}>
          {formatValue(utxo.value, tokenData.decimals)} {tokenData.symbol}
          (ID: {utxo.id.slice(0, 8)}...)
        </option>
      {/each}
    </select>
  </div>

  {#if selectedUTXO}
    {@const tokenData = getTokenMetadata(selectedUTXO.tokenAddress)}
    <div class="utxo-info bg-blue-600/20 border border-blue-600/30 rounded-lg p-4 mb-6">
      <h4 class="text-sm font-medium text-blue-200 mb-3">Selected UTXO Info:</h4>
      <div class="space-y-2 text-sm">
        <p class="text-blue-300"><strong class="text-blue-200">ID:</strong> <span class="font-mono">{selectedUTXO.id.slice(0, 20)}...</span></p>
        <p class="text-blue-300"><strong class="text-blue-200">Value:</strong> <span class="font-mono">{formatValue(selectedUTXO.value, tokenData.decimals)} {tokenData.symbol}</span></p>
        <p class="text-blue-300"><strong class="text-blue-200">Token:</strong> <span class="font-mono">{tokenData.name} ({selectedUTXO.tokenAddress.slice(0, 8)}...)</span></p>
        <p class="text-blue-300"><strong class="text-blue-200">Owner:</strong> <span class="font-mono">{selectedUTXO.owner.slice(0, 8)}...</span></p>
      </div>
    </div>

    <!-- ✅ NEW: Transfer Details Panel -->
    <div class="transfer-info bg-purple-600/20 border border-purple-600/30 rounded-lg p-4 mb-6">
      <h4 class="text-sm font-medium text-purple-200 mb-3">🔄 Transfer Details:</h4>
      <div class="space-y-2 text-sm">
        <p class="text-purple-300">
          <strong class="text-purple-200">Full Transfer:</strong> 
          <span class="font-mono text-white">{formatValue(selectedUTXO.value, tokenData.decimals)} {tokenData.symbol}</span>
        </p>
        <p class="text-purple-300">
          <strong class="text-purple-200">Operation:</strong> 
          <span class="text-white">Complete UTXO ownership transfer</span>
        </p>
        <div class="bg-purple-900/30 rounded p-2 mt-3">
          <p class="text-purple-200 text-xs flex items-center">
            <span class="mr-2">ℹ️</span>
            <span>This will transfer the <strong>entire UTXO</strong> to the recipient. The original UTXO will be marked as spent, and a new UTXO with the same value will be created for the recipient.</span>
          </p>
        </div>
      </div>
    </div>
  {/if}

  <div class="form-group">
    <label for="recipient" class="block text-sm font-medium text-white mb-2">Recipient Address:</label>
    <input 
      id="recipient"
      type="text" 
      bind:value={recipientAddress}
      placeholder="0x..."
      disabled={isExecuting}
      class="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
      class:border-red-500={recipientAddress && !isValidAddress}
    />
    {#if recipientAddress && !isValidAddress}
      <small class="text-red-400 text-xs mt-1 block">Invalid Ethereum address format</small>
    {/if}
  </div>

  <div class="actions flex gap-3 mt-6">
    <button 
      on:click={executeTransfer}
      disabled={!canExecute}
      class="flex-1 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
      class:loading={isExecuting}
    >
      {#if isExecuting}
        <div class="flex items-center justify-center">
          <div class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
          Transferring Complete UTXO...
        </div>
      {:else}
        � Transfer Complete UTXO
      {/if}
    </button>

    <button 
      on:click={clearForm}
      disabled={isExecuting}
      class="bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
    >
      🗑️ Clear
    </button>
  </div>

  {#if availableUTXOs.length === 0}
    <div class="no-utxos bg-yellow-600/20 border border-yellow-600/30 rounded-lg p-4 text-center">
      <div class="text-yellow-400 text-sm">
        ⚠️ No UTXOs available for transfer. Create or recover UTXOs first.
      </div>
    </div>
  {/if}
</div>

<style>
  /* Empty - All styles now use Tailwind classes like the split panel */
</style>
