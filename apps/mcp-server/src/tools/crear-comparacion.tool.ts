import { BackendClient } from '../services/backend-client';
import { ToolDefinition, ToolExecutionContext } from './types';

/**
 * Tool 3: Crear Comparación
 * Crea una comparación de precios de productos para una prescripción médica
 */
export const crearComparacionTool: ToolDefinition = {
  name: 'crear_comparacion',
  description: 'Crea una comparación de precios entre productos equivalentes para una prescripción médica',
  inputSchema: {
    type: 'object',
    properties: {
      prescripcionId: {
        type: 'number',
        description: 'ID de la prescripción médica a comparar',
      },
    },
    required: ['prescripcionId'],
  },

  async execute(params: any, context: ToolExecutionContext) {
    const { prescripcionId } = params;
    const backendClient = context.backendClient as BackendClient;

    try {
      const comparacion = await backendClient.crearComparacion(prescripcionId);

      return {
        success: true,
        message: `✅ Comparación creada exitosamente`,
        data: {
          comparacionId: comparacion.id,
          prescripcionId: comparacion.prescripcionId,
          fecha: comparacion.fecha,
          totalProductos: comparacion.productos?.length || 0,
          precioTotal: comparacion.precioTotal,
          ahorroPotencial: comparacion.ahorroPotencial,
          mejorOpcion: comparacion.mejorOpcion,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error al crear comparación: ${error.message}`,
        data: null,
      };
    }
  },
};
