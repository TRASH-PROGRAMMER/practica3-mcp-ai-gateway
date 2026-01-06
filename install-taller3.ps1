# Script de Instalación Rápida - Taller 3 MCP

Write-Host "🚀 Instalando Taller 3 - Sistema MCP + IA" -ForegroundColor Cyan
Write-Host ""

# Verificar Node.js
Write-Host "Verificando Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: Node.js no está instalado" -ForegroundColor Red
    Write-Host "Instalar desde: https://nodejs.org" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green

# Instalar MCP Server
Write-Host ""
Write-Host "📦 Instalando MCP Server..." -ForegroundColor Yellow
Set-Location "apps\mcp-server"
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error instalando MCP Server" -ForegroundColor Red
    exit 1
}
Write-Host "✅ MCP Server instalado" -ForegroundColor Green

# Copiar .env de ejemplo
if (!(Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "✅ Archivo .env creado" -ForegroundColor Green
}

Set-Location "..\..\"

# Instalar API Gateway
Write-Host ""
Write-Host "📦 Instalando API Gateway..." -ForegroundColor Yellow
Set-Location "apps\api-gateway"
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error instalando API Gateway" -ForegroundColor Red
    exit 1
}
Write-Host "✅ API Gateway instalado" -ForegroundColor Green

# Copiar .env de ejemplo
if (!(Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "✅ Archivo .env creado" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  IMPORTANTE: Edita apps\api-gateway\.env y configura GEMINI_API_KEY" -ForegroundColor Yellow
    Write-Host "   Obtén tu API Key en: https://aistudio.google.com" -ForegroundColor Cyan
}

Set-Location "..\..\"

Write-Host ""
Write-Host "✅ Instalación completada!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Próximos pasos:" -ForegroundColor Cyan
Write-Host "1. Configura GEMINI_API_KEY en apps\api-gateway\.env" -ForegroundColor White
Write-Host "2. Inicia el backend: cd Practica_gateway\gateway\comparador-service && npm run start:dev" -ForegroundColor White
Write-Host "3. Inicia MCP Server: cd apps\mcp-server && npm run dev" -ForegroundColor White
Write-Host "4. Inicia API Gateway: cd apps\api-gateway && npm run start:dev" -ForegroundColor White
Write-Host ""
Write-Host "📚 Ver README_TALLER_3_MCP.md para más información" -ForegroundColor Cyan
