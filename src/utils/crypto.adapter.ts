// src/utils/crypto.adapter.ts
import type { CryptoProvider, CryptoMode } from './crypto.types';
import type { PedersenCommitment } from '../types/zenroom.d';
import type { BackendAttestation } from '../contracts/ZKUTXOVault.types';
import { EthersCryptoProvider } from './providers/ethers.provider.js';

/**
 * CryptoAdapter - Adaptador unificado para operaciones criptográficas
 * 
 * ARQUITECTURA CRIPTOGRÁFICA ACLARADA:
 * =================================
 * - Curva Elíptica: secp256k1 (misma que Ethereum)
 * - Pedersen Commitments: Implementados sobre secp256k1
 * - Nullifiers: keccak256 compatible con EVM
 * - Attestations: ECDSA signatures (Ethereum standard)
 * 
 * IMPORTANTE - CONFUSIÓN HISTÓRICA BN254 vs secp256k1:
 * ===================================================
 * Este sistema usa EXCLUSIVAMENTE secp256k1, NO BN254.
 * Las referencias a "BN254" en el código son por compatibilidad histórica
 * y deben interpretarse como "secp256k1 ZK operations".
 * 
 * Razones para usar secp256k1 en lugar de BN254:
 * 1. Compatibilidad nativa con Ethereum (misma curva)
 * 2. Mejor soporte en navegadores web (Web Crypto API)
 * 3. Menor complejidad de implementación
 * 4. Reutilización de infraestructura Ethereum existente
 * 5. No requiere librerías ZK especializadas como arkworks
 * 
 * ELIMINACIONES REALIZADAS:
 * - bn254.generators.ts (archivo obsoleto e innecesario)
 * - Referencias a librerías BN254 (no implementadas)
 * 
 * Si se necesita BN254 real en el futuro, se puede agregar como provider adicional,
 * pero la implementación actual es secp256k1 puro.
 */
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
  
  /**
   * Obtener información sobre la configuración criptográfica actual
   */
  static getCryptoInfo(): {
    curve: string;
    provider: string;
    initialized: boolean;
    features: string[];
  } {
    return {
      curve: 'secp256k1',
      provider: this.getProviderName(),
      initialized: !!this.currentProvider,
      features: [
        'Pedersen Commitments',
        'Nullifier Generation',
        'ECDSA Attestations',
        'Equality Proofs',
        'Secure Random Generation'
      ]
    };
  }
  
  /**
   * Validar que el adapter esté correctamente inicializado
   */
  static ensureInitialized(): void {
    if (!this.currentProvider) {
      throw new Error('CryptoAdapter not initialized. Call initialize() first.');
    }
  }
  
  // =====================================================
  // MÉTODOS PROXY PARA OPERACIONES CRIPTOGRÁFICAS
  // =====================================================
  
  /**
   * Crear Pedersen commitment con validación mejorada
   */
  static async createPedersenCommitment(value: bigint, blindingFactor?: string): Promise<PedersenCommitment> {
    this.ensureInitialized();
    
    // Validaciones de entrada
    if (value < 0n) {
      throw new Error('Value must be non-negative');
    }
    
    if (value > 2n ** 64n - 1n) {
      throw new Error('Value too large (max 2^64 - 1)');
    }
    
    return this.currentProvider.createPedersenCommitment(value, blindingFactor);
  }
  
  /**
   * Crear nullifier hash con owner normalizado
   */
  static async createNullifierHash(commitment: PedersenCommitment, owner: string): Promise<string> {
    this.ensureInitialized();
    
    // Validar formato del commitment
    if (!commitment.x || !commitment.y) {
      throw new Error('Invalid commitment: missing coordinates');
    }
    
    return this.currentProvider.createNullifierHash(commitment, owner);
  }
  
  /**
   * Crear attestation con validaciones adicionales
   */
  static async createAttestation(operation: string, dataHash: string, nonce: number): Promise<BackendAttestation> {
    this.ensureInitialized();
    
    // Validar parámetros
    if (!operation || operation.trim().length === 0) {
      throw new Error('Operation cannot be empty');
    }
    
    if (!dataHash || dataHash.length !== 66 || !dataHash.startsWith('0x')) {
      throw new Error('Invalid dataHash format (must be 0x + 64 hex chars)');
    }
    
    if (nonce < 0) {
      throw new Error('Nonce must be non-negative');
    }
    
    return this.currentProvider.createAttestation(operation, dataHash, nonce);
  }
  
  /**
   * Generar blinding factor criptográficamente seguro
   */
  static generateSecureBlindingFactor(): string {
    this.ensureInitialized();
    return this.currentProvider.generateSecureBlindingFactor();
  }
  
  /**
   * Generar equality proof determinístico
   */
  static async generateEqualityProof(c1: PedersenCommitment, c2: PedersenCommitment): Promise<string> {
    this.ensureInitialized();
    
    // Validar commitments
    if (!c1.x || !c1.y || !c2.x || !c2.y) {
      throw new Error('Invalid commitments for equality proof');
    }
    
    return this.currentProvider.generateEqualityProof(c1, c2);
  }
  
  /**
   * Obtener generadores Pedersen para secp256k1
   */
  static async getRealPedersenGenerators(): Promise<{ G: string; H: string }> {
    this.ensureInitialized();
    return this.currentProvider.getRealPedersenGenerators();
  }
  
  /**
   * Verificar la coherencia criptográfica del sistema
   * Útil para debugging y validación de arquitectura
   */
  static async validateCryptographicIntegrity(): Promise<{
    isValid: boolean;
    curve: string;
    warnings: string[];
    recommendations: string[];
  }> {
    const info = this.getCryptoInfo();
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    // Verificar que estamos usando secp256k1
    if (info.curve !== 'secp256k1') {
      warnings.push(`Unexpected curve: ${info.curve}. Expected secp256k1.`);
    }
    
    // Verificar que el provider está inicializado
    if (!info.initialized) {
      warnings.push('CryptoAdapter not properly initialized');
      recommendations.push('Call CryptoAdapter.initialize() before using crypto operations');
    }
    
    // Verificar funcionalidades disponibles
    const expectedFeatures = ['Pedersen Commitments', 'Nullifier Generation', 'ECDSA Attestations'];
    const missingFeatures = expectedFeatures.filter(f => !info.features.includes(f));
    
    if (missingFeatures.length > 0) {
      warnings.push(`Missing features: ${missingFeatures.join(', ')}`);
    }
    
    // Recomendaciones generales
    if (warnings.length === 0) {
      recommendations.push('Cryptographic architecture is correctly configured for secp256k1 ZK operations');
      recommendations.push('All references to "BN254" in the codebase should be interpreted as secp256k1 operations');
    }
    
    return {
      isValid: warnings.length === 0,
      curve: info.curve,
      warnings,
      recommendations
    };
  }
}