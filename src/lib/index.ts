// Re-export all modules
// ===== ZK ENHANCED MANAGERS =====
export { 
  zkPrivateUTXOManager, 
  ZKPrivateUTXOManager,
  privateUTXOManager  // Backward compatibility alias
} from '$lib/ManagerUTXO';

export type { PrivateUTXO } from '$lib/ManagerUTXO';
export { default as zkPrivateUTXOManagerDefault } from '$lib/ManagerUTXO';

// ===== ZK SERVICES =====
export { ZKCompatibilityAdapter } from './ZKCompatibilityAdapter';
export { ZKCryptoServiceImpl } from './ZKCryptoService';

// ===== CORE SERVICES =====
export { AttestationService } from './AttestationService';
export { PrivateUTXOStorage } from './PrivateUTXOStorage';

// ===== UTILITIES =====
export { calculateDepositDataHash } from './HashCalculator';

// ===== BACKWARD COMPATIBILITY =====
// Legacy exports for existing code
export { privateUTXOManager as PrivateUTXOManager } from '$lib/ManagerUTXO';
export { zkPrivateUTXOManager as privateUTXOManagerDefault } from '$lib/ManagerUTXO';
