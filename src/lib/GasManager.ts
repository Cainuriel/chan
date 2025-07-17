/**
 * @fileoverview GasManager - Gestión inteligente de gas para diferentes redes
 * @description Maneja costes de gas de manera inteligente, evitando costes en redes gratuitas como Alastria
 */

import { ethers, type Provider } from 'ethers';

export interface NetworkGasConfig {
  requiresGas: boolean;
  defaultGasLimit?: bigint;
  defaultGasPrice?: bigint;
  gasMultiplier?: number; // Multiplicador para ajustar gas price
}

export interface GasOptions {
  gasLimit?: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

export class GasManager {
  private networkConfigs: Map<number, NetworkGasConfig> = new Map();

  constructor() {
    // Configuraciones por defecto para redes conocidas
    this.networkConfigs.set(80002, { // Polygon Amoy
      requiresGas: true,
      defaultGasLimit: BigInt(500000),
      defaultGasPrice: BigInt(30000000000), // 30 Gwei
      gasMultiplier: 1.2 // +20% para operaciones BN254
    });

    this.networkConfigs.set(2020, { // Alastria
      requiresGas: false // Red sin costes de gas
    });

    this.networkConfigs.set(137, { // Polygon Mainnet
      requiresGas: true,
      defaultGasLimit: BigInt(500000),
      defaultGasPrice: BigInt(50000000000), // 50 Gwei
      gasMultiplier: 1.5 // +50% para operaciones complejas
    });

    this.networkConfigs.set(1, { // Ethereum Mainnet
      requiresGas: true,
      defaultGasLimit: BigInt(500000),
      defaultGasPrice: BigInt(20000000000), // 20 Gwei
      gasMultiplier: 1.3 // +30% para asegurar procesamiento
    });
  }

  /**
   * Registra una nueva configuración de red
   */
  registerNetwork(chainId: number, config: NetworkGasConfig): void {
    this.networkConfigs.set(chainId, config);
    console.log(`⛽ Registered gas config for chain ${chainId}:`, config);
  }

  /**
   * Verifica si una red requiere gas
   */
  requiresGas(chainId: number): boolean {
    const config = this.networkConfigs.get(chainId);
    return config?.requiresGas ?? true; // Por defecto, asumir que requiere gas por seguridad
  }

  /**
   * Obtiene opciones de gas para una transacción
   */
  async getGasOptions(
    chainId: number, 
    provider?: Provider, 
    operation: 'deposit' | 'transfer' | 'split' | 'withdraw' | 'default' = 'default'
  ): Promise<GasOptions | null> {
    
    const config = this.networkConfigs.get(chainId);
    
    // Si la red no requiere gas, retornar null
    if (!config?.requiresGas) {
      console.log(`⛽ Chain ${chainId} is gas-free, skipping gas calculations`);
      return null;
    }

    console.log(`⛽ Calculating gas for chain ${chainId}, operation: ${operation}`);

    try {
      const gasOptions: GasOptions = {};

      // Establecer gas limit base según la operación
      gasOptions.gasLimit = this.getGasLimitForOperation(operation, config);

      // Si hay provider, intentar obtener datos de gas actuales
      if (provider) {
        const feeData = await provider.getFeeData();
        console.log(`⛽ Current fee data:`, {
          gasPrice: feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') + ' gwei' : 'N/A',
          maxFeePerGas: feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei') + ' gwei' : 'N/A',
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') + ' gwei' : 'N/A'
        });

        // Usar EIP-1559 si está disponible
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          gasOptions.maxFeePerGas = this.applyMultiplier(feeData.maxFeePerGas, config.gasMultiplier);
          gasOptions.maxPriorityFeePerGas = this.applyMultiplier(feeData.maxPriorityFeePerGas, config.gasMultiplier);
          console.log(`⛽ Using EIP-1559 pricing with ${config.gasMultiplier}x multiplier`);
        } 
        // Fallback a legacy gas pricing
        else if (feeData.gasPrice) {
          gasOptions.gasPrice = this.applyMultiplier(feeData.gasPrice, config.gasMultiplier);
          console.log(`⛽ Using legacy gas pricing with ${config.gasMultiplier}x multiplier`);
        }
        // Último fallback: usar configuración por defecto
        else {
          gasOptions.gasPrice = config.defaultGasPrice || BigInt(20000000000); // 20 Gwei
          console.log(`⛽ Using default gas price fallback`);
        }
      } 
      // Sin provider, usar valores por defecto
      else {
        gasOptions.gasPrice = config.defaultGasPrice || BigInt(20000000000);
        console.log(`⛽ Using default config (no provider)`);
      }

      console.log(`⛽ Final gas options:`, {
        gasLimit: gasOptions.gasLimit?.toString(),
        gasPrice: gasOptions.gasPrice ? ethers.formatUnits(gasOptions.gasPrice, 'gwei') + ' gwei' : 'N/A',
        maxFeePerGas: gasOptions.maxFeePerGas ? ethers.formatUnits(gasOptions.maxFeePerGas, 'gwei') + ' gwei' : 'N/A',
        maxPriorityFeePerGas: gasOptions.maxPriorityFeePerGas ? ethers.formatUnits(gasOptions.maxPriorityFeePerGas, 'gwei') + ' gwei' : 'N/A'
      });

      return gasOptions;

    } catch (error: any) {
      console.warn(`⚠️ Failed to get gas options for chain ${chainId}:`, error.message);
      
      // Fallback seguro
      return {
        gasLimit: config.defaultGasLimit || BigInt(500000),
        gasPrice: config.defaultGasPrice || BigInt(20000000000)
      };
    }
  }

  /**
   * Aplica gas options a parámetros de transacción
   */
  async applyGasToTransaction(
    txParams: any, 
    chainId: number, 
    provider?: Provider, 
    operation: 'deposit' | 'transfer' | 'split' | 'withdraw' | 'default' = 'default'
  ): Promise<any> {
    
    if (!this.requiresGas(chainId)) {
      console.log(`⛽ Chain ${chainId} is gas-free, returning transaction params unchanged`);
      return txParams;
    }

    const gasOptions = await this.getGasOptions(chainId, provider, operation);
    
    if (gasOptions) {
      return { ...txParams, ...gasOptions };
    }

    return txParams;
  }

  /**
   * Obtiene gas limit apropiado según la operación
   */
  private getGasLimitForOperation(operation: string, config: NetworkGasConfig): bigint {
    const baseLimit = config.defaultGasLimit || BigInt(500000);
    
    switch (operation) {
      case 'deposit':
        return baseLimit; // Depósitos son relativamente simples
      case 'transfer':
        return baseLimit + BigInt(100000); // Transferencias requieren más gas
      case 'split':
        return baseLimit + BigInt(200000); // Split es más complejo
      case 'withdraw':
        return baseLimit + BigInt(150000); // Withdraw requiere validaciones extra
      default:
        return baseLimit;
    }
  }

  /**
   * Aplica multiplicador a un valor de gas
   */
  private applyMultiplier(gasValue: bigint, multiplier?: number): bigint {
    if (!multiplier || multiplier === 1) return gasValue;
    
    const multiplierBigInt = BigInt(Math.floor(multiplier * 100));
    return gasValue * multiplierBigInt / 100n;
  }

  /**
   * Estima costo de transacción (solo para redes con gas)
   */
  async estimateTransactionCost(
    chainId: number,
    gasLimit: bigint,
    provider?: Provider
  ): Promise<{ cost: bigint; costInEth: string; gasPrice: bigint } | null> {
    
    if (!this.requiresGas(chainId)) {
      return null; // Sin costo para redes gratuitas
    }

    try {
      const gasOptions = await this.getGasOptions(chainId, provider);
      if (!gasOptions) return null;

      const effectiveGasPrice = gasOptions.gasPrice || gasOptions.maxFeePerGas || BigInt(0);
      const cost = gasLimit * effectiveGasPrice;

      return {
        cost,
        costInEth: ethers.formatEther(cost),
        gasPrice: effectiveGasPrice
      };

    } catch (error: any) {
      console.warn(`⚠️ Failed to estimate transaction cost:`, error.message);
      return null;
    }
  }

  /**
   * Debug: Muestra configuración actual
   */
  debugConfiguration(): void {
    console.log('⛽ === GAS MANAGER CONFIGURATION ===');
    for (const [chainId, config] of this.networkConfigs.entries()) {
      console.log(`Chain ${chainId}:`, {
        requiresGas: config.requiresGas,
        defaultGasLimit: config.defaultGasLimit?.toString(),
        defaultGasPrice: config.defaultGasPrice ? ethers.formatUnits(config.defaultGasPrice, 'gwei') + ' gwei' : 'N/A',
        gasMultiplier: config.gasMultiplier || 1
      });
    }
  }
}

// Instancia singleton del GasManager
export const gasManager = new GasManager();
