# 🔐 Resumen Rápido - Sistema de Firma HMAC

## ✅ Implementación Completa

Se ha implementado un **sistema completo de generación y validación de firmas HMAC-SHA256** para webhooks con las siguientes características:

### 🎯 Componentes Creados

| Archivo | Descripción | Ubicación |
|---------|-------------|-----------|
| `hmac-signature.service.ts` | Servicio principal de firma HMAC | `src/webhook/` |
| `hmac-validation.middleware.ts` | Middleware de validación automática | `src/webhook/` |
| `webhook.controller.ts` | Controlador con validación integrada | `src/webhook/` |
| `webhook.module.ts` | Módulo NestJS completo | `src/webhook/` |
| `webhook-hmac-tests.http` | 10 tests completos | `src/webhook/` |
| `generate-webhook-secret.js` | Generador de claves | Raíz del proyecto |
| `webhook-sender.example.js` | Emisor de ejemplo | Raíz del proyecto |
| `.env.example` | Configuración de ejemplo | Raíz del proyecto |
| `HMAC_README.md` | Documentación completa | `src/webhook/` |

---

## 🚀 Inicio Rápido (3 pasos)

### 1. Generar Clave Secreta

```bash
cd gateway/comparador-service
node generate-webhook-secret.js
```

Copiar la clave generada y agregarla a `.env`:

```bash
WEBHOOK_SECRET=la-clave-generada-aqui
```

### 2. Importar Módulo

En `app.module.ts`:

```typescript
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    WebhookModule,  // ← Agregar esta línea
    // ... otros módulos
  ],
})
export class AppModule {}
```

### 3. Probar

```bash
# Iniciar servidor
npm run start:dev

# En otra terminal, ejecutar tests
# Abrir: src/webhook/webhook-hmac-tests.http
# Ejecutar con REST Client (VS Code extension)
```

---

## 🔑 Características Implementadas

### ✅ Seguridad

- **HMAC-SHA256:** Firma criptográfica robusta
- **Timing Attack Protection:** Comparación de tiempo constante
- **Replay Attack Prevention:** Validación de timestamp (ventana de 5 minutos)
- **Key Rotation:** Soporte para rotación de claves

### ✅ Confiabilidad

- **Idempotencia:** Previene procesamiento duplicado
- **Validación Automática:** Middleware que valida antes de procesar
- **Reintentos:** Ejemplo con backoff exponencial

### ✅ Desarrollo

- **Testing Completo:** 10 casos de prueba
- **Generador de Firmas:** Endpoint `/webhook/generate-signature`
- **Logs Estructurados:** Debugging fácil
- **Health Check:** `/webhook/health`

---

## 📊 Casos de Prueba

| # | Test | Resultado Esperado |
|---|------|-------------------|
| 1 | ✅ Firma válida | 200 OK |
| 2 | ❌ Sin firma | 401 Unauthorized |
| 3 | ❌ Firma inválida | 401 Unauthorized |
| 4 | ❌ Timestamp expirado | 401 Unauthorized |
| 5 | 🔄 Evento duplicado | 200 OK (duplicate) |
| 6 | ❌ Payload sin event_type | 400 Bad Request |
| 7 | ❌ Evento incorrecto | 400 Bad Request |
| 8 | ✅ Comparación válida | 200 OK |
| 9 | ❌ Payload inválido | 400 Bad Request |
| 10 | ✅ Health check | 200 OK |

---

## 🧪 Testing

### Opción A: REST Client (VS Code)

1. Instalar extensión: **REST Client**
2. Abrir: `src/webhook/webhook-hmac-tests.http`
3. Click en "Send Request" sobre cada test

### Opción B: Script Node.js

```bash
# Enviar webhooks de ejemplo
node webhook-sender.example.js
```

### Opción C: curl

```bash
# Primero generar firma
curl -X POST http://localhost:3002/webhook/generate-signature \
  -H "Content-Type: application/json" \
  -d '{"event_type":"prescripcion.registrada","event_id":"test-123","data":{}}'

# Usar firma generada
curl -X POST http://localhost:3002/webhook/prescripcion \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: FIRMA_AQUI" \
  -H "X-Webhook-Timestamp: TIMESTAMP_AQUI" \
  -H "X-Event-ID: test-123" \
  -d '{"event_type":"prescripcion.registrada","event_id":"test-123","data":{}}'
```

---

## 📖 Documentación Detallada

Para información completa, ver:

📄 **[HMAC_README.md](gateway/comparador-service/src/webhook/HMAC_README.md)**

Contiene:
- ✅ Explicación detallada de HMAC
- ✅ Arquitectura completa
- ✅ Guía de configuración paso a paso
- ✅ Buenas prácticas de seguridad
- ✅ Solución de problemas
- ✅ Referencias y recursos

---

## 🔒 Recordatorios de Seguridad

### ⚠️ IMPORTANTE

1. **NUNCA** subir `WEBHOOK_SECRET` a Git
2. **SIEMPRE** usar claves de mínimo 32 caracteres
3. **ROTAR** claves cada 90 días
4. **USAR** diferentes claves por ambiente (dev/staging/prod)

### ✅ Generación de Clave Segura

```bash
# Opción 1: Con script incluido
node generate-webhook-secret.js

# Opción 2: Con OpenSSL
openssl rand -hex 32

# Opción 3: Con Node.js directo
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 📋 Checklist de Integración

- [ ] Generar clave secreta segura
- [ ] Agregar `WEBHOOK_SECRET` a `.env`
- [ ] Importar `WebhookModule` en `app.module.ts`
- [ ] Configurar middleware (opcional)
- [ ] Probar endpoint `/webhook/health`
- [ ] Ejecutar tests en `webhook-hmac-tests.http`
- [ ] Verificar logs de validación
- [ ] Implementar lógica de negocio en controlador
- [ ] Configurar Redis para idempotencia (producción)
- [ ] Establecer monitoreo y alertas

---

## 🎓 Ejemplos de Uso

### Emisor (enviar webhook)

```typescript
import { HmacSignatureService } from './hmac-signature.service';

const hmacService = new HmacSignatureService();
const payload = { event_type: 'test', data: {} };
const headers = hmacService.generateWebhookHeaders(payload);

// Enviar con axios, fetch, etc.
await axios.post('http://api.example.com/webhook', payload, { headers });
```

### Receptor (validar webhook)

```typescript
@Post('webhook')
async handleWebhook(
  @Body() payload: any,
  @Headers('x-webhook-signature') signature: string,
  @Headers('x-webhook-timestamp') timestamp: string,
) {
  const timestampNum = parseInt(timestamp);
  
  if (!this.hmacService.validateSignature(payload, signature, timestampNum)) {
    throw new UnauthorizedException('Firma inválida');
  }
  
  // Procesar webhook...
}
```

---

## 📞 Soporte

**¿Problemas?** Revisar:

1. **Logs del servicio** - Verificar mensajes de error
2. **Health check** - `GET /webhook/health`
3. **Tests** - Ejecutar `webhook-hmac-tests.http`
4. **Documentación** - Leer `HMAC_README.md`
5. **Variables de entorno** - Verificar `.env`

---

## 🎯 Próximos Pasos

### Producción

- [ ] Implementar Redis para idempotencia (TTL 7 días)
- [ ] Configurar monitoreo (Prometheus, DataDog)
- [ ] Establecer alertas de seguridad
- [ ] Documentar para equipo de infraestructura
- [ ] Plan de rotación de claves

### Mejoras Opcionales

- [ ] Rate limiting por consumidor
- [ ] Queue para procesamiento asíncrono
- [ ] Dashboard de webhooks
- [ ] Webhooks de salida (para notificar a otros sistemas)

---

**✅ Sistema HMAC listo para usar en desarrollo y producción** 🚀
