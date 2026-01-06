import { ToolDefinition } from './types';
import { buscarProductoTool } from './buscar-producto.tool';
import { validarStockTool } from './validar-stock.tool';
import { crearComparacionTool } from './crear-comparacion.tool';

/**
 * Registro centralizado de todos los Tools disponibles
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  /**
   * Registra los tools por defecto del sistema
   */
  private registerDefaultTools() {
    this.register(buscarProductoTool);
    this.register(validarStockTool);
    this.register(crearComparacionTool);
  }

  /**
   * Registra un nuevo tool
   */
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' ya está registrado`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Obtiene un tool por nombre
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Lista todos los tools disponibles
   */
  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Obtiene los metadatos de todos los tools (para enviar a Gemini)
   */
  getToolsMetadata(): any[] {
    return this.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    }));
  }

  /**
   * Verifica si existe un tool
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }
}
