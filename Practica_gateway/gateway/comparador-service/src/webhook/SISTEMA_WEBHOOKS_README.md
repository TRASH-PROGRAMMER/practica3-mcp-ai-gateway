# Sistema de Webhooks Empresarial - Documentación Completa

## 📋 Tabla de Contenidos

1. [Características](#características)
2. [Arquitectura](#arquitectura)
3. [Componentes](#componentes)
4. [Seguridad](#seguridad)
5. [Uso](#uso)
6. [Administración](#administración)
7. [Funciones Serverless](#funciones-serverless)
8. [Despliegue](#despliegue)

---

## ✨ Características

### ✅ Seguridad
- **Validación HMAC-SHA256**: Todas las solicitudes deben incluir firma válida
- **Anti-Replay Protection**: Timestamps con ventana de 5 minutos
- **Timing-Safe Comparison**: Protección contra timing attacks

### ✅ Confiabilidad
- **Idempotencia**: Previene procesamiento duplicado de eventos
- **Circuit Breaker**: Protege endpoints externos de sobrecarga
- **Dead Letter Queue**: Reintentos automáticos con backoff exponencial
- **Graceful Degradation**: Fallo controlado sin afectar el sistema

### ✅ Observabilidad
- **Correlation IDs**: Trazabilidad distribuida entre servicios
- **Logs Estructurados**: JSON logs para análisis automatizado
- **Métricas de Rendimiento**: P50, P95, P99, tasa de éxito
- **Dashboards**: Panel de control unificado

### ✅ Escalabilidad
- **Procesamiento Asíncrono**: Webhooks procesados sin bloquear
- **Funciones Serverless**: Escala automática sin gestión de infraestructura
- **Rate Limiting**: Protección contra abuso (opcional)

---

## 🏗️ Arquitectura

```
┌─────────────────┐
│  Sistema Ext.   │
│   (Emisor)      │
└────────┬────────┘
         │ POST + HMAC
         ↓
┌────────────────────────────────────────┐
│         NestJS Webhook Receiver        │
│  ┌──────────────────────────────────┐  │
│  │  1. HMAC Validation Middleware   │  │
│  │     ✓ Firma + Timestamp          │  │
│  └──────────────┬───────────────────┘  │
│                 ↓                       │
│  ┌──────────────────────────────────┐  │
│  │  2. Idempotency Check            │  │
│  │     ✓ Event ID único             │  │
│  └──────────────┬───────────────────┘  │
│                 ↓                       │
│  ┌──────────────────────────────────┐  │
│  │  3. Business Logic Processing    │  │
│  │     ✓ Circuit Breaker            │  │
│  │     ✓ Observability              │  │
│  └──────────────┬───────────────────┘  │
│                 ↓                       │
│  ┌──────────────────────────────────┐  │
│  │  4. Response + DLQ (si falla)    │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
         │
         ↓
┌────────────────────────────────────────┐
│      Supabase Edge Functions           │
│  ┌──────────────┐  ┌────────────────┐  │
│  │ Event Logger │  │ Ext. Notifier  │  │
│  │  ✓ Valida    │  │  ✓ Envía con   │  │
│  │    HMAC      │  │    HMAC        │  │
│  │  ✓ Registra  │  │  ✓ Reintentos  │  │
│  │    en DB     │  │                │  │
│  └──────────────┘  └────────────────┘  │
└────────────────────────────────────────┘
```

---

## 🔧 Componentes

### 1. HMAC Signature Service

**Ubicación**: `src/webhook/hmac-signature.service.ts`

Genera y valida firmas HMAC-SHA256.

```typescript
// Generar firma
const signature = hmacService.generateSignature(payload, Date.now());

// Validar firma
const isValid = hmacService.validateSignature(payload, signature, timestamp);
```

**Características**:
- Algoritmo: SHA-256
- Formato: `sha256=hexstring`
- Anti-replay: Timestamp con ventana de 5 minutos
- Timing-safe comparison

---

### 2. Idempotency Service

**Ubicación**: `src/webhook/idempotency.service.ts`

Previene procesamiento duplicado usando claves de idempotencia.

```typescript
// Verificar si ya fue procesado
const processed = await idempotencyService.isProcessed(eventId);

// Marcar como procesando (lock optimista)
const canProcess = await idempotencyService.markAsProcessing(eventId, payload);

// Marcar como completado
await idempotencyService.markAsCompleted(eventId, response);
```

**Características**:
- TTL: 24 horas
- Cache en memoria + persistencia (opcional)
- Detección de concurrencia
- Respuestas cacheadas

---

### 3. Circuit Breaker Service

**Ubicación**: `src/webhook/circuit-breaker.service.ts`

Protege endpoints externos con patrón Circuit Breaker.

```typescript
// Ejecutar con circuit breaker
const result = await circuitBreaker.execute(
  'external-api',
  async () => {
    return await fetch('https://api.external.com/...');
  }
);
```

**Estados**:
- **CLOSED**: Funcionamiento normal
- **OPEN**: Rechaza peticiones (servicio caído)
- **HALF_OPEN**: Probando recuperación

**Configuración**:
```typescript
{
  failureThreshold: 5,      // Fallos para abrir
  successThreshold: 2,      // Éxitos para cerrar
  timeout: 60000,           // 60s antes de half-open
  resetTimeout: 300000,     // 5min para reset
}
```

---

### 4. Dead Letter Queue Service

**Ubicación**: `src/webhook/dead-letter-queue.service.ts`

Gestiona webhooks fallidos con reintentos automáticos.

```typescript
// Agregar a DLQ
await dlq.addToQueue(eventId, eventType, payload, error);

// Reintento manual
await dlq.manualRetry(eventId);

// Descartar mensaje
await dlq.discardMessage(eventId, 'Razón...');
```

**Estrategia de Reintentos**:
- Intento 1: 5 segundos
- Intento 2: 15 segundos
- Intento 3: 60 segundos
- Máximo: 5 intentos

**Backoff Exponencial**:
```
delay = initialDelay * (multiplier ^ (attempt - 1))
```

---

### 5. Observability Service

**Ubicación**: `src/webhook/observability.service.ts`

Sistema completo de observabilidad.

```typescript
// Log estructurado
observability.info('Procesando evento', { eventId, type });

// Medir operación
const result = await observability.measureOperation(
  'webhook.process',
  async () => {
    // ... lógica
  }
);

// Obtener correlation headers
const headers = observability.getPropagatetionHeaders();
```

**Características**:
- Correlation IDs (X-Correlation-ID)
- Logs estructurados JSON
- Métricas: duración, success rate, percentiles
- Context propagation

---

## 🔒 Seguridad

### Generar Secreto HMAC

```bash
node generate-webhook-secret.js
```

Esto genera un secreto de 256 bits:
```
WEBHOOK_SECRET=a1b2c3d4e5f6...
```

### Configurar Variables de Entorno

```bash
# .env
WEBHOOK_SECRET=tu-secreto-generado-aqui
```

### Validación de Webhooks

Todos los webhooks deben incluir estos headers:

```http
POST /webhook/prescripcion
Content-Type: application/json
X-Webhook-Signature: sha256=a1b2c3d4...
X-Webhook-Timestamp: 1702652400000
X-Event-ID: evt-123-abc
```

### Anti-Replay Protection

- Timestamp debe estar dentro de ±5 minutos
- Previene replay attacks
- Firma incluye timestamp: `HMAC(timestamp.payload)`

---

## 🚀 Uso

### 1. Iniciar Servidor

```bash
cd gateway/comparador-service
npm install
npm run start:dev
```

### 2. Enviar Webhook de Prueba

```bash
# Generar firma
curl -X POST http://localhost:3002/webhook/generate-signature \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "prescripcion.registrada",
    "event_id": "evt-test-123",
    "data": {
      "id_prescripcion": 1,
      "nombre_paciente": "Juan Pérez"
    }
  }'

# Usar la firma generada
curl -X POST http://localhost:3002/webhook/prescripcion \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: sha256=..." \
  -H "X-Webhook-Timestamp: 1702652400000" \
  -H "X-Event-ID: evt-test-123" \
  -d '{...payload...}'
```

### 3. Verificar Health

```bash
curl http://localhost:3002/webhook/health
```

Respuesta:
```json
{
  "status": "ok",
  "timestamp": "2025-12-15T...",
  "hmac": { "healthy": true },
  "idempotency": { "totalKeys": 5, "processing": 1, ... },
  "circuitBreaker": { "external-api": { "state": "CLOSED", ... } },
  "deadLetterQueue": { "total": 2, "pending": 1, ... }
}
```

---

## 🎛️ Administración

### Endpoints de Admin

Base URL: `/webhook/admin`

#### Dead Letter Queue

```bash
# Listar todos los mensajes
GET /webhook/admin/dlq

# Por estado
GET /webhook/admin/dlq/status/exhausted

# Reintento manual
POST /webhook/admin/dlq/{eventId}/retry

# Descartar mensaje
POST /webhook/admin/dlq/{eventId}/discard
Body: { "reason": "Mensaje inválido" }

# Estadísticas
GET /webhook/admin/dlq-stats
```

#### Circuit Breakers

```bash
# Listar todos
GET /webhook/admin/circuit-breakers

# Específico
GET /webhook/admin/circuit-breakers/external-api

# Resetear
POST /webhook/admin/circuit-breakers/external-api/reset

# Forzar cierre
POST /webhook/admin/circuit-breakers/external-api/close

# Forzar apertura (mantenimiento)
POST /webhook/admin/circuit-breakers/external-api/open
```

#### Métricas

```bash
# Todas las métricas
GET /webhook/admin/metrics

# Operación específica
GET /webhook/admin/metrics/webhook.prescripcion

# Dashboard consolidado
GET /webhook/admin/dashboard
```

---

## ☁️ Funciones Serverless

### 1. Event Logger (Supabase Edge Function)

**Ubicación**: `supabase/functions/webhook-event-logger/index.ts`

Registra todos los eventos de webhook en Supabase.

**Características**:
- Validación HMAC entrante
- Detección de duplicados
- Métricas de rendimiento
- Almacenamiento en PostgreSQL

**Deploy**:
```bash
# Configurar secretos
npx supabase secrets set WEBHOOK_SECRET=tu-secreto

# Deploy
npx supabase functions deploy webhook-event-logger
```

**Invocar**:
```bash
curl -X POST https://tu-proyecto.supabase.co/functions/v1/webhook-event-logger \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "X-Webhook-Signature: sha256=..." \
  -H "X-Webhook-Timestamp: 1702652400000" \
  -d '{...payload...}'
```

---

### 2. External Notifier (Supabase Edge Function)

**Ubicación**: `supabase/functions/webhook-external-notifier/index.ts`

Envía webhooks a sistemas externos con reintentos.

**Características**:
- Generación HMAC para webhooks salientes
- Reintentos con backoff exponencial
- Registro de entregas
- Suscripciones configurables

**Configuración de Suscripciones**:
```sql
INSERT INTO webhook_subscriptions (name, endpoint_url, secret, events) VALUES
(
  'Sistema Externo',
  'https://api.external.com/webhooks',
  'secret-ext-123',
  ARRAY['prescripcion.registrada', 'comparacion.realizada']
);
```

**Deploy**:
```bash
npx supabase functions deploy webhook-external-notifier
```

---

## 📊 Base de Datos (Supabase)

### Esquema

```sql
-- Eventos recibidos
webhook_events (
  id, event_id, event_type, payload,
  signature, timestamp, processed_at, status
)

-- Métricas
webhook_metrics (
  id, event_type, processing_time_ms,
  success, timestamp, metadata
)

-- Suscripciones
webhook_subscriptions (
  id, name, endpoint_url, secret,
  events[], active, retry_config
)

-- Entregas
webhook_deliveries (
  id, subscription_id, event_id,
  success, response, error, delivered_at
)
```

### Migración

```bash
cd supabase
npx supabase db push
```

---

## 🚢 Despliegue

### Variables de Entorno Requeridas

```env
# NestJS
WEBHOOK_SECRET=secreto-hmac-256-bits
NODE_ENV=production

# Supabase (para funciones)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
WEBHOOK_SECRET=mismo-secreto-que-nestjs
```

### Docker

```bash
# Build
docker build -t webhook-service .

# Run
docker run -p 3002:3002 \
  -e WEBHOOK_SECRET=tu-secreto \
  webhook-service
```

### Supabase Functions

```bash
# Login
npx supabase login

# Link proyecto
npx supabase link --project-ref tu-proyecto-ref

# Configurar secretos
npx supabase secrets set WEBHOOK_SECRET=tu-secreto

# Deploy todas las funciones
npx supabase functions deploy
```

---

## 📈 Monitoreo

### Métricas Clave

1. **Tasa de Éxito**: `successful_webhooks / total_webhooks`
2. **Latencia P95**: Percentil 95 de tiempo de procesamiento
3. **DLQ Size**: Número de mensajes en cola de fallos
4. **Circuit Breaker State**: Estado de cada circuito

### Alertas Recomendadas

- DLQ > 10 mensajes
- Tasa de éxito < 95%
- Latencia P95 > 5 segundos
- Circuit Breaker OPEN

---

## 🔍 Troubleshooting

### Error: "Invalid HMAC signature"

✅ **Solución**:
1. Verificar que el secreto es el mismo en emisor y receptor
2. Comprobar que timestamp está dentro de ±5 minutos
3. Verificar formato: `sha256=hexstring`

### Error: "Circuit breaker is OPEN"

✅ **Solución**:
1. Verificar que el servicio externo está disponible
2. Revisar logs del circuit breaker
3. Resetear manualmente: `POST /webhook/admin/circuit-breakers/{name}/reset`

### Mensajes atascados en DLQ

✅ **Solución**:
1. Revisar el error: `GET /webhook/admin/dlq/{eventId}`
2. Corregir el problema raíz
3. Reintento manual: `POST /webhook/admin/dlq/{eventId}/retry`
4. O descartar: `POST /webhook/admin/dlq/{eventId}/discard`

---

## 📚 Referencias

- [HMAC RFC](https://datatracker.ietf.org/doc/html/rfc2104)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Idempotency](https://stripe.com/docs/api/idempotent_requests)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

---

## 👨‍💻 Desarrollo

### Tests

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

### Estructura de Archivos

```
src/webhook/
├── hmac-signature.service.ts        # Generación/validación HMAC
├── idempotency.service.ts           # Prevención duplicados
├── circuit-breaker.service.ts       # Protección endpoints
├── dead-letter-queue.service.ts     # Reintentos automáticos
├── observability.service.ts         # Logs y métricas
├── webhook.controller.ts            # Endpoints principales
├── webhook-admin.controller.ts      # Endpoints de admin
├── webhook.module.ts                # Módulo NestJS
└── README.md                        # Esta documentación
```

---

**Última actualización**: 15 de diciembre de 2025
