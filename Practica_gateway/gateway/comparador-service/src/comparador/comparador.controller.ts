import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, EventPattern } from '@nestjs/microservices';
import { ComparadorService } from './comparador.service';

@Controller()
export class ComparadorController {
  constructor(private readonly comparadorService: ComparadorService) {}

  @MessagePattern('buscar_productos')
  buscarProductos(@Payload() term: string) {
    return this.comparadorService.buscarProductos(term || '');
  }

  @MessagePattern('comparar_precios')
  compararPrecios(@Payload() data: { idProducto: number; idUsuario?: number }) {
    return this.comparadorService.compararPrecios(data.idProducto, data.idUsuario);
  }

  /**
   * EVENTO: Escucha cuando se realiza una comparación (para analytics)
   */
  @EventPattern('comparacion.realizada')
  async onComparacionRealizada(@Payload() data: any) {
    console.log('📊 [EVENTO] comparacion.realizada recibido:', {
      id_comparacion: data.id_comparacion,
      producto: data.nombre_producto,
      ahorro: data.ahorro_potencial,
    });
    
    // Aquí podrían agregarse acciones como:
    // - Actualizar estadísticas de productos más buscados
    // - Enviar recomendaciones personalizadas
    // - Alertas de precios favorables
  }
}
