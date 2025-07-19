// src/utils/crypto.adapter.ts
import type { CryptoProvider, CryptoMode } from './crypto.types';
import type { PedersenCommitment } from '../types/zenroom.d';
import type { BackendAttestation } from '../contracts/UTXOVault.types';
import { EthersCryptoProvider } from './providers/ethers.provider.js';

export class CryptoAdapter {
  private static currentProvider: CryptoProvider;
  private static availableProviders: Map<string, CryptoProvider> = new Map();
  
  static async initialize(): Promise<boolean> {
    console.log('🔄 Initializing CryptoAdapter...');
    
    // Detectar providers disponibles
    await this.detectAvailableProviders();
    
    // Seleccionar el mejor provider
    const bestProvider = this.selectBestProvider();
    if (!bestProvider) {
      console.error('❌ No crypto providers available');
      return false;
    }
    
    this.currentProvider = bestProvider;
    const success = await this.currentProvider.initialize();
    
    console.log(`✅ CryptoAdapter initialized with ${this.getProviderName()}`);
    return success;
  }
  
  private static async detectAvailableProviders(): Promise<void> {
    // Test ethers.js provider (solo este por ahora)
    try {
      const ethersProvider = new EthersCryptoProvider();
      await ethersProvider.initialize();
      this.availableProviders.set('ethers', ethersProvider);
      console.log('✅ Ethers.js provider available');
    } catch (error) {
      console.warn('⚠️ Ethers.js provider failed:', error);
    }
  }
  
  private static selectBestProvider(): CryptoProvider | null {
    // Prioridad: ethers por ahora
    const priority = ['ethers'];
    
    for (const name of priority) {
      const provider = this.availableProviders.get(name);
      if (provider) {
        console.log(`🎯 Selected ${name} as crypto provider`);
        return provider;
      }
    }
    
    return null;
  }
  
  private static getProviderName(): string {
    for (const [name, provider] of this.availableProviders.entries()) {
      if (provider === this.currentProvider) {
        return name;
      }
    }
    return 'unknown';
  }
  
  // Métodos proxy que delegan al provider actual
  static async createPedersenCommitment(value: bigint, blindingFactor?: string): Promise<PedersenCommitment> {
    return this.currentProvider.createPedersenCommitment(value, blindingFactor);
  }
  
  static async createNullifierHash(commitment: PedersenCommitment, owner: string): Promise<string> {
    return this.currentProvider.createNullifierHash(commitment, owner);
  }
  
  static async createAttestation(operation: string, dataHash: string, nonce: number): Promise<BackendAttestation> {
    return this.currentProvider.createAttestation(operation, dataHash, nonce);
  }
  
  static generateSecureBlindingFactor(): string {
    return this.currentProvider.generateSecureBlindingFactor();
  }
  
  static async generateEqualityProof(c1: PedersenCommitment, c2: PedersenCommitment): Promise<string> {
    return this.currentProvider.generateEqualityProof(c1, c2);
  }
  
  static async getRealPedersenGenerators(): Promise<{ G: string; H: string }> {
    return this.currentProvider.getRealPedersenGenerators();
  }
}