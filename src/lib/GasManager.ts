/**
 * @fileoverview GasManager - Gestión inteligente de gas para diferentes redes
 * @description Maneja costes de gas de manera inteligente, evitando costes en redes gratuitas como Alastria
 * @version 2.0 - Con soporte para operaciones ZK (Zero-Knowledge)
 */

import { ethers, type Provider } from 'ethers';

export interface NetworkGasConfig {
  requiresGas: boolean;
  defaultGasLimit?: bigint;
  defaultGasPrice?: bigint;
  gasMultiplier?: number; // Multiplicador para operaciones ZK (todas son ZK)
  zkOptimized?: boolean; // ✅ NUEVO: Indica si la red está optimizada para ZK
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
    // ✅ TODAS las configuraciones son para operaciones ZK-private
    this.networkConfigs.set(80002, { // Polygon Amoy
      requiresGas: true,
      defaultGasLimit: BigInt(400000), // ✅ Optimizado para ZK (menos gas que legacy)
      defaultGasPrice: BigInt(30000000000), // 30 Gwei
      gasMultiplier: 1.1, // ✅ Solo +10% porque ZK es más eficiente
      zkOptimized: true
    });

    this.networkConfigs.set(2020, { // Alastria
      requiresGas: false, // Red sin costes de gas
      zkOptimized: true // ✅ Optimizada para ZK
    });

    this.networkConfigs.set(137, { // Polygon Mainnet
      requiresGas: true,
      defaultGasLimit: BigInt(400000), // ✅ ZK-optimized
      defaultGasPrice: BigInt(50000000000), // 50 Gwei
      gasMultiplier: 1.2, // ✅ +20% para ZK en mainnet
      zkOptimized: true
    });

    this.networkConfigs.set(1, { // Ethereum Mainnet
      requiresGas: true,
      defaultGasLimit: BigInt(450000), // ✅ Más gas para ZK en Ethereum
      defaultGasPrice: BigInt(20000000000), // 20 Gwei
      gasMultiplier: 1.3, // ✅ +30% para ZK en Ethereum
      zkOptimized: false // Ethereum no está optimizado para ZK
    });
  }

  /**
   * Registra una nueva configuración de red ZK
   */
  registerNetwork(chainId: number, config: NetworkGasConfig): void {
    this.networkConfigs.set(chainId, config);
    console.log(`🔐 Registered ZK gas config for chain ${chainId}:`, config);
  }

  /**
   * Verifica si una red requiere gas
   */
  requiresGas(chainId: number): boolean {
    const config = this.networkConfigs.get(chainId);
    return config?.requiresGas ?? true; // Por defecto, asumir que requiere gas por seguridad
  }

  /**
   * ✅ Obtiene opciones de gas para operaciones ZK-private
   * @notice TODAS las operaciones son ZK por defecto
   */
  async getGasOptions(
    chainId: number, 
    provider?: Provider, 
    operation: 'deposit' | 'transfer' | 'split' | 'withdraw' | 'default' = 'default'
  ): Promise<GasOptions | null> {
    
    const config = this.networkConfigs.get(chainId);
    
    // Si la red no requiere gas, retornar null
    if (!config?.requiresGas) {
      console.log(`🔐 Chain ${chainId} is gas-free ZK network, skipping gas calculations`);
      return null;
    }

    console.log(`🔐 Calculating ZK-private gas for chain ${chainId}, operation: ${operation}`);

    try {
      const gasOptions: GasOptions = {};

      // ✅ Establecer gas limit optimizado para ZK
      gasOptions.gasLimit = this.getZKGasLimitForOperation(operation, config);

      // Si hay provider, intentar obtener datos de gas actuales
      if (provider) {
        const feeData = await provider.getFeeData();
        console.log(`🔐 Current ZK fee data:`, {
          gasPrice: feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') + ' gwei' : 'N/A',
          maxFeePerGas: feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei') + ' gwei' : 'N/A',
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') + ' gwei' : 'N/A'
        });

        // Usar EIP-1559 si está disponible
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          gasOptions.maxFeePerGas = this.applyMultiplier(feeData.maxFeePerGas, config.gasMultiplier);
          gasOptions.maxPriorityFeePerGas = this.applyMultiplier(feeData.maxPriorityFeePerGas, config.gasMultiplier);
          console.log(`🔐 Using EIP-1559 ZK pricing with ${config.gasMultiplier}x multiplier`);
        } 
        // Fallback a legacy gas pricing
        else if (feeData.gasPrice) {
          gasOptions.gasPrice = this.applyMultiplier(feeData.gasPrice, config.gasMultiplier);
          console.log(`🔐 Using legacy ZK gas pricing with ${config.gasMultiplier}x multiplier`);
        }
        // Último fallback: usar configuración por defecto
        else {
          gasOptions.gasPrice = config.defaultGasPrice || BigInt(20000000000); // 20 Gwei
          console.log(`🔐 Using default ZK gas price fallback`);
        }
      } 
      // Sin provider, usar valores por defecto
      else {
        gasOptions.gasPrice = config.defaultGasPrice || BigInt(20000000000);
        console.log(`🔐 Using default ZK config (no provider)`);
      }

      console.log(`🔐 Final ZK gas options:`, {
        gasLimit: gasOptions.gasLimit?.toString(),
        gasPrice: gasOptions.gasPrice ? ethers.formatUnits(gasOptions.gasPrice, 'gwei') + ' gwei' : 'N/A',
        maxFeePerGas: gasOptions.maxFeePerGas ? ethers.formatUnits(gasOptions.maxFeePerGas, 'gwei') + ' gwei' : 'N/A',
        maxPriorityFeePerGas: gasOptions.maxPriorityFeePerGas ? ethers.formatUnits(gasOptions.maxPriorityFeePerGas, 'gwei') + ' gwei' : 'N/A'
      });

      return gasOptions;

    } catch (error: any) {
      console.warn(`⚠️ Failed to get ZK gas options for chain ${chainId}:`, error.message);
      
      // Fallback seguro para ZK
      return {
        gasLimit: config.defaultGasLimit || BigInt(400000), // ✅ ZK-optimized fallback
        gasPrice: config.defaultGasPrice || BigInt(20000000000)
      };
    }
  }

  /**
   * ✅ Aplica gas options ZK a parámetros de transacción
   */
  async applyGasToTransaction(
    txParams: any, 
    chainId: number, 
    provider?: Provider, 
    operation: 'deposit' | 'transfer' | 'split' | 'withdraw' | 'default' = 'default'
  ): Promise<any> {
    
    if (!this.requiresGas(chainId)) {
      console.log(`🔐 Chain ${chainId} is gas-free ZK network, returning transaction params unchanged`);
      return txParams;
    }

    const gasOptions = await this.getGasOptions(chainId, provider, operation);
    
    if (gasOptions) {
      console.log(`🔐 Applied ZK gas options for ${operation} operation`);
      return { ...txParams, ...gasOptions };
    }

    return txParams;
  }

  /**
   * ✅ Obtiene gas limit apropiado para operaciones ZK-private
   * @notice Todas las operaciones usan arquitectura ZK simplificada
   */
  private getZKGasLimitForOperation(operation: string, config: NetworkGasConfig): bigint {
    const baseLimit = config.defaultGasLimit || BigInt(400000); // ✅ Base ZK-optimized
    
    switch (operation) {
      case 'deposit':
        // ✅ ZK Deposit: Amount visible, crear UTXO privado
        return baseLimit; // Base limit suficiente
      case 'transfer':
        // ✅ ZK Transfer: Amount OCULTO, solo nullifiers
        return baseLimit - BigInt(50000); // ✅ 50k menos gas (más eficiente)
      case 'split':
        // ✅ ZK Split: Amounts OCULTOS, múltiples outputs
        return baseLimit + BigInt(50000); // ✅ 50k más gas (múltiples outputs)
      case 'withdraw':
        // ✅ ZK Withdraw: Amount visible, salir del sistema
        return baseLimit + BigInt(25000); // ✅ 25k más gas (transfer externo)
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
    return gasValue * multiplierBigInt / BigInt(100);
  }

  /**
   * ✅ Estima costo de transacción ZK (solo para redes con gas)
   */
  async estimateZKTransactionCost(
    chainId: number,
    gasLimit: bigint,
    operation: 'deposit' | 'transfer' | 'split' | 'withdraw',
    provider?: Provider
  ): Promise<{ cost: bigint; costInEth: string; gasPrice: bigint; zkOptimized: boolean } | null> {
    
    if (!this.requiresGas(chainId)) {
      return null; // Sin costo para redes ZK gratuitas
    }

    try {
      const config = this.networkConfigs.get(chainId);
      const gasOptions = await this.getGasOptions(chainId, provider, operation);
      if (!gasOptions) return null;

      const effectiveGasPrice = gasOptions.gasPrice || gasOptions.maxFeePerGas || BigInt(0);
      const cost = gasLimit * effectiveGasPrice;

      console.log(`🔐 ZK ${operation} estimated cost:`, {
        gasLimit: gasLimit.toString(),
        gasPrice: ethers.formatUnits(effectiveGasPrice, 'gwei') + ' gwei',
        cost: ethers.formatEther(cost) + ' ETH',
        zkOptimized: config?.zkOptimized || false
      });

      return {
        cost,
        costInEth: ethers.formatEther(cost),
        gasPrice: effectiveGasPrice,
        zkOptimized: config?.zkOptimized || false
      };

    } catch (error: any) {
      console.warn(`⚠️ Failed to estimate ZK transaction cost:`, error.message);
      return null;
    }
  }

  /**
   * ✅ Debug: Muestra configuración ZK actual
   */
  debugZKConfiguration(): void {
    console.log('🔐 === ZK GAS MANAGER CONFIGURATION ===');
    this.networkConfigs.forEach((config, chainId) => {
      console.log(`Chain ${chainId} (ZK-enabled):`, {
        requiresGas: config.requiresGas,
        zkOptimized: config.zkOptimized || false,
        defaultGasLimit: config.defaultGasLimit?.toString(),
        defaultGasPrice: config.defaultGasPrice ? ethers.formatUnits(config.defaultGasPrice, 'gwei') + ' gwei' : 'N/A',
        gasMultiplier: config.gasMultiplier || 1,
        benefits: this.getZKBenefits(config)
      });
    });
  }

  /**
   * ✅ Obtiene beneficios de ZK para una configuración
   */
  private getZKBenefits(config: NetworkGasConfig): string[] {
    const benefits = ['Private amounts in transfers/splits'];
    
    if (!config.requiresGas) {
      benefits.push('Gas-free operations');
    }
    
    if (config.zkOptimized) {
      benefits.push('ZK-optimized infrastructure');
    }
    
    if ((config.gasMultiplier || 1) <= 1.2) {
      benefits.push('Low gas overhead for ZK proofs');
    }
    
    return benefits;
  }
}

// Instancia singleton del GasManager
export const gasManager = new GasManager();
