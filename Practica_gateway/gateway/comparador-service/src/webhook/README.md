# 🧪 Ejemplos de Implementación de Webhooks

Este directorio contiene ejemplos de código para implementar consumidores de webhooks que procesan los eventos de negocio del sistema.

## 📁 Archivos

- **`webhook-consumer.service.example.ts`** - Servicio que procesa webhooks con validación y lógica de negocio
- **`webhook.controller.example.ts`** - Controlador HTTP para recibir webhooks
- **`webhook-tests.http`** - Tests de ejemplo usando REST Client (VS Code)

## 🚀 Uso

### 1. Instalar en tu proyecto

```bash
# Copiar archivos a tu servicio
cp webhook-consumer.service.example.ts src/webhook/webhook-consumer.service.ts
cp webhook.controller.example.ts src/webhook/webhook.controller.ts

# Instalar dependencias si es necesario
npm install
```

### 2. Registrar en el módulo

```typescript
// app.module.ts
import { WebhookController } from './webhook/webhook.controller';
import { WebhookConsumerService } from './webhook/webhook-consumer.service';

@Module({
  controllers: [WebhookController],
  providers: [WebhookConsumerService],
})
export class AppModule {}
```

### 3. Configurar variables de entorno

```bash
# .env
WEBHOOK_SECRET=tu-clave-secreta-hmac-256
```

### 4. Probar endpoints

```bash
# Test de prescripción
curl -X POST http://localhost:3002/webhook/prescripcion \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: sha256=abc123..." \
  -H "X-Event-ID: prescripcion-123-1234567890" \
  -d @test-prescripcion-payload.json

# Test de comparación
curl -X POST http://localhost:3002/webhook/comparacion \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: sha256=def456..." \
  -H "X-Event-ID: comparacion-456-1234567890" \
  -d @test-comparacion-payload.json
```

## 🔒 Características Implementadas

### ✅ Validación de Firma HMAC
```typescript
const isValid = webhookConsumer.validateSignature(payload, signature);
```

### ✅ Idempotencia
```typescript
if (isEventProcessed(eventId)) {
  return; // Ignorar evento duplicado
}
```

### ✅ Manejo de Errores
- Errores 4xx (permanentes) → No reintentar
- Errores 5xx (temporales) → Reintentar

### ✅ Logging Estructurado
```typescript
logger.log(`Procesando evento: ${event_id}`);
```

### ✅ Respuesta Rápida (< 30s)
El endpoint responde inmediatamente y procesa en background si es necesario.

## 📊 Métricas Recomendadas

- **webhooks.received** - Total de webhooks recibidos
- **webhooks.processed** - Webhooks procesados exitosamente
- **webhooks.failed** - Webhooks fallidos
- **webhooks.duplicates** - Webhooks duplicados (idempotencia)
- **webhooks.latency** - Tiempo de procesamiento

## 🔗 Referencias

- [WEBHOOK_PAYLOADS.md](../../WEBHOOK_PAYLOADS.md) - Estructura completa de payloads
- [EVENTOS_DE_NEGOCIO.md](../../EVENTOS_DE_NEGOCIO.md) - Especificación de eventos

## ⚠️ Notas Importantes

1. **Producción**: Usar Redis o base de datos para idempotencia, no Set en memoria
2. **Seguridad**: Siempre validar firma HMAC en producción
3. **Timeouts**: Configurar timeout de 30 segundos máximo
4. **Retry**: El emisor reintentará automáticamente en caso de error 5xx
5. **Logs**: Implementar logging estructurado para debugging

## 📝 TODO para Producción

- [ ] Implementar idempotencia con Redis (TTL 7 días)
- [ ] Agregar circuit breaker para llamadas externas
- [ ] Implementar rate limiting
- [ ] Agregar métricas con Prometheus
- [ ] Configurar alertas para webhooks fallidos
- [ ] Implementar cola de procesamiento async (Bull/BullMQ)
- [ ] Agregar tests unitarios e integración
- [ ] Documentar API con Swagger/OpenAPI
