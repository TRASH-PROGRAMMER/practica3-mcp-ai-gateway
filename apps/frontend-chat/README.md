# 💬 Frontend Chat - MCP AI

Frontend Vue 3 con diseño neón y efectos modernos para interactuar con el sistema MCP + IA.

## 🎨 Características

- ✨ **Diseño Neón**: Colores vibrantes con efectos de brillo
- 🎭 **Animaciones**: Partículas flotantes, pulsos y transiciones suaves
- 💬 **Chat Vertical**: Diseño tipo mensajería moderna
- 🎯 **Sugerencias**: Botones de acceso rápido
- 🔧 **Modal de Herramientas**: Visualiza los tools disponibles
- 📱 **Responsive**: Adaptable a móviles y tablets
- ⚡ **Real-time**: Indicadores de estado y escritura

## 🚀 Uso

### Opción 1: Abrir directamente (Sin servidor)

Simplemente abre `index.html` en tu navegador:

```bash
# Windows
start index.html

# O doble clic en el archivo
```

### Opción 2: Con servidor local (Recomendado)

```bash
# Instalar servidor HTTP simple
npm install -g http-server

# Iniciar servidor
cd apps/frontend-chat
http-server -p 8080

# Abrir en navegador
# http://localhost:8080
```

### Opción 3: Con Python

```bash
cd apps/frontend-chat
python -m http.server 8080

# Abrir: http://localhost:8080
```

## ⚙️ Configuración

Si tu API Gateway está en otro puerto, edita `app.js`:

```javascript
apiUrl: 'http://localhost:3000'  // ← Cambiar aquí
```

## 🎯 Funcionalidades

### Sugerencias Rápidas
- 🔍 Buscar productos
- 📦 Verificar stock
- 💰 Comparar precios

### Acciones Rápidas
- 🗑️ Limpiar chat
- 💚 Verificar estado del sistema
- 🔧 Ver herramientas disponibles

### Efectos Visuales
- Partículas flotantes animadas
- Texto con efecto neón parpadeante
- Avatares con brillo pulsante
- Animaciones de entrada/salida
- Indicador de escritura animado

## 🎨 Paleta de Colores Neón

- **Cyan**: `#00f3ff` - Textos principales y bordes
- **Púrpura**: `#b800ff` - Elementos secundarios
- **Rosa**: `#ff00ff` - Acentos
- **Verde**: `#00ff41` - Estados positivos
- **Amarillo**: `#ffff00` - Alertas

## 📱 Capturas de Pantalla

### Pantalla de Bienvenida
- Mensaje de bienvenida animado
- 3 sugerencias de consulta
- Diseño neón con partículas

### Chat Activo
- Mensajes del usuario (gradiente púrpura)
- Respuestas de la IA (fondo oscuro con borde cyan)
- Indicador de herramientas usadas
- Timestamps en cada mensaje

### Modal de Herramientas
- Lista de tools disponibles
- Descripción de cada herramienta
- Diseño tipo tarjeta con efectos hover

## 🔧 Personalización

### Cambiar Colores

Edita las variables CSS en `styles.css`:

```css
:root {
    --neon-cyan: #00f3ff;      /* Color principal */
    --neon-purple: #b800ff;    /* Color secundario */
    --neon-pink: #ff00ff;      /* Acentos */
    --dark-bg: #0a0a0f;        /* Fondo principal */
}
```

### Agregar Más Partículas

En `index.html`, cambia el número:

```html
<div v-for="n in 20" :key="n" class="particle"></div>
<!-- Cambiar 20 por el número deseado -->
```

### Modificar Sugerencias

En `index.html`, edita las tarjetas de sugerencia:

```html
<div class="suggestion-card" @click="sendSuggestion('Tu consulta aquí')">
    <span class="icon">🔥</span>
    <span>Tu texto aquí</span>
</div>
```

## 🌐 Tecnologías Usadas

- **Vue 3**: Framework JavaScript reactivo
- **Axios**: Cliente HTTP
- **CSS3**: Animaciones y efectos
- **HTML5**: Estructura semántica

## 📦 Sin Dependencias Locales

No requiere instalación de Node.js ni npm. Todo se carga desde CDN:
- Vue 3 desde CDN oficial
- Axios desde CDN oficial

## 🎯 Próximas Mejoras

- [ ] Comando de voz (botón de micrófono)
- [ ] Exportar chat a PDF
- [ ] Temas personalizables
- [ ] Historial de conversaciones
- [ ] Markdown completo en mensajes
- [ ] Adjuntar archivos

## 🐛 Solución de Problemas

### El chat no conecta
- Verifica que el API Gateway esté corriendo en puerto 3000
- Revisa la consola del navegador (F12)
- Verifica CORS en el backend

### Las partículas no se ven
- Verifica que tu navegador soporte CSS animations
- Prueba en Chrome/Firefox/Edge moderno

### El diseño se ve raro
- Limpia la caché del navegador (Ctrl+F5)
- Verifica que todos los archivos (HTML, CSS, JS) estén presentes

---

**¡Disfruta tu chat con efectos neón! ✨🎨**
