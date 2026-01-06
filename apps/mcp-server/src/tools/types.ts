import { BackendClient } from '../services/backend-client';

/**
 * Definición de un Tool en MCP
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
  execute: (params: any, context: ToolExecutionContext) => Promise<ToolExecutionResult>;
}

/**
 * Contexto de ejecución de un tool
 */
export interface ToolExecutionContext {
  backendClient: BackendClient;
  requestId?: string;
}

/**
 * Resultado de ejecución de un tool
 */
export interface ToolExecutionResult {
  success: boolean;
  message: string;
  data: any;
}

/**
 * Mensaje JSON-RPC 2.0
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id?: string | number;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number | null;
}
