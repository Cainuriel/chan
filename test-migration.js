// test-migration.js - Script para ejecutar test de migración
import { testMigration } from './src/utils/migration.test.ts';

console.log('🚀 Starting migration test...\n');

testMigration().then(result => {
  console.log(`\n📊 Test Result: ${result ? '✅ SUCCESS' : '❌ FAILED'}`);
  process.exit(result ? 0 : 1);
}).catch(error => {
  console.error('💥 Test execution failed:', error);
  process.exit(1);
});
