# 🎨 Diagramas Visuales - Taller 3 MCP

## 📊 Vista General del Sistema

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          TALLER 3: MCP + IA                              │
│                   Sistema de Comparación de Medicamentos                 │
└─────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────┐
                              │   Usuario   │
                              │  (Cliente)  │
                              └──────┬──────┘
                                     │
                    "Busca paracetamol y verifica stock"
                                     │
                                     ▼
            ┌────────────────────────────────────────────┐
            │        API GATEWAY                         │
            │        (NestJS + Gemini AI)                │
            │        Puerto: 3000                        │
            │                                            │
            │  ┌──────────────────────────────────────┐ │
            │  │  /ia/query   → Procesar con IA      │ │
            │  │  /ia/tools   → Listar herramientas  │ │
            │  │  /ia/health  → Estado del sistema   │ │
            │  └──────────────────────────────────────┘ │
            └──────────┬─────────────────┬──────────────┘
                       │                 │
              JSON-RPC │                 │ Function Calling
                       │                 │
                       ▼                 ▼
        ┌──────────────────┐    ┌─────────────────┐
        │   MCP SERVER     │    │   GEMINI AI     │
        │   (Express)      │    │  (Google Cloud) │
        │   Puerto: 3001   │    │                 │
        │                  │    │  • Analiza      │
        │  Tools:          │    │  • Decide       │
        │  • buscar_prod   │◄───┤  • Ejecuta      │
        │  • validar_stock │    │  • Genera       │
        │  • crear_comp    │    │                 │
        └─────────┬────────┘    └─────────────────┘
                  │
             HTTP │ REST
                  │
                  ▼
        ┌─────────────────┐
        │    BACKEND      │
        │  (Taller 2)     │
        │  Puerto: 3003   │
        │                 │
        │  • Productos    │
        │  • Prescripc.   │
        │  • Comparador   │
        └─────────┬───────┘
                  │
                  ▼
        ┌─────────────────┐
        │   SQLite DB     │
        └─────────────────┘
```

---

## 🔄 Flujo de Ejecución Detallado

```
PASO 1: Usuario envía consulta
═══════════════════════════════
┌─────────┐
│ Usuario │ → POST /ia/query
└─────────┘   {"message": "Busca paracetamol"}


PASO 2: Gateway consulta tools disponibles
═══════════════════════════════════════════
┌─────────────┐                    ┌─────────────┐
│ API Gateway │ ─JSON-RPC 2.0─────→│ MCP Server  │
│             │   tools/list        │             │
│             │←───────────────────│             │
│             │   [3 tools]         │             │
└─────────────┘                    └─────────────┘


PASO 3: Gateway envía a Gemini
═══════════════════════════════
┌─────────────┐                    ┌─────────────┐
│ API Gateway │────────────────────→│  Gemini AI  │
│             │  Mensaje + Tools    │             │
│             │                     │  Analiza... │
└─────────────┘                    └─────────────┘


PASO 4: Gemini decide ejecutar tool
════════════════════════════════════
┌─────────────┐                    ┌─────────────┐
│ API Gateway │←Function Call──────│  Gemini AI  │
│             │  buscar_producto    │             │
│             │  {query:"paracet"}  │             │
└─────────────┘                    └─────────────┘


PASO 5: Gateway ejecuta tool via MCP
═════════════════════════════════════
┌─────────────┐                    ┌─────────────┐
│ API Gateway │─JSON-RPC 2.0──────→│ MCP Server  │
│             │  tools/call         │             │
│             │  buscar_producto    │             │
└─────────────┘                    └──────┬──────┘
                                          │
                                          │ HTTP REST
                                          ▼
                                   ┌─────────────┐
                                   │   Backend   │
                                   │   /productos│
                                   └─────────────┘


PASO 6: Resultados regresan
════════════════════════════
┌─────────────┐                    ┌─────────────┐
│ API Gateway │←JSON-RPC──────────│ MCP Server  │
│             │  {success:true...}  │             │
│             │                     │             │
│             │──Function Response→│  Gemini AI  │
│             │                     │             │
│             │←Respuesta Natural──│             │
└──────┬──────┘                    └─────────────┘
       │
       │ JSON
       ▼
┌─────────┐
│ Usuario │ "Encontré Paracetamol 500mg..."
└─────────┘
```

---

## 🏗️ Arquitectura de Capas

```
╔═══════════════════════════════════════════════════════════════════╗
║                          CAPA DE PRESENTACIÓN                     ║
║                         (Interfaz de Usuario)                     ║
╠═══════════════════════════════════════════════════════════════════╣
║  • Postman / cURL                                                 ║
║  • Thunder Client                                                 ║
║  • Frontend Web (opcional)                                        ║
╚═══════════════════════════════════════════════════════════════════╝
                                 │
                                 │ HTTP REST
                                 ▼
╔═══════════════════════════════════════════════════════════════════╗
║                      CAPA DE ORQUESTACIÓN                         ║
║                     (API Gateway con IA)                          ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  ┌─────────────────┐    ┌──────────────────┐                    ║
║  │ IaController    │    │  GeminiService   │                    ║
║  │                 │───→│  • processQuery  │                    ║
║  │ • /ia/query     │    │  • Function Call │                    ║
║  │ • /ia/tools     │    └──────────────────┘                    ║
║  │ • /ia/health    │              │                             ║
║  └─────────────────┘              │                             ║
║                                   ▼                             ║
║                          ┌──────────────────┐                    ║
║                          │  McpClientService│                    ║
║                          │  • listTools     │                    ║
║                          │  • callTool      │                    ║
║                          └──────────────────┘                    ║
╚═══════════════════════════════════════════════════════════════════╝
                                 │
                                 │ JSON-RPC 2.0
                                 ▼
╔═══════════════════════════════════════════════════════════════════╗
║                         CAPA DE HERRAMIENTAS                      ║
║                          (MCP Server)                             ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  ┌─────────────────┐    ┌──────────────────┐                    ║
║  │  ToolRegistry   │    │  BackendClient   │                    ║
║  │                 │    │                  │                    ║
║  │ • buscar_prod   │───→│  • GET /productos│                    ║
║  │ • validar_stock │    │  • GET /stock    │                    ║
║  │ • crear_comp    │    │  • POST /comp    │                    ║
║  └─────────────────┘    └──────────────────┘                    ║
╚═══════════════════════════════════════════════════════════════════╝
                                 │
                                 │ HTTP REST
                                 ▼
╔═══════════════════════════════════════════════════════════════════╗
║                       CAPA DE LÓGICA DE NEGOCIO                   ║
║                         (Backend Services)                        ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          ║
║  │  Productos   │  │Prescripciones│  │  Comparador  │          ║
║  │              │  │              │  │              │          ║
║  │ • CRUD       │  │ • CRUD       │  │ • Comparar   │          ║
║  │ • Búsqueda   │  │ • Validar    │  │ • Analizar   │          ║
║  └──────────────┘  └──────────────┘  └──────────────┘          ║
╚═══════════════════════════════════════════════════════════════════╝
                                 │
                                 │ SQL
                                 ▼
╔═══════════════════════════════════════════════════════════════════╗
║                        CAPA DE PERSISTENCIA                       ║
║                          (Base de Datos)                          ║
╠═══════════════════════════════════════════════════════════════════╣
║                          SQLite                                   ║
║                    comparador.db                                  ║
╚═══════════════════════════════════════════════════════════════════╝
```

---

## 🔐 Flujo de Seguridad

```
┌─────────────────────────────────────────────────────────┐
│                    SEGURIDAD DEL SISTEMA                 │
└─────────────────────────────────────────────────────────┘

1. API KEY DE GEMINI
   ═══════════════════
   ┌──────────────┐
   │ .env file    │  ← API_KEY guardada aquí
   │ (No en Git)  │
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │ API Gateway  │  ← Lee de variables de entorno
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │  Gemini AI   │  ← Autenticación HTTPS
   └──────────────┘

2. VALIDACIÓN DE INPUTS
   ═══════════════════
   ┌──────────────┐
   │ Request      │
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │ DTOs +       │  ← Validación con class-validator
   │ Validators   │
   └──────┬───────┘
          │
          ▼ (Solo si válido)
   ┌──────────────┐
   │ Processing   │
   └──────────────┘

3. MANEJO DE ERRORES
   ═══════════════════
   ┌──────────────┐
   │ Try-Catch    │  ← En cada capa
   └──────┬───────┘
          │ Error
          ▼
   ┌──────────────┐
   │ Logger       │  ← Registra error
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │ User-friendly│  ← Mensaje apropiado
   │ Response     │
   └──────────────┘
```

---

## 📈 Escalabilidad

```
┌──────────────────────────────────────────────────────────┐
│              ESCALABILIDAD HORIZONTAL                     │
└──────────────────────────────────────────────────────────┘

ACTUAL (Desarrollo):
════════════════════
┌──────────┐   ┌──────────┐   ┌──────────┐
│ Gateway  │   │   MCP    │   │ Backend  │
│  :3000   │──→│  :3001   │──→│  :3003   │
└──────────┘   └──────────┘   └──────────┘

ESCALADO (Producción):
══════════════════════
                  ┌──────────┐
              ┌──→│ Gateway 1│
              │   └──────────┘
┌───────────┐ │   ┌──────────┐      ┌──────────┐
│   Load    │─┼──→│ Gateway 2│──┬──→│   MCP 1  │──┐
│  Balancer │ │   └──────────┘  │   └──────────┘  │
└───────────┘ │   ┌──────────┐  │   ┌──────────┐  │   ┌────────┐
              └──→│ Gateway 3│  ├──→│   MCP 2  │──┼──→│Backend │
                  └──────────┘  │   └──────────┘  │   │Cluster │
                                │   ┌──────────┐  │   └────────┘
                                └──→│   MCP 3  │──┘
                                    └──────────┘
```

---

## 🎯 Patrones de Diseño Aplicados

```
┌──────────────────────────────────────────────────────────┐
│               PATRONES IMPLEMENTADOS                      │
└──────────────────────────────────────────────────────────┘

1. REGISTRY PATTERN
   ════════════════
   ┌──────────────────┐
   │  ToolRegistry    │
   ├──────────────────┤
   │ + register()     │
   │ + get()          │
   │ + list()         │
   └────────┬─────────┘
            │
            ├── Tool 1
            ├── Tool 2
            └── Tool 3

2. STRATEGY PATTERN
   ════════════════
   ┌──────────────────┐
   │  ToolDefinition  │ ← Interface
   └────────┬─────────┘
            │
    ┌───────┴────────┬──────────┐
    │                │          │
┌───▼───┐     ┌──────▼──┐  ┌───▼────┐
│Buscar │     │ Validar │  │ Crear  │
└───────┘     └─────────┘  └────────┘

3. FACADE PATTERN
   ═══════════════
   ┌──────────────────┐
   │  GeminiService   │ ← Simplifica acceso
   ├──────────────────┤
   │ + processQuery() │
   └────────┬─────────┘
            │
    ┌───────┼────────┐
    │       │        │
┌───▼──┐ ┌──▼──┐ ┌───▼────┐
│Gemini│ │ MCP │ │Backend │
│  AI  │ │     │ │        │
└──────┘ └─────┘ └────────┘

4. ADAPTER PATTERN
   ════════════════
   ┌──────────────────┐
   │ McpClientService │ ← Adapta JSON-RPC
   ├──────────────────┤
   │ + listTools()    │
   │ + callTool()     │
   └────────┬─────────┘
            │ JSON-RPC 2.0
            ▼
   ┌──────────────────┐
   │    MCP Server    │
   └──────────────────┘
```

---

## 🚦 Estados del Sistema

```
┌──────────────────────────────────────────────────────────┐
│                 ESTADOS DEL SISTEMA                       │
└──────────────────────────────────────────────────────────┘

HEALTHY (Todo OK)
═══════════════════
┌─────────┐ ✅     ┌─────────┐ ✅     ┌─────────┐
│ Gateway │───────→│   MCP   │───────→│ Backend │
│ ONLINE  │        │ ONLINE  │        │ ONLINE  │
└─────────┘        └─────────┘        └─────────┘

DEGRADED (MCP Down)
═══════════════════
┌─────────┐ ❌     ┌─────────┐        ┌─────────┐
│ Gateway │─ X X  →│   MCP   │        │ Backend │
│ ONLINE  │        │ OFFLINE │        │ ONLINE  │
└─────────┘        └─────────┘        └─────────┘
     │
     └──→ Error: "MCP Server unreachable"

DEGRADED (Backend Down)
═══════════════════════
┌─────────┐ ✅     ┌─────────┐ ❌     ┌─────────┐
│ Gateway │───────→│   MCP   │─ X X  →│ Backend │
│ ONLINE  │        │ ONLINE  │        │ OFFLINE │
└─────────┘        └─────────┘        └─────────┘
                        │
                        └──→ Error: "Backend timeout"

OFFLINE (Todo Down)
═══════════════════
┌─────────┐        ┌─────────┐        ┌─────────┐
│ Gateway │        │   MCP   │        │ Backend │
│ OFFLINE │        │ OFFLINE │        │ OFFLINE │
└─────────┘        └─────────┘        └─────────┘
```

---

## 📊 Métricas y Monitoreo

```
┌──────────────────────────────────────────────────────────┐
│                  PUNTOS DE MONITOREO                      │
└──────────────────────────────────────────────────────────┘

1. HEALTH ENDPOINTS
   ════════════════
   GET /ia/health
        │
        ├─→ Gateway Status
        ├─→ MCP Server Status
        └─→ Tools Count

2. LOGS
   ════
   MCP Server:
   ┌─────────────────┐
   │ mcp-server.log  │
   ├─────────────────┤
   │ • Requests      │
   │ • Tool calls    │
   │ • Errors        │
   └─────────────────┘

   API Gateway:
   ┌─────────────────┐
   │ Console output  │
   ├─────────────────┤
   │ • Queries       │
   │ • Gemini calls  │
   │ • Responses     │
   └─────────────────┘

3. METRICS
   ═══════
   • Requests/minute
   • Average response time
   • Error rate
   • Tools execution count
   • Gemini API usage
```

---

**Diagramas completos! 🎨**
