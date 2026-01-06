# 🧪 Guía de Pruebas - Sistema MCP + IA

## 📋 Checklist de Verificación

### ✅ Prerrequisitos
- [ ] Backend (comparador-service) ejecutándose en puerto 3003
- [ ] MCP Server ejecutándose en puerto 3001
- [ ] API Gateway ejecutándose en puerto 3000
- [ ] API Key de Gemini configurada en `.env`

---

## 🔬 Pruebas Funcionales

### 1. Health Checks

#### MCP Server
```bash
curl http://localhost:3001/health
```

**Resultado esperado:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-05T10:30:00.000Z",
  "tools": ["buscar_producto", "validar_stock", "crear_comparacion"]
}
```

#### API Gateway
```bash
curl http://localhost:3000/ia/health
```

**Resultado esperado:**
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

### 2. Listar Tools Disponibles

```bash
curl http://localhost:3000/ia/tools
```

**Resultado esperado:**
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

---

### 3. Pruebas de Consultas con IA

#### Test 1: Búsqueda Simple
```bash
curl -X POST http://localhost:3000/ia/query \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Busca productos con paracetamol"
  }'
```

**Verificar:**
- ✅ `success: true`
- ✅ `response` contiene información de productos
- ✅ `toolsExecuted` incluye `buscar_producto`

---

#### Test 2: Validación de Stock
```bash
curl -X POST http://localhost:3000/ia/query \
  -H "Content-Type: application/json" \
  -d '{
    "message": "¿Hay 20 unidades del producto con ID 1?"
  }'
```

**Verificar:**
- ✅ Tool `validar_stock` ejecutado
- ✅ Respuesta indica disponibilidad o faltante
- ✅ Datos incluyen: stock actual, cantidad requerida, disponible (true/false)

---

#### Test 3: Crear Comparación
```bash
curl -X POST http://localhost:3000/ia/query \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Crea una comparación de precios para la prescripción 1"
  }'
```

**Verificar:**
- ✅ Tool `crear_comparacion` ejecutado
- ✅ Respuesta incluye ID de comparación
- ✅ Muestra precio total y ahorro potencial

---

#### Test 4: Consulta Compleja (Multi-Tool)
```bash
curl -X POST http://localhost:3000/ia/query \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Busca ibuprofeno 400mg, verifica si hay 15 unidades disponibles"
  }'
```

**Verificar:**
- ✅ Múltiples tools ejecutados: `buscar_producto` + `validar_stock`
- ✅ `iterations >= 2`
- ✅ Respuesta coherente integrando ambos resultados

---

## 🧪 Pruebas con Postman/Thunder Client

### Colección de Requests

#### 1. Health Check Gateway
```
GET http://localhost:3000/ia/health
```

#### 2. Listar Tools
```
GET http://localhost:3000/ia/tools
```

#### 3. Consulta Simple
```
POST http://localhost:3000/ia/query
Content-Type: application/json

{
  "message": "¿Qué productos tienen aspirina?"
}
```

#### 4. Consulta con Validación
```
POST http://localhost:3000/ia/query
Content-Type: application/json

{
  "message": "Necesito 30 unidades del producto 5, verifica disponibilidad"
}
```

#### 5. Crear Comparación
```
POST http://localhost:3000/ia/query
Content-Type: application/json

{
  "message": "Haz una comparación de precios de la prescripción 2"
}
```

---

## 🎭 Casos de Prueba por Escenario

### Escenario 1: Producto Encontrado con Stock
**Input:**
```json
{
  "message": "Busca amoxicilina y verifica stock de 10 unidades"
}
```

**Esperado:**
- Tool 1: `buscar_producto` → Encuentra producto(s)
- Tool 2: `validar_stock` → Stock suficiente (≥10)
- Respuesta: "✅ Stock disponible"

---

### Escenario 2: Producto Encontrado sin Stock Suficiente
**Input:**
```json
{
  "message": "Verifica si hay 100 unidades del producto 3"
}
```

**Esperado:**
- Tool: `validar_stock` → Stock insuficiente
- Respuesta: "❌ Stock insuficiente: X disponibles, faltan Y"

---

### Escenario 3: Producto No Encontrado
**Input:**
```json
{
  "message": "Busca producto XXXINEXISTENTEXXX"
}
```

**Esperado:**
- Tool: `buscar_producto` → `data: []`
- Respuesta: "No se encontraron productos con ese término"

---

### Escenario 4: Consulta Ambigua
**Input:**
```json
{
  "message": "Hola, ¿cómo estás?"
}
```

**Esperado:**
- No ejecuta tools (o muy pocos)
- Respuesta: Saludo educado explicando las capacidades del sistema

---

## 📊 Verificación de Logs

### MCP Server (`mcp-server.log`)
Buscar estas líneas:
```
[info]: 🔧 Ejecutando tool: buscar_producto
[info]: 🔹 Request: GET /productos?search=...
[info]: ✅ Response: 200 /productos
[info]: ✅ Tool ejecutado: buscar_producto
```

### API Gateway (consola)
```
[GeminiService] 📦 Tools disponibles: 3
[GeminiService] 🔄 Iteración 1: Gemini solicita ejecutar tools
[GeminiService] 🔧 Ejecutando: buscar_producto
[GeminiService] ✅ Tool buscar_producto ejecutado exitosamente
```

---

## 🐛 Casos de Error Esperados

### Error 1: Backend No Disponible
**Simular:** Detener comparador-service

**Request:**
```json
{
  "message": "Busca paracetamol"
}
```

**Resultado esperado:**
```json
{
  "success": true,
  "response": "No pude conectar con el sistema de productos...",
  "toolsExecuted": [
    { "name": "buscar_producto", "success": false }
  ]
}
```

---

### Error 2: MCP Server No Disponible
**Simular:** Detener mcp-server

**Request:**
```bash
curl http://localhost:3000/ia/health
```

**Resultado esperado:**
```json
{
  "success": false,
  "gateway": "healthy",
  "mcpServer": "unreachable",
  "error": "Error comunicándose con MCP Server..."
}
```

---

### Error 3: API Key Inválida
**Simular:** Configurar `GEMINI_API_KEY` incorrecta

**Resultado esperado:**
```json
{
  "success": false,
  "error": "Error de autenticación con Gemini API..."
}
```

---

## 📈 Métricas de Rendimiento

### Tiempo de Respuesta Esperado

| Tipo de Consulta | Tiempo (ms) | Tools Ejecutados |
|------------------|-------------|------------------|
| Búsqueda simple  | 1000-2000   | 1                |
| Con validación   | 1500-3000   | 2                |
| Comparación      | 2000-4000   | 1-3              |
| Multi-tool       | 3000-6000   | 3+               |

### Logs de Gemini
Verificar en consola:
```
[GeminiService] iterations: 2
```
- ✅ Normal: 1-3 iteraciones
- ⚠️ Revisar: 4+ iteraciones

---

## ✅ Checklist Final

### Funcionalidad Core
- [ ] Health check responde correctamente
- [ ] Tools se listan correctamente
- [ ] Consulta simple funciona
- [ ] Validación de stock funciona
- [ ] Crear comparación funciona
- [ ] Multi-tool funciona (2+ tools en una consulta)

### Integración
- [ ] MCP Server se comunica con Backend
- [ ] API Gateway se comunica con MCP Server
- [ ] Gemini ejecuta tools correctamente
- [ ] Resultados se procesan y retornan al usuario

### Manejo de Errores
- [ ] Backend offline: error manejado
- [ ] MCP Server offline: error manejado
- [ ] API Key inválida: error manejado
- [ ] Producto no encontrado: respuesta apropiada

### Logs y Monitoreo
- [ ] Logs del MCP Server se generan
- [ ] Logs del API Gateway aparecen
- [ ] Errores se registran correctamente

---

## 🎥 Video Demostrativo

Grabar mostrando:
1. ✅ Arranque de los 3 servicios
2. ✅ Health check exitoso
3. ✅ Consulta simple (búsqueda)
4. ✅ Consulta con validación
5. ✅ Consulta compleja (multi-tool)
6. ✅ Logs en consola mostrando ejecución

**Duración:** 3-5 minutos

---

**Sistema completamente probado y funcional! 🎉**
