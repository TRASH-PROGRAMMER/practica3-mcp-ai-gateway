import { Injectable, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';

/**
 * Evento recibido de RabbitMQ
 */
export interface RabbitMQEvent {
  eventId: string;
  eventType: string;
  timestamp: string;
  payload: any;
  metadata?: {
    correlationId?: string;
    traceId?: string;
    source?: string;
  };
}

/**
 * RabbitMQ Event Listener Service para Gateway/Productos Service
 * 
 * Escucha eventos internos de RabbitMQ relacionados con productos:
 * - Sincronización de datos
 * - Notificaciones de cambios
 * - Eventos de comparaciones realizadas
 * - Logging estructurado de eventos
 */
@Injectable()
export class GatewayRabbitMQListenerService {
  private readonly logger = new Logger(GatewayRabbitMQListenerService.name);

  /**
   * Escucha eventos de comparaciones completadas
   * Pattern: comparacion.completada
   */
  @EventPattern('comparacion.completada')
  async handleComparacionCompletada(
    @Payload() data: RabbitMQEvent,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      this.logger.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Evento recibido: comparacion.completada',
        correlationId: data.metadata?.correlationId,
        eventId: data.eventId,
        metadata: {
          comparacionId: data.payload?.id,
          resultados: data.payload?.resultados?.length || 0,
        },
      }));

      // Procesar evento
      await this.processComparacionCompletada(data);

      // ACK mensaje
      channel.ack(originalMsg);

      this.logger.log(`✅ Comparación completada procesada: ${data.eventId}`);

    } catch (error) {
      this.logger.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Error procesando comparacion.completada',
        correlationId: data.metadata?.correlationId,
        eventId: data.eventId,
        error: {
          message: (error as Error).message,
          stack: (error as Error).stack,
        },
      }));

      // NACK con requeue si es error temporal
      const shouldRequeue = this.shouldRequeue(error as Error, originalMsg);
      channel.nack(originalMsg, false, shouldRequeue);
    }
  }

  /**
   * Escucha eventos de prescripciones actualizadas
   * Pattern: prescripcion.actualizada
   */
  @EventPattern('prescripcion.actualizada')
  async handlePrescripcionActualizada(
    @Payload() data: RabbitMQEvent,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      this.logger.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Evento recibido: prescripcion.actualizada',
        correlationId: data.metadata?.correlationId,
        eventId: data.eventId,
        metadata: {
          prescripcionId: data.payload?.id,
        },
      }));

      await this.processPrescripcionActualizada(data);

      channel.ack(originalMsg);

    } catch (error) {
      this.logger.error(`Error procesando prescripcion.actualizada: ${(error as Error).message}`);

      const shouldRequeue = this.shouldRequeue(error as Error, originalMsg);
      channel.nack(originalMsg, false, shouldRequeue);
    }
  }

  /**
   * Escucha notificaciones de sistema
   * Pattern: sistema.notificacion
   */
  @EventPattern('sistema.notificacion')
  async handleSistemaNotificacion(
    @Payload() data: RabbitMQEvent,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      this.logger.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Notificación del sistema recibida',
        correlationId: data.metadata?.correlationId,
        eventId: data.eventId,
        metadata: {
          tipo: data.payload?.tipo,
          severidad: data.payload?.severidad,
        },
      }));

      await this.processSistemaNotificacion(data);

      channel.ack(originalMsg);

    } catch (error) {
      this.logger.error(`Error procesando notificación: ${(error as Error).message}`);
      
      channel.nack(originalMsg, false, false); // No reencolar notificaciones
    }
  }

  // ============================================
  // PROCESAMIENTO DE EVENTOS
  // ============================================

  private async processComparacionCompletada(event: RabbitMQEvent) {
    this.logger.debug(`Procesando comparación ${event.payload?.id}`);
    
    // Lógica de negocio:
    // - Actualizar caché
    // - Enviar notificaciones
    // - Actualizar estadísticas
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private async processPrescripcionActualizada(event: RabbitMQEvent) {
    this.logger.debug(`Procesando prescripción actualizada ${event.payload?.id}`);
    
    // Lógica de negocio:
    // - Invalidar caché relacionada
    // - Notificar a servicios dependientes
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private async processSistemaNotificacion(event: RabbitMQEvent) {
    this.logger.log(`📢 Notificación: ${event.payload?.mensaje}`);
    
    // Lógica de notificaciones:
    // - Registrar en log
    // - Enviar a sistema de alertas
    // - Actualizar dashboard
    
    await new Promise(resolve => setTimeout(resolve, 20));
  }

  // ============================================
  // UTILIDADES
  // ============================================

  private shouldRequeue(error: Error, message: any): boolean {
    const deliveryCount = message.properties.headers?.['x-delivery-count'] || 0;
    
    if (deliveryCount >= 3) {
      this.logger.warn(`Mensaje rechazado permanentemente después de ${deliveryCount} intentos`);
      return false;
    }

    const temporaryErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET'];
    const isTemporary = temporaryErrors.some(err => 
      error.message.includes(err) || (error as any).code === err
    );

    return isTemporary;
  }

  /**
   * Obtiene estadísticas básicas
   */
  getStats() {
    return {
      timestamp: new Date().toISOString(),
      status: 'active',
      listeners: [
        'comparacion.completada',
        'prescripcion.actualizada',
        'sistema.notificacion',
      ],
    };
  }
}
