<!--
  @fileoverview Operations Panel
  @description Main operations interface for UTXO operations
-->

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ERC20TokenData } from '../../types/ethereum.types';
  import type { PrivateUTXO } from '../../types/utxo.types';
  import { EthereumHelpers } from '../../utils/ethereum.helpers';
  import { getSplitErrorMessage } from '../../contracts/ZKUTXOVault.types';
  import TransferPanelSimple from './TransferPanelSimple.svelte';

  // Import using default import only and infer type
  import privateUTXOManager  from '$lib/ManagerUTXO';
  type PrivateUTXOManager = typeof privateUTXOManager;

  // Props - Solo private UTXOs
  export let utxoManager: PrivateUTXOManager;
  export let privateUTXOs: PrivateUTXO[] = [];
  
  // Event dispatcher
  const dispatch = createEventDispatcher();

  // Operation types
  type OperationType = 'split' | 'withdraw' | 'transfer';

  // State
  let activeOperation: OperationType = 'split';
  let isProcessing = false;

  // Loading states
  let isLoadingUTXOs = false;
  let isLoadingTokenMetadata = false;
  let utxosLoaded = false;
  let tokenMetadataLoaded = false;

  // Computed loading state
  $: isFullyLoaded = utxosLoaded && tokenMetadataLoaded;
  $: isLoadingAny = isLoadingUTXOs || isLoadingTokenMetadata;

  // Token metadata cache
  let tokenMetadataCache: Record<string, ERC20TokenData> = {};

  // Watch for private UTXO changes and trigger loading sequence
  $: if (privateUTXOs.length > 0) {
    handlePrivateUTXOsChanged();
  }

  // Handle private UTXOs change - start loading sequence
  async function handlePrivateUTXOsChanged() {
    console.log('🔄 Private UTXOs changed, starting loading sequence...');
    
    // Reset states
    utxosLoaded = false;
    tokenMetadataLoaded = false;
    
    // Phase 1: Mark UTXOs as loaded (they come from props)
    isLoadingUTXOs = true;
    console.log('📦 Phase 1: Private UTXOs loading...', {
      private: privateUTXOs.length
    });
    
    // Simulate UTXO processing time if needed
    await new Promise(resolve => setTimeout(resolve, 100));
    isLoadingUTXOs = false;
    utxosLoaded = true;
    console.log('✅ Phase 1: Private UTXOs loaded');

    // Phase 2: Load token metadata
    await loadTokenMetadata();
  }

  // Load token metadata - Phase 2
  async function loadTokenMetadata() {
    if (!utxosLoaded) {
      console.warn('⚠️ Attempting to load token metadata before UTXOs are loaded');
      return;
    }

    isLoadingTokenMetadata = true;
    console.log('🏷️ Phase 2: Token metadata loading...');

    try {
      // Get unique token addresses from private UTXOs
      const uniqueTokens = [...new Set(privateUTXOs.map(u => u.tokenAddress))];
      
      console.log('🔍 Loading token metadata for:', uniqueTokens);
      
      for (const tokenAddress of uniqueTokens) {
        if (!tokenMetadataCache[tokenAddress]) {
          try {
            console.log(`📊 Fetching metadata for ${tokenAddress}...`);
            const tokenData = await EthereumHelpers.getERC20TokenInfo(tokenAddress);
            console.log(`✅ Token metadata loaded:`, {
              address: tokenData.address,
              symbol: tokenData.symbol,
              name: tokenData.name,
              decimals: tokenData.decimals,
              hasBalance: tokenData.balance !== undefined,
              hasAllowance: tokenData.allowance !== undefined,
              verified: tokenData.verified
            });
            
            tokenMetadataCache[tokenAddress] = tokenData;
            // Trigger reactivity
            tokenMetadataCache = { ...tokenMetadataCache };
          } catch (error) {
            console.error('❌ Failed to load token metadata for', tokenAddress, error);
            // Set default metadata with warning
            tokenMetadataCache[tokenAddress] = {
              address: tokenAddress,
              name: `Unknown Token (${tokenAddress.slice(0, 6)}...)`,
              symbol: 'UNK',
              decimals: 18, // Default fallback
              balance: 0n,
              allowance: 0n,
              verified: false
            };
            tokenMetadataCache = { ...tokenMetadataCache };
          }
        }
      }

      isLoadingTokenMetadata = false;
      tokenMetadataLoaded = true;
      console.log('✅ Phase 2: Token metadata loaded for all tokens');
      console.log('🎉 All data loaded, ready to render operations');
      
      // Log summary of loaded tokens
      const tokenSummary = Object.entries(tokenMetadataCache).map(([address, data]) => ({
        address: address.slice(0, 8) + '...',
        symbol: data.symbol,
        decimals: data.decimals
      }));
      console.log('📋 Token metadata summary:', tokenSummary);
      
    } catch (error) {
      console.error('❌ Error loading token metadata:', error);
      isLoadingTokenMetadata = false;
      tokenMetadataLoaded = false;
    }
  }

  // Helper function to get token metadata
  function getTokenMetadata(tokenAddress: string): ERC20TokenData {
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
    
    // Ensure all fields are present, with defaults for missing ones
    const completeMetadata: ERC20TokenData = {
      address: metadata.address,
      name: metadata.name,
      symbol: metadata.symbol,
      decimals: metadata.decimals,
      balance: metadata.balance ?? 0n,  // Default to 0n if undefined
      allowance: metadata.allowance ?? 0n,  // Default to 0n if undefined
      verified: metadata.verified ?? false
    };
    
    console.log(`📋 Using metadata for ${tokenAddress}:`, {
      symbol: completeMetadata.symbol, 
      decimals: completeMetadata.decimals.toString(),
      hasBalance: metadata.balance !== undefined,
      hasAllowance: metadata.allowance !== undefined
    });
        console.log(`completeMetadata`, completeMetadata);
    return completeMetadata;
  }

  // Split operation state
  let splitSelectedUTXO = '';
  let splitOutputs: Array<{ amount: string; owner: string }> = [
    { amount: '', owner: '' },
    { amount: '', owner: '' }
  ];
  
  // Initialize owner addresses when component loads
  $: if (utxoManager && utxoManager.getCurrentAccount() && splitOutputs.every(o => !o.owner)) {
    const currentAddress = utxoManager.getCurrentAccount()?.address || '';
    splitOutputs = splitOutputs.map(output => ({
      ...output,
      owner: output.owner || currentAddress
    }));
  }

  // Withdraw operation state - no recipient needed (always current account)
  let withdrawSelectedUTXO = '';

  // Transfer operation state
  let transferSelectedUTXO = '';
  let transferRecipient = '';

  // Split validation state
  let splitValidation: { valid: boolean; error?: string; canSubmit: boolean } = { 
    valid: false, 
    error: 'No UTXO selected',
    canSubmit: false 
  };

  // Computed values - only available private UTXOs when data is fully loaded
  $: availableUTXOs = isFullyLoaded ? 
    privateUTXOs.filter(utxo => !utxo.isSpent) : [];
  
  // Simplified version for operations that need just basic fields (kept for backward compatibility)
  $: availableUTXOsSimple = isFullyLoaded ? 
    privateUTXOs.filter(utxo => !utxo.isSpent).map(privateUTXO => ({
      id: privateUTXO.id,
      value: privateUTXO.value,
      tokenAddress: privateUTXO.tokenAddress,
      owner: privateUTXO.owner,
      isSpent: privateUTXO.isSpent,
      timestamp: privateUTXO.timestamp,
      commitment: privateUTXO.commitment,
      nullifierHash: privateUTXO.nullifierHash,
      blindingFactor: privateUTXO.blindingFactor
    })) : [];
  
  $: selectedUTXOData = {
    split: availableUTXOsSimple.find(u => u.id === splitSelectedUTXO),
    withdraw: availableUTXOsSimple.find(u => u.id === withdrawSelectedUTXO),
    transfer: availableUTXOsSimple.find(u => u.id === transferSelectedUTXO)
  };

  // Debug: Log UTXOs props when they change
  $: {
    console.log('📥 OperationsPanel received private UTXOs:', {
      privateUTXOs: privateUTXOs.length,
      privateDetails: privateUTXOs.map(u => ({ id: u.id.slice(0, 8), spent: u.isSpent }))
    });
  }

  // Debug: Log available private UTXOs when they change
  $: if (availableUTXOsSimple.length > 0) {
    console.log('🔧 Available private UTXOs for operations:', {
      total: availableUTXOsSimple.length,
      private: privateUTXOs.filter(utxo => !utxo.isSpent).length,
      utxos: availableUTXOsSimple.map(u => ({
        id: u.id.slice(0, 8),
        value: u.value.toString(),
        tokenAddress: u.tokenAddress
      }))
    });
  }

  // Initialize with current account as default owner for split outputs
  $: if (utxoManager.getCurrentAccount()) {
    const address = utxoManager.getCurrentAccount()?.address;
    if (address) {
      splitOutputs = splitOutputs.map(output => ({
        ...output,
        owner: output.owner || address
      }));
    }
  }

  // Reactive split validation - only when data is loaded
  $: {
    try {
      // Only validate if data is fully loaded
      if (!isFullyLoaded) {
        splitValidation = { 
          valid: false, 
          error: 'Loading data...',
          canSubmit: false 
        };
      } else {
        const utxo = selectedUTXOData.split;
        if (!utxo) {
          splitValidation = { 
            valid: false, 
            error: 'No UTXO selected',
            canSubmit: false 
          };
        } else {
          const tokenData = getTokenMetadata(utxo.tokenAddress);
          const decimals = tokenData.decimals;
          const totalInput = utxo.value;
          
          console.log(`decimals ---------- `, decimals);
          let totalOutput = BigInt(0);
          let hasEmptyFields = false;
          let hasInvalidAmounts = false;
        
        console.log('🔄 Reactive validation:', {
          selectedUTXO: utxo.id.slice(0, 8),
          totalInput: formatValue(totalInput),
          outputs: splitOutputs.map(o => ({ amount: o.amount, owner: o.owner?.slice(0, 8) + '...' }))
        });
        
        for (const output of splitOutputs) {
          if (!output.amount || !output.owner) {
            hasEmptyFields = true;
            continue;
          }
          
          const amountBigInt = parseAmountToBigInt(output.amount, decimals);
          if (amountBigInt <= 0) {
            hasInvalidAmounts = true;
            continue;
          }
          
          totalOutput += amountBigInt;
        }
        
        if (hasEmptyFields) {
          splitValidation = { 
            valid: false, 
            error: 'All outputs must have amount and owner',
            canSubmit: false 
          };
        } else if (hasInvalidAmounts) {
          splitValidation = { 
            valid: false, 
            error: 'All amounts must be positive',
            canSubmit: false 
          };
        } else if (totalOutput !== totalInput) {
          const diff = totalInput - totalOutput;
          const diffFormatted = formatValue(diff > 0 ? diff : -diff, decimals);
          splitValidation = { 
            valid: false, 
            error: `Sum of outputs (${formatValue(totalOutput, decimals)}) must equal input (${formatValue(totalInput, decimals)}). Difference: ${diffFormatted}`,
            canSubmit: false 
          };
        } else {
          splitValidation = { 
            valid: true,
            canSubmit: true 
          };
          console.log('✅ Split validation passed');
        }
        }
      }
    } catch (error) {
      console.error('❌ Reactive validation error:', error);
      splitValidation = { 
        valid: false, 
        error: 'Validation failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
        canSubmit: false 
      };
    }
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
  function parseAmountToBigInt(amountInput: string | number, decimals: number): bigint {
    try {
      if (!amountInput) {
        return 0n;
      }
      
      // Convert to string regardless of input type
      const amountStr = String(amountInput).trim();
      
      if (amountStr === '') {
        return 0n;
      }
      
      // Check if it's a valid number
      const amountFloat = parseFloat(amountStr);
      if (isNaN(amountFloat) || amountFloat <= 0) {
        return 0n;
      }
      
      // Split into integer and decimal parts
      const [integerPart, decimalPart = ''] = amountStr.split('.');
      
      // Truncate decimal part to the token's decimals (don't round, truncate)
      const truncatedDecimal = decimalPart.slice(0, decimals);
      
      // Pad with zeros if needed
      const paddedDecimal = truncatedDecimal.padEnd(decimals, '0');
      
      // Combine integer and decimal parts
      const fullAmountStr = integerPart + paddedDecimal;
      
      console.log(`💱 Parse ${amountInput} with ${decimals} decimals:`, {
        original: amountInput,
        stringified: amountStr,
        integerPart,
        decimalPart,
        truncatedDecimal,
        paddedDecimal,
        fullAmountStr,
        result: BigInt(fullAmountStr).toString()
      });
      
      return BigInt(fullAmountStr);
    } catch (error) {
      console.error('Error parsing amount:', error, 'Input:', amountInput, 'Type:', typeof amountInput);
      return 0n;
    }
  }

  function addSplitOutput() {
    splitOutputs = [...splitOutputs, { 
      amount: '', 
      owner: utxoManager.getCurrentAccount()?.address || '' 
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
      const decimals = tokenData.decimals;
      const totalInput = utxo.value;
      
      console.log('🔍 Validating split amounts:', {
        totalInput: totalInput.toString(),
        totalInputFormatted: formatValue(totalInput),
        decimals,
        outputs: splitOutputs.map(o => ({ amount: o.amount, owner: o.owner.slice(0, 8) + '...' }))
      });
      
      let totalOutput = BigInt(0);
      const outputDetails = [];
      
      for (const output of splitOutputs) {
        if (!output.amount || !output.owner) {
          console.log('❌ Missing amount or owner:', output);
          return { valid: false, error: 'All outputs must have amount and owner' };
        }
        
        const amountBigInt = parseAmountToBigInt(output.amount, decimals);
        outputDetails.push({
          amount: output.amount,
          amountBigInt: amountBigInt.toString(),
          owner: output.owner.slice(0, 8) + '...'
        });
        
        if (amountBigInt <= 0) {
          console.log('❌ Invalid amount:', { amount: output.amount, amountBigInt });
          return { valid: false, error: 'All amounts must be positive' };
        }
        
        totalOutput += amountBigInt;
      }
      
      console.log('📊 Detailed validation:', {
        totalInput: totalInput.toString(),
        totalOutput: totalOutput.toString(),
        difference: (totalInput - totalOutput).toString(),
        inputFormatted: formatValue(totalInput),
        outputFormatted: formatValue(totalOutput),
        outputDetails,
        isEqual: totalOutput === totalInput
      });
      
      if (totalOutput !== totalInput) {
        const diff = totalInput - totalOutput;
        const diffFormatted = formatValue(diff);
        console.log('❌ Amounts do not match. Difference:', diffFormatted);
        return { 
          valid: false, 
          error: `Sum of outputs (${formatValue(totalOutput)}) must equal input (${formatValue(totalInput)}). Difference: ${diffFormatted}` 
        };
      }
      
      console.log('✅ Validation passed');
      return { valid: true };
    } catch (error) {
      console.error('❌ Validation error:', error);
      return { valid: false, error: 'Validation failed: ' + (error instanceof Error ? error.message : 'Unknown error') };
    }
  }

  // Reactive calculation of split remainder - updates automatically when inputs change
  $: splitRemainder = (() => {
    const currentAccount = utxoManager.getCurrentAccount();
    if (!selectedUTXOData.split || !currentAccount || !isFullyLoaded) return { 
      remainder: '0', 
      formatted: '0',
      outputToOthers: BigInt(0),
      remainingToUser: BigInt(0),
      formattedOutputToOthers: '0',
      formattedRemainingToUser: '0',
      isPositive: false,
      isNegative: false,
      isZero: true
    };
    
    const utxo = selectedUTXOData.split;
    const tokenData = getTokenMetadata(utxo.tokenAddress);
    const decimals = tokenData.decimals;
    const totalInput = utxo.value;
    const currentUserAddress = currentAccount.address.toLowerCase();
    
    let totalOutput = BigInt(0);
    let outputToOthers = BigInt(0);
    let remainingToUser = BigInt(0);
    
    for (const output of splitOutputs) {
      if (output.amount && output.owner) {
        const outputValue = parseAmountToBigInt(output.amount, decimals);
        totalOutput += outputValue;
        
        // Clasificar según la dirección del owner
        if (output.owner.toLowerCase() === currentUserAddress) {
          remainingToUser += outputValue;
        } else {
          outputToOthers += outputValue;
        }
      }
    }
    
    const remainderBigInt = totalInput - totalOutput;
    const remainderFormatted = formatValue(remainderBigInt, decimals);
    
    // Si hay remainder positivo, va al usuario
    if (remainderBigInt > 0) {
      remainingToUser += remainderBigInt;
    }
    
    return {
      remainder: remainderBigInt.toString(),
      formatted: remainderFormatted,
      isPositive: remainderBigInt > 0,
      isNegative: remainderBigInt < 0,
      isZero: remainderBigInt === 0n,
      outputToOthers,
      remainingToUser,
      formattedOutputToOthers: formatValue(outputToOthers, decimals),
      formattedRemainingToUser: formatValue(remainingToUser, decimals)
    };
  })();

  // Auto-complete remaining amount in last output (function kept for potential future use)
  /*
  function autoCompleteLastSplit() {
    if (!selectedUTXOData.split || splitOutputs.length === 0) return;
    
    const remainderData = calculateSplitRemainder();
    const lastIndex = splitOutputs.length - 1;
    
    if (remainderData.isPositive) {
      splitOutputs[lastIndex] = {
        ...splitOutputs[lastIndex],
        amount: remainderData.formatted
      };
    }
  }
  */

  async function executeSplit() {
    const validation = validateSplitAmounts();
    if (!validation.valid) {
      console.error('Split validation failed:', validation.error);
      return;
    }

    const utxo = selectedUTXOData.split!;
    isProcessing = true;

    try {
      // Debug: Log detailed split information
      console.log('🔍 Executing split with detailed info:', {
        selectedUTXOId: splitSelectedUTXO,
        selectedUTXOData: utxo,
        currentAccount: utxoManager.getCurrentAccount()?.address,
        allAvailableUTXOs: availableUTXOs.map(u => ({ id: u.id, owner: u.owner, value: u.value.toString() })),
        allPrivateUTXOs: privateUTXOs.map(u => ({ id: u.id, owner: u.owner, isSpent: u.isSpent, value: u.value.toString() }))
      });

      // Verify UTXO exists in manager
      const currentAccount = utxoManager.getCurrentAccount();
      if (!currentAccount) {
        throw new Error('No current account available');
      }
      
      const managerPrivateUTXOs = utxoManager.getPrivateUTXOsByOwner(currentAccount.address);
      const foundInManager = managerPrivateUTXOs.find(u => u.id === splitSelectedUTXO);
      
      console.log('🔍 UTXO verification:', {
        searchingForId: splitSelectedUTXO,
        searchingForIdLength: splitSelectedUTXO.length,
        foundInManager: foundInManager ? {
          id: foundInManager.id,
          idLength: foundInManager.id.length,
          owner: foundInManager.owner,
          isSpent: foundInManager.isSpent,
          value: foundInManager.value.toString()
        } : null,
        managerUTXOsCount: managerPrivateUTXOs.length,
        managerUTXOsIds: managerPrivateUTXOs.map(u => ({ 
          id: u.id, 
          idLength: u.id.length,
          isSpent: u.isSpent,
          owner: u.owner
        })),
        exactMatch: managerPrivateUTXOs.some((u) => (u as import('../../types/utxo.types').PrivateUTXO).id === splitSelectedUTXO),
        idComparisons: managerPrivateUTXOs.map((u) => {
          const utxoTyped = u as import('../../types/utxo.types').PrivateUTXO;
          return {
            managerId: utxoTyped.id,
            selectedId: splitSelectedUTXO,
            equal: utxoTyped.id === splitSelectedUTXO,
            lengthMatch: utxoTyped.id.length === splitSelectedUTXO.length
          };
        })
      });

      // Additional debug: Check internal manager state
      console.log('� Detailed manager state:', {
        hasCurrentAccount: !!currentAccount,
        currentAccountAddress: currentAccount?.address,
        managerPrivateUTXOsInternal: managerPrivateUTXOs.map(u => {
          const utxoTyped = u as import('../../types/utxo.types').PrivateUTXO;
          return {
            id: utxoTyped.id,
            owner: utxoTyped.owner,
            isSpent: utxoTyped.isSpent,
            value: utxoTyped.value.toString(),
            tokenAddress: utxoTyped.tokenAddress
          };
        })
      });

      // Check if the UTXO we found is exactly the same object or a copy
      if (foundInManager) {
        console.log('� Found UTXO detailed analysis:', {
          foundUTXO: foundInManager,
          isExactSameObject: foundInManager === utxo,
          propertiesMatch: {
            id: foundInManager.id === utxo.id,
            owner: foundInManager.owner === utxo.owner,
            value: foundInManager.value === utxo.value,
            isSpent: foundInManager.isSpent === utxo.isSpent,
            tokenAddress: foundInManager.tokenAddress === utxo.tokenAddress
          }
        });
      }

      const tokenData = getTokenMetadata(utxo.tokenAddress);
      const decimals = tokenData.decimals;
      const outputValues = splitOutputs.map(output => 
        parseAmountToBigInt(output.amount, decimals)
      );
      const outputOwners = splitOutputs.map(output => output.owner);

      // Validar que las direcciones de los owners sean válidas
      console.log('📧 Validating output owners:', outputOwners);
      for (let i = 0; i < outputOwners.length; i++) {
        const ownerAddress = outputOwners[i]?.trim();
        if (!ownerAddress || !ownerAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
          throw new Error(`Invalid owner address for output ${i + 1}: "${ownerAddress}". Please provide a valid Ethereum address.`);
        }
        console.log(`📧 Output ${i + 1} owner: ${ownerAddress}`);
      }
      
      // Verificar si hay transfers (direcciones diferentes al usuario actual)
      const currentUserAddress = currentAccount.address.toLowerCase();
      const transfers = outputOwners.filter(addr => 
        addr.toLowerCase() !== currentUserAddress
      );
      
      console.log('👥 Owner distribution analysis:', {
        currentUser: currentUserAddress,
        output1: { 
          value: splitOutputs[0].amount,
          owner: outputOwners[0],
          isTransfer: outputOwners[0].toLowerCase() !== currentUserAddress
        },
        output2: { 
          value: splitOutputs[1].amount,
          owner: outputOwners[1],
          isTransfer: outputOwners[1].toLowerCase() !== currentUserAddress
        },
        totalTransfers: transfers.length
      });

      // Execute private UTXO split operation
      const result = await utxoManager.splitPrivateUTXO({
        inputUTXOId: splitSelectedUTXO,
        outputValues: splitOutputs.map(o => parseAmountToBigInt(o.amount, decimals)),
        outputOwners: splitOutputs.map(o => o.owner)
      });

      if (result.success) {
        console.log('✅ Split operation completed successfully:', result);
        console.log('📦 New UTXOs created:', result);
        console.log('👥 Final owner distribution:', {
          output1: { 
            value: splitOutputs[0].amount,
            owner: outputOwners[0],
            isTransfer: outputOwners[0].toLowerCase() !== currentUserAddress
          },
          output2: { 
            value: splitOutputs[1].amount,
            owner: outputOwners[1],
            isTransfer: outputOwners[1].toLowerCase() !== currentUserAddress
          }
        });
        
        // Mostrar notificaciones específicas según el tipo de operación
        if (transfers.length > 0) {
          console.log(`🔄 Split completed with ${transfers.length} transfer(s) to other address(es)`);
          // Note: No podemos usar addNotification aquí, pero se muestra en los logs
        } else {
          console.log('✅ Split completed - both UTXOs remain in your account');
        }
        
        // Reset form
        splitSelectedUTXO = '';
        splitOutputs = [
          { amount: '', owner: utxoManager.getCurrentAccount()?.address || '' },
          { amount: '', owner: utxoManager.getCurrentAccount()?.address || '' }
        ];
        
        dispatch('operation', { type: 'split', result });

      } else {
        console.error('Split failed:', result.error);
        
        // Mostrar error específico si está relacionado con validación
        let errorMessage = result.error || 'Unknown error occurred';
        
        // Detectar errores específicos de pre-validación
        if (typeof result.error === 'string') {
          if (result.error.includes('Output nullifier same as input')) {
            errorMessage = 'Error: Los nullifiers de salida no pueden ser iguales al de entrada. Se detectó un conflicto criptográfico.';
          } else if (result.error.includes('Output nullifier already used')) {
            errorMessage = 'Error: Uno de los nullifiers de salida ya está en uso. Intenta nuevamente.';
          } else if (result.error.includes('Duplicate output nullifiers')) {
            errorMessage = 'Error: Se detectaron nullifiers duplicados entre las salidas.';
          } else if (result.error.includes('Input already spent')) {
            errorMessage = 'Error: El UTXO de entrada ya ha sido gastado.';
          } else if (result.error.includes('Pre-validación COMPLETA falló')) {
            errorMessage = 'Error: La validación criptográfica completa falló. ' + result.error;
          }
        }
        
        console.error('💥 Split error details:', {
          originalError: result.error,
          displayMessage: errorMessage
        });
      }
    } catch (error) {
      console.error('Split error:', error);
      
      // Manejo mejorado de errores con mensajes específicos
      let errorMessage = 'Error desconocido durante el split';
      
      if (error instanceof Error) {
        const errorText = error.message;
        
        // Detectar errores específicos de la nueva pre-validación
        if (errorText.includes('Output nullifier same as input')) {
          errorMessage = 'Error criptográfico: Los nullifiers de salida no pueden ser iguales al de entrada';
        } else if (errorText.includes('Output nullifier already used')) {
          errorMessage = 'Error: Uno de los nullifiers de salida ya está en uso';
        } else if (errorText.includes('Duplicate output nullifiers')) {
          errorMessage = 'Error: Se detectaron nullifiers duplicados';
        } else if (errorText.includes('Input already spent')) {
          errorMessage = 'Error: El UTXO ya ha sido gastado';
        } else if (errorText.includes('Pre-validación COMPLETA falló')) {
          errorMessage = 'Error de validación criptográfica: ' + errorText;
        } else {
          errorMessage = errorText;
        }
      }
      
      console.error('💥 Split operation failed:', {
        originalError: error,
        displayMessage: errorMessage
      });
    } finally {
      isProcessing = false;
    }
  }

  async function executeWithdraw() {
    if (!withdrawSelectedUTXO) return;

    // Get current account address automatically
    const currentAccount = utxoManager.getCurrentAccount();
    if (!currentAccount) {
      console.error('No current account available for withdraw');
      return;
    }

    isProcessing = true;

    try {
      // Execute private UTXO withdrawal to current account
      const result = await utxoManager.withdrawPrivateUTXO({
        utxoId: withdrawSelectedUTXO,
        recipient: currentAccount.address // ✅ Always use current account address
      });

      if (result.success) {
        // Reset form
        withdrawSelectedUTXO = '';
        
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

  // ✅ NEW: Handle transfer completion from TransferPanelSimple
  function handleTransferCompleted(event: CustomEvent) {
    const { sourceUTXOId, recipientAddress, amount, transactionHash } = event.detail;
    
    console.log('🎉 Transfer completed in OperationsPanel:', {
      sourceUTXOId: sourceUTXOId.slice(0, 16) + '...',
      recipientAddress: recipientAddress.slice(0, 8) + '...',
      amount,
      transactionHash: transactionHash?.slice(0, 16) + '...'
    });

    // Dispatch to parent component (+page.svelte)
    dispatch('operation', { 
      type: 'transfer', 
      result: { 
        success: true, 
        transactionHash,
        sourceUTXOId,
        recipientAddress,
        amount
      } 
    });
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

  // Reactive canExecute - updates automatically when dependencies change
  $: canExecute = (() => {
    // Can't execute if processing or data not loaded
    if (isProcessing || !isFullyLoaded) return false;

    switch (activeOperation) {
      case 'split':
        return splitValidation.canSubmit;
      case 'withdraw':
        return !!(withdrawSelectedUTXO && utxoManager.getCurrentAccount()); // ✅ Only need UTXO and current account
      case 'transfer':
        return !!(transferSelectedUTXO && transferRecipient);
      default:
        return false;
    }
  })();

  // Debug function to verify localStorage update after split (kept for future debugging)
  /*
  async function debugSplitResult() {
    if (!utxoManager.currentAccount) {
      console.warn('No current account to debug');
      return;
    }

    console.log('🔍 Debugging split result - localStorage state:');
    
    try {
      // Check localStorage directly
      const { PrivateUTXOStorage } = await import('../lib/PrivateUTXOStorage');
      const storedUTXOs = PrivateUTXOStorage.getPrivateUTXOs(utxoManager.currentAccount.address);
      
      console.log('📦 Private UTXOs in localStorage:', {
        count: storedUTXOs.length,
        utxos: storedUTXOs.map(u => ({
          id: u.id.slice(0, 8) + '...',
          value: u.value.toString(),
          isSpent: u.isSpent,
          owner: u.owner,
          timestamp: new Date(u.localCreatedAt).toLocaleTimeString()
        }))
      });

      // Check manager state
      const managerPrivateUTXOs = utxoManager.getPrivateUTXOsByOwner(utxoManager.currentAccount.address);
      
      console.log('🎮 Private UTXOs in manager:', {
        count: managerPrivateUTXOs.length,
        utxos: managerPrivateUTXOs.map(u => ({
          id: u.id.slice(0, 8) + '...',
          value: u.value.toString(),
          isSpent: u.isSpent,
          owner: u.owner,
          timestamp: new Date(u.localCreatedAt).toLocaleTimeString()
        }))
      });

      // Cross-check consistency
      const storageNotSpent = storedUTXOs.filter(u => !u.isSpent);
      const managerNotSpent = managerPrivateUTXOs.filter(u => !u.isSpent);
      
      console.log('✅ Consistency check:', {
        storageUnspent: storageNotSpent.length,
        managerUnspent: managerNotSpent.length,
        consistent: storageNotSpent.length === managerNotSpent.length
      });

    } catch (error) {
      console.error('❌ Error debugging split result:', error);
    }
  }
  */

  // Debug function for split state (kept for future debugging) 
  /*
  function debugSplitState() {
    console.log('🔍 Current split state:', {
      selectedUTXO: selectedUTXOData.split?.id,
      outputs: splitOutputs,
      validation: splitValidation,
      remainder: splitRemainder
    });
    alert('Check console for split state');
  }
  */
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
    <div class="flex justify-between items-center">
      <div>
        <h2 class="text-xl font-bold text-white mb-2">UTXO Operations</h2>
        <p class="text-gray-300 text-sm">
          Perform privacy-preserving operations on your UTXOs
        </p>
      </div>
    </div>
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
    
    <!-- Loading State -->
    {#if isLoadingAny || !isFullyLoaded}
      <div class="text-center py-12">
        <div class="text-6xl mb-4">⏳</div>
        <div class="text-white text-xl font-semibold mb-4">Loading Data...</div>
        
        <!-- Loading Progress -->
        <div class="space-y-2 max-w-md mx-auto">
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-300">UTXOs</span>
            <span class="text-{utxosLoaded ? 'green' : 'yellow'}-400">
              {utxosLoaded ? '✅' : isLoadingUTXOs ? '⏳' : '⏸️'}
            </span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-300">Token Metadata</span>
            <span class="text-{tokenMetadataLoaded ? 'green' : 'yellow'}-400">
              {tokenMetadataLoaded ? '✅' : isLoadingTokenMetadata ? '⏳' : '⏸️'}
            </span>
          </div>
        </div>
        
        {#if isLoadingTokenMetadata}
          <div class="mt-4 text-gray-400 text-sm">
            Loading token information...
          </div>
        {/if}
      </div>
    
    <!-- No UTXOs Available -->
    {:else if availableUTXOs.length === 0}
      <div class="text-center py-12">
        <div class="text-gray-400 text-6xl mb-4">📪</div>
        <div class="text-white text-xl font-semibold mb-2">No UTXOs Available</div>
        <div class="text-gray-400 mb-4">
          You need confirmed UTXOs to perform operations. Try depositing some tokens first.
        </div>
        <div class="text-xs text-gray-500 mt-4 bg-gray-800/50 rounded p-2">
          Debug: Private UTXOs: {privateUTXOs.length}
          {#if privateUTXOs.length > 0}
            <br/>Private UTXOs: {privateUTXOs.map(u => `${u.id.slice(0,6)}(spent:${u.isSpent})`).join(', ')}
          {/if}
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
            
            {#if !tokenMetadataLoaded}
              <div class="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-gray-400 flex items-center">
                <div class="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full mr-2"></div>
                Loading token metadata...
              </div>
            {:else}
              <select
                id="split-utxo-select"
                bind:value={splitSelectedUTXO}
                class="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none"
                required
              >
                <option value="">Choose a UTXO...</option>
                {#each availableUTXOsSimple as utxo}
                  {@const tokenData = getTokenMetadata(utxo.tokenAddress)}
                  <option value={utxo.id}>
                    {formatValue(utxo.value, tokenData.decimals)} {tokenData.symbol} 
                    (ID: {utxo.id.slice(0, 8)}...)
                  </option>
                {/each}
              </select>
            {/if}
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
                
                <!-- Real-time remainder display -->
                <div class="bg-blue-600/20 border border-blue-600/30 rounded-lg p-3 mb-4">
                  <div class="flex justify-between items-center text-sm">
                    <span class="text-blue-200">Input Total:</span>
                    <span class="text-white font-mono">{formatValue(selectedUTXOData.split.value, splitTokenData.decimals)} {splitTokenData.symbol}</span>
                  </div>
                  <div class="flex justify-between items-center text-sm mt-1">
                    <span class="text-blue-200">Output to Others:</span>
                    <span class="text-white font-mono">{splitRemainder.formattedOutputToOthers} {splitTokenData.symbol}</span>
                  </div>
                  <div class="flex justify-between items-center text-sm mt-1">
                    <span class="text-blue-200">Remaining to You:</span>
                    <span class="font-mono {splitRemainder.isZero ? 'text-green-400' : splitRemainder.isPositive ? 'text-yellow-400' : 'text-red-400'}">
                      {splitRemainder.formattedRemainingToUser} {splitTokenData.symbol}
                    </span>
                  </div>
                </div>

                <!-- Validation Status -->
                <div class="p-3 rounded-lg border {splitValidation.valid ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10'}">
                  <div class="text-sm {splitValidation.valid ? 'text-green-400' : 'text-red-400'}">
                    {#if splitValidation.valid}
                      ✅ Split configuration is valid
                    {:else}
                      ❌ {splitValidation.error}
                    {/if}
                  </div>
                  <!-- Validation Status Indicator -->
                  <div class="text-xs text-gray-400 text-center mt-2">
                    Status: {splitValidation.canSubmit ? '✅ Ready to Execute' : '❌ Validation Required'}
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
            
            {#if !tokenMetadataLoaded}
              <div class="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-gray-400 flex items-center">
                <div class="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full mr-2"></div>
                Loading token metadata...
              </div>
            {:else}
              <select
                id="withdraw-utxo-select"
                bind:value={withdrawSelectedUTXO}
                class="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none"
                required
              >
                <option value="">Choose a UTXO...</option>
                {#each availableUTXOsSimple as utxo}
                  {@const tokenData = getTokenMetadata(utxo.tokenAddress)}
                  <option value={utxo.id}>
                    {formatValue(utxo.value, tokenData.decimals)} {tokenData.symbol} 
                    (ID: {utxo.id.slice(0, 8)}...)
                  </option>
                {/each}
              </select>
            {/if}
          </div>

          <!-- Recipient -->
          <div class="bg-blue-600/20 border border-blue-600/30 rounded-lg p-4">
            <div class="flex space-x-3">
              <div class="text-blue-400 text-xl">ℹ️</div>
              <div class="text-sm text-blue-200">
                <div class="font-medium mb-1">Withdrawal Information:</div>
                <div class="space-y-1 text-blue-300">
                  <div>🏦 <strong>Recipient:</strong> Your connected account</div>
                  <div>📍 <strong>Address:</strong> {utxoManager.getCurrentAccount()?.address || 'Loading...'}</div>
                  <div>💡 All withdrawals are automatically sent to your connected wallet</div>
                </div>
              </div>
            </div>
          </div>

          {#if selectedUTXOData.withdraw}
            {@const withdrawTokenData = getTokenMetadata(selectedUTXOData.withdraw.tokenAddress)}
            <div class="bg-blue-600/20 border border-blue-600/30 rounded-lg p-4">
              <div class="flex space-x-3">
                <div class="text-blue-400 text-xl">ℹ️</div>
                <div class="text-sm text-blue-200">
                  <div class="font-medium mb-1">Withdrawal Details:</div>
                  <div class="space-y-1 text-blue-300">
                    <div>Amount: {formatValue(selectedUTXOData.withdraw.value, withdrawTokenData.decimals)} {withdrawTokenData.symbol}</div>
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
          <h3 class="text-lg font-semibold text-white">🔄 Transfer Private UTXO</h3>
          
          <!-- ✅ NEW: Use TransferPanelSimple component -->
          <TransferPanelSimple 
            availableUTXOs={availableUTXOs}
            tokenMetadataCache={tokenMetadataCache}
            on:transferCompleted={handleTransferCompleted}
          />
        </div>
      {/if}

      <!-- Execute Button (hidden for transfer operation since TransferPanelSimple has its own button) -->
      {#if activeOperation !== 'transfer'}
        <div class="pt-6 border-t border-white/10">
          <button
            on:click={handleExecute}
            disabled={!canExecute}
            class="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
          >
            {#if isProcessing}
              <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Processing...</span>
            {:else}
              <span>
                {#if activeOperation === 'split'}✂️
                {:else if activeOperation === 'withdraw'}💸
                {/if}
              </span>
              <span>
                Execute {activeOperation.charAt(0).toUpperCase() + activeOperation.slice(1)}
              </span>
            {/if}
          </button>
        </div>
      {/if}
    {/if}
  </div>
</div>