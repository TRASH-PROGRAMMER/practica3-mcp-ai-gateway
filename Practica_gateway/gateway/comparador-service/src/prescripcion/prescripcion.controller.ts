import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, EventPattern, Ctx, RmqContext } from '@nestjs/microservices';
import { PrescripcionService } from './prescripcion.service';
import { RegistrarPrescripcionDto } from './dto/registrar-prescripcion.dto';

@Controller()
export class PrescripcionController {
  constructor(private readonly prescripcionService: PrescripcionService) {}

  /**
   * COMANDO: Registrar una nueva prescripción médica
   */
  @MessagePattern({ cmd: 'registrar_prescripcion' })
  async registrarPrescripcion(
    @Payload() dto: RegistrarPrescripcionDto,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      const result = await this.prescripcionService.registrarPrescripcion(dto);
      
      // ACK manual después de procesamiento exitoso
      channel.ack(originalMsg);
      
      return result;
    } catch (error) {
      // NACK sin requeue si es error de negocio
      channel.nack(originalMsg, false, false);
      throw error;
    }
  }

  /**
   * EVENTO: Escucha cuando se registra una prescripción (para auditoría)
   */
  @EventPattern('prescripcion.registrada')
  async onPrescripcionRegistrada(@Payload() data: any) {
    console.log('📋 [EVENTO] prescripcion.registrada recibido:', {
      id_prescripcion: data.id_prescripcion,
      paciente: data.nombre_paciente,
      medicamentos: data.medicamentos.length,
    });
    
    // Aquí podrían agregarse acciones como:
    // - Enviar notificación al paciente
    // - Alertas a la farmacia
    // - Registro en sistema de auditoría
  }
}
