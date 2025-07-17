/**
 * @fileoverview TypeScript type definitions for Zenroom library
 * @version 5.19.2
 * @description Custom type definitions for the Zenroom cryptographic VM
 * since no official @types/zenroom package exists
 */

// Export types for direct import (outside of module declaration)
export interface ZenroomExecutionResult {
  /** The output of the execution as a string */
  result: string;
  /** Logs and debug information from the virtual machine */
  logs: string;
}

export interface ZenroomExecutionOptions {
  /** Input data as JSON string */
  data?: string;
  /** Keys data as JSON string */
  keys?: string;
  /** Extra data as JSON string */
  extra?: string;
  /** Context data as JSON string */
  context?: string;
  /** Configuration string for VM behavior */
  conf?: string;
}

export interface ZenroomIntrospectionResult {
  /** Whether the Zencode is valid */
  valid: boolean;
  /** Error messages if any */
  errors?: string[];
  /** Required input schema */
  input_schema?: Record<string, any>;
  /** Expected output schema */
  output_schema?: Record<string, any>;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface ZenroomCommitmentResult {
  /** Pedersen commitment as hex string */
  pedersen_commitment: string;
  /** Blinding factor (keep secret) */
  blinding_factor: string;
  /** Commitment proof */
  commitment_proof?: string;
}

export interface PedersenCommitment {
  /** X coordinate of commitment point on BN254 */
  x: bigint;
  /** Y coordinate of commitment point on BN254 */
  y: bigint;
  /** Blinding factor used in commitment */
  blindingFactor: string;
  /** Value committed */
  value: bigint;
}

export interface BulletproofRangeProof {
  /** Point A in bulletproof */
  A: string;
  /** Point S in bulletproof */
  S: string;
  /** Point T1 in bulletproof */
  T1: string;
  /** Point T2 in bulletproof */
  T2: string;
  /** Scalar taux */
  taux: string;
  /** Scalar mu */
  mu: string;
  /** Inner product proof */
  proof: string;
  /** Associated commitment */
  commitment: string;
}

export interface CoconutCredential {
  /** Credential signature */
  signature: string;
  /** Zero-knowledge proof */
  proof: string;
  /** Signed attributes */
  attributes: string[];
}

export interface EqualityProof {
  /** Challenge scalar */
  challenge: string;
  /** First response scalar */
  response1: string;
  /** Second response scalar */
  response2: string;
}

export interface Attestation {
  /** Unique nonce for this attestation */
  nonce: bigint;
  /** Hash of the operation data */
  dataHash: string;
  /** ECDSA signature from backend */
  signature: string;
  /** Timestamp of creation */
  timestamp: bigint;
  /** Address of the signer */
  signer: string;
}

export interface ZenroomSplitProofResult {
  /** Proof that input equals sum of outputs */
  split_proof: string;
  /** Individual output commitments */
  output_commitments: string[];
  /** Validation signatures */
  signatures: string[];
}

export interface ZenroomOwnershipProofResult {
  /** Proof of UTXO ownership */
  ownership_proof: string;
  /** EOA signature component */
  eoa_signature: string;
  /** Zenroom signature component */
  zenroom_signature: string;
}

export interface ZenroomKeyDerivationResult {
  /** Derived private key */
  private_key: string;
  /** Derived public key */
  public_key: string;
  /** Key derivation path */
  derivation_path: string;
  /** Curve used (e.g., 'secp256k1') */
  curve: string;
}

export class ZenroomExecutionError extends Error {
  constructor(
    message: string,
    public logs: string,
    public zencode?: string
  ) {
    super(message);
    this.name = 'ZenroomExecutionError';
  }
}

export class ZenroomValidationError extends Error {
  constructor(
    message: string,
    public validationErrors: string[]
  ) {
    super(message);
    this.name = 'ZenroomValidationError';
  }
}

// Type aliases for function signatures
export type ZenroomExecFunction = (
  script: string,
  options?: ZenroomExecutionOptions
) => Promise<ZenroomExecutionResult>;

export type ZencodeExecFunction = (
  zencode: string,
  options?: ZenroomExecutionOptions
) => Promise<ZenroomExecutionResult>;

export type ZenroomIntrospectionFunction = (
  zencode: string
) => Promise<ZenroomIntrospectionResult>;

// Module declaration for the 'zenroom' library
declare module 'zenroom' {
  /**
   * Execute Lua script in Zenroom VM
   * @param script - Lua script to execute
   * @param options - Optional execution parameters
   * @returns Promise resolving to execution result
   */
  export function zenroom_exec(
    script: string,
    options?: ZenroomExecutionOptions
  ): Promise<ZenroomExecutionResult>;

  /**
   * Execute Zencode (human-readable smart contracts) in Zenroom VM
   * @param zencode - Zencode script to execute
   * @param options - Optional execution parameters
   * @returns Promise resolving to execution result
   */
  export function zencode_exec(
    zencode: string,
    options?: ZenroomExecutionOptions
  ): Promise<ZenroomExecutionResult>;

  /**
   * Inspect Zencode for validation and introspection
   * @param zencode - Zencode script to inspect
   * @returns Promise resolving to introspection data
   */
  export function introspect(
    zencode: string
  ): Promise<ZenroomIntrospectionResult>;

  // Re-export the same types within the module
  export type {
    ZenroomExecutionResult,
    ZenroomExecutionOptions,
    ZenroomIntrospectionResult,
    ZenroomCommitmentResult,
    ZenroomSplitProofResult,
    ZenroomOwnershipProofResult,
    ZenroomKeyDerivationResult,
    PedersenCommitment,
    BulletproofRangeProof,
    CoconutCredential,
    EqualityProof,
    Attestation
  };

  export {
    ZenroomExecutionError,
    ZenroomValidationError
  };
}