# Registro de Intentos de Entrega en Base de Datos

## 📋 Resumen

Sistema completo de persistencia de entregas de webhooks en **Supabase PostgreSQL**. Registra todos los intentos de entrega (exitosos y fallidos) incluyendo todos los metadatos relevantes para auditoría, análisis y debugging.

## 🎯 Características

✅ **Persistencia Completa**
- Registro de CADA intento de entrega (no solo el resultado final)
- Almacenamiento de request payload y response body
- Tracking de número de intento (1, 2, 3, etc.)
- Timestamps precisos con timezones

✅ **Doble Almacenamiento**
- Memoria: Para consultas rápidas en tiempo real
- Supabase: Para análisis histórico y auditoría

✅ **Fallback Automático**
- Si Supabase no está configurado, funciona 100% en memoria
- Degradación graceful sin errores

✅ **Estadísticas en Tiempo Real**
- Consultas directas a PostgreSQL para stats globales
- Agregaciones por suscripción
- Response time promedio, tasa de éxito, etc.

## 📐 Arquitectura

### Componentes Creados

```
SupabaseService
  ├── insertDelivery() - Inserta cada intento de entrega
  ├── getRecentDeliveries() - Últimas N entregas
  ├── getDeliveriesByEvent() - Entregas de un evento específico
  ├── getDeliveriesBySubscription() - Entregas de una suscripción
  ├── getDeliveryStatsBySubscription() - Stats por suscripción
  └── getGlobalDeliveryStats() - Stats globales

WebhookDeliveryService (Actualizado)
  ├── recordDelivery() - Ahora guarda en memoria Y Supabase
  ├── getRecentDeliveries() - Consulta Supabase primero, fallback a memoria
  ├── getDeliveriesByEvent() - Consulta Supabase primero
  ├── getDeliveriesBySubscription() - Consulta Supabase primero
  └── getDeliveryStats() - Calcula desde Supabase primero
```

### Esquema de Base de Datos

```sql
-- Tabla webhook_deliveries (actualizada)
CREATE TABLE webhook_deliveries (
    id BIGSERIAL PRIMARY KEY,
    subscription_id BIGINT REFERENCES webhook_subscriptions(id),
    event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    endpoint_url TEXT,                -- URL destino
    http_status INTEGER,              -- Código HTTP (200, 404, 500, etc.)
    success BOOLEAN NOT NULL,
    attempt_number INTEGER DEFAULT 1,  -- 1, 2, 3, etc.
    response_time_ms INTEGER,         -- Tiempo de respuesta en ms
    error_message TEXT,               -- Mensaje de error si falló
    request_payload JSONB,            -- Webhook completo enviado
    response_body JSONB,              -- Respuesta recibida
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX idx_webhook_deliveries_subscription_id ON webhook_deliveries(subscription_id);
CREATE INDEX idx_webhook_deliveries_event_id ON webhook_deliveries(event_id);
CREATE INDEX idx_webhook_deliveries_attempt_number ON webhook_deliveries(attempt_number);
CREATE INDEX idx_webhook_deliveries_created_at ON webhook_deliveries(created_at DESC);
```

## 🔧 Configuración

### 1. Variables de Entorno

```bash
# .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
# O usar service role key para operaciones administrativas
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. Aplicar Migraciones

```bash
# Aplicar migraciones a tu proyecto Supabase
cd supabase
npx supabase db push

# O ejecutar manualmente
psql postgresql://... < migrations/001_webhook_tables.sql
psql postgresql://... < migrations/002_webhook_deliveries_attempts.sql
```

### 3. Verificar Conexión

```bash
# Health check incluye estado de Supabase
curl http://localhost:3000/webhook/subscriptions/health/status

Response:
{
  "status": "ok",
  "subscriptions": { "total": 2, "active": 2 },
  "deliveries": {
    "total": 150,
    "successful": 142,
    "failed": 8,
    "successRate": "94.67%",
    "avgResponseTime": "245ms"
  },
  "dlq": { /* ... */ },
  "supabase": {
    "configured": true  ← Verifica que esté configurado
  }
}
```

## 💻 Flujo de Registro

### 1. Intento de Entrega con Retry

```typescript
// Usuario dispara evento
POST /prescripcion/registrar
{
  "paciente": "Juan Pérez",
  "medicamentos": [...]
}

// ↓ RabbitMQ listener recibe evento

// ↓ EventTransformer convierte a StandardWebhookDto

// ↓ WebhookDeliveryService.deliverWebhook()
//   - Filtra suscripciones aplicables

// ↓ WebhookSenderService.sendWebhook() para cada suscripción
//   - Intento 1: FALLO (ECONNREFUSED)
//     ↓ recordDelivery(attempt=1, success=false) → INSERTA EN DB
//     ↓ Espera 1s (exponential backoff)
//   
//   - Intento 2: FALLO (ETIMEDOUT)
//     ↓ recordDelivery(attempt=2, success=false) → INSERTA EN DB
//     ↓ Espera 2s
//   
//   - Intento 3: ÉXITO (HTTP 200)
//     ↓ recordDelivery(attempt=3, success=true) → INSERTA EN DB

// RESULTADO: 3 registros en webhook_deliveries
// - event_id: "evt_123", attempt_number: 1, success: false
// - event_id: "evt_123", attempt_number: 2, success: false
// - event_id: "evt_123", attempt_number: 3, success: true
```

### 2. Ejemplo de Registros en DB

```sql
SELECT 
  id,
  event_id,
  event_type,
  attempt_number,
  success,
  http_status,
  response_time_ms,
  error_message,
  created_at
FROM webhook_deliveries
WHERE event_id = 'evt_abc123'
ORDER BY attempt_number;
```

**Resultado**:
| id | event_id | event_type | attempt | success | http_status | response_time_ms | error_message | created_at |
|----|----------|------------|---------|---------|-------------|------------------|---------------|------------|
| 101 | evt_abc123 | producto.creado | 1 | false | null | 1024 | ECONNREFUSED | 2025-12-15 10:00:00 |
| 102 | evt_abc123 | producto.creado | 2 | false | 503 | 5230 | Service Unavailable | 2025-12-15 10:00:01 |
| 103 | evt_abc123 | producto.creado | 3 | true | 200 | 234 | null | 2025-12-15 10:00:03 |

## 📊 Consultas y Análisis

### 1. Ver Entregas Recientes

```bash
GET /webhook/subscriptions/deliveries/recent?limit=50

Response:
[
  {
    "id": "103",
    "subscriptionId": 1,
    "eventId": "evt_abc123",
    "eventType": "producto.creado",
    "success": true,
    "attempt": 3,
    "responseTime": 234,
    "statusCode": 200,
    "deliveredAt": "2025-12-15T10:00:03.456Z"
  },
  {
    "id": "102",
    "subscriptionId": 1,
    "eventId": "evt_abc123",
    "eventType": "producto.creado",
    "success": false,
    "attempt": 2,
    "responseTime": 5230,
    "statusCode": 503,
    "error": "Service Unavailable",
    "deliveredAt": "2025-12-15T10:00:01.234Z"
  },
  // ...
]
```

### 2. Ver Entregas de un Evento Específico

```bash
GET /webhook/subscriptions/deliveries/event/evt_abc123

# Retorna TODOS los intentos para ese evento
# Útil para debugging: "¿Por qué este webhook falló?"
```

### 3. Estadísticas Globales (desde DB)

```bash
GET /webhook/subscriptions/stats/global

Response:
{
  "total": 1250,
  "successful": 1180,
  "failed": 70,
  "avgResponseTime": 245,  // ms
  "successRate": 94.4,     // %
  "bySubscription": {
    "1": { "total": 800, "successful": 780, "failed": 20 },
    "2": { "total": 450, "successful": 400, "failed": 50 }
  }
}
```

### 4. Estadísticas por Suscripción

```bash
GET /webhook/subscriptions/1/stats

Response:
{
  "subscription": {
    "id": 1,
    "name": "Sistema de Notificaciones",
    "active": true
  },
  "stats": {
    "total": 800,
    "successful": 780,
    "failed": 20
  },
  "recentDeliveries": [ /* últimas 10 entregas */ ]
}
```

## 🔍 Análisis Avanzado con SQL

### 1. Tasa de Éxito por Intento

```sql
-- ¿Cuántos webhooks se recuperan en el 2do o 3er intento?
SELECT 
  attempt_number,
  COUNT(*) as total,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM webhook_deliveries
GROUP BY attempt_number
ORDER BY attempt_number;
```

**Resultado Ejemplo**:
| attempt | total | successful | success_rate |
|---------|-------|------------|--------------|
| 1 | 1000 | 850 | 85.00% |
| 2 | 150 | 100 | 66.67% |
| 3 | 50 | 30 | 60.00% |
| 4 | 20 | 10 | 50.00% |
| 5 | 10 | 5 | 50.00% |

**Análisis**: 85% de webhooks funcionan en el primer intento, 15% requieren reintentos.

### 2. Tipos de Errores Más Comunes

```sql
SELECT 
  error_message,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as percentage
FROM webhook_deliveries
WHERE success = false
GROUP BY error_message
ORDER BY count DESC
LIMIT 10;
```

### 3. Response Time por Suscripción

```sql
SELECT 
  s.name,
  COUNT(*) as total_deliveries,
  AVG(d.response_time_ms) as avg_response_time,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY d.response_time_ms) as p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY d.response_time_ms) as p95,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY d.response_time_ms) as p99
FROM webhook_deliveries d
JOIN webhook_subscriptions s ON d.subscription_id = s.id
WHERE d.success = true
GROUP BY s.id, s.name
ORDER BY avg_response_time DESC;
```

### 4. Eventos con Más Fallos

```sql
SELECT 
  event_id,
  event_type,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN success THEN 0 ELSE 1 END) as failed_attempts,
  MAX(attempt_number) as max_attempts_reached
FROM webhook_deliveries
GROUP BY event_id, event_type
HAVING SUM(CASE WHEN success THEN 0 ELSE 1 END) > 2
ORDER BY failed_attempts DESC
LIMIT 20;
```

### 5. Timeline de Entregas (últimas 24h)

```sql
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM webhook_deliveries
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;
```

## 🛠️ Limpieza y Mantenimiento

### Limpiar Entregas Antiguas

```sql
-- Eliminar entregas > 30 días
DELETE FROM webhook_deliveries
WHERE created_at < NOW() - INTERVAL '30 days';

-- O crear función automática
CREATE OR REPLACE FUNCTION cleanup_old_deliveries()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM webhook_deliveries
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Programar con pg_cron (extensión de Supabase)
SELECT cron.schedule(
    'cleanup-old-deliveries',
    '0 2 * * *',  -- 2 AM todos los días
    'SELECT cleanup_old_deliveries();'
);
```

## 📈 Métricas de Rendimiento

### Tamaño de Tabla

```sql
SELECT 
  pg_size_pretty(pg_total_relation_size('webhook_deliveries')) as total_size,
  COUNT(*) as total_rows,
  pg_size_pretty(pg_total_relation_size('webhook_deliveries') / COUNT(*)) as avg_row_size
FROM webhook_deliveries;
```

### Índices Utilizados

```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'webhook_deliveries'
ORDER BY idx_scan DESC;
```

## 🔒 Seguridad y Privacidad

### 1. Row Level Security (RLS)

```sql
-- Habilitar RLS
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Política: Solo leer tus propias suscripciones
CREATE POLICY "Users can view their own deliveries"
ON webhook_deliveries
FOR SELECT
USING (
  subscription_id IN (
    SELECT id FROM webhook_subscriptions
    WHERE organization_id = auth.jwt() ->> 'organization_id'
  )
);
```

### 2. Datos Sensibles

```typescript
// Opción: Enmascarar datos sensibles antes de guardar
await supabase.insertDelivery({
  // ...
  request_payload: maskSensitiveData(webhook),
  response_body: maskSensitiveData(response),
});

function maskSensitiveData(data: any): any {
  const masked = { ...data };
  if (masked.password) masked.password = '***';
  if (masked.apiKey) masked.apiKey = '***';
  if (masked.creditCard) masked.creditCard = '****-****-****-' + masked.creditCard.slice(-4);
  return masked;
}
```

## 🧪 Testing

### Test de Inserción

```typescript
describe('SupabaseService.insertDelivery', () => {
  it('debe insertar delivery correctamente', async () => {
    const result = await supabase.insertDelivery({
      subscription_id: 1,
      event_id: 'evt_test_123',
      event_type: 'test.event',
      endpoint_url: 'https://example.com/webhook',
      http_status: 200,
      success: true,
      attempt_number: 1,
      response_time_ms: 150,
      error_message: null,
      request_payload: { test: true },
      response_body: { ok: true },
    });

    expect(result).toBeDefined();
    expect(result.event_id).toBe('evt_test_123');
  });
});
```

### Test de Fallback

```typescript
it('debe funcionar sin Supabase configurado', async () => {
  // Sin SUPABASE_URL en environment
  const service = new WebhookDeliveryService(/* ... */);
  
  // Debe funcionar en memoria
  const deliveries = await service.getRecentDeliveries(10);
  expect(deliveries).toBeDefined();
  expect(Array.isArray(deliveries)).toBe(true);
});
```

## 📚 Ventajas del Sistema

### 1. Auditoría Completa
- Cada intento registrado con timestamp preciso
- Payload completo del request
- Response body para debugging
- Trazabilidad total para compliance

### 2. Análisis de Fallos
```sql
-- ¿Por qué falló este webhook específico?
SELECT * FROM webhook_deliveries 
WHERE event_id = 'evt_problematico'
ORDER BY attempt_number;

-- Ver payload exacto que se envió
SELECT request_payload FROM webhook_deliveries 
WHERE id = 12345;
```

### 3. Optimización de Reintentos
```sql
-- ¿Vale la pena hacer más de 3 intentos?
SELECT 
  COUNT(DISTINCT event_id) as recovered_events
FROM webhook_deliveries
WHERE attempt_number > 3 AND success = true;
```

### 4. Monitoreo de SLAs
```sql
-- Webhooks que tardaron > 5 segundos
SELECT * FROM webhook_deliveries
WHERE response_time_ms > 5000
ORDER BY created_at DESC;
```

---

**Implementado**: Diciembre 2025  
**Versión**: 1.0.0  
**Base de Datos**: Supabase PostgreSQL  
**Mantenedor**: Sistema de Webhooks
