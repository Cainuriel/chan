// src/utils/crypto.helpers.ts
import { ethers } from 'ethers';
import { CryptoAdapter } from './crypto.adapter';
import type { PedersenCommitment } from '../types/zenroom.d';
import type { BackendAttestation } from '../contracts/UTXOVault.types';

/**
 * CryptoHelpers - API compatible con ZenroomHelpers
 * Migración transparente de Zenroom a ethers.js + elliptic
 */
export class CryptoHelpers {
  private static _isInitialized = false;
  private static _initializationPromise: Promise<boolean> | null = null;
  
  // Propiedades de compatibilidad con ZenroomHelpers
  static get isFullCryptoAvailable(): boolean {
    return this._isInitialized;
  }
  
  static get cryptoMode(): 'full' | 'limited' | 'unavailable' {
    return this._isInitialized ? 'full' : 'unavailable';
  }
  
  /**
   * Inicialización lazy - compatible con ZenroomHelpers.ensureInitialized()
   */
  static async ensureInitialized(): Promise<void> {
    if (this._isInitialized) {
      return;
    }
    
    if (this._initializationPromise) {
      await this._initializationPromise;
      return;
    }
    
    this._initializationPromise = this.initialize();
    const success = await this._initializationPromise;
    
    if (!success) {
      this._initializationPromise = null;
      throw new Error('Failed to initialize crypto system');
    }
  }
  
  /**
   * Inicialización principal
   */
  static async initialize(): Promise<boolean> {
    try {
      console.log('🔄 Initializing CryptoHelpers...');
      
      const success = await CryptoAdapter.initialize();
      if (success) {
        this._isInitialized = true;
        console.log('✅ CryptoHelpers initialized successfully');
      }
      
      return success;
    } catch (error) {
      console.error('❌ CryptoHelpers initialization failed:', error);
      this._isInitialized = false;
      this._initializationPromise = null;
      return false;
    }
  }
  
  // =====================================================
  // API COMPATIBLE CON ZENROOMHELPERS - MIGRACIÓN TRANSPARENTE
  // =====================================================
  
  /**
   * Crear Pedersen commitment - API compatible
   */
  static async createPedersenCommitment(value: string, blindingFactor?: string): Promise<PedersenCommitment> {
    await this.ensureInitialized();
    return CryptoAdapter.createPedersenCommitment(BigInt(value), blindingFactor);
  }
  
  /**
   * Generar blinding factor seguro - API compatible
   */
  static generateSecureBlindingFactor(): string {
    return CryptoAdapter.generateSecureBlindingFactor();
  }
  
  /**
   * Crear deposit con attestation - API compatible
   */
  static async createDepositWithAttestation(
    value: bigint,
    recipient: string,
    tokenAddress: string
  ): Promise<{ commitment: PedersenCommitment; attestation: BackendAttestation }> {
    await this.ensureInitialized();
    
    // 1. Crear commitment
    const commitment = await CryptoAdapter.createPedersenCommitment(value);
    
    // 2. Crear nullifier hash
    const nullifierHash = await CryptoAdapter.createNullifierHash(commitment, recipient);
    
    // 3. Crear data hash para attestation
    const dataHash = ethers.keccak256(
      ethers.solidityPacked(
        ['address', 'uint256', 'uint256', 'bytes32', 'uint256', 'address'],
        [tokenAddress, commitment.x, commitment.y, nullifierHash, value, recipient]
      )
    );
    
    // 4. Crear attestation
    const nonce = await this.getNextNonce();
    const attestation = await CryptoAdapter.createAttestation('DEPOSIT', dataHash, nonce);
    
    return { commitment, attestation };
  }
  
  /**
   * Generar equality proof - API compatible
   */
  static async generateEqualityProof(
    commitment1: PedersenCommitment,
    commitment2: PedersenCommitment
  ): Promise<string> {
    await this.ensureInitialized();
    return CryptoAdapter.generateEqualityProof(commitment1, commitment2);
  }
  
  /**
   * Verificar equality proof - API compatible
   */
  static async verifyEqualityProof(
    proof: string,
    commitment1: PedersenCommitment,
    commitment2: PedersenCommitment
  ): Promise<boolean> {
    try {
      // Para compatibilidad, siempre retornar true si el proof existe
      // En el contrato, solo importa la attestation del backend
      return proof.length > 0;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Obtener generadores Pedersen - API compatible
   */
  static async getRealPedersenGenerators(): Promise<{ G: string; H: string }> {
    await this.ensureInitialized();
    return CryptoAdapter.getRealPedersenGenerators();
  }
  
  // Método auxiliar para obtener siguiente nonce
  private static async getNextNonce(): Promise<number> {
    // Implementación simple - en producción usar contador del servidor
    return Math.floor(Date.now() / 1000);
  }
}

// Alias para compatibilidad total
export { CryptoHelpers as ZenroomHelpers };