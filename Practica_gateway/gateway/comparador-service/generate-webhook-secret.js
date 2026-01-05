#!/usr/bin/env node

/**
 * Script de Utilidad para Generación de Claves HMAC
 * 
 * Uso:
 *   node generate-webhook-secret.js
 */

const crypto = require('crypto');

console.log('\n🔐 Generador de Clave Secreta para Webhooks HMAC\n');
console.log('='.repeat(60));

// Generar clave secreta de 32 bytes (256 bits)
const secret = crypto.randomBytes(32).toString('hex');

console.log('\n✅ Clave generada exitosamente:\n');
console.log(`WEBHOOK_SECRET=${secret}`);
console.log('\n' + '='.repeat(60));

console.log('\n📝 Pasos siguientes:\n');
console.log('1. Copia la línea WEBHOOK_SECRET=... arriba');
console.log('2. Agrégala a tu archivo .env');
console.log('3. Reinicia tu servidor NestJS');
console.log('4. Guarda esta clave de forma segura (KMS, vault, etc.)');
console.log('5. Compártela solo con sistemas autorizados');

console.log('\n⚠️  Recordatorios de Seguridad:\n');
console.log('❌ NUNCA subas esta clave a Git');
console.log('❌ NUNCA la expongas en logs');
console.log('❌ NUNCA la incluyas en código fuente');
console.log('✅ Rótala cada 90 días');
console.log('✅ Usa diferentes claves por ambiente (dev, staging, prod)');

console.log('\n💡 Para generar otra clave, ejecuta este script de nuevo.\n');

// Ejemplo de uso
console.log('='.repeat(60));
console.log('\n📖 Ejemplo de uso en código:\n');

const examplePayload = {
  event_type: 'test.event',
  event_id: 'test-123',
  timestamp: new Date().toISOString(),
  data: { message: 'Hello, World!' }
};

const timestamp = Date.now();
const dataToSign = `${timestamp}.${JSON.stringify(examplePayload)}`;
const signature = crypto
  .createHmac('sha256', secret)
  .update(dataToSign)
  .digest('hex');

console.log('```javascript');
console.log('// Generar firma:');
console.log('const payload = ' + JSON.stringify(examplePayload, null, 2) + ';');
console.log('const timestamp = Date.now();');
console.log('const signature = hmacService.generateSignature(payload, timestamp);');
console.log('');
console.log('// Resultado:');
console.log(`// signature: "sha256=${signature}"`);
console.log(`// timestamp: ${timestamp}`);
console.log('```\n');
