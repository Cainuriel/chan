/**
 * UTXORecoveryService v2.0 - OPTIMIZADO
 * 
 * ELIMINADO: Scanning de bloques que causaba "RPC range limit exceeded"
 * AGREGADO: Queries directas usando user mappings del contrato
 * 
 * BENEFICIOS:
 * - O(1) recovery en lugar de O(n) scanning
 * - No más errores de RPC range limits
 * - Recovery instantáneo
 * - Funciona en Amoy/Alastria/cualquier red
 */

import { ethers } from 'ethers';

interface UTXOData {
    commitmentHash: string;
    tokenAddress: string;
    timestamp: number;
    isSpent: boolean;
    blockNumber?: number;
    owner: string;
}

interface ContractUTXODetails {
    exists: boolean;
    tokenAddress: string;
    timestamp: bigint;
    isSpent: boolean;
    parentUTXO: string;
    utxoType: number;
    blockNumber: bigint;
    owner: string;
}

export class OptimizedUTXORecoveryService {
    private provider: ethers.Provider;
    private contract: ethers.Contract;
    private userAddress: string;

    constructor(
        provider: ethers.Provider,
        contractAddress: string,
        contractABI: any[],
        userAddress: string
    ) {
        this.provider = provider;
        this.contract = new ethers.Contract(contractAddress, contractABI, provider);
        this.userAddress = userAddress;
    }

    /**
     * NUEVA FUNCIÓN: Recovery eficiente sin scanning
     * USA: getUserUnspentUTXOs() del contrato optimizado
     */
    async recoverUserUTXOs(): Promise<UTXOData[]> {
        try {
            console.log(`🔍 Recovering UTXOs for user ${this.userAddress} (OPTIMIZED)`);

            // ✅ Query directa - O(1) en lugar de scanning O(n)
            const result = await this.contract.getUserUnspentUTXOs(this.userAddress);
            
            const [commitments, tokens, timestamps] = result;
            
            const utxos: UTXOData[] = [];
            
            // Procesar resultados
            for (let i = 0; i < commitments.length; i++) {
                const utxo: UTXOData = {
                    commitmentHash: commitments[i],
                    tokenAddress: tokens[i],
                    timestamp: Number(timestamps[i]),
                    isSpent: false, // getUserUnspentUTXOs solo devuelve no gastados
                    owner: this.userAddress
                };
                
                utxos.push(utxo);
            }

            console.log(`✅ Recovered ${utxos.length} unspent UTXOs instantly`);
            
            return utxos;

        } catch (error) {
            console.error('❌ Error recovering UTXOs:', error);
            throw new Error(`UTXO recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Obtiene TODOS los UTXOs del usuario (gastados y no gastados)
     */
    async getAllUserUTXOs(): Promise<UTXOData[]> {
        try {
            console.log(`🔍 Getting ALL UTXOs for user ${this.userAddress}`);

            const result = await this.contract.getUserUTXOs(this.userAddress);
            const [commitments, spentStatus, tokens, timestamps] = result;
            
            const utxos: UTXOData[] = [];
            
            for (let i = 0; i < commitments.length; i++) {
                const utxo: UTXOData = {
                    commitmentHash: commitments[i],
                    tokenAddress: tokens[i],
                    timestamp: Number(timestamps[i]),
                    isSpent: spentStatus[i],
                    owner: this.userAddress
                };
                
                utxos.push(utxo);
            }

            console.log(`✅ Retrieved ${utxos.length} total UTXOs (${utxos.filter(u => !u.isSpent).length} unspent)`);
            
            return utxos;

        } catch (error) {
            console.error('❌ Error getting all UTXOs:', error);
            throw error;
        }
    }

    /**
     * Obtiene detalles completos de un UTXO específico
     */
    async getUTXODetails(commitmentHash: string): Promise<UTXOData | null> {
        try {
            const details: ContractUTXODetails = await this.contract.getUTXODetails(commitmentHash);
            
            if (!details.exists) {
                return null;
            }

            return {
                commitmentHash,
                tokenAddress: details.tokenAddress,
                timestamp: Number(details.timestamp),
                isSpent: details.isSpent,
                blockNumber: Number(details.blockNumber),
                owner: details.owner
            };

        } catch (error) {
            console.error('❌ Error getting UTXO details:', error);
            return null;
        }
    }

    /**
     * Verifica si un commitment pertenece al usuario actual
     */
    async isUserUTXO(commitmentHash: string): Promise<boolean> {
        try {
            return await this.contract.isUserUTXO(this.userAddress, commitmentHash);
        } catch (error) {
            console.error('❌ Error checking UTXO ownership:', error);
            return false;
        }
    }

    /**
     * Obtiene el número total de UTXOs del usuario
     */
    async getUserUTXOCount(): Promise<number> {
        try {
            const count = await this.contract.getUserUTXOCount(this.userAddress);
            return Number(count);
        } catch (error) {
            console.error('❌ Error getting UTXO count:', error);
            return 0;
        }
    }

    /**
     * Función de backup: Si por alguna razón las queries directas fallan,
     * puede usar eventos como fallback (SOLO para casos extremos)
     */
    async recoverFromEventsAsBackup(fromBlock: number = 0, maxBlocks: number = 1000): Promise<UTXOData[]> {
        console.warn('⚠️  Using event scanning as backup - this may hit RPC limits');
        
        try {
            const toBlock = Math.min(fromBlock + maxBlocks, await this.provider.getBlockNumber());
            
            console.log(`🔍 Scanning events from block ${fromBlock} to ${toBlock}`);

            // Obtener eventos con filtro limitado
            const filter = this.contract.filters.PrivateUTXOCreated(null, null, null);
            const events = await this.contract.queryFilter(filter, fromBlock, toBlock);
            
            const utxos: UTXOData[] = [];
            
            for (const event of events) {
                // Verificar que es un EventLog válido
                if ('args' in event && event.args) {
                    // Verificar si es del usuario actual
                    const isUserOwned = await this.isUserUTXO(event.args.commitmentHash);
                    
                    if (isUserOwned) {
                        const details = await this.getUTXODetails(event.args.commitmentHash);
                        if (details) {
                            utxos.push(details);
                        }
                    }
                }
            }

            console.log(`✅ Backup recovery found ${utxos.length} UTXOs in range ${fromBlock}-${toBlock}`);
            
            return utxos;

        } catch (error) {
            console.error('❌ Backup recovery failed:', error);
            throw error;
        }
    }
}

// Export para uso directo
export default OptimizedUTXORecoveryService;
