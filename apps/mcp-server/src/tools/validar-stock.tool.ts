import { BackendClient } from '../services/backend-client';
import { ToolDefinition, ToolExecutionContext } from './types';

/**
 * Tool 2: Validar Stock
 * Verifica si hay stock disponible de un producto para una cantidad específica
 */
export const validarStockTool: ToolDefinition = {
  name: 'validar_stock',
  description: 'Valida si un producto tiene suficiente stock disponible para una cantidad requerida',
  inputSchema: {
    type: 'object',
    properties: {
      productoId: {
        type: 'number',
        description: 'ID del producto a validar',
      },
      cantidad: {
        type: 'number',
        description: 'Cantidad requerida del producto',
        minimum: 1,
      },
    },
    required: ['productoId', 'cantidad'],
  },

  async execute(params: any, context: ToolExecutionContext) {
    const { productoId, cantidad } = params;
    const backendClient = context.backendClient as BackendClient;

    try {
      const producto = await backendClient.obtenerProducto(productoId);
      const stockDisponible = producto.stock >= cantidad;

      return {
        success: true,
        message: stockDisponible
          ? `✅ Stock disponible: ${producto.stock} unidades`
          : `❌ Stock insuficiente: ${producto.stock} disponibles, se requieren ${cantidad}`,
        data: {
          productoId: producto.id,
          nombre: producto.nombre,
          stockActual: producto.stock,
          cantidadRequerida: cantidad,
          disponible: stockDisponible,
          faltante: stockDisponible ? 0 : cantidad - producto.stock,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error al validar stock: ${error.message}`,
        data: null,
      };
    }
  },
};
