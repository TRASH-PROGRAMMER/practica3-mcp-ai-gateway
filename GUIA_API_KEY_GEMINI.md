# 🔑 Guía para Obtener API Key de Gemini

## 📋 Requisitos Previos

- ✅ Cuenta de Google (Gmail)
- ✅ Acceso a internet
- ✅ Navegador web moderno

---

## 🚀 Pasos para Obtener la API Key

### 1. Acceder a Google AI Studio

Visita: **https://aistudio.google.com**

![Google AI Studio](https://aistudio.google.com)

---

### 2. Iniciar Sesión

- Haz clic en **"Sign in"** o **"Get started"**
- Inicia sesión con tu cuenta de Google
- Acepta los términos y condiciones

---

### 3. Crear una API Key

#### Opción A: Desde el Dashboard

1. En el menú lateral, busca **"Get API key"**
2. Haz clic en **"Create API key"**
3. Selecciona el proyecto:
   - **Create API key in new project** (recomendado para nuevos usuarios)
   - O selecciona un proyecto existente de Google Cloud

#### Opción B: Desde la Configuración

1. Haz clic en tu avatar (esquina superior derecha)
2. Selecciona **"API keys"**
3. Haz clic en **"+ Create API key"**

---

### 4. Copiar la API Key

Una vez creada, verás algo como:

```
AIzaSyD1234567890abcdefghijklmnopqrstuvw
```

⚠️ **IMPORTANTE:**
- Copia esta key inmediatamente
- Guárdala en un lugar seguro
- No la compartas públicamente
- No la subas a repositorios públicos

---

### 5. Configurar en tu Proyecto

#### Opción 1: Archivo .env (Recomendado)

```bash
# apps/api-gateway/.env
GEMINI_API_KEY=AIzaSyD1234567890abcdefghijklmnopqrstuvw
```

#### Opción 2: Variable de Entorno del Sistema

**Windows (PowerShell):**
```powershell
$env:GEMINI_API_KEY="AIzaSyD1234567890abcdefghijklmnopqrstuvw"
```

**Linux/Mac:**
```bash
export GEMINI_API_KEY="AIzaSyD1234567890abcdefghijklmnopqrstuvw"
```

---

## ✅ Verificar la API Key

### Prueba 1: Health Check

```bash
# Iniciar API Gateway
cd apps/api-gateway
npm run start:dev

# Verificar
curl http://localhost:3000/ia/health
```

**Respuesta esperada:**
```json
{
  "success": true,
  "gateway": "healthy",
  "mcpServer": {
    "status": "healthy"
  }
}
```

### Prueba 2: Consulta Simple

```bash
curl -X POST http://localhost:3000/ia/query \
  -H "Content-Type: application/json" \
  -d '{"message":"Hola, ¿qué puedes hacer?"}'
```

**Si la API Key es válida:**
✅ Recibirás una respuesta en lenguaje natural

**Si la API Key es inválida:**
❌ Error: "Invalid API Key" o "Authentication failed"

---

## 📊 Límites y Cuotas (Gratuitas)

### Gemini 2.0 Flash (Free Tier)

| Recurso | Límite Gratuito |
|---------|-----------------|
| Requests/minuto | 15 |
| Requests/día | 1,500 |
| Tokens/minuto | 1,000,000 |
| Tokens/request | 32,768 (entrada + salida) |

### ⚠️ Notas sobre Límites

- ✅ Suficiente para desarrollo y pruebas
- ✅ Sin tarjeta de crédito requerida
- ⚠️ Si excedes, espera 1 minuto y reintenta
- ⚠️ Para producción, considera Google Cloud billing

---

## 🔒 Seguridad de la API Key

### ✅ Buenas Prácticas

```bash
# 1. Usar .env (nunca hardcodear)
✅ .env
❌ const API_KEY = "AIzaSy..."

# 2. .gitignore debe incluir .env
✅ .env en .gitignore
❌ .env commiteado

# 3. Proveer .env.example
✅ GEMINI_API_KEY=tu_api_key_aqui
❌ GEMINI_API_KEY=AIzaSy...realpkey

# 4. Rotar la key si se expone
✅ Generar nueva key
❌ Seguir usando key expuesta
```

### ❌ Qué NO Hacer

```typescript
// ❌ NUNCA HACER ESTO:
const apiKey = "AIzaSyD1234567890abcdefghijklmnopqrstuvw";

// ❌ NUNCA HACER ESTO:
git add .env
git commit -m "Added API key"
git push

// ❌ NUNCA HACER ESTO:
console.log("API Key:", process.env.GEMINI_API_KEY);
```

---

## 🔄 Rotar o Regenerar API Key

### ¿Cuándo rotar?

- ✅ La key se expuso públicamente
- ✅ Sospecha de compromiso
- ✅ Cada 90 días (buena práctica)
- ✅ Al cambiar de equipo

### Cómo rotar

1. Ir a https://aistudio.google.com
2. Menú **"API keys"**
3. Hacer clic en **"..."** junto a la key
4. Seleccionar **"Delete"** o **"Regenerate"**
5. Copiar la nueva key
6. Actualizar en tu `.env`

---

## 🌍 Disponibilidad Regional

### Países Soportados

Gemini AI está disponible en la mayoría de países, incluyendo:

✅ Estados Unidos  
✅ Canadá  
✅ Reino Unido  
✅ Europa (mayoría)  
✅ América Latina (mayoría)  
✅ Asia (mayoría)  

⚠️ Verifica en: https://ai.google.dev/available_regions

---

## 🆘 Problemas Comunes

### Error: "API key not valid"

**Causa:** Key incorrecta o malformada

**Solución:**
1. Verificar que copiaste la key completa
2. Sin espacios al inicio o final
3. Regenerar key si es necesario

---

### Error: "429 - Quota exceeded"

**Causa:** Excediste el límite de requests

**Solución:**
1. Espera 1 minuto
2. Verifica en Google AI Studio tu uso
3. Considera implementar rate limiting

---

### Error: "403 - Permission denied"

**Causa:** API no habilitada o país restringido

**Solución:**
1. Verifica disponibilidad regional
2. Habilita Gemini API en Google Cloud Console
3. Acepta términos y condiciones

---

### Error: "Invalid authentication credentials"

**Causa:** Key expirada o revocada

**Solución:**
1. Regenerar API key
2. Actualizar .env
3. Reiniciar aplicación

---

## 📱 API Key para Otros Servicios

Si en el futuro quieres usar otros servicios de Google AI:

### Google Cloud Console
```
https://console.cloud.google.com/apis/credentials
```

### Vertex AI
```
https://cloud.google.com/vertex-ai
```

---

## 📚 Recursos Adicionales

- **Google AI Studio:** https://aistudio.google.com
- **Documentación Oficial:** https://ai.google.dev/tutorials/setup
- **Gemini API Docs:** https://ai.google.dev/gemini-api/docs
- **Pricing:** https://ai.google.dev/pricing
- **Support:** https://support.google.com

---

## ✅ Checklist de Configuración

```bash
☐ Visitaste https://aistudio.google.com
☐ Iniciaste sesión con tu cuenta Google
☐ Creaste una API key
☐ Copiaste la key completa
☐ Creaste archivo apps/api-gateway/.env
☐ Configuraste GEMINI_API_KEY en .env
☐ Verificaste que .env está en .gitignore
☐ Probaste con curl o Postman
☐ La consulta funciona correctamente
```

---

## 🎓 Tips para el Taller

### Desarrollo
```bash
# Usa .env.example como referencia
cp apps/api-gateway/.env.example apps/api-gateway/.env

# Edita .env
nano apps/api-gateway/.env
# o
notepad apps/api-gateway/.env
```

### Entrega
```bash
# NO incluyas tu API key real en el repo
# Usa .env.example con placeholder
GEMINI_API_KEY=tu_api_key_aqui

# Proporciona la key real al docente por otro medio:
# - Email privado
# - Plataforma del curso
# - En persona
```

### Demo
```bash
# Antes de la demo, verifica:
1. API key configurada
2. Límites no excedidos
3. Internet funcionando
4. Servicios iniciados
```

---

## 🎉 ¡Listo!

Con tu API Key configurada, el sistema MCP + IA está completamente operativo.

**Próximo paso:** Probar el sistema con [GUIA_PRUEBAS_TALLER_3.md](GUIA_PRUEBAS_TALLER_3.md)

---

**¡Buena suerte con tu proyecto! 🚀**
