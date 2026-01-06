# 🔒 Firma HMAC-SHA256 en Sistema de Transformación de Eventos

## 📋 Resumen

Se ha implementado la **firma automática de payloads con HMAC-SHA256** en el sistema de transformación de eventos, proporcionando seguridad y autenticidad a todos los webhooks generados.

---

## 🎯 Características Implementadas

✅ **Firma Automática** - Todos los eventos transformados incluyen firma HMAC-SHA256
✅ **Validación de Firma** - API para validar firmas de webhooks recibidos
✅ **Re-firmado** - Capacidad de re-firmar webhooks para reenvíos
✅ **Prevención de Replay Attacks** - Timestamp incluido en la firma
✅ **Timing Attack Protection** - Comparación segura de firmas
✅ **Headers Estándar** - Firma incluida en header `X-Webhook-Signature`

---

## 🔐 Cómo Funciona

### Proceso de Firmado

```
1. TRANSFORMACIÓN DE EVENTO
   ↓
   Evento interno → StandardWebhookDto
   {
     metadata: { ... },
     payload: { ... },
     context: { ... },
     links: { ... }
   }

2. GENERACIÓN DE FIRMA
   ↓
   dataToSign = JSON.stringify(webhook)
   timestamp = Date.parse(metadata.timestamp)
   signatureData = `${timestamp}.${dataToSign}`
   
   ↓
   HMAC-SHA256 con secret key
   ↓
   signature = "sha256=a1b2c3d4e5f6..."

3. INCLUSIÓN EN HEADERS
   ↓
   headers: {
     ...otherHeaders,
     'X-Webhook-Signature': 'sha256=a1b2c3d4...'
   }

4. WEBHOOK COMPLETO
   ↓
   {
     metadata: { ... },
     payload: { ... },
     headers: {
       'X-Webhook-Signature': 'sha256=...',
       ...
     }
   }
```

---

## 🔑 Configuración de Secret Key

### Variables de Entorno

```bash
# .env
WEBHOOK_SECRET=tu-secret-key-super-segura-aqui

# Generar una clave segura (recomendado)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### ⚠️ Importante

- **Nunca** expongas tu secret key en código
- Usa diferentes claves para desarrollo, staging y producción
- Rota la clave periódicamente
- Mínimo 32 caracteres de longitud
- Usa caracteres alfanuméricos y especiales

---

## 📊 Formato de Firma

### Header HTTP

```http
X-Webhook-Signature: sha256=a1b2c3d4e5f67890abcdef1234567890fedcba09876543210abcdef12345678
```

### Estructura

```
algoritmo=firma_hexadecimal

algoritmo: "sha256"
firma: hash HMAC-SHA256 en formato hexadecimal (64 caracteres)
```

### Datos Firmados

```javascript
// Se firma TODO excepto los headers
{
  metadata: {
    eventId: "evt_abc123",
    eventType: "producto.creado",
    timestamp: "2025-12-15T10:30:00.000Z",
    ...
  },
  payload: {
    id: "prod_123",
    nombre: "Aspirina",
    ...
  },
  context: { ... },  // opcional
  links: { ... }     // opcional
}

// Con timestamp para prevenir replay
signatureData = `${timestamp}.${JSON.stringify(webhookData)}`
```

---

## 🚀 Uso del Sistema

### 1. Transformación con Firma Automática

Los eventos se firman **automáticamente** al transformar:

```bash
curl -X POST http://localhost:3001/events/transform \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt_123",
    "eventType": "producto.creado",
    "payload": { "id": "prod_123", "nombre": "Aspirina" }
  }'
```

**Respuesta incluye firma:**

```json
{
  "webhook": {
    "metadata": { ... },
    "payload": { ... },
    "headers": {
      "X-Webhook-Signature": "sha256=a1b2c3d4e5f67890...",
      "X-Event-ID": "evt_123",
      ...
    }
  },
  "transformationInfo": {
    "appliedRules": [
      "standard_format",
      "metadata_extraction",
      "headers_generation",
      "hmac_signature",  ← NUEVO
      ...
    ]
  }
}
```

### 2. Validar Firma de Webhook Recibido

```bash
curl -X POST http://localhost:3001/events/transform/validate-signature \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "metadata": {
        "eventId": "evt_123",
        "eventType": "producto.creado",
        "timestamp": "2025-12-15T10:30:00.000Z",
        "correlationId": "corr_abc"
      },
      "payload": { "id": "prod_123" },
      "headers": {
        "X-Webhook-Signature": "sha256=a1b2c3d4..."
      }
    }
  }'
```

**Respuesta:**

```json
{
  "valid": true,
  "message": "Firma HMAC válida",
  "eventId": "evt_123"
}
```

### 3. Validar Firma con Signature Personalizada

```bash
curl -X POST http://localhost:3001/events/transform/validate-signature \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": { ... },
    "signature": "sha256=firma_recibida_externamente"
  }'
```

### 4. Re-firmar Webhook

Útil cuando necesitas reenviar un webhook:

```bash
curl -X POST http://localhost:3001/events/transform/resign \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": { ... },
    "payload": { ... },
    "headers": { ... }
  }'
```

**Respuesta:**

```json
{
  "webhook": {
    "metadata": { ... },
    "payload": { ... },
    "headers": {
      "X-Webhook-Signature": "sha256=nueva_firma_generada...",
      ...
    }
  },
  "message": "Webhook re-firmado exitosamente"
}
```

### 5. Validación Completa de Formato + Firma

```bash
curl -X POST http://localhost:3001/events/transform/validate \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": { ... },
    "payload": { ... },
    "headers": {
      "X-Webhook-Signature": "sha256=...",
      ...
    }
  }'
```

**Respuesta:**

```json
{
  "valid": true,
  "errors": [],
  "warnings": [],
  "hmacValid": true  ← Incluye validación de firma
}
```

---

## 💻 Consumir Webhooks con Firma HMAC

### Ejemplo en Node.js

```javascript
const crypto = require('crypto');
const express = require('express');

const app = express();
app.use(express.json());

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

function validateWebhookSignature(webhook, receivedSignature) {
  // 1. Reconstruir datos firmados (sin headers)
  const dataToSign = {
    metadata: webhook.metadata,
    payload: webhook.payload,
    context: webhook.context,
    links: webhook.links,
  };

  // 2. Incluir timestamp
  const timestamp = Date.parse(webhook.metadata.timestamp);
  const signatureData = `${timestamp}.${JSON.stringify(dataToSign)}`;

  // 3. Calcular HMAC esperado
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(signatureData);
  const expectedSignature = `sha256=${hmac.digest('hex')}`;

  // 4. Comparar de forma segura (timing attack safe)
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(receivedSignature)
  );
}

app.post('/webhook', (req, res) => {
  const webhook = req.body;
  const signature = req.headers['x-webhook-signature'];

  // Validar firma
  if (!validateWebhookSignature(webhook, signature)) {
    return res.status(401).json({ error: 'Firma inválida' });
  }

  // Procesar webhook
  console.log('Webhook válido:', webhook.metadata.eventType);
  
  res.status(200).json({ received: true });
});

app.listen(3000, () => {
  console.log('Webhook receiver listening on port 3000');
});
```

### Ejemplo en Python

```python
import hmac
import hashlib
import json
from datetime import datetime
from flask import Flask, request, jsonify

app = Flask(__name__)
WEBHOOK_SECRET = 'your-secret-key'.encode('utf-8')

def validate_webhook_signature(webhook, received_signature):
    # 1. Reconstruir datos firmados
    data_to_sign = {
        'metadata': webhook['metadata'],
        'payload': webhook['payload'],
        'context': webhook.get('context'),
        'links': webhook.get('links')
    }
    
    # 2. Incluir timestamp
    timestamp = int(datetime.fromisoformat(
        webhook['metadata']['timestamp'].replace('Z', '+00:00')
    ).timestamp() * 1000)
    
    signature_data = f"{timestamp}.{json.dumps(data_to_sign, separators=(',', ':'))}"
    
    # 3. Calcular HMAC
    hmac_obj = hmac.new(WEBHOOK_SECRET, signature_data.encode('utf-8'), hashlib.sha256)
    expected_signature = f"sha256={hmac_obj.hexdigest()}"
    
    # 4. Comparar de forma segura
    return hmac.compare_digest(expected_signature, received_signature)

@app.route('/webhook', methods=['POST'])
def webhook():
    webhook_data = request.json
    signature = request.headers.get('X-Webhook-Signature')
    
    # Validar firma
    if not validate_webhook_signature(webhook_data, signature):
        return jsonify({'error': 'Firma inválida'}), 401
    
    # Procesar webhook
    print(f"Webhook válido: {webhook_data['metadata']['eventType']}")
    
    return jsonify({'received': True}), 200

if __name__ == '__main__':
    app.run(port=3000)
```

---

## 🔍 Seguridad

### Prevención de Replay Attacks

La firma incluye el timestamp del evento:

```javascript
// Validar antigüedad del webhook
const eventTimestamp = Date.parse(webhook.metadata.timestamp);
const now = Date.now();
const maxAge = 5 * 60 * 1000; // 5 minutos

if (now - eventTimestamp > maxAge) {
  return res.status(400).json({ error: 'Webhook expirado' });
}
```

### Timing Attack Protection

El servicio HMAC usa `crypto.timingSafeEqual()` para comparaciones seguras.

### Best Practices

✅ **Valida SIEMPRE la firma** antes de procesar el webhook
✅ **Verifica el timestamp** para prevenir replay attacks
✅ **Usa HTTPS** en producción
✅ **Rota las claves** periódicamente
✅ **Loguea fallos** de validación para detectar ataques
✅ **Rate limiting** en endpoints de webhook

---

## 📊 Logs Generados

### Al Transformar (Firma Generada)

```json
{
  "timestamp": "2025-12-15T10:30:00.123Z",
  "level": "info",
  "message": "Evento transformado exitosamente",
  "correlationId": "corr_abc123",
  "metadata": {
    "eventId": "evt_123",
    "eventType": "producto.creado",
    "duration": 5,
    "validated": true
  }
}
```

### Al Validar Firma (Exitosa)

```json
{
  "timestamp": "2025-12-15T10:30:05.456Z",
  "level": "info",
  "message": "Firma HMAC validada exitosamente",
  "correlationId": "corr_abc123",
  "metadata": {
    "eventId": "evt_123"
  }
}
```

### Al Validar Firma (Fallida)

```json
{
  "timestamp": "2025-12-15T10:30:05.789Z",
  "level": "warn",
  "message": "Firma HMAC inválida",
  "correlationId": "corr_abc123",
  "metadata": {
    "eventId": "evt_123"
  }
}
```

---

## 🧪 Testing de Firmas

### Test con curl

```bash
# 1. Transformar evento y obtener firma
RESPONSE=$(curl -s -X POST http://localhost:3001/events/transform \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt_test",
    "eventType": "producto.creado",
    "payload": {"id": "prod_test"}
  }')

# 2. Extraer webhook y firma
WEBHOOK=$(echo $RESPONSE | jq '.webhook')
SIGNATURE=$(echo $RESPONSE | jq -r '.webhook.headers["X-Webhook-Signature"]')

# 3. Validar firma
curl -X POST http://localhost:3001/events/transform/validate-signature \
  -H "Content-Type: application/json" \
  -d "{\"webhook\": $WEBHOOK, \"signature\": \"$SIGNATURE\"}"
```

### Test Unitario

```typescript
import { Test } from '@nestjs/testing';
import { EventTransformerService } from './event-transformer.service';
import { HmacSignatureService } from './hmac-signature.service';

describe('HMAC Signature', () => {
  let service: EventTransformerService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [EventTransformerService, HmacSignatureService, ...],
    }).compile();

    service = module.get<EventTransformerService>(EventTransformerService);
  });

  it('debe generar y validar firma HMAC correctamente', async () => {
    // 1. Transformar evento
    const result = await service.transformToStandardWebhook({
      eventId: 'evt_test',
      eventType: 'producto.creado',
      payload: { id: 'prod_test' },
    });

    // 2. Verificar que tiene firma
    expect(result.webhook.headers['X-Webhook-Signature']).toBeDefined();
    expect(result.webhook.headers['X-Webhook-Signature']).toMatch(/^sha256=/);

    // 3. Validar firma
    const isValid = service.validateWebhookSignature(result.webhook);
    expect(isValid).toBe(true);
  });

  it('debe detectar firma inválida', async () => {
    const webhook = {
      metadata: { ... },
      payload: { ... },
      headers: {
        'X-Webhook-Signature': 'sha256=firmainvalida123',
      },
    };

    const isValid = service.validateWebhookSignature(webhook);
    expect(isValid).toBe(false);
  });
});
```

---

## 📈 Métricas

### Métricas Disponibles

- **Firmas generadas**: Total de firmas HMAC creadas
- **Firmas validadas**: Total de validaciones exitosas
- **Firmas rechazadas**: Total de validaciones fallidas
- **Tiempo de firmado**: Duración promedio (~1-2ms)
- **Tiempo de validación**: Duración promedio (~1-2ms)

### Monitoreo

```bash
# Ver estadísticas
curl http://localhost:3001/events/transform/stats

# Ver logs de firmas
grep "HMAC" logs/application.log | tail -20
```

---

## ✅ Checklist de Implementación

- [x] Integración de HmacSignatureService en EventTransformerService
- [x] Generación automática de firma al transformar eventos
- [x] Inclusión de firma en header X-Webhook-Signature
- [x] Timestamp incluido en datos firmados
- [x] Endpoint para validar firmas (POST /events/transform/validate-signature)
- [x] Endpoint para re-firmar webhooks (POST /events/transform/resign)
- [x] Validación de firma en endpoint general (POST /events/transform/validate)
- [x] DTO actualizado con firma obligatoria
- [x] Logs estructurados de firmado y validación
- [x] Regla 'hmac_signature' en appliedRules
- [x] Documentación completa
- [x] Ejemplos de consumo en Node.js y Python

---

## 🎉 Conclusión

El sistema ahora firma **automáticamente todos los webhooks** con HMAC-SHA256, proporcionando:

✅ **Autenticidad** - Verifica que el webhook proviene de tu sistema
✅ **Integridad** - Detecta cualquier modificación del payload
✅ **Seguridad** - Previene replay attacks y timing attacks
✅ **Estándar** - Compatible con prácticas de la industria (GitHub, Stripe, etc.)

**Total agregado: ~200 líneas de código funcional**

🔒 **Todos los webhooks ahora incluyen firma HMAC-SHA256!**
