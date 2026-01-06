# 🔐 Generación y Validación de Firma HMAC

## Descripción General

Este sistema implementa un mecanismo robusto de **autenticación y validación de webhooks** usando **firmas HMAC-SHA256**. Garantiza que todos los webhooks recibidos:

- ✅ Provienen de una fuente autenticada
- ✅ No han sido modificados en tránsito
- ✅ No son ataques de replay (usando timestamps)
- ✅ Son procesados una sola vez (idempotencia)

---

## 🏗️ Arquitectura

### Componentes Implementados

1. **HmacSignatureService** - Servicio principal para generación y validación
2. **WebhookController** - Controlador con endpoints de recepción
3. **HmacValidationMiddleware** - Middleware para validación automática
4. **WebhookModule** - Módulo de NestJS que integra todos los componentes

```
┌─────────────────────────────────────────────────────────┐
│                 Sistema Emisor de Webhook                │
│  1. Genera payload                                       │
│  2. Crea firma HMAC: HMAC-SHA256(payload, secret)      │
│  3. Envía: POST /webhook con headers de firma           │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTP POST
                     ▼
┌─────────────────────────────────────────────────────────┐
│              HmacValidationMiddleware (opcional)         │
│  - Extrae headers: X-Webhook-Signature, X-Timestamp     │
│  - Valida firma automáticamente                         │
│  - Rechaza si es inválida (401)                         │
└────────────────────┬────────────────────────────────────┘
                     │ Si válido
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  WebhookController                       │
│  1. Valida estructura del payload                       │
│  2. Verifica firma HMAC                                 │
│  3. Verifica idempotencia (evento ya procesado?)        │
│  4. Procesa lógica de negocio                          │
│  5. Marca evento como procesado                         │
│  6. Responde 200 OK (< 30s)                            │
└─────────────────────────────────────────────────────────┘
```

---

## 🔑 ¿Cómo Funciona HMAC?

### Generación de Firma (Emisor)

```typescript
// 1. Serializar payload a JSON
const payloadString = JSON.stringify(payload);

// 2. Incluir timestamp para prevenir replay attacks
const dataToSign = `${timestamp}.${payloadString}`;

// 3. Generar HMAC-SHA256
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(dataToSign)
  .digest('hex');

// 4. Formato final: "sha256=abc123def456..."
const finalSignature = `sha256=${signature}`;
```

### Validación de Firma (Receptor)

```typescript
// 1. Recibir payload y firma del header
const receivedSignature = headers['x-webhook-signature'];
const timestamp = parseInt(headers['x-webhook-timestamp']);

// 2. Validar timestamp (máx. 5 minutos de diferencia)
const drift = Math.abs(Date.now() - timestamp);
if (drift > 300000) return false; // 5 min en ms

// 3. Regenerar firma con mismo algoritmo
const expectedSignature = generateSignature(payload, timestamp);

// 4. Comparación segura (tiempo constante)
return crypto.timingSafeEqual(
  Buffer.from(receivedSignature),
  Buffer.from(expectedSignature)
);
```

---

## 📦 Instalación y Configuración

### 1. Variables de Entorno

Crear archivo `.env`:

```bash
# Clave secreta para HMAC (mínimo 32 caracteres)
WEBHOOK_SECRET=tu-clave-secreta-super-segura-de-256-bits
```

**⚠️ IMPORTANTE:**
- Usa una clave de **mínimo 32 caracteres**
- Genera con: `openssl rand -hex 32`
- **NUNCA** la subas a Git
- Rótala periódicamente (cada 90 días)

### 2. Importar Módulo

En `app.module.ts`:

```typescript
import { Module, MiddlewareConsumer } from '@nestjs/common';
import { WebhookModule } from './webhook/webhook.module';
import { HmacValidationMiddleware } from './webhook/hmac-validation.middleware';

@Module({
  imports: [
    WebhookModule,
    // ... otros módulos
  ],
})
export class AppModule {
  // Opcional: Aplicar middleware globalmente a rutas de webhook
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(HmacValidationMiddleware)
      .forRoutes('webhook/*');
  }
}
```

### 3. Iniciar Aplicación

```bash
# Instalar dependencias
npm install

# Desarrollo
npm run start:dev

# Producción
npm run build
npm run start:prod
```

---

## 🚀 Uso

### Opción A: Con Middleware Automático

El middleware valida automáticamente todas las solicitudes a `/webhook/*`:

```typescript
// Configuración en app.module.ts
configure(consumer: MiddlewareConsumer) {
  consumer
    .apply(HmacValidationMiddleware)
    .forRoutes('webhook/*');
}
```

El controlador solo procesa lógica de negocio:

```typescript
@Post('prescripcion')
async handlePrescripcionWebhook(@Body() payload: any) {
  // La firma ya fue validada por el middleware
  await this.processPrescripcion(payload);
  return { status: 'success' };
}
```

### Opción B: Validación Manual en Controlador

Si no usas middleware:

```typescript
@Post('prescripcion')
async handlePrescripcionWebhook(
  @Body() payload: any,
  @Headers('x-webhook-signature') signature: string,
  @Headers('x-webhook-timestamp') timestamp: string,
) {
  // Validar firma manualmente
  const timestampNum = parseInt(timestamp);
  if (!this.hmacService.validateSignature(payload, signature, timestampNum)) {
    throw new HttpException('Firma inválida', HttpStatus.UNAUTHORIZED);
  }

  // Procesar webhook
  await this.processPrescripcion(payload);
  return { status: 'success' };
}
```

---

## 🧪 Testing

### 1. Generar Firma para Testing

```bash
# Endpoint helper para generar firmas
POST http://localhost:3002/webhook/generate-signature
Content-Type: application/json

{
  "event_type": "prescripcion.registrada",
  "event_id": "test-123",
  "data": { ... }
}

# Respuesta incluye:
# - Firma HMAC generada
# - Headers necesarios
# - Comando curl de ejemplo
```

### 2. Usar REST Client (VS Code)

Instalar extensión: **REST Client**

Abrir: [webhook-hmac-tests.http](webhook-hmac-tests.http)

Ejecutar tests con: `Ctrl+Alt+R` (o clic en "Send Request")

### 3. Usar curl

```bash
# Test con firma válida (primero genera la firma)
curl -X POST http://localhost:3002/webhook/prescripcion \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: sha256=FIRMA_AQUI" \
  -H "X-Webhook-Timestamp: 1734259800000" \
  -H "X-Event-ID: test-123" \
  -d '{"event_type":"prescripcion.registrada","event_id":"test-123","data":{}}'

# Test sin firma (debe retornar 401)
curl -X POST http://localhost:3002/webhook/prescripcion \
  -H "Content-Type: application/json" \
  -d '{"event_type":"prescripcion.registrada","event_id":"test-456","data":{}}'
```

### 4. Casos de Prueba Implementados

| # | Caso | Resultado Esperado |
|---|------|-------------------|
| 1 | Firma válida | 200 OK |
| 2 | Sin firma | 401 Unauthorized |
| 3 | Firma inválida | 401 Unauthorized |
| 4 | Timestamp expirado (>5 min) | 401 Unauthorized |
| 5 | Evento duplicado | 200 OK (status: duplicate) |
| 6 | Payload sin event_type | 400 Bad Request |
| 7 | Tipo de evento incorrecto | 400 Bad Request |

---

## 🔒 Características de Seguridad

### 1. Protección contra Timing Attacks

Usa `crypto.timingSafeEqual()` para comparación de firmas en tiempo constante:

```typescript
// ❌ INSEGURO: vulnerable a timing attacks
if (receivedSignature === expectedSignature) { ... }

// ✅ SEGURO: tiempo constante
crypto.timingSafeEqual(
  Buffer.from(receivedSignature),
  Buffer.from(expectedSignature)
);
```

### 2. Prevención de Replay Attacks

Validación de timestamp:

```typescript
const maxDrift = 5 * 60 * 1000; // 5 minutos
const drift = Math.abs(Date.now() - timestamp);
if (drift > maxDrift) {
  return false; // Timestamp muy antiguo o futuro
}
```

### 3. Idempotencia

Evita procesar el mismo evento múltiples veces:

```typescript
if (this.isEventProcessed(eventId)) {
  return { status: 'duplicate' };
}

// Procesar evento...

this.markEventAsProcessed(eventId);
```

**Producción:** Usar Redis con TTL de 7 días:
```typescript
await redis.setex(`webhook:processed:${eventId}`, 604800, '1');
```

### 4. Rotación de Claves

Soporta validación con clave anterior durante transición:

```typescript
const isValid = hmacService.validateWithKeyRotation(
  oldSecret,
  newSecret,
  payload,
  signature
);
```

**Proceso de rotación:**
1. Generar nueva clave: `openssl rand -hex 32`
2. Configurar `NEW_WEBHOOK_SECRET` en servidor
3. Notificar a emisores de webhooks
4. Periodo de transición: validar con ambas claves (7 días)
5. Remover clave antigua

---

## 📊 Monitoreo y Logs

### Logs Estructurados

El servicio emite logs detallados:

```
[HmacSignatureService] Firma generada para payload de 1024 bytes
[HmacSignatureService] Firma HMAC validada exitosamente
[HmacValidationMiddleware] Firma validada exitosamente para evento: test-123
[WebhookController] Procesando prescripcion.registrada: prescripcion-123
```

### Logs de Seguridad (Advertencias)

```
[HmacSignatureService] ⚠️ Usando clave secreta por defecto
[HmacValidationMiddleware] Webhook sin firma rechazado
[HmacValidationMiddleware] Firma inválida para evento: test-456
[WebhookController] Evento duplicado ignorado: prescripcion-789
```

### Métricas Recomendadas

Implementar contadores para:

- `webhooks.received` - Total recibidos
- `webhooks.signature_valid` - Firmas válidas
- `webhooks.signature_invalid` - Firmas inválidas
- `webhooks.timestamp_expired` - Timestamps expirados
- `webhooks.duplicates` - Eventos duplicados
- `webhooks.processed` - Procesados exitosamente
- `webhooks.failed` - Fallidos

---

## 🛡️ Buenas Prácticas

### Para Emisores de Webhooks

1. **Generar firma correctamente:**
   ```typescript
   const signature = hmacService.generateSignature(payload, Date.now());
   ```

2. **Incluir headers obligatorios:**
   ```typescript
   headers: {
     'Content-Type': 'application/json',
     'X-Webhook-Signature': signature,
     'X-Webhook-Timestamp': timestamp,
     'X-Event-ID': eventId,
   }
   ```

3. **Implementar reintentos exponenciales:**
   - 1º intento: inmediato
   - 2º intento: +5s
   - 3º intento: +15s
   - 4º intento: +1min
   - Máx: 5 intentos

4. **Timeout de 30 segundos**

### Para Receptores de Webhooks

1. **Responder rápidamente (< 30s):**
   ```typescript
   // Responder inmediatamente
   res.status(200).json({ status: 'received' });
   
   // Procesar en background
   await queue.add('process-webhook', payload);
   ```

2. **Validar siempre la firma:**
   - No confiar en headers User-Agent
   - No confiar en IP de origen
   - Solo confiar en firma HMAC

3. **Implementar idempotencia:**
   - Redis con TTL de 7 días
   - Verificar `event_id` antes de procesar

4. **Logs de seguridad:**
   - Registrar firmas inválidas
   - Alertar si hay patrones sospechosos

---

## 🔧 Solución de Problemas

### Error: "Firma inválida"

**Causas posibles:**

1. **Clave secreta incorrecta**
   ```bash
   # Verificar .env
   echo $WEBHOOK_SECRET
   ```

2. **Payload modificado en tránsito**
   - Verificar que no haya proxies que modifiquen el body
   - Verificar Content-Type: application/json

3. **Orden de serialización JSON diferente**
   ```typescript
   // Emisor y receptor deben usar JSON.stringify() canónico
   const payload = JSON.stringify(data);
   ```

4. **Timestamp incluido incorrectamente**
   ```typescript
   // Emisor y receptor deben incluir timestamp igual
   const dataToSign = `${timestamp}.${payload}`;
   ```

### Error: "Timestamp fuera de rango válido"

**Solución:** Sincronizar relojes con NTP:

```bash
# Linux
sudo ntpdate pool.ntp.org

# Windows
w32tm /resync
```

### Error: "Evento duplicado"

**Normal:** Es la idempotencia funcionando correctamente.

Si es un evento nuevo pero con `event_id` reutilizado, generar ID único:

```typescript
const eventId = `${eventType}-${uniqueId}-${Date.now()}`;
```

---

## 📚 Referencias

- **HMAC (RFC 2104):** https://tools.ietf.org/html/rfc2104
- **SHA-256:** https://en.wikipedia.org/wiki/SHA-2
- **Webhook Security Best Practices:** https://webhooks.fyi/security/hmac
- **NestJS Middleware:** https://docs.nestjs.com/middleware
- **crypto.timingSafeEqual():** https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b

---

## 📄 Licencia

Este código es parte del proyecto de práctica de microservicios.

---

## 👥 Soporte

Para dudas o problemas:
1. Revisar logs del servicio
2. Ejecutar tests en [webhook-hmac-tests.http](webhook-hmac-tests.http)
3. Verificar health check: `GET /webhook/health`
