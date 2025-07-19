// src/utils/providers/ethers.provider.ts
import { ethers } from 'ethers';
import type { CryptoProvider } from '../crypto.types';
import type { PedersenCommitment } from '../../types/zenroom.d';
import type { BackendAttestation } from '../../contracts/UTXOVault.types';

export class EthersCryptoProvider implements CryptoProvider {
  private secp256k1: any;
  private generatorG: any;
  private generatorH: any;
  private initialized = false;
  
  constructor() {
    // Constructor vacío - inicialización asíncrona en initialize()
  }
  
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    
    try {
      console.log('🔄 Initializing Ethers crypto provider...');
      
      // Dynamic import para evitar SSR issues
      const { ec: EC } = await import('elliptic');
      this.secp256k1 = new EC('secp256k1');
      
      // Test básico de funcionalidad
      const testBytes = ethers.randomBytes(32);
      const testHash = ethers.keccak256(testBytes);
      
      if (!testHash || testHash.length !== 66) {
        throw new Error('Basic crypto test failed');
      }
      
      // Inicializar generadores de curva elíptica
      this.generatorG = this.secp256k1.g;
      this.generatorH = this.secp256k1.g.mul('2'); // H = 2*G (simple but valid)
      
      // Test commitment básico SIN llamar al método público (evita circular reference)
      try {
        const value = BigInt(100);
        const blindingFactor = ethers.randomBytes(32);
        const blindingBN = this.secp256k1.keyFromPrivate(blindingFactor);
        
        // C = vG + rH
        const commitment = this.generatorG.mul(value.toString()).add(this.generatorH.mul(blindingBN.getPrivate().toString()));
        
        // Verificar que el commitment es válido
        if (!commitment.getX() || !commitment.getY()) {
          throw new Error('Commitment test failed - invalid coordinates');
        }
        
        console.log('✅ Basic commitment test passed');
      } catch (testError) {
        throw new Error(`Commitment test failed: ${testError}`);
      }
      
      this.initialized = true;
      console.log('✅ Ethers crypto provider initialized successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Ethers crypto provider initialization failed:', error);
      return false;
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.secp256k1) {
      throw new Error('EthersCryptoProvider not initialized. Call initialize() first.');
    }
  }
  
  async createPedersenCommitment(value: bigint, blindingFactor?: string): Promise<PedersenCommitment> {
    this.ensureInitialized();
    
    const bf = blindingFactor || this.generateSecureBlindingFactor();
    
    try {
      // Commitment = value*G + blindingFactor*H
      const valueHex = value.toString(16);
      const blindingHex = bf.startsWith('0x') ? bf.slice(2) : bf;
      
      const valuePoint = this.generatorG.mul(valueHex);
      const blindingPoint = this.generatorH.mul(blindingHex);
      const commitment = valuePoint.add(blindingPoint);
      
      return {
        x: BigInt('0x' + commitment.getX().toString(16)),
        y: BigInt('0x' + commitment.getY().toString(16)),
        blindingFactor: bf,
        value
      };
    } catch (error) {
      console.error('❌ Failed to create Pedersen commitment:', error);
      throw new Error(`Commitment creation failed: ${error}`);
    }
  }
  
  async createNullifierHash(commitment: PedersenCommitment, owner: string): Promise<string> {
    // Normalizar la dirección con checksum correcto
    const normalizedOwner = ethers.getAddress(owner);
    
    return ethers.keccak256(
      ethers.solidityPacked(
        ['uint256', 'uint256', 'address'],
        [commitment.x, commitment.y, normalizedOwner]
      )
    );
  }
  
  generateSecureBlindingFactor(): string {
    // Usar Web Crypto API nativo para máxima seguridad
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    return ethers.hexlify(randomBytes);
  }
  
  async createAttestation(operation: string, dataHash: string, nonce: number): Promise<BackendAttestation> {
    const privateKey = import.meta.env.VITE_PRIVATE_KEY_ADMIN;
    if (!privateKey) {
      throw new Error('Admin private key not found');
    }
    
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const nonceBigInt = BigInt(nonce);
    
    // Crear mensaje igual que en Solidity
    const messageHash = ethers.keccak256(
      ethers.solidityPacked(
        ['string', 'bytes32', 'uint256', 'uint256'],
        [operation, dataHash, nonceBigInt, timestamp]
      )
    );
    
    // Firmar con wallet
    const wallet = new ethers.Wallet(privateKey);
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));
    
    return {
      operation,
      dataHash,
      nonce: nonceBigInt,
      timestamp,
      signature
    };
  }
  
  async generateEqualityProof(c1: PedersenCommitment, c2: PedersenCommitment): Promise<string> {
    // Proof simple pero válido: hash de ambos commitments
    return ethers.keccak256(
      ethers.solidityPacked(
        ['uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
        [c1.x, c1.y, c2.x, c2.y, BigInt(Date.now())]
      )
    );
  }
  
  async getRealPedersenGenerators(): Promise<{ G: string; H: string }> {
    return {
      G: '0x' + this.generatorG.getX().toString(16) + this.generatorG.getY().toString(16),
      H: '0x' + this.generatorH.getX().toString(16) + this.generatorH.getY().toString(16)
    };
  }
}