# 🧠 Taller 3: Sistema MCP con Integración de IA

**Universidad Laica Eloy Alfaro de Manabí (ULEAM)**  
**Asignatura:** Aplicación para el Servidor Web  
**Proyecto:** Sistema de Comparación de Productos Farmacéuticos con IA

---

## 📋 Descripción del Proyecto

Sistema de microservicios que integra **Model Context Protocol (MCP)** con **Gemini AI** para permitir consultas en lenguaje natural sobre productos farmacéuticos, validación de stock y comparación de precios de prescripciones médicas.

### Arquitectura del Sistema

```
┌─────────────┐
│   Usuario   │
└──────┬──────┘
       │ Texto en lenguaje natural
       ▼
┌─────────────────────┐
│   API Gateway       │ ← Gemini AI (Function Calling)
│   (NestJS)          │
│   Puerto: 3000      │
└──────────┬──────────┘
           │ JSON-RPC 2.0
           ▼
┌─────────────────────┐
│   MCP Server        │
│   (Express)         │
│   Puerto: 3001      │
│   • buscar_producto │
│   • validar_stock   │
│   • crear_comparacion│
└──────────┬──────────┘
           │ HTTP REST
           ▼
┌─────────────────────┐
│  Backend Services   │
│  (comparador-service)│
│  Puerto: 3003       │
│  • Productos        │
│  • Prescripciones   │
│  • Comparaciones    │
└─────────────────────┘
```

---

## 🚀 Instalación y Configuración

### Prerrequisitos

- Node.js 18+
- npm o yarn
- Servicio backend del Taller 2 ejecutándose en puerto 3003
- API Key de Gemini (gratuita): https://aistudio.google.com

### 1️⃣ Instalar Dependencias

```bash
# MCP Server
cd apps/mcp-server
npm install

# API Gateway
cd ../api-gateway
npm install
```

### 2️⃣ Configurar Variables de Entorno

**MCP Server** (`apps/mcp-server/.env`):
```env
PORT=3001
BACKEND_URL=http://localhost:3003
LOG_LEVEL=info
```

**API Gateway** (`apps/api-gateway/.env`):
```env
PORT=3000
MCP_SERVER_URL=http://localhost:3001
GEMINI_API_KEY=tu_api_key_de_gemini
GEMINI_MODEL=gemini-2.0-flash-exp
```

> ⚠️ **IMPORTANTE**: Reemplaza `tu_api_key_de_gemini` con tu API Key real de Google AI Studio

### 3️⃣ Iniciar los Servicios

**Terminal 1 - Backend (Taller 2):**
```bash
cd Practica_gateway/gateway/comparador-service
npm run start:dev
```

**Terminal 2 - MCP Server:**
```bash
cd apps/mcp-server
npm run dev
```

**Terminal 3 - API Gateway:**
```bash
cd apps/api-gateway
npm run start:dev
```

---

## 📚 Uso del Sistema

### Endpoint Principal: Consulta con IA

**POST** `/ia/query`

```json
{
  "message": "Busca productos con paracetamol y verifica si hay stock de 10 unidades"
}
```

**Respuesta:**
```json
{
  "success": true,
  "timestamp": "2026-01-05T10:30:00.000Z",
  "query": "Busca productos con paracetamol...",
  "response": "Encontré 2 productos con paracetamol:\n\n1. **Paracetamol 500mg** (ID: 15)\n   - Precio: $2.50\n   - Stock: 45 unidades ✅\n   - Laboratorio: GenFar\n\n2. **Paracetamol Forte 1g** (ID: 23)\n   - Precio: $4.20\n   - Stock: 8 unidades ❌ (faltan 2)\n\nEl producto con ID 15 tiene stock suficiente para 10 unidades.",
  "metadata": {
    "toolsExecuted": [
      { "name": "buscar_producto", "success": true },
      { "name": "validar_stock", "success": true },
      { "name": "validar_stock", "success": true }
    ],
    "iterations": 2
  }
}
```

### Otros Endpoints

#### Listar Tools Disponibles
**GET** `/ia/tools`

```json
{
  "success": true,
  "tools": [
    {
      "name": "buscar_producto",
      "description": "Busca productos farmacéuticos...",
      "parameters": { ... }
    },
    {
      "name": "validar_stock",
      "description": "Valida stock disponible...",
      "parameters": { ... }
    },
    {
      "name": "crear_comparacion",
      "description": "Crea comparación de precios...",
      "parameters": { ... }
    }
  ]
}
```

#### Health Check
**GET** `/ia/health`

```json
{
  "success": true,
  "gateway": "healthy",
  "mcpServer": {
    "status": "healthy",
    "tools": 3
  }
}
```

---

## 🧪 Ejemplos de Consultas

### 1. Búsqueda Simple
```json
{
  "message": "¿Qué productos tienen ibuprofeno?"
}
```

### 2. Validación de Stock
```json
{
  "message": "Necesito 50 unidades del producto con ID 12, ¿hay disponibilidad?"
}
```

### 3. Comparación de Precios
```json
{
  "message": "Crea una comparación de precios para la prescripción 5"
}
```

### 4. Consulta Compleja
```json
{
  "message": "Busca productos de amoxicilina, verifica que tengan al menos 20 unidades en stock y crea una comparación de precios para la prescripción 3"
}
```

---

## 🔧 Descripción de los Tools

### 1. `buscar_producto`
**Descripción:** Busca productos farmacéuticos por nombre, código o principio activo.

**Parámetros:**
- `query` (string, requerido): Término de búsqueda

**Ejemplo de uso por IA:**
```
Usuario: "Busca productos con aspirina"
→ Gemini ejecuta: buscar_producto({ query: "aspirina" })
```

### 2. `validar_stock`
**Descripción:** Valida si un producto tiene stock suficiente.

**Parámetros:**
- `productoId` (number, requerido): ID del producto
- `cantidad` (number, requerido): Cantidad requerida

**Ejemplo de uso por IA:**
```
Usuario: "¿Hay 15 unidades del producto 8?"
→ Gemini ejecuta: validar_stock({ productoId: 8, cantidad: 15 })
```

### 3. `crear_comparacion`
**Descripción:** Crea una comparación de precios para una prescripción médica.

**Parámetros:**
- `prescripcionId` (number, requerido): ID de la prescripción

**Ejemplo de uso por IA:**
```
Usuario: "Compara precios de la prescripción 2"
→ Gemini ejecuta: crear_comparacion({ prescripcionId: 2 })
```

---

## 🏗️ Estructura del Proyecto

```
apps/
├── mcp-server/                    # Servidor MCP (JSON-RPC 2.0)
│   ├── src/
│   │   ├── tools/
│   │   │   ├── buscar-producto.tool.ts
│   │   │   ├── validar-stock.tool.ts
│   │   │   ├── crear-comparacion.tool.ts
│   │   │   ├── registry.ts        # Registro de tools
│   │   │   └── types.ts           # Tipos TypeScript
│   │   ├── services/
│   │   │   └── backend-client.ts  # Cliente HTTP al backend
│   │   ├── utils/
│   │   │   └── logger.ts          # Sistema de logs
│   │   └── server.ts              # Servidor Express + JSON-RPC
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
│
└── api-gateway/                   # Gateway con Gemini AI
    ├── src/
    │   ├── mcp-client/
    │   │   ├── mcp-client.service.ts    # Cliente MCP (JSON-RPC)
    │   │   └── mcp-client.module.ts
    │   ├── gemini/
    │   │   ├── gemini.service.ts        # Integración Gemini
    │   │   └── gemini.module.ts
    │   ├── ia-controller/
    │   │   ├── ia.controller.ts         # Endpoints REST
    │   │   ├── ia.module.ts
    │   │   └── dto/
    │   │       └── query.dto.ts
    │   ├── app.module.ts
    │   └── main.ts
    ├── package.json
    ├── tsconfig.json
    ├── nest-cli.json
    └── .env
```

---

## 🔄 Flujo de Ejecución

1. **Usuario** envía texto en lenguaje natural al API Gateway
2. **Gateway** obtiene la lista de tools disponibles del MCP Server
3. **Gateway** envía el mensaje a **Gemini** con los tools como funciones disponibles
4. **Gemini** analiza la intención y decide qué tools ejecutar
5. **Gateway** llama al **MCP Server** vía JSON-RPC para ejecutar cada tool
6. **MCP Server** ejecuta los tools llamando al **Backend** vía REST
7. **Gateway** reenvía los resultados a **Gemini**
8. **Gemini** genera una respuesta en lenguaje natural
9. **Gateway** retorna la respuesta al usuario

---

## 🧪 Pruebas con cURL

### Health Check
```bash
curl http://localhost:3000/ia/health
```

### Listar Tools
```bash
curl http://localhost:3000/ia/tools
```

### Consulta Simple
```bash
curl -X POST http://localhost:3000/ia/query \
  -H "Content-Type: application/json" \
  -d '{"message": "Busca productos con paracetamol"}'
```

### Consulta Compleja
```bash
curl -X POST http://localhost:3000/ia/query \
  -H "Content-Type: application/json" \
  -d '{"message": "Busca ibuprofeno 400mg, verifica stock de 25 unidades"}'
```

---

## 📊 Logs y Monitoreo

### MCP Server
Los logs se guardan en `apps/mcp-server/mcp-server.log`:

```
2026-01-05 10:30:15 [info]: 🚀 MCP Server iniciado en http://localhost:3001
2026-01-05 10:30:15 [info]: 📦 Tools registrados: buscar_producto, validar_stock, crear_comparacion
2026-01-05 10:32:45 [info]: 🔧 Ejecutando tool: buscar_producto
2026-01-05 10:32:45 [info]: 🔹 Request: GET /productos?search=paracetamol
2026-01-05 10:32:45 [info]: ✅ Response: 200 /productos
2026-01-05 10:32:45 [info]: ✅ Tool ejecutado: buscar_producto
```

### API Gateway
Los logs aparecen en la consola de NestJS:

```
[Bootstrap] 🚀 API Gateway iniciado en http://localhost:3000
[GeminiService] 🤖 Gemini AI inicializado: gemini-2.0-flash-exp
[IaController] 📨 Nueva consulta: "Busca productos con paracetamol"
[GeminiService] 📦 Tools disponibles: 3
[GeminiService] 🔄 Iteración 1: Gemini solicita ejecutar tools
[GeminiService] 🔧 Ejecutando: buscar_producto
[GeminiService] ✅ Tool buscar_producto ejecutado exitosamente
```

---

## 🎯 Criterios de Evaluación

| Criterio | Puntos | Estado |
|----------|--------|--------|
| MCP Server funcional (JSON-RPC 2.0) | 25 | ✅ |
| API Gateway con Gemini (Function Calling) | 25 | ✅ |
| 3 Tools implementados correctamente | 15 | ✅ |
| Integración con Backend (Taller 2) | 15 | ✅ |
| Flujo End-to-End completo | 10 | ✅ |
| Documentación y README | 10 | ✅ |
| **TOTAL** | **100** | **✅** |

---

## 🔐 Seguridad

- **API Keys:** Nunca commitear el archivo `.env` al repositorio
- **CORS:** Configurar adecuadamente para producción
- **Validación:** Validar todos los inputs con `class-validator`
- **Rate Limiting:** Considerar limitar peticiones a Gemini API

---

## 🐛 Troubleshooting

### Error: "GEMINI_API_KEY no configurada"
**Solución:** Crear archivo `.env` en `apps/api-gateway/` con tu API Key de Gemini

### Error: "Error comunicándose con MCP Server"
**Solución:** Verificar que el MCP Server esté ejecutándose en puerto 3001

### Error: "Error buscando productos: 404"
**Solución:** Verificar que el backend (comparador-service) esté ejecutándose en puerto 3003

### Gemini no ejecuta los tools
**Solución:** Verificar que los tools tengan descripciones claras y parámetros bien definidos

---

## 📚 Referencias

- **MCP Oficial:** https://modelcontextprotocol.io
- **Gemini AI:** https://ai.google.dev/gemini-api/docs/function-calling
- **JSON-RPC 2.0:** https://www.jsonrpc.org/specification
- **NestJS:** https://docs.nestjs.com

---

## 👥 Equipo de Desarrollo

**Grupo:** [Nombre del grupo]  
**Integrantes:**
- [Estudiante 1]
- [Estudiante 2]
- [Estudiante 3]

**Docente:** Ing. John Cevallos  
**Asignatura:** Aplicación para el Servidor Web  
**Período:** 2025-2026 (2)

---

## 📝 Licencia

Este proyecto es parte del material académico de ULEAM.

---

**¡Sistema MCP Completamente Funcional! 🎉**
