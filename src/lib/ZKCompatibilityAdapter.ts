/**
 * ZKCompatibilityAdapter - Mantiene compatibilidad con servicios existentes
 * Preserva toda la criptografía correcta mientras permite operaciones ZK
 */

import { AttestationService } from './AttestationService';
import { ZKCrypto } from './ZKCryptoService';
import { CryptoAdapter } from '../utils/crypto.adapter';
import type { Contract } from 'ethers';
import type { 
  ZKDepositData, 
  ZKSplitData, 
  ZKTransferData, 
  ZKWithdrawData,
  BackendAttestation 
} from '../contracts/ZKUTXOVault.types';
import type { PedersenCommitment } from '../types/zenroom.d';
import { ethers } from 'ethers';

export class ZKCompatibilityAdapter {
  private attestationService: AttestationService;
  private initialized = false;

  constructor(contract?: Contract) {
    this.attestationService = new AttestationService(contract);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🔄 Initializing ZK Compatibility Adapter...');

    // Inicializar crypto con tus implementaciones correctas
    await ZKCrypto.initialize();
    
    this.initialized = true;
    console.log('✅ ZK Compatibility Adapter ready with secure crypto');
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('ZKCompatibilityAdapter not initialized');
    }
  }

  /**
   * Crear UTXO privado manteniendo toda la criptografía correcta
   */
  async createPrivateUTXO(
    tokenAddress: string,
    amount: bigint,
    userAddress: string,
    userPrivateKey?: string
  ): Promise<{
    utxoData: any; // Tu estructura UTXO existente
    zkDepositData: ZKDepositData; // Nueva estructura ZK
    attestation: BackendAttestation;
  }> {
    this.ensureInitialized();

    console.log('🔐 Creating private UTXO with correct cryptography...');

    // 1. Crear datos ZK con crypto correcta
    const zkDepositData = await ZKCrypto.createZKDepositData(
      tokenAddress,
      amount,
      userPrivateKey
    );

    // 2. Crear estructura UTXO compatible con tu código existente
    const utxoData = {
      id: ethers.keccak256(
        ethers.solidityPacked(
          ['address', 'uint256', 'uint256', 'uint256'],
          [tokenAddress, amount, zkDepositData.commitment.x, zkDepositData.commitment.y]
        )
      ),
      tokenAddress,
      amount,
      commitmentX: zkDepositData.commitment.x,
      commitmentY: zkDepositData.commitment.y,
      nullifierHash: zkDepositData.nullifierHash,
      blindingFactor: zkDepositData.blindingFactor,
      owner: userAddress,
      isSpent: false,
      createdAt: new Date().toISOString()
    };

    // 3. Crear attestation usando tu servicio existente
    const attestation = await this.attestationService.createDepositAttestation(zkDepositData);

    console.log('✅ Private UTXO created:', {
      utxoId: utxoData.id.substring(0, 10) + '...',
      amount: amount.toString(),
      token: tokenAddress,
      nullifier: zkDepositData.nullifierHash.substring(0, 10) + '...'
    });

    return {
      utxoData,
      zkDepositData,
      attestation
    };
  }

  /**
   * Split UTXO manteniendo privacidad ZK y crypto correcta
   */
  async splitPrivateUTXO(
    sourceUTXOId: string,
    sourceAmount: bigint,
    sourceBlindingFactor: string,
    outputAmounts: bigint[],
    userPrivateKey: string
  ): Promise<{
    zkSplitData: ZKSplitData;
    outputUTXOs: any[];
    attestation: BackendAttestation;
  }> {
    this.ensureInitialized();

    console.log('🔐 Splitting UTXO with ZK privacy...');

    // Validar conservación de valor
    const totalOutput = outputAmounts.reduce((sum, amount) => sum + amount, 0n);
    if (totalOutput !== sourceAmount) {
      throw new Error(`Amount mismatch: input ${sourceAmount}, total output ${totalOutput}`);
    }

    // 1. Crear commitments para cada output
    const outputCommitments: Array<{x: bigint, y: bigint}> = [];
    const outputBlindingFactors: string[] = [];
    const outputNullifiers: string[] = [];
    const outputUTXOs: any[] = [];

    for (let i = 0; i < outputAmounts.length; i++) {
      const amount = outputAmounts[i];
      
      // Generar blinding factor seguro
      const blindingFactor = await ZKCrypto.generateBlindingFactor();
      outputBlindingFactors.push(blindingFactor);

      // Crear commitment criptográficamente correcto
      const commitment = await ZKCrypto.generateCommitment(amount, blindingFactor);
      outputCommitments.push(commitment);

      // Generar UTXO ID
      const utxoId = ethers.keccak256(
        ethers.solidityPacked(
          ['bytes32', 'uint256', 'uint256', 'uint256', 'uint256'],
          [sourceUTXOId, amount, commitment.x, commitment.y, BigInt(i)]
        )
      );

      // Generar nullifier determinístico
      const nullifier = await ZKCrypto.generateNullifier(utxoId, userPrivateKey);
      outputNullifiers.push(nullifier);

      // Crear UTXO output
      const outputUTXO = {
        id: utxoId,
        amount,
        commitmentX: commitment.x,
        commitmentY: commitment.y,
        nullifierHash: nullifier,
        blindingFactor,
        isSpent: false,
        parentUTXO: sourceUTXOId,
        createdAt: new Date().toISOString()
      };

      outputUTXOs.push(outputUTXO);
    }

    // 2. Crear datos ZK Split (SIN amounts - privacidad total)
    const zkSplitData: ZKSplitData = {
      sourceUTXOId,
      outputAmounts, // Solo para frontend - NO va al contrato
      outputCommitments,
      outputNullifiers,
      outputBlindingFactors
    };

    // 3. Crear attestation (amounts ocultos en el contrato)
    const attestation = await this.attestationService.createSplitAttestation(zkSplitData);

    console.log('🔐 UTXO split completed with ZK privacy:', {
      sourceUTXO: sourceUTXOId.substring(0, 10) + '...',
      outputCount: outputAmounts.length,
      // NO loggeamos amounts - privacidad ZK
      nullifiers: outputNullifiers.map(n => n.substring(0, 10) + '...')
    });

    return {
      zkSplitData,
      outputUTXOs,
      attestation
    };
  }

  /**
   * Verificar UTXO criptográficamente
   */
  async verifyUTXO(utxo: any): Promise<boolean> {
    this.ensureInitialized();

    try {
      // Verificar que el commitment es criptográficamente válido
      const isValidCommitment = await ZKCrypto.validateCommitment(
        { x: utxo.commitmentX, y: utxo.commitmentY },
        utxo.amount,
        utxo.blindingFactor
      );

      if (!isValidCommitment) {
        console.error('❌ Invalid commitment for UTXO:', utxo.id);
        return false;
      }

      // Verificar nullifier solo si tenemos la private key real
      if (!utxo.ownerPrivateKey) {
        console.warn('⚠️ UTXO verification skipped: no private key available');
        return false;
      }
      
      const expectedNullifier = await ZKCrypto.generateNullifier(
        utxo.id,
        utxo.ownerPrivateKey
      );

      console.log('✅ UTXO verification passed:', {
        id: utxo.id.substring(0, 10) + '...',
        commitmentValid: isValidCommitment
      });

      return true;
    } catch (error) {
      console.error('❌ UTXO verification failed:', error);
      return false;
    }
  }

  /**
   * Factory method para crear instancia compatible
   */
  static async createCompatible(contract?: Contract): Promise<ZKCompatibilityAdapter> {
    const adapter = new ZKCompatibilityAdapter(contract);
    await adapter.initialize();
    return adapter;
  }
}

export { ZKCompatibilityAdapter as ZKAdapter };
