import { Injectable, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { ObservabilityService } from '../webhook/observability.service';
import { DistributedTracingService } from '../webhook/distributed-tracing.service';
import { EventTransformerService } from '../webhook/event-transformer.service';
import { WebhookDeliveryService } from '../webhook/webhook-delivery.service';
import { IdempotencyService } from './idempotency.service';

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
 * RabbitMQ Event Listener Service
 * 
 * Escucha eventos de RabbitMQ con observabilidad completa:
 * - Logging estructurado JSON
 * - Distributed tracing
 * - Propagación de contexto
 * - Manejo de errores
 * - ACK/NACK automático
 * - Transformación a formato estándar de webhook
 */
@Injectable()
export class RabbitMQEventListenerService {
  private readonly logger = new Logger(RabbitMQEventListenerService.name);

  constructor(
    private readonly observability: ObservabilityService,
    private readonly tracing: DistributedTracingService,
    private readonly transformer: EventTransformerService,
    private readonly delivery: WebhookDeliveryService,
    private readonly idempotency: IdempotencyService,
  ) {}

  /**
   * Escucha eventos de productos creados
   * Pattern: producto.creado
   */
  @EventPattern('producto.creado')
  async handleProductoCreado(
    @Payload() data: RabbitMQEvent,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    // Crear contexto de correlación desde el evento
    const correlationContext = this.observability.createContext(undefined, {
      correlationId: data.metadata?.correlationId,
      traceId: data.metadata?.traceId,
    });

    // Trazar operación completa
    return await this.tracing.traceOperation(
      'rabbitmq.producto.creado',
      async (span) => {
        try {
          // ============================================
          // VERIFICACIÓN DE IDEMPOTENCIA
          // ============================================
          const idempotencyKey = await this.idempotency.generateKey(
            'producto.creado',
            data.payload?.id || data.eventId,
            'process',
            {
              eventId: data.eventId,
              timestamp: data.timestamp,
            }
          );

          const idempotencyCheck = await this.idempotency.isDuplicate(idempotencyKey);

          if (idempotencyCheck.isDuplicate) {
            this.logger.warn('Mensaje duplicado detectado, omitiendo procesamiento', {
              eventId: data.eventId,
              eventType: 'producto.creado',
              idempotencyKey: idempotencyKey.key,
              originalProcessedAt: idempotencyCheck.existingKey?.processedAt,
              timeSinceProcessing: Date.now() - (idempotencyCheck.existingKey?.processedAt?.getTime() || 0),
            });

            // ACK mensaje duplicado sin reprocesar
            channel.ack(originalMsg);

            return {
              status: 'duplicate',
              message: 'Mensaje ya procesado previamente',
              eventId: data.eventId,
              originalResult: idempotencyCheck.existingKey?.result,
            };
          }

          // Marcar como procesando
          await this.idempotency.markProcessed(idempotencyKey);

          // ============================================
          // PROCESAMIENTO NORMAL
          // ============================================

          // Tags del span
          this.tracing.setSpanTags(span.spanId, {
            eventType: 'producto.creado',
            eventId: data.eventId,
            source: data.metadata?.source || 'unknown',
            messageId: originalMsg.properties.messageId,
            routingKey: originalMsg.fields.routingKey,
            idempotencyKey: idempotencyKey.key,
          });

          // Log estructurado
          this.observability.info('Evento recibido de RabbitMQ', {
            eventType: 'producto.creado',
            eventId: data.eventId,
            productoId: data.payload?.id,
            idempotencyKey: idempotencyKey.key,
          });

          // Transformar evento a formato estándar de webhook
          const transformedEvent = await this.transformer.transformToStandardWebhook(data, {
            includeOriginalEvent: false,
          });

          this.observability.info('Evento transformado a formato estándar', {
            eventId: data.eventId,
            validated: transformedEvent.transformationInfo.validated,
            duration: transformedEvent.transformationInfo.transformationDuration,
          });

          // Enviar webhook a suscripciones registradas
          const deliveries = await this.delivery.deliverWebhook(transformedEvent.webhook);

          this.observability.info('Webhooks enviados', {
            eventId: data.eventId,
            deliveryCount: deliveries.length,
            successful: deliveries.filter(d => d.success).length,
            failed: deliveries.filter(d => !d.success).length,
          });

          // Procesar evento (ahora con formato estándar disponible)
          const processResult = await this.processProductoCreado(data, span, transformedEvent);

          // Actualizar clave de idempotencia con resultado
          await this.idempotency.markProcessed(idempotencyKey, {
            status: 'success',
            deliveries: deliveries.length,
            processResult,
          });

          // ACK mensaje
          channel.ack(originalMsg);

          this.observability.info('Evento procesado exitosamente', {
            eventId: data.eventId,
            eventType: 'producto.creado',
            idempotencyKey: idempotencyKey.key,
          });

          return {
            status: 'success',
            eventId: data.eventId,
            result: processResult,
          };

        } catch (error) {
          // Log de error
          this.observability.error(
            'Error procesando evento de RabbitMQ',
            error as Error,
            {
              eventId: data.eventId,
              eventType: 'producto.creado',
            }
          );

          // NACK con requeue si es error temporal
          const shouldRequeue = this.shouldRequeue(error as Error, originalMsg);
          channel.nack(originalMsg, false, shouldRequeue);

          if (!shouldRequeue) {
            this.logger.error(
              `Mensaje rechazado permanentemente: ${data.eventId}`
            );
          }

          throw error;
        }
      },
      correlationContext?.requestId,
      correlationContext?.traceId
    );
  }

  /**
   * Escucha eventos de productos actualizados
   * Pattern: producto.actualizado
   */
  @EventPattern('producto.actualizado')
  async handleProductoActualizado(
    @Payload() data: RabbitMQEvent,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    const correlationContext = this.observability.createContext(undefined, {
      correlationId: data.metadata?.correlationId,
      traceId: data.metadata?.traceId,
    });

    return await this.tracing.traceOperation(
      'rabbitmq.producto.actualizado',
      async (span) => {
        try {
          this.tracing.setSpanTags(span.spanId, {
            eventType: 'producto.actualizado',
            eventId: data.eventId,
            source: data.metadata?.source || 'unknown',
          });

          this.observability.info('Evento recibido: producto.actualizado', {
            eventId: data.eventId,
            productoId: data.payload?.id,
          });

          await this.processProductoActualizado(data, span);

          channel.ack(originalMsg);

          this.observability.info('Evento procesado: producto.actualizado', {
            eventId: data.eventId,
          });

        } catch (error) {
          this.observability.error(
            'Error en producto.actualizado',
            error as Error,
            { eventId: data.eventId }
          );

          const shouldRequeue = this.shouldRequeue(error as Error, originalMsg);
          channel.nack(originalMsg, false, shouldRequeue);

          throw error;
        }
      },
      correlationContext?.requestId,
      correlationContext?.traceId
    );
  }

  /**
   * Escucha eventos de productos eliminados
   * Pattern: producto.eliminado
   */
  @EventPattern('producto.eliminado')
  async handleProductoEliminado(
    @Payload() data: RabbitMQEvent,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    const correlationContext = this.observability.createContext(undefined, {
      correlationId: data.metadata?.correlationId,
      traceId: data.metadata?.traceId,
    });

    return await this.tracing.traceOperation(
      'rabbitmq.producto.eliminado',
      async (span) => {
        try {
          this.tracing.setSpanTags(span.spanId, {
            eventType: 'producto.eliminado',
            eventId: data.eventId,
          });

          this.observability.info('Evento recibido: producto.eliminado', {
            eventId: data.eventId,
            productoId: data.payload?.id,
          });

          await this.processProductoEliminado(data, span);

          channel.ack(originalMsg);

        } catch (error) {
          this.observability.error(
            'Error en producto.eliminado',
            error as Error,
            { eventId: data.eventId }
          );

          const shouldRequeue = this.shouldRequeue(error as Error, originalMsg);
          channel.nack(originalMsg, false, shouldRequeue);

          throw error;
        }
      },
      correlationContext?.requestId,
      correlationContext?.traceId
    );
  }

  /**
   * Escucha eventos de prescripciones creadas
   * Pattern: prescripcion.creada
   */
  @EventPattern('prescripcion.creada')
  async handlePrescripcionCreada(
    @Payload() data: RabbitMQEvent,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    const correlationContext = this.observability.createContext(undefined, {
      correlationId: data.metadata?.correlationId,
      traceId: data.metadata?.traceId,
    });

    return await this.tracing.traceOperation(
      'rabbitmq.prescripcion.creada',
      async (span) => {
        try {
          this.tracing.setSpanTags(span.spanId, {
            eventType: 'prescripcion.creada',
            eventId: data.eventId,
          });

          this.observability.info('Evento recibido: prescripcion.creada', {
            eventId: data.eventId,
            prescripcionId: data.payload?.id,
          });

          await this.processPrescripcionCreada(data, span);

          channel.ack(originalMsg);

        } catch (error) {
          this.observability.error(
            'Error en prescripcion.creada',
            error as Error,
            { eventId: data.eventId }
          );

          const shouldRequeue = this.shouldRequeue(error as Error, originalMsg);
          channel.nack(originalMsg, false, shouldRequeue);

          throw error;
        }
      },
      correlationContext?.requestId,
      correlationContext?.traceId
    );
  }

  /**
   * Escucha cualquier otro evento
   * Pattern: *
   */
  @EventPattern('*')
  async handleGenericEvent(
    @Payload() data: RabbitMQEvent,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    const correlationContext = this.observability.createContext(undefined, {
      correlationId: data.metadata?.correlationId,
      traceId: data.metadata?.traceId,
    });

    return await this.tracing.traceOperation(
      'rabbitmq.generic.event',
      async (span) => {
        try {
          this.tracing.setSpanTags(span.spanId, {
            eventType: data.eventType || 'unknown',
            eventId: data.eventId,
          });

          this.observability.info('Evento genérico recibido', {
            eventType: data.eventType,
            eventId: data.eventId,
          });

          // ACK automático para eventos no manejados específicamente
          channel.ack(originalMsg);

        } catch (error) {
          this.observability.error(
            'Error en evento genérico',
            error as Error,
            { eventId: data.eventId }
          );

          channel.nack(originalMsg, false, false);
        }
      },
      correlationContext?.requestId,
      correlationContext?.traceId
    );
  }

  // ============================================
  // PROCESAMIENTO DE EVENTOS
  // ============================================

  /**
   * Procesa producto creado
   */
  private async processProductoCreado(
    event: RabbitMQEvent, 
    span: any, 
    standardWebhook?: any
  ) {
    return await this.tracing.traceOperation(
      'process.producto.creado',
      async (childSpan) => {
        // Lógica de negocio aquí
        this.logger.debug(`Procesando producto creado: ${event.payload?.id}`);

        // El evento está disponible en formato estándar
        if (standardWebhook) {
          this.logger.debug('Webhook estándar disponible', {
            headers: Object.keys(standardWebhook.webhook.headers),
            validated: standardWebhook.transformationInfo.validated,
          });
        }

        // Simular procesamiento
        await new Promise(resolve => setTimeout(resolve, 50));

        // Ejemplo: Actualizar read model, enviar webhook externo, etc.
        // Aquí podrías usar standardWebhook.webhook para enviar a sistemas externos
      },
      span.spanId,
      span.traceId
    );
  }

  /**
   * Procesa producto actualizado
   */
  private async processProductoActualizado(
    event: RabbitMQEvent, 
    span: any, 
    standardWebhook?: any
  ) {
    return await this.tracing.traceOperation(
      'process.producto.actualizado',
      async () => {
        this.logger.debug(`Procesando producto actualizado: ${event.payload?.id}`);
        
        if (standardWebhook) {
          this.logger.debug('Formato estándar disponible para envío externo');
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
      },
      span.spanId,
      span.traceId
    );
  }

  /**
   * Procesa producto eliminado
   */
  private async processProductoEliminado(
    event: RabbitMQEvent, 
    span: any, 
    standardWebhook?: any
  ) {
    return await this.tracing.traceOperation(
      'process.producto.eliminado',
      async () => {
        this.logger.debug(`Procesando producto eliminado: ${event.payload?.id}`);
        
        if (standardWebhook) {
          this.logger.debug('Formato estándar listo para notificaciones');
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
      },
      span.spanId,
      span.traceId
    );
  }

  /**
   * Procesa prescripción creada
   */
  private async processPrescripcionCreada(event: RabbitMQEvent, span: any) {
    return await this.tracing.traceOperation(
      'process.prescripcion.creada',
      async () => {
        this.logger.debug(`Procesando prescripción creada: ${event.payload?.id}`);
        await new Promise(resolve => setTimeout(resolve, 50));
      },
      span.spanId,
      span.traceId
    );
  }

  // ============================================
  // UTILIDADES
  // ============================================

  /**
   * Determina si un mensaje debe ser reencolado
   */
  private shouldRequeue(error: Error, message: any): boolean {
    // No reencolar si ya se intentó muchas veces
    const deliveryCount = message.properties.headers?.['x-delivery-count'] || 0;
    
    if (deliveryCount >= 3) {
      this.logger.warn(
        `Mensaje ha sido intentado ${deliveryCount} veces, rechazando permanentemente`
      );
      return false;
    }

    // Errores temporales que pueden reintentarse
    const temporaryErrors = [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ECONNRESET',
      'ENOTFOUND',
    ];

    const isTemporary = temporaryErrors.some(err => 
      error.message.includes(err) || (error as any).code === err
    );

    return isTemporary;
  }

  /**
   * Obtiene estadísticas de procesamiento
   */
  getStats() {
    const perfMetrics = this.observability.getMetrics();
    const traceStats = this.tracing.getTraceStats();

    const rabbitMQMetrics = perfMetrics.filter(m => 
      m.operation.startsWith('rabbitmq.')
    );

    return {
      timestamp: new Date().toISOString(),
      totalEventsProcessed: rabbitMQMetrics.reduce((sum, m) => sum + m.totalCalls, 0),
      avgProcessingTime: rabbitMQMetrics.reduce((sum, m) => sum + m.avgDuration, 0) / rabbitMQMetrics.length || 0,
      successRate: rabbitMQMetrics.reduce((sum, m) => sum + m.successRate, 0) / rabbitMQMetrics.length || 100,
      byEventType: rabbitMQMetrics.map(m => ({
        eventType: m.operation.replace('rabbitmq.', ''),
        totalCalls: m.totalCalls,
        successRate: m.successRate,
        avgDuration: m.avgDuration,
      })),
      tracing: {
        activeSpans: traceStats.activeSpans,
        errorRate: traceStats.errorRate,
      },
    };
  }
}
