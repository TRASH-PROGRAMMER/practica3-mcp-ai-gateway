/**
 * Ejemplo de Emisor de Webhooks con Firma HMAC
 * 
 * Este ejemplo muestra cómo enviar webhooks a un sistema externo
 * con firma HMAC-SHA256 para autenticación.
 * 
 * Uso:
 *   node webhook-sender.example.js
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');

// ==================================================
// CONFIGURACIÓN
// ==================================================

const CONFIG = {
  // URL del endpoint de webhook
  webhookUrl: 'http://localhost:3002/webhook/prescripcion',
  
  // Clave secreta (debe ser la misma en emisor y receptor)
  webhookSecret: process.env.WEBHOOK_SECRET || 'default-secret-key',
  
  // Configuración de reintentos
  maxRetries: 3,
  retryDelays: [5000, 15000, 60000], // 5s, 15s, 1min
};

// ==================================================
// FUNCIONES DE UTILIDAD
// ==================================================

/**
 * Genera firma HMAC-SHA256 para un payload
 */
function generateHmacSignature(payload, timestamp, secret) {
  const payloadString = JSON.stringify(payload);
  const dataToSign = `${timestamp}.${payloadString}`;
  
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(dataToSign);
  const signature = hmac.digest('hex');
  
  return `sha256=${signature}`;
}

/**
 * Genera headers completos para el webhook
 */
function generateWebhookHeaders(payload, signature, timestamp) {
  return {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
    'X-Webhook-Timestamp': timestamp.toString(),
    'X-Event-ID': payload.event_id,
    'X-Webhook-Version': '1.0.0',
    'User-Agent': 'WebhookSender/1.0',
  };
}

/**
 * Envía el webhook con firma HMAC
 */
async function sendWebhook(payload, url = CONFIG.webhookUrl) {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const signature = generateHmacSignature(payload, timestamp, CONFIG.webhookSecret);
    const headers = generateWebhookHeaders(payload, signature, timestamp);
    const payloadString = JSON.stringify(payload);
    
    // Parse URL
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(payloadString),
      },
      timeout: 30000, // 30 segundos
    };
    
    console.log(`\n📤 Enviando webhook a: ${url}`);
    console.log(`📝 Event ID: ${payload.event_id}`);
    console.log(`🔐 Firma: ${signature.substring(0, 20)}...`);
    console.log(`⏰ Timestamp: ${timestamp}`);
    
    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ Webhook enviado exitosamente (${res.statusCode})`);
          try {
            const response = JSON.parse(data);
            console.log(`📥 Respuesta:`, response);
            resolve(response);
          } catch (e) {
            resolve(data);
          }
        } else {
          console.error(`❌ Error: HTTP ${res.statusCode}`);
          console.error(`📥 Respuesta:`, data);
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`❌ Error enviando webhook:`, error.message);
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      const error = new Error('Timeout de 30 segundos excedido');
      console.error(`❌ ${error.message}`);
      reject(error);
    });
    
    req.write(payloadString);
    req.end();
  });
}

/**
 * Envía webhook con reintentos exponenciales
 */
async function sendWebhookWithRetry(payload, maxRetries = CONFIG.maxRetries) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await sendWebhook(payload);
      return response;
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = CONFIG.retryDelays[attempt] || 60000;
        console.log(`⏳ Reintentando en ${delay/1000}s... (intento ${attempt + 2}/${maxRetries + 1})`);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Utilidad para esperar
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================================================
// EJEMPLOS DE PAYLOADS
// ==================================================

/**
 * Ejemplo 1: Prescripción Registrada
 */
function createPrescripcionPayload() {
  return {
    event_type: 'prescripcion.registrada',
    event_id: `prescripcion-${Math.floor(Math.random() * 1000)}-${Date.now()}`,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    source: 'comparador-service',
    data: {
      id_prescripcion: Math.floor(Math.random() * 1000),
      id_paciente: 456,
      nombre_paciente: 'Juan Pérez',
      id_medico: 789,
      nombre_medico: 'Dra. María García',
      diagnostico: 'Hipertensión arterial',
      medicamentos: [
        {
          id_producto: 101,
          nombre_comercial: 'Losartán 50mg',
          dosis: '1 tableta',
          frecuencia: 'cada 12 horas',
          duracion_dias: 30,
        },
        {
          id_producto: 102,
          nombre_comercial: 'Hidroclorotiazida 25mg',
          dosis: '1 tableta',
          frecuencia: 'cada 24 horas',
          duracion_dias: 30,
        },
      ],
      fecha_emision: new Date().toISOString(),
      estado: 'activa',
    },
    metadata: {
      correlation_id: `corr-${Date.now()}`,
      user_id: 789,
      ip_address: '192.168.1.100',
      user_agent: 'Mozilla/5.0...',
    },
  };
}

/**
 * Ejemplo 2: Comparación Realizada
 */
function createComparacionPayload() {
  return {
    event_type: 'comparacion.realizada',
    event_id: `comparacion-${Math.floor(Math.random() * 1000)}-${Date.now()}`,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    source: 'comparador-service',
    data: {
      id_comparacion: Math.floor(Math.random() * 1000),
      id_producto: 101,
      nombre_producto: 'Losartán 50mg',
      id_usuario: 123,
      farmacias_comparadas: 5,
      precio_min: 15.50,
      precio_max: 25.00,
      precio_promedio: 19.75,
      ahorro_potencial: 38.0,
      fecha_comparacion: new Date().toISOString(),
    },
  };
}

// ==================================================
// EJECUTAR EJEMPLO
// ==================================================

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 Emisor de Webhooks con Firma HMAC - Ejemplo');
  console.log('='.repeat(70));
  
  try {
    // Ejemplo 1: Enviar prescripción
    console.log('\n📋 Ejemplo 1: Enviando webhook de prescripción...');
    const prescripcionPayload = createPrescripcionPayload();
    await sendWebhookWithRetry(prescripcionPayload);
    
    // Esperar 2 segundos
    await sleep(2000);
    
    // Ejemplo 2: Enviar comparación
    console.log('\n📊 Ejemplo 2: Enviando webhook de comparación...');
    const comparacionPayload = createComparacionPayload();
    await sendWebhookWithRetry(comparacionPayload, CONFIG.webhookUrl.replace('/prescripcion', '/comparacion'));
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ Todos los webhooks enviados exitosamente');
    console.log('='.repeat(70) + '\n');
    
  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ Error enviando webhooks:', error.message);
    console.error('='.repeat(70) + '\n');
    process.exit(1);
  }
}

// Ejecutar si se ejecuta directamente
if (require.main === module) {
  main().catch(console.error);
}

// Exportar para uso en otros módulos
module.exports = {
  sendWebhook,
  sendWebhookWithRetry,
  generateHmacSignature,
  generateWebhookHeaders,
  createPrescripcionPayload,
  createComparacionPayload,
};
