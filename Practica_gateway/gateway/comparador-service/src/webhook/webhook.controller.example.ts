import { Controller, Post, Body, Headers, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { WebhookConsumerService } from './webhook-consumer.service.example';

/**
 * Controlador HTTP para recibir webhooks
 * 
 * Este controlador expone endpoints REST para que sistemas externos
 * puedan recibir notificaciones de eventos del sistema.
 */
@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly webhookConsumer: WebhookConsumerService
  ) {}

  /**
   * Endpoint para recibir webhooks de prescripciones
   * 
   * POST /webhook/prescripcion
   */
  @Post('prescripcion')
  async handlePrescripcionWebhook(
    @Body() payload: any,
    @Headers('x-webhook-signature') signature: string,
    @Headers('x-event-id') eventId: string,
  ) {
    try {
      // 1. Validar que el payload tenga estructura básica
      if (!payload.event_type || !payload.event_id || !payload.data) {
        throw new HttpException(
          'Payload inválido: campos requeridos faltantes',
          HttpStatus.BAD_REQUEST
        );
      }

      // 2. Validar tipo de evento
      if (payload.event_type !== 'prescripcion.registrada') {
        throw new HttpException(
          `Tipo de evento inesperado: ${payload.event_type}`,
          HttpStatus.BAD_REQUEST
        );
      }

      // 3. Validar firma HMAC (si está configurada)
      if (signature && !this.webhookConsumer.validateSignature(payload, signature)) {
        this.logger.warn(`Firma inválida para evento: ${payload.event_id}`);
        throw new HttpException(
          'Firma de webhook inválida',
          HttpStatus.UNAUTHORIZED
        );
      }

      // 4. Procesar webhook de forma asíncrona
      // Encolar para procesamiento en background si es necesario
      await this.webhookConsumer.handlePrescripcionRegistrada(payload);

      // 5. Responder inmediatamente (< 30 segundos)
      return {
        status: 'success',
        message: 'Webhook procesado correctamente',
        event_id: payload.event_id,
        processed_at: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Error procesando webhook de prescripción:', error);

      // Distinguir entre errores temporales y permanentes
      if (error instanceof HttpException) {
        throw error;
      }

      // Error temporal: indicar que se puede reintentar
      throw new HttpException(
        'Error temporal procesando webhook',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Endpoint para recibir webhooks de comparaciones
   * 
   * POST /webhook/comparacion
   */
  @Post('comparacion')
  async handleComparacionWebhook(
    @Body() payload: any,
    @Headers('x-webhook-signature') signature: string,
    @Headers('x-event-id') eventId: string,
  ) {
    try {
      // 1. Validar estructura básica
      if (!payload.event_type || !payload.event_id || !payload.data) {
        throw new HttpException(
          'Payload inválido: campos requeridos faltantes',
          HttpStatus.BAD_REQUEST
        );
      }

      // 2. Validar tipo de evento
      if (payload.event_type !== 'comparacion.realizada') {
        throw new HttpException(
          `Tipo de evento inesperado: ${payload.event_type}`,
          HttpStatus.BAD_REQUEST
        );
      }

      // 3. Validar firma HMAC
      if (signature && !this.webhookConsumer.validateSignature(payload, signature)) {
        this.logger.warn(`Firma inválida para evento: ${payload.event_id}`);
        throw new HttpException(
          'Firma de webhook inválida',
          HttpStatus.UNAUTHORIZED
        );
      }

      // 4. Procesar webhook
      await this.webhookConsumer.handleComparacionRealizada(payload);

      // 5. Responder inmediatamente
      return {
        status: 'success',
        message: 'Webhook procesado correctamente',
        event_id: payload.event_id,
        processed_at: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Error procesando webhook de comparación:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Error temporal procesando webhook',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Endpoint genérico para cualquier evento
   * 
   * POST /webhook/events
   */
  @Post('events')
  async handleGenericWebhook(
    @Body() payload: any,
    @Headers('x-webhook-signature') signature: string,
    @Headers('x-event-type') eventType: string,
  ) {
    try {
      // Validar estructura
      if (!payload.event_type || !payload.event_id || !payload.data) {
        throw new HttpException(
          'Payload inválido',
          HttpStatus.BAD_REQUEST
        );
      }

      // Validar firma
      if (signature && !this.webhookConsumer.validateSignature(payload, signature)) {
        throw new HttpException(
          'Firma inválida',
          HttpStatus.UNAUTHORIZED
        );
      }

      // Rutear según tipo de evento
      switch (payload.event_type) {
        case 'prescripcion.registrada':
          await this.webhookConsumer.handlePrescripcionRegistrada(payload);
          break;
        
        case 'comparacion.realizada':
          await this.webhookConsumer.handleComparacionRealizada(payload);
          break;
        
        default:
          this.logger.warn(`Tipo de evento no soportado: ${payload.event_type}`);
          throw new HttpException(
            `Evento no soportado: ${payload.event_type}`,
            HttpStatus.BAD_REQUEST
          );
      }

      return {
        status: 'success',
        message: 'Webhook procesado correctamente',
        event_id: payload.event_id,
        event_type: payload.event_type,
        processed_at: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Error procesando webhook genérico:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Error temporal',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Endpoint de health check para webhooks
   * 
   * GET /webhook/health
   */
  @Post('health')
  healthCheck() {
    return {
      status: 'ok',
      service: 'webhook-receiver',
      timestamp: new Date().toISOString()
    };
  }
}
