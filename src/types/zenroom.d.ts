// src/types/zenroom.d.ts

/**
 * Tipos para operaciones criptográficas reales con Zenroom
 * Todas las estructuras reflejan protocolos criptográficos reales
 */

/**
 * Pedersen commitment en curva BN254
 */
export interface PedersenCommitment {
  /** Coordenada X del punto en BN254 (como BigInt) */
  x: bigint;
  /** Coordenada Y del punto en BN254 (como BigInt) */
  y: bigint;
  /** Factor de cegado usado para el commitment (hex string) */
  blindingFactor: string;
  /** Valor comprometido (como BigInt) */
  value: bigint;
}

/**
 * Bulletproof range proof completo
 * Implementa el protocolo Bulletproof real para rangos
 */
export interface BulletproofRangeProof {
  /** Punto A del protocolo Bulletproof (hex string) */
  A: string;
  /** Punto S del protocolo Bulletproof (hex string) */
  S: string;
  /** Punto T1 para polinomio de grado 1 (hex string) */
  T1: string;
  /** Punto T2 para polinomio de grado 2 (hex string) */
  T2: string;
  /** Escalar taux para blinding aggregation (hex string) */
  taux: string;
  /** Escalar mu para blinding vector commitment (hex string) */
  mu: string;
  /** Inner product proof comprimido (hex string) */
  proof: string;
  /** Commitment del valor probado (hex string) */
  commitment: string;
}

/**
 * Coconut credential usando BBS signatures
 * Protocolo completo de credenciales anónimas
 */
export interface CoconutCredential {
  /** Firma BBS de la credencial (hex string) */
  signature: string;
  /** Proof de conocimiento de la firma (hex string) */
  proof: string;
  /** Atributos de la credencial */
  attributes: string[];
  /** Clave pública del issuer (hex string) */
  issuerPublicKey?: string;
  /** Hash del mensaje firmado (hex string) */
  messageHash?: string;
}

/**
 * Equality proof usando protocolo Sigma
 * Prueba que dos commitments encriptan el mismo valor
 */
export interface EqualityProof {
  /** Challenge del protocolo Fiat-Shamir (hex string) */
  challenge: string;
  /** Respuesta para el primer commitment (hex string) */
  response1: string;
  /** Respuesta para el segundo commitment (hex string) */
  response2: string;
  /** Commitment aleatorio del protocolo Sigma (hex string) */
  randomCommitment?: string;
}

/**
 * Attestation firmada por el backend autorizado
 * Garantiza que las operaciones son válidas
 */
export interface Attestation {
  /** Tipo de operación atestiguada */
  type: 'deposit' | 'transfer' | 'split' | 'withdraw';
  /** Timestamp de la operación */
  timestamp: number;
  /** Dirección del usuario */
  userAddress: string;
  /** Firma del backend (hex string) */
  signature: string;
  /** Nonce único para evitar replay attacks */
  nonce: string;
  /** Hash de los datos para verificación */
  dataHash: string;
  /** Datos específicos de la operación */
  data: DepositAttestationData | TransferAttestationData | SplitAttestationData | WithdrawAttestationData;
}

/**
 * Datos de attestation para depósitos
 */
export interface DepositAttestationData {
  /** Dirección del token */
  tokenAddress: string;
  /** Coordenada X del commitment */
  commitmentX: bigint;
  /** Coordenada Y del commitment */
  commitmentY: bigint;
  /** Nullifier del depósito */
  nullifier: string;
  /** Cantidad depositada */
  amount: bigint;
}

/**
 * Datos de attestation para transferencias
 */
export interface TransferAttestationData {
  /** Nullifier del input */
  inputNullifier: string;
  /** Coordenada X del output commitment */
  outputCommitmentX: bigint;
  /** Coordenada Y del output commitment */
  outputCommitmentY: bigint;
  /** Cantidad transferida */
  amount: bigint;
  /** Dirección del sender */
  fromAddress: string;
  /** Dirección del receiver */
  toAddress: string;
}

/**
 * Datos de attestation para splits
 */
export interface SplitAttestationData {
  /** Nullifier del input */
  inputNullifier: string;
  /** Coordenada X del primer output */
  outputCommitment1X: bigint;
  /** Coordenada Y del primer output */
  outputCommitment1Y: bigint;
  /** Coordenada X del segundo output */
  outputCommitment2X: bigint;
  /** Coordenada Y del segundo output */
  outputCommitment2Y: bigint;
  /** Cantidad del primer output */
  amount1: bigint;
  /** Cantidad del segundo output */
  amount2: bigint;
}

/**
 * Datos de attestation para withdrawals
 */
export interface WithdrawAttestationData {
  /** Nullifier del withdrawal */
  nullifier: string;
  /** Cantidad a retirar */
  amount: bigint;
  /** Dirección del token */
  tokenAddress: string;
  /** Dirección del recipient */
  recipientAddress: string;
}

/**
 * Contexto de la curva BN254
 */
export interface BN254Context {
  /** Módulo del campo base */
  fieldModulus: string;
  /** Orden de la curva */
  curveOrder: string;
  /** Punto generador base */
  generator: string;
}

/**
 * Generadores Pedersen
 */
export interface PedersenGenerators {
  /** Generador G (hex string) */
  G: string;
  /** Generador H independiente de G (hex string) */
  H: string;
}

/**
 * Parámetros para crear un Pedersen commitment
 */
export interface CreateCommitmentParams {
  /** Valor a comprometer */
  value: string | bigint;
  /** Factor de cegado opcional (se genera si no se provee) */
  blindingFactor?: string;
}

/**
 * Parámetros para generar un Bulletproof
 */
export interface BulletproofParams {
  /** Valor a probar */
  value: bigint;
  /** Factor de cegado */
  blindingFactor: string;
  /** Rango mínimo (por defecto 0) */
  minRange?: bigint;
  /** Rango máximo (por defecto 2^32-1) */
  maxRange?: bigint;
}

/**
 * Parámetros para crear una Coconut credential
 */
export interface CoconutParams {
  /** Atributos de la credencial */
  attributes: string[];
  /** Clave privada del issuer (opcional, se genera si no se provee) */
  issuerPrivateKey?: string;
}

/**
 * Resultado de una operación criptográfica
 */
export interface CryptographicResult<T> {
  /** Resultado de la operación */
  result: T;
  /** Tiempo de ejecución en milisegundos */
  executionTime: number;
  /** Hash de verificación */
  verificationHash?: string;
}

/**
 * Configuración de Zenroom
 */
export interface ZenroomConfig {
  /** Usar logs de debug */
  debug?: boolean;
  /** Timeout para operaciones en ms */
  timeout?: number;
  /** Configuración de memoria */
  memory?: {
    /** Tamaño inicial */
    initial?: number;
    /** Tamaño máximo */
    maximum?: number;
  };
}

/**
 * Estadísticas de operaciones Zenroom
 */
export interface ZenroomStats {
  /** Número de operaciones ejecutadas */
  operationsCount: number;
  /** Tiempo total de ejecución */
  totalExecutionTime: number;
  /** Errores encontrados */
  errorsCount: number;
  /** Última operación exitosa */
  lastSuccessfulOperation?: string;
}

/**
 * Interfaz principal para el helper de Zenroom
 */
export interface IZenroomHelpers {
  /** Inicializar Zenroom */
  initialize(): Promise<boolean>;
  
  /** Crear Pedersen commitment */
  createPedersenCommitment(value: string, blindingFactor?: string): Promise<PedersenCommitment>;
  
  /** Verificar Pedersen commitment */
  verifyPedersenCommitment(commitment: string, value: bigint, blindingFactor: string): Promise<boolean>;
  
  /** Generar Bulletproof */
  generateBulletproof(value: bigint, blindingFactor: string, minRange?: bigint, maxRange?: bigint): Promise<BulletproofRangeProof>;
  
  /** Generar Coconut credential */
  generateCoconutCredential(attributes: string[], issuerKey?: string): Promise<CoconutCredential>;
  
  /** Generar equality proof */
  generateEqualityProof(commitment1: PedersenCommitment, commitment2: PedersenCommitment): Promise<EqualityProof>;
  
  /** Generar nullifier hash */
  generateNullifierHash(commitment: string, owner: string, nonce: string): Promise<string>;
  
  /** Validar commitment */
  validateCommitment(commitment: PedersenCommitment): Promise<boolean>;
}

/**
 * Tipos para operaciones específicas del mixer
 */
export interface MixerOperationResult {
  /** Tipo de operación */
  operation: 'deposit' | 'transfer' | 'split' | 'withdraw';
  /** Commitments generados */
  commitments: PedersenCommitment[];
  /** Proofs generados */
  proofs: (BulletproofRangeProof | EqualityProof)[];
  /** Attestation del backend */
  attestation: Attestation;
  /** Hash de la transacción */
  transactionHash?: string;
}

// Extensiones de tipos para compatibilidad
declare global {
  interface Window {
    zenroom?: any;
    zenroomStats?: ZenroomStats;
  }
}

export type ZenroomFunction = 'zencode_exec' | 'zenroom_exec' | 'introspect';
export type CurveOperation = 'add' | 'multiply' | 'double' | 'negate';
export type HashFunction = 'sha256' | 'sha512' | 'keccak256' | 'pbkdf2';
export type ProofType = 'bulletproof' | 'coconut' | 'equality' | 'membership';