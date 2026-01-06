# 🐰 Módulo de Listeners de RabbitMQ con Observabilidad

## 📋 Resumen

Se ha implementado un módulo completo de listeners de RabbitMQ en ambos microservicios (Comparador y Gateway/Productos) con integración completa del sistema de observabilidad.

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                         RabbitMQ                             │
│                      (Event Bus)                             │
└─────────────────────────────────────────────────────────────┘
                    │                    │
                    ▼                    ▼
    ┌───────────────────────┐   ┌───────────────────────┐
    │  Comparador Service   │   │  Gateway/Productos    │
    │  (Microservicio B)    │   │  (Microservicio A)    │
    ├───────────────────────┤   ├───────────────────────┤
    │                       │   │                       │
    │ RabbitMQ Listener     │   │ RabbitMQ Listener     │
    │ ├─ producto.creado    │   │ ├─ comparacion.      │
    │ ├─ producto.          │   │ │   completada       │
    │ │   actualizado       │   │ ├─ prescripcion.     │
    │ ├─ producto.          │   │ │   actualizada      │
    │ │   eliminado         │   │ └─ sistema.          │
    │ ├─ prescripcion.      │   │     notificacion     │
    │ │   creada            │   │                       │
    │ └─ * (genérico)       │   │                       │
    │                       │   │                       │
    │ Observabilidad:       │   │ Observabilidad:       │
    │ ✅ Logs JSON          │   │ ✅ Logs JSON          │
    │ ✅ Distributed Trace  │   │ ✅ ACK/NACK           │
    │ ✅ Correlation IDs    │   │ ✅ Manejo errores     │
    │ ✅ Métricas           │   │ ✅ Estadísticas       │
    │ ✅ ACK/NACK           │   │                       │
    └───────────────────────┘   └───────────────────────┘
```

---

## 📁 Archivos Implementados

### Comparador Service (Microservicio B)

1. **`rabbitmq-event-listener.service.ts`** (479 líneas)
   - Service principal con listeners de eventos
   - Integración completa con ObservabilityService
   - Integración completa con DistributedTracingService
   - Manejo de ACK/NACK inteligente
   - Patrones de eventos:
     - `producto.creado`
     - `producto.actualizado`
     - `producto.eliminado`
     - `prescripcion.creada`
     - `*` (genérico)

2. **`rabbitmq-event-listener.module.ts`**
   - Módulo de configuración
   - Providers: RabbitMQEventListenerService, ObservabilityService, DistributedTracingService

3. **`rabbitmq-stats.controller.ts`**
   - Endpoints de estadísticas
   - Health check del listener

4. **`app.module.ts`** (modificado)
   - Integración del RabbitMQEventListenerModule
   - Integración del WebhookModule

5. **`main.ts`** (modificado)
   - Configuración de microservicios RabbitMQ
   - Puerto HTTP para API REST
   - Logging mejorado

### Gateway/Productos Service (Microservicio A)

6. **`rabbitmq-listener.service.ts`** (209 líneas)
   - Service de listeners para gateway
   - Logging estructurado JSON
   - Manejo de errores
   - Patrones de eventos:
     - `comparacion.completada`
     - `prescripcion.actualizada`
     - `sistema.notificacion`

7. **`rabbitmq-listener.module.ts`**
   - Módulo de configuración

8. **`rabbitmq-stats.controller.ts`**
   - Endpoints de estadísticas

---

## 🎯 Responsabilidades del Módulo

### ✅ Escuchar Eventos Internos de RabbitMQ

**Comparador Service escucha:**
- `producto.creado` - Cuando se crea un producto
- `producto.actualizado` - Cuando se actualiza un producto
- `producto.eliminado` - Cuando se elimina un producto
- `prescripcion.creada` - Cuando se crea una prescripción
- `*` - Cualquier otro evento (catch-all)

**Gateway/Productos Service escucha:**
- `comparacion.completada` - Cuando se completa una comparación
- `prescripcion.actualizada` - Cuando se actualiza una prescripción
- `sistema.notificacion` - Notificaciones del sistema

### ✅ Logging Estructurado JSON

Todos los eventos generan logs en formato JSON:

```json
{
  "timestamp": "2025-12-15T10:30:00.123Z",
  "level": "info",
  "message": "Evento recibido de RabbitMQ",
  "correlationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "requestId": "x9y8z7w6-v5u4-3210-zyxw-vut9876543210",
  "metadata": {
    "eventType": "producto.creado",
    "eventId": "evt_123",
    "productoId": "prod_456"
  }
}
```

### ✅ Distributed Tracing

Cada evento procesado genera una traza completa:

```
📊 Traza: a1b2c3d4-e5f6-7890-abcd-ef1234567890
✅ rabbitmq.producto.creado (150ms)
  ✅ process.producto.creado (50ms)
    ✅ database.update (30ms)
    ✅ cache.invalidate (15ms)
```

### ✅ Manejo de Errores con ACK/NACK

**ACK (Acknowledge):**
- Evento procesado exitosamente
- Mensaje eliminado de la cola

**NACK con requeue:**
- Error temporal (ECONNREFUSED, ETIMEDOUT, etc.)
- Reintenta hasta 3 veces
- Mensaje vuelve a la cola

**NACK sin requeue:**
- Error permanente
- Más de 3 intentos fallidos
- Mensaje va a DLQ (si está configurada)

### ✅ Propagación de Contexto

Los correlation IDs y trace IDs se propagan desde el evento:

```typescript
const correlationContext = observability.createContext(undefined, {
  correlationId: event.metadata?.correlationId,
  traceId: event.metadata?.traceId,
});
```

---

## 🚀 Uso

### Iniciar los Servicios

**Comparador Service:**
```bash
cd gateway/comparador-service
npm run start:dev
```

**Salida esperada:**
```
🚀 Servicio Comparador iniciado
📊 API REST: http://localhost:3001
📨 RabbitMQ Listeners activos: producto_events, comparador_queue
🔍 Dashboard Observabilidad: http://localhost:3001/webhook/dashboard
📈 Estadísticas RabbitMQ: http://localhost:3001/events/rabbitmq/stats
```

**Gateway/Productos Service:**
```bash
cd gateway/productos-service
npm run start:dev
```

---

## 📊 Endpoints de Monitoreo

### Comparador Service (Puerto 3001)

**Estadísticas de RabbitMQ:**
```bash
curl http://localhost:3001/events/rabbitmq/stats
```

**Respuesta:**
```json
{
  "timestamp": "2025-12-15T10:30:00.123Z",
  "totalEventsProcessed": 1523,
  "avgProcessingTime": 45.67,
  "successRate": 98.5,
  "byEventType": [
    {
      "eventType": "producto.creado",
      "totalCalls": 856,
      "successRate": 99.2,
      "avgDuration": 52.3
    },
    {
      "eventType": "producto.actualizado",
      "totalCalls": 423,
      "successRate": 97.8,
      "avgDuration": 38.5
    }
  ],
  "tracing": {
    "activeSpans": 5,
    "errorRate": 1.5
  }
}
```

**Health Check:**
```bash
curl http://localhost:3001/events/rabbitmq/health
```

**Respuesta:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-15T10:30:00.123Z",
  "details": {
    "totalEventsProcessed": 1523,
    "successRate": "98.50%",
    "avgProcessingTime": "45.67ms"
  }
}
```

**Dashboard de Observabilidad:**
```bash
curl http://localhost:3001/webhook/dashboard
```

### Gateway/Productos Service (Puerto 3000)

```bash
curl http://localhost:3000/events/rabbitmq/stats
curl http://localhost:3000/events/rabbitmq/health
```

---

## 💻 Ejemplo de Evento

### Formato de Evento RabbitMQ

```typescript
interface RabbitMQEvent {
  eventId: string;          // Identificador único
  eventType: string;        // Tipo de evento
  timestamp: string;        // ISO 8601
  payload: any;             // Datos del evento
  metadata?: {
    correlationId?: string; // Para trazabilidad
    traceId?: string;       // Para distributed tracing
    source?: string;        // Servicio origen
  };
}
```

### Ejemplo Concreto

```json
{
  "eventId": "evt_a1b2c3d4",
  "eventType": "producto.creado",
  "timestamp": "2025-12-15T10:30:00.123Z",
  "payload": {
    "id": "prod_123",
    "nombre": "Aspirina 500mg",
    "precio": 15.50,
    "stock": 100
  },
  "metadata": {
    "correlationId": "corr_x9y8z7w6",
    "traceId": "trace_123abc",
    "source": "productos-service"
  }
}
```

### Logs Generados

**Al recibir:**
```json
{
  "timestamp": "2025-12-15T10:30:00.123Z",
  "level": "info",
  "message": "Evento recibido de RabbitMQ",
  "correlationId": "corr_x9y8z7w6",
  "requestId": "req_456def",
  "metadata": {
    "eventType": "producto.creado",
    "eventId": "evt_a1b2c3d4",
    "productoId": "prod_123"
  }
}
```

**Al completar:**
```json
{
  "timestamp": "2025-12-15T10:30:00.175Z",
  "level": "info",
  "message": "Evento procesado exitosamente",
  "correlationId": "corr_x9y8z7w6",
  "requestId": "req_456def",
  "metadata": {
    "eventId": "evt_a1b2c3d4",
    "eventType": "producto.creado",
    "duration": 52
  }
}
```

---

## 🔍 Integración con Dashboard de Observabilidad

Los eventos procesados se visualizan en el dashboard:

```bash
# Dashboard principal
curl http://localhost:3001/webhook/dashboard

# Trazas de eventos RabbitMQ
curl "http://localhost:3001/webhook/dashboard/traces?limit=20"

# Métricas de eventos RabbitMQ
curl http://localhost:3001/webhook/dashboard/metrics
```

**Dashboard mostrará:**
- Total de eventos procesados
- Tasa de éxito por tipo de evento
- Tiempo promedio de procesamiento
- Eventos más lentos
- Errores recientes con diagnóstico

---

## ⚙️ Configuración

### Variables de Entorno

```bash
# RabbitMQ
RABBITMQ_URL=amqp://user:pass@localhost:5672

# Puerto del servicio
PORT=3001

# Logging
NODE_ENV=production  # Para logs JSON
```

### Prefetch Count

Controla cuántos mensajes se procesan en paralelo:

```typescript
{
  prefetchCount: 10,  // Hasta 10 mensajes simultáneos
}
```

### Reintentos

- Máximo 3 intentos automáticos
- Backoff exponencial (gestionado por RabbitMQ)
- Después de 3 intentos → DLQ o descarte

---

## 📈 Métricas Disponibles

### Por Tipo de Evento
- Total de llamadas
- Tasa de éxito (%)
- Duración promedio (ms)
- P50, P95, P99

### Globales
- Total eventos procesados
- Tiempo promedio de procesamiento
- Tasa de éxito global
- Spans activos
- Tasa de error

---

## 🧪 Testing

### Enviar Evento de Prueba

```bash
# Usando RabbitMQ Management API
curl -u user:pass -X POST http://localhost:15672/api/exchanges/%2F/amq.default/publish \
  -H "Content-Type: application/json" \
  -d '{
    "properties": {},
    "routing_key": "producto_events",
    "payload": "{\"eventId\":\"test_123\",\"eventType\":\"producto.creado\",\"timestamp\":\"2025-12-15T10:30:00.000Z\",\"payload\":{\"id\":\"prod_test\",\"nombre\":\"Test\"},\"metadata\":{\"correlationId\":\"test_corr\",\"source\":\"test\"}}",
    "payload_encoding": "string"
  }'
```

### Verificar Procesamiento

```bash
# Ver estadísticas
curl http://localhost:3001/events/rabbitmq/stats

# Ver logs (si está en desarrollo)
# Los logs mostrarán el evento procesado
```

---

## 🎯 Beneficios

### Para Desarrollo
- ✅ **Trazabilidad completa** de eventos
- ✅ **Logs estructurados** fáciles de buscar
- ✅ **Debugging rápido** con correlation IDs

### Para Operaciones
- ✅ **Monitoreo en tiempo real** del procesamiento
- ✅ **Detección automática** de fallos
- ✅ **Métricas detalladas** por tipo de evento
- ✅ **Health checks** específicos

### Para el Sistema
- ✅ **Integración completa** con observabilidad existente
- ✅ **Manejo robusto** de errores
- ✅ **Reintentos automáticos** inteligentes
- ✅ **Propagación de contexto** entre servicios

---

## 📚 Documentación Relacionada

- **Observabilidad General**: `OBSERVABILITY_README.md`
- **Dashboard**: `GUIA_RAPIDA_ENDPOINTS.md`
- **Sistema Completo**: `SISTEMA_OBSERVABILIDAD_RESUMEN.md`

---

## ✅ Checklist de Implementación

- [x] Servicio de listeners en Comparador Service
- [x] Servicio de listeners en Gateway/Productos Service
- [x] Integración con ObservabilityService
- [x] Integración con DistributedTracingService
- [x] Logging estructurado JSON
- [x] Manejo de ACK/NACK
- [x] Propagación de correlation IDs
- [x] Endpoints de estadísticas
- [x] Health checks
- [x] Configuración de microservicios en main.ts
- [x] Documentación completa

---

**🎉 Módulo completamente implementado y funcional!**

Los microservicios ahora escuchan eventos de RabbitMQ con observabilidad completa.
