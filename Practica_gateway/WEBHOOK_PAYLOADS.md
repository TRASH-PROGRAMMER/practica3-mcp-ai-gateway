# 📡 Estructura de Payloads de Webhook

## Introducción

Este documento define la estructura estándar de los payloads que se emiten como webhooks en el sistema de eventos de negocio. Todos los webhooks siguen una estructura consistente para facilitar la integración con sistemas externos.

---

## 🏗️ Estructura Base del Webhook

Todos los webhooks emitidos desde el sistema siguen esta estructura base:

```typescript
interface WebhookPayload<T> {
  event_type: string;           // Tipo de evento (ej: "prescripcion.registrada")
  event_id: string;             // Identificador único del evento
  timestamp: string;            // ISO 8601 timestamp
  version: string;              // Versión del schema del evento
  source: string;               // Servicio emisor
  data: T;                      // Payload específico del evento
  metadata?: {                  // Metadatos opcionales
    correlation_id?: string;    // ID para rastrear flujos relacionados
    user_id?: number;           // Usuario que desencadenó el evento
    ip_address?: string;        // IP del cliente (si aplica)
    user_agent?: string;        // User agent del cliente
  };
}
```

### **Campos Obligatorios:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `event_type` | `string` | Nombre del evento en formato kebab-case |
| `event_id` | `string` | UUID único del evento |
| `timestamp` | `string` | Fecha/hora en formato ISO 8601 (UTC) |
| `version` | `string` | Versión del schema (semver: "1.0.0") |
| `source` | `string` | Servicio que emitió el evento |
| `data` | `object` | Datos específicos del evento |

### **Campos Opcionales:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `metadata.correlation_id` | `string` | ID para rastrear eventos relacionados |
| `metadata.user_id` | `number` | Usuario que generó el evento |
| `metadata.ip_address` | `string` | IP del cliente |
| `metadata.user_agent` | `string` | User agent del navegador |

---

## 📋 Evento: `prescripcion.registrada`

### **Descripción:**
Se emite cuando un médico registra una nueva prescripción médica en el sistema.

### **Event Type:**
```
prescripcion.registrada
```

### **Payload Completo:**

```typescript
interface PrescripcionRegistradaPayload {
  event_type: "prescripcion.registrada";
  event_id: string;                    // "prescripcion-123-1734234567890"
  timestamp: string;                   // "2025-12-15T10:30:00.000Z"
  version: "1.0.0";
  source: "comparador-service";
  data: {
    id_prescripcion: number;           // ID único de la prescripción
    id_paciente: number;               // ID del paciente
    nombre_paciente: string;           // Nombre completo del paciente
    id_medico: number;                 // ID del médico
    nombre_medico: string;             // Nombre completo del médico
    diagnostico: string;               // Diagnóstico médico
    medicamentos: Array<{
      id_producto: number;             // ID del producto/medicamento
      nombre_comercial: string;        // Nombre comercial del medicamento
      dosis: string;                   // Ej: "1 tableta", "5ml"
      frecuencia: string;              // Ej: "cada 12 horas", "3 veces al día"
      duracion_dias: number;           // Duración del tratamiento en días
    }>;
    fecha_emision: string;             // ISO 8601 timestamp de emisión
    estado: string;                    // "activa" | "dispensada" | "vencida"
  };
  metadata?: {
    correlation_id?: string;
    user_id?: number;                  // ID del médico que registró
    ip_address?: string;
    user_agent?: string;
  };
}
```

### **Ejemplo Real:**

```json
{
  "event_type": "prescripcion.registrada",
  "event_id": "prescripcion-123-1734234567890",
  "timestamp": "2025-12-15T10:30:00.000Z",
  "version": "1.0.0",
  "source": "comparador-service",
  "data": {
    "id_prescripcion": 123,
    "id_paciente": 456,
    "nombre_paciente": "Juan Pérez García",
    "id_medico": 789,
    "nombre_medico": "Dra. María González López",
    "diagnostico": "Hipertensión arterial sistémica",
    "medicamentos": [
      {
        "id_producto": 1,
        "nombre_comercial": "Losartán 50mg",
        "dosis": "1 tableta",
        "frecuencia": "cada 12 horas",
        "duracion_dias": 30
      },
      {
        "id_producto": 15,
        "nombre_comercial": "Hidroclorotiazida 25mg",
        "dosis": "1 tableta",
        "frecuencia": "cada 24 horas",
        "duracion_dias": 30
      }
    ],
    "fecha_emision": "2025-12-15T10:30:00.000Z",
    "estado": "activa"
  },
  "metadata": {
    "correlation_id": "session-abc123",
    "user_id": 789,
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
  }
}
```

### **Casos de Uso para Consumidores:**

#### **1. Servicio de Notificaciones**
```javascript
// Enviar SMS/Email al paciente
if (event.data.medicamentos.length > 0) {
  sendNotification({
    to: event.data.nombre_paciente,
    subject: "Nueva Prescripción Médica",
    body: `El Dr. ${event.data.nombre_medico} ha registrado una prescripción 
           con ${event.data.medicamentos.length} medicamento(s).`
  });
}
```

#### **2. Servicio de Inventario**
```javascript
// Reservar stock en farmacia
event.data.medicamentos.forEach(med => {
  reserveStock({
    productId: med.id_producto,
    quantity: calculateQuantity(med.dosis, med.frecuencia, med.duracion_dias),
    prescriptionId: event.data.id_prescripcion
  });
});
```

#### **3. Servicio de Auditoría**
```javascript
// Registro para cumplimiento regulatorio
auditLog.save({
  event_type: event.event_type,
  event_id: event.event_id,
  medico_id: event.data.id_medico,
  paciente_id: event.data.id_paciente,
  timestamp: event.timestamp,
  payload: event.data
});
```

---

## 🔍 Evento: `comparacion.realizada`

### **Descripción:**
Se emite cuando un usuario realiza una comparación de precios de un medicamento entre diferentes farmacias.

### **Event Type:**
```
comparacion.realizada
```

### **Payload Completo:**

```typescript
interface ComparacionRealizadaPayload {
  event_type: "comparacion.realizada";
  event_id: string;                    // "comparacion-456-1734234567890"
  timestamp: string;                   // "2025-12-15T11:15:00.000Z"
  version: "1.0.0";
  source: "comparador-service";
  data: {
    id_comparacion: number;            // ID único de la comparación
    id_producto: number;               // ID del producto comparado
    nombre_producto: string;           // Nombre comercial del medicamento
    id_usuario?: number;               // ID del usuario (opcional, puede ser anónimo)
    resultados: Array<{
      farmacia: string;                // Nombre de la farmacia
      precio: number;                  // Precio en moneda local
      stock_disponible: boolean;       // Disponibilidad en stock
      descuento?: number;              // Descuento aplicado (porcentaje)
      ubicacion?: {
        direccion: string;
        latitud: number;
        longitud: number;
      };
    }>;
    precio_min: number;                // Precio mínimo encontrado
    precio_max: number;                // Precio máximo encontrado
    ahorro_potencial: number;          // Diferencia entre max y min
    total_farmacias: number;           // Cantidad de farmacias comparadas
    fecha_comparacion: string;         // ISO 8601 timestamp
  };
  metadata?: {
    correlation_id?: string;
    user_id?: number;
    ip_address?: string;
    user_agent?: string;
  };
}
```

### **Ejemplo Real:**

```json
{
  "event_type": "comparacion.realizada",
  "event_id": "comparacion-456-1734234567890",
  "timestamp": "2025-12-15T11:15:00.000Z",
  "version": "1.0.0",
  "source": "comparador-service",
  "data": {
    "id_comparacion": 456,
    "id_producto": 1,
    "nombre_producto": "Losartán 50mg x 30 tabletas",
    "id_usuario": 789,
    "resultados": [
      {
        "farmacia": "Farmacia Central",
        "precio": 95.50,
        "stock_disponible": true,
        "descuento": 5,
        "ubicacion": {
          "direccion": "Av. Principal 123, Ciudad",
          "latitud": -12.0464,
          "longitud": -77.0428
        }
      },
      {
        "farmacia": "Farmacia del Ahorro",
        "precio": 105.00,
        "stock_disponible": true,
        "descuento": 0,
        "ubicacion": {
          "direccion": "Calle Secundaria 456, Ciudad",
          "latitud": -12.0500,
          "longitud": -77.0500
        }
      },
      {
        "farmacia": "Farmacia San Pablo",
        "precio": 100.00,
        "stock_disponible": false,
        "descuento": 0,
        "ubicacion": {
          "direccion": "Av. Los Olivos 789, Ciudad",
          "latitud": -12.0550,
          "longitud": -77.0550
        }
      }
    ],
    "precio_min": 95.50,
    "precio_max": 105.00,
    "ahorro_potencial": 9.50,
    "total_farmacias": 3,
    "fecha_comparacion": "2025-12-15T11:15:00.000Z"
  },
  "metadata": {
    "correlation_id": "search-xyz789",
    "user_id": 789,
    "ip_address": "192.168.1.105",
    "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)"
  }
}
```

### **Casos de Uso para Consumidores:**

#### **1. Servicio de Analytics**
```javascript
// Actualizar ranking de productos más buscados
analytics.increment('product_searches', {
  product_id: event.data.id_producto,
  product_name: event.data.nombre_producto,
  timestamp: event.timestamp
});

// Calcular ahorro promedio
analytics.track('avg_savings', event.data.ahorro_potencial);
```

#### **2. Servicio de Recomendaciones**
```javascript
// Sugerir alternativas si el ahorro es significativo
if (event.data.ahorro_potencial > 20) {
  recommendations.suggest({
    user_id: event.data.id_usuario,
    product_id: event.data.id_producto,
    best_pharmacy: event.data.resultados.find(r => r.precio === event.data.precio_min).farmacia,
    savings: event.data.ahorro_potencial
  });
}
```

#### **3. Servicio de Marketing**
```javascript
// Enviar alerta de precio favorable
if (event.data.ahorro_potencial > 30) {
  marketing.sendAlert({
    user_id: event.data.id_usuario,
    message: `¡Ahorra $${event.data.ahorro_potencial} en ${event.data.nombre_producto}!`,
    best_price: event.data.precio_min,
    pharmacy: event.data.resultados.find(r => r.precio === event.data.precio_min).farmacia
  });
}
```

---

## 🔒 Seguridad y Validación

### **1. Firma HMAC (Webhook Signature)**

Para garantizar la autenticidad de los webhooks, se puede implementar firma HMAC-SHA256:

```typescript
interface SignedWebhookPayload extends WebhookPayload<any> {
  signature: string;  // HMAC-SHA256 del payload
}
```

**Ejemplo de generación de firma:**

```typescript
import * as crypto from 'crypto';

function generateSignature(payload: object, secret: string): string {
  const payloadString = JSON.stringify(payload);
  return crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex');
}

// Uso
const payload = { event_type: "prescripcion.registrada", ... };
const signature = generateSignature(payload, process.env.WEBHOOK_SECRET);

const signedPayload = {
  ...payload,
  signature
};
```

**Verificación en el consumidor:**

```typescript
function verifySignature(payload: any, receivedSignature: string, secret: string): boolean {
  const { signature, ...dataWithoutSignature } = payload;
  const expectedSignature = generateSignature(dataWithoutSignature, secret);
  return crypto.timingSafeEqual(
    Buffer.from(receivedSignature),
    Buffer.from(expectedSignature)
  );
}
```

### **2. Headers HTTP Recomendados**

Cuando se envían webhooks a endpoints externos:

```http
POST /webhook/prescripcion HTTP/1.1
Host: api.farmacia-externa.com
Content-Type: application/json
X-Webhook-Signature: sha256=abc123def456...
X-Event-Type: prescripcion.registrada
X-Event-ID: prescripcion-123-1734234567890
X-Source: comparador-service
X-Timestamp: 2025-12-15T10:30:00.000Z
User-Agent: SaludMedX-Webhook/1.0
```

### **3. Validación de Schema**

Los consumidores deben validar el schema del payload:

```typescript
import Ajv from 'ajv';

const prescripcionSchema = {
  type: "object",
  required: ["event_type", "event_id", "timestamp", "version", "source", "data"],
  properties: {
    event_type: { type: "string", const: "prescripcion.registrada" },
    event_id: { type: "string", pattern: "^prescripcion-[0-9]+-[0-9]+$" },
    timestamp: { type: "string", format: "date-time" },
    version: { type: "string", pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+$" },
    source: { type: "string" },
    data: {
      type: "object",
      required: ["id_prescripcion", "id_paciente", "nombre_paciente", "medicamentos"],
      properties: {
        id_prescripcion: { type: "number" },
        id_paciente: { type: "number" },
        nombre_paciente: { type: "string" },
        medicamentos: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            required: ["id_producto", "nombre_comercial", "dosis", "frecuencia", "duracion_dias"],
            properties: {
              id_producto: { type: "number" },
              nombre_comercial: { type: "string" },
              dosis: { type: "string" },
              frecuencia: { type: "string" },
              duracion_dias: { type: "number", minimum: 1 }
            }
          }
        }
      }
    }
  }
};

const ajv = new Ajv();
const validate = ajv.compile(prescripcionSchema);

// Validar payload
if (!validate(payload)) {
  console.error('Payload inválido:', validate.errors);
  throw new Error('Invalid webhook payload');
}
```

---

## 🔄 Reintentos y Manejo de Errores

### **Política de Reintentos**

Cuando un webhook falla, el sistema debe implementar reintentos con exponential backoff:

```typescript
interface RetryPolicy {
  max_attempts: number;        // Máximo 6 intentos
  backoff_strategy: "exponential";
  intervals: number[];         // [60s, 300s, 1800s, 7200s, 43200s] (1min, 5min, 30min, 2h, 12h)
  timeout: number;             // 30 segundos por intento
}

const retryPolicy: RetryPolicy = {
  max_attempts: 6,
  backoff_strategy: "exponential",
  intervals: [60, 300, 1800, 7200, 43200],
  timeout: 30000
};
```

### **Respuestas Esperadas del Consumidor**

#### **✅ Éxito (200-299)**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "success",
  "message": "Webhook procesado correctamente",
  "event_id": "prescripcion-123-1734234567890",
  "processed_at": "2025-12-15T10:30:05.000Z"
}
```

#### **❌ Error Temporal (500-599)**
```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json

{
  "status": "error",
  "message": "Servicio temporalmente no disponible",
  "retry_after": 300,
  "event_id": "prescripcion-123-1734234567890"
}
```

**Acción:** Reintentar según política de reintentos

#### **❌ Error Permanente (400-499)**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "status": "error",
  "message": "Payload inválido: campo 'medicamentos' requerido",
  "event_id": "prescripcion-123-1734234567890"
}
```

**Acción:** NO reintentar, enviar a Dead Letter Queue

---

## 📊 Monitoring y Observabilidad

### **Métricas a Rastrear**

```typescript
interface WebhookMetrics {
  event_type: string;
  event_id: string;
  delivery_attempts: number;      // Cantidad de intentos
  delivery_status: "success" | "failed" | "pending";
  response_time_ms: number;       // Tiempo de respuesta del consumidor
  http_status_code: number;
  error_message?: string;
  first_attempt_at: string;
  last_attempt_at: string;
  delivered_at?: string;
}
```

### **Logs Estructurados**

```json
{
  "timestamp": "2025-12-15T10:30:00.000Z",
  "level": "info",
  "service": "webhook-dispatcher",
  "event_type": "prescripcion.registrada",
  "event_id": "prescripcion-123-1734234567890",
  "consumer_url": "https://api.farmacia.com/webhook",
  "attempt": 1,
  "http_status": 200,
  "response_time_ms": 245,
  "message": "Webhook entregado exitosamente"
}
```

---

## 🧪 Testing de Webhooks

### **Payload de Prueba**

```json
{
  "event_type": "prescripcion.registrada",
  "event_id": "test-prescripcion-999-1234567890",
  "timestamp": "2025-12-15T10:00:00.000Z",
  "version": "1.0.0",
  "source": "comparador-service-test",
  "data": {
    "id_prescripcion": 999,
    "id_paciente": 1,
    "nombre_paciente": "Usuario de Prueba",
    "id_medico": 1,
    "nombre_medico": "Dr. Test",
    "diagnostico": "Diagnóstico de prueba",
    "medicamentos": [
      {
        "id_producto": 1,
        "nombre_comercial": "Medicamento Test",
        "dosis": "1 tableta",
        "frecuencia": "cada 24 horas",
        "duracion_dias": 7
      }
    ],
    "fecha_emision": "2025-12-15T10:00:00.000Z",
    "estado": "activa"
  },
  "metadata": {
    "correlation_id": "test-session-123",
    "user_id": 1
  }
}
```

### **Endpoint de Testing**

```bash
# Enviar webhook de prueba
curl -X POST http://localhost:3002/webhook/test \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: test-secret-key" \
  -d @test-prescripcion-payload.json
```

---

## 📋 Checklist de Integración

Para consumidores de webhooks:

- [ ] **Validar firma HMAC** antes de procesar
- [ ] **Validar schema** del payload
- [ ] **Verificar `event_type`** esperado
- [ ] **Implementar idempotencia** usando `event_id`
- [ ] **Responder con 2xx** dentro de 30 segundos
- [ ] **Loggear** todos los webhooks recibidos
- [ ] **Manejar errores** y responder con códigos apropiados
- [ ] **No hacer operaciones sincrónicas pesadas** en el endpoint
- [ ] **Encolar** procesamiento asíncrono si es necesario
- [ ] **Monitorear** métricas de recepción

---

## 🔗 Referencias

- [RFC 8927 - JSON Meta Application Protocol (JMAP)](https://datatracker.ietf.org/doc/html/rfc8927)
- [CloudEvents Specification v1.0](https://cloudevents.io/)
- [Webhook Best Practices](https://github.com/adnanh/webhook/blob/master/docs/Webhook-Best-Practices.md)
- [OWASP API Security Project](https://owasp.org/www-project-api-security/)

---

## 📞 Soporte

Para dudas sobre la integración de webhooks:

- **Documentación**: [EVENTOS_DE_NEGOCIO.md](EVENTOS_DE_NEGOCIO.md)
- **Diagramas**: [DIAGRAMA_EVENTOS.md](DIAGRAMA_EVENTOS.md)
- **Email**: soporte-webhooks@saludmedx.com
- **Slack**: #webhooks-support

---

**Versión del Documento:** 1.0.0  
**Fecha:** 15 de Diciembre, 2025  
**Última Actualización:** 15 de Diciembre, 2025
