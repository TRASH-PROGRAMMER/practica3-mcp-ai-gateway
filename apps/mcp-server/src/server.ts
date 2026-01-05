import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getToolByName, listToolsForAI } from './tools/registry';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

/**
 * JSON-RPC 2.0 Request Interface
 */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id?: string | number;
}

/**
 * JSON-RPC 2.0 Response Interface
 */
interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number | null;
}

/**
 * Endpoint principal JSON-RPC 2.0
 * Implementa el protocolo MCP
 */
app.post('/rpc', async (req: Request, res: Response) => {
  const request: JsonRpcRequest = req.body;

  // Validar estructura JSON-RPC
  if (request.jsonrpc !== '2.0') {
    return res.json({
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message: 'Invalid Request: jsonrpc debe ser "2.0"',
      },
      id: null,
    });
  }

  try {
    switch (request.method) {
      case 'tools/list': {
        // Listar todas las tools disponibles
        const tools = listToolsForAI();
        return res.json({
          jsonrpc: '2.0',
          result: { tools },
          id: request.id,
        } as JsonRpcResponse);
      }

      case 'tools/execute': {
        // Ejecutar una tool específica
        const { name, params } = request.params || {};

        if (!name) {
          return res.json({
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Invalid params: "name" es requerido',
            },
            id: request.id,
          } as JsonRpcResponse);
        }

        const tool = getToolByName(name);

        if (!tool) {
          return res.json({
            jsonrpc: '2.0',
            error: {
              code: -32601,
              message: `Method not found: Tool "${name}" no existe`,
            },
            id: request.id,
          } as JsonRpcResponse);
        }

        // Ejecutar la tool
        const result = await tool.execute(params);

        return res.json({
          jsonrpc: '2.0',
          result,
          id: request.id,
        } as JsonRpcResponse);
      }

      default: {
        return res.json({
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: `Method not found: "${request.method}"`,
          },
          id: request.id,
        } as JsonRpcResponse);
      }
    }
  } catch (error: any) {
    console.error('Error procesando RPC:', error);
    return res.json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error',
        data: error.message,
      },
      id: request.id,
    } as JsonRpcResponse);
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'MCP Server',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Root endpoint con información del servidor
 */
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'MCP Server - Sistema de Productos',
    version: '1.0.0',
    protocol: 'JSON-RPC 2.0',
    endpoints: {
      rpc: 'POST /rpc',
      health: 'GET /health',
    },
    tools: listToolsForAI(),
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 MCP Server corriendo en http://localhost:${PORT}`);
  console.log(`📋 Tools disponibles: ${listToolsForAI().length}`);
  console.log(`🔗 Endpoint RPC: http://localhost:${PORT}/rpc`);
});
