import { BackendClient } from '../services/backend-client';
import { ToolDefinition, ToolExecutionContext } from './types';

/**
 * Tool 1: Buscar Productos
 * Permite buscar productos médicos por nombre, código o principio activo
 */
export const buscarProductoTool: ToolDefinition = {
  name: 'buscar_producto',
  description: 'Busca productos farmacéuticos por nombre, código o principio activo en la base de datos',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Término de búsqueda: nombre del producto, código o principio activo',
      },
    },
    required: ['query'],
  },

  async execute(params: any, context: ToolExecutionContext) {
    const { query } = params;
    const backendClient = context.backendClient as BackendClient;

    try {
      const productos = await backendClient.buscarProductos(query);

      if (productos.length === 0) {
        return {
          success: true,
          message: `No se encontraron productos con el término: "${query}"`,
          data: [],
        };
      }

      return {
        success: true,
        message: `Se encontraron ${productos.length} producto(s)`,
        data: productos.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          codigo: p.codigo,
          principioActivo: p.principioActivo,
          precio: p.precio,
          stock: p.stock,
          laboratorio: p.laboratorio,
        })),
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error al buscar productos: ${error.message}`,
        data: null,
      };
    }
  },
};
