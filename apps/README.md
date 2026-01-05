# Taller 3 - MCP + IA: Sistema de Productos y Prescripciones

## 📋 Descripción
Sistema de orquestación inteligente de microservicios usando **Model Context Protocol (MCP)** con **Gemini AI**. La IA decide automáticamente qué operaciones ejecutar basándose en la intención del usuario.

## 🏗️ Arquitectura

```
┌─────────────────┐
│   Usuario       │ Texto natural: "Busca ibuprofeno"
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│     API Gateway (Puerto 3000)       │
│  - Recibe solicitud                 │
│  - Consulta Gemini AI               │
│  - Ejecuta Tools automáticamente    │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   MCP Server (Puerto 3001)          │
│  - JSON-RPC 2.0                     │
│  - 3 Tools: buscar, validar, crear  │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   Backend (Puerto 3002)             │
│  - NestJS + TypeORM + SQLite        │
│  - Entidades: Producto, Prescripción│
└─────────────────────────────────────┘
```

## 🚀 Instalación

### 1. Instalar dependencias del MCP Server
```bash
cd apps/mcp-server
npm install
```

### 2. Instalar dependencias del API Gateway
```bash
cd apps/api-gateway
npm install
```

### 3. Configurar variables de entorno

**apps/api-gateway/.env:**
```env
GEMINI_API_KEY=tu_api_key_de_gemini
MCP_SERVER_URL=http://localhost:3001
PORT=3000
```

**apps/mcp-server/.env:**
```env
BACKEND_URL=http://localhost:3002
PORT=3001
```

> ⚠️ **Obtén tu API Key de Gemini en:** https://aistudio.google.com

### 4. Verificar Backend (Taller 2)
El backend debe estar corriendo en el puerto 3002:
```bash
cd Practica_gateway/gateway/comparador-service
npm install
npm run start:dev
```

## ▶️ Ejecución

### Terminal 1: Backend (Puerto 3002)
```bash
cd Practica_gateway/gateway/comparador-service
npm run start:dev
```

### Terminal 2: MCP Server (Puerto 3001)
```bash
cd apps/mcp-server
npm run dev
```

### Terminal 3: API Gateway (Puerto 3000)
```bash
cd apps/api-gateway
npm run start:dev
```

## 🛠️ Tools Disponibles

### 1. **buscar_producto**
Busca medicamentos por nombre o principio activo.

**Parámetros:**
- `query` (string): Término de búsqueda

**Ejemplo:**
```json
{
  "query": "ibuprofeno"
}
```

### 2. **validar_prescripcion**
Valida si una prescripción médica está activa.

**Parámetros:**
- `idPrescripcion` (number): ID de la prescripción

**Ejemplo:**
```json
{
  "idPrescripcion": 1
}
```

### 3. **crear_comparacion**
Compara dos productos según un criterio.

**Parámetros:**
- `idProducto1` (number): ID del primer producto
- `idProducto2` (number): ID del segundo producto
- `criterio` (string): "precio", "efectividad", "efectos_secundarios", "disponibilidad"

**Ejemplo:**
```json
{
  "idProducto1": 1,
  "idProducto2": 2,
  "criterio": "precio"
}
```

## 📡 Endpoints

### API Gateway (Puerto 3000)

#### POST /productos/chat
Endpoint principal para interactuar con la IA.

**Request:**
```json
{
  "message": "Quiero buscar ibuprofeno y compararlo con paracetamol por precio"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Operaciones completadas exitosamente",
  "toolsExecuted": [
    {
      "name": "buscar_producto",
      "args": { "query": "ibuprofeno" },
      "result": { "success": true, "data": [...] }
    },
    {
      "name": "buscar_producto",
      "args": { "query": "paracetamol" },
      "result": { "success": true, "data": [...] }
    },
    {
      "name": "crear_comparacion",
      "args": { "idProducto1": 1, "idProducto2": 2, "criterio": "precio" },
      "result": { "success": true, "data": {...} }
    }
  ]
}
```

#### GET /productos/tools
Lista las tools disponibles.

#### GET /productos/health
Health check del gateway.

### MCP Server (Puerto 3001)

#### POST /rpc
Endpoint JSON-RPC 2.0.

**Listar tools:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}
```

**Ejecutar tool:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/execute",
  "params": {
    "name": "buscar_producto",
    "params": { "query": "ibuprofeno" }
  },
  "id": 2
}
```

## 🧪 Ejemplos de Uso

### Ejemplo 1: Búsqueda simple
```bash
curl -X POST http://localhost:3000/productos/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Busca productos con ibuprofeno"}'
```

### Ejemplo 2: Validación de prescripción
```bash
curl -X POST http://localhost:3000/productos/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Valida si la prescripción 1 está activa"}'
```

### Ejemplo 3: Comparación compleja
```bash
curl -X POST http://localhost:3000/productos/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Compara ibuprofeno con paracetamol según efectividad"}'
```

## 📊 Flujo de Ejecución

```
1. Usuario → "Busca ibuprofeno y valida prescripción 1"
       ↓
2. API Gateway → Envía a Gemini con tools disponibles
       ↓
3. Gemini decide → [buscar_producto, validar_prescripcion]
       ↓
4. API Gateway → Ejecuta tools en MCP Server
       ↓
5. MCP Server → Llama al Backend REST
       ↓
6. Backend → Retorna datos (SQLite)
       ↓
7. Usuario ← Respuesta consolidada
```

## 📁 Estructura del Proyecto

```
apps/
├── backend/                      # Referencia al backend del Taller 2
│   └── README.md                 # Ubicación real: Practica_gateway/...
│
├── mcp-server/                   # Servidor MCP (Puerto 3001)
│   ├── src/
│   │   ├── tools/
│   │   │   ├── registry.ts       # Registro de tools
│   │   │   ├── buscar-producto.tool.ts
│   │   │   ├── validar-prescripcion.tool.ts
│   │   │   └── crear-comparacion.tool.ts
│   │   ├── services/
│   │   │   └── backend-client.ts # Cliente HTTP al backend
│   │   └── server.ts             # Servidor Express + JSON-RPC
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
│
└── api-gateway/                  # Gateway con IA (Puerto 3000)
    ├── src/
    │   ├── gemini/
    │   │   └── gemini.service.ts # Integración Gemini
    │   ├── mcp-client/
    │   │   └── mcp-client.service.ts # Cliente MCP
    │   ├── productos/
    │   │   ├── productos.controller.ts
    │   │   ├── productos.service.ts
    │   │   └── productos.module.ts
    │   ├── app.module.ts
    │   └── main.ts
    ├── package.json
    ├── tsconfig.json
    ├── nest-cli.json
    └── .env
```

## 🎯 Tecnologías

| Componente | Tecnología | Puerto |
|-----------|------------|--------|
| Backend | NestJS + TypeORM + SQLite | 3002 |
| MCP Server | TypeScript + Express + JSON-RPC | 3001 |
| API Gateway | NestJS + Gemini AI | 3000 |
| Modelo IA | Gemini 2.0 Flash Experimental | Cloud |

## 🔗 Referencias

- [MCP Docs](https://modelcontextprotocol.io)
- [Gemini AI Studio](https://aistudio.google.com)
- [JSON-RPC 2.0](https://www.jsonrpc.org/specification)

## 📝 Entregables

- ✅ Código funcional en repositorio Git
- ✅ README.md con instrucciones completas
- ⏳ Video demostrativo (3-5 minutos)
- ✅ Documentación de Tools
- ⏳ Pruebas documentadas (Postman/Thunder Client)

## 👥 Grupo

- [Nombre 1]
- [Nombre 2]
- [Nombre 3]

---

**Universidad Laica Eloy Alfaro de Manabí (ULEAM)**  
**Asignatura:** Aplicación para el Servidor Web  
**Docente:** Ing. John Cevallos  
**Período:** 2025-2026 (2)
