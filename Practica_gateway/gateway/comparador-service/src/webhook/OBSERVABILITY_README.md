# 🔍 Sistema de Observabilidad y Monitoreo Distribuido

Sistema completo de observabilidad para rastrear eventos a través de múltiples sistemas, logging estructurado JSON, dashboards de monitoreo y diagnóstico de fallos.

## 📋 Tabla de Contenidos

- [Características Principales](#características-principales)
- [Arquitectura](#arquitectura)
- [Componentes](#componentes)
- [Endpoints del Dashboard](#endpoints-del-dashboard)
- [Logging Estructurado](#logging-estructurado)
- [Distributed Tracing](#distributed-tracing)
- [Diagnóstico de Fallos](#diagnóstico-de-fallos)
- [Integración con Sistemas Externos](#integración-con-sistemas-externos)
- [Ejemplos de Uso](#ejemplos-de-uso)

## ✨ Características Principales

### 1. **Rastreo de Eventos a Través de Múltiples Sistemas**
- ✅ Correlation IDs para trazabilidad end-to-end
- ✅ Distributed tracing compatible con OpenTelemetry
- ✅ Propagación de contexto entre servicios
- ✅ Visualización de trazas en formato árbol

### 2. **Logging Estructurado con Formato JSON**
- ✅ Logs en formato JSON para fácil parseo
- ✅ Contexto automático (correlationId, requestId, traceId)
- ✅ Niveles de log: debug, info, warn, error
- ✅ Metadata enriquecida en cada log

### 3. **Dashboards de Monitoreo de Entregas de Webhooks**
- ✅ Dashboard principal consolidado
- ✅ Métricas en tiempo real
- ✅ Visualización de circuit breakers
- ✅ Estado de Dead Letter Queue
- ✅ Health score del sistema

### 4. **Diagnóstico de Fallos en Sistemas Distribuidos**
- ✅ Identificación automática de root cause
- ✅ Análisis de patrones de error
- ✅ Recomendaciones de solución
- ✅ Correlación de fallos relacionados
- ✅ Clasificación por severidad

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    Sistema de Observabilidad                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐│
│  │ Correlation ID  │  │ Structured Logs  │  │  Metrics    ││
│  │   Middleware    │─▶│    Service       │─▶│  Service    ││
│  └─────────────────┘  └──────────────────┘  └─────────────┘│
│           │                     │                    │       │
│           ▼                     ▼                    ▼       │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐│
│  │  Distributed    │  │    Failure       │  │  Dashboard  ││
│  │    Tracing      │─▶│   Diagnosis      │─▶│ Controller  ││
│  └─────────────────┘  └──────────────────┘  └─────────────┘│
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 🧩 Componentes

### 1. ObservabilityService

Servicio central de observabilidad con:
- Creación y gestión de contextos de correlación
- Logs estructurados en JSON
- Métricas de rendimiento
- Propagación de headers para llamadas downstream

```typescript
// Crear contexto de correlación
const context = observability.createContext(req);

// Log estructurado
observability.info('Evento procesado', { 
  eventId: '123', 
  eventType: 'producto.creado' 
});

// Medir operación
await observability.measureOperation(
  'webhook.send',
  async () => {
    return await sendWebhook(url, payload);
  }
);
```

### 2. DistributedTracingService

Implementa trazabilidad distribuida:
- Creación de spans con jerarquía padre-hijo
- Extracción e inyección de contexto de traza
- Visualización de trazas en formato árbol
- Compatible con W3C Trace Context

```typescript
// Iniciar span
const span = tracing.startSpan('webhook.send', parentSpanId, traceId);

// O usar wrapper automático
await tracing.traceOperation(
  'webhook.send',
  async (span) => {
    span.setTags({ endpoint: url });
    return await sendWebhook(url, payload);
  }
);
```

### 3. FailureDiagnosisService

Diagnostica fallos automáticamente:
- Identifica root cause de errores
- Detecta patrones de fallos recurrentes
- Genera recomendaciones de solución
- Clasifica por severidad y categoría

```typescript
// Diagnosticar un fallo
const diagnosis = await failureDiagnosis.diagnoseFailure(traceId);

console.log(diagnosis.summary);
console.log(diagnosis.rootCause);
console.log(diagnosis.recommendations);
```

### 4. CorrelationIdMiddleware

Middleware que:
- Extrae o genera correlation IDs
- Inyecta headers en respuestas
- Registra inicio y fin de requests
- Mide tiempo de respuesta

## 📊 Endpoints del Dashboard

### Dashboard Principal

```http
GET /webhook/dashboard
```

**Respuesta:**
```json
{
  "timestamp": "2025-12-15T10:30:00.000Z",
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

### Métricas Detalladas

```http
GET /webhook/dashboard/metrics
```

**Respuesta:**
```json
{
  "timestamp": "2025-12-15T10:30:00.000Z",
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

### Trazas Distribuidas

```http
GET /webhook/dashboard/traces?limit=50&status=error
```

**Respuesta:**
```json
{
  "timestamp": "2025-12-15T10:30:00.000Z",
  "total": 15,
  "traces": [
    {
      "traceId": "a1b2c3d4-...",
      "spanId": "e5f6g7h8-...",
      "operation": "webhook.send",
      "status": "error",
      "duration": "1523ms",
      "error": {
        "message": "Connection timeout"
      }
    }
  ]
}
```

### Detalle de Traza Específica

```http
GET /webhook/dashboard/traces/:traceId
```

**Respuesta:**
```json
{
  "traceId": "a1b2c3d4-...",
  "totalSpans": 8,
  "totalDuration": "2345ms",
  "status": "error",
  "visualization": "📊 Traza: a1b2c3d4...\n✅ webhook.send (100ms)\n  ✅ circuit-breaker.check (5ms)\n  ❌ http.post (1500ms)\n    ⚠️ Connection timeout",
  "spans": [...]
}
```

### Análisis de Fallos

```http
GET /webhook/dashboard/failures?limit=50
```

**Respuesta:**
```json
{
  "totalFailures": 45,
  "byErrorType": [
    {
      "error": "Connection timeout",
      "count": 23,
      "percentage": "51.11%",
      "operations": ["webhook.send", "external-api.call"]
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

### Health Check

```http
GET /webhook/dashboard/health
```

**Respuesta:**
```json
{
  "timestamp": "2025-12-15T10:30:00.000Z",
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

### Alertas Activas

```http
GET /webhook/dashboard/alerts
```

**Respuesta:**
```json
{
  "timestamp": "2025-12-15T10:30:00.000Z",
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

## 📝 Logging Estructurado

### Formato de Log en Producción (JSON)

```json
{
  "timestamp": "2025-12-15T10:30:00.123Z",
  "level": "info",
  "message": "Webhook enviado exitosamente",
  "correlationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "requestId": "x9y8z7w6-v5u4-3210-zyxw-vut9876543210",
  "context": "WebhookService",
  "metadata": {
    "eventId": "evt_123",
    "endpoint": "https://api.example.com/webhook",
    "statusCode": 200,
    "duration": 234
  }
}
```

### Formato en Desarrollo (Legible)

```
ℹ️  [a1b2c3d4] Webhook enviado exitosamente
   eventId: evt_123
   endpoint: https://api.example.com/webhook
   statusCode: 200
   duration: 234ms
```

### Ejemplo de Uso

```typescript
// Crear contexto
const context = observability.createContext(req);

// Log simple
observability.info('Procesando evento');

// Log con metadata
observability.info('Webhook enviado', {
  eventId: event.id,
  endpoint: webhook.url,
  statusCode: response.status,
});

// Log de error
observability.error('Error al enviar webhook', error, {
  eventId: event.id,
  endpoint: webhook.url,
  retryCount: 3,
});

// Medir operación con logs automáticos
await observability.measureOperation(
  'webhook.send',
  async () => {
    return await sendWebhook(url, payload);
  },
  { eventId: event.id }
);
```

## 🔍 Distributed Tracing

### Propagación de Contexto

Los headers se propagan automáticamente:

```http
X-Correlation-ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
X-Request-ID: x9y8z7w6-v5u4-3210-zyxw-vut9876543210
X-Trace-ID: trace_123abc
X-Parent-Span-ID: span_456def
traceparent: 00-trace_123abc-span_456def-01
```

### Creación de Spans

```typescript
// Span manual
const span = tracing.startSpan('webhook.send', parentSpanId, traceId, {
  endpoint: url,
  method: 'POST',
});

try {
  const result = await sendWebhook(url, payload);
  tracing.finishSpan(span.spanId);
  return result;
} catch (error) {
  tracing.finishSpan(span.spanId, error);
  throw error;
}

// Span automático (recomendado)
await tracing.traceOperation(
  'webhook.send',
  async (span) => {
    span.setTags({ endpoint: url, method: 'POST' });
    span.logToSpan(span.spanId, 'info', 'Iniciando envío');
    
    const result = await sendWebhook(url, payload);
    
    span.logToSpan(span.spanId, 'info', 'Envío exitoso', { 
      statusCode: result.status 
    });
    
    return result;
  },
  parentSpanId,
  traceId
);
```

### Visualización de Trazas

```typescript
// Visualizar traza en consola
const visualization = tracing.visualizeTrace(traceId);
console.log(visualization);
```

**Output:**
```
📊 Traza: a1b2c3d4-e5f6-7890-abcd-ef1234567890
Total spans: 8

✅ comparador.procesar (2345ms)
  ✅ prescripcion.buscar (156ms)
  ✅ producto.comparar (892ms)
    ✅ db.query (234ms)
    ✅ cache.get (12ms)
  ❌ webhook.send (1200ms)
    ✅ circuit-breaker.check (5ms)
    ❌ http.post (1150ms)
      ⚠️ Connection timeout
```

## 🔧 Diagnóstico de Fallos

### Diagnosticar Traza con Error

```http
POST /webhook/diagnosis/:traceId
```

**Respuesta:**
```json
{
  "status": "success",
  "diagnosis": {
    "failureId": "diag-1702638000123",
    "timestamp": "2025-12-15T10:30:00.123Z",
    "severity": "high",
    "category": "timeout",
    "summary": "Connection timeout en webhook.send. 3 error(es) en cadena afectando 2 servicio(s): comparador-service, external-api",
    "rootCause": "Connection timeout",
    "affectedServices": ["comparador-service", "external-api"],
    "errorChain": [
      {
        "service": "comparador-service",
        "operation": "webhook.send",
        "error": "Request failed",
        "timestamp": "2025-12-15T10:30:00.000Z",
        "duration": 1200
      },
      {
        "service": "external-api",
        "operation": "http.post",
        "error": "Connection timeout",
        "timestamp": "2025-12-15T10:30:00.050Z",
        "duration": 1150
      }
    ],
    "recommendations": [
      "Aumentar el timeout configurado para la operación",
      "Revisar la carga del servicio downstream",
      "Considerar implementar caching para reducir latencia",
      "Verificar conexiones de red y ancho de banda"
    ],
    "relatedTraces": ["trace_456", "trace_789"],
    "metrics": {
      "errorCount": 3,
      "affectedRequests": 8,
      "timeframe": "2345ms"
    }
  }
}
```

### Análisis de Patrones

```http
GET /webhook/diagnosis/patterns/analyze?limit=100
```

**Respuesta:**
```json
{
  "timestamp": "2025-12-15T10:30:00.000Z",
  "patterns": [
    {
      "pattern": "Connection timeout",
      "occurrences": 45,
      "firstSeen": "2025-12-15T08:00:00.000Z",
      "lastSeen": "2025-12-15T10:25:00.000Z",
      "affectedOperations": ["webhook.send", "external-api.call"],
      "examples": [
        "Connection timeout after 30000ms",
        "Connection timeout after 30001ms"
      ]
    }
  ],
  "insights": [
    "El error más común es 'Connection timeout' con 45 ocurrencias",
    "Se detectaron 3 patrones de error recurrentes que requieren atención",
    "La operación 'webhook.send' tiene la mayor cantidad de fallos (30)"
  ]
}
```

### Estadísticas de Diagnósticos

```http
GET /webhook/diagnosis/stats
```

**Respuesta:**
```json
{
  "timestamp": "2025-12-15T10:30:00.000Z",
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
    },
    {
      "error": "Circuit breaker is OPEN",
      "count": 23
    }
  ]
}
```

## 🔗 Integración con Sistemas Externos

### Prometheus

Exportar métricas en formato Prometheus:

```typescript
// Endpoint compatible con Prometheus
app.get('/metrics', (req, res) => {
  const metrics = observability.getMetrics();
  
  let prometheusFormat = '';
  
  for (const metric of metrics) {
    prometheusFormat += `# HELP ${metric.operation}_duration_ms Duration in milliseconds\n`;
    prometheusFormat += `# TYPE ${metric.operation}_duration_ms histogram\n`;
    prometheusFormat += `${metric.operation}_duration_ms{quantile="0.5"} ${metric.p50Duration}\n`;
    prometheusFormat += `${metric.operation}_duration_ms{quantile="0.95"} ${metric.p95Duration}\n`;
    prometheusFormat += `${metric.operation}_duration_ms{quantile="0.99"} ${metric.p99Duration}\n`;
  }
  
  res.set('Content-Type', 'text/plain');
  res.send(prometheusFormat);
});
```

### Jaeger / Zipkin

Configurar exportación de spans:

```typescript
// En environment variables
JAEGER_ENDPOINT=http://jaeger:14268/api/traces
JAEGER_SERVICE_NAME=comparador-service
```

### ELK Stack / Datadog

Los logs JSON estructurados son compatibles directamente:

```json
{
  "timestamp": "2025-12-15T10:30:00.123Z",
  "level": "info",
  "message": "Webhook enviado",
  "correlationId": "...",
  "service": "comparador-service",
  "environment": "production"
}
```

## 📖 Ejemplos de Uso

### Ejemplo Completo: Envío de Webhook con Observabilidad

```typescript
import { Injectable } from '@nestjs/common';
import { ObservabilityService } from './observability.service';
import { DistributedTracingService } from './distributed-tracing.service';
import { CircuitBreakerService } from './circuit-breaker.service';

@Injectable()
export class WebhookService {
  constructor(
    private readonly observability: ObservabilityService,
    private readonly tracing: DistributedTracingService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  async sendWebhook(event: any, webhook: any) {
    // 1. Obtener contexto actual
    const context = this.observability.getCurrentContext();
    
    // 2. Crear span para tracing
    return await this.tracing.traceOperation(
      'webhook.send',
      async (span) => {
        // 3. Agregar tags al span
        span.setTags({
          eventType: event.type,
          endpoint: webhook.url,
          eventId: event.id,
        });

        // 4. Log estructurado
        this.observability.info('Iniciando envío de webhook', {
          eventId: event.id,
          endpoint: webhook.url,
        });

        // 5. Medir operación
        const result = await this.observability.measureOperation(
          'webhook.http.post',
          async () => {
            // 6. Usar circuit breaker
            return await this.circuitBreaker.execute(
              webhook.url,
              async () => {
                // 7. Preparar headers con propagación de contexto
                const headers = {
                  ...this.observability.getPropagatetionHeaders(context),
                  ...this.tracing.injectTraceContext(span),
                  'Content-Type': 'application/json',
                };

                // 8. Hacer la llamada HTTP
                const response = await fetch(webhook.url, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify(event),
                });

                // 9. Log del resultado
                if (response.ok) {
                  this.observability.info('Webhook enviado exitosamente', {
                    eventId: event.id,
                    statusCode: response.status,
                  });
                  
                  span.logToSpan(span.spanId, 'info', 'Response OK', {
                    statusCode: response.status,
                  });
                } else {
                  throw new Error(`HTTP ${response.status}`);
                }

                return response;
              }
            );
          },
          { eventId: event.id, endpoint: webhook.url }
        );

        return result;
      },
      context?.requestId, // parent span
      context?.traceId    // trace id
    );
  }
}
```

### Ejemplo: Consultar Dashboard desde Frontend

```javascript
// Obtener dashboard principal
async function fetchDashboard() {
  const response = await fetch('/webhook/dashboard');
  const data = await response.json();
  
  // Actualizar UI
  document.getElementById('health-score').textContent = data.healthScore;
  document.getElementById('success-rate').textContent = data.overview.successRate;
  document.getElementById('avg-response').textContent = data.overview.avgResponseTime;
}

// Obtener trazas con errores
async function fetchErrorTraces() {
  const response = await fetch('/webhook/dashboard/traces?status=error&limit=20');
  const data = await response.json();
  
  // Mostrar en tabla
  const tbody = document.getElementById('error-traces');
  data.traces.forEach(trace => {
    const row = tbody.insertRow();
    row.innerHTML = `
      <td>${trace.traceId.substr(0, 8)}...</td>
      <td>${trace.operation}</td>
      <td>${trace.error?.message || 'N/A'}</td>
      <td>${trace.duration}</td>
      <td><a href="/webhook/dashboard/traces/${trace.traceId}">Ver detalle</a></td>
    `;
  });
}

// Diagnosticar un fallo
async function diagnoseTrace(traceId) {
  const response = await fetch(`/webhook/diagnosis/${traceId}`, {
    method: 'POST',
  });
  const data = await response.json();
  
  // Mostrar diagnóstico
  console.log('Root Cause:', data.diagnosis.rootCause);
  console.log('Recommendations:', data.diagnosis.recommendations);
}

// Polling cada 5 segundos
setInterval(fetchDashboard, 5000);
```

## 🎯 Mejores Prácticas

### 1. Propagación de Contexto

Siempre propagar correlation IDs en llamadas downstream:

```typescript
const headers = {
  ...observability.getPropagatetionHeaders(),
  ...tracing.injectTraceContext(span),
};

await axios.post(url, data, { headers });
```

### 2. Logs Estructurados

Usar logs estructurados en lugar de strings simples:

```typescript
// ❌ Mal
console.log('Enviando webhook a ' + url);

// ✅ Bien
observability.info('Enviando webhook', { endpoint: url, eventId });
```

### 3. Métricas de Operaciones Críticas

Medir todas las operaciones críticas:

```typescript
await observability.measureOperation('critical-operation', async () => {
  // ... operación crítica
});
```

### 4. Diagnóstico Proactivo

Diagnosticar automáticamente en caso de error:

```typescript
try {
  await sendWebhook(event, webhook);
} catch (error) {
  const traceId = currentSpan.traceId;
  const diagnosis = await failureDiagnosis.diagnoseFailure(traceId);
  
  // Alertar o guardar para revisión
  logger.error('Diagnosis:', diagnosis);
}
```

## 📚 Referencias

- [OpenTelemetry](https://opentelemetry.io/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- [Distributed Tracing Patterns](https://microservices.io/patterns/observability/distributed-tracing.html)
- [Structured Logging Best Practices](https://www.loggly.com/ultimate-guide/json-logging-best-practices/)

---

## 🚀 Endpoints Disponibles

### Dashboard y Monitoreo

- `GET /webhook/dashboard` - Dashboard principal
- `GET /webhook/dashboard/metrics` - Métricas detalladas
- `GET /webhook/dashboard/traces` - Lista de trazas
- `GET /webhook/dashboard/traces/:traceId` - Detalle de traza
- `GET /webhook/dashboard/failures` - Análisis de fallos
- `GET /webhook/dashboard/health` - Health check
- `GET /webhook/dashboard/alerts` - Alertas activas

### Diagnóstico

- `POST /webhook/diagnosis/:traceId` - Diagnosticar fallo
- `GET /webhook/diagnosis` - Diagnósticos recientes
- `GET /webhook/diagnosis/severity/:severity` - Por severidad
- `GET /webhook/diagnosis/patterns/analyze` - Análisis de patrones
- `GET /webhook/diagnosis/stats` - Estadísticas

### Administración

- `GET /webhook/admin/circuit-breakers` - Estado de circuit breakers
- `GET /webhook/admin/dlq` - Dead Letter Queue
- `GET /webhook/admin/idempotency/stats` - Estadísticas de idempotencia
- `GET /webhook/admin/dashboard` - Dashboard administrativo

---

**🎉 Sistema completamente implementado y listo para producción!**
