# 🔑 Instrucciones para Configurar API Key de Google Gemini

## ❌ Problema Actual
El API Key de Gemini que tienes configurado **NO ES VÁLIDO** o ha expirado.

Error: `API key not valid. Please pass a valid API key.`

## ✅ Solución: Obtener Nueva API Key

### Paso 1: Ir a Google AI Studio
Abre tu navegador y visita:
```
https://aistudio.google.com/app/apikey
```

### Paso 2: Iniciar Sesión
- Inicia sesión con tu cuenta de Google
- Si no tienes cuenta, créala gratis

### Paso 3: Crear API Key
1. Haz clic en **"Create API Key"** o **"Crear clave de API"**
2. Selecciona un proyecto de Google Cloud (o crea uno nuevo)
3. Copia la API Key generada (ejemplo: `AIzaSyABC123...`)

### Paso 4: Configurar en el Proyecto

#### Opción A: Editar archivo .env (Recomendado)
1. Abre el archivo: `apps/api-gateway/.env`
2. Reemplaza la línea:
   ```env
   GEMINI_API_KEY=TU_NUEVA_API_KEY_AQUI
   ```
   Con tu API Key real:
   ```env
   GEMINI_API_KEY=AIzaSyABC123TuApiKeyReal
   ```
3. Guarda el archivo

#### Opción B: Por PowerShell (Temporal)
```powershell
cd apps/api-gateway
$env:GEMINI_API_KEY="AIzaSyABC123TuApiKeyReal"
npm run start:dev
```

### Paso 5: Reiniciar el API Gateway
1. Detén el proceso del API Gateway (si está corriendo)
2. Inícialo de nuevo:
   ```powershell
   cd apps/api-gateway
   npm run start:dev
   ```

### Paso 6: Verificar
Espera 10 segundos y prueba:
```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/ia/health' -Method Get
```

Deberías ver: `"gateway": "healthy"`

### Paso 7: Probar Chat
1. Recarga la página del chat (F5)
2. Escribe: "Busca productos con paracetamol"
3. Deberías ver resultados exitosos

## 🆓 API Key Gratuita
- Google Gemini ofrece un tier **GRATUITO**
- Límites:
  - 15 solicitudes por minuto
  - 1,500 solicitudes por día
  - 1 millón de tokens por día
- **Suficiente para desarrollo y pruebas**

## 📝 Notas Importantes

### Seguridad
- ⚠️ **NO compartas tu API Key públicamente**
- ⚠️ **NO la subas a GitHub sin `.gitignore`**
- ✅ El archivo `.env` ya está en `.gitignore`

### Si no funciona
1. Verifica que copiaste la API Key completa (sin espacios)
2. Verifica que el archivo `.env` se guardó correctamente
3. Reinicia el servidor después de cambiar la API Key
4. Verifica que tu cuenta de Google tenga permisos

## 🔄 Archivo a Editar
```
apps/api-gateway/.env
```

Busca esta línea y reemplázala:
```env
GEMINI_API_KEY=TU_NUEVA_API_KEY_AQUI
```

---

**¿Necesitas ayuda?** Verifica que:
1. Iniciaste sesión en https://aistudio.google.com
2. Creaste una nueva API Key
3. La copiaste completa
4. La pegaste en el archivo `.env`
5. Reiniciaste el servidor

¡Listo para usar el chat con IA! 🚀✨
