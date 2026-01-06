# 🚀 Aplicaciones del Taller 3 - MCP + IA

Este directorio contiene las aplicaciones implementadas para el Taller 3 de integración de Model Context Protocol con IA.

## 📂 Estructura

```
apps/
├── mcp-server/          # Servidor MCP (JSON-RPC 2.0)
│   └── Puerto: 3001
│
└── api-gateway/         # Gateway con Gemini AI
    └── Puerto: 3000
```

---

## 🏗️ Componentes

### 1. MCP Server

**Propósito:** Servidor que expone tools mediante JSON-RPC 2.0

**Tecnologías:**
- Express.js
- TypeScript
- Winston (logging)
- Axios (HTTP client)

**Tools Disponibles:**
- `buscar_producto`: Busca productos por nombre/código
- `validar_stock`: Verifica disponibilidad de stock
- `crear_comparacion`: Crea comparaciones de precios

**Endpoints:**
- `POST /rpc` - JSON-RPC 2.0
- `GET /health` - Health check

---

### 2. API Gateway

**Propósito:** Gateway inteligente con integración de Gemini AI

**Tecnologías:**
- NestJS
- Google Gemini AI
- TypeScript
- class-validator

**Módulos:**
- `mcp-client`: Cliente JSON-RPC para comunicarse con MCP Server
- `gemini`: Servicio de integración con Gemini AI
- `ia-controller`: Endpoints REST públicos

**Endpoints:**
- `POST /ia/query` - Consulta con IA
- `GET /ia/tools` - Lista tools disponibles
- `GET /ia/health` - Health check

---

## 🚦 Inicio Rápido

### Instalación

```bash
# Desde la raíz del proyecto
./install-taller3.ps1  # Windows
./install-taller3.sh   # Linux/Mac
```

### Configuración

#### MCP Server
```bash
# apps/mcp-server/.env
PORT=3001
BACKEND_URL=http://localhost:3003
LOG_LEVEL=info
```

#### API Gateway
```bash
# apps/api-gateway/.env
PORT=3000
MCP_SERVER_URL=http://localhost:3001
GEMINI_API_KEY=tu_api_key_aqui
GEMINI_MODEL=gemini-2.0-flash-exp
```

> ⚠️ Obtén tu API Key en https://aistudio.google.com

### Ejecución

#### Terminal 1: Backend (Taller 2)
```bash
cd ../Practica_gateway/gateway/comparador-service
npm run start:dev
```

#### Terminal 2: MCP Server
```bash
cd apps/mcp-server
npm run dev
```

#### Terminal 3: API Gateway
```bash
cd apps/api-gateway
npm run start:dev
```

---

## 🧪 Pruebas

### Health Check
```bash
curl http://localhost:3000/ia/health
```

### Consulta Simple
```bash
curl -X POST http://localhost:3000/ia/query \
  -H "Content-Type: application/json" \
  -d '{"message":"Busca paracetamol"}'
```

### Consulta Compleja
```bash
curl -X POST http://localhost:3000/ia/query \
  -H "Content-Type: application/json" \
  -d '{"message":"Busca ibuprofeno y verifica stock de 15 unidades"}'
```

---

## 📊 Flujo de Datos

```
Usuario
  │
  ▼
API Gateway (Puerto 3000)
  │ 1. Recibe consulta
  │ 2. Obtiene tools del MCP Server
  │ 3. Envía a Gemini con tools
  │
  ▼
Gemini AI (Google Cloud)
  │ 4. Analiza intención
  │ 5. Decide qué tools ejecutar
  │
  ▼
API Gateway
  │ 6. Llama MCP Server vía JSON-RPC
  │
  ▼
MCP Server (Puerto 3001)
  │ 7. Ejecuta tools
  │ 8. Llama Backend vía REST
  │
  ▼
Backend (Puerto 3003)
  │ 9. Consulta base de datos
  │ 10. Retorna resultados
```

---

## 🔧 Desarrollo

### MCP Server

#### Agregar un Nuevo Tool

1. Crear archivo en `apps/mcp-server/src/tools/mi-tool.ts`
```typescript
import { ToolDefinition, ToolExecutionContext } from './types';

export const miTool: ToolDefinition = {
  name: 'mi_tool',
  description: 'Descripción del tool',
  inputSchema: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'Parámetro 1',
      },
    },
    required: ['param1'],
  },
  async execute(params, context) {
    // Implementación
    return {
      success: true,
      message: 'Tool ejecutado',
      data: {},
    };
  },
};
```

2. Registrar en `apps/mcp-server/src/tools/registry.ts`
```typescript
import { miTool } from './mi-tool';

private registerDefaultTools() {
  // ... tools existentes
  this.register(miTool); // ← Agregar
}
```

#### Logs

Los logs se guardan en `apps/mcp-server/mcp-server.log`

```bash
# Ver logs en tiempo real
tail -f apps/mcp-server/mcp-server.log
```

---

### API Gateway

#### Agregar un Nuevo Endpoint

```typescript
// apps/api-gateway/src/ia-controller/ia.controller.ts

@Get('mi-endpoint')
async miEndpoint() {
  return {
    success: true,
    data: 'Mi respuesta',
  };
}
```

#### Logs

Los logs aparecen en la consola de NestJS con colores:

```
[IaController] 📨 Nueva consulta: "..."
[GeminiService] 🔧 Ejecutando: buscar_producto
[GeminiService] ✅ Tool ejecutado exitosamente
```

---

## 📚 Documentación

- **[README Principal](../README_TALLER_3_MCP.md)** - Guía completa
- **[Arquitectura](../ARQUITECTURA_MCP.md)** - Diagramas y flujos
- **[Guía de Pruebas](../GUIA_PRUEBAS_TALLER_3.md)** - Test cases
- **[Ejemplos de Código](../EJEMPLOS_CODIGO_TALLER_3.md)** - Snippets
- **[Checklist de Entrega](../CHECKLIST_ENTREGA_TALLER_3.md)** - Verificación

---

## 🐛 Troubleshooting

### MCP Server no inicia
```bash
# Verificar puerto
netstat -an | findstr 3001

# Ver logs
cat apps/mcp-server/mcp-server.log
```

### API Gateway no conecta con MCP Server
```bash
# Verificar MCP_SERVER_URL en .env
cat apps/api-gateway/.env | grep MCP_SERVER_URL

# Probar conexión
curl http://localhost:3001/health
```

### Gemini retorna error
```bash
# Verificar API Key
cat apps/api-gateway/.env | grep GEMINI_API_KEY

# Probar API Key en Google AI Studio
```

---

## 📦 Dependencias Principales

### MCP Server
```json
{
  "express": "^4.18.2",
  "axios": "^1.6.2",
  "winston": "^3.11.0"
}
```

### API Gateway
```json
{
  "@nestjs/common": "^10.0.0",
  "@nestjs/core": "^10.0.0",
  "@google/generative-ai": "^0.1.3",
  "axios": "^1.6.2"
}
```

---

## 🎯 Próximos Pasos

1. ✅ Instalar dependencias
2. ✅ Configurar variables de entorno
3. ✅ Iniciar servicios
4. ✅ Probar endpoints
5. ✅ Revisar documentación completa

---

## 👥 Equipo

**Universidad:** ULEAM  
**Asignatura:** Aplicación para el Servidor Web  
**Taller:** 3 - MCP + IA  
**Docente:** Ing. John Cevallos

---

**¡Sistema MCP completamente funcional! 🎉**
