#!/bin/bash

echo "🚀 Sistema MCP + IA - Inicio Rápido"
echo ""

# Función para verificar si un puerto está en uso
check_port() {
    nc -z localhost $1 2>/dev/null
    return $?
}

# Verificar servicios
echo "Verificando servicios..."

# Backend
if check_port 3003; then
    echo "✅ Backend (puerto 3003): Activo"
else
    echo "❌ Backend (puerto 3003): No encontrado"
    echo "   Iniciar: cd Practica_gateway/gateway/comparador-service && npm run start:dev"
fi

# MCP Server
if check_port 3001; then
    echo "✅ MCP Server (puerto 3001): Activo"
else
    echo "❌ MCP Server (puerto 3001): No encontrado"
    echo "   Iniciar: cd apps/mcp-server && npm run dev"
fi

# API Gateway
if check_port 3000; then
    echo "✅ API Gateway (puerto 3000): Activo"
else
    echo "❌ API Gateway (puerto 3000): No encontrado"
    echo "   Iniciar: cd apps/api-gateway && npm run start:dev"
fi

echo ""
echo "📊 Estado del Sistema:"

# Health check
if check_port 3000; then
    response=$(curl -s http://localhost:3000/ia/health)
    echo "$response" | grep -q '"success":true' && echo "✅ Sistema operativo" || echo "⚠️  Sistema con problemas"
else
    echo "⚠️  No se pudo conectar con el sistema"
fi

echo ""
echo "📚 Endpoints disponibles:"
echo "   POST http://localhost:3000/ia/query    - Consultar con IA"
echo "   GET  http://localhost:3000/ia/tools    - Listar tools"
echo "   GET  http://localhost:3000/ia/health   - Health check"

echo ""
echo "🧪 Prueba rápida:"
echo '   curl -X POST http://localhost:3000/ia/query -H "Content-Type: application/json" -d '"'"'{"message":"Busca paracetamol"}'"'"''

echo ""
