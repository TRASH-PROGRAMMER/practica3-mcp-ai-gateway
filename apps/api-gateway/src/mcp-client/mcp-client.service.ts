import axios, { AxiosInstance } from 'axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id: string | number;
}

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
 * Cliente para comunicarse con el MCP Server via JSON-RPC 2.0
 */
@Injectable()
export class McpClientService {
  private readonly logger = new Logger(McpClientService.name);
  private client: AxiosInstance;
  private requestId = 0;

  constructor(private configService: ConfigService) {
    const mcpServerUrl = this.configService.get<string>('MCP_SERVER_URL');
    
    this.client = axios.create({
      baseURL: mcpServerUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.logger.log(`🔗 MCP Client configurado: ${mcpServerUrl}`);
  }

  /**
   * Lista todos los tools disponibles en el MCP Server
   */
  async listTools(): Promise<any[]> {
    const response = await this.sendRequest('tools/list');
    return response.tools || [];
  }

  /**
   * Ejecuta un tool específico
   */
  async callTool(toolName: string, args: any): Promise<any> {
    this.logger.log(`🔧 Llamando tool: ${toolName}`);
    this.logger.debug(`Argumentos: ${JSON.stringify(args)}`);

    const response = await this.sendRequest('tools/call', {
      name: toolName,
      arguments: args,
    });

    this.logger.log(`✅ Tool ${toolName} ejecutado`);
    return response;
  }

  /**
   * Verifica el estado del MCP Server
   */
  async healthCheck(): Promise<any> {
    const response = await this.sendRequest('health');
    return response;
  }

  /**
   * Envía una petición JSON-RPC 2.0
   */
  private async sendRequest(method: string, params?: any): Promise<any> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: ++this.requestId,
    };

    try {
      const { data } = await this.client.post<JsonRpcResponse>('/rpc', request);

      if (data.error) {
        throw new Error(
          `JSON-RPC Error [${data.error.code}]: ${data.error.message}${
            data.error.data ? ` - ${JSON.stringify(data.error.data)}` : ''
          }`
        );
      }

      return data.result;
    } catch (error: any) {
      if (error.response) {
        this.logger.error(`Error HTTP ${error.response.status}: ${error.response.statusText}`);
      }
      throw new Error(`Error comunicándose con MCP Server: ${error.message}`);
    }
  }
}
