import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { McpClientService } from '../mcp-client/mcp-client.service';

/**
 * Servicio para interactuar con Gemini AI y coordinar la ejecución de Tools
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(
    private configService: ConfigService,
    private mcpClient: McpClientService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    const modelName = this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.0-flash-exp';

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY no configurada');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.logger.log(`🤖 Gemini AI inicializado: ${modelName}`);
  }

  /**
   * Procesa una consulta del usuario usando IA + MCP Tools
   */
  async processQuery(userMessage: string): Promise<any> {
    this.logger.log(`📩 Consulta recibida: "${userMessage.substring(0, 100)}..."`);

    // 1. Obtener tools disponibles del MCP Server
    const mcpTools = await this.mcpClient.listTools();
    this.logger.log(`📦 Tools disponibles: ${mcpTools.length}`);

    // 2. Convertir tools de MCP a formato Gemini
    const geminiTools = this.convertMcpToolsToGemini(mcpTools);

    // 3. Configurar el modelo
    this.model = this.genAI.getGenerativeModel({
      model: this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.0-flash-exp',
    });

    // 4. Iniciar chat con contexto y tools
    const chat = this.model.startChat({
      tools: [{ functionDeclarations: geminiTools }],
      history: [
        {
          role: 'user',
          parts: [{
            text: `Eres un asistente inteligente para un sistema de comparación de productos farmacéuticos.
            
Puedes ayudar a:
- Buscar productos médicos por nombre o principio activo
- Validar disponibilidad de stock
- Crear comparaciones de precios para prescripciones médicas

Responde de forma clara y profesional. Usa los tools disponibles para obtener información actualizada.`
          }]
        },
        {
          role: 'model',
          parts: [{ text: 'Entendido. Estoy listo para ayudarte con el sistema farmacéutico.' }]
        }
      ],
    });

    // 5. Enviar mensaje del usuario
    let result = await chat.sendMessage(userMessage);
    let response = result.response;

    // 6. Manejar function calls iterativamente
    const executedTools: any[] = [];
    let iterations = 0;
    const MAX_ITERATIONS = 5;

    while (response.functionCalls() && iterations < MAX_ITERATIONS) {
      iterations++;
      this.logger.log(`🔄 Iteración ${iterations}: Gemini solicita ejecutar tools`);

      const functionCalls = response.functionCalls();
      const functionResponses = [];

      for (const call of functionCalls) {
        this.logger.log(`🔧 Ejecutando: ${call.name}`);

        try {
          // Ejecutar tool via MCP
          const toolResult = await this.mcpClient.callTool(call.name, call.args);

          executedTools.push({
            name: call.name,
            args: call.args,
            result: toolResult,
          });

          // Formato correcto para Gemini 2.5 API
          functionResponses.push({
            functionResponse: {
              name: call.name,
              response: toolResult,
            },
          });

          this.logger.log(`✅ Tool ${call.name} ejecutado exitosamente`);
        } catch (error: any) {
          this.logger.error(`❌ Error ejecutando ${call.name}: ${error.message}`);
          
          // Formato correcto para Gemini 2.5 API
          functionResponses.push({
            functionResponse: {
              name: call.name,
              response: {
                success: false,
                message: `Error: ${error.message}`,
                data: null,
              },
            },
          });
        }
      }

      // Enviar resultados de vuelta a Gemini
      result = await chat.sendMessage(functionResponses);
      response = result.response;
    }

    // 7. Obtener respuesta final
    const finalText = response.text();

    return {
      message: finalText,
      toolsExecuted: executedTools.map(t => ({
        name: t.name,
        args: t.args,
        success: t.result.success,
      })),
      iterations,
    };
  }

  /**
   * Convierte los tools de MCP al formato de Gemini Function Calling
   */
  private convertMcpToolsToGemini(mcpTools: any[]): any[] {
    return mcpTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.parameters.properties,
        required: tool.parameters.required,
      },
    }));
  }
}
