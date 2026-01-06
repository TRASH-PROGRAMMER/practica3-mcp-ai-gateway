# Eventos de Negocio - Sistema Farmacéutico

## 📋 1. EVENTO: `prescripcion.registrada`

### **Descripción**
Evento que se emite cuando un médico registra una nueva prescripción médica en el sistema, incluyendo los medicamentos recetados.

### **Cuándo se dispara**
- Un médico crea una prescripción para un paciente
- Se asocian medicamentos específicos con dosis y duración

### **Payload del Evento**
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
    "nombre_paciente": "Juan Pérez",
    "id_medico": 789,
    "nombre_medico": "Dra. María González",
    "diagnostico": "Hipertensión arterial",
    "medicamentos": [
      {
        "id_producto": 1,
        "nombre_comercial": "Losartán 50mg",
        "dosis": "1 tableta",
        "frecuencia": "cada 12 horas",
        "duracion_dias": 30
      }
    ],
    "fecha_emision": "2025-12-15T10:30:00.000Z"
  }
}
```

> 📘 **Nota:** Para estructura completa de payloads y detalles de integración webhook, ver [WEBHOOK_PAYLOADS.md](WEBHOOK_PAYLOADS.md)

### **Consumidores del Evento**
- **Sistema de Notificaciones**: Envía SMS/Email al paciente
- **Sistema de Inventario**: Reserva medicamentos en farmacia
- **Sistema de Auditoría**: Registro de prescripciones para control
- **Sistema de Facturación**: Prepara presupuesto

### **Reglas de Negocio**
- ✅ La prescripción debe tener al menos 1 medicamento
- ✅ El médico debe estar autorizado (validación previa)
- ✅ Los medicamentos deben existir en el catálogo
- ✅ Genera una única notificación por prescripción (idempotencia)

### **Implementación**
- **Archivo**: [prescripcion.service.ts](gateway/comparador-service/src/prescripcion/prescripcion.service.ts)
- **Línea de emisión**: Método `registrarPrescripcion()`
- **Cola RabbitMQ**: `producto_events`

---

## 🔍 2. EVENTO: `comparacion.realizada`

### **Descripción**
Evento que se emite cuando un usuario (paciente o farmacéutico) realiza una comparación de precios de un medicamento entre diferentes farmacias.

### **Cuándo se dispara**
- Un usuario consulta precios de un medicamento específico
- El sistema compara precios entre múltiples farmacias
- Se calcula el ahorro potencial

### **Payload del Evento**
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
    "nombre_producto": "Losartán 50mg",
    "id_usuario": 789,
    "precio_min": 85.50,
    "precio_max": 120.00,
    "ahorro_potencial": 34.50,
    "total_farmacias": 3,
    "fecha_comparacion": "2025-12-15T11:15:00.000Z"
  }
}
```

> 📘 **Nota:** Para estructura completa de payloads y detalles de integración webhook, ver [WEBHOOK_PAYLOADS.md](WEBHOOK_PAYLOADS.md)

### **Consumidores del Evento**
- **Sistema de Analytics**: Mide popularidad de productos
- **Sistema de Recomendaciones**: Sugiere alternativas más baratas
- **Sistema de Marketing**: Identifica productos con alta demanda
- **Sistema de Reportes**: Genera estadísticas de ahorro

### **Reglas de Negocio**
- ✅ Debe haber al menos 2 farmacias para comparar
- ✅ Los precios deben ser actualizados (< 24 horas)
- ✅ Se registra incluso si el usuario no compra
- ✅ Calcula métricas: precio_min, precio_max, ahorro_potencial

### **Implementación**
- **Archivo**: [comparador.service.ts](gateway/comparador-service/src/comparador/comparador.service.ts)
- **Línea de emisión**: Método `compararPrecios()`
- **Cola RabbitMQ**: `producto_events`

---

## 🏗️ Arquitectura de Eventos

```
┌─────────────────────────────────────────────────────────────┐
│                    API GATEWAY (Puerto 3000)                 │
└───────────────┬─────────────────────────────────────────────┘
                │
                ├─── POST /api/prescripciones
                │    └─> Comando: registrar_prescripcion
                │
                └─── GET /api/catalogo/precios?idProducto=1
                     └─> Query: comparar_precios
                │
                v
┌───────────────────────────────────────────────────────────────┐
│                       RABBITMQ                                │
│  Cola: producto_events (Eventos de Dominio)                  │
└───────────┬───────────────────────────────────────────────────┘
            │
            ├──> 📋 prescripcion.registrada
            │    └─> Consumidores: Notificaciones, Inventario
            │
            └──> 🔍 comparacion.realizada  
                 └─> Consumidores: Analytics, Marketing
```

---

## 🔄 Flujo de Eventos

### **Flujo 1: Registro de Prescripción**
```
1. Médico → POST /api/prescripciones
2. Gateway → Comando 'registrar_prescripcion' → Comparador Service
3. Comparador Service → Guarda en BD (Prescripcion + DetallePrescripcion)
4. Comparador Service → EMIT 'prescripcion.registrada' → RabbitMQ
5. Consumidores escuchan y reaccionan (notificaciones, inventario, etc.)
```

### **Flujo 2: Comparación de Precios**
```
1. Usuario → GET /api/catalogo/precios?idProducto=1
2. Gateway → Query 'comparar_precios' → Comparador Service
3. Comparador Service → Calcula comparación de precios
4. Comparador Service → Guarda en BD (Comparacion)
5. Comparador Service → EMIT 'comparacion.realizada' → RabbitMQ
6. Consumidores escuchan y reaccionan (analytics, marketing, etc.)
```

---

## 📊 Beneficios de esta Arquitectura

### **1. Desacoplamiento**
- Los servicios no necesitan conocerse entre sí
- Nuevos consumidores pueden agregarse sin modificar emisores

### **2. Auditabilidad**
- Cada evento queda registrado con timestamp
- Trazabilidad completa de acciones de negocio

### **3. Escalabilidad**
- Múltiples consumidores pueden procesar eventos en paralelo
- RabbitMQ maneja la distribución

### **4. Resiliencia**
- Si un consumidor falla, el evento permanece en la cola
- Reintentos automáticos (At-least-once delivery)

### **5. Analytics en Tiempo Real**
- Los eventos alimentan sistemas de métricas inmediatamente
- Business Intelligence basado en eventos reales

---

## 🧪 Pruebas

### **Probar Evento: prescripcion.registrada**
```bash
# Desde el gateway
POST http://localhost:3000/api/prescripciones
Content-Type: application/json

{
  "id_paciente": 1,
  "nombre_paciente": "Juan Pérez",
  "id_medico": 5,
  "nombre_medico": "Dra. María González",
  "diagnostico": "Hipertensión",
  "medicamentos": [
    {
      "id_producto": 1,
      "nombre_comercial": "Losartán 50mg",
      "dosis": "1 tableta",
      "frecuencia": "cada 12 horas",
      "duracion_dias": 30
    }
  ]
}
```

### **Probar Evento: comparacion.realizada**
```bash
# Desde el gateway
GET http://localhost:3000/api/catalogo/precios?idProducto=1
```

---

## 📝 Próximos Pasos

1. **Implementar Idempotencia** (OPCIÓN B de estrategias)
   - Agregar tabla `idempotency_keys`
   - Evitar procesamiento duplicado

2. **Implementar Dead Letter Queue** (OPCIÓN A)
   - Manejar eventos fallidos
   - Reintentos con exponential backoff

3. **Agregar más consumidores**
   - Servicio de notificaciones
   - Servicio de analytics
   - Servicio de inventario

4. **Monitoring**
   - Dashboard de eventos emitidos/consumidos
   - Alertas por eventos fallidos
