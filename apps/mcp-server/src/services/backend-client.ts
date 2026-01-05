import axios, { AxiosInstance } from 'axios';

/**
 * Cliente HTTP para comunicarse con el Backend (Puerto 3002)
 * Conecta el MCP Server con los microservicios existentes
 */
export class BackendClient {
  private client: AxiosInstance;

  constructor(baseURL: string = process.env.BACKEND_URL || 'http://localhost:3002') {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Buscar productos por nombre o principio activo
   */
  async buscarProductos(query: string): Promise<any[]> {
    try {
      const response = await this.client.get('/productos', {
        params: { search: query },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Error al buscar productos: ${error.message}`);
    }
  }

  /**
   * Obtener un producto específico por ID
   */
  async obtenerProductoPorId(id: number): Promise<any> {
    try {
      const response = await this.client.get(`/productos/${id}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Error al obtener producto: ${error.message}`);
    }
  }

  /**
   * Validar si una prescripción está activa
   */
  async validarPrescripcion(idPrescripcion: number): Promise<{ valida: boolean; mensaje: string }> {
    try {
      const response = await this.client.get(`/prescripciones/${idPrescripcion}`);
      const prescripcion = response.data;

      if (prescripcion.estado !== 'activa') {
        return {
          valida: false,
          mensaje: `La prescripción está en estado: ${prescripcion.estado}`,
        };
      }

      return {
        valida: true,
        mensaje: 'Prescripción válida y activa',
      };
    } catch (error: any) {
      return {
        valida: false,
        mensaje: `Error al validar prescripción: ${error.message}`,
      };
    }
  }

  /**
   * Crear una comparación entre productos
   */
  async crearComparacion(datos: {
    idProducto1: number;
    idProducto2: number;
    criterio: string;
  }): Promise<any> {
    try {
      const response = await this.client.post('/comparaciones', datos);
      return response.data;
    } catch (error: any) {
      throw new Error(`Error al crear comparación: ${error.message}`);
    }
  }

  /**
   * Obtener todas las prescripciones activas
   */
  async obtenerPrescripcionesActivas(): Promise<any[]> {
    try {
      const response = await this.client.get('/prescripciones', {
        params: { estado: 'activa' },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Error al obtener prescripciones: ${error.message}`);
    }
  }
}
