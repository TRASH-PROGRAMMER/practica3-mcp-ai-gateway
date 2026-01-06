# 🏗️ Arquitectura del Sistema MCP

## Diagrama de Componentes

```
┌──────────────────────────────────────────────────────────────────┐
│                           USUARIO                                │
│                 (Consultas en lenguaje natural)                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             │ HTTP POST /ia/query
                             │ { "message": "Busca paracetamol" }
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (NestJS)                        │
│                        Puerto: 3000                              │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  IaController                                               │ │
│ │  • POST /ia/query    (Procesar consulta)                    │ │
│ │  • GET  /ia/tools    (Listar tools)                         │ │
│ │  • GET  /ia/health   (Health check)                         │ │
│ └────────────────────┬────────────────────────────────────────┘ │
│                      │                                           │
│ ┌────────────────────▼────────────────────────────────────────┐ │
│ │  GeminiService (Function Calling)                          │ │
│ │  • Envía mensaje + tools a Gemini                          │ │
│ │  • Recibe function calls de Gemini                         │ │
│ │  • Coordina ejecución de tools                             │ │
│ │  • Genera respuesta final en lenguaje natural              │ │
│ └────────────────────┬────────────────────────────────────────┘ │
│                      │                                           │
│ ┌────────────────────▼────────────────────────────────────────┐ │
│ │  McpClientService (JSON-RPC 2.0)                           │ │
│ │  • sendRequest(method, params)                             │ │
│ │  • listTools()                                             │ │
│ │  • callTool(name, args)                                    │ │
│ └────────────────────┬────────────────────────────────────────┘ │
└──────────────────────┼──────────────────────────────────────────┘
                       │
                       │ JSON-RPC 2.0
                       │ POST /rpc
                       │ { "jsonrpc": "2.0", "method": "tools/call" }
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   MCP SERVER (Express)                           │
│                      Puerto: 3001                                │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  JSON-RPC Handler                                           │ │
│ │  • tools/list    (Lista tools disponibles)                  │ │
│ │  • tools/call    (Ejecuta un tool)                          │ │
│ │  • health        (Estado del servidor)                      │ │
│ └────────────────────┬────────────────────────────────────────┘ │
│                      │                                           │
│ ┌────────────────────▼────────────────────────────────────────┐ │
│ │  ToolRegistry                                               │ │
│ │  • buscar_producto                                          │ │
│ │  • validar_stock                                            │ │
│ │  • crear_comparacion                                        │ │
│ └────────────────────┬────────────────────────────────────────┘ │
│                      │                                           │
│ ┌────────────────────▼────────────────────────────────────────┐ │
│ │  BackendClient (HTTP)                                       │ │
│ │  • buscarProductos(query)                                   │ │
│ │  • obtenerProducto(id)                                      │ │
│ │  • validarStock(productoId, cantidad)                       │ │
│ │  • crearComparacion(prescripcionId)                         │ │
│ └────────────────────┬────────────────────────────────────────┘ │
└──────────────────────┼──────────────────────────────────────────┘
                       │
                       │ HTTP REST
                       │ GET /productos, POST /comparador/comparar
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              BACKEND (comparador-service) - NestJS               │
│                        Puerto: 3003                              │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  ProductoController                                         │ │
│ │  • GET    /productos        (Listar/buscar)                 │ │
│ │  • GET    /productos/:id    (Obtener uno)                   │ │
│ │  • POST   /productos        (Crear)                         │ │
│ │  • PATCH  /productos/:id    (Actualizar)                    │ │
│ │  • DELETE /productos/:id    (Eliminar)                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  ComparadorController                                       │ │
│ │  • POST /comparador/comparar     (Crear comparación)        │ │
│ │  • GET  /comparador/comparaciones (Listar)                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  Base de Datos (SQLite)                                     │ │
│ │  • productos                                                │ │
│ │  • prescripciones                                           │ │
│ │  • comparaciones                                            │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    GEMINI AI (Google Cloud)                      │
│                     API: generativeai                            │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  Model: gemini-2.0-flash-exp                                │ │
│ │  • Function Calling                                         │ │
│ │  • Analiza intención del usuario                            │ │
│ │  • Decide qué tools ejecutar                                │ │
│ │  • Genera respuestas naturales                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flujo de Datos

### Ejemplo: "Busca paracetamol y verifica stock de 10 unidades"

```
1. Usuario → API Gateway
   POST /ia/query
   { "message": "Busca paracetamol y verifica stock de 10 unidades" }

2. API Gateway → MCP Server
   POST /rpc
   { "method": "tools/list" }
   
3. MCP Server → API Gateway
   { "result": { "tools": [ buscar_producto, validar_stock, crear_comparacion ] }}

4. API Gateway → Gemini AI
   • Mensaje: "Busca paracetamol y verifica stock de 10 unidades"
   • Tools: [ buscar_producto, validar_stock, crear_comparacion ]

5. Gemini AI → API Gateway (Function Call)
   functionCalls: [
     { name: "buscar_producto", args: { query: "paracetamol" } }
   ]

6. API Gateway → MCP Server
   POST /rpc
   { "method": "tools/call", "params": { 
     "name": "buscar_producto", 
     "arguments": { "query": "paracetamol" } 
   }}

7. MCP Server → Backend
   GET /productos?search=paracetamol

8. Backend → MCP Server
   [{ id: 15, nombre: "Paracetamol 500mg", stock: 45, precio: 2.50 }]

9. MCP Server → API Gateway
   { "result": { "success": true, "data": [ ... ] }}

10. API Gateway → Gemini AI (Function Response)
    functionResponses: [
      { name: "buscar_producto", response: { success: true, data: [ ... ] } }
    ]

11. Gemini AI → API Gateway (Function Call #2)
    functionCalls: [
      { name: "validar_stock", args: { productoId: 15, cantidad: 10 } }
    ]

12. API Gateway → MCP Server → Backend → MCP Server → API Gateway
    (Mismo proceso JSON-RPC para validar_stock)

13. API Gateway → Gemini AI (Function Response #2)
    functionResponses: [
      { name: "validar_stock", response: { success: true, data: { disponible: true } } }
    ]

14. Gemini AI → API Gateway (Respuesta Final)
    "Encontré Paracetamol 500mg (ID: 15) a $2.50. 
     Hay 45 unidades disponibles, suficiente para las 10 que necesitas. ✅"

15. API Gateway → Usuario
    {
      "success": true,
      "response": "Encontré Paracetamol 500mg...",
      "toolsExecuted": [ "buscar_producto", "validar_stock" ],
      "iterations": 2
    }
```

---

## Protocolos de Comunicación

### 1. HTTP REST (Usuario ↔ API Gateway)
```http
POST /ia/query HTTP/1.1
Content-Type: application/json

{ "message": "..." }
```

### 2. JSON-RPC 2.0 (API Gateway ↔ MCP Server)
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "buscar_producto",
    "arguments": { "query": "paracetamol" }
  },
  "id": 1
}
```

**Respuesta:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "success": true,
    "message": "...",
    "data": [ ... ]
  },
  "id": 1
}
```

### 3. HTTP REST (MCP Server ↔ Backend)
```http
GET /productos?search=paracetamol HTTP/1.1
```

### 4. Gemini Function Calling (API Gateway ↔ Gemini)
**Request:**
```javascript
{
  model: "gemini-2.0-flash-exp",
  tools: [{
    functionDeclarations: [
      {
        name: "buscar_producto",
        description: "Busca productos...",
        parameters: { type: "object", properties: { ... } }
      }
    ]
  }],
  messages: [ { role: "user", content: "Busca paracetamol" } ]
}
```

**Response (Function Call):**
```javascript
{
  functionCalls: [
    { name: "buscar_producto", args: { query: "paracetamol" } }
  ]
}
```

---

## Tecnologías por Capa

| Capa | Tecnología | Puerto | Protocolo |
|------|-----------|--------|-----------|
| Frontend (Usuario) | cURL/Postman | - | HTTP REST |
| API Gateway | NestJS + @google/generative-ai | 3000 | HTTP + Function Calling |
| MCP Server | Express + TypeScript | 3001 | JSON-RPC 2.0 |
| Backend | NestJS + TypeORM | 3003 | HTTP REST |
| Base de Datos | SQLite | - | SQL |
| IA | Gemini 2.0 Flash | Cloud | Function Calling API |

---

## Ventajas de esta Arquitectura

✅ **Separación de Responsabilidades**
- Gateway: Orquestación de IA
- MCP Server: Lógica de tools
- Backend: Lógica de negocio

✅ **Escalabilidad**
- Cada servicio puede escalar independientemente
- MCP Server puede agregar tools sin modificar Gateway

✅ **Reutilización**
- Backend del Taller 2 se reutiliza sin cambios
- Tools pueden usarse desde múltiples gateways

✅ **Estándares**
- JSON-RPC 2.0 (protocolo estándar)
- MCP (protocolo de Anthropic)
- REST (universal)

✅ **Testabilidad**
- Cada capa puede probarse independientemente
- MCP Server tiene endpoints de test

---

## Seguridad y Buenas Prácticas

🔒 **Autenticación**
- API Key de Gemini en variables de entorno
- CORS configurado en Gateway
- Validación de inputs con `class-validator`

🔒 **Validación**
- JSON Schema en tools
- DTOs en NestJS
- Type safety con TypeScript

🔒 **Logging**
- Winston en MCP Server
- Logger de NestJS en Gateway
- Trazabilidad de requests

🔒 **Manejo de Errores**
- Try-catch en todos los niveles
- Errores JSON-RPC estandarizados
- Respuestas HTTP apropiadas

---

**Arquitectura robusta y escalable! 🏗️**
