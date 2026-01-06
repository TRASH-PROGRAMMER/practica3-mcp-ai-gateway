# Inicio Rápido - Sistema MCP + IA

Write-Host "🚀 Sistema MCP + IA - Inicio Rápido" -ForegroundColor Cyan
Write-Host ""

# Función para verificar si un puerto está en uso
function Test-Port {
    param($port)
    $connection = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue
    return $connection.TcpTestSucceeded
}

# Verificar servicios
Write-Host "Verificando servicios..." -ForegroundColor Yellow

# Backend
if (Test-Port 3003) {
    Write-Host "✅ Backend (puerto 3003): Activo" -ForegroundColor Green
} else {
    Write-Host "❌ Backend (puerto 3003): No encontrado" -ForegroundColor Red
    Write-Host "   Iniciar: cd Practica_gateway\gateway\comparador-service && npm run start:dev" -ForegroundColor Yellow
}

# MCP Server
if (Test-Port 3001) {
    Write-Host "✅ MCP Server (puerto 3001): Activo" -ForegroundColor Green
} else {
    Write-Host "❌ MCP Server (puerto 3001): No encontrado" -ForegroundColor Red
    Write-Host "   Iniciar: cd apps\mcp-server && npm run dev" -ForegroundColor Yellow
}

# API Gateway
if (Test-Port 3000) {
    Write-Host "✅ API Gateway (puerto 3000): Activo" -ForegroundColor Green
} else {
    Write-Host "❌ API Gateway (puerto 3000): No encontrado" -ForegroundColor Red
    Write-Host "   Iniciar: cd apps\api-gateway && npm run start:dev" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📊 Estado del Sistema:" -ForegroundColor Cyan

# Health check
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/ia/health" -Method Get -TimeoutSec 5
    if ($response.success) {
        Write-Host "✅ Sistema operativo" -ForegroundColor Green
        Write-Host "   Gateway: $($response.gateway)" -ForegroundColor White
        Write-Host "   MCP Server: $($response.mcpServer.status)" -ForegroundColor White
        Write-Host "   Tools disponibles: $($response.mcpServer.tools)" -ForegroundColor White
    }
} catch {
    Write-Host "⚠️  No se pudo conectar con el sistema" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📚 Endpoints disponibles:" -ForegroundColor Cyan
Write-Host "   POST http://localhost:3000/ia/query    - Consultar con IA" -ForegroundColor White
Write-Host "   GET  http://localhost:3000/ia/tools    - Listar tools" -ForegroundColor White
Write-Host "   GET  http://localhost:3000/ia/health   - Health check" -ForegroundColor White

Write-Host ""
Write-Host "🧪 Prueba rápida:" -ForegroundColor Cyan
Write-Host '   Invoke-RestMethod -Uri "http://localhost:3000/ia/query" -Method Post -ContentType "application/json" -Body ''{"message":"Busca paracetamol"}''' -ForegroundColor White

Write-Host ""
