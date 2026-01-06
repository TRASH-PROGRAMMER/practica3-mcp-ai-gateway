#!/bin/bash

echo "🚀 Instalando Taller 3 - Sistema MCP + IA"
echo ""

# Verificar Node.js
echo "Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js no está instalado"
    echo "Instalar desde: https://nodejs.org"
    exit 1
fi
echo "✅ Node.js: $(node --version)"

# Instalar MCP Server
echo ""
echo "📦 Instalando MCP Server..."
cd apps/mcp-server
npm install
if [ $? -ne 0 ]; then
    echo "❌ Error instalando MCP Server"
    exit 1
fi
echo "✅ MCP Server instalado"

# Copiar .env de ejemplo
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ Archivo .env creado"
fi

cd ../..

# Instalar API Gateway
echo ""
echo "📦 Instalando API Gateway..."
cd apps/api-gateway
npm install
if [ $? -ne 0 ]; then
    echo "❌ Error instalando API Gateway"
    exit 1
fi
echo "✅ API Gateway instalado"

# Copiar .env de ejemplo
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ Archivo .env creado"
    echo ""
    echo "⚠️  IMPORTANTE: Edita apps/api-gateway/.env y configura GEMINI_API_KEY"
    echo "   Obtén tu API Key en: https://aistudio.google.com"
fi

cd ../..

echo ""
echo "✅ Instalación completada!"
echo ""
echo "📋 Próximos pasos:"
echo "1. Configura GEMINI_API_KEY en apps/api-gateway/.env"
echo "2. Inicia el backend: cd Practica_gateway/gateway/comparador-service && npm run start:dev"
echo "3. Inicia MCP Server: cd apps/mcp-server && npm run dev"
echo "4. Inicia API Gateway: cd apps/api-gateway && npm run start:dev"
echo ""
echo "📚 Ver README_TALLER_3_MCP.md para más información"
