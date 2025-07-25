/**
 * ZKCryptoService - Wrapper ZK que preserva toda la criptografía correcta existente
 * Utiliza CryptoAdapter y EthersCryptoProvider para mantener seguridad criptográfica
 */

import { CryptoAdapter } from '../utils/crypto.adapter';
import type { ZKCryptoService, ZKDepositData, ZKSplitData, ZKTransferData, ZKWithdrawData } from '../contracts/ZKUTXOVault.types';
import type { PedersenCommitment } from '../types/zenroom.d';
import { ethers } from 'ethers';

export class ZKCryptoServiceImpl implements ZKCryptoService {
  private static instance: ZKCryptoServiceImpl;
  private initialized = false;

  private constructor() {}

  static getInstance(): ZKCryptoServiceImpl {
    if (!ZKCryptoServiceImpl.instance) {
      ZKCryptoServiceImpl.instance = new ZKCryptoServiceImpl();
    }
    return ZKCryptoServiceImpl.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🔐 Initializing ZKCryptoService...');
    
    // Usar tu CryptoAdapter existente (que ya es criptográficamente correcto)
    const success = await CryptoAdapter.initialize();
    if (!success) {
      throw new Error('Failed to initialize crypto provider');
    }

    this.initialized = true;
    console.log('✅ ZKCryptoService initialized with secure crypto');
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('ZKCryptoService not initialized. Call initialize() first.');
    }
  }

  /**
   * Generar commitment usando tu crypto correcta existente
   */
  async generateCommitment(value: bigint, blindingFactor: string): Promise<{x: bigint, y: bigint}> {
    this.ensureInitialized();

    console.log('🔐 Generating cryptographically correct Pedersen commitment...');
    
    // Usar tu implementación existente de Pedersen commitments
    const commitment = await CryptoAdapter.createPedersenCommitment(value, blindingFactor);
    
    console.log('✅ Commitment generated:', {
      value: value.toString(),
      blindingFactor: blindingFactor.substring(0, 10) + '...',
      x: commitment.x.toString(),
      y: commitment.y.toString()
    });

    return {
      x: commitment.x,
      y: commitment.y
    };
  }

  /**
   * Generar nullifier usando tu crypto correcta existente
   */
  async generateNullifier(utxoId: string, privateKey: string): Promise<string> {
    this.ensureInitialized();

    console.log('🔐 Generating cryptographically correct nullifier...');
    
    // Para ZK, el nullifier debe ser determinístico pero único
    // Usar tu método existente pero adaptado para UTXO ID
    const nullifier = ethers.keccak256(
      ethers.solidityPacked(
        ['bytes32', 'bytes32'],
        [utxoId, ethers.keccak256(privateKey)]
      )
    );

    console.log('✅ Nullifier generated:', {
      utxoId: utxoId.substring(0, 10) + '...',
      nullifier: nullifier.substring(0, 10) + '...'
    });

    return nullifier;
  }

  /**
   * Generar blinding factor usando tu crypto segura existente
   */
  async generateBlindingFactor(): Promise<string> {
    this.ensureInitialized();

    // Usar tu generador seguro existente
    const blindingFactor = CryptoAdapter.generateSecureBlindingFactor();
    
    console.log('🔐 Secure blinding factor generated:', blindingFactor.substring(0, 10) + '...');
    
    return blindingFactor;
  }

  /**
   * Crear datos de depósito ZK manteniendo criptografía correcta
   */
  async createZKDepositData(
    tokenAddress: string,
    amount: bigint,
    userPrivateKey?: string
  ): Promise<ZKDepositData> {
    this.ensureInitialized();

    console.log('🔐 Creating ZK deposit data with correct cryptography...');

    // 1. Generar blinding factor seguro
    const blindingFactor = await this.generateBlindingFactor();

    // 2. Crear commitment criptográficamente correcto
    const commitment = await this.generateCommitment(amount, blindingFactor);

    // 3. Generar UTXO ID único y determinístico
    const utxoId = ethers.keccak256(
      ethers.solidityPacked(
        ['address', 'uint256', 'uint256', 'uint256', 'string'],
        [tokenAddress, amount, commitment.x, commitment.y, 'utxo_id_salt']
      )
    );

    // 4. Generar nullifier determinístico
    const privateKey = userPrivateKey || ethers.randomBytes(32);
    const nullifierHash = await this.generateNullifier(utxoId, ethers.hexlify(privateKey));

    const zkDepositData: ZKDepositData = {
      tokenAddress,
      amount,
      commitment,
      nullifierHash,
      blindingFactor
    };

    console.log('✅ ZK deposit data created with correct crypto:', {
      token: tokenAddress,
      amount: amount.toString(),
      commitmentX: commitment.x.toString(),
      commitmentY: commitment.y.toString(),
      nullifier: nullifierHash.substring(0, 10) + '...'
    });

    return zkDepositData;
  }

  /**
   * Validar commitment criptográficamente
   */
  async validateCommitment(
    commitment: {x: bigint, y: bigint},
    value: bigint,
    blindingFactor: string
  ): Promise<boolean> {
    this.ensureInitialized();

    try {
      // Recalcular commitment con los mismos parámetros
      const recalculated = await this.generateCommitment(value, blindingFactor);
      
      // Verificar que coinciden
      const isValid = recalculated.x === commitment.x && recalculated.y === commitment.y;
      
      console.log('🔍 Commitment validation:', {
        original: { x: commitment.x.toString(), y: commitment.y.toString() },
        recalculated: { x: recalculated.x.toString(), y: recalculated.y.toString() },
        isValid
      });

      return isValid;
    } catch (error) {
      console.error('❌ Commitment validation failed:', error);
      return false;
    }
  }

  /**
   * Obtener generadores de curva (para debugging/verificación)
   */
  async getCurveGenerators(): Promise<{ G: string; H: string }> {
    this.ensureInitialized();
    return CryptoAdapter.getRealPedersenGenerators();
  }
}

// Export singleton instance
export const ZKCrypto = ZKCryptoServiceImpl.getInstance();
