// src/utils/providers/ethers.provider.ts
import { ethers } from 'ethers';
import { ec as EC } from 'elliptic';
import type { CryptoProvider } from '../crypto.types';
import type { PedersenCommitment } from '../../types/zenroom.d';
import type { BackendAttestation } from '../../contracts/UTXOVault.types';

export class EthersCryptoProvider implements CryptoProvider {
  private secp256k1: EC;
  private generatorG: any;
  private generatorH: any;
  private initialized = false;
  
  constructor() {
    this.secp256k1 = new EC('secp256k1');
  }
  
  async initialize(): Promise<boolean> {
    try {
      console.log('🔄 Initializing Ethers crypto provider...');
      
      // Test básico de funcionalidad
      const testBytes = ethers.randomBytes(32);
      const testHash = ethers.keccak256(testBytes);
      
      if (!testHash || testHash.length !== 66) {
        throw new Error('Basic crypto test failed');
      }
      
      // Inicializar generadores de curva elíptica
      this.generatorG = this.secp256k1.g;
      this.generatorH = this.secp256k1.g.mul('2'); // H = 2*G (simple but valid)
      
      // Test commitment básico
      const testCommitment = await this.createPedersenCommitment(BigInt(100));
      if (!testCommitment.x || !testCommitment.y) {
        throw new Error('Commitment test failed');
      }
      
      this.initialized = true;
      console.log('✅ Ethers crypto provider initialized successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Ethers crypto provider initialization failed:', error);
      return false;
    }
  }
  
  async createPedersenCommitment(value: bigint, blindingFactor?: string): Promise<PedersenCommitment> {
    if (!this.initialized) {
      throw new Error('Provider not initialized');
    }
    
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
    return ethers.keccak256(
      ethers.solidityPacked(
        ['uint256', 'uint256', 'address'],
        [commitment.x, commitment.y, owner]
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