import { Controller, Post, Body, Get, Logger } from '@nestjs/common';
import { GeminiService } from '../gemini/gemini.service';
import { McpClientService } from '../mcp-client/mcp-client.service';
import { QueryDto } from './dto/query.dto';

@Controller('ia')
export class IaController {
  private readonly logger = new Logger(IaController.name);

  constructor(
    private readonly geminiService: GeminiService,
    private readonly mcpClient: McpClientService,
  ) {}

  /**
   * Endpoint principal: Procesar consulta con IA
   * POST /ia/query
   */
  @Post('query')
  async processQuery(@Body() queryDto: QueryDto) {
    try {
      this.logger.log(`📨 Nueva consulta: "${queryDto.message.substring(0, 50)}..."`);
      
      const result = await this.geminiService.processQuery(queryDto.message);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        query: queryDto.message,
        response: result.message,
        metadata: {
          toolsExecuted: result.toolsExecuted,
          iterations: result.iterations,
        },
      };
    } catch (error: any) {
      this.logger.error(`❌ Error procesando consulta: ${error.message}`);
      
      return {
        success: false,
        timestamp: new Date().toISOString(),
        query: queryDto.message,
        error: error.message,
      };
    }
  }

  /**
   * Listar tools disponibles
   * GET /ia/tools
   */
  @Get('tools')
  async listTools() {
    try {
      const tools = await this.mcpClient.listTools();
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        tools,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error obteniendo tools: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Health check del sistema completo
   * GET /ia/health
   */
  @Get('health')
  async health() {
    try {
      const mcpHealth = await this.mcpClient.healthCheck();
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        gateway: 'healthy',
        mcpServer: mcpHealth,
      };
    } catch (error: any) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        gateway: 'healthy',
        mcpServer: 'unreachable',
        error: error.message,
      };
    }
  }
}
