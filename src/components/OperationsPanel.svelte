<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PrivateUTXOManager, PrivateUTXO } from '../lib/PrivateUTXOManager';
  import type { ExtendedUTXOData } from '../types/utxo.types';
  import type { ERC20TokenData } from '../types/ethereum.types';
  import { EthereumHelpers } from '../utils/ethereum.helpers';

  // Props
  export let utxoManager: PrivateUTXOManager;
  export let utxos: ExtendedUTXOData[] = [];
  export let privateUTXOs: PrivateUTXO[] = [];
  export let privacyMode: boolean = true;

  // Event dispatcher
  const dispatch = createEventDispatcher();

  // Operation types
  type OperationType = 'split' | 'withdraw' | 'transfer';

  // State
  let activeOperation: OperationType = 'split';
  let isProcessing = false;

  // Token metadata cache
  let tokenMetadataCache: Record<string, ERC20TokenData> = {};

  // Load token metadata when UTXOs change
  $: if (utxos.length > 0) {
    loadTokenMetadata();
  }

  // Load token metadata
  async function loadTokenMetadata() {
    const uniqueTokens = [...new Set(utxos.map(u => u.tokenAddress))];
    for (const tokenAddress of uniqueTokens) {
      if (!tokenMetadataCache[tokenAddress]) {
        try {
          const tokenData = await EthereumHelpers.getERC20TokenInfo(tokenAddress);
          tokenMetadataCache[tokenAddress] = tokenData;
          // Trigger reactivity
          tokenMetadataCache = { ...tokenMetadataCache };
        } catch (error) {
          console.error('Failed to load token metadata for', tokenAddress, error);
          // Set default metadata
          tokenMetadataCache[tokenAddress] = {
            address: tokenAddress,
            name: 'Unknown Token',
            symbol: 'UNK',
            decimals: 18,
            balance: 0n,
            allowance: 0n,
            verified: false
          };
          tokenMetadataCache = { ...tokenMetadataCache };
        }
      }
    }
  }

  // Helper function to get token metadata
  function getTokenMetadata(tokenAddress: string): ERC20TokenData | undefined {
    return tokenMetadataCache[tokenAddress];
  }

  // Split operation state
  let splitSelectedUTXO = '';
  let splitOutputs: Array<{ amount: string; owner: string }> = [
    { amount: '', owner: '' },
    { amount: '', owner: '' }
  ];

  // Withdraw operation state
  let withdrawSelectedUTXO = '';
  let withdrawRecipient = '';

  // Transfer operation state
  let transferSelectedUTXO = '';
  let transferRecipient = '';

  // Computed values
  $: availableUTXOs = utxos.filter(utxo => !utxo.isSpent && utxo.confirmed);
  $: selectedUTXOData = {
    split: availableUTXOs.find(u => u.id === splitSelectedUTXO),
    withdraw: availableUTXOs.find(u => u.id === withdrawSelectedUTXO),
    transfer: availableUTXOs.find(u => u.id === transferSelectedUTXO)
  };

  // Initialize with current account as default owner
  $: if (utxoManager.currentAccount) {
    const address = utxoManager.currentAccount.address;
    splitOutputs = splitOutputs.map(output => ({
      ...output,
      owner: output.owner || address
    }));
    withdrawRecipient = withdrawRecipient || address;
  }

  function formatValue(value: bigint | string | number, decimals: number = 18): string {
    try {
      // Convert to BigInt if not already
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

  // Helper function to safely convert amount to BigInt
  function parseAmountToBigInt(amountStr: string, decimals: number): bigint {
    try {
      const amountFloat = parseFloat(amountStr);
      if (isNaN(amountFloat) || amountFloat <= 0) {
        return 0n;
      }
      
      const amountFixed = amountFloat.toFixed(decimals);
      const [integerPart, decimalPart = ''] = amountFixed.split('.');
      const paddedDecimal = decimalPart.padEnd(decimals, '0');
      const fullAmountStr = integerPart + paddedDecimal;
      return BigInt(fullAmountStr);
    } catch {
      return 0n;
    }
  }

  function addSplitOutput() {
    splitOutputs = [...splitOutputs, { 
      amount: '', 
      owner: utxoManager.currentAccount?.address || '' 
    }];
  }

  function removeSplitOutput(index: number) {
    if (splitOutputs.length > 2) {
      splitOutputs = splitOutputs.filter((_, i) => i !== index);
    }
  }

  function validateSplitAmounts(): { valid: boolean; error?: string } {
    const utxo = selectedUTXOData.split;
    if (!utxo) return { valid: false, error: 'No UTXO selected' };

    try {
      const tokenData = getTokenMetadata(utxo.tokenAddress);
      const decimals = tokenData?.decimals || 18;
      const totalInput = utxo.value;
      
      let totalOutput = BigInt(0);
      for (const output of splitOutputs) {
        if (!output.amount || !output.owner) {
          return { valid: false, error: 'All outputs must have amount and owner' };
        }
        
        const amountBigInt = parseAmountToBigInt(output.amount, decimals);
        
        if (amountBigInt <= 0) {
          return { valid: false, error: 'All amounts must be positive' };
        }
        
        totalOutput += amountBigInt;
      }
      
      if (totalOutput !== totalInput) {
        return { 
          valid: false, 
          error: `Sum of outputs (${formatValue(totalOutput, decimals)}) must equal input (${formatValue(totalInput, decimals)})` 
        };
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Invalid amounts' };
    }
  }

  async function executeSplit() {
    const validation = validateSplitAmounts();
    if (!validation.valid) {
      console.error('Split validation failed:', validation.error);
      return;
    }

    const utxo = selectedUTXOData.split!;
    isProcessing = true;

    try {
      const tokenData = getTokenMetadata(utxo.tokenAddress);
      const decimals = tokenData?.decimals || 18;
      const outputValues = splitOutputs.map(output => 
        parseAmountToBigInt(output.amount, decimals)
      );
      const outputOwners = splitOutputs.map(output => output.owner);

      // Execute split operation based on privacy mode
      const result = privacyMode 
        ? await utxoManager.splitPrivateUTXO({
            inputUTXOId: splitInputUTXO,
            outputValues: splitOutputs.map(o => parseAmountToBigInt(o.amount, tokenData?.decimals || 18)),
            outputOwners: splitOutputs.map(o => o.owner)
          })
        : await utxoManager.splitUTXO({
        inputUTXOId: splitSelectedUTXO,
        outputValues,
        outputOwners
      });

      if (result.success) {
        // Reset form
        splitSelectedUTXO = '';
        splitOutputs = [
          { amount: '', owner: utxoManager.currentAccount?.address || '' },
          { amount: '', owner: utxoManager.currentAccount?.address || '' }
        ];
        
        dispatch('operation', { type: 'split', result });
      } else {
        console.error('Split failed:', result.error);
      }
    } catch (error) {
      console.error('Split error:', error);
    } finally {
      isProcessing = false;
    }
  }

  async function executeWithdraw() {
    if (!withdrawSelectedUTXO || !withdrawRecipient) return;

    isProcessing = true;

    try {
      // Execute withdrawal based on privacy mode
      const result = privacyMode 
        ? await utxoManager.withdrawPrivateUTXO({
            utxoId: withdrawUTXOId,
            recipient: withdrawRecipient
          })
        : await utxoManager.withdrawFromUTXO({
        utxoId: withdrawSelectedUTXO,
        recipient: withdrawRecipient
      });

      if (result.success) {
        // Reset form
        withdrawSelectedUTXO = '';
        withdrawRecipient = utxoManager.currentAccount?.address || '';
        
        dispatch('operation', { type: 'withdraw', result });
      } else {
        console.error('Withdraw failed:', result.error);
      }
    } catch (error) {
      console.error('Withdraw error:', error);
    } finally {
      isProcessing = false;
    }
  }

  async function executeTransfer() {
    if (!transferSelectedUTXO || !transferRecipient) return;

    isProcessing = true;

    try {
      // Note: Transfer implementation would be similar to other operations
      // For now, we'll show a placeholder
      console.log('Transfer operation not yet implemented in the library');
      
      // Reset form
      transferSelectedUTXO = '';
      transferRecipient = '';
      
      dispatch('operation', { type: 'transfer', result: { success: false, error: 'Not implemented' } });
    } catch (error) {
      console.error('Transfer error:', error);
    } finally {
      isProcessing = false;
    }
  }

  function handleExecute() {
    switch (activeOperation) {
      case 'split':
        executeSplit();
        break;
      case 'withdraw':
        executeWithdraw();
        break;
      case 'transfer':
        executeTransfer();
        break;
    }
  }

  function canExecute(): boolean {
    if (isProcessing) return false;

    switch (activeOperation) {
      case 'split':
        const validation = validateSplitAmounts();
        return validation.valid;
      case 'withdraw':
        return !!(withdrawSelectedUTXO && withdrawRecipient);
      case 'transfer':
        return !!(transferSelectedUTXO && transferRecipient);
      default:
        return false;
    }
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
    <h2 class="text-xl font-bold text-white mb-2">UTXO Operations</h2>
    <p class="text-gray-300 text-sm">
      Perform privacy-preserving operations on your UTXOs
    </p>
  </div>

  <!-- Operation Tabs -->
  <div class="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
    <div class="flex space-x-1 p-1">
      {#each [
        { id: 'split', label: 'Split UTXO', icon: '✂️', description: 'Divide one UTXO into multiple outputs' },
        { id: 'withdraw', label: 'Withdraw', icon: '💸', description: 'Convert UTXO back to ERC20 tokens' },
        { id: 'transfer', label: 'Transfer', icon: '📤', description: 'Transfer UTXO to another address' }
      ] as operation}
        <button
          on:click={() => activeOperation = operation.id as OperationType}
          class="flex-1 flex flex-col items-center justify-center py-4 px-4 rounded-lg font-medium transition-all duration-200 {activeOperation === operation.id ? 'bg-white/20 text-white' : 'text-gray-300 hover:bg-white/10'}"
          title={operation.description}
        >
          <span class="text-2xl mb-1">{operation.icon}</span>
          <span class="text-sm">{operation.label}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Operation Forms -->
  <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
    {#if availableUTXOs.length === 0}
      <div class="text-center py-12">
        <div class="text-gray-400 text-6xl mb-4">📪</div>
        <div class="text-white text-xl font-semibold mb-2">No UTXOs Available</div>
        <div class="text-gray-400">
          You need confirmed UTXOs to perform operations. Try depositing some tokens first.
        </div>
      </div>
    {:else}
      <!-- Split UTXO Form -->
      {#if activeOperation === 'split'}
        <div class="space-y-6">
          <h3 class="text-lg font-semibold text-white">Split UTXO into Multiple Outputs</h3>
          
          <!-- Select UTXO -->
          <div>
            <label for="split-utxo-select" class="block text-sm font-medium text-white mb-2">
              Select UTXO to Split
            </label>
            <select
              id="split-utxo-select"
              bind:value={splitSelectedUTXO}
              class="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white"
              required
            >
              <option value="">Choose a UTXO...</option>
              {#each availableUTXOs as utxo}
                <option value={utxo.id}>
                  {formatValue(utxo.value, utxo.tokenMetadata?.decimals)} {utxo.tokenMetadata?.symbol} 
                  (ID: {utxo.id.slice(0, 8)}...)
                </option>
              {/each}
            </select>
          </div>

          {#if selectedUTXOData.split}
            <!-- Split Outputs -->
            <div>
              <div class="flex items-center justify-between mb-4">
                <div class="text-sm font-medium text-white">
                  Output UTXOs
                </div>
                <button
                  type="button"
                  on:click={addSplitOutput}
                  class="text-purple-400 hover:text-purple-300 text-sm font-medium"
                >
                  + Add Output
                </button>
              </div>

              <div class="space-y-3">
                {#each splitOutputs as output, index}
                  <div class="flex space-x-3 items-end">
                    <div class="flex-1">
                      <label for="amount-{index}" class="block text-xs text-gray-400 mb-1">
                        Amount
                      </label>
                      <input
                        id="amount-{index}"
                        type="number"
                        bind:value={output.amount}
                        placeholder="0.00"
                        step="any"
                        min="0"
                        class="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400"
                        required
                      />
                    </div>
                    
                    <div class="flex-1">
                      <label for="owner-{index}" class="block text-xs text-gray-400 mb-1">
                        Owner Address
                      </label>
                      <input
                        id="owner-{index}"
                        type="text"
                        bind:value={output.owner}
                        placeholder="0x..."
                        class="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400"
                        required
                      />
                    </div>
                    
                    {#if splitOutputs.length > 2}
                      <button
                        type="button"
                        on:click={() => removeSplitOutput(index)}
                        class="p-2 text-red-400 hover:text-red-300"
                      >
                        🗑️
                      </button>
                    {/if}
                  </div>
                {/each}
              </div>

              <!-- Validation Info -->
              {#if splitSelectedUTXO}
                {@const validation = validateSplitAmounts()}
                {@const splitTokenData = getTokenMetadata(selectedUTXOData.split?.tokenAddress || '')}
                <div class="mt-4 p-3 rounded-lg border {validation.valid ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10'}">
                  <div class="text-sm {validation.valid ? 'text-green-400' : 'text-red-400'}">
                    {#if validation.valid}
                      ✅ Split configuration is valid
                    {:else}
                      ❌ {validation.error}
                    {/if}
                  </div>
                  <div class="text-xs text-gray-400 mt-1">
                    Input: {formatValue(selectedUTXOData.split.value, splitTokenData?.decimals || 18)} 
                    {splitTokenData?.symbol || 'UNK'}
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Withdraw Form -->
      {#if activeOperation === 'withdraw'}
        <div class="space-y-6">
          <h3 class="text-lg font-semibold text-white">Withdraw UTXO to ERC20</h3>
          
          <!-- Select UTXO -->
          <div>
            <label for="withdraw-utxo-select" class="block text-sm font-medium text-white mb-2">
              Select UTXO to Withdraw
            </label>
            <select
              id="withdraw-utxo-select"
              bind:value={withdrawSelectedUTXO}
              class="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white"
              required
            >
              <option value="">Choose a UTXO...</option>
              {#each availableUTXOs as utxo}
                {@const tokenData = getTokenMetadata(utxo.tokenAddress)}
                <option value={utxo.id}>
                  {formatValue(utxo.value, tokenData?.decimals || 18)} {tokenData?.symbol || 'UNK'} 
                  (ID: {utxo.id.slice(0, 8)}...)
                </option>
              {/each}
            </select>
          </div>

          <!-- Recipient -->
          <div>
            <label for="withdraw-recipient" class="block text-sm font-medium text-white mb-2">
              Recipient Address
            </label>
            <input
              id="withdraw-recipient"
              type="text"
              bind:value={withdrawRecipient}
              placeholder="0x..."
              class="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400"
              required
            />
          </div>

          {#if selectedUTXOData.withdraw}
            {@const withdrawTokenData = getTokenMetadata(selectedUTXOData.withdraw.tokenAddress)}
            <div class="bg-blue-600/20 border border-blue-600/30 rounded-lg p-4">
              <div class="flex space-x-3">
                <div class="text-blue-400 text-xl">ℹ️</div>
                <div class="text-sm text-blue-200">
                  <div class="font-medium mb-1">Withdrawal Details:</div>
                  <div class="space-y-1 text-blue-300">
                    <div>Amount: {formatValue(selectedUTXOData.withdraw.value, withdrawTokenData?.decimals || 18)} {withdrawTokenData?.symbol || 'UNK'}</div>
                    <div>Token: {selectedUTXOData.withdraw.tokenAddress}</div>
                    <div>This will convert your UTXO back to standard ERC20 tokens</div>
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Transfer Form -->
      {#if activeOperation === 'transfer'}
        <div class="space-y-6">
          <h3 class="text-lg font-semibold text-white">Transfer UTXO Ownership</h3>
          
          <!-- Select UTXO -->
          <div>
            <label for="transfer-utxo-select" class="block text-sm font-medium text-white mb-2">
              Select UTXO to Transfer
            </label>
            <select
              id="transfer-utxo-select"
              bind:value={transferSelectedUTXO}
              class="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white"
              required
            >
              <option value="">Choose a UTXO...</option>
              {#each availableUTXOs as utxo}
                {@const tokenData = getTokenMetadata(utxo.tokenAddress)}
                <option value={utxo.id}>
                  {formatValue(utxo.value, tokenData?.decimals || 18)} {tokenData?.symbol || 'UNK'} 
                  (ID: {utxo.id.slice(0, 8)}...)
                </option>
              {/each}
            </select>
          </div>

          <!-- New Owner -->
          <div>
            <label for="transfer-recipient" class="block text-sm font-medium text-white mb-2">
              New Owner Address
            </label>
            <input
              id="transfer-recipient"
              type="text"
              bind:value={transferRecipient}
              placeholder="0x..."
              class="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400"
              required
            />
          </div>

          <div class="bg-yellow-600/20 border border-yellow-600/30 rounded-lg p-4">
            <div class="flex space-x-3">
              <div class="text-yellow-400 text-xl">🚧</div>
              <div class="text-sm text-yellow-200">
                <div class="font-medium mb-1">Coming Soon:</div>
                <div class="text-yellow-300">
                  UTXO transfer functionality is being implemented and will be available in a future update.
                </div>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Execute Button -->
      <div class="pt-6 border-t border-white/10">
        <button
          on:click={handleExecute}
          disabled={!canExecute()}
          class="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
        >
          {#if isProcessing}
            <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span>Processing...</span>
          {:else}
            <span>
              {#if activeOperation === 'split'}✂️
              {:else if activeOperation === 'withdraw'}💸
              {:else if activeOperation === 'transfer'}📤
              {/if}
            </span>
            <span>
              Execute {activeOperation.charAt(0).toUpperCase() + activeOperation.slice(1)}
            </span>
          {/if}
        </button>
      </div>
    {/if}
  </div>
</div>