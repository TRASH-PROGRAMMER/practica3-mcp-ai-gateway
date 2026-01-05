# 🎓 Taller 3 - MCP + IA: Integración con Microservicios

**Universidad Laica Eloy Alfaro de Manabí (ULEAM)**  
**Asignatura:** Aplicación para el Servidor Web  
**Docente:** Ing. John Cevallos

---

## 📖 Descripción del Proyecto

Sistema de orquestación inteligente que integra **Model Context Protocol (MCP)** con **Gemini AI** para gestionar operaciones de productos farmacéuticos y prescripciones médicas de forma inteligente.

### 🎯 Objetivo
Crear un sistema donde la **IA toma decisiones** sobre qué operaciones ejecutar basándose en el lenguaje natural del usuario, sin necesidad de especificar endpoints o parámetros manualmente.

---

## 🏗️ Arquitectura Implementada

```
┌──────────────────────────────────────────────────────────┐
│                   USUARIO                                │
│  "Busca ibuprofeno y compáralo con paracetamol"         │
└─────────────────────┬────────────────────────────────────┘
                      │ (Texto Natural)
                      ▼
┌──────────────────────────────────────────────────────────┐
│           API GATEWAY (Puerto 3000)                      │
│  ┌────────────────────────────────────────┐             │
│  │  Gemini AI 2.0 Flash                   │             │
│  │  - Analiza intención del usuario       │             │
│  │  - Decide qué Tools ejecutar           │             │
│  │  - Function Calling automático         │             │
│  └────────────────────────────────────────┘             │
└─────────────────────┬────────────────────────────────────┘
                      │ (JSON-RPC 2.0)
                      ▼
┌──────────────────────────────────────────────────────────┐
│           MCP SERVER (Puerto 3001)                       │
│  ┌─────────────────────────────────────────────┐        │
│  │  Tools Disponibles:                         │        │
│  │  • buscar_producto                          │        │
│  │  • validar_prescripcion                     │        │
│  │  • crear_comparacion                        │        │
│  └─────────────────────────────────────────────┘        │
└─────────────────────┬────────────────────────────────────┘
                      │ (HTTP REST)
                      ▼
┌──────────────────────────────────────────────────────────┐
│           BACKEND (Puerto 3002)                          │
│  - NestJS + TypeORM + SQLite                            │
│  - Entidades: Producto, Prescripción                    │
│  - CRUD completo (Taller 2)                             │
└──────────────────────────────────────────────────────────┘
```

---

## 🚀 Inicio Rápido

### 1️⃣ Instalar Dependencias

```bash
# MCP Server
cd apps/mcp-server
npm install

# API Gateway
cd ../api-gateway
npm install

# Backend (si no está instalado)
cd ../../Practica_gateway/gateway/comparador-service
npm install
```

### 2️⃣ Configurar Variables de Entorno

#### **API Gateway** (`apps/api-gateway/.env`)
```env
GEMINI_API_KEY=tu_clave_de_gemini_aqui
MCP_SERVER_URL=http://localhost:3001
PORT=3000
```

> 🔑 **Obtén tu API Key gratuita aquí:** https://aistudio.google.com/apikey

#### **MCP Server** (`apps/mcp-server/.env`)
```env
BACKEND_URL=http://localhost:3002
PORT=3001
```

### 3️⃣ Ejecutar el Sistema

**Opción A: 3 Terminales (Recomendado para desarrollo)**

```bash
# Terminal 1: Backend
cd Practica_gateway/gateway/comparador-service
npm run start:dev

# Terminal 2: MCP Server
cd apps/mcp-server
npm run dev

# Terminal 3: API Gateway
cd apps/api-gateway
npm run start:dev
```

**Opción B: Script de Prueba Rápida**
```powershell
.\apps\test-quick.ps1
```

---

## 📡 Uso del Sistema

### Endpoint Principal: Chat con IA

```bash
POST http://localhost:3000/productos/chat
Content-Type: application/json

{
  "message": "Busca productos con ibuprofeno"
}
```

### Ejemplos de Mensajes

| Mensaje del Usuario | Tools que Ejecuta la IA |
|---------------------|-------------------------|
| "Busca ibuprofeno" | `buscar_producto` |
| "Valida la prescripción 1" | `validar_prescripcion` |
| "Compara producto 1 vs 2 por precio" | `crear_comparacion` |
| "Busca paracetamol y valida prescripción 5" | `buscar_producto` + `validar_prescripcion` |
| "Encuentra aspirina, valida receta 2 y compara con ibuprofeno" | 3 tools en secuencia |

---

## 🛠️ Tools Disponibles

### 1. **buscar_producto**
Busca medicamentos en el inventario.

**Parámetros:**
- `query` (string): Término de búsqueda

**Ejemplo de uso natural:**
- "Busca ibuprofeno"
- "Encuentra productos con paracetamol"
- "Qué medicamentos tienen aspirina"

---

### 2. **validar_prescripcion**
Valida si una prescripción médica está activa.

**Parámetros:**
- `idPrescripcion` (number): ID de la prescripción

**Ejemplo de uso natural:**
- "Valida la prescripción 1"
- "Verifica si la receta número 5 está activa"
- "¿Está válida la prescripción 3?"

---

### 3. **crear_comparacion**
Compara dos productos según un criterio.

**Parámetros:**
- `idProducto1` (number): Primer producto
- `idProducto2` (number): Segundo producto
- `criterio` (string): precio | efectividad | efectos_secundarios | disponibilidad

**Ejemplo de uso natural:**
- "Compara producto 1 con producto 2 por precio"
- "Qué es mejor entre medicamento 3 y 5 en efectividad"

---

## 📂 Estructura del Proyecto

```
apps/
├── README.md                          # 👈 Documentación principal
├── IMPLEMENTACION.md                  # Detalles técnicos
├── test-quick.ps1                     # Script de pruebas
├── Taller3-MCP-Tests.postman_collection.json
│
├── backend/
│   └── README.md                      # Referencia al Taller 2
│
├── mcp-server/                        # 🔧 Servidor MCP (Puerto 3001)
│   ├── src/
│   │   ├── server.ts                  # Servidor JSON-RPC
│   │   ├── tools/
│   │   │   ├── registry.ts
│   │   │   ├── buscar-producto.tool.ts
│   │   │   ├── validar-prescripcion.tool.ts
│   │   │   └── crear-comparacion.tool.ts
│   │   └── services/
│   │       └── backend-client.ts      # Cliente HTTP
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
│
└── api-gateway/                       # 🤖 Gateway IA (Puerto 3000)
    ├── src/
    │   ├── main.ts
    │   ├── app.module.ts
    │   ├── gemini/
    │   │   └── gemini.service.ts      # Integración Gemini
    │   ├── mcp-client/
    │   │   └── mcp-client.service.ts  # Cliente RPC
    │   └── productos/
    │       ├── productos.controller.ts
    │       ├── productos.service.ts
    │       └── productos.module.ts
    ├── package.json
    ├── tsconfig.json
    └── .env
```

---

## 🧪 Pruebas

### 1. Verificar Servicios
```bash
# Backend
curl http://localhost:3002

# MCP Server
curl http://localhost:3001/health

# API Gateway
curl http://localhost:3000/productos/health
```

### 2. Listar Tools Disponibles
```bash
curl http://localhost:3000/productos/tools
```

### 3. Prueba Completa con IA
```bash
curl -X POST http://localhost:3000/productos/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Busca ibuprofeno y valida prescripción 1"}'
```

### 4. Importar Colección Postman
Archivo: `apps/Taller3-MCP-Tests.postman_collection.json`
- 12 requests de prueba
- Ejemplos de todos los escenarios
- Documentación incluida

---

## 📊 Stack Tecnológico

| Capa | Tecnología | Puerto | Descripción |
|------|-----------|--------|-------------|
| **Frontend (Usuario)** | cURL / Postman | - | Cliente HTTP |
| **API Gateway** | NestJS + Gemini AI | 3000 | Orquestación IA |
| **MCP Server** | Express + JSON-RPC | 3001 | Gestión de Tools |
| **Backend** | NestJS + TypeORM | 3002 | Lógica de negocio |
| **Base de Datos** | SQLite | - | Almacenamiento |

---

## 🎓 Conceptos Clave Implementados

### 1. **Model Context Protocol (MCP)**
- Protocolo estándar para IA (Anthropic)
- Comunicación vía JSON-RPC 2.0
- Tools como contratos de negocio

### 2. **Function Calling (Gemini)**
- IA decide qué funciones ejecutar
- Sin reglas hardcoded
- Orquestación automática

### 3. **Arquitectura de 3 Capas**
- **Gateway:** Interfaz inteligente
- **MCP:** Orquestador
- **Backend:** Persistencia

### 4. **Reutilización de Código**
- Backend del Taller 2 sin cambios
- Nuevas capas no invasivas
- Separación de responsabilidades

---

## 📖 Documentación Adicional

- [README.md](apps/README.md) - Este archivo
- [IMPLEMENTACION.md](apps/IMPLEMENTACION.md) - Detalles técnicos completos
- [MCP Docs](https://modelcontextprotocol.io) - Documentación oficial
- [Gemini AI](https://ai.google.dev/gemini-api/docs) - API de Google

---

## ✅ Checklist de Entregables

- [x] Código funcional en Git
- [x] README.md completo
- [x] Estructura según .md del taller
- [x] 3 Tools implementados
- [x] MCP Server operativo
- [x] API Gateway con Gemini
- [x] Integración con Backend
- [x] Colección Postman
- [ ] Video demostrativo (3-5 min)
- [x] Documentación técnica

---

## 🐛 Solución de Problemas

### Error: "GEMINI_API_KEY no está configurada"
**Solución:**
1. Ve a https://aistudio.google.com/apikey
2. Genera una clave API gratuita
3. Configura en `apps/api-gateway/.env`

### Error: "Backend no responde (3002)"
**Solución:**
```bash
cd Practica_gateway/gateway/comparador-service
npm install
npm run start:dev
```

### Error: "MCP Server no lista tools"
**Solución:**
1. Verifica que `BACKEND_URL` esté en `.env`
2. Reinicia el MCP Server
3. Revisa logs en consola

---

## 👥 Equipo

- **[Tu Nombre]** - Backend + MCP Server
- **[Nombre 2]** - API Gateway + Gemini
- **[Nombre 3]** - Testing + Documentación

---

## 📄 Licencia

Proyecto académico - ULEAM 2025-2026

---

> **"La IA no reemplaza al desarrollador, lo potencia. MCP es el puente."**
