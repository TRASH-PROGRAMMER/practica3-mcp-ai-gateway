import { buscarProductoTool } from './buscar-producto.tool';
import { validarPrescripcionTool } from './validar-prescripcion.tool';
import { crearComparacionTool } from './crear-comparacion.tool';

/**
 * Registro centralizado de todas las Tools disponibles
 * Facilita la exposición de herramientas al API Gateway
 */
export interface Tool {
  name: string;
  description: string;
  inputSchema: any;
  execute: (params: any) => Promise<any>;
}

export const toolRegistry: Tool[] = [
  buscarProductoTool,
  validarPrescripcionTool,
  crearComparacionTool,
];

/**
 * Obtener una tool por su nombre
 */
export function getToolByName(name: string): Tool | undefined {
  return toolRegistry.find((tool) => tool.name === name);
}

/**
 * Listar todas las tools disponibles (sin la función execute)
 * Útil para enviar al modelo de IA
 */
export function listToolsForAI() {
  return toolRegistry.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}
