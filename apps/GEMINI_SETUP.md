# 🔑 Configuración de Gemini API Key

## Paso 1: Obtener API Key

1. Ve a [Google AI Studio](https://aistudio.google.com)
2. Inicia sesión con tu cuenta de Google
3. Haz clic en **"Get API Key"** en el menú izquierdo
4. Crea un nuevo proyecto o selecciona uno existente
5. Copia la API Key generada

## Paso 2: Configurar en el Proyecto

Edita el archivo `apps/api-gateway/.env`:

```env
GEMINI_API_KEY=AIzaSy...TuApiKeyAqui...
MCP_SERVER_URL=http://localhost:3001
PORT=3000
```

## Paso 3: Verificar Configuración

Ejecuta el API Gateway:

```bash
cd apps/api-gateway
npm run start:dev
```

Si ves el mensaje:
```
✅ Gemini inicializado con tools
```

¡Todo está listo! 🎉

## Solución de Problemas

### Error: "GEMINI_API_KEY no está configurada"

**Causa:** La variable de entorno no se cargó correctamente.

**Solución:**
1. Verifica que el archivo `.env` existe en `apps/api-gateway/`
2. Reinicia el servidor después de editar `.env`
3. No incluyas comillas en el valor: `GEMINI_API_KEY=tu_key` (no `"tu_key"`)

### Error: "Invalid API Key"

**Causa:** La API Key no es válida o está mal copiada.

**Solución:**
1. Vuelve a copiar la key desde Google AI Studio
2. Asegúrate de no incluir espacios al principio o final
3. Verifica que la key comience con `AIzaSy`

### Error de Cuota o Límite

**Causa:** Has excedido el límite gratuito de Gemini.

**Solución:**
1. Gemini 2.0 Flash tiene un límite generoso gratuito
2. Espera unos minutos antes de volver a probar
3. Revisa tu cuota en [Google AI Studio](https://aistudio.google.com/apikey)

## Modelos Disponibles

El proyecto usa **Gemini 2.0 Flash Experimental**:
- ✅ **Gratuito**
- ✅ Rápido (optimizado para baja latencia)
- ✅ Soporta Function Calling
- ✅ Límite generoso de requests por minuto

Si quieres cambiar el modelo, edita `apps/api-gateway/src/gemini/gemini.service.ts`:

```typescript
this.model = this.genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',  // Cambiar aquí
  tools: [{ functionDeclarations: geminiTools }],
});
```

Otros modelos disponibles:
- `gemini-pro` (más potente, pero más lento)
- `gemini-1.5-flash` (versión estable anterior)

## Referencias

- [Gemini API Docs](https://ai.google.dev/docs)
- [Google AI Studio](https://aistudio.google.com)
- [Pricing & Limits](https://ai.google.dev/pricing)
