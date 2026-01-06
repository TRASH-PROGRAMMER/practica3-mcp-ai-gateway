import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

/**
 * Cliente HTTP para comunicarse con el Backend (comparador-service)
 * Abstrae las llamadas REST a los microservicios
 */
export class BackendClient {
  private client: AxiosInstance;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptor para logging
    this.client.interceptors.request.use((config) => {
      logger.info(`🔹 Request: ${config.method?.toUpperCase()} ${config.url}`, {
        data: config.data,
      });
      return config;
    });

    this.client.interceptors.response.use(
      (response) => {
        logger.info(`✅ Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error(`❌ Error: ${error.message}`, {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
        });
        throw error;
      }
    );
  }

  /**
   * Buscar productos por nombre o código
   */
  async buscarProductos(query: string): Promise<any[]> {
    try {
      const { data } = await this.client.get('/productos', {
        params: { search: query },
      });
      return Array.isArray(data) ? data : [data];
    } catch (error: any) {
      if (error.response?.status === 404) return [];
      throw new Error(`Error buscando productos: ${error.message}`);
    }
  }

  /**
   * Obtener producto específico por ID
   */
  async obtenerProducto(id: number): Promise<any> {
    const { data } = await this.client.get(`/productos/${id}`);
    return data;
  }

  /**
   * Validar stock disponible de un producto
   */
  async validarStock(productoId: number, cantidadRequerida: number): Promise<boolean> {
    try {
      const producto = await this.obtenerProducto(productoId);
      return producto.stock >= cantidadRequerida;
    } catch (error: any) {
      throw new Error(`Error validando stock: ${error.message}`);
    }
  }

  /**
   * Buscar prescripciones médicas
   */
  async buscarPrescripciones(filtros?: any): Promise<any[]> {
    const { data } = await this.client.get('/prescripciones', { params: filtros });
    return Array.isArray(data) ? data : [data];
  }

  /**
   * Crear una comparación de precios
   */
  async crearComparacion(prescripcionId: number): Promise<any> {
    const { data } = await this.client.post('/comparador/comparar', {
      prescripcionId,
    });
    return data;
  }

  /**
   * Obtener comparaciones existentes
   */
  async obtenerComparaciones(prescripcionId?: number): Promise<any[]> {
    const params = prescripcionId ? { prescripcionId } : {};
    const { data } = await this.client.get('/comparador/comparaciones', { params });
    return Array.isArray(data) ? data : [data];
  }
}
