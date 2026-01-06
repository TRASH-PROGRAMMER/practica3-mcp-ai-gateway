# Script de Prueba Rápida - Taller 3 MCP

Write-Host "🧪 Iniciando pruebas del sistema MCP..." -ForegroundColor Cyan
Write-Host ""

# Verificar que los servidores estén corriendo
Write-Host "1️⃣  Verificando servicios..." -ForegroundColor Yellow

# Backend (3002)
try {
    $backend = Invoke-RestMethod -Uri "http://localhost:3002" -Method Get -ErrorAction Stop
    Write-Host "  ✅ Backend (3002): OK" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Backend (3002): NO RESPONDE" -ForegroundColor Red
    Write-Host "     Ejecuta: cd Practica_gateway/gateway/comparador-service && npm run start:dev" -ForegroundColor Gray
}

# MCP Server (3001)
try {
    $mcp = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method Get -ErrorAction Stop
    Write-Host "  ✅ MCP Server (3001): OK" -ForegroundColor Green
} catch {
    Write-Host "  ❌ MCP Server (3001): NO RESPONDE" -ForegroundColor Red
    Write-Host "     Ejecuta: cd apps/mcp-server && npm run dev" -ForegroundColor Gray
}

# API Gateway (3000)
try {
    $gateway = Invoke-RestMethod -Uri "http://localhost:3000/productos/health" -Method Get -ErrorAction Stop
    Write-Host "  ✅ API Gateway (3000): OK" -ForegroundColor Green
} catch {
    Write-Host "  ❌ API Gateway (3000): NO RESPONDE" -ForegroundColor Red
    Write-Host "     Ejecuta: cd apps/api-gateway && npm run start:dev" -ForegroundColor Gray
}

Write-Host ""
Write-Host "2️⃣  Probando Tools del MCP Server..." -ForegroundColor Yellow

# Listar tools
$toolsBody = @{
    jsonrpc = "2.0"
    method = "tools/list"
    id = 1
} | ConvertTo-Json

try {
    $toolsResponse = Invoke-RestMethod -Uri "http://localhost:3001/rpc" -Method Post -Body $toolsBody -ContentType "application/json"
    $toolCount = $toolsResponse.result.tools.Count
    Write-Host "  ✅ Tools disponibles: $toolCount" -ForegroundColor Green
    
    foreach ($tool in $toolsResponse.result.tools) {
        Write-Host "     - $($tool.name): $($tool.description)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ❌ Error listando tools" -ForegroundColor Red
}

Write-Host ""
Write-Host "3️⃣  Probando API Gateway con IA..." -ForegroundColor Yellow

# Test de búsqueda
$chatBody = @{
    message = "Busca productos con ibuprofeno"
} | ConvertTo-Json

try {
    $chatResponse = Invoke-RestMethod -Uri "http://localhost:3000/productos/chat" -Method Post -Body $chatBody -ContentType "application/json"
    
    if ($chatResponse.success) {
        Write-Host "  ✅ Chat IA funcionando correctamente" -ForegroundColor Green
        Write-Host "     Tools ejecutados: $($chatResponse.toolsExecuted.Count)" -ForegroundColor Gray
        
        foreach ($tool in $chatResponse.toolsExecuted) {
            Write-Host "     - $($tool.name) → $($tool.result.message)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ⚠️  Chat respondió con error: $($chatResponse.message)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ❌ Error en chat IA" -ForegroundColor Red
    Write-Host "     Verifica que GEMINI_API_KEY esté configurada en apps/api-gateway/.env" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Pruebas completadas!" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Para más pruebas, importa la colección:" -ForegroundColor White
Write-Host "   apps/Taller3-MCP-Tests.postman_collection.json" -ForegroundColor Gray
Write-Host ""
