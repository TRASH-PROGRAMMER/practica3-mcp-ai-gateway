import { BackendClient } from '../services/backend-client';

/**
 * Tool: Crear Comparación
 * Crea una comparación entre dos productos para análisis
 */
export const crearComparacionTool = {
  name: 'crear_comparacion',
  description: 'Crea una comparación entre dos medicamentos basándose en un criterio específico (precio, efectividad, efectos secundarios)',
  
  inputSchema: {
    type: 'object',
    properties: {
      idProducto1: {
        type: 'number',
        description: 'ID del primer producto a comparar',
      },
      idProducto2: {
        type: 'number',
        description: 'ID del segundo producto a comparar',
      },
      criterio: {
        type: 'string',
        enum: ['precio', 'efectividad', 'efectos_secundarios', 'disponibilidad'],
        description: 'Criterio de comparación entre los productos',
      },
    },
    required: ['idProducto1', 'idProducto2', 'criterio'],
  },

  async execute(params: {
    idProducto1: number;
    idProducto2: number;
    criterio: string;
  }): Promise<any> {
    const client = new BackendClient();
    
    try {
      // Obtener información de ambos productos
      const producto1 = await client.obtenerProductoPorId(params.idProducto1);
      const producto2 = await client.obtenerProductoPorId(params.idProducto2);

      // Crear la comparación en el backend
      const comparacion = await client.crearComparacion({
        idProducto1: params.idProducto1,
        idProducto2: params.idProducto2,
        criterio: params.criterio,
      });

      return {
        success: true,
        message: `Comparación creada exitosamente usando criterio: ${params.criterio}`,
        data: {
          idComparacion: comparacion.id,
          producto1: {
            id: producto1.id_producto,
            nombre: producto1.nombre_generico,
          },
          producto2: {
            id: producto2.id_producto,
            nombre: producto2.nombre_generico,
          },
          criterio: params.criterio,
          resultado: comparacion.resultado,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  },
};
