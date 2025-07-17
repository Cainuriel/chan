/**
 * Prueba directa de BN254 para verificar el problema real
 */

// Simulación de las operaciones que hace el código real
const FIELD_MODULUS = 0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47n;
const CURVE_ORDER = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;

// Generadores CORREGIDOS
const G = { x: 1n, y: 2n };
const H = { 
  x: 0x769bf9ac56bea3ff40232bcb1b6bd159315d84715b8e679f2d355961915abf0n,
  y: 0x2ab799bee0489429554fdb7c8d086475319e63b40b9c5b57cdf1ff3dd9fe2261n
};

// Funciones criptográficas básicas
function isOnCurve(point) {
  const y2 = (point.y * point.y) % FIELD_MODULUS;
  const x3 = (point.x * point.x * point.x) % FIELD_MODULUS;
  const right = (x3 + 3n) % FIELD_MODULUS;
  return y2 === right;
}

function modInverse(a, m) {
  let old_r = a;
  let r = m;
  let old_s = 1n;
  let s = 0n;
  
  while (r !== 0n) {
    const quotient = old_r / r;
    [old_r, r] = [r, old_r - quotient * r];
    [old_s, s] = [s, old_s - quotient * s];
  }
  
  return old_r === 1n ? (old_s + m) % m : null;
}

function addPoints(p1, p2) {
  if (p1.x === 0n && p1.y === 0n) return p2;
  if (p2.x === 0n && p2.y === 0n) return p1;
  
  if (p1.x === p2.x) {
    if (p1.y === p2.y) {
      // Duplicación
      const numerator = (3n * p1.x * p1.x) % FIELD_MODULUS;
      const denominator = (2n * p1.y) % FIELD_MODULUS;
      const slope = (numerator * modInverse(denominator, FIELD_MODULUS)) % FIELD_MODULUS;
      const x3 = (slope * slope - 2n * p1.x) % FIELD_MODULUS;
      const y3 = (slope * (p1.x - x3) - p1.y) % FIELD_MODULUS;
      return {
        x: (x3 + FIELD_MODULUS) % FIELD_MODULUS,
        y: (y3 + FIELD_MODULUS) % FIELD_MODULUS
      };
    }
    return { x: 0n, y: 0n };
  }
  
  const dx = (p2.x - p1.x + FIELD_MODULUS) % FIELD_MODULUS;
  const dy = (p2.y - p1.y + FIELD_MODULUS) % FIELD_MODULUS;
  const slope = (dy * modInverse(dx, FIELD_MODULUS)) % FIELD_MODULUS;
  const x3 = (slope * slope - p1.x - p2.x) % FIELD_MODULUS;
  const y3 = (slope * (p1.x - x3) - p1.y) % FIELD_MODULUS;
  
  return {
    x: (x3 + FIELD_MODULUS) % FIELD_MODULUS,
    y: (y3 + FIELD_MODULUS) % FIELD_MODULUS
  };
}

function scalarMultiply(point, scalar) {
  scalar = ((scalar % CURVE_ORDER) + CURVE_ORDER) % CURVE_ORDER;
  
  if (scalar === 0n) return { x: 0n, y: 0n };
  if (scalar === 1n) return point;
  
  let result = { x: 0n, y: 0n };
  let addend = { ...point };
  
  while (scalar > 0n) {
    if (scalar & 1n) {
      result = addPoints(result, addend);
    }
    addend = addPoints(addend, addend);
    scalar = scalar >> 1n;
  }
  
  return result;
}

// Simular exactamente lo que hace el código real
function createPedersenCommitment(value, blindingFactorHex) {
  console.log('🔐 Creating BN254 Pedersen commitment...');
  
  const v = BigInt(value);
  const r = BigInt('0x' + blindingFactorHex);
  
  console.log('📊 Commitment inputs:', {
    value: v.toString(),
    blindingFactor: r.toString(16),
    generatorG: { x: G.x.toString(16), y: G.y.toString(16) },
    generatorH: { x: H.x.toString(16), y: H.y.toString(16) }
  });

  // Validar generadores
  if (!isOnCurve(G)) {
    throw new Error('Invalid G1 generator point');
  }
  
  if (!isOnCurve(H)) {
    throw new Error('Invalid H1 generator point');
  }

  // Calcular vG
  const vG = scalarMultiply(G, v);
  console.log('✅ vG computed:', { x: vG.x.toString(16), y: vG.y.toString(16) });

  // Calcular rH
  const rH = scalarMultiply(H, r);
  console.log('✅ rH computed:', { x: rH.x.toString(16), y: rH.y.toString(16) });

  // Sumar vG + rH
  const commitment = addPoints(vG, rH);
  console.log('✅ Commitment computed:', { x: commitment.x.toString(16), y: commitment.y.toString(16) });

  // Validar resultado
  if (!isOnCurve(commitment)) {
    throw new Error('Generated commitment is not a valid curve point');
  }

  // Serializar como hace el código real
  const commitmentHex = commitment.x.toString(16).padStart(64, '0') + commitment.y.toString(16).padStart(64, '0');

  return {
    pedersen_commitment: '0x' + commitmentHex,
    blinding_factor: blindingFactorHex
  };
}

// PRUEBA CON VALORES TÍPICOS
console.log('=== PRUEBA DIRECTA BN254 ===');

// Simular valores típicos de la aplicación
const testValue = '1000000000000000000'; // 1 ETH en wei
const testBlindingFactor = '123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01';

try {
  const result = createPedersenCommitment(testValue, testBlindingFactor);
  console.log('✅ SUCCESS - Commitment created:', {
    fullCommitment: result.pedersen_commitment,
    length: result.pedersen_commitment.length,
    blindingFactor: result.blinding_factor
  });

  // Simular validación exacta del código real
  const commitmentHex = result.pedersen_commitment.substring(2);
  const fullCommitmentX = BigInt('0x' + commitmentHex.substring(0, 64));
  const fullCommitmentY = BigInt('0x' + commitmentHex.substring(64, 128));

  console.log('🔍 Validation check:', {
    xInField: fullCommitmentX < FIELD_MODULUS,
    yInField: fullCommitmentY < FIELD_MODULUS,
    onCurve: isOnCurve({ x: fullCommitmentX, y: fullCommitmentY })
  });

} catch (error) {
  console.error('❌ FAILED:', error.message);
}

// PRUEBA CON BLINDING FACTOR ALEATORIO
console.log('\n=== PRUEBA CON BLINDING FACTOR ALEATORIO ===');

// Generar blinding factor como hace el código real
import { randomBytes } from 'crypto';
const randomBytesArray = randomBytes(32);
const randomBlindingFactor = Array.from(randomBytesArray, b => b.toString(16).padStart(2, '0')).join('');

try {
  const result2 = createPedersenCommitment(testValue, randomBlindingFactor);
  console.log('✅ SUCCESS - Random commitment created:', {
    fullCommitment: result2.pedersen_commitment.slice(0, 20) + '...',
    length: result2.pedersen_commitment.length
  });
} catch (error) {
  console.error('❌ FAILED with random blinding factor:', error.message);
}
