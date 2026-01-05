import { BackendClient } from '../services/backend-client';

/**
 * Tool: Buscar Producto
 * Permite buscar productos por nombre genérico, comercial o principio activo
 */
export const buscarProductoTool = {
  name: 'buscar_producto',
  description: 'Busca medicamentos en el inventario por nombre genérico, comercial o principio activo',
  
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Texto a buscar (nombre del producto o principio activo)',
      },
    },
    required: ['query'],
  },

  async execute(params: { query: string }): Promise<any> {
    const client = new BackendClient();
    
    try {
      const productos = await client.buscarProductos(params.query);
      
      if (productos.length === 0) {
        return {
          success: false,
          message: `No se encontraron productos con el término: "${params.query}"`,
          data: [],
        };
      }

      return {
        success: true,
        message: `Se encontraron ${productos.length} producto(s)`,
        data: productos.map((p: any) => ({
          id: p.id_producto,
          nombreGenerico: p.nombre_generico,
          nombreComercial: p.nombre_comercial,
          principioActivo: p.principio_activo,
          categoria: p.categoria,
          presentacion: p.presentacion,
          requiereReceta: p.requiere_receta,
        })),
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        data: [],
      };
    }
  },
};
