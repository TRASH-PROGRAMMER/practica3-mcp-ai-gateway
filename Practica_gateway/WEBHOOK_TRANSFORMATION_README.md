# 🔄 Sistema de Transformación de Eventos a Formato Estándar de Webhook

## 📋 Resumen

Sistema completo para transformar eventos internos de RabbitMQ a un **formato estándar de webhook** compatible con CloudEvents Specification y REST webhooks estándar de la industria.

---

## 🎯 Objetivo

Convertir eventos internos (específicos de nuestra arquitectura) a un formato estándar, predecible y ampliamente compatible que puede ser consumido por:

- ✅ Servicios externos via webhooks HTTP
- ✅ Integraciones con terceros (Zapier, n8n, Make)
- ✅ Sistemas de monitoreo y observabilidad
- ✅ Event streaming platforms (Kafka, Kinesis)
- ✅ Herramientas de análisis y auditoría

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                     RabbitMQ (Eventos Internos)              │
│  - formato propietario                                       │
│  - estructura variable                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│             RabbitMQ Event Listener Service                  │
│  1. Recibe evento interno                                    │
│  2. Crea contexto de observabilidad                          │
│  3. Inicia traza distribuida                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Event Transformer Service                       │
│  ✅ Extrae metadata estándar                                │
│  ✅ Transforma payload según tipo                           │
│  ✅ Genera headers HTTP estándar                            │
│  ✅ Valida formato resultante                               │
│  ✅ Aplica enriquecimiento configurado                      │
│  ✅ Genera W3C Trace Context                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                Standard Webhook Format                       │
│  {                                                           │
│    metadata: { eventId, eventType, timestamp, ... },        │
│    payload: { ... datos transformados ... },                │
│    headers: { X-Event-ID, X-Correlation-ID, ... },         │
│    context: { user, tenantId, sourceIp, ... },             │
│    links: { self, related, documentation }                  │
│  }                                                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ├─────► Webhook HTTP Externo
                     ├─────► Sistema de Auditoría
                     ├─────► Dashboard de Monitoreo
                     └─────► Event Store / Analytics
```

---

## 📁 Componentes Implementados

### 1. **standard-webhook.dto.ts**
DTOs y tipos para el formato estándar:

- `WebhookEventType` - Enum de tipos de eventos
- `WebhookMetadata` - Metadata estándar del evento
- `WebhookHeaders` - Headers HTTP recomendados
- `WebhookPayload` - Tipos de payload (Producto, Prescripción, Comparación)
- `StandardWebhookDto` - Formato completo del webhook
- `EventTransformationResultDto` - Resultado de la transformación
- `TransformationConfig` - Configuración por tipo de evento

### 2. **event-transformer.service.ts**
Servicio de transformación con:

- ✅ Transformación inteligente por tipo de evento
- ✅ Validación de campos requeridos
- ✅ Enriquecimiento de datos configurable
- ✅ Generación de headers estándar
- ✅ Soporte para W3C Trace Context
- ✅ Mapeo de campos personalizable
- ✅ Transformación en batch
- ✅ Integración con observabilidad

### 3. **event-transformer.controller.ts**
API REST para:

- `POST /events/transform` - Transformar evento único
- `POST /events/transform/batch` - Transformar múltiples eventos
- `GET /events/transform/config` - Ver configuraciones
- `POST /events/transform/config` - Registrar configuración personalizada
- `GET /events/transform/stats` - Estadísticas
- `GET /events/transform/example/:eventType` - Ver ejemplos
- `POST /events/transform/validate` - Validar formato

### 4. **Integración con RabbitMQ Listeners**
Los listeners ahora:

- ✅ Reciben evento interno de RabbitMQ
- ✅ Transforman automáticamente a formato estándar
- ✅ Registran la transformación en logs
- ✅ Pasan formato estándar a métodos de procesamiento
- ✅ Mantienen trazabilidad completa

---

## 🎨 Formato Estándar de Webhook

### Estructura Completa

```json
{
  "metadata": {
    "eventId": "evt_a1b2c3d4e5f67890",
    "eventType": "producto.creado",
    "timestamp": "2025-12-15T10:30:00.000Z",
    "version": "1.0.0",
    "source": "comparador-service",
    "correlationId": "corr_x9y8z7w6v5u4t3s2",
    "traceId": "trace_123abc456def",
    "environment": "production"
  },
  "payload": {
    "id": "prod_123",
    "nombre": "Aspirina 500mg",
    "descripcion": "Analgésico y antipirético",
    "precio": 15.50,
    "stock": 100,
    "categoria": "Medicamentos",
    "transformedAt": "2025-12-15T10:30:00.123Z",
    "sourceService": "comparador-service",
    "dataVersion": "1.0"
  },
  "headers": {
    "Content-Type": "application/json",
    "User-Agent": "Comparador-Service/1.0.0",
    "X-Event-ID": "evt_a1b2c3d4e5f67890",
    "X-Event-Type": "producto.creado",
    "X-Event-Time": "2025-12-15T10:30:00.000Z",
    "X-Correlation-ID": "corr_x9y8z7w6v5u4t3s2",
    "X-Trace-ID": "trace_123abc456def",
    "X-Webhook-Version": "1.0.0",
    "X-Source-Service": "comparador-service",
    "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
  },
  "context": {
    "user": "system",
    "tenantId": "tenant_001",
    "sourceIp": "192.168.1.100"
  },
  "links": {
    "self": "http://localhost:3001/productos/prod_123",
    "documentation": "http://localhost:3001/docs/webhooks/producto.creado"
  }
}
```

---

## 🚀 Uso del Sistema

### 1. Transformación Automática en RabbitMQ Listeners

Los eventos se transforman automáticamente al ser recibidos:

```typescript
// El listener ahora incluye transformación automática
@EventPattern('producto.creado')
async handleProductoCreado(@Payload() data: RabbitMQEvent, @Ctx() context: RmqContext) {
  // 1. Se crea contexto de observabilidad
  // 2. Se inicia traza distribuida
  // 3. Se transforma evento a formato estándar ✅
  // 4. Se procesa el evento
  // 5. Se hace ACK/NACK
}
```

Los logs mostrarán:

```json
{
  "timestamp": "2025-12-15T10:30:00.123Z",
  "level": "info",
  "message": "Evento transformado a formato estándar",
  "correlationId": "corr_x9y8z7w6",
  "metadata": {
    "eventId": "evt_a1b2c3d4",
    "validated": true,
    "duration": 5
  }
}
```

### 2. API REST - Transformar Evento Único

```bash
curl -X POST http://localhost:3001/events/transform \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

**Respuesta:**

```json
{
  "webhook": {
    "metadata": { ... },
    "payload": { ... },
    "headers": { ... }
  },
  "transformationInfo": {
    "transformedAt": "2025-12-15T10:30:00.456Z",
    "transformationDuration": 5,
    "transformerVersion": "1.0.0",
    "validated": true,
    "appliedRules": [
      "standard_format",
      "metadata_extraction",
      "headers_generation",
      "timestamp_enrichment",
      "source_enrichment"
    ]
  }
}
```

### 3. API REST - Transformación en Batch

```bash
curl -X POST http://localhost:3001/events/transform/batch \
  -H "Content-Type: application/json" \
  -d '{
    "events": [
      { "eventId": "evt_1", "eventType": "producto.creado", ... },
      { "eventId": "evt_2", "eventType": "producto.actualizado", ... }
    ],
    "options": {
      "includeOriginalEvent": false
    }
  }'
```

**Respuesta:**

```json
{
  "results": [
    { "webhook": { ... }, "transformationInfo": { ... } },
    { "webhook": { ... }, "transformationInfo": { ... } }
  ],
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0,
    "avgTransformationTime": 4.5
  }
}
```

### 4. Ver Ejemplos por Tipo de Evento

```bash
# Ejemplo de producto.creado
curl http://localhost:3001/events/transform/example/producto.creado

# Ejemplo de prescripcion.actualizada
curl http://localhost:3001/events/transform/example/prescripcion.actualizada

# Ejemplo de comparacion.completada
curl http://localhost:3001/events/transform/example/comparacion.completada
```

### 5. Ver Configuraciones

```bash
# Todas las configuraciones
curl http://localhost:3001/events/transform/config

# Configuración específica
curl "http://localhost:3001/events/transform/config?eventType=producto.creado"
```

### 6. Registrar Configuración Personalizada

```bash
curl -X POST http://localhost:3001/events/transform/config \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "producto.importado",
    "requiredFields": ["id", "nombre", "importadoDe"],
    "enrichment": {
      "addTimestamp": true,
      "addSource": true,
      "addVersion": true
    },
    "customHeaders": {
      "X-Import-Source": "external-api"
    },
    "fieldMapping": {
      "old_field_name": "new_field_name"
    },
    "omitFields": ["internal_field", "temp_data"]
  }'
```

### 7. Validar Formato de Webhook

```bash
curl -X POST http://localhost:3001/events/transform/validate \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "eventId": "evt_123",
      "eventType": "producto.creado",
      "timestamp": "2025-12-15T10:30:00.000Z",
      "correlationId": "corr_abc"
    },
    "payload": { "id": "prod_123" },
    "headers": {
      "X-Event-ID": "evt_123",
      "X-Correlation-ID": "corr_abc"
    }
  }'
```

**Respuesta:**

```json
{
  "valid": true,
  "errors": [],
  "warnings": ["Content-Type header es recomendado"]
}
```

### 8. Ver Estadísticas

```bash
curl http://localhost:3001/events/transform/stats
```

**Respuesta:**

```json
{
  "status": "operational",
  "timestamp": "2025-12-15T10:30:00.000Z",
  "totalConfigs": 3,
  "configuredEventTypes": [
    "producto.creado",
    "producto.actualizado",
    "comparacion.completada"
  ],
  "transformerVersion": "1.0.0",
  "webhookVersion": "1.0.0",
  "availableEventTypes": [
    "producto.creado",
    "producto.actualizado",
    "producto.eliminado",
    "prescripcion.creada",
    "prescripcion.actualizada",
    "comparacion.completada",
    "sistema.notificacion"
  ]
}
```

---

## ⚙️ Configuración Personalizada

### Tipos de Configuración

```typescript
interface TransformationConfig {
  eventType: string;              // Tipo de evento
  fieldMapping?: Record<string, string>;  // Mapeo de campos
  requiredFields?: string[];      // Campos obligatorios
  omitFields?: string[];          // Campos a omitir
  customHeaders?: Record<string, string>; // Headers personalizados
  enrichment?: {                  // Enriquecimiento
    addTimestamp?: boolean;
    addSource?: boolean;
    addVersion?: boolean;
  };
  validations?: Array<{           // Validaciones custom
    field: string;
    rule: string;
    message: string;
  }>;
}
```

### Ejemplo: Configuración Completa

```typescript
{
  eventType: 'producto.importado',
  
  // Renombrar campos
  fieldMapping: {
    'external_id': 'id',
    'product_name': 'nombre',
    'import_date': 'fechaImportacion'
  },
  
  // Campos requeridos
  requiredFields: ['id', 'nombre', 'importadoDe'],
  
  // Campos a omitir
  omitFields: ['_internal_flag', 'temp_data'],
  
  // Headers personalizados
  customHeaders: {
    'X-Import-Source': 'external-api',
    'X-Import-Version': '2.0'
  },
  
  // Enriquecimiento
  enrichment: {
    addTimestamp: true,
    addSource: true,
    addVersion: true
  },
  
  // Validaciones
  validations: [
    {
      field: 'precio',
      rule: 'greater_than_zero',
      message: 'El precio debe ser mayor a 0'
    }
  ]
}
```

---

## 📊 Headers HTTP Estándar Generados

### Headers Obligatorios

| Header | Descripción | Ejemplo |
|--------|-------------|---------|
| `Content-Type` | Tipo de contenido | `application/json` |
| `X-Event-ID` | ID único del evento | `evt_a1b2c3d4` |
| `X-Event-Type` | Tipo de evento | `producto.creado` |
| `X-Event-Time` | Timestamp del evento | `2025-12-15T10:30:00.000Z` |
| `X-Correlation-ID` | ID de correlación | `corr_x9y8z7w6` |
| `X-Webhook-Version` | Versión del formato | `1.0.0` |
| `X-Source-Service` | Servicio origen | `comparador-service` |

### Headers Opcionales

| Header | Descripción | Ejemplo |
|--------|-------------|---------|
| `X-Trace-ID` | ID de traza distribuida | `trace_123abc` |
| `X-Webhook-Signature` | Firma HMAC | `sha256=a1b2c3...` |
| `traceparent` | W3C Trace Context | `00-4bf92f357...` |
| `User-Agent` | Identificación del servicio | `Comparador-Service/1.0.0` |

---

## 🔍 Integración con Observabilidad

### Logs Estructurados

Cada transformación genera logs JSON:

```json
{
  "timestamp": "2025-12-15T10:30:00.123Z",
  "level": "info",
  "message": "Transformando evento a formato estándar",
  "correlationId": "corr_x9y8z7w6",
  "requestId": "req_456def",
  "metadata": {
    "eventId": "evt_a1b2c3d4",
    "eventType": "producto.creado"
  }
}
```

```json
{
  "timestamp": "2025-12-15T10:30:00.128Z",
  "level": "info",
  "message": "Evento transformado exitosamente",
  "correlationId": "corr_x9y8z7w6",
  "metadata": {
    "eventId": "evt_a1b2c3d4",
    "eventType": "producto.creado",
    "duration": 5,
    "validated": true
  }
}
```

### Distributed Tracing

Las transformaciones generan spans:

```
📊 Traza: corr_x9y8z7w6
✅ rabbitmq.producto.creado (156ms)
  ✅ event.transform (5ms)
    ✅ metadata.extract (1ms)
    ✅ payload.transform (2ms)
    ✅ headers.generate (1ms)
    ✅ validation (1ms)
  ✅ process.producto.creado (50ms)
```

### Métricas

Métricas disponibles en el dashboard:

- Total de transformaciones
- Tasa de éxito de transformación
- Tiempo promedio de transformación
- Transformaciones por tipo de evento
- Eventos con validación fallida

---

## 🎯 Casos de Uso

### 1. Envío a Webhook Externo

```typescript
// Evento interno transformado listo para HTTP POST
const result = await transformer.transformToStandardWebhook(rabbitMQEvent);

// Enviar a webhook externo
await fetch(externalWebhookUrl, {
  method: 'POST',
  headers: result.webhook.headers,
  body: JSON.stringify(result.webhook),
});
```

### 2. Integración con Zapier/Make

El formato estándar es compatible con herramientas de automatización:

```json
POST https://hooks.zapier.com/hooks/catch/123456/abcdef/
Headers: {
  "X-Event-Type": "producto.creado",
  "X-Correlation-ID": "corr_abc123"
}
Body: {
  "metadata": { ... },
  "payload": { ... }
}
```

### 3. Event Sourcing / Auditoría

```typescript
// Guardar en event store con formato estándar
await eventStore.save({
  ...result.webhook,
  _original: result.originalEvent,
  _transformation: result.transformationInfo
});
```

### 4. Stream Processing

```typescript
// Enviar a Kafka/Kinesis con formato estándar
await kafka.send({
  topic: 'product-events',
  key: result.webhook.metadata.eventId,
  value: JSON.stringify(result.webhook),
  headers: result.webhook.headers,
});
```

---

## 📈 Beneficios

### Para Desarrollo
✅ **Formato predecible** - Mismo formato para todos los eventos
✅ **Tipado fuerte** - TypeScript DTOs completos
✅ **Fácil testing** - Formato conocido y validado
✅ **Debugging simplificado** - Headers de trazabilidad

### Para Integración
✅ **Compatible con estándares** - CloudEvents, REST webhooks
✅ **Herramientas existentes** - Zapier, n8n, Make funcionan out-of-the-box
✅ **Documentación automática** - Ejemplos disponibles via API
✅ **Versionado** - Control de versiones del formato

### Para Operaciones
✅ **Observabilidad completa** - Logs, métricas, trazas
✅ **Validación automática** - Detección de eventos malformados
✅ **Configuración flexible** - Personalización por tipo de evento
✅ **Monitoreo** - Estadísticas de transformación en tiempo real

---

## 🔗 Compatibilidad

### CloudEvents Specification

El formato es compatible con CloudEvents:

```json
{
  "specversion": "1.0",
  "type": "com.comparador.producto.creado",
  "source": "comparador-service",
  "id": "evt_a1b2c3d4",
  "time": "2025-12-15T10:30:00.000Z",
  "data": { ... }
}
```

### W3C Trace Context

Headers de trazabilidad estándar:

```
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
```

### HMAC Signature (Opcional)

Compatible con firma HMAC existente:

```
X-Webhook-Signature: sha256=a1b2c3d4...
```

---

## 📚 Documentación Relacionada

- **Observabilidad**: `OBSERVABILITY_README.md`
- **RabbitMQ Listeners**: `RABBITMQ_LISTENERS_README.md`
- **Sistema Completo**: `SISTEMA_OBSERVABILIDAD_RESUMEN.md`
- **Webhooks**: `SISTEMA_WEBHOOKS_README.md`

---

## ✅ Checklist de Implementación

- [x] DTOs del formato estándar (standard-webhook.dto.ts)
- [x] Servicio de transformación (event-transformer.service.ts)
- [x] API REST de transformación (event-transformer.controller.ts)
- [x] Integración con RabbitMQ listeners
- [x] Integración con módulo de webhooks
- [x] Configuraciones por defecto
- [x] Validación de formato
- [x] Generación de headers estándar
- [x] W3C Trace Context
- [x] Enriquecimiento de datos
- [x] Transformación en batch
- [x] Ejemplos por tipo de evento
- [x] Estadísticas de transformación
- [x] Logs estructurados
- [x] Distributed tracing
- [x] Documentación completa

---

**🎉 Sistema de transformación completamente implementado y funcional!**

Los eventos internos ahora se transforman automáticamente a formato estándar compatible con webhooks REST, CloudEvents y herramientas de integración de la industria.
