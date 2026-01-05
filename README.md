# Sistema de Comparación de Precios de Medicamentos

Sistema distribuido de microservicios para la comparación de precios de medicamentos entre farmacias, con notificaciones en tiempo real vía webhooks y Telegram.

## 🏗️ Arquitectura

El sistema está compuesto por tres microservicios principales que se comunican a través de **RabbitMQ**:

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Gateway   │◄────►│    RabbitMQ      │◄────►│   Productos     │
│  (Puerto    │      │  Message Broker  │      │   Service       │
│   3000)     │      └──────────────────┘      │  (Puerto 3001)  │
└─────────────┘              ▲                  └─────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   Comparador    │
                    │    Service      │
                    │  (Puerto 3002)  │
                    └─────────────────┘
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
              ┌──────────┐     ┌──────────┐
              │ Webhooks │     │ Telegram │
              │  System  │     │   Bot    │
              └──────────┘     └──────────┘
```

## ✨ Características Principales

### 🔄 Sistema de Eventos (Event-Driven)
- **CQRS Pattern**: Separación de comandos y consultas
- **Event Sourcing**: Registro completo del historial de eventos
- **Idempotencia**: Prevención de procesamiento duplicado de eventos
- **Dead Letter Queue (DLQ)**: Manejo automático de eventos fallidos

### 📡 Sistema de Webhooks
- **HTTP POST Notifications**: Envío de notificaciones a endpoints externos
- **HMAC Signatures**: Validación criptográfica de mensajes (SHA-256)
- **Circuit Breaker**: Protección contra servicios caídos
- **Exponential Backoff**: Reintentos inteligentes con delays incrementales
- **Delivery Tracking**: Registro de intentos de entrega y estados

### 💬 Integración con Telegram
- Notificaciones en tiempo real de prescripciones registradas
- Notificaciones de comparaciones de precios completadas
- Alertas de errores del sistema
- API REST para envío de mensajes personalizados

### 📊 Sistema de Observabilidad
- Dashboard de monitoreo en tiempo real
- Métricas de rendimiento (latencia, throughput, tasa de error)
- Trazabilidad distribuida (Distributed Tracing)
- Health checks de servicios
- Estadísticas de RabbitMQ

### 🗄️ Persistencia
- **TypeORM + SQLite**: Base de datos local para read models
- **Supabase** (Opcional): Registro de webhooks y entregas
- **Read Model**: Modelos optimizados para consultas rápidas

## 📋 Requisitos Previos

- **Node.js**: v18+ (probado con v22.20.0)
- **npm**: v9+
- **Docker**: Para ejecutar RabbitMQ
- **Docker Compose**: Para orchestrar contenedores

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
cd "C:\Users\RUDY PICO\Desktop\practica2segundo pracial\Practica_gateway"
```

### 2. Instalar dependencias

Instalar dependencias en cada servicio:

```bash
# Gateway
cd gateway
npm install --legacy-peer-deps

# Productos Service
cd gateway/productos-service
npm install --legacy-peer-deps

# Comparador Service
cd gateway/comparador-service
npm install --legacy-peer-deps
```

### 3. Levantar RabbitMQ

Desde el directorio `gateway/`:

```bash
docker-compose up -d
```

Esto iniciará RabbitMQ en:
- **AMQP**: `localhost:5672`
- **Management UI**: `http://localhost:15672` (usuario: `user`, contraseña: `pass`)

### 4. Configurar variables de entorno

Crear archivo `.env` en `gateway/comparador-service/`:

```env
# Puerto del servicio
PORT=3002

# RabbitMQ
RABBITMQ_URL=amqp://user:pass@localhost:5672

# Telegram Bot (Opcional)
TELEGRAM_BOT_TOKEN=tu_bot_token_aqui
TELEGRAM_CHAT_ID=tu_chat_id_aqui

# Webhook Secret para HMAC
WEBHOOK_SECRET=1841745af1a80e405b943c18fb61b18f35a9da66f8b9e8f9f57bc1009aa75083

# Supabase (Opcional)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_anon_key
```

## 🏃 Ejecución

Ejecutar cada servicio en terminales separadas:

### Terminal 1: Gateway
```bash
cd gateway
npm run start:dev
```
🌐 API Gateway: http://localhost:3000

### Terminal 2: Productos Service
```bash
cd gateway/productos-service
npm run start:dev
```
🏪 Productos API: http://localhost:3001

### Terminal 3: Comparador Service
```bash
cd gateway/comparador-service
npm run start:dev
```
💊 Comparador API: http://localhost:3002

## 📡 Endpoints Principales

### Gateway (Puerto 3000)

#### Productos
```http
POST /productos
GET /productos
GET /productos/:id
PUT /productos/:id
DELETE /productos/:id
```

#### Prescripciones
```http
POST /prescripciones
GET /prescripciones
GET /prescripciones/:id
```

#### Comparaciones
```http
POST /comparaciones
GET /comparaciones/:id
GET /comparaciones/prescripcion/:idPrescripcion
```

### Comparador Service (Puerto 3002)

#### Telegram
```http
GET  /telegram/status              # Verificar configuración
POST /telegram/test                # Enviar mensaje de prueba
POST /telegram/send                # Enviar mensaje personalizado
GET  /telegram/bot-info            # Información del bot
POST /telegram/test/prescripcion   # Simular notificación de prescripción
POST /telegram/test/comparacion    # Simular notificación de comparación
POST /telegram/test/error          # Simular notificación de error
```

#### Webhooks
```http
GET  /webhook/health               # Health check del sistema
POST /webhook/prescripcion         # Trigger manual de webhook prescripción
POST /webhook/comparacion          # Trigger manual de webhook comparación
POST /webhook/generate-signature   # Generar firma HMAC
```

#### Webhooks Admin
```http
GET  /webhook/admin/dlq                        # Ver cola de mensajes fallidos
POST /webhook/admin/dlq/:eventId/retry         # Reintentar evento fallido
GET  /webhook/admin/circuit-breakers           # Estado de circuit breakers
GET  /webhook/admin/metrics                    # Métricas del sistema
GET  /webhook/admin/dashboard                  # Dashboard HTML
```

#### Dashboard & Monitoreo
```http
GET  /webhook/dashboard            # Dashboard interactivo
GET  /webhook/dashboard/metrics    # Métricas en tiempo real
GET  /webhook/dashboard/traces     # Trazas distribuidas
GET  /webhook/dashboard/failures   # Eventos fallidos
GET  /webhook/dashboard/health     # Estado de salud del sistema
```

#### Subscripciones de Webhooks
```http
GET    /webhook/subscriptions              # Listar subscripciones
POST   /webhook/subscriptions              # Crear subscripción
GET    /webhook/subscriptions/:id          # Obtener subscripción
PUT    /webhook/subscriptions/:id          # Actualizar subscripción
DELETE /webhook/subscriptions/:id          # Eliminar subscripción
POST   /webhook/subscriptions/:id/activate # Activar subscripción
```

#### RabbitMQ Stats
```http
GET /events/rabbitmq/stats   # Estadísticas de RabbitMQ
GET /events/rabbitmq/health  # Health check de RabbitMQ
```

#### Idempotencia
```http
GET    /idempotency/stats    # Estadísticas de idempotencia
POST   /idempotency/check    # Verificar si evento fue procesado
POST   /idempotency/cleanup  # Limpiar claves antiguas
DELETE /idempotency/reset    # Resetear sistema de idempotencia
```

## 💬 Configurar Bot de Telegram

### 1. Crear Bot

1. Abre Telegram y busca `@BotFather`
2. Envía `/newbot`
3. Sigue las instrucciones y guarda el **token**

### 2. Obtener Chat ID

1. Envía un mensaje a tu bot
2. Visita: `https://api.telegram.org/bot<TU_TOKEN>/getUpdates`
3. Busca el `chat.id` en la respuesta

### 3. Configurar en .env

```env
TELEGRAM_BOT_TOKEN=8506149537:AAFe0FhVLFAfniGkGTLR70oeWgy_kuwJUcU
TELEGRAM_CHAT_ID=7269995456
```

### 4. Probar desde Postman

**POST** `http://localhost:3002/telegram/send`

Headers:
```
Content-Type: application/json
```

Body:
```json
{
  "message": "🚀 Hola desde Postman! El sistema está funcionando correctamente."
}
```

Respuesta esperada:
```json
{
  "success": true,
  "message": "✅ Mensaje enviado a Telegram"
}
```

## 🔧 Configurar Webhooks

### Registrar una subscripción

**POST** `http://localhost:3002/webhook/subscriptions`

```json
{
  "name": "Mi Sistema de Notificaciones",
  "url": "https://mi-servidor.com/webhook/recibir",
  "events": ["prescripcion.registrada", "comparacion.realizada"],
  "secret": "mi_secreto_super_seguro",
  "active": true,
  "retryConfig": {
    "maxRetries": 5,
    "initialDelay": 1000,
    "maxDelay": 60000,
    "backoffMultiplier": 2
  }
}
```

### Validar firma HMAC en tu servidor

```javascript
const crypto = require('crypto');

function validarWebhook(body, signature, secret) {
  const calculatedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(body))
    .digest('hex');
  
  return signature === calculatedSignature;
}

// En tu endpoint:
app.post('/webhook/recibir', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const isValid = validarWebhook(req.body, signature, 'mi_secreto_super_seguro');
  
  if (!isValid) {
    return res.status(401).json({ error: 'Firma inválida' });
  }
  
  // Procesar webhook...
  res.status(200).json({ received: true });
});
```

## 🔍 Monitoreo y Debugging

### Dashboard de Observabilidad

Abre en tu navegador: http://localhost:3002/webhook/dashboard

Incluye:
- 📊 Métricas en tiempo real
- 🔄 Estado de circuit breakers
- 📈 Gráficas de rendimiento
- 🚨 Alertas activas
- 📋 Lista de eventos recientes
- ⚠️ Eventos fallidos con detalles

### Ver estadísticas de RabbitMQ

```bash
curl http://localhost:3002/events/rabbitmq/stats
```

### Ver DLQ (Dead Letter Queue)

```bash
curl http://localhost:3002/webhook/admin/dlq
```

### Reintentar evento fallido

```bash
curl -X POST http://localhost:3002/webhook/admin/dlq/{eventId}/retry
```

## 🐛 Troubleshooting

### Puerto 3002 ya en uso

```bash
# Windows PowerShell
netstat -ano | findstr :3002
taskkill /PID <PID> /F

# O matar todos los procesos de Node
taskkill /F /IM node.exe
```

### RabbitMQ no se conecta

```bash
# Verificar que el contenedor esté corriendo
docker ps

# Ver logs de RabbitMQ
docker logs <container_id>

# Reiniciar RabbitMQ
docker-compose restart
```

### Telegram no envía mensajes

1. Verifica que el token y chat ID sean correctos
2. Prueba el endpoint de status:
   ```bash
   curl http://localhost:3002/telegram/status
   ```
3. Verifica que el bot no esté bloqueado
4. Revisa los logs del servicio

### Error: "El campo message es requerido"

Asegúrate de que en Postman:
- El método sea **POST**
- El body esté en formato **raw JSON**
- El header `Content-Type: application/json` esté presente

### Supabase no configurado (Warning)

Es normal si no tienes Supabase configurado. El sistema funciona sin él:
```
⚠️  Supabase no configurado - Variables SUPABASE_URL o SUPABASE_ANON_KEY faltantes
Los intentos de entrega no se guardarán en base de datos
```

Para desactivar el warning, configura las variables en `.env` o ignora el mensaje (no afecta la funcionalidad).

## 📚 Patrones de Diseño Implementados

- **Event-Driven Architecture**: Comunicación asíncrona entre servicios
- **CQRS**: Separación de comandos y consultas
- **Circuit Breaker**: Prevención de cascadas de fallos
- **Retry Pattern**: Exponential backoff para reintentos
- **Idempotent Consumer**: Prevención de procesamiento duplicado
- **Dead Letter Queue**: Manejo de mensajes fallidos
- **API Gateway**: Punto único de entrada al sistema
- **Microservices**: Servicios independientes y escalables
- **Observer Pattern**: Sistema de webhooks y notificaciones

## 📦 Tecnologías Utilizadas

- **Framework**: NestJS 11
- **Message Broker**: RabbitMQ
- **Database**: TypeORM + SQLite
- **Cloud DB**: Supabase (opcional)
- **HTTP Client**: Axios
- **Validation**: class-validator, class-transformer
- **Scheduling**: @nestjs/schedule
- **Containerization**: Docker & Docker Compose

## 🔐 Seguridad

- **HMAC Signatures**: Todas las entregas de webhooks están firmadas con SHA-256
- **Environment Variables**: Credenciales sensibles en archivos .env (no versionados)
- **CORS**: Configurado para prevenir accesos no autorizados
- **Input Validation**: Validación de entrada en todos los endpoints

## 📝 Estructura de Eventos

### Prescripción Registrada
```typescript
{
  eventType: 'prescripcion.registrada',
  data: {
    id_prescripcion: number,
    id_paciente: number,
    id_medico: number,
    fecha_prescripcion: Date,
    detalles: [
      {
        id_detalle_receta: number,
        id_medicamento: number,
        cantidad: number,
        dosis: string,
        frecuencia: string,
        duracion_dias: number
      }
    ]
  },
  timestamp: string,
  traceId: string
}
```

### Comparación Realizada
```typescript
{
  eventType: 'comparacion.realizada',
  data: {
    id_comparacion: number,
    id_prescripcion: number,
    fecha_comparacion: Date,
    total_medicamentos: number,
    resultados: [
      {
        id_medicamento: number,
        nombre_comercial: string,
        mejor_precio: number,
        farmacia: string,
        ahorro_potencial: number
      }
    ],
    precio_total: number
  },
  timestamp: string,
  traceId: string
}
```

## 👥 Contribución

Este proyecto es parte de la **Práctica 2 - Segundo Parcial**.

link del viodeo 1 de la práctica: https://uleam-my.sharepoint.com/:v:/r/personal/e1316318565_live_uleam_edu_ec/Documents/Datos%20adjuntos/video2426072547.mp4?csf=1&web=1&e=nYgAnv&nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJTdHJlYW1XZWJBcHAiLCJyZWZlcnJhbFZpZXciOiJTaGFyZURpYWxvZy1MaW5rIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXcifX0%3D
link del viodeo 2 de la práctica:https://uleam-my.sharepoint.com/:v:/r/personal/e1316318565_live_uleam_edu_ec/Documents/Datos%20adjuntos/video2426072547%201.mp4?csf=1&web=1&e=mJpZXx&nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJTdHJlYW1XZWJBcHAiLCJyZWZlcnJhbFZpZXciOiJTaGFyZURpYWxvZy1MaW5rIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXcifX0%3D

Proyecto educativo - Uso académico únicamente.

---

**Desarrollado con ❤️ usando NestJS y RabbitMQ por Trashprogramen**
