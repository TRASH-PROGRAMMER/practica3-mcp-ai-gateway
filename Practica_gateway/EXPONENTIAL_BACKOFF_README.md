# Sistema de Retry con Exponential Backoff

## 📋 Resumen

Implementación completa de retry automático con **exponential backoff verdadero** para el sistema de webhooks. Proporciona reintentos inteligentes con delays exponenciales y jitter aleatorio para evitar thundering herd problems.

## 🎯 Características

✅ **Exponential Backoff Real**
- Formula: `delay = baseDelay * (multiplier ^ attempt)`
- Límite máximo configurable
- Incremento exponencial 2x, 3x, 4x, etc.

✅ **Jitter Aleatorio**
- Evita thundering herd (múltiples clientes reintentando simultáneamente)
- Configuración de factor de jitter (±10% por defecto)
- Randomización automática de delays

✅ **Configurable y Reutilizable**
- Servicio independiente (`ExponentialBackoffService`)
- Configuración por suscripción
- Type-safe con generics

✅ **Observabilidad Completa**
- Logs estructurados de cada intento
- Métricas de tiempo total y delays
- Tracking de éxito/fracaso

## 📐 Arquitectura

### Componentes

```
ExponentialBackoffService (Core)
  ├── executeWithRetry<T>() - Ejecuta operación con reintentos
  ├── calculateDelay() - Calcula delay exponencial
  ├── calculateDelaySequence() - Planifica secuencia completa
  └── formatDelay() / getBackoffSummary() - Utilidades

WebhookSenderService (Consumer)
  ├── sendWebhook() - Usa backoff.executeWithRetry()
  ├── attemptSend() - Lógica de envío único
  └── generateSignature() - Firma HMAC

WebhookDeliveryService
  ├── deliverWebhook() - Orquesta envíos paralelos
  └── retryFailedDeliveries() - Cron job para DLQ
```

### Flujo de Retry

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. WebhookDeliveryService.deliverWebhook(webhook)              │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. WebhookSenderService.sendWebhook(webhook, subscription)     │
│    - Prepara retryConfig                                        │
│    - Logs inicio de envío                                       │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. ExponentialBackoffService.executeWithRetry()                │
│    FOR attempt = 1 to maxAttempts:                             │
│      ├─ IF attempt > 1:                                        │
│      │    └─ delay = baseDelay * (multiplier ^ (attempt-1))   │
│      │       delay = min(delay, maxDelay)                     │
│      │       delay *= (1 ± jitterFactor * random())           │
│      │       await sleep(delay)                               │
│      │                                                         │
│      ├─ TRY: result = await operation()                       │
│      │   └─ RETURN success                                    │
│      │                                                         │
│      └─ CATCH error:                                          │
│           └─ Log warning, continue to next attempt            │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. WebhookSenderService.attemptSend(webhook, subscription)     │
│    ├─ generateSignature() - Firma HMAC-SHA256                  │
│    ├─ circuitBreaker.execute() - Protección por URL            │
│    │    └─ httpService.post() - Envío HTTP                     │
│    ├─ IF status < 300: return success                          │
│    └─ ELSE: throw error (activa retry)                         │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 Configuración

### Configuración por Defecto

```typescript
{
  baseDelay: 1000,      // 1 segundo
  multiplier: 2,        // Duplicar cada vez
  maxDelay: 60000,      // 1 minuto máximo
  maxAttempts: 5,       // 5 intentos
  enableJitter: true,   // Jitter activado
  jitterFactor: 0.1,    // ±10%
}
```

### Secuencia de Delays (sin jitter)

| Intento | Delay      | Acumulado |
|---------|------------|-----------|
| 1       | 0ms        | 0ms       |
| 2       | 1000ms (1s)  | 1s      |
| 3       | 2000ms (2s)  | 3s      |
| 4       | 4000ms (4s)  | 7s      |
| 5       | 8000ms (8s)  | 15s     |

**Tiempo máximo total: ~15 segundos**

### Secuencia con Jitter (±10%)

| Intento | Delay Base | Con Jitter      |
|---------|------------|-----------------|
| 1       | 0ms        | 0ms             |
| 2       | 1000ms     | 900-1100ms      |
| 3       | 2000ms     | 1800-2200ms     |
| 4       | 4000ms     | 3600-4400ms     |
| 5       | 8000ms     | 7200-8800ms     |

### Configuraciones Personalizadas

#### Reintentos Agresivos (rápidos)
```typescript
{
  baseDelay: 500,       // 0.5s
  multiplier: 2,        // 2x
  maxDelay: 10000,      // 10s max
  maxAttempts: 4,
}
// Secuencia: 0.5s, 1s, 2s, 4s → Total: 7.5s
```

#### Reintentos Conservadores (lentos)
```typescript
{
  baseDelay: 2000,      // 2s
  multiplier: 3,        // 3x (más agresivo)
  maxDelay: 120000,     // 2 min max
  maxAttempts: 5,
}
// Secuencia: 2s, 6s, 18s, 54s, 120s → Total: 3.3 min
```

#### Reintentos Lineales (no exponenciales)
```typescript
{
  baseDelay: 5000,      // 5s
  multiplier: 1,        // Sin crecimiento (NO RECOMENDADO)
  maxDelay: 5000,       // Igual a baseDelay
  maxAttempts: 3,
}
// Secuencia: 5s, 5s, 5s → Total: 15s
```

## 💻 Uso

### 1. Configuración por Suscripción

```typescript
// Crear suscripción con retry personalizado
POST /webhook/subscriptions
{
  "name": "Sistema Crítico",
  "endpointUrl": "https://api.critical.com/webhooks",
  "secret": "super-secret-key-123",
  "events": ["producto.*", "prescripcion.creada"],
  "retryConfig": {
    "maxAttempts": 7,
    "baseDelay": 500,
    "multiplier": 2,
    "maxDelay": 30000,
    "enableJitter": true,
    "jitterFactor": 0.15
  }
}
```

### 2. Envío Automático con Retry

```typescript
// En RabbitMQ listener
const webhook = await transformer.transformToStandardWebhook(event);
const result = await deliveryService.deliverWebhook(webhook);

// WebhookSenderService automáticamente:
// 1. Usa ExponentialBackoffService.executeWithRetry()
// 2. Intenta hasta maxAttempts veces
// 3. Aplica delays exponenciales con jitter
// 4. Logs de cada intento
// 5. Retorna resultado final
```

### 3. Estadísticas de Backoff

```bash
# Ver estrategia configurada
GET /webhook/subscriptions/sender/stats

Response:
{
  "defaultTimeout": 30000,
  "defaultRetryConfig": {
    "maxAttempts": 5,
    "baseDelay": 1000,
    "multiplier": 2,
    "maxDelay": 60000,
    "enableJitter": true,
    "jitterFactor": 0.1
  },
  "backoffStrategy": {
    "type": "exponential",
    "baseDelay": "1000ms",
    "multiplier": "2x",
    "maxDelay": "60000ms",
    "maxAttempts": 5,
    "jitter": "±10%"
  },
  "delaySequence": ["1000ms", "2000ms", "4000ms", "8000ms"],
  "maxTotalDuration": "15000ms"
}
```

### 4. Uso Directo de ExponentialBackoffService

```typescript
// Para cualquier operación que necesite retry
import { ExponentialBackoffService } from './exponential-backoff.service';

@Injectable()
export class MyService {
  constructor(private readonly backoff: ExponentialBackoffService) {}

  async processWithRetry() {
    const result = await this.backoff.executeWithRetry(
      async () => await this.riskyOperation(),
      {
        baseDelay: 1000,
        multiplier: 2,
        maxAttempts: 3,
        enableJitter: true,
      },
      { operation: 'processData', id: 123 }
    );

    if (result.success) {
      console.log('Éxito después de', result.attempts, 'intentos');
      console.log('Datos:', result.data);
    } else {
      console.error('Falló después de', result.attempts, 'intentos');
      console.error('Error:', result.error);
    }

    // Estadísticas
    console.log('Delays usados:', result.delays); // [1000, 2000]
    console.log('Tiempo total:', result.totalDuration); // 3500ms
  }
}
```

## 📊 Ejemplos de Secuencias

### Ejemplo 1: Configuración Por Defecto (5 intentos)

```
Intento 1 → Falla inmediatamente
  ⏱️ Esperar: 1000ms (0.9s - 1.1s con jitter)
  
Intento 2 → Falla
  ⏱️ Esperar: 2000ms (1.8s - 2.2s con jitter)
  
Intento 3 → Falla
  ⏱️ Esperar: 4000ms (3.6s - 4.4s con jitter)
  
Intento 4 → Falla
  ⏱️ Esperar: 8000ms (7.2s - 8.8s con jitter)
  
Intento 5 → ✅ Éxito

Total: ~15 segundos
```

### Ejemplo 2: Multiplier 3x (crecimiento rápido)

```typescript
{ baseDelay: 1000, multiplier: 3, maxAttempts: 4 }

Intento 1 → Falla
  ⏱️ Esperar: 1000ms
  
Intento 2 → Falla
  ⏱️ Esperar: 3000ms (1s * 3^1)
  
Intento 3 → Falla
  ⏱️ Esperar: 9000ms (1s * 3^2)
  
Intento 4 → ✅ Éxito

Total: 13 segundos
```

### Ejemplo 3: Con MaxDelay Límite

```typescript
{ baseDelay: 2000, multiplier: 2, maxDelay: 10000, maxAttempts: 6 }

Intento 1 → Falla
  ⏱️ Esperar: 2000ms
  
Intento 2 → Falla
  ⏱️ Esperar: 4000ms
  
Intento 3 → Falla
  ⏱️ Esperar: 8000ms
  
Intento 4 → Falla
  ⏱️ Esperar: 10000ms (limitado por maxDelay, sería 16s)
  
Intento 5 → Falla
  ⏱️ Esperar: 10000ms (limitado por maxDelay, sería 32s)
  
Intento 6 → ✅ Éxito

Total: 34 segundos
```

## 🔍 Observabilidad

### Logs de Retry

```json
{
  "level": "info",
  "message": "Iniciando envío de webhook con exponential backoff",
  "subscriptionId": 1,
  "subscriptionName": "Sistema Crítico",
  "url": "https://api.example.com/webhooks",
  "eventId": "evt_123",
  "eventType": "producto.creado",
  "backoffStrategy": {
    "baseDelay": 1000,
    "multiplier": 2,
    "maxAttempts": 5
  }
}

// Primer fallo
{
  "level": "warn",
  "message": "Intento 1 fallido, reintentando en 1000ms",
  "subscriptionId": 1,
  "error": "ECONNREFUSED",
  "nextDelay": 1000
}

// Segundo fallo
{
  "level": "warn",
  "message": "Intento 2 fallido, reintentando en 2000ms",
  "subscriptionId": 1,
  "error": "ETIMEDOUT",
  "nextDelay": 2000
}

// Éxito final
{
  "level": "info",
  "message": "Operación exitosa en intento 3",
  "subscriptionId": 1,
  "attempts": 3,
  "totalDuration": 3456
}
```

### Métricas de Entrega

```json
{
  "subscriptionId": 1,
  "attempts": 3,
  "totalDuration": 3456,
  "delays": [1000, 2000],
  "statusCode": 200,
  "success": true
}
```

## 📈 Ventajas del Exponential Backoff

### 1. Protección contra Sobrecargas

```
Sin backoff (reintentos inmediatos):
│││││││││ → 9 requests en 1 segundo → Sobrecarga

Con backoff exponencial:
│  │    │        │ → 4 requests en 15 segundos → Distribuido
```

### 2. Jitter Evita Thundering Herd

```
Sin jitter (100 clientes con mismo intervalo):
  T=0s: ████████████ 100 requests simultáneos
  T=1s: ████████████ 100 requests simultáneos
  T=2s: ████████████ 100 requests simultáneos

Con jitter ±10% (100 clientes):
  T=0.9s-1.1s: ████████████ Distribuidos en 200ms
  T=1.8s-2.2s: ████████████ Distribuidos en 400ms
  T=3.6s-4.4s: ████████████ Distribuidos en 800ms
```

### 3. Adaptación Automática

- **Errores transitorios**: Se recuperan en primeros intentos
- **Errores persistentes**: Delays largos reducen carga
- **Servicios lentos**: Circuit breaker + backoff dan tiempo de recuperación

## 🧪 Testing

### Test de Secuencia de Delays

```typescript
describe('ExponentialBackoffService', () => {
  it('debe calcular secuencia exponencial correctamente', () => {
    const service = new ExponentialBackoffService();
    
    const delays = service.calculateDelaySequence({
      baseDelay: 1000,
      multiplier: 2,
      maxDelay: 60000,
      maxAttempts: 5,
    });
    
    expect(delays).toEqual([1000, 2000, 4000, 8000]);
  });

  it('debe aplicar maxDelay límite', () => {
    const service = new ExponentialBackoffService();
    
    const delays = service.calculateDelaySequence({
      baseDelay: 10000,
      multiplier: 2,
      maxDelay: 15000,
      maxAttempts: 4,
    });
    
    expect(delays).toEqual([10000, 15000, 15000]); // Limitado
  });
});
```

### Test de Retry con Mock

```typescript
it('debe reintentar hasta éxito', async () => {
  const service = new ExponentialBackoffService();
  let attempts = 0;
  
  const result = await service.executeWithRetry(
    async () => {
      attempts++;
      if (attempts < 3) throw new Error('Falla temporal');
      return 'Éxito';
    },
    { baseDelay: 100, maxAttempts: 5 }
  );
  
  expect(result.success).toBe(true);
  expect(result.attempts).toBe(3);
  expect(result.data).toBe('Éxito');
});

it('debe fallar después de maxAttempts', async () => {
  const service = new ExponentialBackoffService();
  
  const result = await service.executeWithRetry(
    async () => { throw new Error('Siempre falla'); },
    { baseDelay: 100, maxAttempts: 3 }
  );
  
  expect(result.success).toBe(false);
  expect(result.attempts).toBe(3);
  expect(result.error?.message).toBe('Siempre falla');
});
```

## 🚀 Mejoras Futuras

### 1. Adaptive Backoff
```typescript
// Ajustar delays según tasa de éxito histórica
const adaptiveMultiplier = successRate > 0.8 ? 1.5 : 2.5;
```

### 2. Backoff Decorrelacionado
```typescript
// Evitar sincronización usando decorrelated jitter
delay = Math.min(maxDelay, random(baseDelay, previousDelay * 3));
```

### 3. Retry Budgets
```typescript
// Límite global de reintentos por periodo
if (retryBudget.isExceeded()) {
  skipRetry();
}
```

## 📚 Referencias

- **AWS Architecture Blog**: [Exponential Backoff And Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- **Google Cloud**: [Retry Strategy Best Practices](https://cloud.google.com/iot/docs/how-tos/exponential-backoff)
- **Stripe**: [Designing robust and predictable APIs with idempotency](https://stripe.com/blog/idempotency)

---

**Implementado**: Diciembre 2025  
**Versión**: 1.0.0  
**Mantenedor**: Sistema de Webhooks
