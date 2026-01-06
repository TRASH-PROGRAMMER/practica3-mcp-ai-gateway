# 🎯 Guía Rápida: Endpoints del Sistema

## 📊 Dashboard y Monitoreo

### Dashboard Principal
```http
GET /webhook/dashboard
```
**Descripción:** Vista consolidada con health score, métricas generales, estado de webhooks, DLQ, circuit breakers e idempotencia.

**Ejemplo de respuesta:**
```json
{
  "healthScore": 95.5,
  "status": "🟢 Excellent",
  "overview": {
    "totalRequests": 1523,
    "activeRequests": 5,
    "successRate": "98.50%",
    "avgResponseTime": "145.23ms"
  },
  "webhookDelivery": {
    "total": 856,
    "successRate": 97.8,
    "avgDeliveryTime": 234.5,
    "p95DeliveryTime": 450.2
  },
  "deadLetterQueue": {
    "total": 12,
    "pending": 5,
    "retrying": 3,
    "exhausted": 4
  },
  "circuitBreakers": {
    "total": 3,
    "open": 0,
    "halfOpen": 1,
    "closed": 2
  }
}
```

---

## 🔄 Transformación de Eventos (NUEVO)

### Transformar Evento Único
```http
POST /events/transform
Content-Type: application/json

{
  "eventId": "evt_123",
  "eventType": "producto.creado",
  "timestamp": "2025-12-15T10:30:00.000Z",
  "payload": {
    "id": "prod_123",
    "nombre": "Aspirina 500mg",
    "precio": 15.50
  },
  "metadata": {
    "correlationId": "corr_abc123",
    "source": "productos-service"
  }
}
```

**Respuesta:**
```json
{
  "webhook": {
    "metadata": {
      "eventId": "evt_123",
      "eventType": "producto.creado",
      "timestamp": "2025-12-15T10:30:00.000Z",
      "version": "1.0.0",
      "source": "comparador-service",
      "correlationId": "corr_abc123"
    },
    "payload": { ... },
    "headers": { ... },
    "links": { ... }
  },
  "transformationInfo": {
    "transformedAt": "2025-12-15T10:30:00.456Z",
    "transformationDuration": 5,
    "transformerVersion": "1.0.0",
    "validated": true,
    "appliedRules": ["standard_format", "metadata_extraction", ...]
  }
}
```

---

### Transformar Múltiples Eventos (Batch)
```http
POST /events/transform/batch
Content-Type: application/json

{
  "events": [
    { "eventId": "evt_1", "eventType": "producto.creado", ... },
    { "eventId": "evt_2", "eventType": "producto.actualizado", ... }
  ],
  "options": {
    "includeOriginalEvent": false
  }
}
```

**Respuesta:**
```json
{
  "results": [ ... ],
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0,
    "avgTransformationTime": 4.5
  }
}
```

---

### Ver Ejemplos de Transformación
```http
GET /events/transform/example/producto.creado
GET /events/transform/example/prescripcion.actualizada
GET /events/transform/example/comparacion.completada
```

**Respuesta:**
```json
{
  "eventType": "producto.creado",
  "description": "Evento emitido cuando se crea un nuevo producto",
  "inputExample": { ... },
  "outputExample": { ... }
}
```

---

### Ver Configuraciones de Transformación
```http
GET /events/transform/config
GET /events/transform/config?eventType=producto.creado
```

**Respuesta:**
```json
{
  "totalConfigs": 3,
  "eventTypes": ["producto.creado", "producto.actualizado", ...],
  "configs": { ... }
}
```

---

### Registrar Configuración Personalizada
```http
POST /events/transform/config
Content-Type: application/json

{
  "eventType": "producto.importado",
  "requiredFields": ["id", "nombre", "importadoDe"],
  "enrichment": {
    "addTimestamp": true,
    "addSource": true
  },
  "customHeaders": {
    "X-Import-Source": "external-api"
  }
}
```

---

### Estadísticas de Transformación
```http
GET /events/transform/stats
```

**Respuesta:**
```json
{
  "status": "operational",
  "timestamp": "2025-12-15T10:30:00.000Z",
  "totalConfigs": 3,
  "configuredEventTypes": ["producto.creado", ...],
  "transformerVersion": "1.0.0",
  "webhookVersion": "1.0.0",
  "availableEventTypes": [...]
}
```

---

### Validar Formato de Webhook
```http
POST /events/transform/validate
Content-Type: application/json

{
  "metadata": { ... },
  "payload": { ... },
  "headers": { ... }
}
```

**Respuesta:**
```json
{
  "valid": true,
  "errors": [],
  "warnings": ["Content-Type header es recomendado"]
}
```

---

### Métricas Detalladas
```http
GET /webhook/dashboard/metrics
```
**Descripción:** Métricas de rendimiento por operación (avg, p50, p95, p99).

**Ejemplo:**
```json
{
  "performance": [
    {
      "operation": "webhook.send",
      "totalCalls": 856,
      "successRate": "97.80%",
      "avgDuration": "234.50ms",
      "p50Duration": "201.00ms",
      "p95Duration": "450.20ms",
      "p99Duration": "678.90ms"
    }
  ]
}
```

---

### Lista de Trazas
```http
GET /webhook/dashboard/traces?limit=50&status=error
```
**Parámetros:**
- `limit` (opcional): Número de trazas a retornar
- `status` (opcional): `success` o `error`

**Descripción:** Lista de trazas distribuidas con filtros.

---

### Detalle de Traza
```http
GET /webhook/dashboard/traces/:traceId
```
**Descripción:** Detalle completo de una traza con visualización en árbol.

**Ejemplo:**
```json
{
  "traceId": "a1b2c3d4-...",
  "totalSpans": 8,
  "totalDuration": "2345ms",
  "status": "error",
  "visualization": "📊 Traza: a1b2c3d4...\n✅ webhook.send (100ms)\n  ❌ http.post (1500ms)",
  "spans": [...]
}
```

---

### Análisis de Fallos
```http
GET /webhook/dashboard/failures?limit=50
```
**Descripción:** Análisis consolidado de fallos por tipo de error y operación.

**Ejemplo:**
```json
{
  "totalFailures": 45,
  "byErrorType": [
    {
      "error": "Connection timeout",
      "count": 23,
      "percentage": "51.11%",
      "operations": ["webhook.send"]
    }
  ],
  "byOperation": [
    {
      "operation": "webhook.send",
      "count": 30,
      "percentage": "66.67%"
    }
  ]
}
```

---

### Health Check
```http
GET /webhook/dashboard/health
```
**Descripción:** Estado de salud detallado del sistema.

**Ejemplo:**
```json
{
  "status": "healthy",
  "checks": {
    "database": {
      "status": "healthy",
      "message": "Database connection OK"
    },
    "circuitBreakers": {
      "status": "healthy",
      "message": "All circuits closed"
    },
    "errorRate": {
      "status": "healthy",
      "message": "Error rate: 2.50%"
    }
  }
}
```

---

### Alertas Activas
```http
GET /webhook/dashboard/alerts
```
**Descripción:** Lista de alertas activas en el sistema.

**Ejemplo:**
```json
{
  "totalAlerts": 2,
  "critical": 0,
  "warnings": 2,
  "alerts": [
    {
      "severity": "warning",
      "name": "HighErrorRate",
      "message": "Tasa de errores alta: 12.50%",
      "value": 12.5,
      "threshold": 10
    }
  ]
}
```

---

## 🔍 Diagnóstico de Fallos

### Diagnosticar Fallo Específico
```http
POST /webhook/diagnosis/:traceId
```
**Descripción:** Analiza una traza fallida y genera diagnóstico con root cause y recomendaciones.

**Ejemplo:**
```bash
curl -X POST http://localhost:3000/webhook/diagnosis/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Respuesta:**
```json
{
  "status": "success",
  "diagnosis": {
    "severity": "high",
    "category": "timeout",
    "summary": "Connection timeout en webhook.send",
    "rootCause": "Connection timeout",
    "affectedServices": ["comparador-service", "external-api"],
    "errorChain": [
      {
        "service": "comparador-service",
        "operation": "webhook.send",
        "error": "Request failed",
        "duration": 1200
      }
    ],
    "recommendations": [
      "Aumentar el timeout configurado para la operación",
      "Revisar la carga del servicio downstream",
      "Considerar implementar caching para reducir latencia"
    ],
    "relatedTraces": ["trace_456", "trace_789"]
  }
}
```

---

### Diagnósticos Recientes
```http
GET /webhook/diagnosis?limit=50
```
**Descripción:** Lista de diagnósticos generados recientemente.

---

### Diagnósticos por Severidad
```http
GET /webhook/diagnosis/severity/:severity
```
**Parámetros:**
- `severity`: `low`, `medium`, `high`, `critical`

**Descripción:** Filtra diagnósticos por nivel de severidad.

---

### Análisis de Patrones
```http
GET /webhook/diagnosis/patterns/analyze?limit=100
```
**Descripción:** Detecta patrones recurrentes en los errores.

**Ejemplo:**
```json
{
  "patterns": [
    {
      "pattern": "Connection timeout",
      "occurrences": 45,
      "firstSeen": "2025-12-15T08:00:00.000Z",
      "lastSeen": "2025-12-15T10:25:00.000Z",
      "affectedOperations": ["webhook.send"]
    }
  ],
  "insights": [
    "El error más común es 'Connection timeout' con 45 ocurrencias",
    "Se detectaron 3 patrones de error recurrentes"
  ]
}
```

---

### Estadísticas de Diagnósticos
```http
GET /webhook/diagnosis/stats
```
**Descripción:** Estadísticas consolidadas de diagnósticos.

**Ejemplo:**
```json
{
  "total": 156,
  "bySeverity": {
    "low": 45,
    "medium": 78,
    "high": 28,
    "critical": 5
  },
  "byCategory": {
    "network": 56,
    "service": 34,
    "data": 23,
    "timeout": 38,
    "unknown": 5
  },
  "topErrors": [
    {
      "error": "Connection timeout",
      "count": 45
    }
  ]
}
```

---

## 🛠️ Administración (Admin)

### Dead Letter Queue
```http
GET /webhook/admin/dlq
```
**Descripción:** Lista todos los mensajes en la DLQ.

---

### DLQ por Estado
```http
GET /webhook/admin/dlq/status/:status
```
**Parámetros:**
- `status`: `pending`, `retrying`, `exhausted`, `recovered`

---

### Reintentar Mensaje
```http
POST /webhook/admin/dlq/:eventId/retry
```
**Descripción:** Reintenta manualmente un mensaje de la DLQ.

---

### Circuit Breakers
```http
GET /webhook/admin/circuit-breakers
```
**Descripción:** Estado de todos los circuit breakers.

---

### Resetear Circuit Breaker
```http
POST /webhook/admin/circuit-breakers/:name/reset
```
**Descripción:** Resetea un circuit breaker específico.

---

### Forzar Cierre/Apertura
```http
POST /webhook/admin/circuit-breakers/:name/close
POST /webhook/admin/circuit-breakers/:name/open
```
**Descripción:** Fuerza estado de un circuit breaker.

---

### Estadísticas de Idempotencia
```http
GET /webhook/admin/idempotency/stats
```
**Descripción:** Estadísticas del sistema de idempotencia.

---

### Dashboard Administrativo
```http
GET /webhook/admin/dashboard
```
**Descripción:** Dashboard consolidado con toda la información administrativa.

---

## 🚀 Ejemplos de Uso con curl

### 1. Verificar Estado General
```bash
curl http://localhost:3000/webhook/dashboard
```

### 2. Ver Trazas con Error
```bash
curl "http://localhost:3000/webhook/dashboard/traces?status=error&limit=10"
```

### 3. Diagnosticar un Fallo
```bash
curl -X POST http://localhost:3000/webhook/diagnosis/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### 4. Análisis de Patrones de Error
```bash
curl http://localhost:3000/webhook/diagnosis/patterns/analyze
```

### 5. Health Check
```bash
curl http://localhost:3000/webhook/dashboard/health
```

### 6. Ver Alertas Activas
```bash
curl http://localhost:3000/webhook/dashboard/alerts
```

### 7. Reintentar Mensaje en DLQ
```bash
curl -X POST http://localhost:3000/webhook/admin/dlq/evt_123/retry
```

### 8. Resetear Circuit Breaker
```bash
curl -X POST http://localhost:3000/webhook/admin/circuit-breakers/external-api/reset
```

---

## 📈 Integración con Frontend

### Ejemplo con JavaScript/Fetch

```javascript
// Dashboard en tiempo real
async function updateDashboard() {
  const response = await fetch('/webhook/dashboard');
  const data = await response.json();
  
  document.getElementById('health-score').textContent = data.healthScore;
  document.getElementById('success-rate').textContent = data.overview.successRate;
  document.getElementById('avg-response').textContent = data.overview.avgResponseTime;
}

// Actualizar cada 5 segundos
setInterval(updateDashboard, 5000);

// Ver detalle de traza
async function viewTrace(traceId) {
  const response = await fetch(`/webhook/dashboard/traces/${traceId}`);
  const data = await response.json();
  
  console.log(data.visualization);
  return data;
}

// Diagnosticar fallo
async function diagnoseFailure(traceId) {
  const response = await fetch(`/webhook/diagnosis/${traceId}`, {
    method: 'POST'
  });
  const data = await response.json();
  
  console.log('Root Cause:', data.diagnosis.rootCause);
  console.log('Recommendations:', data.diagnosis.recommendations);
  
  return data.diagnosis;
}
```

---

## 📊 Formato de Headers para Correlation

Al hacer peticiones, los siguientes headers son utilizados para trazabilidad:

**Request Headers:**
```http
X-Correlation-ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
X-Request-ID: x9y8z7w6-v5u4-3210-zyxw-vut9876543210
X-Trace-ID: trace_123abc
X-Parent-Span-ID: span_456def
traceparent: 00-trace_123abc-span_456def-01
```

**Response Headers:**
```http
X-Correlation-ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
X-Request-ID: x9y8z7w6-v5u4-3210-zyxw-vut9876543210
```

---

## 🎨 Códigos de Estado HTTP

- `200 OK` - Operación exitosa
- `404 Not Found` - Recurso no encontrado (traza, diagnóstico, etc.)
- `400 Bad Request` - Parámetros inválidos
- `500 Internal Server Error` - Error del servidor

---

## 📚 Documentación Completa

Para más detalles, consultar:
- `/src/webhook/OBSERVABILITY_README.md` - Documentación completa
- `/src/webhook/simple-observability.example.ts` - Ejemplos de código

---

**🎉 Sistema listo para usar!**
