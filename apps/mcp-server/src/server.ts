import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ToolRegistry } from './tools/registry';
import { BackendClient } from './services/backend-client';
import { JsonRpcRequest, JsonRpcResponse } from './tools/types';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3003';

// Middleware
app.use(cors());
app.use(express.json());

// Inicializar servicios
const toolRegistry = new ToolRegistry();
const backendClient = new BackendClient(BACKEND_URL);

/**
 * Endpoint principal JSON-RPC 2.0
 */
app.post('/rpc', async (req: Request, res: Response) => {
  const request: JsonRpcRequest = req.body;

  // Validación básica JSON-RPC 2.0
  if (request.jsonrpc !== '2.0') {
    return res.json(createErrorResponse(null, -32600, 'Invalid Request: jsonrpc debe ser "2.0"'));
  }

  try {
    const response = await handleJsonRpcMethod(request);
    res.json(response);
  } catch (error: any) {
    logger.error('Error procesando JSON-RPC', { error: error.message, request });
    res.json(createErrorResponse(request.id || null, -32603, 'Internal error', error.message));
  }
});

/**
 * Maneja los métodos JSON-RPC
 */
async function handleJsonRpcMethod(request: JsonRpcRequest): Promise<JsonRpcResponse> {
  const { method, params, id } = request;

  switch (method) {
    case 'tools/list':
      return createSuccessResponse(id, {
        tools: toolRegistry.getToolsMetadata(),
      });

    case 'tools/call':
      return await executeToolCall(params, id);

    case 'health':
      return createSuccessResponse(id, {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        tools: toolRegistry.list().length,
      });

    default:
      return createErrorResponse(id, -32601, `Method not found: ${method}`);
  }
}

/**
 * Ejecuta la llamada a un tool específico
 */
async function executeToolCall(params: any, id: any): Promise<JsonRpcResponse> {
  const { name, arguments: toolArgs } = params;

  if (!name) {
    return createErrorResponse(id, -32602, 'Invalid params: falta el campo "name"');
  }

  const tool = toolRegistry.get(name);
  if (!tool) {
    return createErrorResponse(id, -32601, `Tool no encontrado: ${name}`);
  }

  try {
    logger.info(`🔧 Ejecutando tool: ${name}`, { arguments: toolArgs });

    const result = await tool.execute(toolArgs, {
      backendClient,
      requestId: String(id),
    });

    logger.info(`✅ Tool ejecutado: ${name}`, { result });

    return createSuccessResponse(id, result);
  } catch (error: any) {
    logger.error(`❌ Error ejecutando tool: ${name}`, { error: error.message });
    return createErrorResponse(id, -32000, `Error en tool ${name}`, error.message);
  }
}

/**
 * Crea una respuesta exitosa JSON-RPC
 */
function createSuccessResponse(id: any, result: any): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    result,
    id: id ?? null,
  };
}

/**
 * Crea una respuesta de error JSON-RPC
 */
function createErrorResponse(id: any, code: number, message: string, data?: any): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    error: {
      code,
      message,
      data,
    },
    id: id ?? null,
  };
}

/**
 * Endpoint de salud
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    tools: toolRegistry.list().map((t) => t.name),
  });
});

/**
 * Inicia el servidor
 */
app.listen(PORT, () => {
  logger.info(`🚀 MCP Server iniciado en http://localhost:${PORT}`);
  logger.info(`📦 Tools registrados: ${toolRegistry.list().map((t) => t.name).join(', ')}`);
  logger.info(`🔗 Backend URL: ${BACKEND_URL}`);
});

export { app, toolRegistry };
