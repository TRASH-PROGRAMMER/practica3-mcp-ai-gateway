# IDEMPOTENT CONSUMER PATTERN

## El Problema

**RabbitMQ garantiza "At-least-once delivery", no "Exactly-once".**

```
┌─────────────────────────────────────────────────────────────────┐
│  ESCENARIO DE DUPLICACIÓN DE MENSAJES                           │
└─────────────────────────────────────────────────────────────────┘

1. Producer → RabbitMQ: Publica mensaje "pago_123"
2. RabbitMQ → Consumer: Entrega mensaje
3. Consumer: Procesa mensaje (registra pago en BD)
4. Consumer → RabbitMQ: Envía ACK
   ❌ FALLA LA RED ANTES DE QUE RABBITMQ RECIBA EL ACK
5. RabbitMQ: No recibió ACK, asume fallo
6. RabbitMQ → Consumer: REENVÍA EL MISMO MENSAJE
7. Consumer: Procesa mensaje NUEVAMENTE
   🔥 PAGO DUPLICADO EN BASE DE DATOS
```

### Consecuencias Sin Idempotencia:
- ❌ Pagos procesados múltiples veces
- ❌ Inventario decrementado incorrectamente
- ❌ Notificaciones duplicadas a usuarios
- ❌ Inconsistencias en base de datos
- ❌ Pérdidas económicas

## La Solución: Idempotent Consumer

**Garantizar que el efecto en la base de datos ocurra exactamente una vez, aunque el mensaje llegue múltiples veces.**

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                     FLUJO CON IDEMPOTENCIA                      │
└─────────────────────────────────────────────────────────────────┘

                 ┌──────────────────┐
                 │   RabbitMQ Queue │
                 │  (at-least-once) │
                 └─────────┬────────┘
                           │
                           ▼
                 ┌──────────────────┐
                 │  RabbitMQ Listener│
                 │  @EventPattern    │
                 └─────────┬────────┘
                           │
                           ▼
          ┌────────────────────────────────────┐
          │  1. GENERAR IDEMPOTENCY KEY       │
          │                                    │
          │  Key = event_type + entity_id     │
          │        + action + context          │
          │                                    │
          │  Ejemplo:                          │
          │  "idempotency:producto.creado:    │
          │   123:process:a1b2c3d4"           │
          └────────────────┬──────────────────┘
                           │
                           ▼
          ┌────────────────────────────────────┐
          │  2. VERIFICAR SI YA SE PROCESÓ     │
          │                                    │
          │  SELECT * FROM processed_keys     │
          │  WHERE key_hash = 'abc123...'     │
          └────────────────┬──────────────────┘
                           │
                ┌──────────┴──────────┐
                │                     │
                ▼                     ▼
       ┌────────────┐       ┌────────────┐
       │  DUPLICADO │       │   NUEVO    │
       │   DETECTADO│       │  MENSAJE   │
       └──────┬─────┘       └──────┬─────┘
              │                    │
              ▼                    ▼
       ┌────────────┐       ┌────────────┐
       │ ACK mensaje│       │ PROCESAR   │
       │ Omitir     │       │ Mensaje    │
       │ procesamiento│     └──────┬─────┘
       │            │              │
       │ Retornar   │              ▼
       │ resultado  │       ┌────────────┐
       │ original   │       │ MARCAR COMO│
       └────────────┘       │ PROCESADO  │
                            │            │
                            │ INSERT key │
                            │ + result   │
                            └──────┬─────┘
                                   │
                                   ▼
                            ┌────────────┐
                            │ ACK mensaje│
                            └────────────┘
```

## Implementación

### 1. Servicio de Idempotencia

**Archivo**: [src/events/idempotency.service.ts](../gateway/comparador-service/src/events/idempotency.service.ts)

#### Generar Clave de Idempotencia:

```typescript
const key = await idempotency.generateKey(
  'producto.creado',  // event_type
  '123',              // entity_id
  'process',          // action
  {                   // additional_context
    eventId: 'evt_abc',
    timestamp: '2025-12-15T10:30:00Z'
  }
);

// Resultado:
{
  key: "idempotency:producto.creado:123:process:a1b2c3d4",
  hash: "3f8a9b...",  // SHA-256 del key
  components: {
    eventType: "producto.creado",
    entityId: "123",
    action: "process"
  },
  expiresAt: "2025-12-22T10:30:00Z"  // TTL 7 días
}
```

#### Verificar Duplicados:

```typescript
const check = await idempotency.isDuplicate(key);

if (check.isDuplicate) {
  logger.warn('Mensaje duplicado', {
    originalProcessedAt: check.existingKey.processedAt,
    timeSince: Date.now() - check.existingKey.processedAt
  });
  
  // Retornar resultado original sin reprocesar
  return check.existingKey.result;
}
```

#### Marcar como Procesado:

```typescript
// Antes de procesar
await idempotency.markProcessed(key);

// Procesamiento...
const result = await processMessage(data);

// Actualizar con resultado
await idempotency.markProcessed(key, result);
```

### 2. Integración con RabbitMQ Listener

**Archivo**: [src/events/rabbitmq-event-listener.service.ts](../gateway/comparador-service/src/events/rabbitmq-event-listener.service.ts)

```typescript
@EventPattern('producto.creado')
async handleProductoCreado(
  @Payload() data: RabbitMQEvent,
  @Ctx() context: RmqContext,
) {
  const channel = context.getChannelRef();
  const originalMsg = context.getMessage();

  try {
    // ============================================
    // VERIFICACIÓN DE IDEMPOTENCIA
    // ============================================
    const idempotencyKey = await this.idempotency.generateKey(
      'producto.creado',
      data.payload?.id || data.eventId,
      'process',
      {
        eventId: data.eventId,
        timestamp: data.timestamp,
      }
    );

    const idempotencyCheck = await this.idempotency.isDuplicate(
      idempotencyKey
    );

    if (idempotencyCheck.isDuplicate) {
      this.logger.warn('Mensaje duplicado, omitiendo', {
        eventId: data.eventId,
        originalProcessedAt: idempotencyCheck.existingKey?.processedAt,
      });

      // ACK mensaje sin reprocesar
      channel.ack(originalMsg);

      return {
        status: 'duplicate',
        originalResult: idempotencyCheck.existingKey?.result,
      };
    }

    // Marcar como procesando
    await this.idempotency.markProcessed(idempotencyKey);

    // ============================================
    // PROCESAMIENTO NORMAL
    // ============================================
    const result = await this.processProductoCreado(data);

    // Actualizar con resultado
    await this.idempotency.markProcessed(idempotencyKey, {
      status: 'success',
      result,
    });

    // ACK mensaje
    channel.ack(originalMsg);

    return { status: 'success', result };

  } catch (error) {
    // NACK con requeue si es error temporal
    const shouldRequeue = this.shouldRequeue(error);
    channel.nack(originalMsg, false, shouldRequeue);
    throw error;
  }
}
```

## Configuración

### TTL (Time To Live)

Por defecto: **7 días**

```typescript
// En idempotency.service.ts
private readonly config: IdempotencyConfig = {
  ttlDays: 7,  // Ajustar según necesidad
  keyPrefix: 'idempotency',
};
```

### Limpieza Automática

El servicio ejecuta limpieza cada **1 hora**:

```typescript
constructor() {
  // Limpieza cada 1 hora
  setInterval(() => this.cleanupExpiredKeys(), 60 * 60 * 1000);
}
```

## Endpoints API

### GET /idempotency/stats

Obtener estadísticas del servicio:

```bash
curl http://localhost:3001/idempotency/stats
```

**Respuesta:**
```json
{
  "status": "active",
  "timestamp": "2025-12-15T10:30:00.000Z",
  "stats": {
    "totalKeys": 1543,
    "expiredKeys": 12,
    "activeKeys": 1531,
    "oldestKey": "2025-12-08T10:30:00.000Z",
    "newestKey": "2025-12-15T10:29:59.000Z"
  }
}
```

### POST /idempotency/check

Verificar si una clave fue procesada:

```bash
curl -X POST http://localhost:3001/idempotency/check \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "producto.creado",
    "entityId": "123",
    "action": "process"
  }'
```

**Respuesta (no duplicado):**
```json
{
  "key": "idempotency:producto.creado:123:process",
  "hash": "3f8a9b...",
  "check": {
    "isDuplicate": false,
    "message": "Mensaje no procesado, proceder"
  }
}
```

**Respuesta (duplicado):**
```json
{
  "key": "idempotency:producto.creado:123:process",
  "hash": "3f8a9b...",
  "check": {
    "isDuplicate": true,
    "existingKey": {
      "key": "idempotency:producto.creado:123:process",
      "processedAt": "2025-12-15T09:15:00.000Z",
      "result": { "status": "success" },
      "expiresAt": "2025-12-22T09:15:00.000Z"
    },
    "message": "Mensaje ya procesado previamente"
  }
}
```

### POST /idempotency/cleanup

Limpiar claves expiradas manualmente:

```bash
curl -X POST http://localhost:3001/idempotency/cleanup
```

**Respuesta:**
```json
{
  "status": "success",
  "deletedCount": 12,
  "timestamp": "2025-12-15T10:30:00.000Z"
}
```

### DELETE /idempotency/reset

Resetear store (solo para testing):

```bash
curl -X DELETE http://localhost:3001/idempotency/reset
```

## Testing

### Probar Deduplicación

1. **Enviar mensaje a RabbitMQ:**
```typescript
await rabbitClient.emit('producto.creado', {
  eventId: 'evt_test_001',
  eventType: 'producto.creado',
  payload: { id: 123, nombre: 'Producto Test' },
  timestamp: new Date().toISOString(),
});
```

2. **Primera ejecución:**
```
✅ Mensaje procesado exitosamente
   Idempotency Key: idempotency:producto.creado:123:process
```

3. **Enviar el mismo mensaje nuevamente:**
```
⚠️  Mensaje duplicado detectado
   Tiempo desde procesamiento original: 5234ms
   Omitiendo procesamiento
   Retornando resultado original
```

### Verificar en Logs

```json
{
  "level": "warn",
  "message": "Mensaje duplicado detectado, omitiendo procesamiento",
  "eventId": "evt_test_001",
  "eventType": "producto.creado",
  "idempotencyKey": "idempotency:producto.creado:123:process:a1b2c3d4",
  "originalProcessedAt": "2025-12-15T10:25:00.000Z",
  "timeSinceProcessing": 5234
}
```

## Métricas

### Monitoreo de Deduplicación

```typescript
// Contador de duplicados detectados
metrics.duplicatesDetected.inc({
  eventType: 'producto.creado',
  entityId: '123'
});

// Histograma de tiempo entre duplicados
metrics.duplicateInterval.observe(
  timeSinceOriginalProcessing
);
```

### Alertas Recomendadas

1. **Alta tasa de duplicados** (>10% del total):
   - Indica problemas de red o configuración de RabbitMQ
   - Revisar timeouts de ACK

2. **Claves que nunca expiran**:
   - TTL demasiado largo
   - Limpieza automática no funcionando

3. **Store de idempotencia muy grande**:
   - Reducir TTL
   - Aumentar frecuencia de limpieza

## Ventajas

✅ **Exactly-Once Semantics**: Garantiza procesamiento único
✅ **Sin Duplicados en BD**: Protege integridad de datos
✅ **Transparente**: Consumidores no cambian lógica
✅ **Persistente**: Sobrevive reinicios (con PostgreSQL)
✅ **TTL Automático**: Limpieza de claves antiguas
✅ **Bajo Overhead**: Verificación rápida con hash SHA-256

## Limitaciones

⚠️ **In-Memory Store Actual**: Implementación usa Map de JavaScript
  - No persiste entre reinicios
  - Limitado a memoria del proceso
  - Solo para desarrollo/testing

🔄 **Solución Recomendada para Producción**:
  - Migrar a PostgreSQL/Supabase
  - Usar tabla `processed_webhooks` existente
  - Atomicidad con transacciones SQL

## Migración a PostgreSQL

### Próximos Pasos:

1. **Usar tabla existente** `processed_webhooks`:
```sql
-- Ya está creada en 004_webhook_registry_complete.sql
CREATE TABLE processed_webhooks (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100),
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    result JSONB
);
```

2. **Actualizar IdempotencyService**:
```typescript
// Reemplazar Map por consultas SQL
async isDuplicate(key: IdempotencyKey): Promise<boolean> {
  const { data } = await supabase
    .from('processed_webhooks')
    .select('*')
    .eq('event_id', key.hash)
    .single();
  
  return !!data;
}
```

3. **Atomicidad con UPSERT**:
```sql
INSERT INTO processed_webhooks (event_id, event_type, result)
VALUES ($1, $2, $3)
ON CONFLICT (event_id) DO NOTHING
RETURNING *;

-- Si retorna registro: primera vez (procesar)
-- Si no retorna nada: duplicado (omitir)
```

## Resumen

El patrón **Idempotent Consumer** protege contra:
- 🔥 Procesamiento duplicado de pagos
- 🔥 Doble decremento de inventario
- 🔥 Notificaciones múltiples
- 🔥 Inconsistencias de datos

**Garantizando**:
- ✅ Exactly-once processing
- ✅ Integridad de datos
- ✅ Resiliencia ante fallos de red
- ✅ Compatible con at-least-once delivery de RabbitMQ

**Estado Actual**:
- ✅ Implementado con In-Memory store
- ✅ Integrado en RabbitMQ listeners
- ✅ API REST para monitoreo
- ✅ Limpieza automática con TTL
- ⏳ Pendiente: Migración a PostgreSQL para producción
