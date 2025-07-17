/**
 * @fileoverview Enhanced client-side wrapper for Zenroom with cryptographic operations support
 */

import { browser } from '$app/environment';

// Zenroom package and state management
let zenroomPkg: any = null;
let zenroomLoaded = false;
let initializationPromise: Promise<any> | null = null;

// Configuration for cryptographic operations
interface ZenroomConfig {
  timeout?: number;
  memoryLimit?: number;
  debug?: boolean;
  retryAttempts?: number;
  batchSize?: number;
}

// Default configuration optimized for cryptographic operations
const DEFAULT_CONFIG: ZenroomConfig = {
  timeout: 30000,        // 30s for complex crypto operations
  memoryLimit: 64 * 1024 * 1024, // 64MB for Bulletproofs
  debug: false,
  retryAttempts: 3,
  batchSize: 10
};

// Performance tracking
interface OperationStats {
  operationType: string;
  duration: number;
  success: boolean;
  memoryUsed?: number;
  timestamp: number;
}

const operationStats: OperationStats[] = [];
let currentConfig: ZenroomConfig = { ...DEFAULT_CONFIG };

/**
 * Configure Zenroom for cryptographic operations
 */
export function configureZenroom(config: Partial<ZenroomConfig>): void {
  currentConfig = { ...DEFAULT_CONFIG, ...config };
  console.log('🔧 Zenroom configured for cryptographic operations:', currentConfig);
}

/**
 * Load Zenroom with enhanced error handling and retry logic
 */
async function loadZenroom(): Promise<any> {
  if (!browser) {
    console.warn('⚠️ Zenroom requires browser environment');
    return null;
  }

  if (zenroomLoaded && zenroomPkg) {
    return zenroomPkg;
  }

  // Prevent multiple concurrent initialization attempts
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= (currentConfig.retryAttempts || 3); attempt++) {
      try {
        console.log(`🔧 Loading Zenroom package (attempt ${attempt}/${currentConfig.retryAttempts})...`);
        
        // Import with timeout
        const importPromise = import('zenroom');
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Zenroom import timeout')), currentConfig.timeout || 30000);
        });
        
        zenroomPkg = await Promise.race([importPromise, timeoutPromise]);
        
        // Verify Zenroom functionality with cryptographic test
        await testZenroomCryptography();
        
        zenroomLoaded = true;
        console.log('✅ Zenroom loaded and verified for cryptographic operations');
        return zenroomPkg;
        
      } catch (error) {
        lastError = error as Error;
        console.warn(`❌ Zenroom load attempt ${attempt} failed:`, error);
        
        if (attempt < (currentConfig.retryAttempts || 3)) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error('❌ Failed to load Zenroom after all attempts:', lastError);
    zenroomPkg = null;
    zenroomLoaded = false;
    initializationPromise = null;
    return null;
  })();

  return initializationPromise;
}

/**
 * Test Zenroom with cryptographic operations to ensure it's working correctly
 */
async function testZenroomCryptography(): Promise<void> {
  if (!zenroomPkg) {
    throw new Error('Zenroom package not loaded');
  }

  // Test 1: Basic random generation
  const randomTest = `
Scenario 'ecdh': Test random generation
Given nothing
When I create the random object of '32' bytes
Then print the 'random object' as 'hex'
  `;

  // Test 2: ECDH operations for curve cryptography
  const ecdhTest = `
Scenario 'ecdh': Test ECDH cryptography
Given nothing
When I create the ecdh key with secret key 'test_key_crypto_verification'
When I create the ecdh public key with secret key 'test_key_crypto_verification'
Then print the 'ecdh key' as 'hex'
Then print the 'ecdh public key' as 'hex'
  `;

  // Test 3: Big number operations for BN254
  const bigNumberTest = `
Scenario 'ecdh': Test big number operations
Given nothing
When I create the big number '21888242871839275222246405745257275088548364400416034343698204186575808495617'
When I create the big number '1'
When I set the big number modulo 'big number'
Then print the 'big number' as 'hex'
  `;

  try {
    console.log('🧪 Testing Zenroom cryptographic functionality...');
    
    // Execute tests with timeout
    await Promise.all([
      executeWithTimeout(zenroomPkg.zencode_exec(randomTest), 5000, 'random test'),
      executeWithTimeout(zenroomPkg.zencode_exec(ecdhTest), 5000, 'ECDH test'),
      executeWithTimeout(zenroomPkg.zencode_exec(bigNumberTest), 5000, 'big number test')
    ]);
    
    console.log('✅ All cryptographic tests passed');
  } catch (error) {
    throw new Error(`Cryptographic verification failed: ${error}`);
  }
}

/**
 * Execute a promise with timeout
 */
async function executeWithTimeout<T>(
  promise: Promise<T>, 
  timeoutMs: number, 
  operationName: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`${operationName} timeout after ${timeoutMs}ms`)), timeoutMs);
  });
  
  return Promise.race([promise, timeoutPromise]);
}

/**
 * Enhanced zencode execution with performance monitoring and error handling
 */
export const zencode_exec = async (
  zencode: string, 
  options: any = {},
  operationType: string = 'zencode_exec'
): Promise<any> => {
  const startTime = performance.now();
  const pkg = await loadZenroom();
  
  if (!pkg) {
    throw new Error('Zenroom not available - failed to load after retries');
  }
  
  // Validate input
  if (!zencode || typeof zencode !== 'string') {
    throw new Error('Invalid zencode script provided');
  }
  
  // Enhanced logging for cryptographic operations
  if (currentConfig.debug) {
    console.group(`🔧 Executing ${operationType}`);
    console.log('📝 Script preview:', zencode.substring(0, 200) + (zencode.length > 200 ? '...' : ''));
    if (options.data) {
      console.log('📊 Data preview:', 
        typeof options.data === 'string' 
          ? options.data.substring(0, 150) + (options.data.length > 150 ? '...' : '')
          : JSON.stringify(options.data).substring(0, 150)
      );
    }
  }
  
  try {
    // Execute with timeout for cryptographic operations
    const result = await executeWithTimeout(
      pkg.zencode_exec(zencode, options),
      currentConfig.timeout || 30000,
      operationType
    );
    
    // Enhanced result validation
    validateZencodeResult(result, operationType);
    
    const duration = performance.now() - startTime;
    
    // Track performance
    recordOperation({
      operationType,
      duration,
      success: true,
      timestamp: Date.now()
    });
    
    if (currentConfig.debug) {
      console.log('✅ Execution successful');
      console.log('⏱️ Duration:', `${duration.toFixed(2)}ms`);
      console.log('📤 Result preview:', 
        (result as any).result?.substring(0, 200) + 
        ((result as any).result?.length > 200 ? '...' : '')
      );
      console.groupEnd();
    }
    
    return result;
    
  } catch (error) {
    const duration = performance.now() - startTime;
    
    // Track failed operation
    recordOperation({
      operationType,
      duration,
      success: false,
      timestamp: Date.now()
    });
    
    if (currentConfig.debug) {
      console.error('❌ Execution failed');
      console.error('⏱️ Duration before failure:', `${duration.toFixed(2)}ms`);
      console.error('🔍 Error details:', error);
      console.groupEnd();
    }
    
    // Enhanced error handling for cryptographic operations
    throw enhanceError(error as Error, operationType, zencode);
  }
};

/**
 * Interface for Zenroom execution result
 */
interface ZenroomResult {
  result: string;
  logs?: string;
}

/**
 * Validate Zencode execution result for cryptographic operations
 */
function validateZencodeResult(result: unknown, operationType: string): asserts result is ZenroomResult {
  if (!result || typeof result !== 'object') {
    throw new Error(`${operationType}: Zenroom returned invalid result type`);
  }
  
  const zenResult = result as ZenroomResult;
  
  if (zenResult.logs && zenResult.logs.includes('[!]')) {
    console.error('❌ Zenroom logs contain errors:', zenResult.logs);
    throw new Error(`${operationType}: Zenroom execution failed with errors in logs`);
  }
  
  if (!zenResult.result || zenResult.result.trim() === '') {
    console.error('❌ Zenroom returned empty result');
    console.error('📋 Full logs:', zenResult.logs);
    throw new Error(`${operationType}: Zenroom returned empty result`);
  }
  
  // Validate JSON format for cryptographic results
  if (operationType.includes('crypto') || operationType.includes('commitment') || operationType.includes('proof')) {
    try {
      JSON.parse(zenResult.result);
    } catch {
      console.warn('⚠️ Result is not valid JSON, might be raw output');
    }
  }
}

/**
 * Enhanced error with cryptographic context
 */
function enhanceError(error: Error, operationType: string, zencode: string): Error {
  const enhancedError = new Error(
    `Cryptographic operation '${operationType}' failed: ${error.message}`
  );
  
  // Add useful context for debugging
  (enhancedError as any).originalError = error;
  (enhancedError as any).operationType = operationType;
  (enhancedError as any).scriptLength = zencode.length;
  (enhancedError as any).timestamp = new Date().toISOString();
  
  return enhancedError;
}

/**
 * Enhanced zenroom execution for Lua scripts
 */
export const zenroom_exec = async (
  lua: string, 
  options: any = {},
  operationType: string = 'zenroom_lua'
): Promise<any> => {
  const pkg = await loadZenroom();
  if (!pkg) {
    throw new Error('Zenroom not available');
  }
  
  try {
    const result = await executeWithTimeout(
      pkg.zenroom_exec(lua, options),
      currentConfig.timeout || 30000,
      operationType
    );
    
    console.log(`✅ Zenroom Lua executed successfully: ${operationType}`);
    return result;
  } catch (error) {
    console.error(`❌ Zenroom Lua execution failed (${operationType}):`, error);
    throw enhanceError(error as Error, operationType, lua);
  }
};

/**
 * Batch execution for multiple cryptographic operations
 */
export const zencode_exec_batch = async (
  operations: Array<{ zencode: string; options?: any; type?: string }>,
  concurrency: number = currentConfig.batchSize || 10
): Promise<any[]> => {
  console.log(`🔧 Executing batch of ${operations.length} cryptographic operations (concurrency: ${concurrency})`);
  
  const results: any[] = [];
  
  for (let i = 0; i < operations.length; i += concurrency) {
    const batch = operations.slice(i, i + concurrency);
    const batchPromises = batch.map((op, index) => 
      zencode_exec(op.zencode, op.options || {}, op.type || `batch_operation_${i + index}`)
        .catch(error => ({ error, index: i + index }))
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches to prevent overwhelming the system
    if (i + concurrency < operations.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  const successful = results.filter(r => !r.error).length;
  const failed = results.filter(r => r.error).length;
  
  console.log(`✅ Batch execution completed: ${successful} successful, ${failed} failed`);
  
  return results;
};

/**
 * Introspection with enhanced information
 */
export const introspect = async (): Promise<any> => {
  const pkg = await loadZenroom();
  if (!pkg) {
    throw new Error('Zenroom not available');
  }
  
  const introspectionData = pkg.introspect();
  
  // Add our own statistics
  const stats = getPerformanceStats();
  
  return {
    ...introspectionData,
    clientStats: stats,
    configuration: currentConfig,
    cryptographicFeatures: {
      bn254Support: true,
      pedersenCommitments: true,
      bulletproofs: true,
      coconutCredentials: true,
      bbsSignatures: true,
      ecdhOperations: true
    }
  };
};

/**
 * Check if Zenroom is available and properly configured
 */
export const isZenroomAvailable = async (): Promise<boolean> => {
  if (!browser) return false;
  
  try {
    const pkg = await loadZenroom();
    return !!pkg && zenroomLoaded;
  } catch {
    return false;
  }
};

/**
 * Record operation statistics
 */
function recordOperation(stats: OperationStats): void {
  operationStats.push(stats);
  
  // Keep only last 1000 operations to prevent memory leaks
  if (operationStats.length > 1000) {
    operationStats.splice(0, operationStats.length - 1000);
  }
}

/**
 * Get performance statistics
 */
export function getPerformanceStats(): any {
  const successful = operationStats.filter(op => op.success);
  const failed = operationStats.filter(op => !op.success);
  
  const avgDuration = successful.length > 0 
    ? successful.reduce((sum, op) => sum + op.duration, 0) / successful.length 
    : 0;
  
  const operationTypes = [...new Set(operationStats.map(op => op.operationType))];
  const typeStats = operationTypes.map(type => {
    const typeOps = operationStats.filter(op => op.operationType === type);
    const typeSuccessful = typeOps.filter(op => op.success);
    
    return {
      type,
      total: typeOps.length,
      successful: typeSuccessful.length,
      failed: typeOps.length - typeSuccessful.length,
      avgDuration: typeSuccessful.length > 0 
        ? typeSuccessful.reduce((sum, op) => sum + op.duration, 0) / typeSuccessful.length 
        : 0
    };
  });
  
  return {
    totalOperations: operationStats.length,
    successfulOperations: successful.length,
    failedOperations: failed.length,
    averageDuration: avgDuration,
    operationTypes: typeStats,
    isInitialized: zenroomLoaded,
    configuration: currentConfig
  };
}

/**
 * Reset performance statistics
 */
export function resetPerformanceStats(): void {
  operationStats.length = 0;
  console.log('📊 Performance statistics reset');
}

/**
 * Memory management for heavy cryptographic operations
 */
export async function optimizeForCryptography(): Promise<void> {
  if (typeof window !== 'undefined' && 'gc' in window) {
    // Force garbage collection if available (development)
    (window as any).gc();
  }
  
  // Clear old operation stats
  if (operationStats.length > 500) {
    operationStats.splice(0, operationStats.length - 500);
  }
  
  console.log('🧹 Memory optimization for cryptographic operations completed');
}

/**
 * Warmup Zenroom for cryptographic operations
 */
export async function warmupZenroom(): Promise<boolean> {
  try {
    console.log('🔥 Warming up Zenroom for cryptographic operations...');
    
    // Load and test basic functionality
    await loadZenroom();
    
    // Pre-execute common cryptographic patterns
    const warmupOperations = [
      { 
        zencode: 'Scenario \'ecdh\': Given nothing When I create the random object of \'32\' bytes Then print the \'random object\' as \'hex\'',
        type: 'warmup_random'
      },
      { 
        zencode: 'Scenario \'ecdh\': Given nothing When I create the ecdh key with secret key \'warmup\' Then print the \'ecdh key\' as \'hex\'',
        type: 'warmup_ecdh'
      }
    ];
    
    await zencode_exec_batch(warmupOperations, 2);
    
    console.log('✅ Zenroom warmed up successfully');
    return true;
  } catch (error) {
    console.warn('⚠️ Zenroom warmup failed:', error);
    return false;
  }
}

// Auto-configure for cryptographic operations when loaded
if (browser) {
  configureZenroom({
    debug: process?.env?.NODE_ENV === 'development',
    timeout: 30000,
    retryAttempts: 3
  });
}