// src/utils/crypto.types.ts
import type { PedersenCommitment } from '../types/zenroom.d';
import type { BackendAttestation } from '../contracts/UTXOVault.types';
import type { CryptographyType } from '../types/utxo.types';

export interface CryptoProvider {
  initialize(): Promise<boolean>;
  createPedersenCommitment(value: bigint, blindingFactor?: string): Promise<PedersenCommitment>;
  createNullifierHash(commitment: PedersenCommitment, owner: string): Promise<string>;
  createAttestation(operation: string, dataHash: string, nonce: number): Promise<BackendAttestation>;
  generateEqualityProof(c1: PedersenCommitment, c2: PedersenCommitment): Promise<string>;
  generateSecureBlindingFactor(): string;
  getRealPedersenGenerators(): Promise<{ G: string; H: string }>;
}

export interface CryptoMode {
  name: 'ethers' | 'noble' | 'webcrypto' | 'zenroom';
  available: boolean;
  performance: 'fast' | 'medium' | 'slow';
  features: string[];
}

export interface CryptographyStatus {
  cryptographyType: CryptographyType;
  isInitialized: boolean;
  hasErrors: boolean;
  errors: string[];
  secp256k1Available: boolean;
  zkProofGeneration: boolean;
  lastCheck: Date;
  // Estadísticas opcionales
  operationCount?: number;
  totalUTXOs?: number;
  cryptographyDistribution?: {
    BN254: number;
    secp256k1: number;
    Other: number;
  };
}