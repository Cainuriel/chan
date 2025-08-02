/**
 * Script de prueba para verificar la estimación de gas en Amoy
 */

// Simulación de una estimación de gas para split en Amoy
function testAmoyGasEstimation() {
  console.log('🧪 === PRUEBA DE ESTIMACIÓN DE GAS PARA AMOY ===');
  
  // Simular parámetros de split típicos
  const mockSplitParams = {
    outputNullifiers: ['0x123...', '0x456...'], // 2 outputs
    inputCommitment: '0xabc...',
    proof: '0xdef...'
  };
  
  const outputCount = mockSplitParams.outputNullifiers.length;
  console.log(`📊 Número de outputs: ${outputCount}`);
  
  // Simular estimación nativa del contrato
  console.log('\n⛽ === ESTIMACIÓN NATIVA (SIMULADA) ===');
  const mockNativeGas = BigInt(280000); // Gas típico para split con 2 outputs
  console.log(`Gas nativo estimado: ${mockNativeGas.toString()}`);
  
  // Aplicar margen de seguridad del 40% para Amoy
  const gasWithMargin = (mockNativeGas * BigInt(140)) / BigInt(100);
  console.log(`Gas con margen (40%): ${gasWithMargin.toString()}`);
  console.log(`Diferencia: +${(gasWithMargin - mockNativeGas).toString()} gas`);
  
  // Simular fallback basado en outputs
  console.log('\n🔄 === FALLBACK BASADO EN OUTPUTS ===');
  const baseGas = BigInt(300000);
  const gasPerOutput = BigInt(100000);
  const calculatedGas = baseGas + (gasPerOutput * BigInt(outputCount));
  
  console.log(`Gas base: ${baseGas.toString()}`);
  console.log(`Gas por output: ${gasPerOutput.toString()}`);
  console.log(`Gas calculado total: ${calculatedGas.toString()}`);
  
  // Comparación de estrategias
  console.log('\n📈 === COMPARACIÓN DE ESTRATEGIAS ===');
  console.log(`Estimación nativa + margen: ${gasWithMargin.toString()}`);
  console.log(`Cálculo por outputs: ${calculatedGas.toString()}`);
  
  const recommendedGas = gasWithMargin > calculatedGas ? gasWithMargin : calculatedGas;
  console.log(`🎯 Gas recomendado: ${recommendedGas.toString()}`);
  
  // Simular gas price optimizado
  console.log('\n💰 === GAS PRICE OPTIMIZADO ===');
  const mockBaseGasPrice = BigInt('20000000000'); // 20 gwei
  const optimizedGasPrice = (mockBaseGasPrice * BigInt(150)) / BigInt(100); // +50%
  
  console.log(`Gas price base: ${mockBaseGasPrice.toString()} wei (${mockBaseGasPrice / BigInt(1000000000)}gwei)`);
  console.log(`Gas price optimizado: ${optimizedGasPrice.toString()} wei (${optimizedGasPrice / BigInt(1000000000)}gwei)`);
  
  // Costo total estimado
  const totalCost = recommendedGas * optimizedGasPrice;
  const costInEth = Number(totalCost) / Math.pow(10, 18);
  
  console.log('\n💸 === COSTO TOTAL ESTIMADO ===');
  console.log(`Costo total: ${totalCost.toString()} wei`);
  console.log(`Costo en ETH: ~${costInEth.toFixed(6)} ETH`);
  console.log(`Costo en USD (ETH@$2000): ~$${(costInEth * 2000).toFixed(4)}`);
  
  console.log('\n✅ === CONFIGURACIÓN DE TRANSACCIÓN ===');
  const txConfig = {
    gasLimit: recommendedGas.toString(),
    gasPrice: optimizedGasPrice.toString(),
    network: 'amoy',
    strategy: gasWithMargin > calculatedGas ? 'native+margin' : 'calculated'
  };
  
  console.log('Configuración final:', JSON.stringify(txConfig, null, 2));
  
  return txConfig;
}

// Ejecutar prueba
if (typeof window === 'undefined') {
  // Node.js environment
  testAmoyGasEstimation();
} else {
  // Browser environment
  window.testAmoyGasEstimation = testAmoyGasEstimation;
  console.log('🌐 Función testAmoyGasEstimation() disponible en la consola del navegador');
}
